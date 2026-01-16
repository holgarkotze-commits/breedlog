import { useRoute } from "wouter";
import { useAnimal, useFamilyTree } from "@/hooks/use-animals";
import { usePerformanceRecords, useHealthRecords } from "@/hooks/use-records";
import { Layout } from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Edit, Activity, Syringe, Scale, Dna } from "lucide-react";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

export default function AnimalDetail() {
  const [match, params] = useRoute("/animals/:id");
  const id = parseInt(params?.id || "0");
  const { data: animal, isLoading } = useAnimal(id);

  if (isLoading) {
    return (
      <Layout>
        <div className="space-y-8">
           <Skeleton className="h-12 w-48" />
           <div className="grid md:grid-cols-3 gap-8">
             <Skeleton className="h-96 md:col-span-1" />
             <Skeleton className="h-96 md:col-span-2" />
           </div>
        </div>
      </Layout>
    );
  }

  if (!animal) {
    return <Layout><div className="p-8">Animal not found</div></Layout>;
  }

  return (
    <Layout>
      <div className="space-y-8 animate-in fade-in duration-300">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/animals">
              <Button variant="outline" size="icon" className="rounded-full w-10 h-10 border-border hover:bg-secondary">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tight">{animal.tagId}</h1>
                <Badge className="text-lg px-3 py-1 bg-secondary text-foreground uppercase border-border rounded-sm">
                  {animal.sex}
                </Badge>
              </div>
              <p className="text-muted-foreground font-mono">{animal.electronicId || "No EID"}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="rugged-btn border-border">
              <Edit className="w-4 h-4 mr-2" /> Edit
            </Button>
            <Button className="rugged-btn bg-primary text-black">
              Actions
            </Button>
          </div>
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Quick Info */}
          <div className="space-y-6">
            <Card className="rugged-card bg-card overflow-hidden">
              <div className="aspect-square bg-secondary/30 relative">
                 {animal.photo ? (
                  <img src={animal.photo} alt={animal.tagId} className="w-full h-full object-cover" />
                 ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/30">
                    <span className="text-8xl font-black">{animal.tagId.slice(0, 1)}</span>
                    <span className="text-sm uppercase tracking-widest font-bold mt-4">No Photo</span>
                  </div>
                 )}
              </div>
              <CardContent className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs uppercase text-muted-foreground font-bold">Status</p>
                    <p className="text-lg font-bold capitalize">{animal.status}</p>
                  </div>
                   <div>
                    <p className="text-xs uppercase text-muted-foreground font-bold">Breed</p>
                    <p className="text-lg font-bold">{animal.breed}</p>
                  </div>
                   <div>
                    <p className="text-xs uppercase text-muted-foreground font-bold">DOB</p>
                    <p className="text-lg font-bold">{animal.birthDate ? format(new Date(animal.birthDate), "dd MMM yyyy") : "-"}</p>
                  </div>
                   <div>
                    <p className="text-xs uppercase text-muted-foreground font-bold">Weight</p>
                    <p className="text-lg font-bold text-primary">{animal.currentWeight || "-"} kg</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rugged-card bg-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 uppercase tracking-wide">
                  <Dna className="w-5 h-5 text-primary" /> Pedigree
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                 <div className="p-3 bg-secondary/50 rounded border border-border/50">
                    <p className="text-xs text-muted-foreground uppercase mb-1">Sire (Father)</p>
                    <Link href={animal.sireId ? `/animals/${animal.sireId}` : "#"} className="font-bold text-lg hover:text-primary transition-colors">
                      {animal.sire?.tagId || "Unknown"}
                    </Link>
                 </div>
                 <div className="p-3 bg-secondary/50 rounded border border-border/50">
                    <p className="text-xs text-muted-foreground uppercase mb-1">Dam (Mother)</p>
                    <Link href={animal.damId ? `/animals/${animal.damId}` : "#"} className="font-bold text-lg hover:text-primary transition-colors">
                      {animal.dam?.tagId || "Unknown"}
                    </Link>
                 </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Tabs */}
          <div className="lg:col-span-2">
            <Tabs defaultValue="records" className="w-full">
              <TabsList className="w-full justify-start h-auto p-1 bg-secondary rounded-sm mb-6 overflow-x-auto">
                <TabsTrigger value="records" className="data-[state=active]:bg-card data-[state=active]:text-primary py-2 px-4 uppercase font-bold text-xs md:text-sm tracking-wide">Performance</TabsTrigger>
                <TabsTrigger value="health" className="data-[state=active]:bg-card data-[state=active]:text-primary py-2 px-4 uppercase font-bold text-xs md:text-sm tracking-wide">Health</TabsTrigger>
                <TabsTrigger value="evaluations" className="data-[state=active]:bg-card data-[state=active]:text-primary py-2 px-4 uppercase font-bold text-xs md:text-sm tracking-wide">Evaluations</TabsTrigger>
              </TabsList>

              <TabsContent value="records" className="animate-in slide-in-from-right-2 duration-300">
                <PerformanceTab animalId={id} />
              </TabsContent>
              <TabsContent value="health" className="animate-in slide-in-from-right-2 duration-300">
                <HealthTab animalId={id} />
              </TabsContent>
               <TabsContent value="evaluations" className="animate-in slide-in-from-right-2 duration-300">
                <div className="p-8 text-center bg-secondary/20 border border-dashed border-border rounded-lg">
                  <p className="text-muted-foreground">Evaluation history feature coming soon.</p>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </Layout>
  );
}

