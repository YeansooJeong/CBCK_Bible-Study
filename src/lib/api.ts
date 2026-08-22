const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

// 인앱 브라우저나 약한 신호에서 응답이 오지 않고 매달리는 것을 막는다.
const REQUEST_TIMEOUT_MS = 15000
// 응답 자체를 못 받은 경우에만 다시 시도한다. 서버가 응답했다면(ApiError) 재시도는 의미가 없다.
const RETRY_DELAYS_MS = [600, 1500]

/** 서버 응답을 아예 받지 못한 경우(연결 끊김·타임아웃). ApiError와 구분해 안내 문구를 달리한다. */
export class NetworkError extends Error {
  constructor() {
    super('network_error')
  }
}

export class ApiError extends Error {
  status: number
  // 서버가 오류와 함께 내려준 부가 정보(예: 몇 번째 문제가 왜 거절됐는지)
  details?: Record<string, unknown>
  constructor(code: string, status: number, details?: Record<string, unknown>) {
    super(code)
    this.status = status
    this.details = details
  }
}

// 세션 만료(401)를 앱 전체에서 한 곳으로 모아 처리하기 위한 통로.
// 만료된 토큰이 localStorage에 남아 있으면 화면마다 오류만 뜨고 로그인으로 갈 방법이 없어진다.
type UnauthorizedKind = 'user' | 'admin'
let unauthorizedHandler: ((kind: UnauthorizedKind) => void) | null = null
export function setUnauthorizedHandler(handler: ((kind: UnauthorizedKind) => void) | null) {
  unauthorizedHandler = handler
}

/** 화면에 그대로 띄울 수 있는 오류 문구. 원인별로 사용자가 할 수 있는 행동이 다르다. */
export function describeApiError(err: unknown, fallback: string): string {
  if (err instanceof NetworkError) return '네트워크 연결이 불안정합니다. 연결을 확인한 뒤 다시 시도해 주세요.'
  if (err instanceof ApiError && err.status === 401) return '로그인이 만료되었습니다. 다시 로그인해 주세요.'
  if (err instanceof ApiError && err.status >= 500) return '서버에 일시적인 문제가 있습니다. 잠시 후 다시 시도해 주세요.'
  return fallback
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

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

  const method = options.method ?? (options.body ? 'POST' : 'GET')
  // POST는 서버에 이미 도달했을 수 있어 다시 보내면 중복 생성될 위험이 있다. 조회(GET)만 재시도한다.
  const retryable = method === 'GET'

  const attempt = async (): Promise<T> => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    let res: Response
    try {
      res = await fetch(`${FUNCTIONS_URL}/${name}`, {
        method,
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      })
    } catch {
      // fetch가 던지는 건 연결 실패이거나 타임아웃(abort)이다.
      throw new NetworkError()
    } finally {
      clearTimeout(timer)
    }

    const data = await res.json().catch(() => ({}))
    if (res.status === 401 && (options.userToken || options.adminToken)) {
      unauthorizedHandler?.(options.adminToken ? 'admin' : 'user')
    }
    if (!res.ok) throw new ApiError(data.error ?? 'unknown_error', res.status, data)
    return data as T
  }

  for (let i = 0; ; i++) {
    try {
      return await attempt()
    } catch (err) {
      if (!(err instanceof NetworkError) || !retryable || i >= RETRY_DELAYS_MS.length) throw err
      await sleep(RETRY_DELAYS_MS[i])
    }
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
  // 작성자의 개인정보가 파기된 경우 true. 이름은 관리 목적으로 보존한 값이다.
  ownerPurged?: boolean
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
  problem_count?: number
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
    password: string
  }) => callFunction<{ success: true }>('activate-account', { body: payload }),

  login: (phone: string, password: string) =>
    callFunction<{ success: true; token: string; user: { id: string; displayName: string; isAdmin: boolean } }>('login', {
      body: { phone, password },
    }),

  adminLogin: (loginId: string, password: string) =>
    callFunction<{ success: true; token: string }>('admin-login', { body: { loginId, password } }),

  adminChangePassword: (adminToken: string, payload: { currentPassword: string; newPassword: string }) =>
    callFunction<{ success: true }>('admin-change-password', { adminToken, body: payload }),

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

  adminListProblemAuditLog: (adminToken: string) =>
    callFunction<{
      entries: Array<{
        id: number
        action: 'create' | 'update' | 'delete'
        createdAt: string
        actorName: string
        actorRole: 'admin' | 'general_admin' | 'student'
        problemQuestion: string | null
        refCourse: string | null
        refSession: string | null
      }>
    }>('admin-list-problem-audit-log', { adminToken, method: 'GET' }),

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
    payload: {
      projectId?: string
      refCourse?: string
      refSession?: string
      count?: number
      bookmarkedOnly?: boolean
      // 출제할 문제 유형. 비우면 전체 유형에서 출제한다.
      types?: ProblemType[]
    },
  ) => callFunction<{
    success: true
    sessionId: string
    problems: Problem[]
    // 안 풀어본 문제 / 다시 나온 문제 구성. 구버전 서버에서는 내려오지 않는다.
    newCount?: number
    reviewCount?: number
    remainingNew?: number
  }>('start-quiz-session', { userToken, body: payload }),

  listQuizScopes: (userToken: string, projectId?: string) =>
    callFunction<{ courses: Array<{ course: string; sessions: string[] }> }>(
      `list-quiz-scopes${projectId ? `?projectId=${projectId}` : ''}`,
      { userToken, method: 'GET' },
    ),

  submitAnswer: (userToken: string, payload: { sessionId: string; problemId: string; userAnswer: string }) =>
    callFunction<{
      success: true
      isCorrect: boolean
      // verdict/score는 신버전 submit-answer에서만 내려온다(배포 시차 대비 optional).
      verdict?: 'correct' | 'partial' | 'wrong'
      score?: number
      matchScore: number
      answer: string
    }>('submit-answer', { userToken, body: payload }),

  finishQuizSession: (userToken: string, sessionId: string) =>
    callFunction<{
      success: true
      total: number
      correct: number
      partial?: number
      earned?: number
      score: number
      weakAreas: Array<{ refCourse: string; refSession: string; total: number; correct: number; rate: number }>
    }>('finish-quiz-session', { userToken, body: { sessionId } }),

  quizHistory: (userToken: string) =>
    callFunction<{ sessions: Array<{ id: string; started_at: string; total: number; correct: number }> }>('quiz-history', { userToken, method: 'GET' }),

  withdrawAccount: (userToken: string, payload: { reason: string; reasonDetail?: string }) =>
    callFunction<{ success: true }>('withdraw-account', { userToken, body: payload }),

  deleteQuizHistory: (userToken: string) =>
    callFunction<{ success: true; deleted: number }>('delete-quiz-history', { userToken, body: {} }),

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

  listFlashcardProblems: (
    userToken: string,
    payload: {
      projectId?: string
      refCourse?: string
      refSession?: string
      bookmarkedOnly?: boolean
      count?: number
      // 보고 싶은 문제 유형. 비우면 전체 유형에서 보여준다.
      types?: ProblemType[]
    },
  ) => callFunction<{ problems: Problem[] }>('list-flashcard-problems', { userToken, body: payload }),

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
