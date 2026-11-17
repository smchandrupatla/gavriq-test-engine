/** Remove a versioned fixture owned by this case and verify it is gone. */
export function cleanupVersionedFixture(collection: 'datasets' | 'schemas', id: string) {
  const url = `{{api}}/api/v1/${collection}/{{${id}}}`;
  const etag = `${id}_cleanup_etag`;
  const authorization = 'Bearer {{token}}';
  return [
    { action: 'request', method: 'GET', url, headers: { authorization }, skip_if_missing: [id],
      expected_status: [200, 404], save: { [etag]: collection === 'datasets' ? 'etag' : 'data.etag' },
      text: 'Read the current version of this test’s temporary record',
      expected: 'The current version is available, or the temporary record has already been removed.',
      description: `read current ${collection} version for cleanup` },
    { action: 'request', method: 'DELETE', url, headers: { authorization, 'if-match': `{{${etag}}}` },
      skip_if_missing: [id, etag], expected_status: [200, 404],
      text: 'Remove this test’s temporary record', expected: 'The record is removed or was already absent.',
      description: `delete case-owned ${collection} fixture` },
    { action: 'request', method: 'GET', url, headers: { authorization }, skip_if_missing: [id], expected_status: 404,
      text: 'Check that the temporary record is no longer available',
      expected: 'The application reports that the removed record does not exist.',
      description: `verify ${collection} fixture was removed` },
  ];
}

/** Runs are deleted by their case-owned runId; this route has no version precondition. */
export function cleanupRunFixture(id: string, authorization = 'Bearer {{token}}') {
  const url = `{{api}}/api/v1/runs/{{${id}}}`;
  return [
    { action: 'request', method: 'DELETE', url, headers: { authorization }, skip_if_missing: [id],
      expected_status: [200, 404], description: 'remove the run created by this case' },
    { action: 'request', method: 'GET', url, headers: { authorization }, skip_if_missing: [id],
      expected_status: 404, description: 'verify the case-owned run is no longer available' },
  ];
}
