const ADMIN_TOKEN_KEY = 'cbck_admin_token'
const STUDENT_TOKEN_KEY = 'cbck_student_token'
const STUDENT_USER_KEY = 'cbck_student_user'

export const adminSession = {
  get: () => localStorage.getItem(ADMIN_TOKEN_KEY),
  set: (token: string) => localStorage.setItem(ADMIN_TOKEN_KEY, token),
  clear: () => localStorage.removeItem(ADMIN_TOKEN_KEY),
}

export interface StudentUser {
  id: string
  displayName: string
  isAdmin?: boolean
}

export const studentSession = {
  get: () => localStorage.getItem(STUDENT_TOKEN_KEY),
  getUser: (): StudentUser | null => {
    const raw = localStorage.getItem(STUDENT_USER_KEY)
    return raw ? (JSON.parse(raw) as StudentUser) : null
  },
  set: (token: string, user: StudentUser) => {
    localStorage.setItem(STUDENT_TOKEN_KEY, token)
    localStorage.setItem(STUDENT_USER_KEY, JSON.stringify(user))
  },
  clear: () => {
    localStorage.removeItem(STUDENT_TOKEN_KEY)
    localStorage.removeItem(STUDENT_USER_KEY)
  },
}
