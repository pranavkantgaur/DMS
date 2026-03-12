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

const emptyForm = { name: '', description: '' }

export default function DepartmentManagement() {
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editDept, setEditDept] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadDepartments()
  }, [])

  const loadDepartments = async () => {
    setLoading(true)
    try {
      const res = await api.get('/departments')
      const data = res.data
      setDepartments(Array.isArray(data) ? data : data.data || [])
    } catch {
      toast.error('Failed to load departments')
    } finally {
      setLoading(false)
    }
  }

  const openCreate = () => {
    setEditDept(null)
    setForm(emptyForm)
    setModalOpen(true)
  }

  const openEdit = (dept) => {
    setEditDept(dept)
    setForm({ name: dept.name || '', description: dept.description || '' })
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditDept(null)
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
      if (editDept) {
        await api.put(`/departments/${editDept.id}`, form)
        toast.success('Department updated')
      } else {
        await api.post('/departments', form)
        toast.success('Department created')
      }
      closeModal()
      loadDepartments()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Operation failed')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this department?')) return
    try {
      await api.delete(`/departments/${id}`)
      toast.success('Department deleted')
      loadDepartments()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed')
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Department Management</h1>
        <button className="btn btn-primary" onClick={openCreate}>+ Create Department</button>
      </div>

      <div className="card">
        <div className="card-body" style={{ padding: 0 }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
              <span className="loading-spinner" style={{ width: 36, height: 36 }} />
            </div>
          ) : departments.length === 0 ? (
            <div className="empty-state">No departments found.</div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Description</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {departments.map((d) => (
                    <tr key={d.id}>
                      <td><strong>{d.name}</strong></td>
                      <td>{d.description || '—'}</td>
                      <td>{d.created_at ? new Date(d.created_at).toLocaleDateString() : '—'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => openEdit(d)}>Edit</button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(d.id)}>Delete</button>
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
        <Modal title={editDept ? 'Edit Department' : 'Create Department'} onClose={closeModal}>
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
                {saving ? <span className="loading-spinner" /> : (editDept ? 'Save Changes' : 'Create')}
              </button>
              <button type="button" className="btn btn-secondary" onClick={closeModal} disabled={saving}>Cancel</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
