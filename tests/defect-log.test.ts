import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { canMoveLog, decodeAttachment, isLogStatus, isSeverity, LogError, MAX_ATTACHMENT_BYTES } from '../apps/api/src/defect-log.ts';

describe('defect log lifecycle', () => {
  it('moves logged -> validated -> sent, or logged -> rejected', () => {
    assert.equal(canMoveLog('logged', 'validated'), true);
    assert.equal(canMoveLog('validated', 'sent'), true);
    assert.equal(canMoveLog('logged', 'rejected'), true);
  });

  it('lets a rejected defect be reopened, but a sent defect is final', () => {
    assert.equal(canMoveLog('rejected', 'logged'), true);
    assert.equal(canMoveLog('sent', 'logged'), false);
    assert.equal(canMoveLog('sent', 'rejected'), false);
  });

  it('does not skip validation on the way out, and staying put is always allowed', () => {
    assert.equal(canMoveLog('rejected', 'validated'), false);
    assert.equal(canMoveLog('validated', 'validated'), true);
  });

  it('accepts only known statuses and severities', () => {
    assert.equal(isLogStatus('validated'), true);
    assert.equal(isLogStatus('closed'), false);
    assert.equal(isSeverity('critical'), true);
    assert.equal(isSeverity('blocker'), false);
  });
});

describe('attachments', () => {
  it('decodes base64 content', () => {
    const bytes = decodeAttachment(Buffer.from('screen').toString('base64'));
    assert.equal(bytes.toString(), 'screen');
  });

  it('refuses empty and oversized content with a client error', () => {
    assert.throws(() => decodeAttachment(''), (e: unknown) => e instanceof LogError && e.statusCode === 400);
    const big = Buffer.alloc(MAX_ATTACHMENT_BYTES + 1, 1).toString('base64');
    assert.throws(() => decodeAttachment(big), (e: unknown) => e instanceof LogError && e.statusCode === 413);
  });
});
