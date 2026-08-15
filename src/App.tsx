import { useEffect } from 'react'
import { HashRouter, Routes, Route, useNavigate } from 'react-router-dom'
import { setUnauthorizedHandler } from './lib/api'
import { adminSession, studentSession } from './lib/session'
import StudentAuthPage from './pages/StudentAuthPage'
import StudentHomePage from './pages/StudentHomePage'
import ProjectsPage from './pages/ProjectsPage'
import ProjectDetailPage from './pages/ProjectDetailPage'
import NewProblemPage from './pages/NewProblemPage'
import ManagePage from './pages/ManagePage'
import AdminLoginPage from './pages/admin/AdminLoginPage'
import AdminDashboardPage from './pages/admin/AdminDashboardPage'

// 토큰이 만료되면 서버가 401을 준다. 만료된 토큰을 그대로 두면 화면마다 오류만 뜨고
// 로그인 화면으로 갈 방법이 없어 갇히므로, 세션을 지우고 곧바로 로그인으로 보낸다.
function SessionGuard() {
  const navigate = useNavigate()
  useEffect(() => {
    setUnauthorizedHandler((kind) => {
      if (kind === 'admin') {
        adminSession.clear()
        navigate('/admin/login', { replace: true, state: { sessionExpired: true } })
      } else {
        studentSession.clear()
        navigate('/login', { replace: true, state: { sessionExpired: true } })
      }
    })
    return () => setUnauthorizedHandler(null)
  }, [navigate])
  return null
}

function App() {
  return (
    <HashRouter>
      <SessionGuard />
      <Routes>
        <Route path="/" element={<StudentAuthPage />} />
        <Route path="/login" element={<StudentAuthPage />} />
        <Route path="/home" element={<StudentHomePage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
        <Route path="/problems/new" element={<NewProblemPage />} />
        <Route path="/problems/:problemId/edit" element={<NewProblemPage />} />
        <Route path="/manage" element={<ManagePage />} />
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/admin" element={<AdminDashboardPage />} />
      </Routes>
    </HashRouter>
  )
}

export default App
