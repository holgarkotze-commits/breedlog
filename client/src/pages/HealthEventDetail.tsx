import {
  getCanonicalPortraitCSS,
  renderExportHeader,
  renderExportFooter,
  wrapExportDocument,
  openExportPrintDialog,
  sanitizePublicNote,
} from "@/lib/export-template";
import { PDFExportDialog } from "@/components/PDFExportDialog";
import { useState } from "react";
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
import { useNavigationHistory } from "@/lib/navigation-history-context";

export default function HealthEventDetail() {
  const [, params] = useRoute("/health/:id");
  const eventId = params?.id ? parseInt(params.id) : 0;
  const { data: event, isLoading } = useFlockHealthEvent(eventId);
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false);
  const { data: animals } = useAnimals({});
  const { data: farmSettings } = useFarmSettings();
  const displayName = farmSettings?.studName || farmSettings?.farmName;
  const createExportedDoc = useCreateExportedDocument();
  const { toast } = useToast();
  const { goBack } = useNavigationHistory();

  const getAnimalById = (id: number) => animals?.find(a => a.id === id);

  const treatmentAnimals = event?.treatments?.map(t => getAnimalById(t.animalId)).filter(Boolean) || [];
  const activeAnimals = animals?.filter(a => a.status === 'active') || [];
  const eventAnimals = event?.treatAllAnimals ? activeAnimals : treatmentAnimals;

  const exportPDF = () => {
    if (!event) return;
    
    const exportDate = format(new Date(), "dd/MM/yyyy HH:mm");
    const fb = farmSettings ?? null;
    const title = event.eventName || "Health Event Record";
    const subtitle = `${displayName || "BreedLog"} — Health`;

    // Canonical portrait CSS + health-specific detail styles
    const css = getCanonicalPortraitCSS() + `
      .health-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 16px; margin: 6mm 0; font-size: 8.5pt; }
      .health-field label { font-weight: 700; color: #444; display: block; }
      .health-field span { color: #111; }
      .section-title { font-size: 9pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #003366; border-bottom: 1px solid #ddd; margin: 5mm 0 3mm; padding-bottom: 1mm; }
      .notes-box { background: #fffbea; border-left: 3px solid #FFC300; padding: 4px 8px; margin: 4px 0; font-size: 8pt; border-radius: 2px; }
      .animal-table { width: 100%; border-collapse: collapse; margin-top: 2mm; }
      .animal-table th { background: #FFC300; color: #000; font-weight: 700; font-size: 7pt; padding: 6px 6px; text-align: left; text-transform: uppercase; }
      .animal-table td { padding: 5px 6px; border-bottom: 1px solid #eee; font-size: 7.5pt; }
      .animal-table tbody tr:nth-child(even) { background: #fafafa; }
    `;

    const field = (label: string, value: string | null | undefined) =>
      `<div class="health-field"><label>${label}</label><span>${value || "Not recorded"}</span></div>`;

    const body = `
      <div class="health-grid">
        ${field("Event Name", event.eventName)}
        ${field("Event Date", format(new Date(event.eventDate), "dd MMMM yyyy"))}
        ${field("Category / Type", event.eventType || "Not recorded")}
        ${field("Treatment / Product", event.productName)}
        ${field("Dosage", event.dose)}
        ${field("Route", event.route)}
        ${field("Administrator", (event as any).administrator)}
        ${field("Animals Treated", event.treatAllAnimals ? `All active (${eventAnimals.length})` : `${eventAnimals.length} selected`)}
        ${field("Withdrawal Date", (event as any).withdrawalDate)}
        ${field("Follow-up Date", event.nextFollowUpDate ? format(new Date(event.nextFollowUpDate), "dd/MM/yyyy") : null)}
      </div>
      ${event.withdrawalPeriodNotes ? `<div class="notes-box"><strong>Withdrawal notes:</strong> ${sanitizePublicNote(event.withdrawalPeriodNotes)}</div>` : ""}
      ${event.notes ? `<div class="notes-box"><strong>Clinical notes:</strong> ${sanitizePublicNote(event.notes)}</div>` : ""}
      <p class="section-title">Animals Treated (${eventAnimals.length})</p>
      <table class="animal-table">
        <thead><tr><th>#</th><th>Tag ID</th><th>Name</th><th>Sex</th><th>Breed</th></tr></thead>
        <tbody>
          ${eventAnimals.map((animal, idx) => `<tr>
            <td>${idx + 1}</td>
            <td><strong>${animal?.tagId || "—"}</strong></td>
            <td>${animal?.name || "—"}</td>
            <td style="text-transform:capitalize">${animal?.sex || "—"}</td>
            <td>${animal?.breed || "—"}</td>
          </tr>`).join("")}
        </tbody>
      </table>`;

    const pageHtml = `<div class="page">
      ${renderExportHeader(fb, 1, 1, exportDate, title, subtitle)}
      ${body}
      ${renderExportFooter(fb)}
    </div>`;

    const html = wrapExportDocument(title, css, pageHtml);
    openExportPrintDialog(html);

    createExportedDoc.mutate({
      name: `Health Event PDF - ${event.eventName || event.productName} - ${format(new Date(event.eventDate), "dd MMM yyyy")}`,
      documentType: "productivity",
      subfolder: "flock-health"
    });

    toast({ title: "PDF Exported", description: "Health event PDF opened for printing" });
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
          <Button variant="outline" onClick={() => goBack('/health')}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Health
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-4 md:space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
          <div>
            <Button variant="ghost" size="sm" className="mb-2 -ml-2" onClick={() => goBack('/health')} data-testid="button-back">
              <ArrowLeft className="w-4 h-4 mr-1" /> Back to Health
            </Button>
            <h1 className="text-xl md:text-2xl font-bold text-foreground tracking-tight" data-testid="page-title">
              {event.eventName || "Health Event"}
            </h1>
            <p className="text-muted-foreground text-xs md:text-sm mt-0.5">
              {format(new Date(event.eventDate), "dd MMMM yyyy")} • {eventAnimals.length} animals • {event.eventType || "observation_symptom"}
            </p>
            <div className="flex flex-wrap gap-2 mt-2 text-xs">
              {event.dose && <Badge variant="outline">Dose: {event.dose}</Badge>}
              {event.nextFollowUpDate && <Badge variant="outline">Follow-up: {format(new Date(event.nextFollowUpDate), "dd MMM yyyy")}</Badge>}
              {event.withdrawalPeriodNotes && <Badge variant="outline">Withdrawal notes recorded</Badge>}
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" data-testid="button-export-health-event">
                <Download className="w-4 h-4 mr-2" /> Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setPdfDialogOpen(true)} className="cursor-pointer" data-testid="menu-export-pdf">
                <FileText className="w-4 h-4 mr-2" /> Export PDF
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
                  <p className="font-medium text-sm" data-testid="text-event-name">{event.eventName || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Date</p>
                  <p className="font-medium text-sm flex items-center gap-1" data-testid="text-event-date">
                    <Calendar className="w-3 h-3" />
                    {format(new Date(event.eventDate), "dd MMM yyyy")}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Treatment/Product</p>
                  <p className="font-medium text-sm" data-testid="text-product-name">{event.productName}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Treatment Type</p>
                  <Badge variant="outline" className="capitalize" data-testid="text-route">{event.route}</Badge>
                </div>
              </div>
              
              {event.notes && (
                <div className="pt-2 border-t border-border">
                  <p className="text-xs text-muted-foreground">Notes</p>
                  <p className="text-sm mt-1" data-testid="text-notes">{event.notes}</p>
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
      {/* PDF quality dialog */}
      <PDFExportDialog
        open={pdfDialogOpen}
        onOpenChange={setPdfDialogOpen}
        title="Export Health Event PDF"
        description="Choose export quality. Data, text, and counts are identical at all quality levels."
        exportLabel="Export PDF"
        onExport={async (_quality) => {
          exportPDF();
          setPdfDialogOpen(false);
        }}
      />
    </Layout>
  );
}
