import { memo } from 'react'

const MiniDataTable = memo(({ 
  title, 
  headers, 
  rows, 
  onViewAll,
  loading = false,
  emptyMessage = 'No data available'
}) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        {onViewAll && (
          <button
            onClick={onViewAll}
            className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1 hover:gap-2 transition-all"
          >
            <span>View All</span>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
      </div>
      
      <div className="overflow-x-auto">
        {loading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        ) : rows && rows.length > 0 ? (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {headers.map((header, i) => (
                  <th key={i} className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row, i) => (
                <tr key={i} className="hover:bg-gray-50 transition-colors">
                  {row.map((cell, j) => (
                    <td key={j} className="px-4 py-3 text-sm text-gray-900">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-8 text-center text-sm text-gray-500">
            {emptyMessage}
          </div>
        )}
      </div>
    </div>
  )
})

MiniDataTable.displayName = 'MiniDataTable'

export default MiniDataTable
