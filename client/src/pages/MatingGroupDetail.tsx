import { Layout } from "@/components/Layout";
import { useMatingGroups, useUpdateMatingGroup, useDeleteMatingGroup } from "@/hooks/use-mating-groups";
import { useAnimals } from "@/hooks/use-animals";
import { useFarmSettings } from "@/hooks/use-farm-settings";
import { useCreateExportedDocument } from "@/hooks/use-exported-documents";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertMatingGroupSchema, type MatingGroup } from "@shared/schema";
import { ArrowLeft, Calendar, Shield, Heart, Download, Pencil, Trash2, Archive, Users } from "lucide-react";
import { format, addDays, addMonths } from "date-fns";
import { useState, useEffect } from "react";
import { z } from "zod";
import { useLocation, Link } from "wouter";
import { useRoute } from "wouter";
import { useNavigationHistory } from "@/lib/navigation-history-context";
import {
  getCanonicalGroupCSS,
  renderExportHeader,
  renderExportFooter,
  wrapExportDocument,
  openExportPrintDialog,
  GROUP_ROWS_PER_PAGE,
  sanitizePublicNote,
  escapeHtmlText,
  getExportStatusClassToken,
} from "@/lib/export-template";

export default function MatingGroupDetail() {
  const [, params] = useRoute("/breeding/groups/:id");
  const groupId = params?.id ? parseInt(params.id) : null;
  const [, navigate] = useLocation();
  const { goBack } = useNavigationHistory();
  
  const { data: matingGroups, isLoading } = useMatingGroups();
  const { data: animals } = useAnimals({});
  const { data: farmSettings } = useFarmSettings();
  const createExportedDoc = useCreateExportedDocument();
  
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  const displayName = farmSettings?.studName || farmSettings?.farmName;
  const group = matingGroups?.find(g => g.id === groupId);
  
  const getAnimalById = (id: number) => animals?.find(a => a.id === id);
  
  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </Layout>
    );
  }
  
  if (!group) {
    return (
      <Layout>
        <div className="space-y-4">
          <Button variant="ghost" onClick={() => goBack('/breeding')} data-testid="button-back">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Breeding
          </Button>
          <div className="text-center py-12">
            <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h2 className="text-xl font-bold mb-2">Mating Group Not Found</h2>
            <p className="text-muted-foreground">This mating group may have been deleted or does not exist.</p>
          </div>
        </div>
      </Layout>
    );
  }
  
  const ram = getAnimalById(group.ramId);
  const dateIn = new Date(group.dateIn);
  const dateOut = group.dateOut ? new Date(group.dateOut) : addDays(dateIn, 42);
  const expectedLambing = addMonths(dateIn, 5);
  const ewesInGroup = (group.eweIds || []).map(id => {
    const ewe = getAnimalById(id);
    return ewe
      ? { ...ewe, unavailable: false as const }
      : {
          id,
          tagId: `Unavailable animal #${id}`,
          name: "",
          photo: "",
          electronicId: "",
          tattooId: "",
          breed: "",
          currentWeight: null,
          status: "unavailable",
          unavailable: true as const,
        };
  });
  
  const getDocumentFileName = (type: string) => {
    const date = format(new Date(), "yyyy-MM-dd");
    const safeName = group.name.replace(/[^a-zA-Z0-9]/g, '_');
    return `${safeName}_${type}_${date}.pdf`;
  };
  
  const getGroupExportData = () => {
    const ewes = ewesInGroup.map(ewe => ({
        id: ewe.id,
        tagId: ewe.tagId,
        name: ewe.name || "",
        photo: ewe.photo || "",
        electronicId: ewe.electronicId || "",
        tattooId: ewe.tattooId || "",
        breed: ewe.unavailable ? "" : ewe.breed || "Meatmaster",
        currentWeight: ewe.currentWeight || null,
        status: ewe.unavailable ? "unavailable" : ewe.status || "",
        unavailable: ewe.unavailable,
      }));
    
    return {
      name: group.name,
      ramId: group.ramId,
      ramTagId: ram?.tagId || String(group.ramId),
      ramName: ram?.name || "",
      ramPhoto: ram?.photo || "",
      ramElectronicId: ram?.electronicId || "",
      ramTattooId: ram?.tattooId || "",
      ramBreed: ram?.breed || "Meatmaster",
      ewes: ewes,
      eweCount: (group.eweIds || []).length,
      dateIn: format(dateIn, "yyyy-MM-dd"),
      dateOut: format(dateOut, "yyyy-MM-dd"),
      matingPeriodDays: 42,
      expectedLambing: format(expectedLambing, "yyyy-MM-dd"),
      lambingSeason: group.lambingSeason || "",
      environmentGroup: group.environmentGroup || "",
      managementGroup: group.managementGroup || "",
      status: group.status,
      notes: group.notes || "",
    };
  };
  
  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  const exportCSV = () => {
    const g = getGroupExportData();
    const farmInfo = farmSettings ? [
      `"Farm/Stud","${farmSettings.studName || farmSettings.farmName || ''}"`,
      `"Export Date","${format(new Date(), "dd/MM/yyyy")}"`,
      `"Mating Group","${g.name}"`,
      "",
    ].join("\n") : "";
    
    const headers = ["Ewe Tag", "Ewe Name", "Electronic ID", "Breed", "Date Introduced", "Current status"];
    const rows = g.ewes.map((ewe: any) => [
      ewe.tagId, ewe.name || "", ewe.electronicId || "", ewe.breed, g.dateIn, ewe.status || "active"
    ]);
    const dataContent = [headers.join(","), ...rows.map(r => r.map(v => `"${v}"`).join(","))].join("\n");
    const content = farmInfo + `"Ram","${g.ramTagId} (${g.ramName})"` + "\n\n" + dataContent;
    const safeName = group.name.replace(/[^a-zA-Z0-9]/g, '_');
    downloadFile(content, `${safeName}-${format(new Date(), "yyyy-MM-dd")}.csv`, "text/csv");
  };
  
  const exportPDF = () => {
    {
    const g = getGroupExportData();
    const exportDate = format(new Date(), "dd/MM/yyyy HH:mm");
    const title = `${g.name} Mating Group Report`;
    const chunks = Array.from(
      { length: Math.max(1, Math.ceil(g.ewes.length / GROUP_ROWS_PER_PAGE)) },
      (_, page) => g.ewes.slice(page * GROUP_ROWS_PER_PAGE, (page + 1) * GROUP_ROWS_PER_PAGE),
    );
    const css = getCanonicalGroupCSS() + `
      .summary { display:grid; grid-template-columns:repeat(4, 1fr); border:1px solid #ddd; margin-bottom:4mm; }
      .summary div { padding:3mm; border-right:1px solid #ddd; }
      .summary div:last-child { border-right:0; }
      .summary strong { display:block; font-size:7pt; color:#666; text-transform:uppercase; margin-bottom:1mm; }
      .notes { margin-top:3mm; font-size:8pt; }
    `;
    const pages = chunks.map((ewes, page) => `<div class="page">
      ${renderExportHeader(farmSettings, page + 1, chunks.length, exportDate, title, `Mating Group — ${g.name}`)}
      <p class="section-label">${escapeHtmlText(g.name)}${page ? " — Ewes continued" : ""}</p>
      ${page === 0 ? `<div class="summary">
        <div><strong>Ram</strong>${escapeHtmlText(g.ramTagId)}${g.ramName ? ` (${escapeHtmlText(g.ramName)})` : ""}</div>
        <div><strong>Mating period</strong>${g.dateIn} – ${g.dateOut}</div>
        <div><strong>Expected lambing</strong>${g.expectedLambing}</div>
        <div><strong>Group status</strong><span class="status status-${getExportStatusClassToken(g.status)}">${escapeHtmlText(g.status || "active")}</span></div>
      </div>` : ""}
      <table class="export-table"><thead><tr><th class="row-num">#</th><th>Ewe ID</th><th>Name</th><th>Electronic ID</th><th>Breed</th><th>Weight</th><th>Current status</th></tr></thead>
      <tbody>${ewes.length ? ewes.map((ewe: any, index: number) => `<tr>
        <td class="row-num">${page * GROUP_ROWS_PER_PAGE + index + 1}</td><td>${escapeHtmlText(ewe.tagId)}</td><td>${escapeHtmlText(ewe.name || "—")}</td>
        <td>${escapeHtmlText(ewe.electronicId || "—")}</td><td>${escapeHtmlText(ewe.breed)}</td><td>${escapeHtmlText(ewe.currentWeight ? `${ewe.currentWeight} kg` : "—")}</td>
        <td><span class="status status-${getExportStatusClassToken(ewe.status)}">${escapeHtmlText(ewe.status || "active")}</span></td>
      </tr>`).join("") : `<tr><td colspan="7" class="zero-state">No ewes recorded in this mating group</td></tr>`}</tbody></table>
      ${page === 0 && g.notes ? `<p class="notes"><strong>Group notes:</strong> ${escapeHtmlText(sanitizePublicNote(g.notes))}</p>` : ""}
      ${renderExportFooter(farmSettings)}
    </div>`).join("");
    openExportPrintDialog(wrapExportDocument(title, css, pages));
    createExportedDoc.mutate({
      name: getDocumentFileName("MatingGroup"),
      documentType: "breeding",
      subfolder: "breeding"
    });
    }

  };
  
  return (
    <Layout>
      <div className="space-y-4 md:space-y-6 animate-in fade-in duration-500">
        <div className="flex flex-col gap-3">
          <Button 
            variant="ghost" 
            onClick={() => goBack('/breeding')} 
            className="w-fit"
            data-testid="button-back"
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Breeding
          </Button>
          
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl md:text-3xl font-bold uppercase tracking-tight" data-testid="group-title">
                {group.name}
              </h1>
              <p className="text-sm text-muted-foreground">
                {displayName && `${displayName} • `}Mating Group Details
              </p>
            </div>
            
            <div className="flex flex-wrap gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" data-testid="button-export-group">
                    <Download className="w-4 h-4 mr-1" /> Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={exportPDF} data-testid="menu-export-pdf">
                    Export as PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportCSV} data-testid="menu-export-csv">
                    Export as CSV
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setEditDialogOpen(true)}
                data-testid="button-edit-group"
              >
                <Pencil className="w-4 h-4 mr-1" /> Edit
              </Button>
              
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowDeleteConfirm(true)}
                className="bg-white text-red-600 border-red-200 hover:bg-red-50"
                data-testid="button-delete-group"
              >
                <Trash2 className="w-4 h-4 mr-1" /> Delete
              </Button>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="rugged-card lg:col-span-2">
            <CardHeader className="p-3 md:p-6 pb-2">
              <CardTitle className="uppercase text-sm md:text-lg flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                Group Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 md:p-6 pt-0">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 bg-secondary rounded-md">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge 
                    variant="outline" 
                    className={group.status === 'active' 
                      ? "bg-green-600/20 text-green-600 dark:text-green-400 border-green-500 dark:border-green-700 mt-1" 
                      : "bg-secondary text-muted-foreground border-border mt-1"
                    }
                  >
                    {(group.status || "active").toUpperCase()}
                  </Badge>
                </div>
                <div className="p-3 bg-secondary rounded-md">
                  <p className="text-xs text-muted-foreground">Ewes in Group</p>
                  <p className="text-xl font-bold text-primary">{ewesInGroup.length}</p>
                </div>
                <div className="p-3 bg-secondary rounded-md">
                  <p className="text-xs text-muted-foreground">Mating Period</p>
                  <p className="font-medium text-sm">{format(dateIn, "dd MMM")} - {format(dateOut, "dd MMM yyyy")}</p>
                </div>
                <div className="p-3 bg-primary/10 rounded-md border border-primary/30">
                  <p className="text-xs text-muted-foreground">Expected Lambing</p>
                  <p className="font-bold text-primary">{format(expectedLambing, "dd MMM yyyy")}</p>
                </div>
              </div>
              
              {group.lambingSeason && (
                <div className="mt-4 p-3 bg-secondary rounded-md">
                  <p className="text-xs text-muted-foreground">Season Code</p>
                  <p className="font-medium">{group.lambingSeason}</p>
                </div>
              )}
              
              {group.notes && (
                <div className="mt-4 p-3 bg-secondary rounded-md">
                  <p className="text-xs text-muted-foreground mb-1">Notes</p>
                  <p className="text-sm">{group.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
          
          <Card className="rugged-card">
            <CardHeader className="p-3 md:p-6 pb-2">
              <CardTitle className="uppercase text-sm md:text-lg flex items-center gap-2">
                <Shield className="w-5 h-5 text-blue-400" />
                Ram
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 md:p-6 pt-0">
              {ram ? (
                <Link 
                  href={`/animals/${ram.id}`}
                  className="block p-3 bg-secondary rounded-md hover:bg-secondary/80 transition-colors"
                  data-testid="link-ram-profile"
                >
                  <div className="flex items-center gap-3">
                    {ram.photo ? (
                      <img 
                        src={ram.photo} 
                        alt={ram.tagId} 
                        className="w-12 h-12 rounded-full object-cover border-2 border-blue-500/50"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-blue-900/30 border-2 border-blue-500/50 flex items-center justify-center">
                        <Shield className="w-5 h-5 text-blue-400" />
                      </div>
                    )}
                    <div>
                      <p className="font-bold">{ram.tagId}</p>
                      {ram.name && <p className="text-sm text-muted-foreground">{ram.name}</p>}
                      <p className="text-xs text-muted-foreground">{ram.breed || "Meatmaster"}</p>
                    </div>
                  </div>
                </Link>
              ) : (
                <div className="p-3 bg-secondary rounded-md text-center text-muted-foreground text-sm">
                  Ram not found (ID: {group.ramId})
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        
        <Card className="rugged-card">
          <CardHeader className="p-3 md:p-6 pb-2">
            <CardTitle className="uppercase text-sm md:text-lg flex items-center gap-2">
              <Heart className="w-5 h-5 text-pink-400" />
              Ewes in Group ({ewesInGroup.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 md:p-6 pt-0">
            {ewesInGroup.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground border-2 border-dashed border-border rounded-md">
                <Heart className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No ewes assigned to this group yet.</p>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setEditDialogOpen(true)}
                  className="text-primary mt-2"
                >
                  Add Ewes
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {ewesInGroup.map((ewe, index) => ewe.unavailable ? (
                  <div
                    key={`${ewe.id}-${index}`}
                    className="p-3 bg-secondary rounded-md border border-dashed border-border flex items-center gap-3"
                    data-testid={`unavailable-ewe-${ewe.id}`}
                  >
                    <div className="w-10 h-10 rounded-full bg-muted border-2 border-border flex items-center justify-center">
                      <Heart className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-sm truncate">{ewe.tagId}</p>
                      <Badge variant="outline" className="mt-1 text-xs">Unavailable</Badge>
                    </div>
                  </div>
                ) : (
                  <Link
                    key={`${ewe.id}-${index}`}
                    href={`/animals/${ewe.id}`}
                    className="p-3 bg-secondary rounded-md hover:bg-secondary/80 transition-colors flex items-center gap-3"
                    data-testid={`link-ewe-${ewe.id}`}
                  >
                    {ewe.photo ? (
                      <img
                        src={ewe.photo}
                        alt={ewe.tagId}
                        className="w-10 h-10 rounded-full object-cover border-2 border-pink-500/50"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-pink-900/30 border-2 border-pink-500/50 flex items-center justify-center">
                        <Heart className="w-4 h-4 text-pink-400" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-sm truncate">{ewe.tagId}</p>
                      {ewe.name && <p className="text-xs text-muted-foreground truncate">{ewe.name}</p>}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      {editDialogOpen && (
        <EditMatingGroupDialog 
          group={group} 
          open={editDialogOpen} 
          onOpenChange={setEditDialogOpen}
        />
      )}
      
      <DeleteConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        groupId={group.id}
        groupName={group.name}
        onDeleted={() => navigate("/breeding")}
      />
    </Layout>
  );
}

function EditMatingGroupDialog({ group, open, onOpenChange }: { group: MatingGroup, open: boolean, onOpenChange: (open: boolean) => void }) {
  const { mutate: updateGroup, isPending } = useUpdateMatingGroup();
  const { data: animals } = useAnimals({});
  const [selectedEwes, setSelectedEwes] = useState<number[]>(group.eweIds || []);
  
  const rams = animals?.filter(a => a.sex === 'ram' && a.status === 'active') || [];
  const ewes = animals?.filter(a => a.sex === 'ewe' && a.status === 'active') || [];
  
  const matingGroupFormSchema = insertMatingGroupSchema.extend({
    dateIn: z.string().min(1, "Start date is required"),
  });
  
  const form = useForm({
    resolver: zodResolver(matingGroupFormSchema),
    defaultValues: {
      name: group.name,
      ramId: group.ramId,
      dateIn: group.dateIn,
      dateOut: group.dateOut || addDays(new Date(group.dateIn), 42).toISOString().split('T')[0],
      lambingSeason: group.lambingSeason || "",
      environmentGroup: group.environmentGroup || "",
      managementGroup: group.managementGroup || "",
      status: group.status || "active",
      notes: group.notes || "",
    }
  });

  useEffect(() => {
    if (open) {
      setSelectedEwes(group.eweIds || []);
      form.reset({
        name: group.name,
        ramId: group.ramId,
        dateIn: group.dateIn,
        dateOut: group.dateOut || addDays(new Date(group.dateIn), 42).toISOString().split('T')[0],
        lambingSeason: group.lambingSeason || "",
        environmentGroup: group.environmentGroup || "",
        managementGroup: group.managementGroup || "",
        status: group.status || "active",
        notes: group.notes || "",
      });
    }
  }, [open, group]);

  const dateIn = form.watch("dateIn");
  const expectedLambing = dateIn ? format(addMonths(new Date(dateIn), 5), "dd MMM yyyy") : "--";
  const matingEndDate = dateIn ? format(addDays(new Date(dateIn), 42), "dd MMM yyyy") : "--";

  const toggleEwe = (eweId: number) => {
    setSelectedEwes(prev => 
      prev.includes(eweId) 
        ? prev.filter(id => id !== eweId)
        : [...prev, eweId]
    );
  };

  const onSubmit = (data: any) => {
    const submitData = {
      ...data,
      ramId: Number(data.ramId),
      eweIds: selectedEwes.length > 0 ? selectedEwes : null,
      dateOut: addDays(new Date(data.dateIn), 42).toISOString().split('T')[0],
    };
    
    updateGroup({ id: group.id, data: submitData }, { 
      onSuccess: () => {
        onOpenChange(false);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="uppercase font-bold">Edit Mating Group</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField name="name" control={form.control} render={({ field }) => (
              <FormItem>
                <FormLabel>Group Name</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., Spring 2026 Group A" className="rugged-input" {...field} />
                </FormControl>
                <FormMessage/>
              </FormItem>
            )}/>
            
            <FormField name="ramId" control={form.control} render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-blue-400" /> Select Ram
                </FormLabel>
                <Select onValueChange={(v) => field.onChange(Number(v))} value={String(field.value || "")}>
                  <FormControl>
                    <SelectTrigger className="rugged-input">
                      <SelectValue placeholder="Choose a ram..." />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {rams.map(ram => (
                      <SelectItem key={ram.id} value={String(ram.id)}>
                        {ram.tagId} {ram.name ? `(${ram.name})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage/>
              </FormItem>
            )}/>

            <div className="space-y-2">
              <FormLabel className="flex items-center gap-2">
                <Heart className="w-4 h-4 text-pink-400" /> Select Ewes ({selectedEwes.length} selected)
              </FormLabel>
              <div className="max-h-40 overflow-y-auto border border-border rounded-md p-2 space-y-1">
                {ewes.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-2">No active ewes available</p>
                ) : (
                  ewes.map(ewe => (
                    <label 
                      key={ewe.id} 
                      className="flex items-center gap-2 p-1.5 rounded hover:bg-secondary cursor-pointer text-sm"
                    >
                      <Checkbox 
                        checked={selectedEwes.includes(ewe.id)}
                        onCheckedChange={() => toggleEwe(ewe.id)}
                      />
                      <span>{ewe.tagId}</span>
                      {ewe.name && <span className="text-muted-foreground">({ewe.name})</span>}
                    </label>
                  ))
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 xs:grid-cols-2 gap-4">
              <FormField name="dateIn" control={form.control} render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> Start Date
                  </FormLabel>
                  <FormControl>
                    <Input type="date" className="rugged-input" {...field} />
                  </FormControl>
                  <FormMessage/>
                </FormItem>
              )}/>
              
              <div>
                <FormLabel className="text-muted-foreground">Mating Period</FormLabel>
                <p className="text-sm font-medium mt-2">42 days</p>
                <p className="text-xs text-muted-foreground">Ends: {matingEndDate}</p>
              </div>
            </div>

            <div className="p-3 bg-primary/10 rounded-md border border-primary/30">
              <p className="text-xs text-muted-foreground">Expected Lambing (5 months)</p>
              <p className="font-bold text-primary">{expectedLambing}</p>
            </div>

            <FormField name="lambingSeason" control={form.control} render={({ field }) => (
              <FormItem>
                <FormLabel>Lambing Season Code</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., 26A" className="rugged-input" {...field} value={field.value || ""} />
                </FormControl>
                <FormMessage/>
              </FormItem>
            )}/>

            <FormField name="notes" control={form.control} render={({ field }) => (
              <FormItem>
                <FormLabel>Notes</FormLabel>
                <FormControl>
                  <Textarea placeholder="Optional notes..." className="rugged-input" {...field} value={field.value || ""} />
                </FormControl>
                <FormMessage/>
              </FormItem>
            )}/>

            <Button 
              type="submit" 
              disabled={isPending || !form.watch("ramId")} 
              data-testid="button-save-mating-group" 
              className="w-full rugged-btn bg-primary text-primary-foreground"
            >
              {isPending ? "Saving..." : "Save Changes"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteConfirmDialog({ 
  open, 
  onOpenChange, 
  groupId, 
  groupName,
  onDeleted 
}: { 
  open: boolean, 
  onOpenChange: (open: boolean) => void, 
  groupId: number,
  groupName: string,
  onDeleted: () => void 
}) {
  const { mutate: deleteGroup, isPending } = useDeleteMatingGroup();
  
  const handleDelete = () => {
    deleteGroup(groupId, {
      onSuccess: () => {
        onOpenChange(false);
        onDeleted();
      }
    });
  };
  
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Mating Group?</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete "{groupName}"? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleDelete}
            disabled={isPending}
            className="bg-white text-red-600 border border-red-200 hover:bg-red-50"
          >
            {isPending ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
