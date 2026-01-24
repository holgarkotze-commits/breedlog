import { useState } from "react";
import { Link } from "wouter";
import { type Animal } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { User, Scale, Calendar, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { useDeleteAnimal } from "@/hooks/use-animals";
import logo from "@assets/BREEDLOG_LOGO_1768730745128.png";

export function AnimalCard({ animal }: { animal: Animal }) {
  const isRam = animal.sex.toLowerCase() === 'ram';
  const { mutate: deleteAnimal, isPending } = useDeleteAnimal();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    deleteAnimal(animal.id);
    setShowDeleteDialog(false);
  };

  return (
    <div className="relative group">
      <Link href={`/animals/${animal.id}`}>
        <Card className="rugged-card cursor-pointer hover:border-primary transition-all duration-300">
          <CardContent className="p-0 flex flex-col h-full">
            <div className="relative aspect-[4/3] md:aspect-[4/3] bg-secondary overflow-hidden">
              {animal.photo ? (
                <img src={animal.photo} alt={animal.tagId} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              ) : (
                 <div className="w-full h-full flex items-center justify-center opacity-20">
                   <img src={logo} className="w-10 h-10 md:w-16 md:h-16 grayscale" />
                 </div>
              )}
              <div className="absolute top-1 right-1 md:top-2 md:right-2">
                <Badge variant="secondary" className={cn(
                  "font-semibold text-[9px] md:text-xs uppercase shadow-sm px-1.5 py-0 md:px-2 md:py-0.5",
                  animal.status === 'active' ? "bg-green-900/80 text-green-100" : "bg-red-900/80 text-red-100"
                )}>
                  {animal.status}
                </Badge>
              </div>
              <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-background/95 to-transparent p-2 md:p-4 pt-6 md:pt-12">
                 <h3 className="text-sm md:text-2xl font-bold text-foreground">{animal.tagId}</h3>
                 {animal.name && <p className="text-[10px] md:text-sm text-muted-foreground font-medium truncate">{animal.name}</p>}
              </div>
            </div>
            
            <div className="p-2 md:p-4 space-y-1.5 md:space-y-3 flex-1 bg-card">
              <div className="flex items-center justify-between text-[11px] md:text-sm">
                 <div className="flex items-center gap-1 md:gap-2 text-muted-foreground">
                   <User className={cn("w-3 h-3 md:w-4 md:h-4", isRam ? "text-blue-400" : "text-pink-400")} />
                   <span className="uppercase font-semibold text-foreground">{animal.sex}</span>
                 </div>
                 <div className="flex items-center gap-1 md:gap-2 text-muted-foreground">
                   <Scale className="w-3 h-3 md:w-4 md:h-4" />
                   <span className="font-mono text-foreground">{animal.currentWeight || '--'} kg</span>
                 </div>
              </div>
              
              <div className="flex items-center justify-between text-[10px] md:text-xs text-muted-foreground pt-1 md:pt-2 border-t border-border/50">
                 <div className="flex items-center gap-0.5 md:gap-1">
                   <Calendar className="w-2.5 h-2.5 md:w-3 md:h-3" />
                   {animal.birthDate ? format(new Date(animal.birthDate), 'MMM yy') : '--'}
                 </div>
                 <span className="truncate">{animal.breed}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>
      
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogTrigger asChild>
          <Button
            size="icon"
            variant="destructive"
            className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity z-10"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowDeleteDialog(true);
            }}
            data-testid={`button-delete-animal-${animal.id}`}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Animal Profile</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete <strong>{animal.tagId}</strong>
              {animal.name ? ` (${animal.name})` : ''}? This action cannot be undone and will remove all associated records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
