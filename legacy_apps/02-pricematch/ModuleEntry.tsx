import React, { useState, useMemo } from 'react';
import {
  ProductItem,
  MarkupTiers,
  ActiveSection,
  SupplierConfig,
  KsbmModuleProps,
  KsbmBusinessConfig,
} from './types';
import { INITIAL_PRODUCTS, INITIAL_MARKUP_TIERS } from './constants/mockData';
import { INITIAL_SUPPLIERS } from './constants/mockSuppliers';
import { calculateProductDetails, getBrand } from './utils/pricing';
import { hasWholesalePermission } from './utils/permissions';
import { ThemeProvider } from './theme';
import { MainDashboard } from './components/MainDashboard';
import { SettingsDatabaseManager } from './components/SettingsDatabaseManager';
import { ManualScrapeModal } from './components/ManualScrapeModal';
import { LayoutDashboard, Settings, RefreshCw, ShieldAlert, Store } from 'lucide-react';

const WholesaleIntelligenceModuleContent: React.FC<KsbmModuleProps> = ({
  currentUser,
  businessConfig = {} as KsbmBusinessConfig,
}) => {
  const currencySymbol = businessConfig.currencySymbol || '$';
  const highSpreadThreshold = businessConfig.highSpreadAlertThreshold ?? 2.5;

  // Evaluate KSBM granular permissions
  const canView = hasWholesalePermission(currentUser, 'wholesale.view');
  const canScrape = hasWholesalePermission(currentUser, 'wholesale.scrape');
  const canEditCatalog = hasWholesalePermission(currentUser, 'wholesale.catalog.edit');
  const canDeleteCatalog = hasWholesalePermission(currentUser, 'wholesale.catalog.delete');
  const canEditMarkups = hasWholesalePermission(currentUser, 'wholesale.markups.edit');
  const canManageBrands = hasWholesalePermission(currentUser, 'wholesale.brands.manage');
  const canManageSuppliers = hasWholesalePermission(currentUser, 'wholesale.suppliers.manage');
  const canExport = hasWholesalePermission(currentUser, 'wholesale.export');

  const canOpenSettings =
    canEditCatalog ||
    canDeleteCatalog ||
    canEditMarkups ||
    canManageBrands ||
    canManageSuppliers ||
    ['master_admin', 'admin', 'owner', 'manager', 'store_manager', 'supervisor'].includes(
      (currentUser?.role || '').toLowerCase().trim()
    );

  const [products, setProducts] = useState<ProductItem[]>(() => {
    try {
      const saved = localStorage.getItem('kwik_stop_products');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to parse saved products', e);
    }
    return INITIAL_PRODUCTS;
  });

  const [lastScrapedTime, setLastScrapedTime] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('kwik_stop_last_scraped');
      if (saved) return saved;
    } catch {
      // Ignore storage error
    }
    return '13 Sep 2026 at 05:42 AM';
  });

  const [isScraperModalOpen, setIsScraperModalOpen] = useState(false);

  const [suppliers, setSuppliers] = useState<SupplierConfig[]>(() => {
    try {
      const saved = localStorage.getItem('kwik_stop_suppliers');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to parse saved suppliers', e);
    }
    return INITIAL_SUPPLIERS;
  });

  const [markupTiers, setMarkupTiers] = useState<MarkupTiers>(() => {
    const configDefaults = businessConfig.defaultMarkupTiers || {};
    try {
      const saved = localStorage.getItem('kwik_stop_tiers');
      if (saved) {
        return {
          ...INITIAL_MARKUP_TIERS,
          ...configDefaults,
          ...JSON.parse(saved),
        };
      }
    } catch (e) {
      console.error('Failed to parse saved tiers', e);
    }
    return {
      ...INITIAL_MARKUP_TIERS,
      ...configDefaults,
    };
  });

  const [activeSection, setActiveSection] = useState<ActiveSection>('dashboard');

  const [customBrands, setCustomBrands] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('kwik_stop_custom_brands');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to parse saved custom brands', e);
    }
    return [];
  });

  const [hiddenBrands, setHiddenBrands] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('kwik_stop_hidden_brands');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to parse saved hidden brands', e);
    }
    return [];
  });

  const calculatedProducts = useMemo(() => {
    return products.map((p) => calculateProductDetails(p, markupTiers));
  }, [products, markupTiers]);

  const activeStoreCount = useMemo(() => {
    return products.filter((p) => p.in_store).length;
  }, [products]);

  const registeredBrands = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      const b = p.brand && p.brand.trim() ? p.brand.trim().toUpperCase() : getBrand(p.product_name);
      if (b && b !== 'UNKNOWN') set.add(b);
    });
    customBrands.forEach((b) => {
      const trimmed = (b || '').trim().toUpperCase();
      if (trimmed && trimmed !== 'UNKNOWN') set.add(trimmed);
    });
    return Array.from(set).sort();
  }, [products, customBrands]);

  const handleUpdateSupplier = (updated: SupplierConfig) => {
    if (!canManageSuppliers) return;
    const next = suppliers.map((s) => (s.id === updated.id ? updated : s));
    setSuppliers(next);
    localStorage.setItem('kwik_stop_suppliers', JSON.stringify(next));
  };

  const handleAddSupplier = (newSupplier: SupplierConfig) => {
    if (!canManageSuppliers) return;
    const next = [...suppliers, newSupplier];
    setSuppliers(next);
    localStorage.setItem('kwik_stop_suppliers', JSON.stringify(next));
  };

  const handleDeleteSupplier = (supplierId: string) => {
    if (!canManageSuppliers) return;
    const next = suppliers.filter((s) => s.id !== supplierId);
    setSuppliers(next);
    localStorage.setItem('kwik_stop_suppliers', JSON.stringify(next));
  };

  const handleResetDefaultSuppliers = () => {
    if (!canManageSuppliers) return;
    if (
      confirm(
        'Reset suppliers back to the default 3 pre-populated wholesale distributors (Trax, Campbells, One Distribution)?'
      )
    ) {
      setSuppliers(INITIAL_SUPPLIERS);
      localStorage.removeItem('kwik_stop_suppliers');
    }
  };

  const handleToggleHideBrand = (brandToToggle: string) => {
    if (!canManageBrands) return;
    const upper = brandToToggle.trim().toUpperCase();
    if (!upper) return;
    setHiddenBrands((prev) => {
      const next = prev.includes(upper) ? prev.filter((b) => b !== upper) : [...prev, upper];
      localStorage.setItem('kwik_stop_hidden_brands', JSON.stringify(next));
      return next;
    });
  };

  const handleAddBrand = (newBrand: string) => {
    if (!canManageBrands) return;
    const brandUpper = newBrand.trim().toUpperCase();
    if (!brandUpper) return;
    if (!customBrands.includes(brandUpper)) {
      const nextCustom = [...customBrands, brandUpper];
      setCustomBrands(nextCustom);
      localStorage.setItem('kwik_stop_custom_brands', JSON.stringify(nextCustom));
    }
  };

  const handleRenameBrand = (oldBrand: string, newBrand: string) => {
    if (!canManageBrands) return;
    const oldUpper = oldBrand.trim().toUpperCase();
    const newUpper = newBrand.trim().toUpperCase();
    if (!oldUpper || !newUpper || oldUpper === newUpper) return;

    const updatedProducts = products.map((p) => {
      const currentBrand = p.brand && p.brand.trim() ? p.brand.trim().toUpperCase() : getBrand(p.product_name);
      if (currentBrand === oldUpper) {
        return { ...p, brand: newUpper };
      }
      return p;
    });
    setProducts(updatedProducts);
    localStorage.setItem('kwik_stop_products', JSON.stringify(updatedProducts));

    const updatedCustom = customBrands.map((b) => (b === oldUpper ? newUpper : b));
    if (!updatedCustom.includes(newUpper)) updatedCustom.push(newUpper);
    const deduplicated = Array.from(new Set(updatedCustom));
    setCustomBrands(deduplicated);
    localStorage.setItem('kwik_stop_custom_brands', JSON.stringify(deduplicated));

    setHiddenBrands((prev) => {
      if (prev.includes(oldUpper)) {
        const next = Array.from(new Set(prev.map((b) => (b === oldUpper ? newUpper : b))));
        localStorage.setItem('kwik_stop_hidden_brands', JSON.stringify(next));
        return next;
      }
      return prev;
    });
  };

  const handleDeleteBrand = (brandToDelete: string) => {
    if (!canManageBrands) return;
    const upper = brandToDelete.trim().toUpperCase();
    const nextCustom = customBrands.filter((b) => b !== upper);
    setCustomBrands(nextCustom);
    localStorage.setItem('kwik_stop_custom_brands', JSON.stringify(nextCustom));

    setHiddenBrands((prev) => {
      const next = prev.filter((b) => b !== upper);
      localStorage.setItem('kwik_stop_hidden_brands', JSON.stringify(next));
      return next;
    });
  };

  const handleSaveProducts = (updatedProducts: ProductItem[]) => {
    if (!canEditCatalog && !canDeleteCatalog) return;
    setProducts(updatedProducts);
    localStorage.setItem('kwik_stop_products', JSON.stringify(updatedProducts));
  };

  const handleUpdateMarkupTiers = (newTiers: MarkupTiers) => {
    if (!canEditMarkups) return;
    setMarkupTiers(newTiers);
    localStorage.setItem('kwik_stop_tiers', JSON.stringify(newTiers));
  };

  const handleResetDefaults = () => {
    if (!canEditCatalog || !canDeleteCatalog) return;
    if (confirm('Reset catalog and markup tiers to default wholesale state?')) {
      const resetTiers = { ...INITIAL_MARKUP_TIERS, ...(businessConfig.defaultMarkupTiers || {}) };
      setProducts(INITIAL_PRODUCTS);
      setMarkupTiers(resetTiers);
      setCustomBrands([]);
      localStorage.removeItem('kwik_stop_products');
      localStorage.removeItem('kwik_stop_tiers');
      localStorage.removeItem('kwik_stop_custom_brands');
    }
  };

  const handleCompleteScrape = (updatedProducts: ProductItem[], scrapeTimestamp: string) => {
    if (!canScrape) return;
    setProducts(updatedProducts);
    setLastScrapedTime(scrapeTimestamp);
    localStorage.setItem('kwik_stop_products', JSON.stringify(updatedProducts));
    localStorage.setItem('kwik_stop_last_scraped', scrapeTimestamp);
  };

  if (!canView) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-8 text-center max-w-lg mx-auto my-8">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-700 mb-3">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h3 className="text-base font-bold text-slate-900">Wholesale Intelligence Access Restricted</h3>
        <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
          Your KSBM profile ({currentUser?.name || 'Staff'} &bull; {currentUser?.role || 'staff'}) does not currently have the{' '}
          <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-rose-200">wholesale.view</code> permission.
          Contact your Master Admin to enable access.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-5 text-slate-800 font-sans antialiased" id="ksbm-wholesale-module">
      {/* Compact Module-Scoped Action & View Switcher Bar (Master Shell handles outer nav & auth) */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-white px-4 py-2.5 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            id="module-tab-dashboard"
            onClick={() => setActiveSection('dashboard')}
            className={`inline-flex items-center space-x-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer ${
              activeSection === 'dashboard'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <LayoutDashboard className="h-3.5 w-3.5" />
            <span>Price Match Dashboard</span>
            <span
              className={`ml-0.5 rounded-full px-1.5 py-0.2 text-[10px] font-semibold ${
                activeSection === 'dashboard'
                  ? 'bg-white/20 text-white'
                  : 'bg-slate-100 text-slate-600 border border-slate-200'
              }`}
            >
              {activeStoreCount}
            </span>
          </button>

          {canOpenSettings && (
            <button
              type="button"
              id="module-tab-settings"
              onClick={() => setActiveSection('settings')}
              className={`inline-flex items-center space-x-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                activeSection === 'settings'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Settings className="h-3.5 w-3.5" />
              <span>Catalog, Markups &amp; Settings</span>
              <span
                className={`ml-0.5 rounded-full px-1.5 py-0.2 text-[10px] font-semibold ${
                  activeSection === 'settings'
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-100 text-slate-600 border border-slate-200'
                }`}
              >
                {products.length}
              </span>
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {businessConfig.storeName && (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
              <Store className="h-3 w-3 text-slate-500" />
              <span>{businessConfig.storeName}</span>
            </span>
          )}

          <div
            className="hidden md:flex items-center space-x-1.5 rounded-full border border-emerald-200/90 bg-emerald-50/70 px-2.5 py-1 text-[11px] text-emerald-800"
            title="Last successful wholesale price scraping timestamp"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600"></span>
            </span>
            <span className="text-emerald-700/80 font-medium">Last Sync:</span>
            <span className="font-bold text-emerald-950 font-mono">{lastScrapedTime}</span>
          </div>

          {canScrape && (
            <button
              type="button"
              id="module-manual-scrape-btn"
              onClick={() => setIsScraperModalOpen(true)}
              className="inline-flex items-center space-x-1.5 rounded-lg border border-emerald-600 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 text-xs font-bold transition shadow-xs cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Manual Scrape</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Module Workspace */}
      {activeSection === 'dashboard' || !canOpenSettings ? (
        <MainDashboard
          products={calculatedProducts}
          markupTiers={markupTiers}
          onNavigateToSettings={canOpenSettings ? () => setActiveSection('settings') : undefined}
          lastScrapedTime={lastScrapedTime}
          onOpenManualScrape={canScrape ? () => setIsScraperModalOpen(true) : undefined}
          hiddenBrands={hiddenBrands}
          canScrape={canScrape}
          canExport={canExport}
          canAccessSettings={canOpenSettings}
          currencySymbol={currencySymbol}
          highSpreadThreshold={highSpreadThreshold}
        />
      ) : (
        <SettingsDatabaseManager
          products={products}
          markupTiers={markupTiers}
          registeredBrands={registeredBrands}
          suppliers={suppliers}
          onUpdateMarkupTiers={handleUpdateMarkupTiers}
          onSaveProducts={handleSaveProducts}
          onResetDefaults={handleResetDefaults}
          onAddBrand={handleAddBrand}
          onRenameBrand={handleRenameBrand}
          onDeleteBrand={handleDeleteBrand}
          onUpdateSupplier={handleUpdateSupplier}
          onAddSupplier={handleAddSupplier}
          onDeleteSupplier={handleDeleteSupplier}
          onResetDefaultSuppliers={handleResetDefaultSuppliers}
          lastScrapedTime={lastScrapedTime}
          onOpenManualScrape={canScrape ? () => setIsScraperModalOpen(true) : undefined}
          hiddenBrands={hiddenBrands}
          onToggleHideBrand={handleToggleHideBrand}
          canEditMarkups={canEditMarkups}
          canManageBrands={canManageBrands}
          canManageSuppliers={canManageSuppliers}
          canEditCatalog={canEditCatalog}
          canDeleteCatalog={canDeleteCatalog}
          canScrape={canScrape}
          currencySymbol={currencySymbol}
        />
      )}

      {canScrape && (
        <ManualScrapeModal
          isOpen={isScraperModalOpen}
          onClose={() => setIsScraperModalOpen(false)}
          suppliers={suppliers}
          products={products}
          onCompleteScrape={handleCompleteScrape}
          currencySymbol={currencySymbol}
        />
      )}
    </div>
  );
};

export const ModuleEntry: React.FC<KsbmModuleProps> = ({ currentUser, businessConfig }) => {
  return (
    <ThemeProvider defaultThemeId={businessConfig?.defaultThemeId || 'slate'}>
      <WholesaleIntelligenceModuleContent
        currentUser={currentUser}
        businessConfig={businessConfig}
      />
    </ThemeProvider>
  );
};

export default ModuleEntry;
