import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import Group8 from '../../Login Desktop Icons/Group 8.svg'
import Group9 from '../../Login Desktop Icons/Group 9.svg'
import Group10 from '../../Login Desktop Icons/Group 10.svg'
import BrandGroup from '../../Mobile cards icons/Brokers Eye Platform/Group.svg'

// Mobile-specific Login Page designed per Figma specs
// Container: 412x923, rounded corners, layered ellipses, centered brand, hero + features, and form
const LoginMobile = () => {
  const { login } = useAuth()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMessage('')
    if (!username.trim() || !password.trim()) {
      setErrorMessage('Please fill in all fields')
      return
    }
    setIsLoading(true)
    try {
      const result = await login(username, password)
      if (!result?.success) {
        setErrorMessage(result?.error || 'Invalid email or password')
      }
    } catch (err) {
      setErrorMessage('Unexpected error. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="w-full min-h-screen flex items-center justify-center bg-gray-100">
      <div className="relative w-full max-w-[412px] h-[923px] bg-white rounded-[20px] overflow-hidden shadow-2xl mx-4">
        {/* Background Ellipses (blue layers) */}
        <div className="absolute rounded-full" style={{ width: 651, height: 651, left: -40, top: -158, background: '#4471D6' }} />
        <div className="absolute rounded-full" style={{ width: 651, height: 652, left: -32, top: -178, background: '#3B65C5' }} />
        <div className="absolute rounded-full" style={{ width: 651, height: 651, left: -22, top: -204, background: '#1641A2' }} />

        {/* Upper-right subtle border circle */}
        <div className="absolute rounded-full box-border" style={{ width: 243, height: 256, left: 286, top: -142, border: '30px solid rgba(220, 240, 153, 0.06)' }} />

        {/* Brand row (center top) */}
        <div className="absolute" style={{ left: '50%', transform: 'translateX(-50%)', top: 24, width: 149, height: 42 }}>
          <div className="w-full h-full flex items-center justify-center gap-[6.4px]">
            {/* Brand icon from assets */}
            <img src={BrandGroup} alt="Broker Eyes" className="w-[33.07px] h-[33.07px] rounded-[8px]" />
            <div className="flex flex-col justify-center items-start" style={{ width: 97, height: 50 }}>
              <div className="font-outfit font-semibold text-[18px] leading-[24px] text-white">Broker Eyes</div>
              <div className="font-outfit font-normal text-[10px] leading-[16px] tracking-[0.14em] text-[#F2F2F7]">Trading Platform</div>
            </div>
          </div>
        </div>

        {/* Hero heading (center top) */}
        <div className="absolute text-white font-outfit font-extrabold text-[32px] leading-[41px] text-center capitalize" style={{ width: 298, left: '50%', transform: 'translateX(-50%)', top: 90 }}>
          Your Path To Financial Recovery!
        </div>

        {/* Three feature boxes */}
        {/* Left */}
        <div className="absolute" style={{ left: 54, top: 191, width: 54, height: 66 }}>
          <div className="flex flex-col items-center gap-[6px]">
            <div className="w-[42px] h-[42px] rounded-[8px] bg-[#3C61D6] flex items-center justify-center p-[9px]">
              <img src={Group8} alt="Secure Trading Infrastructure" className="w-[24px] h-[24px] select-none" />
            </div>
            <div className="font-outfit font-medium text-[8px] leading-[9px] text-white text-center capitalize">Secure Trading Infrastructure</div>
          </div>
        </div>
        {/* Middle */}
        <div className="absolute" style={{ left: 128, top: 191, width: 62, height: 66 }}>
          <div className="flex flex-col items-center gap-[6px]">
            <div className="w-[42px] h-[42px] rounded-[8px] bg-[#3C61D6] flex items-center justify-center p-[9px]">
              <img src={Group9} alt="Fast and reliable execution" className="w-[24px] h-[24px] select-none" />
            </div>
            <div className="font-outfit font-medium text-[8px] leading-[9px] text-white text-center capitalize">Fast And Reliable Execution</div>
          </div>
        </div>
        {/* Right */}
        <div className="absolute" style={{ left: 210, top: 191, width: 64, height: 66 }}>
          <div className="flex flex-col items-center gap-[6px]">
            <div className="w-[42px] h-[42px] rounded-[8px] bg-[#3C61D6] flex items-center justify-center p-[9px]">
              <img src={Group10} alt="Real-time market insights" className="w-[24px] h-[24px] select-none" />
            </div>
            <div className="font-outfit font-medium text-[8px] leading-[9px] text-white text-center capitalize">Real-Time Market Insights</div>
          </div>
        </div>

        {/* Subtitle paragraph */}
        <div className="absolute font-outfit font-medium text-[12px] leading-[19px] text-white text-center capitalize" style={{ width: 303, left: '50%', transform: 'translateX(-50%)', top: 277 }}>
          A Trusted Platform For Disciplined Trading, Designed To Support Consistency, Risk Awareness, And Execution Quality.
        </div>

        {/* Decorative shapes near center-right */}
        <div className="absolute rounded-full" style={{ width: 21, height: 22, left: 223, top: 366, background: 'rgba(220, 240, 153, 0.06)' }} />
        <div className="absolute rounded-[100px]" style={{ width: 109.5, height: 37.55, left: 174.96, top: 374.92, background: 'rgba(220, 240, 153, 0.06)', transform: 'rotate(-32deg)' }} />
        <div className="absolute rounded-[100px]" style={{ width: 186.38, height: 63.91, left: 174, top: 397.9, background: 'rgba(220, 240, 153, 0.06)', transform: 'rotate(-32deg)' }} />

        {/* Form header: Welcome Back + note */}
        <div className="absolute" style={{ left: 20, top: 533, width: 324, height: 62 }}>
          <div className="flex flex-col items-start gap-[7px]">
            <div className="font-outfit font-semibold text-[20px] leading-[25px] text-[#333333]">Welcome Back</div>
            <div className="font-outfit font-normal text-[12px] leading-[15px] text-[#8C8C8C]">Welcome back to access your account. Make sure you use correct information</div>
          </div>
        </div>

        {/* Email field */}
        <div className="absolute" style={{ left: 20, top: 615, width: 372, height: 55 }}>
          <div className="w-full h-full rounded-[9px] bg-[rgba(239,246,255,0.36)] border border-[#EDEDED] flex items-center px-[17px]">
            <div className="flex items-center gap-[15px]">
              {/* Tiny envelope glyph */}
              <svg width="11" height="9" viewBox="0 0 24 24">
                <rect x="4" y="8" width="16" height="8" rx="2" fill="none" stroke="#999999" strokeWidth="1" />
                <path d="M4 8l8 6 8-6" fill="none" stroke="#999999" strokeWidth="1" />
              </svg>
              <span className="font-montserrat font-medium text-[14px] leading-[17px] text-[#999999]">Email</span>
            </div>
          </div>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="absolute top-0 left-[90px] w-[260px] h-full bg-transparent outline-none text-[#333333] placeholder-[#999999] text-[14px]"
            placeholder="Enter your email"
          />
        </div>

        {/* Password field */}
        <div className="absolute" style={{ left: 20, top: 687, width: 372, height: 55 }}>
          <div className="w-full h-full rounded-[9px] bg-[rgba(239,246,255,0.36)] border border-[#EDEDED] flex items-center justify-between px-[17px]">
            <div className="flex items-center gap-[15px]">
              {/* Tiny lock glyph */}
              <svg width="11" height="13" viewBox="0 0 24 24">
                <rect x="6" y="10" width="12" height="9" rx="2" fill="#999999" />
              </svg>
              <span className="font-montserrat font-medium text-[14px] leading-[17px] text-[#999999]">Password</span>
            </div>
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="flex items-center"
            >
              <svg width="16" height="13" viewBox="0 0 24 24" fill="#999999">
                {showPassword ? (
                  <path d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                ) : (
                  <>
                    <path d="M12 5c-4.477 0-8.268 2.943-9.542 7 1.274 4.057 5.064 7 9.542 7 4.478 0 8.268-2.943 9.542-7C20.268 7.943 16.478 5 12 5Z" />
                    <circle cx="12" cy="12" r="3" fill="#FFFFFF" />
                  </>
                )}
              </svg>
            </button>
          </div>
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="absolute top-0 left-[132px] w-[200px] h-full bg-transparent outline-none text-[#333333] placeholder-[#999999] text-[14px]"
            placeholder="Enter password"
          />
        </div>

        {/* Reset Password */}
        <div className="absolute font-montserrat font-medium text-[14px] leading-[17px] text-center text-[#999999]" style={{ left: 279, top: 752, width: 113, height: 17 }}>
          Reset Password
        </div>

        {/* Submit button */}
        <form onSubmit={handleSubmit}>
          <button
            type="submit"
            disabled={isLoading}
            className="absolute flex items-center justify-center gap-[10px] text-white font-montserrat font-bold text-[16px]"
            style={{ left: '50%', transform: 'translateX(-50%)', top: 789, width: 372, height: 55, background: '#2563EB', borderRadius: 12 }}
          >
            {isLoading ? 'Signing in…' : 'Log In'}
          </button>
        </form>

        {/* Error message */}
        {errorMessage && (
          <div className="absolute left-[20px] right-[20px]" style={{ top: 750 }}>
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-800">{errorMessage}</div>
          </div>
        )}

        {/* Social icons row */}
        <div className="absolute flex items-center justify-center gap-[10px]" style={{ left: '50%', transform: 'translateX(-50%)', top: 884, width: 78, height: 12 }}>
          {/* YouTube */}
          <svg width="12" height="12" viewBox="0 0 24 24"><rect x="4" y="7" width="16" height="10" rx="2" fill="rgba(64,64,64,0.42)" /></svg>
          {/* Instagram */}
          <svg width="12" height="12" viewBox="0 0 24 24"><rect x="5" y="5" width="14" height="14" rx="4" fill="rgba(64,64,64,0.42)" /></svg>
          {/* LinkedIn */}
          <svg width="12" height="12" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2" fill="rgba(64,64,64,0.42)" /></svg>
          {/* Facebook */}
          <svg width="12" height="12" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="4" fill="rgba(64,64,64,0.42)" /></svg>
        </div>

        {/* Footer tiny text */}
        <div className="absolute font-roboto font-normal text-[8px] leading-[9px] text-center flex items-center justify-center" style={{ left: '50%', transform: 'translateX(-50%)', bottom: 10, width: 236 }}>
          <span style={{ color: 'rgba(64, 64, 64, 0.42)' }}>Terms & Conditions | Privacy Notice | FAQs | Contact Us | Follow Us</span>
        </div>
      </div>
    </div>
  )
}

export default LoginMobile
