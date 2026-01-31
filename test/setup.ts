import '@testing-library/jest-dom'

// Silence non-critical console output during tests unless explicitly enabled
const DEBUG = process.env.VITE_DEBUG_LOGS === 'true'
if (!DEBUG) {
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(console, 'debug').mockImplementation(() => {})
}
