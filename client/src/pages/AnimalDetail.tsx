import { useRoute, useLocation } from "wouter";
import { useAnimal, useFamilyTree, useUpdateAnimal, useAnimals, useAnimalImages, useUploadAnimalImage, useDeleteAnimalImage, useRemoveFromHerd } from "@/hooks/use-animals";
import { usePerformanceRecords, useHealthRecords, useCreatePerformanceRecord } from "@/hooks/use-records";
import { useFarmSettings } from "@/hooks/use-farm-settings";
import { useCreateExportedDocument } from "@/hooks/use-exported-documents";
import { Layout } from "@/components/Layout";
import { useNavigationHistory } from "@/lib/navigation-history-context";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useState, useRef, useEffect } from "react";
import { format } from "date-fns";
import { ArrowLeft, Dna, Syringe, Scale, FileText, Plus, Upload, Edit, Camera, Image, X, Download, Heart, LogOut, ZoomIn, ZoomOut, RotateCw } from "lucide-react";
import { useAnimalBreedingEvents } from "@/hooks/use-breeding";
import { Link } from "wouter";
import logo from "@/assets/breedlog-logo-mark.png";
import { useToast } from "@/hooks/use-toast";
import type { Animal, AnimalWithRelations, BreedingEvent } from "@shared/schema";
import { calculateEweBreedingStats } from "@/lib/breeding-stats";
import { ImageCropDialog } from "@/components/ImageCropDialog";
import { splitTagInput } from "@shared/tag-utils";
import { isMetricWeight, resolveBirthWeight, resolveWeaningWeight } from "@shared/animal-lifecycle";
import { calculateLambStage } from "@shared/lamb-stage";
import { buildAnimalPerformanceProfile } from "@/lib/animal-performance";

