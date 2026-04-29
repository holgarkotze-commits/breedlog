import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePreviewPath } from '../client/src/lib/route-normalization';

test('normalizes Replit preview iframe paths to root', () => {
  assert.equal(normalizePreviewPath('/__replco/workspace_iframe.html'), '/');
  assert.equal(normalizePreviewPath('/_replco/workspace_iframe.html'), '/');
  assert.equal(normalizePreviewPath('/foo/workspace_iframe.html?x=1'), '/');
});

test('keeps valid app routes unchanged', () => {
  for (const route of ['/', '/records', '/analysis', '/settings', '/health', '/animals', '/breeding']) {
    assert.equal(normalizePreviewPath(route), route);
  }
});
