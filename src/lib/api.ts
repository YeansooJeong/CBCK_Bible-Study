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
  is_admin: boolean
}

export interface ModeratedProblem {
  id: string
  projectId: string
  projectTitle: string
  ownerName: string
  type: ProblemType
  question: string
  options: Record<string, string> | null
  answer: string
  keywords: string | null
  refCourse: string | null
  refSession: string | null
  refKind: RefKind | null
  refDetail: string | null
  shareScope: ProblemShareScope
  createdAt: string
}

export type ShareScope = 'private' | 'all' | 'selected'
export type ProblemShareScope = 'inherit' | ShareScope
export type ProblemType = 'mcq' | 'short' | 'bible'
export type RefKind = '강의요약본' | '강의영상'

export interface Project {
  id: string
  title: string
  session_count: number
  created_at: string
}

export interface Problem {
  id: string
  project_id: string
  author_id: string
  type: ProblemType
  question: string
  options: Record<string, string> | null
  answer: string
  keywords: string | null
  ref_course: string | null
  ref_session: string | null
  ref_kind: RefKind | null
  ref_detail: string | null
  share_scope: ProblemShareScope
  created_at: string
}

export interface ProblemComment { id: string; problem_id: string; author_id: string; content: string; parent_comment_id: string | null; created_at: string; updated_at: string; users?: { display_name: string | null } | null }

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
    callFunction<{ success: true; token: string; user: { id: string; displayName: string; isAdmin: boolean } }>('login', {
      body: { phone, password },
    }),

  adminLogin: (loginId: string, password: string) =>
    callFunction<{ success: true; token: string }>('admin-login', { body: { loginId, password } }),

  adminListCohorts: (actor: { adminToken?: string; userToken?: string }) =>
    callFunction<{ cohorts: Cohort[] }>('admin-list-cohorts', { ...actor, method: 'GET' }),

  adminCreateCohort: (
    adminToken: string,
    payload: { name: string; staffName: string; leaderName: string; kjvYear: string },
  ) => callFunction<{ success: true; cohort: { id: string; name: string } }>('admin-create-cohort', { adminToken, body: payload }),

  adminUpdateCohort: (
    adminToken: string,
    payload: { cohortId: string; name?: string; staffName?: string; leaderName?: string; kjvYear?: string },
  ) => callFunction<{ success: true; cohort: Cohort }>('admin-update-cohort', { adminToken, body: payload }),

  adminDeleteCohort: (adminToken: string, cohortId: string) =>
    callFunction<{ success: true }>('admin-delete-cohort', { adminToken, body: { cohortId } }),

  bulkCreateStudents: (
    actor: { adminToken?: string; userToken?: string },
    payload: { cohortId: string; students: Array<{ name: string; phone: string }> },
  ) =>
    callFunction<{ success: true; created: number; failed: Array<{ row: number; name: string; phone: string; reason: string }> }>(
      'bulk-create-students',
      { ...actor, body: payload },
    ),

  adminSetStudentRole: (adminToken: string, studentId: string, isAdmin: boolean) =>
    callFunction<{ success: true; student: Student }>('admin-set-student-role', { adminToken, body: { studentId, isAdmin } }),

  adminListProblems: (actor: { adminToken?: string; userToken?: string }) =>
    callFunction<{ problems: ModeratedProblem[] }>('admin-list-problems', { ...actor, method: 'GET' }),

  adminUpdateProblem: (
    actor: { adminToken?: string; userToken?: string },
    payload: {
      problemId: string
      type?: ProblemType
      question?: string
      options?: Record<string, string> | null
      answer?: string
      keywords?: string | null
      refSession?: string | null
      refKind?: RefKind | null
      refDetail?: string | null
    },
  ) => callFunction<{ success: true }>('admin-update-problem', { ...actor, body: payload }),

  adminDeleteProblem: (actor: { adminToken?: string; userToken?: string }, problemId: string) =>
    callFunction<{ success: true }>('admin-delete-problem', { ...actor, body: { problemId } }),

  adminListStudents: (actor: { adminToken?: string; userToken?: string }, cohortId?: string) =>
    callFunction<{ students: Student[] }>(
      `admin-list-students${cohortId ? `?cohortId=${cohortId}` : ''}`,
      { ...actor, method: 'GET' },
    ),

  adminCreateStudent: (
    actor: { adminToken?: string; userToken?: string },
    payload: { name: string; phone: string; cohortId: string; displayName?: string },
  ) => callFunction<{ success: true; student: Student }>('admin-create-student', { ...actor, body: payload }),

  adminUpdateStudent: (
    actor: { adminToken?: string; userToken?: string },
    payload: { studentId: string; name?: string; displayName?: string; cohortId?: string; resetToPending?: boolean },
  ) => callFunction<{ success: true; student: Student }>('admin-update-student', { ...actor, body: payload }),

  adminDeleteStudent: (actor: { adminToken?: string; userToken?: string }, studentId: string) =>
    callFunction<{ success: true }>('admin-delete-student', { ...actor, body: { studentId } }),

  adminViewStudentPhone: (adminToken: string, studentId: string) =>
    callFunction<{ success: true; phone: string }>('admin-view-student-phone', { adminToken, body: { studentId } }),

  adminListAuditLog: (adminToken: string) =>
    callFunction<{ entries: Array<{ id: number; action: string; createdAt: string; actorName: string; targetName: string }> }>(
      'admin-list-audit-log',
      { adminToken, method: 'GET' },
    ),

  listProjects: (actor: { adminToken?: string; userToken?: string }) =>
    callFunction<{ projects: Project[] }>('list-projects', { ...actor, method: 'GET' }),

  createProject: (actor: { adminToken?: string; userToken?: string }, payload: { title: string; sessionCount?: number }) =>
    callFunction<{ success: true; project: Project }>('create-project', { ...actor, body: payload }),

  updateProject: (
    actor: { adminToken?: string; userToken?: string },
    payload: { projectId: string; title?: string; sessionCount?: number },
  ) => callFunction<{ success: true }>('update-project', { ...actor, body: payload }),

  deleteProject: (actor: { adminToken?: string; userToken?: string }, projectId: string) =>
    callFunction<{ success: true }>('delete-project', { ...actor, body: { projectId } }),

  listProblems: (userToken: string, projectId: string) =>
    callFunction<{ problems: Problem[] }>(`list-problems?projectId=${projectId}`, {
      userToken,
      method: 'GET',
    }),

  startQuizSession: (
    userToken: string,
    payload: { projectId?: string; refCourse?: string; refSession?: string; count?: number; bookmarkedOnly?: boolean },
  ) => callFunction<{ success: true; sessionId: string; problems: Problem[] }>('start-quiz-session', { userToken, body: payload }),

  listQuizScopes: (userToken: string, projectId?: string) =>
    callFunction<{ courses: Array<{ course: string; sessions: string[] }> }>(
      `list-quiz-scopes${projectId ? `?projectId=${projectId}` : ''}`,
      { userToken, method: 'GET' },
    ),

  submitAnswer: (userToken: string, payload: { sessionId: string; problemId: string; userAnswer: string }) =>
    callFunction<{ success: true; isCorrect: boolean; matchScore: number; answer: string }>('submit-answer', { userToken, body: payload }),

  finishQuizSession: (userToken: string, sessionId: string) =>
    callFunction<{
      success: true
      total: number
      correct: number
      score: number
      weakAreas: Array<{ refCourse: string; refSession: string; total: number; correct: number; rate: number }>
    }>('finish-quiz-session', { userToken, body: { sessionId } }),

  quizHistory: (userToken: string) =>
    callFunction<{ sessions: Array<{ id: string; started_at: string; total: number; correct: number }> }>('quiz-history', { userToken, method: 'GET' }),

  listProblemComments: (userToken: string, problemId: string) => callFunction<{ comments: ProblemComment[] }>(`list-problem-comments?problemId=${problemId}`, { userToken, method: 'GET' }),
  createProblemComment: (userToken: string, payload: { problemId: string; content: string }) => callFunction<{ success: true; comment: ProblemComment }>('create-problem-comment', { userToken, body: payload }),
  updateProblemComment: (userToken: string, payload: { commentId: string; content: string }) => callFunction<{ success: true }>('update-problem-comment', { userToken, body: payload }),
  deleteProblemComment: (userToken: string, commentId: string) => callFunction<{ success: true }>('delete-problem-comment', { userToken, body: { commentId } }),
  toggleProblemBookmark: (userToken: string, problemId: string, bookmarked: boolean) => callFunction<{ success: true; bookmarked: boolean }>('toggle-problem-bookmark', { userToken, body: { problemId, bookmarked } }),
  listBookmarkedProblems: (userToken: string) => callFunction<{ problems: Problem[] }>('list-bookmarked-problems', { userToken, method: 'GET' }),

  getActiveQuizSession: (userToken: string) =>
    callFunction<{ session: { sessionId: string; problems: Problem[]; resumeIndex: number } | null }>(
      'get-active-quiz-session',
      { userToken, method: 'GET' },
    ),

  createProblem: (
    userToken: string,
    payload: {
      projectId: string
      type: ProblemType
      question: string
      options?: Record<string, string>
      answer: string
      keywords?: string
      refSession?: string
      refKind?: RefKind
      refDetail?: string
      shareScope?: ProblemShareScope
      sharedUserIds?: string[]
    },
  ) => callFunction<{ success: true; problem: Problem }>('create-problem', { userToken, body: payload }),

  listShareableUsers: (userToken: string, search?: string) =>
    callFunction<{ users: Array<{ id: string; displayName: string }> }>(
      `list-shareable-users${search ? `?q=${encodeURIComponent(search)}` : ''}`,
      { userToken, method: 'GET' },
    ),

  bulkCreateProblems: (
    userToken: string,
    projectId: string,
    problems: Array<{
      type: ProblemType
      question: string
      options?: Record<string, string>
      answer: string
      keywords?: string
      refSession?: string
      refKind?: RefKind
      refDetail?: string
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
      refSession?: string
      refKind?: RefKind
      refDetail?: string
      shareScope?: ProblemShareScope
      sharedUserIds?: string[]
    },
  ) => callFunction<{ success: true }>('update-problem', { userToken, body: payload }),

  deleteProblem: (userToken: string, problemId: string) =>
    callFunction<{ success: true }>('delete-problem', { userToken, body: { problemId } }),
}
