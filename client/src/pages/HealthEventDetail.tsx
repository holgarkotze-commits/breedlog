import { Layout } from "@/components/Layout";
import { useAnimals } from "@/hooks/use-animals";
import { useFarmSettings } from "@/hooks/use-farm-settings";
import { useCreateExportedDocument } from "@/hooks/use-exported-documents";
import { useFlockHealthEvent } from "@/hooks/use-flock-health";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ArrowLeft, Download, FileText, Calendar, Syringe, Users, FileDown, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { useRoute, Link } from "wouter";
import { useToast } from "@/hooks/use-toast";

export default function HealthEventDetail() {
  const [, params] = useRoute("/health/:id");
  const eventId = params?.id ? parseInt(params.id) : 0;
  const { data: event, isLoading } = useFlockHealthEvent(eventId);
  const { data: animals } = useAnimals({});
  const { data: farmSettings } = useFarmSettings();
  const displayName = farmSettings?.studName || farmSettings?.farmName;
  const createExportedDoc = useCreateExportedDocument();
  const { toast } = useToast();

  const getAnimalById = (id: number) => animals?.find(a => a.id === id);

  const treatmentAnimals = event?.treatments?.map(t => getAnimalById(t.animalId)).filter(Boolean) || [];
  const activeAnimals = animals?.filter(a => a.status === 'active') || [];
  const eventAnimals = event?.treatAllAnimals ? activeAnimals : treatmentAnimals;

  const exportPDF = () => {
    if (!event) return;
    
    const content = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
@page { size: A4 portrait; margin: 10mm; }
body { font-family: Arial, sans-serif; font-size: 10pt; color: #333; margin: 0; padding: 0; }
.header { display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 2px solid #FFC300; margin-bottom: 15px; }
.header-left { flex: 1; }
.header-center { flex: 2; text-align: center; }
.header-right { flex: 1; text-align: right; font-size: 9pt; }
h1 { margin: 0; font-size: 16pt; color: #FFC300; }
.summary { background: #f5f5f5; padding: 12px; margin-bottom: 15px; border-radius: 4px; }
.summary p { margin: 4px 0; }
.summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
table { width: 100%; border-collapse: collapse; margin-top: 10px; }
th { background: #FFC300; color: #000; padding: 8px; text-align: left; font-weight: bold; }
td { padding: 8px; border-bottom: 1px solid #ddd; text-align: left; }
tr:nth-child(even) { background: #f9f9f9; }
.notes-section { margin-top: 15px; padding: 10px; background: #fff8e1; border-left: 3px solid #FFC300; }
.footer { position: fixed; bottom: 10mm; left: 10mm; right: 10mm; text-align: center; padding: 8px; background: #1a1a1a; color: #FFC300; }
.footer-brand { font-weight: bold; }
.footer-tagline { font-size: 8pt; color: #aaa; }
</style>
</head>
<body>
<div class="header">
<div class="header-left">
${farmSettings?.logoUrl ? `<img src="${farmSettings.logoUrl}" style="width: 50px; height: 50px; object-fit: contain;" alt="Logo" />` : ''}
</div>
<div class="header-center">
<h1>Health Event Record</h1>
<p>${displayName || "BreedLog"}</p>
</div>
<div class="header-right">
<div>Exported: ${format(new Date(), "dd MMM yyyy")}</div>
</div>
</div>

<div class="summary">
<h2 style="margin: 0 0 10px 0; font-size: 14pt;">${event.eventName || "Health Treatment"}</h2>
<div class="summary-grid">
<p><strong>Event Date:</strong> ${format(new Date(event.eventDate), "dd MMMM yyyy")}</p>
<p><strong>Treatment/Product:</strong> ${event.productName}</p>
<p><strong>Treatment Type:</strong> ${event.route}</p>
<p><strong>Animals Treated:</strong> ${event.treatAllAnimals ? `All Active (${eventAnimals.length})` : `Selected (${eventAnimals.length})`}</p>
</div>
</div>

${event.notes ? `
<div class="notes-section">
<strong>Notes:</strong> ${event.notes}
</div>
` : ''}

<h3 style="margin-top: 20px;">Animals Treated (${eventAnimals.length})</h3>
<table>
<thead>
<tr>
<th>#</th>
<th>Tag ID</th>
<th>Name</th>
<th>Sex</th>
<th>Breed</th>
</tr>
</thead>
<tbody>
${eventAnimals.map((animal, idx) => `<tr>
<td>${idx + 1}</td>
<td>${animal?.tagId || "—"}</td>
<td>${animal?.name || "—"}</td>
<td style="text-transform: capitalize;">${animal?.sex || "—"}</td>
<td>${animal?.breed || "Meatmaster"}</td>
</tr>`).join("")}
</tbody>
</table>

<div class="footer">
<div class="footer-brand">BREEDLOG</div>
<div class="footer-tagline">Professional Livestock Management</div>
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
      name: `Health Event PDF - ${event.eventName || event.productName} - ${format(new Date(event.eventDate), "dd MMM yyyy")}`,
      documentType: "productivity",
      subfolder: "flock-health"
    });
    
    toast({ title: "PDF Exported", description: "Health event PDF opened for printing" });
  };

  const exportJSON = () => {
    if (!event) return;
    
    const exportData = {
      eventName: event.eventName,
      eventDate: event.eventDate,
      productName: event.productName,
      route: event.route,
      treatAllAnimals: event.treatAllAnimals,
      notes: event.notes,
      animalsTreated: eventAnimals.map(a => ({
        tagId: a?.tagId,
        name: a?.name,
        sex: a?.sex,
        breed: a?.breed,
      })),
      exportedAt: new Date().toISOString(),
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `health-event-${event.id}-${format(new Date(event.eventDate), "yyyy-MM-dd")}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({ title: "JSON Exported", description: "Health event data downloaded" });
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading health event...</p>
        </div>
      </Layout>
    );
  }

  if (!event) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <p className="text-muted-foreground">Health event not found</p>
          <Link href="/health">
            <Button variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to Health
            </Button>
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-4 md:space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
          <div>
            <Link href="/health">
              <Button variant="ghost" size="sm" className="mb-2 -ml-2" data-testid="button-back">
                <ArrowLeft className="w-4 h-4 mr-1" /> Back to Health
              </Button>
            </Link>
            <h1 className="text-xl md:text-2xl font-bold text-foreground tracking-tight" data-testid="page-title">
              {event.eventName || "Health Event"}
            </h1>
            <p className="text-muted-foreground text-xs md:text-sm mt-0.5">
              {format(new Date(event.eventDate), "dd MMMM yyyy")} • {eventAnimals.length} animals
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" data-testid="button-export-health-event">
                <Download className="w-4 h-4 mr-2" /> Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={exportPDF} className="cursor-pointer" data-testid="menu-export-pdf">
                <FileText className="w-4 h-4 mr-2" /> Export PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportJSON} className="cursor-pointer" data-testid="menu-export-json">
                <FileDown className="w-4 h-4 mr-2" /> Export JSON
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <Card className="rugged-card">
            <CardHeader className="p-3 md:p-6 pb-2">
              <CardTitle className="uppercase text-sm flex items-center gap-2">
                <Syringe className="w-4 h-4 text-primary" /> Treatment Details
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 md:p-6 pt-0 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Event Name</p>
                  <p className="font-medium text-sm">{event.eventName || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Date</p>
                  <p className="font-medium text-sm flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {format(new Date(event.eventDate), "dd MMM yyyy")}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Treatment/Product</p>
                  <p className="font-medium text-sm">{event.productName}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Treatment Type</p>
                  <Badge variant="outline" className="capitalize">{event.route}</Badge>
                </div>
              </div>
              
              {event.notes && (
                <div className="pt-2 border-t border-border">
                  <p className="text-xs text-muted-foreground">Notes</p>
                  <p className="text-sm mt-1">{event.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rugged-card">
            <CardHeader className="p-3 md:p-6 pb-2">
              <CardTitle className="uppercase text-sm flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" /> Animals Treated
                <Badge variant="secondary" className="ml-auto">{eventAnimals.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 md:p-6 pt-0">
              {event.treatAllAnimals ? (
                <div className="text-center py-4">
                  <Badge className="bg-green-900/30 text-green-400 border-green-700">
                    All Active Animals Treated
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-2">
                    {eventAnimals.length} animals at time of treatment
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-2">
                  {eventAnimals.length} selected animals treated
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="rugged-card">
          <CardHeader className="p-3 md:p-6 pb-2">
            <CardTitle className="uppercase text-sm">Animals List ({eventAnimals.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-3 md:p-6 pt-0">
            {eventAnimals.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No animals recorded for this event</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {eventAnimals.map((animal, idx) => (
                  <Link
                    key={animal?.id || idx}
                    href={`/animals/${animal?.id}`}
                    className="flex items-center justify-between p-2 bg-secondary rounded border border-border hover:bg-secondary/80 transition-colors cursor-pointer"
                    data-testid={`link-animal-${animal?.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-6">{idx + 1}.</span>
                      <div>
                        <p className="font-medium text-sm">{animal?.tagId}</p>
                        {animal?.name && <p className="text-xs text-muted-foreground">{animal.name}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs capitalize">{animal?.sex}</Badge>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
