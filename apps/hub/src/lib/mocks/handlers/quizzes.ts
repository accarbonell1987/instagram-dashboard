import { http, HttpResponse } from 'msw';

import { notFound, conflict, unprocessable } from './problem';

const BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:8080';

// ── In-memory stores for mock quiz data ────────────────────────────────────

interface MockQuiz {
  id: string;
  moduleId: string | null;
  title: string;
  description: string | null;
  passingScore: number;
  timeLimitMinutes: number | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  questions: MockQuestion[];
}

interface MockQuestion {
  id: string;
  quizId: string;
  text: string;
  type: 'multiple_choice' | 'true_false';
  order: number;
  createdAt: string;
  updatedAt: string;
  options: MockOption[];
}

interface MockOption {
  id: string;
  questionId: string;
  text: string;
  isCorrect: boolean;
  order: number;
  createdAt: string;
}

interface MockAttempt {
  id: string;
  quizId: string;
  tenantId: string;
  userId: string;
  score: number | null;
  passed: boolean | null;
  status: 'in_progress' | 'completed' | 'abandoned';
  startedAt: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  answers: MockAnswer[];
}

interface MockAnswer {
  id: string;
  attemptId: string;
  questionId: string;
  selectedOptionId: string | null;
  createdAt: string;
}

let quizStore: MockQuiz[] = [];
let attemptStore: MockAttempt[] = [];

function now(): string {
  return new Date().toISOString();
}

function uuid(): string {
  return crypto.randomUUID();
}

// ── Admin Quiz Handlers ────────────────────────────────────────────────────

