import { ENV } from "../env.ts";

export async function enterConsole(sess) {
  await sess.go(`${ENV.webBase}/`);
  // The current demo console mounts automatically. Do not type into its hidden gate.
  await new Promise((r) => setTimeout(r, 2000));
  if (await sess.find('css selector', '#console-root:not(.hidden) .opsc-sidebar')) return sess.source();
  const tenant = await sess.find("css selector", "#gate:not(.hidden) #tenant");
  if (tenant) { await sess.clear(tenant); await sess.type(tenant, ENV.tenantSlug || "acme-demo"); }
  const user = await sess.find("css selector", "#gate:not(.hidden) #username");
  if (user) { await sess.clear(user); await sess.type(user, ENV.username || "analyst.acme"); }
  const password = await sess.find('css selector', '#gate:not(.hidden) #password');
  if (password) { await sess.clear(password); await sess.type(password, ENV.password); }
  const login = await sess.find("css selector", "#gate:not(.hidden) #login");
  if (login) await sess.click(login);
  for (let attempt = 0; attempt < 40; attempt++) {
    if (await sess.find('css selector', '#console-root:not(.hidden) .opsc-sidebar')) return sess.source();
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('Console did not mount after sign-in');
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
