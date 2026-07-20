const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

async function callFunction<T>(
  name: string,
  options: { body?: unknown; adminToken?: string; method?: string } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    apikey: ANON_KEY,
    'Content-Type': 'application/json',
  }
  if (options.adminToken) headers['x-admin-token'] = options.adminToken

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
}
