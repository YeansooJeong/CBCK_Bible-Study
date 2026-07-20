import { Link } from 'react-router-dom'

function HomePage() {
  return (
    <div className="min-h-svh flex flex-col items-center justify-center gap-8 bg-white px-6 text-center dark:bg-neutral-950">
      <div className="flex flex-col gap-3">
        <h1 className="text-4xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
          CBCK 문제은행
        </h1>
        <p className="text-neutral-500 dark:text-neutral-400">
          신학원 학생들의 자율 학습을 돕는 카드형 문제 풀이 서비스
        </p>
      </div>

      <div className="flex gap-3">
        <Link
          to="/login"
          className="rounded-lg bg-accent px-5 py-2.5 font-medium text-white transition hover:bg-accent-dark"
        >
          학생 로그인
        </Link>
        <Link
          to="/admin/login"
          className="rounded-lg border border-neutral-300 px-5 py-2.5 font-medium text-neutral-700 transition hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-900"
        >
          관리자
        </Link>
      </div>
    </div>
  )
}

export default HomePage
