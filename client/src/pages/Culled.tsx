import { useState } from "react";
import { Layout } from "@/components/Layout";
import { useAnimals } from "@/hooks/use-animals";
import { useFarmSettings } from "@/hooks/use-farm-settings";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Download, FileText, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import type { Animal } from "@shared/schema";
import logo from "@/assets/breedlog-logo-mark.png";

export default function Culled() {
  const [search, setSearch] = useState("");
  const { data: allAnimals, isLoading } = useAnimals({ search });
  const { data: farmSettings } = useFarmSettings();
  const { toast } = useToast();
  const displayName = farmSettings?.studName || farmSettings?.farmName;

  const culledAnimals = (allAnimals || []).filter(animal => 
    animal.status === 'culled' || animal.cullConfirmed === true
  );

  const exportCulledPDF = () => {
    if (culledAnimals.length === 0) {
      toast({ title: "No Data", description: "No culled animals to export", variant: "destructive" });
      return;
    }

    const fb = farmSettings;
    const exportDate = format(new Date(), "dd/MM/yyyy HH:mm");

    const tableRows = culledAnimals.map(animal => {
      const category = animal.sex === 'ram' ? 'Ram' : animal.sex === 'ewe' ? 'Ewe' : 'Lamb';
      return `<tr>
        <td><strong>${animal.tagId}</strong></td>
        <td>${animal.sex || '-'}</td>
        <td>${animal.birthDate ? format(new Date(animal.birthDate), "dd/MM/yyyy") : '-'}</td>
        <td>${animal.cullDate ? format(new Date(animal.cullDate), "dd/MM/yyyy") : '-'}</td>
        <td>${animal.cullReason || '-'}</td>
        <td>${category}</td>
        <td>${animal.notes || '-'}</td>
      </tr>`;
    }).join('');

    const pdfHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Culled Animals Export</title>
        <style>
          @page { size: A4 portrait; margin: 10mm; }
          * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
          body { background: white; color: #1a1a1a; font-size: 9pt; }
          .page { width: 190mm; min-height: 277mm; position: relative; padding-bottom: 25mm; page-break-after: always; }
          .page:last-child { page-break-after: auto; }
          .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px solid #FFC300; }
          .header-left { display: flex; align-items: center; gap: 15px; }
          .logo { max-height: 50px; max-width: 80px; object-fit: contain; }
          .header-title { font-size: 16pt; font-weight: bold; color: #1a1a1a; }
          .header-right { text-align: right; font-size: 8pt; color: #666; }
          .section-title { background: #FFC300; color: #1a1a1a; font-size: 11pt; font-weight: bold; padding: 8px 12px; margin-bottom: 10px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
          th { background: #FFC300; color: #1a1a1a; font-weight: bold; padding: 8px 10px; text-align: left; font-size: 8pt; border: 1px solid #ddd; }
          td { padding: 8px 10px; text-align: left; font-size: 8pt; border: 1px solid #ddd; vertical-align: top; }
          tr:nth-child(even) { background: #f9f9f9; }
          .footer { position: absolute; bottom: 6mm; left: 6mm; right: 6mm; height: 15mm; display: flex; align-items: center; justify-content: space-between; padding: 5px 15px; background: linear-gradient(135deg, #FFC300 0%, #FFD700 100%); border-radius: 4px; }
          .footer-brand { font-weight: bold; font-size: 10pt; color: #1a1a1a; letter-spacing: 2px; }
          .footer-tagline { font-size: 8pt; color: #333; }
        </style>
      </head>
      <body>
        <div class="page">
          <div class="header">
            <div class="header-left">
              ${fb?.logoUrl ? `<img src="${fb.logoUrl}" class="logo" />` : ''}
              <span class="header-title">${fb?.studName || fb?.farmName || 'BreedLog'}</span>
            </div>
            <div class="header-right">
              <div>Culled Animals Archive</div>
              <div>Generated: ${exportDate}</div>
            </div>
          </div>
          
          <div class="section-title">CULLED ANIMALS (${culledAnimals.length})</div>
          <table>
            <thead>
              <tr>
                <th>Animal ID</th>
                <th>Sex</th>
                <th>DOB</th>
                <th>Cull Date</th>
                <th>Cull Reason</th>
                <th>Last Category</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
          
          <div class="footer">
            <span class="footer-brand">BREEDLOG</span>
            <span class="footer-tagline">Professional Livestock Management</span>
          </div>
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(pdfHtml);
      printWindow.document.close();
      setTimeout(() => {
        printWindow.print();
      }, 500);
    }

    toast({ title: "Export Ready", description: "Culled animals export opened for printing" });
  };

  return (
    <Layout>
      <div className="space-y-4 md:space-y-6 animate-in fade-in duration-500">
        <div className="flex flex-row justify-between items-center gap-2">
          <h1 className="text-base md:text-3xl font-bold tracking-tight" data-testid="page-title">
            {displayName ? `${displayName} - Culled Archive` : "Culled Archive"}
          </h1>
          <Button 
            variant="outline"
            className="text-white border-white/70 hover:border-white [&_svg]:text-primary"
            onClick={exportCulledPDF}
            disabled={culledAnimals.length === 0}
            data-testid="btn-export-culled"
          >
            <Download className="w-4 h-4 mr-2" />
            Export PDF
          </Button>
        </div>

        <div className="flex flex-col md:flex-row gap-2 bg-card p-2.5 md:p-4 rounded-md border border-border shadow-sm">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search culled animals..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 text-sm rugged-input"
              data-testid="input-search-culled"
            />
          </div>
        </div>

        <div className="text-sm text-muted-foreground">
          {culledAnimals.length} culled animal{culledAnimals.length !== 1 ? 's' : ''} in archive
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-16 rounded-md bg-secondary" />
            ))}
          </div>
        ) : culledAnimals.length === 0 ? (
          <Card className="p-8 text-center">
            <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">No culled animals in the archive.</p>
            <p className="text-xs text-muted-foreground mt-2">Animals marked as culled will appear here.</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {culledAnimals.map(animal => (
              <Card 
                key={animal.id} 
                className="p-3 hover-elevate"
                data-testid={`culled-card-${animal.id}`}
              >
                <Link href={`/animals/${animal.id}`} className="block">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm md:text-base" data-testid={`culled-tag-${animal.id}`}>
                          {animal.tagId}
                        </span>
                        <Badge variant="destructive" className="text-xs">CULLED</Badge>
                        <Badge variant="outline" className="text-xs uppercase">{animal.sex}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                        <span>DOB: {animal.birthDate ? format(new Date(animal.birthDate), "dd/MM/yyyy") : "-"}</span>
                        <span>Culled: {animal.cullDate ? format(new Date(animal.cullDate), "dd/MM/yyyy") : "-"}</span>
                        {animal.cullReason && <span>Reason: {animal.cullReason}</span>}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  </div>
                </Link>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
