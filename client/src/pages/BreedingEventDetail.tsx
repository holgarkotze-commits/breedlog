import { Layout } from "@/components/Layout";
import { useBreedingEvents, useDeleteBreedingEvent } from "@/hooks/use-breeding";
import { useAnimals } from "@/hooks/use-animals";
import { useFarmSettings } from "@/hooks/use-farm-settings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ArrowLeft, Calendar, Shield, Heart, Download, Trash2, Baby } from "lucide-react";
import { format, addDays } from "date-fns";
import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useRoute } from "wouter";

export default function BreedingEventDetail() {
  const [, params] = useRoute("/breeding/events/:id");
  const eventId = params?.id ? parseInt(params.id) : null;
  const [, navigate] = useLocation();
  
  const { data: events, isLoading } = useBreedingEvents();
  const { data: animals } = useAnimals({});
  const { data: farmSettings } = useFarmSettings();
  
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  const displayName = farmSettings?.studName || farmSettings?.farmName;
  const event = events?.find(e => e.id === eventId);
  
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
  
  if (!event) {
    return (
      <Layout>
        <div className="space-y-4">
          <Button variant="ghost" onClick={() => navigate("/breeding")} data-testid="button-back">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Breeding
          </Button>
          <div className="text-center py-12">
            <Heart className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h2 className="text-xl font-bold mb-2">Breeding Event Not Found</h2>
            <p className="text-muted-foreground">This breeding event may have been deleted or does not exist.</p>
          </div>
        </div>
      </Layout>
    );
  }
  
  const ewe = getAnimalById(event.eweId);
  const ram = getAnimalById(event.ramId);
  const matingDate = new Date(event.matingDate);
  const expectedDueDate = addDays(matingDate, 150);
  const hasLambed = event.lambingDate && event.lambCount;
  
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
    const content = JSON.stringify({
      exportDate: new Date().toISOString(),
      farm: displayName || "BreedLog Export",
      breedingEvent: {
        id: event.id,
        matingDate: format(matingDate, "yyyy-MM-dd"),
        matingType: event.matingType,
        expectedDueDate: format(expectedDueDate, "yyyy-MM-dd"),
        lambingDate: event.lambingDate || null,
        lambCount: event.lambCount || null,
        ewe: ewe ? {
          id: ewe.id,
          tagId: ewe.tagId,
          name: ewe.name,
          breed: ewe.breed,
        } : { id: event.eweId },
        ram: ram ? {
          id: ram.id,
          tagId: ram.tagId,
          name: ram.name,
          breed: ram.breed,
        } : { id: event.ramId },
        notes: event.notes || null,
      }
    }, null, 2);
    downloadFile(content, `breeding-event-${event.id}-${format(new Date(), "yyyy-MM-dd")}.json`, "application/json");
  };
  
  const exportPDF = () => {
    const content = `
<!DOCTYPE html>
<html>
<head>
<title>Breeding Event Report</title>
<style>
@page { size: A4 portrait; margin: 15mm; }
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 10pt; color: #1a1a1a; background: white; }
.page { max-width: 180mm; margin: 0 auto; padding: 10mm; }
.header { text-align: center; border-bottom: 2px solid #FFC300; padding-bottom: 10px; margin-bottom: 20px; }
.header h1 { font-size: 16pt; margin-bottom: 5px; }
.header p { font-size: 9pt; color: #666; }
.section { margin-bottom: 20px; }
.section-title { font-size: 11pt; font-weight: bold; background: #FFC300; padding: 8px 12px; margin-bottom: 0; }
.info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0; border: 1px solid #ddd; }
.info-item { padding: 10px 12px; border-bottom: 1px solid #ddd; }
.info-item:nth-child(odd) { border-right: 1px solid #ddd; }
.info-item .label { font-size: 8pt; color: #666; text-transform: uppercase; margin-bottom: 3px; }
.info-item .value { font-size: 10pt; font-weight: 500; }
.highlight { color: #b8860b; font-weight: bold; }
.animal-card { display: flex; gap: 15px; padding: 15px; background: #f9f9f9; border: 1px solid #ddd; margin-top: -1px; }
.animal-info h3 { font-size: 12pt; margin-bottom: 5px; }
.animal-info p { font-size: 9pt; color: #555; margin: 2px 0; }
.footer { text-align: center; margin-top: 30px; padding-top: 15px; border-top: 1px solid #ddd; font-size: 8pt; color: #999; }
@media print { body { padding: 0; } }
</style>
</head>
<body>
<div class="page">
<div class="header">
<h1>${displayName || "BreedLog"}</h1>
<p>Breeding Event Report - ${format(new Date(), "dd MMMM yyyy")}</p>
</div>

<div class="section">
<div class="section-title">MATING DETAILS</div>
<div class="info-grid">
<div class="info-item">
<div class="label">Mating Date</div>
<div class="value">${format(matingDate, "dd MMMM yyyy")}</div>
</div>
<div class="info-item">
<div class="label">Mating Type</div>
<div class="value">${event.matingType === 'AI' ? 'Artificial Insemination' : 'Natural'}</div>
</div>
<div class="info-item">
<div class="label">Expected Due Date</div>
<div class="value highlight">${format(expectedDueDate, "dd MMMM yyyy")}</div>
</div>
<div class="info-item">
<div class="label">Status</div>
<div class="value">${hasLambed ? 'Lambed' : 'Pending'}</div>
</div>
</div>
</div>

<div class="section">
<div class="section-title">EWE</div>
<div class="animal-card">
<div class="animal-info">
<h3>${ewe?.tagId || `Ewe #${event.eweId}`}</h3>
${ewe?.name ? `<p><strong>Name:</strong> ${ewe.name}</p>` : ''}
${ewe?.breed ? `<p><strong>Breed:</strong> ${ewe.breed}</p>` : ''}
${ewe?.electronicId ? `<p><strong>Electronic ID:</strong> ${ewe.electronicId}</p>` : ''}
</div>
</div>
</div>

<div class="section">
<div class="section-title">RAM</div>
<div class="animal-card">
<div class="animal-info">
<h3>${ram?.tagId || `Ram #${event.ramId}`}</h3>
${ram?.name ? `<p><strong>Name:</strong> ${ram.name}</p>` : ''}
${ram?.breed ? `<p><strong>Breed:</strong> ${ram.breed}</p>` : ''}
${ram?.electronicId ? `<p><strong>Electronic ID:</strong> ${ram.electronicId}</p>` : ''}
</div>
</div>
</div>

${event.notes ? `
<div class="section">
<div class="section-title">NOTES</div>
<div style="padding: 12px; border: 1px solid #ddd; margin-top: -1px;">
${event.notes}
</div>
</div>
` : ''}

<div class="footer">
Generated by BreedLog - Professional Livestock Management
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
              <h1 className="text-xl md:text-3xl font-bold uppercase tracking-tight" data-testid="event-title">
                Breeding Event
              </h1>
              <p className="text-sm text-muted-foreground">
                {displayName && `${displayName} • `}{format(matingDate, "dd MMMM yyyy")}
              </p>
            </div>
            
            <div className="flex flex-wrap gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" data-testid="button-export-event">
                    <Download className="w-4 h-4 mr-1" /> Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={exportPDF} data-testid="menu-export-pdf">
                    Export as PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportJSON} data-testid="menu-export-json">
                    Export as JSON
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowDeleteConfirm(true)}
                className="bg-white text-red-600 border-red-200 hover:bg-red-50"
                data-testid="button-delete-event"
              >
                <Trash2 className="w-4 h-4 mr-1" /> Delete
              </Button>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="rugged-card">
            <CardHeader className="p-3 md:p-6 pb-2">
              <CardTitle className="uppercase text-sm md:text-lg flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                Mating Details
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 md:p-6 pt-0 space-y-3">
              <div className="p-3 bg-secondary rounded-md">
                <p className="text-xs text-muted-foreground">Mating Date</p>
                <p className="font-bold">{format(matingDate, "dd MMMM yyyy")}</p>
              </div>
              <div className="p-3 bg-secondary rounded-md">
                <p className="text-xs text-muted-foreground">Mating Type</p>
                <Badge variant="outline" className="mt-1">
                  {event.matingType === 'AI' ? 'Artificial Insemination' : 'Natural'}
                </Badge>
              </div>
              <div className="p-3 bg-primary/10 rounded-md border border-primary/30">
                <p className="text-xs text-muted-foreground">Expected Due Date</p>
                <p className="font-bold text-primary">{format(expectedDueDate, "dd MMMM yyyy")}</p>
                <p className="text-xs text-muted-foreground mt-1">(~150 days from mating)</p>
              </div>
              {event.lambingDate && (
                <div className="p-3 bg-green-900/20 rounded-md border border-green-700/30">
                  <p className="text-xs text-muted-foreground">Lambing Date</p>
                  <p className="font-bold text-green-400">{format(new Date(event.lambingDate), "dd MMMM yyyy")}</p>
                </div>
              )}
              {event.lambCount && event.lambCount > 0 && (
                <div className="p-3 bg-secondary rounded-md flex items-center gap-3">
                  <Baby className="w-5 h-5 text-pink-400" />
                  <div>
                    <p className="text-xs text-muted-foreground">Lambs Born</p>
                    <p className="font-bold">{event.lambCount} lamb{event.lambCount > 1 ? 's' : ''}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          
          <Card className="rugged-card">
            <CardHeader className="p-3 md:p-6 pb-2">
              <CardTitle className="uppercase text-sm md:text-lg flex items-center gap-2">
                <Heart className="w-5 h-5 text-pink-400" />
                Ewe
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 md:p-6 pt-0">
              {ewe ? (
                <Link 
                  href={`/animals/${ewe.id}`}
                  className="block p-4 bg-secondary rounded-md hover:bg-secondary/80 transition-colors"
                  data-testid="link-ewe-profile"
                >
                  <div className="flex items-center gap-4">
                    {ewe.photo ? (
                      <img 
                        src={ewe.photo} 
                        alt={ewe.tagId} 
                        className="w-16 h-16 rounded-full object-cover border-2 border-pink-500/50"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-pink-900/30 border-2 border-pink-500/50 flex items-center justify-center">
                        <Heart className="w-6 h-6 text-pink-400" />
                      </div>
                    )}
                    <div>
                      <p className="font-bold text-lg">{ewe.tagId}</p>
                      {ewe.name && <p className="text-muted-foreground">{ewe.name}</p>}
                      <p className="text-xs text-muted-foreground">{ewe.breed || "Meatmaster"}</p>
                    </div>
                  </div>
                </Link>
              ) : (
                <div className="p-4 bg-secondary rounded-md text-center text-muted-foreground">
                  Ewe not found (ID: {event.eweId})
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
                  className="block p-4 bg-secondary rounded-md hover:bg-secondary/80 transition-colors"
                  data-testid="link-ram-profile"
                >
                  <div className="flex items-center gap-4">
                    {ram.photo ? (
                      <img 
                        src={ram.photo} 
                        alt={ram.tagId} 
                        className="w-16 h-16 rounded-full object-cover border-2 border-blue-500/50"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-blue-900/30 border-2 border-blue-500/50 flex items-center justify-center">
                        <Shield className="w-6 h-6 text-blue-400" />
                      </div>
                    )}
                    <div>
                      <p className="font-bold text-lg">{ram.tagId}</p>
                      {ram.name && <p className="text-muted-foreground">{ram.name}</p>}
                      <p className="text-xs text-muted-foreground">{ram.breed || "Meatmaster"}</p>
                    </div>
                  </div>
                </Link>
              ) : (
                <div className="p-4 bg-secondary rounded-md text-center text-muted-foreground">
                  Ram not found (ID: {event.ramId})
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        
        {event.notes && (
          <Card className="rugged-card">
            <CardHeader className="p-3 md:p-6 pb-2">
              <CardTitle className="uppercase text-sm md:text-lg">Notes</CardTitle>
            </CardHeader>
            <CardContent className="p-3 md:p-6 pt-0">
              <p className="text-sm whitespace-pre-wrap">{event.notes}</p>
            </CardContent>
          </Card>
        )}
      </div>
      
      <DeleteEventConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        eventId={event.id}
        onDeleted={() => navigate("/breeding")}
      />
    </Layout>
  );
}

function DeleteEventConfirmDialog({ 
  open, 
  onOpenChange, 
  eventId,
  onDeleted 
}: { 
  open: boolean, 
  onOpenChange: (open: boolean) => void, 
  eventId: number,
  onDeleted: () => void 
}) {
  const { mutate: deleteEvent, isPending } = useDeleteBreedingEvent();
  
  const handleDelete = () => {
    deleteEvent(eventId, {
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
          <AlertDialogTitle>Delete Breeding Event?</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete this breeding event? This action cannot be undone.
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
