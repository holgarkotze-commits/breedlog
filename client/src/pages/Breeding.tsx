import { Layout } from "@/components/Layout";
import { useBreedingEvents, useCreateBreedingEvent } from "@/hooks/use-breeding";
import { useMatingGroups, useCreateMatingGroup } from "@/hooks/use-mating-groups";
import { useAnimals } from "@/hooks/use-animals";
import { useFarmSettings } from "@/hooks/use-farm-settings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertBreedingEventSchema, insertMatingGroupSchema } from "@shared/schema";
import { Plus, Calendar, Shield, Heart, Users, Download } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { format, addDays, addMonths } from "date-fns";
import { useState } from "react";
import { z } from "zod";
import type { MatingGroup } from "@shared/schema";

export default function Breeding() {
  const { data: events, isLoading } = useBreedingEvents();
  const { data: matingGroupsList, isLoading: loadingGroups } = useMatingGroups();
  const { data: farmSettings } = useFarmSettings();
  const displayName = farmSettings?.studName || farmSettings?.farmName;
  const [openRecord, setOpenRecord] = useState(false);
  const [openMatingGroup, setOpenMatingGroup] = useState(false);

  const activeGroups = matingGroupsList?.filter(g => g.status === 'active') || [];
  const closedGroups = matingGroupsList?.filter(g => g.status === 'closed') || [];

  const exportMatingGroups = (formatType: 'json' | 'csv') => {
    if (!matingGroupsList || matingGroupsList.length === 0) return;
    
    const exportData = matingGroupsList.map(group => {
      const dateIn = new Date(group.dateIn);
      const dateOut = group.dateOut ? new Date(group.dateOut) : addDays(dateIn, 42);
      const expectedLambing = addMonths(dateIn, 5);
      
      return {
        name: group.name,
        ramId: group.ramId,
        dateIn: format(dateIn, "yyyy-MM-dd"),
        dateOut: format(dateOut, "yyyy-MM-dd"),
        matingPeriodDays: 42,
        expectedLambing: format(expectedLambing, "yyyy-MM-dd"),
        lambingSeason: group.lambingSeason || "",
        environmentGroup: group.environmentGroup || "",
        managementGroup: group.managementGroup || "",
        status: group.status,
        notes: group.notes || "",
      };
    });

    let content: string;
    let filename: string;
    let mimeType: string;

    if (formatType === 'json') {
      content = JSON.stringify({
        exportDate: new Date().toISOString(),
        farm: displayName || "BreedLog Export",
        matingGroups: exportData,
      }, null, 2);
      filename = `mating-groups-${format(new Date(), "yyyy-MM-dd")}.json`;
      mimeType = "application/json";
    } else {
      const headers = ["Name", "Ram ID", "Date In", "Date Out", "Mating Days", "Expected Lambing", "Season", "Environment", "Management", "Status", "Notes"];
      const rows = exportData.map(g => [
        g.name, g.ramId, g.dateIn, g.dateOut, g.matingPeriodDays, 
        g.expectedLambing, g.lambingSeason, g.environmentGroup, 
        g.managementGroup, g.status, g.notes
      ]);
      content = [headers.join(","), ...rows.map(r => r.map(v => `"${v}"`).join(","))].join("\n");
      filename = `mating-groups-${format(new Date(), "yyyy-MM-dd")}.csv`;
      mimeType = "text/csv";
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Layout>
      <div className="space-y-4 md:space-y-8 animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
          <h1 className="text-lg md:text-3xl font-bold uppercase tracking-tight" data-testid="page-title">
            {displayName ? `${displayName} - Breeding` : "Breeding Program"}
          </h1>
          <div className="flex gap-2">
            <RecordBreedingDialog open={openRecord} onOpenChange={setOpenRecord} />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-8">
          <Card className="rugged-card">
            <CardHeader className="p-3 md:p-6 pb-2">
              <div className="flex justify-between items-center gap-2 flex-wrap">
                <CardTitle className="uppercase text-sm md:text-lg">Mating Groups</CardTitle>
                <div className="flex gap-2">
                  {matingGroupsList && matingGroupsList.length > 0 && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="outline" data-testid="button-export-mating-groups">
                          <Download className="w-4 h-4 mr-1" /> Export
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => exportMatingGroups('json')} data-testid="menu-export-json">
                          Export as JSON
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => exportMatingGroups('csv')} data-testid="menu-export-csv">
                          Export as CSV
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                  <CreateMatingGroupDialog open={openMatingGroup} onOpenChange={setOpenMatingGroup} />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-3 md:p-6 pt-0">
              {loadingGroups ? (
                <p className="text-muted-foreground text-sm">Loading...</p>
              ) : activeGroups.length === 0 ? (
                <div className="text-center py-6 md:py-8 text-muted-foreground border-2 border-dashed border-border rounded-md">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No active mating groups.</p>
                  <Button 
                    variant="ghost" 
                    onClick={() => setOpenMatingGroup(true)}
                    data-testid="button-create-mating-group" 
                    className="text-primary mt-2"
                  >
                    Create Mating Group
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {activeGroups.map((group) => {
                    const dateIn = new Date(group.dateIn);
                    const dateOut = group.dateOut ? new Date(group.dateOut) : addDays(dateIn, 42);
                    const expectedLambing = addMonths(dateIn, 5);
                    
                    return (
                      <div key={group.id} className="p-3 bg-secondary rounded border border-border">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="font-bold text-sm md:text-base">{group.name}</p>
                            <p className="text-xs text-muted-foreground">Ram ID: {group.ramId}</p>
                          </div>
                          <Badge variant="outline" className="bg-green-900/30 text-green-400 border-green-700">
                            Active
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs mt-2">
                          <div>
                            <span className="text-muted-foreground">Mating Period:</span>
                            <p className="font-medium">{format(dateIn, "dd MMM")} - {format(dateOut, "dd MMM yyyy")}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Expected Lambing:</span>
                            <p className="font-medium text-primary">{format(expectedLambing, "dd MMM yyyy")}</p>
                          </div>
                        </div>
                        {group.lambingSeason && (
                          <p className="text-xs mt-2">
                            <span className="text-muted-foreground">Season:</span> {group.lambingSeason}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              
              {closedGroups.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border">
                  <p className="text-xs text-muted-foreground mb-2">Previous Groups ({closedGroups.length})</p>
                  <div className="space-y-2">
                    {closedGroups.slice(0, 3).map((group) => (
                      <div key={group.id} className="p-2 bg-secondary/50 rounded text-xs flex justify-between">
                        <span>{group.name}</span>
                        <span className="text-muted-foreground">{format(new Date(group.dateIn), "MMM yyyy")}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rugged-card">
            <CardHeader className="p-3 md:p-6 pb-2">
              <CardTitle className="uppercase text-sm md:text-lg">Recent Events</CardTitle>
            </CardHeader>
            <CardContent className="p-3 md:p-6 pt-0 space-y-3">
              {isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> : events?.slice(0, 5).map((evt, i) => (
                <div key={i} className="flex justify-between items-center p-3 bg-secondary rounded border border-border">
                  <div>
                    <p className="font-bold text-sm">Ewe {evt.eweId} x Ram {evt.ramId}</p>
                    <p className="text-xs text-muted-foreground">{format(new Date(evt.matingDate), "dd MMM yyyy")} • {evt.matingType}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs uppercase font-bold text-primary">Recorded</span>
                  </div>
                </div>
              ))}
              {(!events || events.length === 0) && <p className="text-muted-foreground italic text-sm">No events recorded.</p>}
            </CardContent>
          </Card>
        </div>

        <div className="text-center py-6 px-4 border-t border-border/30 mt-4">
          <p className="text-sm text-muted-foreground italic max-w-md mx-auto">
            Great genetics start with great records. Every mating you log brings you closer to your <span className="text-primary font-medium">breeding goals</span>.
          </p>
        </div>
      </div>
    </Layout>
  );
}

function CreateMatingGroupDialog({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
  const { mutate, isPending } = useCreateMatingGroup();
  const { data: animals } = useAnimals({});
  const [selectedEwes, setSelectedEwes] = useState<number[]>([]);
  
  const rams = animals?.filter(a => a.sex === 'ram' && a.status === 'active') || [];
  const ewes = animals?.filter(a => a.sex === 'ewe' && a.status === 'active') || [];
  
  const matingGroupFormSchema = insertMatingGroupSchema.extend({
    dateIn: z.string().min(1, "Start date is required"),
  });
  
  const form = useForm({
    resolver: zodResolver(matingGroupFormSchema),
    defaultValues: {
      name: "",
      ramId: 0,
      dateIn: new Date().toISOString().split('T')[0],
      dateOut: addDays(new Date(), 42).toISOString().split('T')[0],
      lambingSeason: "",
      environmentGroup: "",
      managementGroup: "",
      status: "active",
      notes: "",
    }
  });

  const dateIn = form.watch("dateIn");
  const expectedLambing = dateIn ? format(addMonths(new Date(dateIn), 5), "dd MMM yyyy") : "--";
  const matingEndDate = dateIn ? format(addDays(new Date(dateIn), 42), "dd MMM yyyy") : "--";

  const toggleEwe = (eweId: number) => {
    setSelectedEwes(prev => 
      prev.includes(eweId) 
        ? prev.filter(id => id !== eweId)
        : [...prev, eweId]
    );
  };

  const onSubmit = (data: any) => {
    const submitData = {
      ...data,
      ramId: Number(data.ramId),
      dateOut: addDays(new Date(data.dateIn), 42).toISOString().split('T')[0],
    };
    
    mutate(submitData, { 
      onSuccess: () => {
        onOpenChange(false);
        setSelectedEwes([]);
        form.reset();
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" data-testid="button-new-mating-group" className="rugged-btn bg-primary text-black">
          <Plus className="w-4 h-4 mr-1" /> New Group
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="uppercase font-bold">Create Mating Group</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField name="name" control={form.control} render={({ field }) => (
              <FormItem>
                <FormLabel>Group Name</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., Spring 2026 Group A" className="rugged-input" {...field} />
                </FormControl>
                <FormMessage/>
              </FormItem>
            )}/>
            
            <FormField name="ramId" control={form.control} render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-blue-400" /> Select Ram
                </FormLabel>
                <Select onValueChange={(v) => field.onChange(Number(v))} value={String(field.value || "")}>
                  <FormControl>
                    <SelectTrigger className="rugged-input">
                      <SelectValue placeholder="Choose a ram..." />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {rams.map(ram => (
                      <SelectItem key={ram.id} value={String(ram.id)}>
                        {ram.tagId} {ram.name ? `(${ram.name})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage/>
              </FormItem>
            )}/>

            <div className="space-y-2">
              <FormLabel className="flex items-center gap-2">
                <Heart className="w-4 h-4 text-pink-400" /> Select Ewes ({selectedEwes.length} selected)
              </FormLabel>
              <div className="max-h-40 overflow-y-auto border border-border rounded-md p-2 space-y-1">
                {ewes.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-2">No active ewes available</p>
                ) : (
                  ewes.map(ewe => (
                    <label 
                      key={ewe.id} 
                      className="flex items-center gap-2 p-1.5 rounded hover:bg-secondary cursor-pointer text-sm"
                    >
                      <Checkbox 
                        checked={selectedEwes.includes(ewe.id)}
                        onCheckedChange={() => toggleEwe(ewe.id)}
                      />
                      <span>{ewe.tagId}</span>
                      {ewe.name && <span className="text-muted-foreground">({ewe.name})</span>}
                    </label>
                  ))
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField name="dateIn" control={form.control} render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> Start Date
                  </FormLabel>
                  <FormControl>
                    <Input type="date" className="rugged-input" {...field} />
                  </FormControl>
                  <FormMessage/>
                </FormItem>
              )}/>
              
              <div>
                <FormLabel className="text-muted-foreground">Mating Period</FormLabel>
                <p className="text-sm font-medium mt-2">42 days</p>
                <p className="text-xs text-muted-foreground">Ends: {matingEndDate}</p>
              </div>
            </div>

            <div className="p-3 bg-primary/10 rounded-md border border-primary/30">
              <p className="text-xs text-muted-foreground">Expected Lambing (5 months)</p>
              <p className="font-bold text-primary">{expectedLambing}</p>
            </div>

            <FormField name="lambingSeason" control={form.control} render={({ field }) => (
              <FormItem>
                <FormLabel>Lambing Season Code</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., 26A" className="rugged-input" {...field} value={field.value || ""} />
                </FormControl>
                <FormMessage/>
              </FormItem>
            )}/>

            <FormField name="notes" control={form.control} render={({ field }) => (
              <FormItem>
                <FormLabel>Notes</FormLabel>
                <FormControl>
                  <Textarea placeholder="Optional notes..." className="rugged-input" {...field} value={field.value || ""} />
                </FormControl>
                <FormMessage/>
              </FormItem>
            )}/>

            <Button 
              type="submit" 
              disabled={isPending || !form.watch("ramId")} 
              data-testid="button-save-mating-group" 
              className="w-full rugged-btn bg-primary text-black"
            >
              {isPending ? "Creating..." : "Create Mating Group"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function RecordBreedingDialog({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
  const { mutate, isPending } = useCreateBreedingEvent();
  const { data: animals } = useAnimals({});
  
  const rams = animals?.filter(a => a.sex === 'ram' && a.status === 'active') || [];
  const ewes = animals?.filter(a => a.sex === 'ewe' && a.status === 'active') || [];
  
  const form = useForm({
    resolver: zodResolver(insertBreedingEventSchema),
    defaultValues: {
      eweId: 0,
      ramId: 0,
      matingDate: new Date().toISOString().split('T')[0],
      matingType: "natural",
    }
  });

  const onSubmit = (data: any) => {
    mutate({
      ...data,
      eweId: Number(data.eweId),
      ramId: Number(data.ramId),
    }, { onSuccess: () => onOpenChange(false) });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button data-testid="button-record-event" className="rugged-btn bg-primary text-black">
          <Plus className="w-4 h-4 mr-2" /> Record Event
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle className="uppercase font-bold">Record Mating Event</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField name="eweId" control={form.control} render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1">
                    <Heart className="w-3 h-3 text-pink-400" /> Ewe
                  </FormLabel>
                  <Select onValueChange={(v) => field.onChange(Number(v))} value={String(field.value || "")}>
                    <FormControl>
                      <SelectTrigger className="rugged-input">
                        <SelectValue placeholder="Select ewe..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {ewes.map(ewe => (
                        <SelectItem key={ewe.id} value={String(ewe.id)}>
                          {ewe.tagId} {ewe.name ? `(${ewe.name})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage/>
                </FormItem>
              )}/>
              <FormField name="ramId" control={form.control} render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1">
                    <Shield className="w-3 h-3 text-blue-400" /> Ram
                  </FormLabel>
                  <Select onValueChange={(v) => field.onChange(Number(v))} value={String(field.value || "")}>
                    <FormControl>
                      <SelectTrigger className="rugged-input">
                        <SelectValue placeholder="Select ram..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {rams.map(ram => (
                        <SelectItem key={ram.id} value={String(ram.id)}>
                          {ram.tagId} {ram.name ? `(${ram.name})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage/>
                </FormItem>
              )}/>
            </div>
            <FormField name="matingDate" control={form.control} render={({ field }) => (
              <FormItem>
                <FormLabel>Date</FormLabel>
                <FormControl>
                  <Input type="date" className="rugged-input" {...field} value={String(field.value)} />
                </FormControl>
                <FormMessage/>
              </FormItem>
            )}/>
            <FormField name="matingType" control={form.control} render={({ field }) => (
              <FormItem>
                <FormLabel>Type</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger className="rugged-input">
                      <SelectValue/>
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="natural">Natural</SelectItem>
                    <SelectItem value="AI">AI (Artificial Insemination)</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )}/>
            <Button 
              type="submit" 
              disabled={isPending} 
              data-testid="button-save-breeding" 
              className="w-full rugged-btn bg-primary text-black"
            >
              {isPending ? "Saving..." : "Save Record"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
