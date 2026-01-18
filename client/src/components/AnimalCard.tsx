import { Link } from "wouter";
import { type Animal } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { MarsStroke, Venus, Weight, Calendar } from "lucide-react";
import { format } from "date-fns";
import logo from "@assets/logo.png"; // Placeholder if no photo

export function AnimalCard({ animal }: { animal: Animal }) {
  const isRam = animal.sex.toLowerCase() === 'ram';

  return (
    <Link href={`/animals/${animal.id}`}>
      <Card className="rugged-card group cursor-pointer hover:border-primary transition-all duration-300">
        <CardContent className="p-0 flex flex-col h-full">
          <div className="relative aspect-[4/3] bg-secondary overflow-hidden">
            {animal.photo ? (
              <img src={animal.photo} alt={animal.tagId} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
            ) : (
               <div className="w-full h-full flex items-center justify-center opacity-20">
                 <img src={logo} className="w-16 h-16 grayscale" />
               </div>
            )}
            <div className="absolute top-2 right-2">
              <Badge variant="secondary" className={cn(
                "font-black text-xs uppercase shadow-sm",
                animal.status === 'active' ? "bg-green-900/80 text-green-100" : "bg-red-900/80 text-red-100"
              )}>
                {animal.status}
              </Badge>
            </div>
            <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-black/90 to-transparent p-4 pt-12">
               <h3 className="text-2xl font-black text-white">{animal.tagId}</h3>
               {animal.name && <p className="text-sm text-gray-300 font-medium">{animal.name}</p>}
            </div>
          </div>
          
          <div className="p-4 space-y-3 flex-1 bg-card">
            <div className="flex items-center justify-between text-sm">
               <div className="flex items-center gap-2 text-muted-foreground">
                 {isRam ? <MarsStroke className="w-4 h-4 text-blue-400" /> : <Venus className="w-4 h-4 text-pink-400" />}
                 <span className="uppercase font-bold text-foreground">{animal.sex}</span>
               </div>
               <div className="flex items-center gap-2 text-muted-foreground">
                 <Weight className="w-4 h-4" />
                 <span className="font-mono text-foreground">{animal.currentWeight || '--'} kg</span>
               </div>
            </div>
            
            <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border/50">
               <div className="flex items-center gap-1">
                 <Calendar className="w-3 h-3" />
                 {animal.birthDate ? format(new Date(animal.birthDate), 'MMM yyyy') : 'Unknown'}
               </div>
               <span>{animal.breed}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
