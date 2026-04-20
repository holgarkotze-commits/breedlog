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
    <Card className={cn("rugged-card bg-card transition-transform hover:-translate-y-0.5 md:hover:-translate-y-1", href && "cursor-pointer hover:border-accent/85", className)}>
      <CardContent className="p-3 md:p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground md:text-sm">{title}</p>
            {loading ? (
              <Skeleton className="mt-2 h-7 w-12 bg-secondary md:h-10 md:w-20" />
            ) : (
              <h3 className="mt-1 text-2xl font-bold text-foreground md:mt-2 md:text-4xl">{value}</h3>
            )}
          </div>
          <div className="rounded-xl border border-accent/45 bg-gradient-to-b from-slate-600/10 to-slate-700/20 p-1.5 text-primary md:p-3">
            <Icon className="h-4 w-4 md:h-6 md:w-6" />
          </div>
        </div>
        {trend && (
          <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-primary md:mt-4 md:text-sm">
            <TrendingUp className="h-3 w-3 md:h-3.5 md:w-3.5" /> {trend}
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
