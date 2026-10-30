from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    service_name: str = "graph-rag"
    http_port: int = Field(default=8102, alias="GRAPH_RAG_HTTP_PORT")
    internal_token: str | None = Field(default=None, alias="RAG_INTERNAL_TOKEN")
    database_url: str | None = Field(default=None, alias="GRAPH_RAG_DATABASE_URL")
    embedding_provider: str | None = Field(default=None, alias="EMBEDDING_PROVIDER")
    embedding_base_url: str | None = Field(default=None, alias="EMBEDDING_BASE_URL")
    embedding_api_key: str | None = Field(default=None, alias="EMBEDDING_API_KEY")
    embedding_model: str | None = Field(default=None, alias="EMBEDDING_MODEL")
    embedding_dimensions: int = Field(default=1024, alias="EMBEDDING_DIMENSIONS")
    agent_base_url: str | None = Field(default=None, alias="AGENT_BASE_URL")
    agent_api_key: str | None = Field(default=None, alias="AGENT_API_KEY")
    agent_model: str | None = Field(default=None, alias="AGENT_MODEL")
    ingest_timeout_seconds: int = Field(default=600, alias="GRAPH_RAG_INGEST_TIMEOUT_SECONDS")
    db_pool_min_size: int = Field(default=1, alias="GRAPH_RAG_DB_POOL_MIN_SIZE")
    db_pool_max_size: int = Field(default=10, alias="GRAPH_RAG_DB_POOL_MAX_SIZE")
    query_timeout_seconds: int = Field(default=30, alias="GRAPH_RAG_QUERY_TIMEOUT_SECONDS")
    query_concurrency: int = Field(default=4, alias="GRAPH_RAG_QUERY_CONCURRENCY")
    query_max_sources: int = Field(default=30, alias="GRAPH_RAG_QUERY_MAX_SOURCES")


def get_settings() -> Settings:
    return Settings()
