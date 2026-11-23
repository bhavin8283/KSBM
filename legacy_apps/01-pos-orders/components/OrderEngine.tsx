import React, { useEffect, useMemo, useState } from 'react';
import { MultiSelectDepartmentDropdown } from './MultiSelectDepartmentDropdown';
import {
  ClipboardList,
  Download,
  Printer,
  RefreshCw,
  Truck,
  AlertCircle,
  CheckCircle2,
  Star,
  Package,
  X,
  ShieldCheck,
  LayoutList,
  LayoutGrid,
  ImagePlus,
  Camera,
  Search,
  Upload,
  Trash2,
  Sparkles,
  BookmarkPlus,
  History,
  Clock,
  Eye,
  FileText,
  Calendar,
  Check,
  Edit3,
  Pencil,
  Plus,
  XCircle,
  BrainCircuit,
} from 'lucide-react';
import { ImageCropModal } from './ImageCropModal';
import type {
  DeliverySchedule,
  DepartmentFlagSetting,
  OrderRecommendation,
  Supplier,
  SupplierConfig,
  SupplierConfigMap,
  SupplierProduct,
  SavedDraftOrder,
} from '../types';
import {
  defaultSchedule,
  findConfigForSupplier,
  formatSchedule,
  formatTime,
  getCoverageDays,
  getUpcomingCutoffOccurrences,
  normalizeSupplierConfig,
  normalizeSupplierConfigMap,
  pickNextScheduleIndex,
  type UpcomingCutoffOccurrence,
} from '../supplierConfigUtils';
import { WEEKDAYS } from '../schemaMap';
import { compareByPackSize, formatPackSizeLabel, readFileAsDataUrl } from '../productUtils';

export function matchesWildcardSearch(
  fields: (string | number | null | undefined)[],
  searchPattern: string
): boolean {
  if (!searchPattern) return true;
  const q = searchPattern.trim().toLowerCase();
  if (!q) return true;

  const combined = fields
    .filter((f) => f !== null && f !== undefined)
    .map((f) => String(f).toLowerCase())
    .join(' ');

  // Wildcard asterisk matching: e.g. "bega*milk", "*2l", "choc*bar*500", "931*"
  if (q.includes('*')) {
    const rawPattern = q
      .split('*')
      .map((segment) => segment.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
      .join('.*');
    try {
      const reg = new RegExp(rawPattern, 'i');
      return reg.test(combined);
    } catch {
      // Fallback
    }
  }

  // Multi-token search (e.g. "bega milk 2L"): all tokens must be present
  const tokens = q.split(/\s+/).filter(Boolean);
  return tokens.every((token) => combined.includes(token));
}

type ProductViewMode = 'table' | 'thumbnail';

type ConfiguredSupplier = {
  id: string | number;
  name: string;
  code?: string;
  SupplierID?: string;
  SupplierName?: string;
  SupplierCode?: string;
  starredCount?: number;
  config?: SupplierConfig;
};

export type StarredItem = {
  productId: number;
  stockCode: string;
  barcode: string;
  description: string;
  departmentCode: number | null;
  departmentName: string;
  cost: number;
  dbStock: number;
  manualStock: number | string; // Editable optional current stock override (empty string when stock is negative or uncounted)
  photoUrl: string | null;
  recommendedQty: number | null; // null before generate draft
  orderQty: number | null; // null before generate draft
  coverageAvg?: number;
  reason?: string;
  minPackQty?: number | string;
  shelfLifeDays?: number | string;
};

const DEPT_ROW_COLORS = [
  'bg-sky-50',
  'bg-emerald-50',
  'bg-amber-50',
  'bg-rose-50',
  'bg-violet-50',
  'bg-teal-50',
  'bg-orange-50',
  'bg-indigo-50',
  'bg-lime-50',
  'bg-cyan-50',
  'bg-fuchsia-50',
  'bg-yellow-50',
];

const DEPT_HEADER_COLORS = [
  'bg-sky-100 text-sky-900 border-sky-200',
  'bg-emerald-100 text-emerald-900 border-emerald-200',
  'bg-amber-100 text-amber-900 border-amber-200',
  'bg-rose-100 text-rose-900 border-rose-200',
  'bg-violet-100 text-violet-900 border-violet-200',
  'bg-teal-100 text-teal-900 border-teal-200',
  'bg-orange-100 text-orange-900 border-orange-200',
  'bg-indigo-100 text-indigo-900 border-indigo-200',
  'bg-lime-100 text-lime-900 border-lime-200',
  'bg-cyan-100 text-cyan-900 border-cyan-200',
  'bg-fuchsia-100 text-fuchsia-900 border-fuchsia-200',
  'bg-yellow-100 text-yellow-900 border-yellow-200',
];

function departmentColorIndex(code: number | null | undefined, name: string): number {
  const n = Number(code);
  if (Number.isFinite(n)) return Math.abs(n) % DEPT_ROW_COLORS.length;
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash + name.charCodeAt(i) * (i + 1)) % 997;
  return hash % DEPT_ROW_COLORS.length;
}

