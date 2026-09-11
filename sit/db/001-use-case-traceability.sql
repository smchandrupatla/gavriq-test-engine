CREATE TABLE IF NOT EXISTS sit_case_registry (
  case_id TEXT PRIMARY KEY,
  use_case_id TEXT NOT NULL,
  use_case_name TEXT NOT NULL,
  layer TEXT NOT NULL CHECK (layer IN ('backend', 'frontend', 'specification')),
  executable BOOLEAN NOT NULL,
  definition JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sit_case_registry_use_case_idx ON sit_case_registry(use_case_id);
