import { useState } from "react";
import { useAnimals, useCreateAnimal } from "@/hooks/use-animals";
import { Layout } from "@/components/Layout";
import { AnimalCard } from "@/components/AnimalCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Filter, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertAnimalSchema, type InsertAnimal } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

export default function Animals() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const { data: animals, isLoading, error } = useAnimals({ search, status: statusFilter === "all" ? undefined : statusFilter });
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tight">Livestock</h1>
            <p className="text-muted-foreground">Manage your herd registry.</p>
          </div>
          <div className="flex items-center gap-2">
            <CreateAnimalDialog open={isOpen} onOpenChange={setIsOpen} />
          </div>
        </div>

        {/* Filters Bar */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 bg-card border border-border p-4 rounded-sm shadow-sm sticky top-20 md:top-0 z-30">
          <div className="md:col-span-6 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search by Tag ID, EID, or Name..." 
              className="pl-10 rugged-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="md:col-span-3">
             <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="rugged-input">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="sold">Sold</SelectItem>
                <SelectItem value="dead">Dead</SelectItem>
                <SelectItem value="culled">Culled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-3 flex justify-end">
            <Button variant="outline" className="w-full md:w-auto border-border hover:border-primary">
              <Filter className="w-4 h-4 mr-2" /> More Filters
            </Button>
          </div>
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <Skeleton key={i} className="h-[280px] w-full bg-card rounded-sm" />
            ))}
          </div>
        ) : error ? (
          <div className="p-12 text-center text-red-500 bg-red-500/5 rounded-sm border border-red-500/20">
            Error loading animals. Please try again.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-in fade-in duration-500">
            {animals?.map((animal) => (
              <AnimalCard key={animal.id} animal={animal} />
            ))}
            {animals?.length === 0 && (
              <div className="col-span-full py-20 text-center">
                <div className="w-20 h-20 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4">
                  <Search className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-bold uppercase text-foreground">No animals found</h3>
                <p className="text-muted-foreground mt-2">Try adjusting your search or filters.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}

function CreateAnimalDialog({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast();
  const createMutation = useCreateAnimal();
  
  const form = useForm<InsertAnimal>({
    resolver: zodResolver(insertAnimalSchema),
    defaultValues: {
      status: "active",
      sex: "ewe",
      breed: "Meatmaster",
    }
  });

  const onSubmit = async (data: InsertAnimal) => {
    try {
      await createMutation.mutateAsync(data);
      toast({ title: "Success", description: "Animal created successfully", variant: "default" });
      onOpenChange(false);
      form.reset();
    } catch (error) {
      toast({ title: "Error", description: "Failed to create animal", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button className="rugged-btn bg-primary text-black hover:bg-primary/90">
          <Plus className="w-5 h-5 mr-2" /> Add Animal
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg bg-card border-border">
        <DialogHeader>
          <DialogTitle className="font-display font-black text-2xl uppercase">Register New Animal</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="tagId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tag ID *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. 24-001" {...field} className="rugged-input" />
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
                    <FormLabel>Sex *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="rugged-input">
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
                    <Input placeholder="Meatmaster" {...field} value={field.value || ""} className="rugged-input" />
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
                      <Input type="date" {...field} value={field.value ? String(field.value) : ""} className="rugged-input" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="birthWeight"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Birth Weight (kg)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.1" 
                        {...field} 
                        value={field.value ? String(field.value) : ""} 
                        onChange={e => field.onChange(e.target.value)} 
                        className="rugged-input" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="electronicId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Electronic ID (EID)</FormLabel>
                  <FormControl>
                    <Input placeholder="Optional scanned ID" {...field} value={field.value || ""} className="rugged-input" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="border-border">Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending} className="rugged-btn bg-primary text-black">
                {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Register Animal
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
