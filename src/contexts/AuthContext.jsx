import React, { createContext, useContext, useState, useEffect } from 'react'
import { authAPI } from '../services/api'

const AuthContext = createContext()

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  // Safe localStorage helpers (avoid SecurityError in restricted contexts)
  const canUseLS = () => { try { return typeof window !== 'undefined' && !!window.localStorage } catch { return false } }
  const lsGet = (key) => { try { return canUseLS() ? window.localStorage.getItem(key) : null } catch { return null } }
  const lsSet = (key, value) => { try { if (canUseLS()) window.localStorage.setItem(key, value) } catch { /* no-op */ } }
  const lsRemove = (key) => { try { if (canUseLS()) window.localStorage.removeItem(key) } catch { /* no-op */ } }
  const [user, setUser] = useState(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState(null)
  const [requires2FA, setRequires2FA] = useState(false)
  const [tempToken, setTempToken] = useState(null)

  // Check if user is already logged in on app start
  useEffect(() => {
    try {
      const token = lsGet('access_token')
      const userData = lsGet('user_data')
      
      if (token && userData) {
        try {
          const parsedUser = JSON.parse(userData)
          setUser(parsedUser)
          setIsAuthenticated(true)
          if (import.meta?.env?.VITE_DEBUG_LOGS === 'true') {
            console.log('[Auth] Session restored from localStorage')
          }
        } catch (error) {
          console.error('Error parsing stored user data:', error)
          logout()
        }
      }
    } catch (e) {
      console.warn('[Auth] localStorage unavailable:', e?.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const login = async (username, password) => {
    try {
      setAuthError(null)
      const response = await authAPI.login(username, password)
      
      // Check if the response indicates 2FA is required
      if (response.status === 'success' && response.data?.requires_2fa) {
        // 2FA required
        setRequires2FA(true)
        setTempToken(response.data.temp_token)
        return { success: true, requires2FA: true }
      } else if (response.status === 'success' && response.data?.access_token) {
        // Direct login success
        handleLoginSuccess(response.data)
        return { success: true, requires2FA: false }
      } else {
        // Unexpected response format
        const errMsg = response.message || 'Login failed'
        setAuthError(errMsg)
        return { 
          success: false, 
          error: errMsg 
        }
      }
    } catch (error) {
      console.error('Login error:', error)
      console.error('Error response:', error.response)
      console.error('Error data:', error.response?.data)
      
      // Extract error message from various possible locations
      let errorMessage = 'Login failed. Please check your credentials.'
      
      if (error.response?.data) {
        // Try different paths where error message might be
        errorMessage = error.response.data.message 
          || error.response.data.data?.message 
          || error.response.data.error
          || error.response.data.data?.error
          || (typeof error.response.data === 'string' ? error.response.data : null)
          || errorMessage
      } else if (error.message) {
        errorMessage = error.message
      }
      
      console.log('Final error message to display:', errorMessage)
      setAuthError(errorMessage)
      
      return { 
        success: false, 
        error: errorMessage 
      }
    } finally {
      // Do not toggle global loading here; let the login page manage its own spinner
    }
  }

  const verify2FA = async (code) => {
    try {
      setLoading(true)
      const response = await authAPI.verify2FA(tempToken, code)
      
      if (response.status === 'success' && response.data?.access_token) {
        handleLoginSuccess(response.data)
        setRequires2FA(false)
        setTempToken(null)
        return { success: true }
      } else {
        return { 
          success: false, 
          error: response.message || '2FA verification failed' 
        }
      }
    } catch (error) {
      console.error('2FA verification error:', error)
      return { 
        success: false, 
        error: error.response?.data?.message || error.response?.data?.data?.message || '2FA verification failed' 
      }
    } finally {
      setLoading(false)
    }
  }

  const handleLoginSuccess = (data) => {
    // Store tokens
    lsSet('access_token', data.access_token)
    lsSet('refresh_token', data.refresh_token)
    lsSet('user_data', JSON.stringify(data.broker))
    
    // Update state
    setUser(data.broker)
    setIsAuthenticated(true)
    setAuthError(null)
    
    if (import.meta?.env?.VITE_DEBUG_LOGS === 'true') {
      console.log('[Auth] Login successful - tokens stored')
      console.log('[Auth] Refresh token will be used automatically when access token expires')
    }
    
    // Dispatch login event to trigger IB email fetch
    window.dispatchEvent(new CustomEvent('auth:login'))
    console.log('[Auth] Login event dispatched')
  }

  const logout = async () => {
    try {
      await authAPI.logout()
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      // Clear storage and state regardless of API call success
      lsRemove('access_token')
      lsRemove('refresh_token')
      lsRemove('user_data')
      
      setUser(null)
      setIsAuthenticated(false)
      setRequires2FA(false)
      setTempToken(null)

      // Navigate to login explicitly so user is redirected immediately
      try { window.dispatchEvent(new CustomEvent('auth:logout')) } catch {}
      if (typeof window !== 'undefined') {
        // Compute current base path (supports sub-folder deployments)
        const path = window.location.pathname || '/'
        const match = path.match(/^\/(amari-capital|broker-branch|broker)\b/)
        const base = match ? `/${match[1]}` : ''
        window.location.href = `${base}/login`
      }
    }
  }

  const setup2FA = async () => {
    try {
      const response = await authAPI.setup2FA()
      return { success: true, data: response.data }
    } catch (error) {
      console.error('2FA setup error:', error)
      return { 
        success: false, 
        error: error.response?.data?.message || '2FA setup failed' 
      }
    }
  }

  const enable2FA = async (code) => {
    try {
      const response = await authAPI.enable2FA(code)
      return { success: true, data: response.data }
    } catch (error) {
      console.error('2FA enable error:', error)
      return { 
        success: false, 
        error: error.response?.data?.message || '2FA enable failed' 
      }
    }
  }

  const get2FAStatus = async () => {
    try {
      const response = await authAPI.get2FAStatus()
      return { success: true, data: response.data }
    } catch (error) {
      console.error('Get 2FA status error:', error)
      return { 
        success: false, 
        error: error.response?.data?.message || 'Failed to get 2FA status' 
      }
    }
  }

  const regenerateBackupCodes = async () => {
    try {
      const response = await authAPI.regenerateBackupCodes()
      return { success: true, data: response.data }
    } catch (error) {
      console.error('Regenerate backup codes error:', error)
      return { 
        success: false, 
        error: error.response?.data?.message || 'Failed to regenerate backup codes' 
      }
    }
  }

  const resetLogin = () => {
    setRequires2FA(false)
    setTempToken(null)
    setLoading(false)
  }

  const value = {
    user,
    isAuthenticated,
    loading,
    requires2FA,
    authError,
    login,
    verify2FA,
    logout,
    setup2FA,
    enable2FA,
    get2FAStatus,
    regenerateBackupCodes,
    resetLogin
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export default AuthContext