import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../../services/api'
import toast from 'react-hot-toast'

export default function DrawingEdit() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [components, setComponents] = useState([])
  const [form, setForm] = useState({
    title: '',
    drawing_number: '',
    revision: '',
    description: '',
    status: 'active',
    component_id: '',
  })

  useEffect(() => {
    loadDrawing()
    loadComponents()
  }, [id])

  const loadDrawing = async () => {
    try {
      const res = await api.get(`/drawings/${id}`)
      const d = res.data.data
      setForm({
        title: d.title || '',
        drawing_number: d.drawing_number || '',
        revision: d.revision || 'A',
        description: d.description || '',
        status: d.status || 'active',
        component_id: d.component_id || '',
      })
    } catch (err) {
      toast.error('Failed to load drawing')
      navigate('/drawings')
    } finally {
      setLoading(false)
    }
  }

  const loadComponents = async () => {
    try {
      const res = await api.get('/components')
      const data = res.data
      setComponents(Array.isArray(data) ? data : data.data || [])
    } catch {
      // non-critical
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.put(`/drawings/${id}`, form)
      toast.success('Drawing updated successfully')
      navigate(`/drawings/${id}`)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed')
    } finally {
      setSaving(false)
    }
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

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Edit Drawing</h1>
      </div>

      <div className="card" style={{ maxWidth: 700 }}>
        <div className="card-header">
          <h2 style={{ margin: 0, fontSize: '1rem' }}>Edit Details</h2>
        </div>
        <div className="card-body">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Title *</label>
              <input
                type="text"
                name="title"
                className="form-control"
                value={form.title}
                onChange={handleChange}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Drawing Number</label>
                <input
                  type="text"
                  name="drawing_number"
                  className="form-control"
                  value={form.drawing_number}
                  onChange={handleChange}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Revision</label>
                <input
                  type="text"
                  name="revision"
                  className="form-control"
                  value={form.revision}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea
                name="description"
                className="form-control"
                value={form.description}
                onChange={handleChange}
                rows={3}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select name="status" className="form-control" value={form.status} onChange={handleChange}>
                  <option value="active">Active</option>
                  <option value="archived">Archived</option>
                  <option value="under_review">Under Review</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Component</label>
                <select name="component_id" className="form-control" value={form.component_id} onChange={handleChange}>
                  <option value="">Select Component</option>
                  {components.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? <span className="loading-spinner" /> : 'Save Changes'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => navigate(`/drawings/${id}`)}
                disabled={saving}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
