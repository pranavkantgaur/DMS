import React from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Layout() {
  const { user, logout, isAdmin, isSupervisor } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
  }

  const roleBadgeClass = () => {
    if (isAdmin) return 'badge badge-admin'
    if (isSupervisor) return 'badge badge-supervisor'
    return 'badge badge-operator'
  }

  return (
    <div className="layout-container">
      <nav className="navbar">
        <div className="navbar-brand">⚡ DMS - Power Plant</div>
        <div className="nav-user-info">
          <span className="nav-username">{user?.full_name || user?.username}</span>
          <span className={roleBadgeClass()}>{user?.role}</span>
          <button className="nav-logout-btn" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </nav>

      <div className="layout-body">
        <aside className="sidebar">
          <nav className="sidebar-nav">
            <NavLink
              to="/dashboard"
              className={({ isActive }) => 'sidebar-link' + (isActive ? ' active' : '')}
            >
              📊 Dashboard
            </NavLink>
            <NavLink
              to="/drawings"
              end
              className={({ isActive }) => 'sidebar-link' + (isActive ? ' active' : '')}
            >
              📄 Drawings
            </NavLink>
            {(isAdmin || isSupervisor) && (
              <>
                <NavLink
                  to="/drawings/upload"
                  className={({ isActive }) => 'sidebar-link' + (isActive ? ' active' : '')}
                >
                  ⬆ Upload Drawing
                </NavLink>
                <NavLink
                  to="/components"
                  className={({ isActive }) => 'sidebar-link' + (isActive ? ' active' : '')}
                >
                  🔧 Components
                </NavLink>
              </>
            )}
            {isAdmin && (
              <>
                <div className="sidebar-section-title">Administration</div>
                <NavLink
                  to="/users"
                  className={({ isActive }) => 'sidebar-link' + (isActive ? ' active' : '')}
                >
                  👥 Users
                </NavLink>
                <NavLink
                  to="/departments"
                  className={({ isActive }) => 'sidebar-link' + (isActive ? ' active' : '')}
                >
                  🏢 Departments
                </NavLink>
                <NavLink
                  to="/plants"
                  className={({ isActive }) => 'sidebar-link' + (isActive ? ' active' : '')}
                >
                  🏭 Plants
                </NavLink>
              </>
            )}
          </nav>
        </aside>

        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
