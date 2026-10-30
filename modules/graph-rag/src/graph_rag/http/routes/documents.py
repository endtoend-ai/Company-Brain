from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, Query, UploadFile
from pydantic import BaseModel, Field

from graph_rag.core.documents import (
    archive_document,
    create_text_document,
    create_uploaded_document,
    get_readable_document,
    list_readable_documents,
    process_document_ingest,
)
from graph_rag.core.sources import get_source_by_id
from graph_rag.core.types import UserContext
from graph_rag.http.auth import require_internal_user
from graph_rag.http.errors import raise_http_error
from graph_rag.http.serializers import to_public_document

router = APIRouter(prefix="/graph")


class TextDocumentRequest(BaseModel):
    source_id: str
    text: str = Field(min_length=1)
    title: str | None = Field(default=None, max_length=180)
    metadata: dict | None = None


@router.post("/documents/text", status_code=201)
async def create_text_document_route(
    body: TextDocumentRequest,
    background_tasks: BackgroundTasks,
    user: UserContext = Depends(require_internal_user),
) -> dict:
    try:
        document = await create_text_document(user, body.source_id, body.text, title=body.title, metadata=body.metadata)
        source = await get_source_by_id(document.source_id)
        background_tasks.add_task(process_document_ingest, source, document.id, document.content_text)
        return {"document": to_public_document(document)}
    except Exception as error:
        raise_http_error(error)


@router.post("/documents/upload", status_code=201)
async def upload_document_route(
    background_tasks: BackgroundTasks,
    source_id: str = Form(...),
    file: UploadFile = File(...),
    user: UserContext = Depends(require_internal_user),
) -> dict:
    try:
        content = await file.read()
        document = await create_uploaded_document(user, source_id, file.filename or "document.txt", content, file.content_type)
        source = await get_source_by_id(document.source_id)
        background_tasks.add_task(process_document_ingest, source, document.id, document.content_text)
        return {"document": to_public_document(document)}
    except Exception as error:
        raise_http_error(error)


@router.get("/documents")
async def list_documents_route(
    source_id: str | None = Query(default=None),
    user: UserContext = Depends(require_internal_user),
) -> dict:
    try:
        documents = await list_readable_documents(user, source_id)
        return {"documents": [to_public_document(document) for document in documents]}
    except Exception as error:
        raise_http_error(error)


@router.get("/documents/{document_id}")
async def get_document_route(document_id: str, user: UserContext = Depends(require_internal_user)) -> dict:
    try:
        document = await get_readable_document(user, document_id)
        return {"document": to_public_document(document, include_content=True)}
    except Exception as error:
        raise_http_error(error)


@router.delete("/documents/{document_id}")
async def delete_document_route(document_id: str, user: UserContext = Depends(require_internal_user)) -> dict:
    try:
        document = await archive_document(user, document_id)
        return {"document": to_public_document(document), "archived": True}
    except Exception as error:
        raise_http_error(error)
