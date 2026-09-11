// Blocks until a service's health endpoint answers 2xx, or throws after timeoutMs.
// Used by run.mjs to gate the whole SIT suite on real post-deployment readiness rather
// than racing the containers' own healthchecks.
export async function waitForHealth(url, { timeoutMs = 120000, intervalMs = 1500, label = url } = {}) {
  const start = Date.now();
  let lastError = "no attempt made";
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (res.ok) return true;
      lastError = `HTTP ${res.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`${label} did not become healthy within ${timeoutMs}ms (last error: ${lastError})`);
}
