import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/use-auth";
import { useFarmSettings, useSaveFarmSettings } from "@/hooks/use-farm-settings";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LogOut, User, Download, Upload, Building2, Save, Loader2, Image, X, FileText, FileSpreadsheet, Folder, Trash2, AlertCircle, CheckCircle, AlertTriangle, RotateCcw, ShieldCheck, RefreshCw, CloudOff, Database, Sun, Moon, Monitor } from "lucide-react";
import { Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertFarmSettingsSchema, type InsertFarmSettings } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useEffect, useState, useRef } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAnimals } from "@/hooks/use-animals";
import { useBreedingEvents } from "@/hooks/use-breeding";
import { useMatingGroups } from "@/hooks/use-mating-groups";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { clearAllOfflineData, setOnboardingCompleted, getPendingSyncItems, getAllFromStore, type SyncQueueItem } from "@/lib/indexeddb";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { useTheme, type ThemeMode } from "@/components/ThemeProvider";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { performLogout } from "@/lib/queryClient";
import { buildBreedLogCsvContent, buildBreedLogCsvRows, BREEDLOG_CSV_HEADERS } from "@shared/import-export";
import { BREEDLOG_PLANS } from "@shared/commercial";
import { FIELD_TEST_BUILD_DATE, FIELD_TEST_VERSION_LABEL } from "@shared/version";

type EntitlementResponse = {
  entitlement: {
    planId: "free" | "premium";
    status: "active" | "grace_period" | "cancelled" | "payment_failed" | "refunded" | "expired";
    pricingVersion: string;
    effectiveAt: string;
    updatedAt: string;
  };
  downgradeProjection: {
    visibleAnimalIds: number[];
    hiddenAnimalIds: number[];
    rule: string;
  };
};

type AccountDeletionState = {
  accountId: string;
  status: "none" | "pending" | "cancelled" | "completed";
  requestedAt?: string;
  recoveryUntil?: string;
  cancelledAt?: string;
  completedAt?: string;
  exportBeforeDeletion: boolean;
  auditId?: string;
};

type BackupPreview = {
  exportedAt: string;
  animalCount: number;
  breedingEventCount: number;
  healthRecordCount: number;
  performanceRecordCount: number;
  documentCount: number;
  exportedDocumentCount: number;
};

type ManualBackupResponse = {
  fileName: string;
  backup: unknown;
};

