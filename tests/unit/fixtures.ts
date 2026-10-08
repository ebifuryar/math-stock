// tests/unit/fixtures.ts
import { problemSchema, type Format, type Problem } from '@/domain/schema';

const BODIES = {
  choice: {
    kind: 'choice',
    choices: [
      { id: 'a', text: '$1$', rationale: '正解' },
      { id: 'b', text: '$2$', rationale: '誤り', misconceptionId: 'mc-x' },
    ],
    answerId: 'a',
  },
  mark: {
    kind: 'mark',
    blanks: [
      { label: 'ア', answer: '-2' },
      { label: 'イ', answer: '1/2', accept: ['0.5'] },
    ],
  },
  written: {
    kind: 'written',
    modelAnswer: '$(x-2)^2-3$',
    rubric: [
      { id: 'r1', criterion: '平方完成', points: 2, keywords: ['(x-2)^2-3'] },
      { id: 'r2', criterion: '最大値', points: 3, keywords: ['x=5', '最大値6'] },
    ],
  },
} as const;

export function makeProblem(format: Format, overrides: Partial<Record<string, unknown>> = {}): Problem {
  return problemSchema.parse({
    id: `p-${format}`,
    version: 1,
    subjectId: 'math1',
    unitId: 'math1-test',
    level: 'school',
    format,
    title: 't',
    stem: '問題',
    body: BODIES[format],
    solution: '解説',
    targetSeconds: 60,
    irt: { expectedCorrectRate: 0.5 },
    author: { intent: 'ねらい', assessedAbilities: ['知識・技能'], curriculumRefs: ['x'] },
    ...overrides,
  });
}
