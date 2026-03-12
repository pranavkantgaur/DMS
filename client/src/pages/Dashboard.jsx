import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'
import toast from 'react-hot-toast'

function StatCard({ label, value, color }) {
  return (
    <div className="stat-card" style={{ borderTop: `4px solid ${color}` }}>
      <div className="stat-value" style={{ color }}>{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  )
}

function StatusBadge({ status }) {
  return <span className={`badge badge-${status}`}>{status?.replace('_', ' ')}</span>
}

export default function Dashboard() {
  const { user, isAdmin, isSupervisor, isOperator } = useAuth()
  const [stats, setStats] = useState({ drawings: 0, users: 0, plants: 0, departments: 0 })
  const [recentDrawings, setRecentDrawings] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      if (isAdmin) {
        const [drawingsRes, usersRes, plantsRes, deptsRes] = await Promise.allSettled([
          api.get('/drawings?limit=10'),
          api.get('/users'),
          api.get('/plants'),
          api.get('/departments'),
        ])
        const drawings = drawingsRes.status === 'fulfilled' ? drawingsRes.value.data : { data: [], total: 0 }
        const users = usersRes.status === 'fulfilled' ? usersRes.value.data : []
        const plants = plantsRes.status === 'fulfilled' ? plantsRes.value.data : []
        const depts = deptsRes.status === 'fulfilled' ? deptsRes.value.data : []

        const drawingList = Array.isArray(drawings) ? drawings : drawings.data || []
        setStats({
          drawings: Array.isArray(drawings) ? drawings.length : (drawings.total || drawingList.length),
          users: Array.isArray(users) ? users.length : (users.data?.length || 0),
          plants: Array.isArray(plants) ? plants.length : (plants.data?.length || 0),
          departments: Array.isArray(depts) ? depts.length : (depts.data?.length || 0),
        })
        setRecentDrawings(drawingList.slice(0, 10))
      } else {
        const res = await api.get('/drawings?limit=10')
        const drawings = Array.isArray(res.data) ? res.data : (res.data?.data || [])
        setRecentDrawings(drawings.slice(0, 10))
        setStats((s) => ({ ...s, drawings: drawings.length }))
      }
    } catch (err) {
      toast.error('Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="page-container">
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
          <span className="loading-spinner" style={{ width: 40, height: 40 }} />
        </div>
      </div>
    )
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">
          Dashboard
        </h1>
        <p style={{ color: '#6c757d', marginTop: 4 }}>
          Welcome back, {user?.full_name || user?.username}
        </p>
      </div>

      {isAdmin && (
        <div className="stat-cards-grid">
          <StatCard label="Total Drawings" value={stats.drawings} color="#1e3a5f" />
          <StatCard label="Users" value={stats.users} color="#28a745" />
          <StatCard label="Plants" value={stats.plants} color="#fd7e14" />
          <StatCard label="Departments" value={stats.departments} color="#6f42c1" />
        </div>
      )}

      <div className="card" style={{ marginTop: 24 }}>
        <div className="card-header">
          <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Recent Drawings</h2>
          <Link to="/drawings" className="btn btn-secondary btn-sm">View All</Link>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {recentDrawings.length === 0 ? (
            <div className="empty-state">No drawings found.</div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Drawing #</th>
                    <th>Title</th>
                    <th>Revision</th>
                    <th>Plant</th>
                    <th>Department</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {recentDrawings.map((d) => (
                    <tr key={d.id}>
                      <td>{d.drawing_number || '—'}</td>
                      <td>{d.title}</td>
                      <td>{d.revision || 'A'}</td>
                      <td>{d.plant_name || d.plant?.name || '—'}</td>
                      <td>{d.department_name || d.department?.name || '—'}</td>
                      <td><StatusBadge status={d.status} /></td>
                      <td>
                        <Link to={`/drawings/${d.id}`} className="btn btn-secondary btn-sm">View</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
