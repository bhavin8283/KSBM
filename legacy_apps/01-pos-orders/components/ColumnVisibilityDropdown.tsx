import React, { useState, useEffect, useRef } from 'react';
import { SlidersHorizontal, Check, Eye, EyeOff, RotateCcw, X } from 'lucide-react';

export interface ColumnDefinition {
  id: string;
  label: string;
  visible: boolean;
  required?: boolean; // If true, cannot be hidden
}

interface ColumnVisibilityDropdownProps {
  storageKey: string;
  columns: ColumnDefinition[];
  onChange: (columns: ColumnDefinition[]) => void;
  onReset?: () => void;
  className?: string;
  buttonLabel?: string;
}

export function ColumnVisibilityDropdown({
  storageKey,
  columns,
  onChange,
  onReset,
  className = '',
  buttonLabel = 'Columns',
}: ColumnVisibilityDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const visibleCount = columns.filter((c) => c.visible).length;
  const totalCount = columns.length;

  const toggleColumn = (id: string) => {
    const next = columns.map((col) => {
      if (col.id === id) {
        if (col.required) return col;
        return { ...col, visible: !col.visible };
      }
      return col;
    });
    // Ensure at least one column remains visible
    if (next.filter((c) => c.visible).length === 0) {
      return;
    }
    onChange(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next.map((c) => ({ id: c.id, visible: c.visible }))));
    } catch {}
  };

  const showAll = () => {
    const next = columns.map((c) => ({ ...c, visible: true }));
    onChange(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next.map((c) => ({ id: c.id, visible: true }))));
    } catch {}
  };

  const resetDefaults = (defaultCols: ColumnDefinition[]) => {
    try {
      localStorage.removeItem(storageKey);
    } catch {}
    if (onReset) {
      onReset();
    } else {
      onChange(defaultCols);
    }
  };

  const filteredColumns = columns.filter((c) =>
    c.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      <button
        type="button"
        id={`col-vis-btn-${storageKey}`}
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:border-slate-400 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-all shadow-2xs"
        title="Customize visible table columns"
      >
        <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
        <span>{buttonLabel}</span>
        <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600 font-mono text-[10px] font-extrabold border border-slate-200">
          {visibleCount}/{totalCount}
        </span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1.5 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 z-50 p-3 space-y-2 animate-fade-in">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-blue-600" />
              <span className="text-xs font-extrabold text-slate-900">Show / Hide Columns</span>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {totalCount > 6 && (
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search columns..."
              className="w-full px-2.5 py-1 text-xs border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-blue-500"
            />
          )}

          <div className="max-h-56 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
            {filteredColumns.map((col) => {
              const isChecked = col.visible;
              return (
                <label
                  key={col.id}
                  className={`flex items-center justify-between px-2 py-1.5 rounded-lg text-xs cursor-pointer transition-colors select-none ${
                    isChecked ? 'bg-blue-50/60 text-slate-900 font-semibold' : 'text-slate-500 hover:bg-slate-50'
                  } ${col.required ? 'opacity-75 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-center gap-2 truncate pr-2">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={col.required}
                      onChange={() => toggleColumn(col.id)}
                      className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
                    />
                    <span className="truncate">{col.label}</span>
                  </div>
                  {col.required ? (
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Fixed</span>
                  ) : isChecked ? (
                    <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  ) : (
                    <EyeOff className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                  )}
                </label>
              );
            })}
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <button
              type="button"
              onClick={showAll}
              className="text-blue-600 hover:text-blue-800 font-bold hover:underline"
            >
              Show All
            </button>
            <button
              type="button"
              onClick={() => resetDefaults(columns)}
              className="text-slate-500 hover:text-slate-700 flex items-center gap-1 font-semibold"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Helper hook to initialize and sync column visibility with localStorage
 */
export function usePersistentColumns<T extends string>(
  storageKey: string,
  defaultColumns: Array<{ id: T; label: string; visible: boolean; required?: boolean }>
) {
  const [columns, setColumns] = useState<Array<{ id: T; label: string; visible: boolean; required?: boolean }>>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed: Array<{ id: string; visible: boolean }> = JSON.parse(saved);
        const map = new Map(parsed.map((p) => [p.id, p.visible]));
        return defaultColumns.map((col) => ({
          ...col,
          visible: col.required ? true : map.has(col.id) ? Boolean(map.get(col.id)) : col.visible,
        }));
      }
    } catch {}
    return defaultColumns;
  });

  const isVisible = (colId: T | string): boolean => {
    const col = columns.find((c) => c.id === colId);
    return col ? col.visible : true;
  };

  return {
    columns: columns as ColumnDefinition[],
    setColumns: (cols: ColumnDefinition[]) => setColumns(cols as any),
    isVisible,
  };
}
