import { useState, useRef, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { useAnimals, useCreateAnimal, useDeleteAnimal } from "@/hooks/use-animals";
import { useFarmSettings } from "@/hooks/use-farm-settings";
import { useBreedingEvents } from "@/hooks/use-breeding";
import { AnimalCard } from "@/components/AnimalCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertAnimalSchema, type Animal, type BreedingEvent } from "@shared/schema";
import { Search, Plus, Filter, Camera, X, Image, FileText, Trash2, MoreVertical, Download, LayoutGrid, List, Grid3X3 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Link, useSearch, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { format } from "date-fns";
import logo from "@assets/BREEDLOG_LOGO_1768730745128.png";

function calculateEweBreedingStats(eweId: number, breedingEvents: BreedingEvent[], allAnimals: Animal[]) {
  const eweEvents = breedingEvents.filter(e => e.eweId === eweId && e.lambingDate);
  
  const totalLambs = eweEvents.reduce((sum, e) => sum + (e.lambCount || 0), 0);
  
  const lambingDates = eweEvents
    .map(e => new Date(e.lambingDate!))
    .sort((a, b) => a.getTime() - b.getTime());
  
  const firstLambDate = lambingDates.length > 0 ? lambingDates[0] : null;
  
  let avgILP = 0;
  if (lambingDates.length > 1) {
    const intervals: number[] = [];
    for (let i = 1; i < lambingDates.length; i++) {
      const days = (lambingDates[i].getTime() - lambingDates[i-1].getTime()) / (1000 * 60 * 60 * 24);
      intervals.push(days);
    }
    avgILP = Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length);
  }
  
  const offspring = allAnimals.filter(a => a.damId === eweId);
  const weanedLambs = offspring.filter(a => 
    a.weaningStatus === 'normal' || a.weaningStatus === 'early'
  ).length;
  
  const weanedWithWeight = offspring.filter(a => 
    (a.weaningStatus === 'normal' || a.weaningStatus === 'early') && a.weight100Day
  );
  const avgWeanWeight = weanedWithWeight.length > 0
    ? Math.round((weanedWithWeight.reduce((sum, a) => sum + parseFloat(a.weight100Day || '0'), 0) / weanedWithWeight.length) * 10) / 10
    : 0;
  
  return {
    totalLambs,
    firstLambDate,
    avgILP,
    lambsWeaned: weanedLambs,
    avgWeanWeight
  };
}

function calculateRamBreedingStats(ramId: number, breedingEvents: BreedingEvent[], allAnimals: Animal[]) {
  // Get all lambing events where this ram was the sire
  const ramEvents = breedingEvents.filter(e => e.ramId === ramId && e.lambingDate);
  
  // Total lambs sired
  const totalLambs = ramEvents.reduce((sum, e) => sum + (e.lambCount || 0), 0);
  
  // Count twins (lambings with 2+ lambs)
  const twinCount = ramEvents.filter(e => (e.lambCount || 0) >= 2).length;
  
  // Get offspring for weight calculations
  const offspring = allAnimals.filter(a => a.sireId === ramId);
  
  // Calculate average birth weight
  const birthWeights = offspring.filter(a => a.birthWeight).map(a => parseFloat(a.birthWeight || '0'));
  const avgBirthWeight = birthWeights.length > 0 
    ? Math.round((birthWeights.reduce((a, b) => a + b, 0) / birthWeights.length) * 10) / 10 
    : 0;
  
  // Calculate average 100-day weight
  const weight100Days = offspring.filter(a => a.weight100Day).map(a => parseFloat(a.weight100Day || '0'));
  const avgWeight100Day = weight100Days.length > 0 
    ? Math.round((weight100Days.reduce((a, b) => a + b, 0) / weight100Days.length) * 10) / 10 
    : 0;
  
  // Calculate average 270-day weight
  const weight270Days = offspring.filter(a => a.weight270Day).map(a => parseFloat(a.weight270Day || '0'));
  const avgWeight270Day = weight270Days.length > 0 
    ? Math.round((weight270Days.reduce((a, b) => a + b, 0) / weight270Days.length) * 10) / 10 
    : 0;
  
  // Calculate average wean weight (using weight100Day as wean weight)
  const weanedWithWeight = offspring.filter(a => 
    (a.weaningStatus === 'normal' || a.weaningStatus === 'early') && a.weight100Day
  );
  const avgWeanWeight = weanedWithWeight.length > 0
    ? Math.round((weanedWithWeight.reduce((sum, a) => sum + parseFloat(a.weight100Day || '0'), 0) / weanedWithWeight.length) * 10) / 10
    : 0;
  
  return {
    totalLambs,
    twinCount,
    avgBirthWeight,
    avgWeight100Day,
    avgWeight270Day,
    avgWeanWeight
  };
}

export default function Animals() {
  const searchParams = useSearch();
  const urlParams = new URLSearchParams(searchParams);
  
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(urlParams.get("status") || "active");
  const [sexFilter, setSexFilter] = useState(urlParams.get("sex") || "all");
  const [ageFilter, setAgeFilter] = useState(urlParams.get("age") || "all");
  const { data: allAnimals, isLoading } = useAnimals({ search });
  const { data: breedingEvents } = useBreedingEvents();
  const { data: farmSettings } = useFarmSettings();
  const { toast } = useToast();
  const displayName = farmSettings?.studName || farmSettings?.farmName;
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"detailed" | "list" | "thumbnail">("detailed");
  const isMobile = useIsMobile();

  // Full Herd Export PDF with Rams, Ewes, Lambs sections
  const exportFullHerdPDF = () => {
    if (!allAnimals || !breedingEvents) return;
    const fb = farmSettings;
    const exportDate = format(new Date(), "dd/MM/yyyy HH:mm");
    
    const rams = allAnimals.filter(a => a.sex?.toLowerCase() === "ram");
    const ewes = allAnimals.filter(a => a.sex?.toLowerCase() === "ewe");
    const lambs = allAnimals.filter(a => {
      if (!a.birthDate) return false;
      const birthDate = new Date(a.birthDate);
      const ageInDays = (Date.now() - birthDate.getTime()) / (1000 * 60 * 60 * 24);
      return ageInDays <= 365;
    });
    
    if (rams.length === 0 && ewes.length === 0 && lambs.length === 0) {
      toast({ title: "No Animals", description: "No animals found to export", variant: "destructive" });
      return;
    }
    
    let pagesHtml = "";
    let pageNum = 1;
    
    // Count total pages
    const ramsPerPage = 20;
    const ewesPerPage = 18;
    const lambsPerPage = 22;
    const ramsPages = Math.max(1, Math.ceil(rams.length / ramsPerPage));
    const ewesPages = Math.max(1, Math.ceil(ewes.length / ewesPerPage));
    const lambsPages = Math.max(1, Math.ceil(lambs.length / lambsPerPage));
    const totalPages = (rams.length > 0 ? ramsPages : 0) + (ewes.length > 0 ? ewesPages : 0) + (lambs.length > 0 ? lambsPages : 0);
    
    // SECTION 1: RAMS
    if (rams.length > 0) {
      const ramsWithStats = rams.map(ram => {
        const stats = calculateRamBreedingStats(ram.id, breedingEvents, allAnimals);
        return { ...ram, stats };
      });
      
      for (let page = 0; page < ramsPages; page++) {
        const startIdx = page * ramsPerPage;
        const pageRams = ramsWithStats.slice(startIdx, startIdx + ramsPerPage);
        
        const tableRows = pageRams.map((ram) => {
          return `<tr>
            <td><strong>${ram.tagId}</strong></td>
            <td>${ram.birthDate ? format(new Date(ram.birthDate), "dd/MM/yyyy") : '-'}</td>
            <td>${ram.stats.totalLambs || 0}</td>
            <td>${ram.stats.avgBirthWeight || '-'}</td>
            <td>${ram.stats.avgWeight100Day || '-'}</td>
            <td>${ram.stats.avgWeight270Day || '-'}</td>
            <td>${ram.stats.twinCount || 0}</td>
            <td>${ram.stats.avgWeanWeight || '-'}</td>
            <td><span class="status status-${ram.status}">${ram.status}</span></td>
          </tr>`;
        }).join('');
        
        pagesHtml += `
          <div class="page">
            <div class="header">
              <div class="header-left">
                ${fb?.logoUrl ? `<img src="${fb.logoUrl}" class="logo" />` : ''}
              </div>
              <div class="header-center">
                <h1>${fb?.studName || fb?.farmName || "Full Herd Register"}</h1>
                <p class="subtitle">Complete Livestock Register</p>
              </div>
              <div class="header-right">
                <p>Page ${pageNum} of ${totalPages}</p>
                <p>${exportDate}</p>
              </div>
            </div>
            
            <h2 class="section-title">RAMS</h2>
            
            <table class="animals-table">
              <thead>
                <tr>
                  <th>Ram ID</th>
                  <th>DOB</th>
                  <th>Total Lambs</th>
                  <th>Avg Birth (kg)</th>
                  <th>Avg 100-Day (kg)</th>
                  <th>Avg 270-Day (kg)</th>
                  <th>Twin Count</th>
                  <th>Avg Wean (kg)</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>${tableRows}</tbody>
            </table>
            
            <div class="footer">
              <div class="footer-info">
                <p class="footer-title">${fb?.studName || fb?.farmName || "BreedLog"}</p>
                <p>${fb?.ownerName || ""} ${fb?.ownerPhone ? "| " + fb.ownerPhone : ""}</p>
              </div>
              <div class="footer-branding">
                <p class="breedlog-text">BREEDLOG</p>
                <p class="tagline">Professional Livestock Management</p>
              </div>
            </div>
          </div>
        `;
        pageNum++;
      }
    }
    
    // SECTION 2: EWES
    if (ewes.length > 0) {
      const ewesWithStats = ewes.map(ewe => {
        const stats = calculateEweBreedingStats(ewe.id, breedingEvents, allAnimals);
        return { ...ewe, stats };
      });
      
      for (let page = 0; page < ewesPages; page++) {
        const startIdx = page * ewesPerPage;
        const pageEwes = ewesWithStats.slice(startIdx, startIdx + ewesPerPage);
        
        const tableRows = pageEwes.map((ewe) => {
          return `<tr>
            <td><strong>${ewe.tagId}</strong></td>
            <td>${ewe.birthDate ? format(new Date(ewe.birthDate), "dd/MM/yyyy") : '-'}</td>
            <td>${ewe.stats.firstLambDate ? format(new Date(ewe.stats.firstLambDate), "dd/MM/yyyy") : '-'}</td>
            <td>${ewe.stats.totalLambs}</td>
            <td>${ewe.stats.avgILP || '-'}</td>
            <td>${ewe.stats.lambsWeaned}</td>
            <td>${ewe.stats.avgWeanWeight || '-'}</td>
            <td><span class="status status-${ewe.status}">${ewe.status}</span></td>
          </tr>`;
        }).join('');
        
        pagesHtml += `
          <div class="page">
            <div class="header">
              <div class="header-left">
                ${fb?.logoUrl ? `<img src="${fb.logoUrl}" class="logo" />` : ''}
              </div>
              <div class="header-center">
                <h1>${fb?.studName || fb?.farmName || "Full Herd Register"}</h1>
                <p class="subtitle">Complete Livestock Register</p>
              </div>
              <div class="header-right">
                <p>Page ${pageNum} of ${totalPages}</p>
                <p>${exportDate}</p>
              </div>
            </div>
            
            <h2 class="section-title">EWES</h2>
            
            <table class="animals-table">
              <thead>
                <tr>
                  <th>Ewe ID</th>
                  <th>Date of Birth</th>
                  <th>First Lamb Date</th>
                  <th>Total Lamb Count</th>
                  <th>ILP (days)</th>
                  <th>Weaned Lamb Count</th>
                  <th>Avg Wean Weight (kg)</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>${tableRows}</tbody>
            </table>
            
            <div class="footer">
              <div class="footer-info">
                <p class="footer-title">${fb?.studName || fb?.farmName || "BreedLog"}</p>
                <p>${fb?.ownerName || ""} ${fb?.ownerPhone ? "| " + fb.ownerPhone : ""}</p>
              </div>
              <div class="footer-branding">
                <p class="breedlog-text">BREEDLOG</p>
                <p class="tagline">Professional Livestock Management</p>
              </div>
            </div>
          </div>
        `;
        pageNum++;
      }
    }
    
    // SECTION 3: LAMBS
    if (lambs.length > 0) {
      for (let page = 0; page < lambsPages; page++) {
        const startIdx = page * lambsPerPage;
        const pageLambs = lambs.slice(startIdx, startIdx + lambsPerPage);
        
        const tableRows = pageLambs.map((lamb) => {
          return `<tr>
            <td><strong>${lamb.tagId}</strong></td>
            <td>${lamb.name || '-'}</td>
            <td>${lamb.sex || '-'}</td>
            <td>${lamb.birthDate ? format(new Date(lamb.birthDate), "dd/MM/yyyy") : '-'}</td>
            <td>${lamb.birthWeight ? lamb.birthWeight + ' kg' : '-'}</td>
            <td>${lamb.currentWeight ? lamb.currentWeight + ' kg' : '-'}</td>
            <td><span class="status status-${lamb.status}">${lamb.status}</span></td>
          </tr>`;
        }).join('');
        
        pagesHtml += `
          <div class="page">
            <div class="header">
              <div class="header-left">
                ${fb?.logoUrl ? `<img src="${fb.logoUrl}" class="logo" />` : ''}
              </div>
              <div class="header-center">
                <h1>${fb?.studName || fb?.farmName || "Full Herd Register"}</h1>
                <p class="subtitle">Complete Livestock Register</p>
              </div>
              <div class="header-right">
                <p>Page ${pageNum} of ${totalPages}</p>
                <p>${exportDate}</p>
              </div>
            </div>
            
            <h2 class="section-title">LAMBS</h2>
            
            <table class="animals-table">
              <thead>
                <tr>
                  <th>Lamb ID</th>
                  <th>Name</th>
                  <th>Sex</th>
                  <th>Date of Birth</th>
                  <th>Birth Weight</th>
                  <th>Current Weight</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>${tableRows}</tbody>
            </table>
            
            <div class="footer">
              <div class="footer-info">
                <p class="footer-title">${fb?.studName || fb?.farmName || "BreedLog"}</p>
                <p>${fb?.ownerName || ""} ${fb?.ownerPhone ? "| " + fb.ownerPhone : ""}</p>
              </div>
              <div class="footer-branding">
                <p class="breedlog-text">BREEDLOG</p>
                <p class="tagline">Professional Livestock Management</p>
              </div>
            </div>
          </div>
        `;
        pageNum++;
      }
    }
    
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${fb?.studName || fb?.farmName || "BreedLog"} - Full Herd Register</title>
  <style>
    @page { size: A4 portrait; margin: 10mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 9pt; color: #1a1a1a; background: white; }
    .page { width: 190mm; min-height: 277mm; padding: 6mm; padding-bottom: 28mm; margin: 0 auto; page-break-after: always; position: relative; }
    .page:last-child { page-break-after: avoid; }
    .header { display: flex; align-items: center; justify-content: space-between; padding: 0 2mm 4mm 2mm; border-bottom: 2px solid #FFC300; margin-bottom: 5mm; }
    .header-left { width: 60px; flex-shrink: 0; }
    .logo { width: 50px; height: 50px; object-fit: contain; }
    .header-center { flex: 1; text-align: center; }
    .header-center h1 { font-size: 14pt; font-weight: 800; color: #1a1a1a; text-transform: uppercase; letter-spacing: 1px; }
    .header-center .subtitle { font-size: 8pt; color: #666; margin-top: 3px; }
    .header-right { text-align: right; font-size: 8pt; color: #666; flex-shrink: 0; }
    .section-title { font-size: 12pt; font-weight: 800; color: #1a1a1a; margin-bottom: 4mm; text-transform: uppercase; background: #FFC300; padding: 6px 12px; display: inline-block; border-radius: 3px; }
    .animals-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    .animals-table th { background: #FFC300; color: #000; font-weight: 700; font-size: 7pt; padding: 8px 6px; text-align: left; text-transform: uppercase; vertical-align: middle; }
    .animals-table td { padding: 6px; border-bottom: 1px solid #e0e0e0; font-size: 8pt; vertical-align: middle; text-align: left; }
    .animals-table tbody tr { height: auto; }
    .animals-table tr:nth-child(even) { background: #fafafa; }
    .status { display: inline-block; padding: 2px 6px; border-radius: 3px; font-size: 6pt; font-weight: 600; text-transform: uppercase; }
    .status-active { background: #22c55e20; color: #16a34a; }
    .status-sold { background: #f59e0b20; color: #d97706; }
    .status-deceased, .status-dead { background: #ef444420; color: #dc2626; }
    .footer { display: flex; align-items: center; justify-content: space-between; border-top: 2px solid #FFC300; background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%); color: white; padding: 4mm 5mm; border-radius: 2mm; position: absolute; bottom: 6mm; left: 6mm; right: 6mm; }
    .footer-info { flex: 1; }
    .footer-title { font-size: 9pt; font-weight: 700; color: #FFC300; }
    .footer-info p { font-size: 7pt; margin-top: 2px; }
    .footer-branding { text-align: right; display: flex; flex-direction: column; align-items: flex-end; }
    .footer-branding .breedlog-text { font-size: 11pt; font-weight: 800; color: white; letter-spacing: 1px; margin: 0; }
    .footer-branding .tagline { font-size: 7pt; font-style: italic; color: #FFC300; margin-top: 2px; }
    @media print { 
      .page { page-break-after: always; } 
      .page:last-child { page-break-after: avoid; }
      thead { display: table-header-group; }
    }
  </style>
</head>
<body>
  ${pagesHtml}
</body>
</html>
    `;
    
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 500);
    }
    toast({ title: "PDF Ready", description: "Full Herd Register export opened for printing" });
  };

  const exportHerdPDF = (exportType: "rams" | "ewes" | "lambs") => {
    if (!allAnimals || !breedingEvents) return;
    const fb = farmSettings;
    const exportDate = format(new Date(), "dd/MM/yyyy HH:mm");
    
    // Filter animals based on export type
    let exportAnimals: Animal[] = [];
    let exportTitle = "";
    let exportSubtitle = "";
    
    switch (exportType) {
      case "rams":
        exportAnimals = allAnimals.filter(a => a.sex?.toLowerCase() === "ram");
        exportTitle = "Rams Register";
        exportSubtitle = "Male Livestock";
        break;
      case "ewes":
        exportAnimals = allAnimals.filter(a => a.sex?.toLowerCase() === "ewe");
        exportTitle = "Ewes Register";
        exportSubtitle = "Breeding Female Livestock";
        break;
      case "lambs":
        exportAnimals = allAnimals.filter(a => {
          if (!a.birthDate) return false;
          const birthDate = new Date(a.birthDate);
          const ageInDays = (Date.now() - birthDate.getTime()) / (1000 * 60 * 60 * 24);
          return ageInDays <= 365;
        });
        exportTitle = "Lambs Register";
        exportSubtitle = "Animals Under 1 Year";
        break;
    }
    
    if (exportAnimals.length === 0) {
      toast({ title: "No Animals", description: `No ${exportType} found to export`, variant: "destructive" });
      return;
    }
    
    // Ewes get special handling with breeding stats columns
    if (exportType === "ewes") {
      const ewesWithStats = exportAnimals.map(ewe => {
        const stats = calculateEweBreedingStats(ewe.id, breedingEvents, allAnimals);
        return { ...ewe, stats };
      });
      
      const ewesPerPage = 18;
      const totalPages = Math.ceil(ewesWithStats.length / ewesPerPage);
      
      let pagesHtml = "";
      for (let page = 0; page < Math.max(1, totalPages); page++) {
        const startIdx = page * ewesPerPage;
        const pageEwes = ewesWithStats.slice(startIdx, startIdx + ewesPerPage);
        
        const tableRows = pageEwes.map((ewe) => {
          return `<tr>
            <td><strong>${ewe.tagId}</strong></td>
            <td>${ewe.birthDate ? format(new Date(ewe.birthDate), "dd/MM/yyyy") : '-'}</td>
            <td>${ewe.stats.firstLambDate ? format(new Date(ewe.stats.firstLambDate), "dd/MM/yyyy") : '-'}</td>
            <td>${ewe.stats.totalLambs}</td>
            <td>${ewe.stats.avgILP || '-'}</td>
            <td>${ewe.stats.lambsWeaned}</td>
            <td>${ewe.stats.avgWeanWeight || '-'}</td>
            <td><span class="status status-${ewe.status}">${ewe.status}</span></td>
          </tr>`;
        }).join('');
        
        pagesHtml += `
          <div class="page">
            <div class="header">
              <div class="header-left">
                ${fb?.logoUrl ? `<img src="${fb.logoUrl}" class="logo" />` : ''}
              </div>
              <div class="header-center">
                <h1>${fb?.studName || fb?.farmName || exportTitle}</h1>
                <p class="subtitle">${exportSubtitle}</p>
              </div>
              <div class="header-right">
                <p>Page ${page + 1} of ${Math.max(1, totalPages)}</p>
                <p>${exportDate}</p>
              </div>
            </div>
            
            <table class="animals-table">
              <thead>
                <tr>
                  <th>Ewe ID</th>
                  <th>Date of Birth</th>
                  <th>First Lamb Date</th>
                  <th>Total Lamb Count</th>
                  <th>ILP (days)</th>
                  <th>Weaned Lamb Count</th>
                  <th>Avg Wean Wt (kg)</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>${tableRows}</tbody>
            </table>
            
            <div class="footer">
              <div class="footer-info">
                <p class="footer-title">${fb?.studName || fb?.farmName || "BreedLog"}</p>
                <p>${fb?.ownerName || ""} ${fb?.ownerPhone ? "| " + fb.ownerPhone : ""}</p>
              </div>
              <div class="footer-branding">
                <p class="breedlog-text">BREEDLOG</p>
                <p class="tagline">Professional Livestock Management</p>
              </div>
            </div>
          </div>
        `;
      }
      
      const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${fb?.studName || fb?.farmName || "BreedLog"} - ${exportTitle}</title>
  <style>
    @page { size: A4 portrait; margin: 10mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 9pt; color: #1a1a1a; background: white; }
    .page { width: 190mm; min-height: 277mm; padding: 6mm; padding-bottom: 28mm; margin: 0 auto; page-break-after: always; position: relative; }
    .page:last-child { page-break-after: avoid; }
    .header { display: flex; align-items: center; justify-content: space-between; padding: 0 2mm 4mm 2mm; border-bottom: 2px solid #FFC300; margin-bottom: 5mm; }
    .header-left { width: 60px; flex-shrink: 0; }
    .logo { width: 50px; height: 50px; object-fit: contain; }
    .header-center { flex: 1; text-align: center; }
    .header-center h1 { font-size: 14pt; font-weight: 800; color: #1a1a1a; text-transform: uppercase; letter-spacing: 1px; }
    .header-center .subtitle { font-size: 8pt; color: #666; margin-top: 3px; }
    .header-right { text-align: right; font-size: 8pt; color: #666; flex-shrink: 0; }
    .animals-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    .animals-table th { background: #FFC300; color: #000; font-weight: 700; font-size: 7pt; padding: 8px 6px; text-align: left; text-transform: uppercase; vertical-align: middle; }
    .animals-table td { padding: 6px; border-bottom: 1px solid #e0e0e0; font-size: 8pt; vertical-align: middle; text-align: left; }
    .animals-table tbody tr { height: auto; }
    .animals-table tr:nth-child(even) { background: #fafafa; }
    .status { display: inline-block; padding: 2px 6px; border-radius: 3px; font-size: 6pt; font-weight: 600; text-transform: uppercase; }
    .status-active { background: #22c55e20; color: #16a34a; }
    .status-sold { background: #f59e0b20; color: #d97706; }
    .status-deceased, .status-dead { background: #ef444420; color: #dc2626; }
    .footer { display: flex; align-items: center; justify-content: space-between; border-top: 2px solid #FFC300; background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%); color: white; padding: 4mm 5mm; border-radius: 2mm; position: absolute; bottom: 6mm; left: 6mm; right: 6mm; }
    .footer-info { flex: 1; }
    .footer-title { font-size: 9pt; font-weight: 700; color: #FFC300; }
    .footer-info p { font-size: 7pt; margin-top: 2px; }
    .footer-branding { text-align: right; display: flex; flex-direction: column; align-items: flex-end; }
    .footer-branding .breedlog-text { font-size: 11pt; font-weight: 800; color: white; letter-spacing: 1px; margin: 0; }
    .footer-branding .tagline { font-size: 7pt; font-style: italic; color: #FFC300; margin-top: 2px; }
    @media print { 
      .page { page-break-after: always; } 
      .page:last-child { page-break-after: avoid; }
      thead { display: table-header-group; }
    }
  </style>
</head>
<body>
  ${pagesHtml}
</body>
</html>
      `;
      
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        setTimeout(() => printWindow.print(), 500);
      }
      toast({ title: "PDF Ready", description: `${exportTitle} export opened for printing` });
      return;
    }
    
    // Standard export for rams and lambs
    const animalsPerPage = 22;
    const totalPages = Math.ceil(exportAnimals.length / animalsPerPage);
    
    // Table headers - no photo column
    const tableHeaders = `
      <th style="width:15%">Tag ID</th>
      <th style="width:18%">Name</th>
      <th style="width:10%">Sex</th>
      <th style="width:16%">Breed</th>
      <th style="width:14%">DOB</th>
      <th style="width:12%">Weight</th>
      <th style="width:15%">Status</th>`;
    
    let pagesHtml = "";
    for (let page = 0; page < Math.max(1, totalPages); page++) {
      const startIdx = page * animalsPerPage;
      const pageAnimals = exportAnimals.slice(startIdx, startIdx + animalsPerPage);
      
      const tableRows = pageAnimals.map((a: Animal) => {
        return `<tr>
          <td><strong>${a.tagId}</strong></td>
          <td>${a.name || '-'}</td>
          <td>${a.sex || '-'}</td>
          <td>${a.breed || 'Meatmaster'}</td>
          <td>${a.birthDate ? format(new Date(a.birthDate), "dd/MM/yyyy") : '-'}</td>
          <td>${a.currentWeight ? a.currentWeight + ' kg' : '-'}</td>
          <td><span class="status status-${a.status}">${a.status}</span></td>
        </tr>`;
      }).join('');
      
      pagesHtml += `
        <div class="page">
          <div class="header">
            <div class="header-left">
              ${fb?.logoUrl ? `<img src="${fb.logoUrl}" style="width:60px;height:60px;object-fit:contain;" />` : ''}
            </div>
            <div class="header-center">
              <h1>${fb?.studName || fb?.farmName || exportTitle}</h1>
              <p class="subtitle">${exportSubtitle}</p>
            </div>
            <div class="header-right">
              <p>Page ${page + 1} of ${Math.max(1, totalPages)}</p>
              <p>${exportDate}</p>
            </div>
          </div>
          
          <table class="animals-table">
            <thead><tr>${tableHeaders}</tr></thead>
            <tbody>${tableRows}</tbody>
          </table>
          
          <div class="footer">
            <div class="footer-info">
              <p class="footer-title">${fb?.studName || fb?.farmName || "BreedLog"}</p>
              <p>${fb?.ownerName || ""} ${fb?.ownerPhone ? "| " + fb.ownerPhone : ""}</p>
            </div>
            <div class="footer-branding">
              <p class="breedlog-text">BREEDLOG</p>
              <p class="tagline">Professional Livestock Management</p>
            </div>
          </div>
        </div>
      `;
    }
    
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${fb?.studName || fb?.farmName || "BreedLog"} - ${exportTitle}</title>
  <style>
    @page { size: A4 portrait; margin: 10mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 9pt; color: #1a1a1a; background: white; }
    .page { width: 190mm; min-height: 277mm; padding: 6mm; padding-bottom: 28mm; margin: 0 auto; page-break-after: always; position: relative; }
    .page:last-child { page-break-after: avoid; }
    .header { display: flex; align-items: center; justify-content: space-between; padding: 0 2mm 4mm 2mm; border-bottom: 2px solid #FFC300; margin-bottom: 5mm; }
    .header-left { width: 60px; flex-shrink: 0; }
    .header-center { flex: 1; text-align: center; }
    .header-center h1 { font-size: 14pt; font-weight: 800; color: #1a1a1a; text-transform: uppercase; letter-spacing: 1px; }
    .header-center .subtitle { font-size: 8pt; color: #666; margin-top: 3px; }
    .header-right { text-align: right; font-size: 8pt; color: #666; flex-shrink: 0; }
    .animals-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    .animals-table th { background: #FFC300; color: #000; font-weight: 700; font-size: 8pt; padding: 10px 12px; text-align: left; text-transform: uppercase; vertical-align: middle; }
    .animals-table td { padding: 10px 12px; border-bottom: 1px solid #e0e0e0; font-size: 9pt; vertical-align: middle; text-align: left; }
    .animals-table tbody tr { height: 32pt; }
    .animals-table tr:nth-child(even) { background: #fafafa; }
    .status { display: inline-block; padding: 3px 8px; border-radius: 3px; font-size: 7pt; font-weight: 600; text-transform: uppercase; }
    .status-active { background: #22c55e20; color: #16a34a; }
    .status-sold { background: #f59e0b20; color: #d97706; }
    .status-deceased, .status-dead { background: #ef444420; color: #dc2626; }
    .footer { display: flex; align-items: center; justify-content: space-between; border-top: 2px solid #FFC300; background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%); color: white; padding: 4mm 5mm; border-radius: 2mm; position: absolute; bottom: 6mm; left: 6mm; right: 6mm; }
    .footer-info { flex: 1; }
    .footer-title { font-size: 9pt; font-weight: 700; color: #FFC300; }
    .footer-info p { font-size: 7pt; margin-top: 2px; }
    .footer-branding { text-align: right; display: flex; flex-direction: column; align-items: flex-end; }
    .footer-branding .breedlog-text { font-size: 11pt; font-weight: 800; color: white; letter-spacing: 1px; margin: 0; }
    .footer-branding .tagline { font-size: 7pt; font-style: italic; color: #FFC300; margin-top: 2px; }
    @media print { 
      .page { page-break-after: always; } 
      .page:last-child { page-break-after: avoid; }
      thead { display: table-header-group; }
    }
  </style>
</head>
<body>
  ${pagesHtml}
</body>
</html>
    `;
    
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 500);
    }
    toast({ title: "PDF Ready", description: `${exportTitle} export opened for printing` });
  };

  // Dedicated Ram Export PDF with images
  const exportRamsPDF = () => {
    if (!allAnimals || !breedingEvents) return;
    const fb = farmSettings;
    const exportDate = format(new Date(), "dd/MM/yyyy HH:mm");
    
    const rams = allAnimals.filter(a => a.sex?.toLowerCase() === "ram");
    
    if (rams.length === 0) {
      toast({ title: "No Rams", description: "No rams found to export", variant: "destructive" });
      return;
    }
    
    // Calculate stats for each ram
    const ramsWithStats = rams.map(ram => {
      const stats = calculateRamBreedingStats(ram.id, breedingEvents, allAnimals);
      return { ...ram, stats };
    });
    
    const ramsPerPage = 8; // Fewer per page due to images
    const totalPages = Math.ceil(ramsWithStats.length / ramsPerPage);
    
    let pagesHtml = "";
    for (let page = 0; page < Math.max(1, totalPages); page++) {
      const startIdx = page * ramsPerPage;
      const pageRams = ramsWithStats.slice(startIdx, startIdx + ramsPerPage);
      
      const tableRows = pageRams.map((ram) => {
        return `<tr>
          <td class="photo-cell">
            ${ram.photo 
              ? `<img src="${ram.photo}" class="ram-photo" alt="${ram.tagId}" />`
              : `<div class="no-photo"></div>`
            }
          </td>
          <td><strong>${ram.tagId}</strong></td>
          <td>${ram.birthDate ? format(new Date(ram.birthDate), "dd/MM/yyyy") : '-'}</td>
          <td>${ram.stats.totalLambs || 0}</td>
          <td>${ram.stats.avgBirthWeight || '-'}</td>
          <td>${ram.stats.avgWeight100Day || '-'}</td>
          <td>${ram.stats.avgWeight270Day || '-'}</td>
          <td>${ram.stats.twinCount || 0}</td>
          <td>${ram.stats.avgWeanWeight || '-'}</td>
          <td><span class="status status-${ram.status}">${ram.status}</span></td>
        </tr>`;
      }).join('');
      
      pagesHtml += `
        <div class="page">
          <div class="header">
            <div class="header-left">
              ${fb?.logoUrl ? `<img src="${fb.logoUrl}" style="width:60px;height:60px;object-fit:contain;" />` : ''}
            </div>
            <div class="header-center">
              <h1>${fb?.studName || fb?.farmName || "Rams Register"}</h1>
              <p class="subtitle">Breeding Ram Performance Report</p>
            </div>
            <div class="header-right">
              <p>Page ${page + 1} of ${Math.max(1, totalPages)}</p>
              <p>${exportDate}</p>
            </div>
          </div>
          
          <table class="rams-table">
            <thead>
              <tr>
                <th class="photo-header">Photo</th>
                <th>Ram ID</th>
                <th>DOB</th>
                <th>Total Lambs</th>
                <th>Avg Birth (kg)</th>
                <th>Avg 100-Day (kg)</th>
                <th>Avg 270-Day (kg)</th>
                <th>Twin Count</th>
                <th>Avg Wean (kg)</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>${tableRows}</tbody>
          </table>
          
          <div class="footer">
            <div class="footer-info">
              <p class="footer-title">${fb?.studName || fb?.farmName || "BreedLog"}</p>
              <p>${fb?.ownerName || ""} ${fb?.ownerPhone ? "| " + fb.ownerPhone : ""}</p>
            </div>
            <div class="footer-branding">
              <p class="breedlog-text">BREEDLOG</p>
              <p class="tagline">Professional Livestock Management</p>
            </div>
          </div>
        </div>
      `;
    }
    
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${fb?.studName || fb?.farmName || "BreedLog"} - Rams Register</title>
  <style>
    @page { size: A4 portrait; margin: 10mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 9pt; color: #1a1a1a; background: white; }
    .page { width: 190mm; min-height: 277mm; padding: 6mm; padding-bottom: 28mm; margin: 0 auto; page-break-after: always; position: relative; }
    .page:last-child { page-break-after: avoid; }
    .header { display: flex; align-items: center; justify-content: space-between; padding: 0 2mm 4mm 2mm; border-bottom: 2px solid #FFC300; margin-bottom: 5mm; }
    .header-left { width: 60px; flex-shrink: 0; }
    .header-center { flex: 1; text-align: center; }
    .header-center h1 { font-size: 14pt; font-weight: 800; color: #1a1a1a; text-transform: uppercase; letter-spacing: 1px; }
    .header-center .subtitle { font-size: 8pt; color: #666; margin-top: 3px; }
    .header-right { text-align: right; font-size: 8pt; color: #666; flex-shrink: 0; }
    .rams-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    .rams-table th { background: #FFC300; color: #000; font-weight: 700; font-size: 7pt; padding: 8px 6px; text-align: left; text-transform: uppercase; vertical-align: middle; }
    .rams-table td { padding: 8px 6px; border-bottom: 1px solid #e0e0e0; font-size: 8pt; vertical-align: middle; text-align: left; }
    .rams-table tbody tr { height: auto; }
    .rams-table tr:nth-child(even) { background: #fafafa; }
    .photo-header { width: 50px; }
    .photo-cell { width: 50px; padding: 4px !important; }
    .ram-photo { width: 42px; height: 42px; object-fit: cover; border-radius: 4px; border: 1px solid #ddd; }
    .no-photo { width: 42px; height: 42px; background: #f0f0f0; border-radius: 4px; border: 1px solid #ddd; }
    .status { display: inline-block; padding: 2px 6px; border-radius: 3px; font-size: 6pt; font-weight: 600; text-transform: uppercase; }
    .status-active { background: #22c55e20; color: #16a34a; }
    .status-sold { background: #f59e0b20; color: #d97706; }
    .status-deceased, .status-dead { background: #ef444420; color: #dc2626; }
    .footer { display: flex; align-items: center; justify-content: space-between; border-top: 2px solid #FFC300; background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%); color: white; padding: 4mm 5mm; border-radius: 2mm; position: absolute; bottom: 6mm; left: 6mm; right: 6mm; }
    .footer-info { flex: 1; }
    .footer-title { font-size: 9pt; font-weight: 700; color: #FFC300; }
    .footer-info p { font-size: 7pt; margin-top: 2px; }
    .footer-branding { text-align: right; display: flex; flex-direction: column; align-items: flex-end; }
    .footer-branding .breedlog-text { font-size: 11pt; font-weight: 800; color: white; letter-spacing: 1px; margin: 0; }
    .footer-branding .tagline { font-size: 7pt; font-style: italic; color: #FFC300; margin-top: 2px; }
    @media print { 
      .page { page-break-after: always; } 
      .page:last-child { page-break-after: avoid; }
      thead { display: table-header-group; }
    }
  </style>
</head>
<body>
  ${pagesHtml}
</body>
</html>
    `;
    
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 500);
    }
    toast({ title: "PDF Ready", description: "Rams Register export opened for printing" });
  };

  // Update filters when URL changes
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    setStatusFilter(params.get("status") || "active");
    setSexFilter(params.get("sex") || "all");
    setAgeFilter(params.get("age") || "all");
  }, [searchParams]);

  const filteredAnimals = allAnimals?.filter(animal => {
    if (statusFilter === "all") {
    } else if (statusFilter === "active") {
      if (animal.status !== "active") return false;
    } else if (statusFilter === "archived") {
      if (!["sold", "dead", "culled"].includes(animal.status || "")) return false;
    } else {
      if (animal.status !== statusFilter) return false;
    }
    if (sexFilter !== "all" && animal.sex?.toLowerCase() !== sexFilter) return false;
    
    // Age filter for lambs (under 1 year old)
    if (ageFilter === "lamb" && animal.birthDate) {
      const birthDate = new Date(animal.birthDate);
      const ageInDays = (Date.now() - birthDate.getTime()) / (1000 * 60 * 60 * 24);
      if (ageInDays > 365) return false;
    }
    return true;
  });

  return (
    <Layout>
      <div className="space-y-2.5 md:space-y-6 animate-in fade-in duration-500">
        <div className="flex flex-row justify-between items-center gap-2">
          <h1 className="text-base md:text-3xl font-bold tracking-tight" data-testid="page-title">
            {displayName ? `${displayName} - My Herd` : "My Herd"}
          </h1>
          <div className="flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="outline" 
                  disabled={!allAnimals || allAnimals.length === 0}
                  data-testid="button-export-herd"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem 
                  onClick={exportFullHerdPDF}
                  data-testid="export-full-herd"
                >
                  Export Full Herd (PDF)
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => exportHerdPDF("rams")}
                  data-testid="export-rams"
                >
                  Export Rams Only (PDF)
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => exportHerdPDF("ewes")}
                  data-testid="export-ewes"
                >
                  Export Ewes Only (PDF)
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => exportHerdPDF("lambs")}
                  data-testid="export-lambs"
                >
                  Export Lambs Only (PDF)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <CreateAnimalDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} />
          </div>
        </div>

        {/* Filters - Compact on mobile */}
        <div className="flex flex-col md:flex-row gap-2 bg-card p-2.5 md:p-4 rounded-md border border-border shadow-sm">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search Tag ID..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 text-sm rugged-input"
              data-testid="input-search"
            />
          </div>
          <div className="flex gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="flex-1 md:w-[120px] text-sm rugged-input" data-testid="select-status-filter">
                <Filter className="w-4 h-4 mr-1" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
                <SelectItem value="sold">Sold</SelectItem>
                <SelectItem value="dead">Dead</SelectItem>
                <SelectItem value="culled">Culled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sexFilter} onValueChange={setSexFilter}>
              <SelectTrigger className="flex-1 md:w-[120px] text-sm rugged-input" data-testid="select-sex-filter">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="ewe">Ewes</SelectItem>
                <SelectItem value="ram">Rams</SelectItem>
                <SelectItem value="wether">Wethers</SelectItem>
              </SelectContent>
            </Select>
            {/* View Mode Toggle */}
            <div className="flex gap-1 border border-border rounded-md p-0.5">
              <Button
                size="icon"
                variant={viewMode === "detailed" ? "default" : "ghost"}
                className="h-8 w-8"
                onClick={() => setViewMode("detailed")}
                data-testid="button-view-detailed"
                title="Detailed View"
              >
                <LayoutGrid className="w-4 h-4" />
              </Button>
              <Button
                size="icon"
                variant={viewMode === "list" ? "default" : "ghost"}
                className="h-8 w-8"
                onClick={() => setViewMode("list")}
                data-testid="button-view-list"
                title="List View (No Photos)"
              >
                <List className="w-4 h-4" />
              </Button>
              <Button
                size="icon"
                variant={viewMode === "thumbnail" ? "default" : "ghost"}
                className="h-8 w-8"
                onClick={() => setViewMode("thumbnail")}
                data-testid="button-view-thumbnail"
                title="Thumbnail Grid"
              >
                <Grid3X3 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* List/Grid View */}
        {isLoading ? (
          <div className="space-y-1.5 md:grid md:grid-cols-2 lg:grid-cols-4 md:gap-4 md:space-y-0">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <Skeleton key={i} className="h-14 md:aspect-[4/3] rounded-md bg-secondary" />
            ))}
          </div>
        ) : viewMode === "thumbnail" ? (
          /* Thumbnail Grid View */
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
            {filteredAnimals?.map(animal => (
              <Link key={animal.id} href={`/animals/${animal.id}`}>
                <div 
                  className="aspect-square rounded-md bg-secondary overflow-hidden border-2 border-transparent hover:border-primary transition-all cursor-pointer"
                  data-testid={`thumbnail-${animal.id}`}
                >
                  {animal.photo ? (
                    <img src={animal.photo} alt={animal.tagId} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-secondary">
                      <img src={logo} className="w-8 h-8 grayscale opacity-30" />
                    </div>
                  )}
                </div>
                <p className="text-[10px] text-center mt-1 truncate text-muted-foreground">{animal.tagId}</p>
              </Link>
            ))}
            {filteredAnimals?.length === 0 && (
              <div className="col-span-full py-12 text-center text-muted-foreground">
                <p>No animals found matching your criteria.</p>
              </div>
            )}
          </div>
        ) : viewMode === "list" ? (
          /* List View (No Photos) */
          <div className="border border-border rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-primary text-primary-foreground">
                <tr>
                  <th className="text-left p-2.5 font-semibold">Tag ID</th>
                  <th className="text-left p-2.5 font-semibold hidden sm:table-cell">Name</th>
                  <th className="text-left p-2.5 font-semibold">Sex</th>
                  <th className="text-left p-2.5 font-semibold hidden md:table-cell">Breed</th>
                  <th className="text-left p-2.5 font-semibold hidden lg:table-cell">DOB</th>
                  <th className="text-left p-2.5 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredAnimals?.map((animal, idx) => (
                  <ListRow key={animal.id} animal={animal} idx={idx} />
                ))}
              </tbody>
            </table>
            {filteredAnimals?.length === 0 && (
              <div className="py-12 text-center text-muted-foreground">
                <p>No animals found matching your criteria.</p>
              </div>
            )}
          </div>
        ) : isMobile ? (
          <div className="space-y-1.5">
            {filteredAnimals?.map(animal => (
              <AnimalListRow key={animal.id} animal={animal} />
            ))}
            {filteredAnimals?.length === 0 && (
              <div className="py-8 text-center text-muted-foreground text-xs">
                <p>No animals found.</p>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {filteredAnimals?.map(animal => (
              <AnimalCard key={animal.id} animal={animal} />
            ))}
            {filteredAnimals?.length === 0 && (
              <div className="col-span-full py-12 text-center text-muted-foreground">
                <p>No animals found matching your criteria.</p>
              </div>
            )}
          </div>
        )}

        {/* Dedicated RAMS Section */}
        <RamsSection 
          allAnimals={allAnimals || []} 
          breedingEvents={breedingEvents || []} 
          onExport={exportRamsPDF}
          isLoading={isLoading}
        />

        {/* Encouraging message */}
        <div className="text-center py-6 px-4 border-t border-border/30 mt-4">
          <p className="text-sm text-muted-foreground italic max-w-md mx-auto">
            Your flock is your legacy. Track every animal to unlock the full potential of your <span className="text-primary font-medium">genetics</span>.
          </p>
        </div>
      </div>
    </Layout>
  );
}

function RamsSection({ 
  allAnimals, 
  breedingEvents, 
  onExport,
  isLoading 
}: { 
  allAnimals: Animal[]; 
  breedingEvents: BreedingEvent[];
  onExport: () => void;
  isLoading: boolean;
}) {
  const [, setLocation] = useLocation();
  const rams = allAnimals.filter(a => a.sex?.toLowerCase() === "ram");
  
  if (isLoading) {
    return (
      <div className="mt-8 space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-40 w-full rounded-md" />
      </div>
    );
  }
  
  // Calculate stats for each ram
  const ramsWithStats = rams.map(ram => {
    const stats = calculateRamBreedingStats(ram.id, breedingEvents, allAnimals);
    return { ...ram, stats };
  });

  return (
    <div className="mt-8 space-y-4" data-testid="rams-section">
      {/* Section Header */}
      <div className="flex items-center justify-between border-b border-border pb-3">
        <h2 className="text-lg md:text-xl font-bold text-primary uppercase tracking-wide" data-testid="rams-section-title">
          Rams
        </h2>
        <Button 
          variant="outline" 
          size="sm"
          onClick={onExport}
          disabled={rams.length === 0}
          data-testid="button-export-rams-section"
        >
          <Download className="w-4 h-4 mr-2" />
          Export Rams PDF
        </Button>
      </div>

      {rams.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground border border-border rounded-md">
          <p>No rams in your herd yet.</p>
        </div>
      ) : (
        <div className="border border-border rounded-md overflow-x-auto">
          <table className="w-full text-sm min-w-[800px]">
            <thead className="bg-primary text-primary-foreground">
              <tr>
                <th className="text-left p-2.5 font-semibold w-14">Photo</th>
                <th className="text-left p-2.5 font-semibold">Ram ID</th>
                <th className="text-left p-2.5 font-semibold">DOB</th>
                <th className="text-left p-2.5 font-semibold">Total Lambs</th>
                <th className="text-left p-2.5 font-semibold">Avg Birth (kg)</th>
                <th className="text-left p-2.5 font-semibold">Avg 100-Day (kg)</th>
                <th className="text-left p-2.5 font-semibold">Avg 270-Day (kg)</th>
                <th className="text-left p-2.5 font-semibold">Twin Count</th>
                <th className="text-left p-2.5 font-semibold">Avg Wean (kg)</th>
                <th className="text-left p-2.5 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {ramsWithStats.map((ram, idx) => (
                <tr 
                  key={ram.id}
                  className={cn(
                    "hover:bg-secondary/50 cursor-pointer transition-colors",
                    idx % 2 === 0 ? "bg-card" : "bg-secondary/20"
                  )}
                  onClick={() => setLocation(`/animals/${ram.id}`)}
                  data-testid={`ram-row-${ram.id}`}
                >
                  <td className="p-2">
                    <div className="w-10 h-10 rounded-md bg-secondary overflow-hidden">
                      {ram.photo ? (
                        <img src={ram.photo} alt={ram.tagId} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center opacity-30">
                          <img src={logo} className="w-6 h-6 grayscale" />
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="p-2.5 font-semibold">{ram.tagId}</td>
                  <td className="p-2.5">
                    {ram.birthDate ? format(new Date(ram.birthDate), "dd/MM/yyyy") : "—"}
                  </td>
                  <td className="p-2.5 text-center">{ram.stats.totalLambs}</td>
                  <td className="p-2.5 text-center">{ram.stats.avgBirthWeight || "—"}</td>
                  <td className="p-2.5 text-center">{ram.stats.avgWeight100Day || "—"}</td>
                  <td className="p-2.5 text-center">{ram.stats.avgWeight270Day || "—"}</td>
                  <td className="p-2.5 text-center">{ram.stats.twinCount}</td>
                  <td className="p-2.5 text-center">{ram.stats.avgWeanWeight || "—"}</td>
                  <td className="p-2.5">
                    <Badge variant="secondary" className={cn(
                      "text-[10px] px-1.5",
                      ram.status === 'active' ? "bg-green-900/80 text-green-100" : "bg-red-900/80 text-red-100"
                    )}>
                      {ram.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ListRow({ animal, idx }: { animal: Animal; idx: number }) {
  const [, setLocation] = useLocation();
  
  return (
    <tr 
      className={cn(
        "hover:bg-secondary/50 cursor-pointer transition-colors",
        idx % 2 === 0 ? "bg-card" : "bg-secondary/20"
      )}
      onClick={() => setLocation(`/animals/${animal.id}`)}
      data-testid={`list-row-${animal.id}`}
    >
      <td className="p-2.5 font-semibold">{animal.tagId}</td>
      <td className="p-2.5 hidden sm:table-cell">{animal.name || "—"}</td>
      <td className="p-2.5">
        <span className={cn(
          "capitalize",
          animal.sex === "ram" ? "text-blue-400" : animal.sex === "ewe" ? "text-pink-400" : ""
        )}>
          {animal.sex}
        </span>
      </td>
      <td className="p-2.5 hidden md:table-cell">{animal.breed || "Meatmaster"}</td>
      <td className="p-2.5 hidden lg:table-cell">
        {animal.birthDate ? format(new Date(animal.birthDate), "dd/MM/yyyy") : "—"}
      </td>
      <td className="p-2.5">
        <Badge variant="secondary" className={cn(
          "text-[10px] px-1.5",
          animal.status === 'active' ? "bg-green-900/80 text-green-100" : "bg-red-900/80 text-red-100"
        )}>
          {animal.status}
        </Badge>
      </td>
    </tr>
  );
}

function AnimalListRow({ animal }: { animal: Animal }) {
  const { mutate: deleteAnimal, isPending } = useDeleteAnimal();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showImageDialog, setShowImageDialog] = useState(false);
  const isRam = animal.sex?.toLowerCase() === 'ram';
  const isEwe = animal.sex?.toLowerCase() === 'ewe';

  return (
    <>
      <Card className="flex items-center p-2.5 gap-2.5 hover:border-primary transition-colors cursor-pointer">
        {/* Clickable image thumbnail */}
        <div 
          className="w-12 h-12 rounded-md bg-secondary overflow-hidden flex-shrink-0 cursor-pointer ring-2 ring-transparent hover:ring-primary/50 transition-all"
          onClick={(e) => {
            e.stopPropagation();
            if (animal.photo) setShowImageDialog(true);
          }}
          data-testid={`image-${animal.id}`}
        >
          {animal.photo ? (
            <img src={animal.photo} alt={animal.tagId} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center opacity-30">
              <img src={logo} className="w-7 h-7 grayscale" />
            </div>
          )}
        </div>
        
        {/* Rest of row - links to detail page */}
        <Link href={`/animals/${animal.id}`} className="flex-1 flex items-center gap-2.5 min-w-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-sm truncate">{animal.tagId}</span>
              <Badge variant="secondary" className={cn(
                "text-[10px] px-1.5",
                animal.status === 'active' ? "bg-green-900/80 text-green-100" : "bg-red-900/80 text-red-100"
              )}>
                {animal.status}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground truncate">{animal.breed || "Meatmaster"}</p>
          </div>
          <div className="text-right flex-shrink-0">
            <span className={cn(
              "text-xs font-medium capitalize",
              isRam ? "text-blue-400" : isEwe ? "text-pink-400" : "text-muted-foreground"
            )}>
              {animal.sex}
            </span>
          </div>
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.preventDefault()}>
            <Button size="icon" variant="ghost" className="flex-shrink-0" data-testid={`button-menu-${animal.id}`}>
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem 
              className="text-destructive focus:text-destructive"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowDeleteDialog(true);
              }}
              data-testid={`button-delete-${animal.id}`}
            >
              <Trash2 className="w-4 h-4 mr-2" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </Card>
      
      {/* Image Lightbox Dialog */}
      <Dialog open={showImageDialog} onOpenChange={setShowImageDialog}>
        <DialogContent className="p-0 bg-card border-2 border-primary/50 max-w-md overflow-hidden">
          <div className="relative">
            {animal.photo && (
              <img 
                src={animal.photo} 
                alt={animal.tagId} 
                className="w-full aspect-square object-cover"
              />
            )}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background/95 via-background/70 to-transparent p-4">
              <div className="flex items-center justify-center gap-2">
                <Badge className="text-sm font-bold bg-primary text-black px-3 py-1">
                  ID: {animal.tagId}
                </Badge>
                {animal.name && (
                  <span className="text-white/80 text-sm">"{animal.name}"</span>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Animal Profile</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete <strong>{animal.tagId}</strong>
              {animal.name ? ` (${animal.name})` : ''}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteAnimal(animal.id)}
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function CreateAnimalDialog({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
  const { mutate, isPending } = useCreateAnimal();
  const { toast } = useToast();
  const { data: allAnimals } = useAnimals({});
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const evalDocInputRef = useRef<HTMLInputElement>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [evalDocPreview, setEvalDocPreview] = useState<string | null>(null);
  const [useCustomDam, setUseCustomDam] = useState(false);
  const [useCustomSire, setUseCustomSire] = useState(false);
  
  const form = useForm({
    resolver: zodResolver(insertAnimalSchema),
    defaultValues: {
      tagId: "",
      sex: "ewe",
      breed: "Meatmaster",
      status: "active",
      birthDate: new Date().toISOString().split('T')[0],
      birthStatus: "single" as string,
      birthWeight: null as string | null,
      currentWeight: "0",
      weight100Day: null as string | null,
      weight100DayDate: null as string | null,
      weaningStatus: "normal" as string,
      damId: null as number | null,
      sireId: null as number | null,
      externalDamInfo: "" as string,
      externalSireInfo: "" as string,
      photo: null as string | null,
      evaluationDocument: null as string | null,
    }
  });

  const birthStatus = form.watch("birthStatus");

  const ewes = allAnimals?.filter(a => a.sex === "ewe") || [];
  const rams = allAnimals?.filter(a => a.sex === "ram") || [];

  const compressImage = (file: File, maxWidth: number = 1200, quality: number = 0.8): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = document.createElement('img') as HTMLImageElement;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let { width, height } = img;
          
          // Scale down if larger than maxWidth
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
          
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Could not get canvas context'));
            return;
          }
          
          ctx.drawImage(img, 0, 0, width, height);
          const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
          resolve(compressedBase64);
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 20 * 1024 * 1024) {
        toast({ title: "Photo too large", description: "Please use a photo under 20MB", variant: "destructive" });
        return;
      }
      
      try {
        toast({ title: "Processing photo...", description: "Compressing image for upload" });
        const compressedBase64 = await compressImage(file, 1200, 0.8);
        setPhotoPreview(compressedBase64);
        form.setValue("photo", compressedBase64);
        toast({ title: "Photo ready", description: "Image compressed successfully" });
      } catch (error) {
        toast({ title: "Photo error", description: "Failed to process image", variant: "destructive" });
      }
    }
  };

  const handleEvalDocUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast({ title: "File too large", description: "Please use a file under 10MB", variant: "destructive" });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setEvalDocPreview(file.name);
        form.setValue("evaluationDocument", base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearPhoto = () => {
    setPhotoPreview(null);
    form.setValue("photo", null);
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    if (galleryInputRef.current) galleryInputRef.current.value = "";
  };

  const clearEvalDoc = () => {
    setEvalDocPreview(null);
    form.setValue("evaluationDocument", null);
    if (evalDocInputRef.current) evalDocInputRef.current.value = "";
  };

  const onSubmit = (data: any) => {
    mutate(data, {
      onSuccess: () => {
        onOpenChange(false);
        resetForm();
        toast({ title: "Animal added", description: "New animal record created successfully" });
      }
    });
  };

  const resetForm = () => {
    form.reset();
    setPhotoPreview(null);
    setEvalDocPreview(null);
    setUseCustomDam(false);
    setUseCustomSire(false);
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      resetForm();
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button data-testid="button-add-animal" className="rugged-btn bg-primary text-black hover:bg-primary/90">
          <Plus className="w-5 h-5 mr-2" /> Add Animal
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display uppercase text-2xl">New Animal Entry</DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="tagId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tag ID</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. 24-001" className="rugged-input" data-testid="input-tag-id" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="sex"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sex</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="rugged-input" data-testid="select-sex">
                          <SelectValue placeholder="Select sex" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="ram">Ram</SelectItem>
                        <SelectItem value="ewe">Ewe</SelectItem>
                        <SelectItem value="wether">Wether</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="breed"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Breed</FormLabel>
                  <FormControl>
                    <Input className="rugged-input" data-testid="input-breed" {...field} value={field.value || ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="birthDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Birth Date *</FormLabel>
                    <FormControl>
                      <Input type="date" className="rugged-input" data-testid="input-birth-date" {...field} value={field.value ? String(field.value) : ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="birthStatus"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Birth Status</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value || "single"}>
                      <FormControl>
                        <SelectTrigger className="rugged-input" data-testid="select-birth-status">
                          <SelectValue placeholder="Select birth status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="single">Single</SelectItem>
                        <SelectItem value="twin">Twin</SelectItem>
                        <SelectItem value="triplet">Triplet</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="currentWeight"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current Weight (kg)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.1" className="rugged-input" data-testid="input-weight" {...field} value={field.value ? String(field.value) : ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="birthWeight"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Birth Weight (kg)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.1" placeholder="Optional" className="rugged-input" data-testid="input-birth-weight" {...field} value={field.value ? String(field.value) : ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* 100-Day Weight Section */}
            <div className="p-3 bg-secondary/30 rounded-md border border-border/50 space-y-3">
              <p className="text-xs font-bold uppercase text-muted-foreground">100-Day Weaning Data</p>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="weight100DayDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>100-Day Weigh Date</FormLabel>
                      <FormControl>
                        <Input type="date" className="rugged-input" data-testid="input-100day-date" {...field} value={field.value ? String(field.value) : ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="weight100Day"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>100-Day Weight (kg)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.1" className="rugged-input" data-testid="input-100day-weight" {...field} value={field.value ? String(field.value) : ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="weaningStatus"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Weaning Status</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      defaultValue={field.value || "normal"}
                      disabled={birthStatus !== "twin" && birthStatus !== "triplet"}
                    >
                      <FormControl>
                        <SelectTrigger className="rugged-input" data-testid="select-weaning-status">
                          <SelectValue placeholder="Select weaning status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="sibling_died_before_weaning">Sibling died before weaning</SelectItem>
                      </SelectContent>
                    </Select>
                    {(birthStatus !== "twin" && birthStatus !== "triplet") && (
                      <p className="text-[10px] text-muted-foreground">Only applicable for twin/triplet births</p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Dam Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <FormLabel>Dam (Mother)</FormLabel>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm"
                  onClick={() => {
                    setUseCustomDam(!useCustomDam);
                    if (!useCustomDam) form.setValue("damId", null);
                    else form.setValue("externalDamInfo", "");
                  }}
                  data-testid="button-toggle-dam-mode"
                >
                  {useCustomDam ? "Select from list" : "Not in system"}
                </Button>
              </div>
              {useCustomDam ? (
                <FormField
                  control={form.control}
                  name="externalDamInfo"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input 
                          placeholder="Enter dam info (Tag ID, name, breeder)" 
                          className="rugged-input" 
                          data-testid="input-external-dam"
                          {...field} 
                          value={field.value || ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : (
                <FormField
                  control={form.control}
                  name="damId"
                  render={({ field }) => (
                    <FormItem>
                      <Select 
                        onValueChange={(val) => field.onChange(val === "none" ? null : parseInt(val))} 
                        value={field.value ? String(field.value) : "none"}
                      >
                        <FormControl>
                          <SelectTrigger className="rugged-input" data-testid="select-dam">
                            <SelectValue placeholder="Select dam" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">Unknown</SelectItem>
                          {ewes.map(ewe => (
                            <SelectItem key={ewe.id} value={String(ewe.id)}>
                              {ewe.tagId} {ewe.name ? `- ${ewe.name}` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            {/* Sire Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <FormLabel>Sire (Father)</FormLabel>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm"
                  onClick={() => {
                    setUseCustomSire(!useCustomSire);
                    if (!useCustomSire) form.setValue("sireId", null);
                    else form.setValue("externalSireInfo", "");
                  }}
                  data-testid="button-toggle-sire-mode"
                >
                  {useCustomSire ? "Select from list" : "Not in system"}
                </Button>
              </div>
              {useCustomSire ? (
                <FormField
                  control={form.control}
                  name="externalSireInfo"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input 
                          placeholder="Enter sire info (Tag ID, name, breeder)" 
                          className="rugged-input" 
                          data-testid="input-external-sire"
                          {...field} 
                          value={field.value || ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : (
                <FormField
                  control={form.control}
                  name="sireId"
                  render={({ field }) => (
                    <FormItem>
                      <Select 
                        onValueChange={(val) => field.onChange(val === "none" ? null : parseInt(val))} 
                        value={field.value ? String(field.value) : "none"}
                      >
                        <FormControl>
                          <SelectTrigger className="rugged-input" data-testid="select-sire">
                            <SelectValue placeholder="Select sire" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">Unknown</SelectItem>
                          {rams.map(ram => (
                            <SelectItem key={ram.id} value={String(ram.id)}>
                              {ram.tagId} {ram.name ? `- ${ram.name}` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>
            
            {/* Photo Section - Camera & Gallery */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhotoCapture}
              className="hidden"
              data-testid="input-photo-camera"
            />
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoCapture}
              className="hidden"
              data-testid="input-photo-gallery"
            />
            
            {photoPreview ? (
              <div className="relative">
                <img 
                  src={photoPreview} 
                  alt="Preview" 
                  className="w-full h-48 object-cover rounded-md border border-border"
                  data-testid="img-photo-preview"
                />
                <Button 
                  type="button" 
                  variant="destructive" 
                  size="icon"
                  className="absolute top-2 right-2"
                  onClick={clearPhoto}
                  data-testid="button-clear-photo"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  data-testid="button-take-photo" 
                  className="rugged-btn border-dashed"
                  onClick={() => cameraInputRef.current?.click()}
                >
                  <Camera className="w-4 h-4 mr-2" /> Camera
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  data-testid="button-select-gallery" 
                  className="rugged-btn border-dashed"
                  onClick={() => galleryInputRef.current?.click()}
                >
                  <Image className="w-4 h-4 mr-2" /> Gallery
                </Button>
              </div>
            )}

            {/* Evaluation Document Upload */}
            <input
              ref={evalDocInputRef}
              type="file"
              accept="image/*,.pdf"
              onChange={handleEvalDocUpload}
              className="hidden"
              data-testid="input-eval-doc"
            />
            
            {evalDocPreview ? (
              <div className="flex items-center justify-between p-3 bg-secondary rounded-md border border-border">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  <span className="text-sm truncate max-w-[200px]">{evalDocPreview}</span>
                </div>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="icon"
                  onClick={clearEvalDoc}
                  data-testid="button-clear-eval-doc"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <Button 
                type="button" 
                variant="outline" 
                data-testid="button-upload-eval-doc" 
                className="w-full rugged-btn border-dashed"
                onClick={() => evalDocInputRef.current?.click()}
              >
                <FileText className="w-4 h-4 mr-2" /> Attach Evaluation Document
              </Button>
            )}

            <Button type="submit" disabled={isPending} data-testid="button-save-animal" className="w-full rugged-btn bg-primary text-black">
              {isPending ? "Creating..." : "Save Record"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
