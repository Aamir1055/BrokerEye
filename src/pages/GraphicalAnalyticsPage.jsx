import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import { useAuth } from '../contexts/AuthContext'
import { useData } from '../contexts/DataContext'
import { brokerAPI } from '../services/api'

// Vertical Bar Chart with gradients and modern styling
const BarChart = ({ data, height = 260, color = 'blue', title = '', showGrid = true }) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm font-medium">
        <div className="text-center">
          <svg className="w-12 h-12 mx-auto mb-2 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p>No data available</p>
        </div>
      </div>
    )
  }

  const maxVal = Math.max(...data.map(d => Math.abs(d.value)), 1)
  const minVal = Math.min(...data.map(d => d.value), 0)
  const range = maxVal - minVal || 1
  const barWidth = Math.max(50, Math.min(80, (100 / data.length) - 10))
  
  const padding = { top: 40, right: 20, bottom: 60, left: 60 }
  const chartHeight = height - padding.top - padding.bottom

  const colorMap = {
    blue: { from: '#3b82f6', to: '#1e40af', shadow: '#3b82f620' },
    green: { from: '#22c55e', to: '#15803d', shadow: '#22c55e20' },
    emerald: { from: '#10b981', to: '#047857', shadow: '#10b98120' },
    orange: { from: '#f97316', to: '#c2410c', shadow: '#f9731620' },
    amber: { from: '#f59e0b', to: '#b45309', shadow: '#f59e0b20' },
    violet: { from: '#8b5cf6', to: '#6d28d9', shadow: '#8b5cf620' },
    red: { from: '#ef4444', to: '#b91c1c', shadow: '#ef444420' },
    indigo: { from: '#6366f1', to: '#4338ca', shadow: '#6366f120' },
    cyan: { from: '#06b6d4', to: '#0e7490', shadow: '#06b6d420' },
    teal: { from: '#14b8a6', to: '#0f766e', shadow: '#14b8a620' }
  }

  const colors = colorMap[color] || colorMap.blue
  const gradientId = `gradient-${color}-${Math.random()}`

  return (
    <svg width="100%" height={height} className="overflow-visible" style={{ fontFamily: 'system-ui' }}>
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={colors.from} />
          <stop offset="100%" stopColor={colors.to} />
        </linearGradient>
        <filter id="shadow">
          <feDropShadow dx="0" dy="4" stdDeviation="4" floodOpacity="0.15"/>
        </filter>
      </defs>
      
      {/* Grid lines */}
      {showGrid && [0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
        const y = padding.top + chartHeight * (1 - pct)
        const value = (minVal + range * pct).toFixed(0)
        return (
          <g key={i}>
            <line
              x1={padding.left}
              y1={y}
              x2="95%"
              y2={y}
              stroke="#e5e7eb"
              strokeWidth="1"
              strokeDasharray="4 4"
            />
            <text
              x={padding.left - 10}
              y={y + 4}
              fontSize="11"
              textAnchor="end"
              className="fill-gray-500 font-medium"
            >
              {new Intl.NumberFormat('en-US', { notation: 'compact' }).format(value)}
            </text>
          </g>
        )
      })}

      {/* Bars with gradient and shadow */}
      {data.map((d, i) => {
        const isNegative = d.value < 0
        const absHeight = (Math.abs(d.value) / range) * chartHeight
        const zeroY = padding.top + chartHeight - ((0 - minVal) / range) * chartHeight
        const barY = isNegative ? zeroY : zeroY - absHeight
        const x = padding.left + (i / data.length) * (100 - padding.left - padding.right) + '%'

        return (
          <g key={i} className="bar-group">
            <rect
              x={x}
              y={barY}
              width={`${barWidth}px`}
              height={Math.max(3, absHeight)}
              fill={isNegative ? 'url(#gradient-red)' : `url(#${gradientId})`}
              rx="8"
              filter="url(#shadow)"
              className="transition-all duration-300 hover:opacity-90 cursor-pointer"
              style={{ transformOrigin: 'center bottom' }}
            />
            <text
              x={`calc(${x} + ${barWidth / 2}px)`}
              y={padding.top + chartHeight + 24}
              fontSize="12"
              textAnchor="middle"
              className="fill-gray-700 font-semibold"
            >
              {d.label}
            </text>
            <text
              x={`calc(${x} + ${barWidth / 2}px)`}
              y={barY - 10}
              fontSize="12"
              fontWeight="700"
              textAnchor="middle"
              className="fill-gray-900"
            >
              ${new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(Math.abs(d.value))}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// Area Chart with gradient fills and smooth curves
const AreaChart = ({ data, height = 260, color = 'emerald', title = '' }) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm font-medium">
        <div className="text-center">
          <svg className="w-12 h-12 mx-auto mb-2 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
          </svg>
          <p>No data available</p>
        </div>
      </div>
    )
  }

  const maxVal = Math.max(...data.map(d => d.value))
  const minVal = Math.min(...data.map(d => d.value))
  const range = maxVal - minVal || 1
  
  const padding = { top: 40, right: 20, bottom: 60, left: 60 }
  const chartHeight = height - padding.top - padding.bottom
  const chartWidth = 100 - padding.left - padding.right

  const colorMap = {
    emerald: { line: '#10b981', from: '#10b98140', to: '#10b98105', glow: '#10b98180' },
    blue: { line: '#3b82f6', from: '#3b82f640', to: '#3b82f605', glow: '#3b82f680' },
    orange: { line: '#f97316', from: '#f9731640', to: '#f9731605', glow: '#f9731680' },
    violet: { line: '#8b5cf6', from: '#8b5cf640', to: '#8b5cf605', glow: '#8b5cf680' },
    red: { line: '#ef4444', from: '#ef444440', to: '#ef444405', glow: '#ef444480' }
  }

  const colors = colorMap[color] || colorMap.emerald
  const gradientId = `area-gradient-${color}-${Math.random()}`

  const points = data.map((d, i) => {
    const x = padding.left + (i / (data.length - 1)) * chartWidth
    const y = padding.top + chartHeight - ((d.value - minVal) / range) * chartHeight
    return { x, y, value: d.value, label: d.label }
  })

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${padding.top + chartHeight} L ${padding.left} ${padding.top + chartHeight} Z`

  return (
    <svg width="100%" height={height} style={{ fontFamily: 'system-ui' }}>
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={colors.from} />
          <stop offset="100%" stopColor={colors.to} />
        </linearGradient>
        <filter id="line-glow">
          <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      
      {/* Grid */}
      {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
        const y = padding.top + chartHeight * (1 - pct)
        const value = minVal + range * pct
        return (
          <g key={i}>
            <line x1={padding.left} y1={y} x2="95%" y2={y} stroke="#e5e7eb" strokeWidth="1" strokeDasharray="4 4" />
            <text x={padding.left - 10} y={y + 4} fontSize="11" textAnchor="end" className="fill-gray-500 font-medium">
              {new Intl.NumberFormat('en-US', { notation: 'compact' }).format(value)}
            </text>
          </g>
        )
      })}

      {/* Area fill with gradient */}
      <path d={areaPath} fill={`url(#${gradientId})`} />
      
      {/* Line with glow effect */}
      <path d={linePath} fill="none" stroke={colors.line} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" filter="url(#line-glow)" />

      {/* Points with enhanced styling */}
      {points.map((p, i) => (
        <g key={i} className="point-group">
          <circle cx={p.x} cy={p.y} r="8" fill={colors.glow} opacity="0.3" className="transition-all duration-300" />
          <circle cx={p.x} cy={p.y} r="6" fill="white" stroke={colors.line} strokeWidth="3" className="cursor-pointer hover:r-7 transition-all duration-200" />
          <text x={p.x} y={padding.top + chartHeight + 24} fontSize="12" textAnchor="middle" className="fill-gray-700 font-semibold">
            {data[i].label}
          </text>
          <text x={p.x} y={p.y - 14} fontSize="12" fontWeight="700" textAnchor="middle" className="fill-gray-900">
            ${new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(Math.abs(p.value))}
          </text>
        </g>
      ))}
    </svg>
  )
}

// Horizontal Bar Chart with gradients and ranking
const HorizontalBarChart = ({ data, height = 300, color = 'blue' }) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm font-medium">
        <div className="text-center">
          <svg className="w-12 h-12 mx-auto mb-2 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p>No data available</p>
        </div>
      </div>
    )
  }

  const maxVal = Math.max(...data.map(d => Math.abs(d.value)), 1)
  const barHeight = 44
  const gap = 18
  const padding = { top: 20, right: 100, bottom: 20, left: 170 }

  const colorMap = {
    blue: { from: '#3b82f6', to: '#1e40af' },
    violet: { from: '#8b5cf6', to: '#6d28d9' },
    orange: { from: '#f97316', to: '#c2410c' },
    amber: { from: '#f59e0b', to: '#b45309' }
  }

  const colors = colorMap[color] || colorMap.blue
  const gradientId = `h-bar-gradient-${color}-${Math.random()}`

  return (
    <svg width="100%" height={height} style={{ fontFamily: 'system-ui' }}>
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={colors.from} />
          <stop offset="100%" stopColor={colors.to} />
        </linearGradient>
        <filter id="bar-shadow">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.2"/>
        </filter>
      </defs>
      
      {data.map((d, i) => {
        const y = padding.top + i * (barHeight + gap)
        const barWidth = (Math.abs(d.value) / maxVal) * 58 // percentage of chart width
        const isNegative = d.value < 0
        const rankColors = ['#fbbf24', '#94a3b8', '#d97706'] // gold, silver, bronze

        return (
          <g key={i} className="bar-row-group">
            {/* Rank badge for top 3 */}
            {i < 3 && (
              <>
                <circle cx={padding.left - 150} cy={y + barHeight / 2} r="14" fill={rankColors[i]} opacity="0.2" />
                <circle cx={padding.left - 150} cy={y + barHeight / 2} r="12" fill={rankColors[i]} />
                <text 
                  x={padding.left - 150} 
                  y={y + barHeight / 2 + 1} 
                  fontSize="12" 
                  fontWeight="900" 
                  textAnchor="middle" 
                  dominantBaseline="middle" 
                  className="fill-white"
                >
                  {i + 1}
                </text>
              </>
            )}
            
            {/* Label */}
            <text 
              x={padding.left - 12} 
              y={y + barHeight / 2 + 1} 
              fontSize="14" 
              fontWeight="700" 
              textAnchor="end" 
              className="fill-gray-800"
            >
              {d.label}
            </text>
            
            {/* Background bar (track) */}
            <rect
              x={`${padding.left}px`}
              y={y}
              width="60%"
              height={barHeight}
              fill="#f3f4f6"
              rx="10"
            />
            
            {/* Actual bar with gradient */}
            <rect
              x={`${padding.left}px`}
              y={y}
              width={`${barWidth}%`}
              height={barHeight}
              fill={isNegative ? 'url(#h-bar-gradient-red)' : `url(#${gradientId})`}
              rx="10"
              filter="url(#bar-shadow)"
              className="transition-all duration-400 hover:opacity-90 cursor-pointer"
            />
            
            {/* Value inside bar if space, otherwise outside */}
            <text
              x={barWidth > 15 ? `calc(${padding.left}px + ${barWidth}% - 12px)` : `calc(${padding.left}px + ${barWidth}% + 12px)`}
              y={y + barHeight / 2 + 1}
              fontSize="14"
              fontWeight="800"
              textAnchor={barWidth > 15 ? 'end' : 'start'}
              className={barWidth > 15 ? 'fill-white' : 'fill-gray-900'}
            >
              ${new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(Math.abs(d.value))}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// Donut Chart with 3D effect and modern gradients
const DonutChart = ({ data, size = 240, innerRadius = 0.62 }) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm font-medium">
        <div className="text-center">
          <svg className="w-12 h-12 mx-auto mb-2 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
          </svg>
          <p>No data available</p>
        </div>
      </div>
    )
  }

  const total = data.reduce((sum, d) => sum + Math.abs(d.value), 0)
  let cumulativeAngle = 0

  const colorSchemes = [
    { solid: '#3b82f6', gradient: ['#60a5fa', '#2563eb'] },  // blue
    { solid: '#10b981', gradient: ['#34d399', '#059669'] },  // emerald
    { solid: '#f59e0b', gradient: ['#fbbf24', '#d97706'] },  // amber
    { solid: '#8b5cf6', gradient: ['#a78bfa', '#7c3aed'] },  // violet
    { solid: '#ef4444', gradient: ['#f87171', '#dc2626'] },  // red
    { solid: '#06b6d4', gradient: ['#22d3ee', '#0891b2'] },  // cyan
    { solid: '#ec4899', gradient: ['#f472b6', '#db2777'] },  // pink
    { solid: '#84cc16', gradient: ['#a3e635', '#65a30d'] }   // lime
  ]

  const createArc = (startAngle, endAngle, innerR, outerR) => {
    const start = polarToCartesian(0, 0, outerR, endAngle)
    const end = polarToCartesian(0, 0, outerR, startAngle)
    const innerStart = polarToCartesian(0, 0, innerR, endAngle)
    const innerEnd = polarToCartesian(0, 0, innerR, startAngle)
    const largeArc = endAngle - startAngle > 180 ? 1 : 0

    return [
      'M', start.x, start.y,
      'A', outerR, outerR, 0, largeArc, 0, end.x, end.y,
      'L', innerEnd.x, innerEnd.y,
      'A', innerR, innerR, 0, largeArc, 1, innerStart.x, innerStart.y,
      'Z'
    ].join(' ')
  }

  const polarToCartesian = (centerX, centerY, radius, angleInDegrees) => {
    const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0
    return {
      x: centerX + radius * Math.cos(angleInRadians),
      y: centerY + radius * Math.sin(angleInRadians)
    }
  }

  const outerRadius = size / 2 - 12
  const innerR = outerRadius * innerRadius

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} viewBox={`${-size / 2} ${-size / 2} ${size} ${size}`} style={{ fontFamily: 'system-ui', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.08))' }}>
        <defs>
          {colorSchemes.map((scheme, i) => (
            <radialGradient key={i} id={`donut-gradient-${i}`} cx="30%" cy="30%">
              <stop offset="0%" stopColor={scheme.gradient[0]} />
              <stop offset="100%" stopColor={scheme.gradient[1]} />
            </radialGradient>
          ))}
          <filter id="segment-shadow">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.2"/>
          </filter>
        </defs>
        
        {data.map((d, i) => {
          const angle = (Math.abs(d.value) / total) * 360
          const startAngle = cumulativeAngle
          const endAngle = cumulativeAngle + angle
          cumulativeAngle = endAngle

          const midAngle = (startAngle + endAngle) / 2
          const labelRadius = (outerRadius + innerR) / 2
          const labelPos = polarToCartesian(0, 0, labelRadius, midAngle)

          return (
            <g key={i} className="segment-group">
              <path
                d={createArc(startAngle, endAngle, innerR, outerRadius)}
                fill={`url(#donut-gradient-${i % colorSchemes.length})`}
                stroke="white"
                strokeWidth="3"
                filter="url(#segment-shadow)"
                className="transition-all duration-300 hover:opacity-90 cursor-pointer"
                style={{ transformOrigin: 'center' }}
              />
              {angle > 10 && (
                <text
                  x={labelPos.x}
                  y={labelPos.y}
                  fontSize="14"
                  fontWeight="800"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-white pointer-events-none"
                  style={{ textShadow: '0 2px 4px rgba(0,0,0,0.4)', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))' }}
                >
                  {((Math.abs(d.value) / total) * 100).toFixed(0)}%
                </text>
              )}
            </g>
          )
        })}
        
        {/* Center text with gradient background */}
        <circle cx="0" cy="0" r={innerR} fill="white" filter="url(#segment-shadow)" />
        <circle cx="0" cy="0" r={innerR - 2} fill="url(#donut-gradient-0)" opacity="0.05" />
        <text
          x="0"
          y="-8"
          fontSize="28"
          fontWeight="900"
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-gray-800"
        >
          {data.length}
        </text>
        <text
          x="0"
          y="18"
          fontSize="13"
          fontWeight="600"
          textAnchor="middle"
          className="fill-gray-500"
        >
          Categories
        </text>
      </svg>
      
      <div className="mt-6 grid grid-cols-2 gap-x-5 gap-y-3 w-full max-w-sm">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-2.5 group cursor-pointer">
            <div 
              className="w-5 h-5 rounded-md flex-shrink-0 shadow-md transition-transform group-hover:scale-110" 
              style={{ 
                background: `linear-gradient(135deg, ${colorSchemes[i % colorSchemes.length].gradient[0]}, ${colorSchemes[i % colorSchemes.length].gradient[1]})` 
              }}
            ></div>
            <span className="text-sm text-gray-800 font-semibold truncate group-hover:text-gray-900">{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Modern Insight Card with gradient backgrounds
const InsightCard = ({ icon, title, value, subtitle, trend, trendValue, color = 'blue' }) => {
  const colorMap = {
    blue: { 
      gradient: 'from-blue-500 to-blue-600', 
      light: 'bg-blue-50', 
      border: 'border-blue-200',
      ring: 'ring-blue-100'
    },
    green: { 
      gradient: 'from-green-500 to-green-600', 
      light: 'bg-green-50', 
      border: 'border-green-200',
      ring: 'ring-green-100'
    },
    red: { 
      gradient: 'from-red-500 to-red-600', 
      light: 'bg-red-50', 
      border: 'border-red-200',
      ring: 'ring-red-100'
    },
    orange: { 
      gradient: 'from-orange-500 to-orange-600', 
      light: 'bg-orange-50', 
      border: 'border-orange-200',
      ring: 'ring-orange-100'
    },
    violet: { 
      gradient: 'from-violet-500 to-violet-600', 
      light: 'bg-violet-50', 
      border: 'border-violet-200',
      ring: 'ring-violet-100'
    },
    indigo: { 
      gradient: 'from-indigo-500 to-indigo-600', 
      light: 'bg-indigo-50', 
      border: 'border-indigo-200',
      ring: 'ring-indigo-100'
    },
    emerald: { 
      gradient: 'from-emerald-500 to-emerald-600', 
      light: 'bg-emerald-50', 
      border: 'border-emerald-200',
      ring: 'ring-emerald-100'
    },
    amber: { 
      gradient: 'from-amber-500 to-amber-600', 
      light: 'bg-amber-50', 
      border: 'border-amber-200',
      ring: 'ring-amber-100'
    }
  }

  const colors = colorMap[color] || colorMap.blue

  return (
    <div className={`bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-lg border ${colors.border} p-6 hover:shadow-xl hover:scale-[1.02] transition-all duration-300 relative overflow-hidden group`}>
      {/* Subtle background pattern */}
      <div className={`absolute inset-0 opacity-5 ${colors.light}`}></div>
      
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-4">
          <div className={`w-16 h-16 bg-gradient-to-br ${colors.gradient} rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg ring-4 ${colors.ring} group-hover:scale-110 transition-transform duration-300`}>
            {icon}
          </div>
          {trend && (
            <div className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold shadow-md backdrop-blur-sm ${
              trend === 'up' ? 'bg-gradient-to-r from-green-100 to-emerald-100 text-green-700 border border-green-200' : 
              trend === 'down' ? 'bg-gradient-to-r from-red-100 to-rose-100 text-red-700 border border-red-200' : 
              'bg-gradient-to-r from-gray-100 to-slate-100 text-gray-700 border border-gray-200'
            }`}>
              {trend === 'up' && <span className="text-base">↑</span>}
              {trend === 'down' && <span className="text-base">↓</span>}
              <span>{trendValue}</span>
            </div>
          )}
        </div>
        <p className="text-xs font-bold text-gray-500 mb-2.5 uppercase tracking-wider">{title}</p>
        <p className="text-4xl font-black text-gray-900 mb-2 tracking-tight">{value}</p>
        {subtitle && <p className="text-sm text-gray-600 font-semibold">{subtitle}</p>}
      </div>
      
      {/* Gradient accent line */}
      <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${colors.gradient}`}></div>
    </div>
  )
}

const GraphicalAnalyticsPage = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { user } = useAuth()
  const navigate = useNavigate()
  const { clients, positions } = useData()

  // Commission totals from API (same as Dashboard)
  const [commissionTotals, setCommissionTotals] = useState(null)
  const [topIB, setTopIB] = useState([])
  const [loadingCommissions, setLoadingCommissions] = useState(true)

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [totalsRes, ibRes] = await Promise.all([
          brokerAPI.getIBCommissionTotals(),
          brokerAPI.getIBCommissions(1, 10, '', 'available_commission', 'desc')
        ])
        setCommissionTotals(totalsRes?.data || null)
        setTopIB(ibRes?.data?.records || [])
      } catch (e) {
        // non-fatal
      } finally {
        setLoadingCommissions(false)
      }
    }
    fetchAll()
  }, [])

  // Face-card-like totals reused for charts
  const stats = useMemo(() => {
    const list = clients || []
    const sum = (key) => list.reduce((acc, c) => {
      const v = c?.[key]
      return acc + (typeof v === 'number' ? v : 0)
    }, 0)

    const totalPnl = list.reduce((acc, c) => {
      const hasPnl = typeof c?.pnl === 'number'
      const computed = hasPnl ? c.pnl : ((c?.credit || 0) - (c?.equity || 0))
      return acc + (typeof computed === 'number' && !Number.isNaN(computed) ? computed : 0)
    }, 0)

    const dailyDeposit = sum('dailyDeposit')
    const dailyWithdrawal = sum('dailyWithdrawal')
    const netDW = dailyDeposit - dailyWithdrawal

    return {
      totalClients: list.length,
      totalBalance: sum('balance'),
      totalCredit: sum('credit'),
      totalEquity: sum('equity'),
      totalPnl,
      totalProfit: sum('profit'),
      dailyDeposit,
      dailyWithdrawal,
      netDW,
      dailyPnL: sum('dailyPnL'),
      thisWeekPnL: sum('thisWeekPnL'),
      thisMonthPnL: sum('thisMonthPnL'),
      lifetimePnL: sum('lifetimePnL'),
      commTotal: commissionTotals?.total_commission || 0,
      commAvail: commissionTotals?.total_available_commission || 0,
      commTotalPct: commissionTotals?.total_commission_percentage || 0,
      commAvailPct: commissionTotals?.total_available_commission_percentage || 0,
    }
  }, [clients, commissionTotals])

  // Datasets for charts
  const balanceSet = [
    { label: 'Balance', value: Math.max(0, stats.totalBalance || 0) },
    { label: 'Credit', value: Math.max(0, stats.totalCredit || 0) },
    { label: 'Equity', value: Math.max(0, stats.totalEquity || 0) }
  ]

  const dwSet = [
    { label: 'Deposit', value: Math.max(0, stats.dailyDeposit || 0) },
    { label: 'Withdrawal', value: Math.max(0, stats.dailyWithdrawal || 0) },
    { label: 'Net DW', value: stats.netDW || 0 }
  ]

  const pnlSet = [
    { label: 'Daily', value: stats.dailyPnL || 0 },
    { label: 'Week', value: stats.thisWeekPnL || 0 },
    { label: 'Month', value: stats.thisMonthPnL || 0 },
    { label: 'Lifetime', value: stats.lifetimePnL || 0 }
  ]

  const commissionSet = [
    { label: 'Total', value: stats.commTotal || 0 },
    { label: 'Available', value: stats.commAvail || 0 }
  ]

  const topIBAvailSet = (topIB || []).map((ib) => ({ label: ib.name || String(ib.id || ''), value: ib.available_commission || 0 })).slice(0, 6)

  // Helper format
  const fmt = (n) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(n || 0)
  const fmtCompact = (n) => new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n || 0)

  const equityPctOfBalance = stats.totalBalance ? (stats.totalEquity / stats.totalBalance) * 100 : 0
  const creditPctOfBalance = stats.totalBalance ? (stats.totalCredit / stats.totalBalance) * 100 : 0
  const profitMargin = stats.totalBalance ? (stats.totalProfit / stats.totalBalance) * 100 : 0

  // Portfolio composition for donut
  const portfolioComposition = [
    { label: 'Balance', value: stats.totalBalance },
    { label: 'Credit', value: stats.totalCredit },
    { label: 'Equity', value: stats.totalEquity }
  ].filter(d => d.value > 0)

  return (
    <div className="min-h-screen flex bg-gray-50">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="flex-1 p-3 sm:p-4 lg:p-6 lg:ml-60 overflow-x-hidden">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden text-gray-600 hover:text-gray-900 p-2 rounded-lg hover:bg-white shadow-sm"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div>
                <h1 className="text-3xl font-extrabold text-indigo-700">
                  Graphical Analytics
                </h1>
                <p className="text-sm text-gray-700 mt-1 font-medium">Comprehensive performance insights for {user?.full_name || user?.username}</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/dashboard')}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium px-3 py-1.5 rounded-md hover:bg-blue-50 transition-colors border border-blue-200 flex items-center gap-1"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Dashboard
            </button>
          </div>

          {/* Key Metrics Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <InsightCard
              icon={<svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>}
              title="Total Clients"
              value={stats.totalClients}
              subtitle={`Active accounts`}
              color="blue"
            />
            <InsightCard
              icon={<svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
              title="Total Equity"
              value={`$${fmtCompact(stats.totalEquity)}`}
              subtitle={`${equityPctOfBalance.toFixed(1)}% of balance`}
              color="indigo"
            />
            <InsightCard
              icon={<svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>}
              title="Total PnL"
              value={`$${fmtCompact(Math.abs(stats.totalPnl))}`}
              subtitle={stats.totalPnl >= 0 ? 'Profit' : 'Loss'}
              trend={stats.totalPnl >= 0 ? 'up' : 'down'}
              trendValue={`${((stats.totalPnl / (stats.totalBalance || 1)) * 100).toFixed(2)}%`}
              color={stats.totalPnl >= 0 ? 'green' : 'red'}
            />
            <InsightCard
              icon={<svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>}
              title="Open Positions"
              value={positions.length}
              subtitle={`Floating: $${fmtCompact(stats.totalProfit)}`}
              trend={stats.totalProfit >= 0 ? 'up' : 'down'}
              trendValue={`${profitMargin.toFixed(2)}%`}
              color={stats.totalProfit >= 0 ? 'green' : 'red'}
            />
          </div>

          {/* Portfolio Overview with Donut + Balance Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-xl border border-gray-200 p-7 hover:shadow-2xl transition-shadow">
              <h3 className="text-xl font-black text-gray-900 mb-5 flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                  </svg>
                </div>
                <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">Portfolio Composition</span>
              </h3>
              <div className="flex items-center justify-center">
                <DonutChart data={portfolioComposition} size={220} />
              </div>
              <div className="mt-5 p-5 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border-2 border-blue-200 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0 shadow-md">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-1">Insight</p>
                    <p className="text-sm text-gray-800 font-semibold leading-relaxed">
                      Equity represents {equityPctOfBalance.toFixed(1)}% of your balance, indicating <span className="font-extrabold text-blue-900">{equityPctOfBalance > 80 ? 'strong' : equityPctOfBalance > 50 ? 'moderate' : 'weak'}</span> account health.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-xl border border-gray-200 p-7 hover:shadow-2xl transition-shadow">
              <h3 className="text-xl font-black text-gray-900 mb-5 flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <span className="bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">Balance Breakdown</span>
              </h3>
              <BarChart data={balanceSet} height={260} color="blue" />
              <div className="mt-5 p-5 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl border-2 border-indigo-200 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-indigo-500 rounded-lg flex items-center justify-center flex-shrink-0 shadow-md">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-indigo-700 uppercase tracking-wider mb-1">Insight</p>
                    <p className="text-sm text-gray-800 font-semibold leading-relaxed">
                      Total balance is <span className="font-extrabold text-indigo-900">${fmt(stats.totalBalance)}</span> with ${fmt(stats.totalCredit)} in credit. Maintain credit below 30% of equity for optimal risk management.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* PnL Trends */}
          <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-xl border border-gray-200 p-7 mb-6 hover:shadow-2xl transition-shadow">
            <h3 className="text-xl font-black text-gray-900 mb-6 flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                </svg>
              </div>
              <span className="bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent">Profit & Loss Trends</span>
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <AreaChart data={pnlSet} height={260} color="emerald" />
              </div>
              <div className="flex flex-col justify-center gap-4">
                <div className="p-5 bg-gradient-to-br from-emerald-50 to-green-50 rounded-2xl border-2 border-emerald-300 shadow-md hover:shadow-lg transition-shadow">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Daily PnL</span>
                    <div className={`px-3 py-1 rounded-lg ${stats.dailyPnL >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
                      <span className={`text-2xl font-black ${stats.dailyPnL >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        ${fmt(Math.abs(stats.dailyPnL))}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-2xl ${stats.dailyPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>{stats.dailyPnL >= 0 ? '↑' : '↓'}</span>
                    <p className="text-sm text-gray-700 font-semibold">
                      {stats.dailyPnL >= 0 ? 'Profit' : 'Loss'} today
                    </p>
                  </div>
                </div>
                <div className="p-5 bg-gradient-to-br from-cyan-50 to-blue-50 rounded-2xl border-2 border-cyan-300 shadow-md hover:shadow-lg transition-shadow">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-cyan-700 uppercase tracking-wider">Weekly PnL</span>
                    <div className={`px-3 py-1 rounded-lg ${stats.thisWeekPnL >= 0 ? 'bg-cyan-100' : 'bg-orange-100'}`}>
                      <span className={`text-2xl font-black ${stats.thisWeekPnL >= 0 ? 'text-cyan-700' : 'text-orange-700'}`}>
                        ${fmt(Math.abs(stats.thisWeekPnL))}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-2xl ${stats.thisWeekPnL >= 0 ? 'text-cyan-600' : 'text-orange-600'}`}>{stats.thisWeekPnL >= 0 ? '↑' : '↓'}</span>
                    <p className="text-sm text-gray-700 font-semibold">
                      {((stats.thisWeekPnL / (stats.totalBalance || 1)) * 100).toFixed(2)}% of balance
                    </p>
                  </div>
                </div>
                <div className="p-5 bg-gradient-to-br from-violet-50 to-purple-50 rounded-2xl border-2 border-violet-300 shadow-md hover:shadow-lg transition-shadow">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-violet-700 uppercase tracking-wider">Lifetime PnL</span>
                    <div className={`px-3 py-1 rounded-lg ${stats.lifetimePnL >= 0 ? 'bg-violet-100' : 'bg-pink-100'}`}>
                      <span className={`text-2xl font-black ${stats.lifetimePnL >= 0 ? 'text-violet-700' : 'text-pink-700'}`}>
                        ${fmt(Math.abs(stats.lifetimePnL))}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-2xl ${stats.lifetimePnL >= 0 ? 'text-violet-600' : 'text-pink-600'}`}>{stats.lifetimePnL >= 0 ? '↑' : '↓'}</span>
                    <p className="text-sm text-gray-700 font-semibold">
                      Cumulative {stats.lifetimePnL >= 0 ? 'profit' : 'loss'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Deposits vs Withdrawals */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-xl border border-gray-200 p-7 hover:shadow-2xl transition-shadow">
              <h3 className="text-xl font-black text-gray-900 mb-5 flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                </div>
                <span className="bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">Daily Deposits & Withdrawals</span>
              </h3>
              <BarChart data={dwSet} height={260} color="orange" />
              <div className="mt-5 p-5 bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl border-2 border-orange-200 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center flex-shrink-0 shadow-md">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-orange-700 uppercase tracking-wider mb-1">Net Flow</p>
                    <p className="text-sm text-gray-800 font-semibold leading-relaxed">
                      {stats.netDW >= 0 ? 'Positive inflow of' : 'Negative outflow of'} <span className="font-extrabold text-orange-900">${fmt(Math.abs(stats.netDW))}</span> today. {stats.netDW >= 0 ? 'Good liquidity.' : 'Monitor cash flow.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-xl border border-gray-200 p-7 hover:shadow-2xl transition-shadow">
              <h3 className="text-xl font-black text-gray-900 mb-5 flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl flex items-center justify-center shadow-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <span className="bg-gradient-to-r from-amber-600 to-yellow-600 bg-clip-text text-transparent">Commission Overview</span>
              </h3>
              {loadingCommissions ? (
                <div className="flex items-center justify-center h-60 text-gray-500 font-medium">Loading...</div>
              ) : (
                <>
                  <BarChart data={commissionSet} height={260} color="amber" />
                  <div className="mt-5 p-5 bg-gradient-to-br from-amber-50 to-yellow-50 rounded-xl border-2 border-amber-200 shadow-sm">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-amber-500 rounded-lg flex items-center justify-center flex-shrink-0 shadow-md">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-1">Available</p>
                        <p className="text-sm text-gray-800 font-semibold leading-relaxed">
                          <span className="font-extrabold text-amber-900">${fmt(stats.commAvail)}</span> of ${fmt(stats.commTotal)} <span className="text-xs">({stats.commAvailPct.toFixed(1)}%)</span> ready to distribute.
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Top IBs */}
          <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-xl border border-gray-200 p-7 mb-6 hover:shadow-2xl transition-shadow">
            <h3 className="text-xl font-black text-gray-900 mb-5 flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <span className="bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">Top IBs by Available Commission</span>
            </h3>
            {loadingCommissions ? (
              <div className="flex items-center justify-center h-60 text-gray-500 font-medium">Loading...</div>
            ) : topIBAvailSet.length > 0 ? (
              <>
                <HorizontalBarChart data={topIBAvailSet} height={Math.min(360, topIBAvailSet.length * 56 + 40)} color="violet" />
                <div className="mt-5 p-5 bg-gradient-to-br from-violet-50 to-purple-50 rounded-xl border-2 border-violet-200 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-violet-500 rounded-lg flex items-center justify-center flex-shrink-0 shadow-md">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-violet-700 uppercase tracking-wider mb-1">Top Performer</p>
                      <p className="text-sm text-gray-800 font-semibold leading-relaxed">
                        <span className="font-extrabold text-violet-900">{topIBAvailSet[0]?.label || 'N/A'}</span> leads with ${fmt(topIBAvailSet[0]?.value || 0)} available commission.
                      </p>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-60 text-gray-500 font-medium">No IB data available</div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

export default GraphicalAnalyticsPage
