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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Syringe, ChevronRight, Calendar, Users, BookOpen, ShieldAlert } from "lucide-react";
import { format } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { insertFlockHealthEventSchema } from "@shared/schema";
import type { HealthEventType, HealthPlanTopic } from "@/lib/health-plan-guide";

const flockHealthFormSchema = insertFlockHealthEventSchema
  .pick({
    eventName: true,
    eventDate: true,
    productName: true,
    route: true,
    notes: true,
  })
  .extend({
    eventType: insertFlockHealthEventSchema.shape.eventType.refine((val) => val && val.length > 0, "Event type is required"),
    eventName: insertFlockHealthEventSchema.shape.eventName.refine((val) => val && val.length > 0, "Event name is required"),
    eventDate: insertFlockHealthEventSchema.shape.eventDate.refine((val) => val && val.length > 0, "Event date is required"),
    productName: insertFlockHealthEventSchema.shape.productName.refine((val) => val && val.length > 0, "Product/treatment name is required"),
    dose: insertFlockHealthEventSchema.shape.dose,
    nextFollowUpDate: insertFlockHealthEventSchema.shape.nextFollowUpDate,
    withdrawalPeriodNotes: insertFlockHealthEventSchema.shape.withdrawalPeriodNotes,
  });

const EVENT_LABELS: Record<HealthEventType, string> = {
  vaccination: "Vaccination",
  dosing_deworming: "Dosing / Deworming",
  external_parasite_treatment: "External Parasite Treatment",
  antibiotic_treatment: "Antibiotic Treatment",
  vitamin_mineral_supplement: "Vitamin / Mineral Supplement",
  injury_wound: "Injury / Wound",
  abscess: "Abscess",
  footrot: "Footrot",
  mastitis: "Mastitis",
  observation_symptom: "Observation / Symptom",
  vet_visit: "Vet Visit",
};

const HEALTH_EVENT_TYPES: HealthEventType[] = [
  "vaccination",
  "dosing_deworming",
  "external_parasite_treatment",
  "antibiotic_treatment",
  "vitamin_mineral_supplement",
  "injury_wound",
  "abscess",
  "footrot",
  "mastitis",
  "observation_symptom",
  "vet_visit",
];

const HEALTH_ROUTE_OPTIONS = ["oral", "subcutaneous", "intramuscular", "topical", "pour_on", "dip_spray", "other"] as const;

const ROUTE_LABELS: Record<(typeof HEALTH_ROUTE_OPTIONS)[number], string> = {
  oral: "Oral",
  subcutaneous: "Subcutaneous",
  intramuscular: "Intramuscular",
  topical: "Topical",
  pour_on: "Pour-on",
  dip_spray: "Dip/Spray",
  other: "Other",
};

