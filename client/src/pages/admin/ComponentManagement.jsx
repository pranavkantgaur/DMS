import React, { useState, useEffect } from 'react'
import api from '../../services/api'
import toast from 'react-hot-toast'

function Modal({ title, onClose, children }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

const emptyForm = { name: '', plant_id: '', department_id: '', description: '' }

export default function ComponentManagement() {
  const [components, setComponents] = useState([])
  const [plants, setPlants] = useState([])
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(true)
  const [plantFilter, setPlantFilter] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editComp, setEditComp] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadPlants()
  }, [])

  useEffect(() => {
    loadComponents()
  }, [plantFilter])

  const loadPlants = async () => {
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
      toast.error('Failed to load plants')
    }
  }

  const loadComponents = async () => {
    setLoading(true)
    try {
      const params = plantFilter ? { plant_id: plantFilter } : {}
      const res = await api.get('/components', { params })
      const data = res.data
      setComponents(Array.isArray(data) ? data : data.data || [])
    } catch {
      toast.error('Failed to load components')
    } finally {
      setLoading(false)
    }
  }

  const openCreate = () => {
    setEditComp(null)
    setForm({ ...emptyForm, plant_id: plantFilter || '' })
    setModalOpen(true)
  }

  const openEdit = (comp) => {
    setEditComp(comp)
    setForm({
      name: comp.name || '',
      plant_id: comp.plant_id || '',
      department_id: comp.department_id || '',
      description: comp.description || '',
    })
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditComp(null)
    setForm(emptyForm)
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = { ...form }
      if (!payload.plant_id) delete payload.plant_id
      if (editComp) {
        await api.put(`/components/${editComp.id}`, payload)
        toast.success('Component updated')
      } else {
        await api.post('/components', payload)
        toast.success('Component created')
      }
      closeModal()
      loadComponents()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Operation failed')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this component?')) return
    try {
      await api.delete(`/components/${id}`)
      toast.success('Component deleted')
      loadComponents()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed')
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Component Management</h1>
        <button className="btn btn-primary" onClick={openCreate}>+ Create Component</button>
      </div>

      <div className="filter-bar">
        <div className="filter-group">
          <select
            className="form-control"
            value={plantFilter}
            onChange={(e) => setPlantFilter(e.target.value)}
          >
            <option value="">All Plants</option>
            {plants.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>

      <div className="card">
        <div className="card-body" style={{ padding: 0 }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
              <span className="loading-spinner" style={{ width: 36, height: 36 }} />
            </div>
          ) : components.length === 0 ? (
            <div className="empty-state">No components found.</div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Plant</th>
                    <th>Description</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {components.map((c) => (
                    <tr key={c.id}>
                      <td><strong>{c.name}</strong></td>
                      <td>{c.plant_name || c.plant?.name || '—'}</td>
                      <td>{c.description || '—'}</td>
                      <td>{c.created_at ? new Date(c.created_at).toLocaleDateString() : '—'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => openEdit(c)}>Edit</button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(c.id)}>Delete</button>
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

      {modalOpen && (
        <Modal title={editComp ? 'Edit Component' : 'Create Component'} onClose={closeModal}>
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Name *</label>
                <input
                  type="text"
                  name="name"
                  className="form-control"
                  value={form.name}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Plant</label>
                <select name="plant_id" className="form-control" value={form.plant_id} onChange={handleChange}>
                  <option value="">None</option>
                  {plants.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Department</label>
                <select name="department_id" className="form-control" value={form.department_id} onChange={handleChange}>
                  <option value="">None</option>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
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
            </div>
            <div className="modal-footer">
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? <span className="loading-spinner" /> : (editComp ? 'Save Changes' : 'Create')}
              </button>
              <button type="button" className="btn btn-secondary" onClick={closeModal} disabled={saving}>Cancel</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
