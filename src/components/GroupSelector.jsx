import { useState } from 'react'
import { useGroups } from '../contexts/GroupContext'

const GroupSelector = ({ onCreateClick, onEditClick, moduleName }) => {
  const { groups, getActiveGroupFilter, setActiveGroupFilter, deleteGroup } = useGroups()
  const [showDropdown, setShowDropdown] = useState(false)

  const activeGroupFilter = getActiveGroupFilter(moduleName)

  const handleEdit = (group, e) => {
    e.stopPropagation()
    setShowDropdown(false)
    if (onEditClick) {
      console.log('[GroupSelector] Calling onEditClick with group:', group)
      onEditClick(group)
    } else {
      console.warn('[GroupSelector] onEditClick is not defined')
    }
  }

  const handleDelete = (groupName, e) => {
    e.stopPropagation()
    if (confirm(`Delete group "${groupName}"?`)) {
      deleteGroup(groupName)
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-lg hover:bg-white border border-gray-300 transition-colors inline-flex items-center gap-1.5 text-sm"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        Groups
        {groups.length > 0 && (
          <span className="ml-1 px-1.5 py-0.5 bg-blue-600 text-white text-xs rounded-full">
            {groups.length}
          </span>
        )}
        {activeGroupFilter && (
          <span className="ml-1 px-1.5 py-0.5 bg-green-600 text-white text-xs rounded-full">
            Active
          </span>
        )}
      </button>
      
      {showDropdown && (
        <div className="absolute right-0 top-full mt-2 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50 w-64">
          <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-700 uppercase">Login Groups</p>
            <button
              onClick={() => {
                setShowDropdown(false)
                onCreateClick()
              }}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              + New
            </button>
          </div>
          
          {groups.length === 0 ? (
            <div className="px-3 py-4 text-center text-sm text-gray-500">
              No groups created yet
            </div>
          ) : (
            <div className="py-1 max-h-80 overflow-y-auto">
              <button
                onClick={() => {
                  setActiveGroupFilter(moduleName, null)
                  setShowDropdown(false)
                }}
                className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                  activeGroupFilter === null 
                    ? 'bg-blue-50 text-blue-700 font-medium' 
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                All Items
              </button>
              
              {groups.map((group, idx) => (
                <div key={idx} className="flex items-center hover:bg-gray-50">
                  <button
                    onClick={() => {
                      setActiveGroupFilter(moduleName, group.name)
                      setShowDropdown(false)
                    }}
                    className={`flex-1 text-left px-3 py-2 text-sm transition-colors ${
                      activeGroupFilter === group.name 
                        ? 'bg-blue-50 text-blue-700 font-medium' 
                        : 'text-gray-700'
                    }`}
                  >
                    {group.name}
                    {group.range && (
                      <span className="ml-2 text-xs text-gray-500">
                        ({group.range.from}-{group.range.to})
                      </span>
                    )}
                    {!group.range && group.loginIds && (
                      <span className="ml-2 text-xs text-gray-500">
                        ({group.loginIds.length} logins)
                      </span>
                    )}
                  </button>
                  <button
                    onClick={(e) => handleEdit(group, e)}
                    className="px-2 py-2 text-blue-600 hover:text-blue-700"
                    title="Edit group"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => handleDelete(group.name, e)}
                    className="px-2 py-2 text-red-600 hover:text-red-700"
                    title="Delete group"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default GroupSelector
