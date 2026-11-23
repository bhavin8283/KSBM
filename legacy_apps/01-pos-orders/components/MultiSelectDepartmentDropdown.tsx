import React, { useState, useRef, useEffect } from 'react';
import { Layers, ChevronDown, Check, X, Search } from 'lucide-react';

interface MultiSelectDepartmentDropdownProps {
  departments: string[];
  selectedDepartments: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  className?: string;
  align?: 'left' | 'right';
}

export const MultiSelectDepartmentDropdown: React.FC<MultiSelectDepartmentDropdownProps> = ({
  departments,
  selectedDepartments,
  onChange,
  placeholder = 'All Departments',
  className = '',
  align = 'left',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const uniqueDepts: string[] = Array.from(new Set(departments.map((d) => String(d)))).filter((d): d is string => Boolean(d));

  const filteredDepts = uniqueDepts.filter((d) =>
    d.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const selectAll = () => {
    onChange([]);
  };

  const selectNone = () => {
    onChange(['__NONE__']);
  };

  const toggleDepartment = (dept: string) => {
    const isNone = selectedDepartments.length === 1 && selectedDepartments[0] === '__NONE__';
    const isAll = selectedDepartments.length === 0 || selectedDepartments.length === departments.length;

    if (isAll || isNone) {
      onChange([dept]);
    } else {
      if (selectedDepartments.includes(dept)) {
        const next = selectedDepartments.filter((d) => d !== dept);
        if (next.length === 0) {
          onChange(['__NONE__']);
        } else {
          onChange(next);
        }
      } else {
        onChange([...selectedDepartments, dept]);
      }
    }
  };

  const getButtonText = () => {
    if (selectedDepartments.length === 1 && selectedDepartments[0] === '__NONE__') {
      return 'No Depts Selected';
    }
    if (selectedDepartments.length === 0 || selectedDepartments.length === departments.length) {
      return placeholder;
    }
    if (selectedDepartments.length === 1) {
      return selectedDepartments[0];
    }
    return `${selectedDepartments.length} Depts Selected`;
  };

  return (
    <div className={`relative inline-block text-left ${className}`} ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-2 py-2 px-3 bg-white border border-slate-300 hover:border-slate-400 rounded-lg text-xs font-medium text-slate-800 shadow-xs focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer"
      >
        <div className="flex items-center gap-1.5 truncate">
          <Layers className="w-3.5 h-3.5 text-blue-600 shrink-0" />
          <span className="truncate">{getButtonText()}</span>
          {selectedDepartments.length > 0 && selectedDepartments.length < departments.length && (
            <span className="ml-1 px-1.5 py-0.2 bg-blue-100 text-blue-800 font-bold rounded-full text-[10px]">
              {selectedDepartments.length}
            </span>
          )}
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Popover Menu */}
      {isOpen && (
        <div
          className={`absolute ${
            align === 'right' ? 'right-0' : 'left-0'
          } mt-1 w-64 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-2 text-xs space-y-2`}
        >
          {/* Header & Quick Action */}
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 px-1">
            <span className="font-bold text-slate-700">Select Departments</span>
            <div className="flex items-center gap-1.5 text-[11px]">
              <button
                type="button"
                onClick={selectAll}
                className="font-semibold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
              >
                Select All
              </button>
              <span className="text-slate-300">|</span>
              <button
                type="button"
                onClick={selectNone}
                className="font-semibold text-slate-500 hover:text-slate-700 hover:underline cursor-pointer"
              >
                Select None
              </button>
            </div>
          </div>

          {/* Search Box for Departments */}
          {departments.length > 5 && (
            <div className="relative px-1">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Filter departments..."
                className="w-full pl-7 pr-6 py-1 bg-slate-50 border border-slate-200 rounded-md text-[11px] text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              {searchFilter && (
                <button
                  onClick={() => setSearchFilter('')}
                  className="absolute right-2.5 top-1.5 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          )}

          {/* "All Departments" Option */}
          <div
            onClick={() => onChange([])}
            className={`flex items-center justify-between px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
              selectedDepartments.length === 0
                ? 'bg-blue-50 text-blue-900 font-semibold'
                : 'hover:bg-slate-50 text-slate-700 font-medium'
            }`}
          >
            <span className="truncate">All Departments ({departments.length})</span>
            {selectedDepartments.length === 0 && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
          </div>

          {/* Department List Options */}
          <div className="max-h-52 overflow-y-auto space-y-0.5 divide-y divide-slate-50 border-t border-slate-100 pt-1">
            {filteredDepts.length === 0 ? (
              <div className="p-2 text-center text-slate-400 text-[11px]">No departments found</div>
            ) : (
              filteredDepts.map((dept, index) => {
                const isNone = selectedDepartments.length === 1 && selectedDepartments[0] === '__NONE__';
                const isChecked = !isNone && (selectedDepartments.length === 0 || selectedDepartments.includes(dept));

                return (
                  <div
                    key={`ms-dept-${dept}-${index}`}
                    onClick={() => toggleDepartment(dept)}
                    className="flex items-center justify-between px-2 py-1.5 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors group"
                  >
                    <div className="flex items-center gap-2 truncate pr-2">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}} // handled by parent div onClick
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer pointer-events-none"
                      />
                      <span className={`truncate text-slate-800 ${isChecked ? 'font-semibold' : 'font-normal'}`}>
                        {dept}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Action */}
          <div className="pt-1 border-t border-slate-100 flex items-center justify-between px-1 text-[11px] text-slate-500">
            <span>
              {selectedDepartments.length === 0
                ? 'Showing all'
                : `${selectedDepartments.length} of ${departments.length} selected`}
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 font-semibold text-slate-700 rounded transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