export default function Settings() {
  const { user } = useAuth();
  const { data: farmSettings, isLoading } = useFarmSettings();
  const { data: animals } = useAnimals();
  const { data: breedingEvents } = useBreedingEvents();
  const { data: matingGroups } = useMatingGroups();
  const { toast } = useToast();
  const displayName = farmSettings?.studName || farmSettings?.farmName;
  const saveMutation = useSaveFarmSettings();
  
  // Appearance / theme
  const { theme, setTheme } = useTheme();

  // Data & Sync controls
  const { syncState, performFullSync, reloadLocalData, isSyncing, purgeFailedSyncs } = useNetworkStatus();
  const [isSyncingNow, setIsSyncingNow] = useState(false);
  const [isReloadingView, setIsReloadingView] = useState(false);
  const [isPurgingSyncs, setIsPurgingSyncs] = useState(false);

  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<{ imported: number; created?: number; skipped?: number; duplicate?: number; failed?: number; errors: string[]; validationErrors?: string[] } | null>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [resetConfirmPhrase, setResetConfirmPhrase] = useState("");
  const [isResetting, setIsResetting] = useState(false);
  const [showClearCacheDialog, setShowClearCacheDialog] = useState(false);
  const [clearCacheConfirmText, setClearCacheConfirmText] = useState("");
  const [isClearingCache, setIsClearingCache] = useState(false);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [backupPassphrase, setBackupPassphrase] = useState("");
  const [restorePassphrase, setRestorePassphrase] = useState("");
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restorePreview, setRestorePreview] = useState<BackupPreview | null>(null);
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [confirmRestoreOverwrite, setConfirmRestoreOverwrite] = useState(false);
  const [showDeleteAccountDialog, setShowDeleteAccountDialog] = useState(false);
  const [deleteConfirmPhrase, setDeleteConfirmPhrase] = useState("");
  const [deleteExportBackup, setDeleteExportBackup] = useState(true);
  const [deleteBackupPassphrase, setDeleteBackupPassphrase] = useState("");
  
  // Debug sync state
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const [debugPendingItems, setDebugPendingItems] = useState<SyncQueueItem[]>([]);
  const [isLoadingDebug, setIsLoadingDebug] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [dataOpen, setDataOpen] = useState(false);
  const backupRestoreInputRef = useRef<HTMLInputElement>(null);
  
  // Fetch pending sync items for debugging
  const handleShowDebug = async () => {
    if (showDebugInfo) {
      setShowDebugInfo(false);
      return;
    }
    
    setIsLoadingDebug(true);
    try {
      const items = await getPendingSyncItems();
      setDebugPendingItems(items);
      setShowDebugInfo(true);
    } catch (error) {
      toast({
        title: "Debug Error",
        description: "Could not load pending sync items",
        variant: "destructive",
      });
    } finally {
      setIsLoadingDebug(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    const refreshPendingCount = async () => {
      try {
        const pending = await getPendingSyncItems();
        if (mounted) {
          setPendingSyncCount(pending.length);
        }
      } catch {
        if (mounted) {
          setPendingSyncCount(0);
        }
      }
    };
    void refreshPendingCount();
  }, [syncState]);
  
  // Handle Purge Failed Syncs button
  const handlePurgeFailedSyncs = async () => {
    if (isPurgingSyncs) return;
    
    setIsPurgingSyncs(true);
    try {
      const purgedCount = await purgeFailedSyncs();
      
      // Refresh debug info if shown
      if (showDebugInfo) {
        const items = await getPendingSyncItems();
        setDebugPendingItems(items);
      }
      
      toast({
        title: "Sync Queue Cleaned",
        description: purgedCount > 0 
          ? `Removed ${purgedCount} stuck/orphaned sync items`
          : "No stuck items found - queue is clean",
      });
    } catch (error) {
      toast({
        title: "Purge Failed",
        description: "Could not clean sync queue",
        variant: "destructive",
      });
    } finally {
      setIsPurgingSyncs(false);
    }
  };
  
  // Handle Sync Now button
  const handleSyncNow = async () => {
    if (isSyncingNow || isSyncing()) return;
    
    setIsSyncingNow(true);
    try {
      const result = await performFullSync();
      
      switch (result) {
        case 'SYNC_COMPLETE':
          toast({
            title: "Data synced",
            description: "All data synchronized successfully",
          });
          break;
        case 'OFFLINE_MODE':
          toast({
            title: "Backend unreachable",
            description: "Reloaded local data. Changes saved to device.",
          });
          break;
        case 'SYNC_PARTIAL_ERROR':
          toast({
            title: "Sync complete with warnings",
            description: "Some items failed to sync",
            variant: "destructive",
          });
          break;
      }
    } catch (error) {
      toast({
        title: "Sync failed",
        description: "Unable to sync data",
        variant: "destructive",
      });
    } finally {
      setIsSyncingNow(false);
    }
  };
  
  // Handle Reload Data View button
  const handleReloadView = async () => {
    if (isReloadingView) return;
    
    setIsReloadingView(true);
    try {
      if (!(await guardRiskyAction())) {
        return;
      }
      await reloadLocalData();
      toast({
        title: "View refreshed",
        description: "Data reloaded from local storage",
      });
    } catch (error) {
      toast({
        title: "Reload failed",
        description: "Unable to reload data",
        variant: "destructive",
      });
    } finally {
      setIsReloadingView(false);
    }
  };

  const { data: documents, isLoading: docsLoading } = useQuery<any[]>({
    queryKey: ['/api/documents'],
  });

  const { data: entitlementData, isLoading: entitlementLoading } = useQuery<EntitlementResponse>({
    queryKey: ["/api/entitlements/me"],
    enabled: !!user,
  });

  const { data: accountDeletionState } = useQuery<AccountDeletionState>({
    queryKey: ["/api/account/deletion"],
    enabled: !!user,
  });

  const uploadDocMutation = useMutation({
    mutationFn: async (doc: { fileName: string; category: string; fileUrl: string; fileType: string; fileSize?: number }) => {
      return apiRequest('POST', '/api/documents', doc);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      toast({ title: "Document Uploaded", description: "File saved successfully" });
    },
    onError: () => {
      toast({ title: "Upload Failed", description: "Could not save document", variant: "destructive" });
    }
  });

  const deleteDocMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/documents/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      toast({ title: "Document Deleted" });
    }
  });

  const createManualBackupMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/backups/manual", {
        passphrase: backupPassphrase.trim() || undefined,
      });
      return response.json() as Promise<ManualBackupResponse>;
    },
    onSuccess: async ({ fileName, backup }) => {
      await shareOrDownloadFile(JSON.stringify(backup, null, 2), fileName, "application/json", "Encrypted BreedLog backup created.");
    },
    onError: (error: Error) => {
      toast({
        title: "Backup failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const previewRestoreMutation = useMutation({
    mutationFn: async () => {
      if (!restoreFile) {
        throw new Error("Select a .breedlogbackup file first.");
      }
      const backup = JSON.parse(await restoreFile.text());
      const response = await apiRequest("POST", "/api/backups/preview-restore", {
        backup,
        passphrase: restorePassphrase.trim() || undefined,
      });
      return response.json() as Promise<BackupPreview>;
    },
    onSuccess: (preview) => {
      setRestorePreview(preview);
      setShowRestoreDialog(true);
    },
    onError: (error: Error) => {
      setRestorePreview(null);
      toast({
        title: "Restore preview failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const restoreBackupMutation = useMutation({
    mutationFn: async () => {
      if (!restoreFile) {
        throw new Error("Select a .breedlogbackup file first.");
      }
      const backup = JSON.parse(await restoreFile.text());
      const response = await apiRequest("POST", "/api/backups/restore", {
        backup,
        passphrase: restorePassphrase.trim() || undefined,
        confirmOverwrite: true,
      });
      return response.json() as Promise<BackupPreview>;
    },
    onSuccess: async () => {
      setShowRestoreDialog(false);
      setRestorePreview(null);
      setConfirmRestoreOverwrite(false);
      queryClient.invalidateQueries();
      await reloadLocalData();
      toast({
        title: "Restore complete",
        description: "Workspace data was restored from the encrypted backup.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Restore failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const requestAccountDeletionMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/account/deletion", {
        typedConfirmation: deleteConfirmPhrase,
        exportBeforeDeletion: deleteExportBackup,
        passphrase: deleteExportBackup ? deleteBackupPassphrase.trim() || undefined : undefined,
      });
      return response.json() as Promise<{ state: AccountDeletionState; backup: unknown | null }>;
    },
    onSuccess: async ({ state, backup }) => {
      if (backup) {
        await shareOrDownloadFile(
          JSON.stringify(backup, null, 2),
          `breedlog-account-deletion-${state.accountId.slice(0, 8)}.breedlogbackup`,
          "application/json",
          "Encrypted pre-deletion backup created.",
        );
      }
      setShowDeleteAccountDialog(false);
      setDeleteConfirmPhrase("");
      setDeleteBackupPassphrase("");
      queryClient.invalidateQueries({ queryKey: ["/api/account/deletion"] });
      toast({
        title: "Account deletion scheduled",
        description: "The 30-day recovery window has started. You can still cancel before permanent deletion.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Deletion request failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const cancelAccountDeletionMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/account/deletion/cancel", {});
      return response.json() as Promise<AccountDeletionState>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/account/deletion"] });
      toast({
        title: "Deletion cancelled",
        description: "Your account and workspace remain active.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Cancellation failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const importCsvMutation = useMutation({
    mutationFn: async (csvData: string) => {
      const res = await apiRequest('POST', '/api/import/csv', { csvData });
      return res.json();
    },
    onSuccess: (data) => {
      setImportResult(data);
      queryClient.invalidateQueries({ queryKey: ['/api/animals'] });
      const validationErrors = data.validationErrors || data.errors || [];
      if (validationErrors.length === 0) {
        toast({ title: "Import Complete", description: `${data.imported} animals imported successfully` });
      } else {
        toast({ title: "Import Completed with Warnings", description: `${data.imported} imported, ${validationErrors.length} issues`, variant: "destructive" });
      }
    },
    onError: (err: any) => {
      toast({ title: "Import Failed", description: err.message || "Could not import CSV", variant: "destructive" });
    }
  });

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImportFile(file);
      setImportResult(null);
    }
  };

  const processCsvImport = () => {
    if (!importFile) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const csvData = e.target?.result as string;
        importCsvMutation.mutate(csvData);
      } catch (error) {
        toast({ title: "Import Failed", description: "Invalid file format for import.", variant: "destructive" });
      }
    };
    reader.readAsText(importFile);
  };

  const handleProductionReset = async () => {
    if (resetConfirmPhrase !== "RESET BREEDLOG") {
      toast({ 
        title: "Invalid Phrase", 
        description: "Type 'RESET BREEDLOG' exactly to confirm", 
        variant: "destructive" 
      });
      return;
    }
    
    setIsResetting(true);
    try {
      const res = await fetch("/api/admin/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmPhrase: resetConfirmPhrase }),
        credentials: "include"
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Reset failed");
      }
      
      await clearAllOfflineData();
      queryClient.clear();
      
      toast({ 
        title: "Reset Complete", 
        description: "All data has been cleared. The app is now production-ready." 
      });
      
      setShowResetDialog(false);
      setResetConfirmPhrase("");
      
      window.location.reload();
    } catch (err: any) {
      toast({ 
        title: "Reset Failed", 
        description: err.message || "Could not complete reset", 
        variant: "destructive" 
      });
    } finally {
      setIsResetting(false);
    }
  };

  const handleRestartOnboarding = async () => {
    try {
      await setOnboardingCompleted(false);
      toast({ 
        title: "Onboarding Reset", 
        description: "The welcome wizard will show on next refresh." 
      });
      window.location.reload();
    } catch (err) {
      toast({ 
        title: "Error", 
        description: "Could not reset onboarding", 
        variant: "destructive" 
      });
    }
  };

  const handleClearLocalCache = async () => {
    if (clearCacheConfirmText.trim().toUpperCase() !== "CLEAR DEVICE") {
      toast({
        title: "Confirmation required",
        description: "Type CLEAR DEVICE exactly to continue.",
        variant: "destructive",
      });
      return;
    }

    if (pendingSyncCount > 0) {
      toast({
        title: "Sync required before reset",
        description: `You have ${pendingSyncCount} unsynced change(s). Unsynced local records detected. Export a backup or sync successfully before continuing.`,
        variant: "destructive",
      });
      return;
    }

    setIsClearingCache(true);
    try {
      await clearAllOfflineData();
      setShowClearCacheDialog(false);
      setClearCacheConfirmText("");
      toast({
        title: "Local cache cleared",
        description: "Only this device cache was reset. Cloud account data was not deleted.",
      });
      window.location.reload();
    } catch {
      toast({
        title: "Reset failed",
        description: "Could not clear local cache.",
        variant: "destructive",
      });
    } finally {
      setIsClearingCache(false);
    }
  };

  const handleDocUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        uploadDocMutation.mutate({
          fileName: file.name,
          category: 'general',
          fileUrl: reader.result as string,
          fileType: file.type,
          fileSize: file.size
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRestoreFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setRestoreFile(file);
    setRestorePreview(null);
    setConfirmRestoreOverwrite(false);
  };

  const form = useForm<InsertFarmSettings>({
    resolver: zodResolver(insertFarmSettingsSchema),
    defaultValues: {
      farmName: "",
      studName: "",
      studPrefix: "",
      ownerName: "",
      ownerEmail: "",
      ownerPhone: "",
      farmAddress: "",
      farmLocation: "",
      membershipNumber: "",
      registrationNumber: "",
      logoUrl: "",
      logoSize: "medium",
      logoWidth: null,
      logoHeight: null,
    },
  });

  useEffect(() => {
    if (farmSettings) {
      form.reset({
        farmName: farmSettings.farmName || "",
        studName: farmSettings.studName || "",
        studPrefix: farmSettings.studPrefix || "",
        ownerName: farmSettings.ownerName || "",
        ownerEmail: farmSettings.ownerEmail || "",
        ownerPhone: farmSettings.ownerPhone || "",
        farmAddress: farmSettings.farmAddress || "",
        farmLocation: farmSettings.farmLocation || "",
        membershipNumber: farmSettings.membershipNumber || "",
        registrationNumber: farmSettings.registrationNumber || "",
        logoUrl: farmSettings.logoUrl || "",
        logoSize: farmSettings.logoSize || "medium",
        logoWidth: farmSettings.logoWidth,
        logoHeight: farmSettings.logoHeight,
      });
      if (farmSettings.logoUrl) {
        setLogoPreview(farmSettings.logoUrl);
      }
    }
  }, [farmSettings, form]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        toast({ title: "Optimising logo...", description: "Please wait" });
        const { compressImageWithFeedback, formatFileSize } = await import("@/lib/image-compression");
        const result = await compressImageWithFeedback(file, { maxWidth: 300, maxHeight: 300, quality: 0.8 });
        setLogoPreview(result.base64);
        form.setValue("logoUrl", result.base64);
        const reduction = Math.round((1 - result.compressedSize / result.originalSize) * 100);
        toast({ 
          title: "Logo ready", 
          description: `Optimised to ${formatFileSize(result.compressedSize)} (${reduction}% smaller)` 
        });
      } catch (error) {
        console.error("Logo compression failed:", error);
        toast({ title: "Error", description: "Failed to process logo image", variant: "destructive" });
      }
    }
  };

  const removeLogo = () => {
    setLogoPreview(null);
    form.setValue("logoUrl", "");
    if (logoInputRef.current) {
      logoInputRef.current.value = "";
    }
  };

  const logoSize = form.watch("logoSize");
  
  const getLogoSizePixels = (size: string) => {
    switch (size) {
      case "small": return { width: 80, height: 80 };
      case "medium": return { width: 120, height: 120 };
      case "large": return { width: 180, height: 180 };
      case "custom": return { 
        width: form.watch("logoWidth") || 120, 
        height: form.watch("logoHeight") || 120 
      };
      default: return { width: 120, height: 120 };
    }
  };

  const onSubmit = (data: InsertFarmSettings) => {
    saveMutation.mutate(data);
  };

  const downloadFile = (content: BlobPart, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const shareOrDownloadFile = async (content: BlobPart, filename: string, type: string, successMessage: string) => {
    const blob = new Blob([content], { type });
    const file = new File([blob], filename, { type });
    const navWithShare = navigator as Navigator & { canShare?: (data?: ShareData) => boolean };

    if (navWithShare.share && navWithShare.canShare?.({ files: [file] })) {
      try {
        await navWithShare.share({ files: [file], title: "BreedLog Export" });
        toast({ title: "Share Complete", description: successMessage });
        return;
      } catch {
        // fallback to download
      }
    }

    downloadFile(content, filename, type);
    toast({ title: "Export Complete", description: `${successMessage} Download started.` });
  };

  const getExportData = () => {
    return {
      exportDate: format(new Date(), "dd/MM/yyyy HH:mm"),
      farmBranding: farmSettings ? {
        farmName: farmSettings.farmName,
        studName: farmSettings.studName,
        studPrefix: farmSettings.studPrefix,
        ownerName: farmSettings.ownerName,
        ownerPhone: farmSettings.ownerPhone,
        ownerEmail: farmSettings.ownerEmail,
        farmLocation: farmSettings.farmLocation,
        membershipNumber: farmSettings.membershipNumber,
        registrationNumber: farmSettings.registrationNumber,
        logoUrl: farmSettings.logoUrl,
        logoSize: (farmSettings as any).logoSize || "medium",
        logoWidth: (farmSettings as any).logoWidth,
        logoHeight: (farmSettings as any).logoHeight
      } : null,
      animals: animals || [],
      breedingEvents: breedingEvents || [],
      matingGroups: matingGroups || []
    };
  };

  const buildAnimalExportRows = () => {
    const data = getExportData();
    const rows = buildBreedLogCsvRows(data.animals as any[], data.farmBranding?.studPrefix || null);
    return { data, rows };
  };

  const exportCSV = async () => {
    const { rows } = buildAnimalExportRows();
    const content = buildBreedLogCsvContent(rows);
    await shareOrDownloadFile(content, `breedlog-export-${format(new Date(), "yyyy-MM-dd")}.csv`, "text/csv", "Herd database exported as CSV.");
  };

  const exportXLSX = async () => {
    toast({
      title: "XLSX blocked in this environment",
      description: "Spreadsheet package install is blocked (403). Use CSV import/export until XLSX dependency is available.",
      variant: "destructive",
    });
  };

  const exportPDF = () => {
    const data = getExportData();
    const fb = data.farmBranding;
    const logoSize = getLogoSizePixels(fb?.logoSize || "medium");
    
    const animalsPerPage = 18;
    const totalPages = Math.ceil(data.animals.length / animalsPerPage);
    
    let pagesHtml = "";
    for (let page = 0; page < Math.max(1, totalPages); page++) {
      const startIdx = page * animalsPerPage;
      const pageAnimals = data.animals.slice(startIdx, startIdx + animalsPerPage);
      
      pagesHtml += `
        <div class="page">
          <div class="header">
            <div class="header-left">
              ${fb?.logoUrl ? `<img src="${fb.logoUrl}" style="width:${logoSize.width}px;height:${logoSize.height}px;object-fit:contain;" />` : ""}
            </div>
            <div class="header-center">
              <h1>${fb?.studName || fb?.farmName || "BREEDLOG"}</h1>
              <p class="subtitle">Livestock Database Export</p>
            </div>
            <div class="header-right">
              <p>Page ${page + 1} of ${Math.max(1, totalPages)}</p>
              <p>${data.exportDate}</p>
            </div>
          </div>
          
          <table class="animals-table">
            <thead>
              <tr>
                <th style="width:32px"></th>
                <th style="width:14%">Tag ID</th>
                <th style="width:16%">Name</th>
                <th style="width:8%">Sex</th>
                <th style="width:12%">Breed</th>
                <th style="width:10%">Status</th>
                <th style="width:14%">Birth Date</th>
                <th style="width:12%">Weight</th>
              </tr>
            </thead>
            <tbody>
              ${pageAnimals.map((a: any, i: number) => `
                <tr>
                  <td><strong>${a.tagId}</strong></td>
                  <td>${a.name || "-"}</td>
                  <td>${a.sex === "male" ? "M" : a.sex === "female" ? "F" : a.sex}</td>
                  <td>${a.breed || "-"}</td>
                  <td><span class="status status-${a.status}">${a.status}</span></td>
                  <td>${a.birthDate || "-"}</td>
                  <td>${a.currentWeight ? a.currentWeight + " kg" : "-"}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
          
          <div class="footer">
            <div class="footer-logo">
              ${fb?.logoUrl ? `<img src="${fb.logoUrl}" style="width:40px;height:40px;object-fit:contain;" />` : ""}
            </div>
            <div class="footer-info">
              <p class="footer-title">${fb?.studName || fb?.farmName || "BreedLog"}</p>
              <p>${fb?.ownerName || ""} ${fb?.ownerPhone ? "| " + fb.ownerPhone : ""} ${fb?.ownerEmail ? "| " + fb.ownerEmail : ""}</p>
              ${fb?.membershipNumber ? `<p>Membership: ${fb.membershipNumber}</p>` : ""}
            </div>
            <div class="footer-branding">
              <p class="breedlog-text">BREEDLOG</p>
              <p class="tagline">Professional Livestock Management</p>
            </div>
          </div>
        </div>
      `;
    }
    
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${fb?.studName || fb?.farmName || "BreedLog"} - Herd Export</title>
  <style>
    @page { size: A4 portrait; margin: 10mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 9pt; color: #1a1a1a; background: white; }
    .page { width: 190mm; min-height: 277mm; padding: 5mm; padding-bottom: 30mm; margin: 0 auto; page-break-after: always; position: relative; }
    .page:last-child { page-break-after: avoid; }
    .header { display: flex; align-items: center; justify-content: space-between; padding: 0 2mm 3mm 2mm; border-bottom: 2px solid #FFC300; margin-bottom: 4mm; }
    .header-left { width: 60px; flex-shrink: 0; }
    .header-center { flex: 1; text-align: center; }
    .header-center h1 { font-size: 14pt; font-weight: 800; color: #1a1a1a; text-transform: uppercase; letter-spacing: 1px; }
    .header-center .subtitle { font-size: 8pt; color: #666; margin-top: 2px; }
    .header-right { text-align: right; font-size: 8pt; color: #666; flex-shrink: 0; }
    .animals-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    .animals-table th { background: #FFC300; color: #000; font-weight: 700; font-size: 8pt; padding: 8px 10px; text-align: left; text-transform: uppercase; vertical-align: middle; }
    .animals-table td { padding: 8px 10px; border-bottom: 1px solid #e0e0e0; font-size: 8pt; vertical-align: middle; text-align: left; }
    .animals-table tbody tr { height: 30pt; }
    .animals-table tr:nth-child(even) { background: #fafafa; }
    .status { display: inline-block; padding: 2px 6px; border-radius: 3px; font-size: 7pt; font-weight: 600; text-transform: uppercase; }
    .status-active { background: #22c55e20; color: #16a34a; }
    .status-sold { background: #f59e0b20; color: #d97706; }
    .status-deceased { background: #ef444420; color: #dc2626; }
    .footer { display: flex; align-items: center; gap: 4mm; border-top: 2px solid #FFC300; background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%); color: white; padding: 3mm 4mm; border-radius: 2mm; margin-top: 6mm; position: absolute; bottom: 5mm; left: 5mm; right: 5mm; }
    .footer-logo { width: 36px; }
    .footer-info { flex: 1; }
    .footer-title { font-size: 9pt; font-weight: 700; color: #FFC300; }
    .footer-info p { font-size: 7pt; margin-top: 1px; }
    .footer-branding { text-align: right; display: flex; flex-direction: column; align-items: flex-end; }
    .footer-branding .breedlog-text { font-size: 11pt; font-weight: 800; color: white; letter-spacing: 1px; margin: 0; }
    .footer-branding .tagline { font-size: 7pt; font-style: italic; color: #FFC300; margin-top: 2px; }
    @media print { 
      .page { page-break-after: always; } 
      .page:last-child { page-break-after: avoid; }
      thead { display: table-header-group; }
    }
  </style>
</head>
<body>
  ${pagesHtml}
</body>
</html>
    `;
    
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 500);
    }
    toast({ title: "PDF Ready", description: "Print dialog opened for PDF export" });
  };




  const getLocalAnimalCount = async (): Promise<number> => {
    try {
      const localAnimals = await getAllFromStore<any>('animals');
      return Array.isArray(localAnimals) ? localAnimals.length : 0;
    } catch {
      return 0;
    }
  };

  const fetchServerAnimalCount = async (): Promise<number | null> => {
    try {
      if (!navigator.onLine) return null;
      const response = await fetch('/api/animals', { credentials: 'include', headers: { Accept: 'application/json' } });
      if (!response.ok) return null;
      const data = await response.json();
      return Array.isArray(data) ? data.length : 0;
    } catch {
      return null;
    }
  };

  const guardRiskyAction = async (): Promise<boolean> => {
    const localAnimalCount = await getLocalAnimalCount();
    const serverAnimalCount = await fetchServerAnimalCount();
    if (pendingSyncCount > 0 || (localAnimalCount > 0 && serverAnimalCount === 0)) {
      toast({
        title: 'Unsynced local records detected',
        description: 'Export CSV Backup or sync successfully before continuing. Server returned no animals while this device has local records.',
        variant: 'destructive',
      });
      return false;
    }
    return true;
  };

  const downloadImportTemplate = async () => {
    try {
      const response = await fetch('/api/import/template/csv', { credentials: 'include' });
      if (!response.ok) throw new Error('Template download failed');
      const content = await response.text();
      await shareOrDownloadFile(content, 'breedlog-import-template.csv', 'text/csv', 'Import template ready.');
    } catch {
      const fallback = `${BREEDLOG_CSV_HEADERS.join(",")}
`;
      await shareOrDownloadFile(fallback, 'breedlog-import-template.csv', 'text/csv', 'Import template ready.');
    }
  };

  const currentPlan = entitlementData ? BREEDLOG_PLANS[entitlementData.entitlement.planId] : null;
  const hiddenAnimalCount = entitlementData?.downgradeProjection.hiddenAnimalIds.length ?? 0;
  const visibleAnimalCount = entitlementData?.downgradeProjection.visibleAnimalIds.length ?? 0;
  const deletionStateLabel = accountDeletionState?.status ?? "none";

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-8 pb-24 animate-in fade-in duration-500">
        <h1 className="text-xl md:text-4xl font-black uppercase tracking-tight" data-testid="page-title">
          {displayName ? `${displayName} - Settings` : "Settings"}
        </h1>

        <Card className="rugged-card">
          <CardHeader className="cursor-pointer" onClick={() => setProfileOpen((v) => !v)}>
            <CardTitle className="uppercase flex items-center justify-between gap-2">
              <span className="flex items-center gap-2"><User className="w-5 h-5 text-primary" /> Profile</span>
              <span className="text-xs text-muted-foreground">{profileOpen ? "Expanded" : "Collapsed"}</span>
            </CardTitle>
          </CardHeader>
          {profileOpen && <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="farmName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Farm Name *</FormLabel>
                          <FormControl>
                            <Input {...field} className="rugged-input" placeholder="e.g. Sunny Hills Farm" data-testid="input-farm-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="studName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Stud Name</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} className="rugged-input" placeholder="e.g. Golden Fleece Stud" data-testid="input-stud-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="studPrefix"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Stud Prefix</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} className="rugged-input" placeholder="e.g. GFS" data-testid="input-stud-prefix" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="ownerName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Owner Name</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} className="rugged-input" placeholder="Your name" data-testid="input-owner-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="ownerEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} type="email" className="rugged-input" placeholder="email@example.com" data-testid="input-owner-email" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="ownerPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} className="rugged-input" placeholder="+27 82 123 4567" data-testid="input-owner-phone" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="farmAddress"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Farm Address</FormLabel>
                        <FormControl>
                          <Textarea {...field} value={field.value || ""} className="rugged-input resize-none" placeholder="Physical address" rows={2} data-testid="input-farm-address" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="farmLocation"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Location / District</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} className="rugged-input" placeholder="e.g. Graaff-Reinet, Eastern Cape" data-testid="input-farm-location" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="membershipNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Membership Number</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} className="rugged-input" placeholder="SA Stamboek / Society No." data-testid="input-membership-number" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="registrationNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Registration Number</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} className="rugged-input" placeholder="Stud registration" data-testid="input-registration-number" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full rugged-btn bg-primary text-primary-foreground" 
                    disabled={saveMutation.isPending}
                    data-testid="button-save-farm-settings"
                  >
                    {saveMutation.isPending ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
                    ) : (
                      <><Save className="w-4 h-4 mr-2" /> Save Profile Details</>
                    )}
                  </Button>
                </form>
              </Form>
            )}
          
            <p className="text-sm text-muted-foreground">
              Upload your farm or stud logo to include on exported documents. This creates a professional branded footer on all your PDF, Word, and other exports.
            </p>
            
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-4 items-start">
                <div 
                  className="w-32 h-32 border-2 border-dashed border-border rounded-lg flex items-center justify-center bg-secondary/30 relative overflow-hidden"
                  style={logoPreview ? { 
                    width: getLogoSizePixels(logoSize || "medium").width, 
                    height: getLogoSizePixels(logoSize || "medium").height 
                  } : undefined}
                >
                  {logoPreview ? (
                    <>
                      <img 
                        src={logoPreview} 
                        alt="Farm logo preview" 
                        className="w-full h-full object-contain"
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="destructive"
                        className="absolute top-1 right-1 h-6 w-6"
                        onClick={removeLogo}
                        data-testid="button-remove-logo"
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </>
                  ) : (
                    <div className="text-center p-2">
                      <Image className="w-8 h-8 mx-auto text-muted-foreground mb-1" />
                      <span className="text-xs text-muted-foreground">No logo</span>
                    </div>
                  )}
                </div>
                
                <div className="flex-1 space-y-3">
                  <div>
                    <Label htmlFor="logo-upload" className="text-sm font-medium mb-2 block">Upload Logo</Label>
                    <input
                      ref={logoInputRef}
                      type="file"
                      id="logo-upload"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                      data-testid="input-logo-upload"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => logoInputRef.current?.click()}
                      className="w-full sm:w-auto"
                      data-testid="button-upload-logo"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      {logoPreview ? "Change Logo" : "Select Image"}
                    </Button>
                  </div>
                  
                  <p className="text-xs text-muted-foreground">
                    Recommended: PNG or JPG, transparent background for best results
                  </p>
                </div>
              </div>
              
              <div className="space-y-3 pt-4 border-t border-border">
                <Label className="text-sm font-medium">Logo Size in Exports</Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { value: "small", label: "Small", desc: "80×80px" },
                    { value: "medium", label: "Medium", desc: "120×120px" },
                    { value: "large", label: "Large", desc: "180×180px" },
                    { value: "custom", label: "Custom", desc: "Set size" },
                  ].map((size) => (
                    <Button
                      key={size.value}
                      type="button"
                      variant={logoSize === size.value ? "default" : "outline"}
                      className={`flex flex-col h-auto py-2 ${logoSize === size.value ? "bg-primary text-primary-foreground" : ""}`}
                      onClick={() => form.setValue("logoSize", size.value)}
                      data-testid={`button-logo-size-${size.value}`}
                    >
                      <span className="font-medium text-xs">{size.label}</span>
                      <span className="text-[10px] opacity-70">{size.desc}</span>
                    </Button>
                  ))}
                </div>
                
                {logoSize === "custom" && (
                  <div className="grid grid-cols-1 xs:grid-cols-2 gap-4 mt-3 p-3 bg-secondary/30 rounded border border-border">
                    <div>
                      <Label className="text-xs mb-1 block">Width (px)</Label>
                      <Input
                        type="number"
                        min="40"
                        max="400"
                        className="rugged-input"
                        value={form.watch("logoWidth") || ""}
                        onChange={(e) => form.setValue("logoWidth", parseInt(e.target.value) || null)}
                        placeholder="120"
                        data-testid="input-logo-width"
                      />
                    </div>
                    <div>
                      <Label className="text-xs mb-1 block">Height (px)</Label>
                      <Input
                        type="number"
                        min="40"
                        max="400"
                        className="rugged-input"
                        value={form.watch("logoHeight") || ""}
                        onChange={(e) => form.setValue("logoHeight", parseInt(e.target.value) || null)}
                        placeholder="120"
                        data-testid="input-logo-height"
                      />
                    </div>
                  </div>
                )}
              </div>
              
              <Button 
                type="button"
                onClick={form.handleSubmit(onSubmit)}
                className="w-full rugged-btn bg-primary text-primary-foreground" 
                disabled={saveMutation.isPending}
                data-testid="button-save-logo-settings"
              >
                {saveMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
                ) : (
                  <><Save className="w-4 h-4 mr-2" /> Save Logo Settings</>
                )}
              </Button>
            </div>
          </CardContent>}
        </Card>

        <Card className="rugged-card">
          <CardHeader className="cursor-pointer" onClick={() => setDataOpen((v) => !v)}>
            <CardTitle className="uppercase flex items-center justify-between gap-2">
              <span className="flex items-center gap-2"><Download className="w-5 h-5" /> Data Management</span>
              <span className="text-xs text-muted-foreground">{dataOpen ? "Expanded" : "Collapsed"}</span>
            </CardTitle>
          </CardHeader>
          {dataOpen && <CardContent className="space-y-6">
            <div className="space-y-4">
               {user && (
                 <Button onClick={async () => { if (await guardRiskyAction()) { await performLogout(); } }} variant="outline" data-testid="button-logout" className="w-full rugged-btn">
                   <LogOut className="w-4 h-4 mr-2" /> Log Out
                 </Button>
               )}
            </div>
          
             <div className="p-4 bg-secondary rounded border border-border">
                <h4 className="font-bold text-sm uppercase mb-2">Save Settings</h4>
                <p className="text-xs text-muted-foreground mb-4">Save all your farm details, branding, and preferences.</p>
                <Button 
                    className="w-full bg-primary text-primary-foreground font-bold hover:bg-primary/90"
                    onClick={form.handleSubmit(onSubmit)}
                    disabled={saveMutation.isPending}
                    data-testid="button-save-settings-data"
                >
                    {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                    Save All Settings
                </Button>
             </div>
             
             <div className="p-4 bg-secondary rounded border border-border">
                <h4 className="font-bold text-sm uppercase mb-2">Export Herd Database</h4>
                <p className="text-xs text-muted-foreground mb-4">Download your complete herd database in farmer-friendly formats. CSV is the approved spreadsheet roundtrip format in this build. CSV backup includes animal records and image references. Full image-file backup will be added in the Android/production backup phase.</p>
                
                <div className="grid grid-cols-2 gap-2">
                  <Button 
                      className="bg-primary text-primary-foreground font-bold hover:bg-primary/90"
                      onClick={exportPDF}
                      data-testid="button-export-pdf"
                  >
                      <FileText className="w-4 h-4 mr-2" /> PDF
                  </Button>
                  <Button 
                      variant="outline"
                      className="font-bold"
                      onClick={exportCSV}
                      data-testid="button-export-csv"
                  >
                      <FileSpreadsheet className="w-4 h-4 mr-2" /> CSV
                  </Button>
                  <Button 
                      variant="outline"
                      className="font-bold"
                      onClick={exportXLSX}
                      data-testid="button-export-xlsx"
                  >
                      <FileSpreadsheet className="w-4 h-4 mr-2" /> XLSX (Blocked)
                  </Button>
                </div>
                
                <p className="text-[10px] text-muted-foreground mt-3 text-center">
                  {animals?.length || 0} animals | {breedingEvents?.length || 0} breeding events | {matingGroups?.length || 0} mating groups
                </p>
             </div>
             
             <div className="p-4 bg-secondary rounded border border-border">
                <h4 className="font-bold text-sm uppercase mb-2">Import Animals (CSV)</h4>
                <p className="text-xs text-muted-foreground mb-4">
                  Bulk import animals from BreedLog CSV. Use the template for exact column names and safe roundtrip imports.
                </p>
                
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => void downloadImportTemplate()}
                  data-testid="button-download-import-template"
                >
                  <Download className="w-4 h-4 mr-2" /> Download Import Template
                </Button>

                <input
                  ref={csvInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleCsvUpload}
                  className="hidden"
                  data-testid="input-csv-file"
                />
                
                <div className="space-y-3">
                  <Button 
                    variant="outline"
                    className="w-full"
                    onClick={() => csvInputRef.current?.click()}
                    data-testid="button-select-csv"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {importFile ? importFile.name : "Select CSV File"}
                  </Button>
                  
                  {importFile && (
                    <Button 
                      className="w-full bg-primary text-primary-foreground font-bold"
                      onClick={processCsvImport}
                      disabled={importCsvMutation.isPending}
                      data-testid="button-process-import"
                    >
                      {importCsvMutation.isPending ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Importing...</>
                      ) : (
                        <><Upload className="w-4 h-4 mr-2" /> Import {importFile.name}</>
                      )}
                    </Button>
                  )}
                  
                  {importResult && (
                    <div className={`p-3 rounded text-sm ${(importResult.validationErrors || importResult.errors).length > 0 ? 'bg-destructive/20 border border-destructive/50' : 'bg-green-500/20 border border-green-500/50'}`}>
                      <div className="flex items-center gap-2 mb-1">
                        {(importResult.validationErrors || importResult.errors).length > 0 ? (
                          <AlertCircle className="w-4 h-4 text-destructive" />
                        ) : (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        )}
                        <span className="font-bold">{importResult.imported} animals imported</span>
                      </div>
                      {(importResult.validationErrors || importResult.errors).length > 0 && (
                        <ul className="text-xs text-muted-foreground list-disc list-inside">
                          {(importResult.validationErrors || importResult.errors).slice(0, 5).map((err, i) => (
                            <li key={i}>{err}</li>
                          ))}
                          {(importResult.validationErrors || importResult.errors).length > 5 && (
                            <li>...and {(importResult.validationErrors || importResult.errors).length - 5} more errors</li>
                          )}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
             </div>

             <div className="p-4 bg-secondary rounded border border-border space-y-4" data-testid="card-plan-entitlements">
                <div>
                  <h4 className="font-bold text-sm uppercase mb-2">Plan & Entitlements</h4>
                  <p className="text-xs text-muted-foreground">
                    Server-authoritative plan status, quota rules, and downgrade visibility are shown here. Backend enforcement remains the source of truth.
                  </p>
                </div>

                {entitlementLoading || !currentPlan ? (
                  <Skeleton className="h-24 w-full" />
                ) : (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={currentPlan.id === "premium" ? "default" : "secondary"}>
                        {currentPlan.displayName}
                      </Badge>
                      <Badge variant="outline">{entitlementData?.entitlement.status.replace("_", " ")}</Badge>
                      <span className="text-xs text-muted-foreground">
                        Pricing version: {entitlementData?.entitlement.pricingVersion}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="rounded border border-border bg-background/70 p-3">
                        <p><strong>Active animals:</strong> {currentPlan.limits.activeAnimals === "unlimited" ? "Unlimited" : currentPlan.limits.activeAnimals}</p>
                        <p><strong>Registered devices:</strong> {currentPlan.limits.activeDevices}</p>
                        <p><strong>AI actions/month:</strong> {currentPlan.limits.aiActionsPerMonth === "fair_use" ? "Fair use" : currentPlan.limits.aiActionsPerMonth}</p>
                      </div>
                      <div className="rounded border border-border bg-background/70 p-3">
                        <p><strong>Individual PDFs/month:</strong> {currentPlan.limits.individualPdfExportsPerMonth}</p>
                        <p><strong>Batch PDFs/month:</strong> {currentPlan.limits.batchPdfExportsPerMonth}</p>
                        <p><strong>Weekly auto backups retained:</strong> {currentPlan.limits.retainedWeeklyAutomaticBackups}</p>
                      </div>
                    </div>
                    <div className="rounded border border-border bg-background/70 p-3 text-xs">
                      <p><strong>Downgrade visibility rule:</strong> first 30 active animals originally added remain visible.</p>
                      <p><strong>Visible under Free:</strong> {visibleAnimalCount}</p>
                      <p><strong>Hidden on downgrade:</strong> {hiddenAnimalCount}</p>
                    </div>
                  </div>
                )}
             </div>

             <div className="p-4 bg-secondary rounded border border-border space-y-4" data-testid="card-encrypted-backups">
                <div>
                  <h4 className="font-bold text-sm uppercase mb-2">Encrypted BreedLog Backups</h4>
                  <p className="text-xs text-muted-foreground">
                    Create account-bound `.breedlogbackup` files, preview restores safely, and restore only into the authenticated workspace.
                  </p>
                </div>

                <div className="space-y-3">
                  <Label htmlFor="backup-passphrase" className="text-xs">Optional backup passphrase</Label>
                  <Input
                    id="backup-passphrase"
                    type="password"
                    value={backupPassphrase}
                    onChange={(e) => setBackupPassphrase(e.target.value)}
                    placeholder="Extra passphrase for this backup"
                    data-testid="input-backup-passphrase"
                  />
                  <Button
                    className="w-full bg-primary text-primary-foreground font-bold hover:bg-primary/90"
                    onClick={() => createManualBackupMutation.mutate()}
                    disabled={createManualBackupMutation.isPending}
                    data-testid="button-create-manual-backup"
                  >
                    {createManualBackupMutation.isPending ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating Backup...</>
                    ) : (
                      <><Download className="w-4 h-4 mr-2" /> Create Manual .breedlogbackup</>
                    )}
                  </Button>
                  <p className="text-[10px] text-muted-foreground">
                    Free plan: one manual backup in a rolling 7-day window. Premium: unlimited manual backups.
                  </p>
                </div>

                <div className="border-t border-border pt-4 space-y-3">
                  <input
                    ref={backupRestoreInputRef}
                    type="file"
                    accept=".breedlogbackup,application/json"
                    className="hidden"
                    onChange={handleRestoreFileSelected}
                    data-testid="input-restore-backup-file"
                  />
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => backupRestoreInputRef.current?.click()}
                    data-testid="button-select-restore-backup"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {restoreFile ? restoreFile.name : "Select .breedlogbackup File"}
                  </Button>
                  <Input
                    type="password"
                    value={restorePassphrase}
                    onChange={(e) => setRestorePassphrase(e.target.value)}
                    placeholder="Restore passphrase if one was used"
                    data-testid="input-restore-passphrase"
                  />
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => previewRestoreMutation.mutate()}
                    disabled={!restoreFile || previewRestoreMutation.isPending}
                    data-testid="button-preview-backup-restore"
                  >
                    {previewRestoreMutation.isPending ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Checking Backup...</>
                    ) : (
                      <><RefreshCw className="w-4 h-4 mr-2" /> Preview Restore</>
                    )}
                  </Button>
                </div>
             </div>

             <div className="p-4 bg-secondary rounded border border-border space-y-4" data-testid="card-account-deletion">
                <div>
                  <h4 className="font-bold text-sm uppercase mb-2">Account Deletion & Recovery</h4>
                  <p className="text-xs text-muted-foreground">
                    Deletion requests enter a 30-day recovery window before permanent removal. You can export an encrypted backup first and cancel during the recovery period.
                  </p>
                </div>
                <div className="rounded border border-border bg-background/70 p-3 text-xs">
                  <p><strong>Status:</strong> {deletionStateLabel}</p>
                  {accountDeletionState?.requestedAt && <p><strong>Requested:</strong> {format(new Date(accountDeletionState.requestedAt), "dd MMM yyyy HH:mm")}</p>}
                  {accountDeletionState?.recoveryUntil && <p><strong>Recovery until:</strong> {format(new Date(accountDeletionState.recoveryUntil), "dd MMM yyyy HH:mm")}</p>}
                  {accountDeletionState?.cancelledAt && <p><strong>Cancelled:</strong> {format(new Date(accountDeletionState.cancelledAt), "dd MMM yyyy HH:mm")}</p>}
                  {accountDeletionState?.completedAt && <p><strong>Completed:</strong> {format(new Date(accountDeletionState.completedAt), "dd MMM yyyy HH:mm")}</p>}
                </div>
                {accountDeletionState?.status === "pending" ? (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => cancelAccountDeletionMutation.mutate()}
                    disabled={cancelAccountDeletionMutation.isPending}
                    data-testid="button-cancel-account-deletion"
                  >
                    {cancelAccountDeletionMutation.isPending ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Cancelling...</>
                    ) : (
                      <><RotateCcw className="w-4 h-4 mr-2" /> Cancel Pending Deletion</>
                    )}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setShowDeleteAccountDialog(true)}
                    data-testid="button-open-account-deletion-dialog"
                  >
                    <Trash2 className="w-4 h-4 mr-2" /> Request Account Deletion
                  </Button>
                )}
                <p className="text-[10px] text-muted-foreground">
                  Legal documents are implementation drafts and still require professional legal review before production launch.
                </p>
             </div>
          </CardContent>}
        </Card>

        <Card className="rugged-card">
          <CardHeader>
            <CardTitle className="uppercase flex items-center gap-2">
              <Folder className="w-5 h-5 text-primary" /> Documents
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Upload and manage documents like evaluation certificates, pedigrees, and other records.
            </p>
            
            <input
              ref={docInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              onChange={handleDocUpload}
              className="hidden"
              data-testid="input-doc-file"
            />
            
            <Button 
              variant="outline"
              className="w-full"
              onClick={() => docInputRef.current?.click()}
              disabled={uploadDocMutation.isPending}
              data-testid="button-upload-doc"
            >
              {uploadDocMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploading...</>
              ) : (
                <><Upload className="w-4 h-4 mr-2" /> Upload Document</>
              )}
            </Button>
            
            {docsLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : documents && documents.length > 0 ? (
              <div className="space-y-2">
                {documents.map((doc: any) => (
                  <div 
                    key={doc.id} 
                    className="flex items-center justify-between p-3 bg-secondary/50 rounded border border-border"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <FileText className="w-4 h-4 text-primary flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{doc.fileName}</p>
                        <p className="text-xs text-muted-foreground">
                          {doc.category} {doc.createdAt && `• ${format(new Date(doc.createdAt), "dd MMM yyyy")}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {doc.fileUrl && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            const link = document.createElement('a');
                            link.href = doc.fileUrl;
                            link.download = doc.fileName;
                            link.click();
                          }}
                          data-testid={`button-download-doc-${doc.id}`}
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => deleteDocMutation.mutate(doc.id)}
                        disabled={deleteDocMutation.isPending}
                        data-testid={`button-delete-doc-${doc.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Folder className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No documents uploaded yet</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Appearance Section */}
        <Card className="rugged-card">
          <CardHeader>
            <CardTitle className="uppercase flex items-center gap-2">
              <Sun className="w-5 h-5 text-primary" /> Appearance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Choose your preferred display theme. Light Mode is optimised for outdoor use in bright sunlight.
            </p>
            <div className="grid grid-cols-3 gap-3" data-testid="theme-selector">
              {([ 
                { value: "light", label: "Light", Icon: Sun, desc: "Outdoor-optimised" },
                { value: "dark",  label: "Dark",  Icon: Moon, desc: "Original dark mode" },
                { value: "system",label: "Auto",  Icon: Monitor, desc: "Follows device" },
              ] as { value: ThemeMode; label: string; Icon: React.FC<{className?: string}>; desc: string }[]).map(({ value, label, Icon, desc }) => (
                <button
                  key={value}
                  onClick={() => setTheme(value)}
                  data-testid={`theme-option-${value}`}
                  className={`flex flex-col items-center gap-2 p-3 rounded-md border-2 transition-all cursor-pointer min-h-[80px] justify-center ${
                    theme === value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-sm font-bold uppercase tracking-wide">{label}</span>
                  <span className="text-[10px] opacity-70 text-center leading-tight">{desc}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Data & Sync Section */}
        <Card className="rugged-card">
          <CardHeader>
            <CardTitle className="uppercase flex items-center gap-2">
              <Database className="w-5 h-5 text-primary" /> Data & Sync
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Manually sync your data with the server or refresh the current view from local storage.
            </p>
            
            {/* Sync status indicator */}
            <div className="flex items-center gap-2 text-sm">
              <div className={`w-2.5 h-2.5 rounded-full ${
                !syncState.backendReachable ? 'bg-red-500' :
                syncState.pendingCount > 0 || syncState.failedItems > 0 ? 'bg-yellow-500' :
                'bg-green-500'
              }`} />
              <span className="text-muted-foreground">
                {!syncState.backendReachable ? 'Backend unreachable' :
                 syncState.failedItems > 0 ? `${syncState.failedItems} failed items` :
                 syncState.pendingCount > 0 ? `${syncState.pendingCount} pending` :
                 'All synced'}
              </span>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3">
              <Button 
                variant="outline" 
                onClick={handleSyncNow}
                disabled={isSyncingNow || syncState.status === 'syncing'}
                className="flex-1"
                data-testid="button-sync-now"
              >
                {isSyncingNow || syncState.status === 'syncing' ? (
                  <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Syncing...</>
                ) : (
                  <><RefreshCw className="w-4 h-4 mr-2" /> Sync Now (Online Only)</>
                )}
              </Button>
              
              <Button 
                variant="outline" 
                onClick={handleReloadView}
                disabled={isReloadingView}
                className="flex-1"
                data-testid="button-reload-view"
              >
                {isReloadingView ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Reloading...</>
                ) : (
                  <><CloudOff className="w-4 h-4 mr-2" /> Reload Data View</>
                )}
              </Button>
            </div>
            
            <p className="text-xs text-muted-foreground">
              <strong>Sync Now:</strong> Attempts to connect to the server, push local changes, and pull fresh data.
              <br />
              <strong>Reload Data View:</strong> Refreshes the UI from local storage without network calls (use when UI seems stuck).
            </p>
            
            {/* Debug Sync Section */}
            <div className="border-t border-border pt-4 mt-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-sm">Sync Troubleshooting</h4>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handlePurgeFailedSyncs}
                    disabled={isPurgingSyncs}
                    className="text-orange-400 border-orange-400/50 hover:border-orange-400"
                    data-testid="button-purge-failed-syncs"
                  >
                    {isPurgingSyncs ? (
                      <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Purging...</>
                    ) : (
                      <><Trash2 className="w-3 h-3 mr-1" /> Purge Failed Syncs</>
                    )}
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={handleShowDebug}
                    disabled={isLoadingDebug}
                    data-testid="button-debug-sync"
                  >
                    {isLoadingDebug ? (
                      <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Loading...</>
                    ) : showDebugInfo ? (
                      <><X className="w-3 h-3 mr-1" /> Hide Debug</>
                    ) : (
                      <><AlertCircle className="w-3 h-3 mr-1" /> Debug Sync</>
                    )}
                  </Button>
                </div>
              </div>
              
              {showDebugInfo && (
                <div className="bg-secondary/50 border border-border rounded-md p-3 space-y-2 text-xs font-mono max-h-64 overflow-auto">
                  <div className="flex justify-between items-center pb-2 border-b border-border">
                    <span className="font-semibold text-foreground">Pending Sync Queue ({debugPendingItems.length} items)</span>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 text-[10px]"
                      onClick={handleShowDebug}
                      data-testid="button-refresh-debug"
                    >
                      <RefreshCw className="w-3 h-3" />
                    </Button>
                  </div>
                  
                  {debugPendingItems.length === 0 ? (
                    <p className="text-muted-foreground py-2">No items pending sync. All data is synchronized.</p>
                  ) : (
                    debugPendingItems.map((item, idx) => (
                      <div key={item.id || idx} className="bg-background/50 rounded p-2 space-y-1">
                        <div className="flex justify-between">
                          <span className="text-primary font-semibold">
                            {item.action.toUpperCase()} {item.entity}
                          </span>
                          <span className="text-muted-foreground">
                            ID: {String(item.tempId || (item.data as { id?: number })?.id || 'N/A')}
                          </span>
                        </div>
                        <div className="text-muted-foreground text-[10px] break-all">
                          {item.data ? String(JSON.stringify(item.data, null, 0)).substring(0, 150) + '...' : 'No data'}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          Synced: {item.synced ? 'Yes' : 'No'} | 
                          Created: {item.timestamp ? new Date(item.timestamp).toLocaleString() : 'Unknown'}
                        </div>
                      </div>
                    ))
                  )}
                  
                  <div className="pt-2 border-t border-border text-muted-foreground">
                    <p><strong>Sync Status:</strong> {syncState.status}</p>
                    <p><strong>Backend Reachable:</strong> {syncState.backendReachable ? 'Yes' : 'No'}</p>
                    <p><strong>Failed Items:</strong> {syncState.failedItems}</p>
                    <p><strong>Last Sync:</strong> {syncState.lastSyncTime ? new Date(syncState.lastSyncTime).toLocaleString() : 'Never'}</p>
                    {syncState.error && <p><strong>Error:</strong> {syncState.error}</p>}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Advanced Settings */}
        <Card className="rugged-card border-border">
          <CardHeader>
            <CardTitle className="uppercase flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-primary" /> Advanced Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Restart Onboarding</h4>
              <p className="text-xs text-muted-foreground">
                Show the welcome wizard again on next page load.
              </p>
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleRestartOnboarding}
                data-testid="button-restart-onboarding"
              >
                <RotateCcw className="w-4 h-4 mr-2" /> Restart Onboarding
              </Button>
            </div>
            
            <div className="border-t border-border pt-4 space-y-2">
              <h4 className="font-semibold text-sm">Production Reset</h4>
              <p className="text-xs text-muted-foreground">
                Remove ALL test/demo data and reset the app for production use. 
                This action cannot be undone.
              </p>
              <Button 
                variant="outline"
                size="sm"
                onClick={() => setShowResetDialog(true)}
                data-testid="button-open-reset-dialog"
              >
                <Trash2 className="w-4 h-4 mr-2" /> Reset All Data
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="rugged-card border-border" data-testid="field-test-release-info">
          <CardHeader>
            <CardTitle className="uppercase flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" /> Field-Test Release Info
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><strong>Version:</strong> {FIELD_TEST_VERSION_LABEL}</p>
            <p><strong>Build date:</strong> {FIELD_TEST_BUILD_DATE}</p>
            <p className="text-xs text-muted-foreground">
              If the app shows older content, connect online once and refresh/reload to update cached PWA files.
            </p>
            <p className="text-xs text-muted-foreground">
              Report issues with version, device, browser, screen, steps, online/offline state, and screenshot/video when possible.
            </p>
            <div className="flex flex-col gap-2 pt-1">
              <a
                href="/report-issue"
                className="inline-flex items-center gap-1.5 text-primary underline text-sm font-medium"
                data-testid="link-report-field-test-issue"
              >
                Report an Issue (in-app form)
              </a>
              <a
                href={`mailto:support@breedlog.app?subject=${encodeURIComponent(`[${FIELD_TEST_VERSION_LABEL}] Field Test Issue`)}`}
                className="inline-flex items-center text-muted-foreground underline text-xs"
                data-testid="link-report-field-test-issue-email"
              >
                Or report by email
              </a>
              <a
                href="/help"
                className="inline-flex items-center gap-1.5 text-primary underline text-sm font-medium"
                data-testid="link-help-center"
              >
                Help & Information
              </a>
            </div>
          </CardContent>
        </Card>

        {/* Encouraging message */}
        <div className="text-center py-6 px-4 border-t border-border/30 mt-4">
          <p className="text-sm text-muted-foreground italic max-w-md mx-auto">
            Your farm identity matters. A well-branded stud stands out in the <span className="text-primary font-medium">industry</span>.
          </p>
        </div>
      </div>

      <Dialog open={showRestoreDialog} onOpenChange={setShowRestoreDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-primary" /> Restore Workspace Backup
            </DialogTitle>
            <DialogDescription>
              Confirm this overwrite only after checking the backup preview. Restore is limited to the authenticated BreedLog account and rejects cross-workspace backups.
            </DialogDescription>
          </DialogHeader>
          {restorePreview && (
            <div className="space-y-3 py-2 text-sm">
              <div className="rounded border border-border bg-secondary/40 p-3 space-y-1">
                <p><strong>Exported:</strong> {format(new Date(restorePreview.exportedAt), "dd MMM yyyy HH:mm")}</p>
                <p><strong>Animals:</strong> {restorePreview.animalCount}</p>
                <p><strong>Breeding events:</strong> {restorePreview.breedingEventCount}</p>
                <p><strong>Health records:</strong> {restorePreview.healthRecordCount}</p>
                <p><strong>Performance records:</strong> {restorePreview.performanceRecordCount}</p>
                <p><strong>Documents:</strong> {restorePreview.documentCount}</p>
                <p><strong>Export history:</strong> {restorePreview.exportedDocumentCount}</p>
              </div>
              <label className="flex items-start gap-3 rounded border border-border p-3 text-xs">
                <Checkbox
                  checked={confirmRestoreOverwrite}
                  onCheckedChange={(checked) => setConfirmRestoreOverwrite(checked === true)}
                  data-testid="checkbox-confirm-backup-restore"
                />
                <span>
                  I understand this will overwrite the current workspace on this account. The backup has been previewed and I want to continue.
                </span>
              </label>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowRestoreDialog(false);
                setConfirmRestoreOverwrite(false);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={() => restoreBackupMutation.mutate()}
              disabled={!confirmRestoreOverwrite || restoreBackupMutation.isPending}
              data-testid="button-confirm-backup-restore"
            >
              {restoreBackupMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Restoring...</>
              ) : (
                <><RefreshCw className="w-4 h-4 mr-2" /> Restore Backup</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteAccountDialog} onOpenChange={setShowDeleteAccountDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-primary" /> Request Account Deletion
            </DialogTitle>
            <DialogDescription>
              This starts a 30-day recovery window. You can optionally export an encrypted `.breedlogbackup` before the deletion request is recorded.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <label className="flex items-start gap-3 rounded border border-border p-3 text-sm">
              <Checkbox
                checked={deleteExportBackup}
                onCheckedChange={(checked) => setDeleteExportBackup(checked === true)}
                data-testid="checkbox-export-before-delete"
              />
              <span>Create an encrypted backup before requesting deletion.</span>
            </label>
            {deleteExportBackup && (
              <Input
                type="password"
                value={deleteBackupPassphrase}
                onChange={(e) => setDeleteBackupPassphrase(e.target.value)}
                placeholder="Optional passphrase for the pre-deletion backup"
                data-testid="input-delete-backup-passphrase"
              />
            )}
            <div className="rounded border border-border bg-secondary/40 p-3 text-xs">
              <p><strong>Type exactly:</strong> DELETE MY BREEDLOG ACCOUNT</p>
            </div>
            <Input
              value={deleteConfirmPhrase}
              onChange={(e) => setDeleteConfirmPhrase(e.target.value)}
              placeholder="Type the confirmation phrase"
              data-testid="input-delete-account-confirm"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteAccountDialog(false);
                setDeleteConfirmPhrase("");
                setDeleteBackupPassphrase("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={() => requestAccountDeletionMutation.mutate()}
              disabled={deleteConfirmPhrase !== "DELETE MY BREEDLOG ACCOUNT" || requestAccountDeletionMutation.isPending}
              data-testid="button-confirm-account-deletion"
            >
              {requestAccountDeletionMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting...</>
              ) : (
                <><Trash2 className="w-4 h-4 mr-2" /> Start 30-Day Recovery Window</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showClearCacheDialog} onOpenChange={setShowClearCacheDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Database className="w-5 h-5 text-primary" /> Clear Local Device Cache
            </DialogTitle>
            <DialogDescription>
              This resets only local data on this device (cached records, local sync queue, and session data).
              It does not delete your cloud account/farm data.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-3">
            <div className="rounded border border-border bg-secondary/40 p-3 text-xs text-muted-foreground">
              <p><strong>Will remove:</strong> local cache, this device session, pending local queue.</p>
              <p><strong>Will not remove:</strong> server/cloud account data and admin access codes.</p>
              <p className="mt-2"><strong>Current unsynced items:</strong> {pendingSyncCount}</p>
              <Button type="button" variant="outline" className="mt-3 h-7 text-[11px]" onClick={() => void exportCSV()}>
                Export CSV Backup
              </Button>
            </div>
            <Input
              value={clearCacheConfirmText}
              onChange={(e) => setClearCacheConfirmText(e.target.value)}
              placeholder="Type CLEAR DEVICE"
              data-testid="input-clear-device-confirm"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowClearCacheDialog(false);
                setClearCacheConfirmText("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={handleClearLocalCache}
              disabled={isClearingCache || clearCacheConfirmText.trim().toUpperCase() !== "CLEAR DEVICE" || pendingSyncCount > 0}
              data-testid="button-confirm-clear-device-cache"
            >
              {isClearingCache ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Clear Local Cache
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Production Reset Dialog */}
      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-primary" /> Production Reset
            </DialogTitle>
            <DialogDescription>
              This will permanently delete ALL data including animals, breeding events, 
              mating groups, health records, and documents. The app will be reset to a 
              clean state for production use.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="bg-secondary border border-border rounded p-3">
              <p className="text-sm font-medium">
                To confirm, type: <code className="bg-background px-1 rounded text-primary">RESET BREEDLOG</code>
              </p>
            </div>
            <Input
              value={resetConfirmPhrase}
              onChange={(e) => setResetConfirmPhrase(e.target.value)}
              placeholder="Type confirmation phrase..."
              data-testid="input-reset-confirm"
            />
          </div>
          
          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setShowResetDialog(false);
                setResetConfirmPhrase("");
              }}
              disabled={isResetting}
              data-testid="button-cancel-reset"
            >
              Cancel
            </Button>
            <Button 
              variant="outline"
              onClick={handleProductionReset}
              disabled={isResetting || resetConfirmPhrase !== "RESET BREEDLOG"}
              data-testid="button-confirm-reset"
            >
              {isResetting ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Resetting...</>
              ) : (
                <><Trash2 className="w-4 h-4 mr-2" /> Reset Everything</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
