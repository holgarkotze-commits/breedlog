import { useRoute } from "wouter";
import { useAnimal, useFamilyTree, useUpdateAnimal } from "@/hooks/use-animals";
import { usePerformanceRecords, useHealthRecords, useCreatePerformanceRecord } from "@/hooks/use-records";
import { useEvaluations, useCreateEvaluation } from "@/hooks/use-evaluations";
import { Layout } from "@/components/Layout";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { format } from "date-fns";
import { ArrowLeft, Dna, Syringe, Scale, FileText, Plus, Upload } from "lucide-react";
import { Link } from "wouter";
import logo from "@assets/BREEDLOG_LOGO_1768730745128.png";

export default function AnimalDetail() {
  const [match, params] = useRoute("/animals/:id");
  const id = parseInt(params?.id || "0");
  const { data: animal, isLoading } = useAnimal(id);

  if (isLoading) return <DetailSkeleton />;
  if (!animal) return <div className="p-8 text-center">Animal not found</div>;

  return (
    <Layout>
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="flex items-center gap-4">
          <Link href="/animals">
            <Button variant="ghost" size="icon" data-testid="button-back"><ArrowLeft className="w-5 h-5" /></Button>
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-black">{animal.tagId}</h1>
              <Badge variant="outline" className="uppercase font-bold text-primary border-primary">
                {animal.sex}
              </Badge>
              <Badge variant={animal.status === 'active' ? 'default' : 'destructive'} className="uppercase">
                {animal.status}
              </Badge>
            </div>
            <p className="text-muted-foreground">{animal.name || "Unnamed"} • {animal.breed}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Info Card */}
          <div className="lg:col-span-1 space-y-6">
            <Card className="rugged-card overflow-hidden">
                <div className="aspect-square bg-secondary relative">
                    <img src={animal.photo || logo} className={animal.photo ? "w-full h-full object-cover" : "w-1/2 h-1/2 absolute top-1/4 left-1/4 opacity-20 grayscale"} />
                </div>
                <CardContent className="p-6 space-y-4">
                    <InfoRow label="Electronic ID" value={animal.electronicId || "N/A"} />
                    <InfoRow label="Birth Date" value={animal.birthDate ? format(new Date(animal.birthDate), "dd MMM yyyy") : "N/A"} />
                    <InfoRow label="Current Weight" value={animal.currentWeight ? `${animal.currentWeight} kg` : "N/A"} />
                    <InfoRow label="Breeder" value={animal.breederName || "Self"} />
                    <div className="pt-4 border-t border-border">
                        <Label className="text-muted-foreground text-xs uppercase">Notes</Label>
                        <p className="text-sm mt-1">{animal.notes || "No notes recorded."}</p>
                    </div>
                </CardContent>
            </Card>
          </div>

          {/* Tabs Section */}
          <div className="lg:col-span-2">
            <Tabs defaultValue="pedigree" className="w-full">
              <TabsList className="w-full bg-card border border-border h-12">
                <TabsTrigger value="pedigree" data-testid="tab-pedigree" className="flex-1 uppercase font-bold text-xs"><Dna className="w-4 h-4 mr-2" /> Pedigree</TabsTrigger>
                <TabsTrigger value="performance" data-testid="tab-weights" className="flex-1 uppercase font-bold text-xs"><Scale className="w-4 h-4 mr-2" /> Weights</TabsTrigger>
                <TabsTrigger value="health" data-testid="tab-health" className="flex-1 uppercase font-bold text-xs"><Syringe className="w-4 h-4 mr-2" /> Health</TabsTrigger>
                <TabsTrigger value="evaluations" data-testid="tab-evaluations" className="flex-1 uppercase font-bold text-xs"><FileText className="w-4 h-4 mr-2" /> Eval</TabsTrigger>
              </TabsList>
              
              <TabsContent value="pedigree" className="mt-4">
                <PedigreeView animal={animal} />
              </TabsContent>
              
              <TabsContent value="performance" className="mt-4">
                <PerformanceView animalId={animal.id} />
              </TabsContent>

              <TabsContent value="health" className="mt-4">
                 <HealthView animalId={animal.id} />
              </TabsContent>

              <TabsContent value="evaluations" className="mt-4">
                 <EvaluationView animalId={animal.id} initialEvaluations={animal.evaluations || []} />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </Layout>
  );
}

