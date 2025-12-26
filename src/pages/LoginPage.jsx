import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import TwoFactorVerification from '../components/TwoFactorVerification'

const LoginPage = () => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isVisible, setIsVisible] = useState(false)

  const { login, requires2FA, authError } = useAuth()

  useEffect(() => {
    setIsVisible(true)
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Clear previous error
    setErrorMessage('')

    // Validation
    if (!username.trim() || !password.trim()) {
      setErrorMessage('Please fill in all fields')
      return
    }

    setIsLoading(true)

    try {
      const result = await login(username, password)
      
      // Handle login response
      if (result?.requires2FA) {
        // 2FA required - AuthContext will handle the state
        setIsLoading(false)
      } else if (result?.success) {
        // Login successful - user will be redirected by AuthContext
        setIsLoading(false)
      } else {
        // Login failed - show error
        setErrorMessage(result?.error || 'Invalid username or password. Please try again.')
        setIsLoading(false)
      }
    } catch (err) {
      // Handle unexpected errors
      console.error('Login error:', err)
      setErrorMessage('An unexpected error occurred. Please try again.')
      setIsLoading(false)
    }
  }

  // Show 2FA verification if required
  if (requires2FA) {
    return <TwoFactorVerification />
  }

  return (
    <div className="min-h-screen bg-white flex">
      {/* Left Side - Login Form */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-20 xl:px-32">
        <div className={`w-full max-w-md transition-all duration-1000 transform ${
          isVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
        }`}>
          {/* Logo and Header */}
          <div className="mb-8">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-16 h-16 bg-[#5B8DEF] rounded-2xl flex items-center justify-center shadow-lg">
                <svg className="w-9 h-9 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-[#2D3748]">Broker Eyes</h1>
                <p className="text-sm text-[#718096]">Trading Platform</p>
              </div>
            </div>
            
            <h2 className="text-3xl font-bold text-[#2D3748] mb-2">Welcome Back</h2>
            <p className="text-[#718096]">Welcome back to access your account. Make sure you use correct information</p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email Field */}
            <div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-[#A0AEC0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="block w-full pl-12 pr-4 py-4 text-gray-900 bg-white border border-[#E2E8F0] rounded-xl focus:ring-2 focus:ring-[#5B8DEF] focus:border-transparent transition-all duration-200 placeholder-[#A0AEC0]"
                  placeholder="Email"
                  disabled={isLoading}
                  required
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-[#A0AEC0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-12 pr-12 py-4 text-gray-900 bg-white border border-[#E2E8F0] rounded-xl focus:ring-2 focus:ring-[#5B8DEF] focus:border-transparent transition-all duration-200 placeholder-[#A0AEC0]"
                  placeholder="Password"
                  disabled={isLoading}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-[#A0AEC0] hover:text-[#5B8DEF] transition-colors duration-200"
                  disabled={isLoading}
                >
                  {showPassword ? (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {(errorMessage || authError) && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                    <svg className="h-4 w-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-red-800">{errorMessage || authError}</span>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#5B8DEF] hover:bg-[#4A7DD8] disabled:bg-gray-400 text-white font-semibold py-4 px-4 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl disabled:cursor-not-allowed text-lg"
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3" />
                  <span>Signing in...</span>
                </div>
              ) : (
                'Log In'
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Right Side - Blue Wave Design */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-3/5 relative overflow-hidden bg-white">
        {/* Ellipse 49 */}
        <div 
          className="absolute rounded-full" 
          style={{
            width: '1549px',
            height: '1490px',
            left: '-850px',
            top: '-372px',
            background: '#4471D6'
          }}
        />
        
        {/* Ellipse 51 */}
        <div 
          className="absolute rounded-full" 
          style={{
            width: '1549px',
            height: '1490px',
            left: '-800px',
            top: '-377px',
            background: '#3B65C5'
          }}
        />
        
        {/* Ellipse 50 */}
        <div 
          className="absolute rounded-full" 
          style={{
            width: '1549px',
            height: '1456px',
            left: '-752px',
            top: '-359px',
            background: '#1641A2'
          }}
        />
        
        {/* Ellipse 29 - Border Circle */}
        <div 
          className="absolute rounded-full box-border" 
          style={{
            width: '412px',
            height: '412px',
            left: '150px',
            top: '-296px',
            border: '100px solid rgba(220, 240, 153, 0.06)',
            background: 'transparent'
          }}
        />
      </div>
    </div>
  )
}

export default LoginPage
