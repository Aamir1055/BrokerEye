/**
 * Mobile detection hook
 * Extract from: All pages with isMobile state
 */
import { useState, useEffect } from 'react'
import { BREAKPOINTS } from '../constants'

export const useMobile = () => {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth <= BREAKPOINTS.MOBILE
    }
    return false
  })

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= BREAKPOINTS.MOBILE)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  return isMobile
}
