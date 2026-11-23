import React, { useState, useEffect, useRef } from "react";
import {
  FolderPlus,
  Folder as FolderIcon,
  Trash2,
  Edit3,
  ChevronRight,
  Move,
  Upload,
  Sparkles,
  Image as ImageIcon,
  Video as VideoIcon,
  AlertCircle,
  ArrowLeft,
  X,
  Info,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Asset, Folder, ModulePermissions } from "../types";
import { StoreSocialApiClient } from "../services/storeSocialApi";

interface AssetsViewProps {
  api: StoreSocialApiClient;
  permissions: ModulePermissions;
  onImportToStudio?: (asset: Asset) => void;
  onNotify?: (message: string, type?: "success" | "error" | "info") => void;
}

export default function AssetsView({ api, permissions, onImportToStudio, onNotify }: AssetsViewProps) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [folderModalMode, setFolderModalMode] = useState<"create" | "edit">("create");
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [folderName, setFolderName] = useState("");
  const [folderDescription, setFolderDescription] = useState("");

  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [assetName, setAssetName] = useState("");
  const [assetDescription, setAssetDescription] = useState("");
  const [assetFolderId, setAssetFolderId] = useState("");

  const [confirmDeleteFolderId, setConfirmDeleteFolderId] = useState<string | null>(null);
  const [confirmDeleteAssetId, setConfirmDeleteAssetId] = useState<string | null>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [foldersData, assetsData] = await Promise.all([api.getFolders(), api.getAssets()]);
      setFolders(foldersData);
      setAssets(assetsData);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Something went wrong while fetching folders and assets");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [api]);

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderName.trim() || !permissions.canManageAssets) return;

    try {
      const data = await api.createFolder({ name: folderName, description: folderDescription });
      setFolders((prev) => [data.folder, ...prev]);
      setIsFolderModalOpen(false);
      resetFolderForm();
      onNotify?.("Folder created successfully.", "success");
    } catch (err: any) {
      onNotify?.(err.message || "Could not create folder", "error");
    }
  };

  const handleUpdateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFolderId || !folderName.trim() || !permissions.canManageAssets) return;

    try {
      await api.updateFolder(editingFolderId, { name: folderName, description: folderDescription });
      setFolders((prev) =>
        prev.map((f) => (f.id === editingFolderId ? { ...f, name: folderName, description: folderDescription } : f))
      );
      setIsFolderModalOpen(false);
      resetFolderForm();
      onNotify?.("Folder updated successfully.", "success");
    } catch (err: any) {
      onNotify?.(err.message || "Could not update folder", "error");
    }
  };

  const handleDeleteFolder = async (id: string) => {
    if (!permissions.canDelete) return;
    try {
      await api.deleteFolder(id);
      setFolders((prev) => prev.filter((f) => f.id !== id));
      setAssets((prev) => prev.filter((a) => a.folderId !== id));
      if (selectedFolderId === id) {
        setSelectedFolderId(null);
      }
      setConfirmDeleteFolderId(null);
      onNotify?.("Folder and contained assets deleted.", "info");
    } catch (err: any) {
      onNotify?.(err.message || "Could not delete folder", "error");
    }
  };

  const openEditFolderModal = (folder: Folder) => {
    setFolderModalMode("edit");
    setEditingFolderId(folder.id);
    setFolderName(folder.name);
    setFolderDescription(folder.description);
    setIsFolderModalOpen(true);
  };

  const resetFolderForm = () => {
    setFolderName("");
    setFolderDescription("");
    setEditingFolderId(null);
    setFolderModalMode("create");
  };

  const handleUpdateAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAsset || !permissions.canManageAssets) return;

    try {
      await api.updateAsset(editingAsset.id, {
        name: assetName,
        folderId: assetFolderId,
        description: assetDescription,
      });

      setAssets((prev) =>
        prev.map((a) =>
          a.id === editingAsset.id ? { ...a, name: assetName, folderId: assetFolderId, description: assetDescription } : a
        )
      );
      setEditingAsset(null);
      onNotify?.("Asset updated successfully.", "success");
    } catch (err: any) {
      onNotify?.(err.message || "Could not update asset", "error");
    }
  };

  const handleDeleteAsset = async (id: string) => {
    if (!permissions.canDelete) return;
    try {
      await api.deleteAsset(id);
      setAssets((prev) => prev.filter((a) => a.id !== id));
      setConfirmDeleteAssetId(null);
      onNotify?.("Asset deleted.", "info");
    } catch (err: any) {
      onNotify?.(err.message || "Could not delete asset", "error");
    }
  };

  const openEditAssetModal = (asset: Asset) => {
    setEditingAsset(asset);
    setAssetName(asset.name);
    setAssetDescription(asset.description);
    setAssetFolderId(asset.folderId);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (!permissions.canManageAssets) return;
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFilesUpload(e.dataTransfer.files);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!permissions.canManageAssets) return;
    if (e.target.files && e.target.files[0]) {
      handleFilesUpload(e.target.files);
    }
  };

  const handleFilesUpload = async (fileList: FileList) => {
    if (!selectedFolderId || !permissions.canManageAssets) return;
    setIsUploading(true);
    setUploadError(null);

    try {
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = (err) => reject(err);
        });
        reader.readAsDataURL(file);

        const base64Data = await base64Promise;
        const detectedMediaType = file.type.startsWith("video") ? "video" : "image";
        const displayName = file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");

        const data = await api.createAsset({
          folderId: selectedFolderId,
          name: displayName,
          imageUrl: base64Data,
          mediaType: detectedMediaType,
          description: `Uploaded file asset named ${displayName}`,
        });

        setAssets((prev) => [data.asset, ...prev]);
      }
      onNotify?.("Asset files uploaded to vault.", "success");
    } catch (err: any) {
      setUploadError(err.message || "Failed to upload one or more files");
    } finally {
      setIsUploading(false);
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const currentFolder = folders.find((f) => f.id === selectedFolderId);
  const currentFolderAssets = assets.filter((a) => a.folderId === selectedFolderId);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6" id="assets-view-root">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4 border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2 font-display">
            <FolderIcon className="w-7 h-7 text-indigo-400" />
            Media Assets Vault
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Store and organize permanent and temporary promotional assets. Folders supply AI marketing generators with product context.
          </p>
        </div>

        {!selectedFolderId && permissions.canManageAssets && (
          <button
            id="btn-create-folder"
            onClick={() => {
              resetFolderForm();
              setFolderModalMode("create");
              setIsFolderModalOpen(true);
            }}
            className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-600 cursor-pointer"
          >
            <FolderPlus className="w-4 h-4 mr-2" />
            New Folder
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-xl bg-rose-500/10 p-4 mb-6 border border-rose-500/20 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-rose-300">Connection Error</h3>
            <p className="text-sm text-rose-200/80 mt-1">{error}</p>
            <button onClick={fetchData} className="mt-2 text-xs font-semibold text-rose-300 underline hover:text-rose-200 cursor-pointer">
              Retry Connection
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
          <p className="text-sm text-slate-400 mt-4 font-medium animate-pulse">Loading Asset Vault...</p>
        </div>
      ) : (
        <>
          {!selectedFolderId ? (
            <div>
              {folders.length === 0 ? (
                <div className="text-center py-16 bg-slate-900/50 rounded-2xl border border-dashed border-slate-800 px-4">
                  <FolderPlus className="w-12 h-12 text-slate-500 mx-auto mb-3" />
                  <h3 className="text-base font-semibold text-slate-200">No Asset Folders Created</h3>
                  <p className="text-sm text-slate-400 mt-1 max-w-md mx-auto">
                    Create your first folder to hold permanent design materials, product photography, or promotional clips.
                  </p>
                  {permissions.canManageAssets && (
                    <button
                      onClick={() => {
                        resetFolderForm();
                        setFolderModalMode("create");
                        setIsFolderModalOpen(true);
                      }}
                      className="mt-4 inline-flex items-center px-4 py-2 rounded-lg text-xs font-semibold text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 transition cursor-pointer"
                    >
                      Create Your First Folder
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {folders.map((folder) => {
                    const count = assets.filter((a) => a.folderId === folder.id).length;
                    return (
                      <motion.div
                        key={folder.id}
                        layoutId={`folder-card-${folder.id}`}
                        className="bg-slate-900 rounded-2xl border border-slate-800 shadow-sm hover:border-slate-700 transition-all flex flex-col h-full overflow-hidden"
                      >
                        <div className="h-1.5 bg-indigo-600 w-full" />

                        <div className="p-5 flex-1 flex flex-col justify-between">
                          <div>
                            <div className="flex items-start justify-between gap-2">
                              <div
                                className="flex items-center gap-2 text-indigo-400 cursor-pointer hover:text-indigo-300"
                                onClick={() => setSelectedFolderId(folder.id)}
                              >
                                <FolderIcon className="w-9 h-9 fill-indigo-500/10 text-indigo-400 shrink-0" />
                                <span className="font-semibold text-base text-white hover:underline line-clamp-1">{folder.name}</span>
                              </div>

                              <div className="flex gap-1.5">
                                {permissions.canManageAssets && (
                                  <button
                                    title="Edit Folder Name & Description"
                                    onClick={() => openEditFolderModal(folder)}
                                    className="p-1.5 text-slate-400 hover:text-indigo-400 rounded-md hover:bg-slate-800 transition cursor-pointer"
                                  >
                                    <Edit3 className="w-4 h-4" />
                                  </button>
                                )}
                                {permissions.canDelete &&
                                  (confirmDeleteFolderId === folder.id ? (
                                    <div className="flex items-center gap-1">
                                      <button
                                        onClick={() => handleDeleteFolder(folder.id)}
                                        className="px-2 py-1 text-[10px] font-bold bg-rose-600 text-white rounded cursor-pointer"
                                      >
                                        Confirm
                                      </button>
                                      <button
                                        onClick={() => setConfirmDeleteFolderId(null)}
                                        className="px-2 py-1 text-[10px] font-bold bg-slate-800 text-slate-300 rounded cursor-pointer"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      title="Delete Folder"
                                      onClick={() => setConfirmDeleteFolderId(folder.id)}
                                      className="p-1.5 text-slate-400 hover:text-rose-400 rounded-md hover:bg-rose-500/10 transition cursor-pointer"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  ))}
                              </div>
                            </div>

                            <p className="text-xs text-slate-400 mt-3 line-clamp-3 italic min-h-[2.5rem]">
                              {folder.description || "No description provided."}
                            </p>
                          </div>

                          <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between">
                            <span className="text-xs font-medium text-slate-500">
                              {count} {count === 1 ? "asset" : "assets"}
                            </span>

                            <button
                              onClick={() => setSelectedFolderId(folder.id)}
                              className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5 group cursor-pointer"
                            >
                              Open Folder
                              <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-6">
                <button
                  onClick={() => setSelectedFolderId(null)}
                  className="inline-flex items-center text-xs font-semibold text-slate-400 hover:text-white transition gap-1 px-2 py-1 rounded-md hover:bg-slate-800 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back to Folders
                </button>
                <ChevronRight className="w-3 h-3 text-slate-600" />
                <span className="text-xs font-bold text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-md">
                  {currentFolder?.name}
                </span>
              </div>

              <div className="bg-indigo-500/5 rounded-2xl border border-indigo-500/20 p-5 mb-8 flex flex-col md:flex-row gap-4 justify-between items-start">
                <div className="flex gap-3">
                  <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400 shrink-0">
                    <Info className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-white text-sm flex items-center gap-1.5">AI Generation Context Summary</h2>
                    <p className="text-sm text-slate-400 mt-1 max-w-2xl leading-relaxed">
                      {currentFolder?.description ||
                        "This folder has no short description. Add a folder description to help the AI model understand the types of products stored here when generating promotional campaign context."}
                    </p>
                  </div>
                </div>

                {permissions.canManageAssets && (
                  <button
                    onClick={() => currentFolder && openEditFolderModal(currentFolder)}
                    className="text-xs font-semibold text-indigo-300 bg-slate-900 hover:bg-slate-800 border border-indigo-500/20 px-3 py-1.5 rounded-lg transition shadow-sm cursor-pointer whitespace-nowrap"
                  >
                    Edit Context
                  </button>
                )}
              </div>

              {permissions.canManageAssets && (
                <div
                  id="asset-drag-area"
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  className={`relative border-2 border-dashed rounded-2xl p-8 mb-8 text-center transition-all ${
                    dragActive ? "border-indigo-500 bg-indigo-500/10" : "border-slate-700 bg-slate-900/50 hover:bg-slate-900"
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    id="asset-file-input"
                    multiple
                    accept="image/*,video/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />

                  <Upload className="w-10 h-10 text-slate-400 mx-auto mb-2.5" />

                  <h3 className="text-sm font-semibold text-slate-200">
                    Drag and drop files here, or{" "}
                    <button
                      onClick={triggerFileSelect}
                      className="text-indigo-400 hover:text-indigo-300 underline font-semibold cursor-pointer"
                    >
                      browse your device
                    </button>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">Supports PNG, JPG, WEBP, MP4, MOV up to 25MB</p>

                  {isUploading && (
                    <div className="absolute inset-0 bg-slate-950/80 rounded-2xl flex items-center justify-center flex-col">
                      <div className="w-8 h-8 border-3 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
                      <p className="text-xs text-slate-300 font-semibold mt-2 animate-pulse">Uploading asset files...</p>
                    </div>
                  )}
                </div>
              )}

              {uploadError && (
                <div className="rounded-xl bg-rose-500/10 p-3 mb-6 border border-rose-500/20 flex items-center gap-2 text-rose-300 text-xs font-medium">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  {uploadError}
                </div>
              )}

              <h3 className="text-base font-bold text-white mb-4 flex items-center gap-1.5">
                Folder Contents ({currentFolderAssets.length})
              </h3>

              {currentFolderAssets.length === 0 ? (
                <div className="text-center py-16 bg-slate-900/50 rounded-2xl border border-slate-800">
                  <ImageIcon className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <h4 className="text-sm font-semibold text-slate-300">This folder is empty</h4>
                  <p className="text-xs text-slate-500 mt-1">Drag files above to start compiling design assets inside this folder.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                  {currentFolderAssets.map((asset) => (
                    <div
                      key={asset.id}
                      className="group bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-sm hover:border-slate-700 transition flex flex-col h-full"
                    >
                      <div className="relative aspect-square bg-slate-950 flex items-center justify-center border-b border-slate-800 overflow-hidden group">
                        {asset.mediaType === "video" ? (
                          <div className="w-full h-full relative">
                            {asset.imageUrl.startsWith("data:") ? (
                              <video src={asset.imageUrl} className="w-full h-full object-cover" controls={false} muted playsInline />
                            ) : (
                              <div className="w-full h-full bg-slate-950 flex items-center justify-center">
                                <VideoIcon className="w-10 h-10 text-white opacity-40" />
                              </div>
                            )}
                            <span className="absolute top-2 left-2 bg-black/70 text-white text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
                              <VideoIcon className="w-3 h-3" />
                              VIDEO
                            </span>
                          </div>
                        ) : (
                          <div className="w-full h-full">
                            <img
                              src={asset.imageUrl}
                              alt={asset.name}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                            <span className="absolute top-2 left-2 bg-black/70 text-white text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
                              <ImageIcon className="w-3 h-3" />
                              IMAGE
                            </span>
                          </div>
                        )}

                        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {permissions.canManageAssets && (
                            <button
                              title="Edit Asset Details"
                              onClick={() => openEditAssetModal(asset)}
                              className="p-1.5 bg-slate-900/90 hover:bg-slate-800 text-slate-200 rounded-md shadow-sm transition cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {permissions.canDelete &&
                            (confirmDeleteAssetId === asset.id ? (
                              <button
                                onClick={() => handleDeleteAsset(asset.id)}
                                className="px-2 py-1 bg-rose-600 text-white text-[10px] font-bold rounded-md cursor-pointer"
                              >
                                Delete?
                              </button>
                            ) : (
                              <button
                                title="Delete Asset"
                                onClick={() => setConfirmDeleteAssetId(asset.id)}
                                className="p-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-md shadow-sm transition cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            ))}
                        </div>

                        {onImportToStudio && permissions.canUpload && (
                          <div className="absolute inset-x-0 bottom-0 p-2.5 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex justify-center">
                            <button
                              onClick={() => onImportToStudio(asset)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition shadow cursor-pointer"
                            >
                              <Sparkles className="w-3 h-3" />
                              Use in Campaign
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="p-3.5 flex-1 flex flex-col justify-between">
                        <div>
                          <h4 className="font-semibold text-sm text-white truncate" title={asset.name}>
                            {asset.name}
                          </h4>
                          <p className="text-xs text-slate-400 mt-1 line-clamp-2 italic" title={asset.description}>
                            {asset.description || "No asset prompt description."}
                          </p>
                        </div>

                        <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-500 font-medium">
                          <span>Added {new Date(asset.createdAt).toLocaleDateString()}</span>
                          {permissions.canManageAssets && (
                            <button
                              onClick={() => openEditAssetModal(asset)}
                              className="text-indigo-400 hover:underline cursor-pointer font-bold flex items-center gap-0.5"
                            >
                              <Move className="w-2.5 h-2.5" />
                              Manage
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* FOLDER MODAL */}
      <AnimatePresence>
        {isFolderModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-800"
            >
              <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
                <h3 className="text-lg font-bold text-white">
                  {folderModalMode === "create" ? "Create New Folder" : "Edit Folder Context"}
                </h3>
                <button
                  onClick={() => setIsFolderModalOpen(false)}
                  className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={folderModalMode === "create" ? handleCreateFolder : handleUpdateFolder}>
                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Folder Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Christmas Beverage Photos"
                      value={folderName}
                      onChange={(e) => setFolderName(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                      AI Description / Prompt Context
                    </label>
                    <textarea
                      rows={4}
                      placeholder="Describe the products or visual themes stored in this folder..."
                      value={folderDescription}
                      onChange={(e) => setFolderDescription(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600 text-sm"
                    />
                  </div>
                </div>

                <div className="px-6 py-3.5 bg-slate-950 border-t border-slate-800 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsFolderModalOpen(false)}
                    className="px-4 py-2 text-sm font-semibold text-slate-300 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow transition cursor-pointer"
                  >
                    {folderModalMode === "create" ? "Create Folder" : "Save Changes"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ASSET EDIT MODAL */}
      <AnimatePresence>
        {editingAsset && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-800"
            >
              <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
                <h3 className="text-lg font-bold text-white">Manage Asset Details</h3>
                <button
                  onClick={() => setEditingAsset(null)}
                  className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleUpdateAsset}>
                <div className="p-6 space-y-4">
                  <div className="flex items-center gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800">
                    <div className="w-16 h-16 rounded-lg bg-slate-900 overflow-hidden shrink-0 flex items-center justify-center">
                      {editingAsset.mediaType === "video" ? (
                        <VideoIcon className="w-6 h-6 text-slate-400" />
                      ) : (
                        <img src={editingAsset.imageUrl} alt="preview" className="w-full h-full object-cover" />
                      )}
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm text-white line-clamp-1">{editingAsset.name}</h4>
                      <p className="text-xs text-slate-400 uppercase mt-0.5 font-bold tracking-wider">{editingAsset.mediaType}</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Asset Display Name</label>
                    <input
                      type="text"
                      required
                      value={assetName}
                      onChange={(e) => setAssetName(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Folder (Move Asset)</label>
                    <select
                      value={assetFolderId}
                      onChange={(e) => setAssetFolderId(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600 text-sm"
                    >
                      {folders.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Asset Prompt / Short Description
                    </label>
                    <textarea
                      rows={3}
                      placeholder="e.g. Glossy close-up of energy drink can with splash effects."
                      value={assetDescription}
                      onChange={(e) => setAssetDescription(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600 text-sm"
                    />
                  </div>
                </div>

                <div className="px-6 py-3.5 bg-slate-950 border-t border-slate-800 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingAsset(null)}
                    className="px-4 py-2 text-sm font-semibold text-slate-300 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg transition cursor-pointer"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow transition cursor-pointer"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
