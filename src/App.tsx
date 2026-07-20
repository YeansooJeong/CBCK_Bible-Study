function App() {
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

      <div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <p className="text-sm text-neutral-400 dark:text-neutral-500">문제 1 / 10</p>
        <p className="mt-4 text-lg text-neutral-900 dark:text-neutral-50">
          천지창조는 며칠 동안 이루어졌는가?
        </p>
        <button
          type="button"
          className="mt-6 w-full rounded-lg bg-accent px-4 py-2 font-medium text-white transition hover:bg-accent-dark"
        >
          학습 시작하기
        </button>
      </div>
    </div>
  )
}

export default App
