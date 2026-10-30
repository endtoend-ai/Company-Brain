# RAG Pipeline Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strengthen the real Traditional RAG backend with broader document ingestion, structured table retrieval, retrieval diagnostics, and verifiable end-to-end behavior.

**Architecture:** Keep the existing module boundary: `apps/api` only proxies, while `modules/traditional-rag` owns parsing, indexing, retrieval, and asset APIs. Reuse PostgreSQL/pgvector instead of introducing Chroma, FAISS, or Milvus as production stores. Add structured retrieval as a first-class capability beside chunk search and table query.

**Tech Stack:** Python 3.11+, FastAPI, psycopg, PostgreSQL, pgvector, existing OpenRouter-compatible embedding client, MinerU PDF parse cache, Bun workspace scripts.

---

## File Structure

- Modify: `modules/traditional-rag/src/traditional_rag/core/documents.py`
- Modify: `modules/traditional-rag/src/traditional_rag/core/parsers.py`
- Create: `modules/traditional-rag/src/traditional_rag/core/structured.py`
- Modify: `modules/traditional-rag/src/traditional_rag/core/tables.py`
- Modify: `modules/traditional-rag/src/traditional_rag/db/migrations.py`
- Modify: `modules/traditional-rag/src/traditional_rag/http/routes/documents.py`
- Create: `modules/traditional-rag/tests/test_document_detection.py`
- Create: `modules/traditional-rag/tests/test_parsers.py`
- Create: `modules/traditional-rag/tests/test_structured.py`

## Tasks

### Task 1: Document Format Detection And Parsing

- [ ] Write failing `unittest` coverage for HTML, JSON, image, audio, and video detection.
- [ ] Run `uv run python -m unittest discover -s tests -p 'test_*.py'` from `modules/traditional-rag` and confirm failure.
- [ ] Implement stdlib HTML and JSON parsing in `core/parsers.py`.
- [ ] Extend `core/documents.py` detection so HTML/JSON are indexable text assets and image/audio/video are accepted media assets with explicit extractor state.
- [ ] Re-run tests and keep them green.

### Task 2: Structured Retrieval Over Table Rows

- [ ] Write failing `unittest` coverage for field classification, semantic row text, and basic natural-language filter extraction.
- [ ] Create `core/structured.py` with pure helpers first.
- [ ] Add database-backed structured row indexing using existing `embed_texts` and pgvector.
- [ ] Populate structured row index after CSV/XLSX table build.
- [ ] Add `POST /traditional/structured/search`.
- [ ] Re-run tests and module smoke checks.

### Task 3: Real Chain Smoke

- [ ] Create real Markdown, HTML, JSON, CSV, and media sample files.
- [ ] Run database migrations against local PostgreSQL.
- [ ] Upload/process sample files through module API or direct core flow.
- [ ] Verify jobs, documents, chunks, tables, structured rows, and retrieval results.
- [ ] Record IDs/counts/results in the final report.

## Self-Review

- Covers richer document formats, structured retrieval from the RAG advanced materials, and real backend verification.
- Full semantic audio/video extraction is staged behind explicit extractor state because no local ASR/video model boundary exists in the current module.
- No new production vector store is introduced; current PostgreSQL/pgvector remains the source of truth.
