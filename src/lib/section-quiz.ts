export interface SectionQuizQuestionKey {
  id: number;
  answerIndex: number;
}

export interface SectionQuizAnswer {
  questionId: number;
  answerIndex: number;
}

export function gradeSectionAttempt(
  questions: SectionQuizQuestionKey[],
  answers: SectionQuizAnswer[],
  passPercent = 70,
) {
  if (!questions.length || answers.length !== questions.length) return null;
  const answerByQuestion = new Map<number, number>();
  for (const answer of answers) {
    if (answerByQuestion.has(answer.questionId)) return null;
    answerByQuestion.set(answer.questionId, answer.answerIndex);
  }
  if (questions.some(question => !answerByQuestion.has(question.id))) return null;

  const score = questions.reduce(
    (total, question) => total + Number(answerByQuestion.get(question.id) === question.answerIndex),
    0,
  );
  const percent = Math.round(score * 100 / questions.length);
  return { score, total: questions.length, percent, passed: percent >= passPercent };
}

export function isSectionUnlocked(index: number, completed: boolean, previousCompleted: boolean) {
  return index === 0 || completed || previousCompleted;
}
