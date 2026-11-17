import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { uniqueBuildServices } from '../deploy/staging/build-targets.mjs';

describe('pinned staging image builds', () => {
  it('builds a shared API and worker image once and retains independent services', () => {
    const build = { context: '/pinned-source', dockerfile: 'Dockerfile', args: { SBE_BUILD_COMMIT: 'fixture-commit' } };
    const config = { services: {
      api: { image: 'fixture-app:pinned', build },
      worker: { image: 'fixture-app:pinned', build: structuredClone(build) },
      web: { image: 'fixture-web:pinned', build: { context: '/pinned-source/apps/web' } },
      external: { image: 'fixture-external:pinned' },
    } };
    assert.deepEqual(uniqueBuildServices(['api', 'worker', 'web', 'external'], config), ['api', 'web']);
  });

  it('refuses to choose between conflicting sources for the same image tag', () => {
    const config = { services: {
      api: { image: 'fixture-app:pinned', build: { context: '/pin-a' } },
      worker: { image: 'fixture-app:pinned', build: { context: '/pin-b' } },
    } };
    assert.throws(() => uniqueBuildServices(['api', 'worker'], config), /conflicting build definitions/);
  });

  it('reports a missing required service instead of silently omitting it', () => {
    assert.throws(() => uniqueBuildServices(['api'], { services: {} }), /service is missing.*api/);
  });
});
