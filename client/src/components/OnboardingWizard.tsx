import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, ArrowLeft, Sparkles, Building2, PlusCircle, Lightbulb, Check } from "lucide-react";
import { setOnboardingCompleted } from "@/lib/indexeddb";
import { useSaveFarmSettings } from "@/hooks/use-farm-settings";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

interface OnboardingWizardProps {
  onComplete: () => void;
}

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState(1);
  const [farmName, setFarmName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [farmLocation, setFarmLocation] = useState("");
  const [primaryBreed, setPrimaryBreed] = useState("Meatmaster");
  const { toast } = useToast();
  const saveFarmSettings = useSaveFarmSettings();
  const [, setLocation] = useLocation();

  const handleNext = () => {
    if (step < 4) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleSaveFarmSettings = async () => {
    if (!farmName.trim()) {
      toast({ 
        title: "Farm Name Required", 
        description: "Please enter your farm name to continue", 
        variant: "destructive" 
      });
      return;
    }

    try {
      await saveFarmSettings.mutateAsync({
        farmName: farmName.trim(),
        ownerName: ownerName.trim() || null,
        farmLocation: farmLocation.trim() || null,
      });
      handleNext();
    } catch (err) {
      toast({ 
        title: "Error", 
        description: "Could not save farm settings", 
        variant: "destructive" 
      });
    }
  };

  const handleAddAnimal = (type: "ram" | "ewe" | "lamb") => {
    setOnboardingCompleted(true);
    onComplete();
    setLocation(`/animals?add=${type}`);
  };

  const handleFinish = async () => {
    await setOnboardingCompleted(true);
    onComplete();
    setLocation("/");
  };

  return (
    <div className="fixed inset-0 bg-background z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Progress indicator */}
        <div className="flex justify-center gap-2 mb-6">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={`h-2 w-12 rounded-full transition-colors ${
                s <= step ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>

        {/* Step 1: Welcome */}
        {step === 1 && (
          <Card className="rugged-card">
            <CardHeader className="text-center pb-2">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                <Sparkles className="w-10 h-10 text-primary" />
              </div>
              <CardTitle className="text-2xl font-black uppercase tracking-tight">
                Welcome to BreedLog
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <p className="text-muted-foreground">
                BreedLog helps you track rams, ewes, lambs, breeding, weights, 
                and health — even when you're offline in the field.
              </p>
              <div className="grid grid-cols-3 gap-3 pt-4">
                <div className="text-center p-3 rounded bg-secondary/30">
                  <p className="text-2xl font-bold text-primary">100%</p>
                  <p className="text-xs text-muted-foreground">Offline Ready</p>
                </div>
                <div className="text-center p-3 rounded bg-secondary/30">
                  <p className="text-2xl font-bold text-primary">PDF</p>
                  <p className="text-xs text-muted-foreground">Exports</p>
                </div>
                <div className="text-center p-3 rounded bg-secondary/30">
                  <p className="text-2xl font-bold text-primary">Easy</p>
                  <p className="text-xs text-muted-foreground">To Use</p>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                className="w-full" 
                onClick={handleNext}
                data-testid="button-onboarding-start"
              >
                Get Started <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardFooter>
          </Card>
        )}

        {/* Step 2: Farm Setup */}
        {step === 2 && (
          <Card className="rugged-card">
            <CardHeader className="pb-2">
              <div className="w-16 h-16 mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                <Building2 className="w-8 h-8 text-primary" />
              </div>
              <CardTitle className="text-xl font-black uppercase tracking-tight">
                Set Up Your Farm
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="farmName">Farm Name *</Label>
                <Input
                  id="farmName"
                  value={farmName}
                  onChange={(e) => setFarmName(e.target.value)}
                  placeholder="e.g., Kwantam Meatmasters"
                  data-testid="input-onboarding-farm-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ownerName">Owner Name (Optional)</Label>
                <Input
                  id="ownerName"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  placeholder="Your name"
                  data-testid="input-onboarding-owner-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="farmLocation">Location (Optional)</Label>
                <Input
                  id="farmLocation"
                  value={farmLocation}
                  onChange={(e) => setFarmLocation(e.target.value)}
                  placeholder="e.g., Northern Cape, SA"
                  data-testid="input-onboarding-location"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="primaryBreed">Primary Breed (Optional)</Label>
                <Input
                  id="primaryBreed"
                  value={primaryBreed}
                  onChange={(e) => setPrimaryBreed(e.target.value)}
                  placeholder="e.g., Meatmaster"
                  data-testid="input-onboarding-breed"
                />
              </div>
            </CardContent>
            <CardFooter className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={handleBack}
                data-testid="button-onboarding-back"
              >
                <ArrowLeft className="w-4 h-4 mr-2" /> Back
              </Button>
              <Button 
                className="flex-1" 
                onClick={handleSaveFarmSettings}
                disabled={saveFarmSettings.isPending}
                data-testid="button-onboarding-save-farm"
              >
                Save & Continue <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardFooter>
          </Card>
        )}

        {/* Step 3: Add First Animal */}
        {step === 3 && (
          <Card className="rugged-card">
            <CardHeader className="pb-2">
              <div className="w-16 h-16 mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                <PlusCircle className="w-8 h-8 text-primary" />
              </div>
              <CardTitle className="text-xl font-black uppercase tracking-tight">
                Add Your First Animal
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground text-sm">
                Choose the type of animal you'd like to add first. You can always add more later.
              </p>
              <div className="grid grid-cols-1 gap-3">
                <Button
                  variant="outline"
                  className="h-16 justify-start px-4"
                  onClick={() => handleAddAnimal("ram")}
                  data-testid="button-onboarding-add-ram"
                >
                  <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center mr-3">
                    <span className="text-lg">🐏</span>
                  </div>
                  <div className="text-left">
                    <p className="font-bold">Add Ram</p>
                    <p className="text-xs text-muted-foreground">Male breeding stock</p>
                  </div>
                </Button>
                <Button
                  variant="outline"
                  className="h-16 justify-start px-4"
                  onClick={() => handleAddAnimal("ewe")}
                  data-testid="button-onboarding-add-ewe"
                >
                  <div className="w-10 h-10 rounded-full bg-pink-500/20 flex items-center justify-center mr-3">
                    <span className="text-lg">🐑</span>
                  </div>
                  <div className="text-left">
                    <p className="font-bold">Add Ewe</p>
                    <p className="text-xs text-muted-foreground">Female breeding stock</p>
                  </div>
                </Button>
                <Button
                  variant="outline"
                  className="h-16 justify-start px-4"
                  onClick={() => handleAddAnimal("lamb")}
                  data-testid="button-onboarding-add-lamb"
                >
                  <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center mr-3">
                    <span className="text-lg">🐑</span>
                  </div>
                  <div className="text-left">
                    <p className="font-bold">Add Lamb</p>
                    <p className="text-xs text-muted-foreground">Young sheep (under 12 months)</p>
                  </div>
                </Button>
              </div>
            </CardContent>
            <CardFooter className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={handleBack}
                data-testid="button-onboarding-back-step3"
              >
                <ArrowLeft className="w-4 h-4 mr-2" /> Back
              </Button>
              <Button 
                variant="ghost" 
                className="flex-1"
                onClick={handleNext}
                data-testid="button-onboarding-skip"
              >
                Skip for now <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardFooter>
          </Card>
        )}

        {/* Step 4: Quick Tips & Finish */}
        {step === 4 && (
          <Card className="rugged-card">
            <CardHeader className="pb-2">
              <div className="w-16 h-16 mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                <Lightbulb className="w-8 h-8 text-primary" />
              </div>
              <CardTitle className="text-xl font-black uppercase tracking-tight">
                Quick Tips
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 rounded bg-secondary/30">
                  <Check className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-sm">Breeding Groups</p>
                    <p className="text-xs text-muted-foreground">
                      Use "Breeding" to record mating groups and track lambing.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded bg-secondary/30">
                  <Check className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-sm">Health Records</p>
                    <p className="text-xs text-muted-foreground">
                      Use "Health" to log treatments, vaccinations, and vet visits.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded bg-secondary/30">
                  <Check className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-sm">PDF Exports</p>
                    <p className="text-xs text-muted-foreground">
                      Export professional reports anytime from "Records."
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded bg-secondary/30">
                  <Check className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-sm">Works Offline</p>
                    <p className="text-xs text-muted-foreground">
                      All data syncs automatically when you're back online.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={handleBack}
                data-testid="button-onboarding-back-step4"
              >
                <ArrowLeft className="w-4 h-4 mr-2" /> Back
              </Button>
              <Button 
                className="flex-1" 
                onClick={handleFinish}
                data-testid="button-onboarding-finish"
              >
                Go to Dashboard <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardFooter>
          </Card>
        )}
      </div>
    </div>
  );
}
