import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, info: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    // Log error details for debugging
    try {
      // eslint-disable-next-line no-console
      console.error('[ErrorBoundary] Caught error:', error)
      // eslint-disable-next-line no-console
      console.error('[ErrorBoundary] Info:', info)
    } catch {}
    this.setState({ info })
  }

  handleReload = () => {
    try {
      window.location.reload()
    } catch {}
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-screen p-4">
          <div className="max-w-md w-full bg-white shadow rounded-xl p-4 border border-[#E5E7EB]">
            <h2 className="text-lg font-semibold text-red-600 mb-2">Something went wrong.</h2>
            <p className="text-sm text-gray-600 mb-3">A component crashed during render. Try reloading the page.</p>
            {this.state.error && (
              <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto max-h-40">
                {String(this.state.error?.message || this.state.error)}
              </pre>
            )}
            <div className="mt-3 flex gap-2">
              <button onClick={this.handleReload} className="px-3 py-1.5 rounded-md bg-blue-600 text-white text-sm">Reload</button>
              {this.props.onReset && (
                <button onClick={this.props.onReset} className="px-3 py-1.5 rounded-md bg-gray-200 text-gray-800 text-sm">Reset</button>
              )}
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
