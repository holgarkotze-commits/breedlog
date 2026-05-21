import { useState } from "react";
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
  Eye,
  Share2
} from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import type { Animal } from "@shared/schema";
import type { BreedingEvent } from "@shared/schema";
import { cn } from "@/lib/utils";

type FolderType = "culled" | "sold" | "deceased" | "documents" | "productivity" | null;
type DocumentSubfolder = "herd" | "individual" | "breeding" | "culled" | "sold" | "deceased" | "productivity" | null;

interface ExportedDocument {
  id: string;
  name: string;
  type: string;
  subfolder: DocumentSubfolder;
  date: Date;
  size?: string;
}

export default function Records() {
  const [activeFolder, setActiveFolder] = useState<FolderType>(null);
  const [activeSubfolder, setActiveSubfolder] = useState<DocumentSubfolder>(null);
  const [search, setSearch] = useState("");
  const [docToDelete, setDocToDelete] = useState<{id: number, name: string} | null>(null);
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
  
  const getDocumentFileName = (type: string, identifier: string) => {
    const date = format(new Date(), "yyyy-MM-dd");
    return `${identifier}_${type}_${date}.pdf`;
  };

  const culledAnimals = (allAnimals || []).filter(a => 
    a.status === 'culled' || a.cullConfirmed === true
  );
  const soldAnimals = (allAnimals || []).filter(a => 
    a.status === 'sold' || a.status === 'transferred'
  );
  const deceasedAnimals = (allAnimals || []).filter(a => 
    a.status === 'dead' || a.status === 'deceased'
  );

  const folders = [
    { 
      id: "culled" as FolderType, 
      icon: Archive, 
      label: "Culled", 
      description: "Animals removed from herd via culling",
      count: culledAnimals.length,
      color: "text-red-400"
    },
    { 
      id: "sold" as FolderType, 
      icon: Truck, 
      label: "Sold / Removed", 
      description: "Animals sold or transferred out",
      count: soldAnimals.length,
      color: "text-blue-400"
    },
    { 
      id: "deceased" as FolderType, 
      icon: Skull, 
      label: "Deceased", 
      description: "Animals that have passed away",
      count: deceasedAnimals.length,
      color: "text-gray-400"
    },
    { 
      id: "documents" as FolderType, 
      icon: FileText, 
      label: "Exported Documents", 
      description: "All generated PDF exports and reports",
      count: allExportedDocs?.length || 0,
      color: "text-yellow-400"
    },
    { 
      id: "productivity" as FolderType, 
      icon: BarChart3, 
      label: "Productivity Logs", 
      description: "Breeding events, mating groups, and performance records",
      count: (breedingEvents?.length || 0) + (matingGroups?.length || 0),
      color: "text-green-400"
    },
  ];

  const documentSubfolders = [
    { id: "herd" as DocumentSubfolder, label: "Herd Exports", icon: Folder },
    { id: "individual" as DocumentSubfolder, label: "Individual Animal Exports", icon: Folder },
    { id: "breeding" as DocumentSubfolder, label: "Mating Group Reports", icon: Folder },
    { id: "culled" as DocumentSubfolder, label: "Culled Reports", icon: Folder },
    { id: "sold" as DocumentSubfolder, label: "Sold/Removed Reports", icon: Folder },
    { id: "deceased" as DocumentSubfolder, label: "Deceased Reports", icon: Folder },
    { id: "productivity" as DocumentSubfolder, label: "Productivity Logs", icon: Folder },
  ];

  const handleBack = () => {
    if (activeSubfolder) {
      setActiveSubfolder(null);
    } else {
      setActiveFolder(null);
    }
    setSearch("");
  };

  const getBreadcrumb = () => {
    const parts = ["Records"];
    if (activeFolder) {
      const folder = folders.find(f => f.id === activeFolder);
      if (folder) parts.push(folder.label);
    }
    if (activeSubfolder) {
      const subfolder = documentSubfolders.find(s => s.id === activeSubfolder);
      if (subfolder) parts.push(subfolder.label);
    }
    return parts;
  };

  const exportCulledPDF = () => {
    if (culledAnimals.length === 0) {
      toast({ title: "No Data", description: "No culled animals to export", variant: "destructive" });
      return;
    }
    const fb = farmSettings;
    const exportDate = format(new Date(), "dd/MM/yyyy HH:mm");
    const tableRows = culledAnimals.map(animal => {
      return `<tr>
        <td><strong>${animal.tagId}</strong></td>
        <td>${animal.sex || '-'}</td>
        <td>${animal.birthDate ? format(new Date(animal.birthDate), "dd/MM/yyyy") : '-'}</td>
        <td>${animal.cullDate ? format(new Date(animal.cullDate), "dd/MM/yyyy") : '-'}</td>
        <td>${animal.cullReason || '-'}</td>
        <td>${animal.notes || '-'}</td>
      </tr>`;
    }).join('');

    const pdfHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Culled Animals</title>
      <style>
        @page { size: A4 portrait; margin: 10mm; }
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: Arial, sans-serif; }
        body { background: white; color: #1a1a1a; font-size: 9pt; }
        .page { width: 190mm; min-height: 277mm; position: relative; padding-bottom: 25mm; }
        .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px solid #FFC300; }
        .header-title { font-size: 16pt; font-weight: bold; }
        .header-right { text-align: right; font-size: 8pt; color: #666; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        th { background: #FFC300; color: #1a1a1a; font-weight: bold; padding: 8px 10px; text-align: left; font-size: 8pt; }
        td { padding: 8px 10px; text-align: left; font-size: 8pt; border-bottom: 1px solid #ddd; }
        tr:nth-child(even) { background: #f9f9f9; }
        .footer { position: absolute; bottom: 6mm; left: 0; right: 0; display: flex; align-items: center; justify-content: space-between; padding: 5px 15px; background: #FFC300; }
        .footer-brand { font-weight: bold; font-size: 10pt; letter-spacing: 2px; }
        .footer-tagline { font-size: 8pt; }
      </style>
    </head><body><div class="page">
      <div class="header">
        <span class="header-title">${fb?.studName || fb?.farmName || 'BreedLog'} - Culled Animals</span>
        <div class="header-right"><div>Generated: ${exportDate}</div></div>
      </div>
      <table><thead><tr><th>Animal ID</th><th>Sex</th><th>DOB</th><th>Cull Date</th><th>Cull Reason</th><th>Notes</th></tr></thead>
      <tbody>${tableRows}</tbody></table>
      <div class="footer"><span class="footer-brand">BREEDLOG</span><span class="footer-tagline">Professional Livestock Management</span></div>
    </div></body></html>`;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(pdfHtml);
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 500);
    }
    createExportedDoc.mutate({
      name: getDocumentFileName("CulledReport", "All"),
      documentType: "culled",
      subfolder: "culled",
      metadata: { exportType: "pdf", category: "culled", sourceSection: "records-culled", animalCount: culledAnimals.length, pageCount: 1, status: "success" }
    });
    toast({ title: "PDF Ready", description: "Culled report opened for printing" });
  };

  const exportSoldPDF = () => {
    if (soldAnimals.length === 0) {
      toast({ title: "No Data", description: "No sold/transferred animals to export", variant: "destructive" });
      return;
    }
    const fb = farmSettings;
    const exportDate = format(new Date(), "dd/MM/yyyy HH:mm");
    const tableRows = soldAnimals.map(animal => {
      return `<tr>
        <td><strong>${animal.tagId}</strong></td>
        <td>${animal.sex || '-'}</td>
        <td>${animal.birthDate ? format(new Date(animal.birthDate), "dd/MM/yyyy") : '-'}</td>
        <td>${animal.status || '-'}</td>
        <td>${animal.notes || '-'}</td>
      </tr>`;
    }).join('');

    const pdfHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Sold/Removed Animals</title>
      <style>
        @page { size: A4 portrait; margin: 10mm; }
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: Arial, sans-serif; }
        body { background: white; color: #1a1a1a; font-size: 9pt; }
        .page { width: 190mm; min-height: 277mm; position: relative; padding-bottom: 25mm; }
        .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px solid #FFC300; }
        .header-title { font-size: 16pt; font-weight: bold; }
        .header-right { text-align: right; font-size: 8pt; color: #666; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        th { background: #FFC300; color: #1a1a1a; font-weight: bold; padding: 8px 10px; text-align: left; font-size: 8pt; }
        td { padding: 8px 10px; text-align: left; font-size: 8pt; border-bottom: 1px solid #ddd; }
        tr:nth-child(even) { background: #f9f9f9; }
        .footer { position: absolute; bottom: 6mm; left: 0; right: 0; display: flex; align-items: center; justify-content: space-between; padding: 5px 15px; background: #FFC300; }
        .footer-brand { font-weight: bold; font-size: 10pt; letter-spacing: 2px; }
        .footer-tagline { font-size: 8pt; }
      </style>
    </head><body><div class="page">
      <div class="header">
        <span class="header-title">${fb?.studName || fb?.farmName || 'BreedLog'} - Sold/Removed Animals</span>
        <div class="header-right"><div>Generated: ${exportDate}</div></div>
      </div>
      <table><thead><tr><th>Animal ID</th><th>Sex</th><th>DOB</th><th>Status</th><th>Notes</th></tr></thead>
      <tbody>${tableRows}</tbody></table>
      <div class="footer"><span class="footer-brand">BREEDLOG</span><span class="footer-tagline">Professional Livestock Management</span></div>
    </div></body></html>`;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(pdfHtml);
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 500);
    }
    createExportedDoc.mutate({
      name: getDocumentFileName("SoldReport", "All"),
      documentType: "sold",
      subfolder: "sold",
      metadata: { exportType: "pdf", category: "sold", sourceSection: "records-sold", animalCount: soldAnimals.length, pageCount: 1, status: "success" }
    });
    toast({ title: "PDF Ready", description: "Sold/Removed report opened for printing" });
  };

  const exportDeceasedPDF = () => {
    if (deceasedAnimals.length === 0) {
      toast({ title: "No Data", description: "No deceased animals to export", variant: "destructive" });
      return;
    }
    const fb = farmSettings;
    const exportDate = format(new Date(), "dd/MM/yyyy HH:mm");
    const tableRows = deceasedAnimals.map(animal => {
      return `<tr>
        <td><strong>${animal.tagId}</strong></td>
        <td>${animal.sex || '-'}</td>
        <td>${animal.birthDate ? format(new Date(animal.birthDate), "dd/MM/yyyy") : '-'}</td>
        <td>${animal.notes || '-'}</td>
      </tr>`;
    }).join('');

    const pdfHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Deceased Animals</title>
      <style>
        @page { size: A4 portrait; margin: 10mm; }
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: Arial, sans-serif; }
        body { background: white; color: #1a1a1a; font-size: 9pt; }
        .page { width: 190mm; min-height: 277mm; position: relative; padding-bottom: 25mm; }
        .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px solid #FFC300; }
        .header-title { font-size: 16pt; font-weight: bold; }
        .header-right { text-align: right; font-size: 8pt; color: #666; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        th { background: #FFC300; color: #1a1a1a; font-weight: bold; padding: 8px 10px; text-align: left; font-size: 8pt; }
        td { padding: 8px 10px; text-align: left; font-size: 8pt; border-bottom: 1px solid #ddd; }
        tr:nth-child(even) { background: #f9f9f9; }
        .footer { position: absolute; bottom: 6mm; left: 0; right: 0; display: flex; align-items: center; justify-content: space-between; padding: 5px 15px; background: #FFC300; }
        .footer-brand { font-weight: bold; font-size: 10pt; letter-spacing: 2px; }
        .footer-tagline { font-size: 8pt; }
      </style>
    </head><body><div class="page">
      <div class="header">
        <span class="header-title">${fb?.studName || fb?.farmName || 'BreedLog'} - Deceased Animals</span>
        <div class="header-right"><div>Generated: ${exportDate}</div></div>
      </div>
      <table><thead><tr><th>Animal ID</th><th>Sex</th><th>DOB</th><th>Notes</th></tr></thead>
      <tbody>${tableRows}</tbody></table>
      <div class="footer"><span class="footer-brand">BREEDLOG</span><span class="footer-tagline">Professional Livestock Management</span></div>
    </div></body></html>`;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(pdfHtml);
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 500);
    }
    createExportedDoc.mutate({
      name: getDocumentFileName("DeceasedReport", "All"),
      documentType: "deceased",
      subfolder: "deceased",
      metadata: { exportType: "pdf", category: "deceased", sourceSection: "records-deceased", animalCount: deceasedAnimals.length, pageCount: 1, status: "success" }
    });
    toast({ title: "PDF Ready", description: "Deceased report opened for printing" });
  };

  const filterAnimals = (animals: Animal[]) => {
    if (!search.trim()) return animals;
    const s = search.toLowerCase();
    return animals.filter(a => 
      a.tagId?.toLowerCase().includes(s) ||
      a.name?.toLowerCase().includes(s) ||
      a.electronicId?.toLowerCase().includes(s) ||
      a.sex?.toLowerCase().includes(s)
    );
  };

  const renderAnimalTable = (animals: Animal[], type: "culled" | "sold" | "deceased") => {
    const filtered = filterAnimals(animals);
    
    if (filtered.length === 0) {
      return (
        <div className="py-12 text-center text-muted-foreground border border-border rounded-md">
          <p>{search ? "No matching records found." : "No records in this folder."}</p>
        </div>
      );
    }

    return (
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
              <tr 
                key={animal.id}
                className={cn(
                  "cursor-pointer transition-colors",
                  idx % 2 === 0 ? "bg-card" : "bg-secondary/20"
                )}
                data-testid={`record-row-${animal.id}`}
              >
                <td className="p-2.5 font-semibold" data-testid={`text-record-tagid-${animal.id}`}>
                  <Link href={`/animals/${animal.id}`} className="text-primary hover:underline">
                    {animal.tagId}
                  </Link>
                </td>
                <td className="p-2.5 capitalize">{animal.sex || "—"}</td>
                <td className="p-2.5">{animal.birthDate ? format(new Date(animal.birthDate), "dd/MM/yyyy") : "—"}</td>
                {type === "culled" && (
                  <td className="p-2.5">{animal.cullDate ? format(new Date(animal.cullDate), "dd/MM/yyyy") : "—"}</td>
                )}
                {type === "culled" && <td className="p-2.5">{animal.cullReason || "—"}</td>}
                {type === "sold" && (
                  <td className="p-2.5">
                    <Badge variant="secondary" className="text-xs">{animal.status}</Badge>
                  </td>
                )}
                <td className="p-2.5 text-muted-foreground text-xs max-w-[200px] truncate">{animal.notes || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderProductivityLogs = () => {
    const events: BreedingEvent[] = breedingEvents || [];
    const lambingEvents = events.filter((e: BreedingEvent) => e.lambingDate);
    
    return (
      <div className="space-y-6">
        <Card className="p-4">
          <h3 className="font-semibold mb-3">Lambing Outcomes Summary</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Total lambing events recorded: {lambingEvents.length}
          </p>
          {lambingEvents.length > 0 ? (
            <div className="border border-border rounded-md overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-primary text-primary-foreground">
                  <tr>
                    <th className="text-left p-2.5 font-semibold">Ewe ID</th>
                    <th className="text-left p-2.5 font-semibold">Lambing Date</th>
                    <th className="text-left p-2.5 font-semibold">Lamb Count</th>
                    <th className="text-left p-2.5 font-semibold">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {lambingEvents.map((event: BreedingEvent, idx: number) => {
                    const ewe = allAnimals?.find(a => a.id === event.eweId);
                    return (
                      <tr key={event.id} className={idx % 2 === 0 ? "bg-card" : "bg-secondary/20"}>
                        <td className="p-2.5 font-semibold">{ewe?.tagId || `Ewe #${event.eweId}`}</td>
                        <td className="p-2.5">{event.lambingDate ? format(new Date(event.lambingDate), "dd/MM/yyyy") : "—"}</td>
                        <td className="p-2.5">{event.lambCount || "—"}</td>
                        <td className="p-2.5 text-muted-foreground text-xs">{event.notes || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No lambing records yet.</p>
          )}
        </Card>

        <Card className="p-4">
          <h3 className="font-semibold mb-3">Weight Recording Summary</h3>
          <p className="text-sm text-muted-foreground">
            Weight logs are recorded per animal profile. View individual animal records to see weight history.
          </p>
        </Card>
      </div>
    );
  };

  const renderDocumentsFolder = () => {
    const docs = exportedDocs || [];
    
    if (activeSubfolder) {
      if (docs.length === 0) {
        return (
          <div className="py-12 text-center text-muted-foreground border border-border rounded-md">
            <FileText className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="font-medium">No exported documents yet</p>
            <p className="text-sm mt-1">Documents will appear here when you export PDFs from other parts of the app.</p>
          </div>
        );
      }
      
      return (
        <>
          <div className="space-y-2">
            {docs.map((doc) => (
              // Backward-compatible metadata parsing
              // Old records may not include metadata.
              (() => {
                const meta = (doc as any).metadata || {};
                return (
              <Card 
                key={doc.id} 
                className="p-3 flex items-center justify-between gap-3 cursor-pointer hover:border-primary transition-colors" 
                data-testid={`doc-${doc.id}`}
                onClick={() => toast({
                  title: "Export Record",
                  description: `"${doc.name}" exported on ${doc.exportedAt ? format(new Date(doc.exportedAt), "dd MMM yyyy 'at' HH:mm") : "unknown date"} • ${meta.category || doc.documentType || "unknown"} • ${meta.animalCount ?? "?"} animals • ${meta.pageCount ?? "?"} pages • ${meta.status || "unknown"}.`
                })}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <FileText className="w-5 h-5 text-primary flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{doc.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {doc.exportedAt ? format(new Date(doc.exportedAt), "dd MMM yyyy, HH:mm") : "—"}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {(meta.category || doc.documentType || "unknown")} • animals: {meta.animalCount ?? "—"} • pages: {meta.pageCount ?? "—"} • {meta.status || "unknown"}
                    </p>
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="text-destructive hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDocToDelete({ id: doc.id, name: doc.name });
                  }}
                  data-testid={`button-delete-doc-${doc.id}`}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </Card>
                );
              })()
            ))}
          </div>

          {/* Delete confirmation dialog */}
          <AlertDialog open={docToDelete !== null} onOpenChange={(open) => !open && setDocToDelete(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Export Record</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete the export record "{docToDelete?.name}"? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel data-testid="button-cancel-delete-export">Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    if (docToDelete) {
                      deleteExportedDoc.mutate(docToDelete.id);
                      setDocToDelete(null);
                    }
                  }}
                  className="bg-white text-red-600 border border-red-200 hover:bg-red-50"
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

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {documentSubfolders.map((subfolder) => {
          const subfolderDocs = (exportedDocs || []).filter(d => d.subfolder === subfolder.id);
          return (
            <Card 
              key={subfolder.id}
              className="p-4 cursor-pointer transition-all border-border"
              onClick={() => setActiveSubfolder(subfolder.id)}
              data-testid={`subfolder-${subfolder.id}`}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-secondary">
                  <subfolder.icon className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">{subfolder.label}</p>
                  <p className="text-xs text-muted-foreground">{subfolderDocs.length} documents</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
            </Card>
          );
        })}
      </div>
    );
  };

  const renderFolderContent = () => {
    switch (activeFolder) {
      case "culled":
        return renderAnimalTable(culledAnimals, "culled");
      case "sold":
        return renderAnimalTable(soldAnimals, "sold");
      case "deceased":
        return renderAnimalTable(deceasedAnimals, "deceased");
      case "documents":
        return renderDocumentsFolder();
      case "productivity":
        return renderProductivityLogs();
      default:
        return null;
    }
  };

  const getExportAction = () => {
    switch (activeFolder) {
      case "culled": return exportCulledPDF;
      case "sold": return exportSoldPDF;
      case "deceased": return exportDeceasedPDF;
      default: return null;
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="space-y-4">
          <Skeleton className="h-10 w-48" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} className="h-24 w-full rounded-md" />
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-4 md:space-y-6 animate-in fade-in duration-500">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {getBreadcrumb().map((part, idx) => (
              <span key={idx} className="flex items-center gap-2">
                {idx > 0 && <ChevronRight className="w-3 h-3" />}
                <span className={idx === getBreadcrumb().length - 1 ? "text-foreground font-medium" : ""}>
                  {part}
                </span>
              </span>
            ))}
          </div>
          
          <div className="flex flex-row justify-between items-center gap-2">
            <div className="flex items-center gap-3">
              {activeFolder && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={handleBack}
                  data-testid="button-back"
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              )}
              <h1 className="text-lg md:text-3xl font-bold tracking-tight" data-testid="records-title">
                {displayName ? `${displayName} - Records` : "Records"}
              </h1>
            </div>
            
            {activeFolder && activeFolder !== "documents" && activeFolder !== "productivity" && (
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8 h-9 w-40 md:w-56"
                    data-testid="input-search-records"
                  />
                </div>
                {getExportAction() && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={getExportAction()!}
                    data-testid="button-export-folder"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export PDF
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        {!activeFolder ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {folders.map((folder) => (
              <Card 
                key={folder.id}
                className="p-5 cursor-pointer transition-all border-border group"
                onClick={() => setActiveFolder(folder.id)}
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
    </Layout>
  );
}