export const quizHandlers = [
  // GET /admin/quizzes — List all quizzes
  http.get(`${BASE}/admin/quizzes`, ({ request }) => {
    const url = new URL(request.url);
    const activeParam = url.searchParams.get('active');

    let quizzes = quizStore;
    if (activeParam === 'true') quizzes = quizzes.filter((q) => q.active);
    else if (activeParam === 'false') quizzes = quizzes.filter((q) => !q.active);

    return HttpResponse.json({ quizzes }, { status: 200 });
  }),

  // POST /admin/quizzes — Create quiz
  http.post(`${BASE}/admin/quizzes`, async ({ request }) => {
    const body = (await request.json()) as {
      title?: string;
      description?: string;
      passingScore?: number;
      timeLimitMinutes?: number;
      moduleId?: string;
    };

    if (!body.title || body.title.trim().length === 0) {
      return unprocessable('Title is required');
    }

    const quiz: MockQuiz = {
      id: uuid(),
      moduleId: body.moduleId ?? null,
      title: body.title,
      description: body.description ?? null,
      passingScore: body.passingScore ?? 60,
      timeLimitMinutes: body.timeLimitMinutes ?? null,
      active: true,
      createdAt: now(),
      updatedAt: now(),
      questions: [],
    };

    quizStore.push(quiz);
    const { questions: _questions, ...quizWithoutQuestions } = quiz;
    return HttpResponse.json(quizWithoutQuestions, { status: 201 });
  }),

  // GET /admin/quizzes/:quizId — Get quiz with questions
  http.get(`${BASE}/admin/quizzes/:quizId`, ({ params }) => {
    const quiz = quizStore.find((q) => q.id === params['quizId']);
    if (!quiz) return notFound('quizzes.not_found');
    return HttpResponse.json(quiz, { status: 200 });
  }),

  // PATCH /admin/quizzes/:quizId — Update quiz
  http.patch(`${BASE}/admin/quizzes/:quizId`, async ({ params, request }) => {
    const quiz = quizStore.find((q) => q.id === params['quizId']);
    if (!quiz) return notFound('quizzes.not_found');

    const body = (await request.json()) as Record<string, unknown>;
    if (body['title'] !== undefined) quiz.title = body['title'] as string;
    if (body['description'] !== undefined) quiz.description = body['description'] as string | null;
    if (body['passingScore'] !== undefined) quiz.passingScore = body['passingScore'] as number;
    if (body['timeLimitMinutes'] !== undefined) quiz.timeLimitMinutes = body['timeLimitMinutes'] as number | null;
    if (body['active'] !== undefined) quiz.active = body['active'] as boolean;
    if (body['moduleId'] !== undefined) quiz.moduleId = body['moduleId'] as string | null;
    quiz.updatedAt = now();

    return HttpResponse.json(quiz, { status: 200 });
  }),

  // DELETE /admin/quizzes/:quizId — Archive quiz
  http.delete(`${BASE}/admin/quizzes/:quizId`, ({ params }) => {
    const quiz = quizStore.find((q) => q.id === params['quizId']);
    if (!quiz) return notFound('quizzes.not_found');
    quiz.active = false;
    quiz.updatedAt = now();
    return HttpResponse.json(quiz, { status: 200 });
  }),

  // POST /admin/quizzes/:quizId/questions — Add question
  http.post(`${BASE}/admin/quizzes/:quizId/questions`, async ({ params, request }) => {
    const quiz = quizStore.find((q) => q.id === params['quizId']);
    if (!quiz) return notFound('quizzes.not_found');

    const body = (await request.json()) as { text?: string; type?: string };
    if (!body.text) return unprocessable('Question text is required');

    const question: MockQuestion = {
      id: uuid(),
      quizId: quiz.id,
      text: body.text,
      type: (body.type as 'multiple_choice' | 'true_false') ?? 'multiple_choice',
      order: quiz.questions.length,
      createdAt: now(),
      updatedAt: now(),
      options: [],
    };

    if (question.type === 'true_false') {
      question.options.push(
        { id: uuid(), questionId: question.id, text: 'Verdadero', isCorrect: false, order: 0, createdAt: now() },
        { id: uuid(), questionId: question.id, text: 'Falso', isCorrect: false, order: 1, createdAt: now() },
      );
    }

    quiz.questions.push(question);
    return HttpResponse.json(question, { status: 201 });
  }),

  // PATCH /admin/quizzes/:quizId/questions/:questionId — Update question
  http.patch(`${BASE}/admin/quizzes/:quizId/questions/:questionId`, async ({ params, request }) => {
    const quiz = quizStore.find((q) => q.id === params['quizId']);
    if (!quiz) return notFound('quizzes.not_found');

    const question = quiz.questions.find((q) => q.id === params['questionId']);
    if (!question) return notFound('questions.not_found');

    const body = (await request.json()) as Record<string, unknown>;
    if (body['text'] !== undefined) question.text = body['text'] as string;
    if (body['type'] !== undefined) question.type = body['type'] as 'multiple_choice' | 'true_false';
    question.updatedAt = now();

    return HttpResponse.json(question, { status: 200 });
  }),

  // DELETE /admin/quizzes/:quizId/questions/:questionId — Delete question
  http.delete(`${BASE}/admin/quizzes/:quizId/questions/:questionId`, ({ params }) => {
    const quiz = quizStore.find((q) => q.id === params['quizId']);
    if (!quiz) return notFound('quizzes.not_found');

    const idx = quiz.questions.findIndex((q) => q.id === params['questionId']);
    if (idx === -1) return notFound('questions.not_found');

    quiz.questions.splice(idx, 1);
    return new HttpResponse(null, { status: 204 });
  }),

  // PUT /admin/quizzes/:quizId/questions/reorder — Reorder questions
  http.put(`${BASE}/admin/quizzes/:quizId/questions/reorder`, async ({ params, request }) => {
    const quiz = quizStore.find((q) => q.id === params['quizId']);
    if (!quiz) return notFound('quizzes.not_found');

    const body = (await request.json()) as { orderedIds?: string[] };
    if (!body.orderedIds) return unprocessable('orderedIds is required');

    const reordered: MockQuestion[] = [];
    for (const id of body.orderedIds) {
      const question = quiz.questions.find((q) => q.id === id);
      if (question) {
        question.order = reordered.length;
        reordered.push(question);
      }
    }
    quiz.questions = reordered;
    return new HttpResponse(null, { status: 204 });
  }),

  // POST /admin/quizzes/:quizId/questions/:questionId/options — Add option
  http.post(`${BASE}/admin/quizzes/:quizId/questions/:questionId/options`, async ({ params, request }) => {
    const quiz = quizStore.find((q) => q.id === params['quizId']);
    if (!quiz) return notFound('quizzes.not_found');

    const question = quiz.questions.find((q) => q.id === params['questionId']);
    if (!question) return notFound('questions.not_found');

    const body = (await request.json()) as { text?: string; isCorrect?: boolean };
    if (!body.text) return unprocessable('Option text is required');

    const option: MockOption = {
      id: uuid(),
      questionId: question.id,
      text: body.text,
      isCorrect: body.isCorrect ?? false,
      order: question.options.length,
      createdAt: now(),
    };
    question.options.push(option);
    return HttpResponse.json(option, { status: 201 });
  }),

  // PATCH /admin/quizzes/:quizId/questions/:questionId/options/:optionId — Update option
  http.patch(`${BASE}/admin/quizzes/:quizId/questions/:questionId/options/:optionId`, async ({ params, request }) => {
    const quiz = quizStore.find((q) => q.id === params['quizId']);
    if (!quiz) return notFound('quizzes.not_found');

    const question = quiz.questions.find((q) => q.id === params['questionId']);
    if (!question) return notFound('questions.not_found');

    const option = question.options.find((o) => o.id === params['optionId']);
    if (!option) return notFound('questions.not_found');

    const body = (await request.json()) as Record<string, unknown>;
    if (body['text'] !== undefined) option.text = body['text'] as string;
    if (body['isCorrect'] !== undefined) option.isCorrect = body['isCorrect'] as boolean;

    return HttpResponse.json(option, { status: 200 });
  }),

  // DELETE /admin/quizzes/:quizId/questions/:questionId/options/:optionId — Delete option
  http.delete(`${BASE}/admin/quizzes/:quizId/questions/:questionId/options/:optionId`, ({ params }) => {
    const quiz = quizStore.find((q) => q.id === params['quizId']);
    if (!quiz) return notFound('quizzes.not_found');

    const question = quiz.questions.find((q) => q.id === params['questionId']);
    if (!question) return notFound('questions.not_found');

    const idx = question.options.findIndex((o) => o.id === params['optionId']);
    if (idx === -1) return notFound('questions.not_found');

    question.options.splice(idx, 1);
    return new HttpResponse(null, { status: 204 });
  }),

  // ── Tenant Quiz Handlers ───────────────────────────────────────────────

  // GET /tenants/current/quizzes — List available quizzes
  http.get(`${BASE}/tenants/current/quizzes`, () => {
    const activeQuizzes = quizStore.filter((q) => q.active);
    return HttpResponse.json({ quizzes: activeQuizzes.map((q) => ({ ...q, questions: undefined, questionCount: q.questions.length })) }, { status: 200 });
  }),

  // GET /tenants/current/quizzes/:quizId — Get quiz detail
  http.get(`${BASE}/tenants/current/quizzes/:quizId`, ({ params }) => {
    const quiz = quizStore.find((q) => q.id === params['quizId']);
    if (!quiz || !quiz.active) return notFound('quizzes.not_found');
    return HttpResponse.json({ ...quiz, questions: undefined, questionCount: quiz.questions.length }, { status: 200 });
  }),

  // POST /tenants/current/quizzes/:quizId/attempts — Start attempt
  http.post(`${BASE}/tenants/current/quizzes/:quizId/attempts`, ({ params }) => {
    const quiz = quizStore.find((q) => q.id === params['quizId']);
    if (!quiz || !quiz.active) return notFound('quizzes.not_found');

    const existing = attemptStore.find((a) => a.quizId === quiz.id && a.status === 'in_progress');
    if (existing) return conflict('attempts.already_in_progress');

    const attempt: MockAttempt = {
      id: uuid(),
      quizId: quiz.id,
      tenantId: 'tenant-mock-uuid',
      userId: 'user-mock-uuid',
      score: null,
      passed: null,
      status: 'in_progress',
      startedAt: now(),
      completedAt: null,
      createdAt: now(),
      updatedAt: now(),
      answers: [],
    };

    attemptStore.push(attempt);
    return HttpResponse.json({ attempt, quiz }, { status: 201 });
  }),

  // POST /tenants/current/quizzes/:quizId/attempts/:attemptId/answers — Submit answer
  http.post(`${BASE}/tenants/current/quizzes/:quizId/attempts/:attemptId/answers`, async ({ params, request }) => {
    const attempt = attemptStore.find((a) => a.id === params['attemptId']);
    if (!attempt) return notFound('attempts.not_found');
    if (attempt.status !== 'in_progress') return conflict('attempts.already_submitted');

    const body = (await request.json()) as { questionId?: string; selectedOptionId?: string | null };

    const answerIdx = attempt.answers.findIndex((a) => a.questionId === body.questionId);
    const answer: MockAnswer = {
      id: uuid(),
      attemptId: attempt.id,
      questionId: body.questionId ?? '',
      selectedOptionId: body.selectedOptionId ?? null,
      createdAt: now(),
    };

    if (answerIdx >= 0) {
      attempt.answers[answerIdx] = answer;
    } else {
      attempt.answers.push(answer);
    }

    return HttpResponse.json(answer, { status: 200 });
  }),

  // POST /tenants/current/quizzes/:quizId/attempts/:attemptId/complete — Complete attempt
  http.post(`${BASE}/tenants/current/quizzes/:quizId/attempts/:attemptId/complete`, ({ params }) => {
    const attempt = attemptStore.find((a) => a.id === params['attemptId']);
    if (!attempt) return notFound('attempts.not_found');
    if (attempt.status !== 'in_progress') return conflict('attempts.already_submitted');

    const quiz = quizStore.find((q) => q.id === attempt.quizId);
    if (!quiz) return notFound('quizzes.not_found');

    // Calculate score
    let correctCount = 0;
    for (const question of quiz.questions) {
      const correctOption = question.options.find((o) => o.isCorrect);
      const answer = attempt.answers.find((a) => a.questionId === question.id);
      if (correctOption && answer && answer.selectedOptionId === correctOption.id) {
        correctCount++;
      }
    }

    const score = quiz.questions.length > 0
      ? Math.round((correctCount / quiz.questions.length) * 100)
      : 0;
    const passed = score >= quiz.passingScore;

    attempt.score = score;
    attempt.passed = passed;
    attempt.status = 'completed';
    attempt.completedAt = now();
    attempt.updatedAt = now();

    return HttpResponse.json(attempt, { status: 200 });
  }),

  // GET /tenants/current/quizzes/:quizId/attempts — List user attempts
  http.get(`${BASE}/tenants/current/quizzes/:quizId/attempts`, ({ params }) => {
    const userAttempts = attemptStore.filter((a) => a.quizId === params['quizId']);
    return HttpResponse.json({ attempts: userAttempts }, { status: 200 });
  }),

  // GET /tenants/current/quizzes/:quizId/attempts/:attemptId — Get attempt detail
  http.get(`${BASE}/tenants/current/quizzes/:quizId/attempts/:attemptId`, ({ params }) => {
    const attempt = attemptStore.find((a) => a.id === params['attemptId']);
    if (!attempt) return notFound('attempts.not_found');

    const quiz = quizStore.find((q) => q.id === attempt.quizId);
    const answersWithQuestions = attempt.answers.map((a) => {
      const question = quiz?.questions.find((q) => q.id === a.questionId);
      const selectedOption = question?.options.find((o) => o.id === a.selectedOptionId);
      return {
        ...a,
        question: question ?? null,
        selectedOption: selectedOption ?? null,
      };
    });

    return HttpResponse.json({ ...attempt, answers: answersWithQuestions }, { status: 200 });
  }),
];
