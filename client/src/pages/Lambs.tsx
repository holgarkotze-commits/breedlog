import { useState } from "react";
import { Layout } from "@/components/Layout";
import { useAnimals, useClassifyRamLamb, useConfirmCull, useRemoveFromHerd, useMoveToEwes, useMoveToRams, useUpdateAnimal } from "@/hooks/use-animals";
import { useFarmSettings } from "@/hooks/use-farm-settings";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Search, Filter, Scale, Tag, Trash2, UserMinus, ChevronRight, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { format, differenceInDays } from "date-fns";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PDFExportDialog, usePDFExportDialog } from "@/components/PDFExportDialog";
import { type PDFQuality, chunkGroupExportRows } from "@/lib/pdf-utils";
import { getCanonicalGroupCSS, renderExportHeader, renderExportFooter, wrapExportDocument, openExportPrintDialog, GROUP_ROWS_PER_PAGE } from "@/lib/export-template";
import { buildLambBirthRows, buildLambPerformanceRows } from "@/lib/stamboek-export-fields";
import { useCreateExportedDocument } from "@/hooks/use-exported-documents";
import type { Animal } from "@shared/schema";
import { calculateLambStage } from "@shared/lamb-stage";

function getAgeDays(birthDate: string | null): number {
  if (!birthDate) return 0;
  return differenceInDays(new Date(), new Date(birthDate));
}

