CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  page_number integer NOT NULL CHECK (page_number >= 1),
  chunk_index integer NOT NULL CHECK (chunk_index >= 0),
  text text NOT NULL,
  embedding vector(768),
  UNIQUE (document_id, page_number, chunk_index)
);