import { useAnimals } from "@/hooks/use-animals";
import { useBreedingEvents, useMatingGroups } from "@/hooks/use-breeding";
import { useFarmSettings } from "@/hooks/use-farm-settings";
import { useRecentVisits } from "@/hooks/use-recent-visits";
import { useFlockHealthEvents } from "@/hooks/use-flock-health";
import { useTheme } from "@/components/ThemeProvider";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/StatCard";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Clock, Beef, Dna, Settings, ChevronRight, Heart, Shield, BarChart3, PlusCircle, TrendingUp, Award, Scale, Baby, Bell, AlertTriangle, Info, X, Calendar, AlertCircle } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, Legend, PieChart, Pie, Cell } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Link } from "wouter";
import { format } from "date-fns";
import { useMemo, useState } from "react";
import { generateAllAlerts, dismissAlert, type DecisionAlert } from "@/lib/decision-alerts";

export default function Dashboard() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const chartGrid = isDark ? "#333" : "#e2e8f0";
  const chartAxis = isDark ? "#666" : "#64748b";

  const { data: animals, isLoading: loadingAnimals } = useAnimals();
  const { data: breeding, isLoading: loadingBreeding } = useBreedingEvents();
  const { data: matingGroups } = useMatingGroups();
  const { data: flockHealthEvents } = useFlockHealthEvents();
  const { data: farmSettings } = useFarmSettings();
  const { getRecentVisits } = useRecentVisits();
  const displayName = farmSettings?.studName || farmSettings?.farmName;
  const recentVisits = getRecentVisits(4);

  const [dismissedKeys, setDismissedKeys] = useState<string[]>([]);

  const getIconForPath = (path: string) => {
    if (path.startsWith("/animals")) return Beef;
    if (path === "/breeding") return Dna;
    if (path === "/settings") return Settings;
    return Clock;
  };

  // Calculate simple stats using age-based counting (consistent with My Herd page)
  // Lambs = animals under 8 months old (240 days)
  // Ewes = female animals 8 months or older and active
  // Rams = male animals 8 months or older and active
  const activeAnimals = animals?.filter(a => a.status === 'active').length || 0;
  
  // Helper function to check if animal is under 8 months old (240 days)
  const isLamb = (animal: { birthDate?: string | null; status?: string | null }) => {
    if (!animal.birthDate || animal.status !== 'active') return false;
    const birthDate = new Date(animal.birthDate);
    const ageInDays = (Date.now() - birthDate.getTime()) / (1000 * 60 * 60 * 24);
    return ageInDays <= 240;
  };
  
  // Ewes are female animals 8+ months old and active
  const activeEwes = animals?.filter(a => 
    a.sex === 'ewe' && 
    a.status === 'active' && 
    !isLamb(a)
  ).length || 0;
  
  // Rams are male animals 8+ months old and active
  const activeRams = animals?.filter(a => 
    a.sex === 'ram' && 
    a.status === 'active' && 
    !isLamb(a)
  ).length || 0;

  // Active lambs
  const activeLambs = animals?.filter(a => a.status === 'active' && isLamb(a)).length || 0;

  // Total herd = all active animals
  const totalAnimals = activeAnimals;

  // Key Performance Metrics
  const animalsWithBirthWeight = animals?.filter(a => a.birthWeight) || [];
  const avgBirthWeight = animalsWithBirthWeight.length > 0
    ? (animalsWithBirthWeight.reduce((s, a) => s + parseFloat(a.birthWeight || '0'), 0) / animalsWithBirthWeight.length).toFixed(1)
    : null;

  const animalsWithWeanWeight = animals?.filter(a => a.weight100Day) || [];
  const avgWeanWeight = animalsWithWeanWeight.length > 0
    ? (animalsWithWeanWeight.reduce((s, a) => s + parseFloat(a.weight100Day || '0'), 0) / animalsWithWeanWeight.length).toFixed(1)
    : null;

  const currentYear = new Date().getFullYear();
  // Use string slice to avoid UTC-midnight timezone shifts on date-only strings
  const lambsThisYear = animals?.filter(a => a.birthDate && a.birthDate.slice(0, 4) === String(currentYear)).length || 0;

  const activeSires = new Set(animals?.filter(a => a.sireId).map(a => a.sireId) || []).size;

  // Active wethers (castrated males, adult)
  const activeWethers = animals?.filter(a =>
    a.sex === 'wether' &&
    a.status === 'active' &&
    !isLamb(a)
  ).length || 0;

  // Herd distribution for donut chart — all active animal categories
  const herdDistribution = [
    { name: 'Ewes', value: activeEwes, color: '#ec4899' },
    { name: 'Rams', value: activeRams, color: '#3b82f6' },
    { name: 'Lambs', value: activeLambs, color: '#f59e0b' },
    { name: 'Wethers', value: activeWethers, color: '#8b5cf6' },
  ].filter(d => d.value > 0);

  // Top sires by progeny count
  const sireProgenyMap = new Map<number, number>();
  animals?.forEach(a => { if (a.sireId) sireProgenyMap.set(a.sireId, (sireProgenyMap.get(a.sireId) || 0) + 1); });
  const topSires = Array.from(sireProgenyMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([sireId, count]) => ({ sire: animals?.find(a => a.id === sireId), count }))
    .filter(({ sire }) => !!sire);

  const slaughterCullWeightData = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    return Array.from({ length: 12 }, (_, m) => {
      const monthName = format(new Date(currentYear, m, 1), 'MMM');
      const culls = animals?.filter(a =>
        (a.classification === 'slaughter_cull' || a.ramLambClass === 'cull') && a.currentWeight
      ) || [];
      const totalWeight = culls.reduce((sum, a) => sum + parseFloat(a.currentWeight || '0'), 0);
      return { month: monthName, avg: culls.length > 0 ? Math.round(totalWeight / culls.length) : 0 };
    });
  }, [animals]);

  const slaughterCullCount = useMemo(() =>
    (animals?.filter(a =>
      (a.classification === 'slaughter_cull' || a.ramLambClass === 'cull') && a.currentWeight
    ).length) || 0,
  [animals]);

  const birthRatioData = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    return Array.from({ length: 12 }, (_, m) => {
      const monthStart = new Date(currentYear, m, 1);
      const monthEnd = new Date(currentYear, m + 1, 0);
      const monthName = format(monthStart, 'MMM');
      const ramLambs = animals?.filter(a => {
        if (!a.birthDate || a.sex !== 'ram') return false;
        const bd = new Date(a.birthDate);
        return bd >= monthStart && bd <= monthEnd && bd.getFullYear() === currentYear;
      }).length || 0;
      const eweLambs = animals?.filter(a => {
        if (!a.birthDate || a.sex !== 'ewe') return false;
        const bd = new Date(a.birthDate);
        return bd >= monthStart && bd <= monthEnd && bd.getFullYear() === currentYear;
      }).length || 0;
      return { month: monthName, ramLambs, eweLambs };
    });
  }, [animals]);

  const totalRamLambs = useMemo(() => birthRatioData.reduce((s, m) => s + m.ramLambs, 0), [birthRatioData]);
  const totalEweLambs = useMemo(() => birthRatioData.reduce((s, m) => s + m.eweLambs, 0), [birthRatioData]);
  const birthRatioText = totalRamLambs > 0 || totalEweLambs > 0
    ? `${totalEweLambs} : ${totalRamLambs}`
    : 'No births recorded';

  const herdGrowthData = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 12 }, (_, idx) => {
      const i = 11 - idx;
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      const monthName = format(date, 'MMM');
      const births = animals?.filter(a => {
        if (!a.birthDate) return false;
        const bd = new Date(a.birthDate);
        return bd >= date && bd <= monthEnd;
      }).length || 0;
      const additions = animals?.filter(a => {
        if (!a.createdAt) return false;
        const cd = new Date(a.createdAt);
        const hasBirth = a.birthDate && new Date(a.birthDate) >= date && new Date(a.birthDate) <= monthEnd;
        return cd >= date && cd <= monthEnd && !hasBirth;
      }).length || 0;
      const declined = animals?.filter(a => {
        if (!a.createdAt || a.status === 'active') return false;
        const cd = new Date(a.createdAt);
        return cd >= date && cd <= monthEnd && ['sold', 'dead', 'culled'].includes(a.status || '');
      }).length || 0;
      return { month: monthName, growth: births + additions, decline: -declined };
    });
  }, [animals]);

  const decisionAlerts = useMemo(() =>
    generateAllAlerts({
      flockHealthEvents: flockHealthEvents || [],
      matingGroups: matingGroups || [],
      animals: animals || [],
    }),
  [flockHealthEvents, matingGroups, animals, dismissedKeys]);

  return (
    <Layout>
      <div className="space-y-5 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col justify-between gap-2 md:flex-row md:items-end md:gap-4">
          <div>
            <h1 className="text-2xl md:text-5xl font-bold text-foreground tracking-tight" data-testid="page-title">
              {displayName ? `${displayName}` : "Dashboard"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground md:text-base">Daily digest and performance metrics</p>
          </div>
          <div className="rounded-xl border border-accent/55 bg-card/85 px-3 py-1.5 font-display text-sm font-semibold text-primary shadow-sm md:px-5 md:py-2 md:text-sm">
            {new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
          </div>
        </div>

        {/* Decision Assist Alerts */}
        {decisionAlerts.length > 0 && (
          <div className="space-y-2" data-testid="decision-assist-alerts">
            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <Bell className="w-4 h-4 text-primary" /> Important Alerts
            </h3>
            {decisionAlerts.map((alert) => {
              const isOverdue = alert.severity === "critical";
              const isImportant = alert.severity === "important";
              const isDueSoon = alert.severity === "due-soon";
              return (
                <div
                  key={alert.key}
                  data-testid={`decision-alert-${alert.key}`}
                  className={cn(
                    "flex items-start gap-3 rounded-xl border px-4 py-3",
                    isOverdue && "border-destructive/40 bg-destructive/10",
                    isImportant && "border-amber-500/40 bg-amber-500/10",
                    isDueSoon && "border-primary/30 bg-primary/5",
                    !isOverdue && !isImportant && !isDueSoon && "border-border bg-secondary/40"
                  )}
                >
                  <div className="mt-0.5 shrink-0">
                    {isOverdue && <AlertCircle className="w-4 h-4 text-destructive" />}
                    {isImportant && <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />}
                    {isDueSoon && <Calendar className="w-4 h-4 text-primary" />}
                    {!isOverdue && !isImportant && !isDueSoon && <Info className="w-4 h-4 text-muted-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      "text-sm font-bold",
                      isOverdue && "text-destructive dark:text-foreground",
                      isImportant && "text-amber-800 dark:text-amber-300",
                    )}>
                      {alert.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{alert.message}</p>
                    {alert.action && alert.actionHref && (
                      <Link href={alert.actionHref}>
                        <Button variant="outline" size="sm" className="mt-2 h-7 text-xs">
                          {alert.action}
                        </Button>
                      </Link>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      dismissAlert(alert.key);
                      setDismissedKeys((prev) => [...prev, alert.key]);
                    }}
                    className="shrink-0 mt-0.5 p-1 rounded-md hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                    aria-label="Dismiss alert"
                    data-testid={`button-dismiss-alert-${alert.key}`}
                  >
                    <X className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Empty State - Show when no animals */}
        {!loadingAnimals && totalAnimals === 0 && (
          <Card className="rugged-card border-accent/70 bg-card">
            <CardContent className="p-6 md:p-8 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-accent/60 bg-primary/10">
                <Beef className="w-8 h-8 text-primary" />
              </div>
              <h3 className="mb-2 text-3xl font-bold">No animals yet.</h3>
              <p className="text-muted-foreground text-sm mb-4 max-w-md mx-auto">
                Add your first ram, ewe, or lamb to start tracking your herd. 
                All your data will sync automatically and work offline.
              </p>
              <div className="flex flex-col justify-center gap-3 sm:flex-row">
                <Link href="/animals?add=ram">
                  <Button variant="default" className="w-full sm:w-auto" data-testid="button-add-ram-empty">
                    <PlusCircle className="w-4 h-4 mr-2" /> Add Ram
                  </Button>
                </Link>
                <Link href="/animals?add=ewe">
                  <Button variant="default" className="w-full sm:w-auto" data-testid="button-add-ewe-empty">
                    <PlusCircle className="w-4 h-4 mr-2" /> Add Ewe
                  </Button>
                </Link>
                <Link href="/animals?add=lamb">
                  <Button variant="default" className="w-full sm:w-auto" data-testid="button-add-lamb-empty">
                    <PlusCircle className="w-4 h-4 mr-2" /> Add Lamb
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Key Metrics Grid - 2x2 on mobile */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 md:gap-5">
          {/* Total Herd with itemized status */}
          <Link href="/animals?section=total">
            <Card className="rugged-card cursor-pointer bg-card transition-transform hover:-translate-y-0.5 hover:border-accent/80 md:hover:-translate-y-1">
              <CardContent className="p-3 md:p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs md:text-sm font-semibold text-muted-foreground uppercase tracking-wide">Total Herd</p>
                    {loadingAnimals ? (
                      <Skeleton className="h-7 md:h-10 w-12 md:w-20 mt-1 md:mt-2 bg-secondary" />
                    ) : (
                      <h3 className="text-2xl md:text-4xl font-bold mt-0.5 md:mt-2 text-foreground">{totalAnimals}</h3>
                    )}
                  </div>
                  <div className="rounded-xl border border-accent/45 bg-secondary/70 p-1.5 text-primary md:p-3">
                    <Beef className="w-4 h-4 md:w-6 md:h-6" />
                  </div>
                </div>
                {!loadingAnimals && (
                  <div className="mt-2 md:mt-3 pt-2 border-t border-border/50 grid grid-cols-3 gap-1 text-xs">
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-primary shrink-0"></span>
                      <span className="text-muted-foreground">Rams:</span>
                      <span className="font-bold text-foreground">{activeRams}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-pink-500 shrink-0"></span>
                      <span className="text-muted-foreground">Ewes:</span>
                      <span className="font-bold text-foreground">{activeEwes}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0"></span>
                      <span className="text-muted-foreground">Lambs:</span>
                      <span className="font-bold text-foreground">{totalAnimals - activeRams - activeEwes}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </Link>
          <StatCard 
            title="Ewes" 
            value={activeEwes} 
            loading={loadingAnimals} 
            icon={Heart} 
            className="border-l-2 md:border-l-4 border-l-pink-500"
            href="/animals?section=ewes"
          />
          <StatCard 
            title="Rams" 
            value={activeRams} 
            loading={loadingAnimals} 
            icon={Shield} 
            className="border-l-2 md:border-l-4 border-l-blue-500"
            href="/animals?section=rams"
          />
          <StatCard 
            title="Lambs" 
            value={activeLambs} 
            loading={loadingAnimals} 
            icon={Baby} 
            className="border-l-2 md:border-l-4 border-l-amber-400"
            href="/animals?section=lambs"
          />
        </div>

        {/* Key Performance Metrics */}
        {!loadingAnimals && totalAnimals > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm md:text-base font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <TrendingUp className="w-4 h-4" /> Key Performance Metrics
            </h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
              <Card className="rugged-card bg-card">
                <CardContent className="p-3 md:p-5">
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-xs md:text-sm font-semibold text-muted-foreground uppercase tracking-wide">Avg Birth Wt</p>
                    <div className="rounded-lg border border-accent/40 bg-secondary/60 p-1.5 text-primary">
                      <Scale className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <p className="text-xl md:text-3xl font-bold text-foreground">
                    {avgBirthWeight ? `${avgBirthWeight} kg` : '—'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{animalsWithBirthWeight.length} records</p>
                </CardContent>
              </Card>
              <Card className="rugged-card bg-card">
                <CardContent className="p-3 md:p-5">
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-xs md:text-sm font-semibold text-muted-foreground uppercase tracking-wide">Avg Wean Wt</p>
                    <div className="rounded-lg border border-accent/40 bg-secondary/60 p-1.5 text-primary">
                      <Scale className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <p className="text-xl md:text-3xl font-bold text-foreground">
                    {avgWeanWeight ? `${avgWeanWeight} kg` : '—'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{animalsWithWeanWeight.length} records</p>
                </CardContent>
              </Card>
              <Card className="rugged-card bg-card">
                <CardContent className="p-3 md:p-5">
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-xs md:text-sm font-semibold text-muted-foreground uppercase tracking-wide">Born {currentYear}</p>
                    <div className="rounded-lg border border-accent/40 bg-secondary/60 p-1.5 text-primary">
                      <Baby className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <p className="text-xl md:text-3xl font-bold text-foreground">{lambsThisYear}</p>
                  <p className="text-xs text-muted-foreground mt-1">lambs this season</p>
                </CardContent>
              </Card>
              <Card className="rugged-card bg-card">
                <CardContent className="p-3 md:p-5">
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-xs md:text-sm font-semibold text-muted-foreground uppercase tracking-wide">Active Sires</p>
                    <div className="rounded-lg border border-accent/40 bg-secondary/60 p-1.5 text-primary">
                      <Award className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <p className="text-xl md:text-3xl font-bold text-foreground">{activeSires}</p>
                  <p className="text-xs text-muted-foreground mt-1">sires with progeny</p>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Herd Distribution + Top Sires */}
        {!loadingAnimals && totalAnimals > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-5">
            {/* Herd Distribution Donut */}
            <Card className="rugged-card bg-card">
              <CardHeader className="p-3 md:p-5 pb-1 md:pb-2">
                <CardTitle className="text-sm md:text-base font-semibold">Herd Distribution</CardTitle>
              </CardHeader>
              <CardContent className="p-3 md:p-5 pt-0 flex items-center gap-4">
                <div className="relative h-[140px] w-[140px] md:h-[160px] md:w-[160px] shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={herdDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius="58%"
                        outerRadius="78%"
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {herdDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-2xl md:text-3xl font-bold text-foreground">{totalAnimals}</span>
                    <span className="text-xs text-muted-foreground">total</span>
                  </div>
                </div>
                <div className="flex flex-col gap-2 flex-1">
                  {herdDistribution.map(d => (
                    <div key={d.name} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                        <span className="text-sm text-muted-foreground">{d.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground">{d.value}</span>
                        <span className="text-xs text-muted-foreground">{totalAnimals > 0 ? Math.round(d.value / totalAnimals * 100) : 0}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Top Sires by Progeny */}
            <Card className="rugged-card bg-card">
              <CardHeader className="p-3 md:p-5 pb-1 md:pb-2">
                <CardTitle className="text-sm md:text-base font-semibold flex items-center gap-2">
                  <Award className="w-4 h-4 text-primary" /> Top Sires by Progeny
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 md:p-5 pt-0">
                {topSires.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No sire data recorded yet</p>
                ) : (
                  <div className="space-y-2">
                    {topSires.map(({ sire, count }, index) => {
                      const maxCount = topSires[0].count;
                      const pct = maxCount > 0 ? Math.round(count / maxCount * 100) : 0;
                      return (
                        <Link key={sire!.id} href={`/animals/${sire!.id}`}>
                          <div className="flex items-center gap-2 group cursor-pointer">
                            <span className="text-xs font-bold text-muted-foreground w-4 shrink-0">#{index + 1}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between mb-1">
                                <span className="text-sm font-semibold truncate group-hover:text-primary transition-colors">{sire!.tagId}</span>
                                <span className="text-sm font-bold text-foreground shrink-0 ml-2">{count} <span className="text-xs text-muted-foreground font-normal">lambs</span></span>
                              </div>
                              <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Recently Visited */}
        {recentVisits.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm md:text-base font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <Clock className="w-4 h-4" /> Recently Visited
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {recentVisits.map((visit, index) => {
                const Icon = getIconForPath(visit.path);
                // Check if this is an animal page and get the animal data
                const isAnimalPage = visit.path.startsWith("/animals/");
                const animalId = isAnimalPage ? parseInt(visit.path.split("/")[2]) : null;
                const animal = animalId ? animals?.find(a => a.id === animalId) : null;
                
                // Get display label - prefer tagId over generic "Animal X"
                const displayLabel = animal?.tagId || visit.label;
                
                // Get thumbnail URL - animal's photo field
                const thumbnailUrl = animal?.photo || null;
                
                return (
                  <Link key={index} href={visit.path}>
                    <Card className="rugged-card cursor-pointer p-2 transition-colors hover:border-accent/80 md:p-3" data-testid={`card-recent-visit-${index}`}>
                      <div className="flex items-center gap-2">
                        {/* Thumbnail or icon */}
                        {isAnimalPage && thumbnailUrl ? (
                          <div className="w-10 h-10 rounded overflow-hidden shrink-0 border border-border">
                            <img 
                              src={thumbnailUrl} 
                              alt={displayLabel}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                // On error, hide and show placeholder
                                e.currentTarget.style.display = 'none';
                                e.currentTarget.nextElementSibling?.classList.remove('hidden');
                              }}
                            />
                            <div className="hidden w-full h-full bg-primary/10 flex items-center justify-center">
                              <Beef className="w-5 h-5 text-primary/60" />
                            </div>
                          </div>
                        ) : isAnimalPage ? (
                          <div className="w-10 h-10 rounded bg-primary/10 flex items-center justify-center shrink-0 border border-border">
                            <Beef className="w-5 h-5 text-primary/60" />
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center shrink-0">
                            <Icon className="w-4 h-4 text-primary" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs md:text-sm font-medium truncate" data-testid={`text-recent-visit-label-${index}`}>{displayLabel}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(visit.timestamp), "HH:mm")}
                          </p>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Herd Growth Chart - Full Width */}
        <Card className="rugged-card bg-card">
          <CardHeader className="p-3 md:p-6 pb-1 md:pb-2">
            <CardTitle className="text-sm md:text-base font-semibold">12-Month Herd Growth & Decline</CardTitle>
          </CardHeader>
          <CardContent className="h-[200px] md:h-[280px] w-full p-2 md:p-6 pt-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={herdGrowthData} stackOffset="sign">
                <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} vertical={false} />
                <XAxis dataKey="month" stroke={chartAxis} fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke={chartAxis} fontSize={10} tickLine={false} axisLine={false} width={30} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#18181b', borderColor: '#333', borderRadius: '4px', fontSize: '12px' }}
                  itemStyle={{ color: '#fff' }}
                  formatter={(value: number, name: string) => [Math.abs(value), name === 'growth' ? 'Added' : 'Removed']}
                />
                <Legend 
                  wrapperStyle={{ fontSize: '10px' }}
                  formatter={(value) => value === 'growth' ? 'Added' : 'Removed'}
                />
                <Bar dataKey="growth" fill="#22c55e" stackId="stack" radius={[2, 2, 0, 0]} />
                <Bar dataKey="decline" fill="#ef4444" stackId="stack" radius={[0, 0, 2, 2]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-8 items-start">
          {/* Slaughter/Cull Weight Chart */}
          <div className="flex flex-col">
            <Card className="rugged-card bg-card h-[240px] md:h-[380px]">
              <CardHeader className="p-3 md:p-6 pb-1 md:pb-2">
                <CardTitle className="text-sm md:text-base font-semibold">Avg. Slaughter/Cull Weight</CardTitle>
              </CardHeader>
              <CardContent className="h-[180px] md:h-[300px] w-full p-2 md:p-6 pt-0">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={slaughterCullWeightData}>
                    <defs>
                      <linearGradient id="colorAvg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#FFC300" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#FFC300" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} vertical={false} />
                    <XAxis dataKey="month" stroke={chartAxis} fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke={chartAxis} fontSize={10} tickLine={false} axisLine={false} unit="kg" width={35} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#18181b', borderColor: '#333', borderRadius: '4px', fontSize: '12px' }}
                      itemStyle={{ color: '#fff' }}
                      formatter={(value: number) => [`${value} kg`, 'Avg Weight']}
                    />
                    <Area type="monotone" dataKey="avg" stroke="#FFC300" strokeWidth={2} fillOpacity={1} fill="url(#colorAvg)" name="Avg Weight" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <p className="text-xs md:text-sm text-muted-foreground mt-2 text-center" data-testid="text-cull-count">
              Based on {slaughterCullCount} animal{slaughterCullCount !== 1 ? 's' : ''} with recorded weights
            </p>
          </div>

          {/* Birth Ratio Chart - Ram vs Ewe Lambs */}
          <div className="flex flex-col">
            <Card className="rugged-card bg-card h-[240px] md:h-[380px]">
              <CardHeader className="p-3 md:p-6 pb-1 md:pb-2">
                <CardTitle className="text-sm md:text-base font-semibold">Birth Ratio {new Date().getFullYear()} (Ram vs Ewe Lambs)</CardTitle>
              </CardHeader>
              <CardContent className="h-[180px] md:h-[300px] w-full p-2 md:p-6 pt-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={birthRatioData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} vertical={false} />
                    <XAxis dataKey="month" stroke={chartAxis} fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke={chartAxis} fontSize={10} tickLine={false} axisLine={false} width={25} allowDecimals={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#18181b', borderColor: '#333', borderRadius: '4px', fontSize: '12px' }}
                      itemStyle={{ color: '#fff' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '10px' }} />
                    <Bar dataKey="ramLambs" name="Ram Lambs" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="eweLambs" name="Ewe Lambs" fill="#ec4899" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            {/* Ratio Summary - Below the card */}
            <div className="mt-3 md:mt-4 text-center" data-testid="birth-ratio-summary">
              <p className="text-xs md:text-sm text-muted-foreground">
                <span className="text-pink-500 font-semibold">Ewe Lambs</span>
                {" vs "}
                <span className="text-blue-500 font-semibold">Ram Lambs</span>
              </p>
              <p className="text-lg md:text-2xl font-bold text-foreground mt-1" data-testid="birth-ratio-value">
                {birthRatioText}
              </p>
            </div>
          </div>
        </div>

        {/* Encouraging message */}
        <div className="mt-4 border-t border-accent/30 px-4 py-6 text-center">
          <p className="text-sm text-muted-foreground italic max-w-md mx-auto">
            Every record you add builds a stronger genetic foundation. 
            <span className="text-primary font-medium"> BreedLog</span> helps you make smarter breeding decisions for healthier, more productive flocks.
          </p>
        </div>
      </div>
    </Layout>
  );
}
