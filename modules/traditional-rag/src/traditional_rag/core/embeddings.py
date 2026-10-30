from __future__ import annotations

import json
import math
import time
import urllib.error
import urllib.request
from typing import Any

from traditional_rag.config import get_settings
from traditional_rag.core.errors import TraditionalRagError


def _require_embedding_settings() -> tuple[str, str, str]:
    settings = get_settings()
    if settings.embedding_provider != "openai-compatible":
        raise TraditionalRagError("Embedding configuration missing: EMBEDDING_PROVIDER must be openai-compatible", "config_error")
    if not settings.embedding_base_url:
        raise TraditionalRagError("Embedding configuration missing: set EMBEDDING_BASE_URL", "config_error")
    if not settings.embedding_api_key:
        raise TraditionalRagError("Embedding configuration missing: set EMBEDDING_API_KEY", "config_error")
    if not settings.embedding_model:
        raise TraditionalRagError("Embedding configuration missing: set EMBEDDING_MODEL", "config_error")
    return settings.embedding_base_url.rstrip("/"), settings.embedding_api_key, settings.embedding_model


def _truncate_normalize(vector: list[float], target_dim: int) -> list[float]:
    # MRL 截断：取前 target_dim 维 + L2 归一化，与存量 SQL l2_normalize(subvector(emb,1,N)) 完全同口径。
    if target_dim <= 0 or target_dim >= len(vector):
        return vector
    truncated = vector[:target_dim]
    norm = math.sqrt(sum(x * x for x in truncated))
    if norm == 0:
        return truncated
    return [x / norm for x in truncated]


def embed_texts(texts: list[str]) -> tuple[list[list[float]], str, int]:
    if not texts:
        return [], get_settings().embedding_model or "", 0
    base_url, api_key, model = _require_embedding_settings()
    payload = {"model": model, "input": texts}
    encoded_payload = json.dumps(payload).encode("utf-8")
    last_network_error: Exception | None = None
    result: dict[str, Any] | None = None
    attempts = 5
    for attempt in range(attempts):
        request = urllib.request.Request(
            f"{base_url}/embeddings",
            data=encoded_payload,
            headers={
                "Accept": "application/json",
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=10) as response:
                body = response.read().decode("utf-8")
                result = json.loads(body)
                break
        except urllib.error.HTTPError as error:
            detail = error.read().decode("utf-8", errors="replace")
            raise TraditionalRagError(f"Embedding API HTTP {error.code}: {detail}", "embedding_error") from error
        except (urllib.error.URLError, TimeoutError, OSError) as error:
            # OpenRouter embedding 端点会间歇性挂起；用短超时 + 快速重试穿过抖动，
            # 而不是在单次请求上干等到 120s。
            last_network_error = error
            if attempt < attempts - 1:
                time.sleep(min(1.0 * (attempt + 1), 3.0))
                continue
        except json.JSONDecodeError as error:
            raise TraditionalRagError("Embedding API returned a non-JSON response", "embedding_error") from error
    if result is None:
        raise TraditionalRagError(f"Embedding API network error: {last_network_error.reason if last_network_error else 'unknown'}", "embedding_error")

    data = result.get("data")
    if not isinstance(data, list) or len(data) != len(texts):
        raise TraditionalRagError(f"Embedding API returned an unexpected number of items: {result}", "embedding_error")
    ordered = sorted(data, key=lambda item: item.get("index", 0) if isinstance(item, dict) else 0)
    vectors: list[list[float]] = []
    for item in ordered:
        if not isinstance(item, dict) or not isinstance(item.get("embedding"), list):
            raise TraditionalRagError(f"Embedding API response is missing an embedding: {item}", "embedding_error")
        vector = [float(value) for value in item["embedding"]]
        if not vector:
            raise TraditionalRagError("Embedding API returned an empty vector", "embedding_error")
        vectors.append(vector)
    dimensions = len(vectors[0])
    if any(len(vector) != dimensions for vector in vectors):
        raise TraditionalRagError("Embedding API returned vectors with inconsistent dimensions", "embedding_error")
    # 降维到配置维度（默认 1024）：MRL 截断 + 归一化，与存量 SQL 迁移同口径，保证 query/chunk 同维。
    target_dim = get_settings().embedding_dimensions
    if 0 < target_dim < dimensions:
        vectors = [_truncate_normalize(vector, target_dim) for vector in vectors]
        dimensions = target_dim
    return vectors, model, dimensions


def vector_literal(vector: list[float]) -> str:
    return "[" + ",".join(f"{value:.8g}" for value in vector) + "]"
