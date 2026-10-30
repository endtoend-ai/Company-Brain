import asyncio
import json
import logging
from dataclasses import dataclass
from hashlib import sha256
from pathlib import PurePath
from uuid import uuid4

from graph_rag.config import get_settings
from graph_rag.core.errors import GraphRagError
from graph_rag.core.lightrag_service import delete_document, insert_document
from graph_rag.core.sources import GraphSource, assert_can_manage_source, assert_can_read_source, get_source_by_id
from graph_rag.core.types import UserContext
from graph_rag.db import get_connection

DocumentStatus = str

EXTENSION_TO_FILE_TYPE = {
    ".md": "markdown",
    ".markdown": "markdown",
    ".txt": "txt",
}


@dataclass(frozen=True)
class GraphDocument:
    id: str
    source_id: str
    original_filename: str
    file_type: str
    status: DocumentStatus
    content_hash: str | None
    content_text: str
    metadata: dict
    uploaded_by: str
    created_at: object
    updated_at: object
    archived_at: object | None


def map_document(row: dict) -> GraphDocument:
    return GraphDocument(
        id=row["id"],
        source_id=row["source_id"],
        original_filename=row["original_filename"],
        file_type=row["file_type"],
        status=row["status"],
        content_hash=row["content_hash"],
        content_text=row["content_text"],
        metadata=row["metadata"],
        uploaded_by=row["uploaded_by"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
        archived_at=row["archived_at"],
    )


def safe_original_filename(filename: str) -> str:
    base = PurePath(filename).name.strip()
    if not base:
        return "document.txt"
    safe = "".join(char if char.isalnum() or char in {".", "_", "-", " ", "(", ")"} else "_" for char in base)
    return safe[:180] or "document.txt"


def detect_file_type(filename: str) -> str:
    suffix = PurePath(filename).suffix.lower()
    file_type = EXTENSION_TO_FILE_TYPE.get(suffix)
    if not file_type:
        raise GraphRagError("Unsupported file type: GraphRAG v1 supports Markdown and TXT only", "unsupported_file_type")
    return file_type


def assert_valid_text(text: str) -> str:
    normalized = text.strip()
    if not normalized:
        raise GraphRagError("Document content must not be empty")
    if len(normalized) > 2_000_000:
        raise GraphRagError("Document content must not exceed 2000000 characters")
    return normalized


def _insert_processing_document(
    user: UserContext,
    source_id: str,
    filename: str,
    file_type: str,
    text: str,
    metadata: dict,
) -> GraphDocument:
    document_id = str(uuid4())
    digest = sha256(text.encode("utf-8")).hexdigest()
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO graph_documents (
                  id, source_id, original_filename, file_type, status,
                  content_hash, content_text, metadata, uploaded_by
                )
                VALUES (%s, %s, %s, %s, 'processing', %s, %s, %s::jsonb, %s)
                RETURNING id, source_id, original_filename, file_type, status, content_hash,
                          content_text, metadata, uploaded_by, created_at, updated_at, archived_at
                """,
                (document_id, source_id, filename, file_type, digest, text, json.dumps(metadata), user.user_id),
            )
            document = map_document(cursor.fetchone())
        connection.commit()
        return document


def _mark_document(document_id: str, status: DocumentStatus, metadata_patch: dict | None = None) -> GraphDocument:
    with get_connection() as connection:
        with connection.cursor() as cursor:
            if metadata_patch:
                cursor.execute(
                    """
                    UPDATE graph_documents
                    SET status = %s, metadata = metadata || %s::jsonb, updated_at = now()
                    WHERE id = %s
                    RETURNING id, source_id, original_filename, file_type, status, content_hash,
                              content_text, metadata, uploaded_by, created_at, updated_at, archived_at
                    """,
                    (status, json.dumps(metadata_patch), document_id),
                )
            else:
                cursor.execute(
                    """
                    UPDATE graph_documents
                    SET status = %s, updated_at = now()
                    WHERE id = %s
                    RETURNING id, source_id, original_filename, file_type, status, content_hash,
                              content_text, metadata, uploaded_by, created_at, updated_at, archived_at
                    """,
                    (status, document_id),
                )
            document = map_document(cursor.fetchone())
        connection.commit()
        return document


async def create_text_document(
    user: UserContext,
    source_id: str,
    text: str,
    *,
    title: str | None = None,
    metadata: dict | None = None,
) -> GraphDocument:
    source = await get_source_by_id(source_id)
    if not source:
        raise GraphRagError("Source not found", "not_found")
    assert_can_manage_source(user, source)
    content = assert_valid_text(text)
    filename = safe_original_filename(title or "raw-text.txt")
    document = _insert_processing_document(
        user,
        source_id,
        filename,
        "text",
        content,
        {"ingest_type": "raw_text", **(metadata or {})},
    )
    # C1：插入 processing 行后立即返回，LightRAG 重写入移到后台任务 process_document_ingest。
    return document


async def create_uploaded_document(
    user: UserContext,
    source_id: str,
    filename: str,
    content: bytes,
    content_type: str | None = None,
) -> GraphDocument:
    source = await get_source_by_id(source_id)
    if not source:
        raise GraphRagError("Source not found", "not_found")
    assert_can_manage_source(user, source)
    if not content:
        raise GraphRagError("Uploaded file must not be empty")
    original_filename = safe_original_filename(filename)
    file_type = detect_file_type(original_filename)
    try:
        text = assert_valid_text(content.decode("utf-8"))
    except UnicodeDecodeError as exc:
        raise GraphRagError("File must be UTF-8 encoded text", "unsupported_file_type") from exc
    document = _insert_processing_document(
        user,
        source_id,
        original_filename,
        file_type,
        text,
        {"content_type": content_type, "size_bytes": len(content), "ingest_type": "upload"},
    )
    # C1：插入 processing 行后立即返回，LightRAG 重写入移到后台任务 process_document_ingest。
    return document


async def process_document_ingest(source: GraphSource, document_id: str, text: str) -> None:
    """C1 后台任务：在 HTTP 请求外跑 LightRAG 写入，带超时守卫，结果落 ready/failed。

    codex 必修：wait_for 超时后 cancel 不保证 LightRAG 真停止，可能"标 failed 但图里已半写"，
    故超时 error 用 timeout_may_have_partial_index 标记；检索侧只信任 status='ready' 的文档。
    """
    if source is None:
        # codex 建议：source 可能在上传后被并发删除/归档，重取得 None；不延后到 LightRAG 才炸。
        _mark_document(document_id, "failed", {"error": "source_missing"})
        return
    try:
        await asyncio.wait_for(insert_document(source, document_id, text), timeout=get_settings().ingest_timeout_seconds)
        _mark_document(document_id, "ready")
    except asyncio.TimeoutError:
        logging.getLogger("graph_rag").warning("ingest timed out document_id=%s source=%s", document_id, source.workspace)
        _mark_document(document_id, "failed", {"error": "timeout_may_have_partial_index"})
    except Exception as exc:
        logging.getLogger("graph_rag").exception("ingest failed document_id=%s source=%s", document_id, source.workspace)
        _mark_document(document_id, "failed", {"error": "embedding_failed", "detail": str(exc)[:300]})


def recover_interrupted_documents(started_before) -> int:
    """C1 启动恢复：把启动前残留在 processing 的文档条件更新为 failed(interrupted_by_restart)。

    codex 必修：条件更新 status='processing' + created_at < 启动时刻，避免误伤启动后新上传的在途文档。
    标 failed 而非重跑——LightRAG 写入可能已部分落库，盲目重跑去重/补偿不确定，KISS 让用户重传。
    """
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                UPDATE graph_documents
                SET status = 'failed', metadata = metadata || %s::jsonb, updated_at = now()
                WHERE status = 'processing' AND archived_at IS NULL AND created_at < %s
                """,
                (json.dumps({"error": "interrupted_by_restart"}), started_before),
            )
            count = cursor.rowcount
        connection.commit()
    return count


