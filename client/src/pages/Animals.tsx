import { useState, useRef, useEffect, useMemo, lazy, Suspense } from "react";
import { Layout } from "@/components/Layout";
import { useAnimals, useCreateAnimal, useDeleteAnimal, useRemoveFromHerd, useClassifyRamLamb, useConfirmCull, useMoveToEwes, useMoveToRams, useUpdateAnimal, useSetRamType } from "@/hooks/use-animals";
import { buildBreedLogCsvRows, buildBreedLogCsvContent } from "@shared/import-export";
import { useFarmSettings } from "@/hooks/use-farm-settings";
import { useBreedingEvents } from "@/hooks/use-breeding";
import { useCreateExportedDocument } from "@/hooks/use-exported-documents";
import { buildCullSoldRows, buildEweExportRows, buildLambBirthRows, buildLambPerformanceRows, buildRamExportRows } from "@/lib/stamboek-export-fields";
import { AnimalCard } from "@/components/AnimalCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertAnimalSchema, type Animal, type BreedingEvent } from "@shared/schema";
import { Search, Plus, Filter, Camera, X, Image, FileText, Trash2, MoreVertical, Download, LayoutGrid, List, Grid3X3, LogOut, Scale, Tag, ChevronRight, UserPlus, ChevronDown, Edit } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { useCreateHealthRecord, useCreatePerformanceRecord } from "@/hooks/use-records";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Link, useSearch, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { format, differenceInDays } from "date-fns";
import { Label } from "@/components/ui/label";
import { DialogFooter, DialogDescription } from "@/components/ui/dialog";
import logo from "@/assets/breedlog-logo-mark.png";
import type { PDFQuality } from "@/lib/pdf-utils";
import { getHerdCounts } from "@/lib/herd-counts";
import { api } from "@shared/routes";
import { nextTagRawSequence, splitTagInput } from "@shared/tag-utils";
import { calculateLambStage } from "@shared/lamb-stage";
import { ImageCropDialog } from "@/components/ImageCropDialog";
const PDFExportDialog = lazy(() => import("@/components/PDFExportDialog").then((m) => ({ default: m.PDFExportDialog })));
const ANIMALS_INITIAL_VISIBLE_COUNT = 50;
const ANIMALS_LOAD_MORE_STEP = 50;

function calculateEweBreedingStats(eweId: number, breedingEvents: BreedingEvent[], allAnimals: Animal[]) {
  const eweEvents = breedingEvents.filter(e => e.eweId === eweId && e.lambingDate);
  
  const totalLambs = eweEvents.reduce((sum, e) => sum + (e.lambCount || 0), 0);
  
  const lambingDates = eweEvents
    .map(e => new Date(e.lambingDate!))
    .sort((a, b) => a.getTime() - b.getTime());
  
  const firstLambDate = lambingDates.length > 0 ? lambingDates[0] : null;
  
  let avgILP = 0;
  if (lambingDates.length > 1) {
    const intervals: number[] = [];
    for (let i = 1; i < lambingDates.length; i++) {
      const days = (lambingDates[i].getTime() - lambingDates[i-1].getTime()) / (1000 * 60 * 60 * 24);
      intervals.push(days);
    }
    avgILP = Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length);
  }
  
  const offspring = allAnimals.filter(a => a.damId === eweId);
  const weanedLambs = offspring.filter(a => 
    a.weaningStatus === 'normal' || a.weaningStatus === 'early'
  ).length;
  
  const weanedWithWeight = offspring.filter(a => 
    (a.weaningStatus === 'normal' || a.weaningStatus === 'early') && a.weight100Day
  );
  const avgWeanWeight = weanedWithWeight.length > 0
    ? Math.round((weanedWithWeight.reduce((sum, a) => sum + parseFloat(a.weight100Day || '0'), 0) / weanedWithWeight.length) * 10) / 10
    : 0;
  
  return {
    totalLambs,
    firstLambDate,
    avgILP,
    lambsWeaned: weanedLambs,
    avgWeanWeight
  };
}

function calculateRamBreedingStats(ramId: number, breedingEvents: BreedingEvent[], allAnimals: Animal[]) {
  // Get all lambing events where this ram was the sire
  const ramEvents = breedingEvents.filter(e => e.ramId === ramId && e.lambingDate);
  
  // Total lambs sired
  const totalLambs = ramEvents.reduce((sum, e) => sum + (e.lambCount || 0), 0);
  
  // Count twins (lambings with 2+ lambs)
  const twinCount = ramEvents.filter(e => (e.lambCount || 0) >= 2).length;
  
  // Get offspring for weight calculations
  const offspring = allAnimals.filter(a => a.sireId === ramId);
  
  // Calculate average birth weight
  const birthWeights = offspring.filter(a => a.birthWeight).map(a => parseFloat(a.birthWeight || '0'));
  const avgBirthWeight = birthWeights.length > 0 
    ? Math.round((birthWeights.reduce((a, b) => a + b, 0) / birthWeights.length) * 10) / 10 
    : 0;
  
  // Calculate average 100-day weight
  const weight100Days = offspring.filter(a => a.weight100Day).map(a => parseFloat(a.weight100Day || '0'));
  const avgWeight100Day = weight100Days.length > 0 
    ? Math.round((weight100Days.reduce((a, b) => a + b, 0) / weight100Days.length) * 10) / 10 
    : 0;
  
  // Calculate average 270-day weight
  const weight270Days = offspring.filter(a => a.weight270Day).map(a => parseFloat(a.weight270Day || '0'));
  const avgWeight270Day = weight270Days.length > 0 
    ? Math.round((weight270Days.reduce((a, b) => a + b, 0) / weight270Days.length) * 10) / 10 
    : 0;
  
  // Calculate average wean weight (using weight100Day as wean weight)
  const weanedWithWeight = offspring.filter(a => 
    (a.weaningStatus === 'normal' || a.weaningStatus === 'early') && a.weight100Day
  );
  const avgWeanWeight = weanedWithWeight.length > 0
    ? Math.round((weanedWithWeight.reduce((sum, a) => sum + parseFloat(a.weight100Day || '0'), 0) / weanedWithWeight.length) * 10) / 10
    : 0;
  
  return {
    totalLambs,
    twinCount,
    avgBirthWeight,
    avgWeight100Day,
    avgWeight270Day,
    avgWeanWeight
  };
}

