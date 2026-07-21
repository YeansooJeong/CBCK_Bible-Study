import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, ApiError, type Cohort, type Student } from '../lib/api'
import { studentSession } from '../lib/session'
import { parseCsvLine, downloadCsv } from '../lib/csv'
import StudentShell from '../components/StudentShell'
import ProblemModerationPanel from '../components/ProblemModerationPanel'

// 1행: 헤더(name,phone), 2행부터 실제 학생 데이터
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

function ManagePage() {
  const navigate = useNavigate()
  const [token] = useState<string | null>(() => studentSession.get())

  const [cohorts, setCohorts] = useState<Cohort[]>([])
  const [selectedCohortId, setSelectedCohortId] = useState('')
  const [students, setStudents] = useState<Student[]>([])

  const [studentName, setStudentName] = useState('')
  const [studentPhone, setStudentPhone] = useState('')
  const [studentError, setStudentError] = useState<string | null>(null)

  const [bulkCsvFileName, setBulkCsvFileName] = useState<string | null>(null)
  const [bulkCsvMessage, setBulkCsvMessage] = useState<string | null>(null)

  const [editingStudentId, setEditingStudentId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editCohortId, setEditCohortId] = useState('')

  useEffect(() => {
    const user = studentSession.getUser()
    if (!token || !user?.isAdmin) {
      navigate('/home')
      return
    }
    api.adminListCohorts({ userToken: token }).then(({ cohorts }) => {
      setCohorts(cohorts)
      if (cohorts.length > 0) setSelectedCohortId(cohorts[0].id)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (token && selectedCohortId) {
      api.adminListStudents({ userToken: token }, selectedCohortId).then(({ students }) => setStudents(students))
    }
  }, [token, selectedCohortId])

  async function reloadStudents() {
    if (!token || !selectedCohortId) return
    const { students } = await api.adminListStudents({ userToken: token }, selectedCohortId)
    setStudents(students)
  }

  async function handleCreateStudent(e: FormEvent) {
    e.preventDefault()
    if (!token || !selectedCohortId) return
    setStudentError(null)
    try {
      await api.adminCreateStudent({ userToken: token }, { name: studentName, phone: studentPhone, cohortId: selectedCohortId })
      setStudentName('')
      setStudentPhone('')
      await reloadStudents()
    } catch (err) {
      setStudentError(
        err instanceof ApiError && err.message === 'phone_already_registered' ? '이미 등록된 전화번호입니다.' : '학생 등록에 실패했습니다.',
      )
    }
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
      await api.adminUpdateStudent({ userToken: token }, { studentId, name: editName, cohortId: editCohortId })
      setEditingStudentId(null)
      await reloadStudents()
    } catch {
      setStudentError('학생 정보 수정에 실패했습니다.')
    }
  }

  async function handleResetStudent(studentId: string) {
    if (!token) return
    if (!window.confirm('이 학생의 비밀번호를 초기화하고 대기중 상태로 되돌릴까요? 학생은 다시 최초 인증을 거쳐야 합니다.')) return
    try {
      await api.adminUpdateStudent({ userToken: token }, { studentId, resetToPending: true })
      await reloadStudents()
    } catch {
      setStudentError('비밀번호 초기화에 실패했습니다.')
    }
  }

  async function handleDeleteStudent(studentId: string) {
    if (!token) return
    if (!window.confirm('이 학생을 삭제할까요? 학생이 만든 프로젝트/문제도 함께 삭제됩니다.')) return
    try {
      await api.adminDeleteStudent({ userToken: token }, studentId)
      await reloadStudents()
    } catch {
      setStudentError('학생 삭제에 실패했습니다.')
    }
  }

  async function handleBulkUploadStudents(file: File) {
    if (!token || !selectedCohortId) return
    setStudentError(null)
    setBulkCsvMessage(null)
    setBulkCsvFileName(file.name)
    try {
      const students = parseStudentCsv(await file.text())
      const { created, failed } = await api.bulkCreateStudents({ userToken: token }, { cohortId: selectedCohortId, students })
      setBulkCsvMessage(
        failed.length === 0
          ? `${created}명이 등록되었습니다.`
          : `${created}명 등록 완료, ${failed.length}명 실패 (행: ${failed.map((f) => f.row).join(', ')})`,
      )
      await reloadStudents()
    } catch (err) {
      setBulkCsvMessage(
        err instanceof Error && err.message === 'header'
          ? '컬럼명(1행)이 올바르지 않습니다. 샘플 양식을 참고해주세요.'
          : err instanceof Error && err.message === 'no_data'
            ? '2행부터 학생 데이터를 입력해주세요.'
            : '일괄 등록에 실패했습니다.',
      )
    }
  }

  if (!token) return null

  return (
    <StudentShell>
      <main className="management-shell">
        <div className="management-heading">
          <div>
            <h1>학생/문제 관리</h1>
          </div>
        </div>

        <section className="management-card">
          <h2>기수 선택</h2>
          <select className="field" value={selectedCohortId} onChange={(e) => setSelectedCohortId(e.target.value)}>
            {cohorts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {cohorts.length === 0 && <p className="notice">등록된 기수가 없습니다.</p>}
        </section>

        {selectedCohortId && (
          <section className="management-card">
            <h2>학생 등록</h2>
            {studentError && <div className="notice error">{studentError}</div>}
            <form onSubmit={handleCreateStudent} className="inline-actions" style={{ marginBottom: 16 }}>
              <input className="field" placeholder="이름" value={studentName} onChange={(e) => setStudentName(e.target.value)} required />
              <input className="field" placeholder="전화번호" value={studentPhone} onChange={(e) => setStudentPhone(e.target.value)} required />
              <button type="submit" className="primary-button">
                추가
              </button>
            </form>

            <div className="csv-block">
              <p className="notice">1행은 컬럼명(name, phone), 실제 학생은 2행부터 채워주세요.</p>
              {bulkCsvMessage && <p className="notice">{bulkCsvMessage}</p>}
              <button type="button" onClick={() => downloadCsv('cbck_student_sample.csv', STUDENT_SAMPLE_CSV)} className="secondary-button">
                샘플 양식 다운로드
              </button>
              <div className="file-picker">
                <label htmlFor="manageCsvFile" className="primary-button">
                  CSV 파일 선택
                </label>
                <span>{bulkCsvFileName ?? '선택된 파일 없음'}</span>
              </div>
              <input
                id="manageCsvFile"
                type="file"
                accept=".csv,text/csv"
                className="visually-hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleBulkUploadStudents(file)
                  e.target.value = ''
                }}
              />
            </div>

            <table style={{ width: '100%', textAlign: 'left', fontSize: 14, marginTop: 20 }}>
              <thead>
                <tr>
                  <th>이름</th>
                  <th>상태</th>
                  <th>등록일</th>
                  <th>관리</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) =>
                  editingStudentId === student.id ? (
                    <tr key={student.id}>
                      <td>
                        <input className="field" value={editName} onChange={(e) => setEditName(e.target.value)} />
                      </td>
                      <td colSpan={2}>-</td>
                      <td>
                        <div className="inline-actions">
                          <button type="button" onClick={() => handleSaveStudent(student.id)} className="text-link">
                            저장
                          </button>
                          <button type="button" onClick={() => setEditingStudentId(null)}>
                            취소
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr key={student.id}>
                      <td>{student.name}</td>
                      <td>{student.status === 'active' ? '활성화' : '대기중'}</td>
                      <td>{new Date(student.created_at).toLocaleDateString('ko-KR')}</td>
                      <td>
                        <div className="inline-actions">
                          <button type="button" onClick={() => startEditStudent(student)} className="text-link">
                            수정
                          </button>
                          <button type="button" onClick={() => handleResetStudent(student.id)}>
                            비밀번호 초기화
                          </button>
                          <button type="button" onClick={() => handleDeleteStudent(student.id)} className="danger-button">
                            삭제
                          </button>
                        </div>
                      </td>
                    </tr>
                  ),
                )}
                {students.length === 0 && (
                  <tr>
                    <td colSpan={4}>등록된 학생이 없습니다.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        )}

        <ProblemModerationPanel actor={{ userToken: token }} />
      </main>
    </StudentShell>
  )
}

export default ManagePage
