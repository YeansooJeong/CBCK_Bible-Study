import type { ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { studentSession } from '../lib/session'

export function Icon({ name, size = 22 }: { name: 'book' | 'file' | 'users' | 'plus' | 'arrow' | 'upload'; size?: number }) {
  const paths = {
    book: <><path d="M4 5.5A3.5 3.5 0 0 1 7.5 2H20v16H7.5A3.5 3.5 0 0 0 4 21.5z"/><path d="M4 5.5v16A3.5 3.5 0 0 1 7.5 18H20"/></>,
    file: <><path d="M6 2h8l4 4v16H6z"/><path d="M14 2v5h5M9 13h6M9 17h5"/></>,
    users: <><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3.5 20a5.5 5.5 0 0 1 11 0M14 15.3A4.5 4.5 0 0 1 21 19"/></>,
    plus: <path d="M12 5v14M5 12h14"/>,
    arrow: <><path d="M5 12h14"/><path d="m14 7 5 5-5 5"/></>,
    upload: <><path d="M12 16V3m0 0L7 8m5-5 5 5"/><path d="M5 14v6h14v-6"/></>,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

export default function StudentShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const user = studentSession.getUser()
  function logout() { studentSession.clear(); navigate('/login') }

  return <div className="student-app">
    <header className="student-topbar">
      <NavLink className="student-brand" to="/home"><span className="brandmark"><span>▯</span></span><strong>신학원 문제은행</strong></NavLink>
      <nav aria-label="주 메뉴">
        <NavLink to="/home">홈</NavLink>
        <NavLink to="/home" state={{ openStudy: true }}>학습하기</NavLink>
        <NavLink to="/projects">내 문제함</NavLink>
        <NavLink to="/projects?scope=shared">공유 문제</NavLink>
      </nav>
      <div className="student-profile">
        <span className="avatar">{user?.displayName?.slice(0, 1) || '학'}</span>
        <span className="profile-name">{user?.displayName || '학습자'}</span>
        <button type="button" onClick={logout}>로그아웃</button>
      </div>
    </header>
    {children}
  </div>
}
