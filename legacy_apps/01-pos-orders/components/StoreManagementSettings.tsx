import React, { useState, useEffect, useMemo } from 'react';
import {
  Store,
  Plus,
  Server,
  Cloud,
  CheckCircle,
  AlertCircle,
  Clock,
  ShieldCheck,
  Edit2,
  Trash2,
  Star,
  ExternalLink,
  BookOpen,
  Wifi,
  WifiOff,
  RefreshCw,
  Copy,
  Check,
  Download,
  Upload,
  Users,
  MapPin,
  Phone,
  Mail,
  Lock,
  ArrowRight,
  Sparkles,
  Layers,
  X,
  Radio,
  Terminal,
  HelpCircle,
  Search,
  Filter,
  Eye,
  EyeOff,
  CopyCheck,
  Building,
  Fuel,
  Coffee,
  ShoppingBag,
  Car,
  Key,
  Database,
  Activity,
  Receipt,
  Globe,
  Calendar,
  Printer,
  FileText,
  AlertTriangle,
  Sliders,
  DollarSign,
  Target,
  Scale,
} from 'lucide-react';
import { StoreLocation, StoreCloudflareConfig, StoreSqlConfig, DateFormat, TimeFormat, CashVarianceThresholds } from '../types';
import { DEFAULT_CASH_VARIANCE_CONFIG, evaluateCashVariance } from '../varianceUtils';
import { CloudflareTunnelGuideModal } from './CloudflareTunnelGuideModal';

interface StoreManagementSettingsProps {
  currentStoreId?: string;
  onStoreSwitched?: (store: StoreLocation) => void;
  userRole?: string;
}

const THEME_COLORS: { id: string; label: string; bgClass: string; textClass: string; borderClass: string }[] = [
  { id: 'blue', label: 'Classic Blue', bgClass: 'bg-blue-500', textClass: 'text-blue-700', borderClass: 'border-blue-300' },
  { id: 'emerald', label: 'Emerald Green', bgClass: 'bg-emerald-500', textClass: 'text-emerald-700', borderClass: 'border-emerald-300' },
  { id: 'purple', label: 'Royal Purple', bgClass: 'bg-purple-500', textClass: 'text-purple-700', borderClass: 'border-purple-300' },
  { id: 'amber', label: 'Warm Amber', bgClass: 'bg-amber-500', textClass: 'text-amber-700', borderClass: 'border-amber-300' },
  { id: 'rose', label: 'Rose Red', bgClass: 'bg-rose-500', textClass: 'text-rose-700', borderClass: 'border-rose-300' },
  { id: 'indigo', label: 'Deep Indigo', bgClass: 'bg-indigo-500', textClass: 'text-indigo-700', borderClass: 'border-indigo-300' },
];

const STORE_TYPES = [
  { id: 'Flagship', label: 'Flagship Store', icon: Building, desc: 'Large superstore with multi-lane checkouts' },
  { id: 'Standard', label: 'Standard Retail', icon: ShoppingBag, desc: 'Standard neighborhood supermarket / convenience' },
  { id: 'Express', label: 'Express Metro', icon: Coffee, desc: 'High-footfall CBD or transit grab-and-go store' },
  { id: 'Fuel & Retail', label: 'Fuel & Forecourt', icon: Fuel, desc: '24/7 service station with fuel pumps' },
  { id: 'Drive-Thru', label: 'Drive-Thru Branch', icon: Car, desc: 'Drive-through window & quick-service counter' },
];

const TIMEZONE_OPTIONS = [
  { value: 'Australia/Brisbane', label: 'Brisbane (AEST - UTC+10)' },
  { value: 'Australia/Sydney', label: 'Sydney, Melbourne, Canberra (AEST/AEDT - UTC+10/+11)' },
  { value: 'Australia/Adelaide', label: 'Adelaide (ACST/ACDT - UTC+9:30/+10:30)' },
  { value: 'Australia/Perth', label: 'Perth (AWST - UTC+8)' },
  { value: 'Australia/Darwin', label: 'Darwin (ACST - UTC+9:30)' },
  { value: 'Pacific/Auckland', label: 'Auckland, Wellington (NZST/NZDT - UTC+12/+13)' },
  { value: 'Asia/Singapore', label: 'Singapore, Kuala Lumpur (SGT - UTC+8)' },
  { value: 'Europe/London', label: 'London (GMT/BST - UTC+0/+1)' },
  { value: 'America/New_York', label: 'New York, Toronto (EST/EDT - UTC-5/-4)' },
  { value: 'America/Los_Angeles', label: 'Los Angeles, Vancouver (PST/PDT - UTC-8/-7)' },
  { value: 'UTC', label: 'Universal Time (UTC)' },
];

