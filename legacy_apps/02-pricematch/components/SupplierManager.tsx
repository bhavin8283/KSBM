import React, { useState } from 'react';
import { SupplierConfig } from '../types';
import { useTheme } from '../theme';
import { SupplierModal } from './SupplierModal';
import { SupplierTestConsole } from './SupplierTestConsole';
import {
  Building2,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  XCircle,
  Globe,
  Lock,
  ExternalLink,
  Search,
  ChevronDown,
  ChevronUp,
  FlaskConical,
} from 'lucide-react';

interface SupplierManagerProps {
  suppliers: SupplierConfig[];
  onUpdateSupplier: (supplier: SupplierConfig) => void;
  onAddSupplier: (supplier: SupplierConfig) => void;
  onDeleteSupplier: (supplierId: string) => void;
  onResetDefaultSuppliers: () => void;
  canManageSuppliers?: boolean;
}

export const SupplierManager: React.FC<SupplierManagerProps> = ({
  suppliers,
  onUpdateSupplier,
  onAddSupplier,
  onDeleteSupplier,
  onResetDefaultSuppliers,
  canManageSuppliers = true,
}) => {
  const { currentTheme } = useTheme();

  const [activeTestSupplierId, setActiveTestSupplierId] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<'add' | 'edit' | null>(null);
  const [selectedSupplierForEdit, setSelectedSupplierForEdit] = useState<SupplierConfig | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [expandedDetailsId, setExpandedDetailsId] = useState<string | null>(null);

  const filteredSuppliers = suppliers.filter((s) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      s.codePrefix.toLowerCase().includes(q) ||
      s.loginUrl.toLowerCase().includes(q)
    );
  });

  const handleOpenAddModal = () => {
    if (!canManageSuppliers) return;
    setSelectedSupplierForEdit(null);
    setModalMode('add');
  };

  const handleOpenEditModal = (supplier: SupplierConfig) => {
    if (!canManageSuppliers) return;
    setSelectedSupplierForEdit(supplier);
    setModalMode('edit');
  };

  const handleToggleTestConsole = (supplierId: string) => {
    setActiveTestSupplierId((prev) => (prev === supplierId ? null : supplierId));
  };

  const handleUpdateTestResult = (
    supplierId: string,
    testResult: SupplierConfig['lastTestResult']
  ) => {
    const target = suppliers.find((s) => s.id === supplierId);
    if (target) {
      onUpdateSupplier({
        ...target,
        lastTestResult: testResult,
      });
    }
  };

  return (
    <div className="rounded-xl border border-slate-200/80 bg-white shadow-xs" id="supplier-manager-settings-hub">
      <div className="flex flex-wrap items-center justify-between border-b border-slate-200 p-5 bg-slate-50/70 gap-3">
        <div className="flex items-center space-x-2.5">
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-lg ${currentTheme.classes.iconBg} ${currentTheme.classes.iconText} shadow-2xs`}
          >
            <Building2 className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">4. Supplier Manager &amp; Testing Hub</h3>
              <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-bold text-white">
                {suppliers.length} Configured
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Manage wholesale suppliers (Trax, Campbells, One Distribution) or add custom distributors with DOM
              selectors &amp; live connection testing.
            </p>
          </div>
        </div>

        {canManageSuppliers && (
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onResetDefaultSuppliers}
              className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 underline mr-1 cursor-pointer"
              title="Reset to 3 core pre-populated default suppliers"
            >
              Reset Default 3 Suppliers
            </button>
            <button
              type="button"
              id="add-new-supplier-btn"
              onClick={handleOpenAddModal}
              className={`inline-flex items-center space-x-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold shadow-2xs transition cursor-pointer ${currentTheme.classes.primaryBtn}`}
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add New Supplier</span>
            </button>
          </div>
        )}
      </div>

      <div className="p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
              <Search className="h-3.5 w-3.5" />
            </div>
            <input
              type="text"
              placeholder="Search suppliers by name, prefix, or portal URL..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:border-slate-900"
            />
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              {suppliers.filter((s) => s.status === 'active').length} Active
            </span>
            <span>&bull;</span>
            <span className="inline-flex items-center gap-1">
              <FlaskConical className="h-3 w-3 text-purple-600" />
              Live Simulation Ready
            </span>
          </div>
        </div>

        <div className="space-y-3.5">
          {filteredSuppliers.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-8 text-center">
              <Building2 className="h-8 w-8 mx-auto text-slate-400 mb-2" />
              <p className="text-xs text-slate-500">No suppliers match &quot;{searchFilter}&quot;.</p>
            </div>
          ) : (
            filteredSuppliers.map((supplier) => {
              const isTestingOpen = activeTestSupplierId === supplier.id;
              const isExpanded = expandedDetailsId === supplier.id;

              return (
                <div
                  key={supplier.id}
                  className={`rounded-xl border transition-all ${
                    isTestingOpen
                      ? 'border-slate-900 ring-2 ring-slate-900/10 bg-slate-50/40 shadow-sm'
                      : 'border-slate-200 bg-white hover:border-slate-300 shadow-2xs'
                  }`}
                >
                  <div className="p-4 sm:p-5">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${currentTheme.classes.brandBadge}`}
                          >
                            {supplier.codePrefix}
                          </span>
                          <h4 className="text-sm font-bold text-slate-900 truncate">{supplier.name}</h4>
                          <span
                            className={`rounded-full px-2 py-0.2 text-[10px] font-semibold border ${
                              supplier.status === 'active'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                          >
                            {supplier.status.toUpperCase()}
                          </span>
                          <span className="rounded bg-slate-100 px-1.5 py-0.2 text-[10px] font-mono text-slate-600 border border-slate-200">
                            {supplier.engine}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-500">
                          <span className="flex items-center gap-1 font-mono text-[11px] truncate max-w-xs">
                            <Globe className="h-3 w-3 text-slate-400 shrink-0" />
                            <a
                              href={supplier.portalUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="hover:text-slate-900 hover:underline truncate"
                            >
                              {supplier.portalUrl}
                            </a>
                            <ExternalLink className="h-2.5 w-2.5 text-slate-400 shrink-0" />
                          </span>

                          <span className="flex items-center gap-1 font-mono text-[11px]">
                            <Lock className="h-3 w-3 text-slate-400 shrink-0" />
                            Vault:{' '}
                            <code className="text-slate-700 font-semibold">
                              ${`{${supplier.credentials.usernameEnvKey}}`}
                            </code>
                          </span>

                          {supplier.specialHandling.ageGateBypass && (
                            <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.2 text-[10px] font-semibold text-amber-800 border border-amber-200">
                              Age-Gate Bypass Active
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                        {supplier.lastTestResult && (
                          <div className="hidden sm:flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs">
                            {supplier.lastTestResult.status === 'success' ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                            ) : (
                              <XCircle className="h-4 w-4 text-rose-600 shrink-0" />
                            )}
                            <div className="text-left leading-tight">
                              <div className="text-[11px] font-bold text-slate-800">
                                {supplier.lastTestResult.itemsExtracted} Items Extracted
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {supplier.lastTestResult.latencyMs}ms &bull; {supplier.lastTestResult.timestamp}
                              </div>
                            </div>
                          </div>
                        )}

                        <button
                          type="button"
                          id={`test-scraper-btn-${supplier.id}`}
                          onClick={() => handleToggleTestConsole(supplier.id)}
                          className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold transition shadow-xs cursor-pointer ${
                            isTestingOpen
                              ? 'bg-slate-900 text-white'
                              : 'bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100/80'
                          }`}
                          title="Open live interactive scraper connection and extraction tester"
                        >
                          <FlaskConical className="h-3.5 w-3.5 text-emerald-600" />
                          <span>{isTestingOpen ? 'Hide Console' : 'Test Scraper & Connection'}</span>
                        </button>

                        {canManageSuppliers && (
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(supplier)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition shadow-2xs cursor-pointer"
                            title="Configure credentials and selectors"
                          >
                            <Pencil className="h-3 w-3 text-slate-500" />
                            <span>Configure</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => setExpandedDetailsId(isExpanded ? null : supplier.id)}
                          className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                          title="Expand selector breakdown"
                        >
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>

                        {canManageSuppliers && suppliers.length > 3 && (
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Remove supplier "${supplier.name}" from configuration?`)) {
                                onDeleteSupplier(supplier.id);
                              }
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                            title="Delete custom supplier"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-4 pt-3.5 border-t border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs bg-slate-50/60 p-3 rounded-lg animate-in fade-in duration-150">
                        <div>
                          <span className="text-[11px] font-semibold text-slate-500 block mb-0.5">Card Selector:</span>
                          <code className="font-mono text-[11px] bg-white px-2 py-1 rounded border border-slate-200 text-slate-800 block truncate">
                            {supplier.selectors.cardSelector}
                          </code>
                        </div>
                        <div>
                          <span className="text-[11px] font-semibold text-slate-500 block mb-0.5">Price Selector:</span>
                          <code className="font-mono text-[11px] bg-white px-2 py-1 rounded border border-slate-200 text-slate-800 block truncate">
                            {supplier.selectors.priceSelector}
                          </code>
                        </div>
                        <div>
                          <span className="text-[11px] font-semibold text-slate-500 block mb-0.5">SKU Selector:</span>
                          <code className="font-mono text-[11px] bg-white px-2 py-1 rounded border border-slate-200 text-slate-800 block truncate">
                            {supplier.selectors.skuSelector}
                          </code>
                        </div>
                      </div>
                    )}

                    {isTestingOpen && (
                      <SupplierTestConsole
                        supplier={supplier}
                        isOpen={isTestingOpen}
                        onClose={() => setActiveTestSupplierId(null)}
                        onUpdateTestResult={handleUpdateTestResult}
                      />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {modalMode && (
        <SupplierModal
          isOpen={Boolean(modalMode)}
          onClose={() => {
            setModalMode(null);
            setSelectedSupplierForEdit(null);
          }}
          onSave={(savedSupplier) => {
            if (modalMode === 'add') {
              onAddSupplier(savedSupplier);
            } else {
              onUpdateSupplier(savedSupplier);
            }
          }}
          initialSupplier={selectedSupplierForEdit}
          mode={modalMode}
        />
      )}
    </div>
  );
};
