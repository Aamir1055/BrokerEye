import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import TwoFactorVerification from '../components/TwoFactorVerification'

const LoginPage = () => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isVisible, setIsVisible] = useState(false)

  const { login, requires2FA, loading } = useAuth()

  useEffect(() => {
    setIsVisible(true)
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    if (!username || !password) {
      setError('Please fill in all fields')
      setIsLoading(false)
      return
    }

    try {
      const result = await login(username, password)
      
      if (!result.success) {
        setError(result.error)
      }
    } catch (err) {
      console.error('Login error:', err)
      setError('Unable to connect to server. Please check your connection.')
    } finally {
      setIsLoading(false)
    }
  }

  // Show 2FA verification if required
  if (requires2FA) {
    return <TwoFactorVerification />
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Enhanced Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-indigo-50 to-blue-100">
        {/* Animated Background Patterns - Responsive */}
        <div className="absolute inset-0">
          <div className="absolute top-10 left-4 sm:top-20 sm:left-20 w-32 h-32 sm:w-72 sm:h-72 bg-blue-200/30 rounded-full mix-blend-multiply filter blur-xl animate-pulse" />
          <div className="absolute top-20 right-4 sm:top-40 sm:right-20 w-32 h-32 sm:w-72 sm:h-72 bg-indigo-200/30 rounded-full mix-blend-multiply filter blur-xl animate-pulse" style={{ animationDelay: '2s' }} />
          <div className="absolute bottom-10 left-8 sm:bottom-20 sm:left-40 w-32 h-32 sm:w-72 sm:h-72 bg-blue-300/20 rounded-full mix-blend-multiply filter blur-xl animate-pulse" style={{ animationDelay: '4s' }} />
        </div>
        
        {/* Floating Elements - Responsive */}
        <div className="absolute inset-0 overflow-hidden">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="absolute w-3 h-3 sm:w-4 sm:h-4 bg-blue-400/20 rounded-full animate-float"
              style={{
                left: `${20 + i * 15}%`,
                top: `${20 + i * 10}%`,
                animationDelay: `${i * 0.5}s`,
                animationDuration: `${3 + i * 0.5}s`
              }}
            />
          ))}
        </div>
      </div>

      <div className="relative z-10 flex items-center justify-center min-h-screen py-4 sm:py-8 lg:py-12 px-3 sm:px-4 lg:px-6">
        <div className={`max-w-xs sm:max-w-sm w-full space-y-4 sm:space-y-6 transition-all duration-1000 transform ${
          isVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
        }`}>
          {/* Enhanced Header - Responsive */}
          <div className="text-center">
            <div className="flex justify-center mb-3 sm:mb-4">
              <div className="relative">
                <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-lg sm:rounded-xl flex items-center justify-center shadow-xl transform hover:scale-105 transition-transform duration-300">
                  <svg className="w-6 h-6 sm:w-7 sm:h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </div>
                <div className="absolute -inset-1 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-lg sm:rounded-xl blur opacity-25 animate-pulse" />
              </div>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-700 bg-clip-text text-transparent mb-2">
              Broker Eyes
            </h2>
            <p className="text-gray-600 text-sm sm:text-base px-4 sm:px-0">
              Sign in to your account
            </p>
            
            {/* Animated Dots */}
            <div className="flex justify-center space-x-2 mt-3 sm:mt-4">
              <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-blue-400 rounded-full animate-bounce" />
              <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
              <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
            </div>
          </div>

          {/* Enhanced Login Form - Responsive */}
          <div className="relative">
            {/* Glass Effect Background */}
            <div className="absolute inset-0 bg-white/70 backdrop-blur-lg rounded-2xl sm:rounded-3xl shadow-2xl border border-white/50" />
            <div className="absolute inset-0 bg-gradient-to-br from-white/80 to-blue-50/50 rounded-2xl sm:rounded-3xl" />
            
            <div className="relative p-3 sm:p-4">
              <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
                {/* Enhanced Username Field - Responsive */}
                <div className="transform hover:scale-105 transition-transform duration-200">
                  <label htmlFor="username" className="block text-sm font-semibold text-gray-800 mb-2">
                    Username
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3 sm:pl-4 flex items-center pointer-events-none">
                      <svg className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500 group-focus-within:text-blue-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <input
                      id="username"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="block w-full pl-8 sm:pl-10 pr-3 py-2.5 sm:py-3 text-gray-900 bg-white/90 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-300 placeholder-gray-500 text-sm font-medium shadow-inner"
                      placeholder="Enter your username"
                      disabled={isLoading}
                      required
                    />
                    <div className="absolute inset-0 rounded-lg sm:rounded-xl bg-gradient-to-r from-blue-400/10 to-indigo-400/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                  </div>
                </div>

                {/* Enhanced Password Field - Responsive */}
                <div className="transform hover:scale-105 transition-transform duration-200">
                  <label htmlFor="password" className="block text-sm font-semibold text-gray-800 mb-2">
                    Password
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3 sm:pl-4 flex items-center pointer-events-none">
                      <svg className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500 group-focus-within:text-blue-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="block w-full pl-8 sm:pl-10 pr-8 sm:pr-10 py-2.5 sm:py-3 text-gray-900 bg-white/90 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-300 placeholder-gray-500 text-sm font-medium shadow-inner"
                      placeholder="Enter your password"
                      disabled={isLoading}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 sm:pr-4 flex items-center text-gray-500 hover:text-blue-600 transition-colors duration-200"
                      disabled={isLoading}
                    >
                      {showPassword ? (
                        <svg className="h-4 w-4 sm:h-5 sm:w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                        </svg>
                      ) : (
                        <svg className="h-4 w-4 sm:h-5 sm:w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                    <div className="absolute inset-0 rounded-lg sm:rounded-xl bg-gradient-to-r from-blue-400/10 to-indigo-400/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                  </div>
                </div>

                {/* Enhanced Error Message - Responsive */}
                {error && (
                  <div className="bg-red-50 border-2 border-red-200 rounded-lg sm:rounded-xl p-3 sm:p-4 animate-shake">
                    <div className="flex items-center">
                      <div className="w-6 h-6 sm:w-8 sm:h-8 bg-red-100 rounded-full flex items-center justify-center mr-2 sm:mr-3 flex-shrink-0">
                        <svg className="h-3 w-3 sm:h-4 sm:w-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <span className="text-xs sm:text-sm font-medium text-red-800">{error}</span>
                    </div>
                  </div>
                )}

                {/* Enhanced Submit Button - Responsive */}
                <button
                  type="submit"
                  disabled={isLoading || loading}
                  className="group relative w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold py-2.5 sm:py-3 px-4 rounded-lg transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500/50 shadow-lg hover:shadow-xl"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-700 to-indigo-700 rounded-lg sm:rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="relative flex items-center justify-center">
                    {isLoading || loading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 sm:h-5 sm:w-5 border-b-2 border-white mr-2 sm:mr-3" />
                        <span className="text-sm sm:text-base">Signing in...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2 group-hover:rotate-12 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                        </svg>
                        <span className="text-sm sm:text-base">Sign In</span>
                      </>
                    )}
                  </div>
                </button>

                {/* Enhanced Forgot Password - Responsive */}
                <div className="text-center">
                  <a href="#" className="inline-flex items-center text-xs sm:text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline transition-all duration-200 hover:scale-105">
                    <svg className="w-3 h-3 sm:w-4 sm:h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Forgot your password?
                  </a>
                </div>
              </form>
            </div>
          </div>

          {/* Enhanced Footer - Responsive */}
          <div className="text-center text-xs sm:text-sm text-gray-600 font-medium px-4 sm:px-0">
            © 2024 Broker Eyes. All rights reserved.
          </div>
        </div>
      </div>
    </div>
  )
}

export default LoginPage