import { NanoBrainError } from './sources';

export type EmbeddingConfig = {
  provider: string;
  baseUrl: string;
  apiKey: string;
  model: string;
};

export function getEmbeddingConfig(): EmbeddingConfig {
  const provider = process.env.EMBEDDING_PROVIDER ?? 'openai-compatible';
  const baseUrl = process.env.EMBEDDING_BASE_URL;
  const apiKey = process.env.EMBEDDING_API_KEY;
  const model = process.env.EMBEDDING_MODEL;

  if (!baseUrl) {
    throw new NanoBrainError('EMBEDDING_BASE_URL is not set', 'embedding_failed');
  }
  if (!apiKey) {
    throw new NanoBrainError('EMBEDDING_API_KEY is not set', 'embedding_failed');
  }
  if (!model) {
    throw new NanoBrainError('EMBEDDING_MODEL is not set', 'embedding_failed');
  }
  if (provider !== 'openai-compatible') {
    throw new NanoBrainError(`Unsupported embedding provider: ${provider}`, 'embedding_failed');
  }

  return { provider, baseUrl, apiKey, model };
}

function embeddingsEndpoint(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/embeddings`;
}

function assertEmbeddingVector(value: unknown): number[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new NanoBrainError('Embedding service returned an empty vector', 'embedding_failed');
  }
  const vector = value.map((item) => Number(item));
  if (vector.some((item) => !Number.isFinite(item))) {
    throw new NanoBrainError('Embedding service returned an invalid vector', 'embedding_failed');
  }
  return vector;
}

// 获取配置的 embedding 维度，默认 1024（与 traditional/graph 的 config default 一致）
export function getEmbeddingDimensions(): number {
  const raw = (process.env.EMBEDDING_DIMENSIONS ?? '').trim();
  // 只接受正整数字符串（与 traditional 的 pydantic int 同严格度），否则退 1024
  return /^[1-9]\d*$/.test(raw) ? Number(raw) : 1024;
}

// MRL 截断 + L2 归一化：与 traditional-rag 的 _truncate_normalize 完全同口径。
// 取前 targetDim 维再归一化；targetDim 无效或不小于原维度时原样返回；norm=0 退未归一化切片。
function truncateNormalize(vector: number[], targetDim: number): number[] {
  if (targetDim <= 0 || targetDim >= vector.length) {
    return vector;
  }
  const sub = vector.slice(0, targetDim);
  const norm = Math.sqrt(sub.reduce((sum, x) => sum + x * x, 0));
  return norm > 0 ? sub.map((x) => x / norm) : sub;
}

export async function embedTexts(texts: string[]): Promise<{ model: string; embeddings: number[][] }> {
  if (texts.length === 0) {
    return { model: getEmbeddingConfig().model, embeddings: [] };
  }

  const config = getEmbeddingConfig();
  // OpenRouter embedding 端点会间歇性挂起 / 限速；fetch 网络错误 + 429/5xx 有界重试穿过抖动，4xx 立即失败（G3）。
  const attempts = 5;
  let response: Response | null = null;
  let lastError: unknown = null;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      response = await fetch(embeddingsEndpoint(config.baseUrl), {
        method: 'POST',
        headers: {
          authorization: `Bearer ${config.apiKey}`,
          'content-type': 'application/json',
          'http-referer': 'http://localhost',
          'x-title': 'FF-CompanyBrain',
        },
        body: JSON.stringify({
          model: config.model,
          input: texts,
        }),
        signal: AbortSignal.timeout(10000),
      });
    } catch (error) {
      // 网络错误（含超时）：重试；耗尽则抛。
      lastError = error;
      if (attempt < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, Math.min(1000 * (attempt + 1), 3000)));
        continue;
      }
      throw new NanoBrainError(`Embedding service network error: ${lastError instanceof Error ? lastError.message : 'unknown'}`, 'embedding_failed');
    }

    // 状态判断在 try/catch 之外，避免不可重试的 4xx throw 被 catch 当网络错误再重试。
    if (response.ok) {
      break;
    }

    const status = response.status;
    if (status === 429 || (status >= 500 && status < 600)) {
      // 限速 / 服务端错误：可重试。
      const message = await response.text().catch(() => '');
      lastError = `HTTP ${status} ${message.slice(0, 300)}`;
      if (attempt < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, Math.min(1000 * (attempt + 1), 3000)));
        continue;
      }
      throw new NanoBrainError(`Embedding service call failed: ${lastError}`, 'embedding_failed');
    }

    // 其它 4xx（400/401/403/404…）：业务失败，立即抛不重试。
    const message = await response.text().catch(() => '');
    throw new NanoBrainError(`Embedding service call failed: HTTP ${status} ${message.slice(0, 300)}`, 'embedding_failed');
  }

  const payload = await response!.json();
  const data = payload?.data;
  if (!Array.isArray(data) || data.length !== texts.length) {
    throw new NanoBrainError('Embedding service returned a different number of vectors than inputs', 'embedding_failed');
  }

  const embeddings = data.map((item: any) => assertEmbeddingVector(item?.embedding));

  // 同批向量维度一致性校验（与 traditional 口径一致，防混合维度污染存储）
  if (embeddings.length > 0) {
    const baseDim = embeddings[0].length;
    for (const vec of embeddings) {
      if (vec.length !== baseDim) {
        throw new NanoBrainError('Embedding service returned vectors with inconsistent dimensions', 'embedding_failed');
      }
    }
  }

  // MRL 截断：按配置维度截断 + L2 归一化，chunk 存储与 query 检索同维同口径（一处改两头生效）
  const targetDim = getEmbeddingDimensions();
  const processedEmbeddings = embeddings.map((vec) => truncateNormalize(vec, targetDim));

  return { model: config.model, embeddings: processedEmbeddings };
}

export function vectorToSqlLiteral(vector: number[]): string {
  return `[${vector.join(',')}]`;
}
