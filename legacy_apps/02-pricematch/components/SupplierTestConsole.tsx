import React, { useState, useEffect, useRef } from 'react';
import { SupplierConfig, ScraperLogEntry, SupplierTestSimulation } from '../types';
import { buildTestSimulationSteps, getSampleExtractedPayload } from '../constants/mockSuppliers';
import {
  Terminal,
  Play,
  RotateCw,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  Package,
  X,
  ShieldCheck,
} from 'lucide-react';

interface SupplierTestConsoleProps {
  supplier: SupplierConfig;
  isOpen: boolean;
  onClose: () => void;
  onUpdateTestResult?: (supplierId: string, result: SupplierConfig['lastTestResult']) => void;
}

export const SupplierTestConsole: React.FC<SupplierTestConsoleProps> = ({
  supplier,
  isOpen,
  onClose,
  onUpdateTestResult,
}) => {
  const [simulation, setSimulation] = useState<SupplierTestSimulation>({
    supplierId: supplier.id,
    isRunning: false,
    logs: [],
  });
  const [simulateError, setSimulateError] = useState(false);
  const [activeTab, setActiveTab] = useState<'console' | 'payload' | 'selectors'>('console');
  const consoleBottomRef = useRef<HTMLDivElement>(null);
  const timeoutsRef = useRef<number[]>([]);

  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  useEffect(() => {
    if (activeTab === 'console') {
      consoleBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [simulation.logs, activeTab]);

  const runTestSimulation = (withError = false) => {
    timeoutsRef.current.forEach((t) => window.clearTimeout(t));
    timeoutsRef.current = [];

    const startTime = Date.now();
    setSimulation({
      supplierId: supplier.id,
      isRunning: true,
      logs: [],
      result: undefined,
    });

    const steps = buildTestSimulationSteps(supplier, withError);
    let cumulativeDelay = 0;

    steps.forEach((step, index) => {
      cumulativeDelay += step.delayMs;
      const timeoutId = window.setTimeout(() => {
        const newLogEntry: ScraperLogEntry = {
          id: `log-${Date.now()}-${index}`,
          ...step.entry,
        };

        setSimulation((prev) => ({
          ...prev,
          logs: [...prev.logs, newLogEntry],
        }));

        if (index === steps.length - 1) {
          const latency = Math.max(160, Date.now() - startTime);
          const isSuccess = !withError && step.entry.level === 'success';

          const testResult = {
            success: isSuccess,
            latencyMs: latency,
            itemsFound: isSuccess ? 18 : 0,
            statusCode: isSuccess ? 200 : 401,
            message: isSuccess
              ? `Healthy: Scraped 18 items with 100% selector match in ${latency}ms.`
              : `Connection Failed: Authentication error on ${supplier.loginUrl}`,
            samplePayload: isSuccess ? getSampleExtractedPayload(supplier.name) : undefined,
          };

          setSimulation((prev) => ({
            ...prev,
            isRunning: false,
            result: testResult,
          }));

          if (onUpdateTestResult) {
            onUpdateTestResult(supplier.id, {
              status: isSuccess ? 'success' : 'failed',
              timestamp: 'Just now',
              latencyMs: latency,
              itemsExtracted: isSuccess ? 18 : 0,
              message: testResult.message,
            });
          }
        }
      }, cumulativeDelay);

      timeoutsRef.current.push(timeoutId);
    });
  };

  useEffect(() => {
    if (isOpen && simulation.logs.length === 0 && !simulation.isRunning) {
      runTestSimulation(simulateError);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="mt-4 rounded-xl border border-slate-800 bg-slate-950 text-slate-100 shadow-xl overflow-hidden animate-in fade-in duration-200"
      id={`live-testing-console-${supplier.id}`}
    >
      <div className="flex flex-wrap items-center justify-between border-b border-slate-800 bg-slate-900/90 px-4 py-2.5 gap-2">
        <div className="flex items-center space-x-2.5">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-500/20 text-emerald-400">
            <Terminal className="h-3.5 w-3.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-white tracking-wide">
                TEST CONSOLE: {supplier.name.toUpperCase()}
              </span>
              <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-300">
                {supplier.engine}
              </span>
              {simulation.isRunning ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-300 animate-pulse">
                  <RotateCw className="h-2.5 w-2.5 animate-spin" />
                  Testing Connection...
                </span>
              ) : simulation.result ? (
                simulation.result.success ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                    <CheckCircle2 className="h-2.5 w-2.5" />
                    Passed ({simulation.result.latencyMs}ms)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-semibold text-rose-300">
                    <XCircle className="h-2.5 w-2.5" />
                    Failed (HTTP {simulation.result.statusCode})
                  </span>
                )
              ) : (
                <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400">
                  Ready to Test
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 font-mono truncate max-w-xl">
              Target: <span className="text-slate-300">{supplier.loginUrl}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-lg bg-slate-800/80 p-0.5 border border-slate-700/60 text-[11px]">
            <button
              type="button"
              onClick={() => setActiveTab('console')}
              className={`px-2.5 py-1 rounded font-medium transition cursor-pointer ${
                activeTab === 'console' ? 'bg-slate-700 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Stream Logs ({simulation.logs.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('payload')}
              className={`px-2.5 py-1 rounded font-medium transition cursor-pointer ${
                activeTab === 'payload' ? 'bg-slate-700 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Extracted Payload (18)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('selectors')}
              className={`px-2.5 py-1 rounded font-medium transition cursor-pointer ${
                activeTab === 'selectors'
                  ? 'bg-slate-700 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Active Selectors
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition cursor-pointer"
            title="Close test console"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 border-b border-slate-800/80 bg-slate-900/40 divide-x divide-slate-800/80 text-xs">
        <div className="px-3.5 py-2 flex items-center justify-between">
          <span className="text-slate-400 flex items-center gap-1.5 text-[11px]">
            <Zap className="h-3 w-3 text-amber-400" />
            Latency:
          </span>
          <span className="font-mono font-bold text-white">
            {simulation.result ? `${simulation.result.latencyMs} ms` : '—'}
          </span>
        </div>
        <div className="px-3.5 py-2 flex items-center justify-between">
          <span className="text-slate-400 flex items-center gap-1.5 text-[11px]">
            <Package className="h-3 w-3 text-blue-400" />
            Items Found:
          </span>
          <span className="font-mono font-bold text-white">
            {simulation.result ? `${simulation.result.itemsFound} SKUs` : '—'}
          </span>
        </div>
        <div className="px-3.5 py-2 flex items-center justify-between">
          <span className="text-slate-400 flex items-center gap-1.5 text-[11px]">
            <ShieldCheck className="h-3 w-3 text-emerald-400" />
            Auth Vault:
          </span>
          <span className="font-mono font-semibold text-emerald-400 text-[11px]">
            ${`{${supplier.credentials.usernameEnvKey}}`}
          </span>
        </div>
        <div className="px-3.5 py-2 flex items-center justify-between">
          <span className="text-slate-400 flex items-center gap-1.5 text-[11px]">
            <Clock className="h-3 w-3 text-purple-400" />
            Schedule:
          </span>
          <span className="text-slate-300 font-medium text-[11px] truncate max-w-[110px]">{supplier.schedule}</span>
        </div>
      </div>

      <div className="p-3">
        {activeTab === 'console' && (
          <div className="font-mono text-xs space-y-1.5 bg-black/70 rounded-lg p-3 max-h-64 overflow-y-auto border border-slate-900 shadow-inner">
            {simulation.logs.length === 0 ? (
              <p className="text-slate-500 italic py-2">
                Click &quot;Run Live Test&quot; below to launch connection and scraper selector validation.
              </p>
            ) : (
              simulation.logs.map((log) => {
                let badgeColor = 'text-slate-400';
                let borderColor = 'border-slate-800';

                if (log.level === 'success') {
                  badgeColor = 'text-emerald-400 bg-emerald-950/40 border-emerald-800/40';
                  borderColor = 'border-emerald-900/40';
                } else if (log.level === 'auth') {
                  badgeColor = 'text-blue-400 bg-blue-950/40 border-blue-800/40';
                  borderColor = 'border-blue-900/40';
                } else if (log.level === 'extract') {
                  badgeColor = 'text-cyan-400 bg-cyan-950/40 border-cyan-800/40';
                  borderColor = 'border-cyan-900/40';
                } else if (log.level === 'warn') {
                  badgeColor = 'text-amber-400 bg-amber-950/40 border-amber-800/40';
                  borderColor = 'border-amber-900/40';
                } else if (log.level === 'error') {
                  badgeColor = 'text-rose-400 bg-rose-950/40 border-rose-800/40';
                  borderColor = 'border-rose-900/40';
                }

                return (
                  <div key={log.id} className={`rounded border px-2.5 py-1.5 bg-slate-950/60 ${borderColor} transition`}>
                    <div className="flex items-start gap-2">
                      <span className="text-[10px] text-slate-500 select-none">[{log.timestamp}]</span>
                      <div className="flex-1">
                        <p className={`font-semibold ${badgeColor.split(' ')[0]}`}>{log.text}</p>
                        {log.detail && <p className="text-[11px] text-slate-400 mt-0.5 select-all">&gt; {log.detail}</p>}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={consoleBottomRef} />
          </div>
        )}

        {activeTab === 'payload' && (
          <div className="bg-black/70 rounded-lg p-3 max-h-64 overflow-y-auto border border-slate-900 font-mono text-xs">
            <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-slate-800 text-[11px] text-slate-400">
              <span>Parsed Wholesale Price Payload Preview:</span>
              <span className="text-emerald-400">18 SKUs synchronized with catalog</span>
            </div>
            <div className="space-y-2">
              {getSampleExtractedPayload(supplier.name).map((item) => (
                <div
                  key={item.gtin}
                  className="flex items-center justify-between rounded border border-slate-800 bg-slate-900/50 p-2 text-[11px]"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white">{item.product_name}</span>
                      <span className="text-slate-400 text-[10px]">{item.gtin}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-400 text-[10px]">
                      <span>
                        Supplier SKU: <b className="text-slate-200">{item.sku}</b>
                      </span>
                      <span>&bull;</span>
                      <span className="text-emerald-400">{item.stock_status}</span>
                    </div>
                  </div>
                  <div className="text-right font-bold text-emerald-400 text-sm">
                    ${item.extracted_price.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'selectors' && (
          <div className="bg-black/70 rounded-lg p-3 max-h-64 overflow-y-auto border border-slate-900 font-mono text-xs space-y-2">
            <div className="text-[11px] text-slate-400 mb-2">Active CSS Selectors applied by the Playwright engine:</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
              <div className="rounded border border-slate-800 bg-slate-900/60 p-2">
                <span className="text-slate-400 block text-[10px]">Product Card Container:</span>
                <code className="text-emerald-300 font-semibold">{supplier.selectors.cardSelector}</code>
              </div>
              <div className="rounded border border-slate-800 bg-slate-900/60 p-2">
                <span className="text-slate-400 block text-[10px]">Wholesale Price Element:</span>
                <code className="text-amber-300 font-semibold">{supplier.selectors.priceSelector}</code>
              </div>
              <div className="rounded border border-slate-800 bg-slate-900/60 p-2">
                <span className="text-slate-400 block text-[10px]">Supplier SKU / Code:</span>
                <code className="text-blue-300 font-semibold">{supplier.selectors.skuSelector}</code>
              </div>
              <div className="rounded border border-slate-800 bg-slate-900/60 p-2">
                <span className="text-slate-400 block text-[10px]">Stock Status Indicator:</span>
                <code className="text-purple-300 font-semibold">{supplier.selectors.stockSelector || 'None'}</code>
              </div>
              <div className="rounded border border-slate-800 bg-slate-900/60 p-2">
                <span className="text-slate-400 block text-[10px]">Pagination Next Button:</span>
                <code className="text-slate-300 font-semibold">{supplier.selectors.paginationSelector || 'None'}</code>
              </div>
              <div className="rounded border border-slate-800 bg-slate-900/60 p-2">
                <span className="text-slate-400 block text-[10px]">Age-Gate Verification Modal:</span>
                <code className="text-rose-300 font-semibold">
                  {supplier.selectors.ageGateSelector || 'None (Cookie Bypass)'}
                </code>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between border-t border-slate-800 bg-slate-900/80 px-4 py-2.5 gap-2">
        <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 cursor-pointer">
          <input
            type="checkbox"
            checked={simulateError}
            onChange={(e) => setSimulateError(e.target.checked)}
            className="rounded border-slate-700 bg-slate-800 text-rose-500 focus:ring-0 cursor-pointer"
          />
          <span>Simulate Auth 401 Error</span>
        </label>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSimulation((prev) => ({ ...prev, logs: [], result: undefined }))}
            className="rounded px-2.5 py-1 text-xs text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            Clear Output
          </button>
          <button
            type="button"
            disabled={simulation.isRunning}
            onClick={() => runTestSimulation(simulateError)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold shadow-xs transition cursor-pointer ${
              simulation.isRunning
                ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
          >
            {simulation.isRunning ? <RotateCw className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5 fill-current" />}
            <span>{simulation.isRunning ? 'Running Scraper...' : 'Re-run Live Test'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
