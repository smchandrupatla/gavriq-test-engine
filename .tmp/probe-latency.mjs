// Scratch probe (not part of the suite): same load shape as TE-PERF-SB-HEALTH-LOAD
// (200 requests, 10 at a time), measured from wherever this script runs.
//   node .tmp/probe-latency.mjs http://127.0.0.1:8080/health [requests] [concurrency]
const [url, requests = '200', concurrency = '10'] = process.argv.slice(2);
const total = Number(requests);
const lat = [];
let ok = 0;
let next = 0;
const start = Date.now();
async function worker() {
  while (next < total) {
    next++;
    const t0 = Date.now();
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      await res.arrayBuffer();
      if (res.ok) ok++;
    } catch { /* counted as not ok */ }
    lat.push(Date.now() - t0);
  }
}
await Promise.all(Array.from({ length: Number(concurrency) }, worker));
lat.sort((a, b) => a - b);
const p = (q) => lat[Math.min(lat.length - 1, Math.ceil((q / 100) * lat.length) - 1)];
const secs = (Date.now() - start) / 1000;
console.log(`${url}  ok=${ok}/${total}  p50=${p(50)}ms p95=${p(95)}ms p99=${p(99)}ms max=${lat[lat.length - 1]}ms  rps=${(total / secs).toFixed(1)}`);
