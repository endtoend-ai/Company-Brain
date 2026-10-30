import unicodedata
from dataclasses import dataclass
from hashlib import sha1
from uuid import uuid4

from psycopg.errors import UniqueViolation

from graph_rag.core.errors import GraphRagError, GraphRagPermissionError
from graph_rag.core.types import UserContext
from graph_rag.db import get_connection

SourceKind = str


@dataclass(frozen=True)
class GraphSource:
    id: str
    name: str
    description: str
    kind: SourceKind
    workspace: str
    owner_user_id: str | None
    created_by: str
    created_at: object
    updated_at: object
    archived_at: object | None


def normalize_source_name(name: str) -> str:
    return " ".join(name.strip().split())


def assert_valid_source_name(name: str) -> str:
    normalized = normalize_source_name(name)
    if len(normalized) < 3 or len(normalized) > 96:
        raise GraphRagError("source name must be between 3 and 96 characters")
    if any(unicodedata.category(char).startswith("C") for char in normalized):
        raise GraphRagError("source name must not contain control characters")
    return normalized


def map_source(row: dict) -> GraphSource:
    return GraphSource(
        id=row["id"],
        name=row["name"],
        description=row["description"],
        kind=row["kind"],
        workspace=row["workspace"],
        owner_user_id=row["owner_user_id"],
        created_by=row["created_by"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
        archived_at=row["archived_at"],
    )


def workspace_for_source(source_id: str) -> str:
    # LightRAG appends "_chunk_entity_relation" for the AGE graph name.
    # Keep the workspace short enough for PostgreSQL/AGE identifier limits.
    return f"gsrc_{sha1(source_id.encode('utf-8')).hexdigest()[:16]}"


def default_private_source_name(username: str) -> str:
    normalized = normalize_source_name(username).replace("@", "-at-")
    safe = "".join(char if char.isalnum() or char in {"_", ".", "-", "/"} else "-" for char in normalized)
    return f"user/{safe}"


def can_read_source(user: UserContext, source: GraphSource) -> bool:
    return user.is_admin or source.kind == "public" or source.owner_user_id == user.user_id


def can_manage_source(user: UserContext, source: GraphSource) -> bool:
    return user.is_admin or (source.kind == "private" and source.owner_user_id == user.user_id)


def assert_can_read_source(user: UserContext, source: GraphSource) -> None:
    if not can_read_source(user, source):
        raise GraphRagPermissionError("You do not have permission to read this GraphRAG source")


def assert_can_manage_source(user: UserContext, source: GraphSource) -> None:
    if not can_manage_source(user, source):
        raise GraphRagPermissionError("You do not have permission to manage this GraphRAG source")


async def ensure_default_private_source(user_id: str, username: str, actor_user_id: str | None = None) -> GraphSource:
    name = assert_valid_source_name(default_private_source_name(username))
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT id, name, description, kind, workspace, owner_user_id, created_by, created_at, updated_at, archived_at
                FROM graph_sources
                WHERE kind = 'private' AND owner_user_id = %s AND archived_at IS NULL
                ORDER BY created_at ASC
                LIMIT 1
                """,
                (user_id,),
            )
            existing = cursor.fetchone()
            if existing:
                return map_source(existing)
            source_id = str(uuid4())
            cursor.execute(
                """
                INSERT INTO graph_sources (id, name, kind, workspace, owner_user_id, created_by)
                VALUES (%s, %s, 'private', %s, %s, %s)
                RETURNING id, name, description, kind, workspace, owner_user_id, created_by, created_at, updated_at, archived_at
                """,
                (source_id, name, workspace_for_source(source_id), user_id, actor_user_id or user_id),
            )
            created = map_source(cursor.fetchone())
        connection.commit()
        return created


async def create_source(user: UserContext, name: str, kind: SourceKind = "private", description: str = "") -> GraphSource:
    if kind not in {"private", "public"}:
        raise GraphRagError("source kind must be private or public")
    if kind == "public" and not user.is_admin:
        raise GraphRagPermissionError("Only admins can create public sources")
    source_id = str(uuid4())
    source_name = assert_valid_source_name(name)
    owner_user_id = user.user_id if kind == "private" else None
    try:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    INSERT INTO graph_sources (id, name, description, kind, workspace, owner_user_id, created_by)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    RETURNING id, name, description, kind, workspace, owner_user_id, created_by, created_at, updated_at, archived_at
                    """,
                    (source_id, source_name, description.strip(), kind, workspace_for_source(source_id), owner_user_id, user.user_id),
                )
                created = map_source(cursor.fetchone())
            connection.commit()
            return created
    except UniqueViolation as exc:
        raise GraphRagError("source name already exists", "duplicate_source") from exc


async def get_source_by_id(source_id: str) -> GraphSource | None:
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT id, name, description, kind, workspace, owner_user_id, created_by, created_at, updated_at, archived_at
                FROM graph_sources
                WHERE id = %s AND archived_at IS NULL
                """,
                (source_id,),
            )
            row = cursor.fetchone()
            return map_source(row) if row else None


async def get_readable_source(user: UserContext, source_id: str) -> GraphSource:
    source = await get_source_by_id(source_id)
    if not source:
        raise GraphRagError("Source not found", "not_found")
    assert_can_read_source(user, source)
    return source


async def get_manageable_source(user: UserContext, source_id: str) -> GraphSource:
    source = await get_source_by_id(source_id)
    if not source:
        raise GraphRagError("Source not found", "not_found")
    assert_can_manage_source(user, source)
    return source


async def list_readable_sources(user: UserContext) -> list[GraphSource]:
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT id, name, description, kind, workspace, owner_user_id, created_by, created_at, updated_at, archived_at
                FROM graph_sources
                WHERE archived_at IS NULL
                  AND (%s = true OR kind = 'public' OR owner_user_id = %s)
                ORDER BY kind ASC, name ASC
                """,
                (user.is_admin, user.user_id),
            )
            return [map_source(row) for row in cursor.fetchall()]


async def update_source(
    user: UserContext,
    source_id: str,
    *,
    name: str | None = None,
    description: str | None = None,
) -> GraphSource:
    source = await get_source_by_id(source_id)
    if not source:
        raise GraphRagError("Source not found", "not_found")
    assert_can_manage_source(user, source)
    next_name = assert_valid_source_name(name) if name is not None else source.name
    next_description = description.strip() if description is not None else source.description
    try:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    UPDATE graph_sources
                    SET name = %s, description = %s, updated_at = now()
                    WHERE id = %s
                    RETURNING id, name, description, kind, workspace, owner_user_id, created_by, created_at, updated_at, archived_at
                    """,
                    (next_name, next_description, source_id),
                )
                updated = map_source(cursor.fetchone())
            connection.commit()
            return updated
    except UniqueViolation as exc:
        raise GraphRagError("source name already exists", "duplicate_source") from exc
