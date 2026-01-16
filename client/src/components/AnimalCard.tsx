import { Link } from "wouter";
import { type Animal } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Calendar, Tag, Weight } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface AnimalCardProps {
  animal: Animal;
  className?: string;
}

export function AnimalCard({ animal, className }: AnimalCardProps) {
  const statusColors: Record<string, string> = {
    active: "bg-green-500/10 text-green-500 border-green-500/20",
    sold: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    dead: "bg-red-500/10 text-red-500 border-red-500/20",
    culled: "bg-orange-500/10 text-orange-500 border-orange-500/20",
    lost: "bg-gray-500/10 text-gray-500 border-gray-500/20",
  };

  const sexIcons: Record<string, string> = {
    ram: "♂",
    ewe: "♀",
    wether: "○",
  };

  return (
    <Link href={`/animals/${animal.id}`}>
      <div className={cn("block group cursor-pointer h-full", className)}>
        <Card className="rugged-card h-full flex flex-col overflow-hidden bg-card border-border hover:border-primary transition-all duration-300">
          <div className="h-32 bg-secondary/50 relative overflow-hidden group-hover:bg-secondary/70 transition-colors">
            {animal.photo ? (
              <img src={animal.photo} alt={animal.tagId} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground/20 font-black text-6xl select-none">
                {animal.tagId.slice(0, 2)}
              </div>
            )}
            <div className="absolute top-2 right-2">
              <Badge variant="outline" className={cn("uppercase font-bold tracking-wide border", statusColors[animal.status || "active"])}>
                {animal.status}
              </Badge>
            </div>
          </div>
          
          <CardHeader className="p-4 pb-2">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-display text-2xl font-black group-hover:text-primary transition-colors">
                  {animal.tagId}
                </h3>
                <p className="text-muted-foreground text-sm font-medium">{animal.breed || "Meatmaster"}</p>
              </div>
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center font-bold text-lg border",
                animal.sex === 'ram' ? "border-blue-500/30 text-blue-500 bg-blue-500/10" : 
                animal.sex === 'ewe' ? "border-pink-500/30 text-pink-500 bg-pink-500/10" : "border-gray-500/30 text-gray-400"
              )}>
                {sexIcons[animal.sex] || "?"}
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-4 pt-2 flex-grow space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="w-4 h-4 text-primary/70" />
              <span>{animal.birthDate ? format(new Date(animal.birthDate), "MMM d, yyyy") : "Unknown DOB"}</span>
            </div>
            {animal.currentWeight && (
              <div className="flex items-center gap-2 text-sm text-foreground font-medium">
                <Weight className="w-4 h-4 text-primary/70" />
                <span>{animal.currentWeight} kg</span>
              </div>
            )}
            {animal.electronicId && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono bg-secondary/50 p-1.5 rounded border border-border/50 truncate">
                <Tag className="w-3 h-3" />
                <span className="truncate">{animal.electronicId}</span>
              </div>
            )}
          </CardContent>
          
          <CardFooter className="p-4 pt-0 border-t border-border/30 mt-auto">
            <div className="w-full flex items-center justify-between pt-3">
              <span className="text-xs text-muted-foreground uppercase font-bold tracking-widest group-hover:text-primary/80 transition-colors">
                View Details
              </span>
              <span className="transform translate-x-0 group-hover:translate-x-1 transition-transform duration-300 text-primary">
                →
              </span>
            </div>
          </CardFooter>
        </Card>
      </div>
    </Link>
  );
}
