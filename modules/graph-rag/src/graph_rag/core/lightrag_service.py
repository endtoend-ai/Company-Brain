import asyncio
import os
from pathlib import Path
from urllib.parse import unquote, urlparse

from graph_rag.config import get_settings
from graph_rag.core.errors import GraphRagError
from graph_rag.core.sources import GraphSource
from graph_rag.db import get_database_url

_instances: dict[str, object] = {}
_instances_lock = asyncio.Lock()


def _require(value: str | None, name: str) -> str:
    if not value:
        raise GraphRagError(f"{name} is not configured", "config_error")
    return value


def _configure_postgres_env() -> None:
    parsed = urlparse(get_database_url())
    os.environ["POSTGRES_HOST"] = parsed.hostname or "127.0.0.1"
    os.environ["POSTGRES_PORT"] = str(parsed.port or 5432)
    os.environ["POSTGRES_USER"] = unquote(parsed.username or "")
    os.environ["POSTGRES_PASSWORD"] = unquote(parsed.password or "")
    os.environ["POSTGRES_DATABASE"] = unquote(parsed.path.lstrip("/"))
    os.environ.setdefault("POSTGRES_VECTOR_INDEX_TYPE", "HNSW")


def _load_lightrag_symbols():
    try:
        from lightrag import LightRAG, QueryParam
        from lightrag.llm.openai import openai_complete_if_cache, openai_embed
        from lightrag.utils import EmbeddingFunc
    except Exception as exc:
        raise GraphRagError(
            "LightRAG Core is not installed or unavailable; install lightrag-hku and check the Python environment",
            "config_error",
        ) from exc
    return LightRAG, QueryParam, openai_complete_if_cache, openai_embed, EmbeddingFunc


def _working_dir() -> str:
    path = Path(os.getenv("GRAPH_RAG_WORKING_DIR", ".graph-rag-workdir")).resolve()
    path.mkdir(parents=True, exist_ok=True)
    return str(path)


async def _llm_model_func(prompt: str, system_prompt: str | None = None, history_messages: list | None = None, **kwargs):
    settings = get_settings()
    _, _, openai_complete_if_cache, _, _ = _load_lightrag_symbols()
    return await openai_complete_if_cache(
        _require(settings.agent_model, "AGENT_MODEL"),
        prompt,
        system_prompt=system_prompt,
        history_messages=history_messages or [],
        api_key=_require(settings.agent_api_key, "AGENT_API_KEY"),
        base_url=_require(settings.agent_base_url, "AGENT_BASE_URL"),
        **kwargs,
    )


async def _embedding_func(texts: list[str]):
    settings = get_settings()
    _, _, _, openai_embed, _ = _load_lightrag_symbols()
    return await openai_embed.func(
        texts,
        model=_require(settings.embedding_model, "EMBEDDING_MODEL"),
        api_key=_require(settings.embedding_api_key, "EMBEDDING_API_KEY"),
        base_url=_require(settings.embedding_base_url, "EMBEDDING_BASE_URL"),
        embedding_dim=settings.embedding_dimensions,
        max_token_size=8192,
    )


async def get_lightrag(source: GraphSource):
    cached = _instances.get(source.workspace)
    if cached is not None:
        return cached

    # C-A2 必修（codex·高）：无锁 check-then-set 在并发冷启动同一 workspace 会建多个实例、
    # 缓存赋值竞争。模块级 asyncio.Lock 双检——热路径(已缓存)不进锁，仅冷启动首次进锁。
    # 已知瓶颈(异源审标注)：全局单锁使不同 workspace 冷启动串行化；本地冷启动低频可接受，规模化再改 per-workspace 锁。
    async with _instances_lock:
        cached = _instances.get(source.workspace)
        if cached is not None:
            return cached

        settings = get_settings()
        LightRAG, _, _, _, EmbeddingFunc = _load_lightrag_symbols()
        _configure_postgres_env()

        rag = LightRAG(
            working_dir=_working_dir(),
            workspace=source.workspace,
            llm_model_func=_llm_model_func,
            llm_model_name=_require(settings.agent_model, "AGENT_MODEL"),
            embedding_func=EmbeddingFunc(
                embedding_dim=settings.embedding_dimensions,
                max_token_size=8192,
                func=_embedding_func,
                model_name=_require(settings.embedding_model, "EMBEDDING_MODEL"),
            ),
            kv_storage="PGKVStorage",
            vector_storage="PGVectorStorage",
            doc_status_storage="PGDocStatusStorage",
            graph_storage="PGGraphStorage",
        )
        await rag.initialize_storages()
        _instances[source.workspace] = rag
        return rag


async def query_source(source: GraphSource, query: str, *, mode: str = "mix", limit: int = 10) -> object:
    rag = await get_lightrag(source)
    _, QueryParam, _, _, _ = _load_lightrag_symbols()
    return await rag.aquery(query, param=QueryParam(mode=mode, top_k=limit, only_need_context=True))


async def insert_document(source: GraphSource, document_id: str, text: str) -> None:
    rag = await get_lightrag(source)
    try:
        await rag.ainsert(text, ids=[document_id])
    except TypeError:
        await rag.ainsert(text)


async def delete_document(source: GraphSource, document_id: str) -> None:
    rag = await get_lightrag(source)
    delete = getattr(rag, "adelete_by_doc_id", None)
    if not delete:
        raise GraphRagError("This LightRAG version does not support deleting by document id", "config_error")
    await delete(document_id)


async def finalize_lightrag_instances() -> None:
    for rag in list(_instances.values()):
        finalize = getattr(rag, "finalize_storages", None)
        if finalize:
            result = finalize()
            if hasattr(result, "__await__"):
                await result
    _instances.clear()
