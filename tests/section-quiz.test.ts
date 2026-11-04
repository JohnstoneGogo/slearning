import assert from 'node:assert/strict';
import test from 'node:test';
import { gradeSectionAttempt, isSectionUnlocked } from '../src/lib/section-quiz';

const questions = [
  { id: 11, answerIndex: 1 },
  { id: 12, answerIndex: 0 },
  { id: 13, answerIndex: 2 },
];

test('section quiz grades answers by question id and applies the 70 percent pass mark', () => {
  assert.deepEqual(gradeSectionAttempt(questions, [
    { questionId: 13, answerIndex: 2 },
    { questionId: 11, answerIndex: 1 },
    { questionId: 12, answerIndex: 1 },
  ]), { score: 2, total: 3, percent: 67, passed: false });
  assert.deepEqual(gradeSectionAttempt(questions, [
    { questionId: 11, answerIndex: 1 },
    { questionId: 12, answerIndex: 0 },
    { questionId: 13, answerIndex: 2 },
  ]), { score: 3, total: 3, percent: 100, passed: true });
});

test('section quiz rejects missing, duplicate, or unrelated answers', () => {
  assert.equal(gradeSectionAttempt(questions, [{ questionId: 11, answerIndex: 1 }]), null);
  assert.equal(gradeSectionAttempt(questions, [
    { questionId: 11, answerIndex: 1 },
    { questionId: 11, answerIndex: 1 },
    { questionId: 13, answerIndex: 2 },
  ]), null);
  assert.equal(gradeSectionAttempt(questions, [
    { questionId: 11, answerIndex: 1 },
    { questionId: 12, answerIndex: 0 },
    { questionId: 999, answerIndex: 2 },
  ]), null);
});

test('the first section is open and later sections unlock after passing the prior quiz', () => {
  assert.equal(isSectionUnlocked(0, false, false), true);
  assert.equal(isSectionUnlocked(1, false, false), false);
  assert.equal(isSectionUnlocked(1, false, true), true);
  assert.equal(isSectionUnlocked(1, true, false), true);
});
