# Agent API

How an external automation party, the Sand Bench agent, uses the test engine in the nightly loop:

1. **Trigger** the nightly suite (or any selection) through the API.
2. Get **notified** when the run finishes.
3. **Fetch** the results, fix the failures in the code.
4. **Trigger** the suite again, and repeat until it passes.

The engine does the running and the reporting. The fixing is the agent's job. Failures also become defect reports (see [DEFECT-MANAGER.md](DEFECT-MANAGER.md)); the agent's results call links each failure to its defect.

## Setup

Set `AGENT_API_KEY` on the engine (`openssl rand -hex 32`) and give the same value to the agent. Every `/api/v1/agent/*` route requires it, as `X-Agent-Key: <key>` or `Authorization: Bearer <key>`. Without the variable these routes answer **503**, never open. A wrong or missing key is **401**.

Optional: `WEBHOOK_ALLOWED_HOSTS=agent.internal,...` restricts which hosts may receive notifications. Regardless of that setting, webhook URLs must be `http(s)`, may not carry credentials, and may not point at link-local or cloud-metadata addresses. Private and docker-network hosts are allowed.

## 1. Trigger a run

```
POST /api/v1/agent/runs
{ "schedule_id": "<uuid>" }                       // run a saved schedule now, e.g. the nightly one
{ "target": { "scope": "suites", "suite_ids": ["<uuid>"] } }   // or an ad-hoc selection: all | types | suites | cases
```

Optional fields: `environment_id`, `label` (up to 200 characters, lets a webhook filter on it), `requested_by`, and `callback_url` (this run's own completion webhook, see below).

`202` returns `{ execution_id, key, status: "queued", case_count, status_url, results_url }`. `409` means the previous run of that schedule is still going: wait for its notification instead of starting another. `400` means a bad request or a selection that matches no test cases.

`GET /api/v1/agent/schedules` lists what can be triggered (id, name, cron, next and last run).

## 2. Be notified

Register a receiver once:

```
POST /api/v1/agent/webhooks
{ "name": "Sand Bench agent", "url": "http://agent:9000/hooks/test-engine",
  "schedule_id": "<uuid>",   // optional: only this schedule's runs
  "label": "nightly" }       // optional: only runs started with this label
```

The response contains `secret` **once**. Store it. Or skip registration and pass `callback_url` when you trigger: that delivery is signed with the agent key.

When a run finishes (passed, failed, error, timed out, cancelled) the engine POSTs:

```json
{ "event": "execution.completed",
  "execution": { "id": "...", "key": "api-...", "status": "failed", "finished_at": "...", "label": null, "schedule_id": "...", "schedule_name": "Nightly" },
  "summary": { "total": 120, "passed": 117, "failed": 3, "errored": 0, "skipped": 0, "other": 0 },
  "outcome": "fail",
  "results_url": "/api/v1/agent/runs/<id>/results" }
```

The body carries verdicts and counts only. Details come from the results call, over an authenticated channel.

Headers: `X-Gavriq-Event`, `X-Gavriq-Delivery` (unique id), `X-Gavriq-Timestamp` (unix seconds), `X-Gavriq-Signature: sha256=<hex>` where the hex is `HMAC_SHA256(secret, timestamp + "." + rawBody)`. Verify it in constant time, and reject timestamps more than a few minutes old.

Delivery is **at least once**. Treat `execution.id` as the idempotency key. Any 2xx counts as delivered. A 4xx other than 408/429 is final; anything else retries after 10 s, 30 s, 2 min, 10 min, 30 min, then 2 h, six attempts in all, after which the delivery is `dead`.

Also: `GET /api/v1/agent/webhooks` (no secrets), `DELETE /api/v1/agent/webhooks/:id`, `POST /api/v1/agent/webhooks/:id/test` (signed `webhook.test` ping), `GET /api/v1/agent/webhook-deliveries?run=<id>&status=dead`, and `POST /api/v1/agent/webhook-deliveries/:id/retry`.

If a notification is ever missed, poll `GET /api/v1/agent/runs/:id`: `finished` turns true when the run ends.

## 3. Fetch the results

```
GET /api/v1/agent/runs/:id            // status, finished, summary, outcome
GET /api/v1/agent/runs/:id/results    // failures only; add ?all=1 for every case
```

Each result has `case_key`, `case_name`, `test_type`, `status`, `verdict`, `message` (what failed), `classification`, `duration_ms`, `evidence` (log/screenshot URLs, fetch them with the same key), and `defects` (the defect-register entries it became). `:id` is the execution id or its key.

## 4. Fix and trigger again

Fix the code, then `POST /api/v1/agent/runs` with the same `schedule_id`. For defects the engine tracks, the Defect Manager loop (claim, mark fixed, request rerun, verified) still applies; see DEFECT-MANAGER.md.

## Example loop

```js
const H = { 'x-agent-key': KEY, 'content-type': 'application/json' };
let run = (await (await fetch(`${ENGINE}/api/v1/agent/runs`, { method: 'POST', headers: H, body: JSON.stringify({ schedule_id: NIGHTLY }) })).json()).data;
// ... the webhook handler receives execution.completed for run.execution_id ...
const { data } = await (await fetch(`${ENGINE}/api/v1/agent/runs/${run.execution_id}/results`, { headers: H })).json();
if (data.outcome === 'fail') { /* read data.results[].message, fix, then trigger the schedule again */ }
```

## Audit

Every trigger, webhook create and delete is recorded in the audit log as the actor `sandbench-agent`.
