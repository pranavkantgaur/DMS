import React, { createContext, useContext, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    const storedToken = localStorage.getItem('dms_token')
    const storedUser = localStorage.getItem('dms_user')
    if (storedToken && storedUser) {
      try {
        setToken(storedToken)
        setUser(JSON.parse(storedUser))
      } catch {
        localStorage.removeItem('dms_token')
        localStorage.removeItem('dms_user')
      }
    }
  }, [])

  const login = async (credentials) => {
    const response = await api.post('/auth/login', credentials)
    const { token: newToken, user: newUser } = response.data
    localStorage.setItem('dms_token', newToken)
    localStorage.setItem('dms_user', JSON.stringify(newUser))
    setToken(newToken)
    setUser(newUser)
    return response.data
  }

  const logout = () => {
    localStorage.removeItem('dms_token')
    localStorage.removeItem('dms_user')
    setToken(null)
    setUser(null)
    navigate('/login')
  }

  const value = {
    user,
    token,
    login,
    logout,
    isAuthenticated: !!token && !!user,
    isAdmin: user?.role === 'admin',
    isSupervisor: user?.role === 'supervisor',
    isOperator: user?.role === 'operator',
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}

export default AuthContext
