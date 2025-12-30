import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import TwoFactorVerification from '../components/TwoFactorVerification'
import Group8 from '../../Login Desktop Icons/Group 8.svg'
import Group9 from '../../Login Desktop Icons/Group 9.svg'
import Group10 from '../../Login Desktop Icons/Group 10.svg'

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
    <div className="h-screen overflow-hidden bg-white relative flex">
      {/* Left Side - Login Form */}
      <div className="flex-1 flex items-center justify-center px-6 relative z-10">
        <div className={`w-[372px] transition-all duration-1000 transform lg:-translate-x-40 xl:-translate-x-64 2xl:-translate-x-80 ${
          isVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
        }`}>
          {/* Logo and Header */}
          <div className="mb-8">
            <div className="flex items-center gap-4 mb-8">
              {/* Gradient square + eye icon per Figma */}
              <div
                className="w-10 h-10 rounded-lg relative flex items-center justify-center"
                style={{
                  background: 'linear-gradient(180deg, rgba(26, 99, 188, 0.6) 0%, #1A63BC 100%)'
                }}
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                  <path d="M12 5c-4.477 0-8.268 2.943-9.542 7 1.274 4.057 5.064 7 9.542 7 4.478 0 8.268-2.943 9.542-7C20.268 7.943 16.478 5 12 5Z" fill="#FFFFFF"/>
                  <circle cx="12" cy="12" r="3" fill="#1A63BC"/>
                </svg>
              </div>
              <div className="flex flex-col justify-center">
                <h1 className="text-[16px] leading-5 font-semibold text-[#404040]">Broker Eyes</h1>
                <p className="text-[12px] leading-5 font-medium text-[#64748B]">Trading Platform</p>
              </div>
            </div>

            <h2 className="text-[20px] leading-[25px] font-semibold text-[#333333] mb-2">Welcome Back</h2>
            <p className="text-[#8C8C8C] text-[12px] leading-[15px]">Welcome back to access your account. Make sure you use correct information</p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="mt-[24px] space-y-[24px]">
            {/* Email Field */}
            <div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg className="h-4 w-4 text-[#999999]" viewBox="0 0 24 24" fill="none">
                    <path d="M2 6h20v12H2z" stroke="#999999" strokeWidth="1.5"/>
                    <path d="M2 6l10 7 10-7" stroke="#999999" strokeWidth="1.5"/>
                  </svg>
                </div>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="block w-full h-[55px] pl-12 pr-4 text-[#333] bg-[rgba(239,246,255,0.36)] border border-[#EDEDED] rounded-[9px] focus:ring-2 focus:ring-[#5B8DEF] focus:border-transparent transition-all duration-200 placeholder-[#999999]"
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
                  <svg className="h-4 w-4 text-[#999999]" viewBox="0 0 24 24" fill="none">
                    <rect x="4" y="9" width="16" height="11" rx="2" stroke="#999999" strokeWidth="1.5"/>
                    <path d="M8 9V7a4 4 0 118 0v2" stroke="#999999" strokeWidth="1.5"/>
                  </svg>
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full h-[55px] pl-12 pr-12 text-[#333] bg-[rgba(239,246,255,0.36)] border border-[#EDEDED] rounded-[9px] focus:ring-2 focus:ring-[#5B8DEF] focus:border-transparent transition-all duration-200 placeholder-[#999999]"
                  placeholder="Password"
                  disabled={isLoading}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-[#999999] hover:text-[#5B8DEF] transition-colors duration-200"
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
              {/* Reset Password link removed as requested */}
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
              className="w-full h-[55px] bg-[#2563EB] hover:bg-[#1E55D0] disabled:bg-gray-400 text-white font-bold rounded-[12px] transition-all duration-300 shadow-lg hover:shadow-xl disabled:cursor-not-allowed text-[16px]"
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

          {/* Footer icons & links panel removed as requested */}
        </div>
      </div>
      
      {/* Right Side - Blue Wave Design (true semicircle, absolute overlay) */}
      <div className="hidden lg:block pointer-events-none absolute inset-0 z-0">
        {/* Ellipse 49 */}
         <div 
           className="absolute rounded-full" 
           style={{
            width: '1400px',
            height: '1400px',
            right: '-700px',
            top: 'calc(54% - 700px)',
            background: '#4471D6'
           }}
         />
        
        {/* Ellipse 51 */}
         <div 
           className="absolute rounded-full" 
           style={{
            width: '1350px',
            height: '1350px',
            right: '-675px',
            top: 'calc(58% - 675px)',
            background: '#3B65C5'
           }}
         />
        
        {/* Ellipse 50 */}
         <div 
           className="absolute rounded-full" 
           style={{
            width: '1300px',
            height: '1300px',
            right: '-650px',
            top: 'calc(62% - 650px)',
            background: '#1641A2'
           }}
         />
        
        {/* Ellipse 29 - Border Circle */}
        <div 
          className="absolute rounded-full box-border" 
          style={{
            width: '320px',
            height: '320px',
            right: '-160px',
            top: 'calc(20% - 160px)',
            border: '80px solid rgba(220, 240, 153, 0.06)',
            background: 'transparent'
          }}
        />

        {/* Content inside dark blue semicircle */}
        <div 
          className="absolute text-white text-left"
          style={{
            right: '50px',
            top: '10%',
            maxWidth: '540px',
          }}
        >
          {/* Main Heading */}
          <h1 
            className="font-bold text-3xl lg:text-4xl xl:text-5xl mb-12"
            style={{
              lineHeight: '1.2',
              textShadow: '0 2px 8px rgba(0,0,0,0.2)'
            }}
          >
            Your Path To Financial<br />Recovery!
          </h1>

          {/* Feature Icons */}
          <div className="flex gap-8 mb-8 justify-start">
            {/* Secure Trading Infrastructure */}
            <div className="flex flex-col items-start text-left" style={{ width: '160px' }}>
              <div className="relative w-20 h-20 mb-3">
                <img src={Group8} alt="Box" className="absolute inset-0 w-full h-full select-none" />
                <div className="absolute inset-0 flex items-center justify-center">
                <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M30.7747 29.2258C28.4797 29.2258 26.6124 31.093 26.6124 33.388C26.6124 34.6453 27.1654 35.806 28.1158 36.5913V40.9048C28.1158 42.371 29.3085 43.5637 30.7747 43.5637C32.2408 43.5637 33.4335 42.371 33.4335 40.9048V36.5913C34.384 35.8058 34.9368 34.6453 34.9368 33.388C34.9369 31.093 33.0698 29.2258 30.7747 29.2258ZM31.9083 35.2297C31.6133 35.4118 31.4337 35.7338 31.4337 36.0806V40.905C31.4337 41.2621 31.1319 41.5638 30.7748 41.5638C30.4177 41.5638 30.1159 41.2622 30.1159 40.905V36.0806C30.1159 35.7338 29.9362 35.4117 29.6412 35.2296C28.997 34.832 28.6125 34.1436 28.6125 33.3881C28.6125 32.196 29.5825 31.226 30.7748 31.226C31.967 31.226 32.937 32.196 32.937 33.3881C32.9369 34.1435 32.5524 34.832 31.9083 35.2297ZM56.3138 39.0378C56.6942 37.0972 56.8893 35.0931 56.8893 33.0707V12.7632C56.8893 12.3632 56.6509 12.0016 56.2832 11.844L31.1687 1.08072C30.9172 0.973094 30.6323 0.973094 30.3808 1.08072L5.26628 11.8441C4.89866 12.0017 4.66016 12.3632 4.66016 12.7633V33.0708C4.66016 40.542 7.21653 47.3793 12.0529 52.8438C16.7145 58.1111 23.3024 61.7126 30.6029 62.9852C30.6598 62.9951 30.7172 63.0001 30.7747 63.0001C30.8322 63.0001 30.8895 62.9951 30.9464 62.9852C35.7227 62.1527 40.253 60.307 44.0878 57.642C45.2693 58.0538 46.5377 58.2785 47.8577 58.2785C54.1888 58.2785 59.3395 53.1277 59.3395 46.7967C59.3397 43.8078 58.1915 41.0827 56.3138 39.0378ZM30.7747 60.9845C16.5675 58.4297 6.66016 46.975 6.66016 33.0707V13.4227L30.7747 3.08797L54.8892 13.4227V33.0708C54.8892 34.5577 54.7764 36.0332 54.5564 37.477C53.8327 36.9553 53.046 36.516 52.2102 36.1723C52.3285 35.1516 52.3893 34.1121 52.3893 33.0708V15.7305C52.3893 15.3305 52.1509 14.9688 51.7832 14.8112L31.1687 5.97659C30.9172 5.86897 30.6323 5.86897 30.3808 5.97659L9.76628 14.8113C9.39866 14.969 9.16016 15.3305 9.16016 15.7306V33.0708C9.16016 39.3262 11.2649 45.0631 15.2468 49.6612C19.1214 54.1355 24.4223 57.158 30.5765 58.4018C30.6419 58.415 30.7083 58.4216 30.7747 58.4216C30.841 58.4216 30.9074 58.415 30.9728 58.4018C34.1677 57.7561 37.1507 56.6186 39.8533 55.0198C40.4923 55.642 41.2029 56.1905 41.972 56.6515C38.6387 58.7722 34.8034 60.2595 30.7747 60.9845ZM36.4319 45.6626H19.8982C19.5544 45.6626 19.2748 45.383 19.2748 45.0393V27.7503C19.2748 27.4066 19.5544 27.127 19.8982 27.127H41.6513C41.995 27.127 42.2747 27.4066 42.2747 27.7503V36.7666C39.0712 38.5568 36.8087 41.8367 36.4319 45.6626ZM38.6588 25.1268H36.5915V22.4712C36.5915 19.2638 33.982 16.6543 30.7747 16.6543C27.5673 16.6543 24.9578 19.2638 24.9578 22.4712V25.1268H22.8907V22.4712C22.8907 18.1241 26.4274 14.5873 30.7747 14.5873C35.1219 14.5873 38.6588 18.1241 38.6588 22.4712V25.1268ZM26.9578 25.1268V22.4712C26.9578 20.3666 28.67 18.6543 30.7747 18.6543C32.8793 18.6543 34.5915 20.3666 34.5915 22.4712V25.1268H26.9578ZM41.6513 25.1268H40.6589V22.4712C40.6589 17.0212 36.2249 12.5873 30.7748 12.5873C25.3247 12.5873 20.8908 17.0213 20.8908 22.4712V25.1268H19.8983C18.4518 25.1268 17.2749 26.3037 17.2749 27.7502V45.0392C17.2749 46.4857 18.4518 47.6625 19.8983 47.6625H36.4087C36.5704 49.8213 37.3322 51.8156 38.5268 53.479C36.155 54.837 33.5535 55.8182 30.7749 56.4003C19.0332 53.9413 11.1604 44.5897 11.1604 33.0706V16.39L30.7749 7.98384L50.3895 16.39V33.0707C50.3895 33.9085 50.3468 34.7447 50.264 35.569C49.4879 35.4027 48.683 35.3146 47.8579 35.3146C46.6072 35.3146 45.4029 35.5163 44.2749 35.8877V27.7503C44.2747 26.3037 43.0978 25.1268 41.6513 25.1268ZM47.8577 56.2782C42.6294 56.2782 38.3759 52.0247 38.3759 46.7965C38.3759 41.5681 42.6294 37.3146 47.8577 37.3146C53.086 37.3146 57.3395 41.5681 57.3395 46.7965C57.3397 52.0247 53.086 56.2782 47.8577 56.2782ZM54.4782 41.8575C53.9964 41.3782 53.3575 41.1148 52.6783 41.1148C52.675 41.1148 52.6715 41.1148 52.6683 41.1148C51.9863 41.1175 51.3468 41.3856 50.8673 41.8697L46.4775 46.3032L44.8462 44.6717C43.85 43.6756 42.2292 43.6757 41.2332 44.6718C40.2373 45.668 40.2373 47.2886 41.2333 48.2847L44.678 51.7295C45.176 52.2275 45.8304 52.4766 46.4845 52.4766C47.1387 52.4766 47.793 52.2275 48.291 51.7293C49.595 50.4252 50.9102 49.0913 52.1822 47.8012C52.9508 47.0216 53.7195 46.2418 54.4902 45.4642C55.4793 44.4657 55.4739 42.8478 54.4782 41.8575ZM53.0694 44.0565C52.2975 44.8353 51.5277 45.6163 50.7579 46.3972C49.4884 47.6847 48.1758 49.0161 46.8767 50.3152C46.6604 50.5315 46.3084 50.5315 46.0922 50.3152L42.6474 46.8706C42.4312 46.6543 42.4312 46.3022 42.6474 46.0861C42.7555 45.978 42.8975 45.9238 43.0397 45.9238C43.1818 45.9238 43.3237 45.978 43.4319 46.0861L45.7739 48.4281C45.9615 48.6156 46.2159 48.721 46.481 48.721H46.4835C46.7497 48.7203 47.0045 48.6137 47.1917 48.4246L52.2884 43.277C52.3914 43.173 52.529 43.1153 52.676 43.1148C52.8209 43.1092 52.9632 43.1713 53.0679 43.2755C53.2832 43.4897 53.2838 43.84 53.0694 44.0565Z" fill="white"/>
                </svg>
                </div>
              </div>
              <span className="text-sm font-semibold" style={{ lineHeight: '1.3' }}>Secure Trading<br />Infrastructure</span>
            </div>

            {/* Fast And Reliable Execution */}
            <div className="flex flex-col items-start text-left" style={{ width: '160px' }}>
              <div className="relative w-20 h-20 mb-3">
                <img src={Group9} alt="Box" className="absolute inset-0 w-full h-full select-none" />
                <div className="absolute inset-0 flex items-center justify-center">
                <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <g clipPath="url(#clip0_545_1072)">
                    <path d="M9.11991 41.63H25.5799L23.3999 61.78C23.353 62.213 23.4488 62.6495 23.6726 63.0231C23.8964 63.3967 24.236 63.6871 24.6399 63.85C25.0466 64.0216 25.4985 64.0538 25.9254 63.9416C26.3523 63.8295 26.7301 63.5793 26.9999 63.23L56.4499 25.6C56.6799 25.3051 56.8227 24.9516 56.8619 24.5796C56.901 24.2076 56.8351 23.8321 56.6716 23.4957C56.5081 23.1593 56.2535 22.8755 55.9368 22.6765C55.6201 22.4775 55.2539 22.3714 54.8799 22.37H38.4199L40.5999 2.22004C40.6468 1.78705 40.5511 1.35059 40.3272 0.976971C40.1034 0.603355 39.7638 0.313006 39.3599 0.150039C38.9533 -0.0215001 38.5013 -0.0537066 38.0744 0.0584374C37.6475 0.170582 37.2697 0.420777 36.9999 0.770039L7.54991 38.4C7.31988 38.695 7.17716 39.0485 7.13796 39.4205C7.09877 39.7925 7.16467 40.168 7.32819 40.5044C7.4917 40.8408 7.74627 41.1246 8.06299 41.3236C8.37971 41.5225 8.74588 41.6287 9.11991 41.63ZM35.8699 8.74004L34.1999 24.15C34.1689 24.4306 34.1975 24.7145 34.284 24.9831C34.3706 25.2518 34.5129 25.4991 34.7018 25.7087C34.8908 25.9184 35.1219 26.0858 35.3801 26.1997C35.6383 26.3137 35.9177 26.3718 36.1999 26.37H50.7699L28.1299 55.26L29.7999 39.85C29.831 39.5695 29.8023 39.2856 29.7158 39.017C29.6293 38.7483 29.4869 38.501 29.298 38.2913C29.1091 38.0816 28.8779 37.9143 28.6197 37.8003C28.3615 37.6864 28.0821 37.6283 27.7999 37.63H13.2299L35.8699 8.74004Z" fill="white"/>
                  </g>
                  <defs>
                    <clipPath id="clip0_545_1072">
                      <rect width="64" height="64" fill="white"/>
                    </clipPath>
                  </defs>
                </svg>
                </div>
              </div>
              <span className="text-sm font-semibold" style={{ lineHeight: '1.3' }}>Fast And Reliable<br />Execution</span>
            </div>

            {/* Real-Time Market Insights */}
            <div className="flex flex-col items-start text-left" style={{ width: '160px' }}>
              <div className="relative w-20 h-20 mb-3">
                <img src={Group10} alt="Box" className="absolute inset-0 w-full h-full select-none" />
                <div className="absolute inset-0 flex items-center justify-center">
                <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <g clipPath="url(#clip0_545_1081)">
                    <path d="M62.0606 61.0909H58.0849V33.9394C58.0849 33.3576 57.697 32.9697 57.1152 32.9697H52.5576C51.9758 32.9697 51.5879 33.3576 51.5879 33.9394V61.0909H47.1273V38.9818C47.1273 38.4 46.7394 38.0121 46.1576 38.0121H41.6C41.0182 38.0121 40.6303 38.4 40.6303 38.9818V61.0909H36.1697V48.097C36.1697 47.5151 35.7818 47.1273 35.2 47.1273H30.6425C30.0606 47.1273 29.6728 47.5151 29.6728 48.097V61.0909H25.2122V45.0909C25.2122 44.5091 24.8243 44.1212 24.2425 44.1212H19.6849C19.1031 44.1212 18.7152 44.5091 18.7152 45.0909V61.0909H14.2546V52.1697C14.2546 51.5879 13.8667 51.2 13.2849 51.2H8.7273C8.14548 51.2 7.75761 51.5879 7.75761 52.1697V61.0909H2.90912V9.50302C2.90912 8.9212 2.52124 8.53333 1.93942 8.53333C1.35761 8.53333 0.969727 8.9212 0.969727 9.50302V62.0606C0.969727 62.6424 1.35761 63.0303 1.93942 63.0303H62.0606C62.6425 63.0303 63.0303 62.6424 63.0303 62.0606C63.0303 61.4788 62.6425 61.0909 62.0606 61.0909ZM12.3152 61.0909H9.697V53.1394H12.3152V61.0909ZM23.2728 61.0909H20.6546V46.0606H23.2728V61.0909ZM34.2303 61.0909H31.6122V49.0667H34.2303V61.0909ZM45.1879 61.0909H42.5697V39.9515H45.1879V61.0909ZM56.1455 61.0909H53.5273V34.9091H56.1455V61.0909Z" fill="white"/>
                    <path d="M10.9576 40.2425C8.82427 40.2425 7.17578 41.988 7.17578 44.0243C7.17578 46.0607 8.92124 47.8061 10.9576 47.8061C12.994 47.8061 14.7394 46.0607 14.7394 44.0243C14.7394 43.5395 14.6424 43.0546 14.4485 42.6668L19.4909 39.0789C20.1697 39.6607 20.9455 39.9516 21.9152 39.9516C23.2728 39.9516 24.4364 39.2728 25.1152 38.2062L29.0909 39.5637V39.8546C29.0909 41.988 30.8364 43.6365 32.8728 43.6365C34.9091 43.6365 36.6546 41.891 36.6546 39.8546C36.6546 39.2728 36.5576 38.788 36.2667 38.3031L41.5031 34.1334C42.1818 34.6183 42.9576 34.9092 43.7334 34.9092C45.8667 34.9092 47.5152 33.1637 47.5152 31.1274C47.5152 30.7395 47.4182 30.3516 47.3212 29.9637L52.0728 26.9577C52.7515 27.6365 53.6243 28.0243 54.6909 28.0243C56.8243 28.0243 58.4728 26.2789 58.4728 24.2425C58.4728 22.1092 56.7273 20.4607 54.6909 20.4607C52.5576 20.4607 50.9091 22.2061 50.9091 24.2425C50.9091 24.6304 51.0061 25.0183 51.1031 25.4061L46.5455 28.3152C45.8667 27.6365 44.994 27.2486 43.9273 27.2486C41.794 27.2486 40.1455 28.994 40.1455 31.0304C40.1455 31.6122 40.2424 32.0971 40.5334 32.5819L35.2 36.8486C34.5212 36.3637 33.7455 36.0728 32.9697 36.0728C31.6121 36.0728 30.4485 36.7516 29.7697 37.8183L25.794 36.4607C25.794 36.3637 25.794 36.2668 25.794 36.1698C25.794 34.0365 24.0485 32.388 22.0121 32.388C19.9758 32.388 18.2303 34.1334 18.2303 36.1698C18.2303 36.6546 18.3273 37.1395 18.5212 37.5274L13.5758 41.1152C12.8 40.6304 11.9273 40.2425 10.9576 40.2425ZM10.9576 45.9637C9.89093 45.9637 9.11517 45.091 9.11517 44.1213C9.11517 43.1516 9.9879 42.2789 10.9576 42.2789C11.5394 42.2789 12.1212 42.5698 12.5091 43.0546C12.7031 43.3455 12.897 43.7334 12.897 44.1213C12.897 45.091 12.0243 45.9637 10.9576 45.9637ZM54.8849 22.3031C55.9515 22.3031 56.7273 23.1758 56.7273 24.1455C56.7273 25.1152 55.8546 25.988 54.8849 25.988C54.2061 25.988 53.6243 25.6001 53.3334 25.1152C53.1394 24.8243 53.0424 24.4365 53.0424 24.1455C52.9455 23.1758 53.8182 22.3031 54.8849 22.3031ZM43.9273 29.188C44.994 29.188 45.7697 30.0607 45.7697 31.0304C45.7697 32.0001 44.897 32.9698 43.9273 32.9698C42.9576 32.9698 42.0849 32.0971 42.0849 31.1274C42.0849 30.1577 42.8606 29.188 43.9273 29.188ZM32.9697 38.0122C34.0364 38.0122 34.8121 38.8849 34.8121 39.8546C34.8121 40.8243 33.9394 41.794 32.9697 41.794C32 41.794 31.0303 41.0183 31.0303 39.9516C31.0303 38.8849 31.9031 38.0122 32.9697 38.0122ZM22.0121 34.2304C23.0788 34.2304 23.8546 35.1031 23.8546 36.0728C23.8546 37.0425 22.9818 37.9152 22.0121 37.9152C21.4303 37.9152 20.8485 37.6243 20.4606 37.1395C20.2667 36.8486 20.0728 36.4607 20.0728 36.0728C20.0728 35.1031 20.9455 34.2304 22.0121 34.2304Z" fill="white"/>
                    <path d="M28.7998 31.0303C37.0423 31.0303 43.8301 24.2425 43.8301 16C43.8301 7.75761 37.1392 0.969727 28.7998 0.969727C20.4604 0.969727 13.7695 7.75761 13.7695 16C13.7695 24.3394 20.5574 31.0303 28.7998 31.0303ZM27.8301 3.00609V4.46064C27.8301 5.04245 28.218 5.43033 28.7998 5.43033C29.3817 5.43033 29.7695 5.04245 29.7695 4.46064V3.00609C36.1695 3.49094 41.4059 8.63033 41.7938 15.0303H40.3392C39.7574 15.0303 39.3695 15.4182 39.3695 16C39.3695 16.5818 39.7574 16.9697 40.3392 16.9697H41.7938C41.3089 23.3697 36.1695 28.6061 29.7695 28.994V27.5394C29.7695 26.9576 29.3817 26.5697 28.7998 26.5697C28.218 26.5697 27.8301 26.9576 27.8301 27.5394V29.0909C21.4301 28.6061 16.1938 23.4667 15.8059 17.0667H17.2604C17.8423 17.0667 18.2301 16.6788 18.2301 16.097C18.2301 15.5152 17.8423 15.1273 17.2604 15.1273H15.8059C16.2907 8.63033 21.4301 3.49094 27.8301 3.00609Z" fill="white"/>
                    <path d="M24.4362 23.6607C24.921 23.9516 25.5029 23.7577 25.7938 23.2728L28.121 19.2001C28.315 19.2971 28.6059 19.2971 28.8968 19.2971C30.7392 19.2971 32.1938 17.8425 32.1938 16.0001C32.1938 14.5455 31.2241 13.2849 29.8665 12.8971V7.75766C29.8665 7.17584 29.4786 6.78796 28.8968 6.78796C28.315 6.78796 27.9271 7.17584 27.9271 7.75766V12.8971C26.5695 13.2849 25.5998 14.5455 25.5998 16.0001C25.5998 16.8728 25.8907 17.6486 26.4725 18.2304L24.0483 22.3031C23.7574 22.788 23.9513 23.3698 24.4362 23.6607ZM28.7998 14.6425C29.5756 14.6425 30.1574 15.2243 30.1574 16.0001C30.1574 16.7758 29.5756 17.3577 28.7998 17.3577C28.5089 17.3577 28.315 17.2607 28.121 17.1637C27.7332 16.9698 27.4422 16.4849 27.4422 16.0001C27.4422 15.3213 28.0241 14.6425 28.7998 14.6425Z" fill="white"/>
                  </g>
                  <defs>
                    <clipPath id="clip0_545_1081">
                      <rect width="64" height="64" fill="white"/>
                    </clipPath>
                  </defs>
                </svg>
                </div>
              </div>
              <span className="text-sm font-semibold" style={{ lineHeight: '1.3' }}>Real-Time Market<br />Insights</span>
            </div>
          </div>

          {/* Subtitle */}
          <p 
            className="text-white text-base"
            style={{
              lineHeight: '1.5',
              opacity: 0.95,
              maxWidth: '500px'
            }}
          >
            A Trusted Platform For Disciplined Trading, Designed To Support Consistency, Risk Awareness, And Execution Quality.
          </p>
        </div>
      </div>
    </div>
  )
}

export default LoginPage
