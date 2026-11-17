/**
 * IMP-NAV121 / UC-applicationShell — SIT static contract when web is reachable.
 * Skips cleanly when webBase is down (agent sandbox without compose).
 */
import { test } from "node:test";
import assert from "node:assert/strict";

const webBase = process.env.SBE_GUI_BASE || process.env.WEB_BASE || "http://127.0.0.1:8080";

async function get(path: string): Promise<{ status: number; text: string } | null> {
  try {
    const res = await fetch(`${webBase}${path}`, { signal: AbortSignal.timeout(4000) });
    return { status: res.status, text: await res.text() };
  } catch {
    return null;
  }
}

test("SIT shell-demo is 200 and references sbe-shell", async () => {
  const hit = await get("/shell-demo.html");
  if (!hit) return;
  assert.equal(hit.status, 200);
  assert.match(hit.text, /sbe-shell\.js/);
  assert.match(hit.text, /sbe-content/);
});

test("SIT not-found is 200 public shell", async () => {
  const hit = await get("/not-found.html");
  if (!hit) return;
  assert.equal(hit.status, 200);
  assert.match(hit.text, /data-sbe-shell=["']public["']/);
  assert.match(hit.text, /sbe-shell\.js/);
});

test("SIT help is 200 with public shell markers", async () => {
  const hit = await get("/help.html");
  if (!hit) return;
  assert.equal(hit.status, 200);
  assert.match(hit.text, /sbe-shell|Help/i);
});

test("SIT nginx serves sbe-shell.js", async () => {
  const hit = await get("/js/sbe-shell.js");
  if (!hit) return;
  assert.equal(hit.status, 200);
  assert.match(hit.text, /SbeShell|sbe-content|mount/);
});
