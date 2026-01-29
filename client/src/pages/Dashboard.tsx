import { useAnimals } from "@/hooks/use-animals";
import { useBreedingEvents } from "@/hooks/use-breeding";
import { useFarmSettings } from "@/hooks/use-farm-settings";
import { useRecentVisits } from "@/hooks/use-recent-visits";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/StatCard";
import { Clock, Beef, Dna, Settings, ChevronRight, Heart, Shield, Baby } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, Legend } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Link } from "wouter";
import { format } from "date-fns";

export default function Dashboard() {
  const { data: animals, isLoading: loadingAnimals } = useAnimals();
  const { data: breeding, isLoading: loadingBreeding } = useBreedingEvents();
  const { data: farmSettings } = useFarmSettings();
  const { getRecentVisits } = useRecentVisits();
  const displayName = farmSettings?.studName || farmSettings?.farmName;
  const recentVisits = getRecentVisits(4);

  const getIconForPath = (path: string) => {
    if (path.startsWith("/animals")) return Beef;
    if (path === "/breeding") return Dna;
    if (path === "/settings") return Settings;
    return Clock;
  };

  // Calculate simple stats using age-based counting (consistent with My Herd page)
  // Lambs = animals under 1 year old (365 days)
  // Ewes = female animals 1 year or older
  // Rams = male animals 1 year or older
  const activeAnimals = animals?.filter(a => a.status === 'active').length || 0;
  const soldAnimals = animals?.filter(a => a.status === 'sold').length || 0;
  const deadAnimals = animals?.filter(a => a.status === 'dead').length || 0;
  const culledAnimals = animals?.filter(a => a.status === 'culled').length || 0;
  
  // Helper function to check if animal is under 1 year old
  const isLamb = (animal: { birthDate?: string | null; status?: string | null }) => {
    if (!animal.birthDate || animal.status !== 'active') return false;
    const birthDate = new Date(animal.birthDate);
    const ageInDays = (Date.now() - birthDate.getTime()) / (1000 * 60 * 60 * 24);
    return ageInDays <= 365;
  };
  
  // Lambs are active animals under 1 year old
  const lambs = animals?.filter(a => isLamb(a)).length || 0;
  
  // Ewes are female animals 1 year or older and active
  const activeEwes = animals?.filter(a => 
    a.sex === 'ewe' && 
    a.status === 'active' && 
    !isLamb(a)
  ).length || 0;
  
  // Rams are male animals 1 year or older and active
  const activeRams = animals?.filter(a => 
    a.sex === 'ram' && 
    a.status === 'active' && 
    !isLamb(a)
  ).length || 0;
  
  // Total herd = all active animals
  const totalAnimals = activeAnimals;

  // Mock weight data for chart (in real app, use aggregated performance records)
  const weightData = [
    { month: 'Jan', avg: 45 },
    { month: 'Feb', avg: 48 },
    { month: 'Mar', avg: 52 },
    { month: 'Apr', avg: 55 },
    { month: 'May', avg: 58 },
    { month: 'Jun', avg: 62 },
  ];

  // Calculate 12-month herd growth/decline data
  const getHerdGrowthData = () => {
    const months = [];
    const now = new Date();
    
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      const monthName = format(date, 'MMM');
      
      // Count births (animals born in this month)
      const births = animals?.filter(a => {
        if (!a.birthDate) return false;
        const birthDate = new Date(a.birthDate);
        return birthDate >= date && birthDate <= monthEnd;
      }).length || 0;
      
      // Count additions (animals created/added in this month, excluding births)
      const additions = animals?.filter(a => {
        if (!a.createdAt) return false;
        const createdDate = new Date(a.createdAt);
        const hasBirthInMonth = a.birthDate && new Date(a.birthDate) >= date && new Date(a.birthDate) <= monthEnd;
        return createdDate >= date && createdDate <= monthEnd && !hasBirthInMonth;
      }).length || 0;
      
      // For decline, we'd need status change dates which we don't track
      // So we'll estimate based on non-active animals with createdAt in this period
      const declined = animals?.filter(a => {
        if (!a.createdAt || a.status === 'active') return false;
        const createdDate = new Date(a.createdAt);
        return createdDate >= date && createdDate <= monthEnd && ['sold', 'dead', 'culled'].includes(a.status || '');
      }).length || 0;
      
      months.push({
        month: monthName,
        growth: births + additions,
        decline: -declined,
      });
    }
    
    return months;
  };
  
  const herdGrowthData = getHerdGrowthData();

  return (
    <Layout>
      <div className="space-y-4 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-2 md:gap-4">
          <div>
            <h1 className="text-lg md:text-3xl font-bold text-foreground tracking-tight" data-testid="page-title">
              {displayName ? `${displayName}` : "Dashboard"}
            </h1>
            <p className="text-muted-foreground text-xs md:text-base mt-0.5">Daily digest and performance metrics</p>
          </div>
          <div className="bg-secondary/50 px-2.5 py-1 md:px-4 md:py-2 rounded border border-border font-mono text-[10px] md:text-sm text-primary">
            {new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
          </div>
        </div>

        {/* Key Metrics Grid - 2x2 on mobile */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4">
          {/* Total Herd with itemized status */}
          <Link href="/animals?status=all">
            <Card className="rugged-card bg-card hover:-translate-y-0.5 md:hover:-translate-y-1 transition-transform cursor-pointer hover:border-primary/50">
              <CardContent className="p-3 md:p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-[10px] md:text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total Herd</p>
                    {loadingAnimals ? (
                      <Skeleton className="h-6 md:h-10 w-12 md:w-20 mt-1 md:mt-2 bg-secondary" />
                    ) : (
                      <h3 className="text-xl md:text-3xl font-bold mt-0.5 md:mt-2 text-foreground">{totalAnimals}</h3>
                    )}
                  </div>
                  <div className="p-1.5 md:p-3 bg-secondary rounded-sm text-primary border border-border">
                    <Beef className="w-4 h-4 md:w-5 md:h-5" />
                  </div>
                </div>
                {!loadingAnimals && (
                  <div className="mt-2 md:mt-3 pt-2 border-t border-border/50 grid grid-cols-2 gap-1 text-[9px] md:text-xs">
                    <div className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                      <span className="text-muted-foreground">Active:</span>
                      <span className="font-semibold text-foreground">{activeAnimals}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                      <span className="text-muted-foreground">Sold:</span>
                      <span className="font-semibold text-foreground">{soldAnimals}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                      <span className="text-muted-foreground">Dead:</span>
                      <span className="font-semibold text-foreground">{deadAnimals}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
                      <span className="text-muted-foreground">Culled:</span>
                      <span className="font-semibold text-foreground">{culledAnimals}</span>
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
            href="/animals?status=active&sex=ewe"
          />
          <StatCard 
            title="Rams" 
            value={activeRams} 
            loading={loadingAnimals} 
            icon={Shield} 
            className="border-l-2 md:border-l-4 border-l-blue-500"
            href="/animals?status=active&sex=ram"
          />
          <StatCard 
            title="Lambs" 
            value={lambs} 
            loading={loadingAnimals} 
            icon={Baby} 
            className="border-l-2 md:border-l-4 border-l-yellow-500"
            href="/animals?status=active&age=lamb"
          />
        </div>

        {/* Recently Visited */}
        {recentVisits.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs md:text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <Clock className="w-3.5 h-3.5" /> Recently Visited
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {recentVisits.map((visit, index) => {
                const Icon = getIconForPath(visit.path);
                return (
                  <Link key={index} href={visit.path}>
                    <Card className="rugged-card hover:border-primary/50 transition-colors cursor-pointer p-2 md:p-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center shrink-0">
                          <Icon className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs md:text-sm font-medium truncate">{visit.label}</p>
                          <p className="text-[10px] text-muted-foreground">
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
                <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                <XAxis dataKey="month" stroke="#666" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#666" fontSize={10} tickLine={false} axisLine={false} width={30} />
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

        {/* Charts & Activity Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-8">
          {/* Main Chart */}
          <Card className="lg:col-span-2 rugged-card bg-card">
            <CardHeader className="p-3 md:p-6 pb-1 md:pb-2">
              <CardTitle className="text-sm md:text-base font-semibold">Avg. Herd Weight Trend</CardTitle>
            </CardHeader>
            <CardContent className="h-[180px] md:h-[300px] w-full p-2 md:p-6 pt-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={weightData}>
                  <defs>
                    <linearGradient id="colorAvg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#FFC300" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#FFC300" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                  <XAxis dataKey="month" stroke="#666" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#666" fontSize={10} tickLine={false} axisLine={false} unit="kg" width={35} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#18181b', borderColor: '#333', borderRadius: '4px', fontSize: '12px' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Area type="monotone" dataKey="avg" stroke="#FFC300" strokeWidth={2} fillOpacity={1} fill="url(#colorAvg)" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Recent Activity Feed */}
          <Card className="rugged-card bg-card">
            <CardHeader className="p-3 md:p-6 pb-1 md:pb-2">
              <CardTitle className="text-sm md:text-base font-semibold">Recent Events</CardTitle>
            </CardHeader>
            <CardContent className="p-3 md:p-6 pt-1 md:pt-2">
              {loadingBreeding ? (
                <div className="space-y-2 md:space-y-4">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 md:h-16 w-full bg-secondary" />)}
                </div>
              ) : (
                <div className="space-y-3 md:space-y-6">
                  {breeding?.slice(0, 4).map((event, i) => (
                    <div key={i} className="flex gap-2 md:gap-4 items-start border-l-2 border-border pl-2 md:pl-4 relative">
                      <div className="absolute -left-[4px] md:-left-[5px] top-0 w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-primary" />
                      <div>
                        <p className="text-xs md:text-sm font-semibold text-foreground">
                          {event.matingType}
                        </p>
                        <p className="text-[10px] md:text-xs text-muted-foreground">
                          {new Date(event.matingDate).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                  {(!breeding || breeding.length === 0) && (
                    <p className="text-muted-foreground text-xs italic">No recent events.</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Encouraging message */}
        <div className="text-center py-6 px-4 border-t border-border/30 mt-4">
          <p className="text-sm text-muted-foreground italic max-w-md mx-auto">
            Every record you add builds a stronger genetic foundation. 
            <span className="text-primary font-medium"> BreedLog</span> helps you make smarter breeding decisions for healthier, more productive flocks.
          </p>
        </div>
      </div>
    </Layout>
  );
}
