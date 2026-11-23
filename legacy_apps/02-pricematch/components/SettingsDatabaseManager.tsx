import React, { useState } from 'react';
import { ProductItem, MarkupTiers, SupplierConfig } from '../types';
import { getBrand, getCategory } from '../utils/pricing';
import { useTheme } from '../theme';
import { ProductFormModal } from './ProductFormModal';
import { SupplierManager } from './SupplierManager';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import {
  Save,
  Plus,
  RotateCcw,
  Sliders,
  Database,
  Trash2,
  CheckCircle2,
  HelpCircle,
  Tag,
  Palette,
  Check,
  Pencil,
  Tags,
  AlertCircle,
  Search,
  X,
  Barcode,
  Camera,
  RefreshCw,
  Eye,
  EyeOff,
  ShieldAlert,
} from 'lucide-react';

interface SettingsDatabaseManagerProps {
  products: ProductItem[];
  markupTiers: MarkupTiers;
  registeredBrands?: string[];
  suppliers: SupplierConfig[];
  onUpdateMarkupTiers: (tiers: MarkupTiers) => void;
  onSaveProducts: (updatedProducts: ProductItem[]) => void;
  onResetDefaults: () => void;
  onAddBrand?: (brand: string) => void;
  onRenameBrand?: (oldBrand: string, newBrand: string) => void;
  onDeleteBrand?: (brand: string) => void;
  onUpdateSupplier: (supplier: SupplierConfig) => void;
  onAddSupplier: (supplier: SupplierConfig) => void;
  onDeleteSupplier: (supplierId: string) => void;
  onResetDefaultSuppliers: () => void;
  lastScrapedTime?: string;
  onOpenManualScrape?: () => void;
  hiddenBrands?: string[];
  onToggleHideBrand?: (brand: string) => void;
  canEditMarkups?: boolean;
  canManageBrands?: boolean;
  canManageSuppliers?: boolean;
  canEditCatalog?: boolean;
  canDeleteCatalog?: boolean;
  canScrape?: boolean;
  currencySymbol?: string;
}

