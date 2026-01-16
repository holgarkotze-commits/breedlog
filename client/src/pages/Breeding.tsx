import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useBreedingEvents, useCreateBreedingEvent } from "@/hooks/use-breeding";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Plus, GitMerge } from "lucide-react";
import { format } from "date-fns";

export default function Breeding() {
  const { data: events, isLoading } = useBreedingEvents();

  return (
    <Layout>
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-black uppercase tracking-tight">Breeding</h1>
            <p className="text-muted-foreground">Manage mating pairs and family trees.</p>
          </div>
          <Button className="rugged-btn bg-primary text-black">
            <Plus className="w-5 h-5 mr-2" /> Record Event
          </Button>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          <Card className="rugged-card bg-card lg:col-span-2">
            <CardHeader>
               <CardTitle className="uppercase flex items-center gap-2">
                 <GitMerge className="w-5 h-5 text-primary" /> Active Mating Groups
               </CardTitle>
            </CardHeader>
            <CardContent>
               {isLoading ? (
                 <div className="space-y-4">
                   <Skeleton className="h-16 w-full" />
                   <Skeleton className="h-16 w-full" />
                 </div>
               ) : (
                 <div className="space-y-4">
                   {events?.map((event) => (
                     <div key={event.id} className="p-4 bg-secondary/30 border border-border rounded-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground font-bold uppercase tracking-wider mb-1">
                            {format(new Date(event.matingDate), "MMM d, yyyy")} • {event.matingType}
                          </p>
                          <div className="flex items-center gap-4 font-mono text-lg">
                             <span className="text-pink-500 font-bold">Ewe #{event.eweId}</span>
                             <span className="text-muted-foreground">+</span>
                             <span className="text-blue-500 font-bold">Ram #{event.ramId}</span>
                          </div>
                        </div>
                        <div className="text-right">
                           <span className={`px-3 py-1 rounded text-xs font-bold uppercase border ${event.lambingDate ? "bg-green-500/10 text-green-500 border-green-500/20" : "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"}`}>
                             {event.lambingDate ? "Lambed" : "Active"}
                           </span>
                        </div>
                     </div>
                   ))}
                   {(!events || events.length === 0) && (
                     <p className="text-muted-foreground text-center py-8 italic">No breeding events recorded.</p>
                   )}
                 </div>
               )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
