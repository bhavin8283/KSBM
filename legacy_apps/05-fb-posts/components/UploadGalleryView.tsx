import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  UploadCloud,
  Trash2,
  Check,
  ChevronDown,
  ChevronUp,
  Zap,
  Clock,
  Folder,
  ArrowLeft,
  FileText,
  Sparkles,
  Globe,
  X,
  Sliders,
  Image as ImageIcon,
  Video as VideoIcon,
} from "lucide-react";
import {
  Asset,
  Folder as VaultFolder,
  GeneratedCaption,
  ModulePermissions,
  Product,
  Template,
} from "../types";
import { StoreSocialApiClient } from "../services/storeSocialApi";
import {
  BACKGROUND_STYLES,
  CAPTION_TONES,
  PRODUCT_CATEGORIES,
  SAFE_AREA_MODES,
} from "../constants";
import {
  deriveSocialHandle,
  getBgImageUrl,
  getComputedBgStyle,
  isVideoMedia,
} from "../utils/mediaUtils";

interface UploadGalleryViewProps {
  api: StoreSocialApiClient;
  permissions: ModulePermissions;
  storeName?: string;
  socialHandle?: string;
  products: Product[];
  onUploadAutomated?: (
    imageUrl: string,
    category: string,
    mediaType: "image" | "video",
    date: string,
    time: string,
    platform: "Facebook" | "Instagram" | "Both",
    extraNotes?: string
  ) => void | Promise<void>;
  onApproveAutomation?: (productId: string) => void;
  onDeleteProduct: (productId: string) => void;
  onUpdateProduct: (productId: string, updates: Partial<Product>) => void;
  templates: Template[];
  onPublishNow: (postData: {
    productId: string;
    platform: string;
    caption: string;
    hashtags: string[];
    imageUrl: string;
  }) => Promise<any>;
  onSchedulePost: (schedData: {
    productId: string;
    date: string;
    time: string;
    platform: "Facebook" | "Instagram" | "Both";
  }) => Promise<any>;
  onTriggerRefresh?: () => void;
  onNotify?: (message: string, type?: "success" | "error" | "info") => void;
}