export default function OrderEngine({ connected }: { connected: boolean }) {
  const [suppliers, setSuppliers] = useState<ConfiguredSupplier[]>([]);
  const [configs, setConfigs] = useState<SupplierConfigMap>({});
  const [supplierId, setSupplierId] = useState('');
  const [scheduleIndex, setScheduleIndex] = useState(0);

  // Main Starred Products State
  const [starredItems, setStarredItems] = useState<StarredItem[]>([]);
  const [loadingStarred, setLoadingStarred] = useState(false);
  const [generatingDraft, setGeneratingDraft] = useState(false);
  const [draftGenerated, setDraftGenerated] = useState(false);

  // Saved Draft Orders State
  const [savedDrafts, setSavedDrafts] = useState<SavedDraftOrder[]>([]);
  const [showDraftHistory, setShowDraftHistory] = useState(false);
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);

  // View & Filter States
  const [viewMode, setViewMode] = useState<ProductViewMode>('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState<string[]>([]);
  const [brokenImages, setBrokenImages] = useState<Record<string | number, boolean>>({});

  // Supplier Config & Schedule State
  const [config, setConfig] = useState<SupplierConfig | null>(null);
  const [schedule, setSchedule] = useState<DeliverySchedule | null>(null);
  const [coverageDays, setCoverageDays] = useState<string[]>([]);
  const [supplier, setSupplier] = useState<Supplier | null>(null);

  // Messages
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Modal State for Products & Stars
  const [showProductsModal, setShowProductsModal] = useState(false);
  const [modalProducts, setModalProducts] = useState<SupplierProduct[]>([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalSearch, setModalSearch] = useState('');
  const [modalDeptFilter, setModalDeptFilter] = useState<string[]>([]);
  const [modalStarredOnly, setModalStarredOnly] = useState(false);
  const [modalSearchEntireCatalog, setModalSearchEntireCatalog] = useState(false);
  const [savingStars, setSavingStars] = useState(false);
  const [modalViewMode, setModalViewMode] = useState<ProductViewMode>('thumbnail');

  // Photo Upload & Square Crop State
  const [uploadingPhotoId, setUploadingPhotoId] = useState<number | null>(null);
  const [cropTargetProduct, setCropTargetProduct] = useState<{
    productId: number;
    productName: string;
    file: File;
  } | null>(null);

  // Product Alias (Rename) State
  const [renamingProduct, setRenamingProduct] = useState<{
    productId: number;
    currentName: string;
  } | null>(null);
  const [renameInput, setRenameInput] = useState('');
  const [savingRename, setSavingRename] = useState(false);

  // Quick Schedule Modal State
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [editingSchedules, setEditingSchedules] = useState<DeliverySchedule[]>([]);
  const [editingSafetyPct, setEditingSafetyPct] = useState(20);
  const [savingScheduleModal, setSavingScheduleModal] = useState(false);

  const openScheduleModal = () => {
    if (!supplierId) return;
    const currentCfg = activeConfig || normalizeSupplierConfig(null);
    setEditingSchedules(
      currentCfg.schedules?.length
        ? currentCfg.schedules.map((s) => ({ ...s }))
        : [defaultSchedule()]
    );
    setEditingSafetyPct(Math.round(((currentCfg.safetyMultiplier || 1.2) - 1) * 100));
    setShowScheduleModal(true);
  };

  const updateScheduleEntry = (index: number, patch: Partial<DeliverySchedule>) => {
    setEditingSchedules((prev) =>
      prev.map((s, i) => (i === index ? { ...s, ...patch } : s))
    );
  };

  const addScheduleEntry = () => {
    setEditingSchedules((prev) => [...prev, defaultSchedule()]);
  };

  const removeScheduleEntry = (index: number) => {
    setEditingSchedules((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  };

  const handleSaveQuickSchedule = async () => {
    if (!supplierId) return;
    setSavingScheduleModal(true);
    setError(null);
    try {
      const payload = {
        supplierId,
        schedules: editingSchedules,
        safetyMultiplier: 1 + Math.max(0, editingSafetyPct) / 100,
      };
      const res = await fetch('/api/supplier-configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Failed to save schedule');

      const updatedCfg = data.config || normalizeSupplierConfig(payload);
      setConfigs((prev) => ({ ...prev, [supplierId]: updatedCfg }));
      setShowScheduleModal(false);
      setInfo('Supplier delivery & lead time schedules saved successfully!');
    } catch (err: any) {
      setError(err.message || 'Failed to save schedule');
    } finally {
      setSavingScheduleModal(false);
    }
  };

  // Department settings & options
  const [departmentFlagsList, setDepartmentFlagsList] = useState<DepartmentFlagSetting[]>([]);
  const [availableDepartments, setAvailableDepartments] = useState<string[]>([]);

  const fetchDepartmentSettings = async () => {
    try {
      const res = await fetch('/api/pos/departments');
      if (res.ok) {
        const data = await res.json();
        if (data.departments && Array.isArray(data.departments)) {
          const flags: DepartmentFlagSetting[] = data.departments.map((d: any) => ({
            departmentCode: d.departmentCode,
            departmentName: d.departmentName || d.name || 'General',
            isCore: typeof d.isCore === 'boolean' ? d.isCore : true,
            isGeneral: typeof d.isGeneral === 'boolean' ? d.isGeneral : true,
          }));
          setDepartmentFlagsList(flags);
          const names = Array.from(new Set(flags.map((d) => d.departmentName))).filter(Boolean).sort();
          setAvailableDepartments(names);
        }
      }
    } catch (err) {
      console.error('Failed to load department settings in Order Engine', err);
    }
  };

  const hiddenDepartmentNamesSet = useMemo(() => {
    if (departmentFlagsList.length === 0) return new Set<string>();
    const hidden = departmentFlagsList.filter((d) => !d.isCore && !d.isGeneral);
    return new Set(hidden.map((d) => d.departmentName));
  }, [departmentFlagsList]);

  const fetchSavedDrafts = async () => {
    try {
      const res = await fetch('/api/draft-orders');
      const data = await res.json();
      if (data.drafts) setSavedDrafts(data.drafts);
    } catch (err) {
      console.error('Failed to load draft orders', err);
    }
  };

  const configuredSuppliers = useMemo(() => {
    const matched = suppliers.filter((s) => {
      const cfg = findConfigForSupplier(s, configs, suppliers);
      return !!cfg && Array.isArray(cfg.schedules) && cfg.schedules.length > 0;
    });

    const extraSuppliers: ConfiguredSupplier[] = [];
    for (const [cfgKey, rawCfg] of Object.entries(configs)) {
      const cfg = rawCfg as SupplierConfig;
      if (!cfg || !Array.isArray(cfg.schedules) || cfg.schedules.length === 0) continue;
      const alreadyMatched = matched.some((s) => {
        const idMatch = String(s.id) === cfgKey;
        const codeMatch = Boolean(s.code && s.code.toLowerCase() === cfgKey.toLowerCase());
        const nameMatch = Boolean(s.name && s.name.toLowerCase() === cfgKey.toLowerCase());
        return idMatch || codeMatch || nameMatch;
      });
      if (!alreadyMatched) {
        extraSuppliers.push({
          id: cfgKey,
          name: cfgKey,
          code: cfgKey,
        });
      }
    }

    const combined = [...matched, ...extraSuppliers];
    return combined.sort((a, b) =>
      (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base', numeric: true })
    );
  }, [suppliers, configs]);

  useEffect(() => {
    void loadConfiguredSuppliers();
    void fetchSavedDrafts();
    void fetchDepartmentSettings();
  }, []);

  // Auto-select first supplier with schedule if none selected
  useEffect(() => {
    if (!supplierId && configuredSuppliers.length > 0) {
      setSupplierId(String(configuredSuppliers[0].id));
    }
  }, [configuredSuppliers, supplierId]);


  // When supplier selection changes
  useEffect(() => {
    if (!supplierId) {
      setStarredItems([]);
      setDraftGenerated(false);
      setCurrentDraftId(null);
      return;
    }


    const cfg = findConfigForSupplier(supplierId, configs, suppliers);
    let defaultIdx = 0;
    if (cfg?.schedules?.length) {
      defaultIdx = pickNextScheduleIndex(cfg.schedules);
      if (scheduleIndex === undefined || scheduleIndex === null) {
        setScheduleIndex(defaultIdx);
      }
    }

    const targetIndex = scheduleIndex ?? defaultIdx;

    // Reuse existing draft order from history if matching supplier & schedule index
    const matchingDraft = savedDrafts.find(
      (d) => String(d.supplierId) === String(supplierId) && (d.scheduleIndex ?? 0) === targetIndex
    );

    if (matchingDraft) {
      handleLoadDraft(matchingDraft);
    } else {
      setDraftGenerated(false);
      setCurrentDraftId(null);
      setError(null);
      setInfo(null);
      void loadStarredItemsForSupplier(supplierId);
    }
  }, [supplierId, scheduleIndex, savedDrafts]);

  const loadConfiguredSuppliers = async () => {
    try {
      const [supRes, cfgRes] = await Promise.all([
        fetch('/api/suppliers/configured'),
        fetch('/api/supplier-configs'),
      ]);
      const supData = await supRes.json();
      const cfgData = normalizeSupplierConfigMap(await cfgRes.json());
      if (supData.error) throw new Error(supData.error);
      const rawSups = supData.suppliers || [];
      const normalizedSups = rawSups.map((s: any) => ({
        ...s,
        id: String(s.id ?? s.supplierId ?? s.SupplierID ?? ''),
        name: s.name ?? s.SupplierName ?? `Supplier #${s.id || s.supplierId || s.SupplierID}`,
        code: s.code ?? s.SupplierCode ?? '',
      }));
      setSuppliers(normalizedSups);
      setConfigs(cfgData);
    } catch (err: any) {
      setError(err.message || 'Failed to load configured suppliers');
    }
  };

  const loadStarredItemsForSupplier = async (sId: string) => {
    setLoadingStarred(true);
    setError(null);
    try {
      const res = await fetch(`/api/suppliers/${encodeURIComponent(sId)}/products`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const allProds: SupplierProduct[] = data.products || [];
      const starredOnly = allProds.filter((p) => p.starred);
      const itemsToUse = starredOnly;

      const mapped: StarredItem[] = itemsToUse.map((p) => {
        const dbStock = p.currentStock ?? 0;
        return {
          productId: Number(p.productId),
          stockCode: (p as any).stockCode || (p as any).Code || p.barcode || String(p.productId),
          barcode: p.barcode || '',
          description: p.description || '',
          departmentCode: (p as any).departmentCode ?? null,
          departmentName: p.department || (p as any).departmentName || 'Unassigned',
          cost: p.cost ?? 0,
          dbStock,
          manualStock: dbStock < 0 ? '' : dbStock, // Keep negative stock empty/optional
          photoUrl: p.photoUrl || null,
          recommendedQty: null,
          orderQty: null,
          minPackQty: p.minPackQty || 1,
          shelfLifeDays: p.shelfLifeDays || 10,
        };
      });

      setStarredItems(mapped);
    } catch (err: any) {
      setError(err.message || 'Failed to load starred products');
      setStarredItems([]);
    } finally {
      setLoadingStarred(false);
    }
  };

  const displayedSuppliers = useMemo(() => {
    if (configuredSuppliers.length > 0) {
      const confIds = new Set(configuredSuppliers.map((s) => String(s.id)));
      const otherSups = suppliers.filter((s) => !confIds.has(String(s.id)));
      return {
        configured: configuredSuppliers,
        others: otherSups,
      };
    }
    return {
      configured: [],
      others: suppliers,
    };
  }, [configuredSuppliers, suppliers]);

  const activeConfig = useMemo(() => {
    if (config) return normalizeSupplierConfig(config);
    if (!supplierId) return null;
    const cfg = findConfigForSupplier(supplierId, configs, suppliers);
    return normalizeSupplierConfig(cfg);
  }, [config, configs, supplierId, suppliers]);

  const selectedSchedules = activeConfig?.schedules || [];

  const upcomingCutoffs = useMemo(() => {
    if (!selectedSchedules || selectedSchedules.length === 0) return [];
    return getUpcomingCutoffOccurrences(selectedSchedules, 4);
  }, [selectedSchedules]);

  const [selectedOccurrenceIdx, setSelectedOccurrenceIdx] = useState(0);

  useEffect(() => {
    setSelectedOccurrenceIdx(0);
  }, [supplierId]);

  const activeOccurrence = upcomingCutoffs[selectedOccurrenceIdx] || upcomingCutoffs[0] || null;

  useEffect(() => {
    if (activeOccurrence) {
      setScheduleIndex(activeOccurrence.scheduleIndex);
    }
  }, [activeOccurrence]);

  const selectedSchedule =
    schedule || selectedSchedules[scheduleIndex] || selectedSchedules[0] || null;
  const previewCoverage = selectedSchedule
    ? getCoverageDays(selectedSchedule.cutOffDay, selectedSchedule.deliveryDay)
    : [];

  // Cut-off time check for locking edits on draft
  const isCutoffLocked = useMemo(() => {
    if (!selectedSchedule || !selectedSchedule.cutOffDay || !selectedSchedule.cutOffTime) return false;
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const now = new Date();
    const currentDayIdx = now.getDay();
    const cutoffDayIdx = days.indexOf(selectedSchedule.cutOffDay.toLowerCase());
    if (cutoffDayIdx === -1) return false;

    const [cutHours, cutMins] = (selectedSchedule.cutOffTime || '17:00').split(':').map((n) => parseInt(n, 10) || 0);

    if (currentDayIdx > cutoffDayIdx) return true;
    if (currentDayIdx === cutoffDayIdx) {
      const cutOffDateTime = new Date();
      cutOffDateTime.setHours(cutHours, cutMins, 0, 0);
      return now > cutOffDateTime;
    }
    return false;
  }, [selectedSchedule]);

  // Save Draft Order Handler
  const handleSaveDraft = async () => {
    if (!supplierId || starredItems.length === 0) return;
    setSavingDraft(true);
    setError(null);
    setInfo(null);
    try {
      const supName = suppliers.find((s) => String(s.id) === supplierId)?.name || 'Supplier';
      const schedLabel = selectedSchedule ? formatSchedule(selectedSchedule) : 'Standard Schedule';

      const res = await fetch('/api/draft-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: currentDraftId,
          supplierId,
          supplierName: supName,
          scheduleLabel: schedLabel,
          scheduleIndex,
          items: starredItems,
          status: draftGenerated ? 'Calculated Draft' : 'Saved Draft',
        }),
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to save draft order');

      setCurrentDraftId(data.draft.id);
      setInfo('Draft Order saved successfully! Re-open or modify anytime from Draft Order History.');
      void fetchSavedDrafts();
    } catch (err: any) {
      setError(err.message || 'Failed to save draft order');
    } finally {
      setSavingDraft(false);
    }
  };

  const handleLoadDraft = (draft: SavedDraftOrder) => {
    setSupplierId(draft.supplierId);
    setScheduleIndex(draft.scheduleIndex || 0);
    setCurrentDraftId(draft.id);

    if (Array.isArray(draft.items) && draft.items.length > 0) {
      setStarredItems(
        draft.items.map((i: any) => ({
          productId: Number(i.productId),
          stockCode: i.stockCode || i.barcode || String(i.productId),
          barcode: i.barcode || '',
          description: i.description || '',
          departmentCode: i.departmentCode ?? null,
          departmentName: i.departmentName || 'Unassigned',
          cost: i.cost ?? 0,
          dbStock: i.dbStock ?? 0,
          manualStock: i.manualStock !== undefined ? i.manualStock : (i.dbStock < 0 ? '' : i.dbStock),
          photoUrl: i.photoUrl || null,
          recommendedQty: i.recommendedQty ?? null,
          orderQty: i.orderQty ?? null,
          coverageAvg: i.coverageAvg,
          reason: i.reason,
        }))
      );
      setDraftGenerated(draft.items.some((i: any) => i.recommendedQty !== null));
    }
    setShowDraftHistory(false);
    setInfo(`Loaded draft order for ${draft.supplierName} (${new Date(draft.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`);
  };

  const handleDeleteDraft = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/draft-orders/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setSavedDrafts((prev) => prev.filter((d) => d.id !== id));
        if (currentDraftId === id) setCurrentDraftId(null);
      }
    } catch (err) {
      console.error('Failed to delete draft order', err);
    }
  };

  // Generate Draft Order handler
  const generateDraftOrder = async (useAI = false) => {
    if (!supplierId || starredItems.length === 0) return;
    setGeneratingDraft(true);
    setError(null);
    setInfo(null);

    try {
      // Pass manual current stock entries as overrides
      const stockOverrides: Record<number, number> = {};
      for (const item of starredItems) {
        stockOverrides[item.productId] =
          item.manualStock === ''
            ? (item.dbStock < 0 ? 0 : item.dbStock)
            : Number(item.manualStock) || 0;
      }

      const res = await fetch('/api/orders/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId,
          scheduleIndex,
          stockOverrides,
          useAI,
          items: starredItems.map((item) => ({
            productId: item.productId,
            stockCode: item.stockCode,
            barcode: item.barcode,
            description: item.description,
            departmentCode: item.departmentCode,
            departmentName: item.departmentName,
            cost: item.cost,
            dbStock: item.dbStock,
            manualStock: item.manualStock,
            minPackQty: item.minPackQty || 1,
            shelfLifeDays: item.shelfLifeDays || 10,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Failed to generate draft');

      setSupplier(data.supplier);
      setConfig(normalizeSupplierConfig(data.config));
      setSchedule(data.schedule || null);
      setCoverageDays(data.coverageDays || []);

      const recMap = new Map<number, OrderRecommendation>();
      for (const r of data.recommendations || []) {
        recMap.set(Number(r.productId), r);
      }

      setStarredItems((prev) =>
        prev.map((item) => {
          const rec = recMap.get(item.productId);
          if (!rec) return item;
          return {
            ...item,
            stockCode: (rec as any).stockCode || item.stockCode,
            recommendedQty: rec.recommendedQty,
            orderQty: rec.recommendedQty,
            coverageAvg: (rec as any).coverageAvg,
            reason: rec.reason,
            minPackQty: rec.minPackQty || item.minPackQty || 1,
            shelfLifeDays: rec.shelfLifeDays || item.shelfLifeDays || 10,
          };
        })
      );

      setDraftGenerated(true);
      if (data.message) setInfo(data.message);
    } catch (err: any) {
      setError(err.message || 'Failed to generate draft order');
    } finally {
      setGeneratingDraft(false);
    }
  };

  // Input handlers for items (strictly prevents negative numbers)
  const handleManualStockChange = (productId: number, val: string) => {
    if (isCutoffLocked) return;
    if (val === '') {
      setStarredItems((prev) =>
        prev.map((item) => (item.productId === productId ? { ...item, manualStock: '' } : item))
      );
      return;
    }
    const cleanStr = val.replace(/[^0-9]/g, '');
    const valueToSet = cleanStr === '' ? '' : Math.max(0, parseInt(cleanStr, 10));
    setStarredItems((prev) =>
      prev.map((item) => (item.productId === productId ? { ...item, manualStock: valueToSet } : item))
    );
  };

  const handleOrderQtyChange = (productId: number, val: string) => {
    if (isCutoffLocked) return;
    if (val === '') {
      setStarredItems((prev) =>
        prev.map((item) => (item.productId === productId ? { ...item, orderQty: '' as any } : item))
      );
      return;
    }
    const cleanStr = val.replace(/[^0-9]/g, '');
    const qty = cleanStr === '' ? ('' as any) : Math.max(0, parseInt(cleanStr, 10));
    setStarredItems((prev) =>
      prev.map((item) => (item.productId === productId ? { ...item, orderQty: qty } : item))
    );
  };

  const handleOrderQtyBlur = (productId: number) => {
    setStarredItems((prev) =>
      prev.map((item) => {
        if (item.productId !== productId) return item;
        const val = typeof item.orderQty === 'number' ? item.orderQty : parseInt(String(item.orderQty || '0'), 10);
        return { ...item, orderQty: Number.isFinite(val) && val >= 0 ? val : 0 };
      })
    );
  };

  const handleOrderQtyStep = (productId: number, delta: number) => {
    if (isCutoffLocked) return;
    setStarredItems((prev) =>
      prev.map((item) => {
        if (item.productId !== productId) return item;
        const step = Math.max(1, item.minPackQty || 1);
        const currentQty = typeof item.orderQty === 'number' ? item.orderQty : parseInt(String(item.orderQty || '0'), 10) || 0;
        const newQty = Math.max(0, currentQty + delta * step);
        return { ...item, orderQty: newQty };
      })
    );
  };

  const handleModalPackQtyChange = (productId: number | string, val: string) => {
    if (val === '') {
      setModalProducts((prev) =>
        prev.map((p) => (String(p.productId) === String(productId) ? { ...p, minPackQty: '' } : p))
      );
      return;
    }
    const cleanDigits = val.replace(/[^0-9]/g, '');
    const cleanVal = cleanDigits === '' ? '' : parseInt(cleanDigits, 10);
    setModalProducts((prev) =>
      prev.map((p) => (String(p.productId) === String(productId) ? { ...p, minPackQty: cleanVal } : p))
    );
  };

  const handleModalPackQtyBlur = (productId: number | string) => {
    setModalProducts((prev) =>
      prev.map((p) => {
        if (String(p.productId) !== String(productId)) return p;
        const num = typeof p.minPackQty === 'number' ? p.minPackQty : parseInt(String(p.minPackQty || ''), 10);
        const finalVal = !Number.isFinite(num) || num < 1 ? 1 : num;
        return { ...p, minPackQty: finalVal };
      })
    );
  };

  const handleModalShelfLifeChange = (productId: number | string, val: string) => {
    if (val === '') {
      setModalProducts((prev) =>
        prev.map((p) => (String(p.productId) === String(productId) ? { ...p, shelfLifeDays: '' } : p))
      );
      return;
    }
    const cleanDigits = val.replace(/[^0-9]/g, '');
    const cleanVal = cleanDigits === '' ? '' : parseInt(cleanDigits, 10);
    setModalProducts((prev) =>
      prev.map((p) => (String(p.productId) === String(productId) ? { ...p, shelfLifeDays: cleanVal } : p))
    );
  };

  const handleModalShelfLifeBlur = (productId: number | string) => {
    setModalProducts((prev) =>
      prev.map((p) => {
        if (String(p.productId) !== String(productId)) return p;
        const num = typeof p.shelfLifeDays === 'number' ? p.shelfLifeDays : parseInt(String(p.shelfLifeDays || ''), 10);
        const finalVal = !Number.isFinite(num) || num < 1 ? 10 : num;
        return { ...p, shelfLifeDays: finalVal };
      })
    );
  };

  // Auto-select text on focus on desktop devices ONLY.
  // Strictly disabled for mobile & touch views so that mobile OS does NOT show Cut/Copy/Paste floating toolbar.
  const handleDesktopFocusSelect = (e: React.FocusEvent<HTMLInputElement>) => {
    if (typeof window === 'undefined') return;

    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0 || ((navigator as any).msMaxTouchPoints > 0);
    const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet/i.test(navigator.userAgent || '');
    const isCoarse = window.matchMedia && (
      window.matchMedia('(pointer: coarse)').matches ||
      window.matchMedia('(any-pointer: coarse)').matches
    );
    const isSmallWidth = window.innerWidth < 1024;

    // Never auto-select on mobile, tablet, or touch-screen viewports
    if (hasTouch || isMobileUA || isCoarse || isSmallWidth) {
      return;
    }

    // On desktop, defer select so that subsequent mouseup doesn't cancel selection
    const target = e.currentTarget;
    requestAnimationFrame(() => {
      if (document.activeElement === target) {
        target.select();
      }
    });
  };

  // Close active draft & move to draft history
  const handleCloseDraftAndMoveToHistory = async () => {
    if (supplierId && starredItems.length > 0) {
      await handleSaveDraft();
    }
    setInfo('Draft Order closed and saved to Draft History below.');
    setDraftGenerated(false);
    setCurrentDraftId(null);
    setStarredItems([]);
    setSupplierId('');
    setTimeout(() => {
      const el = document.getElementById('draft-history-section');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  // Product Photo Upload
  const triggerPhotoCropModal = (productId: number, productName: string, file: File) => {
    setCropTargetProduct({ productId, productName, file });
  };

  const handleSaveCroppedPhoto = async (croppedDataUrl: string) => {
    if (!cropTargetProduct) return;
    const { productId } = cropTargetProduct;
    setUploadingPhotoId(productId);
    setError(null);
    try {
      const res = await fetch('/api/product-photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          mimeType: 'image/jpeg',
          data: croppedDataUrl,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Photo upload failed');

      setStarredItems((prev) =>
        prev.map((item) => (item.productId === productId ? { ...item, photoUrl: data.photoUrl } : item))
      );
      setModalProducts((prev) =>
        prev.map((p) => (p.productId === productId ? { ...p, photoUrl: data.photoUrl } : p))
      );
      setBrokenImages((prev) => ({ ...prev, [productId]: false }));
    } catch (err: any) {
      setError(err.message || 'Failed to upload photo');
    } finally {
      setUploadingPhotoId(null);
      setCropTargetProduct(null);
    }
  };

  const handleSaveRename = async () => {
    if (!renamingProduct) return;
    const { productId } = renamingProduct;
    const customName = renameInput.trim();
    setSavingRename(true);
    setError(null);
    try {
      const res = await fetch('/api/product-aliases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, customName }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Failed to save product rename');

      // Update name locally in state
      setStarredItems((prev) =>
        prev.map((item) =>
          item.productId === productId ? { ...item, description: customName || renamingProduct.currentName } : item
        )
      );
      setModalProducts((prev) =>
        prev.map((p) =>
          Number(p.productId) === productId ? { ...p, description: customName || renamingProduct.currentName } : p
        )
      );
      setRenamingProduct(null);
    } catch (err: any) {
      setError(err.message || 'Failed to rename product');
    } finally {
      setSavingRename(false);
    }
  };

  const removePhoto = async (productId: number) => {
    try {
      const res = await fetch(`/api/product-photos/${productId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Failed to remove photo');

      setStarredItems((prev) =>
        prev.map((item) => (item.productId === productId ? { ...item, photoUrl: null } : item))
      );
      setModalProducts((prev) =>
        prev.map((p) => (p.productId === productId ? { ...p, photoUrl: null } : p))
      );
    } catch (err: any) {
      setError(err.message || 'Failed to remove photo');
    }
  };

  const scheduleAssignedDepts = selectedSchedule?.departments || [];

  // Filtered Starred Items (supports wildcard * and multi-keyword search)
  const filteredStarredItems = useMemo(() => {
    return starredItems.filter((item) => {
      // Exclude hidden departments from Department Settings
      if (hiddenDepartmentNamesSet.has(item.departmentName)) return false;

      // If active schedule specifies assigned departments, restrict to those
      if (scheduleAssignedDepts.length > 0 && !scheduleAssignedDepts.includes(item.departmentName)) {
        return false;
      }

      // User dropdown filter
      if (deptFilter.length > 0 && !deptFilter.includes(item.departmentName)) return false;

      return matchesWildcardSearch(
        [item.description, item.stockCode, item.barcode, item.productId, item.departmentName],
        searchQuery
      );
    });
  }, [starredItems, searchQuery, deptFilter, hiddenDepartmentNamesSet, scheduleAssignedDepts]);

  // Group filtered items by Department for Table view (Sorted by Department Code, then Name)
  const departmentGroups = useMemo(() => {
    const map = new Map<string, { code: number | null; name: string; items: StarredItem[] }>();
    for (const item of filteredStarredItems) {
      const key = `${item.departmentCode ?? 'x'}::${item.departmentName}`;
      if (!map.has(key)) {
        map.set(key, { code: item.departmentCode, name: item.departmentName, items: [] });
      }
      map.get(key)!.items.push(item);
    }

    return [...map.values()]
      .sort((a, b) => (a.code ?? 0) - (b.code ?? 0) || a.name.localeCompare(b.name))
      .map((group) => ({
        ...group,
        items: [...group.items].sort((a, b) => compareByPackSize(a.description, b.description)),
      }));
  }, [filteredStarredItems]);

  const departmentOptions = useMemo(() => {
    const set = new Set<string>();
    for (const item of starredItems) {
      if (hiddenDepartmentNamesSet.has(item.departmentName)) continue;
      if (scheduleAssignedDepts.length > 0 && !scheduleAssignedDepts.includes(item.departmentName)) continue;
      set.add(item.departmentName);
    }
    return [...set].sort();
  }, [starredItems, hiddenDepartmentNamesSet, scheduleAssignedDepts]);

  // Totals
  const activeOrderLines = starredItems.filter((i) => {
    if (hiddenDepartmentNamesSet.has(i.departmentName)) return false;
    if (scheduleAssignedDepts.length > 0 && !scheduleAssignedDepts.includes(i.departmentName)) return false;
    return (i.orderQty ?? 0) > 0;
  });
  const totalUnits = activeOrderLines.reduce((sum, i) => sum + (i.orderQty || 0), 0);
  const totalCost = activeOrderLines.reduce((sum, i) => sum + (i.orderQty || 0) * (i.cost || 0), 0);

  // Products Modal Handlers
  const fetchModalProducts = async (includeAll = false) => {
    if (!supplierId) return;
    setModalLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/suppliers/${encodeURIComponent(supplierId)}/products${includeAll ? '?all=true' : ''}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setModalProducts(data.products || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load products');
    } finally {
      setModalLoading(false);
    }
  };

  const openProductsModal = async () => {
    if (!supplierId) return;
    setModalSearch('');
    setModalDeptFilter([]);
    setModalStarredOnly(false);
    setModalSearchEntireCatalog(false);
    setShowProductsModal(true);
    await fetchModalProducts(false);
  };

  const handleToggleCatalogScope = async (includeAll: boolean) => {
    setModalSearchEntireCatalog(includeAll);
    await fetchModalProducts(includeAll);
  };

  const toggleModalStar = (productId: number) => {
    setModalProducts((prev) =>
      prev.map((p) => (p.productId === productId ? { ...p, starred: !p.starred } : p))
    );
  };

  const handleUnstarProduct = async (productId: number) => {
    if (!supplierId) return;
    const remaining = starredItems.filter((i) => i.productId !== productId);
    setStarredItems(remaining);
    const productIds = remaining.map((i) => i.productId);
    try {
      await fetch('/api/starred-products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supplierId, productIds }),
      });
      setSuppliers((prev) =>
        prev.map((s) =>
          String(s.id) === supplierId ? { ...s, starredCount: productIds.length } : s
        )
      );
    } catch (err: any) {
      console.error('Failed to unstar product:', err);
      setError('Failed to update starred products');
    }
  };

  const closeProductsModal = async () => {
    if (!supplierId) {
      setShowProductsModal(false);
      return;
    }
    setSavingStars(true);
    setError(null);
    try {
      const productIds = modalProducts.filter((p) => p.starred).map((p) => Number(p.productId));
      const packSizesMap: Record<string, { minPackQty: number; shelfLifeDays: number }> = {};
      for (const p of modalProducts) {
        if (p.minPackQty !== undefined || p.shelfLifeDays !== undefined) {
          const rawPack = typeof p.minPackQty === 'number' ? p.minPackQty : parseInt(String(p.minPackQty || '1'), 10);
          const rawShelf = typeof p.shelfLifeDays === 'number' ? p.shelfLifeDays : parseInt(String(p.shelfLifeDays || '10'), 10);
          packSizesMap[String(p.productId)] = {
            minPackQty: Number.isFinite(rawPack) && rawPack >= 1 ? rawPack : 1,
            shelfLifeDays: Number.isFinite(rawShelf) && rawShelf >= 1 ? rawShelf : 10,
          };
        }
      }

      const [resStars, resPacks] = await Promise.all([
        fetch('/api/starred-products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ supplierId, productIds }),
        }),
        fetch('/api/product-pack-sizes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ packSizes: packSizesMap }),
        }),
      ]);

      const data = await resStars.json();
      if (!data.success) throw new Error(data.message || 'Failed to save stars');

      // Update supplier count
      setSuppliers((prev) =>
        prev.map((s) =>
          String(s.id) === supplierId ? { ...s, starredCount: productIds.length } : s
        )
      );

      void loadStarredItemsForSupplier(supplierId);
      setShowProductsModal(false);
    } catch (err: any) {
      setError(err.message || 'Failed to save starred products');
    } finally {
      setSavingStars(false);
    }
  };

  // Supports wildcard * matching across code, description, barcode, ID, and department
  const filteredModalProducts = useMemo(() => {
    return modalProducts.filter((p) => {
      if (modalStarredOnly && !p.starred) return false;
      const deptName = p.department || (p as any).departmentName;
      if (modalDeptFilter.length > 0 && !modalDeptFilter.includes(deptName))
        return false;
      return matchesWildcardSearch(
        [
          p.description,
          (p as any).stockCode,
          (p as any).Code,
          p.barcode,
          p.productId,
          deptName,
        ],
        modalSearch
      );
    });
  }, [modalProducts, modalSearch, modalDeptFilter, modalStarredOnly]);

  // Export CSV
  const exportCsv = () => {
    const header = ['StockCode', 'Barcode', 'Description', 'Department', 'CurrentStock', 'OrderQty', 'Cost', 'LineTotal'];
    const lines = activeOrderLines.map((i) =>
      [
        csvEscape(i.stockCode),
        csvEscape(i.barcode),
        csvEscape(i.description),
        csvEscape(i.departmentName),
        i.manualStock,
        i.orderQty || 0,
        i.cost,
        ((i.orderQty || 0) * (i.cost || 0)).toFixed(2),
      ].join(',')
    );
    const supplierName = suppliers.find((s) => String(s.id) === supplierId)?.name || 'supplier';
    downloadBlob(
      [header.join(','), ...lines].join('\n'),
      `kwikorder-${slugify(supplierName)}-${todayStamp()}.csv`,
      'text/csv;charset=utf-8'
    );
  };

  // Print Order
  const printOrder = () => {
    const supplierName = suppliers.find((s) => String(s.id) === supplierId)?.name || 'Supplier';
    const coverageLabel = (coverageDays.length ? coverageDays : previewCoverage).join(', ');

    const bodyRows = activeOrderLines
      .map(
        (i) => `<tr>
          <td><strong>${escapeHtml(i.stockCode)}</strong></td>
          <td>${escapeHtml(i.barcode || '-')}</td>
          <td>${escapeHtml(i.description)}</td>
          <td class="num">${i.manualStock}</td>
          <td class="num" style="font-weight:bold">${i.orderQty || 0}</td>
          <td>${escapeHtml(i.reason || '')}</td>
        </tr>`
      )
      .join('');

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Draft Order - ${escapeHtml(supplierName)}</title>
  <style>
    body { font-family: Segoe UI, Arial, sans-serif; color: #111; margin: 24px; }
    h1 { margin: 0 0 4px; font-size: 22px; }
    .meta { color: #555; margin-bottom: 16px; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
    th { background: #f3f4f6; }
    td.num, th.num { text-align: right; }
    .totals { margin-top: 16px; font-size: 14px; }
  </style>
</head>
<body>
  <h1>KwikOrder — ${escapeHtml(supplierName)}</h1>
  <div class="meta">
    Generated ${new Date().toLocaleString()}
    ${selectedSchedule ? ` · ${escapeHtml(formatSchedule(selectedSchedule))}` : ''}
    ${coverageLabel ? ` · Coverage days: ${escapeHtml(coverageLabel)}` : ''}
  </div>
  <table>
    <thead>
      <tr>
        <th>Stock Code</th>
        <th>Barcode</th>
        <th>Description</th>
        <th class="num">Current Stock</th>
        <th class="num">Order Qty</th>
        <th>Reason</th>
      </tr>
    </thead>
    <tbody>${bodyRows}</tbody>
  </table>
  <div class="totals"><strong>Lines:</strong> ${activeOrderLines.length} &nbsp;|&nbsp; <strong>Total Units:</strong> ${totalUnits}</div>
  <script>window.onload = () => window.print();</script>
</body>
</html>`;
    const win = window.open('', '_blank', 'noopener,noreferrer,width=900,height=700');
    if (!win) {
      setError('Pop-up blocked. Allow pop-ups to print/export PDF.');
      return;
    }
    win.document.write(html);
    win.document.close();
  };

  return (
    <div className="space-y-6">
      {!connected && (
        <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-3 px-4 flex items-center justify-between text-xs text-amber-900 shadow-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Cloned Database / Offline Mode Active:</strong> Generating draft orders using local cached supplier and inventory data.
            </span>
          </div>
          <span className="text-amber-800 font-semibold bg-amber-200/60 px-2 py-0.5 rounded-md text-[11px]">
            Cached Mode
          </span>
        </div>
      )}

      {/* Header & Supplier Config Selector */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <ClipboardList className="w-6 h-6 text-blue-600 shrink-0" />
            <div>
              <h2 className="text-2xl font-semibold text-gray-900">Order Engine</h2>
              <p className="text-sm text-gray-500">
                Starred products · sales coverage replenishment strategy
              </p>
            </div>
          </div>

          {supplierId && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void openProductsModal()}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-all shadow-xs flex items-center gap-2"
              >
                <Star className="w-4 h-4 fill-white" />
                <span>Products &amp; Stars</span>
              </button>
            </div>
          )}
        </div>

        {suppliers.length === 0 ? (
          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-lg p-4">
            No suppliers found in database. Connect your database or check Server Settings.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-700">Select Supplier</label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium text-sm"
              >
                <option value="">Select Supplier to Order</option>
                {displayedSuppliers.configured.length > 0 && (
                  <optgroup label="Configured Suppliers (With Schedule)">
                    {displayedSuppliers.configured.map((s, idx) => (
                      <option key={`sup-conf-${s.id}-${idx}`} value={String(s.id)}>
                        {s.name || `Supplier #${s.id}`} {s.code ? `(${s.code})` : ''}
                      </option>
                    ))}
                  </optgroup>
                )}
                {displayedSuppliers.others.length > 0 && (
                  <optgroup label={displayedSuppliers.configured.length > 0 ? "Other IdealPOS Suppliers" : "All IdealPOS Suppliers"}>
                    {displayedSuppliers.others.map((s, idx) => (
                      <option key={`sup-oth-${s.id}-${idx}`} value={String(s.id)}>
                        {s.name || `Supplier #${s.id}`} {s.code ? `(${s.code})` : ''}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-gray-700">Order Delivery Schedule</label>
                {supplierId && (
                  <button
                    type="button"
                    onClick={openScheduleModal}
                    className="text-xs text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 hover:underline"
                  >
                    <Pencil className="w-3 h-3" />
                    Edit Schedule &amp; Lead Time
                  </button>
                )}
              </div>
              <select
                value={selectedOccurrenceIdx}
                onChange={(e) => {
                  const idx = Number(e.target.value);
                  setSelectedOccurrenceIdx(idx);
                  if (upcomingCutoffs[idx]) {
                    setScheduleIndex(upcomingCutoffs[idx].scheduleIndex);
                  }
                }}
                disabled={!supplierId || upcomingCutoffs.length === 0}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white disabled:bg-gray-50 text-sm font-medium"
              >
                {upcomingCutoffs.length === 0 ? (
                  <option value={0}>No schedule configured for this supplier</option>
                ) : (
                  upcomingCutoffs.map((occ, i) => {
                    const supName = suppliers.find((s) => String(s.id) === supplierId)?.name || '';
                    return (
                      <option key={`cutoff-opt-${occ.scheduleIndex}-${i}`} value={i}>
                        {supName ? `${supName} — ` : ''}{occ.displayText}
                      </option>
                    );
                  })
                )}
              </select>
            </div>
          </div>
        )}

        {supplierId && selectedSchedule && (
          <div className="p-3.5 rounded-lg bg-blue-50/80 border border-blue-100 text-blue-900 text-xs leading-relaxed space-y-1">
            <p>
              <strong>{suppliers.find((s) => String(s.id) === supplierId)?.name}</strong>
              {' '}— order by{' '}
              <span className="font-semibold text-blue-950 underline decoration-blue-300">
                {activeOccurrence
                  ? `${activeOccurrence.cutoffDayName} ${String(activeOccurrence.cutoffDate.getDate()).padStart(2, '0')}/${String(activeOccurrence.cutoffDate.getMonth() + 1).padStart(2, '0')} ${formatTime(activeOccurrence.cutoffTimeStr)}`
                  : `${selectedSchedule.cutOffDay} ${formatTime(selectedSchedule.cutOffTime)}`}
              </span>{' '}
              for <strong className="text-blue-950">
                {activeOccurrence
                  ? `${activeOccurrence.deliveryDayName} ${String(activeOccurrence.deliveryDate.getDate()).padStart(2, '0')}/${String(activeOccurrence.deliveryDate.getMonth() + 1).padStart(2, '0')}`
                  : selectedSchedule.deliveryDay}
              </strong> delivery.
            </p>
            <p className="text-blue-800">
              Usage period checked:{' '}
              <strong>{(coverageDays.length ? coverageDays : previewCoverage).join(', ')}</strong>
              {' '}(4-week average sales, fallback 12-week). Safety buffer: {Math.round(((activeConfig?.safetyMultiplier || 1.2) - 1) * 100)}%.
            </p>
          </div>
        )}

        {info && (
          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center justify-between">
            <span>{info}</span>
            <button onClick={() => setInfo(null)} className="text-emerald-700 hover:text-emerald-900">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Main Starred Products Container */}
      {supplierId ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden space-y-0">
          {/* Toolbar above starred list */}
          <div className="p-4 bg-slate-50 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-sm font-bold text-gray-900">
                <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                Starred Products
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs font-bold">
                {starredItems.length}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Search filter */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search code, description, or * (e.g. bega*milk)…"
                  title="Search items with text or * wildcard"
                  className="pl-8 pr-3 py-1.5 text-xs bg-white border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 w-52 sm:w-64"
                />
              </div>

              {/* Department filter */}
              {departmentOptions.length > 0 && (
                <div className="w-52">
                  <MultiSelectDepartmentDropdown
                    departments={departmentOptions}
                    selectedDepartments={deptFilter}
                    onChange={setDeptFilter}
                    placeholder="All Departments"
                  />
                </div>
              )}

              {/* View Mode Toggle Button Bar */}
              <div className="flex items-center bg-white border border-gray-300 rounded-lg p-0.5 shadow-xs">
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md flex items-center gap-1.5 transition-colors ${
                    viewMode === 'table'
                      ? 'bg-blue-600 text-white font-semibold'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                  title="Table View"
                >
                  <LayoutList className="w-3.5 h-3.5" />
                  <span>Table</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('thumbnail')}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md flex items-center gap-1.5 transition-colors ${
                    viewMode === 'thumbnail'
                      ? 'bg-blue-600 text-white font-semibold'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                  title="Thumbnail Grid View"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>Thumbnail</span>
                </button>
              </div>
            </div>
          </div>

          {/* Loading or Empty state */}
          {loadingStarred ? (
            <div className="p-12 text-center text-gray-500 space-y-3">
              <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mx-auto" />
              <p className="text-sm font-medium">Loading starred products for supplier…</p>
            </div>
          ) : starredItems.length === 0 ? (
            <div className="p-12 text-center text-gray-500 space-y-3">
              <Star className="w-10 h-10 text-amber-300 mx-auto" />
              <h4 className="text-base font-semibold text-gray-900">No starred products for this supplier</h4>
              <p className="text-xs text-gray-500 max-w-md mx-auto">
                No products are starred by default. Open <strong>Products &amp; Stars</strong> to star the regular products you order from this supplier. Once starred, they will stay starred until you remove the star.
              </p>
              <button
                type="button"
                onClick={() => void openProductsModal()}
                className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors inline-flex items-center gap-2 shadow-xs"
              >
                <Star className="w-4 h-4 fill-white" />
                Select &amp; Star Products
              </button>
            </div>
          ) : viewMode === 'table' ? (
            /* ================================================================== */
            /* TABLE VIEW (Product Info, Stock On Hand, Total Sold, Order Qty)    */
            /* ================================================================== */
            <div>
              {/* DESKTOP TABLE VIEW (md:block) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-100 text-gray-700 font-semibold text-xs uppercase tracking-wider border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-3">Product Description &amp; Sales Info</th>
                      <th className="text-center px-4 py-3 w-44">
                        Stock On Hand
                        <span className="block text-[10px] font-normal normal-case text-gray-500 mt-0.5">
                          (Count entry / SOH)
                        </span>
                      </th>
                      <th className="text-center px-4 py-3 w-36">
                        Total Sold So Far
                        <span className="block text-[10px] font-normal normal-case text-gray-500 mt-0.5">
                          (Sales count)
                        </span>
                      </th>
                      <th className="text-right px-4 py-3 w-44">
                        {draftGenerated ? 'Suggested Qty' : 'Order Qty'}
                        <span className="block text-[10px] font-normal normal-case text-gray-500 mt-0.5">
                          {draftGenerated ? 'Calculated draft' : 'Populated after draft'}
                        </span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {departmentGroups.map((group, groupIndex) => {
                      const colorIdx = departmentColorIndex(group.code, group.name);
                      const rowBg = DEPT_ROW_COLORS[colorIdx];
                      const headerBg = DEPT_HEADER_COLORS[colorIdx];

                      return (
                        <React.Fragment key={`oe-desk-grp-${group.code}-${group.name}-${groupIndex}`}>
                          <tr>
                            <td colSpan={4} className={`px-4 py-2 border-y ${headerBg} font-bold text-xs`}>
                              {group.name}
                              <span className="ml-2 font-normal opacity-75">
                                ({group.items.length} item{group.items.length === 1 ? '' : 's'})
                              </span>
                            </td>
                          </tr>

                          {group.items.map((item, index) => {
                            const soldSoFar = item.dbStock < 0 ? Math.abs(item.dbStock) : (item.coverageAvg ? Math.round(item.coverageAvg) : 0);
                            const activeDays = coverageDays.length ? coverageDays : previewCoverage;
                            const windowDaysLabel = activeDays.length ? activeDays.map((d) => (d ? String(d).slice(0, 3) : '')).join('/') : 'Delivery Window';

                            return (
                              <tr key={`oe-desk-${item.productId}-${index}`} className={`${rowBg} border-b border-white/80 hover:bg-white/80 transition-colors`}>
                                {/* Product Info & Sales Details */}
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2.5">
                                    {/* Star Button to easily unstar regular product */}
                                    <button
                                      type="button"
                                      onClick={() => void handleUnstarProduct(item.productId)}
                                      title="Starred regular item (click to remove star)"
                                      className="p-1 rounded-md text-amber-500 hover:text-gray-400 hover:bg-amber-50 transition-colors shrink-0 group"
                                    >
                                      <Star className="w-4 h-4 fill-amber-400 text-amber-500 group-hover:scale-110 transition-transform" />
                                    </button>

                                    {/* Thumbnail Image */}
                                    <div className="shrink-0 w-12 h-12 rounded-lg bg-white border border-gray-200 overflow-hidden shadow-xs flex items-center justify-center">
                                      {item.photoUrl && !brokenImages[item.productId] ? (
                                        <img
                                          src={item.photoUrl}
                                          alt={item.description}
                                          className="w-full h-full object-cover"
                                          onError={() => setBrokenImages((prev) => ({ ...prev, [item.productId]: true }))}
                                        />
                                      ) : (
                                        <Package className="w-5 h-5 text-gray-400" />
                                      )}
                                    </div>

                                    <div>
                                      <div className="font-semibold text-gray-900 leading-snug flex items-center flex-wrap gap-1.5">
                                        <span>{item.description}</span>
                                        {item.minPackQty && item.minPackQty > 1 && (
                                          <span className="font-bold text-indigo-900 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded text-[10px]" title="Minimum supplier order multiple">
                                            📦 Pack of {item.minPackQty}
                                          </span>
                                        )}
                                        {item.shelfLifeDays && item.shelfLifeDays < 30 && (
                                          <span className="font-medium text-slate-700 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded text-[10px]" title="Product shelf life in days">
                                            ⏳ Shelf Life: {item.shelfLifeDays}d
                                          </span>
                                        )}
                                      </div>
                                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                                        <span className="font-bold text-amber-900 bg-amber-100/90 px-2 py-0.5 rounded text-[11px] font-mono">
                                          Total Sold So Far: {soldSoFar}
                                        </span>
                                        <span className="font-medium text-blue-900 bg-blue-100/80 px-2 py-0.5 rounded text-[11px] font-mono">
                                          Sold last window ({windowDaysLabel}): {Math.round(item.coverageAvg || 0)} units
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </td>

                                {/* Stock On Hand Input (No Negative Numbers allowed) */}
                                <td className="px-4 py-3 text-center">
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    disabled={isCutoffLocked}
                                    value={item.manualStock}
                                    onFocus={handleDesktopFocusSelect}
                                    onChange={(e) => handleManualStockChange(item.productId, e.target.value)}
                                    className="w-24 px-2.5 py-1.5 border border-gray-300 rounded-lg text-center font-bold text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white shadow-2xs text-sm placeholder:font-normal placeholder:text-gray-400 disabled:bg-gray-100 disabled:text-gray-400"
                                    placeholder="Count…"
                                  />
                                </td>

                                {/* Total Sold So Far Column */}
                                <td className="px-4 py-3 text-center font-mono">
                                  <span className="inline-block px-2.5 py-1 rounded-md bg-amber-100/80 text-amber-900 font-extrabold text-xs">
                                    {soldSoFar} units
                                  </span>
                                </td>

                                {/* Suggested / Order Qty Column */}
                                <td className="px-4 py-3 text-right">
                                  {draftGenerated ? (
                                    <div className="inline-flex flex-col items-end gap-1">
                                      <div className="flex items-center gap-1">
                                        <button
                                          type="button"
                                          disabled={isCutoffLocked}
                                          onClick={() => handleOrderQtyStep(item.productId, -1)}
                                          className="w-7 h-8 border border-gray-300 rounded-l-lg bg-gray-50 hover:bg-gray-100 text-gray-700 font-bold text-sm flex items-center justify-center transition-colors disabled:opacity-50"
                                          title={`Subtract ${item.minPackQty || 1}`}
                                        >
                                          -
                                        </button>
                                        <input
                                          type="text"
                                          inputMode="numeric"
                                          pattern="[0-9]*"
                                          disabled={isCutoffLocked}
                                          value={item.orderQty !== undefined && item.orderQty !== null ? item.orderQty : ''}
                                          placeholder="0"
                                          onFocus={handleDesktopFocusSelect}
                                          onChange={(e) => handleOrderQtyChange(item.productId, e.target.value)}
                                          onBlur={() => handleOrderQtyBlur(item.productId)}
                                          className="w-20 px-2 py-1 border-y-2 border-emerald-500 text-right font-extrabold text-emerald-900 focus:ring-2 focus:ring-emerald-500 outline-none bg-emerald-50/60 text-sm disabled:bg-gray-100 disabled:border-gray-300 disabled:text-gray-400 placeholder:text-gray-400"
                                        />
                                        <button
                                          type="button"
                                          disabled={isCutoffLocked}
                                          onClick={() => handleOrderQtyStep(item.productId, 1)}
                                          className="w-7 h-8 border border-gray-300 rounded-r-lg bg-gray-50 hover:bg-gray-100 text-gray-700 font-bold text-sm flex items-center justify-center transition-colors disabled:opacity-50"
                                          title={`Add ${item.minPackQty || 1}`}
                                        >
                                          +
                                        </button>
                                      </div>
                                      {item.reason && (
                                        <span className="text-[10px] font-semibold text-slate-600 bg-slate-100/90 px-2 py-0.5 rounded border border-slate-200 text-right max-w-[14rem] leading-tight">
                                          {item.reason}
                                        </span>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-gray-400 italic text-xs font-mono pr-4">
                                      — (click Generate below)
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* MOBILE RESPONSIVE CARD VIEW (block md:hidden) - NO HORIZONTAL SCROLLING */}
              <div className="block md:hidden p-3 space-y-4 bg-slate-50/60">
                {departmentGroups.map((group, groupIndex) => {
                  const colorIdx = departmentColorIndex(group.code, group.name);
                  const headerBg = DEPT_HEADER_COLORS[colorIdx];

                  return (
                    <div key={`oe-mob-grp-${group.code}-${group.name}-${groupIndex}`} className="space-y-2.5">
                      {/* Department Header */}
                      <div className={`px-3 py-2 rounded-lg ${headerBg} font-bold text-xs flex items-center justify-between shadow-2xs border border-gray-200/60`}>
                        <span>{group.name}</span>
                        <span className="opacity-80 font-semibold text-[11px]">
                          {group.items.length} item{group.items.length === 1 ? '' : 's'}
                        </span>
                      </div>

                      {/* Items */}
                      <div className="space-y-3">
                        {group.items.map((item, index) => {
                          const soldSoFar = item.dbStock < 0 ? Math.abs(item.dbStock) : (item.coverageAvg ? Math.round(item.coverageAvg) : 0);
                          const activeDays = coverageDays.length ? coverageDays : previewCoverage;
                          const windowDaysLabel = activeDays.length ? activeDays.map((d) => (d ? String(d).slice(0, 3) : '')).join('/') : 'Delivery Window';

                          return (
                            <div
                              key={`oe-mob-${item.productId}-${index}`}
                              className="bg-white rounded-xl border border-gray-200 shadow-xs p-3.5 space-y-3 hover:shadow-md transition-shadow"
                            >
                              {/* Top Product Header */}
                              <div className="flex items-start gap-2.5">
                                {/* Star unstar button */}
                                <button
                                  type="button"
                                  onClick={() => void handleUnstarProduct(item.productId)}
                                  title="Starred regular item (click to remove star)"
                                  className="p-1 rounded-md text-amber-500 hover:text-gray-400 hover:bg-amber-50 transition-colors shrink-0 mt-1"
                                >
                                  <Star className="w-4 h-4 fill-amber-400 text-amber-500" />
                                </button>

                                <div className="shrink-0 w-12 h-12 rounded-lg bg-slate-100 border border-gray-200 overflow-hidden flex items-center justify-center">
                                  {item.photoUrl && !brokenImages[item.productId] ? (
                                    <img
                                      src={item.photoUrl}
                                      alt={item.description}
                                      className="w-full h-full object-cover"
                                      onError={() => setBrokenImages((prev) => ({ ...prev, [item.productId]: true }))}
                                    />
                                  ) : (
                                    <Package className="w-5 h-5 text-gray-400" />
                                  )}
                                </div>

                                <div className="space-y-1 flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-1 flex-wrap">
                                    <span className="text-[10px] font-extrabold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded font-mono">
                                      #{item.stockCode}
                                    </span>
                                    {item.minPackQty && item.minPackQty > 1 && (
                                      <span className="font-bold text-indigo-900 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded text-[10px]">
                                        📦 Pack {item.minPackQty}
                                      </span>
                                    )}
                                    {item.shelfLifeDays && item.shelfLifeDays < 30 && (
                                      <span className="font-medium text-slate-700 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded text-[10px]">
                                        ⏳ {item.shelfLifeDays}d
                                      </span>
                                    )}
                                  </div>
                                  <h5 className="font-bold text-gray-900 text-sm leading-snug">
                                    {item.description}
                                  </h5>
                                </div>
                              </div>

                              {/* Sales Stats Badges */}
                              <div className="space-y-1 text-xs">
                                <div className="text-[11px] text-amber-900 font-semibold bg-amber-50 px-2 py-0.5 rounded border border-amber-200 inline-block font-mono mr-1">
                                  Total Sold So Far: {soldSoFar}
                                </div>
                                <div className="text-[11px] text-blue-900 font-medium bg-blue-50 px-2 py-0.5 rounded border border-blue-200 block font-mono">
                                  Sold last window ({windowDaysLabel}): {Math.round(item.coverageAvg || 0)} units
                                </div>
                              </div>

                              {/* Inputs: Stock On Hand & Suggested Qty */}
                              <div className="pt-2 border-t border-gray-100 grid grid-cols-2 gap-2 text-xs">
                                <div className="space-y-1">
                                  <label className="text-[10px] font-bold text-gray-700 block">Stock On Hand</label>
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    disabled={isCutoffLocked}
                                    value={item.manualStock}
                                    onChange={(e) => handleManualStockChange(item.productId, e.target.value)}
                                    className="w-full h-9 px-2 border border-gray-300 rounded-lg text-center font-bold text-gray-900 outline-none focus:ring-2 focus:ring-blue-500 bg-white text-xs disabled:bg-gray-100"
                                    placeholder="Count…"
                                  />
                                </div>

                                <div className="space-y-1 text-right">
                                  <label className="text-[10px] font-bold text-gray-700 block">Suggested Qty</label>
                                  {draftGenerated ? (
                                    <div className="space-y-1">
                                      <div className="flex items-center justify-end gap-0.5">
                                        <button
                                          type="button"
                                          disabled={isCutoffLocked}
                                          onClick={() => handleOrderQtyStep(item.productId, -1)}
                                          className="w-7 h-9 border border-gray-300 rounded-l-lg bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-sm flex items-center justify-center transition-colors disabled:opacity-50 active:scale-95"
                                        >
                                          -
                                        </button>
                                        <input
                                          type="text"
                                          inputMode="numeric"
                                          pattern="[0-9]*"
                                          disabled={isCutoffLocked}
                                          value={item.orderQty !== undefined && item.orderQty !== null ? item.orderQty : ''}
                                          placeholder="0"
                                          onChange={(e) => handleOrderQtyChange(item.productId, e.target.value)}
                                          onBlur={() => handleOrderQtyBlur(item.productId)}
                                          className="w-14 h-9 px-1 border-y-2 border-emerald-500 text-center font-extrabold text-emerald-900 bg-emerald-50 text-xs disabled:bg-gray-100"
                                        />
                                        <button
                                          type="button"
                                          disabled={isCutoffLocked}
                                          onClick={() => handleOrderQtyStep(item.productId, 1)}
                                          className="w-7 h-9 border border-gray-300 rounded-r-lg bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-sm flex items-center justify-center transition-colors disabled:opacity-50 active:scale-95"
                                        >
                                          +
                                        </button>
                                      </div>
                                      {item.reason && (
                                        <p className="text-[9px] font-semibold text-slate-600 bg-slate-100/90 px-1.5 py-0.5 rounded border border-slate-200 text-right leading-tight">
                                          {item.reason}
                                        </p>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="h-9 px-2 flex items-center justify-center border border-dashed border-gray-300 rounded-lg text-gray-400 italic text-[10px]">
                                      — (Generate)
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* ================================================================== */
            /* THUMBNAIL / GRID VIEW                                             */
            /* ================================================================== */
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 bg-slate-50/50">
              {filteredStarredItems.map((item) => {
                const soldSoFar = item.dbStock < 0 ? Math.abs(item.dbStock) : (item.coverageAvg ? Math.round(item.coverageAvg) : 0);
                const activeDays = coverageDays.length ? coverageDays : previewCoverage;
                const windowDaysLabel = activeDays.length ? activeDays.map((d) => (d ? String(d).slice(0, 3) : '')).join('/') : 'Delivery Window';

                return (
                  <div
                    key={item.productId}
                    className="bg-white rounded-xl border border-gray-200 shadow-xs p-3.5 space-y-3 flex flex-col justify-between hover:shadow-md transition-shadow relative group"
                  >
                    {/* Star unstar button */}
                    <button
                      type="button"
                      onClick={() => void handleUnstarProduct(item.productId)}
                      title="Starred regular item (click to remove star)"
                      className="absolute top-2 right-2 z-10 p-1.5 rounded-full bg-white/95 shadow-sm border border-gray-200 text-amber-500 hover:text-gray-400 hover:bg-white transition-colors"
                    >
                      <Star className="w-4 h-4 fill-amber-400 text-amber-500" />
                    </button>

                    {/* Top Image Container */}
                    <div className="w-full h-36 rounded-lg bg-slate-100 border border-gray-200 overflow-hidden flex items-center justify-center">
                      {item.photoUrl && !brokenImages[item.productId] ? (
                        <img
                          src={item.photoUrl}
                          alt={item.description}
                          className="w-full h-full object-cover"
                          onError={() => setBrokenImages((prev) => ({ ...prev, [item.productId]: true }))}
                        />
                      ) : (
                        <div className="text-center p-3 text-gray-400 space-y-1">
                          <Package className="w-8 h-8 mx-auto" />
                          <span className="text-[10px] font-medium block">No Picture</span>
                        </div>
                      )}
                    </div>

                    {/* Product Metadata */}
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center justify-between gap-1 flex-wrap">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-semibold">
                          {item.departmentName}
                        </span>
                        {item.minPackQty && item.minPackQty > 1 && (
                          <span className="font-bold text-indigo-900 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded text-[10px]">
                            📦 Pack {item.minPackQty}
                          </span>
                        )}
                        <span className="text-[10px] font-extrabold text-slate-900 bg-slate-200/80 px-1.5 py-0.5 rounded font-mono">
                          #{item.stockCode}
                        </span>
                      </div>
                      <h5 className="font-bold text-gray-900 text-sm leading-snug line-clamp-2">
                        {item.description}
                      </h5>
                      <div className="space-y-1 pt-1">
                        <div className="text-[11px] text-amber-900 font-semibold bg-amber-50 px-2 py-0.5 rounded border border-amber-200 inline-block font-mono">
                          Total Sold So Far: {soldSoFar}
                        </div>
                        <div className="text-[11px] text-blue-900 font-medium bg-blue-50 px-2 py-0.5 rounded border border-blue-200 block font-mono">
                          Sold last window ({windowDaysLabel}): {Math.round(item.coverageAvg || 0)} units
                        </div>
                      </div>
                    </div>

                    {/* Inputs Row: Stock On Hand & Order Qty */}
                    <div className="pt-2 border-t border-gray-100 grid grid-cols-2 gap-2 text-xs">
                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-gray-600 block">Stock On Hand</label>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          disabled={isCutoffLocked}
                          value={item.manualStock}
                          onChange={(e) => handleManualStockChange(item.productId, e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-center font-bold text-gray-900 outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:bg-gray-100"
                          placeholder="Count…"
                        />
                      </div>

                      <div className="space-y-1 text-right">
                        <label className="text-[10px] font-semibold text-gray-600 block">Suggested Qty</label>
                        {draftGenerated ? (
                          <div className="space-y-1">
                            <div className="flex items-center justify-end gap-0.5">
                              <button
                                type="button"
                                disabled={isCutoffLocked}
                                onClick={() => handleOrderQtyStep(item.productId, -1)}
                                className="w-6 h-8 border border-gray-300 rounded-l-md bg-gray-50 hover:bg-gray-100 text-gray-700 font-bold text-xs flex items-center justify-center transition-colors disabled:opacity-50"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min="0"
                                step={item.minPackQty || 1}
                                disabled={isCutoffLocked}
                                value={item.orderQty ?? 0}
                                onChange={(e) => handleOrderQtyChange(item.productId, e.target.value)}
                                className="w-14 px-1 py-1.5 border-y-2 border-emerald-500 text-center font-extrabold text-emerald-900 outline-none focus:ring-2 focus:ring-emerald-500 bg-emerald-50/70 text-xs disabled:bg-gray-100"
                              />
                              <button
                                type="button"
                                disabled={isCutoffLocked}
                                onClick={() => handleOrderQtyStep(item.productId, 1)}
                                className="w-6 h-8 border border-gray-300 rounded-r-md bg-gray-50 hover:bg-gray-100 text-gray-700 font-bold text-xs flex items-center justify-center transition-colors disabled:opacity-50"
                              >
                                +
                              </button>
                            </div>
                            {item.reason && (
                              <p className="text-[9px] font-semibold text-slate-600 bg-slate-100/90 px-1.5 py-0.5 rounded border border-slate-200 text-right leading-tight">
                                {item.reason}
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="px-2 py-1.5 border border-dashed border-gray-300 rounded-md text-center text-gray-400 italic text-[11px]">
                            —
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ================================================================== */}
          {/* GENERATE, CLOSE & SAVE DRAFT ORDER ACTION BUTTONS                   */}
          {/* ================================================================== */}
          <div className="p-6 bg-slate-50 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-gray-600 space-y-0.5 text-center sm:text-left">
              <p className="font-semibold text-gray-900 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-blue-600" />
                Sales &amp; Replenishment Draft Generator
              </p>
              <p>
                Calculates suggested order quantities for all {starredItems.length} starred items based on sales history &amp; manual current stock entries.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto shrink-0">
              {/* Save Draft Button */}
              <button
                type="button"
                onClick={() => void handleSaveDraft()}
                disabled={savingDraft || starredItems.length === 0}
                className="flex-1 sm:flex-initial px-4 py-3 bg-slate-800 hover:bg-slate-900 text-white font-bold text-sm rounded-xl transition-all shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
                title="Save this draft order to re-open or edit later"
              >
                {savingDraft ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <BookmarkPlus className="w-4 h-4 text-emerald-400" />
                )}
                <span>Save Draft</span>
              </button>

              {/* Generate Draft Order Button (Tries AI, falls back to Standard) */}
              <button
                type="button"
                onClick={() => void generateDraftOrder(true)}
                disabled={generatingDraft || starredItems.length === 0 || isCutoffLocked}
                className="flex-1 sm:flex-initial px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl transition-all shadow-md hover:shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {generatingDraft ? (
                  <RefreshCw className="w-5 h-5 animate-spin text-white" />
                ) : (
                  <BrainCircuit className="w-5 h-5 text-white" />
                )}
                <span>{generatingDraft ? 'Calculating Draft…' : 'Generate Draft Order'}</span>
              </button>

              {/* Close Button next to Generate Draft Order */}
              <button
                type="button"
                onClick={() => void handleCloseDraftAndMoveToHistory()}
                className="flex-1 sm:flex-initial px-4 py-3 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-sm rounded-xl transition-all shadow-xs flex items-center justify-center gap-2"
                title="Close draft order and view in Draft History below"
              >
                <XCircle className="w-4 h-4 text-slate-600" />
                <span>Close</span>
              </button>
            </div>
          </div>

          {/* Draft Summary Footer & Export Controls */}
          {draftGenerated && activeOrderLines.length > 0 && (
            <div className="p-5 bg-emerald-50/80 border-t border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in">
              <div className="flex items-center gap-2 text-sm text-emerald-900 font-medium">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>
                  Draft Order Ready: <strong>{activeOrderLines.length} lines</strong> · <strong>{totalUnits} total units</strong>
                  {totalCost > 0 && <> · Est. <strong>${totalCost.toFixed(2)}</strong></>}
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={exportCsv}
                  className="px-3.5 py-2 text-xs font-semibold bg-white border border-emerald-300 text-emerald-900 rounded-lg hover:bg-emerald-100/50 transition-colors flex items-center gap-1.5 shadow-2xs"
                >
                  <Download className="w-4 h-4" /> Export CSV / Excel
                </button>
                <button
                  type="button"
                  onClick={printOrder}
                  className="px-3.5 py-2 text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg transition-colors flex items-center gap-1.5 shadow-2xs"
                >
                  <Printer className="w-4 h-4" /> Print / PDF
                </button>
              </div>
            </div>
          )}

          {draftGenerated && activeOrderLines.length === 0 && (
            <div className="p-4 bg-sky-50 border-t border-sky-200 flex items-center justify-between gap-3 animate-fade-in">
              <div className="flex items-center gap-2 text-sm text-sky-900 font-medium">
                <CheckCircle2 className="w-5 h-5 text-sky-600 shrink-0" />
                <span>
                  Draft Calculated: All items are currently sufficiently stocked for the upcoming delivery window. No reorders needed at this time. You can manually adjust quantities with +/- if desired.
                </span>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* No Supplier Selected Placeholder */
        <div className="bg-white p-12 rounded-xl border border-dashed border-gray-300 text-center space-y-3">
          <Truck className="w-12 h-12 text-gray-300 mx-auto" />
          <h4 className="text-lg font-semibold text-gray-800">Select a supplier to start draft ordering</h4>
          <p className="text-xs text-gray-500 max-w-sm mx-auto">
            Choose a supplier from the dropdown above. Their starred products will automatically display here for quick ordering.
          </p>
        </div>
      )}

      {/* ================================================================== */}
      {/* PERMANENT DRAFT ORDERS HISTORY SECTION AT BOTTOM                   */}
      {/* ================================================================== */}
      <div id="draft-history-section" className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4 mt-6">
        <div className="flex items-center justify-between pb-3 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-gray-900 text-base">Draft Orders History</h3>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
              {savedDrafts.length} saved
            </span>
          </div>
          <p className="text-xs text-gray-500">
            Select supplier above to open draft, or delete old drafts to manage database storage size.
          </p>
        </div>

        {savedDrafts.length === 0 ? (
          <div className="text-center py-8 text-gray-400 space-y-2">
            <FileText className="w-8 h-8 mx-auto text-gray-300" />
            <p className="text-xs font-medium text-gray-500">No saved draft orders in history</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {savedDrafts.map((draft) => {
              const deliveryDateText = (() => {
                if (draft.scheduleLabel && draft.scheduleLabel.includes('Delivery:')) {
                  return draft.scheduleLabel;
                }
                const cfg = findConfigForSupplier(draft.supplierId, configs, suppliers);
                const sched = cfg?.schedules?.[draft.scheduleIndex || 0] || cfg?.schedules?.[0];
                if (sched?.deliveryDay) {
                  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
                  const targetIdx = days.indexOf(sched.deliveryDay.toLowerCase());
                  if (targetIdx !== -1) {
                    const savedDate = new Date(draft.savedAt);
                    const baseDate = isNaN(savedDate.getTime()) ? new Date() : savedDate;
                    let diff = targetIdx - baseDate.getDay();
                    if (diff <= 0) diff += 7;
                    const delivDate = new Date(baseDate);
                    delivDate.setDate(baseDate.getDate() + diff);
                    const dateStr = delivDate.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });
                    return `${dateStr} (${sched.deliveryDay})`;
                  }
                }
                return draft.scheduleLabel || 'Schedule set';
              })();

              const { totalLines, totalUnits, totalCost } = (() => {
                if (Array.isArray(draft.items) && draft.items.length > 0) {
                  const activeItems = draft.items.filter((i: any) => {
                    const q = i.orderQty !== null && i.orderQty !== undefined ? Number(i.orderQty) : Number(i.recommendedQty || 0);
                    return q > 0;
                  });
                  const lines = activeItems.length > 0 ? activeItems.length : draft.items.length;
                  const units = draft.items.reduce((sum: number, i: any) => {
                    const q = i.orderQty !== null && i.orderQty !== undefined ? Number(i.orderQty) : Number(i.recommendedQty || 0);
                    return sum + (q > 0 ? q : 0);
                  }, 0);
                  const cost = draft.items.reduce((sum: number, i: any) => {
                    const q = i.orderQty !== null && i.orderQty !== undefined ? Number(i.orderQty) : Number(i.recommendedQty || 0);
                    const c = Number(i.cost) || 0;
                    return sum + (q > 0 ? q * c : 0);
                  }, 0);
                  return {
                    totalLines: lines,
                    totalUnits: units,
                    totalCost: cost > 0 ? cost : (draft.totalCost || 0),
                  };
                }
                return {
                  totalLines: draft.totalLines || 0,
                  totalUnits: draft.totalUnits || 0,
                  totalCost: draft.totalCost || 0,
                };
              })();

              return (
                <div
                  key={draft.id}
                  className="p-4 bg-slate-50 hover:bg-blue-50/60 border border-slate-200 rounded-xl transition-all flex items-center justify-between gap-4 group"
                >
                  <div className="space-y-1.5 min-w-0">
                    {/* Supplier Name */}
                    <div className="font-extrabold text-slate-900 text-base truncate leading-snug">
                      {draft.supplierName}
                    </div>

                    {/* Delivery Date */}
                    <div className="text-xs text-blue-900 font-semibold bg-blue-100/80 px-2 py-0.5 rounded-md inline-flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <span>Delivery Date: {deliveryDateText}</span>
                    </div>

                    {/* Lines & Units */}
                    <div className="text-xs text-slate-700 font-medium">
                      <strong>{totalLines} lines</strong> · <strong>{totalUnits} units</strong>
                      {totalCost > 0 && <> · Est. <strong>${totalCost.toFixed(2)}</strong></>}
                    </div>
                  </div>

                  {/* Open Draft & Delete buttons */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleLoadDraft(draft)}
                      className="px-3.5 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors shadow-2xs flex items-center gap-1.5"
                    >
                      <span>Open Draft</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => void handleDeleteDraft(draft.id, e)}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-100/80 rounded-lg transition-colors"
                      title="Delete draft from history"
                    >
                      <Trash2 className="w-4.5 h-4.5 text-rose-600" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ================================================================== */}
      {/* SAVED DRAFT ORDERS HISTORY DRAWER / MODAL                          */}
      {/* ================================================================== */}
      {showDraftHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/50 backdrop-blur-xs"
            onClick={() => setShowDraftHistory(false)}
          />
          <div className="relative w-full max-w-2xl max-h-[85vh] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden animate-fade-in">
            <div className="px-6 py-4 border-b border-gray-200 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-base">Saved Draft Orders History</h3>
              </div>
              <button
                onClick={() => setShowDraftHistory(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 max-h-[65vh]">
              {savedDrafts.length === 0 ? (
                <div className="text-center py-10 text-slate-400 space-y-2">
                  <FileText className="w-10 h-10 mx-auto text-slate-300" />
                  <p className="text-sm font-semibold text-slate-700">No saved draft orders yet</p>
                  <p className="text-xs text-slate-400">
                    Click <strong>Save Draft</strong> in the Order Engine to store draft orders for later editing.
                  </p>
                </div>
              ) : (
                savedDrafts.map((draft) => {
                  const deliveryDateText = (() => {
                    if (draft.scheduleLabel && draft.scheduleLabel.includes('Delivery:')) {
                      return draft.scheduleLabel;
                    }
                    const cfg = findConfigForSupplier(draft.supplierId, configs, suppliers);
                    const sched = cfg?.schedules?.[draft.scheduleIndex || 0] || cfg?.schedules?.[0];
                    if (sched?.deliveryDay) {
                      const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
                      const targetIdx = days.indexOf(sched.deliveryDay.toLowerCase());
                      if (targetIdx !== -1) {
                        const savedDate = new Date(draft.savedAt);
                        const baseDate = isNaN(savedDate.getTime()) ? new Date() : savedDate;
                        let diff = targetIdx - baseDate.getDay();
                        if (diff <= 0) diff += 7;
                        const delivDate = new Date(baseDate);
                        delivDate.setDate(baseDate.getDate() + diff);
                        const dateStr = delivDate.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });
                        return `${dateStr} (${sched.deliveryDay})`;
                      }
                    }
                    return draft.scheduleLabel || 'Schedule set';
                  })();

                  const { totalLines, totalUnits, totalCost } = (() => {
                    if (Array.isArray(draft.items) && draft.items.length > 0) {
                      const activeItems = draft.items.filter((i: any) => {
                        const q = i.orderQty !== null && i.orderQty !== undefined ? Number(i.orderQty) : Number(i.recommendedQty || 0);
                        return q > 0;
                      });
                      const lines = activeItems.length > 0 ? activeItems.length : draft.items.length;
                      const units = draft.items.reduce((sum: number, i: any) => {
                        const q = i.orderQty !== null && i.orderQty !== undefined ? Number(i.orderQty) : Number(i.recommendedQty || 0);
                        return sum + (q > 0 ? q : 0);
                      }, 0);
                      const cost = draft.items.reduce((sum: number, i: any) => {
                        const q = i.orderQty !== null && i.orderQty !== undefined ? Number(i.orderQty) : Number(i.recommendedQty || 0);
                        const c = Number(i.cost) || 0;
                        return sum + (q > 0 ? q * c : 0);
                      }, 0);
                      return {
                        totalLines: lines,
                        totalUnits: units,
                        totalCost: cost > 0 ? cost : (draft.totalCost || 0),
                      };
                    }
                    return {
                      totalLines: draft.totalLines || 0,
                      totalUnits: draft.totalUnits || 0,
                      totalCost: draft.totalCost || 0,
                    };
                  })();

                  return (
                    <div
                      key={draft.id}
                      onClick={() => handleLoadDraft(draft)}
                      className="p-4 bg-slate-50 hover:bg-blue-50/60 border border-slate-200 rounded-xl transition-all cursor-pointer flex items-center justify-between gap-4 group shadow-xs"
                    >
                      <div className="space-y-1.5 min-w-0">
                        <div className="font-extrabold text-slate-900 text-base truncate leading-snug">
                          {draft.supplierName}
                        </div>
                        <div className="text-xs text-blue-900 font-semibold bg-blue-100/80 px-2 py-0.5 rounded-md inline-flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span>Delivery Date: {deliveryDateText}</span>
                        </div>
                        <div className="text-xs text-slate-700 font-medium">
                          <strong>{totalLines} lines</strong> · <strong>{totalUnits} units</strong>
                          {totalCost > 0 && <> · Est. <strong>${totalCost.toFixed(2)}</strong></>}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleLoadDraft(draft)}
                          className="px-3.5 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors shadow-2xs"
                        >
                          Open Draft
                        </button>
                        <button
                          type="button"
                          onClick={(e) => void handleDeleteDraft(draft.id, e)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-100/80 rounded-lg transition-colors"
                          title="Delete saved draft"
                        >
                          <Trash2 className="w-4.5 h-4.5 text-rose-600" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* PRODUCTS & STARS MANAGEMENT MODAL                                  */}
      {/* ================================================================== */}
      {showProductsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/50 backdrop-blur-xs"
            aria-label="Close products popup"
            disabled={savingStars}
            onClick={() => void closeProductsModal()}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="products-stars-title"
            className="relative w-full max-w-3xl max-h-[88vh] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden animate-fade-in"
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-start justify-between gap-3 bg-slate-50">
              <div>
                <h3 id="products-stars-title" className="font-bold text-gray-900 text-base flex items-center gap-2">
                  <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
                  Products &amp; Stars Management
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Star the products you order regularly from this supplier.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void closeProductsModal()}
                disabled={savingStars}
                className="p-1.5 text-gray-400 hover:bg-gray-200 hover:text-gray-700 rounded-lg disabled:opacity-50 transition-colors"
                title="Close & save"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Search & Filters */}
            <div className="p-4 bg-slate-50/80 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  value={modalSearch}
                  onChange={(e) => setModalSearch(e.target.value)}
                  placeholder="Search code, description, or * (e.g. bega*milk, *2L, 931*)…"
                  className="w-full pl-8 pr-3 py-1.5 bg-white border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {/* Catalog Scope Switcher */}
                <div className="flex items-center bg-gray-200/80 p-0.5 rounded-lg border border-gray-300 text-[11px]">
                  <button
                    type="button"
                    onClick={() => void handleToggleCatalogScope(false)}
                    className={`px-2.5 py-1 rounded-md font-bold transition-all ${
                      !modalSearchEntireCatalog
                        ? 'bg-white text-blue-700 shadow-xs'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                    title="Show products linked to this supplier"
                  >
                    Supplier Items
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleToggleCatalogScope(true)}
                    className={`px-2.5 py-1 rounded-md font-bold transition-all ${
                      modalSearchEntireCatalog
                        ? 'bg-white text-blue-700 shadow-xs'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                    title="Search and star any product from the entire POS inventory"
                  >
                    All POS Items
                  </button>
                </div>

                <label className="flex items-center gap-1.5 font-semibold text-gray-700 cursor-pointer select-none text-xs">
                  <input
                    type="checkbox"
                    checked={modalStarredOnly}
                    onChange={(e) => setModalStarredOnly(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span>Starred Only</span>
                </label>

                {/* Modal View Mode Toggle */}
                <div className="flex items-center bg-gray-200/80 p-0.5 rounded-lg border border-gray-300">
                  <button
                    type="button"
                    onClick={() => setModalViewMode('table')}
                    className={`px-2 py-1 rounded-md text-xs font-bold flex items-center gap-1 transition-all ${
                      modalViewMode === 'table' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                    }`}
                    title="Table View"
                  >
                    <LayoutList className="w-3.5 h-3.5" />
                    <span>Table</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalViewMode('thumbnail')}
                    className={`px-2 py-1 rounded-md text-xs font-bold flex items-center gap-1 transition-all ${
                      modalViewMode === 'thumbnail' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                    }`}
                    title="Thumbnail View"
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    <span>Thumbnail</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Product Content */}
            <div className="overflow-y-auto max-h-[55vh] p-3">
              {modalViewMode === 'table' ? (
                <div>
                  {/* Desktop Table View */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="min-w-full text-xs divide-y divide-gray-200">
                      <thead className="bg-slate-100 font-bold text-gray-700 uppercase sticky top-0 z-10">
                        <tr>
                          <th className="px-3 py-2 text-center w-12">Star</th>
                          <th className="px-3 py-2 text-center w-20">Photo</th>
                          <th className="px-3 py-2 text-left">Stock Code / Barcode</th>
                          <th className="px-3 py-2 text-left">Product Name / Description</th>
                          <th className="px-3 py-2 text-left">Department</th>
                          <th className="px-3 py-2 text-center w-28">Order Multiple (Pack)</th>
                          <th className="px-3 py-2 text-center w-24">Shelf Life</th>
                          <th className="px-3 py-2 text-right">Current Stock</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {filteredModalProducts.map((p, index) => {
                          const isStarred = p.starred;
                          const pId = Number(p.productId);
                          const stockCode = (p as any).stockCode || (p as any).Code || p.barcode || String(p.productId);

                          return (
                            <tr
                              key={`mod-tbl-${p.productId}-${index}`}
                              className={`transition-colors ${
                                isStarred ? 'bg-amber-50/50' : 'hover:bg-slate-50'
                              }`}
                            >
                              <td className="px-3 py-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => toggleModalStar(pId)}
                                  className="p-1.5 rounded hover:bg-amber-100 transition-colors"
                                  title={isStarred ? 'Unstar item' : 'Star item'}
                                >
                                  <Star
                                    className={`w-4 h-4 ${
                                      isStarred
                                        ? 'text-amber-500 fill-amber-500'
                                        : 'text-gray-300 hover:text-amber-400'
                                    }`}
                                  />
                                </button>
                              </td>

                              {/* Photo Column with Crop Upload & Remove */}
                              <td className="px-3 py-2 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <div className="w-10 h-10 rounded border border-gray-200 bg-slate-50 overflow-hidden shrink-0 flex items-center justify-center">
                                    {p.photoUrl && !brokenImages[pId] ? (
                                      <img
                                        src={p.photoUrl}
                                        alt=""
                                        className="w-full h-full object-cover"
                                        onError={() => setBrokenImages((prev) => ({ ...prev, [pId]: true }))}
                                      />
                                    ) : (
                                      <Package className="w-4 h-4 text-gray-300" />
                                    )}
                                  </div>
                                  <div className="flex flex-col gap-1">
                                    <label
                                      className="p-1 text-blue-600 hover:bg-blue-50 rounded cursor-pointer transition-colors"
                                      title="Upload / Crop photo"
                                    >
                                      <Camera className="w-3.5 h-3.5" />
                                      <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(e) => {
                                          const file = e.target.files?.[0];
                                          if (file) triggerPhotoCropModal(pId, p.description, file);
                                        }}
                                      />
                                    </label>
                                    {p.photoUrl && (
                                      <button
                                        type="button"
                                        onClick={() => void removePhoto(pId)}
                                        className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                                        title="Delete photo"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </td>

                              <td className="px-3 py-2 font-mono font-bold text-slate-800">
                                #{stockCode}
                              </td>

                              {/* Product Description with Rename Option */}
                              <td className="px-3 py-2 font-semibold text-gray-900">
                                <div className="flex items-center gap-2 group">
                                  <span>{p.description}</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setRenamingProduct({ productId: pId, currentName: p.description });
                                      setRenameInput(p.description);
                                    }}
                                    className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded opacity-70 group-hover:opacity-100 transition-all"
                                    title="Rename product in KwikOrder"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>

                              <td className="px-3 py-2 text-gray-500">{p.department || (p as any).departmentName}</td>

                              {/* Order Multiple / Min Pack Size */}
                              <td className="px-3 py-2 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    placeholder="1"
                                    value={p.minPackQty !== undefined && p.minPackQty !== null ? p.minPackQty : ''}
                                    onFocus={handleDesktopFocusSelect}
                                    onChange={(e) => handleModalPackQtyChange(p.productId, e.target.value)}
                                    onBlur={() => handleModalPackQtyBlur(p.productId)}
                                    className="w-16 px-2 py-1 border border-gray-300 rounded text-center font-bold text-gray-900 focus:ring-1 focus:ring-blue-500 bg-white placeholder:text-gray-400 placeholder:font-normal"
                                    title="Minimum pack or outer carton quantity supplied"
                                  />
                                  <span className="text-[10px] text-gray-500 font-medium">units</span>
                                </div>
                              </td>

                              {/* Shelf Life Days */}
                              <td className="px-3 py-2 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    placeholder="10"
                                    value={p.shelfLifeDays !== undefined && p.shelfLifeDays !== null ? p.shelfLifeDays : ''}
                                    onFocus={handleDesktopFocusSelect}
                                    onChange={(e) => handleModalShelfLifeChange(p.productId, e.target.value)}
                                    onBlur={() => handleModalShelfLifeBlur(p.productId)}
                                    className="w-14 px-2 py-1 border border-gray-300 rounded text-center font-bold text-gray-900 focus:ring-1 focus:ring-blue-500 bg-white placeholder:text-gray-400 placeholder:font-normal"
                                    title="Product shelf life in days"
                                  />
                                  <span className="text-[10px] text-gray-500 font-medium">days</span>
                                </div>
                              </td>

                              <td className="px-3 py-2 text-right font-mono font-bold text-gray-700">
                                {p.currentStock ?? 0}
                              </td>
                            </tr>
                          );
                        })}

                        {filteredModalProducts.length === 0 && (
                          <tr>
                            <td colSpan={8} className="px-4 py-10 text-center text-gray-500">
                              No products match your search or filter.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Responsive Cards View */}
                  <div className="block md:hidden space-y-3">
                    {filteredModalProducts.map((p, index) => {
                      const isStarred = p.starred;
                      const pId = Number(p.productId);
                      const stockCode = (p as any).stockCode || (p as any).Code || p.barcode || String(p.productId);

                      return (
                        <div
                          key={`mod-card-${p.productId}-${index}`}
                          className={`p-3 rounded-xl border transition-all space-y-2.5 ${
                            isStarred
                              ? 'bg-amber-50/60 border-amber-300 shadow-2xs'
                              : 'bg-white border-gray-200'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <button
                                type="button"
                                onClick={() => toggleModalStar(pId)}
                                className="p-1 rounded bg-white border border-gray-200 hover:bg-amber-50 shrink-0"
                              >
                                <Star
                                  className={`w-4 h-4 ${
                                    isStarred ? 'text-amber-500 fill-amber-500' : 'text-gray-300'
                                  }`}
                                />
                              </button>

                              <div className="w-9 h-9 rounded border border-gray-200 bg-slate-50 overflow-hidden shrink-0 flex items-center justify-center">
                                {p.photoUrl && !brokenImages[pId] ? (
                                  <img
                                    src={p.photoUrl}
                                    alt=""
                                    className="w-full h-full object-cover"
                                    onError={() => setBrokenImages((prev) => ({ ...prev, [pId]: true }))}
                                  />
                                ) : (
                                  <Package className="w-4 h-4 text-gray-300" />
                                )}
                              </div>

                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-mono text-[10px] font-extrabold text-slate-800 bg-slate-100 px-1 py-0.5 rounded">
                                    #{stockCode}
                                  </span>
                                  <span className="text-[10px] text-gray-500">
                                    {p.department || (p as any).departmentName}
                                  </span>
                                </div>
                                <h6 className="font-bold text-xs text-gray-900 leading-snug truncate">
                                  {p.description}
                                </h6>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                setRenamingProduct({ productId: pId, currentName: p.description });
                                setRenameInput(p.description);
                              }}
                              className="p-1 text-gray-400 hover:text-blue-600 rounded shrink-0"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100 text-[11px]">
                            <div>
                              <label className="text-gray-500 font-semibold block mb-0.5">Order Pack</label>
                              <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                placeholder="1"
                                value={p.minPackQty !== undefined && p.minPackQty !== null ? p.minPackQty : ''}
                                onChange={(e) => handleModalPackQtyChange(p.productId, e.target.value)}
                                onBlur={() => handleModalPackQtyBlur(p.productId)}
                                className="w-full px-2 py-1 border border-gray-300 rounded text-center font-bold text-gray-900 bg-white placeholder:text-gray-400 placeholder:font-normal"
                              />
                            </div>
                            <div>
                              <label className="text-gray-500 font-semibold block mb-0.5">Shelf Life (Days)</label>
                              <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                placeholder="10"
                                value={p.shelfLifeDays !== undefined && p.shelfLifeDays !== null ? p.shelfLifeDays : ''}
                                onChange={(e) => handleModalShelfLifeChange(p.productId, e.target.value)}
                                onBlur={() => handleModalShelfLifeBlur(p.productId)}
                                className="w-full px-2 py-1 border border-gray-300 rounded text-center font-bold text-gray-900 bg-white placeholder:text-gray-400 placeholder:font-normal"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {filteredModalProducts.length === 0 && (
                      <div className="text-center py-8 text-gray-400 text-xs">
                        No products match your search or filter.
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* Thumbnail Grid View for Products Modal */
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {filteredModalProducts.map((p, index) => {
                    const isStarred = p.starred;
                    const pId = Number(p.productId);
                    const stockCode = (p as any).stockCode || (p as any).Code || p.barcode || String(p.productId);

                    return (
                      <div
                        key={`mod-grid-${p.productId}-${index}`}
                        className={`p-3 rounded-xl border transition-all flex flex-col justify-between space-y-2 relative bg-white ${
                          isStarred ? 'border-amber-400 ring-2 ring-amber-400/20 shadow-xs' : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        {/* Image Preview Box */}
                        <div className="w-full aspect-square rounded-lg bg-slate-50 border border-gray-200 overflow-hidden relative flex items-center justify-center">
                          {p.photoUrl && !brokenImages[pId] ? (
                            <img
                              src={p.photoUrl}
                              alt=""
                              className="w-full h-full object-cover"
                              onError={() => setBrokenImages((prev) => ({ ...prev, [pId]: true }))}
                            />
                          ) : (
                            <div className="text-center p-2 text-gray-400">
                              <Package className="w-8 h-8 mx-auto mb-1" />
                              <span className="text-[10px] block font-medium">No Photo</span>
                            </div>
                          )}

                          {/* Star button on top corner */}
                          <button
                            type="button"
                            onClick={() => toggleModalStar(pId)}
                            className="absolute top-1.5 right-1.5 p-1.5 rounded-full bg-white/90 shadow-xs border border-gray-200 hover:bg-white transition-transform active:scale-95"
                          >
                            <Star
                              className={`w-4 h-4 ${
                                isStarred ? 'text-amber-500 fill-amber-500' : 'text-gray-300'
                              }`}
                            />
                          </button>
                        </div>

                        {/* Title and Rename */}
                        <div className="space-y-1">
                          <div className="flex items-start justify-between gap-1">
                            <span className="font-bold text-xs text-gray-900 leading-snug line-clamp-2">
                              {p.description}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setRenamingProduct({ productId: pId, currentName: p.description });
                                setRenameInput(p.description);
                              }}
                              className="p-1 text-gray-400 hover:text-blue-600 rounded shrink-0"
                              title="Rename product"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <p className="text-[10px] text-gray-500 font-mono">#{stockCode} · {p.department || (p as any).departmentName}</p>
                        </div>

                        {/* Pack Size & Shelf Life Controls */}
                        <div className="grid grid-cols-2 gap-1.5 pt-1.5 border-t border-gray-100 text-[10px]">
                          <div>
                            <label className="text-gray-500 font-semibold block mb-0.5">Order Pack</label>
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              placeholder="1"
                              value={p.minPackQty !== undefined && p.minPackQty !== null ? p.minPackQty : ''}
                              onFocus={handleDesktopFocusSelect}
                              onChange={(e) => handleModalPackQtyChange(p.productId, e.target.value)}
                              onBlur={() => handleModalPackQtyBlur(p.productId)}
                              className="w-full px-1.5 py-0.5 border border-gray-300 rounded text-center font-bold text-gray-900 bg-white placeholder:text-gray-400 placeholder:font-normal"
                              title="Minimum pack size supplied"
                            />
                          </div>
                          <div>
                            <label className="text-gray-500 font-semibold block mb-0.5">Shelf Life</label>
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              placeholder="10"
                              value={p.shelfLifeDays !== undefined && p.shelfLifeDays !== null ? p.shelfLifeDays : ''}
                              onFocus={handleDesktopFocusSelect}
                              onChange={(e) => handleModalShelfLifeChange(p.productId, e.target.value)}
                              onBlur={() => handleModalShelfLifeBlur(p.productId)}
                              className="w-full px-1.5 py-0.5 border border-gray-300 rounded text-center font-bold text-gray-900 bg-white placeholder:text-gray-400 placeholder:font-normal"
                              title="Product shelf life in days"
                            />
                          </div>
                        </div>

                        {/* Action Buttons: Crop Photo & Remove Photo */}
                        <div className="flex items-center justify-between pt-1 border-t border-gray-100">
                          <label
                            className="px-2 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            <Camera className="w-3 h-3" />
                            <span>{p.photoUrl ? 'Change' : 'Add Photo'}</span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) triggerPhotoCropModal(pId, p.description, file);
                              }}
                            />
                          </label>

                          {p.photoUrl && (
                            <button
                              type="button"
                              onClick={() => void removePhoto(pId)}
                              className="p-1 text-red-500 hover:bg-red-50 rounded transition-colors"
                              title="Delete photo"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-gray-200 flex items-center justify-between gap-3 bg-slate-50">
              <p className="text-xs text-gray-500">
                Starred count: <strong>{modalProducts.filter((p) => p.starred).length}</strong>
              </p>
              <button
                type="button"
                onClick={() => void closeProductsModal()}
                disabled={savingStars}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg disabled:opacity-50 transition-colors shadow-xs"
              >
                {savingStars ? 'Saving Stars…' : 'Save & Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Crop & Zoom Modal */}
      {cropTargetProduct && (
        <ImageCropModal
          file={cropTargetProduct.file}
          productName={cropTargetProduct.productName}
          onClose={() => setCropTargetProduct(null)}
          onSave={(croppedDataUrl) => void handleSaveCroppedPhoto(croppedDataUrl)}
        />
      )}

      {/* Product Rename Modal */}
      {renamingProduct && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-gray-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-blue-600" />
                <span>Rename Product</span>
              </h3>
              <button
                type="button"
                onClick={() => setRenamingProduct(null)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed">
              IdealPOS database is read-only. Changing the product name here saves a custom display alias in KwikOrder for easy identification.
            </p>

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-700">Display Name</label>
              <input
                type="text"
                value={renameInput}
                onChange={(e) => setRenameInput(e.target.value)}
                placeholder="Enter custom product name…"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-semibold text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setRenameInput('')}
                className="text-xs text-red-600 hover:underline font-semibold"
              >
                Reset to Original
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setRenamingProduct(null)}
                  className="px-3 py-1.5 text-xs text-gray-600 font-bold hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleSaveRename()}
                  disabled={savingRename}
                  className="px-4 py-1.5 text-xs bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {savingRename ? 'Saving…' : 'Save Name'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Modal for Quick Editing Supplier Delivery Schedule & Cut-Off */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full border border-slate-200 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">
                    Edit Delivery Schedule &amp; Cut-Off Times
                  </h3>
                  <p className="text-xs text-gray-500">
                    {suppliers.find((s) => String(s.id) === supplierId)?.name || 'Supplier'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowScheduleModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Schedule Rows */}
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-700">Delivery &amp; Cut-Off Windows</span>
                <button
                  type="button"
                  onClick={addScheduleEntry}
                  className="text-xs text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Option
                </button>
              </div>

              {editingSchedules.map((sch, idx) => {
                const currentSupName = suppliers.find((s) => String(s.id) === supplierId)?.name || 'Supplier';
                return (
                  <div
                    key={`sch-edit-${idx}`}
                    className="bg-slate-50 border border-slate-200 rounded-xl p-3 grid grid-cols-1 sm:grid-cols-[1fr_100px_1fr_auto] gap-2.5 items-end"
                  >
                    <div className="col-span-full pb-1 border-b border-gray-200/60 flex items-center justify-between text-xs font-bold text-gray-800">
                      <span>Supplier: {currentSupName} — Option #{idx + 1}</span>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-gray-500">Cut-Off Day</label>
                      <select
                        value={sch.cutOffDay}
                        onChange={(e) => updateScheduleEntry(idx, { cutOffDay: e.target.value })}
                        className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs bg-white font-medium"
                      >
                        {WEEKDAYS.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-gray-500">Time</label>
                      <input
                        type="time"
                        value={sch.cutOffTime}
                        onChange={(e) => updateScheduleEntry(idx, { cutOffTime: e.target.value })}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs bg-white font-medium"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-gray-500">Delivery Day</label>
                      <select
                        value={sch.deliveryDay}
                        onChange={(e) => updateScheduleEntry(idx, { deliveryDay: e.target.value })}
                        className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs bg-white font-medium"
                      >
                        {WEEKDAYS.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeScheduleEntry(idx)}
                      disabled={editingSchedules.length <= 1}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-30 self-end"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}

              <div className="space-y-1 pt-2 border-t border-gray-100">
                <label className="text-xs font-semibold text-gray-700 flex items-center justify-between">
                  <span>Safety Buffer Percentage</span>
                  <span className="text-blue-600 font-bold">{editingSafetyPct}%</span>
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={editingSafetyPct}
                  onChange={(e) => setEditingSafetyPct(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-semibold"
                />
                <p className="text-[11px] text-gray-500">
                  Adds extra buffer above recommended sales velocity replenishment.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowScheduleModal(false)}
                className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSaveQuickSchedule()}
                disabled={savingScheduleModal}
                className="px-5 py-2 text-xs bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-xs disabled:opacity-50"
              >
                {savingScheduleModal ? 'Saving…' : 'Save Schedule'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function csvEscape(value: string | number | null | undefined) {
  const s = String(value ?? '');
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'order';
}

function todayStamp() {
  return new Date().toISOString().slice(0, 10);
}

function downloadBlob(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
