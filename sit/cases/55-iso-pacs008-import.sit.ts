/**
 * Post-deploy: validate + upload pacs.008.001.14 fixtures, verify job, then clear import rows.
 * Requires API (+ DB). Uses portal session (demo classification).
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const API = process.env.SIT_API_BASE || process.env.SBE_API_BASE || "http://127.0.0.1:8787";

async function token() {
  const res = await fetch(`${API}/api/v1/session/portal`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ tenantSlug: "acme-demo", username: "analyst.acme" }),
  });
  const json = await res.json();
  if (!res.ok || !json.token) throw new Error(`portal failed ${res.status}`);
  return json.token as string;
}

export default async function run(ctx: { log: (m: string) => void; assert: (c: unknown, m?: string) => void }) {
  const { log, assert } = ctx;
  const xsd = readFileSync(join(root, "tests/fixtures/iso20022/pacs.008.001.14.xsd"), "utf8");
  const md = readFileSync(join(root, "tests/fixtures/iso20022/pacs.008.001.14-mdr-excerpt.md"), "utf8");
  const t = await token();
  const headers = { "content-type": "application/json", authorization: `Bearer ${t}` };

  log("validate-markdown pacs.008.001.14");
  const v = await fetch(`${API}/api/v1/catalog/iso/validate-markdown`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      schemas: [{ fileName: "pacs.008.001.14.xsd", content: xsd }],
      markdowns: [{ fileName: "pacs.008.001.14-mdr-excerpt.md", content: md }],
    }),
  });
  const vj = await v.json();
  assert(v.ok, `validate HTTP ${v.status}`);
  log(`validate ok=${JSON.stringify(vj.data?.ok ?? vj)}`);

  log("confirm upload");
  const u = await fetch(`${API}/api/v1/catalog/iso/uploads`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      schemas: [{ fileName: "pacs.008.001.14.xsd", content: xsd }],
      markdowns: [{ fileName: "pacs.008.001.14-mdr-excerpt.md", content: md }],
      confirm: true,
      proceed: "with-markdown",
      name: "SIT pacs.008.001.14",
    }),
  });
  const uj = await u.json();
  assert(u.status === 202 || u.status === 409, `upload HTTP ${u.status} ${JSON.stringify(uj)}`);
  if (u.status === 202) {
    assert(uj.job_id || uj.code, "missing job_id/code");
    log(`stored status=${uj.status} code=${uj.code} job=${uj.job_id}`);
    if (uj.job_id) {
      const g = await fetch(`${API}/api/v1/catalog/iso/uploads/${uj.job_id}`, { headers });
      assert(g.ok, `get job ${g.status}`);
      log(`job detail HTTP ${g.status}`);
    }
  } else {
    log("duplicate schema — already stored (acceptable on re-run)");
  }

  // Clear: prefer screen-clear API if present; otherwise best-effort note.
  log("clear import test data");
  for (const path of ["/api/v1/console/clear", "/api/v1/screen-clear", "/api/v1/catalog/iso/clear"]) {
    try {
      const c = await fetch(`${API}${path}`, {
        method: "POST",
        headers,
        body: JSON.stringify({ scope: "catalog_imports", confirm: true }),
      });
      if (c.ok || c.status === 204) {
        log(`cleared via ${path}`);
        return;
      }
    } catch {
      /* try next */
    }
  }
  log("no clear endpoint matched — import rows may remain until DB reset / Clear test data in UI");
}