export default function UploadGalleryView({
  api,
  permissions,
  storeName = "Kwik Stop Convenience",
  socialHandle,
  products,
  onUploadAutomated,
  onApproveAutomation,
  onDeleteProduct,
  onUpdateProduct,
  onTriggerRefresh,
  onPublishNow,
  onSchedulePost,
  onNotify,
  templates = [],
}: UploadGalleryViewProps) {
  const displayStoreName = storeName || "Kwik Stop Convenience";
  const displayHandle = deriveSocialHandle(displayStoreName, socialHandle);
  const storeInitials = displayStoreName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("") || "KS";

  const [dragActive, setDragActive] = useState(false);
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [expandedPrompts, setExpandedPrompts] = useState<Record<string, boolean>>({});
  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null);
  const [uploadCategory, setUploadCategory] = useState<string>(PRODUCT_CATEGORIES[0]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const manualFileInputRef = useRef<HTMLInputElement>(null);

  const [stagedAssets, setStagedAssets] = useState<
    {
      id: string;
      imageUrl: string;
      mediaType: "image" | "video";
      scheduledDate: string;
      scheduledTime: string;
      platform: "Facebook" | "Instagram" | "Both";
      extraNotes: string;
    }[]
  >([]);
  const [isProcessingStaged, setIsProcessingStaged] = useState(false);

  const [isProcessingBatch, setIsProcessingBatch] = useState(false);
  const [batchLogs, setBatchLogs] = useState<string[]>([]);

  const [postingMode, setPostingMode] = useState<"automated" | "manual">("automated");

  const [manualName, setManualName] = useState("");
  const [manualBrand, setManualBrand] = useState("");
  const [manualFlavor, setManualFlavor] = useState("");
  const [manualSize, setManualSize] = useState("");
  const [manualPackageType, setManualPackageType] = useState("Can");
  const [manualSlogan, setManualSlogan] = useState("");
  const [manualExtraNotes, setManualExtraNotes] = useState("");
  const [manualSelectedImageUrl, setManualSelectedImageUrl] = useState("");
  const [manualMediaType, setManualMediaType] = useState<"image" | "video">("image");
  const [manualOutputType, setManualOutputType] = useState("Generate Image");
  const [manualBgStyle, setManualBgStyle] = useState("Auto");
  const [manualBannerMode, setManualBannerMode] = useState("Preset");
  const [manualBannerPreset] = useState("NEW ARRIVAL");
  const [manualBannerCustomText, setManualBannerCustomText] = useState("");
  const [manualFooterCaption, setManualFooterCaption] = useState(`Available at ${displayStoreName}`);
  const [manualOfferBadgeEnabled, setManualOfferBadgeEnabled] = useState(false);
  const [manualOfferBadgeText, setManualOfferBadgeText] = useState("SPECIAL");
  const [manualSafeAreaMode, setManualSafeAreaMode] = useState("Facebook & Instagram Mobile-Optimized");
  const [manualDisableBgRemoval, setManualDisableBgRemoval] = useState(false);

  const [targetPlatform, setTargetPlatform] = useState<"Facebook" | "Instagram" | "Both">("Both");
  const [customScheduleDate, setCustomScheduleDate] = useState("");
  const [customScheduleTime, setCustomScheduleTime] = useState("12:00");
  const [isPublishingNow, setIsPublishingNow] = useState(false);
  const [isSchedulingPost, setIsSchedulingPost] = useState(false);

  const computedBgStyle = getComputedBgStyle(manualBgStyle, manualFlavor, manualName);

  const [manualGenerating, setManualGenerating] = useState(false);
  const [currentGenerationPhase, setCurrentGenerationPhase] = useState("");
  const manualAbortControllerRef = useRef<AbortController | null>(null);

  const handleStopManualGenerate = () => {
    if (manualAbortControllerRef.current) {
      manualAbortControllerRef.current.abort();
      manualAbortControllerRef.current = null;
    }
    setManualGenerating(false);
  };

  const handleStopAutomatedProduction = async (productId: string) => {
    try {
      await api.stopProductProduction(productId);
      onTriggerRefresh?.();
    } catch (e: any) {
      onNotify?.(e.message || "Failed to stop production.", "error");
    }
  };

  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
  const [vaultFolders, setVaultFolders] = useState<VaultFolder[]>([]);
  const [vaultAssets, setVaultAssets] = useState<Asset[]>([]);
  const [vaultLoading, setVaultLoading] = useState(false);
  const [selectedVaultFolderId, setSelectedVaultFolderId] = useState<string | null>(null);

  const fetchVaultData = async () => {
    setVaultLoading(true);
    try {
      const [foldersRes, assetsRes] = await Promise.all([api.getFolders(), api.getAssets()]);
      setVaultFolders(foldersRes || []);
      setVaultAssets(assetsRes || []);
    } catch (err) {
      console.error("Failed to load assets from vault:", err);
    } finally {
      setVaultLoading(false);
    }
  };

  useEffect(() => {
    if (isAssetModalOpen) {
      fetchVaultData();
    }
  }, [isAssetModalOpen]);

  const [autoPostDate, setAutoPostDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split("T")[0];
  });
  const [autoPostTime, setAutoPostTime] = useState("12:00");
  const [autoPlatform, setAutoPlatform] = useState<"Facebook" | "Instagram" | "Both">("Both");
  const [autoExtraNotes, setAutoExtraNotes] = useState("");

  const [currentCaptions, setCurrentCaptions] = useState<GeneratedCaption[]>([]);
  const [selectedCaptionType, setSelectedCaptionType] = useState<string>("Fun");
  const [isGeneratingCaption, setIsGeneratingCaption] = useState<string | null>(null);
  const [currentHashtags, setCurrentHashtags] = useState<string[]>([]);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);

  const [previewPostModal, setPreviewPostModal] = useState<{
    isOpen: boolean;
    platform: "Facebook" | "Instagram";
    caption: string;
    hashtags: string[];
    imageUrl: string;
  } | null>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const processFiles = (files: FileList) => {
    if (!permissions.canUpload) {
      onNotify?.("You do not have upload permission.", "error");
      return;
    }
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      const isVideo = file.type.startsWith("video/");
      const mediaType = isVideo ? "video" : "image";
      reader.onload = (event) => {
        if (event.target?.result) {
          setStagedAssets((prev) => [
            ...prev,
            {
              id: Math.random().toString(36).substr(2, 9) + "_" + Date.now(),
              imageUrl: event.target.result as string,
              mediaType,
              scheduledDate: autoPostDate || new Date().toISOString().split("T")[0],
              scheduledTime: autoPostTime || "12:00",
              platform: autoPlatform || "Both",
              extraNotes: autoExtraNotes || "",
            },
          ]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleProcessStagedQueue = async () => {
    if (stagedAssets.length === 0 || !onUploadAutomated || !permissions.canUpload) return;
    setIsProcessingStaged(true);
    try {
      for (const asset of stagedAssets) {
        await onUploadAutomated(
          asset.imageUrl,
          uploadCategory,
          asset.mediaType,
          asset.scheduledDate,
          asset.scheduledTime,
          asset.platform,
          asset.extraNotes
        );
      }
      setStagedAssets([]);
      setAutoExtraNotes("");
    } catch (e) {
      console.error("Error processing staged queue:", e);
    } finally {
      setIsProcessingStaged(false);
    }
  };

  const handleProcessProductNow = async (productId: string) => {
    if (!permissions.canEdit) {
      onNotify?.("You do not have permission to trigger AI processing.", "error");
      return;
    }
    onUpdateProduct(productId, { status: "Processing" });
    try {
      const data = await api.processProductNow(productId);
      if (data.success) {
        setTimeout(() => {
          onTriggerRefresh?.();
        }, 1000);
      } else {
        onUpdateProduct(productId, { status: "Queued" });
      }
    } catch (err) {
      console.error("Error processing product now:", err);
      onUpdateProduct(productId, { status: "Queued" });
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFiles(e.target.files);
    }
  };

  const handleFolderUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
  };

  const handleManualFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setManualSelectedImageUrl(event.target.result as string);
          setManualMediaType(file.type.startsWith("video/") ? "video" : "image");
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleManualGenerate = async () => {
    if (!permissions.canUpload) {
      onNotify?.("You do not have permission to generate manual creatives.", "error");
      return;
    }
    if (!manualName.trim()) {
      onNotify?.("Please enter a Product Name.", "error");
      return;
    }

    setManualGenerating(true);
    setCurrentGenerationPhase("Analyzing product geometry and brand assets...");

    const phases = [
      "Analyzing product geometry and brand assets...",
      "Extracting dominant color themes (Locking Brand Colors)...",
      "Injecting environmental background style: " + manualBgStyle + "...",
      "Applying creative direction accents...",
      "Polishing typography and Safe-Zone overlay alignments...",
      "Generating high-resolution photorealistic final composite...",
    ];

    let phaseIdx = 0;
    const interval = setInterval(() => {
      phaseIdx++;
      if (phaseIdx < phases.length) {
        setCurrentGenerationPhase(phases[phaseIdx]);
      }
    }, 1200);

    const controller = new AbortController();
    manualAbortControllerRef.current = controller;

    try {
      const data = await api.uploadManualCreative(
        {
          name: manualName,
          brand: manualBrand,
          flavor: manualFlavor,
          size: manualSize,
          packagingType: manualPackageType,
          slogan: manualSlogan,
          extraNotes: manualExtraNotes,
          imageUrl: manualSelectedImageUrl,
          outputType: manualOutputType,
          backgroundStyle: manualBgStyle,
          season: "None",
          brandColorLock: true,
          bannerTitleMode: manualBannerMode,
          bannerTitlePreset: manualBannerPreset,
          bannerTitleText: manualBannerCustomText,
          footerCaption: manualFooterCaption,
          offerBadgeEnabled: manualOfferBadgeEnabled,
          offerBadgeText: manualOfferBadgeText,
          businessLogoEnabled: true,
          textDensity: "Balanced",
          safeAreaMode: manualSafeAreaMode,
          disableBackgroundRemoval: manualDisableBgRemoval,
        },
        controller.signal
      );

      clearInterval(interval);

      if (data.success) {
        setManualName("");
        setManualBrand("");
        setManualFlavor("");
        setManualSize("");
        setManualSlogan("");
        setManualExtraNotes("");
        setManualSelectedImageUrl("");

        if (data.product?.id) {
          setExpandedCardId(data.product.id);
        }

        onTriggerRefresh?.();
        onNotify?.("Commercial creative generated!", "success");
      }
    } catch (err) {
      console.error("Manual Creative generation failed:", err);
      clearInterval(interval);
    } finally {
      manualAbortControllerRef.current = null;
      setManualGenerating(false);
      setCurrentGenerationPhase("");
    }
  };

  const toggleCardExpansion = async (productId: string) => {
    if (expandedCardId === productId) {
      setExpandedCardId(null);
      return;
    }

    setExpandedCardId(productId);
    const todayStr = new Date().toISOString().split("T")[0];
    setCustomScheduleDate(todayStr);
    setCustomScheduleTime("12:00");
    setTargetPlatform("Both");

    api
      .generateCaptions(productId, { type: "Fun" })
      .then((data) => {
        if (data.success) {
          setCurrentCaptions(data.captions);
          const selected = data.captions.find((c) => c.isSelected);
          if (selected) {
            setSelectedCaptionType(selected.type);
          } else if (data.captions.length > 0) {
            setSelectedCaptionType(data.captions[0].type);
          }
        }
      })
      .catch((err) => console.error("Error loading captions:", err));

    api
      .generateHashtags(productId, 20)
      .then((data) => {
        if (data.success) {
          setCurrentHashtags(data.hashtags);
        }
      })
      .catch((err) => console.error("Error loading hashtags:", err));
  };

  return (
    <div id="bulk_upload_module" className="space-y-8 animate-fade-in">
      {/* Upload zone (hidden for view-only users) */}
      {permissions.canUpload && (
        <div id="upload_zone_container" className="bg-slate-900 border border-slate-800/80 p-6 rounded-3xl shadow-xl">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800/60">
            <div>
              <h2 className="text-lg font-bold text-white font-display">Upload Product Assets</h2>
              <p className="text-xs text-slate-400 mt-1">
                Select or drag convenience product photos (Energy Drinks, Sodas, Snacks, Ice Creams, Confectionery)
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-slate-400">Post Category:</span>
              <select
                value={uploadCategory}
                onChange={(e) => setUploadCategory(e.target.value)}
                className="text-xs font-semibold bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-xl text-slate-200 cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {PRODUCT_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 mb-6 bg-slate-950 p-1 rounded-2xl w-fit border border-slate-800">
            <button
              type="button"
              onClick={() => setPostingMode("automated")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                postingMode === "automated"
                  ? "bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/10"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              Automated Posting
            </button>
            <button
              type="button"
              onClick={() => setPostingMode("manual")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                postingMode === "manual"
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/15"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              Manual Posting
            </button>
          </div>

          {postingMode === "manual" ? (
            <div id="manual_posting_studio" className="grid grid-cols-1 lg:grid-cols-12 gap-8 my-2 animate-fade-in text-xs">
              {/* LEFT COLUMN: EDITOR CONTROLS */}
              <div className="lg:col-span-7 space-y-6">
                <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
                    <h3 className="text-sm font-bold text-slate-200 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-indigo-400" />
                      1. Product Campaign Asset
                    </h3>
                    <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Required or AI-Generated</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                    <div className="md:col-span-1 aspect-square bg-slate-950 rounded-xl overflow-hidden border border-slate-800 flex flex-col items-center justify-center relative group">
                      {manualSelectedImageUrl ? (
                        <>
                          {manualMediaType === "video" ? (
                            <video src={manualSelectedImageUrl} className="w-full h-full object-cover" muted playsInline autoPlay loop />
                          ) : (
                            <img src={manualSelectedImageUrl} referrerPolicy="no-referrer" alt="Manual upload preview" className="w-full h-full object-cover" />
                          )}
                          <button
                            type="button"
                            onClick={() => setManualSelectedImageUrl("")}
                            className="absolute top-1.5 right-1.5 bg-slate-950/80 text-rose-400 hover:text-rose-300 p-1 rounded-lg border border-slate-800 opacity-0 group-hover:opacity-100 transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : (
                        <div className="text-center p-3">
                          <ImageIcon className="w-6 h-6 text-slate-700 mx-auto mb-1" />
                          <span className="text-[10px] text-slate-500 font-semibold">No Asset Loaded</span>
                          <p className="text-[9px] text-slate-600 mt-0.5">AI will synthesize product scene from text specs</p>
                        </div>
                      )}
                    </div>

                    <div className="md:col-span-2 space-y-3">
                      <p className="text-slate-400 leading-relaxed text-[11px]">
                        Provide a photo or transparent packshot. If you don't select an asset, the Creative Engine generates a photorealistic product render from scratch.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setIsAssetModalOpen(true)}
                          className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer text-[11px]"
                        >
                          <Folder className="w-3.5 h-3.5" />
                          Select from Vault
                        </button>
                        <button
                          type="button"
                          onClick={() => manualFileInputRef.current?.click()}
                          className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl border border-slate-700 transition flex items-center gap-1.5 cursor-pointer text-[11px]"
                        >
                          <UploadCloud className="w-3.5 h-3.5" />
                          Upload Custom File
                        </button>
                        <input
                          ref={manualFileInputRef}
                          type="file"
                          accept="image/*,video/*"
                          className="hidden"
                          onChange={handleManualFileChange}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
                    <h3 className="text-sm font-bold text-slate-200 flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-indigo-400" />
                      2. Product & Creative Settings
                    </h3>
                    <span className="text-[10px] text-indigo-400 font-bold bg-indigo-500/10 px-2 py-0.5 rounded-md">Simple Mode</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                        Product Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Energy Shot, Lemonade"
                        value={manualName}
                        onChange={(e) => setManualName(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Brand / Manufacturer</label>
                      <input
                        type="text"
                        placeholder="e.g. Red Bull, Kwik Crisp"
                        value={manualBrand}
                        onChange={(e) => setManualBrand(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Flavor / Variant</label>
                      <input
                        type="text"
                        placeholder="e.g. Blueberry, Salted Caramel"
                        value={manualFlavor}
                        onChange={(e) => setManualFlavor(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Size / Volume</label>
                        <input
                          type="text"
                          placeholder="e.g. 500ml, 3.5oz"
                          value={manualSize}
                          onChange={(e) => setManualSize(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Package Type</label>
                        <select
                          value={manualPackageType}
                          onChange={(e) => setManualPackageType(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
                        >
                          <option value="Can">Sleek Can</option>
                          <option value="Bottle">Glass Bottle</option>
                          <option value="Box">Cardboard Box</option>
                          <option value="Bag">Foil Bag</option>
                          <option value="Cup">Paper Cup</option>
                          <option value="Tub">Plastic Tub</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 pt-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Campaign Slogan / Catchphrase</label>
                      <input
                        type="text"
                        placeholder="e.g. Unleash your potential in every sip."
                        value={manualSlogan}
                        onChange={(e) => setManualSlogan(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                        Extra Information / Custom Creative Notes
                      </label>
                      <textarea
                        rows={3}
                        placeholder="Provide any additional specs, specific offer notes, holiday context, or prompt styling directives..."
                        value={manualExtraNotes}
                        onChange={(e) => setManualExtraNotes(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 resize-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
                    <h3 className="text-sm font-bold text-slate-200 flex items-center gap-1.5">
                      <Zap className="w-4 h-4 text-indigo-400" />
                      3. AI Rendering & Layout Configuration
                    </h3>
                    <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Style Options</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Output Format</label>
                      <select
                        value={manualOutputType}
                        onChange={(e) => setManualOutputType(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 font-semibold"
                      >
                        <option value="Generate Image">Static Creative Image (High-Res)</option>
                        <option value="Generate Video">Slow-Motion Ad Video (5-10s)</option>
                        <option value="Animate Existing Image">Animate Selected Image (Parallax Loop)</option>
                        <option value="Replace Background">Replace Background Only (Keep original product)</option>
                        <option value="Replace Background + Animate">Replace Background + Video Animation</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">AI Background Backdrop Style</label>
                      <select
                        value={manualBgStyle}
                        onChange={(e) => setManualBgStyle(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 font-semibold"
                      >
                        {BACKGROUND_STYLES.map((style) => (
                          <option key={style.value} value={style.value}>
                            {style.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="sm:col-span-2 p-3.5 bg-slate-950/40 border border-slate-800/60 rounded-xl flex items-start gap-3">
                      <input
                        type="checkbox"
                        id="manual_disable_bg_removal"
                        checked={!manualDisableBgRemoval}
                        onChange={(e) => setManualDisableBgRemoval(!e.target.checked)}
                        className="w-4 h-4 mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-800 bg-slate-950 cursor-pointer"
                      />
                      <div className="space-y-0.5">
                        <label htmlFor="manual_disable_bg_removal" className="text-xs font-bold text-slate-200 cursor-pointer select-none">
                          Auto Background Removal (Auto-Crop)
                        </label>
                        <p className="text-[10px] text-slate-400 leading-relaxed">
                          Automatically crops solid white/light backgrounds from the product image. Uncheck if your product has white or silver reflective labels.
                        </p>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Top Banner Headline (Optional)</label>
                      <input
                        type="text"
                        placeholder="e.g. NEW ARRIVAL, SPECIAL OFFER"
                        value={manualBannerCustomText}
                        onChange={(e) => {
                          const val = e.target.value;
                          setManualBannerCustomText(val);
                          setManualBannerMode(val ? "Custom" : "None");
                        }}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Promo Badge Sticker (Optional)</label>
                      <input
                        type="text"
                        placeholder="e.g. SALE, 2 FOR $6, Buy 1 Get 1"
                        value={manualOfferBadgeText}
                        onChange={(e) => {
                          const val = e.target.value;
                          setManualOfferBadgeText(val);
                          setManualOfferBadgeEnabled(!!val);
                        }}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Footer Caption / Call to Action</label>
                      <input
                        type="text"
                        placeholder={`e.g. Available at ${displayStoreName}`}
                        value={manualFooterCaption}
                        onChange={(e) => setManualFooterCaption(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 font-medium"
                      />
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {[`Available at ${displayStoreName}`, "Visit Today", "Open 7 Days", "Fresh Every Day", "Your Local Store"].map(
                          (capPreset) => (
                            <button
                              key={capPreset}
                              type="button"
                              onClick={() => setManualFooterCaption(capPreset)}
                              className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-[9px] font-bold text-slate-300 cursor-pointer"
                            >
                              +{capPreset}
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN: INTERACTIVE LIVE PREVIEW & SAFE AREA GUIDE */}
              <div className="lg:col-span-5 flex flex-col space-y-4">
                <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-5 shadow-sm space-y-4 flex-1 flex flex-col">
                  <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
                    <h3 className="text-sm font-bold text-slate-200 flex items-center gap-1.5">
                      <Sliders className="w-4 h-4 text-indigo-400" />
                      Live Feed Safe-Zone Preview
                    </h3>
                    <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                      WYSIWYG
                    </span>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Select Platform Canvas Dimensions</label>
                    <select
                      value={manualSafeAreaMode}
                      onChange={(e) => setManualSafeAreaMode(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none text-[11px] font-bold"
                    >
                      {SAFE_AREA_MODES.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex-1 flex items-center justify-center py-4 bg-slate-950/45 rounded-2xl border border-slate-800/80 overflow-hidden relative">
                    {manualGenerating && (
                      <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md z-30 flex flex-col items-center justify-center p-6 text-center animate-fade-in">
                        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4 shadow-lg shadow-indigo-500/25" />
                        <p className="text-sm font-black tracking-wide text-white animate-pulse">CREATIVE DIRECTOR BOT ACTIVE</p>
                        <p className="text-xs text-indigo-400 mt-2 bg-indigo-500/10 px-3 py-1 rounded-full font-semibold border border-indigo-500/15 max-w-xs truncate">
                          {currentGenerationPhase}
                        </p>
                        <button
                          onClick={handleStopManualGenerate}
                          className="mt-6 px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs rounded-xl transition-all inline-flex items-center gap-1.5 shadow-md cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                          Stop Generating
                        </button>
                      </div>
                    )}

                    <div
                      className={`relative shadow-2xl transition-all duration-300 overflow-hidden shrink-0 border border-slate-800/60 bg-slate-900 ${
                        manualSafeAreaMode.includes("Stories") || manualSafeAreaMode.includes("Reels")
                          ? "w-[240px] h-[426px] rounded-3xl"
                          : manualSafeAreaMode.includes("Portrait")
                          ? "w-[280px] h-[350px] rounded-2xl"
                          : "w-[300px] h-[300px] rounded-2xl"
                      }`}
                    >
                      <img
                        src={getBgImageUrl(computedBgStyle)}
                        alt="Campaign backdrop"
                        className="absolute inset-0 w-full h-full object-cover z-0 brightness-[0.55] saturate-[1.1] transition-all duration-500"
                        referrerPolicy="no-referrer"
                      />

                      <div className="absolute inset-2 border border-dashed border-rose-500/20 rounded-xl pointer-events-none z-10 flex flex-col justify-between p-1.5">
                        <div className="text-[7px] text-rose-500/40 font-mono scale-90 origin-top-left uppercase">Feed Safe Zone Bounds</div>
                        <div className="text-[7px] text-rose-500/40 font-mono scale-90 origin-bottom-right uppercase text-right">
                          Keep elements inside
                        </div>
                      </div>

                      {(manualSafeAreaMode.includes("Stories") || manualSafeAreaMode.includes("Reels")) && (
                        <>
                          <div className="absolute top-0 inset-x-0 h-10 bg-rose-500/5 border-b border-rose-500/10 z-10 pointer-events-none flex items-center justify-center">
                            <span className="text-[7px] text-rose-400 font-bold uppercase tracking-widest scale-90">Story Header Safe Zone</span>
                          </div>
                          <div className="absolute bottom-0 inset-x-0 h-14 bg-rose-500/5 border-t border-rose-500/10 z-10 pointer-events-none flex items-center justify-center">
                            <span className="text-[7px] text-rose-400 font-bold uppercase tracking-widest scale-90">Reply Bar Safe Zone</span>
                          </div>
                        </>
                      )}

                      {manualBannerMode !== "None" && (
                        <div className="absolute top-12 left-0 right-0 z-20 px-3 text-center">
                          <div className="inline-block px-3 py-1.5 rounded-xl font-black text-center shadow-md uppercase tracking-wider leading-none select-none border bg-indigo-600 text-white border-indigo-500 text-[10px]">
                            {manualBannerMode === "Preset" ? manualBannerPreset : manualBannerCustomText || "HEADLINE TITLE"}
                          </div>
                        </div>
                      )}

                      <div className="absolute inset-0 flex items-center justify-center z-10">
                        {manualSelectedImageUrl ? (
                          <div className="w-[60%] aspect-square flex items-center justify-center relative">
                            <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-36 h-3 bg-black/60 blur-md rounded-full z-0" />
                            {manualMediaType === "video" ? (
                              <video src={manualSelectedImageUrl} className="w-full h-full object-contain pointer-events-none z-10" muted playsInline autoPlay loop />
                            ) : (
                              <img src={manualSelectedImageUrl} referrerPolicy="no-referrer" alt="mock packshot" className="w-full h-full object-contain drop-shadow-2xl z-10" />
                            )}

                            {manualOfferBadgeEnabled && (
                              <div className="absolute -top-3 -right-3 w-12 h-12 rounded-full bg-red-600 text-white font-black flex items-center justify-center text-[8px] uppercase tracking-wider text-center rotate-12 shadow-lg border-2 border-white leading-tight select-none">
                                {manualOfferBadgeText || "SALE"}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="w-[45%] h-[60%] border-2 border-indigo-500/30 bg-indigo-500/5 rounded-3xl relative flex flex-col items-center justify-center shadow-inner p-4 text-center">
                            <Sparkles className="w-6 h-6 text-indigo-400/80 mb-2 animate-pulse" />
                            <span className="text-[10px] font-black text-indigo-300 select-none tracking-wider uppercase">
                              {manualBrand || "BRAND"}
                            </span>
                            <span className="text-[11px] font-bold text-white mt-1 select-none leading-none">
                              {manualName || "PRODUCT HERO"}
                            </span>
                            <span className="text-[8px] text-indigo-400 font-semibold mt-1.5 italic bg-indigo-500/15 border border-indigo-500/20 px-1.5 py-0.5 rounded-md select-none">
                              {manualPackageType} {manualSize && `• ${manualSize}`}
                            </span>
                            {manualOfferBadgeEnabled && (
                              <div className="absolute -top-4 -right-4 w-12 h-12 rounded-full bg-red-600 text-white font-black flex items-center justify-center text-[8px] uppercase tracking-wider text-center rotate-12 shadow-lg border-2 border-white leading-tight select-none z-10">
                                {manualOfferBadgeText || "SALE"}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="absolute bottom-3 left-4 z-20 pointer-events-none select-none flex items-center gap-1 opacity-75">
                        <div className="w-3.5 h-3.5 bg-amber-500 rounded-full flex items-center justify-center text-[6px] font-black text-slate-950">
                          {storeInitials[0] || "K"}
                        </div>
                        <span className="text-[8px] font-black tracking-widest text-white uppercase font-sans">{displayStoreName}</span>
                      </div>

                      {manualFooterCaption && (
                        <div className="absolute bottom-3 right-4 left-4 z-20 pointer-events-none select-none text-right">
                          <p className="text-[7.5px] font-bold text-slate-300 uppercase tracking-wider truncate">{manualFooterCaption}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleManualGenerate}
                    disabled={manualGenerating || !manualName.trim()}
                    className={`w-full py-3.5 px-4 font-black rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 text-white ${
                      !manualName.trim()
                        ? "bg-slate-800 border border-slate-700 text-slate-500 cursor-not-allowed"
                        : "bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] cursor-pointer"
                    }`}
                  >
                    <Sparkles className="w-4 h-4" />
                    Generate Commercial Creative
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div
                id="automated_campaign_settings"
                className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 bg-slate-950/70 p-4 rounded-2xl border border-amber-500/15 text-xs animate-fade-in"
              >
                <div>
                  <label className="block text-[10px] font-bold text-amber-400 uppercase tracking-wider mb-1.5">Auto Post Date</label>
                  <input
                    type="date"
                    value={autoPostDate}
                    onChange={(e) => setAutoPostDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-amber-400 uppercase tracking-wider mb-1.5">Auto Post Time</label>
                  <input
                    type="time"
                    value={autoPostTime}
                    onChange={(e) => setAutoPostTime(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-amber-400 uppercase tracking-wider mb-1.5">Target Platforms</label>
                  <select
                    value={autoPlatform}
                    onChange={(e) => setAutoPlatform(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="Both">Both Facebook & Instagram</option>
                    <option value="Facebook">Facebook Page Only</option>
                    <option value="Instagram">Instagram Business Only</option>
                  </select>
                </div>

                <div className="md:col-span-3 border-t border-slate-800/60 pt-3 mt-1">
                  <label className="block text-[10px] font-bold text-amber-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                    <span>Custom Overlay Text / Campaign Copy Claims (Optional)</span>
                    <span className="text-[9px] text-slate-500 font-normal normal-case">Directs AI to add custom text onto the image</span>
                  </label>
                  <input
                    type="text"
                    value={autoExtraNotes}
                    onChange={(e) => setAutoExtraNotes(e.target.value)}
                    placeholder="e.g., Slogan: 'Ice Cold Energy', 'Limited Stock!', or 'Buy 1 Get 1 Free'"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-500 text-xs"
                  />
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {["Limited Stock!", "Running Out of Stock!", "Slogan: Pure Taste", "Buy 1 Get 1 Free"].map((notePreset) => (
                      <button
                        key={notePreset}
                        type="button"
                        onClick={() => setAutoExtraNotes(notePreset)}
                        className="px-2 py-0.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded text-[9px] font-bold text-slate-400 hover:text-slate-200 cursor-pointer"
                      >
                        +{notePreset}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                id="drag_drop_zone"
                className={`border-2 border-dashed rounded-2xl p-8 text-center flex flex-col items-center justify-center transition-all ${
                  dragActive ? "border-amber-500 bg-amber-950/30" : "border-amber-900/40 bg-slate-950/40 hover:bg-amber-950/10"
                }`}
              >
                <Zap className="w-12 h-12 text-amber-400 mb-3 animate-bounce" />
                <p className="text-sm font-bold text-slate-200">Upload Media to Queue Automated Posting</p>
                <p className="text-xs text-slate-500 mt-1">
                  Supports JPEG, PNG, MP4, MOV - AI will automatically recognize specs, captions, and backgrounds
                </p>

                <div className="flex gap-3 mt-4 flex-wrap justify-center">
                  <button
                    type="button"
                    onClick={() => setIsAssetModalOpen(true)}
                    className="px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer text-white bg-indigo-600 hover:bg-indigo-500 shadow-md flex items-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Select Assets
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer text-white bg-amber-600 hover:bg-amber-500 shadow-md"
                  >
                    Upload Files
                  </button>
                  <label className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1">
                    <input
                      type="file"
                      multiple
                      {...({ webkitdirectory: "", directory: "" } as React.InputHTMLAttributes<HTMLInputElement>)}
                      className="hidden"
                      onChange={handleFolderUpload}
                    />
                    Upload Folder
                  </label>
                </div>

                <input ref={fileInputRef} type="file" multiple className="hidden" accept="image/*,video/*" onChange={handleFileChange} />
              </div>

              {stagedAssets.length > 0 && (
                <div
                  id="staged_assets_queue"
                  className="mt-6 bg-slate-950/40 border border-amber-500/20 rounded-2xl p-5 space-y-4 animate-fade-in text-xs"
                >
                  <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
                    <div>
                      <h3 className="text-sm font-bold text-amber-400 flex items-center gap-1.5 font-display">
                        <Zap className="w-4 h-4 text-amber-400 animate-pulse" />
                        Staged Campaign Queue ({stagedAssets.length} {stagedAssets.length === 1 ? "Item" : "Items"})
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Customize individual schedules or notes below, then click "Process & Queue Campaigns".
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setStagedAssets([])}
                      className="text-slate-400 hover:text-rose-400 text-[10px] font-bold transition cursor-pointer"
                    >
                      Clear All
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {stagedAssets.map((asset) => (
                      <div key={asset.id} className="bg-slate-900 border border-slate-800/60 rounded-2xl p-3 flex flex-col sm:flex-row gap-3 relative shadow-md">
                        <div className="w-full sm:w-24 h-24 bg-slate-950 rounded-xl overflow-hidden relative flex-shrink-0 flex items-center justify-center border border-slate-800">
                          {asset.mediaType === "video" ? (
                            <video src={asset.imageUrl} className="w-full h-full object-cover" muted playsInline />
                          ) : (
                            <img src={asset.imageUrl} alt="Staged item preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          )}

                          <button
                            type="button"
                            onClick={() => setStagedAssets((prev) => prev.filter((a) => a.id !== asset.id))}
                            className="absolute top-1 right-1 bg-slate-950/80 text-rose-400 hover:text-rose-300 p-1 rounded-lg border border-slate-800 hover:scale-105 transition cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>

                        <div className="flex-1 space-y-2 text-[11px]">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Post Date</label>
                              <input
                                type="date"
                                value={asset.scheduledDate}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setStagedAssets((prev) => prev.map((a) => (a.id === asset.id ? { ...a, scheduledDate: val } : a)));
                                }}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-slate-200 focus:outline-none focus:border-amber-500 font-medium"
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Post Time</label>
                              <input
                                type="time"
                                value={asset.scheduledTime}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setStagedAssets((prev) => prev.map((a) => (a.id === asset.id ? { ...a, scheduledTime: val } : a)));
                                }}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-slate-200 focus:outline-none focus:border-amber-500 font-medium"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Platform</label>
                              <select
                                value={asset.platform}
                                onChange={(e) => {
                                  const val = e.target.value as "Facebook" | "Instagram" | "Both";
                                  setStagedAssets((prev) => prev.map((a) => (a.id === asset.id ? { ...a, platform: val } : a)));
                                }}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-slate-200 focus:outline-none focus:border-amber-500 font-bold"
                              >
                                <option value="Both">Both</option>
                                <option value="Facebook">Facebook</option>
                                <option value="Instagram">Instagram</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Custom Claims</label>
                              <input
                                type="text"
                                placeholder="e.g. Slogan: Cold Fizz"
                                value={asset.extraNotes}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setStagedAssets((prev) => prev.map((a) => (a.id === asset.id ? { ...a, extraNotes: val } : a)));
                                }}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-slate-200 focus:outline-none focus:border-amber-500 font-medium"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-800">
                    <div className="text-[11px] text-slate-400 font-semibold">
                      Staging Category: <span className="text-amber-400 font-bold">{uploadCategory}</span> |{" "}
                      <span className="text-slate-200 font-bold">{stagedAssets.length} Assets</span> ready to queue.
                    </div>
                    <button
                      type="button"
                      disabled={isProcessingStaged}
                      onClick={handleProcessStagedQueue}
                      className="w-full sm:w-auto px-6 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-lg cursor-pointer transition-all flex items-center justify-center gap-2 uppercase tracking-wider"
                    >
                      {isProcessingStaged ? "Adding to AI Queue..." : "Process & Queue Campaigns"}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Daily 9 PM AI Batch Control Panel */}
          {postingMode === "automated" && (
            <div className="mt-6 bg-slate-900/60 border border-indigo-500/10 rounded-3xl p-5 space-y-4 animate-fade-in text-xs shadow-xl relative overflow-hidden">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-indigo-400 flex items-center gap-1.5 font-display">
                    <Clock className="w-4 h-4 text-indigo-400" />
                    Daily 9:00 PM AI Batch Engine
                  </h3>
                  <p className="text-[11px] text-slate-300 leading-relaxed max-w-2xl">
                    Bulk-uploaded photos are saved to your queue. Every night at <strong>9:00 PM</strong>, StoreSocial AI processes 2 queued photos, extracts specs, and drafts campaigns labeled <span className="text-amber-400 font-bold">Draft Scheduled</span>.
                  </p>
                </div>

                <div className="flex gap-3 bg-slate-950/60 border border-slate-800 p-3 rounded-2xl flex-shrink-0">
                  <div className="text-center px-2">
                    <div className="text-lg font-black text-indigo-400 font-mono">
                      {products.filter((p) => p.status === "Queued" || (p.status === "Not Processed" && p.isFullyAutomated)).length}
                    </div>
                    <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Queued</div>
                  </div>
                  <div className="w-px bg-slate-800 self-stretch" />
                  <div className="text-center px-2">
                    <div className="text-lg font-black text-amber-500 font-mono">
                      {products.filter((p) => p.status === "Draft Scheduled").length}
                    </div>
                    <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Need Approval</div>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-800/60">
                <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                  Status: <strong className="text-slate-300">Active (Next auto-run tonight at 9:00 PM)</strong>
                </div>

                {permissions.canEdit && (
                  <button
                    type="button"
                    disabled={
                      isProcessingBatch ||
                      products.filter((p) => p.status === "Queued" || (p.status === "Not Processed" && p.isFullyAutomated)).length === 0
                    }
                    onClick={async () => {
                      setIsProcessingBatch(true);
                      setBatchLogs(["[Daily AI Run] Contacting active AI agents...", "[Daily AI Run] Fetching next 2 queued campaign items..."]);
                      try {
                        const data = await api.runDailyBatchNow();
                        if (data.success) {
                          setBatchLogs((prev) => [
                            ...prev,
                            `[Daily AI Run] Selected ${data.processedCount} queued photos for batch processing.`,
                            "Executing vision scanning and background enhancement in background...",
                          ]);
                          setTimeout(() => {
                            onTriggerRefresh?.();
                            setIsProcessingBatch(false);
                            setBatchLogs([]);
                          }, 3000);
                        } else {
                          setBatchLogs((prev) => [...prev, `Error: ${data.message || "Failed to trigger batch"}`]);
                          setTimeout(() => setIsProcessingBatch(false), 4000);
                        }
                      } catch {
                        setBatchLogs((prev) => [...prev, "Connection error during batch process execution."]);
                        setTimeout(() => setIsProcessingBatch(false), 4000);
                      }
                    }}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-md"
                  >
                    <Clock className="w-3.5 h-3.5" />
                    {isProcessingBatch ? "Running 9:00 PM Batch..." : "Run 9:00 PM AI Batch Now"}
                  </button>
                )}
              </div>

              {batchLogs.length > 0 && (
                <div className="bg-slate-950 border border-indigo-500/20 p-3 rounded-2xl space-y-1 font-mono text-[10px] text-indigo-300 max-h-32 overflow-y-auto">
                  {batchLogs.map((log, idx) => (
                    <div key={idx} className="leading-relaxed">
                      {log}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Grid gallery display */}
      <div id="product_gallery_section">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-md font-bold text-white">Convenience Product Cards ({products.length})</h2>
          <span className="text-xs text-slate-400 font-medium">Click card to expand Campaign Board</span>
        </div>

        {products.length === 0 ? (
          <div className="bg-slate-900/60 p-12 text-center rounded-2xl border border-dashed border-slate-800">
            <p className="text-slate-400 text-sm">No product images in your catalog yet. Upload an image to start.</p>
          </div>
        ) : (
          <div id="products_grid" className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {products.map((prod) => {
              const isExpanded = expandedCardId === prod.id;
              const isVid = isVideoMedia(prod.imageUrl, prod.mediaType);

              return (
                <div
                  key={prod.id}
                  id={`product_card_${prod.id}`}
                  className={`bg-slate-900 rounded-3xl border transition-all overflow-hidden ${
                    isExpanded ? "border-indigo-500/80 shadow-2xl ring-1 ring-indigo-500/30" : "border-slate-800/80 shadow-md hover:border-slate-700"
                  }`}
                >
                  <div onClick={() => toggleCardExpansion(prod.id)} className="p-4 flex gap-4 items-center cursor-pointer select-none">
                    <div className="w-20 h-20 bg-slate-950 rounded-xl overflow-hidden flex-shrink-0 border border-slate-800 relative flex items-center justify-center">
                      {isVid ? (
                        <video src={prod.imageUrl} className="w-full h-full object-cover" muted loop playsInline autoPlay />
                      ) : (
                        <img src={prod.imageUrl} referrerPolicy="no-referrer" alt={prod.name} className="w-full h-full object-cover" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-semibold text-indigo-300 bg-indigo-500/10 px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-indigo-500/20">
                          {prod.category}
                        </span>
                        {prod.internetSearchPerformed && (
                          <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-emerald-500/20 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                            Web Grounded
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm font-bold text-white mt-1 truncate">{prod.name}</h3>

                      <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-400 font-medium">
                        {prod.brand && <span>{prod.brand}</span>}
                        {prod.brand && prod.size && <span>•</span>}
                        {prod.size && <span>{prod.size}</span>}
                      </div>

                      <div className="mt-2 flex items-center gap-1.5">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            prod.status === "Posted"
                              ? "bg-emerald-500"
                              : prod.status === "Scheduled"
                              ? "bg-blue-500"
                              : prod.status === "Draft Scheduled"
                              ? "bg-amber-500 animate-pulse"
                              : prod.status === "Queued"
                              ? "bg-indigo-500 animate-pulse"
                              : prod.status === "Processing"
                              ? "bg-amber-400 animate-pulse"
                              : "bg-slate-600"
                          }`}
                        />
                        <span
                          className={`text-[10px] font-bold ${
                            prod.status === "Draft Scheduled"
                              ? "text-amber-400"
                              : prod.status === "Queued"
                              ? "text-indigo-400"
                              : "text-slate-300"
                          }`}
                        >
                          {prod.status === "Draft Scheduled"
                            ? "Draft Scheduled (Needs Review)"
                            : prod.status === "Queued"
                            ? "Queued for 9:00 PM AI Run"
                            : prod.status}
                        </span>
                      </div>
                    </div>

                    <button className="text-slate-400 hover:text-slate-200 p-2 rounded-full hover:bg-slate-800">
                      {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-slate-800 bg-slate-950/40 p-4 space-y-4">
                      {prod.status === "Queued" ? (
                        <div className="p-6 text-center space-y-4 bg-slate-950/60 rounded-2xl border border-indigo-500/10 text-xs">
                          <Clock className="w-8 h-8 text-indigo-400 mx-auto animate-pulse" />
                          <div className="text-indigo-300 font-bold text-xs uppercase tracking-wider">Awaiting Nightly AI Batch Processor</div>
                          <p className="text-[11px] text-slate-400 max-w-sm mx-auto leading-relaxed">
                            This product photo is queued. At 9:00 PM, AI will scan this image, generate copywriting captions, and style a custom backdrop.
                          </p>

                          <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2">
                            <div className="text-[11px] text-slate-400 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800 font-medium">
                              Schedule: <strong className="text-slate-200">{prod.automatedScheduledDate} {prod.automatedScheduledTime}</strong> on{" "}
                              <strong className="text-indigo-400">{prod.automatedPlatform}</strong>
                            </div>

                            {permissions.canEdit && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleProcessProductNow(prod.id);
                                }}
                                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition cursor-pointer flex items-center gap-1 inline-flex text-xs shadow-md"
                              >
                                <Sparkles className="w-3.5 h-3.5" />
                                Process with AI Now
                              </button>
                            )}
                          </div>
                        </div>
                      ) : prod.status === "Processing" ? (
                        <div className="p-8 text-center space-y-4">
                          <div className="flex justify-center">
                            <Zap className="w-8 h-8 text-amber-400 animate-bounce" />
                          </div>
                          <div className="text-slate-300 font-bold text-xs">AI Agent is producing your automated campaign...</div>
                          <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                            Recognizing specifications via Gemini Vision, compiling copywriting captions, and creating a 1440x1800 px backdrop.
                          </p>
                          {permissions.canEdit && (
                            <div className="pt-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStopAutomatedProduction(prod.id);
                                }}
                                className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs rounded-xl transition-all inline-flex items-center gap-1.5 shadow-md cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                                Stop Production
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div id={`automated_preview_${prod.id}`} className="space-y-4 pt-1 animate-fade-in text-xs">
                          {prod.quotaExceeded && (
                            <div className="bg-indigo-500/10 border border-indigo-500/20 p-4 rounded-2xl flex items-start gap-3">
                              <div className="flex-1">
                                <h4 className="font-bold text-indigo-300 text-[11px] uppercase tracking-wider">Premium Composite Backdrop Fallback</h4>
                                <p className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">
                                  Image generation quota was temporarily reached; a high-resolution themed composite backdrop matching the product profile was applied.
                                </p>
                              </div>
                            </div>
                          )}

                          {prod.status === "Draft Scheduled" ? (
                            <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="bg-amber-500 text-slate-950 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider">
                                    AI Automated Campaign Draft
                                  </span>
                                  <span className="text-slate-200 font-medium">Ready for review & approval</span>
                                </div>
                                <p className="text-[11px] text-slate-300 mt-2">
                                  Review generated visuals, captions, and hashtags below before approving for the schedule queue.
                                </p>
                              </div>
                              {permissions.canApprove && (
                                <div className="flex gap-2.5 flex-shrink-0">
                                  <button
                                    onClick={() => onApproveAutomation?.(prod.id)}
                                    className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-slate-950 font-black text-xs rounded-xl shadow-md cursor-pointer transition-all flex items-center gap-1.5"
                                  >
                                    <Check className="w-4 h-4 text-slate-950 stroke-[3]" />
                                    Approve Campaign
                                  </button>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="bg-emerald-500 text-slate-950 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider">
                                    Campaign {prod.status}
                                  </span>
                                  <span className="text-slate-200 font-medium">Ready for social channels</span>
                                </div>
                              </div>
                            </div>
                          )}

                          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                            <div className="lg:col-span-5 space-y-3">
                              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Social Feed Simulation</h4>
                              <div className="bg-slate-900 rounded-2xl border border-slate-800/80 p-4 space-y-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 bg-indigo-600/20 text-indigo-400 rounded-full flex items-center justify-center font-bold text-xs">
                                    {storeInitials}
                                  </div>
                                  <div>
                                    <div className="font-bold text-white text-xs">{displayStoreName}</div>
                                    <div className="text-[9px] text-slate-400 font-medium">
                                      Scheduled for {prod.automatedScheduledDate || "tomorrow"} at {prod.automatedScheduledTime || "12:00"} on{" "}
                                      {prod.automatedPlatform || "Both"}
                                    </div>
                                  </div>
                                </div>

                                <div className="aspect-square bg-slate-950 rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center relative">
                                  {isVid ? (
                                    <video src={prod.imageUrl} className="w-full h-full object-cover" muted loop playsInline autoPlay />
                                  ) : (
                                    <img src={prod.imageUrl} referrerPolicy="no-referrer" alt="Campaign Post Preview" className="w-full h-full object-cover" />
                                  )}
                                  {prod.originalImageUrl && prod.originalImageUrl !== prod.imageUrl && (
                                    <div className="absolute top-2 right-2 bg-indigo-500/20 border border-indigo-500/40 text-[9px] font-extrabold text-indigo-300 px-2 py-0.5 rounded-md backdrop-blur-sm">
                                      AI Enhanced Backdrop
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="lg:col-span-7 space-y-4">
                              <div className="space-y-2">
                                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-display">Auto-Compiled Specifications</h4>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 bg-slate-900/50 p-3 rounded-xl border border-slate-800">
                                  <div className="p-2 bg-slate-950 rounded-lg">
                                    <span className="block text-[8px] font-bold text-slate-500 uppercase">Brand</span>
                                    <span className="font-bold text-white text-xs">{prod.brand || "Generic"}</span>
                                  </div>
                                  <div className="p-2 bg-slate-950 rounded-lg">
                                    <span className="block text-[8px] font-bold text-slate-500 uppercase">Flavor</span>
                                    <span className="font-bold text-white text-xs">{prod.flavor || "Original"}</span>
                                  </div>
                                  <div className="p-2 bg-slate-950 rounded-lg">
                                    <span className="block text-[8px] font-bold text-slate-500 uppercase">Category</span>
                                    <span className="font-bold text-indigo-400 text-xs truncate block">{prod.category}</span>
                                  </div>
                                  <div className="p-2 bg-slate-950 rounded-lg">
                                    <span className="block text-[8px] font-bold text-slate-500 uppercase">Size</span>
                                    <span className="font-bold text-white text-xs">{prod.size || "Standard"}</span>
                                  </div>
                                </div>
                              </div>

                              {prod.internetSearchNotes && (
                                <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3.5 space-y-2">
                                  <div className="flex items-center gap-2 text-emerald-400">
                                    <Globe className="w-3.5 h-3.5 animate-pulse" />
                                    <span className="font-bold text-xs tracking-wide uppercase font-display flex items-center gap-1.5">
                                      Google AI Web Search Insights
                                      <span className="px-1.5 py-0.5 bg-emerald-500/10 text-[8px] rounded border border-emerald-500/20 font-mono">
                                        LIVE GROUNDED
                                      </span>
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-slate-300 leading-relaxed font-sans max-h-36 overflow-y-auto bg-slate-950/40 p-2.5 rounded-lg border border-slate-900/60 whitespace-pre-line">
                                    {prod.internetSearchNotes}
                                  </div>
                                </div>
                              )}

                              <div className="bg-slate-900/45 border border-slate-800 rounded-xl p-3 space-y-2">
                                <button
                                  onClick={() =>
                                    setExpandedPrompts((prev) => ({
                                      ...prev,
                                      [prod.id]: !prev[prod.id],
                                    }))
                                  }
                                  className="w-full flex items-center justify-between text-left text-slate-300 hover:text-white transition-colors cursor-pointer"
                                >
                                  <div className="flex items-center gap-2">
                                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                                    <span className="font-bold text-xs tracking-wide">AI Creative Director Scene Recipe</span>
                                  </div>
                                  {expandedPrompts[prod.id] ? (
                                    <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                                  ) : (
                                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                                  )}
                                </button>

                                {expandedPrompts[prod.id] && (
                                  <div className="text-[11px] text-slate-300 pt-1.5 space-y-2.5 border-t border-slate-800/80">
                                    <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 font-mono text-[10px] text-slate-200 relative">
                                      <p className="leading-relaxed">
                                        Commercial advertisement studio backdrop stage for "{prod.brand || "Generic"}" "{prod.name}" (Flavor:{" "}
                                        {prod.flavor || "Original"}, Category: {prod.category || "General"}).
                                      </p>
                                      <button
                                        onClick={() => {
                                          const fullPrompt = `Commercial advertisement studio backdrop stage for "${prod.brand || "Generic"}" "${prod.name}" (Flavor: "${prod.flavor || "Original"}", Category: "${prod.category || "General"}").`;
                                          navigator.clipboard.writeText(fullPrompt);
                                          setCopiedPromptId(prod.id);
                                          setTimeout(() => setCopiedPromptId(null), 2000);
                                        }}
                                        className="mt-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[9px] font-bold text-slate-300 px-2 py-1 rounded cursor-pointer"
                                      >
                                        {copiedPromptId === prod.id ? "Copied!" : "Copy Prompt"}
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>

                              <div className="space-y-2">
                                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-display">
                                  Generated Copywriting (Selected Option)
                                </h4>
                                <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 space-y-3">
                                  {currentCaptions.length > 0 || isGeneratingCaption !== null ? (
                                    <div className="space-y-3">
                                      <textarea
                                        value={
                                          isGeneratingCaption === selectedCaptionType
                                            ? `Generating targeted "${selectedCaptionType}" copy variant...`
                                            : currentCaptions.find((c) => c.type === selectedCaptionType)?.content || ""
                                        }
                                        disabled={isGeneratingCaption === selectedCaptionType || !permissions.canEdit}
                                        onChange={(e) => {
                                          const text = e.target.value;
                                          setCurrentCaptions((prev) =>
                                            prev.map((c) => (c.type === selectedCaptionType ? { ...c, content: text } : c))
                                          );
                                          const selected = currentCaptions.find((c) => c.type === selectedCaptionType);
                                          if (selected) {
                                            api.updateCaption(prod.id, selected.id, text);
                                          }
                                        }}
                                        rows={6}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
                                      />
                                      <div className="flex flex-wrap gap-1.5 pt-1">
                                        {CAPTION_TONES.map((style) => {
                                          const cap = currentCaptions.find((c) => c.type === style);
                                          const isSelected = selectedCaptionType === style;
                                          const isGeneratingThisStyle = isGeneratingCaption === style;

                                          return (
                                            <button
                                              key={style}
                                              disabled={isGeneratingCaption !== null}
                                              onClick={() => {
                                                setSelectedCaptionType(style);
                                                if (!cap && permissions.canEdit) {
                                                  setIsGeneratingCaption(style);
                                                  api
                                                    .generateCaptions(prod.id, { type: style })
                                                    .then((data) => {
                                                      if (data.success) {
                                                        setCurrentCaptions(data.captions);
                                                      }
                                                    })
                                                    .catch((err) => console.error("Error generating style caption:", err))
                                                    .finally(() => setIsGeneratingCaption(null));
                                                }
                                              }}
                                              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                                                isSelected
                                                  ? "bg-amber-500/10 border-amber-500/40 text-amber-400"
                                                  : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
                                              }`}
                                            >
                                              {isGeneratingThisStyle && <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-ping" />}
                                              {style} {cap ? "" : "+"}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  ) : (
                                    <p className="text-slate-500 italic text-xs">Loading AI Copywriting variations...</p>
                                  )}
                                </div>
                              </div>

                              <div className="space-y-2.5">
                                <div className="flex items-center justify-between">
                                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-display">Campaign Hashtags</h4>
                                  <span className="text-[9px] text-slate-500 font-mono">Space separated</span>
                                </div>

                                <textarea
                                  disabled={!permissions.canEdit}
                                  value={currentHashtags && currentHashtags.length > 0 ? currentHashtags.join(" ") : ""}
                                  onChange={(e) => {
                                    const tags = e.target.value.split(/\s+/).filter((t) => t.length > 0);
                                    const formatted = tags.map((t) => (t.startsWith("#") ? t : `#${t}`));
                                    setCurrentHashtags(formatted);
                                  }}
                                  placeholder="Type or click templates below to add hashtags e.g., #Coffee #Drinks"
                                  rows={2}
                                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                                />

                                <div className="border border-slate-800/60 bg-slate-900/40 p-2.5 rounded-xl space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-wider">
                                      Hashtags Template Library (Click to Select)
                                    </span>
                                  </div>

                                  {templates.filter((t) => t.type === "hashtag").length > 0 ? (
                                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                                      {templates
                                        .filter((t) => t.type === "hashtag")
                                        .map((temp) => (
                                          <button
                                            key={temp.id}
                                            type="button"
                                            disabled={!permissions.canEdit}
                                            onClick={() => {
                                              const rawTags = temp.content.split(/\s+/).filter((t) => t.length > 0);
                                              const formattedTags = rawTags.map((t) => (t.startsWith("#") ? t : `#${t}`));
                                              setCurrentHashtags((prev) => {
                                                const merged = [...prev];
                                                formattedTags.forEach((tag) => {
                                                  if (!merged.includes(tag)) merged.push(tag);
                                                });
                                                return merged;
                                              });
                                            }}
                                            className="px-2.5 py-1 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg text-[10px] font-bold text-slate-300 hover:text-indigo-300 cursor-pointer flex items-center gap-1.5 transition-all"
                                          >
                                            <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                                            <span>{temp.title}</span>
                                          </button>
                                        ))}
                                    </div>
                                  ) : (
                                    <p className="text-[10px] text-slate-500 italic">No hashtag templates available.</p>
                                  )}
                                </div>
                              </div>

                              {/* Publish & Schedule Center */}
                              {(permissions.canPublish || permissions.canEdit) && (
                                <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-4">
                                  <div className="flex items-center justify-between">
                                    <h4 className="text-[10px] font-bold text-slate-300 uppercase tracking-wider font-display flex items-center gap-1.5">
                                      <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                                      Publish & Schedule Center
                                    </h4>
                                    <span className="text-[9px] font-extrabold uppercase text-slate-400">{prod.status}</span>
                                  </div>

                                  <div className="space-y-1.5">
                                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Select Social Platform</label>
                                    <div className="grid grid-cols-3 gap-1.5">
                                      {(["Both", "Facebook", "Instagram"] as const).map((plat) => (
                                        <button
                                          key={plat}
                                          type="button"
                                          onClick={() => setTargetPlatform(plat)}
                                          className={`py-1.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                                            targetPlatform === plat
                                              ? "bg-indigo-600 border-indigo-500 text-white shadow-md"
                                              : "bg-slate-900 border-slate-800/80 text-slate-400 hover:text-white"
                                          }`}
                                        >
                                          {plat === "Both" ? "Both (FB & IG)" : plat}
                                        </button>
                                      ))}
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                                    {permissions.canPublish && (
                                      <div className="bg-slate-900/40 p-3 rounded-lg border border-slate-800/60 flex flex-col justify-between space-y-2">
                                        <div>
                                          <h5 className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wide">Option A: Instant Post</h5>
                                          <p className="text-[10px] text-slate-500 mt-0.5 leading-normal">
                                            Publish this creative directly to your live feeds immediately.
                                          </p>
                                        </div>
                                        <button
                                          type="button"
                                          disabled={isPublishingNow}
                                          onClick={async () => {
                                            setIsPublishingNow(true);
                                            const activeCap =
                                              currentCaptions.find((c) => c.type === selectedCaptionType)?.content ||
                                              "Checkout this convenience item!";
                                            try {
                                              await onPublishNow({
                                                productId: prod.id,
                                                platform: targetPlatform,
                                                caption: activeCap,
                                                hashtags: currentHashtags,
                                                imageUrl: prod.imageUrl,
                                              });
                                              onTriggerRefresh?.();
                                            } finally {
                                              setIsPublishingNow(false);
                                            }
                                          }}
                                          className="w-full py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white font-black text-xs rounded-xl cursor-pointer transition-all flex items-center justify-center gap-1.5"
                                        >
                                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                                          {isPublishingNow ? "Publishing..." : "Post Now"}
                                        </button>
                                      </div>
                                    )}

                                    {permissions.canEdit && (
                                      <div className="bg-slate-900/40 p-3 rounded-lg border border-slate-800/60 space-y-2">
                                        <h5 className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wide">Option B: Schedule Queue</h5>

                                        <div className="grid grid-cols-2 gap-1.5">
                                          <div>
                                            <label className="block text-[8px] font-bold text-slate-500 uppercase tracking-wider mb-1">Date</label>
                                            <input
                                              type="date"
                                              value={customScheduleDate}
                                              onChange={(e) => setCustomScheduleDate(e.target.value)}
                                              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-slate-200 focus:outline-none text-[10px] font-medium"
                                            />
                                          </div>
                                          <div>
                                            <label className="block text-[8px] font-bold text-slate-500 uppercase tracking-wider mb-1">Time</label>
                                            <input
                                              type="time"
                                              value={customScheduleTime}
                                              onChange={(e) => setCustomScheduleTime(e.target.value)}
                                              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-slate-200 focus:outline-none text-[10px] font-medium"
                                            />
                                          </div>
                                        </div>

                                        <button
                                          type="button"
                                          disabled={isSchedulingPost}
                                          onClick={async () => {
                                            if (!customScheduleDate) return;
                                            setIsSchedulingPost(true);
                                            try {
                                              await onSchedulePost({
                                                productId: prod.id,
                                                date: customScheduleDate,
                                                time: customScheduleTime,
                                                platform: targetPlatform,
                                              });
                                              onTriggerRefresh?.();
                                            } finally {
                                              setIsSchedulingPost(false);
                                            }
                                          }}
                                          className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black text-xs rounded-xl cursor-pointer transition-all flex items-center justify-center gap-1.5"
                                        >
                                          <Clock className="w-3.5 h-3.5" />
                                          {isSchedulingPost ? "Scheduling..." : "Post Schedule"}
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}

                              <div className="flex gap-2 justify-between items-center pt-2 border-t border-slate-800/60">
                                <div className="flex gap-2">
                                  {(["Facebook", "Instagram"] as const).map((plat) => (
                                    <button
                                      key={plat}
                                      onClick={() => {
                                        const activeCap =
                                          currentCaptions.find((c) => c.type === selectedCaptionType)?.content ||
                                          "Checkout this convenience item!";
                                        setPreviewPostModal({
                                          isOpen: true,
                                          platform: plat,
                                          caption: activeCap,
                                          hashtags: currentHashtags,
                                          imageUrl: prod.imageUrl,
                                        });
                                      }}
                                      className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-lg text-[10px] font-bold cursor-pointer flex items-center gap-1 transition-all"
                                    >
                                      Preview {plat}
                                    </button>
                                  ))}
                                </div>

                                {permissions.canDelete &&
                                  (deletingProductId === prod.id ? (
                                    <div className="flex items-center gap-2 animate-fade-in">
                                      <span className="text-[10px] text-rose-500 font-bold">Are you sure?</span>
                                      <button
                                        onClick={() => {
                                          onDeleteProduct(prod.id);
                                          setDeletingProductId(null);
                                        }}
                                        className="text-[10px] bg-rose-600 hover:bg-rose-500 text-white font-bold px-2 py-1 rounded-md transition-colors cursor-pointer"
                                      >
                                        Yes, Delete
                                      </button>
                                      <button
                                        onClick={() => setDeletingProductId(null)}
                                        className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-2 py-1 rounded-md transition-colors cursor-pointer"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => setDeletingProductId(prod.id)}
                                      className="text-xs text-rose-500 hover:text-rose-400 font-bold flex items-center gap-1 cursor-pointer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                      Delete Card
                                    </button>
                                  ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Social Device Mockup Overlay Modal */}
      {previewPostModal &&
        createPortal(
          <div id="social_device_preview_modal" className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-800 animate-scale-up">
              <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Live Post Simulation Screen</span>
                <button
                  onClick={() => setPreviewPostModal(null)}
                  className="text-slate-400 hover:text-slate-200 font-bold text-lg cursor-pointer leading-none"
                >
                  ×
                </button>
              </div>

              <div className="p-4 bg-slate-950 max-h-[500px] overflow-y-auto">
                {previewPostModal.platform === "Facebook" ? (
                  <div id="fb_sim_frame" className="bg-slate-900 rounded-2xl shadow-sm border border-slate-800 overflow-hidden text-slate-200">
                    <div className="p-3 flex items-center gap-2">
                      <div className="w-10 h-10 bg-indigo-500/10 rounded-full flex items-center justify-center text-indigo-400 font-extrabold text-sm border border-indigo-500/20">
                        {storeInitials}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold leading-tight text-white">{displayStoreName}</h4>
                        <p className="text-[10px] text-slate-400 font-medium">Sponsored • Published via StoreSocial AI</p>
                      </div>
                    </div>

                    <div className="px-3 pb-3 text-xs leading-relaxed whitespace-pre-wrap text-slate-300">
                      {previewPostModal.caption}
                      <div className="text-indigo-400 mt-2 font-semibold">{previewPostModal.hashtags.join(" ")}</div>
                    </div>

                    <div className="aspect-video bg-slate-950 border-y border-slate-800 relative flex items-center justify-center">
                      {isVideoMedia(previewPostModal.imageUrl) ? (
                        <video src={previewPostModal.imageUrl} controls className="w-full h-full object-cover" />
                      ) : (
                        <img src={previewPostModal.imageUrl} referrerPolicy="no-referrer" alt="Preview" className="w-full h-full object-cover" />
                      )}
                    </div>
                  </div>
                ) : (
                  <div id="ig_sim_frame" className="bg-slate-900 rounded-2xl shadow-sm border border-slate-800 overflow-hidden text-slate-200">
                    <div className="p-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-gradient-to-tr from-yellow-500 to-purple-600 rounded-full p-0.5">
                          <div className="w-full h-full bg-slate-950 rounded-full flex items-center justify-center text-indigo-400 font-black text-xs">
                            {storeInitials}
                          </div>
                        </div>
                        <h4 className="text-xs font-bold leading-tight text-white">{displayHandle}</h4>
                      </div>
                      <span className="text-xs font-bold text-slate-500">•••</span>
                    </div>

                    <div className="aspect-square bg-slate-950 border-y border-slate-800 flex items-center justify-center">
                      {isVideoMedia(previewPostModal.imageUrl) ? (
                        <video src={previewPostModal.imageUrl} controls className="w-full h-full object-cover" />
                      ) : (
                        <img src={previewPostModal.imageUrl} referrerPolicy="no-referrer" alt="Preview" className="w-full h-full object-cover" />
                      )}
                    </div>

                    <div className="px-3 py-3 text-xs leading-relaxed text-slate-300">
                      <span className="font-bold mr-1 text-white">{displayHandle}</span>
                      <span className="whitespace-pre-wrap">{previewPostModal.caption}</span>
                      <div className="text-indigo-400 font-semibold mt-2">{previewPostModal.hashtags.join(" ")}</div>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-slate-800 bg-slate-950 flex justify-end">
                <button
                  onClick={() => setPreviewPostModal(null)}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  Looks Great
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Asset Selection Modal */}
      {isAssetModalOpen &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-4xl w-full max-h-[85vh] overflow-hidden flex flex-col shadow-2xl">
              <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900">
                <div>
                  <h3 className="text-md font-bold text-white flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-indigo-400" />
                    Select from Media Assets Vault
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">Choose an asset from your vault to queue for posting</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsAssetModalOpen(false);
                    setSelectedVaultFolderId(null);
                  }}
                  className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto flex-1 bg-slate-950/40">
                {vaultLoading ? (
                  <div className="flex flex-col items-center justify-center py-20">
                    <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-xs text-slate-400 mt-3 font-semibold">Loading media vault assets...</p>
                  </div>
                ) : selectedVaultFolderId === null ? (
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Select Folder</h4>
                    {vaultFolders.length === 0 ? (
                      <div className="text-center py-12 border border-dashed border-slate-800 rounded-2xl bg-slate-900/40">
                        <Folder className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                        <p className="text-xs text-slate-400">No folders inside the Media Vault.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {vaultFolders.map((folder) => {
                          const count = vaultAssets.filter((a) => a.folderId === folder.id).length;
                          return (
                            <div
                              key={folder.id}
                              onClick={() => setSelectedVaultFolderId(folder.id)}
                              className="bg-slate-900 border border-slate-800 rounded-2xl p-4 hover:border-indigo-500/50 transition cursor-pointer flex flex-col justify-between group"
                            >
                              <div className="flex items-start gap-3">
                                <div className="p-2.5 bg-indigo-500/10 rounded-xl text-indigo-400 shrink-0">
                                  <Folder className="w-5 h-5" />
                                </div>
                                <div className="min-w-0">
                                  <h4 className="font-bold text-sm text-slate-200 truncate">{folder.name}</h4>
                                  <p className="text-xs text-slate-400 line-clamp-2 mt-1 italic leading-relaxed">
                                    {folder.description || "No context description."}
                                  </p>
                                </div>
                              </div>
                              <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-[11px]">
                                <span className="text-slate-500 font-semibold">
                                  {count} {count === 1 ? "asset" : "assets"}
                                </span>
                                <span className="text-indigo-400 font-bold">Browse</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <button
                        type="button"
                        onClick={() => setSelectedVaultFolderId(null)}
                        className="inline-flex items-center text-xs font-semibold text-slate-400 hover:text-white transition gap-1.5 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl cursor-pointer"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        Back to Folders
                      </button>
                      <span className="text-slate-500">/</span>
                      <span className="text-xs font-bold text-indigo-400 px-2 py-0.5 bg-indigo-500/10 rounded-lg border border-indigo-500/10">
                        {vaultFolders.find((f) => f.id === selectedVaultFolderId)?.name}
                      </span>
                    </div>

                    {(() => {
                      const folderAssets = vaultAssets.filter((a) => a.folderId === selectedVaultFolderId);
                      if (folderAssets.length === 0) {
                        return (
                          <div className="text-center py-12 border border-dashed border-slate-800 rounded-2xl bg-slate-900/40">
                            <ImageIcon className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                            <p className="text-xs text-slate-400">This folder has no assets.</p>
                          </div>
                        );
                      }
                      return (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                          {folderAssets.map((asset) => (
                            <div
                              key={asset.id}
                              onClick={() => {
                                setIsAssetModalOpen(false);
                                setSelectedVaultFolderId(null);
                                if (postingMode === "manual") {
                                  setManualSelectedImageUrl(asset.imageUrl);
                                  setManualMediaType(asset.mediaType || "image");
                                } else {
                                  setStagedAssets((prev) => [
                                    ...prev,
                                    {
                                      id: Math.random().toString(36).substr(2, 9) + "_" + Date.now(),
                                      imageUrl: asset.imageUrl,
                                      mediaType: asset.mediaType || "image",
                                      scheduledDate: autoPostDate || new Date().toISOString().split("T")[0],
                                      scheduledTime: autoPostTime || "12:00",
                                      platform: autoPlatform || "Both",
                                      extraNotes: autoExtraNotes || "",
                                    },
                                  ]);
                                }
                              }}
                              className="group bg-slate-900 border border-slate-800/80 rounded-2xl overflow-hidden hover:border-indigo-500 hover:shadow-lg transition flex flex-col cursor-pointer"
                            >
                              <div className="relative aspect-square bg-slate-950 flex items-center justify-center border-b border-slate-800/60 overflow-hidden">
                                {asset.mediaType === "video" ? (
                                  <div className="w-full h-full relative flex items-center justify-center">
                                    {asset.imageUrl.startsWith("data:") ? (
                                      <video src={asset.imageUrl} className="w-full h-full object-cover" muted playsInline />
                                    ) : (
                                      <VideoIcon className="w-8 h-8 text-white opacity-40" />
                                    )}
                                  </div>
                                ) : (
                                  <img
                                    src={asset.imageUrl}
                                    alt={asset.name}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                    referrerPolicy="no-referrer"
                                  />
                                )}
                              </div>
                              <div className="p-3">
                                <h5 className="font-bold text-xs text-slate-200 truncate" title={asset.name}>
                                  {asset.name}
                                </h5>
                                <p className="text-[10px] text-slate-400 truncate italic mt-1">
                                  {asset.description || "No description provided."}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-slate-800 bg-slate-900 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setIsAssetModalOpen(false);
                    setSelectedVaultFolderId(null);
                  }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold cursor-pointer transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
