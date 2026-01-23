import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogOut, User, Shield, Download, Upload } from "lucide-react";

export default function Settings() {
  const { user, logout } = useAuth();

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in duration-500">
        <h1 className="text-4xl font-black uppercase tracking-tight">Settings</h1>

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
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 font-bold uppercase text-xs">Coming Soon</div>
                <h4 className="font-bold text-sm uppercase mb-2">Import Data</h4>
                <p className="text-xs text-muted-foreground mb-4">Bulk import animals from CSV.</p>
                <Button className="w-full rugged-btn" disabled data-testid="button-import-csv">
                    <Upload className="w-4 h-4 mr-2" /> Import CSV
                </Button>
             </div>
          </CardContent>
        </Card>

        <Card className="rugged-card opacity-50 cursor-not-allowed">
           <CardHeader>
            <CardTitle className="uppercase flex items-center gap-2">
              <Shield className="w-5 h-5" /> Farm Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
             <div className="space-y-2">
               <Label>Farm Name</Label>
               <Input className="rugged-input" placeholder="e.g. Sunny Hills Station" disabled />
             </div>
             <div className="space-y-2">
               <Label>Owner Name</Label>
               <Input className="rugged-input" placeholder="Your Name" disabled />
             </div>
             <p className="text-xs text-muted-foreground italic">Farm details editing coming in v1.1</p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