function PerformanceTab({ animalId }: { animalId: number }) {
  const { data: records, isLoading } = usePerformanceRecords(animalId);

  if (isLoading) return <Skeleton className="h-40 w-full" />;

  return (
    <Card className="rugged-card bg-card">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="uppercase flex items-center gap-2">
          <Scale className="w-5 h-5 text-primary" /> Weighing Records
        </CardTitle>
        <Button size="sm" variant="outline" className="text-xs border-border hover:border-primary">
          <Plus className="w-4 h-4 mr-1" /> Add Record
        </Button>
      </CardHeader>
      <CardContent>
        {records && records.length > 0 ? (
          <div className="space-y-0">
             {records.map((record) => (
               <div key={record.id} className="flex items-center justify-between p-4 border-b border-border last:border-0 hover:bg-secondary/30 transition-colors">
                 <div>
                   <p className="font-bold text-foreground">{format(new Date(record.date), "MMM d, yyyy")}</p>
                   <p className="text-xs text-muted-foreground">{record.ageDays} days old</p>
                 </div>
                 <div className="text-right">
                    <p className="text-xl font-black text-primary font-display">{record.weight} kg</p>
                    {record.traitNotes && <p className="text-xs text-muted-foreground">{record.traitNotes}</p>}
                 </div>
               </div>
             ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm italic py-4">No performance records found.</p>
        )}
      </CardContent>
    </Card>
  );
}

function HealthTab({ animalId }: { animalId: number }) {
  const { data: records, isLoading } = useHealthRecords(animalId);

  if (isLoading) return <Skeleton className="h-40 w-full" />;

  return (
    <Card className="rugged-card bg-card">
      <CardHeader className="flex flex-row items-center justify-between">
         <CardTitle className="uppercase flex items-center gap-2">
          <Syringe className="w-5 h-5 text-primary" /> Health Log
        </CardTitle>
        <Button size="sm" variant="outline" className="text-xs border-border hover:border-primary">
          <Plus className="w-4 h-4 mr-1" /> Add Record
        </Button>
      </CardHeader>
      <CardContent>
         {records && records.length > 0 ? (
           <div className="space-y-4">
              {records.map((record) => (
                <div key={record.id} className="bg-secondary/30 p-4 rounded border border-border">
                  <div className="flex justify-between items-start mb-2">
                    <p className="font-bold text-lg text-foreground">{record.treatment}</p>
                    <span className="text-xs font-mono text-primary bg-primary/10 px-2 py-1 rounded">
                      {format(new Date(record.date), "dd/MM/yyyy")}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                    <div>
                      <span className="block text-xs uppercase font-bold opacity-70">Medication</span>
                      {record.medication || "-"}
                    </div>
                    <div>
                      <span className="block text-xs uppercase font-bold opacity-70">Dosage</span>
                      {record.dosage || "-"}
                    </div>
                  </div>
                  {record.notes && (
                    <div className="mt-3 pt-3 border-t border-border/50 text-sm italic">
                      "{record.notes}"
                    </div>
                  )}
                </div>
              ))}
           </div>
         ) : (
          <p className="text-muted-foreground text-sm italic py-4">No health records found.</p>
        )}
      </CardContent>
    </Card>
  );
}
