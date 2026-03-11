import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import api, { downloadDrawing } from '../../services/api'
import toast from 'react-hot-toast'

function StatusBadge({ status }) {
  return <span className={`badge badge-${status}`}>{status?.replace('_', ' ')}</span>
}

export default function DrawingList() {
  const { isAdmin, isSupervisor } = useAuth()
  const navigate = useNavigate()
  const [drawings, setDrawings] = useState([])
  const [plants, setPlants] = useState([])
  const [departments, setDepartments] = useState([])
  const [components, setComponents] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    plant_id: '', department_id: '', component_id: '', status: '', search: '',
  })

  useEffect(() => {
    loadFiltersData()
  }, [])

  useEffect(() => {
    loadDrawings()
  }, [filters])

  const loadFiltersData = async () => {
    try {
      const [plantsRes, deptsRes, compsRes] = await Promise.allSettled([
        api.get('/plants'),
        api.get('/departments'),
        api.get('/components'),
      ])
      if (plantsRes.status === 'fulfilled') {
        const d = plantsRes.value.data
        setPlants(Array.isArray(d) ? d : d.data || [])
      }
      if (deptsRes.status === 'fulfilled') {
        const d = deptsRes.value.data
        setDepartments(Array.isArray(d) ? d : d.data || [])
      }
      if (compsRes.status === 'fulfilled') {
        const d = compsRes.value.data
        setComponents(Array.isArray(d) ? d : d.data || [])
      }
    } catch {
      // non-critical
    }
  }

  const loadDrawings = async () => {
    setLoading(true)
    try {
      const params = {}
      if (filters.plant_id) params.plant_id = filters.plant_id
      if (filters.department_id) params.department_id = filters.department_id
      if (filters.component_id) params.component_id = filters.component_id
      if (filters.status) params.status = filters.status
      if (filters.search) params.search = filters.search
      const res = await api.get('/drawings', { params })
      const data = res.data
      setDrawings(Array.isArray(data) ? data : data.data || [])
    } catch (err) {
      toast.error('Failed to load drawings')
    } finally {
      setLoading(false)
    }
  }

  const handleFilterChange = (e) => {
    const { name, value } = e.target
    setFilters((prev) => ({ ...prev, [name]: value }))
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this drawing?')) return
    try {
      await api.delete(`/drawings/${id}`)
      toast.success('Drawing deleted')
      loadDrawings()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete drawing')
    }
  }

  const handleDownload = async (drawing) => {
    try {
      await downloadDrawing(drawing.id, drawing.file_name || `${drawing.drawing_number || drawing.title}.pdf`)
      toast.success('Download started')
    } catch {
      toast.error('Failed to download drawing')
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Drawings</h1>
        {(isAdmin || isSupervisor) && (
          <Link to="/drawings/upload" className="btn btn-primary">+ Upload Drawing</Link>
        )}
      </div>

      <div className="filter-bar">
        <div className="filter-group">
          <select
            name="plant_id"
            className="form-control"
            value={filters.plant_id}
            onChange={handleFilterChange}
          >
            <option value="">All Plants</option>
            {plants.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <select
            name="department_id"
            className="form-control"
            value={filters.department_id}
            onChange={handleFilterChange}
          >
            <option value="">All Departments</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <select
            name="component_id"
            className="form-control"
            value={filters.component_id}
            onChange={handleFilterChange}
          >
            <option value="">All Components</option>
            {components.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <select
            name="status"
            className="form-control"
            value={filters.status}
            onChange={handleFilterChange}
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
            <option value="under_review">Under Review</option>
          </select>
        </div>
        <div className="filter-group" style={{ flex: 2 }}>
          <input
            type="text"
            name="search"
            className="form-control search-input"
            placeholder="Search drawings..."
            value={filters.search}
            onChange={handleFilterChange}
          />
        </div>
      </div>

      <div className="card">
        <div className="card-body" style={{ padding: 0 }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
              <span className="loading-spinner" style={{ width: 36, height: 36 }} />
            </div>
          ) : drawings.length === 0 ? (
            <div className="empty-state">No drawings found. Adjust filters or upload a drawing.</div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Drawing #</th>
                    <th>Title</th>
                    <th>Rev</th>
                    <th>Plant</th>
                    <th>Department</th>
                    <th>Component</th>
                    <th>Status</th>
                    <th>Uploaded By</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {drawings.map((d) => (
                    <tr key={d.id}>
                      <td>{d.drawing_number || '—'}</td>
                      <td>{d.title}</td>
                      <td>{d.revision || 'A'}</td>
                      <td>{d.plant_name || d.plant?.name || '—'}</td>
                      <td>{d.department_name || d.department?.name || '—'}</td>
                      <td>{d.component_name || d.component?.name || '—'}</td>
                      <td><StatusBadge status={d.status} /></td>
                      <td>{d.uploaded_by_name || d.uploaded_by?.username || '—'}</td>
                      <td>{d.created_at ? new Date(d.created_at).toLocaleDateString() : '—'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          <Link to={`/drawings/${d.id}`} className="btn btn-secondary btn-sm btn-icon" title="View">👁</Link>
                          <button
                            className="btn btn-secondary btn-sm btn-icon"
                            title="Download"
                            onClick={() => handleDownload(d)}
                          >⬇</button>
                          {(isAdmin || isSupervisor) && (
                            <>
                              <Link to={`/drawings/${d.id}/edit`} className="btn btn-secondary btn-sm btn-icon" title="Edit">✏</Link>
                              <button
                                className="btn btn-danger btn-sm btn-icon"
                                title="Delete"
                                onClick={() => handleDelete(d.id)}
                              >🗑</button>
                            </>
                          )}
                        </div>
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
