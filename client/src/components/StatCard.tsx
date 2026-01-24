import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { LucideIcon, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "wouter";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  loading?: boolean;
  className?: string;
  href?: string;
}

export function StatCard({ title, value, icon: Icon, trend, loading, className, href }: StatCardProps) {
  const cardContent = (
    <Card className={cn("rugged-card bg-card hover:-translate-y-0.5 md:hover:-translate-y-1 transition-transform", href && "cursor-pointer hover:border-primary/50", className)}>
      <CardContent className="p-3 md:p-6">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-[10px] md:text-xs font-semibold text-muted-foreground uppercase tracking-wide">{title}</p>
            {loading ? (
              <Skeleton className="h-6 md:h-10 w-12 md:w-20 mt-1 md:mt-2 bg-secondary" />
            ) : (
              <h3 className="text-xl md:text-3xl font-bold mt-0.5 md:mt-2 text-foreground">{value}</h3>
            )}
          </div>
          <div className="p-1.5 md:p-3 bg-secondary rounded-sm text-primary border border-border">
            <Icon className="w-4 h-4 md:w-5 md:h-5" />
          </div>
        </div>
        {trend && (
          <p className="text-[10px] md:text-xs font-medium text-primary mt-2 md:mt-4 flex items-center gap-1">
            <TrendingUp className="w-2.5 h-2.5 md:w-3 md:h-3" /> {trend}
          </p>
        )}
      </CardContent>
    </Card>
  );

  if (href) {
    return <Link href={href}>{cardContent}</Link>;
  }

  return cardContent;
}
