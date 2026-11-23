import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Plus, Edit3, AlertCircle, Check, Sparkles, Tag, ChevronDown, Package, Barcode, Camera } from 'lucide-react';
import { ProductItem, ProductType } from '../types';
import { getBrand, inferProductType, inferMasterPackSize } from '../utils/pricing';
import { useTheme } from '../theme';
import { BarcodeScannerModal } from './BarcodeScannerModal';

export interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'add' | 'edit';
  initialProduct?: ProductItem | null;
  onSave: (productData: Omit<ProductItem, 'id'>, id?: string) => void;
  existingProducts: ProductItem[];
  registeredBrands?: string[];
}

export const ProductFormModal: React.FC<ProductFormModalProps> = ({
  isOpen,
  onClose,
  mode,
  initialProduct,
  onSave,
  existingProducts,
  registeredBrands = [],
}) => {
  const { currentTheme } = useTheme();

  const [gtin, setGtin] = useState('');
  const [productName, setProductName] = useState('');
  const [brand, setBrand] = useState('');
  const [productType, setProductType] = useState<ProductType>('Cigarettes');
  const [masterPackSize, setMasterPackSize] = useState('10 Packs');
  const [retailCode, setRetailCode] = useState('');
  const [inStore, setInStore] = useState(true);

  const [traxCode, setTraxCode] = useState('TRX-');
  const [campbellsCode, setCampbellsCode] = useState('CMP-');
  const [oneDistCode, setOneDistCode] = useState('OND-');

  const [scannerTarget, setScannerTarget] = useState<'gtin' | 'sku' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isBrandFocused, setIsBrandFocused] = useState(false);
  const brandContainerRef = useRef<HTMLDivElement>(null);

  const existingBrands = useMemo(() => {
    const set = new Set<string>();
    existingProducts.forEach((p) => {
      const b = p.brand && p.brand.trim() ? p.brand.trim().toUpperCase() : getBrand(p.product_name);
      if (b && b !== 'UNKNOWN') {
        set.add(b);
      }
    });
    if (registeredBrands && Array.isArray(registeredBrands)) {
      registeredBrands.forEach((b) => {
        const trimmed = (b || '').trim().toUpperCase();
        if (trimmed && trimmed !== 'UNKNOWN') {
          set.add(trimmed);
        }
      });
    }
    return Array.from(set).sort();
  }, [existingProducts, registeredBrands]);

  const filteredBrands = useMemo(() => {
    const query = brand.trim().toUpperCase();
    if (!query) return existingBrands;
    return existingBrands.filter((b) => b.includes(query));
  }, [existingBrands, brand]);

  const isExactBrandMatch = useMemo(() => {
    const query = brand.trim().toUpperCase();
    return query !== '' && existingBrands.includes(query);
  }, [existingBrands, brand]);

  useEffect(() => {
    if (!isOpen) {
      setError(null);
      setIsBrandFocused(false);
      return;
    }

    if (mode === 'edit' && initialProduct) {
      setGtin(initialProduct.gtin);
      setProductName(initialProduct.product_name);
      const initialBrand =
        initialProduct.brand && initialProduct.brand.trim()
          ? initialProduct.brand.trim().toUpperCase()
          : getBrand(initialProduct.product_name);
      setBrand(initialBrand);

      const resolvedType = inferProductType(initialProduct.product_name, initialProduct.product_type);
      setProductType(resolvedType);
      setMasterPackSize(
        inferMasterPackSize(initialProduct.product_name, resolvedType, initialProduct.master_pack_size)
      );

      setRetailCode(initialProduct.retail_code);
      setInStore(initialProduct.in_store);
      setTraxCode(initialProduct.trax_code || 'TRX-');
      setCampbellsCode(initialProduct.campbells_code || 'CMP-');
      setOneDistCode(initialProduct.onedistribution_code || 'OND-');
    } else {
      setGtin('');
      setProductName('');
      setBrand('');
      setProductType('Cigarettes');
      setMasterPackSize('10 Packs');
      setRetailCode('');
      setInStore(true);
      setTraxCode('TRX-');
      setCampbellsCode('CMP-');
      setOneDistCode('OND-');
    }
    setError(null);
  }, [isOpen, mode, initialProduct]);

  const handleSelectProductType = (newType: ProductType) => {
    setProductType(newType);
    if (newType === 'Cigarettes' && (masterPackSize === '5 Pouches' || !masterPackSize)) {
      setMasterPackSize('10 Packs');
    } else if (newType === 'Tobacco Pouch (RYO)' && (masterPackSize === '10 Packs' || !masterPackSize)) {
      setMasterPackSize('5 Pouches');
    } else if (
      newType === 'Other' &&
      (masterPackSize === '10 Packs' || masterPackSize === '5 Pouches' || !masterPackSize)
    ) {
      setMasterPackSize('Single / 1 Unit');
    }
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (brandContainerRef.current && !brandContainerRef.current.contains(event.target as Node)) {
        setIsBrandFocused(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  if (!isOpen) return null;

  const handleSelectBrand = (selectedBrand: string) => {
    setBrand(selectedBrand);
    setIsBrandFocused(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedGtin = gtin.trim();
    const trimmedName = productName.trim();
    const trimmedSku = retailCode.trim();
    const rawBrand = brand.trim().toUpperCase();
    const normalizedBrand = rawBrand || getBrand(trimmedName);
    const resolvedPackSize =
      masterPackSize.trim() ||
      (productType === 'Cigarettes'
        ? '10 Packs'
        : productType === 'Tobacco Pouch (RYO)'
        ? '5 Pouches'
        : 'Single');

    if (!trimmedGtin || !trimmedName || !trimmedSku) {
      setError('Please fill in required fields: GTIN barcode, Product Name, and Retail SKU.');
      return;
    }

    const isDuplicateGtin = existingProducts.some((p) => {
      if (mode === 'edit' && initialProduct && p.id === initialProduct.id) {
        return false;
      }
      return p.gtin === trimmedGtin;
    });

    if (isDuplicateGtin) {
      setError(`A product with GTIN barcode "${trimmedGtin}" already exists in the catalog.`);
      return;
    }

    const payload: Omit<ProductItem, 'id'> = {
      gtin: trimmedGtin,
      product_name: trimmedName,
      brand: normalizedBrand,
      product_type: productType,
      master_pack_size: resolvedPackSize,
      retail_code: trimmedSku,
      trax_code: traxCode.trim() || 'TRX-DEFAULT',
      campbells_code: campbellsCode.trim() || 'CMP-DEFAULT',
      onedistribution_code: oneDistCode.trim() || 'OND-DEFAULT',
      in_store: inStore,
      trax_price: initialProduct?.trax_price ?? 0,
      campbells_price: initialProduct?.campbells_price ?? 0,
      onedistribution_price: initialProduct?.onedistribution_price ?? 0,
    };

    onSave(payload, initialProduct?.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-lg my-6 rounded-xl bg-white shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5 bg-slate-50/70">
          <div className="flex items-center space-x-2.5">
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${currentTheme.classes.iconBg} ${currentTheme.classes.iconText}`}>
              {mode === 'add' ? <Plus className="h-4 w-4" /> : <Edit3 className="h-4 w-4" />}
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                {mode === 'add' ? 'Add New Catalog Item' : 'Edit Catalog Row'}
              </h2>
              <p className="text-[11px] text-slate-500">
                {mode === 'add'
                  ? 'Register product details, manual brand, and supplier lookup codes.'
                  : `Update GTIN, brand, SKU, and scraping codes for ${initialProduct?.product_name || 'item'}.`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-rose-50 p-2.5 text-xs font-medium text-rose-700 border border-rose-200">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">GTIN / Barcode *</label>
                  <button
                    type="button"
                    id="modal-scan-gtin-btn"
                    onClick={() => setScannerTarget('gtin')}
                    className="inline-flex items-center gap-1 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-2 py-0.5 text-[10px] font-bold transition cursor-pointer shadow-2xs"
                    title="Scan GTIN Barcode with Camera"
                  >
                    <Barcode className="h-3 w-3" />
                    <span>Scan</span>
                  </button>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="e.g. 9310704929271"
                    value={gtin}
                    onChange={(e) => setGtin(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 pl-3 pr-8 py-1.5 text-xs font-mono focus:border-slate-800 focus:ring-1 focus:ring-slate-800 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setScannerTarget('gtin')}
                    className="absolute right-2 top-2 text-slate-400 hover:text-indigo-600 transition"
                    title="Scan with Camera"
                  >
                    <Camera className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">Retail SKU / Barcode *</label>
                  <button
                    type="button"
                    id="modal-scan-sku-btn"
                    onClick={() => setScannerTarget('sku')}
                    className="inline-flex items-center gap-1 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-2 py-0.5 text-[10px] font-bold transition cursor-pointer shadow-2xs"
                    title="Scan Retail SKU / Barcode with Camera"
                  >
                    <Barcode className="h-3 w-3" />
                    <span>Scan</span>
                  </button>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="e.g. SKU-CHE-20-BLU or 9310704929271"
                    value={retailCode}
                    onChange={(e) => setRetailCode(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 pl-3 pr-8 py-1.5 text-xs font-mono focus:border-slate-800 focus:ring-1 focus:ring-slate-800 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setScannerTarget('sku')}
                    className="absolute right-2 top-2 text-slate-400 hover:text-indigo-600 transition"
                    title="Scan with Camera"
                  >
                    <Camera className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Product Type *</label>
                  <div className="grid grid-cols-3 gap-1.5" role="radiogroup">
                    <button
                      type="button"
                      onClick={() => handleSelectProductType('Cigarettes')}
                      className={`flex flex-col items-center justify-center p-2 rounded-lg border text-center transition cursor-pointer ${
                        productType === 'Cigarettes'
                          ? 'border-slate-900 bg-slate-900 text-white shadow-xs font-bold'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <span className="text-xs">🚬 Cigarettes</span>
                      <span
                        className={`text-[9px] mt-0.5 ${
                          productType === 'Cigarettes' ? 'text-slate-300' : 'text-slate-400'
                        }`}
                      >
                        Carton (20s/25s)
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSelectProductType('Tobacco Pouch (RYO)')}
                      className={`flex flex-col items-center justify-center p-2 rounded-lg border text-center transition cursor-pointer ${
                        productType === 'Tobacco Pouch (RYO)'
                          ? 'border-slate-900 bg-slate-900 text-white shadow-xs font-bold'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <span className="text-xs">🍂 Tobacco (RYO)</span>
                      <span
                        className={`text-[9px] mt-0.5 ${
                          productType === 'Tobacco Pouch (RYO)' ? 'text-slate-300' : 'text-slate-400'
                        }`}
                      >
                        30g / 50g Pouches
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSelectProductType('Other')}
                      className={`flex flex-col items-center justify-center p-2 rounded-lg border text-center transition cursor-pointer ${
                        productType === 'Other'
                          ? 'border-slate-900 bg-slate-900 text-white shadow-xs font-bold'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <span className="text-xs">📦 Other</span>
                      <span
                        className={`text-[9px] mt-0.5 ${
                          productType === 'Other' ? 'text-slate-300' : 'text-slate-400'
                        }`}
                      >
                        General FMCG
                      </span>
                    </button>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-700">Master Pack Size *</label>
                    <span className="text-[10px] text-slate-500 font-medium">Carton / Outer Units</span>
                  </div>
                  <div className="space-y-1.5">
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                        <Package className="h-3.5 w-3.5" />
                      </div>
                      <input
                        type="text"
                        required
                        placeholder="e.g. 10 Packs or 5 Pouches"
                        value={masterPackSize}
                        onChange={(e) => setMasterPackSize(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 pl-8 pr-3 py-1.5 text-xs font-semibold text-slate-800 bg-white focus:border-slate-800 focus:ring-1 focus:ring-slate-800 focus:outline-hidden"
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-1 text-[10px]">
                      <span className="text-slate-400 text-[10px]">Presets:</span>
                      {['10 Packs', '5 Pouches', '20 Packs', 'Single'].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setMasterPackSize(preset)}
                          className={`px-1.5 py-0.5 rounded border transition cursor-pointer ${
                            masterPackSize === preset
                              ? 'bg-slate-900 text-white border-slate-900 font-bold'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Product Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. CHESTERFIELD 20/200 ORIGINAL BLUE"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium focus:border-slate-800 focus:ring-1 focus:ring-slate-800 focus:outline-hidden"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Tip: Standard cigarette cartons typically contain 10 packs; RYO bundles typically contain 5 pouches.
              </p>
            </div>

            <div ref={brandContainerRef} className="relative">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Brand Name (Manual Entry &amp; Suggestions)
                </label>
                {brand.trim() ? (
                  isExactBrandMatch ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                      <Check className="h-3 w-3" />
                      Existing Brand
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                      <Sparkles className="h-3 w-3" />
                      New Brand to Register
                    </span>
                  )
                ) : (
                  <span className="text-[10px] text-slate-400">Type to search or add new</span>
                )}
              </div>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                  <Tag className="h-3.5 w-3.5" />
                </div>
                <input
                  type="text"
                  placeholder="e.g. PETER JACKSON, WINFIELD, MARLBORO..."
                  value={brand}
                  onFocus={() => setIsBrandFocused(true)}
                  onChange={(e) => {
                    setBrand(e.target.value);
                    setIsBrandFocused(true);
                  }}
                  className="w-full rounded-lg border border-slate-300 pl-8 pr-8 py-1.5 text-xs font-bold uppercase tracking-wider focus:border-slate-800 focus:ring-1 focus:ring-slate-800 focus:outline-hidden"
                />
                <button
                  type="button"
                  onClick={() => setIsBrandFocused(!isBrandFocused)}
                  className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </div>

              {isBrandFocused && (
                <div className="absolute left-0 right-0 z-20 mt-1 max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
                  <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    {filteredBrands.length > 0
                      ? `Existing Brands (${filteredBrands.length})`
                      : 'No Existing Brand Matches'}
                  </div>

                  {filteredBrands.map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => handleSelectBrand(b)}
                      className={`flex w-full items-center justify-between rounded px-2.5 py-1.5 text-left text-xs transition ${
                        brand.trim().toUpperCase() === b
                          ? `${currentTheme.classes.brandBadge} font-bold`
                          : 'hover:bg-slate-100 text-slate-800'
                      }`}
                    >
                      <span className="font-semibold">{b}</span>
                      {brand.trim().toUpperCase() === b && <Check className="h-3.5 w-3.5 shrink-0" />}
                    </button>
                  ))}

                  {brand.trim() && !isExactBrandMatch && (
                    <button
                      type="button"
                      onClick={() => {
                        setBrand(brand.trim().toUpperCase());
                        setIsBrandFocused(false);
                      }}
                      className="flex w-full items-center gap-1.5 rounded mt-1 border-t border-slate-100 px-2 py-1.5 text-left text-xs text-amber-800 bg-amber-50/70 hover:bg-amber-100 transition"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                      <span>
                        Use <strong className="font-bold">&quot;{brand.trim().toUpperCase()}&quot;</strong> as a new
                        brand
                      </span>
                    </button>
                  )}
                </div>
              )}

              {!brand && (
                <div className="mt-1.5 flex flex-wrap items-center gap-1">
                  <span className="text-[10px] text-slate-400 mr-1">Quick pick:</span>
                  {existingBrands.slice(0, 5).map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => handleSelectBrand(b)}
                      className="rounded bg-slate-100 hover:bg-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-700 transition"
                    >
                      {b}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center space-x-2 pt-1">
              <input
                type="checkbox"
                id="product-form-in-store"
                checked={inStore}
                onChange={(e) => setInStore(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer accent-slate-900"
              />
              <label
                htmlFor="product-form-in-store"
                className="text-xs font-medium text-slate-700 cursor-pointer select-none"
              >
                Active In-Store (Include in Main Price Match Dashboard)
              </label>
            </div>
          </div>

          <hr className="border-slate-200" />

          <div className="space-y-2.5">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Supplier Lookup Codes</h3>
              <p className="text-[11px] text-slate-500">
                Codes used by automated scrapers to fetch live wholesale prices.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-2.5 space-y-1">
                <label className="block text-[11px] font-bold text-slate-700">Trax Code</label>
                <input
                  type="text"
                  value={traxCode}
                  onChange={(e) => setTraxCode(e.target.value)}
                  placeholder="TRX-XXXX"
                  className="w-full rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-mono text-slate-800 focus:border-slate-800 focus:outline-hidden"
                />
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-2.5 space-y-1">
                <label className="block text-[11px] font-bold text-slate-700">Campbells Code</label>
                <input
                  type="text"
                  value={campbellsCode}
                  onChange={(e) => setCampbellsCode(e.target.value)}
                  placeholder="CMP-XXXX"
                  className="w-full rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-mono text-slate-800 focus:border-slate-800 focus:outline-hidden"
                />
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-2.5 space-y-1">
                <label className="block text-[11px] font-bold text-slate-700">One Dist Code</label>
                <input
                  type="text"
                  value={oneDistCode}
                  onChange={(e) => setOneDistCode(e.target.value)}
                  placeholder="OND-XXXX"
                  className="w-full rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-mono text-slate-800 focus:border-slate-800 focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`rounded-lg px-4 py-1.5 text-xs font-bold shadow-xs transition ${currentTheme.classes.primaryBtn}`}
            >
              {mode === 'add' ? 'Add Item to Database' : 'Save Row Changes'}
            </button>
          </div>
        </form>

        <BarcodeScannerModal
          isOpen={scannerTarget !== null}
          onClose={() => setScannerTarget(null)}
          onScan={(scannedCode) => {
            if (scannerTarget === 'gtin') {
              setGtin(scannedCode);
              if (!retailCode.trim()) {
                setRetailCode(scannedCode);
              }
            } else if (scannerTarget === 'sku') {
              setRetailCode(scannedCode);
            }
            setScannerTarget(null);
          }}
          title={scannerTarget === 'gtin' ? 'Scan GTIN Barcode' : 'Scan Retail SKU / Barcode'}
          subtitle="Point camera at the physical product packaging barcode."
          targetFieldLabel={scannerTarget === 'gtin' ? 'GTIN / Barcode' : 'Retail SKU Code'}
        />
      </div>
    </div>
  );
};
