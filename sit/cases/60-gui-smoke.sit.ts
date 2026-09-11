import { test } from "node:test";
import assert from "node:assert/strict";
import { ENV } from "../lib/env.ts";

const pages = [
  { path: "/index.html", must: /Sand Bench|ops-console|preview-loader/ },
  { path: "/help.html", must: /Help|GARVIQ|Sand Bench/ },
  { path: "/demo.html", must: /N-2|demo|sben/i },
  { path: "/not-production.html", must: /not production|Testhub|simulator/i },
];

for (const page of pages) {
  test(`GUI page ${page.path} is served after deploy`, async () => {
    const res = await fetch(`${ENV.webBase}${page.path}`, { signal: AbortSignal.timeout(5000) });
    assert.equal(res.status, 200, `${page.path} was not 200`);
    const html = await res.text();
    assert.match(html, page.must);
  });
}
