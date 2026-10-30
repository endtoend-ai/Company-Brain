"""图谱 curate(可编辑工作台)业务逻辑:列出、合并、编辑、删除实体与关系。

全部经 LightRAG service 真改图谱存储(PGVector + Apache AGE),不绕过 LightRAG
直接写内部表。仅管理员可操作(由 source 的 manageable 权限把关)。
"""

from __future__ import annotations

from graph_rag.core.lightrag_service import get_lightrag
from graph_rag.core.sources import get_manageable_source, get_readable_source
from graph_rag.core.types import UserContext


def _node_to_dict(node) -> dict:
    props = getattr(node, "properties", None) or {}
    return {
        "id": getattr(node, "id", None),
        "name": props.get("entity_id") or props.get("entity_name") or getattr(node, "id", None),
        "type": props.get("entity_type") or "UNKNOWN",
        "description": props.get("description") or "",
        "source": props.get("file_path") or props.get("source_id") or "",
    }


def _edge_to_dict(edge) -> dict:
    props = getattr(edge, "properties", None) or {}
    return {
        "id": getattr(edge, "id", None),
        "source": getattr(edge, "source", None),
        "target": getattr(edge, "target", None),
        "description": props.get("description") or props.get("keywords") or "",
        "weight": props.get("weight"),
    }


async def graph_detail(user: UserContext, source_id: str, max_nodes: int = 200) -> dict:
    """列出某 source 图谱内的实体与关系,供 curate 工作台展示与编辑。"""
    source = await get_readable_source(user, source_id)
    rag = await get_lightrag(source)
    graph = await rag.get_knowledge_graph(node_label="*", max_depth=3, max_nodes=max_nodes)
    raw_nodes = getattr(graph, "nodes", None) or []
    nodes = [_node_to_dict(n) for n in raw_nodes]
    # AGE 返回的 edge.source/target 是内部节点 id;映射回实体名,UI 才看得懂。
    id_to_name = {n["id"]: n["name"] for n in nodes if n.get("id") is not None}
    edges = []
    for e in (getattr(graph, "edges", None) or []):
        d = _edge_to_dict(e)
        d["source"] = id_to_name.get(d["source"], d["source"])
        d["target"] = id_to_name.get(d["target"], d["target"])
        edges.append(d)
    nodes.sort(key=lambda n: (n["name"] or "").lower())
    return {
        "source_id": source.id,
        "source_name": source.name,
        "entities": nodes,
        "relations": edges,
        "entity_count": len(nodes),
        "relation_count": len(edges),
        "truncated": bool(getattr(graph, "is_truncated", False)),
    }


async def merge_entities(user: UserContext, source_id: str, source_entities: list[str], target_entity: str) -> dict:
    """把多个实体合并成一个(典型:把抽取碎片/中英别名合并)。真改图谱。"""
    source = await get_manageable_source(user, source_id)
    rag = await get_lightrag(source)
    result = await rag.amerge_entities(source_entities=source_entities, target_entity=target_entity)
    return {"ok": True, "target": target_entity, "merged": source_entities, "result": _safe(result)}


async def edit_entity(user: UserContext, source_id: str, entity_name: str, updated_data: dict) -> dict:
    """编辑实体名称/类型/描述。真改图谱。"""
    source = await get_manageable_source(user, source_id)
    rag = await get_lightrag(source)
    result = await rag.aedit_entity(entity_name=entity_name, updated_data=updated_data, allow_rename=True)
    return {"ok": True, "entity": entity_name, "result": _safe(result)}


async def delete_entity(user: UserContext, source_id: str, entity_name: str) -> dict:
    """删除实体(及其关联关系)。真改图谱。"""
    source = await get_manageable_source(user, source_id)
    rag = await get_lightrag(source)
    result = await rag.adelete_by_entity(entity_name)
    return {"ok": True, "entity": entity_name, "result": _safe(result)}


async def edit_relation(user: UserContext, source_id: str, src: str, target: str, updated_data: dict) -> dict:
    source = await get_manageable_source(user, source_id)
    rag = await get_lightrag(source)
    result = await rag.aedit_relation(source_entity=src, target_entity=target, updated_data=updated_data)
    return {"ok": True, "source": src, "target": target, "result": _safe(result)}


async def delete_relation(user: UserContext, source_id: str, src: str, target: str) -> dict:
    source = await get_manageable_source(user, source_id)
    rag = await get_lightrag(source)
    result = await rag.adelete_by_relation(src, target)
    return {"ok": True, "source": src, "target": target, "result": _safe(result)}


def _safe(result) -> dict:
    """LightRAG 返回 dict 或 DeletionResult,统一成可序列化 dict,且不外泄内部异常细节。"""
    if isinstance(result, dict):
        return {k: v for k, v in result.items() if isinstance(v, (str, int, float, bool, list)) or v is None}
    status = getattr(result, "status", None)
    message = getattr(result, "message", None)
    return {"status": str(status) if status is not None else "ok", "message": str(message) if message else ""}
