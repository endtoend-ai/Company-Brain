# Retrieval Benchmarks

CompanyBrain ships a small, reproducible English benchmark so the three retrieval engines can be
compared on the same corpus. The numbers are a regression check for the demo dataset, not a
production benchmark.

## Corpus

`eval/corpus/en/docs/` contains seven Markdown documents (about 1,800 words) describing a fictional
San Francisco B2B SaaS company, Northwind Labs, and two of its customers. The corpus is deliberately
dense in named entities, dates, money, policies, and cross-document relationships so that all three
engines have something meaningful to retrieve.

## Query sets

| Engine | File | Queries | Scoring |
| --- | --- | --- | --- |
| Naive RAG | `eval/golden/en/traditional.jsonl` | 10 | document-level recall@1/3/5/10, MRR |
| Gbrain (Nano Brain) | `eval/golden/en/nano-brain.jsonl` | 10 | document-level recall@1/3/5/10, MRR (slug anchors) |
| GraphRAG | `eval/golden/en/graph-rag.jsonl` | 8 | keyword coverage, non-empty rate |

GraphRAG returns graph context rather than ranked document IDs, so it is scored by whether the
expected entities and relationships appear in the returned context.

## Reproduce

```bash
# 1. Recreate a clean local demo environment
./scripts/reset-demo-data.sh --yes
bun run db:init
bun run admin:create
bun run dev:all            # keep the stack running in another terminal

# 2. Ingest the corpus and build the three product scenarios
bun run demo:seed

# 3. Run the benchmark
bun run demo:eval

# 4. Render the chart used by the README
bun run demo:chart
```

Reports and machine-readable summaries land in `eval/reports/` (`*-en.md`, `*-en-summary.json`).

## Results

| Engine | Queries | Recall@1 | Recall@3 | Recall@5 | Recall@10 | MRR | p50 latency | p95 latency |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Naive RAG | 10 | 0.900 | 1.000 | 1.000 | 1.000 | 0.950 | 1,583 ms | 2,779 ms |
| Gbrain (Nano Brain) | 10 | 0.800 | 1.000 | 1.000 | 1.000 | 0.900 | 1,696 ms | 4,414 ms |

GraphRAG is scored by evidence coverage instead of document recall:

| Engine | Queries | Keyword coverage | Non-empty context | p50 latency | p95 latency |
| --- | --- | --- | --- | --- | --- |
| GraphRAG | 8 | 1.000 | 8/8 | 3,318 ms | 7,577 ms |

Measured with DeepSeek Flash for generation and GraphRAG extraction, `qwen/qwen3-embedding-8b`
(1024 dimensions) for embeddings, and `qwen3-rerank` for reranking. Latency includes the embedding
request and therefore varies with provider/network conditions.

## Limitations

- Seven documents is enough to catch ranking regressions, not enough to claim retrieval quality at
  scale.
- Latency includes the embedding request to the configured provider and therefore depends on
  network conditions.
- GraphRAG extraction quality depends on the configured chat model and on LightRAG's entity
  resolution; the corpus is written with explicit relations to keep results stable.
