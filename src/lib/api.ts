const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

async function callFunction<T>(
  name: string,
  options: { body?: unknown; adminToken?: string; userToken?: string; method?: string } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    apikey: ANON_KEY,
    'Content-Type': 'application/json',
  }
  if (options.adminToken) headers['x-admin-token'] = options.adminToken
  if (options.userToken) headers['x-user-token'] = options.userToken

  const res = await fetch(`${FUNCTIONS_URL}/${name}`, {
    method: options.method ?? (options.body ? 'POST' : 'GET'),
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  const data = await res.json()
  if (!res.ok) throw new ApiError(data.error ?? 'unknown_error', res.status)
  return data as T
}

export class ApiError extends Error {
  status: number
  constructor(code: string, status: number) {
    super(code)
    this.status = status
  }
}

export interface Cohort {
  id: string
  name: string
  staff_name: string
  leader_name: string
  kjv_year: string
}

export interface Student {
  id: string
  name: string
  display_name: string
  status: 'pending' | 'active'
  cohort_id: string
  created_at: string
}

export type ShareScope = 'private' | 'all' | 'selected'
export type ProblemShareScope = 'inherit' | ShareScope
export type ProblemType = 'mcq' | 'short' | 'bible'

export interface Project {
  id: string
  owner_id: string
  title: string
  share_scope: ShareScope
  created_at: string
  isOwner: boolean
}

export interface Problem {
  id: string
  project_id: string
  type: ProblemType
  question: string
  options: Record<string, string> | null
  answer: string
  keywords: string | null
  ref_course: string | null
  ref_session: string | null
  ref_location: string | null
  share_scope: ProblemShareScope
  created_at: string
}

export const api = {
  checkPhone: (phone: string) => callFunction<{ registered: boolean; status?: string }>('check-phone', { body: { phone } }),

  activateAccount: (payload: {
    phone: string
    name: string
    staffName: string
    leaderName: string
    kjvYear: string
    password: string
  }) => callFunction<{ success: true }>('activate-account', { body: payload }),

  login: (phone: string, password: string) =>
    callFunction<{ success: true; token: string; user: { id: string; displayName: string } }>('login', {
      body: { phone, password },
    }),

  adminLogin: (loginId: string, password: string) =>
    callFunction<{ success: true; token: string }>('admin-login', { body: { loginId, password } }),

  adminListCohorts: (adminToken: string) =>
    callFunction<{ cohorts: Cohort[] }>('admin-list-cohorts', { adminToken, method: 'GET' }),

  adminCreateCohort: (
    adminToken: string,
    payload: { name: string; staffName: string; leaderName: string; kjvYear: string },
  ) => callFunction<{ success: true; cohort: { id: string; name: string } }>('admin-create-cohort', { adminToken, body: payload }),

  adminListStudents: (adminToken: string, cohortId?: string) =>
    callFunction<{ students: Student[] }>(
      `admin-list-students${cohortId ? `?cohortId=${cohortId}` : ''}`,
      { adminToken, method: 'GET' },
    ),

  adminCreateStudent: (
    adminToken: string,
    payload: { name: string; phone: string; cohortId: string; displayName?: string },
  ) => callFunction<{ success: true; student: Student }>('admin-create-student', { adminToken, body: payload }),

  listProjects: (userToken: string) =>
    callFunction<{ projects: Project[] }>('list-projects', { userToken, method: 'GET' }),

  createProject: (userToken: string, payload: { title: string; shareScope?: ShareScope }) =>
    callFunction<{ success: true; project: Project }>('create-project', { userToken, body: payload }),

  updateProject: (
    userToken: string,
    payload: { projectId: string; title?: string; shareScope?: ShareScope; sharedUserIds?: string[] },
  ) => callFunction<{ success: true }>('update-project', { userToken, body: payload }),

  deleteProject: (userToken: string, projectId: string) =>
    callFunction<{ success: true }>('delete-project', { userToken, body: { projectId } }),

  listProblems: (userToken: string, projectId: string) =>
    callFunction<{ problems: Problem[]; isOwner: boolean }>(`list-problems?projectId=${projectId}`, {
      userToken,
      method: 'GET',
    }),

  startQuizSession: (userToken: string, payload: { projectId?: string; count?: number }) =>
    callFunction<{ success: true; sessionId: string; problems: Problem[] }>('start-quiz-session', { userToken, body: payload }),

  submitAnswer: (userToken: string, payload: { sessionId: string; problemId: string; userAnswer: string }) =>
    callFunction<{ success: true; isCorrect: boolean; matchScore: number }>('submit-answer', { userToken, body: payload }),

  finishQuizSession: (userToken: string, sessionId: string) =>
    callFunction<{ success: true; total: number; correct: number; score: number }>('finish-quiz-session', { userToken, body: { sessionId } }),

  quizHistory: (userToken: string) =>
    callFunction<{ sessions: Array<{ id: string; started_at: string; total: number; correct: number }> }>('quiz-history', { userToken, method: 'GET' }),

  createProblem: (
    userToken: string,
    payload: {
      projectId: string
      type: ProblemType
      question: string
      options?: Record<string, string>
      answer: string
      keywords?: string
      refCourse?: string
      refSession?: string
      refLocation?: string
      shareScope?: ProblemShareScope
    },
  ) => callFunction<{ success: true; problem: Problem }>('create-problem', { userToken, body: payload }),

  bulkCreateProblems: (
    userToken: string,
    projectId: string,
    problems: Array<{
      type: ProblemType
      question: string
      options?: Record<string, string>
      answer: string
      keywords?: string
      refCourse?: string
      refSession?: string
      refLocation?: string
    }>,
  ) => callFunction<{ success: true; created: number }>('bulk-create-problems', { userToken, body: { projectId, problems } }),

  updateProblem: (
    userToken: string,
    payload: {
      problemId: string
      type?: ProblemType
      question?: string
      options?: Record<string, string>
      answer?: string
      keywords?: string
      refCourse?: string
      refSession?: string
      refLocation?: string
      shareScope?: ProblemShareScope
      sharedUserIds?: string[]
    },
  ) => callFunction<{ success: true }>('update-problem', { userToken, body: payload }),

  deleteProblem: (userToken: string, problemId: string) =>
    callFunction<{ success: true }>('delete-problem', { userToken, body: { problemId } }),
}