async def get_document_by_id(document_id: str) -> GraphDocument | None:
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT id, source_id, original_filename, file_type, status, content_hash,
                       content_text, metadata, uploaded_by, created_at, updated_at, archived_at
                FROM graph_documents
                WHERE id = %s AND archived_at IS NULL
                """,
                (document_id,),
            )
            row = cursor.fetchone()
            return map_document(row) if row else None


async def get_readable_document(user: UserContext, document_id: str) -> GraphDocument:
    document = await get_document_by_id(document_id)
    if not document:
        raise GraphRagError("Document not found", "not_found")
    source = await get_source_by_id(document.source_id)
    if not source:
        raise GraphRagError("Source not found", "not_found")
    assert_can_read_source(user, source)
    return document


async def list_readable_documents(user: UserContext, source_id: str | None = None) -> list[GraphDocument]:
    if source_id:
        source = await get_source_by_id(source_id)
        if not source:
            raise GraphRagError("Source not found", "not_found")
        assert_can_read_source(user, source)
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT d.id, d.source_id, d.original_filename, d.file_type, d.status, d.content_hash,
                       d.content_text, d.metadata, d.uploaded_by, d.created_at, d.updated_at, d.archived_at
                FROM graph_documents d
                JOIN graph_sources s ON s.id = d.source_id
                WHERE d.archived_at IS NULL
                  AND (%s::text IS NULL OR d.source_id = %s)
                  AND (%s = true OR s.kind = 'public' OR s.owner_user_id = %s)
                ORDER BY d.created_at DESC
                LIMIT 200
                """,
                (source_id, source_id, user.is_admin, user.user_id),
            )
            return [map_document(row) for row in cursor.fetchall()]


async def archive_document(user: UserContext, document_id: str) -> GraphDocument:
    document = await get_document_by_id(document_id)
    if not document:
        raise GraphRagError("Document not found", "not_found")
    source = await get_source_by_id(document.source_id)
    if not source:
        raise GraphRagError("Source not found", "not_found")
    assert_can_manage_source(user, source)
    await delete_document(source, document.id)
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                UPDATE graph_documents
                SET status = 'archived', archived_at = now(), updated_at = now()
                WHERE id = %s
                RETURNING id, source_id, original_filename, file_type, status, content_hash,
                          content_text, metadata, uploaded_by, created_at, updated_at, archived_at
                """,
                (document_id,),
            )
            archived = map_document(cursor.fetchone())
        connection.commit()
        return archived
