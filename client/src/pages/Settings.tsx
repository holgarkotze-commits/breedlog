import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/use-auth";
import { useFarmSettings, useSaveFarmSettings } from "@/hooks/use-farm-settings";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LogOut, User, Download, Upload, Building2, Save, Loader2, Image, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertFarmSettingsSchema, type InsertFarmSettings } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useEffect, useState, useRef } from "react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Settings() {
  const { user, logout } = useAuth();
  const { data: farmSettings, isLoading } = useFarmSettings();
  const displayName = farmSettings?.studName || farmSettings?.farmName;
  const saveMutation = useSaveFarmSettings();

  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

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

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setLogoPreview(base64);
        form.setValue("logoUrl", base64);
      };
      reader.readAsDataURL(file);
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
                <h4 className="font-bold text-sm uppercase mb-2">Export Data</h4>
                <p className="text-xs text-muted-foreground mb-4">Download your full herd database as CSV format suitable for Stamboek submission.</p>
                <Button 
                    className="w-full rugged-btn bg-secondary border border-primary text-primary hover:bg-primary hover:text-black"
                    onClick={() => window.open("/api/settings/export", "_blank")}
                    data-testid="button-export-csv"
                >
                    <Download className="w-4 h-4 mr-2" /> Export CSV
                </Button>
             </div>
             
             <div className="p-4 bg-secondary rounded border border-border opacity-50 cursor-not-allowed relative">
                <div className="absolute inset-0 flex items-center justify-center bg-background/80 font-bold uppercase text-xs text-foreground">Coming Soon</div>
                <h4 className="font-bold text-sm uppercase mb-2">Import Data</h4>
                <p className="text-xs text-muted-foreground mb-4">Bulk import animals from CSV.</p>
                <Button className="w-full rugged-btn" disabled data-testid="button-import-csv">
                    <Upload className="w-4 h-4 mr-2" /> Import CSV
                </Button>
             </div>
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
