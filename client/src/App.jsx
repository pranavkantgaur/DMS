import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './context/AuthContext'
import PrivateRoute from './components/PrivateRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import DrawingList from './pages/drawings/DrawingList'
import DrawingUpload from './pages/drawings/DrawingUpload'
import DrawingView from './pages/drawings/DrawingView'
import DrawingEdit from './pages/drawings/DrawingEdit'
import UserManagement from './pages/admin/UserManagement'
import DepartmentManagement from './pages/admin/DepartmentManagement'
import PlantManagement from './pages/admin/PlantManagement'
import ComponentManagement from './pages/admin/ComponentManagement'

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="drawings" element={<DrawingList />} />
        <Route
          path="drawings/upload"
          element={
            <PrivateRoute roles={['admin', 'supervisor']}>
              <DrawingUpload />
            </PrivateRoute>
          }
        />
        <Route path="drawings/:id" element={<DrawingView />} />
        <Route
          path="drawings/:id/edit"
          element={
            <PrivateRoute roles={['admin', 'supervisor']}>
              <DrawingEdit />
            </PrivateRoute>
          }
        />
        <Route
          path="users"
          element={
            <PrivateRoute roles={['admin']}>
              <UserManagement />
            </PrivateRoute>
          }
        />
        <Route
          path="departments"
          element={
            <PrivateRoute roles={['admin']}>
              <DepartmentManagement />
            </PrivateRoute>
          }
        />
        <Route
          path="plants"
          element={
            <PrivateRoute roles={['admin']}>
              <PlantManagement />
            </PrivateRoute>
          }
        />
        <Route
          path="components"
          element={
            <PrivateRoute roles={['admin', 'supervisor']}>
              <ComponentManagement />
            </PrivateRoute>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster position="top-right" />
      </AuthProvider>
    </BrowserRouter>
  )
}
