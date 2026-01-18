import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { LucideIcon, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  loading?: boolean;
  className?: string;
}

export function StatCard({ title, value, icon: Icon, trend, loading, className }: StatCardProps) {
  return (
    <Card className={cn("rugged-card bg-card hover:-translate-y-1 transition-transform", className)}>
      <CardContent className="p-6">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{title}</p>
            {loading ? (
              <Skeleton className="h-10 w-20 mt-2 bg-secondary" />
            ) : (
              <h3 className="text-3xl font-black mt-2 text-foreground font-display">{value}</h3>
            )}
          </div>
          <div className="p-3 bg-secondary rounded-sm text-primary border border-border">
            <Icon className="w-5 h-5" />
          </div>
        </div>
        {trend && (
          <p className="text-xs font-medium text-primary mt-4 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> {trend}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
