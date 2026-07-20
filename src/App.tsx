import { HashRouter, Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import StudentAuthPage from './pages/StudentAuthPage'
import StudentHomePage from './pages/StudentHomePage'
import ProjectsPage from './pages/ProjectsPage'
import ProjectDetailPage from './pages/ProjectDetailPage'
import NewProblemPage from './pages/NewProblemPage'
import AdminLoginPage from './pages/admin/AdminLoginPage'
import AdminDashboardPage from './pages/admin/AdminDashboardPage'

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<StudentAuthPage />} />
        <Route path="/home" element={<StudentHomePage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
        <Route path="/problems/new" element={<NewProblemPage />} />
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/admin" element={<AdminDashboardPage />} />
      </Routes>
    </HashRouter>
  )
}

export default App