function InfoRow({ label, value }: { label: string, value: string }) {
    return (
        <div className="flex justify-between items-center py-2 border-b border-border/50 last:border-0">
            <span className="text-sm text-muted-foreground">{label}</span>
            <span className="font-bold text-foreground">{value}</span>
        </div>
    )
}

function PedigreeView({ animal }: { animal: any }) {
    const { data: tree } = useFamilyTree(animal.id);
    // Simple visualization for MVP - in production use D3 or React Flow
    return (
        <Card className="bg-card rugged-card">
            <CardHeader><CardTitle className="text-lg">Family Tree</CardTitle></CardHeader>
            <CardContent className="space-y-4">
                <div className="flex flex-col items-center gap-8 py-8">
                    {/* Grandparents - simple placeholders if not fetching deep tree yet */}
                    <div className="flex gap-16">
                        <div className="w-24 h-24 rounded-full border-2 border-dashed border-muted-foreground flex items-center justify-center bg-secondary">GP Sire</div>
                        <div className="w-24 h-24 rounded-full border-2 border-dashed border-muted-foreground flex items-center justify-center bg-secondary">GP Dam</div>
                    </div>
                    <div className="w-0.5 h-8 bg-border"></div>
                    
                    {/* Parents */}
                    <div className="flex gap-24">
                        <div className="text-center">
                            <div className={cn("w-20 h-20 rounded-full border-2 flex items-center justify-center mb-2 mx-auto", animal.sire ? "border-primary bg-primary/10" : "border-muted bg-secondary")}>
                                {animal.sire?.tagId || "Unknown"}
                            </div>
                            <span className="text-xs uppercase font-bold text-muted-foreground">Sire</span>
                        </div>
                        <div className="text-center">
                            <div className={cn("w-20 h-20 rounded-full border-2 flex items-center justify-center mb-2 mx-auto", animal.dam ? "border-primary bg-primary/10" : "border-muted bg-secondary")}>
                                {animal.dam?.tagId || "Unknown"}
                            </div>
                            <span className="text-xs uppercase font-bold text-muted-foreground">Dam</span>
                        </div>
                    </div>
                    
                    <div className="w-0.5 h-8 bg-primary"></div>
                    
                    {/* Self */}
                    <div className="text-center">
                         <div className="w-28 h-28 rounded-full border-4 border-primary bg-primary text-black font-black flex items-center justify-center text-xl mx-auto shadow-lg shadow-primary/20">
                            {animal.tagId}
                        </div>
                         <span className="text-xs uppercase font-bold text-primary mt-2 block">Subject</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}

function PerformanceView({ animalId }: { animalId: number }) {
    const { data: records, isLoading } = usePerformanceRecords(animalId);
    const { mutate: addRecord } = useCreatePerformanceRecord();
    const [weight, setWeight] = useState("");

    const handleAdd = () => {
        if(!weight) return;
        addRecord({
            animalId,
            date: new Date().toISOString().split('T')[0],
            weight: weight,
            notes: "Manual entry"
        });
        setWeight("");
    }

    return (
        <Card className="bg-card rugged-card">
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">Weight History</CardTitle>
                <div className="flex gap-2">
                    <Input 
                        type="number" 
                        placeholder="New weight..." 
                        className="w-32 rugged-input h-9" 
                        value={weight}
                        onChange={e => setWeight(e.target.value)}
                    />
                    <Button size="sm" onClick={handleAdd} data-testid="button-add-weight" className="bg-primary text-black font-bold">Add</Button>
                </div>
            </CardHeader>
            <CardContent>
                {isLoading ? <Skeleton className="h-20 w-full" /> : (
                    <div className="space-y-2">
                        {records?.map((rec, i) => (
                            <div key={i} className="flex justify-between p-3 bg-secondary rounded-md border border-border">
                                <span className="font-mono">{format(new Date(rec.date), "dd MMM yyyy")}</span>
                                <span className="font-bold text-primary">{rec.weight} kg</span>
                            </div>
                        ))}
                        {records?.length === 0 && <p className="text-muted-foreground text-center py-4">No records found.</p>}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}

function HealthView({ animalId }: { animalId: number }) {
    const { data: records } = useHealthRecords(animalId);
    return (
        <Card className="bg-card rugged-card">
            <CardHeader><CardTitle className="text-lg">Health Log</CardTitle></CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {records?.map((rec, i) => (
                        <div key={i} className="border-l-2 border-red-500 pl-4 py-1">
                            <p className="font-bold">{rec.treatment}</p>
                            <p className="text-sm text-muted-foreground">{format(new Date(rec.date), "dd MMM yyyy")} • {rec.medication}</p>
                        </div>
                    ))}
                    {(!records || records.length === 0) && <p className="text-muted-foreground text-center py-4">No health records.</p>}
                </div>
            </CardContent>
        </Card>
    )
}

function EvaluationView({ animalId, initialEvaluations }: { animalId: number, initialEvaluations: any[] }) {
    const { data: evaluations } = useEvaluations(animalId);
    const { mutate: createEvaluation, isPending } = useCreateEvaluation();
    const [isOpen, setIsOpen] = useState(false);
    const [formData, setFormData] = useState({
        headScore: "",
        frontScore: "",
        middleScore: "",
        rearScore: "",
        overallType: "",
        evaluator: "",
        comments: ""
    });

    const displayEvaluations = evaluations || initialEvaluations;

    const handleSubmit = () => {
        createEvaluation({
            animalId,
            headScore: formData.headScore ? parseInt(formData.headScore) : null,
            frontScore: formData.frontScore ? parseInt(formData.frontScore) : null,
            middleScore: formData.middleScore ? parseInt(formData.middleScore) : null,
            rearScore: formData.rearScore ? parseInt(formData.rearScore) : null,
            overallType: formData.overallType || null,
            evaluator: formData.evaluator || null,
            comments: formData.comments || null,
        }, {
            onSuccess: () => {
                setIsOpen(false);
                setFormData({ headScore: "", frontScore: "", middleScore: "", rearScore: "", overallType: "", evaluator: "", comments: "" });
            }
        });
    };

    return (
        <Card className="bg-card rugged-card">
            <CardHeader className="flex flex-row items-center justify-between gap-4">
                <CardTitle className="text-lg">Evaluations</CardTitle>
                <Dialog open={isOpen} onOpenChange={setIsOpen}>
                    <DialogTrigger asChild>
                        <Button size="sm" data-testid="button-add-evaluation" className="bg-primary text-black font-bold">
                            <Upload className="w-4 h-4 mr-2" /> Add Evaluation
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-card border-border max-w-lg">
                        <DialogHeader>
                            <DialogTitle className="font-display uppercase text-xl">Upload Evaluation</DialogTitle>
                        </DialogHeader>
                        <p className="text-sm text-muted-foreground mb-4">
                            Enter evaluation data from your external evaluation app. Scores are on a 1-6 scale.
                        </p>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Head Score (1-6)</Label>
                                    <Input 
                                        type="number" 
                                        min="1" 
                                        max="6" 
                                        className="rugged-input"
                                        value={formData.headScore}
                                        onChange={e => setFormData({...formData, headScore: e.target.value})}
                                        data-testid="input-head-score"
                                    />
                                </div>
                                <div>
                                    <Label>Front Score (1-6)</Label>
                                    <Input 
                                        type="number" 
                                        min="1" 
                                        max="6" 
                                        className="rugged-input"
                                        value={formData.frontScore}
                                        onChange={e => setFormData({...formData, frontScore: e.target.value})}
                                        data-testid="input-front-score"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Middle Score (1-6)</Label>
                                    <Input 
                                        type="number" 
                                        min="1" 
                                        max="6" 
                                        className="rugged-input"
                                        value={formData.middleScore}
                                        onChange={e => setFormData({...formData, middleScore: e.target.value})}
                                        data-testid="input-middle-score"
                                    />
                                </div>
                                <div>
                                    <Label>Rear Score (1-6)</Label>
                                    <Input 
                                        type="number" 
                                        min="1" 
                                        max="6" 
                                        className="rugged-input"
                                        value={formData.rearScore}
                                        onChange={e => setFormData({...formData, rearScore: e.target.value})}
                                        data-testid="input-rear-score"
                                    />
                                </div>
                            </div>
                            <div>
                                <Label>Overall Type</Label>
                                <Select value={formData.overallType} onValueChange={v => setFormData({...formData, overallType: v})}>
                                    <SelectTrigger className="rugged-input" data-testid="select-overall-type">
                                        <SelectValue placeholder="Select type..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Euro">Euro</SelectItem>
                                        <SelectItem value="Afro">Afro</SelectItem>
                                        <SelectItem value="Middle">Middle</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Evaluator Name</Label>
                                <Input 
                                    className="rugged-input"
                                    placeholder="e.g. John Smith, External App"
                                    value={formData.evaluator}
                                    onChange={e => setFormData({...formData, evaluator: e.target.value})}
                                    data-testid="input-evaluator"
                                />
                            </div>
                            <div>
                                <Label>Comments / Notes</Label>
                                <Textarea 
                                    className="rugged-input"
                                    placeholder="Additional evaluation notes..."
                                    value={formData.comments}
                                    onChange={e => setFormData({...formData, comments: e.target.value})}
                                    data-testid="input-comments"
                                />
                            </div>
                            <Button 
                                onClick={handleSubmit} 
                                disabled={isPending} 
                                className="w-full rugged-btn bg-primary text-black"
                                data-testid="button-save-evaluation"
                            >
                                {isPending ? "Saving..." : "Save Evaluation"}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </CardHeader>
            <CardContent>
                 <div className="space-y-4">
                    {displayEvaluations.map((ev, i) => (
                        <div key={i} className="bg-secondary p-4 rounded-md border border-border">
                             <div className="flex justify-between mb-2">
                                <span className="font-bold text-sm uppercase">{format(new Date(ev.date || new Date()), "dd MMM yyyy")}</span>
                                <span className="text-xs bg-primary text-black px-2 py-0.5 rounded-full font-bold">{ev.overallType || "N/A"}</span>
                             </div>
                             {ev.evaluator && <p className="text-xs text-muted-foreground mb-2">By: {ev.evaluator}</p>}
                             <div className="grid grid-cols-4 gap-2 text-center text-xs">
                                <div className="bg-background p-2 rounded">
                                    <span className="block text-muted-foreground">Head</span>
                                    <span className="font-bold text-lg">{ev.headScore || "-"}</span>
                                </div>
                                <div className="bg-background p-2 rounded">
                                    <span className="block text-muted-foreground">Front</span>
                                    <span className="font-bold text-lg">{ev.frontScore || "-"}</span>
                                </div>
                                <div className="bg-background p-2 rounded">
                                    <span className="block text-muted-foreground">Middle</span>
                                    <span className="font-bold text-lg">{ev.middleScore || "-"}</span>
                                </div>
                                <div className="bg-background p-2 rounded">
                                    <span className="block text-muted-foreground">Rear</span>
                                    <span className="font-bold text-lg">{ev.rearScore || "-"}</span>
                                </div>
                             </div>
                             {ev.comments && <p className="mt-3 text-sm italic text-muted-foreground">"{ev.comments}"</p>}
                        </div>
                    ))}
                    {displayEvaluations.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground border-2 border-dashed border-border rounded-md">
                            <Upload className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <p>No evaluations recorded.</p>
                            <p className="text-xs mt-1">Use "Add Evaluation" to upload data from your external evaluation app.</p>
                        </div>
                    )}
                 </div>
            </CardContent>
        </Card>
    )
}

function DetailSkeleton() {
    return (
        <Layout>
            <div className="space-y-6">
                <Skeleton className="h-12 w-1/3 bg-secondary" />
                <div className="grid grid-cols-3 gap-8">
                    <Skeleton className="h-96 bg-secondary" />
                    <Skeleton className="col-span-2 h-96 bg-secondary" />
                </div>
            </div>
        </Layout>
    )
}
