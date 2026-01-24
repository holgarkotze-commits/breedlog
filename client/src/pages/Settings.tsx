import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/use-auth";
import { useFarmSettings, useSaveFarmSettings } from "@/hooks/use-farm-settings";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LogOut, User, Download, Upload, Building2, Save, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertFarmSettingsSchema, type InsertFarmSettings } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Settings() {
  const { user, logout } = useAuth();
  const { data: farmSettings, isLoading } = useFarmSettings();
  const displayName = farmSettings?.studName || farmSettings?.farmName;
  const saveMutation = useSaveFarmSettings();

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
      });
    }
  }, [farmSettings, form]);

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
          <p className="text-sm text-primary italic max-w-md mx-auto">
            Your farm identity matters. A well-branded stud stands out in the <span className="text-primary font-medium">industry</span>.
          </p>
        </div>
      </div>
    </Layout>
  );
}
