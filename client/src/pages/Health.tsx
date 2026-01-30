import { Layout } from "@/components/Layout";
import { useAnimals } from "@/hooks/use-animals";
import { useFarmSettings } from "@/hooks/use-farm-settings";
import { useCreateExportedDocument } from "@/hooks/use-exported-documents";
import { useFlockHealthEvents, useCreateFlockHealthEvent } from "@/hooks/use-flock-health";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Syringe, ChevronRight, Calendar, Users } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { insertFlockHealthEventSchema } from "@shared/schema";

const flockHealthFormSchema = insertFlockHealthEventSchema
  .pick({
    eventName: true,
    eventDate: true,
    productName: true,
    route: true,
    notes: true,
  })
  .extend({
    eventName: insertFlockHealthEventSchema.shape.eventName.refine(val => val && val.length > 0, "Event name is required"),
    eventDate: insertFlockHealthEventSchema.shape.eventDate.refine(val => val && val.length > 0, "Event date is required"),
    productName: insertFlockHealthEventSchema.shape.productName.refine(val => val && val.length > 0, "Product/treatment name is required"),
  });

export default function Health() {
  const { data: healthEvents, isLoading } = useFlockHealthEvents();
  const { data: animals } = useAnimals({});
  const { data: farmSettings } = useFarmSettings();
  const displayName = farmSettings?.studName || farmSettings?.farmName;
  const [openRecord, setOpenRecord] = useState(false);

  const sortedEvents = [...(healthEvents || [])].sort((a, b) => {
    const dateA = new Date(a.createdAt || a.eventDate);
    const dateB = new Date(b.createdAt || b.eventDate);
    return dateB.getTime() - dateA.getTime();
  });

  return (
    <Layout>
      <div className="space-y-4 md:space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-2 md:gap-4">
          <div>
            <p className="text-primary text-[10px] md:text-xs font-bold tracking-widest uppercase">
              {displayName || "BreedLog"}
            </p>
            <h1 className="text-xl md:text-3xl font-bold text-foreground tracking-tight uppercase" data-testid="page-title">
              Health
            </h1>
            <p className="text-muted-foreground text-xs md:text-sm mt-0.5">Flock health treatments and records</p>
          </div>
          <Button 
            onClick={() => setOpenRecord(true)}
            className="rugged-btn bg-primary text-black"
            data-testid="button-record-health-event"
          >
            <Plus className="w-4 h-4 mr-2" /> Record Event
          </Button>
        </div>

        <Card className="rugged-card">
          <CardHeader className="p-3 md:p-6 pb-2">
            <CardTitle className="uppercase text-sm md:text-lg flex items-center gap-2">
              <Syringe className="w-4 h-4 md:w-5 md:h-5 text-primary" />
              Health Events
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 md:p-6 pt-0">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : sortedEvents.length === 0 ? (
              <div className="text-center py-8">
                <Syringe className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground text-sm">No health events recorded yet</p>
                <Button 
                  onClick={() => setOpenRecord(true)}
                  className="mt-4 rugged-btn bg-primary text-black"
                  data-testid="button-first-health-event"
                >
                  <Plus className="w-4 h-4 mr-2" /> Record First Event
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {sortedEvents.map((event) => (
                  <Link
                    key={event.id}
                    href={`/health/${event.id}`}
                    className="block p-3 bg-secondary rounded border border-border hover:bg-secondary/80 transition-colors cursor-pointer"
                    data-testid={`link-health-event-${event.id}`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="font-bold text-sm md:text-base hover:text-primary transition-colors">
                          {event.eventName || "Health Treatment"}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {format(new Date(event.eventDate), "dd MMM yyyy")}
                          </span>
                          <span>•</span>
                          <span>{event.productName}</span>
                          {event.treatAllAnimals && (
                            <>
                              <span>•</span>
                              <Badge variant="outline" className="text-xs">All Animals</Badge>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Badge variant="secondary" className="text-xs">
                          <Users className="w-3 h-3 mr-1" />
                          {event.treatAllAnimals ? animals?.filter(a => a.status === 'active').length || 0 : "Select"}
                        </Badge>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="text-center py-6 px-4 border-t border-border/30 mt-4">
          <p className="text-sm text-muted-foreground italic max-w-md mx-auto">
            Healthy animals are productive animals. Track every treatment for <span className="text-primary font-medium">complete flock records</span>.
          </p>
        </div>
      </div>

      <FlockHealthEventDialog open={openRecord} onOpenChange={setOpenRecord} />
    </Layout>
  );
}

function FlockHealthEventDialog({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
  const { mutate, isPending } = useCreateFlockHealthEvent();
  const { data: animals } = useAnimals({});
  const { data: farmSettings } = useFarmSettings();
  const createExportedDoc = useCreateExportedDocument();
  const displayName = farmSettings?.studName || farmSettings?.farmName;
  const { toast } = useToast();
  
  const activeAnimals = animals?.filter(a => a.status === 'active') || [];
  const [treatAll, setTreatAll] = useState(true);
  const [selectedAnimals, setSelectedAnimals] = useState<number[]>([]);
  
  const form = useForm({
    resolver: zodResolver(flockHealthFormSchema),
    defaultValues: {
      eventName: "",
      eventDate: new Date().toISOString().split('T')[0],
      productName: "",
      route: "intramuscular",
      notes: "",
    }
  });

  const toggleAnimal = (animalId: number) => {
    setSelectedAnimals(prev => 
      prev.includes(animalId) 
        ? prev.filter(id => id !== animalId)
        : [...prev, animalId]
    );
  };

  const buildTreatments = (route: string) => {
    const targetAnimals = treatAll ? activeAnimals : activeAnimals.filter(a => selectedAnimals.includes(a.id));
    return targetAnimals.map(a => ({
      animalId: a.id,
      quantity: "2",
      route: route,
      notes: "",
    }));
  };

  const onSubmit = (data: any) => {
    const treatmentList = buildTreatments(data.route);
    
    if (treatmentList.length === 0) {
      toast({ title: "No Animals Selected", description: "Please select at least one animal", variant: "destructive" });
      return;
    }
    
    mutate({
      eventName: data.eventName,
      eventDate: data.eventDate,
      productName: data.productName,
      route: data.route,
      treatAllAnimals: treatAll,
      notes: data.notes || undefined,
      treatments: treatmentList,
    }, { 
      onSuccess: () => {
        createExportedDoc.mutate({
          name: `Health Event - ${data.eventName} - ${format(new Date(data.eventDate), "dd MMM yyyy")}`,
          documentType: "productivity",
          subfolder: "flock-health"
        });
        toast({ title: "Health Event Recorded", description: `${treatmentList.length} animals treated` });
        onOpenChange(false);
        form.reset();
        setSelectedAnimals([]);
        setTreatAll(true);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="uppercase font-bold flex items-center gap-2">
            <Syringe className="w-5 h-5 text-primary" /> Record Health Event
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField name="eventName" control={form.control} render={({ field }) => (
              <FormItem>
                <FormLabel>Event Name *</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., Spring Vaccination, Deworming" className="rugged-input" {...field} data-testid="input-event-name" />
                </FormControl>
                <FormMessage/>
              </FormItem>
            )}/>

            <div className="grid grid-cols-2 gap-4">
              <FormField name="eventDate" control={form.control} render={({ field }) => (
                <FormItem>
                  <FormLabel>Date *</FormLabel>
                  <FormControl>
                    <Input type="date" className="rugged-input" {...field} data-testid="input-event-date" />
                  </FormControl>
                  <FormMessage/>
                </FormItem>
              )}/>
              
              <FormField name="productName" control={form.control} render={({ field }) => (
                <FormItem>
                  <FormLabel>Treatment/Product *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Multimin, Ivermectin" className="rugged-input" {...field} data-testid="input-product-name" />
                  </FormControl>
                  <FormMessage/>
                </FormItem>
              )}/>
            </div>

            <FormField name="route" control={form.control} render={({ field }) => (
              <FormItem>
                <FormLabel>Treatment Type *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="rugged-input" data-testid="select-route">
                      <SelectValue placeholder="Select treatment type..." />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="intravenous">Intravenous (IV)</SelectItem>
                    <SelectItem value="intramuscular">Intramuscular (IM)</SelectItem>
                    <SelectItem value="subcutaneous">Subcutaneous (SC)</SelectItem>
                    <SelectItem value="oral">Oral</SelectItem>
                    <SelectItem value="topical">Topical</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage/>
              </FormItem>
            )}/>

            <FormField name="notes" control={form.control} render={({ field }) => (
              <FormItem>
                <FormLabel>Notes (Optional)</FormLabel>
                <FormControl>
                  <Textarea placeholder="Additional notes about the treatment..." className="rugged-input" {...field} data-testid="input-notes" />
                </FormControl>
              </FormItem>
            )}/>

            <div className="space-y-2">
              <FormLabel>Animals Included *</FormLabel>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={treatAll ? "default" : "outline"}
                  onClick={() => setTreatAll(true)}
                  className={treatAll ? "bg-primary text-black" : ""}
                  data-testid="button-treat-all"
                >
                  All Active Animals ({activeAnimals.length})
                </Button>
                <Button
                  type="button"
                  variant={!treatAll ? "default" : "outline"}
                  onClick={() => setTreatAll(false)}
                  className={!treatAll ? "bg-primary text-black" : ""}
                  data-testid="button-select-individual"
                >
                  Select Individual
                </Button>
              </div>
            </div>

            {!treatAll && (
              <div className="space-y-2">
                <FormLabel>Select Animals ({selectedAnimals.length} selected)</FormLabel>
                <div className="max-h-40 overflow-y-auto border border-border rounded-md p-2 space-y-1">
                  {activeAnimals.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-2">No active animals</p>
                  ) : (
                    activeAnimals.map(animal => (
                      <label 
                        key={animal.id} 
                        className="flex items-center gap-2 p-1.5 rounded hover:bg-secondary cursor-pointer text-sm"
                      >
                        <Checkbox 
                          checked={selectedAnimals.includes(animal.id)}
                          onCheckedChange={() => toggleAnimal(animal.id)}
                          data-testid={`checkbox-animal-${animal.id}`}
                        />
                        <span data-testid={`text-animal-tag-${animal.id}`}>{animal.tagId}</span>
                        {animal.name && <span className="text-muted-foreground">({animal.name})</span>}
                        <Badge variant="outline" className="text-xs ml-auto capitalize">{animal.sex}</Badge>
                      </label>
                    ))
                  )}
                </div>
              </div>
            )}

            <Button 
              type="submit" 
              disabled={isPending} 
              data-testid="button-save-health-event" 
              className="w-full rugged-btn bg-primary text-black"
            >
              {isPending ? "Saving..." : "Save Health Event"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
