import { test } from "node:test";
import assert from "node:assert/strict";
import { apiJson, correlationId, pollUntil } from "../lib/client.ts";

type Job = { id: string; status: "queued" | "running" | "succeeded" | "failed"; kind: string; last_error: string | null };

// Proves the worker container deployed alongside the app is actually alive and sharing
// the same database: the app only enqueues the job, the worker process is the only thing
// that can lease and complete it.
test("worker container leases and completes a job enqueued by the application", async () => {
  const probe = correlationId("sit-probe");
  const enqueue = await apiJson<{ jobId: string }>("/api/v1/jobs", {
    method: "POST",
    body: JSON.stringify({ kind: "sit.smoke", payload: { probe } }),
  });
  assert.equal(enqueue.status, 200, "job enqueue was rejected");
  assert.ok(enqueue.body.jobId, "no jobId returned");

  const final = await pollUntil(
    () => apiJson<Job>(`/api/v1/jobs/${enqueue.body.jobId}`),
    (result) => result.body.status === "succeeded" || result.body.status === "failed",
    { timeoutMs: 10000, intervalMs: 400 }
  );
  assert.equal(final.status, 200);
  assert.equal(
    final.body.status,
    "succeeded",
    `worker did not complete the job (status=${final.body.status}, last_error=${final.body.last_error})`
  );
});
