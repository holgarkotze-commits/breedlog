import { useRoute } from "wouter";
import { useAnimal, useFamilyTree, useUpdateAnimal, useAnimals } from "@/hooks/use-animals";
import { usePerformanceRecords, useHealthRecords, useCreatePerformanceRecord } from "@/hooks/use-records";
import { useEvaluations, useCreateEvaluation } from "@/hooks/use-evaluations";
import { useFarmSettings } from "@/hooks/use-farm-settings";
import { Layout } from "@/components/Layout";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useState, useRef } from "react";
import { format } from "date-fns";
import { ArrowLeft, Dna, Syringe, Scale, FileText, Plus, Upload, Edit, Camera, Image, X, Download, Heart } from "lucide-react";
import { useAnimalBreedingEvents } from "@/hooks/use-breeding";
import { Link } from "wouter";
import logo from "@assets/BREEDLOG_LOGO_1768730745128.png";
import { useToast } from "@/hooks/use-toast";
import type { Animal, AnimalWithRelations } from "@shared/schema";

export default function AnimalDetail() {
  const [match, params] = useRoute("/animals/:id");
  const id = parseInt(params?.id || "0");
  const { data: animal, isLoading } = useAnimal(id);
  const { data: farmSettings } = useFarmSettings();
  const [isEditOpen, setIsEditOpen] = useState(false);

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
            <div className="flex items-center gap-3 flex-wrap">
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
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => setIsEditOpen(true)}
              data-testid="button-edit-animal"
            >
              <Edit className="w-4 h-4 mr-2" /> Edit
            </Button>
            <ExportProfileButton animal={animal} farmSettings={farmSettings} />
          </div>
        </div>
        
        <EditAnimalDialog animal={animal} open={isEditOpen} onOpenChange={setIsEditOpen} />

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
                    <InfoRow label="Profile Entry" value={animal.createdAt ? format(new Date(animal.createdAt), "dd MMM yyyy") : "N/A"} testId="text-entry-date" />
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
              <TabsList className="w-full bg-card border border-border h-12 flex-wrap">
                <TabsTrigger value="pedigree" data-testid="tab-pedigree" className="flex-1 uppercase font-bold text-xs"><Dna className="w-4 h-4 mr-1" /> Pedigree</TabsTrigger>
                {animal.sex === "ewe" && (
                  <TabsTrigger value="breeding" data-testid="tab-breeding" className="flex-1 uppercase font-bold text-xs"><Heart className="w-4 h-4 mr-1" /> Breeding</TabsTrigger>
                )}
                <TabsTrigger value="performance" data-testid="tab-weights" className="flex-1 uppercase font-bold text-xs"><Scale className="w-4 h-4 mr-1" /> Weights</TabsTrigger>
                <TabsTrigger value="health" data-testid="tab-health" className="flex-1 uppercase font-bold text-xs"><Syringe className="w-4 h-4 mr-1" /> Health</TabsTrigger>
                <TabsTrigger value="evaluations" data-testid="tab-evaluations" className="flex-1 uppercase font-bold text-xs"><FileText className="w-4 h-4 mr-1" /> Eval</TabsTrigger>
              </TabsList>
              
              <TabsContent value="pedigree" className="mt-4">
                <PedigreeView animal={animal} />
              </TabsContent>
              
              {animal.sex === "ewe" && (
                <TabsContent value="breeding" className="mt-4">
                  <BreedingStatsView animal={animal} />
                </TabsContent>
              )}
              
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

function InfoRow({ label, value, testId }: { label: string, value: string, testId?: string }) {
    return (
        <div className="flex justify-between items-center py-2 border-b border-border/50 last:border-0">
            <span className="text-sm text-muted-foreground">{label}</span>
            <span className="font-bold text-foreground" data-testid={testId}>{value}</span>
        </div>
    )
}

