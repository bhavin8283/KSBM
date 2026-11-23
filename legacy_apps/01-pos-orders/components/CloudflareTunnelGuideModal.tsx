import React, { useState } from 'react';
import {
  X,
  BookOpen,
  Terminal,
  Download,
  Copy,
  Check,
  ShieldCheck,
  ExternalLink,
  Server,
  Layers,
  HelpCircle,
  AlertCircle,
  FileCode,
  ArrowRight,
  Sparkles,
  Wifi,
} from 'lucide-react';
import { StoreLocation } from '../types';

interface CloudflareTunnelGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  stores?: StoreLocation[];
  selectedStoreId?: string;
}

export function CloudflareTunnelGuideModal({
  isOpen,
  onClose,
  stores = [],
  selectedStoreId,
}: CloudflareTunnelGuideModalProps) {
  const [activeTab, setActiveTab] = useState<'step_by_step' | 'script_generator' | 'troubleshooting'>('step_by_step');
  const [selectedStore, setSelectedStore] = useState<StoreLocation | undefined>(
    stores.find((s) => s.id === selectedStoreId) || stores[0]
  );
  const [customHostname, setCustomHostname] = useState(
    selectedStore?.cloudflared?.tunnelHostname || 'mssql.kwikstop.com.au'
  );
  const [customPort, setCustomPort] = useState(
    selectedStore?.cloudflared?.localPort || 14333
  );
  const [customToken, setCustomToken] = useState(
    selectedStore?.cloudflared?.tunnelToken || 'eyJhIjoiZjgxMmExMjM0NTY3ODkwIiwi...YOUR_TOKEN'
  );
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = (text: string, key: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleDownload = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Dynamic script generation based on parameters
  const batchScriptContent = `@echo off
:: ============================================================================
:: IdealPOS Cloudflare Tunnel Auto-Start Connector
:: Target Hostname: ${customHostname}
:: Local Bridge Port: ${customPort}
:: ============================================================================
TITLE IdealPOS Cloudflare Tunnel Connector - ${customHostname}
COLOR 0B

echo ============================================================================
echo [IdealPOS] Initializing Cloudflare Zero Trust Tunnel for ${customHostname}
echo ============================================================================

:: 1. Verify cloudflared executable exists in current folder or PATH
where cloudflared >nul 2>nul
if %errorlevel% neq 0 (
    if not exist "%~dp0cloudflared.exe" (
        echo [ERROR] cloudflared.exe not found!
        echo Please download cloudflared-windows-amd64.exe from:
        echo https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe
        echo and place it in the same directory as this script.
        pause
        exit /b 1
    )
    set "CF_EXE=%~dp0cloudflared.exe"
) else (
    set "CF_EXE=cloudflared"
)

:RUN_TUNNEL
echo [%DATE% %TIME%] Starting TCP proxy bridge on 127.0.0.1:${customPort}...
"%CF_EXE%" access tcp --hostname ${customHostname} --url 127.0.0.1:${customPort}

echo.
echo [WARNING] Cloudflare Tunnel disconnected or crashed. Restarting in 5 seconds...
timeout /t 5 /nobreak >nul
goto RUN_TUNNEL
`;

  const yamlConfigContent = `# ============================================================================
# Cloudflare Tunnel config.yml for IdealPOS Server
# Place in: %USERPROFILE%\\.cloudflared\\config.yml (Windows) or /etc/cloudflared/ (Linux)
# ============================================================================
tunnel: ${selectedStore?.cloudflared?.tunnelId || 'YOUR_TUNNEL_UUID_HERE'}
credentials-file: C:\\Program Files (x86)\\cloudflared\\${selectedStore?.cloudflared?.tunnelId || 'YOUR_TUNNEL_UUID'}.json

ingress:
  # Route MSSQL TCP traffic to IdealPOS SQL Server
  - hostname: ${customHostname}
    service: tcp://localhost:1433
  # Catch-all rule (required by Cloudflare)
  - service: http_status:404
`;

  const powershellServiceContent = `# ============================================================================
# IdealPOS Cloudflare Tunnel Windows Service Installer (Run as Administrator)
# ============================================================================
$ErrorActionPreference = "Stop"

Write-Host "[1/3] Downloading latest cloudflared executable for Windows..." -ForegroundColor Cyan
$installDir = "C:\\Program Files (x86)\\cloudflared"
if (!(Test-Path $installDir)) {
    New-Item -ItemType Directory -Path $installDir -Force | Out-Null
}

$cfExe = Join-Path $installDir "cloudflared.exe"
if (!(Test-Path $cfExe)) {
    Invoke-WebRequest -Uri "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe" -OutFile $cfExe
}

Write-Host "[2/3] Installing Windows Background Service with Tunnel Token..." -ForegroundColor Cyan
& "$cfExe" service install "${customToken}"

Write-Host "[3/3] Starting IdealPOS Tunnel Service..." -ForegroundColor Green
Start-Service "cloudflared" -ErrorAction SilentlyContinue

Write-Host "SUCCESS: IdealPOS Cloudflare Tunnel is now running permanently as a Windows Service!" -ForegroundColor Green
`;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Top Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 flex items-start justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600/80 text-white rounded-xl border border-indigo-400/30 shadow-md">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">
                  Cloudflare Tunnel Setup &amp; File Guide
                </h3>
                <span className="px-2 py-0.5 bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 rounded-md text-[10px] font-bold uppercase tracking-wider">
                  Zero Trust • No Port Forwarding
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Complete walkthrough for creating encrypted outbound QUIC tunnels to your local store IdealPOS SQL Servers.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-5 pt-3 border-b border-slate-200 bg-slate-50/70 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('step_by_step')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'step_by_step'
                ? 'border-indigo-600 text-indigo-700 bg-white rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-4 h-4" />
            1. Step-by-Step Setup Guide
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('script_generator')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'script_generator'
                ? 'border-indigo-600 text-indigo-700 bg-white rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileCode className="w-4 h-4" />
            2. Script &amp; Config Downloader
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('troubleshooting')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'troubleshooting'
                ? 'border-indigo-600 text-indigo-700 bg-white rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            3. Verification &amp; SQL Ports
          </button>
        </div>

        {/* Scrollable Body Content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 text-xs text-slate-700">
          {/* TAB 1: STEP BY STEP GUIDE */}
          {activeTab === 'step_by_step' && (
            <div className="space-y-6">
              <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-xl flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-bold text-indigo-950 text-xs block">
                    Why Cloudflare Tunnels for IdealPOS Multi-Store?
                  </span>
                  <p className="text-[11px] text-indigo-900 leading-relaxed">
                    Cloudflare Tunnels establish an outbound encrypted QUIC connection from your in-store POS computer to Cloudflare Edge. You do <strong>not</strong> need static public IPs, router port forwarding, or vulnerable open firewall ports (1433).
                  </p>
                </div>
              </div>

              {/* Steps timeline */}
              <div className="space-y-4">
                {/* Step 1 */}
                <div className="flex gap-3">
                  <div className="w-7 h-7 rounded-full bg-blue-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                    1
                  </div>
                  <div className="flex-1 space-y-2 pb-4 border-b border-slate-100">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-slate-900 text-sm">
                        Create Tunnel in Cloudflare Zero Trust Dashboard
                      </h4>
                      <a
                        href="https://one.dash.cloudflare.com"
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 hover:underline flex items-center gap-1 font-bold text-[11px]"
                      >
                        Open Zero Trust <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <p className="text-slate-600 text-[11px]">
                      Navigate to <strong>Networks &rarr; Tunnels</strong> in your Cloudflare Zero Trust dashboard. Click <strong>"Add a Tunnel"</strong>, select <strong>Cloudflared</strong> connector type, and assign a friendly name (e.g. <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-800">idealpos-store-4812</code>).
                    </p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex gap-3">
                  <div className="w-7 h-7 rounded-full bg-blue-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                    2
                  </div>
                  <div className="flex-1 space-y-2 pb-4 border-b border-slate-100">
                    <h4 className="font-bold text-slate-900 text-sm">
                      Install Cloudflared on the Local IdealPOS Machine
                    </h4>
                    <p className="text-slate-600 text-[11px]">
                      Under <strong>"Install and run a connector"</strong>, choose <strong>Windows</strong> (or 64-bit AMD64). Cloudflare will present you with an automated one-line PowerShell installer command containing your unique Tunnel Token:
                    </p>
                    <div className="bg-slate-900 text-slate-100 p-3 rounded-xl font-mono text-[11px] flex items-center justify-between">
                      <span className="truncate pr-2">
                        winget install --id Cloudflare.cloudflared -e &amp;&amp; cloudflared.exe service install eyJhIjoi...
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          handleCopy(
                            'winget install --id Cloudflare.cloudflared -e',
                            'winget_cmd'
                          )
                        }
                        className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 hover:text-white shrink-0 flex items-center gap-1 font-sans"
                      >
                        {copiedKey === 'winget_cmd' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        Copy
                      </button>
                    </div>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex gap-3">
                  <div className="w-7 h-7 rounded-full bg-blue-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                    3
                  </div>
                  <div className="flex-1 space-y-2 pb-4 border-b border-slate-100">
                    <h4 className="font-bold text-slate-900 text-sm">
                      Configure Public Hostname Routing (TCP Service)
                    </h4>
                    <p className="text-slate-600 text-[11px]">
                      In the Cloudflare Tunnel configuration, switch to the <strong>Public Hostname</strong> tab:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200 text-[11px]">
                      <div>
                        <span className="font-bold text-slate-500 block">Subdomain / Domain</span>
                        <span className="font-mono font-bold text-blue-700">mssql-store1.yourdomain.com</span>
                      </div>
                      <div>
                        <span className="font-bold text-slate-500 block">Type / Service</span>
                        <span className="font-mono font-bold text-indigo-700">TCP</span>
                      </div>
                      <div>
                        <span className="font-bold text-slate-500 block">URL Target</span>
                        <span className="font-mono font-bold text-emerald-700">localhost:1433</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Step 4 */}
                <div className="flex gap-3">
                  <div className="w-7 h-7 rounded-full bg-blue-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                    4
                  </div>
                  <div className="flex-1 space-y-2">
                    <h4 className="font-bold text-slate-900 text-sm">
                      Paste Hostname &amp; Port into Store Settings Here
                    </h4>
                    <p className="text-slate-600 text-[11px]">
                      Once saved in Cloudflare, paste your chosen hostname (e.g. <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-800">mssql-store1.yourdomain.com</code>) into the <strong>Stores Management</strong> tab in this app. The applet automatically connects and syncs live POS inventory and transactions!
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SCRIPT & CONFIG GENERATOR */}
          {activeTab === 'script_generator' && (
            <div className="space-y-5">
              {/* Store & Parameter selector */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <span className="font-bold text-slate-800 text-xs block">
                  Customize Parameters for Generator:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Store Preset
                    </label>
                    <select
                      value={selectedStore?.id || ''}
                      onChange={(e) => {
                        const st = stores.find((s) => s.id === e.target.value);
                        if (st) {
                          setSelectedStore(st);
                          setCustomHostname(st.cloudflared.tunnelHostname);
                          setCustomPort(st.cloudflared.localPort || 14333);
                        }
                      }}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold"
                    >
                      {stores.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Tunnel Hostname
                    </label>
                    <input
                      type="text"
                      value={customHostname}
                      onChange={(e) => setCustomHostname(e.target.value)}
                      placeholder="e.g. mssql-north.domain.com"
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Bridge Local Port
                    </label>
                    <input
                      type="number"
                      value={customPort}
                      onChange={(e) => setCustomPort(Number(e.target.value) || 14333)}
                      placeholder="14333"
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Script 1: Windows Batch File */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-800 text-white px-4 py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-emerald-400" />
                    <span className="font-bold text-xs">start-idealpos-tunnel.bat (Windows Batch Runner)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopy(batchScriptContent, 'bat_script')}
                      className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-slate-200 text-[11px] font-bold flex items-center gap-1"
                    >
                      {copiedKey === 'bat_script' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      Copy Script
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownload(`start-tunnel-${selectedStore?.code || 'store'}.bat`, batchScriptContent)}
                      className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 rounded text-white text-[11px] font-bold flex items-center gap-1"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download .BAT
                    </button>
                  </div>
                </div>
                <pre className="p-3 bg-slate-950 text-slate-200 font-mono text-[11px] overflow-x-auto max-h-48 whitespace-pre">
                  {batchScriptContent}
                </pre>
              </div>

              {/* Script 2: config.yml */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-800 text-white px-4 py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-amber-400" />
                    <span className="font-bold text-xs">config.yml (Cloudflared Ingress Rules)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopy(yamlConfigContent, 'yml_config')}
                      className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-slate-200 text-[11px] font-bold flex items-center gap-1"
                    >
                      {copiedKey === 'yml_config' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      Copy YAML
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownload('config.yml', yamlConfigContent)}
                      className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 rounded text-white text-[11px] font-bold flex items-center gap-1"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download config.yml
                    </button>
                  </div>
                </div>
                <pre className="p-3 bg-slate-950 text-slate-200 font-mono text-[11px] overflow-x-auto max-h-40 whitespace-pre">
                  {yamlConfigContent}
                </pre>
              </div>
            </div>
          )}

          {/* TAB 3: TROUBLESHOOTING & SQL VERIFICATION */}
          {activeTab === 'troubleshooting' && (
            <div className="space-y-4">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
                <div className="flex items-center gap-2 font-bold text-amber-900 text-xs">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  Common IdealPOS SQL Server Connection Checks:
                </div>
                <ul className="space-y-1.5 text-[11px] text-amber-800 list-disc pl-5">
                  <li>
                    <strong>SQL Server TCP/IP Protocol Enabled:</strong> In Windows Start Menu, open <em>SQL Server Configuration Manager</em> &rarr; <em>SQL Server Network Configuration</em> &rarr; <em>Protocols for SQLEXPRESS</em> &rarr; Ensure <strong>TCP/IP</strong> is set to <strong>Enabled</strong>.
                  </li>
                  <li>
                    <strong>Default TCP Port 1433:</strong> Under TCP/IP Properties &rarr; IP Addresses &rarr; Scroll down to <em>IPAll</em> &rarr; Set <strong>TCP Port</strong> to <code className="bg-amber-100 px-1 py-0.5 rounded font-bold">1433</code> and clear TCP Dynamic Ports.
                  </li>
                  <li>
                    <strong>SQL Server Authentication:</strong> Ensure SQL Server instance allows mixed mode authentication (SQL Server and Windows Authentication mode).
                  </li>
                  <li>
                    <strong>Windows Defender Firewall:</strong> Allow inbound TCP port 1433 for local connections on the host machine.
                  </li>
                </ul>
              </div>

              {/* Quick Port Test Script */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <span className="font-bold text-slate-800 text-xs block">
                  Quick Local SQL Port Verification (PowerShell):
                </span>
                <p className="text-[11px] text-slate-600">
                  Run this command on your POS server machine to check if port 1433 is listening:
                </p>
                <div className="bg-slate-900 text-emerald-400 p-3 rounded-xl font-mono text-[11px] flex items-center justify-between">
                  <span>Test-NetConnection -ComputerName 127.0.0.1 -Port 1433</span>
                  <button
                    type="button"
                    onClick={() =>
                      handleCopy('Test-NetConnection -ComputerName 127.0.0.1 -Port 1433', 'test_net_cmd')
                    }
                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 hover:text-white shrink-0 flex items-center gap-1 font-sans text-[10px]"
                  >
                    {copiedKey === 'test_net_cmd' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    Copy
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 px-5 py-3.5 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-500 font-medium">
            Need more help? Check Cloudflare Zero Trust official documentation.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
}
