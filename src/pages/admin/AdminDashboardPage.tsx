import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, ApiError, type Cohort, type Student } from '../../lib/api'
import { adminSession } from '../../lib/session'
import { parseCsvLine, downloadCsv } from '../../lib/csv'
import ProblemModerationPanel from '../../components/ProblemModerationPanel'
import SubjectManagementPanel from '../../components/SubjectManagementPanel'

const inputClass =
  'w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900 outline-none focus:border-accent dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-50'

// 1행: 헤더(name,phone), 2행부터 실제 신학원생 데이터
const STUDENT_SAMPLE_CSV = 'name,phone\n"홍길동","01012345678"\n"김철수","01098765432"\n'

function parseStudentCsv(text: string) {
  const rows = text.trim().split(/\r?\n/).map(parseCsvLine)
  if (rows.length < 2) throw new Error('no_data')
  const headers = rows[0]
  const required = ['name', 'phone']
  if (required.some((h) => !headers.includes(h))) throw new Error('header')
  const dataRows = rows.slice(1).filter((r) => r.some(Boolean))
  if (dataRows.length === 0) throw new Error('no_data')
  return dataRows.map((r) => {
    const value = (name: string) => r[headers.indexOf(name)] ?? ''
    return { name: value('name'), phone: value('phone') }
  })
}

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

  const [editingCohortId, setEditingCohortId] = useState<string | null>(null)
  const [editCohortName, setEditCohortName] = useState('')
  const [editCohortStaffName, setEditCohortStaffName] = useState('')
  const [editCohortLeaderName, setEditCohortLeaderName] = useState('')
  const [editCohortKjvYear, setEditCohortKjvYear] = useState('')

  const [studentName, setStudentName] = useState('')
  const [studentPhone, setStudentPhone] = useState('')
  const [studentError, setStudentError] = useState<string | null>(null)

  const [bulkCsvFileName, setBulkCsvFileName] = useState<string | null>(null)
  const [bulkCsvMessage, setBulkCsvMessage] = useState<string | null>(null)

  const [editingStudentId, setEditingStudentId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editCohortId, setEditCohortId] = useState('')

  const [revealedPhones, setRevealedPhones] = useState<Record<string, string>>({})
  const [auditLog, setAuditLog] = useState<Array<{ id: number; action: string; createdAt: string; actorName: string; targetName: string }>>([])

  useEffect(() => {
    const t = adminSession.get()
    if (!t) {
      navigate('/admin/login')
      return
    }
    setToken(t)
    api.adminListAuditLog(t).then(({ entries }) => setAuditLog(entries)).catch(() => setAuditLog([]))
  }, [navigate])

  async function handleViewPhone(studentId: string) {
    if (!token) return
    try {
      const { phone } = await api.adminViewStudentPhone(token, studentId)
      setRevealedPhones((current) => ({ ...current, [studentId]: phone }))
      api.adminListAuditLog(token).then(({ entries }) => setAuditLog(entries)).catch(() => undefined)
    } catch {
      setStudentError('전화번호 조회에 실패했습니다.')
    }
  }

  async function loadCohorts(adminToken: string) {
    const { cohorts } = await api.adminListCohorts({ adminToken })
    setCohorts(cohorts)
    if (cohorts.length > 0 && !selectedCohortId) setSelectedCohortId(cohorts[0].id)
  }

  useEffect(() => {
    if (token) loadCohorts(token)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  useEffect(() => {
    if (token && selectedCohortId) {
      api.adminListStudents({ adminToken: token }, selectedCohortId).then(({ students }) => setStudents(students))
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

  function startEditCohort(cohort: Cohort) {
    setEditingCohortId(cohort.id)
    setEditCohortName(cohort.name)
    setEditCohortStaffName(cohort.staff_name)
    setEditCohortLeaderName(cohort.leader_name)
    setEditCohortKjvYear(cohort.kjv_year)
    setCohortError(null)
  }

  async function handleSaveCohort(cohortId: string) {
    if (!token) return
    try {
      await api.adminUpdateCohort(token, {
        cohortId,
        name: editCohortName,
        staffName: editCohortStaffName,
        leaderName: editCohortLeaderName,
        kjvYear: editCohortKjvYear,
      })
      setEditingCohortId(null)
      await loadCohorts(token)
    } catch {
      setCohortError('기수 정보 수정에 실패했습니다.')
    }
  }

  async function handleDeleteCohort(cohortId: string) {
    if (!token) return
    if (!window.confirm('이 기수를 삭제할까요?')) return
    try {
      await api.adminDeleteCohort(token, cohortId)
      if (selectedCohortId === cohortId) setSelectedCohortId('')
      await loadCohorts(token)
    } catch (err) {
      setCohortError(
        err instanceof ApiError && err.message === 'has_students'
          ? '이 기수에 등록된 신학원생이 있어 삭제할 수 없습니다. 먼저 신학원생을 다른 기수로 옮기거나 삭제해주세요.'
          : '기수 삭제에 실패했습니다.',
      )
    }
  }

  async function handleBulkUploadStudents(file: File) {
    if (!token || !selectedCohortId) return
    setStudentError(null)
    setBulkCsvMessage(null)
    setBulkCsvFileName(file.name)
    try {
      const students = parseStudentCsv(await file.text())
      const { created, failed } = await api.bulkCreateStudents({ adminToken: token }, { cohortId: selectedCohortId, students })
      setBulkCsvMessage(
        failed.length === 0
          ? `${created}명이 등록되었습니다.`
          : `${created}명 등록 완료, ${failed.length}명 실패 (행: ${failed.map((f) => f.row).join(', ')})`,
      )
      const { students: refreshed } = await api.adminListStudents({ adminToken: token }, selectedCohortId)
      setStudents(refreshed)
    } catch (err) {
      setBulkCsvMessage(
        err instanceof Error && err.message === 'header'
          ? '컬럼명(1행)이 올바르지 않습니다. 샘플 양식을 참고해주세요.'
          : err instanceof Error && err.message === 'no_data'
            ? '2행부터 신학원생 데이터를 입력해주세요.'
            : '일괄 등록에 실패했습니다.',
      )
    }
  }

  async function handleCreateStudent(e: FormEvent) {
    e.preventDefault()
    if (!token || !selectedCohortId) return
    setStudentError(null)
    try {
      await api.adminCreateStudent({ adminToken: token }, { name: studentName, phone: studentPhone, cohortId: selectedCohortId })
      setStudentName('')
      setStudentPhone('')
      const { students } = await api.adminListStudents({ adminToken: token }, selectedCohortId)
      setStudents(students)
    } catch (err) {
      setStudentError(
        err instanceof ApiError && err.message === 'phone_already_registered'
          ? '이미 등록된 전화번호입니다.'
          : '신학원생 등록에 실패했습니다.',
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
      await api.adminUpdateStudent({ adminToken: token }, { studentId, name: editName, cohortId: editCohortId })
      setEditingStudentId(null)
      const { students } = await api.adminListStudents({ adminToken: token }, selectedCohortId)
      setStudents(students)
    } catch {
      setStudentError('신학원생 정보 수정에 실패했습니다.')
    }
  }

  async function handleResetStudent(studentId: string) {
    if (!token) return
    if (!window.confirm('이 신학원생의 비밀번호를 초기화하고 대기중 상태로 되돌릴까요? 신학원생은 다시 최초 인증을 거쳐야 합니다.')) return
    try {
      await api.adminUpdateStudent({ adminToken: token }, { studentId, resetToPending: true })
      const { students } = await api.adminListStudents({ adminToken: token }, selectedCohortId)
      setStudents(students)
    } catch {
      setStudentError('비밀번호 초기화에 실패했습니다.')
    }
  }

  async function handleToggleGeneralAdmin(student: Student) {
    if (!token) return
    const next = !student.is_admin
    if (!window.confirm(next ? '이 신학원생에게 일반 Admin 권한을 부여할까요?' : '이 신학원생의 일반 Admin 권한을 해제할까요?')) return
    try {
      await api.adminSetStudentRole(token, student.id, next)
      const { students } = await api.adminListStudents({ adminToken: token }, selectedCohortId)
      setStudents(students)
    } catch {
      setStudentError('권한 변경에 실패했습니다.')
    }
  }

  async function handleDeleteStudent(studentId: string) {
    if (!token) return
    if (!window.confirm('이 신학원생을 삭제할까요? 신학원생이 만든 프로젝트/문제도 함께 삭제됩니다.')) return
    try {
      await api.adminDeleteStudent({ adminToken: token }, studentId)
      const { students } = await api.adminListStudents({ adminToken: token }, selectedCohortId)
      setStudents(students)
    } catch {
      setStudentError('신학원생 삭제에 실패했습니다.')
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
            {cohorts.map((cohort) =>
              editingCohortId === cohort.id ? (
                <li key={cohort.id} className="rounded-lg border border-accent p-3">
                  <div className="grid grid-cols-2 gap-2">
                    <input className={inputClass} placeholder="기수명" value={editCohortName} onChange={(e) => setEditCohortName(e.target.value)} />
                    <input className={inputClass} placeholder="간사 이름" value={editCohortStaffName} onChange={(e) => setEditCohortStaffName(e.target.value)} />
                    <input className={inputClass} placeholder="반장 이름" value={editCohortLeaderName} onChange={(e) => setEditCohortLeaderName(e.target.value)} />
                    <input className={inputClass} placeholder="출판연도" value={editCohortKjvYear} onChange={(e) => setEditCohortKjvYear(e.target.value)} />
                  </div>
                  <div className="mt-2 flex gap-3 text-sm">
                    <button type="button" onClick={() => handleSaveCohort(cohort.id)} className="text-accent hover:underline">
                      저장
                    </button>
                    <button type="button" onClick={() => setEditingCohortId(null)} className="text-neutral-400 hover:underline">
                      취소
                    </button>
                  </div>
                </li>
              ) : (
                <li key={cohort.id} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedCohortId(cohort.id)}
                    className={`flex-1 rounded-lg border px-3 py-2 text-left text-sm transition ${
                      selectedCohortId === cohort.id
                        ? 'border-accent bg-accent/10 text-accent-dark'
                        : 'border-neutral-200 dark:border-neutral-800'
                    }`}
                  >
                    {cohort.name} · 간사 {cohort.staff_name} · 반장 {cohort.leader_name} · {cohort.kjv_year}년판
                  </button>
                  <button type="button" onClick={() => startEditCohort(cohort)} className="whitespace-nowrap text-sm text-accent hover:underline">
                    수정
                  </button>
                  <button type="button" onClick={() => handleDeleteCohort(cohort.id)} className="whitespace-nowrap text-sm text-red-500 hover:underline">
                    삭제
                  </button>
                </li>
              ),
            )}
            {cohorts.length === 0 && <p className="text-sm text-neutral-400">등록된 기수가 없습니다.</p>}
          </ul>
        </section>

        <section className="rounded-2xl border border-neutral-200 p-6 dark:border-neutral-800">
          <h2 className="mb-4 text-lg font-medium text-neutral-900 dark:text-neutral-50">신학원생 등록</h2>
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

              <div className="mb-6 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
                <h3 className="mb-2 text-sm font-medium text-neutral-900 dark:text-neutral-50">CSV로 한 번에 등록</h3>
                <p className="mb-3 text-xs text-neutral-500">1행은 컬럼명(name, phone), 실제 신학원생은 2행부터 채워주세요.</p>
                {bulkCsvMessage && <p className="mb-3 text-sm text-neutral-600 dark:text-neutral-300">{bulkCsvMessage}</p>}
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => downloadCsv('cbck_student_sample.csv', STUDENT_SAMPLE_CSV)}
                    className="whitespace-nowrap rounded-lg border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700"
                  >
                    샘플 양식 다운로드
                  </button>
                  <label
                    htmlFor="studentCsvFile"
                    className="cursor-pointer whitespace-nowrap rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white transition hover:bg-accent-dark"
                  >
                    CSV 파일 선택
                  </label>
                  <span className="text-xs text-neutral-500">{bulkCsvFileName ?? '선택된 파일 없음'}</span>
                  <input
                    id="studentCsvFile"
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleBulkUploadStudents(file)
                      e.target.value = ''
                    }}
                  />
                </div>
              </div>

              <div className="-mx-2 overflow-x-auto px-2">
              <table className="min-w-[760px] w-full text-left text-sm">
                <thead>
                  <tr className="text-neutral-400">
                    <th className="pb-2">이름</th>
                    <th className="pb-2">기수</th>
                    <th className="pb-2">전화번호</th>
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
                        <td className="py-2 text-neutral-400" colSpan={3}>
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
                        <td className="py-2 text-neutral-500">
                          {revealedPhones[student.id] ?? (
                            <button type="button" onClick={() => handleViewPhone(student.id)} className="text-accent hover:underline">
                              보기
                            </button>
                          )}
                        </td>
                        <td className="py-2">
                          <div className="flex flex-wrap gap-1">
                            <span
                              className={
                                student.status === 'active'
                                  ? 'rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                  : 'rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'
                              }
                            >
                              {student.status === 'active' ? '활성화' : '대기중'}
                            </span>
                            {student.is_admin && (
                              <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent-dark">일반 Admin</span>
                            )}
                          </div>
                        </td>
                        <td className="py-2 text-neutral-500">{new Date(student.created_at).toLocaleDateString('ko-KR')}</td>
                        <td className="py-2">
                          <div className="flex max-w-[260px] flex-wrap gap-x-3 gap-y-1 text-xs sm:max-w-none sm:flex-nowrap sm:text-sm">
                            <button type="button" onClick={() => startEditStudent(student)} className="text-accent hover:underline">
                              수정
                            </button>
                            <button type="button" onClick={() => handleResetStudent(student.id)} className="text-neutral-500 hover:underline">
                              비밀번호 초기화
                            </button>
                            <button type="button" onClick={() => handleToggleGeneralAdmin(student)} className="text-accent hover:underline">
                              {student.is_admin ? 'Admin 해제' : 'Admin 지정'}
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
                      <td colSpan={6} className="py-4 text-center text-neutral-400">
                        등록된 신학원생이 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              </div>
            </>
          )}
        </section>

        <SubjectManagementPanel actor={{ adminToken: token }} />

        <ProblemModerationPanel actor={{ adminToken: token }} />

        <section className="rounded-2xl border border-neutral-200 p-6 dark:border-neutral-800">
          <h2 className="mb-4 text-lg font-medium text-neutral-900 dark:text-neutral-50">개인정보 접근 이력</h2>
          <ul className="flex flex-col gap-2 text-sm">
            {auditLog.map((entry) => (
              <li key={entry.id} className="flex justify-between border-b border-neutral-100 pb-2 dark:border-neutral-900">
                <span>
                  <strong>{entry.actorName}</strong>이(가) <strong>{entry.targetName}</strong>의 전화번호를 조회함
                </span>
                <span className="text-neutral-400">{new Date(entry.createdAt).toLocaleString('ko-KR')}</span>
              </li>
            ))}
            {auditLog.length === 0 && <p className="text-neutral-400">접근 이력이 없습니다.</p>}
          </ul>
        </section>
      </div>
    </div>
  )
}

export default AdminDashboardPage
