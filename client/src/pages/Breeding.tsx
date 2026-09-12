import { Layout } from "@/components/Layout";
import { useBreedingEvents } from "@/hooks/use-breeding";
import { useMatingGroups, useCreateMatingGroup, useUpdateMatingGroup, useDeleteMatingGroup } from "@/hooks/use-mating-groups";
import { useAnimals } from "@/hooks/use-animals";
import { useFarmSettings } from "@/hooks/use-farm-settings";
import { useCreateExportedDocument } from "@/hooks/use-exported-documents";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertMatingGroupSchema, type MatingGroup } from "@shared/schema";
import { Plus, Calendar, Shield, Heart, Users, Download, Pencil, Trash2, Archive, ChevronRight } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { format, addDays, addMonths } from "date-fns";
import { useState } from "react";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
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

export default function Breeding() {
  const { data: events, isLoading } = useBreedingEvents();
  const { data: matingGroupsList, isLoading: loadingGroups } = useMatingGroups();
  const { data: animals } = useAnimals({});
  const { data: farmSettings } = useFarmSettings();
  const displayName = farmSettings?.studName || farmSettings?.farmName;
  const [openMatingGroup, setOpenMatingGroup] = useState(false);
  const [editingGroup, setEditingGroup] = useState<MatingGroup | null>(null);

  const createExportedDoc = useCreateExportedDocument();
  
  const getDocumentFileName = (type: string, identifier: string) => {
    const date = format(new Date(), "yyyy-MM-dd");
    return `${identifier}_${type}_${date}.pdf`;
  };
  
  const activeGroups = matingGroupsList?.filter(g => g.status === 'active') || [];
  const closedGroups = matingGroupsList?.filter(g => g.status === 'closed') || [];

  const getAnimalById = (id: number) => animals?.find(a => a.id === id);

  const getExportData = () => {
    return matingGroupsList?.map(group => {
      const dateIn = new Date(group.dateIn);
      const dateOut = group.dateOut ? new Date(group.dateOut) : addDays(dateIn, 42);
      const expectedLambing = addMonths(dateIn, 5);
      const ram = getAnimalById(group.ramId);
      
      // Get full ewe details
      const eweIds = group.eweIds || [];
      const ewes = eweIds.map(id => {
        const ewe = getAnimalById(id);
        return ewe ? {
          id: ewe.id,
          tagId: ewe.tagId,
          name: ewe.name || "",
          photo: ewe.photo || "",
          electronicId: ewe.electronicId || "",
          tattooId: ewe.tattooId || "",
          breed: ewe.breed || "Meatmaster",
          currentWeight: ewe.currentWeight || null,
          status: ewe.status || "",
          notes: ewe.notes || "",
        } : {
          id,
          tagId: `Unavailable/deleted record (ID ${id})`,
          name: "Record unavailable or deleted",
          photo: "",
          electronicId: "",
          tattooId: "",
          breed: "—",
          currentWeight: null,
          status: "unavailable",
          notes: "",
          unavailable: true,
        };
      });
      
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
        eweCount: eweIds.length,
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
    }) || [];
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
    const exportData = getExportData();
    if (exportData.length === 0) return;
    
    const farmInfo = farmSettings ? [
      `"Farm/Stud","${farmSettings.studName || farmSettings.farmName || ''}"`,
      `"Owner","${farmSettings.ownerName || ''}"`,
      `"Phone","${farmSettings.ownerPhone || ''}"`,
      `"Email","${farmSettings.ownerEmail || ''}"`,
      `"Location","${farmSettings.farmLocation || ''}"`,
      `"Membership","${farmSettings.membershipNumber || ''}"`,
      `"Export Date","${format(new Date(), "dd/MM/yyyy")}"`,
      "",
    ].join("\n") : "";
    
    const headers = ["Ram Photo", "Ram Tag", "Ram Name", "Group Name", "Date In", "Date Out", "Mating Days", "Expected Lambing", "Season", "Status", "Notes"];
    const rows = exportData.map(g => [
      g.ramPhoto, g.ramTagId, g.ramName, g.name, g.dateIn, g.dateOut, g.matingPeriodDays, 
      g.expectedLambing, g.lambingSeason, g.status, g.notes
    ]);
    const dataContent = [headers.join(","), ...rows.map(r => r.map(v => `"${v}"`).join(","))].join("\n");
    const content = farmInfo + dataContent;
    downloadFile(content, `mating-groups-${format(new Date(), "yyyy-MM-dd")}.csv`, "text/csv");
  };

  const exportMatingGroupsReport = () => {
    const groups = getExportData();
    if (groups.length === 0) return;

    const exportDate = format(new Date(), "dd/MM/yyyy HH:mm");
    const title = "Mating Groups Report";
    const subtitle = `Mating Groups Register — ${groups.length} groups (all statuses)`;
    const pages = groups.flatMap((group) => {
      const ewePages = Math.max(1, Math.ceil(group.ewes.length / GROUP_ROWS_PER_PAGE));
      return Array.from({ length: ewePages }, (_, page) => ({
        group,
        ewes: group.ewes.slice(page * GROUP_ROWS_PER_PAGE, (page + 1) * GROUP_ROWS_PER_PAGE),
        continuation: page > 0,
        rowStart: page * GROUP_ROWS_PER_PAGE,
      }));
    });
    const totalPages = pages.length;
    const css = getCanonicalGroupCSS() + `
      .group-summary { display:grid; grid-template-columns:repeat(5, 1fr); border:1px solid #ddd; margin-bottom:4mm; }
      .group-summary div { padding:3mm; border-right:1px solid #ddd; }
      .group-summary div:last-child { border-right:0; }
      .group-summary strong { display:block; font-size:7pt; color:#666; text-transform:uppercase; margin-bottom:1mm; }
      .group-notes { margin-top:3mm; font-size:8pt; }
    `;
    const pagesHtml = pages.map(({ group, ewes, continuation, rowStart }, index) => `
      <div class="page">
        ${renderExportHeader(farmSettings, index + 1, totalPages, exportDate, title, subtitle)}
        <p class="section-label">${escapeHtmlText(group.name)}${continuation ? " — Ewes continued" : ""}</p>
        ${!continuation ? `<div class="group-summary">
          <div><strong>Ram</strong>${escapeHtmlText(group.ramTagId)}${group.ramName ? ` (${escapeHtmlText(group.ramName)})` : ""}</div>
          <div><strong>Mating period</strong>${group.dateIn} – ${group.dateOut}</div>
          <div><strong>Expected lambing</strong>${group.expectedLambing}</div>
          <div><strong>Ewes in group</strong>${group.eweCount}</div>
          <div><strong>Group status</strong><span class="status status-${getExportStatusClassToken(group.status)}">${escapeHtmlText(group.status || "active")}</span></div>
        </div>` : ""}
        <table class="export-table">
          <thead><tr><th class="row-num">#</th><th>Ewe ID</th><th>Name</th><th>Electronic ID</th><th>Breed</th><th>Weight</th><th>Current status</th></tr></thead>
          <tbody>${ewes.length ? ewes.map((ewe: any, eweIndex: number) => `<tr>
            <td class="row-num">${rowStart + eweIndex + 1}</td><td>${escapeHtmlText(ewe.tagId)}</td><td>${escapeHtmlText(ewe.name || "—")}</td>
            <td>${escapeHtmlText(ewe.electronicId || "—")}</td><td>${escapeHtmlText(ewe.breed)}</td><td>${escapeHtmlText(ewe.currentWeight ? `${ewe.currentWeight} kg` : "—")}</td>
            <td><span class="status status-${getExportStatusClassToken(ewe.status)}">${escapeHtmlText(ewe.status || "active")}</span></td>
          </tr>`).join("") : `<tr><td colspan="7" class="zero-state">No ewes recorded in this mating group</td></tr>`}</tbody>
        </table>
        ${!continuation && group.notes ? `<p class="group-notes"><strong>Group notes:</strong> ${escapeHtmlText(sanitizePublicNote(group.notes))}</p>` : ""}
        ${renderExportFooter(farmSettings)}
      </div>`).join("");
    openExportPrintDialog(wrapExportDocument(title, css, pagesHtml));
  };

  const exportPDF = () => {
    exportMatingGroupsReport();
    createExportedDoc.mutate({
      name: getDocumentFileName("MatingGroups", "Report"),
      documentType: "breeding",
      subfolder: "breeding"
    });

  };

  return (
    <Layout>
      <div className="space-y-4 md:space-y-8 animate-in fade-in duration-500">
        <div className="flex flex-col gap-2">
          <h1 className="text-lg md:text-3xl font-bold uppercase tracking-tight leading-tight" data-testid="page-title">
            {displayName ? `${displayName} - Breeding` : "Breeding Program"}
          </h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-8">
          <Card className="rugged-card">
            <CardHeader className="p-3 md:p-6 pb-2">
              <div className="flex justify-between items-center gap-2 flex-wrap">
                <CardTitle className="uppercase text-sm md:text-lg">Mating Groups</CardTitle>
                <div className="flex gap-2">
                  {matingGroupsList && matingGroupsList.length > 0 && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="outline" data-testid="button-export-mating-groups">
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
                  )}
                  <CreateMatingGroupDialog open={openMatingGroup} onOpenChange={setOpenMatingGroup} />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-3 md:p-6 pt-0">
              {loadingGroups ? (
                <p className="text-muted-foreground text-sm">Loading...</p>
              ) : activeGroups.length === 0 ? (
                <div className="text-center py-6 md:py-8 text-muted-foreground border-2 border-dashed border-border rounded-md">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No active mating groups.</p>
                  <Button 
                    variant="ghost" 
                    onClick={() => setOpenMatingGroup(true)}
                    data-testid="button-create-mating-group" 
                    className="text-primary mt-2"
                  >
                    Create Mating Group
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {activeGroups.map((group) => {
                    const dateIn = new Date(group.dateIn);
                    const dateOut = group.dateOut ? new Date(group.dateOut) : addDays(dateIn, 42);
                    const expectedLambing = addMonths(dateIn, 5);
                    
                    const ram = getAnimalById(group.ramId);
                    return (
                      <div key={group.id} className="p-3 bg-secondary rounded border border-border hover:bg-secondary/80 transition-colors">
                        <div className="flex justify-between items-start mb-2">
                          <Link 
                            href={`/breeding/groups/${group.id}`}
                            className="flex-1 cursor-pointer"
                            data-testid={`link-group-${group.id}`}
                          >
                            <p className="font-bold text-sm md:text-base hover:text-primary transition-colors">{group.name}</p>
                            <p className="text-xs text-muted-foreground">
                              Ram: {ram?.tagId || group.ramId} {ram?.name && `(${ram.name})`}
                            </p>
                            {group.eweIds && group.eweIds.length > 0 && (
                              <p className="text-xs text-muted-foreground">{group.eweIds.length} ewes in group</p>
                            )}
                          </Link>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              onClick={(e) => { e.stopPropagation(); setEditingGroup(group); }}
                              data-testid={`button-edit-group-${group.id}`}
                              className="h-7 w-7"
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <ArchiveMatingGroupButton group={group} />
                            <Link href={`/breeding/groups/${group.id}`}>
                              <Button size="icon" variant="ghost" className="h-7 w-7" data-testid={`button-view-group-${group.id}`}>
                                <ChevronRight className="w-4 h-4" />
                              </Button>
                            </Link>
                          </div>
                        </div>
                        <Link href={`/breeding/groups/${group.id}`} className="block">
                          <div className="grid grid-cols-2 gap-2 text-xs mt-2">
                            <div>
                              <span className="text-muted-foreground">Mating Period:</span>
                              <p className="font-medium">{format(dateIn, "dd MMM")} - {format(dateOut, "dd MMM yyyy")}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Expected Lambing:</span>
                              <p className="font-medium text-primary">{format(expectedLambing, "dd MMM yyyy")}</p>
                            </div>
                          </div>
                          {group.lambingSeason && (
                            <p className="text-xs mt-2">
                              <span className="text-muted-foreground">Season:</span> {group.lambingSeason}
                            </p>
                          )}
                        </Link>
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50">
                          <Badge variant="outline" className="bg-green-900/30 text-green-400 border-green-700 text-xs">
                            Active
                          </Badge>
                          <Link href={`/breeding/groups/${group.id}`}>
                            <Button size="sm" variant="ghost" className="text-xs h-6 px-2" data-testid={`button-details-group-${group.id}`}>
                              View Details <ChevronRight className="w-3 h-3 ml-1" />
                            </Button>
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              
              {closedGroups.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border">
                  <p className="text-xs text-muted-foreground mb-2">Previous Groups ({closedGroups.length})</p>
                  <div className="space-y-2">
                    {closedGroups.slice(0, 3).map((group) => (
                      <Link 
                        key={group.id} 
                        href={`/breeding/groups/${group.id}`}
                        className="p-2 bg-secondary/50 rounded text-xs flex justify-between items-center hover:bg-secondary transition-colors cursor-pointer"
                        data-testid={`link-closed-group-${group.id}`}
                      >
                        <span className="hover:text-primary">{group.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">{format(new Date(group.dateIn), "MMM yyyy")}</span>
                          <ChevronRight className="w-3 h-3 text-muted-foreground" />
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rugged-card">
            <CardHeader className="p-3 md:p-6 pb-2">
              <CardTitle className="uppercase text-sm md:text-lg">Recent Events</CardTitle>
            </CardHeader>
            <CardContent className="p-3 md:p-6 pt-0 space-y-3">
              {isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> : events?.slice(0, 5).map((evt) => {
                const ewe = getAnimalById(evt.eweId);
                const ram = getAnimalById(evt.ramId);
                return (
                  <Link 
                    key={evt.id} 
                    href={`/breeding/events/${evt.id}`}
                    className="flex justify-between items-center p-3 bg-secondary rounded border border-border hover:bg-secondary/80 transition-colors cursor-pointer"
                    data-testid={`link-event-${evt.id}`}
                  >
                    <div>
                      <p className="font-bold text-sm hover:text-primary transition-colors">
                        {ewe?.tagId || `Ewe ${evt.eweId}`} x {ram?.tagId || `Ram ${evt.ramId}`}
                      </p>
                      <p className="text-xs text-muted-foreground">{format(new Date(evt.matingDate), "dd MMM yyyy")} • {evt.matingType}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs uppercase font-bold text-primary">Recorded</span>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </Link>
                );
              })}
              {(!events || events.length === 0) && <p className="text-muted-foreground italic text-sm">No events recorded.</p>}
            </CardContent>
          </Card>
        </div>

        <div className="text-center py-6 px-4 border-t border-border/30 mt-4">
          <p className="text-sm text-muted-foreground italic max-w-md mx-auto">
            Great genetics start with great records. Every mating you log brings you closer to your <span className="text-primary font-medium">breeding goals</span>.
          </p>
        </div>
      </div>
      
      {editingGroup && (
        <EditMatingGroupDialog 
          group={editingGroup} 
          open={!!editingGroup} 
          onOpenChange={(open) => !open && setEditingGroup(null)} 
        />
      )}
    </Layout>
  );
}

function CreateMatingGroupDialog({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
  const { mutate, isPending } = useCreateMatingGroup();
  const { data: animals } = useAnimals({});
  const [selectedEwes, setSelectedEwes] = useState<number[]>([]);
  
  const rams = animals?.filter(a => a.sex === 'ram' && a.status === 'active') || [];
  const ewes = animals?.filter(a => a.sex === 'ewe' && a.status === 'active') || [];
  
  const matingGroupFormSchema = insertMatingGroupSchema.extend({
    dateIn: z.string().min(1, "Start date is required"),
  });
  
  const form = useForm({
    resolver: zodResolver(matingGroupFormSchema),
    defaultValues: {
      name: "",
      ramId: 0,
      dateIn: new Date().toISOString().split('T')[0],
      dateOut: addDays(new Date(), 42).toISOString().split('T')[0],
      lambingSeason: "",
      environmentGroup: "",
      managementGroup: "",
      status: "active",
      notes: "",
    }
  });

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
    
    mutate(submitData, { 
      onSuccess: () => {
        onOpenChange(false);
        setSelectedEwes([]);
        form.reset();
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" variant="default" data-testid="button-new-mating-group" className="rugged-btn">
          <Plus className="w-4 h-4 mr-1" /> New Group
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="uppercase font-bold">Create Mating Group</DialogTitle>
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
              {isPending ? "Creating..." : "Create Mating Group"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function EditMatingGroupDialog({ group, open, onOpenChange }: { group: MatingGroup, open: boolean, onOpenChange: (open: boolean) => void }) {
  const { mutate: updateGroup, isPending } = useUpdateMatingGroup();
  const { mutate: deleteGroup, isPending: isDeleting } = useDeleteMatingGroup();
  const { data: animals } = useAnimals({});
  const [selectedEwes, setSelectedEwes] = useState<number[]>(group.eweIds || []);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
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

  const handleDeleteConfirm = () => {
    deleteGroup(group.id, {
      onSuccess: () => {
        setShowDeleteConfirm(false);
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
            
            <FormField name="status" control={form.control} render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select onValueChange={field.onChange} value={field.value || "active"}>
                  <FormControl>
                    <SelectTrigger className="rugged-input">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
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

            <div className="flex gap-2">
              <Button 
                type="button"
                variant="destructive"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isDeleting}
                data-testid="button-delete-mating-group"
                className="flex-1"
              >
                <Trash2 className="w-4 h-4 mr-1" />
                {isDeleting ? "Deleting..." : "Delete"}
              </Button>
              <Button 
                type="submit" 
                disabled={isPending} 
                data-testid="button-update-mating-group" 
                className="flex-1 rugged-btn bg-primary text-primary-foreground"
              >
                {isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </Form>

        {/* Delete confirmation dialog */}
        <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Mating Group</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete the mating group "{group.name}"? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-delete-group">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="bg-white text-red-600 border border-red-200 hover:bg-red-50"
                data-testid="button-confirm-delete-group"
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}

function ArchiveMatingGroupButton({ group }: { group: MatingGroup }) {
  const { mutate: updateGroup, isPending } = useUpdateMatingGroup();
  const createExportedDoc = useCreateExportedDocument();
  const { toast } = useToast();
  
  const handleArchive = () => {
    updateGroup({
      id: group.id,
      data: { status: "closed" }
    }, {
      onSuccess: () => {
        createExportedDoc.mutate({
          name: `Mating Group Archived - ${group.name}`,
          documentType: "productivity",
          subfolder: "productivity"
        });
        toast({ 
          title: "Group Archived", 
          description: `${group.name} has been archived to productivity logs` 
        });
      }
    });
  };
  
  return (
    <Button 
      size="icon" 
      variant="ghost" 
      onClick={handleArchive}
      disabled={isPending}
      data-testid={`button-archive-group-${group.id}`}
      title="Archive Group"
    >
      <Archive className="w-4 h-4" />
    </Button>
  );
}

