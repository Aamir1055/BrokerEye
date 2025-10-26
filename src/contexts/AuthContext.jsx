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
  const [user, setUser] = useState(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [requires2FA, setRequires2FA] = useState(false)
  const [tempToken, setTempToken] = useState(null)
  const refreshTimerRef = React.useRef(null)

  // Auto-refresh token before it expires
  const scheduleTokenRefresh = React.useCallback(() => {
    // Clear any existing timer
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current)
    }

    // Refresh token 5 minutes before it expires (3600s - 300s = 3300s = 55 minutes)
    const refreshIn = 55 * 60 * 1000 // 55 minutes in milliseconds
    
    console.log(`[Auth] Token refresh scheduled in ${refreshIn / 1000 / 60} minutes`)
    
    refreshTimerRef.current = setTimeout(async () => {
      console.log('[Auth] Refreshing token...')
      const refreshToken = localStorage.getItem('refresh_token')
      
      if (!refreshToken) {
        console.error('[Auth] No refresh token found, logging out')
        logout()
        return
      }

      try {
        const response = await authAPI.refreshToken(refreshToken)
        
        if (response.status === 'success' && (response.data?.access_token || response.access_token)) {
          const newAccess = response.data?.access_token || response.access_token
          const expiresIn = Number(response.data?.expires_in || response.expires_in || 3600)

          // Update access token
          localStorage.setItem('access_token', newAccess)
          console.log('[Auth] ✅ Token refreshed successfully')

          // Dynamically reschedule next refresh a bit before expiry
          scheduleTokenRefreshDynamic(expiresIn)
        } else {
          console.error('[Auth] Token refresh failed, logging out')
          logout()
        }
      } catch (error) {
        console.error('[Auth] Token refresh error:', error)
        logout()
      }
    }, refreshIn)
  }, [])

  // Version of scheduler that uses expires_in returned by API
  const scheduleTokenRefreshDynamic = React.useCallback((expiresInSeconds) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    // Refresh 60s before expiry, clamp to minimum 60s
    const refreshInMs = Math.max((expiresInSeconds - 60) * 1000, 60000)
    console.log(`[Auth] Token refresh scheduled in ${(refreshInMs/1000/60).toFixed(1)} minutes`)
    refreshTimerRef.current = setTimeout(async () => {
      const refreshToken = localStorage.getItem('refresh_token')
      if (!refreshToken) {
        console.error('[Auth] No refresh token found, logging out')
        logout()
        return
      }
      try {
        const response = await authAPI.refreshToken(refreshToken)
        if (response.status === 'success' && (response.data?.access_token || response.access_token)) {
          const newAccess = response.data?.access_token || response.access_token
          const expiresIn = Number(response.data?.expires_in || response.expires_in || 3600)
          localStorage.setItem('access_token', newAccess)
          console.log('[Auth] ✅ Token refreshed successfully')
          scheduleTokenRefreshDynamic(expiresIn)
        } else {
          console.error('[Auth] Token refresh failed, logging out')
          logout()
        }
      } catch (err) {
        console.error('[Auth] Token refresh error:', err)
        logout()
      }
    }, refreshInMs)
  }, [])

  // Check if user is already logged in on app start
  useEffect(() => {
    const token = localStorage.getItem('access_token')
    const userData = localStorage.getItem('user_data')
    
    if (token && userData) {
      try {
        const parsedUser = JSON.parse(userData)
        setUser(parsedUser)
        setIsAuthenticated(true)
        
    // Start token refresh schedule (fallback interval)
    scheduleTokenRefresh()
      } catch (error) {
        console.error('Error parsing stored user data:', error)
        logout()
      }
    }
    setLoading(false)
    
    // Cleanup on unmount
    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current)
      }
    }
  }, [scheduleTokenRefresh])

  const login = async (username, password) => {
    try {
      setLoading(true)
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
        return { 
          success: false, 
          error: response.message || 'Login failed' 
        }
      }
    } catch (error) {
      console.error('Login error:', error)
      return { 
        success: false, 
        error: error.response?.data?.message || error.response?.data?.data?.message || 'Login failed' 
      }
    } finally {
      setLoading(false)
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
    localStorage.setItem('access_token', data.access_token)
    localStorage.setItem('refresh_token', data.refresh_token)
    localStorage.setItem('user_data', JSON.stringify(data.broker))
    
    // Update state
    setUser(data.broker)
    setIsAuthenticated(true)
    
    // Start token refresh schedule
    const expiresIn = Number(data?.expires_in || 3600)
    scheduleTokenRefreshDynamic(expiresIn)
  }

  const logout = async () => {
    // Clear refresh timer
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current)
      refreshTimerRef.current = null
    }
    
    try {
      await authAPI.logout()
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      // Clear storage and state regardless of API call success
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      localStorage.removeItem('user_data')
      
      setUser(null)
      setIsAuthenticated(false)
      setRequires2FA(false)
      setTempToken(null)

      // Navigate to login explicitly so user is redirected immediately
      try { window.dispatchEvent(new CustomEvent('auth:logout')) } catch {}
      if (typeof window !== 'undefined') {
        window.location.href = '/login'
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