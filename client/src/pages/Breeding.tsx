import { Layout } from "@/components/Layout";
import { useBreedingEvents, useCreateBreedingEvent } from "@/hooks/use-breeding";
import { useFarmSettings } from "@/hooks/use-farm-settings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertBreedingEventSchema } from "@shared/schema";
import { Plus } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";

export default function Breeding() {
  const { data: events, isLoading } = useBreedingEvents();
  const { data: farmSettings } = useFarmSettings();
  const displayName = farmSettings?.studName || farmSettings?.farmName;
  const [open, setOpen] = useState(false);

  return (
    <Layout>
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="flex justify-between items-center">
          <h1 className="text-4xl font-black uppercase tracking-tight" data-testid="page-title">
            {displayName ? `${displayName} - Breeding Program` : "Breeding Program"}
          </h1>
          <RecordBreedingDialog open={open} onOpenChange={setOpen} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card className="rugged-card">
                <CardHeader>
                    <CardTitle className="uppercase text-lg">Mating Groups (Active)</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-8 text-muted-foreground border-2 border-dashed border-border rounded-md">
                        No active mating groups defined.<br/>
                        <Button variant="ghost" data-testid="button-create-mating-group" className="text-primary">Create Mating Group</Button>
                    </div>
                </CardContent>
            </Card>

            <Card className="rugged-card">
                <CardHeader>
                    <CardTitle className="uppercase text-lg">Recent Events</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {isLoading ? <p>Loading...</p> : events?.map((evt, i) => (
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
                    {(!events || events.length === 0) && <p className="text-muted-foreground italic">No events recorded.</p>}
                </CardContent>
            </Card>
        </div>
      </div>
    </Layout>
  );
}

function RecordBreedingDialog({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
    const { mutate, isPending } = useCreateBreedingEvent();
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
        // In a real app we'd need to look up IDs from Tag inputs or selects
        // For this MVP we'll just cast whatever numbers are entered
        mutate(data, { onSuccess: () => onOpenChange(false) });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogTrigger asChild>
                <Button data-testid="button-record-event" className="rugged-btn bg-primary text-black"><Plus className="w-4 h-4 mr-2" /> Record Event</Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
                <DialogHeader><DialogTitle className="uppercase font-display">Record Mating</DialogTitle></DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <FormField name="eweId" control={form.control} render={({ field }) => (
                                <FormItem><FormLabel>Ewe ID (DB ID)</FormLabel><FormControl><Input type="number" className="rugged-input" {...field} onChange={e => field.onChange(parseInt(e.target.value))} /></FormControl><FormMessage/></FormItem>
                            )}/>
                             <FormField name="ramId" control={form.control} render={({ field }) => (
                                <FormItem><FormLabel>Ram ID (DB ID)</FormLabel><FormControl><Input type="number" className="rugged-input" {...field} onChange={e => field.onChange(parseInt(e.target.value))} /></FormControl><FormMessage/></FormItem>
                            )}/>
                        </div>
                         <FormField name="matingDate" control={form.control} render={({ field }) => (
                                <FormItem><FormLabel>Date</FormLabel><FormControl><Input type="date" className="rugged-input" {...field} value={String(field.value)} /></FormControl><FormMessage/></FormItem>
                         )}/>
                         <FormField name="matingType" control={form.control} render={({ field }) => (
                             <FormItem>
                                <FormLabel>Type</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl><SelectTrigger className="rugged-input"><SelectValue/></SelectTrigger></FormControl>
                                    <SelectContent>
                                        <SelectItem value="natural">Natural</SelectItem>
                                        <SelectItem value="AI">AI</SelectItem>
                                    </SelectContent>
                                </Select>
                             </FormItem>
                         )}/>
                         <Button type="submit" disabled={isPending} data-testid="button-save-breeding" className="w-full rugged-btn bg-primary text-black">{isPending ? "Saving..." : "Save Record"}</Button>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
