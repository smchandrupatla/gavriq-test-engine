/** Shared TypeScript types for the GAVRIQ Test Engine */

export type TestType =
  | 'unit' | 'component' | 'service' | 'api' | 'ui' | 'integration' | 'system' | 'e2e'
  | 'regression' | 'smoke' | 'sanity' | 'acceptance' | 'contract' | 'database'
  | 'workflow' | 'event' | 'batch' | 'scheduler' | 'file' | 'performance'
  | 'security' | 'resilience' | 'deployment' | 'other';

export type TestLifecycle =
  | 'draft' | 'ready_for_review' | 'approved' | 'active' | 'maintenance' | 'deprecated' | 'archived';

export type ExecutionStatus =
  | 'queued' | 'preparing' | 'running' | 'passed' | 'failed' | 'skipped'
  | 'blocked' | 'cancelled' | 'error' | 'timed_out';

export type ResultVerdict = 'pass' | 'pass_with_conditions' | 'fail' | 'inconclusive';

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'trivial';
export type Priority = 'p0' | 'p1' | 'p2' | 'p3' | 'p4';

export type ExecutionLocation =
  | 'in_container' | 'out_of_container' | 'sidecar' | 'worker_local' | 'remote';

export type EnvironmentType =
  | 'localhost' | 'development' | 'integration' | 'qa' | 'sit' | 'uat'
  | 'staging' | 'pre_prod' | 'production' | 'docker' | 'kubernetes'
  | 'aws' | 'azure' | 'gcp' | 'remote';

export type FailureClassification =
  | 'application_defect' | 'assertion_failure' | 'environment_problem'
  | 'infrastructure_failure' | 'network_failure' | 'authentication_problem'
  | 'test_data_problem' | 'script_problem' | 'dependency_failure'
  | 'deployment_problem' | 'timeout' | 'unknown';

export interface Application {
  id: string;
  key: string;
  name: string;
  description?: string;
  owner_id?: string;
  status: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface TestCase {
  id: string;
  key: string;
  name: string;
  description?: string;
  application_id: string;
  component_id?: string;
  feature_id?: string;
  requirement_id?: string;
  scenario_id?: string;
  test_type: TestType;
  test_level?: string;
  preconditions?: string;
  dependencies?: unknown[];
  test_data_ref?: string;
  environment_requirements?: Record<string, unknown>;
  execution_location_default?: ExecutionLocation;
  execution_method?: string;
  script?: string;
  steps?: unknown[];
  expected_results?: string;
  assertions?: unknown[];
  validation_rules?: Record<string, unknown>;
  timeout_seconds?: number;
  retry_policy?: Record<string, unknown>;
  severity?: Severity;
  priority?: Priority;
  tags?: string[];
  owner_id?: string;
  author_id?: string;
  reviewer_id?: string;
  automation_status?: string;
  version: number;
  lifecycle: TestLifecycle;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
}

export interface Environment {
  id: string;
  key: string;
  name: string;
  env_type: EnvironmentType;
  base_url?: string;
  config?: Record<string, unknown>;
  secrets_ref?: string;
  safety_policy?: Record<string, string>;
  worker_affinity?: string[];
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Execution {
  id: string;
  key: string;
  requested_by?: string;
  test_plan_id?: string;
  test_suite_id?: string;
  test_case_ids: string[];
  environment_id?: string;
  execution_location?: ExecutionLocation;
  worker_id?: string;
  status: ExecutionStatus;
  trigger_source: string;
  started_at?: string;
  finished_at?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface ExecutionResult {
  id: string;
  execution_id: string;
  test_case_id: string;
  status: ExecutionStatus;
  verdict?: ResultVerdict;
  duration_ms?: number;
  started_at?: string;
  finished_at?: string;
  message?: string;
  classification?: FailureClassification;
  metrics?: Record<string, unknown>;
  created_at: string;
}
