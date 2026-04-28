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

export default function MatingGroupDetail() {
  const [, params] = useRoute("/breeding/groups/:id");
  const groupId = params?.id ? parseInt(params.id) : null;
  const [, navigate] = useLocation();
  
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
          <Button variant="ghost" onClick={() => navigate("/breeding")} data-testid="button-back">
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
  const ewesInGroup = (group.eweIds || []).map(id => getAnimalById(id)).filter(Boolean);
  
  const getDocumentFileName = (type: string) => {
    const date = format(new Date(), "yyyy-MM-dd");
    const safeName = group.name.replace(/[^a-zA-Z0-9]/g, '_');
    return `${safeName}_${type}_${date}.pdf`;
  };
  
  const getGroupExportData = () => {
    const ewes = (group.eweIds || []).map(id => {
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
      } : null;
    }).filter(Boolean);
    
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
      eweCount: ewes.length,
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
  
  const exportJSON = () => {
    const exportData = getGroupExportData();
    const content = JSON.stringify({
      exportDate: new Date().toISOString(),
      farm: displayName || "BreedLog Export",
      farmBranding: farmSettings ? {
        studName: farmSettings.studName || null,
        farmName: farmSettings.farmName || null,
        ownerName: farmSettings.ownerName || null,
      } : null,
      matingGroup: exportData,
    }, null, 2);
    const safeName = group.name.replace(/[^a-zA-Z0-9]/g, '_');
    downloadFile(content, `${safeName}-${format(new Date(), "yyyy-MM-dd")}.json`, "application/json");
  };
  
  const exportCSV = () => {
    const g = getGroupExportData();
    const farmInfo = farmSettings ? [
      `"Farm/Stud","${farmSettings.studName || farmSettings.farmName || ''}"`,
      `"Export Date","${format(new Date(), "dd/MM/yyyy")}"`,
      `"Mating Group","${g.name}"`,
      "",
    ].join("\n") : "";
    
    const headers = ["Ewe Tag", "Ewe Name", "Electronic ID", "Breed", "Date Introduced", "Status"];
    const rows = g.ewes.map((ewe: any) => [
      ewe.tagId, ewe.name || "", ewe.electronicId || "", ewe.breed, g.dateIn, "Active"
    ]);
    const dataContent = [headers.join(","), ...rows.map(r => r.map(v => `"${v}"`).join(","))].join("\n");
    const content = farmInfo + `"Ram","${g.ramTagId} (${g.ramName})"` + "\n\n" + dataContent;
    const safeName = group.name.replace(/[^a-zA-Z0-9]/g, '_');
    downloadFile(content, `${safeName}-${format(new Date(), "yyyy-MM-dd")}.csv`, "text/csv");
  };
  
  const exportPDF = () => {
    const g = getGroupExportData();
    
    const content = `
<!DOCTYPE html>
<html>
<head>
<title>${g.name} - Mating Group Report</title>
<style>
@page { size: A4 portrait; margin: 10mm; }
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 9pt; color: #1a1a1a; background: white; }
.page { width: 190mm; min-height: 277mm; padding: 5mm; padding-bottom: 30mm; margin: 0 auto; position: relative; }
.header { display: flex; align-items: center; justify-content: space-between; padding: 0 2mm 3mm 2mm; border-bottom: 2px solid #FFC300; margin-bottom: 4mm; }
.header-left { width: 60px; flex-shrink: 0; }
.header-center { flex: 1; text-align: center; }
.header-right { width: 60px; text-align: right; font-size: 8pt; color: #666; }
.header h1 { font-size: 14pt; color: #1a1a1a; margin: 0; font-weight: bold; }
.header p { font-size: 8pt; color: #666; margin: 2px 0 0 0; }
.group-title { font-size: 11pt; font-weight: bold; color: #1a1a1a; background: #FFC300; padding: 8px 10px; margin-bottom: 0; }
.section-title { font-size: 9pt; font-weight: bold; color: #333; background: #f5f5f5; padding: 6px 10px; border-bottom: 1px solid #ddd; margin-top: 10px; }
.summary-table { width: 100%; border-collapse: collapse; border: 1px solid #ddd; }
.summary-table td { padding: 8px 10px; border: 1px solid #ddd; font-size: 9pt; text-align: left; vertical-align: top; }
.summary-table .label { width: 25%; font-weight: 600; color: #555; background: #fafafa; }
.summary-table .value { width: 25%; color: #1a1a1a; }
.ewes-table { width: 100%; border-collapse: collapse; border: 1px solid #ddd; margin-top: 0; }
.ewes-table th { background: #FFC300; color: #1a1a1a; font-weight: bold; padding: 8px 10px; text-align: left; font-size: 9pt; border: 1px solid #ddd; }
.ewes-table td { padding: 8px 10px; border: 1px solid #ddd; font-size: 9pt; text-align: left; vertical-align: middle; }
.ewes-table tr:nth-child(even) { background: #fafafa; }
.ewes-table tr:nth-child(odd) { background: #fff; }
.status-active { color: #16a34a; font-weight: 600; }
.highlight { color: #b8860b; font-weight: bold; }
.no-data { color: #999; font-style: italic; text-align: center; padding: 15px; }
.footer { position: absolute; bottom: 0; left: 0; right: 0; background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%); color: white; padding: 8px 15px; }
.footer-content { display: flex; justify-content: space-between; align-items: center; }
.footer-brand { font-size: 10pt; font-weight: bold; color: #FFC300; letter-spacing: 1px; }
.footer-tagline { font-size: 8pt; color: #999; }
@media print { body { padding: 0; } .page { margin: 0; } }
</style>
</head>
<body>
<div class="page">
<div class="header">
<div class="header-left">
${farmSettings?.logoUrl ? `<img src="${farmSettings.logoUrl}" style="width: 50px; height: 50px; object-fit: contain;" alt="Logo" />` : ''}
</div>
<div class="header-center">
<h1>${displayName || "BreedLog"}</h1>
<p>${g.name} - Mating Group Report</p>
</div>
<div class="header-right">
<div>${format(new Date(), "dd MMM yyyy")}</div>
</div>
</div>

<div class="group-title">${g.name}</div>

${g.ramPhoto ? `
<div style="text-align: center; margin: 15px 0;">
  <img src="${g.ramPhoto}" style="max-width: 150px; max-height: 120px; object-fit: contain; border: 2px solid #FFC300; border-radius: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);" alt="${g.ramTagId}" />
  <p style="font-size: 10pt; font-weight: bold; color: #1a1a1a; margin-top: 8px;">Ram: ${g.ramTagId}${g.ramName ? ` (${g.ramName})` : ''}</p>
</div>
` : ''}

<div class="section-title">MATING GROUP SUMMARY</div>
<table class="summary-table">
<tr>
<td class="label">Ram ID</td>
<td class="value">${g.ramTagId}</td>
<td class="label">Date In</td>
<td class="value">${g.dateIn}</td>
</tr>
<tr>
<td class="label">Ram Name</td>
<td class="value">${g.ramName || "N/A"}</td>
<td class="label">Date Out</td>
<td class="value">${g.dateOut}</td>
</tr>
<tr>
<td class="label">Breed</td>
<td class="value">${g.ramBreed}</td>
<td class="label">Mating Period</td>
<td class="value">${g.matingPeriodDays} days</td>
</tr>
<tr>
<td class="label">Status</td>
<td class="value ${g.status === 'active' ? 'status-active' : ''}">${(g.status || "active").toUpperCase()}</td>
<td class="label">Expected Lambing</td>
<td class="value highlight">${g.expectedLambing}</td>
</tr>
<tr>
<td class="label">Season Code</td>
<td class="value">${g.lambingSeason || "N/A"}</td>
<td class="label">Ewes in Group</td>
<td class="value">${g.eweCount}</td>
</tr>
</table>

<div class="section-title">EWES IN THIS GROUP (${g.eweCount})</div>
<table class="ewes-table">
<thead>
<tr>
<th style="width: 5%;">#</th>
<th style="width: 18%;">Ewe ID</th>
<th style="width: 18%;">Name</th>
<th style="width: 20%;">Electronic ID</th>
<th style="width: 15%;">Breed</th>
<th style="width: 12%;">Weight</th>
<th style="width: 12%;">Status</th>
</tr>
</thead>
<tbody>
${g.ewes.length > 0 ? g.ewes.map((ewe: any, i: number) => `
<tr>
<td>${i + 1}</td>
<td>${ewe.tagId}</td>
<td>${ewe.name || "—"}</td>
<td>${ewe.electronicId || "—"}</td>
<td>${ewe.breed}</td>
<td>${ewe.currentWeight ? ewe.currentWeight + " kg" : "—"}</td>
<td class="status-active">Active</td>
</tr>
`).join("") : `
<tr>
<td colspan="7" class="no-data">No ewes recorded in this mating group</td>
</tr>
`}
</tbody>
</table>
${g.notes ? `<p style="margin-top: 12px; font-size: 9pt; color: #555; padding: 0 10px;"><strong>Group Notes:</strong> ${g.notes}</p>` : ""}

<div class="footer">
<div class="footer-content">
<div class="footer-brand">BREEDLOG</div>
<div class="footer-tagline">Professional Livestock Management</div>
</div>
</div>
</div>
</body>
</html>`;
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(content);
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 250);
    }
    createExportedDoc.mutate({
      name: getDocumentFileName("MatingGroup"),
      documentType: "breeding",
      subfolder: "breeding"
    });
  };
  
  return (
    <Layout>
      <div className="space-y-4 md:space-y-6 animate-in fade-in duration-500">
        <div className="flex flex-col gap-3">
          <Button 
            variant="ghost" 
            onClick={() => navigate("/breeding")} 
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
                {ewesInGroup.map((ewe) => ewe && (
                  <Link 
                    key={ewe.id}
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

            <div className="grid grid-cols-2 gap-4">
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
              className="w-full rugged-btn bg-primary text-black"
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
