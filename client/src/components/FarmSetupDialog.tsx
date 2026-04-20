import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSaveFarmSettings } from "@/hooks/use-farm-settings";
import { Loader2, Building2 } from "lucide-react";
import logo from "@/assets/breedlog-logo-mark.png";

interface FarmSetupDialogProps {
  open: boolean;
  onComplete: () => void;
}

export function FarmSetupDialog({ open, onComplete }: FarmSetupDialogProps) {
  const [farmName, setFarmName] = useState("");
  const [studName, setStudName] = useState("");
  const [studPrefix, setStudPrefix] = useState("");
  const saveMutation = useSaveFarmSettings();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!farmName.trim()) return;
    
    saveMutation.mutate({
      farmName: farmName.trim(),
      studName: studName.trim() || null,
      studPrefix: studPrefix.trim() || null,
    }, {
      onSuccess: () => {
        onComplete();
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md bg-card border-primary/30" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader className="text-center items-center">
          <img src={logo} alt="BreedLog" className="w-24 h-24 object-contain mx-auto mb-2" />
          <DialogTitle className="text-2xl font-black uppercase tracking-tight">Welcome to BreedLog</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Let's set up your farm details to get started.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          <div className="space-y-2">
            <Label htmlFor="setup-farm-name" className="flex items-center gap-2">
              <Building2 className="w-4 h-4" /> Farm Name *
            </Label>
            <Input
              id="setup-farm-name"
              value={farmName}
              onChange={(e) => setFarmName(e.target.value)}
              className="rugged-input"
              placeholder="e.g. Sunny Hills Farm"
              required
              data-testid="input-setup-farm-name"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="setup-stud-name">Stud Name (if registered)</Label>
            <Input
              id="setup-stud-name"
              value={studName}
              onChange={(e) => setStudName(e.target.value)}
              className="rugged-input"
              placeholder="e.g. Golden Fleece Stud"
              data-testid="input-setup-stud-name"
            />
            <p className="text-xs text-muted-foreground">This will be displayed in your app header</p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="setup-stud-prefix">Stud Prefix</Label>
            <Input
              id="setup-stud-prefix"
              value={studPrefix}
              onChange={(e) => setStudPrefix(e.target.value)}
              className="rugged-input"
              placeholder="e.g. GFS"
              data-testid="input-setup-stud-prefix"
            />
            <p className="text-xs text-muted-foreground">Used for animal identification</p>
          </div>
          
          <Button 
            type="submit" 
            className="w-full rugged-btn bg-primary text-black font-bold" 
            disabled={!farmName.trim() || saveMutation.isPending}
            data-testid="button-complete-setup"
          >
            {saveMutation.isPending ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Setting up...</>
            ) : (
              "Get Started"
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