function PedigreeView({ animal }: { animal: any }) {
    const { data: tree } = useFamilyTree(animal.id);
    
    return (
        <Card className="bg-gradient-to-br from-card via-card to-secondary/20 rugged-card overflow-hidden">
            <CardHeader className="border-b border-border/50 bg-black/20">
                <CardTitle className="text-lg flex items-center gap-2">
                    <Dna className="w-5 h-5 text-primary" />
                    <span>FAMILY TREE</span>
                    <span className="text-primary font-black ml-1">- ELITE GENETICS</span>
                </CardTitle>
            </CardHeader>
            <CardContent className="p-4 md:p-8">
                <div className="overflow-x-auto">
                    <div className="min-w-[600px] flex items-center gap-4 py-4">
                        {/* Subject (left) */}
                        <div className="flex-shrink-0">
                            <PedigreeNode 
                                animal={animal}
                                isSubject={true}
                            />
                        </div>
                        
                        {/* Connector line */}
                        <div className="w-8 h-0.5 bg-gradient-to-r from-primary to-primary/50"></div>
                        
                        {/* Parents column */}
                        <div className="flex flex-col gap-6 relative">
                            {/* Vertical connector */}
                            <div className="absolute left-0 top-1/2 -translate-x-4 w-4 h-[calc(100%-60px)] border-l-2 border-t-2 border-b-2 border-primary/50 rounded-l-lg"></div>
                            
                            <PedigreeNode 
                                animal={animal.sire}
                                label="SIRE"
                                externalInfo={animal.externalSireInfo}
                            />
                            <PedigreeNode 
                                animal={animal.dam}
                                label="DAM"
                                externalInfo={animal.externalDamInfo}
                            />
                        </div>
                        
                        {/* Connector line to grandparents */}
                        <div className="w-8 h-0.5 bg-gradient-to-r from-primary/50 to-muted-foreground/30"></div>
                        
                        {/* Grandparents column */}
                        <div className="flex flex-col gap-3 relative">
                            <div className="absolute left-0 top-[25%] -translate-x-4 w-4 h-[15%] border-l-2 border-t-2 border-b-2 border-muted-foreground/30 rounded-l-lg"></div>
                            <div className="absolute left-0 top-[60%] -translate-x-4 w-4 h-[15%] border-l-2 border-t-2 border-b-2 border-muted-foreground/30 rounded-l-lg"></div>
                            
                            <PedigreeNodeSmall label="GP Sire" sublabel="Sire's Father" />
                            <PedigreeNodeSmall label="GP Dam" sublabel="Sire's Mother" />
                            <PedigreeNodeSmall label="GP Sire" sublabel="Dam's Father" />
                            <PedigreeNodeSmall label="GP Dam" sublabel="Dam's Mother" />
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function PedigreeNode({ animal, label, isSubject, externalInfo }: { 
    animal?: any, 
    label?: string, 
    isSubject?: boolean,
    externalInfo?: string | null 
}) {
    const hasData = animal || externalInfo;
    const isRam = animal?.sex?.toLowerCase() === 'ram';
    const displayId = animal?.tagId || externalInfo || 'Unknown';
    
    return (
        <div className={cn(
            "flex items-center gap-3 p-3 rounded-xl border-2 transition-all",
            isSubject 
                ? "bg-gradient-to-r from-primary/20 to-primary/5 border-primary shadow-lg shadow-primary/20" 
                : hasData 
                    ? "bg-card/80 border-primary/50 hover:border-primary hover:shadow-md" 
                    : "bg-secondary/50 border-dashed border-muted-foreground/30"
        )}>
            {/* Circular photo with ring */}
            <div className={cn(
                "relative flex-shrink-0 rounded-full p-1",
                isSubject ? "bg-gradient-to-br from-primary via-yellow-500 to-primary" : hasData ? "bg-gradient-to-br from-primary/60 to-primary/30" : "bg-muted-foreground/20"
            )}>
                <div className={cn(
                    "rounded-full overflow-hidden flex items-center justify-center bg-secondary",
                    isSubject ? "w-16 h-16" : "w-12 h-12"
                )}>
                    {animal?.photo ? (
                        <img src={animal.photo} alt={displayId} className="w-full h-full object-cover" />
                    ) : (
                        <img src={logo} alt="placeholder" className="w-8 h-8 opacity-40 grayscale" />
                    )}
                </div>
            </div>
            
            {/* Info */}
            <div className="flex-1 min-w-0">
                {/* ID Badge */}
                <div className={cn(
                    "inline-block px-2 py-0.5 rounded text-xs font-black mb-1",
                    isSubject ? "bg-primary text-black" : hasData ? "bg-primary/80 text-black" : "bg-muted-foreground/20 text-muted-foreground"
                )}>
                    ID: {displayId}
                </div>
                
                {/* Details */}
                <div className="text-[10px] space-y-0.5 text-muted-foreground">
                    <div className="flex items-center gap-1">
                        <span className={cn(
                            "font-bold uppercase",
                            isRam ? "text-blue-400" : "text-pink-400"
                        )}>
                            {animal?.sex || (label === "SIRE" ? "RAM" : label === "DAM" ? "EWE" : "—")}
                        </span>
                        {animal?.name && <span className="truncate">• '{animal.name}'</span>}
                    </div>
                    {animal?.birthDate && (
                        <div>DOB: {format(new Date(animal.birthDate), "dd/MM/yyyy")}</div>
                    )}
                    {label && !isSubject && (
                        <div className="text-primary font-bold uppercase">{label}</div>
                    )}
                </div>
            </div>
        </div>
    );
}

function PedigreeNodeSmall({ label, sublabel }: { label: string, sublabel: string }) {
    return (
        <div className="flex items-center gap-2 p-2 rounded-lg border border-dashed border-muted-foreground/20 bg-secondary/30">
            <div className="w-8 h-8 rounded-full bg-muted-foreground/10 border border-muted-foreground/20 flex items-center justify-center">
                <img src={logo} alt="placeholder" className="w-4 h-4 opacity-20 grayscale" />
            </div>
            <div className="text-[9px] text-muted-foreground">
                <div className="font-bold">{label}</div>
                <div className="opacity-70">{sublabel}</div>
            </div>
        </div>
    );
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

function BreedingStatsView({ animal }: { animal: AnimalWithRelations }) {
    const { data: breedingEvents, isLoading } = useAnimalBreedingEvents(animal.id, animal.sex);
    
    if (isLoading) return <Skeleton className="h-64 bg-secondary" />;
    
    const totalEvents = breedingEvents.length;
    const lambedEvents = breedingEvents.filter(e => e.lambingDate && e.lambCount && e.lambCount > 0);
    const totalLambs = lambedEvents.reduce((sum, e) => sum + (e.lambCount || 0), 0);
    
    const lambingDates = lambedEvents
        .map(e => e.lambingDate ? new Date(e.lambingDate) : null)
        .filter((d): d is Date => d !== null)
        .sort((a, b) => a.getTime() - b.getTime());
    
    const interLambingPeriods: number[] = [];
    for (let i = 1; i < lambingDates.length; i++) {
        const diff = Math.round((lambingDates[i].getTime() - lambingDates[i-1].getTime()) / (1000 * 60 * 60 * 24));
        interLambingPeriods.push(diff);
    }
    
    const avgInterLambing = interLambingPeriods.length > 0 
        ? Math.round(interLambingPeriods.reduce((a, b) => a + b, 0) / interLambingPeriods.length) 
        : 0;
    
    const avgLambsPerLambing = lambedEvents.length > 0 
        ? (totalLambs / lambedEvents.length).toFixed(1) 
        : "0";
    
    const fertilityRate = totalEvents > 0 
        ? ((lambedEvents.length / totalEvents) * 100).toFixed(0)
        : "0";
    
    const offspring: Animal[] = animal.offspringAsDam || [];
    const activeOffspring = offspring.filter((o: Animal) => o.status === "active");
    const soldOffspring = offspring.filter((o: Animal) => o.status === "sold");
    const deadOffspring = offspring.filter((o: Animal) => o.status === "dead" || o.status === "culled");
    const weanedOffspring = offspring.filter((o: Animal) => o.weaningStatus && o.weaningStatus !== "pre-weaning");
    const rearedOffspring = activeOffspring.length + soldOffspring.length;
    
    return (
        <Card className="bg-card rugged-card">
            <CardHeader><CardTitle className="text-lg">Breeding Statistics</CardTitle></CardHeader>
            <CardContent className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-secondary p-4 rounded-md text-center">
                        <div className="text-3xl font-black text-primary">{totalEvents}</div>
                        <div className="text-xs text-muted-foreground uppercase">Total Matings</div>
                    </div>
                    <div className="bg-secondary p-4 rounded-md text-center">
                        <div className="text-3xl font-black text-primary">{lambedEvents.length}</div>
                        <div className="text-xs text-muted-foreground uppercase">Lambings</div>
                    </div>
                    <div className="bg-secondary p-4 rounded-md text-center">
                        <div className="text-3xl font-black text-primary">{totalLambs}</div>
                        <div className="text-xs text-muted-foreground uppercase">Total Lambs Born</div>
                    </div>
                    <div className="bg-secondary p-4 rounded-md text-center">
                        <div className="text-3xl font-black text-primary">{avgLambsPerLambing}</div>
                        <div className="text-xs text-muted-foreground uppercase">Avg Lambs/Lambing</div>
                    </div>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-secondary p-4 rounded-md text-center">
                        <div className="text-3xl font-black text-primary">{fertilityRate}%</div>
                        <div className="text-xs text-muted-foreground uppercase">Fertility Rate</div>
                    </div>
                    <div className="bg-secondary p-4 rounded-md text-center">
                        <div className="text-3xl font-black text-green-500">{rearedOffspring}</div>
                        <div className="text-xs text-muted-foreground uppercase">Lambs Reared</div>
                    </div>
                    <div className="bg-secondary p-4 rounded-md text-center">
                        <div className="text-3xl font-black text-blue-500">{weanedOffspring.length}</div>
                        <div className="text-xs text-muted-foreground uppercase">Lambs Weaned</div>
                    </div>
                    <div className="bg-secondary p-4 rounded-md text-center">
                        <div className="text-3xl font-black text-red-500">{deadOffspring.length}</div>
                        <div className="text-xs text-muted-foreground uppercase">Lambs Lost</div>
                    </div>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-secondary p-4 rounded-md text-center">
                        <div className="text-3xl font-black text-green-500">{activeOffspring.length}</div>
                        <div className="text-xs text-muted-foreground uppercase">Active in Flock</div>
                    </div>
                    <div className="bg-secondary p-4 rounded-md text-center">
                        <div className="text-3xl font-black text-blue-500">{soldOffspring.length}</div>
                        <div className="text-xs text-muted-foreground uppercase">Sold</div>
                    </div>
                    <div className="bg-secondary p-4 rounded-md text-center">
                        <div className="text-3xl font-black text-primary">{avgInterLambing || "N/A"}</div>
                        <div className="text-xs text-muted-foreground uppercase">{avgInterLambing ? "Inter-Lamb Days" : "Inter-Lamb Period"}</div>
                    </div>
                    <div className="bg-secondary p-4 rounded-md text-center">
                        <div className="text-3xl font-black text-primary">{offspring.length}</div>
                        <div className="text-xs text-muted-foreground uppercase">Total Offspring</div>
                    </div>
                </div>
                
                <div>
                    <h4 className="font-bold mb-3 uppercase text-sm">Breeding History</h4>
                    {breedingEvents.length > 0 ? (
                        <div className="space-y-2">
                            {breedingEvents.map((event, idx) => (
                                <div key={event.id} className="flex items-center justify-between p-3 bg-secondary rounded-md">
                                    <div className="flex items-center gap-3">
                                        <span className="text-muted-foreground text-sm">#{idx + 1}</span>
                                        <div>
                                            <div className="font-bold">{event.matingDate ? format(new Date(event.matingDate), "dd MMM yyyy") : "Unknown"}</div>
                                            <div className="text-xs text-muted-foreground">{event.matingType}</div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        {event.lambingDate ? (
                                            <>
                                                <div className="text-sm text-green-500">{event.lambCount} lamb(s)</div>
                                                <div className="text-xs text-muted-foreground">{format(new Date(event.lambingDate), "dd MMM yyyy")}</div>
                                            </>
                                        ) : (
                                            <Badge variant="outline">Pending</Badge>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8 text-muted-foreground border-2 border-dashed border-border rounded-md">
                            <Heart className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <p>No breeding events recorded.</p>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

function ExportProfileButton({ animal, farmSettings }: { animal: AnimalWithRelations, farmSettings?: { farmName?: string | null, studName?: string | null, studPrefix?: string | null, ownerName?: string | null, membershipNumber?: string | null } | null }) {
    const { data: breedingEvents } = useAnimalBreedingEvents(animal.id, animal.sex);
    const { toast } = useToast();
    
    const getProfileData = () => {
        const offspring = animal.offspringAsDam || animal.offspringAsSire || [];
        const activeOffspring = offspring.filter((o: Animal) => o.status === "active");
        const soldOffspring = offspring.filter((o: Animal) => o.status === "sold");
        const deadOffspring = offspring.filter((o: Animal) => o.status === "dead" || o.status === "culled");
        const weanedOffspring = offspring.filter((o: Animal) => o.weaningStatus && o.weaningStatus !== "pre-weaning");
        const rearedOffspring = activeOffspring.length + soldOffspring.length;
        
        const lambedEvents = breedingEvents?.filter(e => e.lambingDate && e.lambCount && e.lambCount > 0) || [];
        const totalLambs = lambedEvents.reduce((sum, e) => sum + (e.lambCount || 0), 0);
        const totalMatings = breedingEvents?.length || 0;
        const fertilityRate = totalMatings > 0 ? ((lambedEvents.length / totalMatings) * 100).toFixed(1) : "0";
        
        return {
            exportDate: new Date().toISOString(),
            exportFormat: "SA Stamboek Compatible",
            generatedBy: "BreedLog",
            farmBranding: farmSettings ? {
                farmName: farmSettings.farmName,
                studName: farmSettings.studName,
                studPrefix: farmSettings.studPrefix,
                ownerName: farmSettings.ownerName,
                membershipNumber: farmSettings.membershipNumber,
            } : null,
            identification: {
                tagId: animal.tagId,
                name: animal.name,
                tattooId: animal.tattooId,
                electronicId: animal.electronicId,
                studPrefix: animal.studPrefix,
            },
            basicInfo: {
                sex: animal.sex,
                breed: animal.breed,
                status: animal.status,
                birthDate: animal.birthDate,
                birthStatus: animal.birthStatus,
            },
            parentage: {
                damId: animal.damId,
                damTagId: animal.dam?.tagId,
                damName: animal.dam?.name,
                externalDamInfo: animal.externalDamInfo,
                sireId: animal.sireId,
                sireTagId: animal.sire?.tagId,
                sireName: animal.sire?.name,
                externalSireInfo: animal.externalSireInfo,
            },
            weaningStatus: animal.weaningStatus,
            weights: {
                birthWeight: animal.birthWeight,
                currentWeight: animal.currentWeight,
                weight100Day: animal.weight100Day,
                weight100DayDate: animal.weight100DayDate,
                weight270Day: animal.weight270Day,
                weight270DayDate: animal.weight270DayDate,
            },
            ownership: {
                breederName: animal.breederName,
                ownerName: animal.ownerName,
                farmName: animal.farmName,
                location: animal.location,
            },
            breedingStats: animal.sex === "ewe" ? {
                totalMatings: totalMatings,
                totalLambings: lambedEvents.length,
                totalLambsBorn: totalLambs,
                fertilityRate: fertilityRate + "%",
                lambsReared: rearedOffspring,
                lambsWeaned: weanedOffspring.length,
                lambsActive: activeOffspring.length,
                lambsSold: soldOffspring.length,
                lambsLost: deadOffspring.length,
                avgLambsPerLambing: lambedEvents.length > 0 ? (totalLambs / lambedEvents.length).toFixed(2) : "0",
            } : null,
            breedingHistory: breedingEvents?.map(e => ({
                matingDate: e.matingDate,
                matingType: e.matingType,
                lambingDate: e.lambingDate,
                lambCount: e.lambCount,
                notes: e.notes,
            })) || [],
            notes: animal.notes,
        };
    };
    
    const downloadFile = (content: string, filename: string, type: string) => {
        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };
    
    const handleExportJSON = () => {
        const profileData = getProfileData();
        downloadFile(JSON.stringify(profileData, null, 2), `${animal.tagId}_profile_${new Date().toISOString().split('T')[0]}.json`, "application/json");
        toast({ title: "JSON Exported", description: `${animal.tagId} profile downloaded as JSON` });
    };
    
    const handleExportCSV = () => {
        const data = getProfileData();
        const rows = [
            ["Field", "Value"],
            ["Tag ID", data.identification.tagId || ""],
            ["Name", data.identification.name || ""],
            ["Sex", data.basicInfo.sex || ""],
            ["Breed", data.basicInfo.breed || ""],
            ["Status", data.basicInfo.status || ""],
            ["Birth Date", data.basicInfo.birthDate || ""],
            ["Electronic ID", data.identification.electronicId || ""],
            ["Tattoo ID", data.identification.tattooId || ""],
            ["Dam", data.parentage.damTagId || data.parentage.externalDamInfo || ""],
            ["Sire", data.parentage.sireTagId || data.parentage.externalSireInfo || ""],
            ["Birth Weight", data.weights.birthWeight || ""],
            ["Current Weight", data.weights.currentWeight || ""],
            ["100 Day Weight", data.weights.weight100Day || ""],
            ["270 Day Weight", data.weights.weight270Day || ""],
            ["Breeder", data.ownership.breederName || ""],
            ["Owner", data.ownership.ownerName || ""],
            ["Farm", data.farmBranding?.farmName || ""],
            ["Stud", data.farmBranding?.studName || ""],
        ];
        if (data.breedingStats) {
            rows.push(["Total Matings", String(data.breedingStats.totalMatings)]);
            rows.push(["Total Lambings", String(data.breedingStats.totalLambings)]);
            rows.push(["Total Lambs Born", String(data.breedingStats.totalLambsBorn)]);
            rows.push(["Fertility Rate", data.breedingStats.fertilityRate]);
        }
        const csvContent = rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
        downloadFile(csvContent, `${animal.tagId}_profile_${new Date().toISOString().split('T')[0]}.csv`, "text/csv");
        toast({ title: "CSV Exported", description: `${animal.tagId} profile downloaded as CSV` });
    };
    
    const handleExportWord = () => {
        const data = getProfileData();
        const content = `
ANIMAL PROFILE REPORT
Generated by BreedLog
Export Date: ${new Date().toLocaleDateString()}

═══════════════════════════════════════════
FARM INFORMATION
═══════════════════════════════════════════
Farm Name: ${data.farmBranding?.farmName || "N/A"}
Stud Name: ${data.farmBranding?.studName || "N/A"}
Stud Prefix: ${data.farmBranding?.studPrefix || "N/A"}
Owner: ${data.farmBranding?.ownerName || "N/A"}

═══════════════════════════════════════════
ANIMAL IDENTIFICATION
═══════════════════════════════════════════
Tag ID: ${data.identification.tagId || "N/A"}
Name: ${data.identification.name || "N/A"}
Electronic ID: ${data.identification.electronicId || "N/A"}
Tattoo ID: ${data.identification.tattooId || "N/A"}

═══════════════════════════════════════════
BASIC INFORMATION
═══════════════════════════════════════════
Sex: ${data.basicInfo.sex || "N/A"}
Breed: ${data.basicInfo.breed || "N/A"}
Status: ${data.basicInfo.status || "N/A"}
Birth Date: ${data.basicInfo.birthDate || "N/A"}

═══════════════════════════════════════════
PARENTAGE
═══════════════════════════════════════════
Dam: ${data.parentage.damTagId || data.parentage.externalDamInfo || "N/A"}
Sire: ${data.parentage.sireTagId || data.parentage.externalSireInfo || "N/A"}

═══════════════════════════════════════════
WEIGHTS
═══════════════════════════════════════════
Birth Weight: ${data.weights.birthWeight ? data.weights.birthWeight + " kg" : "N/A"}
Current Weight: ${data.weights.currentWeight ? data.weights.currentWeight + " kg" : "N/A"}
100-Day Weight: ${data.weights.weight100Day ? data.weights.weight100Day + " kg" : "N/A"}
270-Day Weight: ${data.weights.weight270Day ? data.weights.weight270Day + " kg" : "N/A"}
${data.breedingStats ? `
═══════════════════════════════════════════
BREEDING STATISTICS
═══════════════════════════════════════════
Total Matings: ${data.breedingStats.totalMatings}
Total Lambings: ${data.breedingStats.totalLambings}
Total Lambs Born: ${data.breedingStats.totalLambsBorn}
Fertility Rate: ${data.breedingStats.fertilityRate}
Lambs Reared: ${data.breedingStats.lambsReared}
Lambs Weaned: ${data.breedingStats.lambsWeaned}
` : ""}
═══════════════════════════════════════════
NOTES
═══════════════════════════════════════════
${data.notes || "No notes recorded."}
`;
        downloadFile(content, `${animal.tagId}_profile_${new Date().toISOString().split('T')[0]}.doc`, "application/msword");
        toast({ title: "Word Document Exported", description: `${animal.tagId} profile downloaded as Word document` });
    };
    
    const handleExportPDF = () => {
        const data = getProfileData();
        const formatDate = (dateStr: string | null | undefined) => {
            if (!dateStr) return "Not recorded";
            try {
                return format(new Date(dateStr), "dd/MM/yyyy");
            } catch {
                return dateStr;
            }
        };
        const content = `
<!DOCTYPE html>
<html>
<head>
<title>${data.identification.tagId} - Animal Profile</title>
<style>
body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; color: #333; max-width: 800px; margin: 0 auto; }
h1 { color: #FFC300; border-bottom: 3px solid #FFC300; padding-bottom: 15px; text-align: center; font-size: 28px; }
h2 { color: #333; margin-top: 35px; border-bottom: 2px solid #FFC300; padding-bottom: 8px; font-size: 18px; background: linear-gradient(90deg, #FFC300 0%, transparent 100%); padding-left: 10px; }
.row { display: flex; padding: 10px 0; border-bottom: 1px solid #eee; }
.row:nth-child(even) { background: #fafafa; }
.label { width: 220px; font-weight: bold; color: #555; }
.value { flex: 1; color: #222; }
.header { text-align: center; margin-bottom: 40px; padding: 20px; background: linear-gradient(135deg, #1a1a1a 0%, #333 100%); color: white; border-radius: 8px; }
.header h1 { color: #FFC300; border: none; margin: 0; }
.header p { color: #ccc; margin: 10px 0 0 0; }
.footer { margin-top: 50px; text-align: center; font-size: 12px; color: #999; border-top: 1px solid #eee; padding-top: 20px; }
.section { background: white; border-radius: 8px; padding: 15px 20px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
.highlight { background: #FFC300; color: #000; padding: 2px 8px; border-radius: 4px; font-weight: bold; }
@media print { body { padding: 20px; } .section { box-shadow: none; border: 1px solid #eee; } }
</style>
</head>
<body>
<div class="header">
<h1>${data.farmBranding?.studName || data.farmBranding?.farmName || "BreedLog"}</h1>
<p>Animal Profile Certificate - Generated ${formatDate(new Date().toISOString())}</p>
</div>

<div class="section">
<h2>Identification</h2>
<div class="row"><span class="label">Lamb/Animal ID:</span><span class="value"><span class="highlight">${data.identification.tagId || "Not recorded"}</span></span></div>
<div class="row"><span class="label">Name:</span><span class="value">${data.identification.name || "Not recorded"}</span></div>
<div class="row"><span class="label">Electronic ID:</span><span class="value">${data.identification.electronicId || "Not recorded"}</span></div>
<div class="row"><span class="label">Tattoo ID:</span><span class="value">${data.identification.tattooId || "Not recorded"}</span></div>
</div>

<div class="section">
<h2>Birth Information</h2>
<div class="row"><span class="label">Date of Birth:</span><span class="value">${formatDate(data.basicInfo.birthDate)}</span></div>
<div class="row"><span class="label">Birth Status:</span><span class="value">${data.basicInfo.birthStatus ? data.basicInfo.birthStatus.charAt(0).toUpperCase() + data.basicInfo.birthStatus.slice(1) : "Not recorded"}</span></div>
<div class="row"><span class="label">Sex:</span><span class="value">${data.basicInfo.sex ? data.basicInfo.sex.toUpperCase() : "Not recorded"}</span></div>
<div class="row"><span class="label">Breed:</span><span class="value">${data.basicInfo.breed || "Meatmaster"}</span></div>
<div class="row"><span class="label">Status:</span><span class="value">${data.basicInfo.status ? data.basicInfo.status.charAt(0).toUpperCase() + data.basicInfo.status.slice(1) : "Not recorded"}</span></div>
</div>

<div class="section">
<h2>Parentage</h2>
<div class="row"><span class="label">Sire (Father):</span><span class="value">${data.parentage.sireTagId || data.parentage.externalSireInfo || "Not recorded"}</span></div>
<div class="row"><span class="label">Dam (Mother):</span><span class="value">${data.parentage.damTagId || data.parentage.externalDamInfo || "Not recorded"}</span></div>
</div>

<div class="section">
<h2>Growth & Weaning</h2>
<div class="row"><span class="label">Birth Weight:</span><span class="value">${data.weights.birthWeight ? data.weights.birthWeight + " kg" : "Not recorded"}</span></div>
<div class="row"><span class="label">Current Weight:</span><span class="value">${data.weights.currentWeight ? data.weights.currentWeight + " kg" : "Not recorded"}</span></div>
<div class="row"><span class="label">100-Day Weigh Date:</span><span class="value">${formatDate(data.weights.weight100DayDate)}</span></div>
<div class="row"><span class="label">100-Day Weight:</span><span class="value">${data.weights.weight100Day ? data.weights.weight100Day + " kg" : "Not recorded"}</span></div>
<div class="row"><span class="label">270-Day Weight:</span><span class="value">${data.weights.weight270Day ? data.weights.weight270Day + " kg" : "Not recorded"}</span></div>
<div class="row"><span class="label">Weaning Status:</span><span class="value">${data.weaningStatus === "sibling_died_before_weaning" ? "Sibling died before weaning" : "Normal"}</span></div>
</div>

${data.breedingStats ? `
<div class="section">
<h2>Breeding Statistics</h2>
<div class="row"><span class="label">Total Matings:</span><span class="value">${data.breedingStats.totalMatings}</span></div>
<div class="row"><span class="label">Total Lambings:</span><span class="value">${data.breedingStats.totalLambings}</span></div>
<div class="row"><span class="label">Total Lambs Born:</span><span class="value">${data.breedingStats.totalLambsBorn}</span></div>
<div class="row"><span class="label">Fertility Rate:</span><span class="value">${data.breedingStats.fertilityRate}</span></div>
<div class="row"><span class="label">Lambs Reared:</span><span class="value">${data.breedingStats.lambsReared}</span></div>
<div class="row"><span class="label">Lambs Weaned:</span><span class="value">${data.breedingStats.lambsWeaned}</span></div>
</div>
` : ""}

<div class="footer">
<strong>Generated by BreedLog</strong><br>
Breed Smart. Farm Better.<br>
${data.farmBranding?.membershipNumber ? `Membership: ${data.farmBranding.membershipNumber}` : ""}
</div>
</body>
</html>`;
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(content);
            printWindow.document.close();
            printWindow.print();
        }
        toast({ title: "PDF Ready", description: `Print dialog opened for ${animal.tagId} profile` });
    };
    
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" data-testid="button-export-profile">
                    <Download className="w-4 h-4 mr-2" /> Export
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExportPDF} data-testid="export-pdf">
                    <FileText className="w-4 h-4 mr-2" /> Export as PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportWord} data-testid="export-word">
                    <FileText className="w-4 h-4 mr-2" /> Export as Word
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportCSV} data-testid="export-csv">
                    <FileText className="w-4 h-4 mr-2" /> Export as CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportJSON} data-testid="export-json">
                    <FileText className="w-4 h-4 mr-2" /> Export as JSON
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
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

function EditAnimalDialog({ animal, open, onOpenChange }: { animal: Animal, open: boolean, onOpenChange: (open: boolean) => void }) {
    const { mutate, isPending } = useUpdateAnimal();
    const { toast } = useToast();
    const { data: allAnimals } = useAnimals({});
    const cameraInputRef = useRef<HTMLInputElement>(null);
    const galleryInputRef = useRef<HTMLInputElement>(null);
    const evalDocInputRef = useRef<HTMLInputElement>(null);
    
    const [formData, setFormData] = useState({
        tagId: animal.tagId || "",
        name: animal.name || "",
        sex: animal.sex || "ewe",
        breed: animal.breed || "Meatmaster",
        status: animal.status || "active",
        birthDate: animal.birthDate || "",
        birthStatus: animal.birthStatus || "",
        birthWeight: animal.birthWeight || "",
        currentWeight: animal.currentWeight || "",
        weight100Day: animal.weight100Day || "",
        weight100DayDate: animal.weight100DayDate || "",
        weaningStatus: animal.weaningStatus || "",
        electronicId: animal.electronicId || "",
        tattooId: animal.tattooId || "",
        studPrefix: animal.studPrefix || "",
        damId: animal.damId,
        sireId: animal.sireId,
        externalDamInfo: animal.externalDamInfo || "",
        externalSireInfo: animal.externalSireInfo || "",
        breederName: animal.breederName || "",
        ownerName: animal.ownerName || "",
        farmName: animal.farmName || "",
        location: animal.location || "",
        notes: animal.notes || "",
        photo: animal.photo || null as string | null,
        evaluationDocument: animal.evaluationDocument || null as string | null,
    });
    const [photoPreview, setPhotoPreview] = useState<string | null>(animal.photo || null);
    const [evalDocName, setEvalDocName] = useState<string | null>(animal.evaluationDocument ? "Existing Document" : null);
    const [useCustomDam, setUseCustomDam] = useState(!!animal.externalDamInfo);
    const [useCustomSire, setUseCustomSire] = useState(!!animal.externalSireInfo);
    
    const ewes = allAnimals?.filter(a => a.sex === "ewe" && a.id !== animal.id) || [];
    const rams = allAnimals?.filter(a => a.sex === "ram" && a.id !== animal.id) || [];

    const compressImage = (file: File, maxWidth: number = 1200, quality: number = 0.8): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = document.createElement('img') as HTMLImageElement;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let { width, height } = img;
                    if (width > maxWidth) {
                        height = (height * maxWidth) / width;
                        width = maxWidth;
                    }
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) { reject(new Error('Could not get canvas context')); return; }
                    ctx.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', quality));
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
                toast({ title: "Processing...", description: "Compressing image" });
                const compressedBase64 = await compressImage(file, 1200, 0.8);
                setPhotoPreview(compressedBase64);
                setFormData(prev => ({ ...prev, photo: compressedBase64 }));
                toast({ title: "Photo ready", description: "Image compressed" });
            } catch {
                toast({ title: "Error", description: "Failed to process image", variant: "destructive" });
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
                setEvalDocName(file.name);
                setFormData(prev => ({ ...prev, evaluationDocument: base64 }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = () => {
        // Clean up empty strings for date fields to avoid database errors
        const cleanedData = {
            ...formData,
            birthDate: formData.birthDate || null,
            weight100DayDate: formData.weight100DayDate || null,
            birthWeight: formData.birthWeight || null,
            currentWeight: formData.currentWeight || null,
            weight100Day: formData.weight100Day || null,
            birthStatus: formData.birthStatus || null,
            weaningStatus: formData.weaningStatus || null,
        };
        
        mutate({ id: animal.id, ...cleanedData }, {
            onSuccess: () => {
                onOpenChange(false);
                toast({ title: "Animal updated", description: "Changes saved successfully" });
            },
            onError: (error) => {
                console.error("Update error:", error);
                toast({ title: "Error", description: "Failed to save changes", variant: "destructive" });
            }
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="bg-card border-border max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="font-display uppercase text-2xl">Edit Animal</DialogTitle>
                </DialogHeader>
                
                <div className="space-y-4">
                    {/* Photo Section */}
                    <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handlePhotoCapture} className="hidden" />
                    <input ref={galleryInputRef} type="file" accept="image/*" onChange={handlePhotoCapture} className="hidden" />
                    
                    {photoPreview ? (
                        <div className="relative">
                            <img src={photoPreview} alt="Animal" className="w-full h-48 object-cover rounded-md border border-border" />
                            <div className="absolute top-2 right-2 flex gap-1">
                                <Button type="button" variant="secondary" size="icon" onClick={() => galleryInputRef.current?.click()} data-testid="button-change-photo">
                                    <Image className="w-4 h-4" />
                                </Button>
                                <Button type="button" variant="destructive" size="icon" onClick={() => { setPhotoPreview(null); setFormData(prev => ({...prev, photo: null})); }} data-testid="button-clear-photo">
                                    <X className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-2">
                            <Button type="button" variant="outline" className="border-dashed" onClick={() => cameraInputRef.current?.click()} data-testid="button-take-photo"><Camera className="w-4 h-4 mr-2" /> Camera</Button>
                            <Button type="button" variant="outline" className="border-dashed" onClick={() => galleryInputRef.current?.click()} data-testid="button-select-gallery"><Image className="w-4 h-4 mr-2" /> Gallery</Button>
                        </div>
                    )}

                    {/* Basic Info */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Tag ID</Label>
                            <Input value={formData.tagId} onChange={(e) => setFormData(prev => ({...prev, tagId: e.target.value}))} className="rugged-input" data-testid="input-edit-tag-id" />
                        </div>
                        <div>
                            <Label>Name</Label>
                            <Input value={formData.name} onChange={(e) => setFormData(prev => ({...prev, name: e.target.value}))} className="rugged-input" data-testid="input-edit-name" />
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <Label>Sex</Label>
                            <Select value={formData.sex} onValueChange={(val) => setFormData(prev => ({...prev, sex: val}))}>
                                <SelectTrigger className="rugged-input" data-testid="select-edit-sex"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ram">Ram</SelectItem>
                                    <SelectItem value="ewe">Ewe</SelectItem>
                                    <SelectItem value="wether">Wether</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Status</Label>
                            <Select value={formData.status} onValueChange={(val) => setFormData(prev => ({...prev, status: val}))}>
                                <SelectTrigger className="rugged-input" data-testid="select-edit-status"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="active">Active</SelectItem>
                                    <SelectItem value="sold">Sold</SelectItem>
                                    <SelectItem value="dead">Dead</SelectItem>
                                    <SelectItem value="culled">Culled</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Birth Status</Label>
                            <Select value={formData.birthStatus || "unknown"} onValueChange={(val) => setFormData(prev => ({...prev, birthStatus: val === "unknown" ? "" : val}))}>
                                <SelectTrigger className="rugged-input" data-testid="select-edit-birth-status"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="unknown">Unknown</SelectItem>
                                    <SelectItem value="single">Single</SelectItem>
                                    <SelectItem value="twin">Twin</SelectItem>
                                    <SelectItem value="triplet">Triplet</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Birth Date</Label>
                            <Input type="date" value={formData.birthDate || ""} onChange={(e) => setFormData(prev => ({...prev, birthDate: e.target.value}))} className="rugged-input" data-testid="input-edit-birth-date" />
                        </div>
                        <div>
                            <Label>Current Weight (kg)</Label>
                            <Input type="number" step="0.1" value={formData.currentWeight} onChange={(e) => setFormData(prev => ({...prev, currentWeight: e.target.value}))} className="rugged-input" data-testid="input-edit-weight" />
                        </div>
                    </div>

                    {/* IDs */}
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <Label>Electronic ID</Label>
                            <Input value={formData.electronicId} onChange={(e) => setFormData(prev => ({...prev, electronicId: e.target.value}))} className="rugged-input" placeholder="RFID" data-testid="input-edit-electronic-id" />
                        </div>
                        <div>
                            <Label>Tattoo ID</Label>
                            <Input value={formData.tattooId} onChange={(e) => setFormData(prev => ({...prev, tattooId: e.target.value}))} className="rugged-input" data-testid="input-edit-tattoo-id" />
                        </div>
                        <div>
                            <Label>Stud Prefix</Label>
                            <Input value={formData.studPrefix} onChange={(e) => setFormData(prev => ({...prev, studPrefix: e.target.value}))} className="rugged-input" data-testid="input-edit-stud-prefix" />
                        </div>
                    </div>

                    {/* Dam */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label>Dam (Mother)</Label>
                            <Button type="button" variant="ghost" size="sm" onClick={() => { setUseCustomDam(!useCustomDam); if (!useCustomDam) setFormData(prev => ({...prev, damId: null})); else setFormData(prev => ({...prev, externalDamInfo: ""})); }} data-testid="button-toggle-dam-mode">
                                {useCustomDam ? "Select from list" : "Not in system"}
                            </Button>
                        </div>
                        {useCustomDam ? (
                            <Input value={formData.externalDamInfo} onChange={(e) => setFormData(prev => ({...prev, externalDamInfo: e.target.value}))} placeholder="Enter dam info" className="rugged-input" data-testid="input-edit-external-dam" />
                        ) : (
                            <Select value={formData.damId ? String(formData.damId) : "none"} onValueChange={(val) => setFormData(prev => ({...prev, damId: val === "none" ? null : parseInt(val)}))}>
                                <SelectTrigger className="rugged-input" data-testid="select-edit-dam"><SelectValue placeholder="Select dam" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Unknown</SelectItem>
                                    {ewes.map(ewe => <SelectItem key={ewe.id} value={String(ewe.id)}>{ewe.tagId} {ewe.name ? `- ${ewe.name}` : ''}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        )}
                    </div>

                    {/* Sire */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label>Sire (Father)</Label>
                            <Button type="button" variant="ghost" size="sm" onClick={() => { setUseCustomSire(!useCustomSire); if (!useCustomSire) setFormData(prev => ({...prev, sireId: null})); else setFormData(prev => ({...prev, externalSireInfo: ""})); }} data-testid="button-toggle-sire-mode">
                                {useCustomSire ? "Select from list" : "Not in system"}
                            </Button>
                        </div>
                        {useCustomSire ? (
                            <Input value={formData.externalSireInfo} onChange={(e) => setFormData(prev => ({...prev, externalSireInfo: e.target.value}))} placeholder="Enter sire info" className="rugged-input" data-testid="input-edit-external-sire" />
                        ) : (
                            <Select value={formData.sireId ? String(formData.sireId) : "none"} onValueChange={(val) => setFormData(prev => ({...prev, sireId: val === "none" ? null : parseInt(val)}))}>
                                <SelectTrigger className="rugged-input" data-testid="select-edit-sire"><SelectValue placeholder="Select sire" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Unknown</SelectItem>
                                    {rams.map(ram => <SelectItem key={ram.id} value={String(ram.id)}>{ram.tagId} {ram.name ? `- ${ram.name}` : ''}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        )}
                    </div>

                    {/* Ownership */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Breeder</Label>
                            <Input value={formData.breederName} onChange={(e) => setFormData(prev => ({...prev, breederName: e.target.value}))} className="rugged-input" data-testid="input-edit-breeder" />
                        </div>
                        <div>
                            <Label>Owner</Label>
                            <Input value={formData.ownerName} onChange={(e) => setFormData(prev => ({...prev, ownerName: e.target.value}))} className="rugged-input" data-testid="input-edit-owner" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Farm Name</Label>
                            <Input value={formData.farmName} onChange={(e) => setFormData(prev => ({...prev, farmName: e.target.value}))} className="rugged-input" data-testid="input-edit-farm" />
                        </div>
                        <div>
                            <Label>Location/Camp</Label>
                            <Input value={formData.location} onChange={(e) => setFormData(prev => ({...prev, location: e.target.value}))} className="rugged-input" data-testid="input-edit-location" />
                        </div>
                    </div>

                    {/* Notes */}
                    <div>
                        <Label>Notes</Label>
                        <Textarea value={formData.notes} onChange={(e) => setFormData(prev => ({...prev, notes: e.target.value}))} className="rugged-input min-h-[80px]" data-testid="input-edit-notes" />
                    </div>

                    {/* Evaluation Document */}
                    <input ref={evalDocInputRef} type="file" accept="image/*,.pdf" onChange={handleEvalDocUpload} className="hidden" />
                    
                    {evalDocName ? (
                        <div className="flex items-center justify-between p-3 bg-secondary rounded-md border border-border">
                            <div className="flex items-center gap-2">
                                <FileText className="w-5 h-5 text-primary" />
                                <span className="text-sm truncate max-w-[200px]">{evalDocName}</span>
                            </div>
                            <div className="flex gap-1">
                                <Button type="button" variant="ghost" size="icon" onClick={() => evalDocInputRef.current?.click()} data-testid="button-change-eval-doc"><Upload className="w-4 h-4" /></Button>
                                <Button type="button" variant="ghost" size="icon" onClick={() => { setEvalDocName(null); setFormData(prev => ({...prev, evaluationDocument: null})); }} data-testid="button-clear-eval-doc"><X className="w-4 h-4" /></Button>
                            </div>
                        </div>
                    ) : (
                        <Button type="button" variant="outline" className="w-full border-dashed" onClick={() => evalDocInputRef.current?.click()} data-testid="button-upload-eval-doc">
                            <FileText className="w-4 h-4 mr-2" /> Attach Evaluation Document
                        </Button>
                    )}

                    <Button onClick={handleSubmit} disabled={isPending} className="w-full rugged-btn bg-primary text-black" data-testid="button-save-edit">
                        {isPending ? "Saving..." : "Save Changes"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
