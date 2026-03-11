import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'
import toast from 'react-hot-toast'

export default function DrawingUpload() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [plants, setPlants] = useState([])
  const [departments, setDepartments] = useState([])
  const [components, setComponents] = useState([])
  const [form, setForm] = useState({
    title: '',
    drawing_number: '',
    revision: 'A',
    description: '',
    plant_id: '',
    department_id: '',
    component_id: '',
    status: 'active',
  })
  const [file, setFile] = useState(null)

  useEffect(() => {
    loadPlantsAndDepts()
  }, [])

  useEffect(() => {
    if (form.plant_id || form.department_id) {
      loadComponents()
    } else {
      setComponents([])
    }
  }, [form.plant_id, form.department_id])

  const loadPlantsAndDepts = async () => {
    try {
      const [plantsRes, deptsRes] = await Promise.all([
        api.get('/plants'),
        api.get('/departments'),
      ])
      const plantsData = plantsRes.data
      const deptsData = deptsRes.data
      setPlants(Array.isArray(plantsData) ? plantsData : plantsData.data || [])
      setDepartments(Array.isArray(deptsData) ? deptsData : deptsData.data || [])
    } catch {
      toast.error('Failed to load plants/departments')
    }
  }

  const loadComponents = async () => {
    try {
      const params = {}
      if (form.plant_id) params.plant_id = form.plant_id
      if (form.department_id) params.department_id = form.department_id
      const res = await api.get('/components', { params })
      const data = res.data
      setComponents(Array.isArray(data) ? data : data.data || [])
    } catch {
      setComponents([])
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleFileChange = (e) => {
    setFile(e.target.files[0] || null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!file) {
      toast.error('Please select a PDF file')
      return
    }
    setLoading(true)
    try {
      const formData = new FormData()
      Object.entries(form).forEach(([key, val]) => {
        if (val) formData.append(key, val)
      })
      formData.append('file', file)
      await api.post('/drawings', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      toast.success('Drawing uploaded successfully')
      navigate('/drawings')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Upload Drawing</h1>
      </div>

      <div className="card" style={{ maxWidth: 700 }}>
        <div className="card-header">
          <h2 style={{ margin: 0, fontSize: '1rem' }}>Drawing Details</h2>
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
                placeholder="Drawing title"
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
                  placeholder="e.g. DWG-001"
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
                  placeholder="e.g. A"
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
                placeholder="Optional description"
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Plant</label>
                <select name="plant_id" className="form-control" value={form.plant_id} onChange={handleChange}>
                  <option value="">Select Plant</option>
                  {plants.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Department</label>
                <select name="department_id" className="form-control" value={form.department_id} onChange={handleChange}>
                  <option value="">Select Department</option>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Component</label>
                <select name="component_id" className="form-control" value={form.component_id} onChange={handleChange}>
                  <option value="">Select Component</option>
                  {components.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select name="status" className="form-control" value={form.status} onChange={handleChange}>
                  <option value="active">Active</option>
                  <option value="archived">Archived</option>
                  <option value="under_review">Under Review</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">PDF File *</label>
              <input
                type="file"
                className="form-control"
                accept=".pdf"
                onChange={handleFileChange}
                required
              />
              {file && <small style={{ color: '#6c757d' }}>Selected: {file.name}</small>}
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? <span className="loading-spinner" /> : 'Upload Drawing'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => navigate('/drawings')} disabled={loading}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