function ZoomableImagePreview({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const lastDistanceRef = useRef<number | null>(null);
  const lastTapRef = useRef<number>(0);
  
  const getDistance = (touch1: React.Touch, touch2: React.Touch) => {
    return Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);
  };
  
  const resetView = () => { setScale(1); setPosition({ x: 0, y: 0 }); };
  
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      lastDistanceRef.current = getDistance(e.touches[0], e.touches[1]);
    } else if (e.touches.length === 1) {
      const now = Date.now();
      if (now - lastTapRef.current < 300) {
        resetView();
      }
      lastTapRef.current = now;
      setIsDragging(true);
      setStartPos({ x: e.touches[0].clientX - position.x, y: e.touches[0].clientY - position.y });
    }
  };
  
  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && lastDistanceRef.current !== null) {
      e.preventDefault();
      const distance = getDistance(e.touches[0], e.touches[1]);
      const delta = distance / lastDistanceRef.current;
      lastDistanceRef.current = distance;
      setScale(prev => Math.min(Math.max(0.5, prev * delta), 5));
    } else if (e.touches.length === 1 && isDragging && scale > 1) {
      setPosition({ x: e.touches[0].clientX - startPos.x, y: e.touches[0].clientY - startPos.y });
    }
  };
  
  const handleTouchEnd = () => { lastDistanceRef.current = null; setIsDragging(false); };
  const handleWheel = (e: React.WheelEvent) => { e.preventDefault(); setScale(prev => Math.min(Math.max(0.5, prev * (e.deltaY > 0 ? 0.9 : 1.1)), 5)); };
  const handleMouseDown = (e: React.MouseEvent) => { if (scale > 1) { setIsDragging(true); setStartPos({ x: e.clientX - position.x, y: e.clientY - position.y }); } };
  const handleMouseMove = (e: React.MouseEvent) => { if (isDragging && scale > 1) { setPosition({ x: e.clientX - startPos.x, y: e.clientY - startPos.y }); } };
  const handleMouseUp = () => { setIsDragging(false); };
  
  return (
    <>
      <div className="absolute top-2 right-2 z-50 flex gap-2">
        <Button variant="outline" size="icon" onClick={() => setScale(s => Math.min(s * 1.25, 5))} className="bg-black/50 border-white/20 hover:bg-black/70" data-testid="button-zoom-in">
          <ZoomIn className="h-4 w-4 text-white" />
        </Button>
        <Button variant="outline" size="icon" onClick={() => setScale(s => Math.max(s / 1.25, 0.5))} className="bg-black/50 border-white/20 hover:bg-black/70" data-testid="button-zoom-out">
          <ZoomOut className="h-4 w-4 text-white" />
        </Button>
        <Button variant="outline" size="icon" onClick={() => setRotation(r => (r + 90) % 360)} className="bg-black/50 border-white/20 hover:bg-black/70" data-testid="button-rotate">
          <RotateCw className="h-4 w-4 text-white" />
        </Button>
        <Button variant="outline" size="icon" onClick={onClose} className="bg-black/50 border-white/20 hover:bg-black/70" data-testid="button-close-image-preview">
          <X className="h-4 w-4 text-white" />
        </Button>
      </div>
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 text-white/60 text-xs pointer-events-none">
        Pinch to zoom • Double-tap to reset
      </div>
      <div className="w-full h-[90vh] flex items-center justify-center overflow-hidden touch-none"
        onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
        onWheel={handleWheel} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
        onDoubleClick={resetView}>
        <img src={src} alt={alt} className="max-w-full max-h-full object-contain transition-transform duration-100" draggable={false}
          style={{ transform: `translate(${position.x}px, ${position.y}px) scale(${scale}) rotate(${rotation}deg)`, cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in' }}
          data-testid="image-preview-full"
        />
      </div>
    </>
  );
}

export default function AnimalDetail() {
  const [match, params] = useRoute("/animals/:id");
  const id = parseInt(params?.id || "0");
  const { data: animal, isLoading } = useAnimal(id);
  const { data: farmSettings } = useFarmSettings();
  const { goBack, goForward, canGoForward } = useNavigationHistory();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [removeReason, setRemoveReason] = useState<"sold" | "deceased" | "transferred">("sold");
  const [removeNotes, setRemoveNotes] = useState("");
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);
  const removeFromHerdMutation = useRemoveFromHerd();
  const { toast } = useToast();
  
  const handleRemoveFromHerd = () => {
    if (!animal) return;
    removeFromHerdMutation.mutate(
      { id: animal.id, reason: removeReason, notes: removeNotes },
      {
        onSuccess: () => {
          setRemoveDialogOpen(false);
          setRemoveReason("sold");
          setRemoveNotes("");
          toast({ title: "Success", description: `${animal.tagId} removed from herd` });
        },
      }
    );
  };

  if (isLoading) return <DetailSkeleton />;
  
  // Robust "Not Found" state with navigation back to My Herd
  if (!animal) {
    return (
      <Layout>
        <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-6 p-8">
          <div className="text-center space-y-3">
            <h2 className="text-xl font-semibold text-muted-foreground">Animal Not Found</h2>
            <p className="text-sm text-muted-foreground max-w-md">
              This animal may not have synced yet, or the record doesn't exist. 
              If you just created this animal, please try again after syncing.
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="default" onClick={() => goBack('/animals')} data-testid="button-back-to-herd">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to My Herd
            </Button>
          </div>
        </div>
      </Layout>
    );
  }
  const lambStage = calculateLambStage(animal as Animal);

  return (
    <Layout>
      <div className="space-y-3 md:space-y-6 animate-in fade-in duration-500 abstract-bg">
        {/* Clean Modern Header */}
        <div className="space-y-3">
          {/* Top row: Back + Title + Inline Buttons */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <Button variant="ghost" size="icon" className="shrink-0" onClick={() => goBack('/animals')} data-testid="button-back">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            {canGoForward && (
              <Button variant="ghost" size="icon" className="shrink-0" onClick={() => goForward()} data-testid="button-forward">
                <ArrowLeft className="w-5 h-5 rotate-180" />
              </Button>
            )}
            <h1 className="text-xl md:text-2xl font-bold flex-1 min-w-[8rem] truncate">{animal.tagId}</h1>
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-end ml-auto">
              <Button 
                variant="outline" 
                size="sm"
                className="h-8 px-3 text-xs font-semibold"
                onClick={() => setIsEditOpen(true)}
                data-testid="button-edit-animal"
              >
                <Edit className="w-3.5 h-3.5 mr-1.5" /> Edit
              </Button>
              {animal.status === 'active' && (
                <Button 
                  variant="outline" 
                  size="sm"
                  className="h-8 px-3 text-xs font-semibold"
                  onClick={() => setRemoveDialogOpen(true)}
                  data-testid="button-remove-from-herd"
                >
                  <LogOut className="w-3.5 h-3.5 mr-1.5" /> Remove
                </Button>
              )}
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
            {lambStage.isActiveLambStage && (
              <span className="text-xs text-muted-foreground">Lamb Stage: {lambStage.label} · {lambStage.reason} · Next: {lambStage.nextAction}</span>
            )}
          </div>
        </div>
        
        <EditAnimalDialog animal={animal} open={isEditOpen} onOpenChange={setIsEditOpen} />

        {/* Remove from Herd Dialog */}
        <AlertDialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove from Herd</AlertDialogTitle>
              <AlertDialogDescription>
                Remove <strong>{animal.tagId}</strong> from your active herd. Select the reason below.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-3 py-2">
              <Select value={removeReason} onValueChange={(v: "sold" | "deceased" | "transferred") => setRemoveReason(v)}>
                <SelectTrigger data-testid="select-remove-reason">
                  <SelectValue placeholder="Select reason" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sold">Sold</SelectItem>
                  <SelectItem value="deceased">Deceased</SelectItem>
                  <SelectItem value="transferred">Transferred</SelectItem>
                </SelectContent>
              </Select>
              <Textarea 
                placeholder="Optional notes..." 
                value={removeNotes}
                onChange={(e) => setRemoveNotes(e.target.value)}
                className="h-16"
                data-testid="input-remove-notes"
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleRemoveFromHerd}
                disabled={removeFromHerdMutation.isPending}
                data-testid="btn-confirm-remove"
              >
                {removeFromHerdMutation.isPending ? "Removing..." : "Remove from Herd"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Full-screen Image Preview with Zoom */}
        <Dialog open={imagePreviewOpen} onOpenChange={setImagePreviewOpen}>
          <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-black/95 border-none overflow-hidden">
            <ZoomableImagePreview 
              src={animal.photo || ""} 
              alt={animal.tagId} 
              onClose={() => setImagePreviewOpen(false)} 
            />
          </DialogContent>
        </Dialog>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-8">
          {/* Main Info Card - Compact on Mobile */}
          <div className="lg:col-span-1 space-y-3 md:space-y-6">
            <Card className="rugged-card overflow-hidden">
                <div 
                  className={cn(
                    "aspect-video md:aspect-square bg-secondary relative",
                    animal.photo && "cursor-pointer"
                  )}
                  onClick={() => animal.photo && setImagePreviewOpen(true)}
                  onKeyDown={(e) => animal.photo && (e.key === 'Enter' || e.key === ' ') && setImagePreviewOpen(true)}
                  role={animal.photo ? "button" : undefined}
                  tabIndex={animal.photo ? 0 : undefined}
                  aria-label={animal.photo ? `View full image of ${animal.tagId}` : undefined}
                  data-testid="animal-profile-image"
                >
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
                <TabsTrigger value="pedigree" data-testid="tab-pedigree" className="flex-1 uppercase font-medium text-[10px] md:text-xs px-1 md:px-3 text-white"><Dna className="w-3 h-3 md:w-4 md:h-4 mr-0.5 md:mr-1 text-primary" /> <span className="hidden xs:inline">Pedigree</span><span className="xs:hidden">Ped</span></TabsTrigger>
                {animal.sex === "ewe" && (
                  <TabsTrigger value="breeding" data-testid="tab-breeding" className="flex-1 uppercase font-medium text-[10px] md:text-xs px-1 md:px-3 text-white"><Heart className="w-3 h-3 md:w-4 md:h-4 mr-0.5 md:mr-1 text-primary" /> <span className="hidden xs:inline">Breeding</span><span className="xs:hidden">Bred</span></TabsTrigger>
                )}
                <TabsTrigger value="performance" data-testid="tab-weights" className="flex-1 uppercase font-medium text-[10px] md:text-xs px-1 md:px-3 text-white"><Scale className="w-3 h-3 md:w-4 md:h-4 mr-0.5 md:mr-1 text-primary" /> <span className="hidden xs:inline">Weights</span><span className="xs:hidden">Wt</span></TabsTrigger>
                <TabsTrigger value="health" data-testid="tab-health" className="flex-1 uppercase font-medium text-[10px] md:text-xs px-1 md:px-3 text-white"><Syringe className="w-3 h-3 md:w-4 md:h-4 mr-0.5 md:mr-1 text-primary" /> <span className="hidden xs:inline">Health</span><span className="xs:hidden">Hlth</span></TabsTrigger>
                <TabsTrigger value="images" data-testid="tab-images" className="flex-1 uppercase font-medium text-[10px] md:text-xs px-1 md:px-3 text-white"><Image className="w-3 h-3 md:w-4 md:h-4 mr-0.5 md:mr-1 text-primary" /> Images</TabsTrigger>
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
    const [scale, setScale] = useState(0.85);
    const [lastTouchDistance, setLastTouchDistance] = useState<number | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    
    const handleTouchStart = (e: React.TouchEvent) => {
        if (e.touches.length === 2) {
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            const distance = Math.hypot(
                touch2.clientX - touch1.clientX,
                touch2.clientY - touch1.clientY
            );
            setLastTouchDistance(distance);
        }
    };
    
    const handleTouchMove = (e: React.TouchEvent) => {
        if (e.touches.length === 2 && lastTouchDistance !== null) {
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            const distance = Math.hypot(
                touch2.clientX - touch1.clientX,
                touch2.clientY - touch1.clientY
            );
            
            const scaleChange = (distance - lastTouchDistance) / 200;
            setScale(prev => Math.min(Math.max(prev + scaleChange, 0.5), 1.5));
            setLastTouchDistance(distance);
        }
    };
    
    const handleTouchEnd = () => {
        setLastTouchDistance(null);
    };
    
    const handleWheel = (e: React.WheelEvent) => {
        if (e.ctrlKey) {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -0.1 : 0.1;
            setScale(prev => Math.min(Math.max(prev + delta, 0.5), 1.5));
        }
    };
    
    return (
        <Card className="bg-gradient-to-br from-card via-card to-secondary/20 rugged-card overflow-hidden">
            <CardHeader className="border-b border-border/50 bg-secondary/50">
                <CardTitle className="text-lg flex items-center gap-2">
                    <Dna className="w-5 h-5 text-primary" />
                    <span>BLOODLINE</span>
                    <span className="text-primary font-black ml-1">- ELITE PEDIGREE</span>
                </CardTitle>
                <div className="flex items-center justify-between mt-1">
                    <p className="text-xs text-muted-foreground">Pinch to zoom • Tap animal to view profile</p>
                    <div className="flex items-center gap-1">
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6"
                            onClick={() => setScale(prev => Math.max(prev - 0.15, 0.5))}
                            data-testid="button-zoom-out"
                        >
                            <span className="text-sm font-bold">-</span>
                        </Button>
                        <span className="text-xs text-muted-foreground w-12 text-center">{Math.round(scale * 100)}%</span>
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6"
                            onClick={() => setScale(prev => Math.min(prev + 0.15, 1.5))}
                            data-testid="button-zoom-in"
                        >
                            <span className="text-sm font-bold">+</span>
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-2 md:p-4">
                <div 
                    ref={containerRef}
                    className="overflow-auto touch-pan-x touch-pan-y" 
                    style={{ maxHeight: '400px' }}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    onWheel={handleWheel}
                >
                    <div 
                        className="min-w-[550px] py-4 px-2 origin-top-left transition-transform duration-100" 
                        style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}
                    >
                        {/* Tree structure with CSS-based connectors */}
                        <div className="flex items-center">
                            {/* Subject (left) */}
                            <div className="flex-shrink-0">
                                <PedigreeNode 
                                    animal={animal}
                                    isSubject={true}
                                />
                            </div>
                            
                            {/* Horizontal connector from subject */}
                            <div className="w-6 h-[3px] bg-primary flex-shrink-0"></div>
                            
                            {/* Fork structure - vertical line with branches */}
                            <div className="flex flex-col items-start relative">
                                {/* Vertical line spanning from sire to dam */}
                                <div className="absolute left-0 top-[50px] bottom-[50px] w-[3px] bg-primary"></div>
                                
                                {/* Sire row */}
                                <div className="flex items-center">
                                    <div className="w-4 h-[3px] bg-primary"></div>
                                    <PedigreeNode 
                                        animal={animal.sire}
                                        label="SIRE"
                                        externalInfo={animal.externalSireInfo}
                                    />
                                    
                                    {/* Connector to grandparents */}
                                    <div className="w-4 h-[2px] bg-primary/50 ml-1"></div>
                                    
                                    {/* Sire's parents fork */}
                                    <div className="flex flex-col items-start relative">
                                        <div className="absolute left-0 top-[20px] bottom-[20px] w-[2px] bg-primary/50"></div>
                                        <div className="flex items-center">
                                            <div className="w-3 h-[2px] bg-primary/50"></div>
                                            <PedigreeNodeSmall label="GP Sire" sublabel="Sire's Father" />
                                        </div>
                                        <div className="h-2"></div>
                                        <div className="flex items-center">
                                            <div className="w-3 h-[2px] bg-primary/50"></div>
                                            <PedigreeNodeSmall label="GP Dam" sublabel="Sire's Mother" />
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Vertical spacer */}
                                <div className="h-6"></div>
                                
                                {/* Dam row */}
                                <div className="flex items-center">
                                    <div className="w-4 h-[3px] bg-primary"></div>
                                    <PedigreeNode 
                                        animal={animal.dam}
                                        label="DAM"
                                        externalInfo={animal.externalDamInfo}
                                    />
                                    
                                    {/* Connector to grandparents */}
                                    <div className="w-4 h-[2px] bg-primary/50 ml-1"></div>
                                    
                                    {/* Dam's parents fork */}
                                    <div className="flex flex-col items-start relative">
                                        <div className="absolute left-0 top-[20px] bottom-[20px] w-[2px] bg-primary/50"></div>
                                        <div className="flex items-center">
                                            <div className="w-3 h-[2px] bg-primary/50"></div>
                                            <PedigreeNodeSmall label="GP Sire" sublabel="Dam's Father" />
                                        </div>
                                        <div className="h-2"></div>
                                        <div className="flex items-center">
                                            <div className="w-3 h-[2px] bg-primary/50"></div>
                                            <PedigreeNodeSmall label="GP Dam" sublabel="Dam's Mother" />
                                        </div>
                                    </div>
                                </div>
                            </div>
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
    const [, setLocation] = useLocation();
    const hasData = animal || externalInfo;
    const isRam = animal?.sex?.toLowerCase() === 'ram';
    const displayId = animal?.tagId || externalInfo || 'Unknown';
    const isClickable = !isSubject && animal?.id;
    
    const handleClick = () => {
        if (isClickable) {
            setLocation(`/animals/${animal.id}`);
        }
    };
    
    return (
        <div 
            className={cn(
                "flex items-center gap-3 p-3 rounded-xl border-2 transition-all",
                isSubject 
                    ? "bg-gradient-to-r from-primary/20 to-primary/5 border-primary shadow-lg shadow-primary/20" 
                    : hasData 
                        ? "bg-card/80 border-primary/50 hover:border-primary hover:shadow-md" 
                        : "bg-secondary/50 border-dashed border-muted-foreground/30",
                isClickable && "cursor-pointer active:scale-95"
            )}
            onClick={handleClick}
            data-testid={`pedigree-node-${animal?.id || label || 'unknown'}`}
        >
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
    const { data: allAnimals } = useAnimals({});
    const { data: healthRecords } = useHealthRecords(animal.id);
    const { toast } = useToast();
    const createExportedDoc = useCreateExportedDocument();
    
    const getDocumentFileName = (type: string, identifier: string) => {
        const date = format(new Date(), "yyyy-MM-dd");
        return `${identifier}_${type}_${date}.pdf`;
    };
    
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
                source: (animal as any).animalSource || "unknown_not_recorded",
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
            ["Source", data.basicInfo.source || "unknown_not_recorded"],
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
Source: ${data.basicInfo.source || "unknown_not_recorded"}
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
    
    const handleExportPDF = async (includeTree: boolean = false) => {
        toast({ title: "Preparing PDF…", description: "Building performance datasheet, please wait." });

        // Convert photo to base64 so it loads correctly in the print window
        // (blob: URLs from IndexedDB are not accessible in a new window context)
        let photoBase64: string | null = null;
        if (animal.photo) {
            try {
                const resp = await fetch(animal.photo);
                if (resp.ok) {
                    const blob = await resp.blob();
                    photoBase64 = await new Promise<string>((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(reader.result as string);
                        reader.onerror = reject;
                        reader.readAsDataURL(blob);
                    });
                }
            } catch { photoBase64 = null; }
        }

        const fb = farmSettings;
        const exportDate = format(new Date(), "dd/MM/yyyy HH:mm");
        const formatDate = (dateStr: string | null | undefined) => {
            if (!dateStr) return "Not recorded";
            try { return format(new Date(dateStr), "dd/MM/yyyy"); } catch { return String(dateStr); }
        };
        
        // Build performance profile from real data
        const profile = buildAnimalPerformanceProfile(
            animal,
            allAnimals || [],
            breedingEvents || [],
            healthRecords || []
        );

        // ── Helpers ──────────────────────────────────────────────────────────
        const row = (label: string, value: string | null | undefined) =>
            `<tr><td class="fl">${label}</td><td class="fv">${value || "Not recorded"}</td></tr>`;
        const sectionHeader = (title: string) =>
            `<tr><td class="sh" colspan="2">${title}</td></tr>`;
        const kg = (v: number | null) => v !== null ? `${v} kg` : "—";
        const gday = (v: number | null) => v !== null ? `${v} g/day` : "—";
        const pct = (v: number | null) => v !== null ? `${v}%` : "—";

        // ── Rating colors ────────────────────────────────────────────────────
        const ratingColors: Record<string, string> = {
            "Excellent": "#16a34a", "Strong": "#2563eb", "Good": "#ca8a04",
            "Developing": "#9333ea", "Monitor": "#dc2626", "Insufficient data": "#6b7280",
        };
        const ratingColor = ratingColors[profile.overallRating] || "#6b7280";

        // ── Age string ───────────────────────────────────────────────────────
        const ageStr = (() => {
            const days = profile.growthMetrics.ageInDays;
            if (days === null) return "Unknown";
            if (days < 90) return `${days} days`;
            const months = Math.floor(days / 30);
            if (months < 24) return `${months} months`;
            return `${Math.floor(days / 365)} yr ${Math.floor((days % 365) / 30)} mo`;
        })();

        // ── Role / confidence labels ─────────────────────────────────────────
        const roleLabels: Record<string, string> = {
            "ram": "RAM", "ewe": "EWE", "young-stud-ram": "YOUNG STUD RAM",
            "young-stud-ewe": "YOUNG STUD EWE", "lamb": "LAMB", "meat-production": "MEAT / PRODUCTION",
        };
        const roleLabel = roleLabels[profile.role] || profile.role.toUpperCase();
        const confidenceLabel: Record<string, string> = {
            "high": "High confidence", "medium": "Medium confidence",
            "low": "Low confidence", "insufficient": "Insufficient data",
        };

        // ── Type-specific section ─────────────────────────────────────────────
        const buildTypeSpecificSection = () => {
            const g = profile.growthMetrics;
            if (profile.role === "ram" || profile.role === "young-stud-ram") {
                const pm = profile.ramProgenyMetrics;
                if (!pm) return `<div class="no-data">No progeny data recorded.</div>`;
                return `<table class="ft">
                  ${sectionHeader("Progeny Performance")}
                  ${row("Total Progeny", pm.totalProgeny > 0 ? String(pm.totalProgeny) : "None recorded")}
                  ${row("Male / Female", pm.totalProgeny > 0 ? `${pm.maleProgeny} / ${pm.femaleProgeny}` : "—")}
                  ${row("Progeny Live / Lost", pm.totalProgeny > 0 ? `${pm.progenyLive} / ${pm.progenyDead}` : "—")}
                  ${sectionHeader("Breeding Record")}
                  ${row("Mating Events", String(pm.matingEvents || 0))}
                  ${row("Lambing Events", String(pm.lambingEvents || 0))}
                  ${row("Lambing Rate", pct(pm.lambingRate))}
                  ${sectionHeader("Progeny Averages")}
                  ${row("Avg Birth Weight", kg(pm.avgProgenyBirthWeight))}
                  ${row("Avg 100-Day Weight", kg(pm.avgProgeny100Day))}
                  ${row("Avg 270-Day Weight", kg(pm.avgProgeny270Day))}
                </table>`;
            }
            if (profile.role === "ewe" || profile.role === "young-stud-ewe") {
                const em = profile.eweProductivityMetrics;
                if (!em) return `<div class="no-data">No breeding events recorded.</div>`;
                return `<table class="ft">
                  ${sectionHeader("Lambing History")}
                  ${row("Lambing Events", String(em.totalLambingEvents))}
                  ${row("Total Lambs Born", String(em.totalLambsBorn))}
                  ${row("Lambs Live / Lost", em.totalLambsBorn > 0 ? `${em.lambsLive} / ${em.lambsDead}` : "—")}
                  ${row("Lamb Survival Rate", pct(em.survivalRate))}
                  ${sectionHeader("Productivity")}
                  ${row("Mating Events", String(em.matingEvents))}
                  ${row("Fertility Rate", pct(em.fertilityRate))}
                  ${row("Avg Inter-Lambing", em.avgILP ? `${em.avgILP} days` : "—")}
                  ${row("First Lambing", formatDate(em.firstLambDate ?? undefined))}
                  ${row("Last Lambing", formatDate(em.lastLambDate ?? undefined))}
                  ${sectionHeader("Lamb Averages")}
                  ${row("Avg Birth Weight", kg(em.avgLambBirthWeight))}
                  ${row("Avg 100-Day Weight", kg(em.avgLamb100Day))}
                  ${row("Avg 270-Day Weight", kg(em.avgLamb270Day))}
                </table>`;
            }
            if (profile.role === "meat-production") {
                const mm = profile.meatProductionMetrics;
                if (!mm) return `<div class="no-data">Insufficient production data.</div>`;
                return `<table class="ft">
                  ${sectionHeader("Production Metrics")}
                  ${row("Current Weight", kg(mm.currentWeight))}
                  ${row("Market Target", `${mm.marketTargetKg} kg`)}
                  ${row("Progress to Target", pct(mm.percentToTarget))}
                  ${row("ADG Birth → Current", gday(mm.adgBirthToCurrent))}
                  ${row("Est. Days to Market", mm.projectedDaysToTarget ? `${mm.projectedDaysToTarget} days` : "—")}
                  ${row("Age", mm.ageInDays ? `${mm.ageInDays} days` : "—")}
                </table>`;
            }
            // Young stud / lamb
            const ym = profile.youngAnimalMetrics;
            return `<table class="ft">
              ${sectionHeader("Development")}
              ${row("Age", ym?.ageInDays ? `${ym.ageInDays} days` : "—")}
              ${row("Stage", ym?.ageCategory ? ym.ageCategory.charAt(0).toUpperCase() + ym.ageCategory.slice(1) : "—")}
              ${row("Parentage", ym?.hasParentalData ? "Recorded" : "Not recorded")}
              ${row("Sire", ym?.sireTagId || animal.externalSireInfo || "—")}
              ${row("Dam", ym?.damTagId || animal.externalDamInfo || "—")}
              ${row("Weight Records", `${ym?.growthDataPoints ?? 0} recorded`)}
              ${sectionHeader("Growth Rate")}
              ${row("ADG Birth → 100d", gday(g.adgBirthTo100))}
              ${row("ADG Birth → 270d", gday(g.adgBirthTo270))}
              ${row("ADG Birth → Current", gday(g.adgBirthToCurrent))}
            </table>`;
        };

        // ── Pedigree ──────────────────────────────────────────────────────────
        const sireAnimal = animal.sire;
        const damAnimal = animal.dam;
        const pedigreeSection = `
          <div class="ped-row">
            <div class="ped-box sire-box">
              <div class="ped-lbl">SIRE</div>
              <div class="ped-id">${sireAnimal?.tagId || animal.externalSireInfo || "Unknown"}</div>
              ${sireAnimal?.name ? `<div class="ped-det">${sireAnimal.name}</div>` : ''}
              ${sireAnimal?.birthDate ? `<div class="ped-det">DOB: ${formatDate(sireAnimal.birthDate)}</div>` : ''}
            </div>
            <div class="ped-box dam-box">
              <div class="ped-lbl">DAM</div>
              <div class="ped-id">${damAnimal?.tagId || animal.externalDamInfo || "Unknown"}</div>
              ${damAnimal?.name ? `<div class="ped-det">${damAnimal.name}</div>` : ''}
              ${damAnimal?.birthDate ? `<div class="ped-det">DOB: ${formatDate(damAnimal.birthDate)}</div>` : ''}
            </div>
          </div>`;

        // ── Health notes ──────────────────────────────────────────────────────
        const healthSection = profile.recentHealthNotes.length > 0 ? `
          <div class="full-col" style="margin-bottom:3mm">
            <div class="sec-title">RECENT HEALTH NOTES</div>
            <div class="sec-body">
              ${profile.recentHealthNotes.map(n => `<div class="health-row">${n}</div>`).join('')}
              ${profile.healthRecordCount > 3 ? `<div class="health-more">+ ${profile.healthRecordCount - 3} more health records on file</div>` : ''}
            </div>
          </div>` : '';

        // ── Photo HTML ────────────────────────────────────────────────────────
        const photoHtml = photoBase64
            ? `<img src="${photoBase64}" class="id-photo" alt="${animal.tagId || 'animal'}" />`
            : `<div class="no-photo"><div>No image<br/>recorded</div></div>`;

        // ── Type-specific section title ────────────────────────────────────────
        const specificTitle = profile.role === "ram" || profile.role === "young-stud-ram"
            ? "Progeny &amp; Breeding"
            : profile.role === "ewe" || profile.role === "young-stud-ewe"
            ? "Productivity &amp; Lambing"
            : profile.role === "meat-production" ? "Production Metrics" : "Development";

        // ── Family tree page (landscape) — included when requested ────────────
        const familyTreePage = includeTree ? `
<div class="page" style="page-break-before:always; width:277mm; min-height:190mm; padding: 6mm 6mm 24mm 6mm; position:relative;">
  <div class="hdr">
    <div>${fb?.logoUrl ? `<img src="${fb.logoUrl}" class="hdr-logo" alt="Logo" />` : '<div class="hdr-logo-placeholder"></div>'}</div>
    <div class="hdr-center">
      <h1>${fb?.studName || fb?.farmName || "BreedLog"}</h1>
      <p>Family Tree / Pedigree Certificate</p>
    </div>
    <div class="hdr-right"><div style="font-weight:700">${animal.tagId || "—"}</div><div>${exportDate}</div></div>
  </div>
  <h2 style="text-align:center;font-size:12pt;margin:4mm 0 6mm;">Pedigree for: ${animal.tagId} ${animal.name ? `(${animal.name})` : ''}</h2>
  <div style="display:flex;align-items:center;justify-content:center;gap:30mm;padding:10mm;">
    <div style="border:2px solid #FFC300;border-radius:6px;padding:8px 16px;min-width:80mm;background:linear-gradient(135deg,#FFC300,#ffdb4d);text-align:center;">
      ${photoBase64 ? `<img src="${photoBase64}" style="width:60px;height:60px;object-fit:cover;border-radius:6px;border:2px solid #fff;box-shadow:0 2px 4px rgba(0,0,0,.2);margin-bottom:6px;display:block;margin:0 auto 6px;" />` : ''}
      <div style="font-size:8pt;font-weight:700;color:#555;text-transform:uppercase;">SUBJECT</div>
      <div style="font-size:14pt;font-weight:800;">${animal.tagId}</div>
      <div style="font-size:9pt;color:#555;">${animal.sex?.toUpperCase() || ""} | ${animal.breed || "Meatmaster"}</div>
      <div style="font-size:9pt;color:#555;">${formatDate(animal.birthDate)}</div>
    </div>
    <div style="display:flex;flex-direction:column;gap:8mm;">
      <div style="border:2px solid #3b82f6;border-radius:6px;padding:8px 16px;min-width:80mm;text-align:center;background:white;">
        <div style="font-size:8pt;font-weight:700;color:#555;text-transform:uppercase;">SIRE</div>
        <div style="font-size:13pt;font-weight:800;">${sireAnimal?.tagId || animal.externalSireInfo || "Unknown"}</div>
        ${sireAnimal?.name ? `<div style="font-size:9pt;color:#555;">${sireAnimal.name}</div>` : ''}
      </div>
      <div style="border:2px solid #ec4899;border-radius:6px;padding:8px 16px;min-width:80mm;text-align:center;background:white;">
        <div style="font-size:8pt;font-weight:700;color:#555;text-transform:uppercase;">DAM</div>
        <div style="font-size:13pt;font-weight:800;">${damAnimal?.tagId || animal.externalDamInfo || "Unknown"}</div>
        ${damAnimal?.name ? `<div style="font-size:9pt;color:#555;">${damAnimal.name}</div>` : ''}
      </div>
    </div>
  </div>
  <div class="footer">
    <div class="footer-info"><p class="footer-farm">${fb?.studName || fb?.farmName || "BreedLog"}</p><p>${fb?.ownerName || ""}</p></div>
    <div class="footer-branding"><div class="bl">BREEDLOG</div><div class="tag">Professional Livestock Management</div></div>
  </div>
</div>` : '';

        // ── Full HTML document ────────────────────────────────────────────────
        const content = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>${animal.tagId || 'Animal'} — Performance Datasheet</title>
<style>
${includeTree ? '@page { margin: 8mm 10mm; } @page landscape-page { size: A4 landscape; }' : '@page { size: A4 portrait; margin: 8mm 10mm; }'}
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 8.5pt; color: #1a1a1a; background: white; }
.page { width: 190mm; min-height: 257mm; padding-bottom: 22mm; position: relative; }
.hdr { display: flex; align-items: center; justify-content: space-between; padding-bottom: 3mm; border-bottom: 2.5px solid #FFC300; margin-bottom: 3mm; }
.hdr-logo { width: 46px; height: 46px; object-fit: contain; }
.hdr-logo-placeholder { width: 46px; }
.hdr-center { flex: 1; text-align: center; }
.hdr-center h1 { font-size: 13pt; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; }
.hdr-center p { font-size: 7.5pt; color: #666; margin-top: 2px; }
.hdr-right { text-align: right; font-size: 7.5pt; color: #666; white-space: nowrap; }
.id-block { display: flex; gap: 5mm; margin-bottom: 3mm; align-items: flex-start; }
.id-photo { width: 52mm; height: 42mm; object-fit: cover; border: 1.5px solid #ddd; border-radius: 4px; display: block; }
.no-photo { width: 52mm; height: 42mm; background: #f5f5f5; border: 1.5px dashed #bbb; border-radius: 4px; display: flex; align-items: center; justify-content: center; color: #aaa; font-size: 8pt; text-align: center; }
.id-tag { font-size: 16pt; font-weight: 800; letter-spacing: .5px; line-height: 1; }
.id-name { font-size: 10pt; color: #444; margin-bottom: 2mm; margin-top: 1px; }
.ft { width: 100%; border-collapse: collapse; }
.ft td { padding: 2.5px 5px; font-size: 8pt; border-bottom: 1px solid #efefef; vertical-align: top; }
.fl { width: 44%; font-weight: 600; color: #555; }
.fv { color: #1a1a1a; }
.sh { background: #FFC300; color: #000; font-weight: 700; font-size: 7.5pt; text-transform: uppercase; padding: 3px 5px; }
.rating-strip { display: flex; align-items: center; gap: 3mm; background: #f8f8f8; border: 1px solid #e0e0e0; border-radius: 3px; padding: 2mm 3mm; margin-bottom: 3mm; flex-wrap: wrap; }
.rating-badge { background: ${ratingColor}; color: white; font-weight: 700; font-size: 8.5pt; padding: 2px 7px; border-radius: 3px; text-transform: uppercase; white-space: nowrap; }
.rating-role { font-weight: 700; font-size: 8pt; color: #333; text-transform: uppercase; letter-spacing: .5px; }
.rating-conf { font-size: 7.5pt; color: #666; }
.rating-reason { font-size: 7.5pt; color: #444; flex: 1; font-style: italic; }
.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 3mm; margin-bottom: 3mm; }
.section { border: 1px solid #e0e0e0; border-radius: 3px; overflow: hidden; }
.full-col { border: 1px solid #e0e0e0; border-radius: 3px; overflow: hidden; margin-bottom: 3mm; }
.sec-title { background: #FFC300; color: #000; font-weight: 700; font-size: 7.5pt; text-transform: uppercase; padding: 3px 6px; }
.sec-body { padding: 2mm; }
.no-data { padding: 4mm; color: #888; font-style: italic; font-size: 8pt; text-align: center; }
.ped-row { display: flex; gap: 3mm; padding: 2mm; }
.ped-box { flex: 1; border-radius: 3px; padding: 2mm 3mm; }
.sire-box { background: #eff6ff; border: 1px solid #bfdbfe; }
.dam-box { background: #fdf2f8; border: 1px solid #f9a8d4; }
.ped-lbl { font-size: 7pt; font-weight: 700; text-transform: uppercase; color: #666; }
.ped-id { font-size: 11pt; font-weight: 800; color: #1a1a1a; }
.ped-det { font-size: 7.5pt; color: #555; margin-top: 1px; }
.health-row { font-size: 7.5pt; color: #333; padding: 1.5px 0; border-bottom: 1px solid #f5f5f5; }
.health-more { font-size: 7pt; color: #888; margin-top: 2px; font-style: italic; }
.summary-box { background: #fffbeb; border: 1px solid #fde68a; border-radius: 3px; padding: 3mm; margin-bottom: 3mm; }
.summary-lbl { font-size: 7pt; font-weight: 700; text-transform: uppercase; color: #92400e; margin-bottom: 2px; letter-spacing: .5px; }
.summary-text { font-size: 8.5pt; color: #1a1a1a; line-height: 1.5; }
.footer { display: flex; align-items: center; justify-content: space-between; background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%); color: white; padding: 3mm 5mm; border-top: 2.5px solid #FFC300; border-radius: 2mm; position: absolute; bottom: 0; left: 0; right: 0; }
.footer-info { flex: 1; }
.footer-farm { font-size: 9pt; font-weight: 700; color: #FFC300; margin: 0; }
.footer-info p { font-size: 7pt; margin-top: 1px; color: #ccc; }
.footer-branding { text-align: right; }
.bl { font-size: 11pt; font-weight: 800; color: white; letter-spacing: 1px; }
.tag { font-size: 7pt; font-style: italic; color: #FFC300; margin-top: 1px; }
@media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>
<div class="page">
  <div class="hdr">
    <div>${fb?.logoUrl ? `<img src="${fb.logoUrl}" class="hdr-logo" alt="Logo" />` : '<div class="hdr-logo-placeholder"></div>'}</div>
    <div class="hdr-center"><h1>${fb?.studName || fb?.farmName || "BreedLog"}</h1><p>Individual Animal Performance Datasheet</p></div>
    <div class="hdr-right"><div style="font-weight:700">${animal.tagId || "—"}</div><div>${exportDate}</div></div>
  </div>
  <div class="id-block">
    <div style="width:52mm;flex-shrink:0">${photoHtml}</div>
    <div style="flex:1">
      <div class="id-tag">${animal.tagId || "—"}</div>
      ${animal.name ? `<div class="id-name">${animal.name}</div>` : ''}
      <table class="ft">
        ${row("Sex", animal.sex ? animal.sex.charAt(0).toUpperCase() + animal.sex.slice(1) : null)}
        ${row("Breed", animal.breed || "Meatmaster")}
        ${row("Date of Birth", formatDate(animal.birthDate))}
        ${row("Age", ageStr)}
        ${row("Status", animal.status ? animal.status.charAt(0).toUpperCase() + animal.status.slice(1) : null)}
        ${row("Classification", animal.classification ? animal.classification.replace(/_/g, ' ') : null)}
        ${row("Lambing Season", animal.lambingSeason)}
        ${row("Birth Type", animal.birthStatus ? animal.birthStatus.charAt(0).toUpperCase() + animal.birthStatus.slice(1) : null)}
        ${row("Electronic ID", animal.electronicId)}
      </table>
    </div>
  </div>
  <div class="rating-strip">
    <span class="rating-badge">${profile.overallRating}</span>
    <span class="rating-role">${roleLabel}</span>
    <span class="rating-conf">· ${confidenceLabel[profile.dataConfidence]}</span>
    <span class="rating-reason">${profile.ratingReason}</span>
  </div>
  <div class="two-col">
    <div class="section">
      <div class="sec-title">Growth Performance</div>
      <div class="sec-body"><table class="ft">
        ${row("Birth Weight", kg(profile.growthMetrics.birthWeight))}
        ${row("100-Day Weight", kg(profile.growthMetrics.weight100Day))}
        ${row("270-Day Weight", kg(profile.growthMetrics.weight270Day))}
        ${row("Current Weight", kg(profile.growthMetrics.currentWeight))}
        ${row("ADG Birth → 100d", gday(profile.growthMetrics.adgBirthTo100))}
        ${row("ADG Birth → 270d", gday(profile.growthMetrics.adgBirthTo270))}
        ${row("ADG Birth → Current", gday(profile.growthMetrics.adgBirthToCurrent))}
      </table></div>
    </div>
    <div class="section">
      <div class="sec-title">${specificTitle}</div>
      <div class="sec-body">${buildTypeSpecificSection()}</div>
    </div>
  </div>
  <div class="full-col">
    <div class="sec-title">Pedigree</div>
    ${pedigreeSection}
  </div>
  ${healthSection}
  <div class="summary-box">
    <div class="summary-lbl">Performance Summary</div>
    <div class="summary-text">${profile.summary}</div>
  </div>
  <div class="footer">
    <div class="footer-info">
      <p class="footer-farm">${fb?.studName || fb?.farmName || "BreedLog"}</p>
      <p>${fb?.ownerName || ""} ${fb?.ownerPhone ? "· " + fb.ownerPhone : ""}</p>
    </div>
    <div class="footer-branding"><div class="bl">BREEDLOG</div><div class="tag">Professional Livestock Management</div></div>
  </div>
</div>
${familyTreePage}
</body>
</html>`;

        // ── Print via blob URL + onload ───────────────────────────────────────
        // Blob URL avoids cross-origin issues in the print window and works
        // reliably in PWA standalone mode where window.open('','_blank') + document.write fails.
        const blob = new Blob([content], { type: "text/html; charset=utf-8" });
        const blobUrl = URL.createObjectURL(blob);
        const printWindow = window.open(blobUrl, "_blank");
        if (!printWindow) {
            URL.revokeObjectURL(blobUrl);
            toast({
                title: "Pop-up blocked",
                description: "Allow pop-ups for BreedLog in your browser settings, then try again.",
                variant: "destructive",
            });
            return;
        }
        // onload fires once the blob page is fully rendered; fallback at 2.5s for browsers that don't fire it
        printWindow.onload = () => {
            setTimeout(() => { printWindow.print(); URL.revokeObjectURL(blobUrl); }, 400);
        };
        setTimeout(() => { try { printWindow.print(); } catch {} URL.revokeObjectURL(blobUrl); }, 2500);

        createExportedDoc.mutate({
            name: getDocumentFileName("PerformanceDatasheet", animal.tagId || `ID${animal.id}`),
            documentType: "individual",
            subfolder: "individual",
            animalId: animal.id,
            metadata: {
              exportType: "pdf",
              category: includeTree ? "individual-with-family-tree" : "individual-performance",
              sourceSection: "individual",
              animalCount: 1,
              pageCount: includeTree ? 2 : 1,
              status: "success",
              rowsSummary: [{ tagId: animal.tagId, sex: animal.sex, breed: animal.breed, status: animal.status }],
            }
        });
        toast({ title: "PDF Ready", description: `Performance datasheet opened for ${animal.tagId}` });
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
    const { data: farmSettings } = useFarmSettings();
    const cameraInputRef = useRef<HTMLInputElement>(null);
    const galleryInputRef = useRef<HTMLInputElement>(null);
    const evalDocInputRef = useRef<HTMLInputElement>(null);
    
    const getInitialFormData = () => ({
        tagId: animal.tagId || "",
        name: animal.name || "",
        sex: animal.sex || "ewe",
        breed: animal.breed || "Meatmaster",
        classification: animal.classification || "unclassified",
        animalSource: (animal as any).animalSource || "unknown_not_recorded",
        status: animal.status || "active",
        birthDate: animal.birthDate || "",
        birthStatus: animal.birthStatus || "",
        birthWeight: animal.birthWeight || "",
        birthWeightEstimated: !!(animal as any).birthWeightEstimated,
        currentWeight: animal.currentWeight || "",
        weight100Day: animal.weight100Day || "",
        weight100DayDate: animal.weight100DayDate || "",
        weight100DayEstimated: !!(animal as any).weight100DayEstimated,
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
    
    const [formData, setFormData] = useState(getInitialFormData());
    const [photoPreview, setPhotoPreview] = useState<string | null>(animal.photo || null);
    const [evalDocName, setEvalDocName] = useState<string | null>(animal.evaluationDocument ? "Existing Document" : null);
    const [useCustomDam, setUseCustomDam] = useState(!!animal.externalDamInfo);
    const [useCustomSire, setUseCustomSire] = useState(!!animal.externalSireInfo);
    const [cropSourceImage, setCropSourceImage] = useState<string | null>(null);
    const [showCropDialog, setShowCropDialog] = useState(false);
    
    // Reset form data when animal changes or dialog opens
    useEffect(() => {
        if (open) {
            setFormData(getInitialFormData());
            setPhotoPreview(animal.photo || null);
            setEvalDocName(animal.evaluationDocument ? "Existing Document" : null);
            setUseCustomDam(!!animal.externalDamInfo);
            setUseCustomSire(!!animal.externalSireInfo);
        }
    }, [open, animal.id]);
    
    const ewes = allAnimals?.filter(a => a.sex === "ewe" && a.id !== animal.id) || [];
    const rams = allAnimals?.filter(a => a.sex === "ram" && a.id !== animal.id) || [];

    const [isCompressing, setIsCompressing] = useState(false);
    const normalizedTagPreview = splitTagInput(formData.tagId, formData.studPrefix || farmSettings?.studPrefix || "").canonicalTag;

    const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 20 * 1024 * 1024) {
                toast({ title: "Photo too large", description: "Please use a photo under 20MB", variant: "destructive" });
                return;
            }
            try {
                setIsCompressing(true);
                toast({ title: "Optimising image...", description: "Please wait" });
                const { compressImageWithFeedback, formatFileSize } = await import("@/lib/image-compression");
                const result = await compressImageWithFeedback(file, { maxWidth: 1600, quality: 0.75 });
                setCropSourceImage(result.base64);
                setShowCropDialog(true);
                const reduction = Math.round((1 - result.compressedSize / result.originalSize) * 100);
                toast({ 
                    title: "Photo ready", 
                    description: `Optimised to ${formatFileSize(result.compressedSize)} (${reduction}% smaller). Crop before saving.` 
                });
            } catch {
                toast({ title: "Error", description: "Failed to process image", variant: "destructive" });
            } finally {
                setIsCompressing(false);
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
        const weightFields: Array<[string, string]> = [
            ["birthWeight", formData.birthWeight],
            ["currentWeight", formData.currentWeight],
            ["weight100Day", formData.weight100Day],
        ];
        for (const [field, value] of weightFields) {
            if (!isMetricWeight(value)) {
                toast({ title: "Invalid value", description: `${field} must be numeric in kg`, variant: "destructive" });
                return;
            }
        }
        const birth = resolveBirthWeight(formData.birthWeight, formData.birthWeightEstimated);
        const weaning = resolveWeaningWeight(formData.weight100Day, formData.weight100DayEstimated);

        // Clean up empty strings for date fields to avoid database errors
        const cleanedData = {
            ...formData,
            birthDate: formData.birthDate || null,
            weight100DayDate: formData.weight100DayDate || null,
            birthWeight: birth.value,
            birthWeightEstimated: birth.estimated,
            currentWeight: formData.currentWeight || null,
            weight100Day: weaning.value,
            weight100DayEstimated: weaning.estimated,
            birthStatus: formData.birthStatus || null,
            animalSource: formData.animalSource || "unknown_not_recorded",
            weaningStatus: formData.weaningStatus || null,
            electronicId: formData.electronicId?.trim() || null,
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
                    <ImageCropDialog
                        open={showCropDialog}
                        imageSrc={cropSourceImage}
                        onCancel={() => {
                            setShowCropDialog(false);
                            setCropSourceImage(null);
                        }}
                        onConfirm={(cropped) => {
                            setPhotoPreview(cropped);
                            setFormData(prev => ({ ...prev, photo: cropped }));
                            setShowCropDialog(false);
                            setCropSourceImage(null);
                        }}
                    />
                    
                    {photoPreview ? (
                        <div className="relative">
                            <img src={photoPreview} alt="Animal" className="w-full h-28 md:h-40 object-cover rounded-md border border-border" />
                            <div className="absolute top-1 right-1 flex gap-1">
                                <Button type="button" variant="secondary" size="icon" className="h-7 w-7" onClick={() => galleryInputRef.current?.click()} data-testid="button-change-photo">
                                    <Image className="w-3 h-3" />
                                </Button>
                                <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={() => { setPhotoPreview(null); setFormData(prev => ({...prev, photo: null})); }} data-testid="button-clear-photo">
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
                            <p className="text-[10px] text-muted-foreground mt-1">Display tag preview: <strong>{normalizedTagPreview || "—"}</strong></p>
                        </div>
                        <div>
                            <Label className="text-[11px] md:text-xs">Name</Label>
                            <Input value={formData.name} onChange={(e) => setFormData(prev => ({...prev, name: e.target.value}))} className="rugged-input h-8 text-sm" data-testid="input-edit-name" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 md:gap-2">
                        <div>
                            <Label className="text-[11px] md:text-xs">Sex</Label>
                            <Select value={formData.sex} onValueChange={(val) => setFormData(prev => ({...prev, sex: val}))}>
                                <SelectTrigger className="rugged-input h-8 text-xs" data-testid="select-edit-sex"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ram">Ram</SelectItem>
                                    <SelectItem value="ewe">Ewe</SelectItem>
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
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 md:gap-2">
                        <div>
                            <Label className="text-[11px] md:text-xs">Classification</Label>
                            <Select value={formData.classification} onValueChange={(val) => setFormData(prev => ({...prev, classification: val}))}>
                                <SelectTrigger className="rugged-input h-8 text-xs" data-testid="select-edit-classification"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="unclassified">Unclassified</SelectItem>
                                    <SelectItem value="stud">Stud</SelectItem>
                                    <SelectItem value="commercial">Commercial</SelectItem>
                                    <SelectItem value="slaughter_cull">Slaughter/Cull</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label className="text-[11px] md:text-xs">Source</Label>
                            <Select value={formData.animalSource || "unknown_not_recorded"} onValueChange={(val) => setFormData(prev => ({...prev, animalSource: val}))}>
                                <SelectTrigger className="rugged-input h-8 text-xs" data-testid="select-edit-animal-source"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="born_on_farm">Born on farm</SelectItem>
                                    <SelectItem value="bought_in">Bought in</SelectItem>
                                    <SelectItem value="unknown_not_recorded">Unknown / not recorded</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label className="text-[11px] md:text-xs">Birth Type</Label>
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
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <Label className="text-[11px] md:text-xs">Birth Weight (kg)</Label>
                            <Input type="number" step="0.1" value={formData.birthWeight} onChange={(e) => setFormData(prev => ({...prev, birthWeight: e.target.value}))} className="rugged-input h-8 text-sm" data-testid="input-edit-birth-weight" />
                        </div>
                        <div className="flex items-end pb-1">
                            <label className="text-[11px] md:text-xs flex items-center gap-2">
                                <input type="checkbox" checked={formData.birthWeightEstimated} onChange={(e) => setFormData(prev => ({ ...prev, birthWeightEstimated: e.target.checked }))} />
                                Birth weight is estimated
                            </label>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <Label className="text-[11px] md:text-xs">Weaning Date</Label>
                            <Input type="date" value={formData.weight100DayDate || ""} onChange={(e) => setFormData(prev => ({...prev, weight100DayDate: e.target.value}))} className="rugged-input h-8 text-xs" data-testid="input-edit-weaning-date" />
                        </div>
                        <div>
                            <Label className="text-[11px] md:text-xs">Weaning Weight (kg)</Label>
                            <Input type="number" step="0.1" value={formData.weight100Day} onChange={(e) => setFormData(prev => ({...prev, weight100Day: e.target.value}))} className="rugged-input h-8 text-sm" data-testid="input-edit-weaning-weight" />
                        </div>
                    </div>
                    <div className="flex items-center pb-1">
                        <label className="text-[11px] md:text-xs flex items-center gap-2">
                            <input type="checkbox" checked={formData.weight100DayEstimated} onChange={(e) => setFormData(prev => ({ ...prev, weight100DayEstimated: e.target.checked }))} />
                            Weaning weight is estimated
                        </label>
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
    const [isCompressing, setIsCompressing] = useState(false);
    const [imageToDelete, setImageToDelete] = useState<number | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            try {
                setIsCompressing(true);
                toast({ title: "Optimising image...", description: "Please wait" });
                const { compressImageWithFeedback, formatFileSize } = await import("@/lib/image-compression");
                const result = await compressImageWithFeedback(file, { maxWidth: 1600, quality: 0.75 });
                const reduction = Math.round((1 - result.compressedSize / result.originalSize) * 100);
                uploadImage({
                    animalId,
                    imageData: result.base64,
                    fileName: file.name,
                });
                toast({ 
                    title: "Photo ready", 
                    description: `Optimised to ${formatFileSize(result.compressedSize)} (${reduction}% smaller)` 
                });
            } catch (error) {
                toast({ title: "Error", description: "Failed to process image", variant: "destructive" });
            } finally {
                setIsCompressing(false);
            }
        }
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleDeleteConfirm = () => {
        if (imageToDelete !== null) {
            deleteImage({ animalId, imageId: imageToDelete });
            setImageToDelete(null);
        }
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
                    disabled={isUploading || isCompressing}
                    data-testid="button-add-image"
                >
                    <Upload className="w-4 h-4 mr-2" /> 
                    {isCompressing ? "Optimising image..." : isUploading ? "Uploading..." : "Add Photo to Folder"}
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
                                    variant="outline"
                                    size="icon"
                                    className="absolute -top-2 -right-2 scale-75"
                                    onClick={() => setImageToDelete(img.id)}
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

                {/* Delete confirmation dialog */}
                <AlertDialog open={imageToDelete !== null} onOpenChange={(open) => !open && setImageToDelete(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Delete Image</AlertDialogTitle>
                            <AlertDialogDescription>
                                Are you sure you want to delete this image? This action cannot be undone.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel data-testid="button-cancel-delete-image">Cancel</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={handleDeleteConfirm}
                                disabled={isDeleting}
                                className="bg-white text-red-600 border border-red-200 hover:bg-red-50"
                                data-testid="button-confirm-delete-image"
                            >
                                {isDeleting ? "Deleting..." : "Delete"}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </CardContent>
        </Card>
    );
}

function DocumentsView({ animalId }: { animalId: number }) {
    const [documents, setDocuments] = useState<{id: string, name: string, url: string, date: string}[]>([]);
    const [selectedDoc, setSelectedDoc] = useState<string | null>(null);
    const [docToDelete, setDocToDelete] = useState<string | null>(null);
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

    const handleDeleteConfirm = () => {
        if (docToDelete) {
            setDocuments(prev => prev.filter(d => d.id !== docToDelete));
            setDocToDelete(null);
        }
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
                                    variant="outline"
                                    size="icon"
                                    className="absolute -top-2 -right-2 scale-75"
                                    onClick={() => setDocToDelete(doc.id)}
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

                {/* Delete confirmation dialog */}
                <AlertDialog open={docToDelete !== null} onOpenChange={(open) => !open && setDocToDelete(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Delete Document</AlertDialogTitle>
                            <AlertDialogDescription>
                                Are you sure you want to delete this document? This action cannot be undone.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel data-testid="button-cancel-delete-doc">Cancel</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={handleDeleteConfirm}
                                className="bg-white text-red-600 border border-red-200 hover:bg-red-50"
                                data-testid="button-confirm-delete-doc"
                            >
                                Delete
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </CardContent>
        </Card>
    );
}
