import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import api, { downloadDrawing } from '../../services/api'
import toast from 'react-hot-toast'

function StatusBadge({ status }) {
  return <span className={`badge badge-${status}`}>{status?.replace('_', ' ')}</span>
}

export default function DrawingView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isAdmin, isSupervisor } = useAuth()
  const [drawing, setDrawing] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDrawing()
  }, [id])

  const loadDrawing = async () => {
    setLoading(true)
    try {
      const res = await api.get(`/drawings/${id}`)
      setDrawing(res.data)
    } catch (err) {
      toast.error('Failed to load drawing')
      navigate('/drawings')
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = async () => {
    try {
      await downloadDrawing(id, drawing.file_name || `${drawing.drawing_number || drawing.title}.pdf`)
      toast.success('Download started')
    } catch {
      toast.error('Failed to download drawing')
    }
  }

  const getFileUrl = () => {
    const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
    const token = localStorage.getItem('dms_token')
    return `${baseURL}/drawings/${id}/file${token ? `?token=${token}` : ''}`
  }

  if (loading) {
    return (
      <div className="page-container">
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <span className="loading-spinner" style={{ width: 40, height: 40 }} />
        </div>
      </div>
    )
  }

  if (!drawing) return null

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">{drawing.title}</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" onClick={handleDownload}>⬇ Download</button>
          {(isAdmin || isSupervisor) && (
            <Link to={`/drawings/${id}/edit`} className="btn btn-secondary">✏ Edit</Link>
          )}
          <button className="btn btn-secondary" onClick={() => navigate('/drawings')}>← Back</button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <h2 style={{ margin: 0, fontSize: '1rem' }}>Drawing Information</h2>
          <StatusBadge status={drawing.status} />
        </div>
        <div className="card-body">
          <div className="drawing-detail-grid">
            <div className="form-group">
              <label className="form-label">Drawing Number</label>
              <p style={{ margin: 0 }}>{drawing.drawing_number || '—'}</p>
            </div>
            <div className="form-group">
              <label className="form-label">Revision</label>
              <p style={{ margin: 0 }}>{drawing.revision || 'A'}</p>
            </div>
            <div className="form-group">
              <label className="form-label">Plant</label>
              <p style={{ margin: 0 }}>{drawing.plant_name || drawing.plant?.name || '—'}</p>
            </div>
            <div className="form-group">
              <label className="form-label">Department</label>
              <p style={{ margin: 0 }}>{drawing.department_name || drawing.department?.name || '—'}</p>
            </div>
            <div className="form-group">
              <label className="form-label">Component</label>
              <p style={{ margin: 0 }}>{drawing.component_name || drawing.component?.name || '—'}</p>
            </div>
            <div className="form-group">
              <label className="form-label">Uploaded By</label>
              <p style={{ margin: 0 }}>{drawing.uploaded_by_name || drawing.uploaded_by?.username || '—'}</p>
            </div>
            <div className="form-group">
              <label className="form-label">Upload Date</label>
              <p style={{ margin: 0 }}>{drawing.created_at ? new Date(drawing.created_at).toLocaleString() : '—'}</p>
            </div>
            <div className="form-group">
              <label className="form-label">Last Updated</label>
              <p style={{ margin: 0 }}>{drawing.updated_at ? new Date(drawing.updated_at).toLocaleString() : '—'}</p>
            </div>
            {drawing.description && (
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Description</label>
                <p style={{ margin: 0 }}>{drawing.description}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 style={{ margin: 0, fontSize: '1rem' }}>PDF Preview</h2>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          <iframe
            src={getFileUrl()}
            className="pdf-viewer"
            title={drawing.title}
          />
        </div>
      </div>
    </div>
  )
}
