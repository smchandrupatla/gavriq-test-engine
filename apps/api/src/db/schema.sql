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
    'deployment_problem','timeout','cleanup_failure','unknown'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- The engine's worker reports a cleanup_failure classification when a case's
-- own cleanup step failed after its main assertions passed (see http.ts and
-- worker.ts). Older schemas were seeded before that value existed; add it on
-- the fly so the API's enum cast does not 500 on these reports.
ALTER TYPE failure_classification ADD VALUE IF NOT EXISTS 'cleanup_failure';

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

-- ---------------------------------------------------------------------------
-- Test bench representation (adopted from Sand Bench's Test cases screen):
-- what the case is for in plain words, who owns it, where it runs, how long it
-- takes, the links and notes around it, and the triage/collaboration state.
-- Steps (JSONB above) carry the same shape per entry: {text, expected, testData,
-- attachments} for people, plus the runner fields (action, url, ...) for workers.
-- ---------------------------------------------------------------------------
ALTER TABLE test_cases ADD COLUMN IF NOT EXISTS objective TEXT;
ALTER TABLE test_cases ADD COLUMN IF NOT EXISTS component TEXT;
ALTER TABLE test_cases ADD COLUMN IF NOT EXISTS environment TEXT;
ALTER TABLE test_cases ADD COLUMN IF NOT EXISTS estimated_duration TEXT;
ALTER TABLE test_cases ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'Team';
ALTER TABLE test_cases ADD COLUMN IF NOT EXISTS automation_link TEXT;
ALTER TABLE test_cases ADD COLUMN IF NOT EXISTS test_data TEXT;
ALTER TABLE test_cases ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]';
ALTER TABLE test_cases ADD COLUMN IF NOT EXISTS flakiness_notes TEXT;
ALTER TABLE test_cases ADD COLUMN IF NOT EXISTS known_workarounds TEXT;
ALTER TABLE test_cases ADD COLUMN IF NOT EXISTS common_failure_causes TEXT;
ALTER TABLE test_cases ADD COLUMN IF NOT EXISTS triage_status TEXT NOT NULL DEFAULT 'None';
ALTER TABLE test_cases ADD COLUMN IF NOT EXISTS assignee TEXT;
ALTER TABLE test_cases ADD COLUMN IF NOT EXISTS linked_issue_url TEXT;
ALTER TABLE test_cases ADD COLUMN IF NOT EXISTS notes JSONB NOT NULL DEFAULT '[]';
ALTER TABLE test_cases ADD COLUMN IF NOT EXISTS watchers JSONB NOT NULL DEFAULT '[]';
DO $$ BEGIN
  ALTER TABLE test_cases ADD CONSTRAINT test_cases_visibility_check CHECK (visibility IN ('Public','Team','Private'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE test_cases ADD CONSTRAINT test_cases_estimated_duration_check
    CHECK (estimated_duration IS NULL OR estimated_duration IN ('Under 1m','1-5m','5-15m','15-60m','60m+'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE test_cases ADD CONSTRAINT test_cases_triage_status_check
    CHECK (triage_status IN ('None','Investigating','Assigned','Issue linked','Resolved'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_test_cases_triage ON test_cases(triage_status);
CREATE INDEX IF NOT EXISTS idx_test_cases_component ON test_cases(component);

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
  name                TEXT,                  -- human display name: case/suite name + timestamp
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

ALTER TABLE executions ADD COLUMN IF NOT EXISTS name TEXT;

CREATE INDEX IF NOT EXISTS idx_executions_status ON executions(status);
CREATE INDEX IF NOT EXISTS idx_executions_env ON executions(environment_id);
-- Runs are groups of executions sharing metadata.run_group (trigger API, run-all).
CREATE INDEX IF NOT EXISTS idx_executions_run_group ON executions((metadata->>'run_group'));

-- A deploy of `ref` to one environment, triggered from the console or the API
-- and reported back by that environment's own deploy control plane (see
-- apps/api/src/routes/deployments.ts). `key` is the remote deploy job id.
-- `run_id` is a metadata.run_group value (runs have no dedicated table), set
-- only when mode = deploy_and_run and the deploy itself succeeded.
CREATE TABLE IF NOT EXISTS deployments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key             TEXT UNIQUE,
  application     TEXT NOT NULL,
  environment_id  UUID NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
  ref             TEXT NOT NULL DEFAULT 'main',
  mode            TEXT NOT NULL DEFAULT 'deploy_only' CHECK (mode IN ('deploy_only', 'deploy_and_run')),
  status          TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'deploying', 'succeeded', 'failed')),
  commit          TEXT,
  version         TEXT,
  error           TEXT,
  run_id          TEXT,
  requested_by    TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at      TIMESTAMPTZ,
  finished_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_deployments_env ON deployments(environment_id);
CREATE INDEX IF NOT EXISTS idx_deployments_created ON deployments(created_at DESC);

-- Lifecycle (apps/api/src/infra.ts): a deploy may ask for the environment to be
-- torn down once the run it queued has finished, whatever the verdict. The run
-- request a deploy was made for (a run that found its environment down) is kept
-- so the post-deploy run has the same scope the caller asked for.
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS teardown_after_run BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS teardown_job_id UUID;
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS run_request JSONB;
-- A deploy that is one iteration of a cycle (see cycle_runs below) carries the cycle id.
-- When its teardown succeeds, the engine starts the next iteration or marks the cycle done.
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS cycle_run_id UUID;

-- Cycle runs: deploy → run → tear down, repeated iterations_total times, so the user
-- can hammer an environment N times from one click. apps/api/src/cycle-run.ts starts
-- the first iteration; infra.ts advances the cycle on each teardown success and marks
-- it failed if a deploy or run step fails. Cancel stops the cycle after the current
-- iteration finishes (or immediately, cancelling any live run as well).
CREATE SEQUENCE IF NOT EXISTS cycle_run_key_seq;
CREATE TABLE IF NOT EXISTS cycle_runs (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key                     TEXT NOT NULL UNIQUE,
  application             TEXT NOT NULL,
  environment_id          UUID NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
  iterations_total        INT NOT NULL CHECK (iterations_total BETWEEN 1 AND 100),
  iterations_done         INT NOT NULL DEFAULT 0,
  status                  TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'cancelled', 'failed')),
  current_deployment_id   UUID REFERENCES deployments(id) ON DELETE SET NULL,
  last_error              TEXT,
  requested_by            TEXT,
  started_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at             TIMESTAMPTZ,
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cycle_runs_env_status ON cycle_runs (environment_id, status);
CREATE INDEX IF NOT EXISTS idx_cycle_runs_app ON cycle_runs (application, started_at DESC);

-- Clean-start cycle: before the first iteration, tear down whatever is on the stack and prune
-- Docker (stopped containers in the managed projects, dangling images, build cache older than
-- the policy's prune_build_cache_hours). Phase progresses: tearing_down → pruning → ready → nulled
-- when preparation is done, then normal cycle iterations begin.
ALTER TABLE cycle_runs ADD COLUMN IF NOT EXISTS clean_start BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE cycle_runs ADD COLUMN IF NOT EXISTS preparation_phase TEXT
  CHECK (preparation_phase IS NULL OR preparation_phase IN ('tearing_down', 'pruning', 'ready'));
ALTER TABLE cycle_runs ADD COLUMN IF NOT EXISTS preparation_prune_job_id UUID;

-- Infrastructure jobs: work for the host-side infra agent (apps/infra-agent),
-- which has git and docker where the compose stacks live. The control plane
-- decides when (after a run, idle, too long up, housekeeping cadence, a person);
-- the agent claims the oldest queued job, does it and reports back.
--   deploy    params {script, ref}                → the environment's deploy script
--   teardown  params {script, remove_images, remove_volumes}
--   prune     params {projects, image_prefixes, build_cache_hours, dry_run}
CREATE TABLE IF NOT EXISTS infra_jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind            TEXT NOT NULL CHECK (kind IN ('deploy', 'teardown', 'prune')),
  environment_id  UUID REFERENCES environments(id) ON DELETE CASCADE,
  deployment_id   UUID REFERENCES deployments(id) ON DELETE SET NULL,
  status          TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  reason          TEXT,                         -- requested | after_run | idle | max_uptime | housekeeping | run_on_down_environment
  params          JSONB NOT NULL DEFAULT '{}',
  result          JSONB NOT NULL DEFAULT '{}',
  log             TEXT,
  error           TEXT,
  agent_id        TEXT,
  requested_by    TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at      TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at     TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_infra_jobs_status ON infra_jobs(status, created_at);
CREATE INDEX IF NOT EXISTS idx_infra_jobs_env ON infra_jobs(environment_id, created_at DESC);

-- The agents themselves: one row per host process, kept alive by heartbeats.
CREATE TABLE IF NOT EXISTS infra_agents (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  host            TEXT,
  version         TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}',
  last_heartbeat  TIMESTAMPTZ NOT NULL DEFAULT now(),
  registered_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

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

-- Remarks: what happened, in plain words. On a result they come from the worker
-- (one line per step, then the outcome); on an execution they are added by people
-- reviewing the run ({author, text, at}). Both are shown on the run screen.
ALTER TABLE execution_results ADD COLUMN IF NOT EXISTS remarks JSONB NOT NULL DEFAULT '[]';
ALTER TABLE executions ADD COLUMN IF NOT EXISTS remarks JSONB NOT NULL DEFAULT '[]';

CREATE INDEX IF NOT EXISTS idx_execution_results_exec ON execution_results(execution_id);
CREATE INDEX IF NOT EXISTS idx_execution_results_case ON execution_results(test_case_id);
-- Latest result per case (console summary) and "changed since" polling.
CREATE INDEX IF NOT EXISTS idx_execution_results_case_created ON execution_results(test_case_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_results_created ON execution_results(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_executions_created ON executions(created_at DESC);

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

-- Evidence is always read per result (run screen, evidence gate, reports).
CREATE INDEX IF NOT EXISTS idx_evidence_result ON evidence(execution_result_id);

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
  -- Application schedules run the whole application on the environment through
  -- the run planner (one execution per suite), narrowed by scope.
  application_id  UUID REFERENCES applications(id) ON DELETE CASCADE,
  scope           JSONB NOT NULL DEFAULT '{}',
  enabled         BOOLEAN NOT NULL DEFAULT true,
  last_run_at     TIMESTAMPTZ,
  next_run_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      TEXT
);
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS application_id UUID REFERENCES applications(id) ON DELETE CASCADE;
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS scope JSONB NOT NULL DEFAULT '{}';

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
-- Settings (engine-wide configuration, e.g. run retention)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS settings (
  id                 BOOLEAN PRIMARY KEY DEFAULT true CHECK (id),  -- singleton row
  run_retention_days INT NOT NULL DEFAULT 5,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by         TEXT
);
INSERT INTO settings (id) VALUES (true) ON CONFLICT DO NOTHING;

-- test_type -> minutes; a type absent here uses the 24h application default (see routes/settings.ts).
ALTER TABLE settings ADD COLUMN IF NOT EXISTS test_type_timeout_minutes JSONB NOT NULL DEFAULT '{}';
-- Stop a run after this many test cases in a row fail (anywhere in the run, including its start).
ALTER TABLE settings ADD COLUMN IF NOT EXISTS consecutive_failure_limit INT NOT NULL DEFAULT 20;
-- Rolling fail-rate cancel: cancel every queued execution in a run_group once
-- the group's recent-result window hits this fail rate. 0 disables the guard;
-- the window must have at least `rolling_fail_cancel_window` reported results
-- before the guard fires, so an early fail does not take the whole run down.
ALTER TABLE settings ADD COLUMN IF NOT EXISTS rolling_fail_cancel_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS rolling_fail_cancel_window INT NOT NULL DEFAULT 20;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS rolling_fail_cancel_threshold_pct INT NOT NULL DEFAULT 50;
-- Infrastructure policy (idle/max-uptime teardown, housekeeping cadence, teardown defaults);
-- keys absent here take the defaults in apps/api/src/infra.ts.
ALTER TABLE settings ADD COLUMN IF NOT EXISTS infra_policy JSONB NOT NULL DEFAULT '{}';

-- ---------------------------------------------------------------------------
-- Quality Insights: versioned reviews of an application's test quality.
-- snapshot holds the facts the engine computed, analysis the review written
-- over them; a version is never rewritten and outlives run retention.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS quality_insights (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id  UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  version         INT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'generating',  -- generating|ready|failed
  analyst         TEXT,                                 -- Claude | Built-in rules | name of an external agent
  model           TEXT,
  trigger_source  TEXT NOT NULL DEFAULT 'manual',       -- manual|agent
  requested_by    TEXT,
  window_days     INT NOT NULL DEFAULT 30,
  snapshot        JSONB NOT NULL,
  analysis        JSONB,
  notice          TEXT,
  error           TEXT,
  usage           JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ,
  UNIQUE (application_id, version)
);

-- ---------------------------------------------------------------------------
-- Held reports wait in the defect log until a person sends them to the implementation
-- manager (auto-approve off), so the product manager's queue only sees released ones.
ALTER TABLE defect_reports ADD COLUMN IF NOT EXISTS held BOOLEAN NOT NULL DEFAULT false;

-- Defect log: every failure the engine logs, and every defect a person raises by hand,
-- with its lifecycle (logged -> validated -> sent, or rejected), the run, test case,
-- environment and application version it was seen in, and its attachments.
CREATE SEQUENCE IF NOT EXISTS defect_log_key_seq;

CREATE TABLE IF NOT EXISTS defect_log (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key                   TEXT NOT NULL UNIQUE,              -- DL-000001
  application_id        UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  title                 TEXT NOT NULL,
  description           TEXT NOT NULL DEFAULT '',
  severity              TEXT NOT NULL DEFAULT 'medium',    -- low|medium|high|critical
  status                TEXT NOT NULL DEFAULT 'logged',    -- logged|validated|rejected|sent
  origin                TEXT NOT NULL DEFAULT 'manual',    -- auto|manual
  test_case_id          UUID REFERENCES test_cases(id) ON DELETE SET NULL,
  case_key              TEXT,
  run_id                TEXT,
  execution_id          UUID REFERENCES executions(id) ON DELETE SET NULL,
  execution_result_id   UUID REFERENCES execution_results(id) ON DELETE SET NULL,
  environment_id        UUID REFERENCES environments(id) ON DELETE SET NULL,
  environment_key       TEXT,
  application_version   TEXT NOT NULL DEFAULT 'not recorded',
  failure_message       TEXT,
  defect_report_id      UUID REFERENCES defect_reports(id) ON DELETE SET NULL,
  defect_id             UUID REFERENCES defects(id) ON DELETE SET NULL,
  logged_by             TEXT,
  validated_by          TEXT,
  validated_at          TIMESTAMPTZ,
  rejected_reason       TEXT,
  sent_by               TEXT,
  sent_at               TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS defect_log_status_idx ON defect_log (application_id, status);
CREATE INDEX IF NOT EXISTS defect_log_run_idx ON defect_log (run_id);

-- The named implementation manager (applications.metadata->implementation_manager) recorded
-- on a defect at the moment it is sent, so the record shows who received it.
ALTER TABLE defect_log ADD COLUMN IF NOT EXISTS implementation_manager TEXT;

-- A sent defect's report carries its application key so the right application's implementation
-- manager (and feedback loop) picks it up, even for a manual defect with no execution behind it.
ALTER TABLE defect_reports ADD COLUMN IF NOT EXISTS application_key TEXT;
CREATE INDEX IF NOT EXISTS idx_defect_reports_application ON defect_reports (application_key);

-- Deploy-failure loop (apps/api/src/deploy-loop.ts): when a managed stack's deploy fails,
-- the engine opens a defect_reports row with kind='deploy' and hands it to the application
-- repo's agent through the same claim/fix lane every test defect uses. When the agent marks
-- the defect fixed, the engine redeploys (at the agent's fix_ref if given, otherwise the same
-- ref). The retry count is capped: after deploy_retry_cap attempts (default 5) the report
-- goes to status='parked', and the console banners the environment for offline investigation.
ALTER TABLE defect_reports ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'test';
ALTER TABLE defect_reports ADD COLUMN IF NOT EXISTS environment_id UUID REFERENCES environments(id) ON DELETE SET NULL;
ALTER TABLE defect_reports ADD COLUMN IF NOT EXISTS deploy_retry_count INT NOT NULL DEFAULT 0;
ALTER TABLE defect_reports ADD COLUMN IF NOT EXISTS deploy_retry_cap INT NOT NULL DEFAULT 5;
ALTER TABLE defect_reports ADD COLUMN IF NOT EXISTS deploy_last_ref TEXT;
ALTER TABLE defect_reports ADD COLUMN IF NOT EXISTS deploy_last_error TEXT;
CREATE INDEX IF NOT EXISTS idx_defect_reports_kind_env ON defect_reports (kind, environment_id);
-- At most one live deploy-failure report per environment (parked and verified don't count:
-- a new deploy failure after a parked report opens a fresh one).
CREATE UNIQUE INDEX IF NOT EXISTS idx_defect_reports_live_deploy
  ON defect_reports (environment_id)
  WHERE kind = 'deploy' AND status NOT IN ('parked', 'verified');

-- Attachments: a screenshot or system log either linked to the run's evidence (evidence_id)
-- or uploaded by a person (content).
CREATE TABLE IF NOT EXISTS defect_log_attachments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  defect_log_id   UUID NOT NULL REFERENCES defect_log(id) ON DELETE CASCADE,
  kind            TEXT NOT NULL DEFAULT 'other',          -- screenshot|log|other
  name            TEXT NOT NULL,
  content_type    TEXT NOT NULL DEFAULT 'application/octet-stream',
  size_bytes      INT NOT NULL DEFAULT 0,
  sha256          TEXT,
  evidence_id     UUID REFERENCES evidence(id) ON DELETE SET NULL,
  content         BYTEA,
  created_by      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS defect_log_attachments_log_idx ON defect_log_attachments (defect_log_id);

-- Conversation on a defect: manual comments a person (or the implementation manager) adds,
-- alongside the lifecycle events the timeline derives from the record itself. Lets the
-- implementation manager ask for more detail and the tester answer, kept with the defect.
CREATE TABLE IF NOT EXISTS defect_log_comments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  defect_log_id   UUID NOT NULL REFERENCES defect_log(id) ON DELETE CASCADE,
  author          TEXT NOT NULL DEFAULT 'operator',
  body            TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS defect_log_comments_log_idx ON defect_log_comments (defect_log_id, created_at);

-- Feedback loop (feedback-loop.ts): one row per application. The loop runs the
-- application's suite, lets the Defect Manager file reports, requests reruns of
-- the defects the implementation manager fixed, and stops once a full sweep is clean.
CREATE TABLE IF NOT EXISTS feedback_loops (
  key              TEXT PRIMARY KEY,                    -- application key
  environment_key  TEXT NOT NULL,
  state            TEXT NOT NULL DEFAULT 'stopped',     -- stopped|running|suspended
  phase            TEXT NOT NULL DEFAULT 'idle',        -- idle|sweeping|awaiting_pm|awaiting_fixes|rerunning|converged
  cycle            INT NOT NULL DEFAULT 0,
  current_run_id   TEXT,                                -- full sweep in flight
  clean_sweep      BOOLEAN NOT NULL DEFAULT false,      -- last full sweep had no failures and nothing changed since
  note             TEXT,
  last_error       TEXT,
  started_at       TIMESTAMPTZ,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
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
