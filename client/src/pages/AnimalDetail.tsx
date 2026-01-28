import { useRoute } from "wouter";
import { useAnimal, useFamilyTree, useUpdateAnimal, useAnimals, useAnimalImages, useUploadAnimalImage, useDeleteAnimalImage } from "@/hooks/use-animals";
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
      <div className="space-y-3 md:space-y-6 animate-in fade-in duration-500 abstract-bg">
        {/* Clean Modern Header */}
        <div className="space-y-3">
          {/* Top row: Back + Title + Inline Buttons */}
          <div className="flex items-center gap-3">
            <Link href="/animals">
              <Button variant="ghost" size="icon" className="shrink-0" data-testid="button-back">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <h1 className="text-xl md:text-2xl font-bold flex-1 truncate">{animal.tagId}</h1>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm"
                className="h-8 px-3 text-xs font-semibold"
                onClick={() => setIsEditOpen(true)}
                data-testid="button-edit-animal"
              >
                <Edit className="w-3.5 h-3.5 mr-1.5" /> Edit
              </Button>
              <ExportProfileButton animal={animal} farmSettings={farmSettings} />
            </div>
          </div>
          
          {/* Badges row */}
          <div className="flex items-center gap-2 flex-wrap pl-11">
            <Badge className="text-[10px] uppercase font-bold bg-primary/20 text-primary border border-primary/40">
              {animal.sex}
            </Badge>
            <Badge variant={animal.status === 'active' ? 'default' : 'destructive'} className="text-[10px] uppercase font-bold">
              {animal.status}
            </Badge>
            <span className="text-xs text-muted-foreground">{animal.name || "Unnamed"} • {animal.breed}</span>
          </div>
        </div>
        
        <EditAnimalDialog animal={animal} open={isEditOpen} onOpenChange={setIsEditOpen} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-8">
          {/* Main Info Card - Compact on Mobile */}
          <div className="lg:col-span-1 space-y-3 md:space-y-6">
            <Card className="rugged-card overflow-hidden">
                <div className="aspect-video md:aspect-square bg-secondary relative">
                    <img src={animal.photo || logo} className={animal.photo ? "w-full h-full object-cover" : "w-1/3 md:w-1/2 h-1/3 md:h-1/2 absolute top-1/3 md:top-1/4 left-1/3 md:left-1/4 opacity-20 grayscale"} />
                </div>
                <CardContent className="p-3 md:p-6 space-y-1 md:space-y-3">
                    <InfoRow label="Electronic ID" value={animal.electronicId || "N/A"} />
                    <InfoRow label="Birth Date" value={animal.birthDate ? format(new Date(animal.birthDate), "dd MMM yyyy") : "N/A"} />
                    <InfoRow label="Current Weight" value={animal.currentWeight ? `${animal.currentWeight} kg` : "N/A"} />
                    <InfoRow label="Breeder" value={animal.breederName || "Self"} />
                    <InfoRow label="Profile Entry" value={animal.createdAt ? format(new Date(animal.createdAt), "dd MMM yyyy") : "N/A"} testId="text-entry-date" />
                    <div className="pt-2 md:pt-4 border-t border-border">
                        <Label className="text-muted-foreground text-[10px] md:text-xs uppercase">Notes</Label>
                        <p className="text-xs md:text-sm mt-1">{animal.notes || "No notes recorded."}</p>
                    </div>
                </CardContent>
            </Card>
          </div>

          {/* Tabs Section */}
          <div className="lg:col-span-2">
            <Tabs defaultValue="pedigree" className="w-full">
              <TabsList className="w-full bg-card border border-border h-9 md:h-12 flex-wrap">
                <TabsTrigger value="pedigree" data-testid="tab-pedigree" className="flex-1 uppercase font-medium text-[10px] md:text-xs px-1 md:px-3"><Dna className="w-3 h-3 md:w-4 md:h-4 mr-0.5 md:mr-1" /> <span className="hidden xs:inline">Pedigree</span><span className="xs:hidden">Ped</span></TabsTrigger>
                {animal.sex === "ewe" && (
                  <TabsTrigger value="breeding" data-testid="tab-breeding" className="flex-1 uppercase font-medium text-[10px] md:text-xs px-1 md:px-3"><Heart className="w-3 h-3 md:w-4 md:h-4 mr-0.5 md:mr-1" /> <span className="hidden xs:inline">Breeding</span><span className="xs:hidden">Bred</span></TabsTrigger>
                )}
                <TabsTrigger value="performance" data-testid="tab-weights" className="flex-1 uppercase font-medium text-[10px] md:text-xs px-1 md:px-3"><Scale className="w-3 h-3 md:w-4 md:h-4 mr-0.5 md:mr-1" /> <span className="hidden xs:inline">Weights</span><span className="xs:hidden">Wt</span></TabsTrigger>
                <TabsTrigger value="health" data-testid="tab-health" className="flex-1 uppercase font-medium text-[10px] md:text-xs px-1 md:px-3"><Syringe className="w-3 h-3 md:w-4 md:h-4 mr-0.5 md:mr-1" /> <span className="hidden xs:inline">Health</span><span className="xs:hidden">Hlth</span></TabsTrigger>
                <TabsTrigger value="evaluations" data-testid="tab-evaluations" className="flex-1 uppercase font-medium text-[10px] md:text-xs px-1 md:px-3"><FileText className="w-3 h-3 md:w-4 md:h-4 mr-0.5 md:mr-1" /> Eval</TabsTrigger>
                <TabsTrigger value="images" data-testid="tab-images" className="flex-1 uppercase font-medium text-[10px] md:text-xs px-1 md:px-3"><Image className="w-3 h-3 md:w-4 md:h-4 mr-0.5 md:mr-1" /> Images</TabsTrigger>
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

              <TabsContent value="images" className="mt-4">
                 <ImagesView animalId={animal.id} />
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
        <div className="flex justify-between items-center py-1.5 md:py-2 border-b border-border/50 last:border-0">
            <span className="text-xs md:text-sm text-muted-foreground">{label}</span>
            <span className="text-xs md:text-sm font-semibold text-foreground" data-testid={testId}>{value}</span>
        </div>
    )
}

