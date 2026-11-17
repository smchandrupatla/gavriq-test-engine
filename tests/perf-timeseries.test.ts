/**
 * Performance runs must produce a time series the console can graph.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { bucketize, runPerformance, type Sample } from '../apps/worker/src/runners/performance.ts';

describe('bucketize', () => {
  it('groups samples per second and fills empty seconds with zeros', () => {
    const samples: Sample[] = [
      { t_ms: 10, latency_ms: 20, ok: true, status: 200 },
      { t_ms: 400, latency_ms: 40, ok: false, status: 500 },
      { t_ms: 2100, latency_ms: 30, ok: true, status: 200 },
    ];
    const series = bucketize(samples);
    assert.equal(series.length, 3);
    assert.deepEqual(series.map((b) => b.requests), [2, 0, 1]);
    assert.deepEqual(series.map((b) => b.errors), [1, 0, 0]);
    assert.equal(series[0]!.latency_max_ms, 40);
    assert.equal(series[0]!.latency_avg_ms, 30);
    assert.equal(series[2]!.t_s, 2);
  });

  it('returns nothing for no samples', () => {
    assert.deepEqual(bucketize([]), []);
  });
});

describe('runPerformance', () => {
  it('records every request and a time series', async () => {
    let hits = 0;
    const server = createServer((_req, res) => {
      hits++;
      res.statusCode = hits % 5 === 0 ? 503 : 200;
      res.end('ok');
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    const { port } = server.address() as AddressInfo;
    try {
      const r = await runPerformance({ baseUrl: `http://127.0.0.1:${port}`, path: '/x', requests: 25, concurrency: 5, sla: { error_rate_pct: 50 } });
      assert.equal(r.samples.length, 25);
      assert.equal(r.metrics.total_requests, 25);
      assert.equal(r.metrics.failed, 5);
      assert.ok(r.timeseries.length >= 1);
      assert.equal(r.timeseries.reduce((n, b) => n + b.requests, 0), 25);
      assert.equal(r.status, 'passed');
    } finally {
      server.close();
    }
  });

  it('runs for a duration in endurance mode', async () => {
    const server = createServer((_req, res) => { setTimeout(() => res.end('ok'), 5); });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    const { port } = server.address() as AddressInfo;
    try {
      const started = Date.now();
      const r = await runPerformance({ baseUrl: `http://127.0.0.1:${port}`, durationSeconds: 1, concurrency: 2 });
      assert.ok(Date.now() - started >= 1000);
      // Bounded by time, not by the default request count of 20.
      assert.ok(r.samples.length >= 2, `expected repeated requests, got ${r.samples.length}`);
      assert.ok(r.timeseries.length >= 1);
      assert.equal(r.metrics.total_requests, r.samples.length);
    } finally {
      server.close();
    }
  });
});
