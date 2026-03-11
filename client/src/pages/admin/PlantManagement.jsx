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

const emptyForm = { name: '', location: '', description: '' }

export default function PlantManagement() {
  const [plants, setPlants] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editPlant, setEditPlant] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadPlants()
  }, [])

  const loadPlants = async () => {
    setLoading(true)
    try {
      const res = await api.get('/plants')
      const data = res.data
      setPlants(Array.isArray(data) ? data : data.data || [])
    } catch {
      toast.error('Failed to load plants')
    } finally {
      setLoading(false)
    }
  }

  const openCreate = () => {
    setEditPlant(null)
    setForm(emptyForm)
    setModalOpen(true)
  }

  const openEdit = (plant) => {
    setEditPlant(plant)
    setForm({ name: plant.name || '', location: plant.location || '', description: plant.description || '' })
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditPlant(null)
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
      if (editPlant) {
        await api.put(`/plants/${editPlant.id}`, form)
        toast.success('Plant updated')
      } else {
        await api.post('/plants', form)
        toast.success('Plant created')
      }
      closeModal()
      loadPlants()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Operation failed')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this plant?')) return
    try {
      await api.delete(`/plants/${id}`)
      toast.success('Plant deleted')
      loadPlants()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed')
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Plant Management</h1>
        <button className="btn btn-primary" onClick={openCreate}>+ Create Plant</button>
      </div>

      <div className="card">
        <div className="card-body" style={{ padding: 0 }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
              <span className="loading-spinner" style={{ width: 36, height: 36 }} />
            </div>
          ) : plants.length === 0 ? (
            <div className="empty-state">No plants found.</div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Location</th>
                    <th>Description</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {plants.map((p) => (
                    <tr key={p.id}>
                      <td><strong>{p.name}</strong></td>
                      <td>{p.location || '—'}</td>
                      <td>{p.description || '—'}</td>
                      <td>{p.created_at ? new Date(p.created_at).toLocaleDateString() : '—'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => openEdit(p)}>Edit</button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(p.id)}>Delete</button>
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
        <Modal title={editPlant ? 'Edit Plant' : 'Create Plant'} onClose={closeModal}>
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
                <label className="form-label">Location</label>
                <input
                  type="text"
                  name="location"
                  className="form-control"
                  value={form.location}
                  onChange={handleChange}
                  placeholder="e.g. Unit 1, Block A"
                />
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
                {saving ? <span className="loading-spinner" /> : (editPlant ? 'Save Changes' : 'Create')}
              </button>
              <button type="button" className="btn btn-secondary" onClick={closeModal} disabled={saving}>Cancel</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
