import { useState } from "react";
import {
  getCanonicalGroupCSS,
  renderExportHeader,
  renderExportFooter,
  wrapExportDocument,
  openExportPrintDialog,
  sanitizePublicNote,
  GROUP_ROWS_PER_PAGE,
} from "@/lib/export-template";
import { PDFExportDialog, usePDFExportDialog } from "@/components/PDFExportDialog";
import type { PDFQuality } from "@/lib/pdf-utils";
import { Layout } from "@/components/Layout";
import { useAnimals } from "@/hooks/use-animals";
import { useBreedingEvents } from "@/hooks/use-breeding";
import { useMatingGroups } from "@/hooks/use-mating-groups";
import { useExportedDocuments, useCreateExportedDocument, useDeleteExportedDocument } from "@/hooks/use-exported-documents";
import { useFarmSettings } from "@/hooks/use-farm-settings";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import {
  Folder,
  FolderOpen,
  Archive,
  Truck,
  Skull,
  FileText,
  BarChart3,
  ChevronRight,
  ArrowLeft,
  Search,
  Download,
  Trash2,
  Filter,
  Calendar,
  Users,
  Heart,
  Activity,
  Layers,
  Tag,
} from "lucide-react";
import { Link } from "wouter";
import { format, parseISO, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import type { Animal, BreedingEvent, MatingGroup } from "@shared/schema";
import { cn } from "@/lib/utils";

type FolderType = "culled" | "sold" | "deceased" | "documents" | "productivity" | null;
type DocumentSubfolder = "herd" | "individual" | "breeding" | "flock-health" | "culled" | "sold" | "deceased" | "productivity" | null;
type ProdTab = "lambing" | "mating";

// Records-tab extra table CSS (appended to canonical group CSS)
const RECORDS_TABLE_CSS = `
  .records-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  .records-table th { background: #FFC300; color: #000; font-weight: 700; font-size: 7pt; padding: 8px 6px; text-align: left; text-transform: uppercase; vertical-align: middle; }
  .records-table td { padding: 5px 6px; border-bottom: 1px solid #e0e0e0; font-size: 7.5pt; vertical-align: middle; text-align: left; }
  .records-table tbody tr:nth-child(even) { background: #fafafa; }
  .meta-line { font-size: 7pt; color: #666; margin-bottom: 4mm; }
`;

export default function Records() {
  const [activeFolder, setActiveFolder] = useState<FolderType>(null);
  const [activeSubfolder, setActiveSubfolder] = useState<DocumentSubfolder>(null);

  // Animal section filters
  const [search, setSearch] = useState("");
  const [sexFilter, setSexFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [reasonFilter, setReasonFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Productivity tab + filters
  const [prodTab, setProdTab] = useState<ProdTab>("lambing");
  const [prodDateFrom, setProdDateFrom] = useState("");
  const [prodDateTo, setProdDateTo] = useState("");

  // Document subfolder filters
  const [docSearch, setDocSearch] = useState("");
  const [docDateFrom, setDocDateFrom] = useState("");
  const [docDateTo, setDocDateTo] = useState("");

  const [docToDelete, setDocToDelete] = useState<{ id: number; name: string } | null>(null);

  const { data: allAnimals, isLoading } = useAnimals({});
  const { data: breedingEvents } = useBreedingEvents();
  const { data: matingGroups } = useMatingGroups();
  const { data: farmSettings } = useFarmSettings();
  const { data: exportedDocs } = useExportedDocuments(activeSubfolder || undefined);
  const { data: allExportedDocs } = useExportedDocuments();
  const createExportedDoc = useCreateExportedDocument();
  const deleteExportedDoc = useDeleteExportedDocument();
  const { toast } = useToast();

  const displayName = farmSettings?.studName || farmSettings?.farmName;
  const farmLabel = displayName || "BreedLog";

  // ── Derived data ──────────────────────────────────────────────────────────
  const culledAnimals = (allAnimals || []).filter(a => a.status === "culled" || a.cullConfirmed === true);
  const soldAnimals = (allAnimals || []).filter(a => a.status === "sold" || a.status === "transferred");
  const deceasedAnimals = (allAnimals || []).filter(a => a.status === "dead" || a.status === "deceased");
  const lambingEvents = (breedingEvents || []).filter(e => e.lambingDate);

  const uniqueCullReasons = Array.from(new Set(culledAnimals.map(a => a.cullReason).filter(Boolean))) as string[];
  const uniqueSoldStatuses = Array.from(new Set(soldAnimals.map(a => a.status).filter(Boolean))) as string[];

  // ── Folder definitions ────────────────────────────────────────────────────
  const folders = [
    { id: "culled" as FolderType, icon: Archive, label: "Culled", description: "Animals removed from herd via culling", count: culledAnimals.length, color: "text-orange-400" },
    { id: "sold" as FolderType, icon: Truck, label: "Sold / Removed", description: "Animals sold or transferred out", count: soldAnimals.length, color: "text-blue-400" },
    { id: "deceased" as FolderType, icon: Skull, label: "Deceased", description: "Animals that have passed away", count: deceasedAnimals.length, color: "text-gray-400" },
    { id: "documents" as FolderType, icon: FileText, label: "Exported Documents", description: "All generated PDF reports, organised by type", count: allExportedDocs?.length || 0, color: "text-yellow-400" },
    { id: "productivity" as FolderType, icon: BarChart3, label: "Productivity Logs", description: "Lambing outcomes, mating groups & performance records", count: lambingEvents.length + (matingGroups?.length || 0), color: "text-green-400" },
  ];

  const documentSubfolders: { id: DocumentSubfolder; label: string; icon: typeof Folder; description: string }[] = [
    { id: "herd", label: "Herd Registers & Exports", icon: Users, description: "Full herd, rams, ewes, lambs registers" },
    { id: "individual", label: "Individual Animal Reports", icon: Tag, description: "Single animal profile exports" },
    { id: "breeding", label: "Breeding & Mating Reports", icon: Heart, description: "Mating group and breeding event reports" },
    { id: "flock-health", label: "Health Records Exports", icon: Activity, description: "Flock health event and treatment reports" },
    { id: "culled", label: "Culled Animal Reports", icon: Archive, description: "Exported culling records" },
    { id: "sold", label: "Sold / Removed Reports", icon: Truck, description: "Exported sale and transfer records" },
    { id: "deceased", label: "Deceased Reports", icon: Skull, description: "Exported mortality records" },
    { id: "productivity", label: "Productivity Exports", icon: Layers, description: "Lambing outcomes and productivity PDFs" },
  ];

  // ── Navigation ────────────────────────────────────────────────────────────
  const handleBack = () => {
    if (activeSubfolder) {
      setActiveSubfolder(null);
      setDocSearch("");
      setDocDateFrom("");
      setDocDateTo("");
    } else {
      setActiveFolder(null);
      setSearch("");
      setSexFilter("all");
      setDateFrom("");
      setDateTo("");
      setReasonFilter("all");
      setStatusFilter("all");
      setProdDateFrom("");
      setProdDateTo("");
    }
  };

  const openFolder = (id: FolderType) => {
    setActiveFolder(id);
    setSearch("");
    setSexFilter("all");
    setDateFrom("");
    setDateTo("");
    setReasonFilter("all");
    setStatusFilter("all");
  };

  const getBreadcrumb = () => {
    const parts = ["Records"];
    if (activeFolder) {
      const folder = folders.find(f => f.id === activeFolder);
      if (folder) parts.push(folder.label);
    }
    if (activeSubfolder) {
      const sf = documentSubfolders.find(s => s.id === activeSubfolder);
      if (sf) parts.push(sf.label);
    }
    return parts;
  };

  // ── Date range helpers ────────────────────────────────────────────────────
  const inDateRange = (dateStr: string | null | undefined, from: string, to: string): boolean => {
    if (!dateStr) return !from && !to;
    try {
      const d = startOfDay(parseISO(dateStr));
      if (from && d < startOfDay(parseISO(from))) return false;
      if (to && d > endOfDay(parseISO(to))) return false;
      return true;
    } catch {
      return true;
    }
  };

  // ── Animal filtering ──────────────────────────────────────────────────────
  const filterAnimals = (animals: Animal[], type: "culled" | "sold" | "deceased") => {
    return animals.filter(a => {
      const textMatch = !search.trim() || (
        a.tagId?.toLowerCase().includes(search.toLowerCase()) ||
        a.name?.toLowerCase().includes(search.toLowerCase()) ||
        a.electronicId?.toLowerCase().includes(search.toLowerCase()) ||
        a.sex?.toLowerCase().includes(search.toLowerCase()) ||
        (type === "culled" && a.cullReason?.toLowerCase().includes(search.toLowerCase()))
      );
      const sexMatch = sexFilter === "all" || a.sex === sexFilter;
      const reasonMatch = type !== "culled" || reasonFilter === "all" || a.cullReason === reasonFilter;
      const statusMatch = type !== "sold" || statusFilter === "all" || a.status === statusFilter;
      const dateField = type === "culled" ? a.cullDate : a.birthDate;
      const dateMatch = inDateRange(dateField, dateFrom, dateTo);
      return textMatch && sexMatch && reasonMatch && statusMatch && dateMatch;
    });
  };

  // ── PDF export state ──────────────────────────────────────────────────────
  const { isOpen: isPdfOpen, exportType: pdfExportType, openDialog: openPdfDialog, closeDialog: closePdfDialog, setIsOpen: setPdfIsOpen } = usePDFExportDialog();

  // ── Canonical PDF builder helpers ─────────────────────────────────────────
  const fb = farmSettings ?? null;
  const css = getCanonicalGroupCSS() + RECORDS_TABLE_CSS;

  const buildPagedPdf = (
    title: string,
    subtitle: string,
    headerRow: string,
    dataRows: string[],
    metaLine: string,
  ): string => {
    const exportDate = format(new Date(), "dd/MM/yyyy HH:mm");
    const rowsPerPage = GROUP_ROWS_PER_PAGE;
    const totalPages = Math.max(1, Math.ceil(dataRows.length / rowsPerPage));
    let pagesHtml = "";
    for (let p = 0; p < totalPages; p++) {
      const slice = dataRows.slice(p * rowsPerPage, (p + 1) * rowsPerPage).join("");
      pagesHtml += `<div class="page">
        ${renderExportHeader(fb, p + 1, totalPages, exportDate, title, subtitle)}
        ${p === 0 ? `<p class="meta-line">${metaLine}</p>` : ""}
        <table class="records-table">
          <thead><tr>${headerRow}</tr></thead>
          <tbody>${slice}</tbody>
        </table>
        ${renderExportFooter(fb)}
      </div>`;
    }
    return wrapExportDocument(title, css, pagesHtml);
  };

  // ── Export: Culled ────────────────────────────────────────────────────────
  const exportCulledPDF = (_quality?: PDFQuality) => {
    const animals = filterAnimals(culledAnimals, "culled");
    if (animals.length === 0) { toast({ title: "No Data", description: "No matching culled animals to export", variant: "destructive" }); return; }
    const rows = animals.map(a => `<tr>
      <td><strong>${a.tagId}</strong></td>
      <td>${a.sex || "Not recorded"}</td>
      <td>${a.birthDate ? format(new Date(a.birthDate), "dd/MM/yyyy") : "Not recorded"}</td>
      <td>${(a as any).cullDate ? format(new Date((a as any).cullDate), "dd/MM/yyyy") : "Not recorded"}</td>
      <td>${(a as any).cullReason || "Not recorded"}</td>
      <td>${sanitizePublicNote(a.notes) || "Not recorded"}</td>
    </tr>`);
    const meta = `Total: ${animals.length}${sexFilter !== "all" ? ` | Sex: ${sexFilter}` : ""}${reasonFilter !== "all" ? ` | Reason: ${reasonFilter}` : ""}${dateFrom || dateTo ? ` | Period: ${dateFrom || "—"} to ${dateTo || "—"}` : ""}`;
    const html = buildPagedPdf("Culled Animals Report", `${farmLabel} — Records`, "<th>Animal ID</th><th>Sex</th><th>DOB</th><th>Cull Date</th><th>Cull Reason</th><th>Notes</th>", rows, meta);
    openExportPrintDialog(html);
    const totalPages = Math.max(1, Math.ceil(animals.length / GROUP_ROWS_PER_PAGE));
    createExportedDoc.mutate({ name: `CulledReport_${format(new Date(), "yyyy-MM-dd_HHmm")}.pdf`, documentType: "culled", subfolder: "culled", metadata: { exportType: "pdf", category: "culled", sourceSection: "records-culled", animalCount: animals.length, pageCount: totalPages, status: "success", filters: { sex: sexFilter, reason: reasonFilter, dateFrom, dateTo } } });
    toast({ title: "PDF Ready", description: `Culled report (${animals.length} animals) opened for printing` });
  };

  const exportCulledCSV = () => {
    const animals = filterAnimals(culledAnimals, "culled");
    if (animals.length === 0) { toast({ title: "No Data", description: "No matching culled animals to export", variant: "destructive" }); return; }
    const header = ["Animal ID", "Sex", "DOB", "Cull Date", "Cull Reason", "Notes"].join(",");
    const rows = animals.map(a => [a.tagId, a.sex || "", a.birthDate ? format(new Date(a.birthDate), "dd/MM/yyyy") : "", a.cullDate ? format(new Date(a.cullDate), "dd/MM/yyyy") : "", a.cullReason || "", (a.notes || "").replace(/,/g, ";")].join(",")).join("\n");
    const blob = new Blob([header + "\n" + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url; link.download = `CulledAnimals_${format(new Date(), "yyyy-MM-dd")}.csv`; link.click(); URL.revokeObjectURL(url);
    createExportedDoc.mutate({ name: `CulledReport_${format(new Date(), "yyyy-MM-dd_HHmm")}.csv`, documentType: "culled", subfolder: "culled", metadata: { exportType: "csv", category: "culled", sourceSection: "records-culled", animalCount: animals.length, status: "success" } });
    toast({ title: "CSV Downloaded", description: `${animals.length} culled animal records exported` });
  };

  // ── Export: Sold ──────────────────────────────────────────────────────────
  const exportSoldPDF = (_quality?: PDFQuality) => {
    const animals = filterAnimals(soldAnimals, "sold");
    if (animals.length === 0) { toast({ title: "No Data", description: "No matching sold/removed animals to export", variant: "destructive" }); return; }
    const rows = animals.map(a => `<tr>
      <td><strong>${a.tagId}</strong></td>
      <td>${a.sex || "Not recorded"}</td>
      <td>${a.birthDate ? format(new Date(a.birthDate), "dd/MM/yyyy") : "Not recorded"}</td>
      <td>${a.status || "Not recorded"}</td>
      <td>${sanitizePublicNote(a.notes) || "Not recorded"}</td>
    </tr>`);
    const meta = `Total: ${animals.length}${sexFilter !== "all" ? ` | Sex: ${sexFilter}` : ""}${statusFilter !== "all" ? ` | Status: ${statusFilter}` : ""}`;
    const html = buildPagedPdf("Sold / Removed Animals Report", `${farmLabel} — Records`, "<th>Animal ID</th><th>Sex</th><th>DOB</th><th>Status</th><th>Notes</th>", rows, meta);
    openExportPrintDialog(html);
    const totalPages = Math.max(1, Math.ceil(animals.length / GROUP_ROWS_PER_PAGE));
    createExportedDoc.mutate({ name: `SoldReport_${format(new Date(), "yyyy-MM-dd_HHmm")}.pdf`, documentType: "sold", subfolder: "sold", metadata: { exportType: "pdf", category: "sold", sourceSection: "records-sold", animalCount: animals.length, pageCount: totalPages, status: "success", filters: { sex: sexFilter, status: statusFilter } } });
    toast({ title: "PDF Ready", description: `Sold/Removed report (${animals.length} animals) opened for printing` });
  };

  const exportSoldCSV = () => {
    const animals = filterAnimals(soldAnimals, "sold");
    if (animals.length === 0) { toast({ title: "No Data", description: "No matching sold/removed animals to export", variant: "destructive" }); return; }
    const header = ["Animal ID", "Sex", "DOB", "Status", "Notes"].join(",");
    const rows = animals.map(a => [a.tagId, a.sex || "", a.birthDate ? format(new Date(a.birthDate), "dd/MM/yyyy") : "", a.status || "", (a.notes || "").replace(/,/g, ";")].join(",")).join("\n");
    const blob = new Blob([header + "\n" + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `SoldAnimals_${format(new Date(), "yyyy-MM-dd")}.csv`; link.click(); URL.revokeObjectURL(url);
    createExportedDoc.mutate({ name: `SoldReport_${format(new Date(), "yyyy-MM-dd_HHmm")}.csv`, documentType: "sold", subfolder: "sold", metadata: { exportType: "csv", category: "sold", animalCount: animals.length, status: "success" } });
    toast({ title: "CSV Downloaded", description: `${animals.length} sold/removed records exported` });
  };

  // ── Export: Deceased ──────────────────────────────────────────────────────
  const exportDeceasedPDF = (_quality?: PDFQuality) => {
    const animals = filterAnimals(deceasedAnimals, "deceased");
    if (animals.length === 0) { toast({ title: "No Data", description: "No matching deceased animals to export", variant: "destructive" }); return; }
    const rows = animals.map(a => `<tr>
      <td><strong>${a.tagId}</strong></td>
      <td>${a.sex || "Not recorded"}</td>
      <td>${a.birthDate ? format(new Date(a.birthDate), "dd/MM/yyyy") : "Not recorded"}</td>
      <td>${sanitizePublicNote(a.notes) || "Not recorded"}</td>
    </tr>`);
    const meta = `Total: ${animals.length}${sexFilter !== "all" ? ` | Sex: ${sexFilter}` : ""}`;
    const html = buildPagedPdf("Deceased Animals Report", `${farmLabel} — Records`, "<th>Animal ID</th><th>Sex</th><th>DOB</th><th>Notes</th>", rows, meta);
    openExportPrintDialog(html);
    const totalPages = Math.max(1, Math.ceil(animals.length / GROUP_ROWS_PER_PAGE));
    createExportedDoc.mutate({ name: `DeceasedReport_${format(new Date(), "yyyy-MM-dd_HHmm")}.pdf`, documentType: "deceased", subfolder: "deceased", metadata: { exportType: "pdf", category: "deceased", sourceSection: "records-deceased", animalCount: animals.length, pageCount: totalPages, status: "success", filters: { sex: sexFilter } } });
    toast({ title: "PDF Ready", description: `Deceased report (${animals.length} animals) opened for printing` });
  };

  const exportDeceasedCSV = () => {
    const animals = filterAnimals(deceasedAnimals, "deceased");
    if (animals.length === 0) { toast({ title: "No Data", description: "No matching deceased animals to export", variant: "destructive" }); return; }
    const header = ["Animal ID", "Sex", "DOB", "Notes"].join(",");
    const rows = animals.map(a => [a.tagId, a.sex || "", a.birthDate ? format(new Date(a.birthDate), "dd/MM/yyyy") : "", (a.notes || "").replace(/,/g, ";")].join(",")).join("\n");
    const blob = new Blob([header + "\n" + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `DeceasedAnimals_${format(new Date(), "yyyy-MM-dd")}.csv`; link.click(); URL.revokeObjectURL(url);
    createExportedDoc.mutate({ name: `DeceasedReport_${format(new Date(), "yyyy-MM-dd_HHmm")}.csv`, documentType: "deceased", subfolder: "deceased", metadata: { exportType: "csv", category: "deceased", animalCount: animals.length, status: "success" } });
    toast({ title: "CSV Downloaded", description: `${animals.length} deceased animal records exported` });
  };

  // ── Export: Productivity — Lambing ────────────────────────────────────────
  const filteredLambingEvents = lambingEvents.filter(e => inDateRange(e.lambingDate, prodDateFrom, prodDateTo));

  const exportLambingPDF = (_quality?: PDFQuality) => {
    if (filteredLambingEvents.length === 0) { toast({ title: "No Data", description: "No lambing events match the current filters", variant: "destructive" }); return; }
    const rows = filteredLambingEvents.map(e => {
      const ewe = allAnimals?.find(a => a.id === e.eweId);
      const ram = allAnimals?.find(a => a.id === e.ramId);
      return `<tr>
        <td><strong>${ewe?.tagId || `Ewe #${e.eweId}`}</strong></td>
        <td>${ram?.tagId || `Ram #${e.ramId}`}</td>
        <td>${e.lambingDate ? format(new Date(e.lambingDate), "dd/MM/yyyy") : "Not recorded"}</td>
        <td>${e.lambCount ?? "Not recorded"}</td>
        <td>${sanitizePublicNote(e.notes) || "Not recorded"}</td>
      </tr>`;
    });
    const meta = `Total lambing events: ${filteredLambingEvents.length}${prodDateFrom || prodDateTo ? ` | Period: ${prodDateFrom || "—"} to ${prodDateTo || "—"}` : ""}`;
    const html = buildPagedPdf("Lambing Outcomes Report", `${farmLabel} — Productivity`, "<th>Ewe ID</th><th>Ram ID</th><th>Lambing Date</th><th>Lamb Count</th><th>Notes</th>", rows, meta);
    openExportPrintDialog(html);
    const totalPages = Math.max(1, Math.ceil(filteredLambingEvents.length / GROUP_ROWS_PER_PAGE));
    createExportedDoc.mutate({ name: `LambingOutcomes_${format(new Date(), "yyyy-MM-dd_HHmm")}.pdf`, documentType: "productivity", subfolder: "productivity", metadata: { exportType: "pdf", category: "lambing", sourceSection: "records-productivity", animalCount: filteredLambingEvents.length, pageCount: totalPages, status: "success" } });
    toast({ title: "PDF Ready", description: `Lambing report (${filteredLambingEvents.length} events) opened for printing` });
  };

  const exportLambingCSV = () => {
    if (filteredLambingEvents.length === 0) { toast({ title: "No Data", description: "No lambing events match the current filters", variant: "destructive" }); return; }
    const header = ["Ewe ID", "Ram ID", "Lambing Date", "Lamb Count", "Notes"].join(",");
    const rows = filteredLambingEvents.map(e => {
      const ewe = allAnimals?.find(a => a.id === e.eweId);
      const ram = allAnimals?.find(a => a.id === e.ramId);
      return [ewe?.tagId || `Ewe #${e.eweId}`, ram?.tagId || `Ram #${e.ramId}`, e.lambingDate ? format(new Date(e.lambingDate), "dd/MM/yyyy") : "", e.lambCount ?? "", (e.notes || "").replace(/,/g, ";")].join(",");
    }).join("\n");
    const blob = new Blob([header + "\n" + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `LambingOutcomes_${format(new Date(), "yyyy-MM-dd")}.csv`; link.click(); URL.revokeObjectURL(url);
    createExportedDoc.mutate({ name: `LambingOutcomes_${format(new Date(), "yyyy-MM-dd_HHmm")}.csv`, documentType: "productivity", subfolder: "productivity", metadata: { exportType: "csv", category: "lambing", animalCount: filteredLambingEvents.length, status: "success" } });
    toast({ title: "CSV Downloaded", description: `${filteredLambingEvents.length} lambing records exported` });
  };

  // ── Export: Productivity — Mating Groups ──────────────────────────────────
  const filteredMatingGroups = (matingGroups || []).filter(g => {
    if (prodDateFrom || prodDateTo) return inDateRange(g.dateIn, prodDateFrom, prodDateTo);
    return true;
  });

  const exportMatingPDF = (_quality?: PDFQuality) => {
    if (filteredMatingGroups.length === 0) { toast({ title: "No Data", description: "No mating groups match the current filters", variant: "destructive" }); return; }
    const rows = filteredMatingGroups.map(g => {
      const ram = allAnimals?.find(a => a.id === g.ramId);
      return `<tr>
        <td><strong>${g.name}</strong></td>
        <td>${ram?.tagId || `Ram #${g.ramId}`}</td>
        <td>${g.eweIds?.length ?? 0} ewes</td>
        <td>${g.dateIn ? format(new Date(g.dateIn), "dd/MM/yyyy") : "Not recorded"}</td>
        <td>${g.dateOut ? format(new Date(g.dateOut), "dd/MM/yyyy") : "Not recorded"}</td>
        <td>${g.lambingSeason || "Not recorded"}</td>
        <td>${g.status || "Not recorded"}</td>
        <td>${sanitizePublicNote(g.notes) || "Not recorded"}</td>
      </tr>`;
    });
    const meta = `Total groups: ${filteredMatingGroups.length}${prodDateFrom || prodDateTo ? ` | Date In: ${prodDateFrom || "—"} to ${prodDateTo || "—"}` : ""}`;
    const html = buildPagedPdf("Mating Groups Report", `${farmLabel} — Productivity`, "<th>Group Name</th><th>Ram</th><th>Ewes</th><th>Date In</th><th>Date Out</th><th>Season</th><th>Status</th><th>Notes</th>", rows, meta);
    openExportPrintDialog(html);
    const totalPages = Math.max(1, Math.ceil(filteredMatingGroups.length / GROUP_ROWS_PER_PAGE));
    createExportedDoc.mutate({ name: `MatingGroups_${format(new Date(), "yyyy-MM-dd_HHmm")}.pdf`, documentType: "productivity", subfolder: "productivity", metadata: { exportType: "pdf", category: "mating-groups", sourceSection: "records-productivity", animalCount: filteredMatingGroups.length, pageCount: totalPages, status: "success" } });
    toast({ title: "PDF Ready", description: `Mating groups report (${filteredMatingGroups.length} groups) opened for printing` });
  };

  const exportMatingCSV = () => {
    if (filteredMatingGroups.length === 0) { toast({ title: "No Data", description: "No mating groups match the current filters", variant: "destructive" }); return; }
    const header = ["Group Name", "Ram ID", "Ewe Count", "Date In", "Date Out", "Season", "Status", "Notes"].join(",");
    const rows = filteredMatingGroups.map(g => {
      const ram = allAnimals?.find(a => a.id === g.ramId);
      return [g.name, ram?.tagId || `Ram #${g.ramId}`, g.eweIds?.length ?? 0, g.dateIn ? format(new Date(g.dateIn), "dd/MM/yyyy") : "", g.dateOut ? format(new Date(g.dateOut), "dd/MM/yyyy") : "", g.lambingSeason || "", g.status || "", (g.notes || "").replace(/,/g, ";")].join(",");
    }).join("\n");
    const blob = new Blob([header + "\n" + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `MatingGroups_${format(new Date(), "yyyy-MM-dd")}.csv`; link.click(); URL.revokeObjectURL(url);
    createExportedDoc.mutate({ name: `MatingGroups_${format(new Date(), "yyyy-MM-dd_HHmm")}.csv`, documentType: "productivity", subfolder: "productivity", metadata: { exportType: "csv", category: "mating-groups", animalCount: filteredMatingGroups.length, status: "success" } });
    toast({ title: "CSV Downloaded", description: `${filteredMatingGroups.length} mating groups exported` });
  };

  // ── Render: Filter bar (animal sections) ──────────────────────────────────
  const renderAnimalFilters = (type: "culled" | "sold" | "deceased") => (
    <Card className="p-3 border-border/60 bg-secondary/10">
      <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        <Filter className="w-3.5 h-3.5" />
        Filters
      </div>
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[160px] flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input placeholder="Search ID, name, reason…" value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-sm" data-testid="input-search-records" />
        </div>
        <Select value={sexFilter} onValueChange={setSexFilter}>
          <SelectTrigger className="h-8 text-sm w-[110px]" data-testid="select-sex-filter">
            <SelectValue placeholder="Sex" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sex</SelectItem>
            <SelectItem value="ram">Ram</SelectItem>
            <SelectItem value="ewe">Ewe</SelectItem>
            <SelectItem value="lamb">Lamb</SelectItem>
            <SelectItem value="wether">Wether</SelectItem>
          </SelectContent>
        </Select>
        {type === "culled" && uniqueCullReasons.length > 0 && (
          <Select value={reasonFilter} onValueChange={setReasonFilter}>
            <SelectTrigger className="h-8 text-sm w-[140px]" data-testid="select-reason-filter">
              <SelectValue placeholder="Reason" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Reasons</SelectItem>
              {uniqueCullReasons.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        {type === "sold" && uniqueSoldStatuses.length > 1 && (
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 text-sm w-[130px]" data-testid="select-status-filter">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {uniqueSoldStatuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <div className="flex items-center gap-1">
          <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-8 text-sm w-[130px]" data-testid="input-date-from" />
          <span className="text-muted-foreground text-xs">–</span>
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-8 text-sm w-[130px]" data-testid="input-date-to" />
        </div>
        {(search || sexFilter !== "all" || reasonFilter !== "all" || statusFilter !== "all" || dateFrom || dateTo) && (
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setSearch(""); setSexFilter("all"); setReasonFilter("all"); setStatusFilter("all"); setDateFrom(""); setDateTo(""); }} data-testid="button-clear-filters">
            Clear
          </Button>
        )}
      </div>
    </Card>
  );

  // ── Render: Animal table ──────────────────────────────────────────────────
  const renderAnimalTable = (animals: Animal[], type: "culled" | "sold" | "deceased") => {
    const filtered = filterAnimals(animals, type);
    const totalCount = animals.length;
    const filteredCount = filtered.length;
    const isFiltered = filteredCount < totalCount;

    return (
      <div className="space-y-3">
        {renderAnimalFilters(type)}
        <div className="flex items-center justify-between text-xs text-muted-foreground px-0.5">
          <span>
            {isFiltered ? `${filteredCount} of ${totalCount} records` : `${totalCount} total records`}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={() => openPdfDialog(type)} data-testid="button-export-folder">
              <Download className="w-3.5 h-3.5" /> PDF
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={type === "culled" ? exportCulledCSV : type === "sold" ? exportSoldCSV : exportDeceasedCSV} data-testid="button-export-csv">
              <Download className="w-3.5 h-3.5" /> CSV
            </Button>
          </div>
        </div>
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground border border-border rounded-md">
            <p>{search || sexFilter !== "all" || reasonFilter !== "all" || statusFilter !== "all" || dateFrom || dateTo ? "No records match the selected filters." : "No records in this folder."}</p>
          </div>
        ) : (
          <div className="border border-border rounded-md overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-primary text-primary-foreground">
                <tr>
                  <th className="text-left p-2.5 font-semibold">Animal ID</th>
                  <th className="text-left p-2.5 font-semibold">Sex</th>
                  <th className="text-left p-2.5 font-semibold">DOB</th>
                  {type === "culled" && <th className="text-left p-2.5 font-semibold">Cull Date</th>}
                  {type === "culled" && <th className="text-left p-2.5 font-semibold">Reason</th>}
                  {type === "sold" && <th className="text-left p-2.5 font-semibold">Status</th>}
                  <th className="text-left p-2.5 font-semibold">Notes</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((animal, idx) => (
                  <tr key={animal.id} className={cn("cursor-pointer transition-colors", idx % 2 === 0 ? "bg-card" : "bg-secondary/20")} data-testid={`record-row-${animal.id}`}>
                    <td className="p-2.5 font-semibold" data-testid={`text-record-tagid-${animal.id}`}>
                      <Link href={`/animals/${animal.id}`} className="text-primary hover:underline">{animal.tagId}</Link>
                    </td>
                    <td className="p-2.5 capitalize">{animal.sex || "—"}</td>
                    <td className="p-2.5">{animal.birthDate ? format(new Date(animal.birthDate), "dd/MM/yyyy") : "—"}</td>
                    {type === "culled" && <td className="p-2.5">{animal.cullDate ? format(new Date(animal.cullDate), "dd/MM/yyyy") : "—"}</td>}
                    {type === "culled" && <td className="p-2.5"><Badge variant="secondary" className="text-xs">{animal.cullReason || "—"}</Badge></td>}
                    {type === "sold" && <td className="p-2.5"><Badge variant="secondary" className="text-xs">{animal.status}</Badge></td>}
                    <td className="p-2.5 text-muted-foreground text-xs max-w-[200px] truncate">{animal.notes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  // ── Render: Productivity logs ─────────────────────────────────────────────
  const renderProductivityLogs = () => {
    return (
      <div className="space-y-4">
        <Tabs value={prodTab} onValueChange={v => setProdTab(v as ProdTab)}>
          <TabsList className="w-full justify-start">
            <TabsTrigger value="lambing" data-testid="tab-lambing">
              Lambing Events
              <Badge variant="secondary" className="ml-2 text-xs">{lambingEvents.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="mating" data-testid="tab-mating">
              Mating Groups
              <Badge variant="secondary" className="ml-2 text-xs">{matingGroups?.length || 0}</Badge>
            </TabsTrigger>
          </TabsList>

          {/* ── Lambing Events ── */}
          <TabsContent value="lambing" className="space-y-3 mt-4">
            <Card className="p-3 border-border/60 bg-secondary/10">
              <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <Filter className="w-3.5 h-3.5" />
                Filter by Lambing Date
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <div className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                  <Input type="date" value={prodDateFrom} onChange={e => setProdDateFrom(e.target.value)} className="h-8 text-sm w-[130px]" data-testid="input-prod-date-from" />
                  <span className="text-muted-foreground text-xs">–</span>
                  <Input type="date" value={prodDateTo} onChange={e => setProdDateTo(e.target.value)} className="h-8 text-sm w-[130px]" data-testid="input-prod-date-to" />
                </div>
                {(prodDateFrom || prodDateTo) && (
                  <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setProdDateFrom(""); setProdDateTo(""); }}>Clear</Button>
                )}
              </div>
            </Card>
            <div className="flex items-center justify-between text-xs text-muted-foreground px-0.5">
              <span>{filteredLambingEvents.length} of {lambingEvents.length} lambing events</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={() => openPdfDialog("lambing")} data-testid="button-export-lambing-pdf">
                  <Download className="w-3.5 h-3.5" /> PDF
                </Button>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={exportLambingCSV} data-testid="button-export-lambing-csv">
                  <Download className="w-3.5 h-3.5" /> CSV
                </Button>
              </div>
            </div>
            {filteredLambingEvents.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground border border-border rounded-md">
                <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>{lambingEvents.length === 0 ? "No lambing records yet." : "No records match the selected filters."}</p>
              </div>
            ) : (
              <div className="border border-border rounded-md overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-primary text-primary-foreground">
                    <tr>
                      <th className="text-left p-2.5 font-semibold">Ewe ID</th>
                      <th className="text-left p-2.5 font-semibold">Ram ID</th>
                      <th className="text-left p-2.5 font-semibold">Lambing Date</th>
                      <th className="text-left p-2.5 font-semibold">Lamb Count</th>
                      <th className="text-left p-2.5 font-semibold">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLambingEvents.map((event, idx) => {
                      const ewe = allAnimals?.find(a => a.id === event.eweId);
                      const ram = allAnimals?.find(a => a.id === event.ramId);
                      return (
                        <tr key={event.id} className={idx % 2 === 0 ? "bg-card" : "bg-secondary/20"} data-testid={`lambing-row-${event.id}`}>
                          <td className="p-2.5 font-semibold">{ewe?.tagId || `Ewe #${event.eweId}`}</td>
                          <td className="p-2.5">{ram?.tagId || `Ram #${event.ramId}`}</td>
                          <td className="p-2.5">{event.lambingDate ? format(new Date(event.lambingDate), "dd/MM/yyyy") : "—"}</td>
                          <td className="p-2.5">{event.lambCount ?? "—"}</td>
                          <td className="p-2.5 text-muted-foreground text-xs">{event.notes || "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          {/* ── Mating Groups ── */}
          <TabsContent value="mating" className="space-y-3 mt-4">
            <Card className="p-3 border-border/60 bg-secondary/10">
              <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <Filter className="w-3.5 h-3.5" />
                Filter by Date In
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <div className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                  <Input type="date" value={prodDateFrom} onChange={e => setProdDateFrom(e.target.value)} className="h-8 text-sm w-[130px]" data-testid="input-mating-date-from" />
                  <span className="text-muted-foreground text-xs">–</span>
                  <Input type="date" value={prodDateTo} onChange={e => setProdDateTo(e.target.value)} className="h-8 text-sm w-[130px]" data-testid="input-mating-date-to" />
                </div>
                {(prodDateFrom || prodDateTo) && (
                  <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setProdDateFrom(""); setProdDateTo(""); }}>Clear</Button>
                )}
              </div>
            </Card>
            <div className="flex items-center justify-between text-xs text-muted-foreground px-0.5">
              <span>{filteredMatingGroups.length} of {matingGroups?.length || 0} mating groups</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={() => openPdfDialog("mating")} data-testid="button-export-mating-pdf">
                  <Download className="w-3.5 h-3.5" /> PDF
                </Button>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={exportMatingCSV} data-testid="button-export-mating-csv">
                  <Download className="w-3.5 h-3.5" /> CSV
                </Button>
              </div>
            </div>
            {filteredMatingGroups.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground border border-border rounded-md">
                <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>{(matingGroups?.length || 0) === 0 ? "No mating groups recorded yet." : "No groups match the selected filters."}</p>
              </div>
            ) : (
              <div className="border border-border rounded-md overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-primary text-primary-foreground">
                    <tr>
                      <th className="text-left p-2.5 font-semibold">Group Name</th>
                      <th className="text-left p-2.5 font-semibold">Ram</th>
                      <th className="text-left p-2.5 font-semibold">Ewes</th>
                      <th className="text-left p-2.5 font-semibold">Date In</th>
                      <th className="text-left p-2.5 font-semibold">Date Out</th>
                      <th className="text-left p-2.5 font-semibold">Season</th>
                      <th className="text-left p-2.5 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMatingGroups.map((group, idx) => {
                      const ram = allAnimals?.find(a => a.id === group.ramId);
                      return (
                        <tr key={group.id} className={idx % 2 === 0 ? "bg-card" : "bg-secondary/20"} data-testid={`mating-row-${group.id}`}>
                          <td className="p-2.5 font-semibold">{group.name}</td>
                          <td className="p-2.5">{ram?.tagId || `Ram #${group.ramId}`}</td>
                          <td className="p-2.5">{group.eweIds?.length ?? "—"}</td>
                          <td className="p-2.5">{group.dateIn ? format(new Date(group.dateIn), "dd/MM/yyyy") : "—"}</td>
                          <td className="p-2.5">{group.dateOut ? format(new Date(group.dateOut), "dd/MM/yyyy") : "—"}</td>
                          <td className="p-2.5">{group.lambingSeason || "—"}</td>
                          <td className="p-2.5">
                            <Badge variant={group.status === "active" ? "default" : "secondary"} className="text-xs capitalize">{group.status || "—"}</Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    );
  };

  // ── Render: Documents folder ──────────────────────────────────────────────
  const renderDocumentsFolder = () => {
    if (activeSubfolder) {
      const rawDocs = exportedDocs || [];
      const filteredDocs = rawDocs.filter(doc => {
        const nameMatch = !docSearch.trim() || doc.name.toLowerCase().includes(docSearch.toLowerCase()) || (doc.documentType || "").toLowerCase().includes(docSearch.toLowerCase());
        const dateMatch = inDateRange(doc.exportedAt ? new Date(doc.exportedAt).toISOString().slice(0, 10) : null, docDateFrom, docDateTo);
        return nameMatch && dateMatch;
      });

      const sfDef = documentSubfolders.find(s => s.id === activeSubfolder);

      return (
        <>
          {/* Doc subfolder filter bar */}
          <Card className="p-3 border-border/60 bg-secondary/10">
            <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              <Filter className="w-3.5 h-3.5" />
              Filter Documents
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <div className="relative min-w-[160px] flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input placeholder="Search by name or type…" value={docSearch} onChange={e => setDocSearch(e.target.value)} className="pl-8 h-8 text-sm" data-testid="input-doc-search" />
              </div>
              <div className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                <Input type="date" value={docDateFrom} onChange={e => setDocDateFrom(e.target.value)} className="h-8 text-sm w-[130px]" data-testid="input-doc-date-from" />
                <span className="text-muted-foreground text-xs">–</span>
                <Input type="date" value={docDateTo} onChange={e => setDocDateTo(e.target.value)} className="h-8 text-sm w-[130px]" data-testid="input-doc-date-to" />
              </div>
              {(docSearch || docDateFrom || docDateTo) && (
                <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setDocSearch(""); setDocDateFrom(""); setDocDateTo(""); }}>Clear</Button>
              )}
            </div>
          </Card>

          <div className="flex items-center justify-between text-xs text-muted-foreground px-0.5">
            <span>
              {filteredDocs.length < rawDocs.length ? `${filteredDocs.length} of ${rawDocs.length} documents` : `${rawDocs.length} document${rawDocs.length !== 1 ? "s" : ""}`}
            </span>
            <span className="text-xs italic">{sfDef?.description}</span>
          </div>

          {filteredDocs.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground border border-border rounded-md">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p className="font-medium">{rawDocs.length === 0 ? "No exported documents yet" : "No documents match the current filters"}</p>
              <p className="text-sm mt-1">{rawDocs.length === 0 ? "Documents appear here automatically when you export PDFs from the app." : "Try adjusting your search or date range."}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredDocs.map(doc => {
                const meta = (doc as any).metadata || {};
                return (
                  <Card
                    key={doc.id}
                    className="p-3 flex items-center justify-between gap-3 cursor-pointer hover:border-primary transition-colors"
                    data-testid={`doc-${doc.id}`}
                    onClick={() => toast({
                      title: "Export Record",
                      description: `"${doc.name}" — ${doc.exportedAt ? format(new Date(doc.exportedAt), "dd MMM yyyy 'at' HH:mm") : "unknown date"} • ${meta.exportType?.toUpperCase() || "PDF"} • ${meta.pageCount ?? 1} page(s) • ${meta.animalCount ?? "?"} records • ${meta.status || "unknown"}`
                    })}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <FileText className="w-5 h-5 text-primary flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{doc.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {doc.exportedAt ? format(new Date(doc.exportedAt), "dd MMM yyyy, HH:mm") : "—"}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{meta.exportType?.toUpperCase() || "PDF"}</Badge>
                          {meta.category && <span className="text-[10px] text-muted-foreground">{meta.category}</span>}
                          {meta.animalCount != null && <span className="text-[10px] text-muted-foreground">{meta.animalCount} records</span>}
                          {meta.status && <Badge variant={meta.status === "success" ? "outline" : "destructive"} className="text-[10px] px-1.5 py-0">{meta.status}</Badge>}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-foreground"
                      onClick={e => { e.stopPropagation(); setDocToDelete({ id: doc.id, name: doc.name }); }}
                      data-testid={`button-delete-doc-${doc.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </Card>
                );
              })}
            </div>
          )}

          <AlertDialog open={docToDelete !== null} onOpenChange={open => !open && setDocToDelete(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Export Record</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete "{docToDelete?.name}"? This only removes the log entry — the original file is not affected.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel data-testid="button-cancel-delete-export">Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => { if (docToDelete) { deleteExportedDoc.mutate(docToDelete.id); setDocToDelete(null); } }}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                  data-testid="button-confirm-delete-export"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      );
    }

    // Subfolder grid
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">All generated exports are automatically filed into the folders below. Click a folder to view and filter its documents.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {documentSubfolders.map(sf => {
            const count = (allExportedDocs || []).filter(d => d.subfolder === sf.id).length;
            const IconComp = sf.icon;
            return (
              <Card
                key={sf.id}
                className="p-4 cursor-pointer transition-all border-border hover:border-primary group"
                onClick={() => setActiveSubfolder(sf.id)}
                data-testid={`subfolder-${sf.id}`}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-md bg-secondary group-hover:bg-primary/10 transition-colors">
                    <IconComp className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm leading-tight">{sf.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{sf.description}</p>
                    <div className="flex items-center justify-between mt-2">
                      <Badge variant="secondary" className="text-xs">{count} file{count !== 1 ? "s" : ""}</Badge>
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    );
  };

  // ── Render: folder content dispatch ──────────────────────────────────────
  const renderFolderContent = () => {
    switch (activeFolder) {
      case "culled": return renderAnimalTable(culledAnimals, "culled");
      case "sold": return renderAnimalTable(soldAnimals, "sold");
      case "deceased": return renderAnimalTable(deceasedAnimals, "deceased");
      case "documents": return renderDocumentsFolder();
      case "productivity": return renderProductivityLogs();
      default: return null;
    }
  };

  // ── Loading state ─────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <Layout>
        <div className="space-y-4">
          <Skeleton className="h-10 w-48" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-24 w-full rounded-md" />)}
          </div>
        </div>
      </Layout>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Layout>
      <div className="space-y-4 md:space-y-6 animate-in fade-in duration-500">
        {/* Breadcrumb + header row */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {getBreadcrumb().map((part, idx) => (
              <span key={idx} className="flex items-center gap-2">
                {idx > 0 && <ChevronRight className="w-3 h-3" />}
                <span className={idx === getBreadcrumb().length - 1 ? "text-foreground font-medium" : ""}>{part}</span>
              </span>
            ))}
          </div>

          <div className="flex flex-row justify-between items-center gap-2">
            <div className="flex items-center gap-3">
              {activeFolder && (
                <Button variant="ghost" size="icon" onClick={handleBack} data-testid="button-back">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              )}
              <h1 className="text-lg md:text-3xl font-bold tracking-tight" data-testid="records-title">
                {displayName ? `${displayName} — Records` : "Records"}
              </h1>
            </div>
          </div>
        </div>

        {/* Folder grid or folder content */}
        {!activeFolder ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {folders.map(folder => (
              <Card
                key={folder.id}
                className="p-5 cursor-pointer transition-all border-border group"
                onClick={() => openFolder(folder.id)}
                data-testid={`folder-${folder.id}`}
              >
                <div className="flex items-start gap-4">
                  <div className={cn("p-3 rounded-lg bg-secondary/50 group-hover:bg-secondary transition-colors", folder.color)}>
                    <folder.icon className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-base">{folder.label}</p>
                      <Badge variant="secondary" className="text-xs">{folder.count}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{folder.description}</p>
                  </div>
                </div>
                <div className="flex items-center justify-end mt-3 pt-3 border-t border-border/50">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    Open folder <ChevronRight className="w-3 h-3" />
                  </span>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {renderFolderContent()}
          </div>
        )}
      </div>

      {/* Shared PDF quality dialog for all Records exports */}
      <PDFExportDialog
        open={isPdfOpen}
        onOpenChange={setPdfIsOpen}
        title="Export PDF"
        description="Choose export quality. Quality affects embedded image resolution only — data, text and counts are unchanged."
        exportLabel="Export PDF"
        onExport={async (quality) => {
          if (pdfExportType === "culled") exportCulledPDF(quality);
          else if (pdfExportType === "sold") exportSoldPDF(quality);
          else if (pdfExportType === "deceased") exportDeceasedPDF(quality);
          else if (pdfExportType === "lambing") exportLambingPDF(quality);
          else if (pdfExportType === "mating") exportMatingPDF(quality);
          closePdfDialog();
        }}
      />
    </Layout>
  );
}
