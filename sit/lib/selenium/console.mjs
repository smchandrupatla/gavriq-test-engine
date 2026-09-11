import { ENV } from "../env.ts";

export async function enterConsole(sess) {
  await sess.go(`${ENV.webBase}/`);
  const tenant = await sess.find("css selector", "#tenant");
  if (tenant) { await sess.clear(tenant); await sess.type(tenant, ENV.tenantSlug || "acme-demo"); }
  const user = await sess.find("css selector", "#username");
  if (user) { await sess.clear(user); await sess.type(user, ENV.username || "analyst.acme"); }
  const login = await sess.find("css selector", "#login");
  if (login) await sess.click(login);
  await new Promise((r) => setTimeout(r, 800));
  return sess.source();
}

export async function clickLabel(sess, label) {
  const lit = label.includes("'") ? `"${label}"` : `'${label}'`;
  const el = await sess.find("xpath", `//*[normalize-space()=${lit}]`);
  if (!el) return false;
  await sess.click(el);
  await new Promise((r) => setTimeout(r, 400));
  return true;
}

export function sourceHas(html, needles) {
  const blob = String(html || "").toLowerCase();
  return needles.filter((n) => blob.includes(String(n).toLowerCase()));
}

export function bootFailed(html) {
  return /Official console JS did not boot|JSX console CONFIG was not exposed/i.test(html || "");
}
