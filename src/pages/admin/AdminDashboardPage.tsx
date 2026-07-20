import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, ApiError, type Cohort, type Student } from '../../lib/api'
import { adminSession } from '../../lib/session'

const inputClass =
  'w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900 outline-none focus:border-accent dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-50'

function AdminDashboardPage() {
  const navigate = useNavigate()
  const [token, setToken] = useState<string | null>(null)

  const [cohorts, setCohorts] = useState<Cohort[]>([])
  const [selectedCohortId, setSelectedCohortId] = useState<string>('')
  const [students, setStudents] = useState<Student[]>([])

  const [cohortName, setCohortName] = useState('')
  const [staffName, setStaffName] = useState('')
  const [leaderName, setLeaderName] = useState('')
  const [kjvYear, setKjvYear] = useState('')
  const [cohortError, setCohortError] = useState<string | null>(null)

  const [studentName, setStudentName] = useState('')
  const [studentPhone, setStudentPhone] = useState('')
  const [studentError, setStudentError] = useState<string | null>(null)

  const [editingStudentId, setEditingStudentId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editCohortId, setEditCohortId] = useState('')

  useEffect(() => {
    const t = adminSession.get()
    if (!t) {
      navigate('/admin/login')
      return
    }
    setToken(t)
  }, [navigate])

  async function loadCohorts(adminToken: string) {
    const { cohorts } = await api.adminListCohorts(adminToken)
    setCohorts(cohorts)
    if (cohorts.length > 0 && !selectedCohortId) setSelectedCohortId(cohorts[0].id)
  }

  useEffect(() => {
    if (token) loadCohorts(token)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  useEffect(() => {
    if (token && selectedCohortId) {
      api.adminListStudents(token, selectedCohortId).then(({ students }) => setStudents(students))
    }
  }, [token, selectedCohortId])

  async function handleCreateCohort(e: FormEvent) {
    e.preventDefault()
    if (!token) return
    setCohortError(null)
    try {
      await api.adminCreateCohort(token, { name: cohortName, staffName, leaderName, kjvYear })
      setCohortName('')
      setStaffName('')
      setLeaderName('')
      setKjvYear('')
      await loadCohorts(token)
    } catch (err) {
      console.error('adminCreateCohort failed', err)
      setCohortError('기수 생성에 실패했습니다.')
    }
  }

  async function handleCreateStudent(e: FormEvent) {
    e.preventDefault()
    if (!token || !selectedCohortId) return
    setStudentError(null)
    try {
      await api.adminCreateStudent(token, { name: studentName, phone: studentPhone, cohortId: selectedCohortId })
      setStudentName('')
      setStudentPhone('')
      const { students } = await api.adminListStudents(token, selectedCohortId)
      setStudents(students)
    } catch (err) {
      setStudentError(
        err instanceof ApiError && err.message === 'phone_already_registered'
          ? '이미 등록된 전화번호입니다.'
          : '학생 등록에 실패했습니다.',
      )
    }
  }

  function handleLogout() {
    adminSession.clear()
    navigate('/admin/login')
  }

  function startEditStudent(student: Student) {
    setEditingStudentId(student.id)
    setEditName(student.name)
    setEditCohortId(student.cohort_id)
    setStudentError(null)
  }

  async function handleSaveStudent(studentId: string) {
    if (!token) return
    try {
      await api.adminUpdateStudent(token, { studentId, name: editName, cohortId: editCohortId })
      setEditingStudentId(null)
      const { students } = await api.adminListStudents(token, selectedCohortId)
      setStudents(students)
    } catch {
      setStudentError('학생 정보 수정에 실패했습니다.')
    }
  }

  async function handleResetStudent(studentId: string) {
    if (!token) return
    if (!window.confirm('이 학생의 비밀번호를 초기화하고 대기중 상태로 되돌릴까요? 학생은 다시 최초 인증을 거쳐야 합니다.')) return
    try {
      await api.adminUpdateStudent(token, { studentId, resetToPending: true })
      const { students } = await api.adminListStudents(token, selectedCohortId)
      setStudents(students)
    } catch {
      setStudentError('비밀번호 초기화에 실패했습니다.')
    }
  }

  async function handleDeleteStudent(studentId: string) {
    if (!token) return
    if (!window.confirm('이 학생을 삭제할까요? 학생이 만든 프로젝트/문제도 함께 삭제됩니다.')) return
    try {
      await api.adminDeleteStudent(token, studentId)
      const { students } = await api.adminListStudents(token, selectedCohortId)
      setStudents(students)
    } catch {
      setStudentError('학생 삭제에 실패했습니다.')
    }
  }

  if (!token) return null

  return (
    <div className="min-h-svh bg-white px-6 py-10 dark:bg-neutral-950">
      <div className="mx-auto flex max-w-3xl flex-col gap-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-50">관리자 대시보드</h1>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700"
          >
            로그아웃
          </button>
        </div>

        <section className="rounded-2xl border border-neutral-200 p-6 dark:border-neutral-800">
          <h2 className="mb-4 text-lg font-medium text-neutral-900 dark:text-neutral-50">기수 등록</h2>
          {cohortError && <p className="mb-3 text-sm text-red-500">{cohortError}</p>}
          <form onSubmit={handleCreateCohort} className="mb-6 grid grid-cols-2 gap-3">
            <input className={inputClass} placeholder="기수명" value={cohortName} onChange={(e) => setCohortName(e.target.value)} required />
            <input className={inputClass} placeholder="간사 이름" value={staffName} onChange={(e) => setStaffName(e.target.value)} required />
            <input className={inputClass} placeholder="반장 이름" value={leaderName} onChange={(e) => setLeaderName(e.target.value)} required />
            <input className={inputClass} placeholder="킹제임스 성경(영어) 출판연도 (예: 1611)" value={kjvYear} onChange={(e) => setKjvYear(e.target.value)} required />
            <button
              type="submit"
              className="col-span-2 rounded-lg bg-accent px-4 py-2 font-medium text-white transition hover:bg-accent-dark"
            >
              기수 추가
            </button>
          </form>

          <ul className="flex flex-col gap-2">
            {cohorts.map((cohort) => (
              <li key={cohort.id}>
                <button
                  type="button"
                  onClick={() => setSelectedCohortId(cohort.id)}
                  className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                    selectedCohortId === cohort.id
                      ? 'border-accent bg-accent/10 text-accent-dark'
                      : 'border-neutral-200 dark:border-neutral-800'
                  }`}
                >
                  {cohort.name} · 간사 {cohort.staff_name} · 반장 {cohort.leader_name} · {cohort.kjv_year}년판
                </button>
              </li>
            ))}
            {cohorts.length === 0 && <p className="text-sm text-neutral-400">등록된 기수가 없습니다.</p>}
          </ul>
        </section>

        <section className="rounded-2xl border border-neutral-200 p-6 dark:border-neutral-800">
          <h2 className="mb-4 text-lg font-medium text-neutral-900 dark:text-neutral-50">학생 등록</h2>
          {!selectedCohortId ? (
            <p className="text-sm text-neutral-400">먼저 기수를 등록하고 선택해주세요.</p>
          ) : (
            <>
              {studentError && <p className="mb-3 text-sm text-red-500">{studentError}</p>}
              <form onSubmit={handleCreateStudent} className="mb-6 flex gap-3">
                <input className={inputClass} placeholder="이름" value={studentName} onChange={(e) => setStudentName(e.target.value)} required />
                <input className={inputClass} placeholder="전화번호" value={studentPhone} onChange={(e) => setStudentPhone(e.target.value)} required />
                <button
                  type="submit"
                  className="whitespace-nowrap rounded-lg bg-accent px-4 py-2 font-medium text-white transition hover:bg-accent-dark"
                >
                  추가
                </button>
              </form>

              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-neutral-400">
                    <th className="pb-2">이름</th>
                    <th className="pb-2">기수</th>
                    <th className="pb-2">상태</th>
                    <th className="pb-2">등록일</th>
                    <th className="pb-2">관리</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student) =>
                    editingStudentId === student.id ? (
                      <tr key={student.id} className="border-t border-neutral-100 dark:border-neutral-900">
                        <td className="py-2">
                          <input
                            className={inputClass}
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                          />
                        </td>
                        <td className="py-2">
                          <select
                            className={inputClass}
                            value={editCohortId}
                            onChange={(e) => setEditCohortId(e.target.value)}
                          >
                            {cohorts.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2 text-neutral-400" colSpan={2}>
                          -
                        </td>
                        <td className="py-2">
                          <div className="flex gap-2">
                            <button type="button" onClick={() => handleSaveStudent(student.id)} className="text-accent hover:underline">
                              저장
                            </button>
                            <button type="button" onClick={() => setEditingStudentId(null)} className="text-neutral-400 hover:underline">
                              취소
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      <tr key={student.id} className="border-t border-neutral-100 dark:border-neutral-900">
                        <td className="py-2 text-neutral-900 dark:text-neutral-50">{student.name}</td>
                        <td className="py-2 text-neutral-500">
                          {cohorts.find((c) => c.id === student.cohort_id)?.name ?? '-'}
                        </td>
                        <td className="py-2">
                          <span
                            className={
                              student.status === 'active'
                                ? 'rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                : 'rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'
                            }
                          >
                            {student.status === 'active' ? '활성화' : '대기중'}
                          </span>
                        </td>
                        <td className="py-2 text-neutral-500">{new Date(student.created_at).toLocaleDateString('ko-KR')}</td>
                        <td className="py-2">
                          <div className="flex gap-2 whitespace-nowrap">
                            <button type="button" onClick={() => startEditStudent(student)} className="text-accent hover:underline">
                              수정
                            </button>
                            <button type="button" onClick={() => handleResetStudent(student.id)} className="text-neutral-500 hover:underline">
                              비밀번호 초기화
                            </button>
                            <button type="button" onClick={() => handleDeleteStudent(student.id)} className="text-red-500 hover:underline">
                              삭제
                            </button>
                          </div>
                        </td>
                      </tr>
                    ),
                  )}
                  {students.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-4 text-center text-neutral-400">
                        등록된 학생이 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </>
          )}
        </section>
      </div>
    </div>
  )
}

export default AdminDashboardPage
