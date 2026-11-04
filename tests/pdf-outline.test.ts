import test from 'node:test';
import assert from 'node:assert/strict';
import { publicPdfOutline, readPdfOutline } from '../src/lib/pdf-outline';

const storedOutline = {
  total_pages: 12,
  total_minutes: 42,
  outline_source: 'bookmarks',
  flat: [{
    id: 1,
    title: 'Chapter One',
    level: 1,
    start_page: 2,
    end_page: 7,
    words: 7000,
    minutes: 39,
    category: { key: 'medium', label: 'About an hour', hint: '30-59 min' },
    excerpt: 'A private section excerpt.',
  }],
};

test('public PDF preview outline retains page ranges and excerpts', () => {
  assert.deepEqual(publicPdfOutline(storedOutline, true), storedOutline);
});

test('paid public outline exposes titles and time badges only', () => {
  const outline = publicPdfOutline(storedOutline, false);
  assert.deepEqual(outline, {
    total_minutes: 42,
    flat: [{
      id: 1,
      title: 'Chapter One',
      level: 1,
      minutes: 39,
      category: { key: 'medium', label: 'About an hour', hint: '30-59 min' },
    }],
  });
  assert.equal(JSON.stringify(outline).includes('start_page'), false);
  assert.equal(JSON.stringify(outline).includes('excerpt'), false);
  assert.equal(JSON.stringify(outline).includes('words'), false);
});

test('invalid stored outline data is treated as unavailable', () => {
  assert.equal(readPdfOutline({ ...storedOutline, flat: [] }), null);
  assert.equal(readPdfOutline({ total_minutes: 10, flat: [{ title: 'Missing category' }] }), null);
});