function PedigreeView({ animal }: { animal: any }) {
    const { data: tree } = useFamilyTree(animal.id);
    
    return (
        <Card className="bg-gradient-to-br from-card via-card to-secondary/20 rugged-card overflow-hidden">
            <CardHeader className="border-b border-border/50 bg-secondary/50">
                <CardTitle className="text-lg flex items-center gap-2">
                    <Dna className="w-5 h-5 text-primary" />
                    <span>BLOODLINE</span>
                    <span className="text-primary font-black ml-1">- ELITE PEDIGREE</span>
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">Pinch to zoom • Swipe to pan</p>
            </CardHeader>
            <CardContent className="p-2 md:p-4">
                <div className="overflow-auto touch-pan-x touch-pan-y" style={{ maxHeight: '400px' }}>
                    <div className="min-w-[500px] flex items-center gap-3 py-3 px-2 origin-top-left" style={{ transform: 'scale(0.85)', transformOrigin: 'top left' }}>
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

function ExportProfileButton({ animal, farmSettings }: { animal: AnimalWithRelations, farmSettings?: { farmName?: string | null, studName?: string | null, studPrefix?: string | null, ownerName?: string | null, ownerEmail?: string | null, ownerPhone?: string | null, farmLocation?: string | null, farmAddress?: string | null, membershipNumber?: string | null, registrationNumber?: string | null, logoUrl?: string | null, logoSize?: string | null, logoWidth?: number | null, logoHeight?: number | null } | null }) {
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
                ownerEmail: farmSettings.ownerEmail,
                ownerPhone: farmSettings.ownerPhone,
                farmLocation: farmSettings.farmLocation,
                farmAddress: farmSettings.farmAddress,
                membershipNumber: farmSettings.membershipNumber,
                registrationNumber: farmSettings.registrationNumber,
                logoUrl: farmSettings.logoUrl,
                logoSize: farmSettings.logoSize,
                logoWidth: farmSettings.logoWidth,
                logoHeight: farmSettings.logoHeight,
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
        
        const farmHeader = data.farmBranding ? [
            ["=== FARM/STUD BRANDING ===", ""],
            ["Farm Name", data.farmBranding.farmName || ""],
            ["Stud Name", data.farmBranding.studName || ""],
            ["Owner", data.farmBranding.ownerName || ""],
            ["Phone", data.farmBranding.ownerPhone || ""],
            ["Email", data.farmBranding.ownerEmail || ""],
            ["Location", data.farmBranding.farmLocation || ""],
            ["Membership No", data.farmBranding.membershipNumber || ""],
            ["Registration No", data.farmBranding.registrationNumber || ""],
            ["", ""],
            ["=== ANIMAL PROFILE ===", ""],
        ] : [];
        
        const rows = [
            ...farmHeader,
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
        ];
        if (data.breedingStats) {
            rows.push(["", ""]);
            rows.push(["=== BREEDING STATISTICS ===", ""]);
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
Phone: ${data.farmBranding?.ownerPhone || "N/A"}
Email: ${data.farmBranding?.ownerEmail || "N/A"}
Location: ${data.farmBranding?.farmLocation || "N/A"}
Membership No: ${data.farmBranding?.membershipNumber || "N/A"}
Registration No: ${data.farmBranding?.registrationNumber || "N/A"}
Logo: ${data.farmBranding?.logoUrl ? "[Embedded in document]" : "N/A"}

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
    
    const handleExportPDF = (includeTree: boolean = false) => {
        const data = getProfileData();
        const formatDate = (dateStr: string | null | undefined) => {
            if (!dateStr) return "Not recorded";
            try {
                return format(new Date(dateStr), "dd/MM/yyyy");
            } catch {
                return dateStr;
            }
        };
        
        const fb = data.farmBranding;
        const exportDate = format(new Date(), "dd/MM/yyyy HH:mm");
        
        // Page 1: Main Profile with large centered image
        const page1 = `
<div class="page portrait">
  <div class="header">
    <div class="header-left">
      ${fb?.logoUrl ? `<img src="${fb.logoUrl}" class="logo" alt="Farm Logo" />` : ''}
    </div>
    <div class="header-center">
      <h1>${fb?.studName || fb?.farmName || "BreedLog"}</h1>
      <p class="subtitle">Individual Animal Record</p>
    </div>
    <div class="header-right">
      <p>${exportDate}</p>
    </div>
  </div>
  
  <!-- Large Centered Animal Photo -->
  <div class="photo-section">
    ${animal.photo 
      ? `<img src="${animal.photo}" class="animal-photo" alt="${data.identification.tagId}" />`
      : `<div class="no-photo">No Photo Available</div>`
    }
  </div>
  
  <!-- Title Below Image -->
  <h2 class="record-title">Individual Animal Record</h2>
  
  <!-- Detail Table - Full Details -->
  <table class="detail-table">
    <tr><td class="section-header" colspan="2">IDENTIFICATION</td></tr>
    <tr><td class="label">Animal ID</td><td class="value"><strong>${data.identification.tagId || "—"}</strong></td></tr>
    <tr><td class="label">Name</td><td class="value">${data.identification.name || "—"}</td></tr>
    <tr><td class="label">Electronic ID</td><td class="value">${data.identification.electronicId || "—"}</td></tr>
    <tr><td class="label">Tattoo ID</td><td class="value">${data.identification.tattooId || "—"}</td></tr>
    <tr><td class="label">Stud Prefix</td><td class="value">${data.identification.studPrefix || "—"}</td></tr>
    
    <tr><td class="section-header" colspan="2">BASIC INFORMATION</td></tr>
    <tr><td class="label">Sex</td><td class="value">${data.basicInfo.sex ? data.basicInfo.sex.toUpperCase() : "—"}</td></tr>
    <tr><td class="label">Breed</td><td class="value">${data.basicInfo.breed || "Meatmaster"}</td></tr>
    <tr><td class="label">Date of Birth</td><td class="value">${formatDate(data.basicInfo.birthDate)}</td></tr>
    <tr><td class="label">Birth Status</td><td class="value">${data.basicInfo.birthStatus ? data.basicInfo.birthStatus.charAt(0).toUpperCase() + data.basicInfo.birthStatus.slice(1) : "—"}</td></tr>
    <tr><td class="label">Current Status</td><td class="value">${data.basicInfo.status ? data.basicInfo.status.charAt(0).toUpperCase() + data.basicInfo.status.slice(1) : "—"}</td></tr>
    
    <tr><td class="section-header" colspan="2">PARENTAGE</td></tr>
    <tr><td class="label">Sire (Father)</td><td class="value">${data.parentage.sireTagId || data.parentage.externalSireInfo || "—"}</td></tr>
    <tr><td class="label">Dam (Mother)</td><td class="value">${data.parentage.damTagId || data.parentage.externalDamInfo || "—"}</td></tr>
    
    <tr><td class="section-header" colspan="2">GROWTH DATA</td></tr>
    <tr><td class="label">Birth Weight</td><td class="value">${data.weights.birthWeight ? data.weights.birthWeight + " kg" : "—"}</td></tr>
    <tr><td class="label">Current Weight</td><td class="value">${data.weights.currentWeight ? data.weights.currentWeight + " kg" : "—"}</td></tr>
    <tr><td class="label">100-Day Weigh Date</td><td class="value">${formatDate(data.weights.weight100DayDate)}</td></tr>
    <tr><td class="label">100-Day Weight</td><td class="value">${data.weights.weight100Day ? data.weights.weight100Day + " kg" : "—"}</td></tr>
    <tr><td class="label">270-Day Weigh Date</td><td class="value">${data.weights.weight270DayDate ? formatDate(data.weights.weight270DayDate) : "—"}</td></tr>
    <tr><td class="label">270-Day Weight</td><td class="value">${data.weights.weight270Day ? data.weights.weight270Day + " kg" : "—"}</td></tr>
    <tr><td class="label">Weaning Status</td><td class="value">${data.weaningStatus || "—"}</td></tr>
    
    <tr><td class="section-header" colspan="2">OWNERSHIP</td></tr>
    <tr><td class="label">Breeder</td><td class="value">${data.ownership.breederName || "—"}</td></tr>
    <tr><td class="label">Owner</td><td class="value">${data.ownership.ownerName || "—"}</td></tr>
    <tr><td class="label">Farm</td><td class="value">${data.ownership.farmName || "—"}</td></tr>
    <tr><td class="label">Location</td><td class="value">${data.ownership.location || "—"}</td></tr>
  </table>
  
  <div class="footer">
    <div class="footer-info">
      <p class="footer-title">${fb?.studName || fb?.farmName || "BreedLog"}</p>
      <p>${fb?.ownerName || ""} ${fb?.ownerPhone ? "| " + fb.ownerPhone : ""}</p>
    </div>
    <div class="footer-branding">
      <p class="breedlog-text">BREEDLOG</p>
      <p class="tagline">Professional Livestock Management</p>
    </div>
  </div>
</div>`;

        // Page 2: Family Tree (Landscape) - only if requested
        const buildFamilyTreePage = () => {
            const sire = animal.sire;
            const dam = animal.dam;
            
            return `
<div class="page landscape">
  <div class="header">
    <div class="header-left">
      ${fb?.logoUrl ? `<img src="${fb.logoUrl}" class="logo" alt="Farm Logo" />` : ''}
    </div>
    <div class="header-center">
      <h1>${fb?.studName || fb?.farmName || "BreedLog"}</h1>
      <p class="subtitle">Family Tree / Pedigree Certificate</p>
    </div>
    <div class="header-right">
      <p>${exportDate}</p>
    </div>
  </div>
  
  <h2 class="tree-title">Pedigree for: ${data.identification.tagId} ${data.identification.name ? `(${data.identification.name})` : ''}</h2>
  
  <div class="pedigree-container">
    <div class="pedigree-tree">
      <!-- Subject (Center Left) with Photo -->
      <div class="pedigree-subject">
        <div class="pedigree-box subject-box">
          ${animal.photo 
            ? `<img src="${animal.photo}" class="subject-thumbnail" alt="${data.identification.tagId}" />`
            : ''
          }
          <div class="box-label">SUBJECT</div>
          <div class="box-id">${data.identification.tagId}</div>
          <div class="box-details">${data.basicInfo.sex?.toUpperCase() || ""} | ${data.basicInfo.breed || "Meatmaster"}</div>
          <div class="box-details">${formatDate(data.basicInfo.birthDate)}</div>
        </div>
      </div>
      
      <!-- Parents Column -->
      <div class="pedigree-parents">
        <div class="pedigree-box sire-box">
          <div class="box-label">SIRE</div>
          <div class="box-id">${sire?.tagId || data.parentage.externalSireInfo || "Unknown"}</div>
          ${sire?.name ? `<div class="box-details">${sire.name}</div>` : ''}
        </div>
        <div class="pedigree-connector"></div>
        <div class="pedigree-box dam-box">
          <div class="box-label">DAM</div>
          <div class="box-id">${dam?.tagId || data.parentage.externalDamInfo || "Unknown"}</div>
          ${dam?.name ? `<div class="box-details">${dam.name}</div>` : ''}
        </div>
      </div>
    </div>
  </div>
  
  <div class="footer">
    <div class="footer-info">
      <p class="footer-title">${fb?.studName || fb?.farmName || "BreedLog"}</p>
      <p>${fb?.ownerName || ""} ${fb?.ownerPhone ? "| " + fb.ownerPhone : ""}</p>
    </div>
    <div class="footer-branding">
      <p class="breedlog-text">BREEDLOG</p>
      <p class="tagline">Professional Livestock Management</p>
    </div>
  </div>
</div>`;
        };
        
        const content = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>${data.identification.tagId} - Individual Animal Record</title>
<style>
@page { size: A4 portrait; margin: 10mm; }
@page landscape { size: A4 landscape; margin: 10mm; }
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 9pt; color: #1a1a1a; background: white; }

.page { width: 190mm; min-height: 277mm; padding: 6mm; padding-bottom: 28mm; margin: 0 auto; page-break-after: always; position: relative; }
.page:last-child { page-break-after: avoid; }
.page.landscape { width: 277mm; min-height: 190mm; }

.header { display: flex; align-items: center; justify-content: space-between; padding: 0 2mm 4mm 2mm; border-bottom: 2px solid #FFC300; margin-bottom: 5mm; }
.header-left { width: 60px; flex-shrink: 0; }
.logo { width: 50px; height: 50px; object-fit: contain; }
.header-center { flex: 1; text-align: center; }
.header-center h1 { font-size: 14pt; font-weight: 800; color: #1a1a1a; text-transform: uppercase; letter-spacing: 1px; margin: 0; }
.header-center .subtitle { font-size: 8pt; color: #666; margin-top: 3px; }
.header-right { text-align: right; font-size: 8pt; color: #666; flex-shrink: 0; }

.photo-section { text-align: center; margin: 10mm 0; }
.animal-photo { max-width: 120mm; max-height: 100mm; object-fit: contain; border: 2px solid #ddd; border-radius: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
.no-photo { width: 120mm; height: 80mm; margin: 0 auto; background: #f5f5f5; border: 2px dashed #ccc; border-radius: 6px; display: flex; align-items: center; justify-content: center; color: #999; font-size: 12pt; }

.record-title { text-align: center; font-size: 14pt; font-weight: 700; color: #1a1a1a; margin: 6mm 0 4mm 0; text-transform: uppercase; letter-spacing: 1px; }

.detail-table { width: 100%; border-collapse: collapse; margin-top: 4mm; }
.detail-table td { padding: 6px 10px; border-bottom: 1px solid #e0e0e0; font-size: 8pt; text-align: left; vertical-align: middle; }
.detail-table tr:nth-child(even) { background: #fafafa; }
.detail-table .label { width: 45%; font-weight: 600; color: #555; }
.detail-table .value { color: #222; }
.detail-table .section-header { background: #FFC300; color: #000; font-weight: 700; font-size: 8pt; text-transform: uppercase; padding: 6px 10px; }

.tree-title { text-align: center; font-size: 12pt; font-weight: 700; color: #1a1a1a; margin: 4mm 0 6mm 0; }

.pedigree-container { padding: 10mm; }
.pedigree-tree { display: flex; align-items: center; justify-content: center; gap: 30mm; }
.pedigree-subject, .pedigree-parents { display: flex; flex-direction: column; gap: 8mm; }
.pedigree-box { border: 2px solid #FFC300; border-radius: 6px; padding: 8px 12px; min-width: 80mm; background: white; text-align: center; }
.subject-box { background: linear-gradient(135deg, #FFC300 0%, #ffdb4d 100%); }
.subject-thumbnail { width: 60px; height: 60px; object-fit: cover; border-radius: 6px; border: 2px solid #fff; box-shadow: 0 2px 4px rgba(0,0,0,0.2); margin-bottom: 6px; }
.sire-box { border-color: #3b82f6; }
.dam-box { border-color: #ec4899; }
.box-label { font-size: 8pt; font-weight: 700; text-transform: uppercase; color: #666; margin-bottom: 3px; }
.box-id { font-size: 14pt; font-weight: 800; color: #1a1a1a; }
.box-details { font-size: 9pt; color: #555; margin-top: 2px; }
.pedigree-connector { width: 2px; height: 15mm; background: #ccc; margin: 0 auto; }

.footer { display: flex; align-items: center; justify-content: space-between; border-top: 2px solid #FFC300; background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%); color: white; padding: 4mm 5mm; border-radius: 2mm; position: absolute; bottom: 6mm; left: 6mm; right: 6mm; }
.footer-info { flex: 1; }
.footer-title { font-size: 9pt; font-weight: 700; color: #FFC300; margin: 0; }
.footer-info p { font-size: 7pt; margin-top: 2px; }
.footer-branding { text-align: right; display: flex; flex-direction: column; align-items: flex-end; }
.footer-branding .breedlog-text { font-size: 11pt; font-weight: 800; color: white; letter-spacing: 1px; margin: 0; }
.footer-branding .tagline { font-size: 7pt; font-style: italic; color: #FFC300; margin-top: 2px; }

@page landscape { size: A4 landscape; margin: 10mm; }
@media print { 
  .page { page-break-after: always; }
  .page:last-child { page-break-after: avoid; }
  .page.landscape { page: landscape; }
}
</style>
</head>
<body>
${page1}
${includeTree ? buildFamilyTreePage() : ''}
</body>
</html>`;
        
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(content);
            printWindow.document.close();
            setTimeout(() => printWindow.print(), 500);
        }
        toast({ title: "PDF Ready", description: `Print dialog opened for ${animal.tagId} profile${includeTree ? ' with family tree' : ''}` });
    };
    
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 px-3 text-xs font-semibold" data-testid="button-export-profile">
                    <Download className="w-3.5 h-3.5 mr-1.5" /> Export
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExportPDF(false)} data-testid="export-pdf">
                    <FileText className="w-4 h-4 mr-2" /> Export Individual (PDF)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportPDF(true)} data-testid="export-pdf-tree">
                    <Dna className="w-4 h-4 mr-2" /> Export + Family Tree (PDF)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportWord} data-testid="export-word">
                    <FileText className="w-4 h-4 mr-2" /> Word Document
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportCSV} data-testid="export-csv">
                    <FileText className="w-4 h-4 mr-2" /> CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportJSON} data-testid="export-json">
                    <FileText className="w-4 h-4 mr-2" /> JSON (SA Stamboek)
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
            <DialogContent className="bg-card border-border max-w-lg max-h-[85vh] overflow-y-auto p-3 md:p-6">
                <DialogHeader className="pb-2">
                    <DialogTitle className="text-base md:text-lg font-semibold">Edit Animal</DialogTitle>
                </DialogHeader>
                
                <div className="space-y-2.5 md:space-y-4">
                    {/* Photo Section - Compact */}
                    <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handlePhotoCapture} className="hidden" />
                    <input ref={galleryInputRef} type="file" accept="image/*" onChange={handlePhotoCapture} className="hidden" />
                    
                    {photoPreview ? (
                        <div className="relative">
                            <img src={photoPreview} alt="Animal" className="w-full h-28 md:h-40 object-cover rounded-md border border-border" />
                            <div className="absolute top-1 right-1 flex gap-1">
                                <Button type="button" variant="secondary" size="icon" className="h-7 w-7" onClick={() => galleryInputRef.current?.click()} data-testid="button-change-photo">
                                    <Image className="w-3 h-3" />
                                </Button>
                                <Button type="button" variant="destructive" size="icon" className="h-7 w-7" onClick={() => { setPhotoPreview(null); setFormData(prev => ({...prev, photo: null})); }} data-testid="button-clear-photo">
                                    <X className="w-3 h-3" />
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-1.5">
                            <Button type="button" variant="outline" size="sm" className="border-dashed h-8 text-xs" onClick={() => cameraInputRef.current?.click()} data-testid="button-take-photo"><Camera className="w-3 h-3 mr-1" /> Camera</Button>
                            <Button type="button" variant="outline" size="sm" className="border-dashed h-8 text-xs" onClick={() => galleryInputRef.current?.click()} data-testid="button-select-gallery"><Image className="w-3 h-3 mr-1" /> Gallery</Button>
                        </div>
                    )}

                    {/* Basic Info - Compact */}
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <Label className="text-[11px] md:text-xs">Tag ID</Label>
                            <Input value={formData.tagId} onChange={(e) => setFormData(prev => ({...prev, tagId: e.target.value}))} className="rugged-input h-8 text-sm" data-testid="input-edit-tag-id" />
                        </div>
                        <div>
                            <Label className="text-[11px] md:text-xs">Name</Label>
                            <Input value={formData.name} onChange={(e) => setFormData(prev => ({...prev, name: e.target.value}))} className="rugged-input h-8 text-sm" data-testid="input-edit-name" />
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 md:gap-2">
                        <div>
                            <Label className="text-[11px] md:text-xs">Sex</Label>
                            <Select value={formData.sex} onValueChange={(val) => setFormData(prev => ({...prev, sex: val}))}>
                                <SelectTrigger className="rugged-input h-8 text-xs" data-testid="select-edit-sex"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ram">Ram</SelectItem>
                                    <SelectItem value="ewe">Ewe</SelectItem>
                                    <SelectItem value="wether">Wether</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label className="text-[11px] md:text-xs">Status</Label>
                            <Select value={formData.status} onValueChange={(val) => setFormData(prev => ({...prev, status: val}))}>
                                <SelectTrigger className="rugged-input h-8 text-xs" data-testid="select-edit-status"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="active">Active</SelectItem>
                                    <SelectItem value="sold">Sold</SelectItem>
                                    <SelectItem value="dead">Dead</SelectItem>
                                    <SelectItem value="culled">Culled</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label className="text-[11px] md:text-xs">Birth</Label>
                            <Select value={formData.birthStatus || "unknown"} onValueChange={(val) => setFormData(prev => ({...prev, birthStatus: val === "unknown" ? "" : val}))}>
                                <SelectTrigger className="rugged-input h-8 text-xs" data-testid="select-edit-birth-status"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="unknown">Unknown</SelectItem>
                                    <SelectItem value="single">Single</SelectItem>
                                    <SelectItem value="twin">Twin</SelectItem>
                                    <SelectItem value="triplet">Triplet</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <Label className="text-[11px] md:text-xs">Birth Date</Label>
                            <Input type="date" value={formData.birthDate || ""} onChange={(e) => setFormData(prev => ({...prev, birthDate: e.target.value}))} className="rugged-input h-8 text-xs" data-testid="input-edit-birth-date" />
                        </div>
                        <div>
                            <Label className="text-[11px] md:text-xs">Weight (kg)</Label>
                            <Input type="number" step="0.1" value={formData.currentWeight} onChange={(e) => setFormData(prev => ({...prev, currentWeight: e.target.value}))} className="rugged-input h-8 text-sm" data-testid="input-edit-weight" />
                        </div>
                    </div>

                    {/* IDs - Compact */}
                    <div className="grid grid-cols-3 gap-1.5 md:gap-2">
                        <div>
                            <Label className="text-[11px] md:text-xs">Electronic ID</Label>
                            <Input value={formData.electronicId} onChange={(e) => setFormData(prev => ({...prev, electronicId: e.target.value}))} className="rugged-input h-8 text-xs" placeholder="RFID" data-testid="input-edit-electronic-id" />
                        </div>
                        <div>
                            <Label className="text-[11px] md:text-xs">Tattoo ID</Label>
                            <Input value={formData.tattooId} onChange={(e) => setFormData(prev => ({...prev, tattooId: e.target.value}))} className="rugged-input h-8 text-xs" data-testid="input-edit-tattoo-id" />
                        </div>
                        <div>
                            <Label className="text-[11px] md:text-xs">Stud Prefix</Label>
                            <Input value={formData.studPrefix} onChange={(e) => setFormData(prev => ({...prev, studPrefix: e.target.value}))} className="rugged-input h-8 text-xs" data-testid="input-edit-stud-prefix" />
                        </div>
                    </div>

                    {/* Dam - Compact */}
                    <div className="space-y-1">
                        <div className="flex items-center justify-between">
                            <Label className="text-[11px] md:text-xs">Dam (Mother)</Label>
                            <Button type="button" variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={() => { setUseCustomDam(!useCustomDam); if (!useCustomDam) setFormData(prev => ({...prev, damId: null})); else setFormData(prev => ({...prev, externalDamInfo: ""})); }} data-testid="button-toggle-dam-mode">
                                {useCustomDam ? "Select" : "External"}
                            </Button>
                        </div>
                        {useCustomDam ? (
                            <Input value={formData.externalDamInfo} onChange={(e) => setFormData(prev => ({...prev, externalDamInfo: e.target.value}))} placeholder="Enter dam info" className="rugged-input h-8 text-xs" data-testid="input-edit-external-dam" />
                        ) : (
                            <Select value={formData.damId ? String(formData.damId) : "none"} onValueChange={(val) => setFormData(prev => ({...prev, damId: val === "none" ? null : parseInt(val)}))}>
                                <SelectTrigger className="rugged-input h-8 text-xs" data-testid="select-edit-dam"><SelectValue placeholder="Select dam" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Unknown</SelectItem>
                                    {ewes.map(ewe => <SelectItem key={ewe.id} value={String(ewe.id)}>{ewe.tagId} {ewe.name ? `- ${ewe.name}` : ''}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        )}
                    </div>

                    {/* Sire - Compact */}
                    <div className="space-y-1">
                        <div className="flex items-center justify-between">
                            <Label className="text-[11px] md:text-xs">Sire (Father)</Label>
                            <Button type="button" variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={() => { setUseCustomSire(!useCustomSire); if (!useCustomSire) setFormData(prev => ({...prev, sireId: null})); else setFormData(prev => ({...prev, externalSireInfo: ""})); }} data-testid="button-toggle-sire-mode">
                                {useCustomSire ? "Select" : "External"}
                            </Button>
                        </div>
                        {useCustomSire ? (
                            <Input value={formData.externalSireInfo} onChange={(e) => setFormData(prev => ({...prev, externalSireInfo: e.target.value}))} placeholder="Enter sire info" className="rugged-input h-8 text-xs" data-testid="input-edit-external-sire" />
                        ) : (
                            <Select value={formData.sireId ? String(formData.sireId) : "none"} onValueChange={(val) => setFormData(prev => ({...prev, sireId: val === "none" ? null : parseInt(val)}))}>
                                <SelectTrigger className="rugged-input h-8 text-xs" data-testid="select-edit-sire"><SelectValue placeholder="Select sire" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Unknown</SelectItem>
                                    {rams.map(ram => <SelectItem key={ram.id} value={String(ram.id)}>{ram.tagId} {ram.name ? `- ${ram.name}` : ''}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        )}
                    </div>

                    {/* Ownership - Compact */}
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <Label className="text-[11px] md:text-xs">Breeder</Label>
                            <Input value={formData.breederName} onChange={(e) => setFormData(prev => ({...prev, breederName: e.target.value}))} className="rugged-input h-8 text-xs" data-testid="input-edit-breeder" />
                        </div>
                        <div>
                            <Label className="text-[11px] md:text-xs">Owner</Label>
                            <Input value={formData.ownerName} onChange={(e) => setFormData(prev => ({...prev, ownerName: e.target.value}))} className="rugged-input h-8 text-xs" data-testid="input-edit-owner" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <Label className="text-[11px] md:text-xs">Farm Name</Label>
                            <Input value={formData.farmName} onChange={(e) => setFormData(prev => ({...prev, farmName: e.target.value}))} className="rugged-input h-8 text-xs" data-testid="input-edit-farm" />
                        </div>
                        <div>
                            <Label className="text-[11px] md:text-xs">Location</Label>
                            <Input value={formData.location} onChange={(e) => setFormData(prev => ({...prev, location: e.target.value}))} className="rugged-input h-8 text-xs" data-testid="input-edit-location" />
                        </div>
                    </div>

                    {/* Notes - Compact */}
                    <div>
                        <Label className="text-[11px] md:text-xs">Notes</Label>
                        <Textarea value={formData.notes} onChange={(e) => setFormData(prev => ({...prev, notes: e.target.value}))} className="rugged-input min-h-[50px] md:min-h-[70px] text-xs" data-testid="input-edit-notes" />
                    </div>

                    {/* Evaluation Document - Compact */}
                    <input ref={evalDocInputRef} type="file" accept="image/*,.pdf" onChange={handleEvalDocUpload} className="hidden" />
                    
                    {evalDocName ? (
                        <div className="flex items-center justify-between p-2 bg-secondary rounded-md border border-border">
                            <div className="flex items-center gap-1.5">
                                <FileText className="w-4 h-4 text-primary" />
                                <span className="text-[11px] truncate max-w-[140px]">{evalDocName}</span>
                            </div>
                            <div className="flex gap-1">
                                <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => evalDocInputRef.current?.click()} data-testid="button-change-eval-doc"><Upload className="w-3 h-3" /></Button>
                                <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setEvalDocName(null); setFormData(prev => ({...prev, evaluationDocument: null})); }} data-testid="button-clear-eval-doc"><X className="w-3 h-3" /></Button>
                            </div>
                        </div>
                    ) : (
                        <Button type="button" variant="outline" size="sm" className="w-full border-dashed h-8 text-xs" onClick={() => evalDocInputRef.current?.click()} data-testid="button-upload-eval-doc">
                            <FileText className="w-3 h-3 mr-1" /> Attach Eval Document
                        </Button>
                    )}

                    <Button onClick={handleSubmit} disabled={isPending} size="sm" className="w-full bg-primary text-black h-9 font-semibold" data-testid="button-save-edit">
                        {isPending ? "Saving..." : "Save Changes"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function ImagesView({ animalId }: { animalId: number }) {
    const { data: images, isLoading } = useAnimalImages(animalId);
    const { mutate: uploadImage, isPending: isUploading } = useUploadAnimalImage();
    const { mutate: deleteImage, isPending: isDeleting } = useDeleteAnimalImage();
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                uploadImage({
                    animalId,
                    imageData: reader.result as string,
                    fileName: file.name,
                });
            };
            reader.readAsDataURL(file);
        }
        // Reset input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleDelete = (imageId: number) => {
        deleteImage({ animalId, imageId });
    };

    if (isLoading) {
        return (
            <Card className="bg-gradient-to-br from-card via-card to-secondary/20 rugged-card">
                <CardHeader className="border-b border-border/50 bg-secondary/50">
                    <Skeleton className="h-6 w-40" />
                </CardHeader>
                <CardContent className="p-4">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {[1, 2, 3].map(i => (
                            <Skeleton key={i} className="aspect-square rounded-lg" />
                        ))}
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="bg-gradient-to-br from-card via-card to-secondary/20 rugged-card">
            <CardHeader className="border-b border-border/50 bg-secondary/50">
                <CardTitle className="text-lg flex items-center gap-2">
                    <Image className="w-5 h-5 text-primary" />
                    <span>IMAGES FOLDER</span>
                </CardTitle>
                <p className="text-xs text-muted-foreground">Photos stored only for this animal's profile</p>
            </CardHeader>
            <CardContent className="p-4">
                <input 
                    ref={fileInputRef} 
                    type="file" 
                    accept="image/*" 
                    onChange={handleUpload} 
                    className="hidden" 
                    data-testid="input-upload-image"
                />
                
                <Button 
                    variant="outline" 
                    className="w-full mb-4 border-dashed"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    data-testid="button-add-image"
                >
                    <Upload className="w-4 h-4 mr-2" /> 
                    {isUploading ? "Uploading..." : "Add Photo to Folder"}
                </Button>

                {(!images || images.length === 0) ? (
                    <div className="text-center py-8 text-muted-foreground">
                        <Image className="w-12 h-12 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">No images uploaded yet</p>
                        <p className="text-xs mt-1">Tap the button above to add photos</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {images.map((img: any) => (
                            <div key={img.id} className="relative group">
                                <div 
                                    className="aspect-square rounded-lg overflow-hidden border border-border bg-secondary cursor-pointer hover:border-primary transition-colors"
                                    onClick={() => setSelectedImage(img.imageData)}
                                    data-testid={`image-${img.id}`}
                                >
                                    <img src={img.imageData} alt={img.fileName} className="w-full h-full object-cover" />
                                </div>
                                <Button
                                    variant="destructive"
                                    size="icon"
                                    className="absolute -top-2 -right-2 scale-75"
                                    onClick={() => handleDelete(img.id)}
                                    disabled={isDeleting}
                                    data-testid={`button-delete-image-${img.id}`}
                                >
                                    <X className="w-4 h-4" />
                                </Button>
                                <p className="text-[10px] text-muted-foreground mt-1 truncate">
                                    {img.uploadedAt ? format(new Date(img.uploadedAt), "dd/MM/yy") : ""}
                                </p>
                            </div>
                        ))}
                    </div>
                )}

                {/* Lightbox for viewing images */}
                <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
                    <DialogContent className="max-w-2xl p-2 bg-card/98 border border-primary/50">
                        {selectedImage && (
                            <img src={selectedImage} alt="Image preview" className="w-full h-auto max-h-[80vh] object-contain rounded" />
                        )}
                    </DialogContent>
                </Dialog>
            </CardContent>
        </Card>
    );
}

function DocumentsView({ animalId }: { animalId: number }) {
    const [documents, setDocuments] = useState<{id: string, name: string, url: string, date: string}[]>([]);
    const [selectedDoc, setSelectedDoc] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const newDoc = {
                    id: Date.now().toString(),
                    name: file.name,
                    url: reader.result as string,
                    date: new Date().toLocaleDateString()
                };
                setDocuments(prev => [...prev, newDoc]);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleDelete = (id: string) => {
        setDocuments(prev => prev.filter(d => d.id !== id));
    };

    return (
        <Card className="bg-gradient-to-br from-card via-card to-secondary/20 rugged-card">
            <CardHeader className="border-b border-border/50 bg-secondary/50">
                <CardTitle className="text-lg flex items-center gap-2">
                    <Image className="w-5 h-5 text-primary" />
                    <span>MY DOCUMENTS</span>
                </CardTitle>
                <p className="text-xs text-muted-foreground">Upload photos, screenshots, or documents for this animal</p>
            </CardHeader>
            <CardContent className="p-4">
                <input 
                    ref={fileInputRef} 
                    type="file" 
                    accept="image/*,.pdf" 
                    onChange={handleUpload} 
                    className="hidden" 
                    data-testid="input-upload-document"
                />
                
                <Button 
                    variant="outline" 
                    className="w-full mb-4 border-dashed"
                    onClick={() => fileInputRef.current?.click()}
                    data-testid="button-add-document"
                >
                    <Upload className="w-4 h-4 mr-2" /> Add Document or Screenshot
                </Button>

                {documents.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        <Image className="w-12 h-12 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">No documents uploaded yet</p>
                        <p className="text-xs mt-1">Tap the button above to add photos or files</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {documents.map((doc) => (
                            <div key={doc.id} className="relative group">
                                <div 
                                    className="aspect-square rounded-lg overflow-hidden border border-border bg-secondary cursor-pointer hover:border-primary transition-colors"
                                    onClick={() => setSelectedDoc(doc.url)}
                                >
                                    {doc.url.startsWith('data:image') ? (
                                        <img src={doc.url} alt={doc.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex flex-col items-center justify-center p-2">
                                            <FileText className="w-8 h-8 text-primary mb-1" />
                                            <span className="text-[10px] text-center truncate w-full">{doc.name}</span>
                                        </div>
                                    )}
                                </div>
                                <Button
                                    variant="destructive"
                                    size="icon"
                                    className="absolute -top-2 -right-2 scale-75"
                                    onClick={() => handleDelete(doc.id)}
                                    data-testid={`button-delete-doc-${doc.id}`}
                                >
                                    <X className="w-4 h-4" />
                                </Button>
                                <p className="text-[10px] text-muted-foreground mt-1 truncate">{doc.date}</p>
                            </div>
                        ))}
                    </div>
                )}

                {/* Lightbox for viewing documents */}
                <Dialog open={!!selectedDoc} onOpenChange={() => setSelectedDoc(null)}>
                    <DialogContent className="max-w-2xl p-2 bg-card/98 border border-primary/50">
                        {selectedDoc && (
                            <img src={selectedDoc} alt="Document preview" className="w-full h-auto max-h-[80vh] object-contain rounded" />
                        )}
                    </DialogContent>
                </Dialog>
            </CardContent>
        </Card>
    );
}
