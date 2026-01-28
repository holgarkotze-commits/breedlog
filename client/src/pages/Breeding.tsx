import { Layout } from "@/components/Layout";
import { useBreedingEvents, useCreateBreedingEvent } from "@/hooks/use-breeding";
import { useMatingGroups, useCreateMatingGroup, useUpdateMatingGroup, useDeleteMatingGroup } from "@/hooks/use-mating-groups";
import { useAnimals } from "@/hooks/use-animals";
import { useFarmSettings } from "@/hooks/use-farm-settings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertBreedingEventSchema, insertMatingGroupSchema, type MatingGroup } from "@shared/schema";
import { Plus, Calendar, Shield, Heart, Users, Download, Pencil, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { format, addDays, addMonths } from "date-fns";
import { useState } from "react";
import { z } from "zod";

export default function Breeding() {
  const { data: events, isLoading } = useBreedingEvents();
  const { data: matingGroupsList, isLoading: loadingGroups } = useMatingGroups();
  const { data: animals } = useAnimals({});
  const { data: farmSettings } = useFarmSettings();
  const displayName = farmSettings?.studName || farmSettings?.farmName;
  const [openRecord, setOpenRecord] = useState(false);
  const [openMatingGroup, setOpenMatingGroup] = useState(false);
  const [editingGroup, setEditingGroup] = useState<MatingGroup | null>(null);

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

  const exportJSON = () => {
    const exportData = getExportData();
    if (exportData.length === 0) return;
    
    const content = JSON.stringify({
      exportDate: new Date().toISOString(),
      farm: displayName || "BreedLog Export",
      farmBranding: farmSettings ? {
        studName: farmSettings.studName || null,
        farmName: farmSettings.farmName || null,
        ownerName: farmSettings.ownerName || null,
        ownerEmail: farmSettings.ownerEmail || null,
        ownerPhone: farmSettings.ownerPhone || null,
        farmLocation: farmSettings.farmLocation || null,
        farmAddress: farmSettings.farmAddress || null,
        membershipNumber: farmSettings.membershipNumber || null,
        registrationNumber: farmSettings.registrationNumber || null,
        logoUrl: farmSettings.logoUrl || null,
        logoSize: farmSettings.logoSize || "medium",
      } : null,
      matingGroups: exportData,
    }, null, 2);
    downloadFile(content, `mating-groups-${format(new Date(), "yyyy-MM-dd")}.json`, "application/json");
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

  const exportWord = () => {
    const exportData = getExportData();
    if (exportData.length === 0) return;
    
    let content = `
MATING GROUPS REPORT
Generated by BreedLog
Export Date: ${format(new Date(), "dd/MM/yyyy")}

═══════════════════════════════════════════
FARM INFORMATION
═══════════════════════════════════════════
Farm/Stud: ${displayName || "Not specified"}

═══════════════════════════════════════════
MATING GROUPS (${exportData.length} total)
═══════════════════════════════════════════

`;
    exportData.forEach((g, i) => {
      content += `
GROUP ${i + 1}: ${g.name}
───────────────────────────────────────────

RAM IDENTIFICATION
  Tag ID: ${g.ramTagId}
  Name: ${g.ramName || "N/A"}
  Electronic ID: ${g.ramElectronicId || "N/A"}
  Tattoo ID: ${g.ramTattooId || "N/A"}
  Breed: ${g.ramBreed}
  Photo: ${g.ramPhoto || "No photo available"}

EWES IN GROUP (${g.eweCount} total)
${g.ewes.length > 0 ? g.ewes.map((ewe: any, j: number) => `
  Ewe ${j + 1}:
    Tag ID: ${ewe.tagId}
    Name: ${ewe.name || "N/A"}
    Electronic ID: ${ewe.electronicId || "N/A"}
    Tattoo ID: ${ewe.tattooId || "N/A"}
    Breed: ${ewe.breed}
    Photo: ${ewe.photo || "No photo available"}
`).join("") : "  No ewes recorded in this group\n"}

MATING DETAILS
  Date In: ${g.dateIn}
  Date Out: ${g.dateOut}
  Mating Period: ${g.matingPeriodDays} days
  Expected Lambing: ${g.expectedLambing}
  Season: ${g.lambingSeason || "N/A"}
  Status: ${(g.status || "active").toUpperCase()}
${g.notes ? `  Notes: ${g.notes}` : ""}
`;
    });
    
    if (farmSettings?.farmName || farmSettings?.studName) {
      content += `
═══════════════════════════════════════════
FARM/STUD BRANDING
═══════════════════════════════════════════
${farmSettings?.studName ? `Stud Name: ${farmSettings.studName}` : ''}
${farmSettings?.farmName && farmSettings.farmName !== farmSettings?.studName ? `Farm Name: ${farmSettings.farmName}` : ''}
${farmSettings?.ownerName ? `Owner: ${farmSettings.ownerName}` : ''}
${farmSettings?.ownerPhone ? `Phone: ${farmSettings.ownerPhone}` : ''}
${farmSettings?.ownerEmail ? `Email: ${farmSettings.ownerEmail}` : ''}
${farmSettings?.farmLocation ? `Location: ${farmSettings.farmLocation}` : ''}
${farmSettings?.farmAddress ? `Address: ${farmSettings.farmAddress}` : ''}
${farmSettings?.membershipNumber ? `Membership No: ${farmSettings.membershipNumber}` : ''}
${farmSettings?.registrationNumber ? `Registration No: ${farmSettings.registrationNumber}` : ''}
${farmSettings?.logoUrl ? `Logo: [Embedded in document]` : ''}
`;
    }
    
    content += `
═══════════════════════════════════════════
Generated by BreedLog - Breed Smart. Farm Better.
═══════════════════════════════════════════
`;
    downloadFile(content, `mating-groups-${format(new Date(), "yyyy-MM-dd")}.doc`, "application/msword");
  };

  const exportPDF = () => {
    const exportData = getExportData();
    if (exportData.length === 0) return;
    
    const content = `
<!DOCTYPE html>
<html>
<head>
<title>Mating Groups Report</title>
<style>
@page { size: A4 portrait; margin: 10mm; }
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 10pt; color: #333; max-width: 190mm; margin: 0 auto; padding: 5mm; }
h1 { color: #FFC300; font-size: 18pt; }
h2 { color: #333; margin-top: 20px; font-size: 12pt; font-weight: 700; border-bottom: 2px solid #FFC300; padding-bottom: 6px; text-align: left; }
.header { text-align: center; margin-bottom: 20px; padding: 12px 15px; background: linear-gradient(135deg, #1a1a1a 0%, #333 100%); color: white; border-radius: 6px; }
.header h1 { color: #FFC300; border: none; margin: 0; }
.header p { color: #ccc; margin: 6px 0 0 0; font-size: 9pt; }
.group { background: #fafafa; border-radius: 6px; padding: 12px 15px; margin-bottom: 15px; border-left: 4px solid #FFC300; }
.group-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; gap: 10px; }
.group-left { display: flex; align-items: center; gap: 10px; }
.animal-photo { width: 40px; height: 40px; border-radius: 6px; object-fit: cover; border: 2px solid #FFC300; flex-shrink: 0; }
.animal-photo-sm { width: 32px; height: 32px; border-radius: 4px; object-fit: cover; border: 1px solid #ec4899; flex-shrink: 0; }
.photo-placeholder { width: 40px; height: 40px; border-radius: 6px; background: #ddd; display: flex; align-items: center; justify-content: center; color: #999; font-size: 8px; flex-shrink: 0; border: 1px solid #ccc; }
.photo-placeholder-sm { width: 32px; height: 32px; border-radius: 4px; background: #eee; display: flex; align-items: center; justify-content: center; color: #999; font-size: 7px; flex-shrink: 0; border: 1px solid #ddd; }
.group-info { text-align: left; }
.group-name { font-size: 12pt; font-weight: bold; color: #222; }
.ram-tag { font-size: 9pt; color: #666; margin-top: 2px; }
.status { padding: 3px 8px; border-radius: 12px; font-size: 8pt; font-weight: bold; }
.status-active { background: #22c55e20; color: #16a34a; }
.status-closed { background: #64748b20; color: #475569; }
.data-table { width: 100%; border-collapse: collapse; margin: 8px 0; }
.data-table td { padding: 6px 8px; border-bottom: 1px solid #e0e0e0; font-size: 9pt; text-align: left; vertical-align: middle; }
.data-table tr:nth-child(even) { background: #fff; }
.data-table .label { width: 140px; font-weight: 600; color: #555; }
.data-table .value { color: #222; }
.highlight { color: #FFC300; font-weight: bold; }
.section-title { font-size: 10pt; font-weight: bold; color: #333; margin: 12px 0 8px 0; padding-bottom: 4px; border-bottom: 2px solid #ec4899; text-align: left; }
.ram-section { background: #fff8e1; border-radius: 4px; padding: 8px 10px; margin-bottom: 10px; }
.ewes-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 8px; }
.ewe-card { background: white; border: 1px solid #f0e0f0; border-radius: 6px; padding: 8px; display: flex; align-items: flex-start; gap: 8px; }
.ewe-info { flex: 1; text-align: left; }
.ewe-tag { font-weight: bold; font-size: 10pt; color: #222; }
.ewe-detail { font-size: 8pt; color: #666; margin-top: 2px; text-align: left; }
.footer { margin-top: 30px; text-align: center; font-size: 9pt; color: #999; border-top: 2px solid #FFC300; padding-top: 12px; }
@media print { body { padding: 5mm; } .group { break-inside: avoid; } }
</style>
</head>
<body>
<div class="header">
<h1>${displayName || "BreedLog"}</h1>
<p>Mating Groups Report - Generated ${format(new Date(), "dd/MM/yyyy")}</p>
</div>

<p style="text-align: center; color: #666;">Total Mating Groups: <strong>${exportData.length}</strong></p>

${exportData.map((g, i) => `
<div class="group">
<div class="group-header">
<div class="group-left">
${g.ramPhoto ? `<img src="${g.ramPhoto}" class="animal-photo" alt="Ram ${g.ramTagId}" />` : `<div class="photo-placeholder">No Photo</div>`}
<div class="group-info">
<div class="group-name">${g.name}</div>
<div class="ram-tag">Ram: ${g.ramTagId}${g.ramName ? ` (${g.ramName})` : ""}</div>
</div>
</div>
<span class="status ${g.status === 'active' ? 'status-active' : 'status-closed'}">${(g.status || "active").toUpperCase()}</span>
</div>

<div class="ram-section">
<div style="font-weight: bold; font-size: 9pt; color: #b8860b; margin-bottom: 6px; text-align: left;">RAM IDENTIFICATION</div>
<table class="data-table">
<tr><td class="label">Tag ID</td><td class="value">${g.ramTagId}</td></tr>
<tr><td class="label">Name</td><td class="value">${g.ramName || "N/A"}</td></tr>
<tr><td class="label">Electronic ID</td><td class="value">${g.ramElectronicId || "N/A"}</td></tr>
<tr><td class="label">Tattoo ID</td><td class="value">${g.ramTattooId || "N/A"}</td></tr>
<tr><td class="label">Breed</td><td class="value">${g.ramBreed}</td></tr>
</table>
</div>

<div class="section-title">EWES IN GROUP (${g.eweCount})</div>
${g.ewes.length > 0 ? `
<div class="ewes-grid">
${g.ewes.map((ewe: any) => `
<div class="ewe-card">
${ewe.photo ? `<img src="${ewe.photo}" class="animal-photo-sm" alt="${ewe.tagId}" />` : `<div class="photo-placeholder-sm">No Photo</div>`}
<div class="ewe-info">
<div class="ewe-tag">${ewe.tagId}${ewe.name ? ` (${ewe.name})` : ""}</div>
<div class="ewe-detail">EID: ${ewe.electronicId || "N/A"}</div>
<div class="ewe-detail">Tattoo: ${ewe.tattooId || "N/A"}</div>
<div class="ewe-detail">Breed: ${ewe.breed}</div>
</div>
</div>
`).join("")}
</div>
` : `<p style="color: #999; font-size: 13px; font-style: italic;">No ewes recorded in this group</p>`}

<table class="data-table" style="margin-top: 10px;">
<tr><td class="label">Date In</td><td class="value">${g.dateIn}</td><td class="label">Date Out</td><td class="value">${g.dateOut}</td></tr>
<tr><td class="label">Mating Period</td><td class="value">${g.matingPeriodDays} days</td><td class="label">Expected Lambing</td><td class="value highlight">${g.expectedLambing}</td></tr>
<tr><td class="label">Season</td><td class="value">${g.lambingSeason || "N/A"}</td><td></td><td></td></tr>
</table>
${g.notes ? `<p style="margin-top: 12px; font-size: 13px; color: #555;"><strong>Notes:</strong> ${g.notes}</p>` : ""}
</div>
`).join("")}

${farmSettings?.logoUrl || farmSettings?.farmName ? `
<div class="farm-branding" style="margin-top: 60px; padding: 30px; background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%); border-radius: 12px; color: white;">
<div style="display: flex; align-items: center; gap: 25px; justify-content: center; flex-wrap: wrap;">
${farmSettings?.logoUrl ? `<img src="${farmSettings.logoUrl}" style="width: ${farmSettings?.logoSize === 'small' ? '80' : farmSettings?.logoSize === 'large' ? '180' : farmSettings?.logoWidth || '120'}px; height: ${farmSettings?.logoSize === 'small' ? '80' : farmSettings?.logoSize === 'large' ? '180' : farmSettings?.logoHeight || '120'}px; object-fit: contain; border-radius: 8px;" alt="Farm Logo" />` : ''}
<div style="text-align: ${farmSettings?.logoUrl ? 'left' : 'center'};">
${farmSettings?.studName ? `<div style="font-size: 22px; font-weight: bold; color: #FFC300; margin-bottom: 4px;">${farmSettings.studName}</div>` : ''}
${farmSettings?.farmName && farmSettings?.farmName !== farmSettings?.studName ? `<div style="font-size: 16px; color: #ccc;">${farmSettings.farmName}</div>` : ''}
${farmSettings?.ownerName ? `<div style="font-size: 14px; color: #aaa; margin-top: 8px;">${farmSettings.ownerName}</div>` : ''}
<div style="font-size: 12px; color: #888; margin-top: 6px;">
${farmSettings?.ownerPhone ? `<span>Tel: ${farmSettings.ownerPhone}</span>` : ''}
${farmSettings?.ownerPhone && farmSettings?.ownerEmail ? ` | ` : ''}
${farmSettings?.ownerEmail ? `<span>${farmSettings.ownerEmail}</span>` : ''}
</div>
${farmSettings?.farmLocation ? `<div style="font-size: 12px; color: #888; margin-top: 4px;">${farmSettings.farmLocation}</div>` : ''}
${farmSettings?.membershipNumber ? `<div style="font-size: 11px; color: #666; margin-top: 8px;">Membership: ${farmSettings.membershipNumber}</div>` : ''}
</div>
</div>
</div>
` : ''}

<div class="footer">
<strong>Generated by BreedLog</strong><br>
Breed Smart. Farm Better.
</div>
</body>
</html>`;
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(content);
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 250);
    }
  };

  return (
    <Layout>
      <div className="space-y-4 md:space-y-8 animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
          <h1 className="text-lg md:text-3xl font-bold uppercase tracking-tight" data-testid="page-title">
            {displayName ? `${displayName} - Breeding` : "Breeding Program"}
          </h1>
          <div className="flex gap-2">
            <RecordBreedingDialog open={openRecord} onOpenChange={setOpenRecord} />
          </div>
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
                        <DropdownMenuItem onClick={exportWord} data-testid="menu-export-word">
                          Export as Word
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={exportCSV} data-testid="menu-export-csv">
                          Export as CSV
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={exportJSON} data-testid="menu-export-json">
                          Export as JSON
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
                      <div key={group.id} className="p-3 bg-secondary rounded border border-border">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="font-bold text-sm md:text-base">{group.name}</p>
                            <p className="text-xs text-muted-foreground">
                              Ram: {ram?.tagId || group.ramId} {ram?.name && `(${ram.name})`}
                            </p>
                            {group.eweIds && group.eweIds.length > 0 && (
                              <p className="text-xs text-muted-foreground">{group.eweIds.length} ewes in group</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              onClick={() => setEditingGroup(group)}
                              data-testid={`button-edit-group-${group.id}`}
                              className="h-7 w-7"
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Badge variant="outline" className="bg-green-900/30 text-green-400 border-green-700">
                              Active
                            </Badge>
                          </div>
                        </div>
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
                      <div key={group.id} className="p-2 bg-secondary/50 rounded text-xs flex justify-between">
                        <span>{group.name}</span>
                        <span className="text-muted-foreground">{format(new Date(group.dateIn), "MMM yyyy")}</span>
                      </div>
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
              {isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> : events?.slice(0, 5).map((evt, i) => (
                <div key={i} className="flex justify-between items-center p-3 bg-secondary rounded border border-border">
                  <div>
                    <p className="font-bold text-sm">Ewe {evt.eweId} x Ram {evt.ramId}</p>
                    <p className="text-xs text-muted-foreground">{format(new Date(evt.matingDate), "dd MMM yyyy")} • {evt.matingType}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs uppercase font-bold text-primary">Recorded</span>
                  </div>
                </div>
              ))}
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
        <Button size="sm" data-testid="button-new-mating-group" className="rugged-btn bg-primary text-black">
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
              {isPending ? "Creating..." : "Create Mating Group"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function RecordBreedingDialog({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
  const { mutate, isPending } = useCreateBreedingEvent();
  const { data: animals } = useAnimals({});
  
  const rams = animals?.filter(a => a.sex === 'ram' && a.status === 'active') || [];
  const ewes = animals?.filter(a => a.sex === 'ewe' && a.status === 'active') || [];
  
  const form = useForm({
    resolver: zodResolver(insertBreedingEventSchema),
    defaultValues: {
      eweId: 0,
      ramId: 0,
      matingDate: new Date().toISOString().split('T')[0],
      matingType: "natural",
    }
  });

  const onSubmit = (data: any) => {
    mutate({
      ...data,
      eweId: Number(data.eweId),
      ramId: Number(data.ramId),
    }, { onSuccess: () => onOpenChange(false) });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button data-testid="button-record-event" className="rugged-btn bg-primary text-black">
          <Plus className="w-4 h-4 mr-2" /> Record Event
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle className="uppercase font-bold">Record Mating Event</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField name="eweId" control={form.control} render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1">
                    <Heart className="w-3 h-3 text-pink-400" /> Ewe
                  </FormLabel>
                  <Select onValueChange={(v) => field.onChange(Number(v))} value={String(field.value || "")}>
                    <FormControl>
                      <SelectTrigger className="rugged-input">
                        <SelectValue placeholder="Select ewe..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {ewes.map(ewe => (
                        <SelectItem key={ewe.id} value={String(ewe.id)}>
                          {ewe.tagId} {ewe.name ? `(${ewe.name})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage/>
                </FormItem>
              )}/>
              <FormField name="ramId" control={form.control} render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1">
                    <Shield className="w-3 h-3 text-blue-400" /> Ram
                  </FormLabel>
                  <Select onValueChange={(v) => field.onChange(Number(v))} value={String(field.value || "")}>
                    <FormControl>
                      <SelectTrigger className="rugged-input">
                        <SelectValue placeholder="Select ram..." />
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
            </div>
            <FormField name="matingDate" control={form.control} render={({ field }) => (
              <FormItem>
                <FormLabel>Date</FormLabel>
                <FormControl>
                  <Input type="date" className="rugged-input" {...field} value={String(field.value)} />
                </FormControl>
                <FormMessage/>
              </FormItem>
            )}/>
            <FormField name="matingType" control={form.control} render={({ field }) => (
              <FormItem>
                <FormLabel>Type</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger className="rugged-input">
                      <SelectValue/>
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="natural">Natural</SelectItem>
                    <SelectItem value="AI">AI (Artificial Insemination)</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )}/>
            <Button 
              type="submit" 
              disabled={isPending} 
              data-testid="button-save-breeding" 
              className="w-full rugged-btn bg-primary text-black"
            >
              {isPending ? "Saving..." : "Save Record"}
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

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this mating group?")) {
      deleteGroup(group.id, {
        onSuccess: () => {
          onOpenChange(false);
        }
      });
    }
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
                onClick={handleDelete}
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
                className="flex-1 rugged-btn bg-primary text-black"
              >
                {isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
