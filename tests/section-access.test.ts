import assert from 'node:assert/strict';
import test from 'node:test';
import { canReadSectionPage } from '../src/lib/section-access';

test('section pages are readable for public previews without enrollment', () => {
  assert.equal(canReadSectionPage(true, false, 12, 12, 18), true);
});

test('paid section pages require enrollment', () => {
  assert.equal(canReadSectionPage(false, false, 12, 12, 18), false);
  assert.equal(canReadSectionPage(false, true, 12, 12, 18), true);
});

test('section page requests outside the stored range are rejected', () => {
  assert.equal(canReadSectionPage(true, false, 11, 12, 18), false);
  assert.equal(canReadSectionPage(true, false, 19, 12, 18), false);
  assert.equal(canReadSectionPage(true, false, 12.5, 12, 18), false);
});
