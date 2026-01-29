const LoadingSpinner = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center relative">
      {/* YouTube-style top progress bar */}
      <style>{`
        @keyframes yt-bar {
          0% { left: -30%; width: 30%; }
          50% { left: 25%; width: 40%; }
          100% { left: 100%; width: 25%; }
        }
      `}</style>
      <div className="fixed top-0 left-0 w-full h-0.5 bg-transparent overflow-hidden">
        <div style={{ position: 'relative', height: '100%', backgroundColor: '#FF0000', animation: 'yt-bar 1.2s ease-in-out infinite' }} />
      </div>

      <div className="text-center">
        <div className="w-12 h-12 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-3"></div>
        <p className="text-gray-600 text-sm">Loading...</p>
      </div>
    </div>
  )
}

export default LoadingSpinner
