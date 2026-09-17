/**
 * MQ / Kafka / DB adapters.
 * Missing broker/db config is blocked (environment), not a product failure.
 * Performance "k6" remains concurrent-HTTP unless K6_BIN is set.
 */
export type AdapterResult = {
  status: 'passed' | 'failed' | 'blocked' | 'skipped';
  message: string;
  duration_ms: number;
  classification?: string;
  metrics?: Record<string, unknown>;
};

function missing(name: string, envKeys: string[]): AdapterResult {
  const present = envKeys.filter((k) => process.env[k]);
  if (present.length) {
    return {
      status: 'blocked',
      message: `${name} adapter is not implemented yet (config present: ${present.join(', ')}). Use sit/cases until the native runner ships.`,
      duration_ms: 0,
      classification: 'script_problem',
    };
  }
  return {
    status: 'blocked',
    message: `${name} adapter skipped — set ${envKeys.join(' or ')} and use sit/cases for live broker/db checks.`,
    duration_ms: 0,
    classification: 'environment_problem',
  };
}

export async function runMq(): Promise<AdapterResult> {
  return missing('MQ', ['MQ_QMGR', 'MQ_CHANNEL', 'IBM_MQ_HOST']);
}

export async function runKafka(): Promise<AdapterResult> {
  return missing('Kafka', ['KAFKA_BROKERS', 'KAFKA_BOOTSTRAP']);
}

export async function runDatabase(): Promise<AdapterResult> {
  return missing('Database cross-check', ['TARGET_DATABASE_URL', 'SIT_DB_URL']);
}

export async function runK6Hint(): Promise<AdapterResult> {
  if (process.env.K6_BIN) {
    return {
      status: 'blocked',
      message: `K6_BIN=${process.env.K6_BIN} is set but the k6 runner is not wired. Performance runs still use concurrent HTTP.`,
      duration_ms: 0,
      classification: 'script_problem',
    };
  }
  return {
    status: 'skipped',
    message: 'k6 not configured; performance runner uses concurrent HTTP (not k6).',
    duration_ms: 0,
  };
}