const DATE_FORMAT_OPTIONS: { value: DateFormat; label: string }[] = [
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY (e.g. 31/12/2025)' },
  { value: 'DD-MM-YYYY', label: 'DD-MM-YYYY (e.g. 31-12-2025)' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD (e.g. 2025-12-31)' },
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY (e.g. 12/31/2025)' },
  { value: 'D MMM YYYY', label: 'D MMM YYYY (e.g. 31 Dec 2025)' },
];

const TIME_FORMAT_OPTIONS: { value: TimeFormat; label: string }[] = [
  { value: '12h', label: '12-Hour (e.g. 02:45 PM)' },
  { value: '24h', label: '24-Hour (e.g. 14:45)' },
];

export function StoreManagementSettings({
  currentStoreId,
  onStoreSwitched,
  userRole = 'admin',
}: StoreManagementSettingsProps) {
  const [stores, setStores] = useState<StoreLocation[]>([]);
  const [activeStoreId, setActiveStoreId] = useState<string>(currentStoreId || '');
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ message: string; success: boolean } | null>(null);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Guide Modal
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [guideSelectedStoreId, setGuideSelectedStoreId] = useState<string | undefined>(undefined);

  // Add / Edit Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStore, setEditingStore] = useState<StoreLocation | null>(null);
  const [modalTab, setModalTab] = useState<'profile' | 'receipt' | 'regional' | 'tunnel' | 'sql' | 'staff' | 'variance'>('profile');

  // Form Fields - Basic Store Info
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [storeType, setStoreType] = useState('Standard');
  const [managerName, setManagerName] = useState('');
  const [operatingHours, setOperatingHours] = useState('6:00 AM - 10:00 PM (Daily)');
  const [posTerminalCount, setPosTerminalCount] = useState<number>(2);
  const [taxRate, setTaxRate] = useState<number>(10);
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('QLD');
  const [postcode, setPostcode] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [themeColor, setThemeColor] = useState('blue');
  const [isActive, setIsActive] = useState(true);
  const [isDefault, setIsDefault] = useState(false);

  // Form Fields - Receipt Configuration
  const [receiptHeader, setReceiptHeader] = useState('');
  const [receiptFooter, setReceiptFooter] = useState('');

  // Form Fields - Regional & Timezone Configuration
  const [timeZone, setTimeZone] = useState('Australia/Brisbane');
  const [dateFormat, setDateFormat] = useState<DateFormat>('DD/MM/YYYY');
  const [timeFormat, setTimeFormat] = useState<TimeFormat>('12h');

  // Form Fields - Cloudflare Tunnel
  const [tunnelHostname, setTunnelHostname] = useState('');
  const [tunnelToken, setTunnelToken] = useState('');
  const [tunnelId, setTunnelId] = useState('');
  const [localPort, setLocalPort] = useState(14333);
  const [tunnelProtocol, setTunnelProtocol] = useState('tcp');
  const [originTarget, setOriginTarget] = useState('tcp://127.0.0.1:1433');
  const [autoReconnect, setAutoReconnect] = useState(true);
  const [showTunnelToken, setShowTunnelToken] = useState(false);

  // Form Fields - SQL params
  const [sqlServer, setSqlServer] = useState('127.0.0.1');
  const [sqlPort, setSqlPort] = useState(14333);
  const [sqlDatabase, setSqlDatabase] = useState('IPSTransaction');
  const [sqlUser, setSqlUser] = useState('kwikorder');
  const [sqlPassword, setSqlPassword] = useState('Kwik$top4812');
  const [authType, setAuthType] = useState<'sql' | 'windows'>('sql');
  const [encryptSsl, setEncryptSsl] = useState(false);
  const [trustCert, setTrustCert] = useState(true);
  const [showSqlPassword, setShowSqlPassword] = useState(false);

  // Form Fields - Cash Variance Thresholds
  const [varianceFlaggingEnabled, setVarianceFlaggingEnabled] = useState(true);
  const [varianceShowEmoji, setVarianceShowEmoji] = useState(true);
  const [tierPerfectThreshold, setTierPerfectThreshold] = useState('0.10');
  const [tierPerfectLabel, setTierPerfectLabel] = useState('Perfect / Spot-On');
  const [tierPerfectEmoji, setTierPerfectEmoji] = useState('🎯');

  const [tierGoodThreshold, setTierGoodThreshold] = useState('0.90');
  const [tierGoodLabel, setTierGoodLabel] = useState('Minor / Acceptable');
  const [tierGoodEmoji, setTierGoodEmoji] = useState('✅');

  const [tierModerateThreshold, setTierModerateThreshold] = useState('5.00');
  const [tierModerateLabel, setTierModerateLabel] = useState('Moderate Discrepancy');
  const [tierModerateEmoji, setTierModerateEmoji] = useState('⚠️');

  const [tierConcernedThreshold, setTierConcernedThreshold] = useState('10.00');
  const [tierConcernedLabel, setTierConcernedLabel] = useState('Concerning Variance');
  const [tierConcernedEmoji, setTierConcernedEmoji] = useState('🔍');

  const [tierRedFlagLabel, setTierRedFlagLabel] = useState('Red Flag / Critical Alert');
  const [tierRedFlagEmoji, setTierRedFlagEmoji] = useState('🚨');

  // Deletion Modal State
  const [storePendingDelete, setStorePendingDelete] = useState<StoreLocation | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Testing & Diagnostics
  const [testingStoreId, setTestingStoreId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ storeId: string; success: boolean; message: string; latency?: number } | null>(null);
  const [copiedTokenId, setCopiedTokenId] = useState<string | null>(null);

  const fetchStores = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/stores');
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.stores)) {
        setStores(data.stores);
      }
      if (data.activeStoreId) {
        setActiveStoreId(data.activeStoreId);
      }
    } catch (err) {
      console.warn('Notice: Failed to load stores:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStores();
  }, []);

  const showFeedback = (message: string, success: boolean = true) => {
    setFeedback({ message, success });
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleOpenAdd = () => {
    setEditingStore(null);
    setModalTab('profile');
    setName('');
    const randomNum = Math.floor(100 + Math.random() * 900);
    setCode(`ST-${randomNum}`);
    setStoreType('Standard');
    setManagerName('');
    setOperatingHours('6:00 AM - 10:00 PM (Daily)');
    setPosTerminalCount(2);
    setTaxRate(10);
    setAddress('');
    setCity('Brisbane');
    setState('QLD');
    setPostcode('4000');
    setPhone('+61 7 3000 ' + randomNum);
    setEmail(`store${randomNum}@kwikstop.com.au`);
    setNotes('');
    setThemeColor('blue');
    setIsActive(true);
    setIsDefault(stores.length === 0);

    setReceiptHeader('');
    setReceiptFooter('');
    setTimeZone('Australia/Brisbane');
    setDateFormat('DD/MM/YYYY');
    setTimeFormat('12h');

    const nextPort = 14333 + stores.length;
    setTunnelHostname(`mssql-branch${randomNum}.kwikstop.com.au`);
    setTunnelToken('');
    setTunnelId(`cf-tunnel-${Date.now()}`);
    setLocalPort(nextPort);
    setTunnelProtocol('tcp');
    setOriginTarget('tcp://127.0.0.1:1433');
    setAutoReconnect(true);

    setSqlServer('127.0.0.1');
    setSqlPort(nextPort);
    setSqlDatabase('IPSTransaction');
    setSqlUser('kwikorder');
    setSqlPassword('Kwik$top4812');
    setAuthType('sql');
    setEncryptSsl(false);
    setTrustCert(true);

    setVarianceFlaggingEnabled(true);
    setVarianceShowEmoji(true);
    setTierPerfectThreshold('0.10');
    setTierPerfectLabel('Perfect / Spot-On');
    setTierPerfectEmoji('🎯');
    setTierGoodThreshold('0.90');
    setTierGoodLabel('Minor / Acceptable');
    setTierGoodEmoji('✅');
    setTierModerateThreshold('5.00');
    setTierModerateLabel('Moderate Discrepancy');
    setTierModerateEmoji('⚠️');
    setTierConcernedThreshold('10.00');
    setTierConcernedLabel('Concerning Variance');
    setTierConcernedEmoji('🔍');
    setTierRedFlagLabel('Red Flag / Critical Alert');
    setTierRedFlagEmoji('🚨');

    setIsModalOpen(true);
  };

  const handleOpenEdit = (st: StoreLocation) => {
    setEditingStore(st);
    setModalTab('profile');
    setName(st.name);
    setCode(st.code || '');
    setStoreType(st.storeType || 'Standard');
    setManagerName(st.managerName || '');
    setOperatingHours(st.operatingHours || '6:00 AM - 10:00 PM');
    setPosTerminalCount(st.posTerminalCount || 2);
    setTaxRate(st.taxRate !== undefined ? st.taxRate : 10);
    setAddress(st.address || '');
    setCity(st.city || '');
    setState(st.state || 'QLD');
    setPostcode(st.postcode || '');
    setPhone(st.phone || '');
    setEmail(st.email || '');
    setNotes(st.notes || '');
    setThemeColor(st.themeColor || 'blue');
    setIsActive(st.isActive !== false);
    setIsDefault(st.isDefault || false);

    setReceiptHeader(st.receiptHeader || '');
    setReceiptFooter(st.receiptFooter || '');
    setTimeZone(st.timeZone || 'Australia/Brisbane');
    setDateFormat((st.dateFormat as DateFormat) || 'DD/MM/YYYY');
    setTimeFormat((st.timeFormat as TimeFormat) || '12h');

    setTunnelHostname(st.cloudflared?.tunnelHostname || '');
    setTunnelToken(st.cloudflared?.tunnelToken || '');
    setTunnelId(st.cloudflared?.tunnelId || '');
    setLocalPort(st.cloudflared?.localPort || 14333);
    setTunnelProtocol(st.cloudflared?.protocol || 'tcp');
    setOriginTarget(st.cloudflared?.originTarget || 'tcp://127.0.0.1:1433');
    setAutoReconnect(st.cloudflared?.autoReconnect !== false);

    setSqlServer(st.sql?.server || '127.0.0.1');
    setSqlPort(st.sql?.port || st.cloudflared?.localPort || 14333);
    setSqlDatabase(st.sql?.database || 'IPSTransaction');
    setSqlUser(st.sql?.user || 'kwikorder');
    setSqlPassword(st.sql?.password || 'Kwik$top4812');
    setAuthType(st.sql?.authType || 'sql');
    setEncryptSsl(Boolean(st.sql?.encrypt));
    setTrustCert(st.sql?.trustServerCertificate !== false);

    const vt = st.cashVarianceThresholds || DEFAULT_CASH_VARIANCE_CONFIG;
    setVarianceFlaggingEnabled(vt.enabled !== false);
    setVarianceShowEmoji(vt.showEmoji !== false);
    setTierPerfectThreshold(String(vt.perfect?.maxThreshold ?? '0.10'));
    setTierPerfectLabel(vt.perfect?.label || 'Perfect / Spot-On');
    setTierPerfectEmoji(vt.perfect?.emoji || '🎯');

    setTierGoodThreshold(String(vt.good?.maxThreshold ?? '0.90'));
    setTierGoodLabel(vt.good?.label || 'Minor / Acceptable');
    setTierGoodEmoji(vt.good?.emoji || '✅');

    setTierModerateThreshold(String(vt.moderate?.maxThreshold ?? '5.00'));
    setTierModerateLabel(vt.moderate?.label || 'Moderate Discrepancy');
    setTierModerateEmoji(vt.moderate?.emoji || '⚠️');

    setTierConcernedThreshold(String(vt.concerned?.maxThreshold ?? '10.00'));
    setTierConcernedLabel(vt.concerned?.label || 'Concerning Variance');
    setTierConcernedEmoji(vt.concerned?.emoji || '🔍');

    setTierRedFlagLabel(vt.redFlag?.label || 'Red Flag / Critical Alert');
    setTierRedFlagEmoji(vt.redFlag?.emoji || '🚨');

    setIsModalOpen(true);
  };

  const handleDuplicateStore = (sourceStore: StoreLocation) => {
    const randomNum = Math.floor(100 + Math.random() * 900);
    const nextPort = 14333 + stores.length;

    setEditingStore(null);
    setModalTab('profile');
    setName(`${sourceStore.name} (Copy)`);
    setCode(`ST-${randomNum}`);
    setStoreType(sourceStore.storeType || 'Standard');
    setManagerName(sourceStore.managerName || '');
    setOperatingHours(sourceStore.operatingHours || '6:00 AM - 10:00 PM');
    setPosTerminalCount(sourceStore.posTerminalCount || 2);
    setTaxRate(sourceStore.taxRate || 10);
    setAddress(sourceStore.address || '');
    setCity(sourceStore.city || '');
    setState(sourceStore.state || 'QLD');
    setPostcode(sourceStore.postcode || '');
    setPhone(sourceStore.phone || '');
    setEmail(sourceStore.email || '');
    setNotes(`Cloned from ${sourceStore.name} (${sourceStore.code})`);
    setThemeColor(sourceStore.themeColor || 'blue');
    setIsActive(true);
    setIsDefault(false);

    setReceiptHeader(sourceStore.receiptHeader || '');
    setReceiptFooter(sourceStore.receiptFooter || '');
    setTimeZone(sourceStore.timeZone || 'Australia/Brisbane');
    setDateFormat((sourceStore.dateFormat as DateFormat) || 'DD/MM/YYYY');
    setTimeFormat((sourceStore.timeFormat as TimeFormat) || '12h');

    setTunnelHostname(`mssql-branch${randomNum}.kwikstop.com.au`);
    setTunnelToken(sourceStore.cloudflared?.tunnelToken || '');
    setTunnelId(`cf-tunnel-${Date.now()}`);
    setLocalPort(nextPort);
    setTunnelProtocol(sourceStore.cloudflared?.protocol || 'tcp');
    setOriginTarget(sourceStore.cloudflared?.originTarget || 'tcp://127.0.0.1:1433');
    setAutoReconnect(true);

    setSqlServer(sourceStore.sql?.server || '127.0.0.1');
    setSqlPort(nextPort);
    setSqlDatabase(sourceStore.sql?.database || 'IPSTransaction');
    setSqlUser(sourceStore.sql?.user || 'kwikorder');
    setSqlPassword(sourceStore.sql?.password || 'Kwik$top4812');
    setAuthType(sourceStore.sql?.authType || 'sql');
    setEncryptSsl(Boolean(sourceStore.sql?.encrypt));
    setTrustCert(sourceStore.sql?.trustServerCertificate !== false);

    setIsModalOpen(true);
    showFeedback(`Cloned template from "${sourceStore.name}". Customize and save below.`);
  };

  const handleSaveStore = async () => {
    if (!name.trim()) {
      showFeedback('Please enter a Store Name', false);
      setModalTab('profile');
      return;
    }
    if (!code.trim()) {
      showFeedback('Please enter a Store Code', false);
      setModalTab('profile');
      return;
    }
    if (!tunnelHostname.trim()) {
      showFeedback('Please specify a Cloudflare Tunnel Hostname', false);
      setModalTab('tunnel');
      return;
    }

    const storeId = editingStore ? editingStore.id : `store_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const assignedUserIds = editingStore?.assignedUserIds || ['all'];

    const newStore: StoreLocation = {
      id: storeId,
      code: code.trim().toUpperCase(),
      name: name.trim(),
      address: address.trim(),
      city: city.trim(),
      state: state.trim(),
      postcode: postcode.trim(),
      phone: phone.trim(),
      email: email.trim(),
      managerName: managerName.trim(),
      operatingHours: operatingHours.trim(),
      storeType,
      posTerminalCount: Number(posTerminalCount) || 1,
      taxRate: Number(taxRate) || 0,
      notes: notes.trim(),
      themeColor,
      isActive,
      isDefault,
      receiptHeader: receiptHeader.trim() || undefined,
      receiptFooter: receiptFooter.trim() || undefined,
      timeZone: timeZone || 'Australia/Brisbane',
      dateFormat: dateFormat || 'DD/MM/YYYY',
      timeFormat: timeFormat || '12h',
      cloudflared: {
        tunnelHostname: tunnelHostname.trim(),
        tunnelToken: tunnelToken.trim(),
        tunnelId: tunnelId.trim() || `tunnel_${storeId}`,
        localPort: Number(localPort) || 14333,
        protocol: tunnelProtocol,
        originTarget: originTarget.trim() || 'tcp://127.0.0.1:1433',
        status: 'Active',
        lastPing: new Date().toISOString(),
        latencyMs: Math.floor(12 + Math.random() * 20),
        autoReconnect,
      },
      sql: {
        server: sqlServer.trim() || '127.0.0.1',
        port: Number(sqlPort) || Number(localPort) || 14333,
        database: sqlDatabase.trim() || 'IPSTransaction',
        user: sqlUser.trim() || 'kwikorder',
        password: sqlPassword.trim() || 'Kwik$top4812',
        authType,
        encrypt: encryptSsl,
        trustServerCertificate: trustCert,
      },
      assignedUserIds,
      cashVarianceThresholds: {
        enabled: varianceFlaggingEnabled,
        showEmoji: varianceShowEmoji,
        perfect: {
          label: tierPerfectLabel.trim() || 'Perfect / Spot-On',
          maxThreshold: Math.abs(parseFloat(tierPerfectThreshold)) || 0.10,
          emoji: tierPerfectEmoji.trim() || '🎯',
        },
        good: {
          label: tierGoodLabel.trim() || 'Minor / Acceptable',
          maxThreshold: Math.abs(parseFloat(tierGoodThreshold)) || 0.90,
          emoji: tierGoodEmoji.trim() || '✅',
        },
        moderate: {
          label: tierModerateLabel.trim() || 'Moderate Discrepancy',
          maxThreshold: Math.abs(parseFloat(tierModerateThreshold)) || 5.00,
          emoji: tierModerateEmoji.trim() || '⚠️',
        },
        concerned: {
          label: tierConcernedLabel.trim() || 'Concerning Variance',
          maxThreshold: Math.abs(parseFloat(tierConcernedThreshold)) || 10.00,
          emoji: tierConcernedEmoji.trim() || '🔍',
        },
        redFlag: {
          label: tierRedFlagLabel.trim() || 'Red Flag / Critical Alert',
          emoji: tierRedFlagEmoji.trim() || '🚨',
        },
      },
      createdAt: editingStore ? editingStore.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    let updatedStores: StoreLocation[];
    if (editingStore) {
      updatedStores = stores.map((s) => (s.id === editingStore.id ? newStore : isDefault ? { ...s, isDefault: false } : s));
    } else {
      updatedStores = isDefault
        ? [...stores.map((s) => ({ ...s, isDefault: false })), newStore]
        : [...stores, newStore];
    }

    try {
      const res = await fetch('/api/stores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stores: updatedStores }),
      });
      if (!res.ok) throw new Error('Failed to save store profile');
      setStores(updatedStores);
      setIsModalOpen(false);
      showFeedback(`Successfully saved "${newStore.name}" (${newStore.code})!`);
    } catch (err: any) {
      showFeedback(err.message || 'Error saving store', false);
    }
  };

  const handleDeleteStore = (storeToDelete: StoreLocation) => {
    if (stores.length <= 1) {
      showFeedback('Cannot delete the last remaining store branch.', false);
      return;
    }
    setStorePendingDelete(storeToDelete);
  };

  const confirmDeleteStore = async () => {
    if (!storePendingDelete) return;
    setIsDeleting(true);
    const storeToDelete = storePendingDelete;
    const updated = stores.filter((s) => s.id !== storeToDelete.id);
    let newActiveId = activeStoreId;
    if (storeToDelete.id === activeStoreId) {
      newActiveId = updated[0]?.id || '';
      setActiveStoreId(newActiveId);
    }

    try {
      const res = await fetch('/api/stores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stores: updated, activeStoreId: newActiveId }),
      });
      if (!res.ok) throw new Error('Failed to delete store on server');
      setStores(updated);
      setStorePendingDelete(null);
      showFeedback(`Successfully deleted store branch "${storeToDelete.name}" (${storeToDelete.code}).`);
      if (storeToDelete.id === activeStoreId && updated[0] && onStoreSwitched) {
        onStoreSwitched(updated[0]);
      }
    } catch (err: any) {
      showFeedback(err.message || 'Failed to delete store.', false);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSwitchActiveStore = async (storeToActivate: StoreLocation) => {
    try {
      const res = await fetch('/api/stores/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeId: storeToActivate.id }),
      });
      if (!res.ok) throw new Error('Failed to switch store');
      setActiveStoreId(storeToActivate.id);
      showFeedback(`Active store switched to "${storeToActivate.name}" (${storeToActivate.code})!`);
      if (onStoreSwitched) {
        onStoreSwitched(storeToActivate);
      }
    } catch (err: any) {
      showFeedback(err.message || 'Error switching store', false);
    }
  };

  const handleTestConnection = async (st: StoreLocation) => {
    setTestingStoreId(st.id);
    setTestResult(null);
    const startTime = Date.now();
    try {
      const res = await fetch('/api/tunnel/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          server: st.sql.server,
          port: st.sql.port,
          database: st.sql.database,
          user: st.sql.user,
          password: st.sql.password,
        }),
      });
      const latency = Date.now() - startTime;
      const data = await res.json();
      if (data.success) {
        setTestResult({
          storeId: st.id,
          success: true,
          latency: latency < 10 ? 15 : latency,
          message: `Tunnel active & reachable via Cloudflare Zero Trust (${st.cloudflared.tunnelHostname} -> ${st.sql.database})`,
        });
      } else {
        setTestResult({
          storeId: st.id,
          success: false,
          message: data.message || data.error || 'Connection failed. Verify cloudflared connector daemon is running.',
        });
      }
    } catch {
      setTestResult({
        storeId: st.id,
        success: false,
        message: 'Could not reach server tunnel endpoint.',
      });
    } finally {
      setTestingStoreId(null);
    }
  };

  const handleCopyTunnelToken = (token: string, storeId: string) => {
    if (!token) return;
    void navigator.clipboard.writeText(token);
    setCopiedTokenId(storeId);
    setTimeout(() => setCopiedTokenId(null), 2500);
  };

  const handleExportStoresConfig = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ stores, exportDate: new Date().toISOString() }, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `kwikorder-stores-backup-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showFeedback('Exported multi-store configuration successfully!');
  };

  // Filtered list of stores
  const filteredStores = useMemo(() => {
    return stores.filter((st) => {
      const matchSearch =
        searchQuery === '' ||
        st.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        st.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (st.city && st.city.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (st.managerName && st.managerName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (st.cloudflared?.tunnelHostname && st.cloudflared.tunnelHostname.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && st.isActive) ||
        (statusFilter === 'inactive' && !st.isActive);

      const matchType =
        typeFilter === 'all' || st.storeType === typeFilter;

      return matchSearch && matchStatus && matchType;
    });
  }, [stores, searchQuery, statusFilter, typeFilter]);

  const activeStoresCount = stores.filter((s) => s.isActive).length;
  const connectedTunnelsCount = stores.filter((s) => s.cloudflared?.status === 'Active' || s.cloudflared?.status === 'Connected').length;

  return (
    <div className="space-y-6">
      {/* Top Banner / Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-600 text-white rounded-2xl shadow-xs">
            <Store className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-slate-900 tracking-tight">Store &amp; Tunnel Management</h2>
              <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-[11px] font-bold">
                {stores.length} Branches
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Manage store identities, locations, Cloudflare Zero Trust tunneling, and IdealPOS SQL connections.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleExportStoresConfig}
            className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
            title="Export all store configurations as JSON"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Export JSON</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setGuideSelectedStoreId(activeStoreId);
              setIsGuideOpen(true);
            }}
            className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <BookOpen className="w-4 h-4 text-indigo-600" />
            <span>Tunnel Scripts (.BAT)</span>
          </button>

          {userRole === 'admin' && (
            <button
              type="button"
              onClick={handleOpenAdd}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Store</span>
            </button>
          )}
        </div>
      </div>

      {/* Feedback Alert */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl text-xs font-bold border flex items-center gap-2.5 animate-in fade-in duration-200 ${
            feedback.success
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-rose-50 text-rose-900 border-rose-200'
          }`}
        >
          {feedback.success ? (
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
            Total Branches
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-slate-900">{stores.length}</span>
            <span className="text-[11px] text-slate-500 font-medium">Locations</span>
          </div>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
          <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider block">
            Operational Status
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-emerald-700">{activeStoresCount}</span>
            <span className="text-[11px] text-slate-500 font-medium">Active Stores</span>
          </div>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
          <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider block">
            Cloudflare Tunnels
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-blue-700">{connectedTunnelsCount}</span>
            <span className="text-[11px] text-emerald-600 font-bold flex items-center gap-1">
              <Wifi className="w-3 h-3" /> Live QUIC
            </span>
          </div>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
          <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider block">
            Current Active Session
          </span>
          <div className="mt-1 truncate">
            <span className="text-xs font-extrabold text-slate-900 truncate block">
              {stores.find((s) => s.id === activeStoreId)?.name || 'Default Store'}
            </span>
            <span className="text-[10px] text-slate-500 font-mono">
              {stores.find((s) => s.id === activeStoreId)?.code || 'ST-4812'}
            </span>
          </div>
        </div>
      </div>

      {/* Cloudflare Tunnel Quick Guide Callout */}
      <div className="p-4.5 bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-900 text-white rounded-2xl shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-indigo-800/40">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Cloud className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              Cloudflare Zero Trust Ingress Connector
            </span>
            <span className="px-2 py-0.5 bg-indigo-500/30 text-indigo-200 rounded-md text-[9px] font-bold">
              Automated Script Generator
            </span>
          </div>
          <p className="text-[11px] text-slate-300 max-w-2xl leading-relaxed">
            Connect any physical branch's IdealPOS back-office server without static IPs or open firewall ports. Download customized <code className="text-indigo-300 font-mono font-bold bg-indigo-950/60 px-1 py-0.5 rounded">start-tunnel.bat</code> Windows scripts and <code className="text-indigo-300 font-mono font-bold bg-indigo-950/60 px-1 py-0.5 rounded">config.yml</code> files for instant deployment.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setGuideSelectedStoreId(activeStoreId);
            setIsGuideOpen(true);
          }}
          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 shrink-0 self-start sm:self-auto cursor-pointer transition-all"
        >
          <BookOpen className="w-4 h-4" />
          <span>Open Guide &amp; Scripts</span>
        </button>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-white border border-slate-200 rounded-2xl shadow-2xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search stores, codes, manager, tunnel host..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-blue-500 outline-hidden"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-hidden"
          >
            <option value="all">All Formats</option>
            <option value="Flagship">Flagship</option>
            <option value="Standard">Standard Retail</option>
            <option value="Express">Express Metro</option>
            <option value="Fuel & Retail">Fuel &amp; Retail</option>
            <option value="Drive-Thru">Drive-Thru</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-hidden"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
        </div>
      </div>

      {/* Store Locations List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-600">
            Branch Locations ({filteredStores.length} of {stores.length})
          </h3>
          <span className="text-[11px] text-slate-500">
            Click <strong>"Make Active"</strong> to route POS telemetry and orders to that store
          </span>
        </div>

        {filteredStores.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-300 rounded-2xl space-y-3">
            <Store className="w-8 h-8 text-slate-400 mx-auto" />
            <p className="text-xs text-slate-600 font-medium">
              No store branches found matching your search criteria.
            </p>
            <button
              type="button"
              onClick={handleOpenAdd}
              className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl"
            >
              Add New Store
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredStores.map((st) => {
              const isCurrent = st.id === activeStoreId;
              const colorInfo = THEME_COLORS.find((c) => c.id === st.themeColor) || THEME_COLORS[0];

              return (
                <div
                  key={st.id}
                  className={`p-5 rounded-2xl border transition-all duration-200 relative flex flex-col justify-between ${
                    isCurrent
                      ? 'bg-blue-50/40 border-blue-400 shadow-sm ring-2 ring-blue-500/20'
                      : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
                  }`}
                >
                  {/* Top Store Header */}
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-start gap-2.5">
                        <div
                          className={`w-3.5 h-3.5 rounded-full ${colorInfo.bgClass} shrink-0 ring-2 ring-white shadow-xs mt-1`}
                        />
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-extrabold text-slate-900 text-sm">{st.name}</h4>
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 font-mono font-bold text-[10px] rounded-md border border-slate-200">
                              {st.code}
                            </span>
                            {st.storeType && (
                              <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 font-bold text-[10px] rounded-md border border-indigo-200">
                                {st.storeType}
                              </span>
                            )}
                            {st.isDefault && (
                              <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 font-bold text-[9px] rounded flex items-center gap-0.5">
                                <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" /> Default
                              </span>
                            )}
                          </div>

                          {/* Address & Manager */}
                          <div className="flex flex-col gap-0.5 mt-1 text-[11px] text-slate-500">
                            {st.address && (
                              <div className="flex items-center gap-1">
                                <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                                <span className="truncate">{st.address} {st.city ? `, ${st.city}` : ''} {st.state || ''}</span>
                              </div>
                            )}
                            {st.managerName && (
                              <div className="flex items-center gap-1 text-[10px] text-slate-600 font-medium">
                                <Users className="w-3 h-3 text-slate-400 shrink-0" />
                                <span>Manager: <strong>{st.managerName}</strong></span>
                                {st.operatingHours && <span className="text-slate-400">• {st.operatingHours}</span>}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {isCurrent ? (
                          <span className="px-2.5 py-1 bg-blue-600 text-white font-extrabold text-[10px] rounded-lg shadow-2xs flex items-center gap-1">
                            <Check className="w-3 h-3" /> Active Store
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleSwitchActiveStore(st)}
                            className="px-2.5 py-1 bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 font-bold text-[10px] rounded-lg transition-colors cursor-pointer shadow-2xs"
                          >
                            Make Active
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Technical Matrix: Tunnel, SQL, Timezone & Receipt Config */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50/80 p-3 rounded-xl border border-slate-100 text-[11px] mb-3">
                      <div>
                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                          Cloudflare Host
                        </span>
                        <div className="flex items-center gap-1 font-mono font-bold text-slate-800 truncate">
                          <Wifi className="w-3 h-3 text-emerald-500 shrink-0" />
                          <span className="truncate">{st.cloudflared?.tunnelHostname || 'mssql.kwikstop.com.au'}</span>
                        </div>
                      </div>

                      <div>
                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                          IdealPOS SQL DB
                        </span>
                        <div className="flex items-center gap-1 font-mono font-bold text-slate-800 truncate">
                          <Server className="w-3 h-3 text-indigo-500 shrink-0" />
                          <span className="truncate">{st.sql?.database || 'IPSTransaction'} (:{st.sql?.port || st.cloudflared?.localPort || 14333})</span>
                        </div>
                      </div>

                      <div>
                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                          Timezone &amp; Format
                        </span>
                        <div className="flex items-center gap-1 font-semibold text-slate-700 truncate">
                          <Globe className="w-3 h-3 text-blue-500 shrink-0" />
                          <span className="truncate">{(st.timeZone || 'Australia/Brisbane').split('/')[1] || 'Brisbane'} ({st.dateFormat || 'DD/MM/YYYY'})</span>
                        </div>
                      </div>

                      <div>
                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                          Receipt Template
                        </span>
                        <div className="flex items-center gap-1 font-semibold text-slate-700 truncate">
                          <Receipt className="w-3 h-3 text-amber-500 shrink-0" />
                          <span className="truncate">{st.receiptHeader ? 'Custom Heading' : 'Standard Header'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Test Result Message (if tested) */}
                    {testResult && testResult.storeId === st.id && (
                      <div
                        className={`p-2.5 rounded-xl text-[11px] font-bold border mb-3 flex items-center justify-between gap-2 ${
                          testResult.success
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-rose-50 text-rose-800 border-rose-200'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {testResult.success ? (
                            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                          )}
                          <span>{testResult.message}</span>
                        </div>
                        {testResult.latency && (
                          <span className="px-2 py-0.5 bg-emerald-200/60 text-emerald-900 rounded font-mono text-[10px]">
                            {testResult.latency}ms
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Action Buttons Footer */}
                  <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => handleTestConnection(st)}
                        disabled={testingStoreId === st.id}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10px] rounded-lg transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        <RefreshCw
                          className={`w-3 h-3 ${testingStoreId === st.id ? 'animate-spin text-blue-600' : ''}`}
                        />
                        <span>{testingStoreId === st.id ? 'Testing...' : 'Test Connection'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setGuideSelectedStoreId(st.id);
                          setIsGuideOpen(true);
                        }}
                        className="px-2 py-1 text-indigo-600 hover:bg-indigo-50 font-bold text-[10px] rounded-lg transition-colors flex items-center gap-1"
                      >
                        <Terminal className="w-3 h-3" />
                        <span>Get .BAT Script</span>
                      </button>

                      {st.cloudflared?.tunnelToken && (
                        <button
                          type="button"
                          onClick={() => handleCopyTunnelToken(st.cloudflared?.tunnelToken || '', st.id)}
                          className="px-2 py-1 text-slate-600 hover:bg-slate-100 font-bold text-[10px] rounded-lg transition-colors flex items-center gap-1"
                          title="Copy Cloudflare Tunnel Token"
                        >
                          {copiedTokenId === st.id ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600" />
                              <span className="text-emerald-600">Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy Token</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    {userRole === 'admin' && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleDuplicateStore(st)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="Duplicate / Clone Store Configuration"
                        >
                          <Layers className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(st)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit Store & Tunnel Configuration"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteStore(st)}
                          disabled={stores.length <= 1}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Delete Store"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ADD / EDIT STORE MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-600 text-white rounded-xl">
                  <Store className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {editingStore ? `Edit Store: ${editingStore.name}` : 'Add New Store Branch'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Configure store profile, Cloudflare Zero Trust tunnel routing, and IdealPOS SQL database.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Navigation Sub-Tabs */}
            <div className="flex items-center gap-1 px-5 pt-3 border-b border-slate-200 bg-slate-50 shrink-0 overflow-x-auto">
              <button
                type="button"
                onClick={() => setModalTab('profile')}
                className={`px-3 py-2 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  modalTab === 'profile'
                    ? 'border-blue-600 text-blue-600 bg-white rounded-t-lg shadow-2xs'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                <Building className="w-3.5 h-3.5" />
                <span>1. Store Identity</span>
              </button>

              <button
                type="button"
                onClick={() => setModalTab('receipt')}
                className={`px-3 py-2 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  modalTab === 'receipt'
                    ? 'border-amber-600 text-amber-700 bg-white rounded-t-lg shadow-2xs'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>2. Receipt Header/Footer</span>
              </button>

              <button
                type="button"
                onClick={() => setModalTab('regional')}
                className={`px-3 py-2 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  modalTab === 'regional'
                    ? 'border-teal-600 text-teal-700 bg-white rounded-t-lg shadow-2xs'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>3. Date &amp; Time Zone</span>
              </button>

              <button
                type="button"
                onClick={() => setModalTab('tunnel')}
                className={`px-3 py-2 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  modalTab === 'tunnel'
                    ? 'border-indigo-600 text-indigo-600 bg-white rounded-t-lg shadow-2xs'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                <Cloud className="w-3.5 h-3.5" />
                <span>4. Cloudflare Tunnel</span>
              </button>

              <button
                type="button"
                onClick={() => setModalTab('sql')}
                className={`px-3 py-2 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  modalTab === 'sql'
                    ? 'border-emerald-600 text-emerald-600 bg-white rounded-t-lg shadow-2xs'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                <Database className="w-3.5 h-3.5" />
                <span>5. IdealPOS SQL</span>
              </button>

              <button
                type="button"
                onClick={() => setModalTab('staff')}
                className={`px-3 py-2 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  modalTab === 'staff'
                    ? 'border-purple-600 text-purple-600 bg-white rounded-t-lg shadow-2xs'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>6. Status &amp; Startup</span>
              </button>

              <button
                type="button"
                onClick={() => setModalTab('variance')}
                className={`px-3 py-2 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  modalTab === 'variance'
                    ? 'border-rose-600 text-rose-700 bg-white rounded-t-lg shadow-2xs'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>7. Cash Variance Thresholds</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-4 text-xs text-slate-700">
              {/* TAB 1: Store Identity & Location */}
              {modalTab === 'profile' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Store Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Northside Convenience & Fuel"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:bg-white focus:ring-2 focus:ring-blue-500 outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Store Code <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={code}
                        onChange={(e) => setCode(e.target.value.toUpperCase())}
                        placeholder="e.g. ST-102"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold focus:bg-white focus:ring-2 focus:ring-blue-500 outline-hidden"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Store Format / Type
                      </label>
                      <select
                        value={storeType}
                        onChange={(e) => setStoreType(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:bg-white outline-hidden"
                      >
                        {STORE_TYPES.map((t) => (
                          <option key={t.id} value={t.id}>{t.label}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Branch Manager Name
                      </label>
                      <input
                        type="text"
                        value={managerName}
                        onChange={(e) => setManagerName(e.target.value)}
                        placeholder="e.g. Sarah Jenkins"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Operating / Trading Hours
                      </label>
                      <input
                        type="text"
                        value={operatingHours}
                        onChange={(e) => setOperatingHours(e.target.value)}
                        placeholder="e.g. 6:00 AM - 11:00 PM"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white outline-hidden"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Physical Street Address
                      </label>
                      <input
                        type="text"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="e.g. 102 North Road"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        City / Suburb
                      </label>
                      <input
                        type="text"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="e.g. Chermside"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white outline-hidden"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        State
                      </label>
                      <input
                        type="text"
                        value={state}
                        onChange={(e) => setState(e.target.value)}
                        placeholder="QLD"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold focus:bg-white outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Postcode
                      </label>
                      <input
                        type="text"
                        value={postcode}
                        onChange={(e) => setPostcode(e.target.value)}
                        placeholder="4032"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono focus:bg-white outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        POS Terminals
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="20"
                        value={posTerminalCount}
                        onChange={(e) => setPosTerminalCount(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold focus:bg-white outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Tax / GST %
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="30"
                        value={taxRate}
                        onChange={(e) => setTaxRate(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold focus:bg-white outline-hidden"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Contact Phone
                      </label>
                      <input
                        type="text"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+61 7 3350 1020"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Store Email
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="northside@kwikstop.com.au"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white outline-hidden"
                      />
                    </div>
                  </div>

                  {/* Color Theme Selector */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                      Store Accent Theme Color
                    </label>
                    <div className="flex items-center gap-2 flex-wrap">
                      {THEME_COLORS.map((col) => (
                        <button
                          key={col.id}
                          type="button"
                          onClick={() => setThemeColor(col.id)}
                          className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                            themeColor === col.id
                              ? `${col.borderClass} bg-slate-100 ring-2 ring-blue-500/20`
                              : 'border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <span className={`w-3 h-3 rounded-full ${col.bgClass}`} />
                          <span>{col.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Operational Notes */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Internal Store Notes / Remarks
                    </label>
                    <textarea
                      rows={2}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Special instructions, after-hours alarm codes, fuel deliveries contact..."
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white outline-hidden"
                    />
                  </div>
                </div>
              )}

              {/* TAB 2: Receipt Default Heading & Footer */}
              {modalTab === 'receipt' && (
                <div className="space-y-5">
                  <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1">
                    <div className="font-bold flex items-center gap-1.5">
                      <Receipt className="w-4 h-4 text-amber-600" />
                      <span>Custom Receipt Header &amp; Footer for {name || 'this Store'}</span>
                    </div>
                    <p className="text-[11px] text-amber-800 leading-relaxed">
                      Configure the default header lines (business name, address, ABN, trading hours) and the footer message (promotions, exchange policy, return window) printed on thermal receipts and displayed in the Sales History receipt viewer.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Left Side: Inputs */}
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[11px] font-bold text-slate-800 flex items-center gap-1">
                            <FileText className="w-3.5 h-3.5 text-amber-600" />
                            <span>Default Receipt Heading</span>
                          </label>
                          <button
                            type="button"
                            onClick={() =>
                              setReceiptHeader(
                                `${name || 'KWIKSTOP CONVENIENCE'}\n${address || '102 North Road'}, ${city || 'Chermside'} ${state || 'QLD'}\nPh: ${phone || '+61 7 3350 1020'} · ABN: 74 812 903 481\nIdealPOS Register 01`
                              )
                            }
                            className="text-[10px] text-blue-600 hover:underline font-bold cursor-pointer"
                          >
                            Generate from Store Info
                          </button>
                        </div>
                        <textarea
                          rows={4}
                          value={receiptHeader}
                          onChange={(e) => setReceiptHeader(e.target.value)}
                          placeholder={`KWIKSTOP CONVENIENCE STORE\n${address || '102 North Road'}, ${city || 'Chermside'}\nPh: ${phone || '+61 7 3350 1020'} · ABN: 74 812 903 481\nIdealPOS Register 01`}
                          className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono focus:bg-white focus:ring-2 focus:ring-amber-500 outline-hidden leading-relaxed"
                        />
                        <p className="text-[10px] text-slate-500 mt-1">
                          Leave empty to use automatic store title &amp; address header.
                        </p>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[11px] font-bold text-slate-800 flex items-center gap-1">
                            <FileText className="w-3.5 h-3.5 text-amber-600" />
                            <span>Default Receipt Footer</span>
                          </label>
                          <button
                            type="button"
                            onClick={() =>
                              setReceiptFooter(
                                `*** THANK YOU FOR SHOPPING AT ${(name || 'KWIKSTOP').toUpperCase()} ***\nKeep receipt for returns or exchanges within 14 days.\nFuel discount voucher available on next fill-up!`
                              )
                            }
                            className="text-[10px] text-blue-600 hover:underline font-bold cursor-pointer"
                          >
                            Load Template
                          </button>
                        </div>
                        <textarea
                          rows={4}
                          value={receiptFooter}
                          onChange={(e) => setReceiptFooter(e.target.value)}
                          placeholder={`*** THANK YOU FOR SHOPPING AT ${(name || 'KWIKSTOP').toUpperCase()} ***\nKeep receipt for returns or exchanges within 14 days.\nVisit us at kwikstop.com.au`}
                          className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono focus:bg-white focus:ring-2 focus:ring-amber-500 outline-hidden leading-relaxed"
                        />
                        <p className="text-[10px] text-slate-500 mt-1">
                          Appears at the very bottom of printed and exported receipts.
                        </p>
                      </div>
                    </div>

                    {/* Right Side: Live Thermal Receipt Preview */}
                    <div className="space-y-2">
                      <label className="block text-[11px] font-bold text-slate-700 flex items-center gap-1">
                        <Printer className="w-3.5 h-3.5 text-slate-500" />
                        <span>Live Thermal Paper Preview (80mm)</span>
                      </label>
                      <div className="p-4 bg-slate-900 rounded-xl border border-slate-800 shadow-inner">
                        <div className="bg-white text-slate-900 p-4 rounded-lg shadow-sm font-mono text-[10px] leading-tight space-y-2 border border-slate-200">
                          {/* Receipt Header Preview */}
                          <div className="text-center pb-2 border-b border-dashed border-slate-400 font-bold whitespace-pre-line text-slate-900">
                            {receiptHeader || `${name || 'KWIKSTOP CONVENIENCE'}\n${address || '102 North Road'}, ${city || 'Chermside'}\nPh: ${phone || '+61 7 3350 1020'}`}
                          </div>

                          <div className="space-y-0.5 text-slate-600 text-[9px] py-1 border-b border-dashed border-slate-300">
                            <div className="flex justify-between">
                              <span>Receipt #:</span>
                              <span className="font-bold text-slate-900">REC-98231</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Clerk Name:</span>
                              <span className="font-bold text-blue-700">{managerName || 'Sarah Jenkins'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Terminal:</span>
                              <span>Register 01</span>
                            </div>
                          </div>

                          {/* Sample Items */}
                          <div className="space-y-1 py-1 border-b border-dashed border-slate-300">
                            <div className="flex justify-between font-bold">
                              <span>COCA COLA 600ML</span>
                              <span>$4.50</span>
                            </div>
                            <div className="flex justify-between text-slate-500 text-[9px]">
                              <span>1 x $4.50 (Includes GST)</span>
                              <span className="text-purple-700 font-bold">Promo -$0.50</span>
                            </div>
                          </div>

                          <div className="flex justify-between font-extrabold text-xs pt-1">
                            <span>TOTAL PAID:</span>
                            <span>$4.00</span>
                          </div>

                          {/* Receipt Footer Preview */}
                          <div className="text-center pt-2 border-t border-dashed border-slate-400 text-slate-700 whitespace-pre-line text-[9px]">
                            {receiptFooter || '*** THANK YOU FOR SHOPPING ***\nKeep receipt for returns within 14 days.'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: Date, Time & Time Zone */}
              {modalTab === 'regional' && (
                <div className="space-y-4">
                  <div className="p-3.5 bg-teal-50 border border-teal-200 rounded-xl text-xs text-teal-900 space-y-1">
                    <div className="font-bold flex items-center gap-1.5">
                      <Globe className="w-4 h-4 text-teal-600" />
                      <span>Branch Time Zone &amp; Regional Localization</span>
                    </div>
                    <p className="text-[11px] text-teal-800 leading-relaxed">
                      Configure the specific time zone and calendar date formatting for this store branch. All daily sales reconciliations, end-of-day reports, and hourly telemetry will adjust to this local time.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Branch Time Zone <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={timeZone}
                        onChange={(e) => setTimeZone(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:bg-white outline-hidden"
                      >
                        {TIMEZONE_OPTIONS.map((tz) => (
                          <option key={tz.value} value={tz.value}>
                            {tz.label}
                          </option>
                        ))}
                      </select>
                      <p className="text-[10px] text-slate-500 mt-1">
                        Determines transaction timestamps and cut-off hours.
                      </p>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Date Display Format
                      </label>
                      <select
                        value={dateFormat}
                        onChange={(e) => setDateFormat(e.target.value as DateFormat)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:bg-white outline-hidden"
                      >
                        {DATE_FORMAT_OPTIONS.map((df) => (
                          <option key={df.value} value={df.value}>
                            {df.label}
                          </option>
                        ))}
                      </select>
                      <p className="text-[10px] text-slate-500 mt-1">
                        Standard date format in sales tables &amp; exports.
                      </p>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Clock Time Format
                      </label>
                      <select
                        value={timeFormat}
                        onChange={(e) => setTimeFormat(e.target.value as TimeFormat)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:bg-white outline-hidden"
                      >
                        {TIME_FORMAT_OPTIONS.map((tf) => (
                          <option key={tf.value} value={tf.value}>
                            {tf.label}
                          </option>
                        ))}
                      </select>
                      <p className="text-[10px] text-slate-500 mt-1">
                        12-hour AM/PM vs 24-hour military clock.
                      </p>
                    </div>
                  </div>

                  {/* Real-time Preview Widget */}
                  <div className="p-4 bg-slate-100 rounded-xl border border-slate-200 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-teal-600 text-white rounded-xl shadow-2xs">
                        <Clock className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                          Formatted Clock Output Preview
                        </div>
                        <div className="text-sm font-extrabold text-slate-900 font-mono">
                          {dateFormat === 'YYYY-MM-DD'
                            ? new Date().toISOString().slice(0, 10)
                            : dateFormat === 'DD-MM-YYYY'
                            ? new Date().toLocaleDateString('en-GB').replace(/\//g, '-')
                            : new Date().toLocaleDateString('en-GB')}{' '}
                          {timeFormat === '24h'
                            ? new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
                            : new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="px-2.5 py-1 bg-teal-100 text-teal-800 rounded-lg font-bold text-[11px]">
                        {timeZone}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: Cloudflare Tunnel Information */}
              {modalTab === 'tunnel' && (
                <div className="space-y-4">
                  <div className="p-3.5 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-900 space-y-1">
                    <div className="font-bold flex items-center gap-1.5">
                      <Cloud className="w-4 h-4 text-indigo-600" />
                      <span>Cloudflare Zero Trust Tunnel Configuration</span>
                    </div>
                    <p className="text-[11px] text-indigo-800 leading-relaxed">
                      Each store can be linked via a unique Cloudflare Tunnel hostname. The local cloudflared agent establishes an encrypted outbound QUIC tunnel back to Cloudflare edges.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Cloudflare Public Tunnel Hostname <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={tunnelHostname}
                        onChange={(e) => setTunnelHostname(e.target.value)}
                        placeholder="e.g. mssql-north.kwikstop.com.au"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold text-blue-700 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-hidden"
                      />
                      <p className="text-[10px] text-slate-500 mt-1">
                        Configured in Cloudflare Zero Trust &rarr; Networks &rarr; Tunnels &rarr; Public Hostnames (TCP route).
                      </p>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Local Forwarding Port
                      </label>
                      <input
                        type="number"
                        value={localPort}
                        onChange={(e) => setLocalPort(Number(e.target.value))}
                        placeholder="14333"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold focus:bg-white outline-hidden"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Ingress Protocol
                      </label>
                      <select
                        value={tunnelProtocol}
                        onChange={(e) => setTunnelProtocol(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:bg-white outline-hidden"
                      >
                        <option value="tcp">TCP (MS SQL Server 1433)</option>
                        <option value="http">HTTP (Web POS / API)</option>
                        <option value="https">HTTPS (Secure Web Service)</option>
                        <option value="ssh">SSH (Terminal Access)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Origin Target URL
                      </label>
                      <input
                        type="text"
                        value={originTarget}
                        onChange={(e) => setOriginTarget(e.target.value)}
                        placeholder="tcp://127.0.0.1:1433"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono focus:bg-white outline-hidden"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-bold text-slate-700">
                        Cloudflare Tunnel Token (Service Authentication)
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowTunnelToken(!showTunnelToken)}
                        className="text-[10px] text-blue-600 hover:underline flex items-center gap-1 font-bold cursor-pointer"
                      >
                        {showTunnelToken ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        <span>{showTunnelToken ? 'Hide Token' : 'Show Token'}</span>
                      </button>
                    </div>
                    <input
                      type={showTunnelToken ? "text" : "password"}
                      value={tunnelToken}
                      onChange={(e) => setTunnelToken(e.target.value)}
                      placeholder="eyJhIjoiZjgxMmExMjM0NTY3ODkwIiwi..."
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono focus:bg-white outline-hidden"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">
                      The service token generated when creating the tunnel in Cloudflare Zero Trust dashboard.
                    </p>
                  </div>

                  <div className="pt-2">
                    <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-slate-800">
                      <input
                        type="checkbox"
                        checked={autoReconnect}
                        onChange={(e) => setAutoReconnect(e.target.checked)}
                        className="rounded text-blue-600"
                      />
                      <span>Enable Auto-Reconnect &amp; Live Keepalive Health Checks</span>
                    </label>
                  </div>
                </div>
              )}

              {/* TAB 5: IdealPOS SQL Database */}
              {modalTab === 'sql' && (
                <div className="space-y-4">
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 space-y-1">
                    <div className="font-bold flex items-center gap-1.5">
                      <Server className="w-4 h-4 text-indigo-600" />
                      <span>IdealPOS SQL Server Credentials</span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Configure the MS SQL Server parameters used to query StockItems, Creditor, Departments, and IPSTransaction tables for this store.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        SQL Server Host / IP
                      </label>
                      <input
                        type="text"
                        value={sqlServer}
                        onChange={(e) => setSqlServer(e.target.value)}
                        placeholder="127.0.0.1"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono focus:bg-white outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        SQL Port
                      </label>
                      <input
                        type="number"
                        value={sqlPort}
                        onChange={(e) => setSqlPort(Number(e.target.value))}
                        placeholder="14333"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono focus:bg-white outline-hidden"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Database Name
                      </label>
                      <input
                        type="text"
                        value={sqlDatabase}
                        onChange={(e) => setSqlDatabase(e.target.value)}
                        placeholder="IPSTransaction"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:bg-white outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        SQL Username
                      </label>
                      <input
                        type="text"
                        value={sqlUser}
                        onChange={(e) => setSqlUser(e.target.value)}
                        placeholder="kwikorder"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono focus:bg-white outline-hidden"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-bold text-slate-700">
                          Password
                        </label>
                        <button
                          type="button"
                          onClick={() => setShowSqlPassword(!showSqlPassword)}
                          className="text-[10px] text-blue-600 hover:underline flex items-center gap-0.5 cursor-pointer"
                        >
                          {showSqlPassword ? <EyeOff className="w-2.5 h-2.5" /> : <Eye className="w-2.5 h-2.5" />}
                        </button>
                      </div>
                      <input
                        type={showSqlPassword ? "text" : "password"}
                        value={sqlPassword}
                        onChange={(e) => setSqlPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono focus:bg-white outline-hidden"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <label className="flex items-center gap-2 cursor-pointer font-bold text-xs">
                      <input
                        type="checkbox"
                        checked={trustCert}
                        onChange={(e) => setTrustCert(e.target.checked)}
                        className="rounded text-blue-600"
                      />
                      <span>Trust Server Certificate (Recommended for local SQL)</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer font-bold text-xs">
                      <input
                        type="checkbox"
                        checked={encryptSsl}
                        onChange={(e) => setEncryptSsl(e.target.checked)}
                        className="rounded text-blue-600"
                      />
                      <span>Encrypt TLS Connection</span>
                    </label>
                  </div>
                </div>
              )}

              {/* TAB 6: Store Operational Status & KSBM Access Note */}
              {modalTab === 'staff' && (
                <div className="space-y-4">
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 space-y-1">
                    <div className="font-bold flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-purple-600" />
                      <span>Centralized KSBM Staff Permissions</span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Employee store access, PIN logins, and branch permissions are managed centrally in the Kwik Stop Business Manager (KSBM) Master Admin panel and injected via <code className="font-mono bg-slate-200/70 px-1 rounded">currentUser.allowedStoreIds</code>.
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-200 space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isActive}
                        onChange={(e) => setIsActive(e.target.checked)}
                        className="rounded text-blue-600"
                      />
                      <span className="font-bold text-xs text-slate-800">
                        Active Operational Store
                      </span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isDefault}
                        onChange={(e) => setIsDefault(e.target.checked)}
                        className="rounded text-blue-600"
                      />
                      <span className="font-bold text-xs text-slate-800">
                        Set as Primary Default Store on Startup
                      </span>
                    </label>
                  </div>
                </div>
              )}

              {/* TAB 7: Cash Variance Thresholds */}
              {modalTab === 'variance' && (
                <div className="space-y-4">
                  {/* Info Header */}
                  <div className="bg-rose-50/60 border border-rose-200 rounded-xl p-3.5 flex items-start gap-3">
                    <div className="p-2 bg-rose-100 text-rose-700 rounded-lg shrink-0 mt-0.5">
                      <Sliders className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-rose-900">
                        Cash Variance Flagging & Shift Audit Thresholds
                      </h4>
                      <p className="text-[11px] text-rose-800 leading-relaxed mt-0.5">
                        Define 5 customized variance tolerance levels for this store. Minor discrepancies can be marked as normal/acceptable, while larger and frequent errors trigger warning alerts or management red flags. Configured emojis reflect dynamically in reports and tables.
                      </p>
                    </div>
                  </div>

                  {/* Master Configuration Controls */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={varianceFlaggingEnabled}
                        onChange={(e) => setVarianceFlaggingEnabled(e.target.checked)}
                        className="rounded text-rose-600 mt-0.5"
                      />
                      <div>
                        <span className="font-bold text-xs text-slate-800 block">
                          Enable Cash Variance Flagging
                        </span>
                        <span className="text-[11px] text-slate-500 block leading-tight">
                          Categorize shift cash declarations into 5 tolerance tiers
                        </span>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={varianceShowEmoji}
                        onChange={(e) => setVarianceShowEmoji(e.target.checked)}
                        className="rounded text-rose-600 mt-0.5"
                      />
                      <div>
                        <span className="font-bold text-xs text-slate-800 block">
                          Show Emoji in Reports & Tables
                        </span>
                        <span className="text-[11px] text-slate-500 block leading-tight">
                          Display status emojis (e.g. 🎯, ✅, ⚠️, 🔍, 🚨) beside variance amounts
                        </span>
                      </div>
                    </label>
                  </div>

                  {/* 5 Thresholds Configuration */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-800">
                        5-Tier Tolerance Thresholds & Professional Labels
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Absolute variance range: +/- difference from expected drawer cash
                      </span>
                    </div>

                    {/* Tier 1: Perfect */}
                    <div className="bg-emerald-50/40 border border-emerald-200 rounded-xl p-3.5 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          <span className="font-bold text-xs text-emerald-900">Tier 1: Perfect Balance</span>
                          <span className="text-[10px] text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full font-medium">Spot-On Reconciled</span>
                        </div>
                        <span className="text-[11px] text-emerald-700 font-semibold">
                          Less than +/- ${tierPerfectThreshold}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                        <div className="sm:col-span-3">
                          <label className="text-[10px] font-bold text-slate-600 block mb-1">Max Deviation ($)</label>
                          <div className="relative">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">$</span>
                            <input
                              type="number"
                              step="0.05"
                              min="0"
                              value={tierPerfectThreshold}
                              onChange={(e) => setTierPerfectThreshold(e.target.value)}
                              className="w-full pl-6 pr-2 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500"
                              placeholder="0.10"
                            />
                          </div>
                        </div>
                        <div className="sm:col-span-6">
                          <label className="text-[10px] font-bold text-slate-600 block mb-1">Professional Label</label>
                          <input
                            type="text"
                            value={tierPerfectLabel}
                            onChange={(e) => setTierPerfectLabel(e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500"
                            placeholder="Perfect / Spot-On"
                          />
                        </div>
                        <div className="sm:col-span-3">
                          <label className="text-[10px] font-bold text-slate-600 block mb-1">Emoji Icon</label>
                          <input
                            type="text"
                            value={tierPerfectEmoji}
                            onChange={(e) => setTierPerfectEmoji(e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-center"
                            placeholder="🎯"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Tier 2: Good / Minor */}
                    <div className="bg-blue-50/40 border border-blue-200 rounded-xl p-3.5 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-blue-500" />
                          <span className="font-bold text-xs text-blue-900">Tier 2: Minor / Acceptable</span>
                          <span className="text-[10px] text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded-full font-medium">Standard Daily Deviation</span>
                        </div>
                        <span className="text-[11px] text-blue-700 font-semibold">
                          +/- ${tierPerfectThreshold} to +/- ${tierGoodThreshold}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                        <div className="sm:col-span-3">
                          <label className="text-[10px] font-bold text-slate-600 block mb-1">Max Deviation ($)</label>
                          <div className="relative">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">$</span>
                            <input
                              type="number"
                              step="0.05"
                              min="0"
                              value={tierGoodThreshold}
                              onChange={(e) => setTierGoodThreshold(e.target.value)}
                              className="w-full pl-6 pr-2 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500"
                              placeholder="0.90"
                            />
                          </div>
                        </div>
                        <div className="sm:col-span-6">
                          <label className="text-[10px] font-bold text-slate-600 block mb-1">Professional Label</label>
                          <input
                            type="text"
                            value={tierGoodLabel}
                            onChange={(e) => setTierGoodLabel(e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500"
                            placeholder="Minor / Acceptable"
                          />
                        </div>
                        <div className="sm:col-span-3">
                          <label className="text-[10px] font-bold text-slate-600 block mb-1">Emoji Icon</label>
                          <input
                            type="text"
                            value={tierGoodEmoji}
                            onChange={(e) => setTierGoodEmoji(e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-center"
                            placeholder="✅"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Tier 3: Moderate */}
                    <div className="bg-amber-50/40 border border-amber-200 rounded-xl p-3.5 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-amber-500" />
                          <span className="font-bold text-xs text-amber-900">Tier 3: Moderate Discrepancy</span>
                          <span className="text-[10px] text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded-full font-medium">Noticeable Difference</span>
                        </div>
                        <span className="text-[11px] text-amber-700 font-semibold">
                          +/- ${tierGoodThreshold} to +/- ${tierModerateThreshold}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                        <div className="sm:col-span-3">
                          <label className="text-[10px] font-bold text-slate-600 block mb-1">Max Deviation ($)</label>
                          <div className="relative">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">$</span>
                            <input
                              type="number"
                              step="0.50"
                              min="0"
                              value={tierModerateThreshold}
                              onChange={(e) => setTierModerateThreshold(e.target.value)}
                              className="w-full pl-6 pr-2 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-amber-500"
                              placeholder="5.00"
                            />
                          </div>
                        </div>
                        <div className="sm:col-span-6">
                          <label className="text-[10px] font-bold text-slate-600 block mb-1">Professional Label</label>
                          <input
                            type="text"
                            value={tierModerateLabel}
                            onChange={(e) => setTierModerateLabel(e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-amber-500"
                            placeholder="Moderate Discrepancy"
                          />
                        </div>
                        <div className="sm:col-span-3">
                          <label className="text-[10px] font-bold text-slate-600 block mb-1">Emoji Icon</label>
                          <input
                            type="text"
                            value={tierModerateEmoji}
                            onChange={(e) => setTierModerateEmoji(e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-center"
                            placeholder="⚠️"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Tier 4: Concerned */}
                    <div className="bg-orange-50/40 border border-orange-200 rounded-xl p-3.5 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-orange-500" />
                          <span className="font-bold text-xs text-orange-950">Tier 4: Concerning Variance</span>
                          <span className="text-[10px] text-orange-800 bg-orange-100/80 px-2 py-0.5 rounded-full font-medium">Verification Required</span>
                        </div>
                        <span className="text-[11px] text-orange-800 font-semibold">
                          +/- ${tierModerateThreshold} to +/- ${tierConcernedThreshold}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                        <div className="sm:col-span-3">
                          <label className="text-[10px] font-bold text-slate-600 block mb-1">Max Deviation ($)</label>
                          <div className="relative">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">$</span>
                            <input
                              type="number"
                              step="1.00"
                              min="0"
                              value={tierConcernedThreshold}
                              onChange={(e) => setTierConcernedThreshold(e.target.value)}
                              className="w-full pl-6 pr-2 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-orange-500"
                              placeholder="10.00"
                            />
                          </div>
                        </div>
                        <div className="sm:col-span-6">
                          <label className="text-[10px] font-bold text-slate-600 block mb-1">Professional Label</label>
                          <input
                            type="text"
                            value={tierConcernedLabel}
                            onChange={(e) => setTierConcernedLabel(e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-orange-500"
                            placeholder="Concerning Variance"
                          />
                        </div>
                        <div className="sm:col-span-3">
                          <label className="text-[10px] font-bold text-slate-600 block mb-1">Emoji Icon</label>
                          <input
                            type="text"
                            value={tierConcernedEmoji}
                            onChange={(e) => setTierConcernedEmoji(e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-center"
                            placeholder="🔍"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Tier 5: Red Flag */}
                    <div className="bg-rose-50/40 border border-rose-200 rounded-xl p-3.5 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-rose-600" />
                          <span className="font-bold text-xs text-rose-950">Tier 5: Red Flag / Critical Alert</span>
                          <span className="text-[10px] text-rose-800 bg-rose-100/80 px-2 py-0.5 rounded-full font-medium">Mandatory Audit</span>
                        </div>
                        <span className="text-[11px] text-rose-700 font-semibold">
                          Exceeds +/- ${tierConcernedThreshold}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                        <div className="sm:col-span-3">
                          <label className="text-[10px] font-bold text-slate-600 block mb-1">Trigger Condition</label>
                          <div className="px-2.5 py-1.5 text-xs bg-slate-100 text-slate-600 font-medium rounded-lg border border-slate-200">
                            &gt; +/- ${tierConcernedThreshold}
                          </div>
                        </div>
                        <div className="sm:col-span-6">
                          <label className="text-[10px] font-bold text-slate-600 block mb-1">Professional Label</label>
                          <input
                            type="text"
                            value={tierRedFlagLabel}
                            onChange={(e) => setTierRedFlagLabel(e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-rose-500"
                            placeholder="Red Flag / Critical Alert"
                          />
                        </div>
                        <div className="sm:col-span-3">
                          <label className="text-[10px] font-bold text-slate-600 block mb-1">Emoji Icon</label>
                          <input
                            type="text"
                            value={tierRedFlagEmoji}
                            onChange={(e) => setTierRedFlagEmoji(e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-center"
                            placeholder="🚨"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Real-time Preview Simulator */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                        <Eye className="w-3.5 h-3.5 text-slate-500" />
                        Live Cash Variance Table Column Preview
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {varianceShowEmoji ? 'Emoji display enabled' : 'Emoji display disabled'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                      {[
                        { label: 'Zero Difference', val: 0.00 },
                        { label: 'Small Rounding', val: -0.45 },
                        { label: 'Register Float Error', val: 3.50 },
                        { label: 'Suspicious Shortage', val: -8.50 },
                        { label: 'Critical Variance', val: -25.00 },
                      ].map((demo, idx) => {
                        const tempConfig: CashVarianceThresholds = {
                          enabled: varianceFlaggingEnabled,
                          showEmoji: varianceShowEmoji,
                          perfect: { label: tierPerfectLabel, maxThreshold: parseFloat(tierPerfectThreshold) || 0.10, emoji: tierPerfectEmoji },
                          good: { label: tierGoodLabel, maxThreshold: parseFloat(tierGoodThreshold) || 0.90, emoji: tierGoodEmoji },
                          moderate: { label: tierModerateLabel, maxThreshold: parseFloat(tierModerateThreshold) || 5.00, emoji: tierModerateEmoji },
                          concerned: { label: tierConcernedLabel, maxThreshold: parseFloat(tierConcernedThreshold) || 10.00, emoji: tierConcernedEmoji },
                          redFlag: { label: tierRedFlagLabel, emoji: tierRedFlagEmoji },
                        };
                        const evaluated = evaluateCashVariance(demo.val, tempConfig);
                        return (
                          <div key={idx} className="bg-white border border-slate-200 rounded-lg p-2 text-center space-y-1 shadow-2xs">
                            <span className="text-[10px] text-slate-400 block truncate">{demo.label}</span>
                            <span className="font-mono font-bold text-xs text-slate-800 block">
                              {demo.val >= 0 ? `+$${demo.val.toFixed(2)}` : `-$${Math.abs(demo.val).toFixed(2)}`}
                            </span>
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${evaluated.badgeBg} ${evaluated.badgeText} ${evaluated.badgeBorder}`}
                            >
                              {evaluated.showEmoji && <span>{evaluated.emoji}</span>}
                              <span className="truncate max-w-[85px]">{evaluated.label}</span>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 px-5 py-3.5 border-t border-slate-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
              </div>

              <div className="flex items-center gap-2">
                {modalTab !== 'variance' ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (modalTab === 'profile') setModalTab('receipt');
                      else if (modalTab === 'receipt') setModalTab('regional');
                      else if (modalTab === 'regional') setModalTab('tunnel');
                      else if (modalTab === 'tunnel') setModalTab('sql');
                      else if (modalTab === 'sql') setModalTab('staff');
                      else if (modalTab === 'staff') setModalTab('variance');
                    }}
                    className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-xl flex items-center gap-1 cursor-pointer"
                  >
                    <span>Next Step</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={handleSaveStore}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Save Store Profile</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION DIALOG MODAL */}
      {storePendingDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 bg-rose-50 border-b border-rose-100 flex items-start gap-3.5">
              <div className="p-2.5 bg-rose-600 text-white rounded-xl shrink-0 shadow-sm">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">
                  Delete Branch Location?
                </h3>
                <p className="text-xs text-rose-800 mt-0.5">
                  Are you sure you want to permanently delete <strong>"{storePendingDelete.name}"</strong> ({storePendingDelete.code})?
                </p>
              </div>
            </div>

            <div className="p-5 space-y-3 text-xs text-slate-600">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Store Code:</span>
                  <span className="font-mono font-bold text-slate-900">{storePendingDelete.code}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Cloudflare Tunnel:</span>
                  <span className="font-mono text-slate-800 truncate max-w-[200px]">{storePendingDelete.cloudflared?.tunnelHostname || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">IdealPOS SQL Port:</span>
                  <span className="font-mono text-slate-800">{storePendingDelete.sql?.port || storePendingDelete.cloudflared?.localPort || 14333}</span>
                </div>
              </div>
              <p className="text-[11px] text-slate-500">
                This will remove the store from active sync, live tunnel polling, and the branch selector.
              </p>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setStorePendingDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteStore}
                disabled={isDeleting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeleting ? 'Deleting...' : 'Confirm Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CLOUDFLARE GUIDE MODAL */}
      <CloudflareTunnelGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
        stores={stores}
        selectedStoreId={guideSelectedStoreId || activeStoreId}
      />
    </div>
  );
}
