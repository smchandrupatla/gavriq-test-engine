#!/usr/bin/env node
/**
 * Link every case that is red because of an application defect to the defect's
 * ticket, on the Test cases screen (triage: "Issue linked" + the ticket URL).
 *
 *   node scripts/link-known-defects.mjs            (TE_BASE, default http://127.0.0.1:8797)
 *
 * A case in this list asserts the DOCUMENTED behaviour and fails until the
 * application is fixed. It is never rewritten to expect the defect. When a ticket
 * is closed and the case passes, remove its line here and clear the triage.
 *
 * Triage is operator state in the engine (a reseed does not overwrite it), so
 * this script is the record of which ticket each known-defect case waits on.
 */
const TE = (process.env.TE_BASE || 'http://127.0.0.1:8797').replace(/\/$/, '');
const JIRA = 'https://gavriqlabsglobal.atlassian.net/browse';

/** ticket → the cases that wait on it */
export const KNOWN_DEFECTS = {
  'KAN-1810': ['SB-UC-roleCreate-EXC-1', 'SB-UC-roles-EXC-2'], // duplicate role name answers 500, documented 409
  'KAN-1811': ['SB-UC-roles-EXC-1'], // deleting a role that is still assigned answers 200, documented 409
  'KAN-1812': ['SB-UC-dsNew-ALT-1'], // adding a dataset item answers 500 (ALTER TABLE as the application role)
  'KAN-1813': ['SB-UC-tsNew-ALT-2', 'SB-UC-tsNew-EXC-2'], // invalid suite member list answers 500, documented 422
  'KAN-1814': ['SB-UC-msgCreateSchema-EXC-2'], // same schema under another name answers 500, documented 409
  'KAN-1815': ['SB-VS-CORS-NOT-REFLECTED'], // CORS reflects any Origin with credentials allowed
  'KAN-1818': ['SB-PERF-DBVIEWER-ROWS-INDEX'], // audit rows stored twice, one 1 MB: row listing is slow
};

let failed = 0;
for (const [ticket, keys] of Object.entries(KNOWN_DEFECTS)) {
  for (const key of keys) {
    const res = await fetch(`${TE}/api/v1/test-cases/${encodeURIComponent(key)}/triage`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'x-actor-id': 'known-defects' },
      body: JSON.stringify({ triageStatus: 'Issue linked', linkedIssueUrl: `${JIRA}/${ticket}` }),
    });
    if (!res.ok) failed++;
    console.log(`${key} -> ${ticket}: ${res.ok ? 'linked' : `HTTP ${res.status} ${(await res.text()).slice(0, 160)}`}`);
  }
}
process.exit(failed ? 1 : 0);
