import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/use-auth";
import { useFarmSettings, useSaveFarmSettings } from "@/hooks/use-farm-settings";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LogOut, User, Download, Upload, Building2, Save, Loader2, Image, X, FileText, FileJson, FileSpreadsheet, Folder, Trash2, AlertCircle, CheckCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertFarmSettingsSchema, type InsertFarmSettings } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useEffect, useState, useRef } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAnimals } from "@/hooks/use-animals";
import { useBreedingEvents } from "@/hooks/use-breeding";
import { useMatingGroups } from "@/hooks/use-mating-groups";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function Settings() {
  const { user, logout } = useAuth();
  const { data: farmSettings, isLoading } = useFarmSettings();
  const { data: animals } = useAnimals();
  const { data: breedingEvents } = useBreedingEvents();
  const { data: matingGroups } = useMatingGroups();
  const { toast } = useToast();
  const displayName = farmSettings?.studName || farmSettings?.farmName;
  const saveMutation = useSaveFarmSettings();

  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<{ imported: number; errors: string[] } | null>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  const { data: documents, isLoading: docsLoading } = useQuery<any[]>({
    queryKey: ['/api/documents'],
  });

  const uploadDocMutation = useMutation({
    mutationFn: async (doc: { fileName: string; category: string; fileUrl: string; fileType: string; fileSize?: number }) => {
      return apiRequest('POST', '/api/documents', doc);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      toast({ title: "Document Uploaded", description: "File saved successfully" });
    },
    onError: () => {
      toast({ title: "Upload Failed", description: "Could not save document", variant: "destructive" });
    }
  });

  const deleteDocMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/documents/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      toast({ title: "Document Deleted" });
    }
  });

  const importCsvMutation = useMutation({
    mutationFn: async (csvData: string) => {
      const res = await apiRequest('POST', '/api/import/csv', { csvData });
      return res.json();
    },
    onSuccess: (data) => {
      setImportResult(data);
      queryClient.invalidateQueries({ queryKey: ['/api/animals'] });
      if (data.errors.length === 0) {
        toast({ title: "Import Complete", description: `${data.imported} animals imported successfully` });
      } else {
        toast({ title: "Import Completed with Warnings", description: `${data.imported} imported, ${data.errors.length} errors`, variant: "destructive" });
      }
    },
    onError: (err: any) => {
      toast({ title: "Import Failed", description: err.message || "Could not import CSV", variant: "destructive" });
    }
  });

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCsvFile(file);
      setImportResult(null);
    }
  };

  const processCsvImport = () => {
    if (!csvFile) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const csvData = e.target?.result as string;
      importCsvMutation.mutate(csvData);
    };
    reader.readAsText(csvFile);
  };

  const handleDocUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        uploadDocMutation.mutate({
          fileName: file.name,
          category: 'general',
          fileUrl: reader.result as string,
          fileType: file.type,
          fileSize: file.size
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const form = useForm<InsertFarmSettings>({
    resolver: zodResolver(insertFarmSettingsSchema),
    defaultValues: {
      farmName: "",
      studName: "",
      studPrefix: "",
      ownerName: "",
      ownerEmail: "",
      ownerPhone: "",
      farmAddress: "",
      farmLocation: "",
      membershipNumber: "",
      registrationNumber: "",
      logoUrl: "",
      logoSize: "medium",
      logoWidth: null,
      logoHeight: null,
    },
  });

  useEffect(() => {
    if (farmSettings) {
      form.reset({
        farmName: farmSettings.farmName || "",
        studName: farmSettings.studName || "",
        studPrefix: farmSettings.studPrefix || "",
        ownerName: farmSettings.ownerName || "",
        ownerEmail: farmSettings.ownerEmail || "",
        ownerPhone: farmSettings.ownerPhone || "",
        farmAddress: farmSettings.farmAddress || "",
        farmLocation: farmSettings.farmLocation || "",
        membershipNumber: farmSettings.membershipNumber || "",
        registrationNumber: farmSettings.registrationNumber || "",
        logoUrl: farmSettings.logoUrl || "",
        logoSize: farmSettings.logoSize || "medium",
        logoWidth: farmSettings.logoWidth,
        logoHeight: farmSettings.logoHeight,
      });
      if (farmSettings.logoUrl) {
        setLogoPreview(farmSettings.logoUrl);
      }
    }
  }, [farmSettings, form]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        toast({ title: "Optimising logo...", description: "Please wait" });
        const { compressImageWithFeedback, formatFileSize } = await import("@/lib/image-compression");
        const result = await compressImageWithFeedback(file, { maxWidth: 300, maxHeight: 300, quality: 0.8 });
        setLogoPreview(result.base64);
        form.setValue("logoUrl", result.base64);
        const reduction = Math.round((1 - result.compressedSize / result.originalSize) * 100);
        toast({ 
          title: "Logo ready", 
          description: `Optimised to ${formatFileSize(result.compressedSize)} (${reduction}% smaller)` 
        });
      } catch (error) {
        console.error("Logo compression failed:", error);
        toast({ title: "Error", description: "Failed to process logo image", variant: "destructive" });
      }
    }
  };

  const removeLogo = () => {
    setLogoPreview(null);
    form.setValue("logoUrl", "");
    if (logoInputRef.current) {
      logoInputRef.current.value = "";
    }
  };

  const logoSize = form.watch("logoSize");
  
  const getLogoSizePixels = (size: string) => {
    switch (size) {
      case "small": return { width: 80, height: 80 };
      case "medium": return { width: 120, height: 120 };
      case "large": return { width: 180, height: 180 };
      case "custom": return { 
        width: form.watch("logoWidth") || 120, 
        height: form.watch("logoHeight") || 120 
      };
      default: return { width: 120, height: 120 };
    }
  };

  const onSubmit = (data: InsertFarmSettings) => {
    saveMutation.mutate(data);
  };

  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getExportData = () => {
    return {
      exportDate: format(new Date(), "dd/MM/yyyy HH:mm"),
      farmBranding: farmSettings ? {
        farmName: farmSettings.farmName,
        studName: farmSettings.studName,
        studPrefix: farmSettings.studPrefix,
        ownerName: farmSettings.ownerName,
        ownerPhone: farmSettings.ownerPhone,
        ownerEmail: farmSettings.ownerEmail,
        farmLocation: farmSettings.farmLocation,
        membershipNumber: farmSettings.membershipNumber,
        registrationNumber: farmSettings.registrationNumber,
        logoUrl: farmSettings.logoUrl,
        logoSize: (farmSettings as any).logoSize || "medium",
        logoWidth: (farmSettings as any).logoWidth,
        logoHeight: (farmSettings as any).logoHeight
      } : null,
      animals: animals || [],
      breedingEvents: breedingEvents || [],
      matingGroups: matingGroups || []
    };
  };

  const exportJSON = () => {
    const data = getExportData();
    downloadFile(JSON.stringify(data, null, 2), `breedlog-export-${format(new Date(), "yyyy-MM-dd")}.json`, "application/json");
    toast({ title: "Export Complete", description: "Full database exported as JSON" });
  };

  const exportCSV = () => {
    const data = getExportData();
    const farmHeader = data.farmBranding ? [
      `"Farm/Stud","${data.farmBranding.studName || data.farmBranding.farmName || ''}"`,
      `"Owner","${data.farmBranding.ownerName || ''}"`,
      `"Phone","${data.farmBranding.ownerPhone || ''}"`,
      `"Email","${data.farmBranding.ownerEmail || ''}"`,
      `"Export Date","${data.exportDate}"`,
      "",
    ].join("\n") : "";
    
    const animalHeaders = ["Tag ID", "Name", "Sex", "Breed", "Status", "Birth Date", "Dam", "Sire", "Birth Weight", "Current Weight"];
    const animalRows = data.animals.map((a: any) => [
      a.tagId, a.name || "", a.sex, a.breed, a.status, a.birthDate || "",
      a.damId || "", a.sireId || "", a.birthWeight || "", a.currentWeight || ""
    ].map(v => `"${v}"`).join(","));
    
    const content = farmHeader + "ANIMALS\n" + animalHeaders.join(",") + "\n" + animalRows.join("\n");
    downloadFile(content, `breedlog-export-${format(new Date(), "yyyy-MM-dd")}.csv`, "text/csv");
    toast({ title: "Export Complete", description: "Full database exported as CSV" });
  };

  const exportWord = () => {
    const data = getExportData();
    const fb = data.farmBranding;
    const animalsPerPage = 20;
    const totalPages = Math.ceil(data.animals.length / animalsPerPage);
    
    let tablesHtml = "";
    for (let page = 0; page < Math.max(1, totalPages); page++) {
      const startIdx = page * animalsPerPage;
      const pageAnimals = data.animals.slice(startIdx, startIdx + animalsPerPage);
      
      tablesHtml += `
        <div style="page-break-after: always;">
          <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
            <tr style="background:#FFC300;height:30pt;">
              <th style="border:1px solid #333;padding:3mm;font-weight:bold;width:8%;">#</th>
              <th style="border:1px solid #333;padding:3mm;font-weight:bold;width:15%;">Tag ID</th>
              <th style="border:1px solid #333;padding:3mm;font-weight:bold;width:17%;">Name</th>
              <th style="border:1px solid #333;padding:3mm;font-weight:bold;width:8%;">Sex</th>
              <th style="border:1px solid #333;padding:3mm;font-weight:bold;width:12%;">Breed</th>
              <th style="border:1px solid #333;padding:3mm;font-weight:bold;width:10%;">Status</th>
              <th style="border:1px solid #333;padding:3mm;font-weight:bold;width:15%;">Birth Date</th>
              <th style="border:1px solid #333;padding:3mm;font-weight:bold;width:15%;">Weight</th>
            </tr>
            ${pageAnimals.map((a: any, i: number) => `
              <tr style="height:30pt;${i % 2 === 1 ? 'background:#f5f5f5;' : ''}">
                <td style="border:1px solid #ddd;padding:2mm;">${startIdx + i + 1}</td>
                <td style="border:1px solid #ddd;padding:2mm;font-weight:bold;">${a.tagId}</td>
                <td style="border:1px solid #ddd;padding:2mm;">${a.name || "-"}</td>
                <td style="border:1px solid #ddd;padding:2mm;">${a.sex === "male" ? "M" : a.sex === "female" ? "F" : a.sex}</td>
                <td style="border:1px solid #ddd;padding:2mm;">${a.breed || "-"}</td>
                <td style="border:1px solid #ddd;padding:2mm;">${a.status}</td>
                <td style="border:1px solid #ddd;padding:2mm;">${a.birthDate || "-"}</td>
                <td style="border:1px solid #ddd;padding:2mm;">${a.currentWeight ? a.currentWeight + " kg" : "-"}</td>
              </tr>
            `).join("")}
          </table>
          <p style="text-align:right;font-size:10pt;color:#666;">Page ${page + 1} of ${Math.max(1, totalPages)}</p>
        </div>
      `;
    }
    
    const content = `
<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head>
  <meta charset="UTF-8">
  <style>
    @page { size: A4; margin: 15mm; }
    body { font-family: 'Calibri', Arial, sans-serif; font-size: 11pt; }
    h1 { font-size: 18pt; text-align: center; border-bottom: 2px solid #FFC300; padding-bottom: 10px; }
    .header-info { margin-bottom: 20px; }
    .header-info p { margin: 2mm 0; }
  </style>
</head>
<body>
  <h1>${fb?.studName || fb?.farmName || "BREEDLOG"} - Herd Export</h1>
  <div class="header-info">
    <p><strong>Farm:</strong> ${fb?.farmName || "N/A"} | <strong>Stud:</strong> ${fb?.studName || "N/A"}</p>
    <p><strong>Owner:</strong> ${fb?.ownerName || "N/A"} | <strong>Phone:</strong> ${fb?.ownerPhone || "N/A"} | <strong>Email:</strong> ${fb?.ownerEmail || "N/A"}</p>
    <p><strong>Membership:</strong> ${fb?.membershipNumber || "N/A"} | <strong>Export Date:</strong> ${data.exportDate}</p>
    <p><strong>Total Animals:</strong> ${data.animals.length}</p>
  </div>
  ${tablesHtml}
  <div style="border-top:2px solid #FFC300;padding:10px 15px;margin-top:20px;background:linear-gradient(135deg,#1a1a1a,#2d2d2d);border-radius:4px;display:flex;align-items:center;">
    <div style="flex:1;">
      <p style="font-weight:bold;color:#FFC300;margin:0;">${fb?.studName || fb?.farmName || "BreedLog"}</p>
      <p style="font-size:9pt;color:white;margin:2px 0 0 0;">${fb?.ownerName || ""} ${fb?.ownerPhone ? "| " + fb.ownerPhone : ""} ${fb?.ownerEmail ? "| " + fb.ownerEmail : ""}</p>
      ${fb?.membershipNumber ? `<p style="font-size:9pt;color:white;margin:2px 0 0 0;">Membership: ${fb.membershipNumber}</p>` : ""}
    </div>
    <div style="text-align:right;">
      <p style="font-size:12pt;font-weight:bold;color:white;margin:0;">BREEDLOG</p>
      <p style="font-size:8pt;font-style:italic;color:#FFC300;margin:2px 0 0 0;">Professional Livestock Management</p>
    </div>
  </div>
</body>
</html>
    `;
    downloadFile(content, `breedlog-export-${format(new Date(), "yyyy-MM-dd")}.doc`, "application/msword");
    toast({ title: "Export Complete", description: "Full database exported as Word document" });
  };

  const exportPDF = () => {
    const data = getExportData();
    const fb = data.farmBranding;
    const logoSize = getLogoSizePixels(fb?.logoSize || "medium");
    
    const animalsPerPage = 18;
    const totalPages = Math.ceil(data.animals.length / animalsPerPage);
    
    let pagesHtml = "";
    for (let page = 0; page < Math.max(1, totalPages); page++) {
      const startIdx = page * animalsPerPage;
      const pageAnimals = data.animals.slice(startIdx, startIdx + animalsPerPage);
      
      pagesHtml += `
        <div class="page">
          <div class="header">
            <div class="header-left">
              ${fb?.logoUrl ? `<img src="${fb.logoUrl}" style="width:${logoSize.width}px;height:${logoSize.height}px;object-fit:contain;" />` : ""}
            </div>
            <div class="header-center">
              <h1>${fb?.studName || fb?.farmName || "BREEDLOG"}</h1>
              <p class="subtitle">Livestock Database Export</p>
            </div>
            <div class="header-right">
              <p>Page ${page + 1} of ${Math.max(1, totalPages)}</p>
              <p>${data.exportDate}</p>
            </div>
          </div>
          
          <table class="animals-table">
            <thead>
              <tr>
                <th style="width:32px"></th>
                <th style="width:14%">Tag ID</th>
                <th style="width:16%">Name</th>
                <th style="width:8%">Sex</th>
                <th style="width:12%">Breed</th>
                <th style="width:10%">Status</th>
                <th style="width:14%">Birth Date</th>
                <th style="width:12%">Weight</th>
              </tr>
            </thead>
            <tbody>
              ${pageAnimals.map((a: any, i: number) => `
                <tr>
                  <td style="width:32px;"><div style="width:28px;height:28px;border-radius:3px;overflow:hidden;background:#f0f0f0;">${a.photo ? `<img src="${a.photo}" style="width:100%;height:100%;object-fit:cover;"/>` : ''}</div></td>
                  <td><strong>${a.tagId}</strong></td>
                  <td>${a.name || "-"}</td>
                  <td>${a.sex === "male" ? "M" : a.sex === "female" ? "F" : a.sex}</td>
                  <td>${a.breed || "-"}</td>
                  <td><span class="status status-${a.status}">${a.status}</span></td>
                  <td>${a.birthDate || "-"}</td>
                  <td>${a.currentWeight ? a.currentWeight + " kg" : "-"}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
          
          <div class="footer">
            <div class="footer-logo">
              ${fb?.logoUrl ? `<img src="${fb.logoUrl}" style="width:40px;height:40px;object-fit:contain;" />` : ""}
            </div>
            <div class="footer-info">
              <p class="footer-title">${fb?.studName || fb?.farmName || "BreedLog"}</p>
              <p>${fb?.ownerName || ""} ${fb?.ownerPhone ? "| " + fb.ownerPhone : ""} ${fb?.ownerEmail ? "| " + fb.ownerEmail : ""}</p>
              ${fb?.membershipNumber ? `<p>Membership: ${fb.membershipNumber}</p>` : ""}
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
  <title>${fb?.studName || fb?.farmName || "BreedLog"} - Herd Export</title>
  <style>
    @page { size: A4 portrait; margin: 10mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 9pt; color: #1a1a1a; background: white; }
    .page { width: 190mm; min-height: 277mm; padding: 5mm; padding-bottom: 30mm; margin: 0 auto; page-break-after: always; position: relative; }
    .page:last-child { page-break-after: avoid; }
    .header { display: flex; align-items: center; justify-content: space-between; padding: 0 2mm 3mm 2mm; border-bottom: 2px solid #FFC300; margin-bottom: 4mm; }
    .header-left { width: 60px; flex-shrink: 0; }
    .header-center { flex: 1; text-align: center; }
    .header-center h1 { font-size: 14pt; font-weight: 800; color: #1a1a1a; text-transform: uppercase; letter-spacing: 1px; }
    .header-center .subtitle { font-size: 8pt; color: #666; margin-top: 2px; }
    .header-right { text-align: right; font-size: 8pt; color: #666; flex-shrink: 0; }
    .animals-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    .animals-table th { background: #FFC300; color: #000; font-weight: 700; font-size: 8pt; padding: 8px 10px; text-align: left; text-transform: uppercase; vertical-align: middle; }
    .animals-table td { padding: 8px 10px; border-bottom: 1px solid #e0e0e0; font-size: 8pt; vertical-align: middle; text-align: left; }
    .animals-table tbody tr { height: 30pt; }
    .animals-table tr:nth-child(even) { background: #fafafa; }
    .status { display: inline-block; padding: 2px 6px; border-radius: 3px; font-size: 7pt; font-weight: 600; text-transform: uppercase; }
    .status-active { background: #22c55e20; color: #16a34a; }
    .status-sold { background: #f59e0b20; color: #d97706; }
    .status-deceased { background: #ef444420; color: #dc2626; }
    .footer { display: flex; align-items: center; gap: 4mm; border-top: 2px solid #FFC300; background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%); color: white; padding: 3mm 4mm; border-radius: 2mm; margin-top: 6mm; position: absolute; bottom: 5mm; left: 5mm; right: 5mm; }
    .footer-logo { width: 36px; }
    .footer-info { flex: 1; }
    .footer-title { font-size: 9pt; font-weight: 700; color: #FFC300; }
    .footer-info p { font-size: 7pt; margin-top: 1px; }
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
    toast({ title: "PDF Ready", description: "Print dialog opened for PDF export" });
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in duration-500">
        <h1 className="text-xl md:text-4xl font-black uppercase tracking-tight" data-testid="page-title">
          {displayName ? `${displayName} - Settings` : "Settings"}
        </h1>

        <Card className="rugged-card">
          <CardHeader>
            <CardTitle className="uppercase flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" /> Farm Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="farmName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Farm Name *</FormLabel>
                          <FormControl>
                            <Input {...field} className="rugged-input" placeholder="e.g. Sunny Hills Farm" data-testid="input-farm-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="studName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Stud Name</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} className="rugged-input" placeholder="e.g. Golden Fleece Stud" data-testid="input-stud-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="studPrefix"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Stud Prefix</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} className="rugged-input" placeholder="e.g. GFS" data-testid="input-stud-prefix" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="ownerName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Owner Name</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} className="rugged-input" placeholder="Your name" data-testid="input-owner-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="ownerEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} type="email" className="rugged-input" placeholder="email@example.com" data-testid="input-owner-email" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="ownerPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} className="rugged-input" placeholder="+27 82 123 4567" data-testid="input-owner-phone" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="farmAddress"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Farm Address</FormLabel>
                        <FormControl>
                          <Textarea {...field} value={field.value || ""} className="rugged-input resize-none" placeholder="Physical address" rows={2} data-testid="input-farm-address" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="farmLocation"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Location / District</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} className="rugged-input" placeholder="e.g. Graaff-Reinet, Eastern Cape" data-testid="input-farm-location" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="membershipNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Membership Number</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} className="rugged-input" placeholder="SA Stamboek / Society No." data-testid="input-membership-number" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="registrationNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Registration Number</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} className="rugged-input" placeholder="Stud registration" data-testid="input-registration-number" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full rugged-btn bg-primary text-black" 
                    disabled={saveMutation.isPending}
                    data-testid="button-save-farm-settings"
                  >
                    {saveMutation.isPending ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
                    ) : (
                      <><Save className="w-4 h-4 mr-2" /> Save Farm Details</>
                    )}
                  </Button>
                </form>
              </Form>
            )}
          </CardContent>
        </Card>

        <Card className="rugged-card">
          <CardHeader>
            <CardTitle className="uppercase flex items-center gap-2">
              <Image className="w-5 h-5 text-primary" /> Farm Logo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-sm text-muted-foreground">
              Upload your farm or stud logo to include on exported documents. This creates a professional branded footer on all your PDF, Word, and other exports.
            </p>
            
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-4 items-start">
                <div 
                  className="w-32 h-32 border-2 border-dashed border-border rounded-lg flex items-center justify-center bg-secondary/30 relative overflow-hidden"
                  style={logoPreview ? { 
                    width: getLogoSizePixels(logoSize || "medium").width, 
                    height: getLogoSizePixels(logoSize || "medium").height 
                  } : undefined}
                >
                  {logoPreview ? (
                    <>
                      <img 
                        src={logoPreview} 
                        alt="Farm logo preview" 
                        className="w-full h-full object-contain"
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="destructive"
                        className="absolute top-1 right-1 h-6 w-6"
                        onClick={removeLogo}
                        data-testid="button-remove-logo"
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </>
                  ) : (
                    <div className="text-center p-2">
                      <Image className="w-8 h-8 mx-auto text-muted-foreground mb-1" />
                      <span className="text-xs text-muted-foreground">No logo</span>
                    </div>
                  )}
                </div>
                
                <div className="flex-1 space-y-3">
                  <div>
                    <Label htmlFor="logo-upload" className="text-sm font-medium mb-2 block">Upload Logo</Label>
                    <input
                      ref={logoInputRef}
                      type="file"
                      id="logo-upload"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                      data-testid="input-logo-upload"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => logoInputRef.current?.click()}
                      className="w-full sm:w-auto"
                      data-testid="button-upload-logo"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      {logoPreview ? "Change Logo" : "Select Image"}
                    </Button>
                  </div>
                  
                  <p className="text-xs text-muted-foreground">
                    Recommended: PNG or JPG, transparent background for best results
                  </p>
                </div>
              </div>
              
              <div className="space-y-3 pt-4 border-t border-border">
                <Label className="text-sm font-medium">Logo Size in Exports</Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { value: "small", label: "Small", desc: "80×80px" },
                    { value: "medium", label: "Medium", desc: "120×120px" },
                    { value: "large", label: "Large", desc: "180×180px" },
                    { value: "custom", label: "Custom", desc: "Set size" },
                  ].map((size) => (
                    <Button
                      key={size.value}
                      type="button"
                      variant={logoSize === size.value ? "default" : "outline"}
                      className={`flex flex-col h-auto py-2 ${logoSize === size.value ? "bg-primary text-black" : ""}`}
                      onClick={() => form.setValue("logoSize", size.value)}
                      data-testid={`button-logo-size-${size.value}`}
                    >
                      <span className="font-medium text-xs">{size.label}</span>
                      <span className="text-[10px] opacity-70">{size.desc}</span>
                    </Button>
                  ))}
                </div>
                
                {logoSize === "custom" && (
                  <div className="grid grid-cols-2 gap-4 mt-3 p-3 bg-secondary/30 rounded border border-border">
                    <div>
                      <Label className="text-xs mb-1 block">Width (px)</Label>
                      <Input
                        type="number"
                        min="40"
                        max="400"
                        className="rugged-input"
                        value={form.watch("logoWidth") || ""}
                        onChange={(e) => form.setValue("logoWidth", parseInt(e.target.value) || null)}
                        placeholder="120"
                        data-testid="input-logo-width"
                      />
                    </div>
                    <div>
                      <Label className="text-xs mb-1 block">Height (px)</Label>
                      <Input
                        type="number"
                        min="40"
                        max="400"
                        className="rugged-input"
                        value={form.watch("logoHeight") || ""}
                        onChange={(e) => form.setValue("logoHeight", parseInt(e.target.value) || null)}
                        placeholder="120"
                        data-testid="input-logo-height"
                      />
                    </div>
                  </div>
                )}
              </div>
              
              <Button 
                type="button"
                onClick={form.handleSubmit(onSubmit)}
                className="w-full rugged-btn bg-primary text-black" 
                disabled={saveMutation.isPending}
                data-testid="button-save-logo-settings"
              >
                {saveMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
                ) : (
                  <><Save className="w-4 h-4 mr-2" /> Save Logo Settings</>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="rugged-card">
          <CardHeader>
            <CardTitle className="uppercase flex items-center gap-2">
              <User className="w-5 h-5 text-primary" /> Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {user ? (
              <div className="space-y-4">
                 <div className="flex items-center gap-4 p-4 bg-secondary/30 rounded border border-border">
                    <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center font-black text-2xl text-black">
                      {user.firstName?.[0] || user.email?.[0] || "U"}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">{user.firstName} {user.lastName}</h3>
                      <p className="text-muted-foreground">{user.email}</p>
                    </div>
                 </div>
                 <Button onClick={() => logout()} variant="destructive" data-testid="button-logout" className="w-full rugged-btn">
                   <LogOut className="w-4 h-4 mr-2" /> Log Out
                 </Button>
              </div>
            ) : (
              <div className="text-center py-6 space-y-4">
                 <p className="text-muted-foreground">You are currently using Guest mode.</p>
                 <Button onClick={() => window.location.href = "/api/login"} data-testid="button-settings-login" className="rugged-btn bg-primary text-black w-full">
                   Log In to Sync Data
                 </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rugged-card">
           <CardHeader>
            <CardTitle className="uppercase flex items-center gap-2">
              <Download className="w-5 h-5" /> Data Management
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
             <div className="p-4 bg-secondary rounded border border-border">
                <h4 className="font-bold text-sm uppercase mb-2">Save Settings</h4>
                <p className="text-xs text-muted-foreground mb-4">Save all your farm details, branding, and preferences.</p>
                <Button 
                    className="w-full bg-primary text-black font-bold hover:bg-primary/90"
                    onClick={form.handleSubmit(onSubmit)}
                    disabled={saveMutation.isPending}
                    data-testid="button-save-settings-data"
                >
                    {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                    Save All Settings
                </Button>
             </div>
             
             <div className="p-4 bg-secondary rounded border border-border">
                <h4 className="font-bold text-sm uppercase mb-2">Export Herd Database</h4>
                <p className="text-xs text-muted-foreground mb-4">Download your complete herd database in multiple formats. All exports include farm branding and are SA Stamboek compatible.</p>
                
                <div className="grid grid-cols-2 gap-2">
                  <Button 
                      className="bg-primary text-black font-bold hover:bg-primary/90"
                      onClick={exportPDF}
                      data-testid="button-export-pdf"
                  >
                      <FileText className="w-4 h-4 mr-2" /> PDF
                  </Button>
                  <Button 
                      variant="outline"
                      className="font-bold"
                      onClick={exportWord}
                      data-testid="button-export-word"
                  >
                      <FileText className="w-4 h-4 mr-2" /> WORD
                  </Button>
                  <Button 
                      variant="outline"
                      className="font-bold"
                      onClick={exportCSV}
                      data-testid="button-export-csv"
                  >
                      <FileSpreadsheet className="w-4 h-4 mr-2" /> CSV
                  </Button>
                  <Button 
                      variant="outline"
                      className="font-bold"
                      onClick={exportJSON}
                      data-testid="button-export-json"
                  >
                      <FileJson className="w-4 h-4 mr-2" /> JSON
                  </Button>
                </div>
                
                <p className="text-[10px] text-muted-foreground mt-3 text-center">
                  {animals?.length || 0} animals | {breedingEvents?.length || 0} breeding events | {matingGroups?.length || 0} mating groups
                </p>
             </div>
             
             <div className="p-4 bg-secondary rounded border border-border">
                <h4 className="font-bold text-sm uppercase mb-2">Import Animals from CSV</h4>
                <p className="text-xs text-muted-foreground mb-4">
                  Bulk import animals from a CSV file. Required columns: tagId, sex (ram/ewe/wether). 
                  Optional: name, breed, status, birthDate, birthWeight, currentWeight, notes, tattoo, electronicId.
                </p>
                
                <input
                  ref={csvInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleCsvUpload}
                  className="hidden"
                  data-testid="input-csv-file"
                />
                
                <div className="space-y-3">
                  <Button 
                    variant="outline"
                    className="w-full"
                    onClick={() => csvInputRef.current?.click()}
                    data-testid="button-select-csv"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {csvFile ? csvFile.name : "Select CSV File"}
                  </Button>
                  
                  {csvFile && (
                    <Button 
                      className="w-full bg-primary text-black font-bold"
                      onClick={processCsvImport}
                      disabled={importCsvMutation.isPending}
                      data-testid="button-process-import"
                    >
                      {importCsvMutation.isPending ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Importing...</>
                      ) : (
                        <><Upload className="w-4 h-4 mr-2" /> Import {csvFile.name}</>
                      )}
                    </Button>
                  )}
                  
                  {importResult && (
                    <div className={`p-3 rounded text-sm ${importResult.errors.length > 0 ? 'bg-destructive/20 border border-destructive/50' : 'bg-green-500/20 border border-green-500/50'}`}>
                      <div className="flex items-center gap-2 mb-1">
                        {importResult.errors.length > 0 ? (
                          <AlertCircle className="w-4 h-4 text-destructive" />
                        ) : (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        )}
                        <span className="font-bold">{importResult.imported} animals imported</span>
                      </div>
                      {importResult.errors.length > 0 && (
                        <ul className="text-xs text-muted-foreground list-disc list-inside">
                          {importResult.errors.slice(0, 5).map((err, i) => (
                            <li key={i}>{err}</li>
                          ))}
                          {importResult.errors.length > 5 && (
                            <li>...and {importResult.errors.length - 5} more errors</li>
                          )}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
             </div>
          </CardContent>
        </Card>

        <Card className="rugged-card">
          <CardHeader>
            <CardTitle className="uppercase flex items-center gap-2">
              <Folder className="w-5 h-5 text-primary" /> Documents
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Upload and manage documents like evaluation certificates, pedigrees, and other records.
            </p>
            
            <input
              ref={docInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              onChange={handleDocUpload}
              className="hidden"
              data-testid="input-doc-file"
            />
            
            <Button 
              variant="outline"
              className="w-full"
              onClick={() => docInputRef.current?.click()}
              disabled={uploadDocMutation.isPending}
              data-testid="button-upload-doc"
            >
              {uploadDocMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploading...</>
              ) : (
                <><Upload className="w-4 h-4 mr-2" /> Upload Document</>
              )}
            </Button>
            
            {docsLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : documents && documents.length > 0 ? (
              <div className="space-y-2">
                {documents.map((doc: any) => (
                  <div 
                    key={doc.id} 
                    className="flex items-center justify-between p-3 bg-secondary/50 rounded border border-border"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <FileText className="w-4 h-4 text-primary flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{doc.fileName}</p>
                        <p className="text-xs text-muted-foreground">
                          {doc.category} {doc.createdAt && `• ${format(new Date(doc.createdAt), "dd MMM yyyy")}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {doc.fileUrl && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            const link = document.createElement('a');
                            link.href = doc.fileUrl;
                            link.download = doc.fileName;
                            link.click();
                          }}
                          data-testid={`button-download-doc-${doc.id}`}
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => deleteDocMutation.mutate(doc.id)}
                        disabled={deleteDocMutation.isPending}
                        data-testid={`button-delete-doc-${doc.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Folder className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No documents uploaded yet</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Encouraging message */}
        <div className="text-center py-6 px-4 border-t border-border/30 mt-4">
          <p className="text-sm text-muted-foreground italic max-w-md mx-auto">
            Your farm identity matters. A well-branded stud stands out in the <span className="text-primary font-medium">industry</span>.
          </p>
        </div>
      </div>
    </Layout>
  );
}
