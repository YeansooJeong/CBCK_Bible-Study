import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { studentSession, type StudentUser } from '../lib/session'

function StudentHomePage() {
  const navigate = useNavigate()
  const [user, setUser] = useState<StudentUser | null>(null)

  useEffect(() => {
    const current = studentSession.getUser()
    if (!studentSession.get() || !current) {
      navigate('/login')
      return
    }
    setUser(current)
  }, [navigate])

  if (!user) return null

  return (
    <div className="min-h-svh flex flex-col items-center justify-center gap-6 bg-white px-6 text-center dark:bg-neutral-950">
      <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-50">
        환영합니다, {user.displayName}님
      </h1>
      <p className="text-neutral-500 dark:text-neutral-400">문제 풀이 기능은 곧 추가됩니다.</p>
      <div className="flex gap-3">
        <Link
          to="/projects"
          className="rounded-lg bg-accent px-4 py-2 font-medium text-white transition hover:bg-accent-dark"
        >
          내 프로젝트
        </Link>
        <button
          type="button"
          onClick={() => {
            studentSession.clear()
            navigate('/login')
          }}
          className="rounded-lg border border-neutral-300 px-4 py-2 font-medium dark:border-neutral-700"
        >
          로그아웃
        </button>
      </div>
    </div>
  )
}

export default StudentHomePage
