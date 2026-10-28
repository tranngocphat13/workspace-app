-- Full-text search index on messages.content
-- pg_trgm for substring/ILIKE support
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_messages_content_trgm
  ON public.messages USING gin (content gin_trgm_ops);

-- Also index created_at for ordering search results
CREATE INDEX IF NOT EXISTS idx_messages_created_at
  ON public.messages (created_at DESC);