export const SettingsDatabaseManager: React.FC<SettingsDatabaseManagerProps> = ({
  products,
  markupTiers,
  registeredBrands = [],
  suppliers,
  onUpdateMarkupTiers,
  onSaveProducts,
  onResetDefaults,
  onAddBrand,
  onRenameBrand,
  onDeleteBrand,
  onUpdateSupplier,
  onAddSupplier,
  onDeleteSupplier,
  onResetDefaultSuppliers,
  lastScrapedTime,
  onOpenManualScrape,
  hiddenBrands = [],
  onToggleHideBrand,
  canEditMarkups = true,
  canManageBrands = true,
  canManageSuppliers = true,
  canEditCatalog = true,
  canDeleteCatalog = true,
  canScrape = true,
  currencySymbol = '$',
}) => {
  const { currentTheme, themeId, setThemeId, availableThemes } = useTheme();
  const [draftProducts, setDraftProducts] = useState<ProductItem[]>(products);
  const [draftTiers, setDraftTiers] = useState<MarkupTiers>(markupTiers);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isCatalogScannerOpen, setIsCatalogScannerOpen] = useState(false);

  // Brand Management state
  const [editingBrandKey, setEditingBrandKey] = useState<string | null>(null);
  const [editingBrandValue, setEditingBrandValue] = useState<string>('');
  const [newBrandInput, setNewBrandInput] = useState<string>('');
  const [brandSearchFilter, setBrandSearchFilter] = useState<string>('');
  const [brandFeedback, setBrandFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const brandStats = React.useMemo(() => {
    const map = new Map<string, number>();
    draftProducts.forEach((p) => {
      const b = p.brand && p.brand.trim() ? p.brand.trim().toUpperCase() : getBrand(p.product_name);
      if (b && b !== 'UNKNOWN') {
        map.set(b, (map.get(b) || 0) + 1);
      }
    });
    if (registeredBrands && Array.isArray(registeredBrands)) {
      registeredBrands.forEach((b) => {
        const trimmed = (b || '').trim().toUpperCase();
        if (trimmed && trimmed !== 'UNKNOWN' && !map.has(trimmed)) {
          map.set(trimmed, 0);
        }
      });
    }
    return Array.from(map.entries())
      .map(([brand, count]) => ({ brand, count }))
      .sort((a, b) => a.brand.localeCompare(b.brand));
  }, [draftProducts, registeredBrands]);

  const [brandVisibilityTab, setBrandVisibilityTab] = useState<'all' | 'active' | 'hidden'>('all');

  const filteredBrandStats = React.useMemo(() => {
    let list = brandStats;
    if (brandVisibilityTab === 'active') {
      list = list.filter((b) => !hiddenBrands.includes(b.brand));
    } else if (brandVisibilityTab === 'hidden') {
      list = list.filter((b) => hiddenBrands.includes(b.brand));
    }
    if (!brandSearchFilter.trim()) return list;
    const q = brandSearchFilter.trim().toUpperCase();
    return list.filter((b) => b.brand.includes(q));
  }, [brandStats, brandSearchFilter, brandVisibilityTab, hiddenBrands]);

  const handleStartEditBrand = (brand: string) => {
    if (!canManageBrands) return;
    setEditingBrandKey(brand);
    setEditingBrandValue(brand);
    setBrandFeedback(null);
  };

  const handleCancelEditBrand = () => {
    setEditingBrandKey(null);
    setEditingBrandValue('');
  };

  const handleSaveEditBrand = (oldBrand: string) => {
    if (!canManageBrands) return;
    const oldB = oldBrand.trim().toUpperCase();
    const newB = editingBrandValue.trim().toUpperCase();

    if (!newB) {
      setBrandFeedback({ type: 'error', message: 'Brand name cannot be empty.' });
      return;
    }

    if (oldB === newB) {
      setEditingBrandKey(null);
      return;
    }

    let affectedCount = 0;
    const updated = draftProducts.map((p) => {
      const currentBrand = p.brand && p.brand.trim() ? p.brand.trim().toUpperCase() : getBrand(p.product_name);
      if (currentBrand === oldB) {
        affectedCount++;
        return {
          ...p,
          brand: newB,
        };
      }
      return p;
    });

    setDraftProducts(updated);
    onSaveProducts(updated);

    if (onRenameBrand) {
      onRenameBrand(oldB, newB);
    }

    setBrandFeedback({
      type: 'success',
      message: `Renamed "${oldB}" to "${newB}"! Refactored across ${affectedCount} product${affectedCount === 1 ? '' : 's'} in your catalog.`,
    });
    setEditingBrandKey(null);
    setEditingBrandValue('');
    setTimeout(() => {
      setBrandFeedback(null);
    }, 6000);
  };

  const handleAddNewBrandSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!canManageBrands) return;
    const trimmed = newBrandInput.trim().toUpperCase();
    if (!trimmed) {
      setBrandFeedback({ type: 'error', message: 'Please enter a brand name to add.' });
      return;
    }

    if (brandStats.some((b) => b.brand === trimmed)) {
      setBrandFeedback({ type: 'error', message: `Brand "${trimmed}" is already registered in the system.` });
      return;
    }

    if (onAddBrand) {
      onAddBrand(trimmed);
    }

    setBrandFeedback({
      type: 'success',
      message: `Brand "${trimmed}" successfully added! When you add or edit an item, it will now appear in the brand dropdown list.`,
    });
    setNewBrandInput('');
    setTimeout(() => {
      setBrandFeedback(null);
    }, 6000);
  };

  const handleDeleteEmptyBrand = (brand: string) => {
    if (!canManageBrands) return;
    if (onDeleteBrand) {
      onDeleteBrand(brand);
    }
    setBrandFeedback({
      type: 'success',
      message: `Removed "${brand}" from registered brands list.`,
    });
    setTimeout(() => {
      setBrandFeedback(null);
    }, 4000);
  };

  React.useEffect(() => {
    setDraftProducts(products);
  }, [products]);

  React.useEffect(() => {
    setDraftTiers(markupTiers);
  }, [markupTiers]);

  const handleInStoreToggle = (id: string, current: boolean) => {
    if (!canEditCatalog) return;
    const updated = draftProducts.map((p) => (p.id === id ? { ...p, in_store: !current } : p));
    setDraftProducts(updated);
    onSaveProducts(updated);
  };

  const handleDeleteItem = (id: string, name: string) => {
    if (!canDeleteCatalog) return;
    if (confirm(`Remove "${name}" from master database catalog?`)) {
      const updated = draftProducts.filter((p) => p.id !== id);
      setDraftProducts(updated);
      onSaveProducts(updated);
      setSaveSuccessMessage(`Removed "${name}" from catalog.`);
      setTimeout(() => setSaveSuccessMessage(null), 3000);
    }
  };

  const handleCommitSave = () => {
    if (canEditMarkups) {
      onUpdateMarkupTiers(draftTiers);
    }
    if (canEditCatalog) {
      onSaveProducts(draftProducts);
    }
    setSaveSuccessMessage('Master catalog & markup tier settings saved successfully!');
    setTimeout(() => {
      setSaveSuccessMessage(null);
    }, 4000);
  };

  const handleSaveFromModal = (productData: Omit<ProductItem, 'id'>, id?: string) => {
    if (!canEditCatalog) return;
    if (id) {
      const updated = draftProducts.map((p) => (p.id === id ? { ...p, ...productData, id } : p));
      setDraftProducts(updated);
      onSaveProducts(updated);
      setSaveSuccessMessage(`Successfully updated "${productData.product_name}" in database!`);
    } else {
      const newItem: ProductItem = {
        ...productData,
        id: `prod-${Date.now()}`,
      };
      const updated = [...draftProducts, newItem];
      setDraftProducts(updated);
      onSaveProducts(updated);
      setSaveSuccessMessage(`Successfully added "${productData.product_name}" to master catalog!`);
    }
    setTimeout(() => {
      setSaveSuccessMessage(null);
    }, 4000);
  };

  const [includeHiddenInCatalogTable, setIncludeHiddenInCatalogTable] = useState(false);

  const hiddenProductsCount = React.useMemo(() => {
    return draftProducts.filter((p) => {
      const brand = p.brand && p.brand.trim() ? p.brand.trim().toUpperCase() : getBrand(p.product_name);
      return hiddenBrands.includes(brand);
    }).length;
  }, [draftProducts, hiddenBrands]);

  const filteredDraft = draftProducts.filter((p) => {
    const brand = p.brand && p.brand.trim() ? p.brand.trim().toUpperCase() : getBrand(p.product_name);
    if (!includeHiddenInCatalogTable && hiddenBrands.includes(brand)) {
      return false;
    }
    return (
      p.product_name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      p.gtin.toLowerCase().includes(searchFilter.toLowerCase()) ||
      p.retail_code.toLowerCase().includes(searchFilter.toLowerCase()) ||
      brand.toLowerCase().includes(searchFilter.toLowerCase())
    );
  });

  const canSaveAnything = canEditMarkups || canEditCatalog;

  return (
    <div className="space-y-8" id="settings-database-manager">
      {/* Header Banner */}
      <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center space-x-2">
                <Database className="h-5 w-5 text-slate-900" />
                <h2 className="text-xl font-bold text-slate-900">Settings &amp; Database Manager</h2>
              </div>

              {lastScrapedTime && (
                <div
                  id="settings-last-scraped-badge"
                  className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-800 shadow-2xs"
                  title="Timestamp of the most recent wholesale scraper price synchronization"
                >
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600"></span>
                  </span>
                  <span className="text-emerald-700">Last Scrape:</span>
                  <span className="font-bold text-emerald-950 font-mono">{lastScrapedTime}</span>
                </div>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Configure wholesale retail markup percentages, toggle store inventory visibility, and inline-edit master product records.
            </p>
          </div>

          <div className="flex items-center flex-wrap gap-2.5">
            {canScrape && onOpenManualScrape && (
              <button
                type="button"
                id="settings-scrape-latest-prices-btn"
                onClick={onOpenManualScrape}
                className="flex items-center space-x-1.5 rounded-lg border border-emerald-600 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 px-3.5 py-2 text-xs font-bold transition shadow-2xs cursor-pointer"
                title="Trigger manual scraper to pull latest supplier portal prices"
              >
                <RefreshCw className="h-3.5 w-3.5 text-emerald-600" />
                <span>Scrape Latest Prices</span>
              </button>
            )}

            {canSaveAnything && (
              <button
                id="settings-save-changes-top-btn"
                onClick={handleCommitSave}
                className="flex items-center space-x-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-2xs hover:bg-slate-800 transition cursor-pointer"
              >
                <Save className="h-4 w-4" />
                <span>Save Changes</span>
              </button>
            )}

            {canEditCatalog && canDeleteCatalog && (
              <button
                onClick={onResetDefaults}
                className="flex items-center space-x-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                title="Reset catalog and markups to original sample defaults"
              >
                <RotateCcw className="h-4 w-4 text-slate-500" />
                <span className="hidden sm:inline">Reset Defaults</span>
              </button>
            )}
          </div>
        </div>

        {saveSuccessMessage && (
          <div className="mt-4 flex items-center space-x-2 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs font-semibold text-emerald-800">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{saveSuccessMessage}</span>
          </div>
        )}
      </div>

      {/* SECTION 1: UI APPEARANCE & COLOR THEME */}
      <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-xs" id="ui-theme-settings-panel">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
          <div className="flex items-center space-x-2.5">
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${currentTheme.classes.iconBg} ${currentTheme.classes.iconText}`}>
              <Palette className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">1. UI Appearance &amp; Color Theme</h3>
              <p className="text-xs text-slate-500">
                Select your preferred visual theme for the dashboard, badges, and buttons. Changes persist automatically.
              </p>
            </div>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs">
            <span className="text-slate-500">Current Theme:</span>
            <span className="font-bold text-slate-900">{currentTheme.name}</span>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {availableThemes.map((theme) => {
            const isSelected = themeId === theme.id;
            return (
              <button
                key={theme.id}
                type="button"
                id={`theme-btn-${theme.id}`}
                onClick={() => setThemeId(theme.id)}
                className={`relative flex flex-col justify-between rounded-xl border p-4 text-left transition-all cursor-pointer ${
                  isSelected
                    ? 'border-slate-900 ring-2 ring-slate-900/20 bg-slate-50/70 shadow-xs'
                    : 'border-slate-200 hover:border-slate-400 bg-white hover:bg-slate-50/40'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-1.5">
                      <span
                        className="h-5 w-5 rounded-full border border-black/10 shadow-2xs"
                        style={{ backgroundColor: theme.swatches.primary }}
                        title="Primary Color"
                      />
                      <span
                        className="h-4 w-4 rounded-full border border-black/10"
                        style={{ backgroundColor: theme.swatches.accent }}
                        title="Accent Color"
                      />
                      <span
                        className="h-4 w-4 rounded-full border border-slate-300"
                        style={{ backgroundColor: theme.swatches.bg }}
                        title="Tone Base"
                      />
                    </div>
                    {isSelected ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-bold text-white">
                        <Check className="h-3 w-3" /> Active
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold text-slate-400 hover:text-slate-700">Select</span>
                    )}
                  </div>

                  <h4 className="text-xs font-bold text-slate-900">{theme.name}</h4>
                  <p className="mt-1 text-[11px] text-slate-500 line-clamp-2 leading-relaxed">{theme.tagline}</p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[10px]">
                  <span className="text-slate-400 font-medium">Badge Preview:</span>
                  <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${theme.classes.brandBadge}`}>
                    WINFIELD
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* SECTION 2: RETAIL SELL PRICE CALCULATOR (MARKUP TIERS) */}
      <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
          <div className="flex items-center space-x-2">
            <Sliders className="h-5 w-5 text-slate-900" />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">2. Retail Sell Price Calculator (Markup Tiers)</h3>
                {!canEditMarkups && (
                  <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 border border-slate-200">
                    <ShieldAlert className="h-3 w-3" /> Read-Only
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                These percentages dynamically calculate the retail reference numbers based on the highest supplier wholesale cost.
              </p>
            </div>
          </div>
          <div className="rounded-md bg-slate-100 px-2.5 py-1 text-[11px] font-mono text-slate-600 border border-slate-200/60">
            Formula: Retail = Highest Cost × (1 + Markup %)
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3">
          {/* Tier 1 */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-900">Tier 1 Markup Range</span>
                  <p className="text-[11px] text-slate-500">Primary POS default margin</p>
                </div>
                <span className="font-mono text-lg font-bold text-slate-900">+{draftTiers.tier1}%</span>
              </div>

              <div className="mt-4 space-y-3">
                <input
                  type="range"
                  min="1"
                  max="40"
                  step="0.5"
                  disabled={!canEditMarkups}
                  value={draftTiers.tier1}
                  onChange={(e) => setDraftTiers({ ...draftTiers, tier1: parseFloat(e.target.value) || 0 })}
                  className="w-full accent-slate-900 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Manual input:</span>
                  <div className="flex items-center gap-1 font-mono">
                    <input
                      type="number"
                      step="0.5"
                      min="1"
                      max="100"
                      disabled={!canEditMarkups}
                      value={draftTiers.tier1}
                      onChange={(e) => setDraftTiers({ ...draftTiers, tier1: parseFloat(e.target.value) || 0 })}
                      className="w-16 rounded border border-slate-300 bg-white px-2 py-1 text-right text-xs font-bold text-slate-900 focus:outline-hidden focus:border-slate-900 disabled:bg-slate-100 disabled:text-slate-500"
                    />
                    <span className="text-slate-500">%</span>
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-slate-200/80">
                <label className={`flex items-center justify-between select-none ${canEditMarkups ? 'cursor-pointer' : 'cursor-not-allowed opacity-70'}`}>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="tier1-round-checkbox"
                      disabled={!canEditMarkups}
                      checked={!!draftTiers.round_tier1}
                      onChange={(e) => setDraftTiers({ ...draftTiers, round_tier1: e.target.checked })}
                      className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 accent-slate-900 cursor-pointer"
                    />
                    <span className="text-xs font-semibold text-slate-800">Round figure</span>
                  </div>
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold ${draftTiers.round_tier1 ? 'bg-indigo-100 text-indigo-800 border border-indigo-200' : 'text-slate-400 bg-slate-100'}`}>
                    {draftTiers.round_tier1 ? `Nearest ${currencySymbol}` : 'Exact Cents'}
                  </span>
                </label>
                <p className="text-[10px] text-slate-500 mt-0.5 pl-6">
                  Rounds calculated retail price to nearest round figure on dashboard.
                </p>
              </div>
            </div>

            <div className="mt-3 rounded-md bg-white p-2 text-[11px] text-slate-600 border border-slate-200/60 font-mono flex items-center justify-between">
              <span>{currencySymbol}50.00 max cost &rarr;</span>
              <strong className="text-slate-900">
                {currencySymbol}
                {(draftTiers.round_tier1
                  ? Math.round(50 * (1 + draftTiers.tier1 / 100))
                  : 50 * (1 + draftTiers.tier1 / 100)
                ).toFixed(2)}
                {draftTiers.round_tier1 && <span className="ml-1 text-[9.5px] text-indigo-600 font-normal">(rounded)</span>}
              </strong>
            </div>
          </div>

          {/* Tier 2 */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-900">Tier 2 Markup Range</span>
                  <p className="text-[11px] text-slate-500">High volume / Member pricing</p>
                </div>
                <span className="font-mono text-lg font-bold text-slate-900">+{draftTiers.tier2}%</span>
              </div>

              <div className="mt-4 space-y-3">
                <input
                  type="range"
                  min="1"
                  max="30"
                  step="0.5"
                  disabled={!canEditMarkups}
                  value={draftTiers.tier2}
                  onChange={(e) => setDraftTiers({ ...draftTiers, tier2: parseFloat(e.target.value) || 0 })}
                  className="w-full accent-slate-900 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Manual input:</span>
                  <div className="flex items-center gap-1 font-mono">
                    <input
                      type="number"
                      step="0.5"
                      min="1"
                      max="100"
                      disabled={!canEditMarkups}
                      value={draftTiers.tier2}
                      onChange={(e) => setDraftTiers({ ...draftTiers, tier2: parseFloat(e.target.value) || 0 })}
                      className="w-16 rounded border border-slate-300 bg-white px-2 py-1 text-right text-xs font-bold text-slate-900 focus:outline-hidden focus:border-slate-900 disabled:bg-slate-100 disabled:text-slate-500"
                    />
                    <span className="text-slate-500">%</span>
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-slate-200/80">
                <label className={`flex items-center justify-between select-none ${canEditMarkups ? 'cursor-pointer' : 'cursor-not-allowed opacity-70'}`}>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="tier2-round-checkbox"
                      disabled={!canEditMarkups}
                      checked={!!draftTiers.round_tier2}
                      onChange={(e) => setDraftTiers({ ...draftTiers, round_tier2: e.target.checked })}
                      className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 accent-slate-900 cursor-pointer"
                    />
                    <span className="text-xs font-semibold text-slate-800">Round figure</span>
                  </div>
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold ${draftTiers.round_tier2 ? 'bg-indigo-100 text-indigo-800 border border-indigo-200' : 'text-slate-400 bg-slate-100'}`}>
                    {draftTiers.round_tier2 ? `Nearest ${currencySymbol}` : 'Exact Cents'}
                  </span>
                </label>
                <p className="text-[10px] text-slate-500 mt-0.5 pl-6">
                  Rounds calculated retail price to nearest round figure on dashboard.
                </p>
              </div>
            </div>

            <div className="mt-3 rounded-md bg-white p-2 text-[11px] text-slate-600 border border-slate-200/60 font-mono flex items-center justify-between">
              <span>{currencySymbol}50.00 max cost &rarr;</span>
              <strong className="text-slate-900">
                {currencySymbol}
                {(draftTiers.round_tier2
                  ? Math.round(50 * (1 + draftTiers.tier2 / 100))
                  : 50 * (1 + draftTiers.tier2 / 100)
                ).toFixed(2)}
                {draftTiers.round_tier2 && <span className="ml-1 text-[9.5px] text-indigo-600 font-normal">(rounded)</span>}
              </strong>
            </div>
          </div>

          {/* Tier 3 */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-900">Tier 3 Markup Range</span>
                  <p className="text-[11px] text-slate-500">Floor price margin</p>
                </div>
                <span className="font-mono text-lg font-bold text-slate-900">+{draftTiers.tier3}%</span>
              </div>

              <div className="mt-4 space-y-3">
                <input
                  type="range"
                  min="1"
                  max="25"
                  step="0.5"
                  disabled={!canEditMarkups}
                  value={draftTiers.tier3}
                  onChange={(e) => setDraftTiers({ ...draftTiers, tier3: parseFloat(e.target.value) || 0 })}
                  className="w-full accent-slate-900 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Manual input:</span>
                  <div className="flex items-center gap-1 font-mono">
                    <input
                      type="number"
                      step="0.5"
                      min="1"
                      max="100"
                      disabled={!canEditMarkups}
                      value={draftTiers.tier3}
                      onChange={(e) => setDraftTiers({ ...draftTiers, tier3: parseFloat(e.target.value) || 0 })}
                      className="w-16 rounded border border-slate-300 bg-white px-2 py-1 text-right text-xs font-bold text-slate-900 focus:outline-hidden focus:border-slate-900 disabled:bg-slate-100 disabled:text-slate-500"
                    />
                    <span className="text-slate-500">%</span>
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-slate-200/80">
                <label className={`flex items-center justify-between select-none ${canEditMarkups ? 'cursor-pointer' : 'cursor-not-allowed opacity-70'}`}>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="tier3-round-checkbox"
                      disabled={!canEditMarkups}
                      checked={!!draftTiers.round_tier3}
                      onChange={(e) => setDraftTiers({ ...draftTiers, round_tier3: e.target.checked })}
                      className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 accent-slate-900 cursor-pointer"
                    />
                    <span className="text-xs font-semibold text-slate-800">Round figure</span>
                  </div>
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold ${draftTiers.round_tier3 ? 'bg-indigo-100 text-indigo-800 border border-indigo-200' : 'text-slate-400 bg-slate-100'}`}>
                    {draftTiers.round_tier3 ? `Nearest ${currencySymbol}` : 'Exact Cents'}
                  </span>
                </label>
                <p className="text-[10px] text-slate-500 mt-0.5 pl-6">
                  Rounds calculated retail price to nearest round figure on dashboard.
                </p>
              </div>
            </div>

            <div className="mt-3 rounded-md bg-white p-2 text-[11px] text-slate-600 border border-slate-200/60 font-mono flex items-center justify-between">
              <span>{currencySymbol}50.00 max cost &rarr;</span>
              <strong className="text-slate-900">
                {currencySymbol}
                {(draftTiers.round_tier3
                  ? Math.round(50 * (1 + draftTiers.tier3 / 100))
                  : 50 * (1 + draftTiers.tier3 / 100)
                ).toFixed(2)}
                {draftTiers.round_tier3 && <span className="ml-1 text-[9.5px] text-indigo-600 font-normal">(rounded)</span>}
              </strong>
            </div>
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            {draftTiers.round_tier1 || draftTiers.round_tier2 || draftTiers.round_tier3 ? (
              <span className="inline-flex items-center gap-1.5 text-indigo-700 font-semibold bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-200">
                <span className="h-2 w-2 rounded-full bg-indigo-600" />
                Round figures enabled for:{' '}
                {[draftTiers.round_tier1 && 'Tier 1', draftTiers.round_tier2 && 'Tier 2', draftTiers.round_tier3 && 'Tier 3']
                  .filter(Boolean)
                  .join(', ')}
              </span>
            ) : (
              <span className="text-slate-500">All tiers currently calculate exact dollars and cents.</span>
            )}
          </div>
          {canEditMarkups && (
            <button
              type="button"
              id="save-markup-tiers-btn"
              onClick={handleCommitSave}
              className="flex items-center space-x-1.5 rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-slate-800 transition cursor-pointer"
            >
              <Save className="h-3.5 w-3.5" />
              <span>Apply &amp; Save Markup Settings</span>
            </button>
          )}
        </div>
      </div>

      {/* SECTION 3: BRAND MANAGER */}
      <div className="rounded-xl border border-slate-200/80 bg-white shadow-xs" id="brand-manager-settings-panel">
        <div className="flex flex-wrap items-center justify-between border-b border-slate-200 p-5 bg-slate-50/70 gap-3">
          <div className="flex items-center space-x-2.5">
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${currentTheme.classes.iconBg} ${currentTheme.classes.iconText}`}>
              <Tags className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">3. Brand Manager &bull; Select Brand to Edit / Fix</h3>
                {!canManageBrands && (
                  <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 border border-slate-200">
                    <ShieldAlert className="h-3 w-3" /> Read-Only
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Click any brand name to edit and save it &mdash; refactoring all matching products in your master catalog. Add new brands to show in item creation dropdown lists.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs shadow-2xs">
              <span className="text-slate-500 font-medium">Catalog Brands:</span>
              <span className="font-bold text-slate-900">{brandStats.length} registered</span>
              <span className="text-slate-300">•</span>
              <span className="text-emerald-700 font-bold">{brandStats.length - hiddenBrands.length} active</span>
              {hiddenBrands.length > 0 && (
                <>
                  <span className="text-slate-300">•</span>
                  <span className="text-rose-600 font-bold">{hiddenBrands.length} hidden</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {brandFeedback && (
            <div
              className={`flex items-center gap-2.5 rounded-lg p-3 text-xs font-semibold border ${
                brandFeedback.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border-rose-200'
              }`}
            >
              {brandFeedback.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
              )}
              <span>{brandFeedback.message}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 bg-slate-50/80 p-3.5 rounded-xl border border-slate-200">
            {canManageBrands && (
              <form
                onSubmit={handleAddNewBrandSubmit}
                className="md:col-span-7 flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
              >
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                    <Tag className="h-3.5 w-3.5" />
                  </div>
                  <input
                    type="text"
                    placeholder="Enter new brand name (e.g. MANCHESTER, MARLBORO)..."
                    value={newBrandInput}
                    onChange={(e) => setNewBrandInput(e.target.value.toUpperCase())}
                    className="w-full rounded-lg border border-slate-300 bg-white pl-8 pr-3 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-900 placeholder:normal-case placeholder:font-normal placeholder:text-slate-400 focus:outline-hidden focus:border-slate-900"
                  />
                </div>
                <button
                  type="submit"
                  id="add-new-brand-btn"
                  disabled={!newBrandInput.trim()}
                  className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold shadow-2xs transition shrink-0 cursor-pointer ${
                    !newBrandInput.trim() ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : `${currentTheme.classes.primaryBtn}`
                  }`}
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Brand</span>
                </button>
              </form>
            )}

            <div className={`${canManageBrands ? 'md:col-span-5' : 'md:col-span-12'} relative`}>
              <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                <Search className="h-3.5 w-3.5" />
              </div>
              <input
                type="text"
                placeholder="Filter registered brands..."
                value={brandSearchFilter}
                onChange={(e) => setBrandSearchFilter(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:border-slate-900"
              />
            </div>
          </div>

          <div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 mb-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Select Brand to Edit / Fix
                </label>
                <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-[11px]">
                  <button
                    type="button"
                    onClick={() => setBrandVisibilityTab('all')}
                    className={`px-2 py-0.5 rounded-md font-semibold transition cursor-pointer ${
                      brandVisibilityTab === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    All ({brandStats.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setBrandVisibilityTab('active')}
                    className={`px-2 py-0.5 rounded-md font-semibold transition cursor-pointer ${
                      brandVisibilityTab === 'active'
                        ? 'bg-white text-emerald-800 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Shown ({brandStats.length - hiddenBrands.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setBrandVisibilityTab('hidden')}
                    className={`px-2 py-0.5 rounded-md font-semibold transition cursor-pointer ${
                      brandVisibilityTab === 'hidden' ? 'bg-white text-rose-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Hidden ({hiddenBrands.length})
                  </button>
                </div>
              </div>
              <span className="text-[11px] text-slate-400">
                Tick &quot;Hide&quot; to stop showing brand on Master Catalog &amp; Dashboard
              </span>
            </div>

            {filteredBrandStats.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-6 text-center">
                <p className="text-xs text-slate-500">
                  {brandSearchFilter.trim()
                    ? `No registered brands match "${brandSearchFilter}".`
                    : brandVisibilityTab === 'hidden'
                    ? 'No brands are currently hidden. Use the "Hide" tick box on any brand to hide it.'
                    : 'No brands registered yet. Use the form above to add a brand.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 max-h-[380px] overflow-y-auto p-1">
                {filteredBrandStats.map(({ brand, count }) => {
                  const isEditing = editingBrandKey === brand;
                  const isHidden = hiddenBrands.includes(brand);

                  if (isEditing && canManageBrands) {
                    return (
                      <div
                        key={brand}
                        className="flex flex-col justify-between rounded-xl border-2 border-slate-900 bg-white p-3 shadow-md ring-2 ring-slate-900/10 transition"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600">
                            <span>Editing Brand:</span>
                            <span className="text-[10px] text-slate-400">
                              {count} item{count === 1 ? '' : 's'}
                            </span>
                          </div>
                          <input
                            type="text"
                            autoFocus
                            value={editingBrandValue}
                            onChange={(e) => setEditingBrandValue(e.target.value.toUpperCase())}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleSaveEditBrand(brand);
                              } else if (e.key === 'Escape') {
                                handleCancelEditBrand();
                              }
                            }}
                            className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-slate-900 focus:outline-hidden focus:border-slate-900"
                          />

                          <label className="flex items-center gap-2 rounded-lg bg-slate-50 p-2 border border-slate-200 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={isHidden}
                              onChange={() => onToggleHideBrand && onToggleHideBrand(brand)}
                              className="h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500 accent-rose-600 cursor-pointer"
                            />
                            <div className="text-[11px]">
                              <span className={`font-bold ${isHidden ? 'text-rose-700' : 'text-slate-800'}`}>
                                {isHidden ? 'Hidden from Catalog & Dashboard' : 'Hide this Brand'}
                              </span>
                              <p className="text-[10px] text-slate-500">
                                {isHidden
                                  ? 'Currently hidden. Uncheck to show again.'
                                  : 'Stops showing in Master Catalog table and Dashboard Brand filter.'}
                              </p>
                            </div>
                          </label>

                          <p className="text-[10px] text-slate-500">
                            {count > 0
                              ? `Will refactor across ${count} product${count > 1 ? 's' : ''} in catalog`
                              : 'Brand has 0 products attached'}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5 mt-3 pt-2 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={() => handleSaveEditBrand(brand)}
                            className="flex-1 inline-flex items-center justify-center gap-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 text-xs font-bold transition shadow-2xs cursor-pointer"
                          >
                            <Check className="h-3 w-3" />
                            <span>Save</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelEditBrand}
                            className="inline-flex items-center justify-center gap-1 rounded-md border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 px-2 py-1 text-xs font-semibold transition cursor-pointer"
                          >
                            <X className="h-3 w-3" />
                            <span>Cancel</span>
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={brand}
                      onClick={() => canManageBrands && handleStartEditBrand(brand)}
                      className={`group flex items-center justify-between rounded-xl border p-3 transition ${
                        canManageBrands ? 'cursor-pointer' : 'cursor-default'
                      } ${
                        isHidden
                          ? 'border-rose-200 bg-rose-50/30 hover:border-rose-300 hover:bg-rose-50/50'
                          : 'border-slate-200 bg-white hover:border-slate-400 hover:shadow-xs'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 pr-2">
                        <div
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition ${
                            isHidden
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-slate-100 text-slate-600 group-hover:bg-slate-900 group-hover:text-white'
                          }`}
                        >
                          <Tag className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p
                              className={`text-xs font-bold truncate ${
                                isHidden ? 'text-slate-700 line-through decoration-rose-400' : 'text-slate-900'
                              }`}
                            >
                              {brand}
                            </p>
                            {isHidden && (
                              <span className="shrink-0 text-[9.5px] font-bold text-rose-700 bg-rose-100/80 px-1 py-0.2 rounded border border-rose-200">
                                Hidden
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-500">
                            {count > 0 ? (
                              <span>
                                {count} product{count === 1 ? '' : 's'}
                              </span>
                            ) : (
                              <span className="text-blue-600 font-semibold">New brand (0 items)</span>
                            )}
                          </p>
                        </div>
                      </div>

                      {canManageBrands && (
                        <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <label
                            className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] cursor-pointer select-none transition ${
                              isHidden
                                ? 'border-rose-300 bg-rose-100 text-rose-800 font-bold shadow-2xs'
                                : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 font-medium'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isHidden}
                              onChange={() => onToggleHideBrand && onToggleHideBrand(brand)}
                              className="h-3.5 w-3.5 rounded border-slate-300 text-rose-600 focus:ring-rose-500 accent-rose-600 cursor-pointer"
                            />
                            <span>{isHidden ? 'Hidden' : 'Hide'}</span>
                          </label>

                          <button
                            type="button"
                            onClick={() => handleStartEditBrand(brand)}
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 group-hover:bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:border-slate-400 transition cursor-pointer"
                          >
                            <Pencil className="h-3 w-3 text-slate-500" />
                            <span>Edit</span>
                          </button>
                          {count === 0 && onDeleteBrand && (
                            <button
                              type="button"
                              onClick={() => handleDeleteEmptyBrand(brand)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded transition cursor-pointer"
                              title="Remove empty brand from registered list"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SECTION 4: SUPPLIER MANAGER & TESTING HUB */}
      <SupplierManager
        suppliers={suppliers}
        onUpdateSupplier={onUpdateSupplier}
        onAddSupplier={onAddSupplier}
        onDeleteSupplier={onDeleteSupplier}
        onResetDefaultSuppliers={onResetDefaultSuppliers}
        canManageSuppliers={canManageSuppliers}
      />

      {/* SECTION 5: COMPLETE MASTER CATALOG DATABASE EDITOR */}
      <div className="rounded-xl border border-slate-200/80 bg-white shadow-xs">
        <div className="flex flex-wrap items-center justify-between border-b border-slate-200 p-5 bg-slate-50/70 gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">5. Complete Master Catalog Database Editor</h3>
              {!canEditCatalog && (
                <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 border border-slate-200">
                  <ShieldAlert className="h-3 w-3" /> Read-Only
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Wholesale prices are dynamic and scraped automatically on the dashboard. Click any row or <strong>&quot;Edit&quot;</strong> to update GTINs, brands, or supplier codes.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <input
                type="text"
                placeholder="Search by name, brand, GTIN..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white pl-3 pr-14 py-1.5 text-xs text-slate-700 focus:outline-hidden focus:border-slate-900"
              />
              <div className="absolute right-1 top-1 flex items-center gap-0.5">
                {searchFilter && (
                  <button
                    type="button"
                    onClick={() => setSearchFilter('')}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded"
                    title="Clear filter"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
                <button
                  type="button"
                  id="settings-catalog-scan-inline-btn"
                  onClick={() => setIsCatalogScannerOpen(true)}
                  className="p-1 rounded text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition cursor-pointer shadow-2xs"
                  title="Scan barcode with camera to filter table"
                >
                  <Barcode className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <button
              type="button"
              id="settings-catalog-scan-btn"
              onClick={() => setIsCatalogScannerOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition cursor-pointer shadow-2xs"
              title="Scan physical product packaging barcode"
            >
              <Camera className="h-3.5 w-3.5 text-emerald-600" />
              <Barcode className="h-3.5 w-3.5" />
              <span>Scan Barcode</span>
            </button>

            {canEditCatalog && (
              <button
                id="add-gtin-row-btn"
                onClick={() => setIsAddModalOpen(true)}
                className="flex items-center space-x-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add New Item</span>
              </button>
            )}
            {canSaveAnything && (
              <button
                id="settings-save-changes-bottom-btn"
                onClick={handleCommitSave}
                className="flex items-center space-x-1.5 rounded-lg bg-slate-900 px-4 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-slate-800 transition cursor-pointer"
              >
                <Save className="h-3.5 w-3.5" />
                <span>Save Changes</span>
              </button>
            )}
          </div>
        </div>

        {hiddenProductsCount > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5 bg-amber-50/90 border-b border-amber-200 text-xs text-amber-900">
            <div className="flex items-center gap-2">
              <EyeOff className="h-4 w-4 text-amber-700 shrink-0" />
              <span>
                <strong>{hiddenProductsCount} items hidden from table</strong> because their brand is set to &quot;Hide&quot; ({hiddenBrands.length} brand{hiddenBrands.length > 1 ? 's' : ''} hidden).
              </span>
            </div>
            <label className="inline-flex items-center gap-1.5 font-semibold text-amber-950 cursor-pointer select-none bg-amber-100 hover:bg-amber-200/80 px-2.5 py-1 rounded-md border border-amber-300/70 transition">
              <input
                type="checkbox"
                checked={includeHiddenInCatalogTable}
                onChange={(e) => setIncludeHiddenInCatalogTable(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-amber-400 accent-amber-800 cursor-pointer"
              />
              <span>Temporarily show hidden brands in table</span>
            </label>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
              <tr>
                <th scope="col" className="py-3 px-3 w-12 text-center">In-Store</th>
                <th scope="col" className="py-3 px-3">Brand</th>
                <th scope="col" className="py-3 px-3">GTIN Barcode</th>
                <th scope="col" className="py-3 px-3 min-w-[240px]">Product Name</th>
                <th scope="col" className="py-3 px-3">Retail SKU</th>
                <th scope="col" className="py-3 px-3">Trax Code</th>
                <th scope="col" className="py-3 px-3">Campbells Code</th>
                <th scope="col" className="py-3 px-3">One Dist Code</th>
                {(canEditCatalog || canDeleteCatalog) && (
                  <th scope="col" className="py-3 px-3 text-center w-28">Action</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDraft.length === 0 && (
                <tr>
                  <td colSpan={canEditCatalog || canDeleteCatalog ? 9 : 8} className="py-12 px-4 text-center">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <EyeOff className="h-8 w-8 text-slate-300" />
                      <p className="text-sm font-semibold text-slate-700">
                        {searchFilter
                          ? `No products match "${searchFilter}".`
                          : hiddenProductsCount > 0
                          ? `All products in this view are hidden by brand settings (${hiddenProductsCount} products hidden).`
                          : 'No products found in master catalog.'}
                      </p>
                      {hiddenProductsCount > 0 && !searchFilter && (
                        <button
                          type="button"
                          onClick={() => setIncludeHiddenInCatalogTable(true)}
                          className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs cursor-pointer"
                        >
                          <Eye className="h-3.5 w-3.5 text-slate-500" />
                          <span>Show Hidden Products in Table</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
              {filteredDraft.map((p) => {
                const brand = p.brand && p.brand.trim() ? p.brand.trim().toUpperCase() : getBrand(p.product_name);
                const isHiddenBrand = hiddenBrands.includes(brand);
                const displayCategory = p.product_type || getCategory(p.product_name, p.product_type);

                return (
                  <tr
                    key={p.id}
                    onClick={() => canEditCatalog && setEditingProduct(p)}
                    className={`transition-colors group ${canEditCatalog ? 'cursor-pointer' : 'cursor-default'} ${
                      isHiddenBrand
                        ? 'bg-rose-50/40 hover:bg-rose-50/70'
                        : p.in_store
                        ? 'hover:bg-slate-50/90'
                        : 'bg-slate-50/80 opacity-70 hover:opacity-100 hover:bg-slate-100/80'
                    }`}
                  >
                    <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        disabled={!canEditCatalog}
                        checked={p.in_store}
                        onChange={() => handleInStoreToggle(p.id, p.in_store)}
                        title={p.in_store ? 'Active in store (visible on dashboard)' : 'Hidden from main dashboard'}
                        className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer accent-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    </td>

                    <td className="py-3 px-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          isHiddenBrand ? 'bg-rose-100 text-rose-800 border border-rose-200' : currentTheme.classes.brandBadge
                        }`}
                      >
                        <Tag className="h-2.5 w-2.5 opacity-75" />
                        {brand}
                        {isHiddenBrand && <span className="text-[9px] lowercase font-normal ml-0.5">(hidden)</span>}
                      </span>
                    </td>

                    <td className="py-3 px-3 font-mono text-[11px] font-medium text-slate-700 whitespace-nowrap">{p.gtin}</td>

                    <td className="py-3 px-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                          {p.product_name}
                        </span>
                        {canEditCatalog && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                            <Pencil className="h-2.5 w-2.5" />
                            Click row to edit
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 mt-0.5 text-[10px]">
                        <span className="rounded bg-slate-100 px-1.5 py-0.2 font-medium text-slate-600">{displayCategory}</span>
                        <span className="rounded bg-blue-50 px-1.5 py-0.2 font-medium text-blue-700 border border-blue-200/50">
                          Master: {p.master_pack_size || (p.product_type === 'Cigarettes' ? '10 Packs' : '5 Pouches')}
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-3 font-mono text-[11px] whitespace-nowrap">
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 font-semibold text-slate-800">{p.retail_code}</span>
                    </td>

                    <td className="py-3 px-3 font-mono text-[11px] text-slate-600 whitespace-nowrap">{p.trax_code || '—'}</td>
                    <td className="py-3 px-3 font-mono text-[11px] text-slate-600 whitespace-nowrap">{p.campbells_code || '—'}</td>
                    <td className="py-3 px-3 font-mono text-[11px] text-slate-600 whitespace-nowrap">{p.onedistribution_code || '—'}</td>

                    {(canEditCatalog || canDeleteCatalog) && (
                      <td className="py-3 px-3 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center space-x-1.5">
                          {canEditCatalog && (
                            <button
                              onClick={() => setEditingProduct(p)}
                              className="inline-flex items-center gap-1 rounded bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-900 hover:text-white transition shadow-2xs cursor-pointer"
                              title="Open pop-up to edit this product"
                            >
                              <Pencil className="h-3 w-3" />
                              <span>Edit</span>
                            </button>
                          )}
                          {canDeleteCatalog && (
                            <button
                              onClick={() => handleDeleteItem(p.id, p.product_name)}
                              className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition cursor-pointer"
                              title="Delete product"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between border-t border-slate-200 bg-slate-50 px-5 py-3 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <HelpCircle className="h-3.5 w-3.5 text-slate-400" />
            <span>
              Prices are scraped dynamically. Click any row or <strong>&quot;Edit&quot;</strong> to modify catalog details and brand.
            </span>
          </div>
          <div className="font-semibold text-slate-700">Total Database Records: {draftProducts.length}</div>
        </div>
      </div>

      {canEditCatalog && editingProduct && (
        <ProductFormModal
          isOpen={Boolean(editingProduct)}
          onClose={() => setEditingProduct(null)}
          mode="edit"
          initialProduct={editingProduct}
          onSave={handleSaveFromModal}
          existingProducts={draftProducts}
          registeredBrands={registeredBrands}
        />
      )}

      {canEditCatalog && (
        <ProductFormModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          mode="add"
          onSave={handleSaveFromModal}
          existingProducts={draftProducts}
          registeredBrands={registeredBrands}
        />
      )}

      <BarcodeScannerModal
        isOpen={isCatalogScannerOpen}
        onClose={() => setIsCatalogScannerOpen(false)}
        onScan={(scannedCode) => {
          setSearchFilter(scannedCode);
        }}
        title="Scan Barcode to Locate Item"
        subtitle="Point camera at product GTIN or Retail SKU to locate it in the Master Catalog."
        targetFieldLabel="Catalog Filter"
      />
    </div>
  );
};
