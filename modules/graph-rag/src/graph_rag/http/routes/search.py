from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from graph_rag.core.search import ask, search
from graph_rag.core.graph_stats import graph_stats
from graph_rag.core import graph_curation
from graph_rag.core.types import UserContext
from graph_rag.http.auth import require_internal_user
from graph_rag.http.errors import raise_http_error

router = APIRouter(prefix="/graph")


class QueryRequest(BaseModel):
    query: str = Field(min_length=1, max_length=2000)
    limit: int = Field(default=10, ge=1, le=30)
    source_id: str | None = None
    mode: str = Field(default="mix", pattern="^(local|global|hybrid|naive|mix)$")


class MergeEntitiesRequest(BaseModel):
    source_id: str = Field(min_length=1)
    source_entities: list[str] = Field(min_length=1)
    target_entity: str = Field(min_length=1)


class EditEntityRequest(BaseModel):
    source_id: str = Field(min_length=1)
    entity_name: str = Field(min_length=1)
    updated_data: dict = Field(default_factory=dict)


class EntityRequest(BaseModel):
    source_id: str = Field(min_length=1)
    entity_name: str = Field(min_length=1)


class EditRelationRequest(BaseModel):
    source_id: str = Field(min_length=1)
    source_entity: str = Field(min_length=1)
    target_entity: str = Field(min_length=1)
    updated_data: dict = Field(default_factory=dict)


class RelationRequest(BaseModel):
    source_id: str = Field(min_length=1)
    source_entity: str = Field(min_length=1)
    target_entity: str = Field(min_length=1)


@router.post("/search")
async def search_route(body: QueryRequest, user: UserContext = Depends(require_internal_user)) -> dict:
    try:
        return await search(user, body.query, body.limit, source_id=body.source_id, mode=body.mode)
    except Exception as error:
        raise_http_error(error)


@router.post("/ask")
async def ask_route(body: QueryRequest, user: UserContext = Depends(require_internal_user)) -> dict:
    try:
        return await ask(user, body.query, body.limit, source_id=body.source_id, mode=body.mode)
    except Exception as error:
        raise_http_error(error)


@router.get("/graph-stats")
async def graph_stats_route(user: UserContext = Depends(require_internal_user)) -> dict:
    """图谱健康统计:实体/关系规模、来源、重复实体候选(curate 信号)。后台图谱型监控面板用。"""
    try:
        return graph_stats()
    except Exception as error:
        raise_http_error(error)


@router.get("/curation/detail")
async def graph_detail_route(source_id: str, max_nodes: int = 200, user: UserContext = Depends(require_internal_user)) -> dict:
    """列出某 source 图谱的实体与关系,供 curate 工作台。"""
    try:
        return await graph_curation.graph_detail(user, source_id, max_nodes=max_nodes)
    except Exception as error:
        raise_http_error(error)


@router.post("/curation/entities/merge")
async def merge_entities_route(body: MergeEntitiesRequest, user: UserContext = Depends(require_internal_user)) -> dict:
    try:
        return await graph_curation.merge_entities(user, body.source_id, body.source_entities, body.target_entity)
    except Exception as error:
        raise_http_error(error)


@router.post("/curation/entities/edit")
async def edit_entity_route(body: EditEntityRequest, user: UserContext = Depends(require_internal_user)) -> dict:
    try:
        return await graph_curation.edit_entity(user, body.source_id, body.entity_name, body.updated_data)
    except Exception as error:
        raise_http_error(error)


@router.post("/curation/entities/delete")
async def delete_entity_route(body: EntityRequest, user: UserContext = Depends(require_internal_user)) -> dict:
    try:
        return await graph_curation.delete_entity(user, body.source_id, body.entity_name)
    except Exception as error:
        raise_http_error(error)


@router.post("/curation/relations/edit")
async def edit_relation_route(body: EditRelationRequest, user: UserContext = Depends(require_internal_user)) -> dict:
    try:
        return await graph_curation.edit_relation(user, body.source_id, body.source_entity, body.target_entity, body.updated_data)
    except Exception as error:
        raise_http_error(error)


@router.post("/curation/relations/delete")
async def delete_relation_route(body: RelationRequest, user: UserContext = Depends(require_internal_user)) -> dict:
    try:
        return await graph_curation.delete_relation(user, body.source_id, body.source_entity, body.target_entity)
    except Exception as error:
        raise_http_error(error)