export default function Health() {
  const { data: healthEvents, isLoading } = useFlockHealthEvents();
  const { data: animals } = useAnimals({});
  const { data: farmSettings } = useFarmSettings();
  const displayName = farmSettings?.studName || farmSettings?.farmName;
  const [openRecord, setOpenRecord] = useState(false);
  const [activePane, setActivePane] = useState<"record" | "records" | "plan">("records");
  const [healthPlanData, setHealthPlanData] = useState<{ disclaimer: string; topics: HealthPlanTopic[] } | null>(null);
  const [selectedTopicId, setSelectedTopicId] = useState("");
  const [suggestedEventType, setSuggestedEventType] = useState<HealthEventType>("observation_symptom");

  const sortedEvents = [...(healthEvents || [])].sort((a, b) => {
    const dateA = new Date(a.createdAt || a.eventDate);
    const dateB = new Date(b.createdAt || b.eventDate);
    return dateB.getTime() - dateA.getTime();
  });

  useEffect(() => {
    if (activePane !== "plan" || healthPlanData) return;
    void import("@/lib/health-plan-guide").then((module) => {
      setHealthPlanData({
        disclaimer: module.HEALTH_PLAN_DISCLAIMER,
        topics: module.HEALTH_PLAN_TOPICS,
      });
      setSelectedTopicId((prev) => prev || module.HEALTH_PLAN_TOPICS[0]?.id || "");
    });
  }, [activePane, healthPlanData]);

  const selectedTopic = useMemo(() => {
    if (!healthPlanData?.topics?.length) return null;
    return healthPlanData.topics.find((topic) => topic.id === selectedTopicId) || healthPlanData.topics[0];
  }, [healthPlanData, selectedTopicId]);

  const openRecordWithType = (eventType: HealthEventType) => {
    setSuggestedEventType(eventType);
    setActivePane("record");
    setOpenRecord(true);
  };

  return (
    <Layout>
      <div className="space-y-4 md:space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-2 md:gap-4">
          <div>
            <p className="text-primary text-[10px] md:text-xs font-bold tracking-widest uppercase">{displayName || "BreedLog"}</p>
            <h1 className="text-xl md:text-3xl font-bold text-foreground tracking-tight uppercase" data-testid="page-title">
              Health
            </h1>
            <p className="text-muted-foreground text-xs md:text-sm mt-0.5">Record events, review history, and use the in-app health plan guide.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2" data-testid="health-main-actions">
          <Button onClick={() => openRecordWithType("observation_symptom")} className="rugged-btn bg-primary text-primary-foreground" data-testid="button-record-health-event">
            <Plus className="w-4 h-4 mr-2" /> Record Event
          </Button>
          <Button variant={activePane === "records" ? "default" : "outline"} onClick={() => setActivePane("records")} data-testid="button-health-records">
            <Syringe className="w-4 h-4 mr-2" /> Health Records
          </Button>
          <Button variant={activePane === "plan" ? "default" : "outline"} onClick={() => setActivePane("plan")} data-testid="button-health-plan">
            <BookOpen className="w-4 h-4 mr-2" /> Health Plan
          </Button>
        </div>

        {activePane === "plan" && (
          <Card className="rugged-card" data-testid="health-plan-view">
            <CardHeader className="p-3 md:p-6 pb-2">
              <CardTitle className="uppercase text-sm md:text-lg flex items-center gap-2">
                <BookOpen className="w-4 h-4 md:w-5 md:h-5 text-primary" />
                Health Plan
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 md:p-6 pt-0 space-y-4">
              <Alert className="border-yellow-500/40 bg-yellow-500/10" data-testid="health-plan-disclaimer">
                <ShieldAlert className="h-4 w-4" />
                <AlertDescription className="font-medium text-sm">{healthPlanData?.disclaimer || "Loading health plan guidance..."}</AlertDescription>
              </Alert>

              <div className="grid grid-cols-1 md:grid-cols-[220px,1fr] gap-4">
                <div className="space-y-2" data-testid="health-plan-topic-menu">
                  {healthPlanData?.topics?.map((topic) => (
                    <Button
                      key={topic.id}
                      variant={topic.id === selectedTopic?.id ? "default" : "outline"}
                      className="w-full justify-start text-left whitespace-normal h-auto py-2"
                      onClick={() => setSelectedTopicId(topic.id)}
                      data-testid={`health-plan-topic-${topic.id}`}
                    >
                      {topic.label}
                    </Button>
                  ))}
                </div>

                <div className="space-y-3" data-testid="health-plan-topic-content">
                  <h3 className="font-bold text-base md:text-lg">{selectedTopic?.label || "Loading..."}</h3>
                  {!selectedTopic && <p className="text-sm text-muted-foreground">Loading guide topics...</p>}
                  {selectedTopic?.cards.map((card, index) => (
                    <Card key={`${selectedTopic.id}-${index}`} className="bg-secondary/40 border-border" data-testid={`health-plan-card-${selectedTopic.id}-${index}`}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm md:text-base">{card.title}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        <p className="text-muted-foreground">{card.explanation}</p>
                        <div>
                          <p className="font-semibold">What to watch for</p>
                          <ul className="list-disc ml-5 text-muted-foreground">
                            {card.watchFor.map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <p className="font-semibold">What to record in BreedLog</p>
                          <ul className="list-disc ml-5 text-muted-foreground">
                            {card.recordInBreedLog.map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => openRecordWithType(card.suggestedEventType)}
                          data-testid={`health-plan-action-${selectedTopic.id}-${index}`}
                        >
                          {card.suggestedActionLabel}
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {activePane !== "plan" && (
          <Card className="rugged-card" data-testid="health-records-view">
            <CardHeader className="p-3 md:p-6 pb-2">
              <CardTitle className="uppercase text-sm md:text-lg flex items-center gap-2">
                <Syringe className="w-4 h-4 md:w-5 md:h-5 text-primary" />
                Health Records
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 md:p-6 pt-0">
              {isLoading ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : sortedEvents.length === 0 ? (
                <div className="text-center py-8">
                  <Syringe className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
                  <p className="text-muted-foreground text-sm">No health events recorded yet</p>
                  <Button onClick={() => openRecordWithType("observation_symptom")} className="mt-4 rugged-btn bg-primary text-primary-foreground" data-testid="button-first-health-event">
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
                          <p className="font-bold text-sm md:text-base hover:text-primary transition-colors">{event.eventName || "Health Treatment"}</p>
                          <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {format(new Date(event.eventDate), "dd MMM yyyy")}
                            </span>
                            <span>•</span>
                            <span>{event.productName}</span>
                            {event.eventType && (
                              <>
                                <span>•</span>
                                <Badge variant="outline" className="text-xs">{EVENT_LABELS[event.eventType as HealthEventType] || event.eventType}</Badge>
                              </>
                            )}
                            {event.nextFollowUpDate && (
                              <>
                                <span>•</span>
                                <span>Follow-up: {format(new Date(event.nextFollowUpDate), "dd MMM yyyy")}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Badge variant="secondary" className="text-xs">
                            <Users className="w-3 h-3 mr-1" />
                            {event.treatAllAnimals ? animals?.filter((a) => a.status === "active").length || 0 : "Select"}
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
        )}
      </div>

      <FlockHealthEventDialog open={openRecord} onOpenChange={setOpenRecord} suggestedEventType={suggestedEventType} />
    </Layout>
  );
}

function FlockHealthEventDialog({
  open,
  onOpenChange,
  suggestedEventType,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suggestedEventType: HealthEventType;
}) {
  const { mutate, isPending } = useCreateFlockHealthEvent();
  const { data: animals } = useAnimals({});
  const createExportedDoc = useCreateExportedDocument();
  const { toast } = useToast();

  const activeAnimals = animals?.filter((a) => a.status === "active") || [];
  const [treatAll, setTreatAll] = useState(true);
  const [selectedAnimals, setSelectedAnimals] = useState<number[]>([]);

  const form = useForm({
    resolver: zodResolver(flockHealthFormSchema),
    defaultValues: {
      eventType: suggestedEventType,
      eventName: EVENT_LABELS[suggestedEventType],
      eventDate: new Date().toISOString().split("T")[0],
      productName: "",
      route: "intramuscular",
      dose: "",
      nextFollowUpDate: "",
      withdrawalPeriodNotes: "",
      notes: "",
    },
  });

  const selectedType = form.watch("eventType") as HealthEventType;

  const toggleAnimal = (animalId: number) => {
    setSelectedAnimals((prev) => (prev.includes(animalId) ? prev.filter((id) => id !== animalId) : [...prev, animalId]));
  };

  const buildTreatments = (route: string, dose?: string) => {
    const targetAnimals = treatAll ? activeAnimals : activeAnimals.filter((a) => selectedAnimals.includes(a.id));
    return targetAnimals.map((a) => ({
      animalId: a.id,
      quantity: dose || null,
      route,
      notes: "",
    }));
  };

  const onSubmit = (data: any) => {
    const treatmentList = buildTreatments(data.route, data.dose);

    if (treatmentList.length === 0) {
      toast({ title: "No Animals Selected", description: "Please select at least one animal", variant: "destructive" });
      return;
    }

    mutate(
      {
        eventType: data.eventType,
        eventName: data.eventName,
        eventDate: data.eventDate,
        productName: data.productName,
        route: data.route,
        dose: data.dose || undefined,
        nextFollowUpDate: data.nextFollowUpDate || undefined,
        withdrawalPeriodNotes: data.withdrawalPeriodNotes || undefined,
        treatAllAnimals: treatAll,
        notes: data.notes || undefined,
        treatments: treatmentList,
      } as any,
      {
        onSuccess: () => {
          createExportedDoc.mutate({
            name: `Health Event - ${data.eventName} - ${format(new Date(data.eventDate), "dd MMM yyyy")}`,
            documentType: "productivity",
            subfolder: "flock-health",
          });
          toast({ title: "Health Event Recorded", description: `${treatmentList.length} animals treated` });
          onOpenChange(false);
          form.reset({
            eventType: suggestedEventType,
            eventName: EVENT_LABELS[suggestedEventType],
            eventDate: new Date().toISOString().split("T")[0],
            productName: "",
            route: "intramuscular",
            dose: "",
            nextFollowUpDate: "",
            withdrawalPeriodNotes: "",
            notes: "",
          });
          setSelectedAnimals([]);
          setTreatAll(true);
        },
      }
    );
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
            <FormField
              name="eventType"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Event Type *</FormLabel>
                  <Select
                    onValueChange={(value) => {
                      field.onChange(value);
                      form.setValue("eventName", EVENT_LABELS[value as HealthEventType]);
                    }}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="rugged-input" data-testid="select-event-type">
                        <SelectValue placeholder="Select event type..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {HEALTH_EVENT_TYPES.map((eventType) => (
                        <SelectItem key={eventType} value={eventType}>
                          {EVENT_LABELS[eventType]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              name="eventName"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Event Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="Event label" className="rugged-input" {...field} data-testid="input-event-name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                name="eventDate"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date *</FormLabel>
                    <FormControl>
                      <Input type="date" className="rugged-input" {...field} data-testid="input-event-date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                name="productName"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product / Support Action *</FormLabel>
                    <FormControl>
                      <Input placeholder="Product or action name" className="rugged-input" {...field} data-testid="input-product-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                name="route"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Route *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="rugged-input" data-testid="select-route">
                          <SelectValue placeholder="Select route..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {HEALTH_ROUTE_OPTIONS.map((route) => (
                          <SelectItem key={route} value={route}>
                            {ROUTE_LABELS[route]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                name="dose"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dose (as recorded)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. 2 ml" className="rugged-input" {...field} value={field.value || ""} data-testid="input-dose" />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                name="nextFollowUpDate"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Next Booster / Follow-up Date</FormLabel>
                    <FormControl>
                      <Input type="date" className="rugged-input" {...field} value={field.value || ""} data-testid="input-next-followup-date" />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                name="withdrawalPeriodNotes"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Withdrawal Period Notes</FormLabel>
                    <FormControl>
                      <Input placeholder="Record withdrawal notes" className="rugged-input" {...field} value={field.value || ""} data-testid="input-withdrawal-notes" />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <FormField
              name="notes"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Observed symptoms, outcome, or vet notes..." className="rugged-input" {...field} value={field.value || ""} data-testid="input-notes" />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <FormLabel>Animals Included *</FormLabel>
              <div className="flex gap-2">
                <Button type="button" variant={treatAll ? "default" : "outline"} onClick={() => setTreatAll(true)} className={treatAll ? "bg-primary text-primary-foreground" : ""} data-testid="button-treat-all">
                  All Active Animals ({activeAnimals.length})
                </Button>
                <Button type="button" variant={!treatAll ? "default" : "outline"} onClick={() => setTreatAll(false)} className={!treatAll ? "bg-primary text-primary-foreground" : ""} data-testid="button-select-individual">
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
                    activeAnimals.map((animal) => (
                      <label key={animal.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-secondary cursor-pointer text-sm">
                        <Checkbox checked={selectedAnimals.includes(animal.id)} onCheckedChange={() => toggleAnimal(animal.id)} data-testid={`checkbox-animal-${animal.id}`} />
                        <span data-testid={`text-animal-tag-${animal.id}`}>{animal.tagId}</span>
                        {animal.name && <span className="text-muted-foreground">({animal.name})</span>}
                        <Badge variant="outline" className="text-xs ml-auto capitalize">
                          {animal.sex}
                        </Badge>
                      </label>
                    ))
                  )}
                </div>
              </div>
            )}

            <p className="text-xs text-muted-foreground">Suggested type from Health Plan: {EVENT_LABELS[selectedType]}</p>

            <Button type="submit" disabled={isPending} data-testid="button-save-health-event" className="w-full rugged-btn bg-primary text-primary-foreground">
              {isPending ? "Saving..." : "Save Health Event"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
