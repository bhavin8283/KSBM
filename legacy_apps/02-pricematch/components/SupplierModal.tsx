import React, { useState } from 'react';
import { SupplierConfig, ScraperEngine } from '../types';
import { useTheme } from '../theme';
import { X, Building2, Lock, Code, Sliders, Check, Globe, Shield } from 'lucide-react';

interface SupplierModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (supplier: SupplierConfig) => void;
  initialSupplier?: SupplierConfig | null;
  mode: 'add' | 'edit';
}

export const SupplierModal: React.FC<SupplierModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialSupplier,
  mode,
}) => {
  const { currentTheme } = useTheme();

  const [activeTab, setActiveTab] = useState<'general' | 'credentials' | 'selectors' | 'advanced'>('general');

  const [name, setName] = useState(initialSupplier?.name || '');
  const [codePrefix, setCodePrefix] = useState(initialSupplier?.codePrefix || '');
  const [portalUrl, setPortalUrl] = useState(initialSupplier?.portalUrl || 'https://');
  const [loginUrl, setLoginUrl] = useState(initialSupplier?.loginUrl || 'https://');
  const [status, setStatus] = useState<SupplierConfig['status']>(initialSupplier?.status || 'active');
  const [engine, setEngine] = useState<ScraperEngine>(initialSupplier?.engine || 'Playwright (Stealth)');
  const [schedule, setSchedule] = useState(initialSupplier?.schedule || 'Daily at 06:00 AM AEST');

  const [accountNumber, setAccountNumber] = useState(initialSupplier?.credentials.accountNumber || '');
  const [usernameEnvKey, setUsernameEnvKey] = useState(initialSupplier?.credentials.usernameEnvKey || '');
  const [passwordEnvKey, setPasswordEnvKey] = useState(initialSupplier?.credentials.passwordEnvKey || '');
  const [pinOrTokenKey, setPinOrTokenKey] = useState(initialSupplier?.credentials.pinOrTokenKey || '');

  const [cardSelector, setCardSelector] = useState(initialSupplier?.selectors.cardSelector || '');
  const [priceSelector, setPriceSelector] = useState(initialSupplier?.selectors.priceSelector || '');
  const [skuSelector, setSkuSelector] = useState(initialSupplier?.selectors.skuSelector || '');
  const [stockSelector, setStockSelector] = useState(initialSupplier?.selectors.stockSelector || '');
  const [paginationSelector, setPaginationSelector] = useState(initialSupplier?.selectors.paginationSelector || '');
  const [ageGateSelector, setAgeGateSelector] = useState(initialSupplier?.selectors.ageGateSelector || '');

  const [ageGateBypass, setAgeGateBypass] = useState(initialSupplier?.specialHandling.ageGateBypass || false);
  const [stealthMode, setStealthMode] = useState(initialSupplier?.specialHandling.stealthMode ?? true);
  const [sessionCookiesPersist, setSessionCookiesPersist] = useState(
    initialSupplier?.specialHandling.sessionCookiesPersist ?? true
  );
  const [rateLimitDelayMs, setRateLimitDelayMs] = useState(initialSupplier?.specialHandling.rateLimitDelayMs || 1000);

  const [validationError, setValidationError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setValidationError('Please enter a supplier name.');
      setActiveTab('general');
      return;
    }

    if (!cardSelector.trim() || !priceSelector.trim()) {
      setValidationError('Product Card Selector and Price Selector are required for scraper extraction.');
      setActiveTab('selectors');
      return;
    }

    const finalSupplier: SupplierConfig = {
      id: initialSupplier?.id || `supplier-${Date.now()}`,
      name: trimmedName,
      codePrefix: (codePrefix.trim() || trimmedName.slice(0, 3)).toUpperCase(),
      portalUrl: portalUrl.trim(),
      loginUrl: loginUrl.trim(),
      status,
      engine,
      schedule: schedule.trim() || 'Daily at 06:00 AM AEST',
      credentials: {
        accountNumber: accountNumber.trim(),
        usernameEnvKey:
          usernameEnvKey.trim().toUpperCase() || `${trimmedName.replace(/\s+/g, '_').toUpperCase()}_USER`,
        passwordEnvKey:
          passwordEnvKey.trim().toUpperCase() || `${trimmedName.replace(/\s+/g, '_').toUpperCase()}_PASS`,
        pinOrTokenKey: pinOrTokenKey.trim().toUpperCase(),
      },
      selectors: {
        cardSelector: cardSelector.trim(),
        priceSelector: priceSelector.trim(),
        skuSelector: skuSelector.trim() || '.sku',
        stockSelector: stockSelector.trim(),
        paginationSelector: paginationSelector.trim(),
        ageGateSelector: ageGateSelector.trim(),
      },
      specialHandling: {
        ageGateBypass,
        stealthMode,
        sessionCookiesPersist,
        rateLimitDelayMs: Number(rateLimitDelayMs) || 1000,
      },
      lastScraped: initialSupplier?.lastScraped || 'Pending initial run',
      lastTestResult: initialSupplier?.lastTestResult,
    };

    onSave(finalSupplier);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50/80">
          <div className="flex items-center space-x-3">
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-lg ${currentTheme.classes.iconBg} ${currentTheme.classes.iconText} shadow-2xs`}
            >
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {mode === 'add' ? 'Add New Wholesale Supplier' : `Configure: ${initialSupplier?.name}`}
              </h2>
              <p className="text-xs text-slate-500">
                Configure portal URLs, authentication credential keys, and DOM selectors for automated scraping.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex border-b border-slate-200 bg-white px-6 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`py-3 px-3 border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'general'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Globe className="h-3.5 w-3.5" />
            <span>1. Portal &amp; Info</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('credentials')}
            className={`py-3 px-3 border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'credentials'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Lock className="h-3.5 w-3.5" />
            <span>2. Auth &amp; Vault</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('selectors')}
            className={`py-3 px-3 border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'selectors'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Code className="h-3.5 w-3.5" />
            <span>3. DOM Selectors</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('advanced')}
            className={`py-3 px-3 border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'advanced'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sliders className="h-3.5 w-3.5" />
            <span>4. Engine &amp; Stealth</span>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4">
            {validationError && (
              <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs font-semibold text-rose-800">
                {validationError}
              </div>
            )}

            {activeTab === 'general' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Supplier Company Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Metcash Wholesale, ALM Liquor & Tobacco"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:outline-hidden focus:border-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Code Prefix</label>
                    <input
                      type="text"
                      placeholder="e.g. MTC, ALM"
                      maxLength={5}
                      value={codePrefix}
                      onChange={(e) => setCodePrefix(e.target.value.toUpperCase())}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-900 focus:outline-hidden focus:border-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">B2B Portal Base URL</label>
                  <input
                    type="url"
                    placeholder="https://ordering.supplier.com.au"
                    value={portalUrl}
                    onChange={(e) => setPortalUrl(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900 focus:outline-hidden focus:border-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Sign-In / Authentication URL</label>
                  <input
                    type="url"
                    placeholder="https://ordering.supplier.com.au/customer/account/login"
                    value={loginUrl}
                    onChange={(e) => setLoginUrl(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900 focus:outline-hidden focus:border-slate-900"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Used by the headless scraper to establish an authenticated session cookie.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Operational Status</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as SupplierConfig['status'])}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:outline-hidden focus:border-slate-900 cursor-pointer"
                    >
                      <option value="active">Active (Scraped in Daily Run)</option>
                      <option value="testing">Testing (Sandbox Only)</option>
                      <option value="maintenance">Maintenance</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Cron Schedule</label>
                    <input
                      type="text"
                      placeholder="Daily at 06:00 AM AEST"
                      value={schedule}
                      onChange={(e) => setSchedule(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-hidden focus:border-slate-900"
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'credentials' && (
              <div className="space-y-4">
                <div className="rounded-lg bg-amber-50/70 border border-amber-200 p-3 text-xs text-amber-900 flex items-start gap-2">
                  <Shield className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-semibold">Security Guideline:</strong> Never store plaintext passwords in
                    code. Specify environment variable mapping keys (e.g. <code>TRAX_PORTAL_PASS</code>). The Python
                    scraper resolves them securely from <code>.env</code> or container secret vaults.
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Customer / Account Number (Public ID)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. TRX-CUST-88412"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900 focus:outline-hidden focus:border-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      PIN or 2FA Token Key (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. ONE_DIST_PORTAL_PIN"
                      value={pinOrTokenKey}
                      onChange={(e) => setPinOrTokenKey(e.target.value.toUpperCase())}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono uppercase tracking-wider text-slate-900 focus:outline-hidden focus:border-slate-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Username / Email Env Key</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-slate-400 font-mono text-xs">
                        $
                      </span>
                      <input
                        type="text"
                        placeholder="e.g. TRAX_PORTAL_USER"
                        value={usernameEnvKey}
                        onChange={(e) => setUsernameEnvKey(e.target.value.toUpperCase())}
                        className="w-full rounded-lg border border-slate-300 bg-white pl-6 pr-3 py-2 text-xs font-mono uppercase tracking-wider text-slate-900 focus:outline-hidden focus:border-slate-900"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Password Env Key</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-slate-400 font-mono text-xs">
                        $
                      </span>
                      <input
                        type="text"
                        placeholder="e.g. TRAX_PORTAL_PASS"
                        value={passwordEnvKey}
                        onChange={(e) => setPasswordEnvKey(e.target.value.toUpperCase())}
                        className="w-full rounded-lg border border-slate-300 bg-white pl-6 pr-3 py-2 text-xs font-mono uppercase tracking-wider text-slate-900 focus:outline-hidden focus:border-slate-900"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'selectors' && (
              <div className="space-y-3.5">
                <p className="text-xs text-slate-500">
                  CSS query selectors used by the headless scraping engine to target product cards, prices, and
                  pagination:
                </p>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Product Card Container Selector <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="div.product-item-info, tr.product-row, .product-card"
                    value={cardSelector}
                    onChange={(e) => setCardSelector(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900 focus:outline-hidden focus:border-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Wholesale Price Selector <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="span.special-price span.price, span.contract-price"
                    value={priceSelector}
                    onChange={(e) => setPriceSelector(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900 focus:outline-hidden focus:border-slate-900"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">SKU / Supplier Code Selector</label>
                    <input
                      type="text"
                      placeholder="span.sku, td.sku-code, .product-code"
                      value={skuSelector}
                      onChange={(e) => setSkuSelector(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900 focus:outline-hidden focus:border-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Stock Status Selector</label>
                    <input
                      type="text"
                      placeholder="div.stock.available, .badge-in-stock"
                      value={stockSelector}
                      onChange={(e) => setStockSelector(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900 focus:outline-hidden focus:border-slate-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Pagination Next Button Selector</label>
                    <input
                      type="text"
                      placeholder="a.action.next, li.page-item.next a"
                      value={paginationSelector}
                      onChange={(e) => setPaginationSelector(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900 focus:outline-hidden focus:border-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Age-Gate Modal Button Selector</label>
                    <input
                      type="text"
                      placeholder="#age-verification-modal button.confirm-18-plus"
                      value={ageGateSelector}
                      onChange={(e) => setAgeGateSelector(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900 focus:outline-hidden focus:border-slate-900"
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'advanced' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Scraping Driver Engine</label>
                  <select
                    value={engine}
                    onChange={(e) => setEngine(e.target.value as ScraperEngine)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:outline-hidden focus:border-slate-900 cursor-pointer"
                  >
                    <option value="Playwright (Stealth)">Playwright (Stealth Mode) — Recommended</option>
                    <option value="Requests / HTTP Session">Requests / HTTP Session (Fastest for static APIs)</option>
                    <option value="Selenium Chrome">Selenium Chrome WebDriver</option>
                    <option value="Scrapy Headless">Scrapy Headless Spider</option>
                  </select>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
                  <span className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Special Handling &amp; Bot Evasion
                  </span>

                  <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={ageGateBypass}
                      onChange={(e) => setAgeGateBypass(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-0 cursor-pointer"
                    />
                    <div>
                      <strong className="font-semibold text-slate-900">Tobacco Age-Gate Bypass:</strong>
                      <p className="text-[11px] text-slate-500">
                        Automatically dismisses or pre-injects 18+ verification cookies (used by One Distribution).
                      </p>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={stealthMode}
                      onChange={(e) => setStealthMode(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-0 cursor-pointer"
                    />
                    <div>
                      <strong className="font-semibold text-slate-900">Browser Fingerprint Masking (Stealth):</strong>
                      <p className="text-[11px] text-slate-500">
                        Overwrites navigator.webdriver, sets realistic canvas/webGL noise, and mimics genuine Chrome
                        user-agents.
                      </p>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={sessionCookiesPersist}
                      onChange={(e) => setSessionCookiesPersist(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-0 cursor-pointer"
                    />
                    <div>
                      <strong className="font-semibold text-slate-900">Session Cookie Vaulting:</strong>
                      <p className="text-[11px] text-slate-500">
                        Re-uses authenticated session cookies across runs to prevent frequent logins and account
                        lockouts.
                      </p>
                    </div>
                  </label>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-1">
                    <span>Rate-Limiting Politeness Delay</span>
                    <span className="font-mono text-slate-900">{rateLimitDelayMs} ms</span>
                  </div>
                  <input
                    type="range"
                    min={200}
                    max={4000}
                    step={50}
                    value={rateLimitDelayMs}
                    onChange={(e) => setRateLimitDelayMs(Number(e.target.value))}
                    className="w-full cursor-pointer accent-slate-900"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>Fast (200ms)</span>
                    <span>Standard (1000ms)</span>
                    <span>Stealthy / Slow (4000ms)</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-3.5">
            <div className="text-[11px] text-slate-500">
              {mode === 'edit'
                ? 'Updates apply immediately to scraping engine.'
                : 'New supplier will be added to the live testing hub.'}
            </div>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className={`inline-flex items-center space-x-1.5 rounded-lg px-4 py-1.5 text-xs font-bold shadow-xs transition cursor-pointer ${currentTheme.classes.primaryBtn}`}
              >
                <Check className="h-3.5 w-3.5" />
                <span>{mode === 'add' ? 'Add Supplier' : 'Save Configurations'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
