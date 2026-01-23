import { useState, useRef } from "react";
import { Layout } from "@/components/Layout";
import { useAnimals, useCreateAnimal, useDeleteAnimal } from "@/hooks/use-animals";
import { useFarmSettings } from "@/hooks/use-farm-settings";
import { AnimalCard } from "@/components/AnimalCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertAnimalSchema, type Animal } from "@shared/schema";
import { Search, Plus, Filter, Camera, X, Image, FileText, Trash2, MoreVertical } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import logo from "@assets/BREEDLOG_LOGO_1768730745128.png";

export default function Animals() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [sexFilter, setSexFilter] = useState("all");
  const { data: allAnimals, isLoading } = useAnimals({ search });
  const { data: farmSettings } = useFarmSettings();
  const displayName = farmSettings?.studName || farmSettings?.farmName;
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const isMobile = useIsMobile();

  const filteredAnimals = allAnimals?.filter(animal => {
    if (statusFilter === "all") {
    } else if (statusFilter === "active") {
      if (animal.status !== "active") return false;
    } else if (statusFilter === "archived") {
      if (!["sold", "dead", "culled"].includes(animal.status || "")) return false;
    } else {
      if (animal.status !== statusFilter) return false;
    }
    if (sexFilter !== "all" && animal.sex?.toLowerCase() !== sexFilter) return false;
    return true;
  });

  return (
    <Layout>
      <div className="space-y-4 md:space-y-6 animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <h1 className="text-xl md:text-4xl font-black uppercase tracking-tight" data-testid="page-title">
            {displayName ? `${displayName} - Livestock` : "Livestock"}
          </h1>
          <CreateAnimalDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} />
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-3 bg-card p-3 md:p-4 rounded-md border border-border shadow-sm">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search by Tag ID..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 rugged-input"
              data-testid="input-search"
            />
          </div>
          <div className="flex gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[140px] rugged-input" data-testid="select-status-filter">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sheep</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
                <SelectItem value="sold">Sold</SelectItem>
                <SelectItem value="dead">Dead</SelectItem>
                <SelectItem value="culled">Culled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sexFilter} onValueChange={setSexFilter}>
              <SelectTrigger className="w-full md:w-[140px] rugged-input" data-testid="select-sex-filter">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="ewe">Ewes</SelectItem>
                <SelectItem value="ram">Rams</SelectItem>
                <SelectItem value="wether">Wethers</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* List/Grid View */}
        {isLoading ? (
          <div className="space-y-3 md:grid md:grid-cols-2 lg:grid-cols-4 md:gap-6 md:space-y-0">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
              <Skeleton key={i} className="h-20 md:aspect-[4/3] rounded-md bg-secondary" />
            ))}
          </div>
        ) : isMobile ? (
          <div className="space-y-2">
            {filteredAnimals?.map(animal => (
              <AnimalListRow key={animal.id} animal={animal} />
            ))}
            {filteredAnimals?.length === 0 && (
              <div className="py-12 text-center text-muted-foreground">
                <p>No animals found matching your criteria.</p>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {filteredAnimals?.map(animal => (
              <AnimalCard key={animal.id} animal={animal} />
            ))}
            {filteredAnimals?.length === 0 && (
              <div className="col-span-full py-12 text-center text-muted-foreground">
                <p>No animals found matching your criteria.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}

function AnimalListRow({ animal }: { animal: Animal }) {
  const { mutate: deleteAnimal, isPending } = useDeleteAnimal();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const isRam = animal.sex?.toLowerCase() === 'ram';
  const isEwe = animal.sex?.toLowerCase() === 'ewe';

  return (
    <>
      <Link href={`/animals/${animal.id}`}>
        <Card className="flex items-center p-3 gap-3 hover:border-primary transition-colors cursor-pointer">
          <div className="w-16 h-16 rounded-md bg-secondary overflow-hidden flex-shrink-0">
            {animal.photo ? (
              <img src={animal.photo} alt={animal.tagId} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center opacity-30">
                <img src={logo} className="w-10 h-10 grayscale" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg truncate">{animal.tagId}</span>
              <Badge variant="secondary" className={cn(
                "text-[10px] px-1.5 py-0",
                animal.status === 'active' ? "bg-green-900/80 text-green-100" : "bg-red-900/80 text-red-100"
              )}>
                {animal.status}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground truncate">{animal.breed || "Meatmaster"}</p>
          </div>
          <div className="text-right flex-shrink-0">
            <span className={cn(
              "text-sm font-medium capitalize",
              isRam ? "text-blue-400" : isEwe ? "text-pink-400" : "text-muted-foreground"
            )}>
              {animal.sex}
            </span>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.preventDefault()}>
              <Button size="icon" variant="ghost" className="flex-shrink-0" data-testid={`button-menu-${animal.id}`}>
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem 
                className="text-destructive focus:text-destructive"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowDeleteDialog(true);
                }}
                data-testid={`button-delete-${animal.id}`}
              >
                <Trash2 className="w-4 h-4 mr-2" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </Card>
      </Link>
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Animal Profile</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete <strong>{animal.tagId}</strong>
              {animal.name ? ` (${animal.name})` : ''}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteAnimal(animal.id)}
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function CreateAnimalDialog({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
  const { mutate, isPending } = useCreateAnimal();
  const { toast } = useToast();
  const { data: allAnimals } = useAnimals({});
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const evalDocInputRef = useRef<HTMLInputElement>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [evalDocPreview, setEvalDocPreview] = useState<string | null>(null);
  const [useCustomDam, setUseCustomDam] = useState(false);
  const [useCustomSire, setUseCustomSire] = useState(false);
  
  const form = useForm({
    resolver: zodResolver(insertAnimalSchema),
    defaultValues: {
      tagId: "",
      sex: "ewe",
      breed: "Meatmaster",
      status: "active",
      birthDate: new Date().toISOString().split('T')[0],
      currentWeight: "0",
      damId: null as number | null,
      sireId: null as number | null,
      externalDamInfo: "" as string,
      externalSireInfo: "" as string,
      photo: null as string | null,
      evaluationDocument: null as string | null,
    }
  });

  const ewes = allAnimals?.filter(a => a.sex === "ewe") || [];
  const rams = allAnimals?.filter(a => a.sex === "ram") || [];

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({ title: "Photo too large", description: "Please use a photo under 5MB", variant: "destructive" });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setPhotoPreview(base64);
        form.setValue("photo", base64);
      };
      reader.readAsDataURL(file);
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
        setEvalDocPreview(file.name);
        form.setValue("evaluationDocument", base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearPhoto = () => {
    setPhotoPreview(null);
    form.setValue("photo", null);
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    if (galleryInputRef.current) galleryInputRef.current.value = "";
  };

  const clearEvalDoc = () => {
    setEvalDocPreview(null);
    form.setValue("evaluationDocument", null);
    if (evalDocInputRef.current) evalDocInputRef.current.value = "";
  };

  const onSubmit = (data: any) => {
    mutate(data, {
      onSuccess: () => {
        onOpenChange(false);
        resetForm();
        toast({ title: "Animal added", description: "New animal record created successfully" });
      }
    });
  };

  const resetForm = () => {
    form.reset();
    setPhotoPreview(null);
    setEvalDocPreview(null);
    setUseCustomDam(false);
    setUseCustomSire(false);
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      resetForm();
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button data-testid="button-add-animal" className="rugged-btn bg-primary text-black hover:bg-primary/90">
          <Plus className="w-5 h-5 mr-2" /> Add Animal
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display uppercase text-2xl">New Animal Entry</DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="tagId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tag ID</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. 24-001" className="rugged-input" data-testid="input-tag-id" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="sex"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sex</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="rugged-input" data-testid="select-sex">
                          <SelectValue placeholder="Select sex" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="ram">Ram</SelectItem>
                        <SelectItem value="ewe">Ewe</SelectItem>
                        <SelectItem value="wether">Wether</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="breed"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Breed</FormLabel>
                  <FormControl>
                    <Input className="rugged-input" data-testid="input-breed" {...field} value={field.value || ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="birthDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Birth Date</FormLabel>
                    <FormControl>
                      <Input type="date" className="rugged-input" data-testid="input-birth-date" {...field} value={field.value ? String(field.value) : ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="currentWeight"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Weight (kg)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.1" className="rugged-input" data-testid="input-weight" {...field} value={field.value ? String(field.value) : ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Dam Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <FormLabel>Dam (Mother)</FormLabel>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm"
                  onClick={() => {
                    setUseCustomDam(!useCustomDam);
                    if (!useCustomDam) form.setValue("damId", null);
                    else form.setValue("externalDamInfo", "");
                  }}
                  data-testid="button-toggle-dam-mode"
                >
                  {useCustomDam ? "Select from list" : "Not in system"}
                </Button>
              </div>
              {useCustomDam ? (
                <FormField
                  control={form.control}
                  name="externalDamInfo"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input 
                          placeholder="Enter dam info (Tag ID, name, breeder)" 
                          className="rugged-input" 
                          data-testid="input-external-dam"
                          {...field} 
                          value={field.value || ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : (
                <FormField
                  control={form.control}
                  name="damId"
                  render={({ field }) => (
                    <FormItem>
                      <Select 
                        onValueChange={(val) => field.onChange(val === "none" ? null : parseInt(val))} 
                        value={field.value ? String(field.value) : "none"}
                      >
                        <FormControl>
                          <SelectTrigger className="rugged-input" data-testid="select-dam">
                            <SelectValue placeholder="Select dam" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">Unknown</SelectItem>
                          {ewes.map(ewe => (
                            <SelectItem key={ewe.id} value={String(ewe.id)}>
                              {ewe.tagId} {ewe.name ? `- ${ewe.name}` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            {/* Sire Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <FormLabel>Sire (Father)</FormLabel>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm"
                  onClick={() => {
                    setUseCustomSire(!useCustomSire);
                    if (!useCustomSire) form.setValue("sireId", null);
                    else form.setValue("externalSireInfo", "");
                  }}
                  data-testid="button-toggle-sire-mode"
                >
                  {useCustomSire ? "Select from list" : "Not in system"}
                </Button>
              </div>
              {useCustomSire ? (
                <FormField
                  control={form.control}
                  name="externalSireInfo"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input 
                          placeholder="Enter sire info (Tag ID, name, breeder)" 
                          className="rugged-input" 
                          data-testid="input-external-sire"
                          {...field} 
                          value={field.value || ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : (
                <FormField
                  control={form.control}
                  name="sireId"
                  render={({ field }) => (
                    <FormItem>
                      <Select 
                        onValueChange={(val) => field.onChange(val === "none" ? null : parseInt(val))} 
                        value={field.value ? String(field.value) : "none"}
                      >
                        <FormControl>
                          <SelectTrigger className="rugged-input" data-testid="select-sire">
                            <SelectValue placeholder="Select sire" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">Unknown</SelectItem>
                          {rams.map(ram => (
                            <SelectItem key={ram.id} value={String(ram.id)}>
                              {ram.tagId} {ram.name ? `- ${ram.name}` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>
            
            {/* Photo Section - Camera & Gallery */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhotoCapture}
              className="hidden"
              data-testid="input-photo-camera"
            />
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoCapture}
              className="hidden"
              data-testid="input-photo-gallery"
            />
            
            {photoPreview ? (
              <div className="relative">
                <img 
                  src={photoPreview} 
                  alt="Preview" 
                  className="w-full h-48 object-cover rounded-md border border-border"
                  data-testid="img-photo-preview"
                />
                <Button 
                  type="button" 
                  variant="destructive" 
                  size="icon"
                  className="absolute top-2 right-2"
                  onClick={clearPhoto}
                  data-testid="button-clear-photo"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  data-testid="button-take-photo" 
                  className="rugged-btn border-dashed"
                  onClick={() => cameraInputRef.current?.click()}
                >
                  <Camera className="w-4 h-4 mr-2" /> Camera
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  data-testid="button-select-gallery" 
                  className="rugged-btn border-dashed"
                  onClick={() => galleryInputRef.current?.click()}
                >
                  <Image className="w-4 h-4 mr-2" /> Gallery
                </Button>
              </div>
            )}

            {/* Evaluation Document Upload */}
            <input
              ref={evalDocInputRef}
              type="file"
              accept="image/*,.pdf"
              onChange={handleEvalDocUpload}
              className="hidden"
              data-testid="input-eval-doc"
            />
            
            {evalDocPreview ? (
              <div className="flex items-center justify-between p-3 bg-secondary rounded-md border border-border">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  <span className="text-sm truncate max-w-[200px]">{evalDocPreview}</span>
                </div>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="icon"
                  onClick={clearEvalDoc}
                  data-testid="button-clear-eval-doc"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <Button 
                type="button" 
                variant="outline" 
                data-testid="button-upload-eval-doc" 
                className="w-full rugged-btn border-dashed"
                onClick={() => evalDocInputRef.current?.click()}
              >
                <FileText className="w-4 h-4 mr-2" /> Attach Evaluation Document
              </Button>
            )}

            <Button type="submit" disabled={isPending} data-testid="button-save-animal" className="w-full rugged-btn bg-primary text-black">
              {isPending ? "Creating..." : "Save Record"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
