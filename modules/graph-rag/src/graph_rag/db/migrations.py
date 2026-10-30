from graph_rag.db import get_connection


def migrate_database() -> None:
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute("CREATE EXTENSION IF NOT EXISTS vector;")
            cursor.execute("CREATE EXTENSION IF NOT EXISTS age;")
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS graph_sources (
                  id TEXT PRIMARY KEY,
                  name TEXT NOT NULL,
                  description TEXT NOT NULL DEFAULT '',
                  kind TEXT NOT NULL CHECK (kind IN ('private', 'public')),
                  workspace TEXT NOT NULL UNIQUE,
                  owner_user_id TEXT,
                  created_by TEXT NOT NULL,
                  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                  archived_at TIMESTAMPTZ,
                  CHECK (
                    (kind = 'private' AND owner_user_id IS NOT NULL)
                    OR
                    (kind = 'public' AND owner_user_id IS NULL)
                  )
                );
                """
            )
            cursor.execute(
                """
                CREATE UNIQUE INDEX IF NOT EXISTS idx_graph_sources_private_owner_name
                ON graph_sources (owner_user_id, name)
                WHERE kind = 'private' AND archived_at IS NULL;
                """
            )
            cursor.execute(
                """
                CREATE UNIQUE INDEX IF NOT EXISTS idx_graph_sources_public_name
                ON graph_sources (name)
                WHERE kind = 'public' AND archived_at IS NULL;
                """
            )
            cursor.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_graph_sources_readable
                ON graph_sources (kind, owner_user_id, archived_at);
                """
            )
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS graph_documents (
                  id TEXT PRIMARY KEY,
                  source_id TEXT NOT NULL REFERENCES graph_sources(id) ON DELETE CASCADE,
                  original_filename TEXT NOT NULL,
                  file_type TEXT NOT NULL CHECK (file_type IN ('markdown', 'txt', 'text')),
                  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'ready', 'failed', 'archived')),
                  content_hash TEXT,
                  content_text TEXT NOT NULL,
                  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
                  uploaded_by TEXT NOT NULL,
                  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                  archived_at TIMESTAMPTZ
                );
                """
            )
            cursor.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_graph_documents_source_status
                ON graph_documents (source_id, status, created_at DESC);
                """
            )
            cursor.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_graph_documents_uploaded_by
                ON graph_documents (uploaded_by, created_at DESC);
                """
            )
            cursor.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_graph_documents_metadata_gin
                ON graph_documents USING GIN (metadata);
                """
            )
        connection.commit()


def main() -> None:
    migrate_database()


if __name__ == "__main__":
    main()