export default function Lambs() {
  const LAMB_MAX_AGE_DAYS = 365;
  const [search, setSearch] = useState("");
  const [sexFilter, setSexFilter] = useState("all");
  const [classFilter, setClassFilter] = useState("all");
  const { data: allAnimals, isLoading } = useAnimals({ search });
  const { data: farmSettings } = useFarmSettings();
  const { toast } = useToast();
  const displayName = farmSettings?.studName || farmSettings?.farmName;
  
  const classifyMutation = useClassifyRamLamb();
  const confirmCullMutation = useConfirmCull();
  const removeFromHerdMutation = useRemoveFromHerd();
  const moveToEwesMutation = useMoveToEwes();
  const moveToRamsMutation = useMoveToRams();
  const updateAnimalMutation = useUpdateAnimal();
  
  const [selectedAnimal, setSelectedAnimal] = useState<Animal | null>(null);
  const [showCullConfirm, setShowCullConfirm] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [showWeightDialog, setShowWeightDialog] = useState(false);
  const [showPromoteDialog, setShowPromoteDialog] = useState(false);
  const [cullReason, setCullReason] = useState("");
  const [removeReason, setRemoveReason] = useState<"sold" | "deceased" | "transferred">("sold");
  const [removeNotes, setRemoveNotes] = useState("");
  const [weightValue, setWeightValue] = useState("");
  const [weightType, setWeightType] = useState<"100" | "270">("100");
  const [selectedRamType, setSelectedRamType] = useState<"breeding_ram" | "stud_ram" | "commercial_ram">("breeding_ram");
  
  // PDF Export Dialog
  const pdfExport = usePDFExportDialog();
  const createExportedDoc = useCreateExportedDocument();
  
  // Export Lambs PDF
  const handlePDFExport = async (quality: PDFQuality): Promise<void> => {
    if (!lambs || lambs.length === 0) {
      toast({ title: "No lambs to export", description: "There are no lambs matching your current filters.", variant: "destructive" });
      return;
    }

    const fb = farmSettings;
    const exportDate = format(new Date(), "dd/MM/yyyy HH:mm");

    const eweLambs = lambs.filter(a => a.sex === "ewe");
    const ramLambs = lambs.filter(a => a.sex === "ram");

    const eweBirthRows = buildLambBirthRows(eweLambs);
    const ewePerfRows = buildLambPerformanceRows(eweLambs);
    const ramBirthRows = buildLambBirthRows(ramLambs);
    const ramPerfRows = buildLambPerformanceRows(ramLambs);

    const eweChunks = chunkGroupExportRows(eweBirthRows, GROUP_ROWS_PER_PAGE);
    const ramChunks = chunkGroupExportRows(ramBirthRows, GROUP_ROWS_PER_PAGE);
    const totalPages = eweChunks.length + ramChunks.length;

    let pageCounter = 0;

    const ewePages = eweChunks.map((chunk, chunkIdx) => {
      pageCounter++;
      const currentPage = pageCounter;
      const startIdx = chunkIdx * GROUP_ROWS_PER_PAGE;
      const rows = chunk.map((lamb, idx) => {
        const gi = startIdx + idx;
        const perf = ewePerfRows[gi] || {};
        return `<tr>
          <td class="row-num">${gi + 1}</td>
          <td><strong>${lamb["Lamb ID"] || "—"}</strong></td>
          <td>${lamb["Birth date"] || "—"}</td>
          <td>${perf["Age at 100-day weighing"] || "—"}</td>
          <td>${lamb["Dam/mother ID"] || "—"}</td>
          <td>${lamb["Sire/father ID"] || "—"}</td>
          <td>${perf["100-day weight"] ? perf["100-day weight"] + " kg" : "—"}</td>
          <td>${lamb["Birth status"] || "—"}</td>
        </tr>`;
      }).join('');
      return `<div class="page">
        ${renderExportHeader(fb, currentPage, totalPages, exportDate, 'BreedLog', `Ewe Lambs Register — ${eweLambs.length} lambs`)}
        <table class="export-table">
          <thead><tr>
            <th class="row-num">#</th>
            <th>Lamb ID</th>
            <th>Birth Date</th>
            <th>Age (Days)</th>
            <th>Dam</th>
            <th>Sire</th>
            <th>100-Day Wt</th>
            <th>Status</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
        ${renderExportFooter(fb)}
      </div>`;
    });

    const ramPages = ramChunks.map((chunk, chunkIdx) => {
      pageCounter++;
      const currentPage = pageCounter;
      const startIdx = chunkIdx * GROUP_ROWS_PER_PAGE;
      const rows = chunk.map((lamb, idx) => {
        const gi = startIdx + idx;
        const perf = ramPerfRows[gi] || {};
        return `<tr>
          <td class="row-num">${gi + 1}</td>
          <td><strong>${lamb["Lamb ID"] || "—"}</strong></td>
          <td>${lamb["Birth date"] || "—"}</td>
          <td>${perf["Age at 100-day weighing"] || "—"}</td>
          <td>${lamb["Dam/mother ID"] || "—"}</td>
          <td>${lamb["Sire/father ID"] || "—"}</td>
          <td>${perf["100-day weight"] ? perf["100-day weight"] + " kg" : "—"}</td>
          <td>${perf["270-day/post-wean weight"] ? perf["270-day/post-wean weight"] + " kg" : "—"}</td>
          <td>${lamb["Birth status"] || "—"}</td>
        </tr>`;
      }).join('');
      return `<div class="page">
        ${renderExportHeader(fb, currentPage, totalPages, exportDate, 'BreedLog', `Ram Lambs Register — ${ramLambs.length} lambs`)}
        <table class="export-table">
          <thead><tr>
            <th class="row-num">#</th>
            <th>Lamb ID</th>
            <th>Birth Date</th>
            <th>Age (Days)</th>
            <th>Dam</th>
            <th>Sire</th>
            <th>100-Day Wt</th>
            <th>270-Day Wt</th>
            <th>Status</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
        ${renderExportFooter(fb)}
      </div>`;
    });

    const html = wrapExportDocument(
      `${fb?.studName || fb?.farmName || "BreedLog"} — Lambs Register`,
      getCanonicalGroupCSS(),
      [...ewePages, ...ramPages].join('\n')
    );

    openExportPrintDialog(html);
    const pageCount = eweChunks.length + ramChunks.length;
    createExportedDoc.mutate({
      name: `Lambs_HerdExport_${new Date().toISOString().slice(0,10)}.pdf`,
      documentType: "herd",
      subfolder: "herd",
      metadata: {
        exportType: "pdf",
        category: "lambs",
        sourceSection: "lambs",
        animalCount: lambs.length,
        pageCount,
        status: "success",
        rowsSummary: {
          eweBirthRows: eweBirthRows.length,
          ramBirthRows: ramBirthRows.length,
          sample: [...eweBirthRows, ...ramBirthRows].slice(0, 5)
        },
      },
    });
    
    toast({ title: "PDF Ready", description: "Lambs export opened for printing" });
  };

  const lambs = (allAnimals || []).filter(animal => {
    if (!animal.birthDate) return false;
    const ageDays = getAgeDays(animal.birthDate);
    if (ageDays > LAMB_MAX_AGE_DAYS) return false;
    
    if (animal.lambStatus === 'moved_to_ewes' || animal.lambStatus === 'moved_to_rams') return false;
    if (animal.status === 'culled' || animal.lambStatus === 'culled') return false;
    if (animal.status === 'sold' || animal.status === 'dead') return false;
    
    if (sexFilter !== "all" && animal.sex !== sexFilter) return false;
    
    if (classFilter === "stud" && animal.ramLambClass !== "stud") return false;
    if (classFilter === "commercial" && animal.ramLambClass !== "commercial") return false;
    if (classFilter === "cull" && animal.ramLambClass !== "cull") return false;
    if (classFilter === "unclassified" && animal.ramLambClass && animal.ramLambClass !== "unclassified") return false;
    
    return true;
  });

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
      }
    });
  };

  const handleRemoveFromHerd = () => {
    if (!selectedAnimal) return;
    removeFromHerdMutation.mutate({ id: selectedAnimal.id, reason: removeReason, notes: removeNotes }, {
      onSuccess: () => {
        setShowRemoveConfirm(false);
        setSelectedAnimal(null);
        setRemoveReason("sold");
        setRemoveNotes("");
      }
    });
  };

  const handleSaveWeight = () => {
    if (!selectedAnimal || !weightValue) return;
    const today = format(new Date(), "yyyy-MM-dd");
    const updates = weightType === "100" 
      ? { weight100Day: weightValue, weight100DayDate: today }
      : { weight270Day: weightValue, weight270DayDate: today };
    
    updateAnimalMutation.mutate({ id: selectedAnimal.id, ...updates }, {
      onSuccess: (updatedAnimal) => {
        setShowWeightDialog(false);
        setSelectedAnimal(null);
        setWeightValue("");
        
        if (weightType === "100" && updatedAnimal.sex === "ewe") {
          moveToEwesMutation.mutate(updatedAnimal.id);
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
        setShowPromoteDialog(false);
        setSelectedAnimal(null);
        setSelectedRamType("breeding_ram");
      }
    });
  };

  return (
    <Layout>
      <div className="space-y-4 md:space-y-6 animate-in fade-in duration-500">
        <div className="flex flex-col gap-2">
          <h1 className="text-lg md:text-3xl font-bold tracking-tight leading-tight" data-testid="page-title">
            {displayName ? `${displayName} - Lamb Workflow` : "Lamb Workflow"}
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground">
            This is a filtered lifecycle view of Animals (birth to {LAMB_MAX_AGE_DAYS} days). Lambs leave this view when moved to Ewes/Rams, sold/deceased/culled, or aged out.
          </p>
        </div>

        <div className="flex flex-col md:flex-row gap-2 bg-card p-2.5 md:p-4 rounded-md border border-border shadow-sm">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search Lamb ID..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 text-sm rugged-input"
              data-testid="input-search-lambs"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Select value={sexFilter} onValueChange={setSexFilter}>
              <SelectTrigger className="flex-1 md:w-[120px] text-sm rugged-input" data-testid="select-sex-filter">
                <SelectValue placeholder="Sex" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Lambs</SelectItem>
                <SelectItem value="ewe">Ewe Lambs</SelectItem>
                <SelectItem value="ram">Ram Lambs</SelectItem>
              </SelectContent>
            </Select>
            
            {(sexFilter === "ram" || sexFilter === "all") && (
              <Select value={classFilter} onValueChange={setClassFilter}>
                <SelectTrigger className="flex-1 md:w-[140px] text-sm rugged-input" data-testid="select-class-filter">
                  <Filter className="w-4 h-4 mr-1" />
                  <SelectValue placeholder="Classification" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Classes</SelectItem>
                  <SelectItem value="stud">Stud Candidates</SelectItem>
                  <SelectItem value="commercial">Commercial</SelectItem>
                  <SelectItem value="cull">Cull</SelectItem>
                  <SelectItem value="unclassified">Unclassified</SelectItem>
                </SelectContent>
              </Select>
            )}
            
            <Button
              variant="outline"
              size="sm"
              className="text-white border-white/70 hover:border-white [&_svg]:text-primary"
              onClick={() => pdfExport.setIsOpen(true)}
              disabled={!lambs || lambs.length === 0}
              data-testid="button-export-lambs-pdf"
            >
              <Download className="w-4 h-4 mr-2" />
              Export PDF
            </Button>
          </div>
        </div>

        <div className="text-sm text-muted-foreground">
          {lambs.length} lamb{lambs.length !== 1 ? 's' : ''} in herd
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-16 rounded-md bg-secondary" />
            ))}
          </div>
        ) : lambs.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">No lambs found matching your criteria.</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {lambs.map(lamb => {
              const ageDays = getAgeDays(lamb.birthDate);
              const stage = calculateLambStage(lamb);
              const needs100Day = ageDays >= 100 && !lamb.weight100Day;
              const needs270Day = ageDays >= 270 && !lamb.weight270Day && lamb.sex === "ram" && lamb.ramLambClass === "stud";
              const needsClassification = lamb.sex === "ram" && (!lamb.ramLambClass || lamb.ramLambClass === "unclassified");
              
              return (
                <Card 
                  key={lamb.id} 
                  className="p-3 hover-elevate"
                  data-testid={`lamb-card-${lamb.id}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <Link href={`/animals/${lamb.id}`} className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm md:text-base" data-testid={`lamb-tag-${lamb.id}`}>
                              {lamb.tagId}
                            </span>
                            <Badge variant={stage.needsAttention ? "destructive" : "secondary"} className="text-xs" data-testid={`lamb-status-${lamb.id}`}>
                              {stage.label}
                            </Badge>
                            {lamb.sex === "ram" && (
                              <Badge variant="outline" className="text-xs">RAM</Badge>
                            )}
                            {lamb.sex === "ewe" && (
                              <Badge variant="outline" className="text-xs">EWE</Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                            <span>DOB: {lamb.birthDate ? format(new Date(lamb.birthDate), "dd/MM/yyyy") : "-"}</span>
                            <span>{ageDays} days old</span>
                            <span>Birth: {lamb.birthStatus || "-"}</span>
                            {lamb.weight100Day && <span>100d: {lamb.weight100Day}kg</span>}
                            {lamb.weight270Day && <span>270d: {lamb.weight270Day}kg</span>}
                            <span>Reason: {stage.reason}</span>
                            <span>Next: {stage.nextAction}</span>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                      </div>
                    </Link>
                    
                    <div className="flex items-center gap-1 shrink-0">
                      {needs100Day && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs"
                          onClick={(e) => {
                            e.preventDefault();
                            setSelectedAnimal(lamb);
                            setWeightType("100");
                            setShowWeightDialog(true);
                          }}
                          data-testid={`btn-100day-${lamb.id}`}
                        >
                          <Scale className="w-3 h-3 mr-1" />
                          100d
                        </Button>
                      )}
                      
                      {needs270Day && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs"
                          onClick={(e) => {
                            e.preventDefault();
                            setSelectedAnimal(lamb);
                            setWeightType("270");
                            setShowWeightDialog(true);
                          }}
                          data-testid={`btn-270day-${lamb.id}`}
                        >
                          <Scale className="w-3 h-3 mr-1" />
                          270d
                        </Button>
                      )}
                      
                      {lamb.sex === "ram" && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              size="sm"
                              variant={needsClassification ? "default" : "outline"}
                              className="h-8 text-xs"
                              data-testid={`btn-classify-${lamb.id}`}
                            >
                              <Tag className="w-3 h-3 mr-1" />
                              {needsClassification ? "Classify" : (lamb.ramLambClass ? lamb.ramLambClass.charAt(0).toUpperCase() + lamb.ramLambClass.slice(1) : "Classify")}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem 
                              onClick={() => handleClassify(lamb, "stud")}
                              data-testid={`classify-stud-${lamb.id}`}
                            >
                              Stud Candidate
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleClassify(lamb, "commercial")}
                              data-testid={`classify-commercial-${lamb.id}`}
                            >
                              Commercial
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => handleClassify(lamb, "cull")}
                              data-testid={`classify-cull-${lamb.id}`}
                            >
                              Mark for Cull
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                      
                      {lamb.ramLambClass === "cull" && !lamb.cullConfirmed && (
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-8 text-xs"
                          onClick={(e) => {
                            e.preventDefault();
                            setSelectedAnimal(lamb);
                            setShowCullConfirm(true);
                          }}
                          data-testid={`btn-confirm-cull-${lamb.id}`}
                        >
                          <Trash2 className="w-3 h-3 mr-1" />
                          Confirm Cull
                        </Button>
                      )}
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 text-xs"
                            data-testid={`btn-remove-${lamb.id}`}
                          >
                            <UserMinus className="w-3 h-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem 
                            onClick={() => {
                              setSelectedAnimal(lamb);
                              setRemoveReason("sold");
                              setShowRemoveConfirm(true);
                            }}
                            data-testid={`remove-sold-${lamb.id}`}
                          >
                            Mark as Sold
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => {
                              setSelectedAnimal(lamb);
                              setRemoveReason("deceased");
                              setShowRemoveConfirm(true);
                            }}
                            data-testid={`remove-deceased-${lamb.id}`}
                          >
                            Mark as Deceased
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => {
                              setSelectedAnimal(lamb);
                              setRemoveReason("transferred");
                              setShowRemoveConfirm(true);
                            }}
                            data-testid={`remove-transferred-${lamb.id}`}
                          >
                            Mark as Transferred
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => {
                              setSelectedAnimal(lamb);
                              setShowCullConfirm(true);
                            }}
                            data-testid={`remove-cull-${lamb.id}`}
                          >
                            Cull Animal
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        <AlertDialog open={showCullConfirm} onOpenChange={setShowCullConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Cull</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to cull {selectedAnimal?.tagId}? This will remove the animal from all active herd lists. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-2">
              <Label htmlFor="cull-reason">Cull Reason (optional)</Label>
              <Textarea
                id="cull-reason"
                placeholder="Enter reason for culling..."
                value={cullReason}
                onChange={(e) => setCullReason(e.target.value)}
                className="mt-1.5"
                data-testid="input-cull-reason"
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="btn-cancel-cull">Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleConfirmCull}
                className="bg-white text-red-600 border border-red-200 hover:bg-red-50"
                data-testid="btn-confirm-cull-action"
              >
                Confirm Cull
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={showRemoveConfirm} onOpenChange={setShowRemoveConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove from Herd</AlertDialogTitle>
              <AlertDialogDescription>
                Remove {selectedAnimal?.tagId} from active herd as "{removeReason}"?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-2 space-y-3">
              <div>
                <Label htmlFor="remove-reason">Reason</Label>
                <Select value={removeReason} onValueChange={(v: any) => setRemoveReason(v)}>
                  <SelectTrigger className="mt-1.5" data-testid="select-remove-reason">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sold">Sold</SelectItem>
                    <SelectItem value="deceased">Deceased</SelectItem>
                    <SelectItem value="transferred">Transferred</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="remove-notes">Notes (optional)</Label>
                <Textarea
                  id="remove-notes"
                  placeholder="Additional notes..."
                  value={removeNotes}
                  onChange={(e) => setRemoveNotes(e.target.value)}
                  className="mt-1.5"
                  data-testid="input-remove-notes"
                />
              </div>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="btn-cancel-remove">Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleRemoveFromHerd}
                data-testid="btn-confirm-remove"
              >
                Remove from Herd
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Dialog open={showWeightDialog} onOpenChange={setShowWeightDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record {weightType}-Day Weight</DialogTitle>
              <DialogDescription>
                Enter the {weightType}-day weight for {selectedAnimal?.tagId}
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label htmlFor="weight-value">Weight (kg)</Label>
              <Input
                id="weight-value"
                type="number"
                step="0.1"
                placeholder="e.g., 35.5"
                value={weightValue}
                onChange={(e) => setWeightValue(e.target.value)}
                className="mt-1.5"
                data-testid="input-weight"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowWeightDialog(false)} data-testid="btn-cancel-weight">
                Cancel
              </Button>
              <Button onClick={handleSaveWeight} disabled={!weightValue} data-testid="btn-save-weight">
                Save Weight
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showPromoteDialog} onOpenChange={setShowPromoteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Promote to Rams Section</DialogTitle>
              <DialogDescription>
                {selectedAnimal?.tagId} has completed 270-day weigh-in as a stud candidate. Select the ram type for the Rams section.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label>Ram Type</Label>
              <Select value={selectedRamType} onValueChange={(v: any) => setSelectedRamType(v)}>
                <SelectTrigger className="mt-1.5" data-testid="select-ram-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="breeding_ram">Breeding Ram</SelectItem>
                  <SelectItem value="stud_ram">Stud Ram</SelectItem>
                  <SelectItem value="commercial_ram">Commercial Ram</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPromoteDialog(false)} data-testid="btn-cancel-promote">
                Cancel
              </Button>
              <Button onClick={handlePromoteToRam} data-testid="btn-confirm-promote">
                Promote to Rams
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        <PDFExportDialog
          open={pdfExport.isOpen}
          onOpenChange={pdfExport.setIsOpen}
          title="Export Lambs PDF"
          description="Select the quality level for your PDF export. Lower quality means smaller file size and faster export."
          onExport={handlePDFExport}
        />
      </div>
    </Layout>
  );
}
