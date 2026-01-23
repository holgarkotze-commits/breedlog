import { Layout } from "@/components/Layout";
import { useGenerateValuation } from "@/hooks/use-ai";
import { useAnimals } from "@/hooks/use-animals";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, Lock, BrainCircuit } from "lucide-react";
import { useState } from "react";
import ReactMarkdown from 'react-markdown';

export default function AiValuation() {
  const { user, isLoading: authLoading } = useAuth();
  const { data: animals } = useAnimals();
  const { mutate: generate, isPending, data: result } = useGenerateValuation();
  const [selectedAnimal, setSelectedAnimal] = useState<string>("");

  if (authLoading) return <div className="p-8">Loading...</div>;

  if (!user) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
           <div className="p-6 bg-secondary rounded-full">
             <Lock className="w-12 h-12 text-muted-foreground" />
           </div>
           <h1 className="text-3xl font-black uppercase">Authentication Required</h1>
           <p className="text-muted-foreground max-w-md">The AI Valuation engine is a premium feature that requires a logged-in user account.</p>
           <Button onClick={() => window.location.href = "/api/login"} data-testid="button-login" className="rugged-btn bg-primary text-black">Log In via Replit</Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
        <div className="text-center space-y-2">
            <h1 className="text-4xl font-black uppercase tracking-tight flex items-center justify-center gap-3">
                <Sparkles className="text-primary w-8 h-8" />
                AI Valuation Engine
            </h1>
            <p className="text-muted-foreground">Generate professional breeding assessments using advanced conformation analysis.</p>
        </div>

        <Card className="rugged-card bg-card border-border">
            <CardHeader>
                <CardTitle className="uppercase text-sm tracking-widest text-muted-foreground">Select Animal</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="flex gap-4">
                    <Select value={selectedAnimal} onValueChange={setSelectedAnimal}>
                        <SelectTrigger className="flex-1 rugged-input h-12 text-lg">
                            <SelectValue placeholder="Choose an animal from herd..." />
                        </SelectTrigger>
                        <SelectContent>
                            {animals?.map(a => (
                                <SelectItem key={a.id} value={String(a.id)}>
                                    {a.tagId} ({a.breed} {a.sex})
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button 
                        disabled={!selectedAnimal || isPending} 
                        onClick={() => generate(parseInt(selectedAnimal))}
                        data-testid="button-analyze"
                        className="h-12 px-8 rugged-btn bg-primary text-black text-lg"
                    >
                        {isPending ? <BrainCircuit className="w-5 h-5 animate-pulse" /> : "Analyze"}
                    </Button>
                </div>
            </CardContent>
        </Card>

        {isPending && (
            <div className="space-y-4 p-8 border border-dashed border-border rounded-lg bg-secondary/20">
                <Skeleton className="h-6 w-3/4 bg-secondary" />
                <Skeleton className="h-4 w-full bg-secondary" />
                <Skeleton className="h-4 w-5/6 bg-secondary" />
                <Skeleton className="h-4 w-4/5 bg-secondary" />
                <p className="text-center text-xs text-muted-foreground mt-4 animate-pulse">Running AI Model (GPT-5.1)...</p>
            </div>
        )}

        {result && (
             <Card className="rugged-card border-primary/50 bg-card">
                <CardHeader>
                    <CardTitle className="uppercase text-primary flex items-center gap-2">
                        <BrainCircuit className="w-5 h-5" /> Valuation Report
                    </CardTitle>
                </CardHeader>
                <CardContent className="prose prose-invert prose-yellow max-w-none">
                    <ReactMarkdown>{result.valuationText}</ReactMarkdown>
                </CardContent>
             </Card>
        )}
      </div>
    </Layout>
  );
}
