import { HashRouter, Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import StudentAuthPage from './pages/StudentAuthPage'
import StudentHomePage from './pages/StudentHomePage'
import AdminLoginPage from './pages/admin/AdminLoginPage'
import AdminDashboardPage from './pages/admin/AdminDashboardPage'

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<StudentAuthPage />} />
        <Route path="/home" element={<StudentHomePage />} />
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/admin" element={<AdminDashboardPage />} />
      </Routes>
    </HashRouter>
  )
}

export default App
