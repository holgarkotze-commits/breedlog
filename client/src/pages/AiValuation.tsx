import { useAuth } from "@/hooks/use-auth";
import { useGenerateAiValuation } from "@/hooks/use-evaluations";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BrainCircuit, Lock, Loader2, Sparkles, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAnimals } from "@/hooks/use-animals";

export default function AiValuation() {
  const { user, isLoading: authLoading } = useAuth();
  const { data: animals } = useAnimals({ status: 'active' });
  const mutation = useGenerateAiValuation();
  const [selectedAnimal, setSelectedAnimal] = useState<string>("");

  if (authLoading) {
    return <Layout><div className="flex h-96 items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div></Layout>;
  }

  // Unauthorized State
  if (!user) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto py-20 text-center space-y-6">
          <div className="w-24 h-24 bg-secondary/50 rounded-full flex items-center justify-center mx-auto mb-6 ring-4 ring-secondary">
            <Lock className="w-10 h-10 text-muted-foreground" />
          </div>
          <h1 className="text-4xl font-black uppercase tracking-tight">Access Restricted</h1>
          <p className="text-lg text-muted-foreground max-w-md mx-auto">
            The AI Valuation tool is a premium feature. Please log in to access intelligent livestock grading.
          </p>
          <Button 
            className="rugged-btn bg-primary text-black h-12 px-8 text-lg"
            onClick={() => window.location.href = "/api/login"}
          >
            Log In with Replit
          </Button>
        </div>
      </Layout>
    );
  }

  const handleGenerate = async () => {
    if (!selectedAnimal) return;
    try {
      await mutation.mutateAsync({ animalId: parseInt(selectedAnimal) });
    } catch (e) {
      // Error handling managed by hook/query client
    }
  };

  return (
    <Layout>
      <div className="space-y-8 animate-in fade-in duration-500">
        <div>
          <h1 className="text-4xl font-black uppercase flex items-center gap-3">
            <BrainCircuit className="w-10 h-10 text-primary" /> AI Valuation
          </h1>
          <p className="text-muted-foreground text-lg mt-2">Generate professional grade assessments using AI.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Controls */}
          <Card className="rugged-card h-fit">
            <CardHeader>
              <CardTitle>Select Animal</CardTitle>
              <CardDescription>Choose an animal from your active herd to evaluate.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
               <div className="space-y-2">
                 <label className="text-sm font-bold uppercase text-muted-foreground">Animal ID</label>
                 <Select value={selectedAnimal} onValueChange={setSelectedAnimal}>
                   <SelectTrigger className="rugged-input h-12 text-lg">
                     <SelectValue placeholder="Search or select..." />
                   </SelectTrigger>
                   <SelectContent>
                     {animals?.map(a => (
                       <SelectItem key={a.id} value={String(a.id)} className="font-mono">
                         {a.tagId} ({a.breed})
                       </SelectItem>
                     ))}
                   </SelectContent>
                 </Select>
               </div>
               
               <div className="bg-secondary/30 p-4 rounded border border-border text-sm text-muted-foreground">
                  <p className="flex items-center gap-2 text-yellow-500 font-bold mb-2">
                    <AlertTriangle className="w-4 h-4" /> Note
                  </p>
                  This tool uses available performance records, health history, and lineage data to generate a comprehensive valuation report. Accuracy depends on data completeness.
               </div>

               <Button 
                 disabled={!selectedAnimal || mutation.isPending}
                 onClick={handleGenerate}
                 className="w-full rugged-btn bg-primary text-black h-12 text-lg"
               >
                 {mutation.isPending ? (
                   <>
                     <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Analyzing Data...
                   </>
                 ) : (
                   <>
                     <Sparkles className="w-5 h-5 mr-2" /> Generate Report
                   </>
                 )}
               </Button>
            </CardContent>
          </Card>

          {/* Results Area */}
          <div className="space-y-6">
            {mutation.data ? (
              <Card className="rugged-card border-primary/50 bg-card relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-yellow-600" />
                <CardHeader>
                  <CardTitle className="flex justify-between items-center">
                    <span>Valuation Report</span>
                    <Badge className="bg-primary text-black hover:bg-primary">AI GENERATED</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-invert max-w-none">
                     <p className="whitespace-pre-wrap text-foreground/90 leading-relaxed">
                       {mutation.data.valuationText}
                     </p>
                  </div>
                  <div className="mt-6 pt-6 border-t border-border flex justify-between text-xs text-muted-foreground font-mono">
                    <span>ID: {mutation.data.id}</span>
                    <span>{new Date(mutation.data.createdAt!).toLocaleString()}</span>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="h-full min-h-[400px] border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center text-muted-foreground p-8 text-center bg-secondary/10">
                <BrainCircuit className="w-16 h-16 opacity-20 mb-4" />
                <h3 className="text-xl font-bold uppercase opacity-50">Ready to Analyze</h3>
                <p className="opacity-50 mt-2 max-w-xs">Select an animal on the left to generate a new AI valuation report.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
