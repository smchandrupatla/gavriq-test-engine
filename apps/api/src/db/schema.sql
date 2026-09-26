-- ============================================================================
-- GAVRIQ Test Engine — Prompt 1 Foundation Schema
-- Application → Release → Component → Feature → Requirement
--   → Test Plan → Test Suite → Scenario → Test Case → Step → Assertion
-- Definitions are separate from executions/results.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE test_type AS ENUM (
    'unit','component','service','api','ui','integration','system','e2e',
    'regression','smoke','sanity','acceptance','contract','database',
    'workflow','event','batch','scheduler','file','performance',
    'security','resilience','deployment','selenium-baseline','other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE test_level AS ENUM ('unit','integration','system','acceptance');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE automation_status AS ENUM (
    'manual','automated','partially_automated','to_be_automated','not_automatable'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE test_lifecycle AS ENUM (
    'draft','ready_for_review','approved','active','maintenance','deprecated','archived'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE execution_status AS ENUM (
    'queued','preparing','running','passed','failed','skipped','blocked','cancelled','error','timed_out'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE result_verdict AS ENUM ('pass','pass_with_conditions','fail','inconclusive');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE severity AS ENUM ('critical','high','medium','low','trivial');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE priority AS ENUM ('p0','p1','p2','p3','p4');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE execution_location AS ENUM (
    'in_container','out_of_container','sidecar','worker_local','remote'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE environment_type AS ENUM (
    'localhost','development','integration','qa','sit','uat',
    'staging','pre_prod','production','docker','kubernetes',
    'aws','azure','gcp','remote'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE safety_category AS ENUM (
    'functional_smoke','read_only_api','write_api','load','stress',
    'soak','chaos','destructive_db','security_scan','deployment'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE failure_classification AS ENUM (
    'application_defect','assertion_failure','environment_problem',
    'infrastructure_failure','network_failure','authentication_problem',
    'test_data_problem','script_problem','dependency_failure',
    'deployment_problem','timeout','unknown'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- Hierarchy: Application → Release → Component → Feature → Requirement
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS applications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key           TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  description   TEXT,
  owner_id      TEXT,
  status        TEXT NOT NULL DEFAULT 'active',
  metadata      JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by    TEXT,
  updated_by    TEXT
);

CREATE TABLE IF NOT EXISTS releases (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id  UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  key             TEXT NOT NULL,
  name            TEXT NOT NULL,
  version         TEXT,
  status          TEXT NOT NULL DEFAULT 'planned',
  released_at     TIMESTAMPTZ,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (application_id, key)
);

CREATE TABLE IF NOT EXISTS components (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id  UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  key             TEXT NOT NULL,
  name            TEXT NOT NULL,
  description     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (application_id, key)
);

CREATE TABLE IF NOT EXISTS features (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  component_id    UUID NOT NULL REFERENCES components(id) ON DELETE CASCADE,
  key             TEXT NOT NULL,
  name            TEXT NOT NULL,
  description     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (component_id, key)
);

CREATE TABLE IF NOT EXISTS requirements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_id      UUID REFERENCES features(id) ON DELETE SET NULL,
  application_id  UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  key             TEXT NOT NULL,
  title           TEXT NOT NULL,
  description     TEXT,
  external_id     TEXT,          -- Jira / Azure DevOps / etc.
  external_url    TEXT,
  status          TEXT NOT NULL DEFAULT 'open',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (application_id, key)
);

-- ---------------------------------------------------------------------------
-- Test Repository: Suites, Plans, Scenarios, Cases, Steps, Assertions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS test_suites (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id  UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  key             TEXT NOT NULL,
  name            TEXT NOT NULL,
  description     TEXT,
  suite_type      TEXT,          -- smoke | regression | api | performance | ...
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      TEXT,
  updated_by      TEXT,
  UNIQUE (application_id, key)
);

CREATE TABLE IF NOT EXISTS test_plans (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id  UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  release_id      UUID REFERENCES releases(id) ON DELETE SET NULL,
  key             TEXT NOT NULL,
  name            TEXT NOT NULL,
  description     TEXT,
  status          TEXT NOT NULL DEFAULT 'draft',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      TEXT,
  updated_by      TEXT,
  UNIQUE (application_id, key)
);

CREATE TABLE IF NOT EXISTS test_plan_suites (
  test_plan_id  UUID NOT NULL REFERENCES test_plans(id) ON DELETE CASCADE,
  test_suite_id UUID NOT NULL REFERENCES test_suites(id) ON DELETE CASCADE,
  mandatory     BOOLEAN NOT NULL DEFAULT false,
  sort_order    INT NOT NULL DEFAULT 0,
  PRIMARY KEY (test_plan_id, test_suite_id)
);

CREATE TABLE IF NOT EXISTS test_scenarios (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id  UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  key             TEXT NOT NULL,
  name            TEXT NOT NULL,
  description     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (application_id, key)
);

CREATE TABLE IF NOT EXISTS test_cases (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key                   TEXT NOT NULL UNIQUE,          -- human-readable e.g. TC-AUTH-001
  name                  TEXT NOT NULL,
  description           TEXT,
  application_id        UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  component_id          UUID REFERENCES components(id) ON DELETE SET NULL,
  feature_id            UUID REFERENCES features(id) ON DELETE SET NULL,
  requirement_id        UUID REFERENCES requirements(id) ON DELETE SET NULL,
  scenario_id           UUID REFERENCES test_scenarios(id) ON DELETE SET NULL,
  test_type             test_type NOT NULL DEFAULT 'other',
  test_level            test_level,
  preconditions         TEXT,
  dependencies          JSONB NOT NULL DEFAULT '[]',   -- array of test_case keys/ids
  test_data_ref         TEXT,
  environment_requirements JSONB NOT NULL DEFAULT '{}',
  execution_location_default execution_location DEFAULT 'out_of_container',
  execution_method      TEXT,                          -- selenium | playwright | pytest | rest | ...
  script                TEXT,                          -- script body or storage ref
  steps                 JSONB NOT NULL DEFAULT '[]',
  expected_results      TEXT,
  assertions            JSONB NOT NULL DEFAULT '[]',
  validation_rules      JSONB NOT NULL DEFAULT '{}',
  timeout_seconds       INT DEFAULT 300,
  retry_policy          JSONB NOT NULL DEFAULT '{"max":0}',
  severity              severity DEFAULT 'medium',
  priority              priority DEFAULT 'p2',
  tags                  TEXT[] NOT NULL DEFAULT '{}',
  owner_id              TEXT,
  author_id             TEXT,
  reviewer_id           TEXT,
  automation_status     automation_status NOT NULL DEFAULT 'manual',
  version               INT NOT NULL DEFAULT 1,
  lifecycle             test_lifecycle NOT NULL DEFAULT 'draft',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by            TEXT,
  updated_by            TEXT
);

CREATE INDEX IF NOT EXISTS idx_test_cases_app ON test_cases(application_id);
CREATE INDEX IF NOT EXISTS idx_test_cases_lifecycle ON test_cases(lifecycle);
CREATE INDEX IF NOT EXISTS idx_test_cases_type ON test_cases(test_type);
CREATE INDEX IF NOT EXISTS idx_test_cases_tags ON test_cases USING GIN(tags);

CREATE TABLE IF NOT EXISTS test_case_suites (
  test_case_id  UUID NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
  test_suite_id UUID NOT NULL REFERENCES test_suites(id) ON DELETE CASCADE,
  sort_order    INT NOT NULL DEFAULT 0,
  PRIMARY KEY (test_case_id, test_suite_id)
);

CREATE TABLE IF NOT EXISTS test_case_versions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_case_id  UUID NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
  version       INT NOT NULL,
  snapshot      JSONB NOT NULL,
  change_summary TEXT,
  created_by    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (test_case_id, version)
);

CREATE TABLE IF NOT EXISTS test_steps (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_case_id  UUID NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
  step_order    INT NOT NULL,
  action        TEXT NOT NULL,
  data          JSONB NOT NULL DEFAULT '{}',
  expected      TEXT,
  is_reusable   BOOLEAN NOT NULL DEFAULT false,
  reusable_key  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS assertions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_case_id  UUID REFERENCES test_cases(id) ON DELETE CASCADE,
  test_step_id  UUID REFERENCES test_steps(id) ON DELETE CASCADE,
  assertion_type TEXT NOT NULL,   -- equals | contains | schema | status_code | ...
  expression    TEXT NOT NULL,
  expected_value TEXT,
  is_reusable   BOOLEAN NOT NULL DEFAULT false,
  reusable_key  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Environments (Prompt 3 foundation)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS environments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key             TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  env_type        environment_type NOT NULL DEFAULT 'development',
  base_url        TEXT,
  config          JSONB NOT NULL DEFAULT '{}',
  secrets_ref     TEXT,                    -- vault path / secret manager ref — NEVER raw secrets
  safety_policy   JSONB NOT NULL DEFAULT '{}', -- category → allowed|approval_required|prohibited
  worker_affinity TEXT[],
  status          TEXT NOT NULL DEFAULT 'active',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      TEXT,
  updated_by      TEXT
);

-- ---------------------------------------------------------------------------
-- Executions & Results (separate from definitions)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS executions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key                 TEXT NOT NULL UNIQUE,
  requested_by        TEXT,
  test_plan_id        UUID REFERENCES test_plans(id) ON DELETE SET NULL,
  test_suite_id       UUID REFERENCES test_suites(id) ON DELETE SET NULL,
  test_case_ids       UUID[] NOT NULL DEFAULT '{}',
  environment_id      UUID REFERENCES environments(id) ON DELETE SET NULL,
  execution_location  execution_location DEFAULT 'out_of_container',
  worker_id           TEXT,
  status              execution_status NOT NULL DEFAULT 'queued',
  trigger_source      TEXT NOT NULL DEFAULT 'manual', -- manual|schedule|ci|agent|api
  started_at          TIMESTAMPTZ,
  finished_at         TIMESTAMPTZ,
  safety_override_id  TEXT,
  metadata            JSONB NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_executions_status ON executions(status);
CREATE INDEX IF NOT EXISTS idx_executions_env ON executions(environment_id);

CREATE TABLE IF NOT EXISTS execution_results (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id        UUID NOT NULL REFERENCES executions(id) ON DELETE CASCADE,
  test_case_id        UUID NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
  status              execution_status NOT NULL,
  verdict             result_verdict,
  duration_ms         INT,
  started_at          TIMESTAMPTZ,
  finished_at         TIMESTAMPTZ,
  message             TEXT,
  classification      failure_classification,
  metrics             JSONB NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_execution_results_exec ON execution_results(execution_id);
CREATE INDEX IF NOT EXISTS idx_execution_results_case ON execution_results(test_case_id);

CREATE TABLE IF NOT EXISTS evidence (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_result_id UUID NOT NULL REFERENCES execution_results(id) ON DELETE CASCADE,
  evidence_type       TEXT NOT NULL,  -- log|screenshot|request|response|metric|k8s_event|...
  storage_key         TEXT NOT NULL,
  content_type        TEXT,
  size_bytes          BIGINT,
  redacted            BOOLEAN NOT NULL DEFAULT false,
  metadata            JSONB NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS defect_links (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_result_id UUID NOT NULL REFERENCES execution_results(id) ON DELETE CASCADE,
  external_system     TEXT NOT NULL,  -- jira|azure|github|...
  external_id         TEXT NOT NULL,
  external_url        TEXT,
  status              TEXT,
  linked_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  linked_by           TEXT
);

-- ---------------------------------------------------------------------------
-- Workers (Prompt 3)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS workers (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  capabilities    JSONB NOT NULL DEFAULT '[]',  -- runner types + locations
  labels          JSONB NOT NULL DEFAULT '{}',
  last_heartbeat  TIMESTAMPTZ,
  status          TEXT NOT NULL DEFAULT 'offline', -- online|offline|draining|busy
  current_load    INT NOT NULL DEFAULT 0,
  max_concurrency INT NOT NULL DEFAULT 4,
  metadata        JSONB NOT NULL DEFAULT '{}',
  registered_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Schedules (Prompt 7)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS schedules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  cron_expression TEXT,
  event_trigger   TEXT,            -- after_build|before_deploy|after_deploy|...
  test_plan_id    UUID REFERENCES test_plans(id) ON DELETE SET NULL,
  test_suite_id   UUID REFERENCES test_suites(id) ON DELETE SET NULL,
  test_case_ids   UUID[] DEFAULT '{}',
  environment_id  UUID REFERENCES environments(id) ON DELETE SET NULL,
  enabled         BOOLEAN NOT NULL DEFAULT true,
  last_run_at     TIMESTAMPTZ,
  next_run_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      TEXT
);

-- ---------------------------------------------------------------------------
-- AI Proposals (Prompt 2 / 10)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_proposals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type     TEXT NOT NULL,   -- requirement|openapi|code|defect|...
  source_ref      TEXT,
  proposed_case   JSONB NOT NULL,
  rationale       TEXT,
  status          TEXT NOT NULL DEFAULT 'proposed', -- proposed|accepted|rejected|edited
  application_id  UUID REFERENCES applications(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at     TIMESTAMPTZ,
  reviewed_by     TEXT
);

-- ---------------------------------------------------------------------------
-- Audit (Prompt 9)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id        TEXT,
  action          TEXT NOT NULL,
  resource_type   TEXT NOT NULL,
  resource_id     TEXT,
  application_id  UUID,
  environment_id  UUID,
  details         JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_events_created ON audit_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_resource ON audit_events(resource_type, resource_id);

-- ---------------------------------------------------------------------------
-- Defect Manager: failures → defect reports → Sand Bench PM → rerun → verified
-- ---------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS defect_key_seq;

CREATE TABLE IF NOT EXISTS defect_reports (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key                 TEXT NOT NULL UNIQUE,            -- DR-20260926-4f1a2b
  execution_id        UUID UNIQUE REFERENCES executions(id) ON DELETE SET NULL,
  source              TEXT NOT NULL DEFAULT 'execution', -- execution|ingest
  status              TEXT NOT NULL DEFAULT 'open',      -- open|with_pm|fixing|rerunning|verified|reopened
  claimed_by          TEXT,
  claimed_at          TIMESTAMPTZ,
  rerun_execution_id  UUID REFERENCES executions(id) ON DELETE SET NULL,
  rerun_count         INT NOT NULL DEFAULT 0,
  history             JSONB NOT NULL DEFAULT '[]',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_defect_reports_status ON defect_reports(status);

CREATE TABLE IF NOT EXISTS defects (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key                 TEXT NOT NULL UNIQUE,            -- DEF-00042
  report_id           UUID NOT NULL REFERENCES defect_reports(id) ON DELETE CASCADE,
  fingerprint         TEXT NOT NULL,
  test_case_id        UUID REFERENCES test_cases(id) ON DELETE SET NULL,
  case_key            TEXT NOT NULL,
  case_name           TEXT NOT NULL,
  test_type           TEXT,
  category            TEXT NOT NULL DEFAULT 'unknown',
  severity            TEXT NOT NULL DEFAULT 'medium',
  status              TEXT NOT NULL DEFAULT 'open',
  message             TEXT NOT NULL,
  execution_id        UUID REFERENCES executions(id) ON DELETE SET NULL,
  execution_result_id UUID REFERENCES execution_results(id) ON DELETE SET NULL,
  occurrences         INT NOT NULL DEFAULT 1,
  rerun_attempts      INT NOT NULL DEFAULT 0,
  assignee            TEXT,
  fix_ref             TEXT,                            -- PR / commit URL from the fixer
  history             JSONB NOT NULL DEFAULT '[]',
  first_seen          TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen           TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_defects_report ON defects(report_id);
CREATE INDEX IF NOT EXISTS idx_defects_fingerprint ON defects(fingerprint, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_defects_status ON defects(status);

-- One row per execution the Defect Manager has read, so replays are no-ops.
CREATE TABLE IF NOT EXISTS defect_ingests (
  execution_id  UUID PRIMARY KEY REFERENCES executions(id) ON DELETE CASCADE,
  report_id     UUID REFERENCES defect_reports(id) ON DELETE SET NULL,
  outcome       TEXT NOT NULL,                         -- report|recurring_only|clean|rerun
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Test Packs (Prompt 10)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS test_packs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key             TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  description     TEXT,
  content         JSONB NOT NULL DEFAULT '{}',  -- suite templates + config
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Seed baseline application (Sand Bench)
-- ---------------------------------------------------------------------------
INSERT INTO applications (key, name, description, status)
VALUES ('sand-bench', 'Sand Bench / Sandbox', 'Primary development sandbox application under test', 'active')
ON CONFLICT (key) DO NOTHING;

INSERT INTO environments (key, name, env_type, base_url, safety_policy)
VALUES (
  'local-dev',
  'Local Development',
  'localhost',
  'http://127.0.0.1:8001',
  '{"functional_smoke":"allowed","read_only_api":"allowed","write_api":"allowed","load":"approval_required","stress":"prohibited","chaos":"prohibited","destructive_db":"prohibited"}'::jsonb
)
ON CONFLICT (key) DO NOTHING;
