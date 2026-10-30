import logging
from datetime import datetime, timezone

import uvicorn
from fastapi import FastAPI

from graph_rag.config import get_settings
from graph_rag.core.documents import recover_interrupted_documents
from graph_rag.core.lightrag_service import finalize_lightrag_instances
from graph_rag.db import close_pool
from graph_rag.http.routes.documents import router as documents_router
from graph_rag.http.routes.health import router as health_router
from graph_rag.http.routes.internal import router as internal_router
from graph_rag.http.routes.search import router as search_router
from graph_rag.http.routes.sources import router as sources_router


def create_app() -> FastAPI:
    app = FastAPI(title="FF GraphRAG", version="0.1.0")
    app.include_router(health_router)
    app.include_router(internal_router)
    app.include_router(sources_router)
    app.include_router(documents_router)
    app.include_router(search_router)

    @app.on_event("startup")
    async def recover_on_startup() -> None:
        # C1：把上次进程残留在 processing 的文档标 failed，避免重启后永久卡在 processing。
        try:
            recovered = recover_interrupted_documents(datetime.now(timezone.utc))
            if recovered:
                logging.getLogger("graph_rag").warning("startup recovery: marked %d stale processing documents as failed", recovered)
        except Exception:
            # codex 必修：不静默吞异常——恢复失败必须可见，否则旧 processing 永久卡住且无感知。
            logging.getLogger("graph_rag").exception("startup recovery recover_interrupted_documents failed")

    @app.on_event("shutdown")
    async def shutdown_lightrag() -> None:
        await finalize_lightrag_instances()
        close_pool()  # C3：关闭连接池

    return app


app = create_app()


def main() -> None:
    settings = get_settings()
    uvicorn.run("graph_rag.http.main:app", host="127.0.0.1", port=settings.http_port, reload=True)


if __name__ == "__main__":
    main()
