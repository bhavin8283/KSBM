import React, { useState, useEffect } from 'react';
import { Layers, Search, CheckSquare, Square, RefreshCw, Check, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { DepartmentFlagSetting } from '../types';

export const DepartmentManagementSettings: React.FC = () => {
  const [departments, setDepartments] = useState<DepartmentFlagSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');

  const fetchDepartmentFlags = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/pos/departments');
      if (res.ok) {
        const data = await res.json();
        if (data.departments && Array.isArray(data.departments)) {
          const list: DepartmentFlagSetting[] = data.departments.map((d: any) => ({
            departmentCode: d.departmentCode,
            departmentName: d.departmentName || d.name || 'General',
            isCore: typeof d.isCore === 'boolean' ? d.isCore : true,
            isGeneral: typeof d.isGeneral === 'boolean' ? d.isGeneral : true,
          }));
          setDepartments(list);
        }
      }
    } catch (err) {
      console.warn('Notice: Error fetching department flags:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartmentFlags();
  }, []);

  const saveFlags = async (updatedList: DepartmentFlagSetting[]) => {
    setSaving(true);
    setSaveSuccess(false);

    const settingsMap: Record<string, DepartmentFlagSetting> = {};
    for (const item of updatedList) {
      settingsMap[item.departmentName] = item;
      if (item.departmentCode) {
        settingsMap[String(item.departmentCode)] = item;
      }
    }

    // Save to localStorage
    try {
      localStorage.setItem('idealpos_department_flags_v1', JSON.stringify(settingsMap));
    } catch (e) {}

    // Save to backend API
    try {
      const res = await fetch('/api/pos/department-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: settingsMap }),
      });
      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err) {
      console.error('Failed to save department settings:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = (deptName: string, field: 'isCore' | 'isGeneral', index?: number) => {
    const updated = departments.map((d, i) => {
      if ((index !== undefined && i === index) || d.departmentName === deptName) {
        return { ...d, [field]: !d[field] };
      }
      return d;
    });
    setDepartments(updated);
    saveFlags(updated);
  };

  const handleSetAll = (field: 'isCore' | 'isGeneral', value: boolean) => {
    const updated = departments.map((d) => ({ ...d, [field]: value }));
    setDepartments(updated);
    saveFlags(updated);
  };

  const filteredDepts = departments.filter((d) =>
    d.departmentName.toLowerCase().includes(searchFilter.toLowerCase().trim()) ||
    String(d.departmentCode || '').includes(searchFilter.trim())
  );

  const activeCount = departments.filter((d) => d.isCore || d.isGeneral).length;
  const hiddenCount = departments.length - activeCount;

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-600" />
            Department Management & Visibility
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Configure <span className="font-semibold text-slate-700">Core</span> and <span className="font-semibold text-slate-700">General</span> availability flags for every department. Departments with neither option selected will be hidden from the Inventory & Items page.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {saveSuccess && (
            <span className="px-3 py-1.5 bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200 rounded-lg flex items-center gap-1.5 animate-fade-in">
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              Settings Saved
            </span>
          )}
          <button
            onClick={fetchDepartmentFlags}
            disabled={loading}
            className="p-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-200"
            title="Refresh departments"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Summary Stats & Quick Actions Toolbar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-blue-700">Total Departments</div>
            <div className="text-xl font-extrabold text-blue-900 mt-0.5">{departments.length}</div>
          </div>
          <Layers className="w-8 h-8 text-blue-400 opacity-60" />
        </div>

        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Visible in Inventory</div>
            <div className="text-xl font-extrabold text-emerald-900 mt-0.5">{activeCount}</div>
          </div>
          <Eye className="w-8 h-8 text-emerald-400 opacity-60" />
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Hidden from Inventory</div>
            <div className="text-xl font-extrabold text-slate-800 mt-0.5">{hiddenCount}</div>
          </div>
          <EyeOff className="w-8 h-8 text-slate-400 opacity-60" />
        </div>
      </div>

      {/* Bulk Controls & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Search departments..."
            className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold w-full sm:w-auto">
          <button
            onClick={() => handleSetAll('isCore', true)}
            className="px-2.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg transition-colors"
          >
            Check All Core
          </button>
          <button
            onClick={() => handleSetAll('isCore', false)}
            className="px-2.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg transition-colors"
          >
            Uncheck All Core
          </button>
          <button
            onClick={() => handleSetAll('isGeneral', true)}
            className="px-2.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg transition-colors"
          >
            Check All General
          </button>
          <button
            onClick={() => handleSetAll('isGeneral', false)}
            className="px-2.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg transition-colors"
          >
            Uncheck All General
          </button>
        </div>
      </div>

      {/* Departments Table */}
      {loading ? (
        <div className="p-8 text-center text-slate-500 text-xs font-medium">
          Loading department management configuration...
        </div>
      ) : filteredDepts.length === 0 ? (
        <div className="p-8 text-center text-slate-500 text-xs font-medium border border-dashed border-slate-200 rounded-xl">
          No departments found matching "{searchFilter}".
        </div>
      ) : (
        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Code</th>
                <th className="py-3 px-4">Department Name</th>
                <th className="py-3 px-4 text-center">Core</th>
                <th className="py-3 px-4 text-center">General</th>
                <th className="py-3 px-4 text-right">Visibility Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white font-medium text-slate-800">
              {filteredDepts.map((dept, index) => {
                const isVisible = dept.isCore || dept.isGeneral;
                return (
                  <tr key={`dept-row-${dept.departmentCode || ''}-${dept.departmentName}-${index}`} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 text-slate-500 font-mono">
                      {dept.departmentCode || '-'}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {dept.departmentName}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggle(dept.departmentName, 'isCore', index)}
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg border text-xs font-bold transition-all ${
                          dept.isCore
                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                            : 'bg-slate-100 text-slate-400 border-slate-200 hover:bg-slate-200'
                        }`}
                      >
                        {dept.isCore ? <Check className="w-3.5 h-3.5" /> : null}
                        <span>Core</span>
                      </button>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggle(dept.departmentName, 'isGeneral', index)}
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg border text-xs font-bold transition-all ${
                          dept.isGeneral
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                            : 'bg-slate-100 text-slate-400 border-slate-200 hover:bg-slate-200'
                        }`}
                      >
                        {dept.isGeneral ? <Check className="w-3.5 h-3.5" /> : null}
                        <span>General</span>
                      </button>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {isVisible ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full font-semibold text-[11px]">
                          <Eye className="w-3 h-3 text-emerald-600" />
                          {dept.isCore && dept.isGeneral
                            ? 'Visible (Core & General)'
                            : dept.isCore
                            ? 'Visible (Core)'
                            : 'Visible (General)'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-500 border border-slate-200 rounded-full font-medium text-[11px]">
                          <EyeOff className="w-3 h-3 text-slate-400" />
                          Hidden from Inventory
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