export default function Animals() {
  const searchParams = useSearch();
  const urlParams = new URLSearchParams(searchParams);
  
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(urlParams.get("status") || "active");
  const [classificationFilter, setClassificationFilter] = useState(urlParams.get("classification") || "all");
  const [sexFilter, setSexFilter] = useState(urlParams.get("sex") || "all");
  const [ageFilter, setAgeFilter] = useState(urlParams.get("age") || "all");
  const { data: allAnimals, isLoading } = useAnimals({ search });
  const { data: breedingEvents } = useBreedingEvents();
  const { data: farmSettings } = useFarmSettings();
  const { toast } = useToast();
  const displayName = farmSettings?.studName || farmSettings?.farmName;
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isScanDialogOpen, setIsScanDialogOpen] = useState(false);
  const [prefillElectronicId, setPrefillElectronicId] = useState<string | undefined>(undefined);
  const [viewMode, setViewMode] = useState<"detailed" | "list" | "thumbnail">("detailed");
  const isMobile = useIsMobile();
  
  // Collapsible section states - all collapsed by default
  const [totalHerdExpanded, setTotalHerdExpanded] = useState(false);
  const [ramsExpanded, setRamsExpanded] = useState(false);
  const [ewesExpanded, setEwesExpanded] = useState(false);
  const [lambsExpanded, setLambsExpanded] = useState(false);
  const [culledExpanded, setCulledExpanded] = useState(false);
  
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [animalToRemove, setAnimalToRemove] = useState<Animal | null>(null);
  const [removeReason, setRemoveReason] = useState<"sold" | "deceased" | "transferred">("sold");
  const [removeNotes, setRemoveNotes] = useState("");
  const removeFromHerdMutation = useRemoveFromHerd();
  
  const classifyMutation = useClassifyRamLamb();
  const confirmCullMutation = useConfirmCull();
  const moveToEwesMutation = useMoveToEwes();
  const moveToRamsMutation = useMoveToRams();
  const updateAnimalMutation = useUpdateAnimal();
  const createExportedDoc = useCreateExportedDocument();
  const createHealthRecord = useCreateHealthRecord();
  const createPerformanceRecord = useCreatePerformanceRecord();
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedAnimalIds, setSelectedAnimalIds] = useState<number[]>([]);
  const [bulkAction, setBulkAction] = useState<string>("");
  const [bulkValue, setBulkValue] = useState("");
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // PDF Export Dialog state
  const [isPdfExportDialogOpen, setIsPdfExportDialogOpen] = useState(false);
  const [pdfExportType, setPdfExportType] = useState<'fullHerd' | 'rams' | 'ewes' | 'lambs' | 'culled' | 'ramsRegister' | 'ewesRegister'>('fullHerd');
  const [visibleAnimalsCount, setVisibleAnimalsCount] = useState(ANIMALS_INITIAL_VISIBLE_COUNT);
  
  const getDocumentFileName = (type: string, identifier: string) => {
    const date = format(new Date(), "yyyy-MM-dd");
    return `${identifier}_${type}_${date}.pdf`;
  };
  
  // Unified PDF Export Handler with quality selection
  const handlePDFExport = async (quality: PDFQuality): Promise<void> => {
    // Store quality in a ref or call export functions directly
    // For now, just call the existing functions - quality compression will be added
    switch (pdfExportType) {
      case 'fullHerd':
        exportFullHerdPDF();
        break;
      case 'rams':
        exportHerdPDF("rams");
        break;
      case 'ewes':
        exportHerdPDF("ewes");
        break;
      case 'lambs':
        exportHerdPDF("lambs");
        break;
      case 'culled':
        exportCulledPDF();
        break;
      case 'ramsRegister':
        exportRamsPDF();
        break;
      case 'ewesRegister':
        exportEwesPDF();
        break;
    }
    return Promise.resolve();
  };

  const handleRemoveFromHerd = () => {
    if (!animalToRemove) return;
    removeFromHerdMutation.mutate(
      { id: animalToRemove.id, reason: removeReason, notes: removeNotes },
      {
        onSuccess: () => {
          setRemoveDialogOpen(false);
          setAnimalToRemove(null);
          setRemoveReason("sold");
          setRemoveNotes("");
          toast({ title: "Success", description: `${animalToRemove.tagId} removed from herd` });
        },
      }
    );
  };
  const toggleSelected = (id: number) => setSelectedAnimalIds((prev) => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const startSelectionByLongPress = (id: number) => {
    setSelectionMode(true);
    setSelectedAnimalIds((prev) => prev.includes(id) ? prev : [...prev, id]);
  };
  const clearSelection = () => { setSelectionMode(false); setSelectedAnimalIds([]); };
  const createBulkTrace = (actionType: string, status: "success" | "failure", extra?: Record<string, any>) => {
    const selected = (allAnimals || []).filter(a => selectedAnimalIds.includes(a.id));
    createExportedDoc.mutate({
      name: `BulkAction_${actionType}_${new Date().toISOString().slice(0,10)}`,
      documentType: "productivity",
      subfolder: "productivity",
      metadata: { actionType, dateTime: new Date().toISOString(), selectedAnimalCount: selected.length, selectedAnimalIds, selectedTagIds: selected.map(a => a.tagId), status, ...extra }
    });
  };
  const runBulkAction = async () => {
    const selected = (allAnimals || []).filter(a => selectedAnimalIds.includes(a.id));
    try {
      if (bulkAction === "assign-sire") {
        for (const a of selected) updateAnimalMutation.mutate({ id: a.id, externalSireInfo: bulkValue } as any);
      } else if (bulkAction === "assign-dam") {
        for (const a of selected) updateAnimalMutation.mutate({ id: a.id, externalDamInfo: bulkValue } as any);
      } else if (bulkAction === "health-event") {
        for (const a of selected) await createHealthRecord.mutateAsync({ animalId: a.id, date: new Date().toISOString().slice(0,10), treatment: bulkValue || "Group health event", diagnosis: null } as any);
      } else if (bulkAction === "record-weight") {
        for (const a of selected) await createPerformanceRecord.mutateAsync({ animalId: a.id, date: new Date().toISOString().slice(0,10), weight: bulkValue } as any);
      } else if (bulkAction === "mark-sold" || bulkAction === "mark-deceased" || bulkAction === "mark-removed" || bulkAction === "mark-culled") {
        const reason = bulkAction === "mark-sold" ? "sold" : bulkAction === "mark-deceased" ? "deceased" : "transferred";
        for (const a of selected) removeFromHerdMutation.mutate({ id: a.id, reason: reason as any, notes: "" });
      }
      createBulkTrace(bulkAction, "success", { affectedField: bulkAction, value: bulkValue || "" });
      toast({ title: "Bulk action completed", description: `${bulkAction} applied to ${selected.length} animals` });
      clearSelection();
    } catch {
      createBulkTrace(bulkAction, "failure");
    } finally {
    }
  };

  // Full Herd Export PDF with Rams, Ewes, Lambs sections
  const exportFullHerdPDF = () => {
    if (!allAnimals || !breedingEvents) return;
    const fb = farmSettings;
    const exportDate = format(new Date(), "dd/MM/yyyy HH:mm");
    
    const rams = allAnimals.filter(a => a.sex?.toLowerCase() === "ram");
    const ewes = allAnimals.filter(a => a.sex?.toLowerCase() === "ewe");
    const lambs = allAnimals.filter(a => {
      if (!a.birthDate) return false;
      const birthDate = new Date(a.birthDate);
      const ageInDays = (Date.now() - birthDate.getTime()) / (1000 * 60 * 60 * 24);
      return ageInDays <= 240 && a.status !== 'culled' && a.status !== 'sold' && a.status !== 'dead';
    });
    
    if (rams.length === 0 && ewes.length === 0 && lambs.length === 0) {
      toast({ title: "No Animals", description: "No animals found to export", variant: "destructive" });
      return;
    }
    
    let pagesHtml = "";
    let pageNum = 1;
    
    // Count total pages
    const ramsPerPage = 20;
    const ewesPerPage = 20;
    const lambsPerPage = 20;
    const ramsPages = Math.max(1, Math.ceil(rams.length / ramsPerPage));
    const ewesPages = Math.max(1, Math.ceil(ewes.length / ewesPerPage));
    const lambsPages = Math.max(1, Math.ceil(lambs.length / lambsPerPage));
    const totalPages = (rams.length > 0 ? ramsPages : 0) + (ewes.length > 0 ? ewesPages : 0) + (lambs.length > 0 ? lambsPages : 0);
    
    // SECTION 1: RAMS
    if (rams.length > 0) {
      const ramRows = buildRamExportRows(rams, breedingEvents, allAnimals, []);
      
      for (let page = 0; page < ramsPages; page++) {
        const startIdx = page * ramsPerPage;
        const pageRams = ramRows.slice(startIdx, startIdx + ramsPerPage);
        
        const tableRows = pageRams.map((ram, idx) => {
          const rowNum = startIdx + idx + 1;
          return `<tr>
            <td class="row-num">${rowNum}</td>
            <td><strong>${ram["Ram ID"] || "-"}</strong></td>
            <td>${ram["Date of birth"] || '-'}</td>
            <td>${ram["Number of lambs born from this sire"] || 0}</td>
            <td>-</td>
            <td>${ram["Average 100-day progeny weight"] || '-'}</td>
            <td>${ram["Average 270-day progeny weight"] || '-'}</td>
            <td>${ram["Number of ewes joined"] || 0}</td>
            <td>-</td>
            <td><span class="status status-${ram["Status"] || "active"}">${ram["Status"] || "-"}</span></td>
          </tr>`;
        }).join('');
        
        pagesHtml += `
          <div class="page">
            <div class="header">
              <div class="header-left">
                ${fb?.logoUrl ? `<img src="${fb.logoUrl}" class="logo" />` : ''}
              </div>
              <div class="header-center">
                <h1>${fb?.studName || fb?.farmName || "Full Herd Register"}</h1>
                <p class="subtitle">Complete Livestock Register</p>
              </div>
              <div class="header-right">
                <p>Page ${pageNum} of ${totalPages}</p>
                <p>${exportDate}</p>
              </div>
            </div>
            
            <h2 class="section-title">RAMS</h2>
            
            <table class="animals-table">
              <thead>
                <tr>
                  <th class="row-num">#</th>
                  <th>Ram ID</th>
                  <th>DOB</th>
                  <th>Total Lambs</th>
                  <th>Avg Birth (kg)</th>
                  <th>Avg 100-Day (kg)</th>
                  <th>Avg 270-Day (kg)</th>
                  <th>Twin Count</th>
                  <th>Avg Wean (kg)</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>${tableRows}</tbody>
            </table>
            
            <div class="footer">
              <div class="footer-info">
                <p class="footer-title">${fb?.studName || fb?.farmName || "BreedLog"}</p>
                <p>${fb?.ownerName || ""} ${fb?.ownerPhone ? "| " + fb.ownerPhone : ""}</p>
              </div>
              <div class="footer-branding">
                <p class="breedlog-text">BREEDLOG</p>
                <p class="tagline">Professional Livestock Management</p>
              </div>
            </div>
          </div>
        `;
        pageNum++;
      }
    }
    
    // SECTION 2: EWES
    if (ewes.length > 0) {
      const eweRows = buildEweExportRows(ewes, breedingEvents, []);
      
      for (let page = 0; page < ewesPages; page++) {
        const startIdx = page * ewesPerPage;
        const pageEwes = eweRows.slice(startIdx, startIdx + ewesPerPage);
        
        const tableRows = pageEwes.map((ewe, idx) => {
          const rowNum = startIdx + idx + 1;
          return `<tr>
            <td class="row-num">${rowNum}</td>
            <td><strong>${ewe["Ewe ID"] || "-"}</strong></td>
            <td>${ewe["Date of birth"] || '-'}</td>
            <td>${ewe["Last lambing date"] || '-'}</td>
            <td>${ewe["Lambs born total"] || 0}</td>
            <td>-</td>
            <td>${ewe["Lambs weaned total"] || '-'}</td>
            <td>-</td>
            <td><span class="status status-${ewe["Status"] || "active"}">${ewe["Status"] || "-"}</span></td>
          </tr>`;
        }).join('');
        
        pagesHtml += `
          <div class="page">
            <div class="header">
              <div class="header-left">
                ${fb?.logoUrl ? `<img src="${fb.logoUrl}" class="logo" />` : ''}
              </div>
              <div class="header-center">
                <h1>${fb?.studName || fb?.farmName || "Full Herd Register"}</h1>
                <p class="subtitle">Complete Livestock Register</p>
              </div>
              <div class="header-right">
                <p>Page ${pageNum} of ${totalPages}</p>
                <p>${exportDate}</p>
              </div>
            </div>
            
            <h2 class="section-title">EWES</h2>
            
            <table class="animals-table">
              <thead>
                <tr>
                  <th class="row-num">#</th>
                  <th>Ewe ID</th>
                  <th>Date of Birth</th>
                  <th>First Lamb Date</th>
                  <th>Total Lamb Count</th>
                  <th>ILP (days)</th>
                  <th>Weaned Lamb Count</th>
                  <th>Avg Wean Weight (kg)</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>${tableRows}</tbody>
            </table>
            
            <div class="footer">
              <div class="footer-info">
                <p class="footer-title">${fb?.studName || fb?.farmName || "BreedLog"}</p>
                <p>${fb?.ownerName || ""} ${fb?.ownerPhone ? "| " + fb.ownerPhone : ""}</p>
              </div>
              <div class="footer-branding">
                <p class="breedlog-text">BREEDLOG</p>
                <p class="tagline">Professional Livestock Management</p>
              </div>
            </div>
          </div>
        `;
        pageNum++;
      }
    }
    
    // SECTION 3: LAMBS
    if (lambs.length > 0) {
      const lambBirthRows = buildLambBirthRows(lambs);
      const lambPerfRows = buildLambPerformanceRows(lambs);
      for (let page = 0; page < lambsPages; page++) {
        const startIdx = page * lambsPerPage;
        const pageLambBirthRows = lambBirthRows.slice(startIdx, startIdx + lambsPerPage);
        const pageLambPerfRows = lambPerfRows.slice(startIdx, startIdx + lambsPerPage);
        
        const tableRows = pageLambBirthRows.map((lamb, idx) => {
          const perf = pageLambPerfRows[idx] || {};
          const rowNum = startIdx + idx + 1;
          return `<tr>
            <td class="row-num">${rowNum}</td>
            <td><strong>${lamb["Lamb ID"] || "-"}</strong></td>
            <td>${lamb["Birth status"] || '-'}</td>
            <td>${lamb["Sex"] || '-'}</td>
            <td>${lamb["Birth date"] || '-'}</td>
            <td>${perf["100-day weight"] || '-'}</td>
            <td>${perf["270-day/post-wean weight"] || '-'}</td>
            <td>${perf["Latest/current weight"] || '-'}</td>
            <td><span class="status status-active">active</span></td>
          </tr>`;
        }).join('');
        
        pagesHtml += `
          <div class="page">
            <div class="header">
              <div class="header-left">
                ${fb?.logoUrl ? `<img src="${fb.logoUrl}" class="logo" />` : ''}
              </div>
              <div class="header-center">
                <h1>${fb?.studName || fb?.farmName || "Full Herd Register"}</h1>
                <p class="subtitle">Complete Livestock Register</p>
              </div>
              <div class="header-right">
                <p>Page ${pageNum} of ${totalPages}</p>
                <p>${exportDate}</p>
              </div>
            </div>
            
            <h2 class="section-title">LAMBS</h2>
            
            <table class="animals-table">
              <thead>
                <tr>
                  <th class="row-num">#</th>
                  <th>Lamb ID</th>
                  <th>Name</th>
                  <th>Sex</th>
                  <th>Date of Birth</th>
                  <th>Birth Weight</th>
                  <th>Current Weight</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>${tableRows}</tbody>
            </table>
            
            <div class="footer">
              <div class="footer-info">
                <p class="footer-title">${fb?.studName || fb?.farmName || "BreedLog"}</p>
                <p>${fb?.ownerName || ""} ${fb?.ownerPhone ? "| " + fb.ownerPhone : ""}</p>
              </div>
              <div class="footer-branding">
                <p class="breedlog-text">BREEDLOG</p>
                <p class="tagline">Professional Livestock Management</p>
              </div>
            </div>
          </div>
        `;
        pageNum++;
      }
    }
    
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${fb?.studName || fb?.farmName || "BreedLog"} - Full Herd Register</title>
  <style>
    @page { size: A4 landscape; margin: 10mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 9pt; color: #1a1a1a; background: white; }
    .page { width: 277mm; min-height: 190mm; padding: 6mm; padding-bottom: 28mm; margin: 0 auto; page-break-after: always; position: relative; }
    .page:last-child { page-break-after: avoid; }
    .header { display: flex; align-items: center; justify-content: space-between; padding: 0 2mm 4mm 2mm; border-bottom: 2px solid #FFC300; margin-bottom: 5mm; }
    .header-left { width: 60px; flex-shrink: 0; }
    .logo { width: 50px; height: 50px; object-fit: contain; }
    .header-center { flex: 1; text-align: center; }
    .header-center h1 { font-size: 14pt; font-weight: 800; color: #1a1a1a; text-transform: uppercase; letter-spacing: 1px; }
    .header-center .subtitle { font-size: 8pt; color: #666; margin-top: 3px; }
    .header-right { text-align: right; font-size: 8pt; color: #666; flex-shrink: 0; }
    .section-title { font-size: 12pt; font-weight: 800; color: #1a1a1a; margin-bottom: 4mm; text-transform: uppercase; background: #FFC300; padding: 6px 12px; display: inline-block; border-radius: 3px; }
    .animals-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    .animals-table th { background: #FFC300; color: #000; font-weight: 700; font-size: 7pt; padding: 8px 6px; text-align: left; text-transform: uppercase; vertical-align: middle; }
    .animals-table td { padding: 6px; border-bottom: 1px solid #e0e0e0; font-size: 8pt; vertical-align: middle; text-align: left; }
    .row-num { width: 25px; text-align: center; color: #666; font-size: 7pt; }
    .animals-table tbody tr { height: auto; }
    .animals-table tr:nth-child(even) { background: #fafafa; }
    .status { display: inline-block; padding: 2px 6px; border-radius: 3px; font-size: 6pt; font-weight: 600; text-transform: uppercase; }
    .status-active { background: #22c55e20; color: #16a34a; }
    .status-sold { background: #f59e0b20; color: #d97706; }
    .status-deceased, .status-dead { background: #ef444420; color: #dc2626; }
    .footer { display: flex; align-items: center; justify-content: space-between; border-top: 2px solid #FFC300; background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%); color: white; padding: 4mm 5mm; border-radius: 2mm; position: absolute; bottom: 6mm; left: 6mm; right: 6mm; }
    .footer-info { flex: 1; }
    .footer-title { font-size: 9pt; font-weight: 700; color: #FFC300; }
    .footer-info p { font-size: 7pt; margin-top: 2px; }
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
    createExportedDoc.mutate({
      name: getDocumentFileName("HerdExport", "FullHerd"),
      documentType: "herd",
      subfolder: "herd",
      metadata: { exportType: "pdf", category: "full-herd", sourceSection: "full herd", animalCount: rams.length + ewes.length + lambs.length, pageCount: totalPages, status: "success", rowsSummary: { rams: rams.length, ewes: ewes.length, lambs: lambs.length } }
    });
    toast({ title: "PDF Ready", description: "Full Herd Register export opened for printing" });
  };

  const exportHerdPDF = (exportType: "rams" | "ewes" | "lambs") => {
    if (!allAnimals || !breedingEvents) return;
    const fb = farmSettings;
    const exportDate = format(new Date(), "dd/MM/yyyy HH:mm");
    
    // Filter animals based on export type
    let exportAnimals: Animal[] = [];
    let exportTitle = "";
    let exportSubtitle = "";
    
    switch (exportType) {
      case "rams":
        exportAnimals = allAnimals.filter(a => a.sex?.toLowerCase() === "ram");
        exportTitle = "Rams Register";
        exportSubtitle = "Male Livestock";
        break;
      case "ewes":
        exportAnimals = allAnimals.filter(a => a.sex?.toLowerCase() === "ewe");
        exportTitle = "Ewes Register";
        exportSubtitle = "Breeding Female Livestock";
        break;
      case "lambs":
        exportAnimals = allAnimals.filter(a => {
          if (!a.birthDate) return false;
          const birthDate = new Date(a.birthDate);
          const ageInDays = (Date.now() - birthDate.getTime()) / (1000 * 60 * 60 * 24);
          return ageInDays <= 240 && a.status !== 'culled' && a.status !== 'sold' && a.status !== 'dead';
        });
        exportTitle = "Lambs Register";
        exportSubtitle = "Animals Under 8 Months";
        break;
    }
    
    if (exportAnimals.length === 0) {
      toast({ title: "No Animals", description: `No ${exportType} found to export`, variant: "destructive" });
      return;
    }
    
    // Ewes get special handling with breeding stats columns
    if (exportType === "ewes") {
      const ewesWithStats = exportAnimals.map(ewe => {
        const stats = calculateEweBreedingStats(ewe.id, breedingEvents, allAnimals);
        return { ...ewe, stats };
      });
      
      const ewesPerPage = 20;
      const totalPages = Math.ceil(ewesWithStats.length / ewesPerPage);
      
      let pagesHtml = "";
      for (let page = 0; page < Math.max(1, totalPages); page++) {
        const startIdx = page * ewesPerPage;
        const pageEwes = ewesWithStats.slice(startIdx, startIdx + ewesPerPage);
        
        const tableRows = pageEwes.map((ewe) => {
          return `<tr>
            <td><strong>${ewe.tagId}</strong></td>
            <td>${ewe.birthDate ? format(new Date(ewe.birthDate), "dd/MM/yyyy") : '-'}</td>
            <td>${ewe.stats.firstLambDate ? format(new Date(ewe.stats.firstLambDate), "dd/MM/yyyy") : '-'}</td>
            <td>${ewe.stats.totalLambs}</td>
            <td>${ewe.stats.avgILP || '-'}</td>
            <td>${ewe.stats.lambsWeaned}</td>
            <td>${ewe.stats.avgWeanWeight || '-'}</td>
            <td><span class="status status-${ewe.status}">${ewe.status}</span></td>
          </tr>`;
        }).join('');
        
        pagesHtml += `
          <div class="page">
            <div class="header">
              <div class="header-left">
                ${fb?.logoUrl ? `<img src="${fb.logoUrl}" class="logo" />` : ''}
              </div>
              <div class="header-center">
                <h1>${fb?.studName || fb?.farmName || exportTitle}</h1>
                <p class="subtitle">${exportSubtitle}</p>
              </div>
              <div class="header-right">
                <p>Page ${page + 1} of ${Math.max(1, totalPages)}</p>
                <p>${exportDate}</p>
              </div>
            </div>
            
            <table class="animals-table">
              <thead>
                <tr>
                  <th>Ewe ID</th>
                  <th>Date of Birth</th>
                  <th>First Lamb Date</th>
                  <th>Total Lamb Count</th>
                  <th>ILP (days)</th>
                  <th>Weaned Lamb Count</th>
                  <th>Avg Wean Wt (kg)</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>${tableRows}</tbody>
            </table>
            
            <div class="footer">
              <div class="footer-info">
                <p class="footer-title">${fb?.studName || fb?.farmName || "BreedLog"}</p>
                <p>${fb?.ownerName || ""} ${fb?.ownerPhone ? "| " + fb.ownerPhone : ""}</p>
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
  <title>${fb?.studName || fb?.farmName || "BreedLog"} - ${exportTitle}</title>
  <style>
    @page { size: A4 landscape; margin: 10mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 9pt; color: #1a1a1a; background: white; }
    .page { width: 277mm; min-height: 190mm; padding: 6mm; padding-bottom: 28mm; margin: 0 auto; page-break-after: always; position: relative; }
    .page:last-child { page-break-after: avoid; }
    .header { display: flex; align-items: center; justify-content: space-between; padding: 0 2mm 4mm 2mm; border-bottom: 2px solid #FFC300; margin-bottom: 5mm; }
    .header-left { width: 60px; flex-shrink: 0; }
    .logo { width: 50px; height: 50px; object-fit: contain; }
    .header-center { flex: 1; text-align: center; }
    .header-center h1 { font-size: 14pt; font-weight: 800; color: #1a1a1a; text-transform: uppercase; letter-spacing: 1px; }
    .header-center .subtitle { font-size: 8pt; color: #666; margin-top: 3px; }
    .header-right { text-align: right; font-size: 8pt; color: #666; flex-shrink: 0; }
    .animals-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    .animals-table th { background: #FFC300; color: #000; font-weight: 700; font-size: 7pt; padding: 8px 6px; text-align: left; text-transform: uppercase; vertical-align: middle; }
    .animals-table td { padding: 6px; border-bottom: 1px solid #e0e0e0; font-size: 8pt; vertical-align: middle; text-align: left; }
    .row-num { width: 25px; text-align: center; color: #666; font-size: 7pt; }
    .animals-table tbody tr { height: auto; }
    .animals-table tr:nth-child(even) { background: #fafafa; }
    .status { display: inline-block; padding: 2px 6px; border-radius: 3px; font-size: 6pt; font-weight: 600; text-transform: uppercase; }
    .status-active { background: #22c55e20; color: #16a34a; }
    .status-sold { background: #f59e0b20; color: #d97706; }
    .status-deceased, .status-dead { background: #ef444420; color: #dc2626; }
    .footer { display: flex; align-items: center; justify-content: space-between; border-top: 2px solid #FFC300; background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%); color: white; padding: 4mm 5mm; border-radius: 2mm; position: absolute; bottom: 6mm; left: 6mm; right: 6mm; }
    .footer-info { flex: 1; }
    .footer-title { font-size: 9pt; font-weight: 700; color: #FFC300; }
    .footer-info p { font-size: 7pt; margin-top: 2px; }
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
      createExportedDoc.mutate({
        name: getDocumentFileName("HerdExport", "EwesOnly"),
        documentType: "herd",
        subfolder: "herd",
        metadata: { exportType: "pdf", category: "ewes", sourceSection: "ewes", animalCount: ewesWithStats.length, pageCount: Math.max(1, totalPages), status: "success", rowsSummary: { sample: ewesWithStats.slice(0, 3).map(e => e.tagId) } }
      });
      toast({ title: "PDF Ready", description: `${exportTitle} export opened for printing` });
      return;
    }
    
    // Standard export for rams and lambs
    const animalsPerPage = 20;
    const totalPages = Math.ceil(exportAnimals.length / animalsPerPage);
    
    // Table headers - no photo column
    const tableHeaders = `
      <th style="width:15%">Tag ID</th>
      <th style="width:18%">Name</th>
      <th style="width:10%">Sex</th>
      <th style="width:16%">Breed</th>
      <th style="width:14%">DOB</th>
      <th style="width:12%">Weight</th>
      <th style="width:15%">Status</th>`;
    
    let pagesHtml = "";
    for (let page = 0; page < Math.max(1, totalPages); page++) {
      const startIdx = page * animalsPerPage;
      const pageAnimals = exportAnimals.slice(startIdx, startIdx + animalsPerPage);
      
      const tableRows = pageAnimals.map((a: Animal) => {
        return `<tr>
          <td><strong>${a.tagId}</strong></td>
          <td>${a.name || '-'}</td>
          <td>${a.sex || '-'}</td>
          <td>${a.breed || 'Meatmaster'}</td>
          <td>${a.birthDate ? format(new Date(a.birthDate), "dd/MM/yyyy") : '-'}</td>
          <td>${a.currentWeight ? a.currentWeight + ' kg' : '-'}</td>
          <td><span class="status status-${a.status}">${a.status}</span></td>
        </tr>`;
      }).join('');
      
      pagesHtml += `
        <div class="page">
          <div class="header">
            <div class="header-left">
              ${fb?.logoUrl ? `<img src="${fb.logoUrl}" style="width:60px;height:60px;object-fit:contain;" />` : ''}
            </div>
            <div class="header-center">
              <h1>${fb?.studName || fb?.farmName || exportTitle}</h1>
              <p class="subtitle">${exportSubtitle}</p>
            </div>
            <div class="header-right">
              <p>Page ${page + 1} of ${Math.max(1, totalPages)}</p>
              <p>${exportDate}</p>
            </div>
          </div>
          
          <table class="animals-table">
            <thead><tr>${tableHeaders}</tr></thead>
            <tbody>${tableRows}</tbody>
          </table>
          
          <div class="footer">
            <div class="footer-info">
              <p class="footer-title">${fb?.studName || fb?.farmName || "BreedLog"}</p>
              <p>${fb?.ownerName || ""} ${fb?.ownerPhone ? "| " + fb.ownerPhone : ""}</p>
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
  <title>${fb?.studName || fb?.farmName || "BreedLog"} - ${exportTitle}</title>
  <style>
    @page { size: A4 landscape; margin: 10mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 9pt; color: #1a1a1a; background: white; }
    .page { width: 277mm; min-height: 190mm; padding: 6mm; padding-bottom: 28mm; margin: 0 auto; page-break-after: always; position: relative; }
    .page:last-child { page-break-after: avoid; }
    .header { display: flex; align-items: center; justify-content: space-between; padding: 0 2mm 4mm 2mm; border-bottom: 2px solid #FFC300; margin-bottom: 5mm; }
    .header-left { width: 60px; flex-shrink: 0; }
    .header-center { flex: 1; text-align: center; }
    .header-center h1 { font-size: 14pt; font-weight: 800; color: #1a1a1a; text-transform: uppercase; letter-spacing: 1px; }
    .header-center .subtitle { font-size: 8pt; color: #666; margin-top: 3px; }
    .header-right { text-align: right; font-size: 8pt; color: #666; flex-shrink: 0; }
    .animals-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    .animals-table th { background: #FFC300; color: #000; font-weight: 700; font-size: 7pt; padding: 8px 6px; text-align: left; text-transform: uppercase; vertical-align: middle; }
    .animals-table td { padding: 6px; border-bottom: 1px solid #e0e0e0; font-size: 8pt; vertical-align: middle; text-align: left; }
    .animals-table tbody tr { height: auto; }
    .animals-table tr:nth-child(even) { background: #fafafa; }
    .status { display: inline-block; padding: 2px 6px; border-radius: 3px; font-size: 6pt; font-weight: 600; text-transform: uppercase; }
    .status-active { background: #22c55e20; color: #16a34a; }
    .status-sold { background: #f59e0b20; color: #d97706; }
    .status-deceased, .status-dead { background: #ef444420; color: #dc2626; }
    .footer { display: flex; align-items: center; justify-content: space-between; border-top: 2px solid #FFC300; background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%); color: white; padding: 4mm 5mm; border-radius: 2mm; position: absolute; bottom: 6mm; left: 6mm; right: 6mm; }
    .footer-info { flex: 1; }
    .footer-title { font-size: 9pt; font-weight: 700; color: #FFC300; margin: 0; }
    .footer-info p { font-size: 7pt; margin-top: 2px; color: #d8d8d8; }
    .footer-branding { text-align: right; display: flex; flex-direction: column; align-items: flex-end; }
    .footer-branding .breedlog-text { font-size: 11pt; font-weight: 800; color: white; letter-spacing: 1px; margin: 0; }
    .footer-branding .tagline { font-size: 7pt; font-style: italic; color: #FFC300; margin-top: 2px; }
    @media print {
      .page { page-break-after: always; }
      .page:last-child { page-break-after: avoid; }
      thead { display: table-header-group; }
      body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
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
    createExportedDoc.mutate({
      name: getDocumentFileName("HerdExport", exportType === "rams" ? "RamsOnly" : "LambsOnly"),
      documentType: "herd",
      subfolder: "herd",
      metadata: { exportType: "pdf", category: exportType, sourceSection: exportType, animalCount: exportAnimals.length, pageCount: Math.max(1, totalPages), status: "success" }
    });
    toast({ title: "PDF Ready", description: `${exportTitle} export opened for printing` });
  };

  // Dedicated Ram Export PDF with images
  const exportRamsPDF = () => {
    if (!allAnimals || !breedingEvents) return;
    const fb = farmSettings;
    const exportDate = format(new Date(), "dd/MM/yyyy HH:mm");
    
    const rams = allAnimals.filter(a => a.sex?.toLowerCase() === "ram");
    
    if (rams.length === 0) {
      toast({ title: "No Rams", description: "No rams found to export", variant: "destructive" });
      return;
    }
    
    // Calculate stats for each ram
    const ramsWithStats = rams.map(ram => {
      const stats = calculateRamBreedingStats(ram.id, breedingEvents, allAnimals);
      return { ...ram, stats };
    });
    
    const ramsPerPage = 20;
    const totalPages = Math.ceil(ramsWithStats.length / ramsPerPage);
    
    let pagesHtml = "";
    for (let page = 0; page < Math.max(1, totalPages); page++) {
      const startIdx = page * ramsPerPage;
      const pageRams = ramsWithStats.slice(startIdx, startIdx + ramsPerPage);
      
      const tableRows = pageRams.map((ram) => {
        return `<tr>
          <td><strong>${ram.tagId}</strong></td>
          <td>${ram.birthDate ? format(new Date(ram.birthDate), "dd/MM/yyyy") : '-'}</td>
          <td>${ram.stats.totalLambs || 0}</td>
          <td>${ram.stats.avgBirthWeight || '-'}</td>
          <td>${ram.stats.avgWeight100Day || '-'}</td>
          <td>${ram.stats.avgWeight270Day || '-'}</td>
          <td>${ram.stats.twinCount || 0}</td>
          <td>${ram.stats.avgWeanWeight || '-'}</td>
          <td><span class="status status-${ram.status}">${ram.status}</span></td>
        </tr>`;
      }).join('');
      
      pagesHtml += `
        <div class="page">
          <div class="header">
            <div class="header-left">
              ${fb?.logoUrl ? `<img src="${fb.logoUrl}" style="width:60px;height:60px;object-fit:contain;" />` : ''}
            </div>
            <div class="header-center">
              <h1>${fb?.studName || fb?.farmName || "Rams Register"}</h1>
              <p class="subtitle">Breeding Ram Performance Report</p>
            </div>
            <div class="header-right">
              <p>Page ${page + 1} of ${Math.max(1, totalPages)}</p>
              <p>${exportDate}</p>
            </div>
          </div>
          
          <table class="rams-table">
            <thead>
              <tr>
                <th>Ram ID</th>
                <th>DOB</th>
                <th>Total Lambs</th>
                <th>Avg Birth (kg)</th>
                <th>Avg 100-Day (kg)</th>
                <th>Avg 270-Day (kg)</th>
                <th>Twin Count</th>
                <th>Avg Wean (kg)</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>${tableRows}</tbody>
          </table>
          
          <div class="footer">
            <div class="footer-info">
              <p class="footer-title">${fb?.studName || fb?.farmName || "BreedLog"}</p>
              <p>${fb?.ownerName || ""} ${fb?.ownerPhone ? "| " + fb.ownerPhone : ""}</p>
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
  <title>${fb?.studName || fb?.farmName || "BreedLog"} - Rams Register</title>
  <style>
    @page { size: A4 landscape; margin: 10mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 9pt; color: #1a1a1a; background: white; }
    .page { width: 277mm; min-height: 190mm; padding: 6mm; padding-bottom: 28mm; margin: 0 auto; page-break-after: always; position: relative; }
    .page:last-child { page-break-after: avoid; }
    .header { display: flex; align-items: center; justify-content: space-between; padding: 0 2mm 4mm 2mm; border-bottom: 2px solid #FFC300; margin-bottom: 5mm; }
    .header-left { width: 60px; flex-shrink: 0; }
    .header-center { flex: 1; text-align: center; }
    .header-center h1 { font-size: 14pt; font-weight: 800; color: #1a1a1a; text-transform: uppercase; letter-spacing: 1px; }
    .header-center .subtitle { font-size: 8pt; color: #666; margin-top: 3px; }
    .header-right { text-align: right; font-size: 8pt; color: #666; flex-shrink: 0; }
    .rams-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    .rams-table th { background: #FFC300; color: #000; font-weight: 700; font-size: 7pt; padding: 8px 6px; text-align: left; text-transform: uppercase; vertical-align: middle; }
    .rams-table td { padding: 6px; border-bottom: 1px solid #e0e0e0; font-size: 8pt; vertical-align: middle; text-align: left; }
    .rams-table tbody tr { height: auto; }
    .rams-table tr:nth-child(even) { background: #fafafa; }
    .status { display: inline-block; padding: 2px 6px; border-radius: 3px; font-size: 6pt; font-weight: 600; text-transform: uppercase; }
    .status-active { background: #22c55e20; color: #16a34a; }
    .status-sold { background: #f59e0b20; color: #d97706; }
    .status-deceased, .status-dead { background: #ef444420; color: #dc2626; }
    .footer { display: flex; align-items: center; justify-content: space-between; border-top: 2px solid #FFC300; background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%); color: white; padding: 4mm 5mm; border-radius: 2mm; position: absolute; bottom: 6mm; left: 6mm; right: 6mm; }
    .footer-info { flex: 1; }
    .footer-title { font-size: 9pt; font-weight: 700; color: #FFC300; margin: 0; }
    .footer-info p { font-size: 7pt; margin-top: 2px; color: #d8d8d8; }
    .footer-branding { text-align: right; display: flex; flex-direction: column; align-items: flex-end; }
    .footer-branding .breedlog-text { font-size: 11pt; font-weight: 800; color: white; letter-spacing: 1px; margin: 0; }
    .footer-branding .tagline { font-size: 7pt; font-style: italic; color: #FFC300; margin-top: 2px; }
    @media print {
      .page { page-break-after: always; }
      .page:last-child { page-break-after: avoid; }
      thead { display: table-header-group; }
      body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
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
    createExportedDoc.mutate({
      name: getDocumentFileName("RamsRegister", "Full"),
      documentType: "herd",
      subfolder: "herd",
      metadata: { exportType: "pdf", category: "rams-register", sourceSection: "rams", animalCount: rams.length, pageCount: Math.max(1, totalPages), status: "success" }
    });
    toast({ title: "PDF Ready", description: "Rams Register export opened for printing" });
  };

  const exportEwesPDF = () => {
    if (!allAnimals || !breedingEvents) return;
    const fb = farmSettings;
    const exportDate = format(new Date(), "dd/MM/yyyy HH:mm");
    
    const ewes = allAnimals.filter(a => 
      a.sex?.toLowerCase() === "ewe" && 
      a.status !== 'culled' && 
      a.status !== 'sold' &&
      a.status !== 'dead'
    );
    
    if (ewes.length === 0) {
      toast({ title: "No Ewes", description: "No ewes found to export", variant: "destructive" });
      return;
    }
    
    const ewesWithStats = ewes.map(ewe => {
      const stats = calculateEweBreedingStats(ewe.id, breedingEvents, allAnimals);
      return { ...ewe, stats };
    });
    
    const ewesPerPage = 20;
    const totalPages = Math.ceil(ewesWithStats.length / ewesPerPage);
    
    let pagesHtml = "";
    for (let page = 0; page < Math.max(1, totalPages); page++) {
      const startIdx = page * ewesPerPage;
      const pageEwes = ewesWithStats.slice(startIdx, startIdx + ewesPerPage);
      
      const tableRows = pageEwes.map((ewe) => {
        return `<tr>
          <td><strong>${ewe.tagId}</strong></td>
          <td>${ewe.birthDate ? format(new Date(ewe.birthDate), "dd/MM/yyyy") : '-'}</td>
          <td>${ewe.stats.totalLambs || 0}</td>
          <td>${ewe.stats.firstLambDate ? format(ewe.stats.firstLambDate, "dd/MM/yyyy") : '-'}</td>
          <td>${ewe.stats.avgILP || '-'}</td>
          <td>${ewe.stats.lambsWeaned || 0}</td>
          <td>${ewe.stats.avgWeanWeight || '-'}</td>
          <td><span class="status status-${ewe.status}">${ewe.status}</span></td>
        </tr>`;
      }).join('');
      
      pagesHtml += `
        <div class="page">
          <div class="header">
            <div class="header-left">
              ${fb?.logoUrl ? `<img src="${fb.logoUrl}" style="width:60px;height:60px;object-fit:contain;" />` : ''}
            </div>
            <div class="header-center">
              <h1>${fb?.studName || fb?.farmName || "Ewes Register"}</h1>
              <p class="subtitle">Breeding Ewe Performance Report</p>
            </div>
            <div class="header-right">
              <p>Page ${page + 1} of ${Math.max(1, totalPages)}</p>
              <p>${exportDate}</p>
            </div>
          </div>
          
          <table class="ewes-table">
            <thead>
              <tr>
                <th>Ewe ID</th>
                <th>DOB</th>
                <th># Lambs</th>
                <th>First Lamb</th>
                <th>Avg ILP</th>
                <th>Lambs Weaned</th>
                <th>Avg Wean (kg)</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>${tableRows}</tbody>
          </table>
          
          <div class="footer">
            <div class="footer-info">
              <p class="footer-title">${fb?.studName || fb?.farmName || "BreedLog"}</p>
              <p>${fb?.ownerName || ""} ${fb?.ownerPhone ? "| " + fb.ownerPhone : ""}</p>
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
  <title>Ewes Register - ${fb?.studName || fb?.farmName || "BreedLog"}</title>
  <style>
    @page { size: A4 landscape; margin: 10mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 9pt; color: #1a1a1a; background: white; }
    .page { width: 277mm; min-height: 190mm; padding: 6mm; padding-bottom: 28mm; margin: 0 auto; page-break-after: always; position: relative; }
    .page:last-child { page-break-after: avoid; }
    .header { display: flex; align-items: center; justify-content: space-between; padding: 0 2mm 4mm 2mm; border-bottom: 2px solid #FFC300; margin-bottom: 5mm; }
    .header-left { width: 60px; flex-shrink: 0; }
    .header-center { flex: 1; text-align: center; }
    .header-center h1 { font-size: 14pt; font-weight: 800; color: #1a1a1a; text-transform: uppercase; letter-spacing: 1px; }
    .header-center .subtitle { font-size: 8pt; color: #666; margin-top: 3px; }
    .header-right { text-align: right; font-size: 8pt; color: #666; flex-shrink: 0; }
    .ewes-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    .ewes-table th { background: #FFC300; color: #000; font-weight: 700; font-size: 7pt; padding: 8px 6px; text-align: left; text-transform: uppercase; vertical-align: middle; }
    .ewes-table td { padding: 6px; border-bottom: 1px solid #e0e0e0; font-size: 8pt; vertical-align: middle; text-align: left; }
    .ewes-table tbody tr:nth-child(even) { background: #fafafa; }
    .status { display: inline-block; padding: 2px 6px; border-radius: 3px; font-size: 6pt; font-weight: 600; text-transform: uppercase; }
    .status-active { background: #22c55e20; color: #16a34a; }
    .status-sold { background: #f59e0b20; color: #d97706; }
    .status-deceased, .status-dead { background: #ef444420; color: #dc2626; }
    .footer { display: flex; align-items: center; justify-content: space-between; border-top: 2px solid #FFC300; background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%); color: white; padding: 4mm 5mm; border-radius: 2mm; position: absolute; bottom: 6mm; left: 6mm; right: 6mm; }
    .footer-info { flex: 1; }
    .footer-title { font-size: 9pt; font-weight: 700; color: #FFC300; margin: 0; }
    .footer-info p { font-size: 7pt; margin-top: 2px; color: #d8d8d8; }
    .footer-branding { text-align: right; display: flex; flex-direction: column; align-items: flex-end; }
    .footer-branding .breedlog-text { font-size: 11pt; font-weight: 800; color: white; letter-spacing: 1px; margin: 0; }
    .footer-branding .tagline { font-size: 7pt; font-style: italic; color: #FFC300; margin-top: 2px; }
    @media print {
      .page { page-break-after: always; }
      .page:last-child { page-break-after: avoid; }
      thead { display: table-header-group; }
      body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
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
    createExportedDoc.mutate({
      name: getDocumentFileName("EwesRegister", "Full"),
      documentType: "herd",
      subfolder: "herd",
      metadata: { exportType: "pdf", category: "ewes-register", sourceSection: "ewes", animalCount: ewes.length, pageCount: Math.max(1, totalPages), status: "success" }
    });
    toast({ title: "PDF Ready", description: "Ewes Register export opened for printing" });
  };

  // Export Culled Animals PDF
  const exportCulledPDF = () => {
    if (!allAnimals) return;
    const fb = farmSettings;
    const exportDate = format(new Date(), "dd/MM/yyyy HH:mm");
    
    const culledAnimals = allAnimals.filter(a => 
      a.classification === 'slaughter_cull' || 
      a.ramLambClass === 'cull'
    );
    
    if (culledAnimals.length === 0) {
      toast({ title: "No Culled Animals", description: "No animals marked for cull to export", variant: "destructive" });
      return;
    }
    
    const animalsPerPage = 20;
    const culledRows = buildCullSoldRows(culledAnimals);
    const totalPages = Math.ceil(culledRows.length / animalsPerPage);
    
    let pagesHtml = "";
    for (let page = 0; page < Math.max(1, totalPages); page++) {
      const startIdx = page * animalsPerPage;
      const pageAnimals = culledRows.slice(startIdx, startIdx + animalsPerPage);
      
      const tableRows = pageAnimals.map((animal) => {
        return `<tr>
          <td><strong>${animal["Animal ID"] || "-"}</strong></td>
          <td>${animal["Sex"] || '-'}</td>
          <td>${animal["Breed"] || '-'}</td>
          <td>${animal["Date of birth"] || '-'}</td>
          <td>${animal["Status"] || '-'}</td>
          <td>${animal["Status date"] || '-'}</td>
          <td>${animal["Reason"] || '-'}</td>
          <td>${animal["Latest weight"] || '-'}</td>
          <td>${animal["Notes"] || '-'}</td>
        </tr>`;
      }).join('');
      
      pagesHtml += `
        <div class="page">
          <div class="header">
            <div class="header-left">
              ${fb?.logoUrl ? `<img src="${fb.logoUrl}" style="width:60px;height:60px;object-fit:contain;" />` : ''}
            </div>
            <div class="header-center">
              <h1>${fb?.studName || fb?.farmName || "Culled Animals"}</h1>
              <p class="subtitle">Slaughter/Cull Register</p>
            </div>
            <div class="header-right">
              <p>Page ${page + 1} of ${Math.max(1, totalPages)}</p>
              <p>${exportDate}</p>
            </div>
          </div>
          
          <table class="animals-table">
            <thead>
              <tr>
                <th>Animal ID</th>
                <th>Sex</th>
                <th>Breed</th>
                <th>DOB</th>
                <th>Status</th>
                <th>Status date</th>
                <th>Reason</th>
                <th>Latest weight</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>${tableRows}</tbody>
          </table>
          
          <div class="footer">
            <div class="footer-info">
              <p class="footer-title">${fb?.studName || fb?.farmName || "BreedLog"}</p>
              <p>${fb?.ownerName || ""} ${fb?.ownerPhone ? "| " + fb.ownerPhone : ""}</p>
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
  <title>${fb?.studName || fb?.farmName || "BreedLog"} - Culled Animals</title>
  <style>
    @page { size: A4 landscape; margin: 10mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 9pt; color: #1a1a1a; background: white; }
    .page { width: 277mm; min-height: 190mm; padding: 6mm; padding-bottom: 28mm; margin: 0 auto; page-break-after: always; position: relative; }
    .page:last-child { page-break-after: avoid; }
    .header { display: flex; align-items: center; justify-content: space-between; padding: 0 2mm 4mm 2mm; border-bottom: 2px solid #FFC300; margin-bottom: 5mm; }
    .header-left { width: 60px; flex-shrink: 0; }
    .header-center { flex: 1; text-align: center; }
    .header-center h1 { font-size: 14pt; font-weight: 800; color: #1a1a1a; text-transform: uppercase; letter-spacing: 1px; }
    .header-center .subtitle { font-size: 8pt; color: #666; margin-top: 3px; }
    .header-right { text-align: right; font-size: 8pt; color: #666; flex-shrink: 0; }
    .animals-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    .animals-table th { background: #FFC300; color: #000; font-weight: 700; font-size: 7pt; padding: 8px 6px; text-align: left; text-transform: uppercase; vertical-align: middle; }
    .animals-table td { padding: 6px; border-bottom: 1px solid #e0e0e0; font-size: 8pt; vertical-align: middle; text-align: left; }
    .animals-table tbody tr:nth-child(even) { background: #fafafa; }
    .status { display: inline-block; padding: 2px 6px; border-radius: 3px; font-size: 6pt; font-weight: 600; text-transform: uppercase; }
    .status-active { background: #22c55e20; color: #16a34a; }
    .status-culled { background: #ef444420; color: #dc2626; }
    .status-sold { background: #f59e0b20; color: #d97706; }
    .status-deceased, .status-dead { background: #ef444420; color: #dc2626; }
    .footer { display: flex; align-items: center; justify-content: space-between; border-top: 2px solid #FFC300; background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%); color: white; padding: 4mm 5mm; border-radius: 2mm; position: absolute; bottom: 6mm; left: 6mm; right: 6mm; }
    .footer-info { flex: 1; }
    .footer-title { font-size: 9pt; font-weight: 700; color: #FFC300; margin: 0; }
    .footer-info p { font-size: 7pt; margin-top: 2px; color: #d8d8d8; }
    .footer-branding { text-align: right; display: flex; flex-direction: column; align-items: flex-end; }
    .footer-branding .breedlog-text { font-size: 11pt; font-weight: 800; color: white; letter-spacing: 1px; margin: 0; }
    .footer-branding .tagline { font-size: 7pt; font-style: italic; color: #FFC300; margin-top: 2px; }
    @media print {
      .page { page-break-after: always; }
      .page:last-child { page-break-after: avoid; }
      thead { display: table-header-group; }
      body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    }
  </style>
</head>
<body>${pagesHtml}</body>
</html>`;
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 500);
    }
    createExportedDoc.mutate({
      name: getDocumentFileName("CulledAnimals", "Full"),
      documentType: "herd",
      subfolder: "herd",
      metadata: { exportType: "pdf", category: "culled", sourceSection: "culled", animalCount: culledRows.length, pageCount: Math.max(1, totalPages), status: "success", rowsSummary: culledRows.slice(0, 5) }
    });
    toast({ title: "PDF Ready", description: "Culled Animals export opened for printing" });
  };

  // Update filters AND expand the right section when URL changes
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    setStatusFilter(params.get("status") || "active");
    setClassificationFilter(params.get("classification") || "all");
    setSexFilter(params.get("sex") || "all");
    setAgeFilter(params.get("age") || "all");

    // Deep-link: open the correct collapsible section based on ?section= param
    const section = params.get("section");
    if (section === "rams") {
      setRamsExpanded(true);
      setTotalHerdExpanded(false);
      setEwesExpanded(false);
      setLambsExpanded(false);
      setCulledExpanded(false);
    } else if (section === "ewes") {
      setEwesExpanded(true);
      setTotalHerdExpanded(false);
      setRamsExpanded(false);
      setLambsExpanded(false);
      setCulledExpanded(false);
    } else if (section === "lambs") {
      setLambsExpanded(true);
      setTotalHerdExpanded(false);
      setRamsExpanded(false);
      setEwesExpanded(false);
      setCulledExpanded(false);
    } else if (section === "culled") {
      setCulledExpanded(true);
      setTotalHerdExpanded(false);
      setRamsExpanded(false);
      setEwesExpanded(false);
      setLambsExpanded(false);
    }
  }, [searchParams]);

  const filteredAnimals = allAnimals?.filter(animal => {
    if (statusFilter === "all") {
    } else if (statusFilter === "active") {
      if (animal.status !== "active") return false;
    } else if (statusFilter === "archived") {
      if (!["sold", "dead", "culled"].includes(animal.status || "")) return false;
    } else {
      if (animal.status !== statusFilter) return false;
    }
    
    // Classification filter
    if (classificationFilter !== "all") {
      if (classificationFilter === "stud" && animal.classification !== "stud") return false;
      if (classificationFilter === "commercial" && animal.classification !== "commercial") return false;
      if (classificationFilter === "slaughter_cull" && animal.classification !== "slaughter_cull") return false;
      if (classificationFilter === "unclassified" && animal.classification !== "unclassified" && animal.classification !== null) return false;
    }
    
    if (sexFilter !== "all" && animal.sex?.toLowerCase() !== sexFilter) return false;
    
    // Age filter for lambs (under 8 months / 240 days)
    if (ageFilter === "lamb" && animal.birthDate) {
      const birthDate = new Date(animal.birthDate);
      const ageInDays = (Date.now() - birthDate.getTime()) / (1000 * 60 * 60 * 24);
      if (ageInDays > 240) return false;
    }
    return true;
  });
  const safeFilteredAnimals = filteredAnimals || [];
  const visibleAnimals = useMemo(
    () => safeFilteredAnimals.slice(0, visibleAnimalsCount),
    [safeFilteredAnimals, visibleAnimalsCount]
  );
  const hasMoreFilteredAnimals = safeFilteredAnimals.length > visibleAnimals.length;
  const herdCounts = getHerdCounts(allAnimals || []);

  useEffect(() => {
    setVisibleAnimalsCount(ANIMALS_INITIAL_VISIBLE_COUNT);
  }, [search, statusFilter, classificationFilter, sexFilter, ageFilter, viewMode]);

  return (
    <Layout>
      <div className="space-y-2.5 md:space-y-6 animate-in fade-in duration-500">
        <div className="flex flex-col gap-2">
          <h1 className="text-lg md:text-3xl font-bold tracking-tight leading-tight" data-testid="page-title">
            {displayName ? `${displayName} - My Herd` : "My Herd"} ({herdCounts.activeHerdAnimals})
          </h1>
          <p className="text-xs text-muted-foreground" data-testid="herd-count-summary">
            Active animals on farm: {herdCounts.activeHerdAnimals}
          </p>
          <div className="flex flex-wrap gap-2 items-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="default" 
                  size="sm"
                  disabled={!allAnimals || allAnimals.length === 0}
                  data-testid="button-export-herd"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem 
                  onClick={() => { setPdfExportType('fullHerd'); setIsPdfExportDialogOpen(true); }}
                  data-testid="export-full-herd"
                >
                  Export Full Herd (PDF)
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => { setPdfExportType('rams'); setIsPdfExportDialogOpen(true); }}
                  data-testid="export-rams"
                >
                  Export Rams Only (PDF)
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => { setPdfExportType('ewes'); setIsPdfExportDialogOpen(true); }}
                  data-testid="export-ewes"
                >
                  Export Ewes Only (PDF)
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => { setPdfExportType('lambs'); setIsPdfExportDialogOpen(true); }}
                  data-testid="export-lambs"
                >
                  Export Lambs Only (PDF)
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => { setPdfExportType('culled'); setIsPdfExportDialogOpen(true); }}
                  data-testid="export-culled"
                >
                  Export Culled Animals (PDF)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <EidScanDialog
              open={isScanDialogOpen}
              onOpenChange={setIsScanDialogOpen}
              onCreateFromEid={(electronicId) => {
                setPrefillElectronicId(electronicId);
                setIsDialogOpen(true);
              }}
            />
            <CreateAnimalDialog
              open={isDialogOpen}
              onOpenChange={(open) => {
                setIsDialogOpen(open);
                if (!open) {
                  setPrefillElectronicId(undefined);
                }
              }}
              initialElectronicId={prefillElectronicId}
            />
          </div>
        </div>

        {/* Total Herd Section - Primary browsing experience with search/filters inside */}
        <SectionRibbon
          title="Total Herd (Active)"
          count={herdCounts.activeHerdAnimals}
          isExpanded={totalHerdExpanded}
          onToggle={() => setTotalHerdExpanded(!totalHerdExpanded)}
          testId="ribbon-total-herd"
          actions={
            <Button
              variant="default"
              size="sm"
              onClick={async (e) => {
                e.stopPropagation();
                const { isApiReachable } = await import("@/lib/queryClient");
                const isOnline = await isApiReachable();
                if (!isOnline) {
                  toast({ 
                    title: "Offline", 
                    description: "You must be online to export PDF",
                    variant: "destructive" 
                  });
                  return;
                }
                setPdfExportType('fullHerd');
                setIsPdfExportDialogOpen(true);
              }}
              data-testid="btn-export-total-herd"
            >
              <Download className="w-4 h-4 mr-1" />
              Export PDF
            </Button>
          }
        >
          {/* Search & Filters INSIDE the accordion */}
          <div className="flex flex-col md:flex-row gap-2 bg-card p-2.5 md:p-4 rounded-md border border-border shadow-sm mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Search Tag ID..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 text-sm rugged-input"
                data-testid="input-search"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Select value={classificationFilter} onValueChange={setClassificationFilter}>
                <SelectTrigger className="flex-1 md:w-[140px] text-sm rugged-input" data-testid="select-classification-filter">
                  <Tag className="w-4 h-4 mr-1" />
                  <SelectValue placeholder="Class" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Classes</SelectItem>
                  <SelectItem value="stud">Stud</SelectItem>
                  <SelectItem value="commercial">Commercial</SelectItem>
                  <SelectItem value="slaughter_cull">Slaughter/Cull</SelectItem>
                  <SelectItem value="unclassified">Unclassified</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="flex-1 md:w-[120px] text-sm rugged-input" data-testid="select-status-filter">
                  <Filter className="w-4 h-4 mr-1" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                  <SelectItem value="sold">Sold</SelectItem>
                  <SelectItem value="dead">Dead</SelectItem>
                  <SelectItem value="culled">Culled</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sexFilter} onValueChange={setSexFilter}>
                <SelectTrigger className="flex-1 md:w-[120px] text-sm rugged-input" data-testid="select-sex-filter">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="ewe">Ewes</SelectItem>
                  <SelectItem value="ram">Rams</SelectItem>
                </SelectContent>
              </Select>
              {/* View Mode Toggle */}
              <div className="flex gap-1 border border-border rounded-md p-0.5">
                <Button
                  size="icon"
                  variant={viewMode === "detailed" ? "default" : "ghost"}
                  className="h-8 w-8"
                  onClick={() => setViewMode("detailed")}
                  data-testid="button-view-detailed"
                  title="Detailed View"
                >
                  <LayoutGrid className="w-4 h-4" />
                </Button>
                <Button
                  size="icon"
                  variant={viewMode === "list" ? "default" : "ghost"}
                  className="h-8 w-8"
                  onClick={() => setViewMode("list")}
                  data-testid="button-view-list"
                  title="List View (No Photos)"
                >
                  <List className="w-4 h-4" />
                </Button>
                <Button
                  size="icon"
                  variant={viewMode === "thumbnail" ? "default" : "ghost"}
                  className="h-8 w-8"
                  onClick={() => setViewMode("thumbnail")}
                  data-testid="button-view-thumbnail"
                  title="Thumbnail Grid"
                >
                  <Grid3X3 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Animal List/Grid INSIDE the accordion */}
          {selectionMode && (
            <div className="sticky bottom-20 z-20 bg-card border border-border rounded-md p-2 mb-2" data-testid="bulk-selection-toolbar">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge data-testid="bulk-selected-count">{selectedAnimalIds.length} selected</Badge>
                <Button size="sm" variant="outline" onClick={clearSelection} data-testid="button-clear-selection">Clear</Button>
                <Select value={bulkAction} onValueChange={setBulkAction}>
                  <SelectTrigger className="h-8 w-[180px]" data-testid="select-bulk-action"><SelectValue placeholder="Bulk action" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="assign-sire">Assign sire/father</SelectItem>
                    <SelectItem value="assign-dam">Assign dam/mother</SelectItem>
                    <SelectItem value="health-event">Record health event</SelectItem>
                    <SelectItem value="mark-culled">Mark culled</SelectItem>
                    <SelectItem value="mark-sold">Mark sold</SelectItem>
                    <SelectItem value="mark-deceased">Mark deceased</SelectItem>
                    <SelectItem value="mark-removed">Mark removed/archive</SelectItem>
                    <SelectItem value="record-weight">Record weights</SelectItem>
                  </SelectContent>
                </Select>
                <Input className="h-8 w-[140px]" value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} placeholder="Value/input" data-testid="input-bulk-value" />
                <Button size="sm" onClick={() => { if (window.confirm(`Apply ${bulkAction} to ${selectedAnimalIds.length} selected animals?`)) runBulkAction(); }} disabled={!bulkAction || selectedAnimalIds.length === 0} data-testid="button-confirm-bulk-open">Apply</Button>
              </div>
              {bulkAction === "record-weight" && <p className="text-xs text-muted-foreground mt-1" data-testid="bulk-weight-rule">Apply same weight to all selected animals (explicit action). No automatic average-to-individual overwrite.</p>}
            </div>
          )}
          {isLoading ? (
            <div className="space-y-1.5 md:grid md:grid-cols-2 lg:grid-cols-4 md:gap-4 md:space-y-0">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <Skeleton key={i} className="h-14 md:aspect-[4/3] rounded-md bg-secondary" />
              ))}
            </div>
          ) : viewMode === "thumbnail" ? (
            /* Thumbnail Grid View */
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
              {visibleAnimals.map(animal => (
                <Link key={animal.id} href={`/animals/${animal.id}`}>
                  <div 
                    className={cn("aspect-square rounded-md bg-secondary overflow-hidden border-2 hover:border-primary transition-all cursor-pointer", selectedAnimalIds.includes(animal.id) ? "border-primary" : "border-transparent")}
                    onTouchStart={() => { longPressTimerRef.current = setTimeout(() => startSelectionByLongPress(animal.id), 500); }}
                    onTouchEnd={() => { if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current); }}
                    onClick={(e) => { if (selectionMode) { e.preventDefault(); toggleSelected(animal.id); } }}
                    data-testid={`thumbnail-${animal.id}`}
                  >
                    {animal.photo ? (
                      <img src={animal.photo} alt={animal.tagId} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-secondary">
                        <img src={logo} className="w-8 h-8 grayscale opacity-30" />
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-center mt-1 truncate text-muted-foreground">{animal.tagId}</p>
                </Link>
              ))}
              {safeFilteredAnimals.length === 0 && (
                <div className="col-span-full py-12 text-center text-muted-foreground">
                  <p>No animals found matching your criteria.</p>
                </div>
              )}
            </div>
          ) : viewMode === "list" ? (
            /* List View (No Photos) */
            <div className="border border-border rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-primary text-primary-foreground">
                  <tr>
                    <th className="text-left p-2.5 font-semibold">Tag ID</th>
                    <th className="text-left p-2.5 font-semibold hidden sm:table-cell">Name</th>
                    <th className="text-left p-2.5 font-semibold">Sex</th>
                    <th className="text-left p-2.5 font-semibold hidden md:table-cell">Breed</th>
                    <th className="text-left p-2.5 font-semibold hidden lg:table-cell">DOB</th>
                    <th className="text-left p-2.5 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleAnimals.map((animal, idx) => (
                    <ListRow key={animal.id} animal={animal} idx={idx} selectionMode={selectionMode} isSelected={selectedAnimalIds.includes(animal.id)} onToggleSelect={toggleSelected} onLongPress={startSelectionByLongPress} />
                  ))}
                </tbody>
              </table>
              {safeFilteredAnimals.length === 0 && (
                <div className="py-12 text-center text-muted-foreground">
                  <p>No animals found matching your criteria.</p>
                </div>
              )}
            </div>
          ) : isMobile ? (
            <div className="space-y-1.5">
              {visibleAnimals.map(animal => (
                <AnimalListRow key={animal.id} animal={animal} selectionMode={selectionMode} isSelected={selectedAnimalIds.includes(animal.id)} onToggleSelect={toggleSelected} onLongPress={startSelectionByLongPress} />
              ))}
              {safeFilteredAnimals.length === 0 && (
                <div className="py-8 text-center text-muted-foreground text-xs">
                  <p>No animals found.</p>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {visibleAnimals.map(animal => (
                <AnimalCard key={animal.id} animal={animal} />
              ))}
              {safeFilteredAnimals.length === 0 && (
                <div className="col-span-full py-12 text-center text-muted-foreground">
                  <p>No animals found matching your criteria.</p>
                </div>
              )}
            </div>
          )}
          {safeFilteredAnimals.length > 0 && (
            <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <p className="text-xs text-muted-foreground" data-testid="animals-visible-count">
                Showing {visibleAnimals.length} of {safeFilteredAnimals.length} animals
              </p>
              {hasMoreFilteredAnimals && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setVisibleAnimalsCount((prev) => prev + ANIMALS_LOAD_MORE_STEP)}
                  data-testid="button-load-more-animals"
                >
                  Load more
                </Button>
              )}
            </div>
          )}
        </SectionRibbon>

        {/* RAMS Section - Sibling to Total Herd */}
        <RamsSection 
          allAnimals={allAnimals || []} 
          breedingEvents={breedingEvents || []} 
          onExport={exportRamsPDF}
          isLoading={isLoading}
          isExpanded={ramsExpanded}
          onToggle={() => setRamsExpanded(!ramsExpanded)}
          updateAnimalMutation={updateAnimalMutation}
          classifyMutation={classifyMutation}
        />

        {/* EWES Section - Sibling to Total Herd */}
        <EwesSection 
          allAnimals={allAnimals || []} 
          breedingEvents={breedingEvents || []} 
          onExport={exportEwesPDF}
          isLoading={isLoading}
          isExpanded={ewesExpanded}
          onToggle={() => setEwesExpanded(!ewesExpanded)}
          updateAnimalMutation={updateAnimalMutation}
          classifyMutation={classifyMutation}
        />

        {/* LAMBS Section - Sibling to Total Herd */}
        <LambsSection 
          allAnimals={allAnimals || []} 
          breedingEvents={breedingEvents || []}
          isLoading={isLoading}
          isExpanded={lambsExpanded}
          onToggle={() => setLambsExpanded(!lambsExpanded)}
          onExport={() => exportHerdPDF("lambs")}
          classifyMutation={classifyMutation}
          confirmCullMutation={confirmCullMutation}
          moveToEwesMutation={moveToEwesMutation}
          moveToRamsMutation={moveToRamsMutation}
          updateAnimalMutation={updateAnimalMutation}
        />

        {/* CULLED Section - Archive of removed animals */}
        <CulledSection 
          allAnimals={allAnimals || []} 
          isLoading={isLoading}
          isExpanded={culledExpanded}
          onToggle={() => setCulledExpanded(!culledExpanded)}
          onExport={exportCulledPDF}
        />

        {/* Encouraging message */}
        <div className="text-center py-6 px-4 border-t border-border/30 mt-4">
          <p className="text-sm text-muted-foreground italic max-w-md mx-auto">
            Your flock is your legacy. Track every animal to unlock the full potential of your <span className="text-primary font-medium">genetics</span>.
          </p>
        </div>
      </div>

      {/* Remove from Herd Dialog */}
      <AlertDialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from Herd</AlertDialogTitle>
            <AlertDialogDescription>
              Remove <strong>{animalToRemove?.tagId}</strong> from your active herd. Select the reason below.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 py-2">
            <Select value={removeReason} onValueChange={(v: "sold" | "deceased" | "transferred") => setRemoveReason(v)}>
              <SelectTrigger data-testid="select-remove-reason">
                <SelectValue placeholder="Select reason" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sold">Sold</SelectItem>
                <SelectItem value="deceased">Deceased</SelectItem>
                <SelectItem value="transferred">Transferred</SelectItem>
              </SelectContent>
            </Select>
            <Textarea 
              placeholder="Optional notes..." 
              value={removeNotes}
              onChange={(e) => setRemoveNotes(e.target.value)}
              className="h-16"
              data-testid="input-remove-notes"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveFromHerd}
              disabled={removeFromHerdMutation.isPending}
              data-testid="btn-confirm-remove"
            >
              {removeFromHerdMutation.isPending ? "Removing..." : "Remove from Herd"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* PDF Export Quality Dialog */}
      <Suspense fallback={null}>
        <PDFExportDialog
          open={isPdfExportDialogOpen}
          onOpenChange={setIsPdfExportDialogOpen}
          title={`Export ${
            pdfExportType === 'fullHerd' ? 'Full Herd Register' :
            pdfExportType === 'rams' ? 'Rams Only' :
            pdfExportType === 'ewes' ? 'Ewes Only' :
            pdfExportType === 'lambs' ? 'Lambs Only' :
            pdfExportType === 'culled' ? 'Culled Animals' :
            pdfExportType === 'ramsRegister' ? 'Rams Register' :
            pdfExportType === 'ewesRegister' ? 'Ewes Register' :
            'PDF'
          }`}
          description="Select the quality level for your PDF export. Lower quality means smaller file size and faster export."
          onExport={handlePDFExport}
        />
      </Suspense>
    </Layout>
  );
}

// Collapsible Section Ribbon Component
function SectionRibbon({ 
  title, 
  count, 
  isExpanded, 
  onToggle,
  children,
  actions,
  testId
}: { 
  title: string;
  count: number;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  actions?: React.ReactNode;
  testId?: string;
}) {
  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <div className="border border-border rounded-lg overflow-hidden">
        <CollapsibleTrigger asChild>
          <button 
            type="button"
            className="w-full flex items-center justify-between px-4 py-3 bg-primary/10 cursor-pointer hover:bg-primary/20 transition-colors text-left"
            aria-expanded={isExpanded}
            data-testid={testId || `ribbon-${title.toLowerCase().replace(/\s/g, '-')}`}
          >
            <div className="flex items-center gap-3">
              <ChevronDown 
                className={cn(
                  "w-5 h-5 text-primary transition-transform duration-200",
                  !isExpanded && "-rotate-90"
                )}
              />
              <h2 className="text-base md:text-lg font-bold text-primary uppercase tracking-wide">
                {title} ({count})
              </h2>
            </div>
            {actions && (
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                {actions}
              </div>
            )}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 overflow-hidden">
          {/* Lazy render - only mount children when expanded for performance */}
          {isExpanded && (
            <div className="p-4 pt-2">
              {children}
            </div>
          )}
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

function RamsSection({ 
  allAnimals, 
  breedingEvents, 
  onExport,
  isLoading,
  isExpanded,
  onToggle,
  updateAnimalMutation,
  classifyMutation
}: { 
  allAnimals: Animal[]; 
  breedingEvents: BreedingEvent[];
  onExport: () => void;
  isLoading: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  updateAnimalMutation: ReturnType<typeof useUpdateAnimal>;
  classifyMutation: ReturnType<typeof useClassifyRamLamb>;
}) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [ramTypeFilter, setRamTypeFilter] = useState<"all" | "breeding_ram" | "stud_ram" | "commercial_ram">("all");
  const [selectedAnimal, setSelectedAnimal] = useState<Animal | null>(null);
  const [showWeightDialog, setShowWeightDialog] = useState(false);
  const [weightValue, setWeightValue] = useState("");
  const [weightType, setWeightType] = useState<"100" | "270" | "current">("current");
  const setRamTypeMutation = useSetRamType();

  const handleSaveWeight = () => {
    if (!selectedAnimal || !weightValue) return;
    const today = format(new Date(), "yyyy-MM-dd");
    let updates: Record<string, string> = {};
    if (weightType === "100") {
      updates = { weight100Day: weightValue, weight100DayDate: today };
    } else if (weightType === "270") {
      updates = { weight270Day: weightValue, weight270DayDate: today };
    } else {
      updates = { currentWeight: weightValue };
    }
    updateAnimalMutation.mutate({ id: selectedAnimal.id, ...updates }, {
      onSuccess: () => {
        setShowWeightDialog(false);
        setSelectedAnimal(null);
        setWeightValue("");
        toast({ title: "Weight Recorded", description: `Weight saved for ${selectedAnimal.tagId}` });
      }
    });
  };
  
  const handleClassify = (animal: Animal, ramType: 'breeding_ram' | 'stud_ram' | 'commercial_ram') => {
    setRamTypeMutation.mutate({ id: animal.id, ramType });
  };
  
  // Helper: check if animal is under 8 months old (240 days = lamb)
  const isLamb = (animal: Animal) => {
    if (!animal.birthDate) return false;
    const birthDate = new Date(animal.birthDate);
    const ageInDays = (Date.now() - birthDate.getTime()) / (1000 * 60 * 60 * 24);
    return ageInDays <= 240;
  };
  
  // Adult rams only (8+ months old, active status) - consistent with Dashboard counting
  const allRams = allAnimals.filter(a => 
    a.sex?.toLowerCase() === "ram" && 
    a.status === 'active' &&
    !isLamb(a)
  );
  
  const rams = ramTypeFilter === "all" 
    ? allRams 
    : allRams.filter(r => r.ramType === ramTypeFilter);
  
  if (isLoading) {
    return (
      <div className="mt-8 space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-40 w-full rounded-md" />
      </div>
    );
  }
  
  // Calculate stats for each ram
  const ramsWithStats = rams.map(ram => {
    const stats = calculateRamBreedingStats(ram.id, breedingEvents, allAnimals);
    return { ...ram, stats };
  });

  // Count rams by type
  const breedingCount = allRams.filter(r => r.ramType === 'breeding_ram').length;
  const studCount = allRams.filter(r => r.ramType === 'stud_ram').length;
  const commercialCount = allRams.filter(r => r.ramType === 'commercial_ram').length;

  const handleExportCsv = () => {
    const rows = buildBreedLogCsvRows(rams, undefined, allAnimals || []);
    const csv = buildBreedLogCsvContent(rows);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `breedlog-rams-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportButton = (
    <div className="flex gap-1.5">
      <Button 
        variant="outline" 
        size="sm"
        onClick={handleExportCsv}
        disabled={rams.length === 0}
        data-testid="button-export-rams-csv"
      >
        <FileText className="w-4 h-4 mr-1.5" />
        CSV
      </Button>
      <Button 
        variant="default" 
        size="sm"
        onClick={onExport}
        disabled={rams.length === 0}
        data-testid="button-export-rams-section"
      >
        <Download className="w-4 h-4 mr-1.5" />
        PDF
      </Button>
    </div>
  );

  return (
    <div className="mt-4" data-testid="rams-section">
      <SectionRibbon
        title="Rams"
        count={allRams.length}
        isExpanded={isExpanded}
        onToggle={onToggle}
        actions={exportButton}
        testId="ribbon-rams"
      >
        {/* Filter buttons inside expanded section */}
        <div className="flex items-center gap-1 mb-3 flex-wrap">
          <Button 
            variant={ramTypeFilter === "all" ? "default" : "outline"} 
            size="sm"
            onClick={() => setRamTypeFilter("all")}
            className="text-xs"
            data-testid="filter-rams-all"
          >
            All ({allRams.length})
          </Button>
          <Button 
            variant={ramTypeFilter === "breeding_ram" ? "default" : "outline"} 
            size="sm"
            onClick={() => setRamTypeFilter("breeding_ram")}
            className="text-xs"
            data-testid="filter-rams-breeding"
          >
            Breeding ({breedingCount})
          </Button>
          <Button 
            variant={ramTypeFilter === "stud_ram" ? "default" : "outline"} 
            size="sm"
            onClick={() => setRamTypeFilter("stud_ram")}
            className="text-xs"
            data-testid="filter-rams-stud"
          >
            Stud ({studCount})
          </Button>
          <Button 
            variant={ramTypeFilter === "commercial_ram" ? "default" : "outline"} 
            size="sm"
            onClick={() => setRamTypeFilter("commercial_ram")}
            className="text-xs"
            data-testid="filter-rams-commercial"
          >
            Commercial ({commercialCount})
          </Button>
        </div>

        {rams.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground border border-border rounded-md">
          <p>No rams in your herd yet.</p>
        </div>
      ) : (
        <div className="border border-border rounded-md overflow-x-auto">
          <table className="w-full text-sm min-w-[400px]">
            <thead className="bg-primary text-primary-foreground">
              <tr>
                <th className="text-left p-2.5 font-semibold w-14">Photo</th>
                <th className="text-left p-2.5 font-semibold">Ram ID</th>
                <th className="text-left p-2.5 font-semibold hidden sm:table-cell">Type</th>
                <th className="text-left p-2.5 font-semibold hidden md:table-cell">DOB</th>
                <th className="text-left p-2.5 font-semibold">Lambs</th>
                <th className="text-left p-2.5 font-semibold hidden md:table-cell">Birth (kg)</th>
                <th className="text-left p-2.5 font-semibold hidden sm:table-cell">100-Day</th>
                <th className="text-left p-2.5 font-semibold hidden md:table-cell">270-Day</th>
                <th className="text-left p-2.5 font-semibold hidden md:table-cell">Twins</th>
                <th className="text-left p-2.5 font-semibold hidden md:table-cell">Wean (kg)</th>
                <th className="text-left p-2.5 font-semibold">Status</th>
                <th className="text-left p-2.5 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {ramsWithStats.map((ram, idx) => (
                <tr 
                  key={ram.id}
                  className={cn(
                    "hover:bg-secondary/50 cursor-pointer transition-colors",
                    idx % 2 === 0 ? "bg-card" : "bg-secondary/20"
                  )}
                  onClick={() => setLocation(`/animals/${ram.id}`)}
                  data-testid={`ram-row-${ram.id}`}
                >
                  <td className="p-2">
                    <div className="w-10 h-10 rounded-md bg-secondary overflow-hidden">
                      {ram.photo ? (
                        <img src={ram.photo} alt={ram.tagId} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center opacity-30">
                          <img src={logo} className="w-6 h-6 grayscale" />
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="p-2.5 font-semibold">{ram.tagId}</td>
                  <td className="p-2.5 hidden sm:table-cell">
                    <Badge variant="outline" className="text-xs">
                      {ram.ramType === 'breeding_ram' ? 'Breeding' : 
                       ram.ramType === 'stud_ram' ? 'Stud' : 
                       ram.ramType === 'commercial_ram' ? 'Commercial' : '—'}
                    </Badge>
                  </td>
                  <td className="p-2.5 hidden md:table-cell">
                    {ram.birthDate ? format(new Date(ram.birthDate), "dd/MM/yyyy") : "—"}
                  </td>
                  <td className="p-2.5 text-center">{ram.stats.totalLambs}</td>
                  <td className="p-2.5 text-center hidden md:table-cell">{ram.stats.avgBirthWeight || "—"}</td>
                  <td className="p-2.5 text-center hidden sm:table-cell">{ram.stats.avgWeight100Day || "—"}</td>
                  <td className="p-2.5 text-center hidden md:table-cell">{ram.stats.avgWeight270Day || "—"}</td>
                  <td className="p-2.5 text-center hidden md:table-cell">{ram.stats.twinCount}</td>
                  <td className="p-2.5 text-center hidden md:table-cell">{ram.stats.avgWeanWeight || "—"}</td>
                  <td className="p-2.5">
                    <Badge variant="secondary" className={cn(
                      "text-xs px-1.5",
                      ram.status === 'active' ? "bg-green-900/80 text-green-100" : "bg-secondary text-foreground"
                    )}>
                      {ram.status}
                    </Badge>
                  </td>
                  <td className="p-2.5" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" data-testid={`ram-actions-${ram.id}`}>
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem 
                          onClick={() => {
                            setSelectedAnimal(ram);
                            setWeightType("current");
                            setShowWeightDialog(true);
                          }}
                          data-testid={`ram-weight-${ram.id}`}
                        >
                          <Scale className="w-4 h-4 mr-2" />
                          Record Weight
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleClassify(ram, 'breeding_ram')} data-testid={`ram-breeding-${ram.id}`}>
                          <Tag className="w-4 h-4 mr-2" />
                          Mark as Breeding Ram
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleClassify(ram, 'stud_ram')} data-testid={`ram-stud-${ram.id}`}>
                          <Tag className="w-4 h-4 mr-2" />
                          Mark as Stud Ram
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleClassify(ram, 'commercial_ram')} data-testid={`ram-commercial-${ram.id}`}>
                          <Tag className="w-4 h-4 mr-2" />
                          Mark as Commercial Ram
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
      </SectionRibbon>
      {/* Weight Dialog for Rams */}
      <Dialog open={showWeightDialog} onOpenChange={setShowWeightDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Weight - {selectedAnimal?.tagId}</DialogTitle>
            <DialogDescription>
              Enter the {weightType === "100" ? "100-day" : weightType === "270" ? "270-day" : "current"} weight for this ram.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Weight Type</Label>
              <Select value={weightType} onValueChange={(v) => setWeightType(v as "100" | "270" | "current")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="100">100-Day Weight</SelectItem>
                  <SelectItem value="270">270-Day Weight</SelectItem>
                  <SelectItem value="current">Current Weight</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Weight (kg)</Label>
              <Input 
                type="number" 
                step="0.1"
                value={weightValue}
                onChange={(e) => setWeightValue(e.target.value)}
                placeholder="Enter weight in kg"
                data-testid="input-ram-weight"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowWeightDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveWeight} disabled={!weightValue}>Save Weight</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function getAgeDays(birthDate: string | null): number {
  if (!birthDate) return 0;
  return differenceInDays(new Date(), new Date(birthDate));
}

function EwesSection({ 
  allAnimals, 
  breedingEvents, 
  onExport,
  isLoading,
  isExpanded,
  onToggle,
  updateAnimalMutation,
  classifyMutation
}: { 
  allAnimals: Animal[]; 
  breedingEvents: BreedingEvent[];
  onExport: () => void;
  isLoading: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  updateAnimalMutation: ReturnType<typeof useUpdateAnimal>;
  classifyMutation: ReturnType<typeof useClassifyRamLamb>;
}) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [eweTypeFilter, setEweTypeFilter] = useState<"all" | "stud" | "commercial">("all");
  const [selectedAnimal, setSelectedAnimal] = useState<Animal | null>(null);
  const [showWeightDialog, setShowWeightDialog] = useState(false);
  const [weightValue, setWeightValue] = useState("");
  const [weightType, setWeightType] = useState<"100" | "270" | "current">("current");
  
  const handleSaveWeight = () => {
    if (!selectedAnimal || !weightValue) return;
    const today = format(new Date(), "yyyy-MM-dd");
    let updates: Record<string, string> = {};
    if (weightType === "100") {
      updates = { weight100Day: weightValue, weight100DayDate: today };
    } else if (weightType === "270") {
      updates = { weight270Day: weightValue, weight270DayDate: today };
    } else {
      updates = { currentWeight: weightValue };
    }
    updateAnimalMutation.mutate({ id: selectedAnimal.id, ...updates }, {
      onSuccess: () => {
        setShowWeightDialog(false);
        setSelectedAnimal(null);
        setWeightValue("");
        toast({ title: "Weight Recorded", description: `Weight saved for ${selectedAnimal.tagId}` });
      }
    });
  };
  
  const handleClassify = (animal: Animal, classification: string) => {
    classifyMutation.mutate({ id: animal.id, ramLambClass: classification }, {
      onSuccess: () => {
        toast({ title: "Classification Updated", description: `${animal.tagId} marked as ${classification}` });
      }
    });
  };
  
  // Helper: check if animal is under 8 months old (240 days = lamb)
  const isLamb = (animal: Animal) => {
    if (!animal.birthDate) return false;
    const birthDate = new Date(animal.birthDate);
    const ageInDays = (Date.now() - birthDate.getTime()) / (1000 * 60 * 60 * 24);
    return ageInDays <= 240;
  };
  
  // Adult ewes only (8+ months old, active status) - consistent with Dashboard counting
  const allEwes = allAnimals.filter(a => 
    a.sex?.toLowerCase() === "ewe" && 
    a.status === 'active' &&
    !isLamb(a)
  );
  
  // Filter ewes by type (stud, commercial)
  const ewes = eweTypeFilter === "all" 
    ? allEwes 
    : allEwes.filter(e => e.classification === eweTypeFilter);
  
  // Count ewes by type
  const studCount = allEwes.filter(e => e.classification === 'stud').length;
  const commercialCount = allEwes.filter(e => e.classification === 'commercial').length;
  
  if (isLoading) {
    return (
      <div className="mt-8 space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-40 w-full rounded-md" />
      </div>
    );
  }
  
  const ewesWithStats = ewes.map(ewe => {
    const stats = calculateEweBreedingStats(ewe.id, breedingEvents, allAnimals);
    return { ...ewe, stats };
  });

  const handleExportEwesCsv = () => {
    const rows = buildBreedLogCsvRows(ewes, undefined, allAnimals || []);
    const csv = buildBreedLogCsvContent(rows);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `breedlog-ewes-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportButton = (
    <div className="flex gap-1.5">
      <Button 
        variant="outline" 
        size="sm"
        onClick={handleExportEwesCsv}
        disabled={ewes.length === 0}
        data-testid="button-export-ewes-csv"
      >
        <FileText className="w-4 h-4 mr-1.5" />
        CSV
      </Button>
      <Button 
        variant="default" 
        size="sm"
        onClick={onExport}
        disabled={ewes.length === 0}
        data-testid="button-export-ewes-section"
      >
        <Download className="w-4 h-4 mr-1.5" />
        PDF
      </Button>
    </div>
  );

  return (
    <div className="mt-4" data-testid="ewes-section">
      <SectionRibbon
        title="Ewes"
        count={allEwes.length}
        isExpanded={isExpanded}
        onToggle={onToggle}
        actions={exportButton}
        testId="ribbon-ewes"
      >
        {/* Filter buttons inside expanded section */}
        <div className="flex items-center gap-1 mb-3 flex-wrap">
          <Button 
            variant={eweTypeFilter === "all" ? "default" : "outline"} 
            size="sm"
            onClick={() => setEweTypeFilter("all")}
            data-testid="filter-ewes-all"
          >
            All ({allEwes.length})
          </Button>
          <Button 
            variant={eweTypeFilter === "stud" ? "default" : "outline"} 
            size="sm"
            onClick={() => setEweTypeFilter("stud")}
            data-testid="filter-ewes-stud"
          >
            Stud ({studCount})
          </Button>
          <Button 
            variant={eweTypeFilter === "commercial" ? "default" : "outline"} 
            size="sm"
            onClick={() => setEweTypeFilter("commercial")}
            data-testid="filter-ewes-commercial"
          >
            Commercial ({commercialCount})
          </Button>
        </div>

        {ewes.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground border border-border rounded-md">
          <p>No ewes in your herd yet.</p>
        </div>
      ) : (
        <div className="border border-border rounded-md overflow-x-auto">
          <table className="w-full text-sm min-w-[380px]">
            <thead className="bg-primary text-primary-foreground">
              <tr>
                <th className="text-left p-2.5 font-semibold w-14">Photo</th>
                <th className="text-left p-2.5 font-semibold">Ewe ID</th>
                <th className="text-left p-2.5 font-semibold hidden md:table-cell">DOB</th>
                <th className="text-left p-2.5 font-semibold">Lambs</th>
                <th className="text-left p-2.5 font-semibold hidden md:table-cell">1st Lamb</th>
                <th className="text-left p-2.5 font-semibold hidden sm:table-cell">Avg ILP</th>
                <th className="text-left p-2.5 font-semibold hidden sm:table-cell">Weaned</th>
                <th className="text-left p-2.5 font-semibold hidden md:table-cell">Wean (kg)</th>
                <th className="text-left p-2.5 font-semibold">Status</th>
                <th className="text-left p-2.5 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {ewesWithStats.map((ewe, idx) => (
                <tr 
                  key={ewe.id}
                  className={cn(
                    "hover:bg-secondary/50 cursor-pointer transition-colors",
                    idx % 2 === 0 ? "bg-card" : "bg-secondary/20"
                  )}
                  onClick={() => setLocation(`/animals/${ewe.id}`)}
                  data-testid={`ewe-row-${ewe.id}`}
                >
                  <td className="p-2">
                    <div className="w-10 h-10 rounded-md bg-secondary overflow-hidden">
                      {ewe.photo ? (
                        <img src={ewe.photo} alt={ewe.tagId} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center opacity-30">
                          <img src={logo} className="w-6 h-6 grayscale" />
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="p-2.5 font-semibold" data-testid={`text-ewe-tagid-${ewe.id}`}>{ewe.tagId}</td>
                  <td className="p-2.5 hidden md:table-cell" data-testid={`text-ewe-dob-${ewe.id}`}>
                    {ewe.birthDate ? format(new Date(ewe.birthDate), "dd/MM/yyyy") : "—"}
                  </td>
                  <td className="p-2.5 text-center" data-testid={`text-ewe-lambs-${ewe.id}`}>{ewe.stats.totalLambs}</td>
                  <td className="p-2.5 hidden md:table-cell" data-testid={`text-ewe-firstlamb-${ewe.id}`}>
                    {ewe.stats.firstLambDate ? format(ewe.stats.firstLambDate, "dd/MM/yyyy") : "—"}
                  </td>
                  <td className="p-2.5 text-center hidden sm:table-cell" data-testid={`text-ewe-ilp-${ewe.id}`}>{ewe.stats.avgILP || "—"}</td>
                  <td className="p-2.5 text-center hidden sm:table-cell" data-testid={`text-ewe-weaned-${ewe.id}`}>{ewe.stats.lambsWeaned}</td>
                  <td className="p-2.5 text-center hidden md:table-cell" data-testid={`text-ewe-weanweight-${ewe.id}`}>{ewe.stats.avgWeanWeight || "—"}</td>
                  <td className="p-2.5">
                    <Badge 
                      variant={ewe.status === 'active' ? "default" : "secondary"}
                      className="text-xs px-1.5"
                      data-testid={`badge-ewe-status-${ewe.id}`}
                    >
                      {ewe.status}
                    </Badge>
                  </td>
                  <td className="p-2.5" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" data-testid={`ewe-actions-${ewe.id}`}>
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem 
                          onClick={() => {
                            setSelectedAnimal(ewe);
                            setWeightType("current");
                            setShowWeightDialog(true);
                          }}
                          data-testid={`ewe-weight-${ewe.id}`}
                        >
                          <Scale className="w-4 h-4 mr-2" />
                          Record Weight
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleClassify(ewe, 'stud')} data-testid={`ewe-stud-${ewe.id}`}>
                          <Tag className="w-4 h-4 mr-2" />
                          Mark as Stud
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleClassify(ewe, 'commercial')} data-testid={`ewe-commercial-${ewe.id}`}>
                          <Tag className="w-4 h-4 mr-2" />
                          Mark as Commercial
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleClassify(ewe, 'slaughter_cull')} data-testid={`ewe-cull-${ewe.id}`}>
                          <Tag className="w-4 h-4 mr-2" />
                          Mark for Cull
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
      </SectionRibbon>
      
      {/* Weight Dialog for Ewes */}
      <Dialog open={showWeightDialog} onOpenChange={setShowWeightDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Weight - {selectedAnimal?.tagId}</DialogTitle>
            <DialogDescription>
              Enter the {weightType === "100" ? "100-day" : weightType === "270" ? "270-day" : "current"} weight for this ewe.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Weight Type</Label>
              <Select value={weightType} onValueChange={(v) => setWeightType(v as "100" | "270" | "current")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="100">100-Day Weight</SelectItem>
                  <SelectItem value="270">270-Day Weight</SelectItem>
                  <SelectItem value="current">Current Weight</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Weight (kg)</Label>
              <Input 
                type="number" 
                step="0.1"
                value={weightValue}
                onChange={(e) => setWeightValue(e.target.value)}
                placeholder="Enter weight in kg"
                data-testid="input-ewe-weight"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowWeightDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveWeight} disabled={!weightValue}>Save Weight</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LambsSection({ 
  allAnimals, 
  breedingEvents,
  isLoading,
  isExpanded,
  onToggle,
  onExport,
  classifyMutation,
  confirmCullMutation,
  moveToEwesMutation,
  moveToRamsMutation,
  updateAnimalMutation
}: { 
  allAnimals: Animal[]; 
  breedingEvents: BreedingEvent[];
  isLoading: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  onExport: () => void;
  classifyMutation: ReturnType<typeof useClassifyRamLamb>;
  confirmCullMutation: ReturnType<typeof useConfirmCull>;
  moveToEwesMutation: ReturnType<typeof useMoveToEwes>;
  moveToRamsMutation: ReturnType<typeof useMoveToRams>;
  updateAnimalMutation: ReturnType<typeof useUpdateAnimal>;
}) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [sexFilter, setSexFilter] = useState("all");
  const [classFilter, setClassFilter] = useState("all");
  
  const [selectedAnimal, setSelectedAnimal] = useState<Animal | null>(null);
  const [showCullConfirm, setShowCullConfirm] = useState(false);
  const [showWeightDialog, setShowWeightDialog] = useState(false);
  const [showPromoteDialog, setShowPromoteDialog] = useState(false);
  const [cullReason, setCullReason] = useState("");
  const [weightValue, setWeightValue] = useState("");
  const [weightType, setWeightType] = useState<"100" | "270" | "current">("100");
  const [selectedRamType, setSelectedRamType] = useState<"breeding_ram" | "stud_ram" | "commercial_ram">("breeding_ram");
  
  // Lambs are active animals under 240 days old (8 months) - consistent with Dashboard counting
  // Once an animal reaches 240+ days, they automatically appear in Rams/Ewes section
  const lambs = allAnimals.filter(animal => {
    if (!animal.birthDate) return false;
    const ageDays = getAgeDays(animal.birthDate);
    if (ageDays > 240) return false; // Auto-promote at 8 months
    if (animal.status !== 'active') return false; // Only active animals
    
    if (sexFilter !== "all" && animal.sex !== sexFilter) return false;
    
    if (classFilter === "stud" && animal.ramLambClass !== "stud") return false;
    if (classFilter === "commercial" && animal.ramLambClass !== "commercial") return false;
    if (classFilter === "cull" && animal.ramLambClass !== "cull") return false;
    
    return true;
  });
  
  // Count for filter buttons - active lambs only (under 240 days)
  const ramLambs = allAnimals.filter(a => a.birthDate && getAgeDays(a.birthDate) <= 240 && a.sex === 'ram' && a.status === 'active');
  const eweLambs = allAnimals.filter(a => a.birthDate && getAgeDays(a.birthDate) <= 240 && a.sex === 'ewe' && a.status === 'active');
  
  if (isLoading) {
    return (
      <div className="mt-8 space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-40 w-full rounded-md" />
      </div>
    );
  }

  const handleClassify = (animal: Animal, classification: string) => {
    classifyMutation.mutate({ id: animal.id, ramLambClass: classification });
  };

  const handleConfirmCull = () => {
    if (!selectedAnimal) return;
    confirmCullMutation.mutate({ id: selectedAnimal.id, cullReason }, {
      onSuccess: () => {
        setShowCullConfirm(false);
        setSelectedAnimal(null);
        setCullReason("");
        toast({ title: "Animal Culled", description: `${selectedAnimal.tagId} moved to Culled archive` });
      }
    });
  };

  const handleSaveWeight = () => {
    if (!selectedAnimal || !weightValue) return;
    const today = format(new Date(), "yyyy-MM-dd");
    let updates: Record<string, string> = {};
    if (weightType === "100") {
      updates = { weight100Day: weightValue, weight100DayDate: today };
    } else if (weightType === "270") {
      updates = { weight270Day: weightValue, weight270DayDate: today };
    } else {
      updates = { currentWeight: weightValue };
    }
    
    updateAnimalMutation.mutate({ id: selectedAnimal.id, ...updates }, {
      onSuccess: (updatedAnimal) => {
        setShowWeightDialog(false);
        setSelectedAnimal(null);
        setWeightValue("");
        
        if (weightType === "100" && updatedAnimal.sex === "ewe") {
          moveToEwesMutation.mutate(updatedAnimal.id);
          toast({ title: "Ewe Moved", description: `${updatedAnimal.tagId} moved to Ewes section` });
        }
        
        if (weightType === "270" && updatedAnimal.sex === "ram" && updatedAnimal.ramLambClass === "stud") {
          setSelectedAnimal(updatedAnimal);
          setShowPromoteDialog(true);
        }
      }
    });
  };

  const handlePromoteToRam = () => {
    if (!selectedAnimal) return;
    moveToRamsMutation.mutate({ id: selectedAnimal.id, ramType: selectedRamType }, {
      onSuccess: () => {
        toast({ title: "Ram Promoted", description: `${selectedAnimal.tagId} moved to Rams section as ${selectedRamType.replace('_', ' ')}` });
        setShowPromoteDialog(false);
        setSelectedAnimal(null);
        setSelectedRamType("breeding_ram");
      }
    });
  };

  const handleExportLambsCsv = () => {
    const rows = buildBreedLogCsvRows(lambs, undefined, allAnimals || []);
    const csv = buildBreedLogCsvContent(rows);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `breedlog-lambs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportButton = (
    <div className="flex gap-1.5">
      <Button 
        variant="outline" 
        size="sm"
        onClick={handleExportLambsCsv}
        disabled={lambs.length === 0}
        data-testid="button-export-lambs-csv"
      >
        <FileText className="w-4 h-4 mr-1.5" />
        CSV
      </Button>
      <Button 
        variant="default" 
        size="sm"
        onClick={onExport}
        disabled={lambs.length === 0}
        data-testid="button-export-lambs-section"
      >
        <Download className="w-4 h-4 mr-1.5" />
        PDF
      </Button>
    </div>
  );

  return (
    <div className="mt-4" data-testid="lambs-section">
      <SectionRibbon
        title="Lambs"
        count={lambs.length}
        isExpanded={isExpanded}
        onToggle={onToggle}
        actions={exportButton}
        testId="ribbon-lambs"
      >
        {/* Filter buttons */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <div className="flex items-center gap-1">
            <Button 
              variant={sexFilter === "all" ? "default" : "outline"} 
              size="sm"
              onClick={() => setSexFilter("all")}
              className="text-xs"
              data-testid="filter-lambs-all"
            >
              All ({ramLambs.length + eweLambs.length})
            </Button>
            <Button 
              variant={sexFilter === "ram" ? "default" : "outline"} 
              size="sm"
              onClick={() => setSexFilter("ram")}
              className="text-xs"
              data-testid="filter-lambs-ram"
            >
              Ram ({ramLambs.length})
            </Button>
            <Button 
              variant={sexFilter === "ewe" ? "default" : "outline"} 
              size="sm"
              onClick={() => setSexFilter("ewe")}
              className="text-xs"
              data-testid="filter-lambs-ewe"
            >
              Ewe ({eweLambs.length})
            </Button>
          </div>
          <Select value={classFilter} onValueChange={setClassFilter}>
            <SelectTrigger className="w-[130px] h-7 text-xs" data-testid="select-class-filter">
              <SelectValue placeholder="Classification" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Classes</SelectItem>
              <SelectItem value="stud">Stud</SelectItem>
              <SelectItem value="commercial">Commercial</SelectItem>
              <SelectItem value="cull">Cull</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {lambs.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground border border-border rounded-md">
          <p>No lambs in your herd yet.</p>
        </div>
      ) : (
        <div className="border border-border rounded-md overflow-x-auto">
          <table className="w-full text-sm min-w-[360px]">
            <thead className="bg-primary text-primary-foreground">
              <tr>
                <th className="text-left p-2.5 font-semibold w-14">Photo</th>
                <th className="text-left p-2.5 font-semibold">Lamb ID</th>
                <th className="text-left p-2.5 font-semibold">Sex</th>
                <th className="text-left p-2.5 font-semibold hidden sm:table-cell">DOB</th>
                <th className="text-left p-2.5 font-semibold">Age</th>
                <th className="text-left p-2.5 font-semibold hidden sm:table-cell">Birth Wt</th>
                <th className="text-left p-2.5 font-semibold hidden md:table-cell">100-Day</th>
                <th className="text-left p-2.5 font-semibold hidden md:table-cell">270-Day</th>
                <th className="text-left p-2.5 font-semibold">Status</th>
                <th className="text-left p-2.5 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {lambs.map((lamb, idx) => {
                const ageDays = getAgeDays(lamb.birthDate);
                const stage = calculateLambStage(lamb);
                const needs100Day = ageDays >= 100 && !lamb.weight100Day;
                const needs270Day = ageDays >= 270 && !lamb.weight270Day && lamb.sex === 'ram' && lamb.ramLambClass === 'stud';
                
                return (
                  <tr 
                    key={lamb.id}
                    className={cn(
                      "hover:bg-secondary/50 cursor-pointer transition-colors",
                      idx % 2 === 0 ? "bg-card" : "bg-secondary/20"
                    )}
                    onClick={() => setLocation(`/animals/${lamb.id}`)}
                    data-testid={`lamb-row-${lamb.id}`}
                  >
                    <td className="p-2">
                      <div className="w-10 h-10 rounded-md bg-secondary overflow-hidden">
                        {lamb.photo ? (
                          <img src={lamb.photo} alt={lamb.tagId} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center opacity-30">
                            <img src={logo} className="w-6 h-6 grayscale" />
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-2.5 font-semibold" data-testid={`text-lamb-tagid-${lamb.id}`}>{lamb.tagId}</td>
                    <td className="p-2.5" data-testid={`text-lamb-sex-${lamb.id}`}>
                      <span className={cn(
                        "capitalize",
                        lamb.sex === "ram" ? "text-blue-400" : "text-pink-400"
                      )}>
                        {lamb.sex}
                      </span>
                    </td>
                    <td className="p-2.5 hidden sm:table-cell" data-testid={`text-lamb-dob-${lamb.id}`}>
                      {lamb.birthDate ? format(new Date(lamb.birthDate), "dd/MM/yyyy") : "—"}
                    </td>
                    <td className="p-2.5" data-testid={`text-lamb-age-${lamb.id}`}>{ageDays}d</td>
                    <td className="p-2.5 hidden sm:table-cell" data-testid={`text-lamb-birthweight-${lamb.id}`}>{lamb.birthWeight ? `${lamb.birthWeight} kg` : "—"}</td>
                    <td className="p-2.5 hidden md:table-cell" data-testid={`text-lamb-100day-${lamb.id}`}>
                      {lamb.weight100Day ? (
                        `${lamb.weight100Day} kg`
                      ) : needs100Day ? (
                        <Badge variant="outline" className="text-xs" data-testid={`badge-100day-due-${lamb.id}`}>
                          Due
                        </Badge>
                      ) : "—"}
                    </td>
                    <td className="p-2.5 hidden md:table-cell" data-testid={`text-lamb-270day-${lamb.id}`}>
                      {lamb.weight270Day ? (
                        `${lamb.weight270Day} kg`
                      ) : needs270Day ? (
                        <Badge variant="outline" className="text-xs" data-testid={`badge-270day-due-${lamb.id}`}>
                          Due
                        </Badge>
                      ) : "—"}
                    </td>
                    <td className="p-2.5">
                      <Badge 
                        variant={stage.needsAttention ? "destructive" : "secondary"}
                        className="text-xs px-1.5"
                        data-testid={`badge-lamb-status-${lamb.id}`}
                      >
                        {stage.label}
                      </Badge>
                      <div className="text-xs text-muted-foreground mt-1 max-w-[220px] truncate" title={`${stage.reason} Next: ${stage.nextAction}`}>
                        {stage.reason}
                      </div>
                    </td>
                    <td className="p-2.5" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`lamb-actions-${lamb.id}`}>
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem 
                            onClick={() => {
                              setSelectedAnimal(lamb);
                              setWeightType(needs270Day ? "270" : "100");
                              setShowWeightDialog(true);
                            }}
                            data-testid={`action-weight-${lamb.id}`}
                          >
                            <Scale className="w-4 h-4 mr-2" />
                            Record Weight
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleClassify(lamb, 'stud')} data-testid={`action-stud-${lamb.id}`}>
                            <Tag className="w-4 h-4 mr-2" />
                            Mark as Stud
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleClassify(lamb, 'commercial')} data-testid={`action-commercial-${lamb.id}`}>
                            <Tag className="w-4 h-4 mr-2" />
                            Mark as Commercial
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleClassify(lamb, 'cull')}
                            data-testid={`action-cull-class-${lamb.id}`}
                          >
                            <Tag className="w-4 h-4 mr-2" />
                            Mark for Cull
                          </DropdownMenuItem>
                          {lamb.sex === 'ewe' && (
                            <DropdownMenuItem 
                              onClick={() => {
                                moveToEwesMutation.mutate(lamb.id, {
                                  onSuccess: () => {
                                    toast({ title: "Moved to Ewes", description: `${lamb.tagId} has been moved to the Ewes section` });
                                  }
                                });
                              }}
                              data-testid={`action-move-ewes-${lamb.id}`}
                            >
                              <UserPlus className="w-4 h-4 mr-2" />
                              Move to Ewes
                            </DropdownMenuItem>
                          )}
                          {lamb.sex === 'ram' && (
                            <DropdownMenuItem 
                              onClick={() => {
                                setSelectedAnimal(lamb);
                                setShowPromoteDialog(true);
                              }}
                              data-testid={`action-move-rams-${lamb.id}`}
                            >
                              <UserPlus className="w-4 h-4 mr-2" />
                              Move to Rams
                            </DropdownMenuItem>
                          )}
                          {lamb.ramLambClass === 'cull' && (
                            <DropdownMenuItem 
                              onClick={() => {
                                setSelectedAnimal(lamb);
                                setShowCullConfirm(true);
                              }}
                              data-testid={`action-confirm-cull-${lamb.id}`}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Confirm Cull
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        )}
      </SectionRibbon>

      {/* Weight Dialog */}
      <Dialog open={showWeightDialog} onOpenChange={setShowWeightDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Weight - {selectedAnimal?.tagId}</DialogTitle>
            <DialogDescription>
              Enter the {weightType === "100" ? "100-day" : weightType === "270" ? "270-day" : "current"} weight for this animal.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Weight Type</Label>
              <Select value={weightType} onValueChange={(v) => setWeightType(v as "100" | "270" | "current")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="100">100-Day Weight</SelectItem>
                  <SelectItem value="270">270-Day Weight</SelectItem>
                  <SelectItem value="current">Current Weight</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Weight (kg)</Label>
              <Input 
                type="number" 
                step="0.1"
                value={weightValue}
                onChange={(e) => setWeightValue(e.target.value)}
                placeholder="Enter weight in kg"
                data-testid="input-weight"
              />
            </div>
            {weightType === "100" && selectedAnimal?.sex === "ewe" && (
              <p className="text-sm text-muted-foreground">
                This ewe lamb will be moved to the Ewes section after recording.
              </p>
            )}
            {weightType === "270" && selectedAnimal?.sex === "ram" && selectedAnimal?.ramLambClass === "stud" && (
              <p className="text-sm text-muted-foreground">
                This stud ram will be promoted to the Rams section after recording.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowWeightDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveWeight} disabled={!weightValue}>Save Weight</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cull Confirmation Dialog */}
      <AlertDialog open={showCullConfirm} onOpenChange={setShowCullConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Cull - {selectedAnimal?.tagId}</AlertDialogTitle>
            <AlertDialogDescription>
              This will move the animal to the Culled archive. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label>Cull Reason (optional)</Label>
            <Textarea 
              value={cullReason}
              onChange={(e) => setCullReason(e.target.value)}
              placeholder="Enter reason for culling..."
              className="mt-2"
              data-testid="input-cull-reason"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmCull} className="bg-white text-red-600 border border-red-200 hover:bg-red-50">
              Confirm Cull
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Promote to Ram Dialog */}
      <Dialog open={showPromoteDialog} onOpenChange={setShowPromoteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Promote to Rams - {selectedAnimal?.tagId}</DialogTitle>
            <DialogDescription>
              Select the ram type for this animal before moving to the Rams section.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Ram Type</Label>
              <Select value={selectedRamType} onValueChange={(v) => setSelectedRamType(v as typeof selectedRamType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="breeding_ram">Breeding Ram</SelectItem>
                  <SelectItem value="stud_ram">Stud Ram</SelectItem>
                  <SelectItem value="commercial_ram">Commercial Ram</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPromoteDialog(false)}>Cancel</Button>
            <Button onClick={handlePromoteToRam}>
              <ChevronRight className="w-4 h-4 mr-2" />
              Promote to Rams
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CulledSection({
  allAnimals,
  isLoading,
  isExpanded,
  onToggle,
  onExport
}: {
  allAnimals: Animal[];
  isLoading: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  onExport: () => void;
}) {
  const [, setLocation] = useLocation();
  const [culledSearch, setCulledSearch] = useState("");

  const culledAnimals = allAnimals.filter(a => 
    a.status === 'culled' || a.cullConfirmed === true
  ).filter(a =>
    culledSearch === "" || a.tagId.toLowerCase().includes(culledSearch.toLowerCase())
  );

  const allCulled = allAnimals.filter(a => a.status === 'culled' || a.cullConfirmed === true);

  const handleExportCulledCsv = () => {
    const rows = buildBreedLogCsvRows(allCulled, undefined, allAnimals || []);
    const csv = buildBreedLogCsvContent(rows);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `breedlog-culled-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportButton = (
    <div className="flex gap-1.5">
      <Button
        variant="outline"
        size="sm"
        onClick={handleExportCulledCsv}
        disabled={allCulled.length === 0}
        data-testid="button-export-culled-csv"
      >
        <FileText className="w-4 h-4 mr-1.5" />
        CSV
      </Button>
      <Button
        variant="default"
        size="sm"
        onClick={onExport}
        disabled={allCulled.length === 0}
        data-testid="button-export-culled-section"
      >
        <Download className="w-4 h-4 mr-1.5" />
        PDF
      </Button>
    </div>
  );

  if (isLoading) {
    return (
      <div className="mt-4 space-y-4">
        <Skeleton className="h-12 w-full rounded-md" />
      </div>
    );
  }

  return (
    <div className="mt-4" data-testid="culled-section">
      <SectionRibbon
        title="Culled Archive"
        count={allCulled.length}
        isExpanded={isExpanded}
        onToggle={onToggle}
        actions={exportButton}
        testId="ribbon-culled"
      >
        {/* Search inside section */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search culled animals..."
            value={culledSearch}
            onChange={(e) => setCulledSearch(e.target.value)}
            className="pl-9 text-sm rugged-input"
            data-testid="input-search-culled-section"
          />
        </div>

        {culledAnimals.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground border border-border rounded-md">
            <p>{allCulled.length === 0 ? "No culled animals in archive." : "No results match your search."}</p>
          </div>
        ) : (
          <div className="border border-border rounded-md overflow-x-auto">
            <table className="w-full text-sm min-w-[320px]">
              <thead className="bg-primary text-primary-foreground">
                <tr>
                  <th className="text-left p-2.5 font-semibold">Animal ID</th>
                  <th className="text-left p-2.5 font-semibold hidden sm:table-cell">Sex</th>
                  <th className="text-left p-2.5 font-semibold hidden sm:table-cell">DOB</th>
                  <th className="text-left p-2.5 font-semibold">Cull Date</th>
                  <th className="text-left p-2.5 font-semibold hidden sm:table-cell">Reason</th>
                  <th className="text-left p-2.5 font-semibold hidden md:table-cell">Notes</th>
                </tr>
              </thead>
              <tbody>
                {culledAnimals.map((animal, idx) => (
                  <tr
                    key={animal.id}
                    className={cn(
                      "hover:bg-secondary/50 cursor-pointer transition-colors",
                      idx % 2 === 0 ? "bg-card" : "bg-secondary/20"
                    )}
                    onClick={() => setLocation(`/animals/${animal.id}`)}
                    data-testid={`culled-row-${animal.id}`}
                  >
                    <td className="p-2.5 font-semibold">
                      <div className="flex items-center gap-2 flex-wrap">
                        {animal.tagId}
                        <Badge variant="outline" className="text-xs px-1.5 border-yellow-500/50 text-yellow-500">CULLED</Badge>
                      </div>
                    </td>
                    <td className="p-2.5 capitalize hidden sm:table-cell">{animal.sex || "—"}</td>
                    <td className="p-2.5 hidden sm:table-cell">
                      {animal.birthDate ? format(new Date(animal.birthDate), "dd/MM/yyyy") : "—"}
                    </td>
                    <td className="p-2.5">
                      {animal.cullDate ? format(new Date(animal.cullDate), "dd/MM/yyyy") : "—"}
                    </td>
                    <td className="p-2.5 text-muted-foreground hidden sm:table-cell">{animal.cullReason || "—"}</td>
                    <td className="p-2.5 text-muted-foreground text-xs max-w-[150px] truncate hidden md:table-cell">{animal.notes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionRibbon>
    </div>
  );
}

function ListRow({ animal, idx, selectionMode, isSelected, onToggleSelect, onLongPress }: { animal: Animal; idx: number; selectionMode: boolean; isSelected: boolean; onToggleSelect: (id:number)=>void; onLongPress: (id:number)=>void; }) {
  const [, setLocation] = useLocation();
  
  return (
    <tr 
      className={cn(
        "hover:bg-secondary/50 cursor-pointer transition-colors",
        idx % 2 === 0 ? "bg-card" : "bg-secondary/20"
      )}
      onTouchStart={() => onLongPress(animal.id)}
      onClick={() => selectionMode ? onToggleSelect(animal.id) : setLocation(`/animals/${animal.id}`)}
      data-testid={`list-row-${animal.id}`}
    >
      <td className={cn("p-2.5 font-semibold", isSelected && "text-primary")}>{animal.tagId}</td>
      <td className="p-2.5 hidden sm:table-cell">{animal.name || "—"}</td>
      <td className="p-2.5">
        <span className={cn(
          "capitalize",
          animal.sex === "ram" ? "text-blue-400" : animal.sex === "ewe" ? "text-pink-400" : ""
        )}>
          {animal.sex}
        </span>
      </td>
      <td className="p-2.5 hidden md:table-cell">{animal.breed || "Meatmaster"}</td>
      <td className="p-2.5 hidden lg:table-cell">
        {animal.birthDate ? format(new Date(animal.birthDate), "dd/MM/yyyy") : "—"}
      </td>
      <td className="p-2.5">
        <Badge variant="secondary" className={cn(
          "text-xs px-1.5",
          animal.status === 'active' ? "bg-green-900/80 text-green-100" : "bg-secondary text-foreground"
        )}>
          {animal.status}
        </Badge>
      </td>
    </tr>
  );
}

function AnimalListRow({ animal, selectionMode, isSelected, onToggleSelect, onLongPress }: { animal: Animal; selectionMode: boolean; isSelected: boolean; onToggleSelect: (id:number)=>void; onLongPress: (id:number)=>void; }) {
  const [showImageDialog, setShowImageDialog] = useState(false);
  const isRam = animal.sex?.toLowerCase() === 'ram';
  const isEwe = animal.sex?.toLowerCase() === 'ewe';

  return (
    <>
      <Card className={cn("flex items-center p-2.5 gap-2.5 hover:border-primary transition-colors cursor-pointer", isSelected && "border-primary")} onTouchStart={() => onLongPress(animal.id)} onClick={() => selectionMode ? onToggleSelect(animal.id) : undefined}>
        {/* Clickable image thumbnail */}
        <div 
          className="w-12 h-12 rounded-md bg-secondary overflow-hidden flex-shrink-0 cursor-pointer ring-2 ring-transparent hover:ring-primary/50 transition-all"
          onClick={(e) => {
            e.stopPropagation();
            if (animal.photo) setShowImageDialog(true);
          }}
          data-testid={`image-${animal.id}`}
        >
          {animal.photo ? (
            <img src={animal.photo} alt={animal.tagId} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center opacity-30">
              <img src={logo} className="w-7 h-7 grayscale" />
            </div>
          )}
        </div>
        
        {/* Rest of row - links to detail page */}
        <Link href={`/animals/${animal.id}`} className="flex-1 flex items-center gap-2.5 min-w-0" onClick={(e) => { if (selectionMode) e.preventDefault(); }}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-sm truncate">{animal.tagId}</span>
              <Badge variant="secondary" className={cn(
                "text-xs px-1.5",
                animal.status === 'active' ? "bg-green-900/80 text-green-100" : "bg-secondary text-foreground"
              )}>
                {animal.status}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground truncate">{animal.breed || "Meatmaster"}</p>
            <p className="text-xs text-muted-foreground truncate">
              Source: {animal.animalSource === "born_on_farm" ? "Born on farm" : animal.animalSource === "bought_in" ? "Bought in" : "Unknown / not recorded"}
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <span className={cn(
              "text-xs font-medium capitalize",
              isRam ? "text-blue-400" : isEwe ? "text-pink-400" : "text-muted-foreground"
            )}>
              {animal.sex}
            </span>
          </div>
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.preventDefault()}>
            <Button size="icon" variant="ghost" className="flex-shrink-0" data-testid={`button-menu-${animal.id}`}>
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem asChild data-testid={`button-edit-${animal.id}`}>
              <Link href={`/animals/${animal.id}`}>
                <Edit className="w-4 h-4 mr-2" /> Edit
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </Card>
      
      {/* Image Lightbox Dialog */}
      <Dialog open={showImageDialog} onOpenChange={setShowImageDialog}>
        <DialogContent className="p-0 bg-card border-2 border-primary/50 max-w-md overflow-hidden">
          <div className="relative">
            {animal.photo && (
              <img 
                src={animal.photo} 
                alt={animal.tagId} 
                className="w-full aspect-square object-cover"
              />
            )}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background/95 via-background/70 to-transparent p-4">
              <div className="flex items-center justify-center gap-2">
                <Badge className="text-sm font-bold bg-primary text-primary-foreground px-3 py-1">
                  ID: {animal.tagId}
                </Badge>
                {animal.name && (
                  <span className="text-white/80 text-sm">"{animal.name}"</span>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function CreateAnimalDialog({
  open,
  onOpenChange,
  initialElectronicId,
}: {
  open: boolean,
  onOpenChange: (open: boolean) => void,
  initialElectronicId?: string,
}) {
  const { mutate, isPending } = useCreateAnimal();
  const { toast } = useToast();
  const { data: allAnimals } = useAnimals({});
  const { data: farmSettings } = useFarmSettings();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const evalDocInputRef = useRef<HTMLInputElement>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [evalDocPreview, setEvalDocPreview] = useState<string | null>(null);
  const [useCustomDam, setUseCustomDam] = useState(false);
  const [useCustomSire, setUseCustomSire] = useState(false);
  const [parentPreviewImage, setParentPreviewImage] = useState<{ photo: string; tagId: string } | null>(null);
  
  const form = useForm({
    resolver: zodResolver(insertAnimalSchema),
    defaultValues: {
      tagId: "",
      electronicId: "",
      sex: "ewe",
      breed: "Meatmaster",
      status: "active",
      classification: "unclassified" as string,
      animalSource: "unknown_not_recorded" as string,
      birthDate: new Date().toISOString().split('T')[0],
      birthStatus: "single" as string,
      birthWeight: null as string | null,
      currentWeight: "0",
      weight100Day: null as string | null,
      weight100DayDate: null as string | null,
      weaningStatus: "normal" as string,
      damId: null as number | null,
      sireId: null as number | null,
      externalDamInfo: "" as string,
      externalSireInfo: "" as string,
      photo: null as string | null,
      evaluationDocument: null as string | null,
    }
  });

  const birthStatus = form.watch("birthStatus");
  const watchedTagId = form.watch("tagId");
  const studPrefix = (farmSettings?.studPrefix || "").trim();
  const normalizedTagPreview = splitTagInput(watchedTagId, studPrefix).canonicalTag;

  const ewes = allAnimals?.filter(a => a.sex === "ewe") || [];
  const rams = allAnimals?.filter(a => a.sex === "ram") || [];

  const [isCompressing, setIsCompressing] = useState(false);
  const [submitLocked, setSubmitLocked] = useState(false);
  const [cropSourceImage, setCropSourceImage] = useState<string | null>(null);
  const [showCropDialog, setShowCropDialog] = useState(false);

  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 20 * 1024 * 1024) {
        toast({ title: "Photo too large", description: "Please use a photo under 20MB", variant: "destructive" });
        return;
      }
      
      try {
        setIsCompressing(true);
        toast({ title: "Optimising image...", description: "Please wait" });
        const { compressImageWithFeedback, formatFileSize } = await import("@/lib/image-compression");
        const result = await compressImageWithFeedback(file, { maxWidth: 1600, quality: 0.75 });
        setCropSourceImage(result.base64);
        setShowCropDialog(true);
        const reduction = Math.round((1 - result.compressedSize / result.originalSize) * 100);
        toast({ 
          title: "Photo ready", 
          description: `Optimised to ${formatFileSize(result.compressedSize)} (${reduction}% smaller). Crop before saving.` 
        });
      } catch (error) {
        toast({ title: "Photo error", description: "Failed to process image", variant: "destructive" });
      } finally {
        setIsCompressing(false);
      }
    }
  };

  const handleEvalDocUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast({ title: "File too large", description: "Please use a file under 10MB", variant: "destructive" });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setEvalDocPreview(file.name);
        form.setValue("evaluationDocument", base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearPhoto = () => {
    setPhotoPreview(null);
    form.setValue("photo", null);
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    if (galleryInputRef.current) galleryInputRef.current.value = "";
  };

  const clearEvalDoc = () => {
    setEvalDocPreview(null);
    form.setValue("evaluationDocument", null);
    if (evalDocInputRef.current) evalDocInputRef.current.value = "";
  };

  const setNextTagForCurrentYear = () => {
    const year = new Date().getUTCFullYear();
    const rawNext = nextTagRawSequence((allAnimals || []).map((a) => a.tagId), studPrefix, year);
    form.setValue("tagId", rawNext, { shouldDirty: true, shouldValidate: true });
  };

  const onSubmit = (data: any) => {
    if (submitLocked) return;
    setSubmitLocked(true);
    mutate({
      ...data,
      electronicId: data.electronicId?.trim() || null,
    }, {
      onSuccess: () => {
        onOpenChange(false);
        resetForm();
        toast({ title: "Animal added", description: "New animal record created successfully" });
      },
      onSettled: () => {
        setTimeout(() => setSubmitLocked(false), 500);
      }
    });
  };

  const resetForm = () => {
    form.reset();
    setPhotoPreview(null);
    setEvalDocPreview(null);
    setUseCustomDam(false);
    setUseCustomSire(false);
    setSubmitLocked(false);
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      resetForm();
    }
    onOpenChange(isOpen);
  };

  useEffect(() => {
    if (open && initialElectronicId) {
      form.setValue("electronicId", initialElectronicId);
    }
  }, [form, initialElectronicId, open]);

  return (
    <>
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="default" data-testid="button-add-animal" className="rugged-btn">
          <Plus className="w-5 h-5 mr-2" /> Add Animal
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-card border-border w-full max-w-lg max-h-[90vh] overflow-y-auto mx-2 sm:mx-auto">
        <DialogHeader>
          <DialogTitle className="font-display uppercase text-2xl">New Animal Entry</DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="tagId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tag ID</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. 24-001" className="rugged-input" data-testid="input-tag-id" {...field} />
                    </FormControl>
                    {studPrefix ? (
                      <p className="text-xs text-muted-foreground">
                        Display tag preview: <strong>{normalizedTagPreview || "—"}</strong>
                      </p>
                    ) : (
                      <p className="text-xs text-amber-600">
                        Set stud prefix in Farm Details to apply automatic prefix normalization.
                      </p>
                    )}
                    <Button type="button" variant="outline" size="sm" className="mt-1 h-7 text-xs" onClick={setNextTagForCurrentYear}>
                      Use next sequence
                    </Button>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="sex"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sex</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="rugged-input" data-testid="select-sex">
                          <SelectValue placeholder="Select sex" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="ram">Ram</SelectItem>
                        <SelectItem value="ewe">Ewe</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="electronicId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Electronic ID</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Optional RFID / EID"
                      className="rugged-input"
                      data-testid="input-electronic-id"
                      {...field}
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="breed"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Breed</FormLabel>
                    <FormControl>
                      <Input className="rugged-input" data-testid="input-breed" {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="classification"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Classification</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value || "unclassified"}>
                      <FormControl>
                        <SelectTrigger className="rugged-input" data-testid="select-classification">
                          <SelectValue placeholder="Select classification" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="unclassified">Unclassified</SelectItem>
                        <SelectItem value="stud">Stud</SelectItem>
                        <SelectItem value="commercial">Commercial</SelectItem>
                        <SelectItem value="slaughter_cull">Slaughter/Cull</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="animalSource"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Source</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value || "unknown_not_recorded"}>
                      <FormControl>
                        <SelectTrigger className="rugged-input" data-testid="select-animal-source">
                          <SelectValue placeholder="Select source" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="born_on_farm">Born on farm</SelectItem>
                        <SelectItem value="bought_in">Bought in</SelectItem>
                        <SelectItem value="unknown_not_recorded">Unknown / not recorded</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="birthDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Birth Date *</FormLabel>
                    <FormControl>
                      <Input type="date" className="rugged-input" data-testid="input-birth-date" {...field} value={field.value ? String(field.value) : ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="birthStatus"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Birth Status</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value || "single"}>
                      <FormControl>
                        <SelectTrigger className="rugged-input" data-testid="select-birth-status">
                          <SelectValue placeholder="Select birth status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="single">Single</SelectItem>
                        <SelectItem value="twin">Twin</SelectItem>
                        <SelectItem value="triplet">Triplet</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="currentWeight"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current Weight (kg)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.1" className="rugged-input" data-testid="input-weight" {...field} value={field.value ? String(field.value) : ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="birthWeight"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Birth Weight (kg)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.1" placeholder="Optional" className="rugged-input" data-testid="input-birth-weight" {...field} value={field.value ? String(field.value) : ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* 100-Day Weight Section */}
            <div className="p-3 bg-secondary/30 rounded-md border border-border/50 space-y-3">
              <p className="text-xs font-bold uppercase text-muted-foreground">100-Day Weaning Data</p>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="weight100DayDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>100-Day Weigh Date</FormLabel>
                      <FormControl>
                        <Input type="date" className="rugged-input" data-testid="input-100day-date" {...field} value={field.value ? String(field.value) : ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="weight100Day"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>100-Day Weight (kg)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.1" className="rugged-input" data-testid="input-100day-weight" {...field} value={field.value ? String(field.value) : ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="weaningStatus"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Weaning Status</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      defaultValue={field.value || "normal"}
                      disabled={birthStatus !== "twin" && birthStatus !== "triplet"}
                    >
                      <FormControl>
                        <SelectTrigger className="rugged-input" data-testid="select-weaning-status">
                          <SelectValue placeholder="Select weaning status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="sibling_died_before_weaning">Sibling died before weaning</SelectItem>
                      </SelectContent>
                    </Select>
                    {(birthStatus !== "twin" && birthStatus !== "triplet") && (
                      <p className="text-xs text-muted-foreground">Only applicable for twin/triplet births</p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Dam Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <FormLabel>Dam (Mother)</FormLabel>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm"
                  onClick={() => {
                    setUseCustomDam(!useCustomDam);
                    if (!useCustomDam) form.setValue("damId", null);
                    else form.setValue("externalDamInfo", "");
                  }}
                  data-testid="button-toggle-dam-mode"
                >
                  {useCustomDam ? "Select from list" : "Not in system"}
                </Button>
              </div>
              {useCustomDam ? (
                <FormField
                  control={form.control}
                  name="externalDamInfo"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input 
                          placeholder="Enter dam info (Tag ID, name, breeder)" 
                          className="rugged-input" 
                          data-testid="input-external-dam"
                          {...field} 
                          value={field.value || ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : (
                <FormField
                  control={form.control}
                  name="damId"
                  render={({ field }) => (
                    <FormItem>
                      <Select 
                        onValueChange={(val) => field.onChange(val === "none" ? null : parseInt(val))} 
                        value={field.value ? String(field.value) : "none"}
                      >
                        <FormControl>
                          <SelectTrigger className="rugged-input" data-testid="select-dam">
                            <SelectValue placeholder="Select dam" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="max-h-[300px]">
                          <SelectItem value="none">Unknown</SelectItem>
                          {ewes.map(ewe => (
                            <SelectItem key={ewe.id} value={String(ewe.id)}>
                              <div className="flex items-center gap-2">
                                {ewe.photo ? (
                                  <button
                                    type="button"
                                    className="w-8 h-8 rounded overflow-hidden flex-shrink-0 cursor-zoom-in hover-elevate"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      e.preventDefault();
                                      setParentPreviewImage({ photo: ewe.photo!, tagId: ewe.tagId });
                                    }}
                                    aria-label={`Preview image of ${ewe.tagId}`}
                                    data-testid={`thumbnail-dam-${ewe.id}`}
                                  >
                                    <img src={ewe.photo} alt="" className="w-full h-full object-cover" />
                                  </button>
                                ) : (
                                  <div className="w-8 h-8 rounded bg-muted flex items-center justify-center flex-shrink-0">
                                    <Image className="w-4 h-4 text-muted-foreground" />
                                  </div>
                                )}
                                <span className="truncate">{ewe.tagId} {ewe.name ? `- ${ewe.name}` : ''}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            {/* Sire Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <FormLabel>Sire (Father)</FormLabel>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm"
                  onClick={() => {
                    setUseCustomSire(!useCustomSire);
                    if (!useCustomSire) form.setValue("sireId", null);
                    else form.setValue("externalSireInfo", "");
                  }}
                  data-testid="button-toggle-sire-mode"
                >
                  {useCustomSire ? "Select from list" : "Not in system"}
                </Button>
              </div>
              {useCustomSire ? (
                <FormField
                  control={form.control}
                  name="externalSireInfo"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input 
                          placeholder="Enter sire info (Tag ID, name, breeder)" 
                          className="rugged-input" 
                          data-testid="input-external-sire"
                          {...field} 
                          value={field.value || ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : (
                <FormField
                  control={form.control}
                  name="sireId"
                  render={({ field }) => (
                    <FormItem>
                      <Select 
                        onValueChange={(val) => field.onChange(val === "none" ? null : parseInt(val))} 
                        value={field.value ? String(field.value) : "none"}
                      >
                        <FormControl>
                          <SelectTrigger className="rugged-input" data-testid="select-sire">
                            <SelectValue placeholder="Select sire" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="max-h-[300px]">
                          <SelectItem value="none">Unknown</SelectItem>
                          {rams.map(ram => (
                            <SelectItem key={ram.id} value={String(ram.id)}>
                              <div className="flex items-center gap-2">
                                {ram.photo ? (
                                  <button
                                    type="button"
                                    className="w-8 h-8 rounded overflow-hidden flex-shrink-0 cursor-zoom-in hover-elevate"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      e.preventDefault();
                                      setParentPreviewImage({ photo: ram.photo!, tagId: ram.tagId });
                                    }}
                                    aria-label={`Preview image of ${ram.tagId}`}
                                    data-testid={`thumbnail-sire-${ram.id}`}
                                  >
                                    <img src={ram.photo} alt="" className="w-full h-full object-cover" />
                                  </button>
                                ) : (
                                  <div className="w-8 h-8 rounded bg-muted flex items-center justify-center flex-shrink-0">
                                    <Image className="w-4 h-4 text-muted-foreground" />
                                  </div>
                                )}
                                <span className="truncate">{ram.tagId} {ram.name ? `- ${ram.name}` : ''}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>
            
            {/* Photo Section - Camera & Gallery */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhotoCapture}
              className="hidden"
              data-testid="input-photo-camera"
            />
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoCapture}
              className="hidden"
              data-testid="input-photo-gallery"
            />
            
            {photoPreview ? (
              <div className="relative">
                <img 
                  src={photoPreview} 
                  alt="Preview" 
                  className="w-full h-48 object-cover rounded-md border border-border"
                  data-testid="img-photo-preview"
                />
                <Button 
                  type="button" 
                  variant="outline" 
                  size="icon"
                  className="absolute top-2 right-2"
                  onClick={clearPhoto}
                  data-testid="button-clear-photo"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  data-testid="button-take-photo" 
                  className="rugged-btn border-dashed"
                  onClick={() => cameraInputRef.current?.click()}
                >
                  <Camera className="w-4 h-4 mr-2" /> Camera
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  data-testid="button-select-gallery" 
                  className="rugged-btn border-dashed"
                  onClick={() => galleryInputRef.current?.click()}
                >
                  <Image className="w-4 h-4 mr-2" /> Gallery
                </Button>
              </div>
            )}

            {/* Evaluation Document Upload */}
            <input
              ref={evalDocInputRef}
              type="file"
              accept="image/*,.pdf"
              onChange={handleEvalDocUpload}
              className="hidden"
              data-testid="input-eval-doc"
            />

            <ImageCropDialog
              open={showCropDialog}
              imageSrc={cropSourceImage}
              onCancel={() => {
                setShowCropDialog(false);
                setCropSourceImage(null);
              }}
              onConfirm={(cropped) => {
                setPhotoPreview(cropped);
                form.setValue("photo", cropped);
                setShowCropDialog(false);
                setCropSourceImage(null);
              }}
            />
            
            {evalDocPreview ? (
              <div className="flex items-center justify-between p-3 bg-secondary rounded-md border border-border">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  <span className="text-sm truncate max-w-[200px]">{evalDocPreview}</span>
                </div>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="icon"
                  onClick={clearEvalDoc}
                  data-testid="button-clear-eval-doc"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <Button 
                type="button" 
                variant="outline" 
                data-testid="button-upload-eval-doc" 
                className="w-full rugged-btn border-dashed"
                onClick={() => evalDocInputRef.current?.click()}
              >
                <FileText className="w-4 h-4 mr-2" /> Attach Evaluation Document
              </Button>
            )}

            <Button type="submit" disabled={isPending || submitLocked} data-testid="button-save-animal" className="w-full rugged-btn bg-primary text-primary-foreground">
              {isPending || submitLocked ? "Saving..." : "Save Record"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>

    {/* Parent Image Preview Dialog - rendered as sibling to avoid focus-trap conflicts */}
    <Dialog open={!!parentPreviewImage} onOpenChange={(open) => !open && setParentPreviewImage(null)}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-black/95 border-none">
        <div className="relative w-full h-full flex items-center justify-center min-h-[50vh]">
          <Button
            variant="outline"
            size="icon"
            className="absolute top-2 right-2 z-10"
            onClick={() => setParentPreviewImage(null)}
            data-testid="button-close-parent-preview"
          >
            <X className="w-4 h-4" />
          </Button>
          {parentPreviewImage && (
            <div className="flex flex-col items-center gap-4">
              <img 
                src={parentPreviewImage.photo} 
                alt={parentPreviewImage.tagId}
                className="max-w-full max-h-[80vh] object-contain"
                data-testid="parent-preview-image"
              />
              <span className="text-white text-lg font-semibold">{parentPreviewImage.tagId}</span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}

function EidScanDialog({
  open,
  onOpenChange,
  onCreateFromEid,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateFromEid: (electronicId: string) => void;
}) {
  const { toast } = useToast();
  const [electronicIdRaw, setElectronicIdRaw] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{
    matched: boolean;
    status: "matched" | "unassigned";
    animal: Animal | null;
  } | null>(null);

  const resetState = () => {
    setElectronicIdRaw("");
    setResult(null);
    setIsSubmitting(false);
  };

  const handleDialogChange = (isOpen: boolean) => {
    if (!isOpen) {
      resetState();
    }
    onOpenChange(isOpen);
  };

  const handleScan = async () => {
    const normalized = electronicIdRaw.trim();
    if (!normalized) {
      toast({ title: "EID required", description: "Enter an electronic ID to continue", variant: "destructive" });
      return;
    }

    try {
      setIsSubmitting(true);
      const { getDeviceToken } = await import("@/lib/queryClient");
      const token = getDeviceToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(api.eid.scan.path, {
        method: api.eid.scan.method,
        headers,
        credentials: "include",
        body: JSON.stringify({ electronicIdRaw: normalized }),
      });

      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.message || "Failed to process EID scan");
      }

      setResult(body);
    } catch (error: any) {
      toast({
        title: "Scan failed",
        description: error.message || "Unable to process EID scan",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogChange}>
      <DialogTrigger asChild>
        <Button
          variant="default"
          className="rugged-btn"
          data-testid="button-open-eid-scan"
        >
          <Tag className="w-4 h-4 mr-2" />
          Scan EID
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-card border-border w-full max-w-md mx-2 sm:mx-auto">
        <DialogHeader>
          <DialogTitle className="font-display uppercase text-xl">EID Intake</DialogTitle>
          <DialogDescription>Enter an RFID / EID value to look up an existing animal.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="eid-scan-input">Electronic ID</Label>
            <Input
              id="eid-scan-input"
              value={electronicIdRaw}
              onChange={(e) => setElectronicIdRaw(e.target.value)}
              placeholder="Enter scanned EID"
              data-testid="input-eid-scan"
            />
          </div>

          {result && (
            <Card className="border-border bg-secondary/30">
              <div className="p-4 space-y-2">
                <p className="text-sm font-semibold uppercase text-muted-foreground">
                  {result.matched ? "Matched Animal" : "Unassigned EID"}
                </p>
                {result.matched && result.animal ? (
                  <>
                    <p className="text-lg font-bold">{result.animal.tagId}</p>
                    <p className="text-sm text-muted-foreground">
                      {result.animal.name || "Unnamed"} • {result.animal.sex} • {result.animal.breed}
                    </p>
                    <Link href={`/animals/${result.animal.id}`}>
                      <Button
                        className="w-full mt-2"
                        variant="default"
                        onClick={() => handleDialogChange(false)}
                        data-testid="button-view-matched-animal"
                      >
                        View Animal
                      </Button>
                    </Link>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">
                      No animal is currently assigned to <span className="font-mono">{electronicIdRaw.trim()}</span>.
                    </p>
                    <Button
                      className="w-full mt-2 bg-primary text-primary-foreground"
                      onClick={() => {
                        const normalized = electronicIdRaw.trim();
                        handleDialogChange(false);
                        onCreateFromEid(normalized);
                      }}
                      data-testid="button-create-animal-from-eid"
                    >
                      Create New Animal From This EID
                    </Button>
                  </>
                )}
              </div>
            </Card>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => handleDialogChange(false)}>
              Close
            </Button>
            <Button
              onClick={handleScan}
              disabled={isSubmitting}
              className="bg-primary text-primary-foreground"
              data-testid="button-submit-eid-scan"
            >
              {isSubmitting ? "Checking..." : "Check EID"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
