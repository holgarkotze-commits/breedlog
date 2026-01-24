import { useAnimals } from "@/hooks/use-animals";
import { useBreedingEvents } from "@/hooks/use-breeding";
import { useFarmSettings } from "@/hooks/use-farm-settings";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/StatCard";
import { Activity, Users, TrendingUp, AlertTriangle } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export default function Dashboard() {
  const { data: animals, isLoading: loadingAnimals } = useAnimals();
  const { data: breeding, isLoading: loadingBreeding } = useBreedingEvents();
  const { data: farmSettings } = useFarmSettings();
  const displayName = farmSettings?.studName || farmSettings?.farmName;

  // Calculate simple stats
  const totalAnimals = animals?.length || 0;
  const activeEwes = animals?.filter(a => a.sex === 'ewe' && a.status === 'active').length || 0;
  const activeRams = animals?.filter(a => a.sex === 'ram' && a.status === 'active').length || 0;
  const lambs = animals?.filter(a => {
    if (!a.birthDate) return false;
    const ageInDays = (new Date().getTime() - new Date(a.birthDate).getTime()) / (1000 * 3600 * 24);
    return ageInDays < 365;
  }).length || 0;

  // Mock weight data for chart (in real app, use aggregated performance records)
  const weightData = [
    { month: 'Jan', avg: 45 },
    { month: 'Feb', avg: 48 },
    { month: 'Mar', avg: 52 },
    { month: 'Apr', avg: 55 },
    { month: 'May', avg: 58 },
    { month: 'Jun', avg: 62 },
  ];

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
          <StatCard 
            title="Total Herd" 
            value={totalAnimals} 
            loading={loadingAnimals} 
            icon={Users} 
          />
          <StatCard 
            title="Ewes" 
            value={activeEwes} 
            loading={loadingAnimals} 
            icon={Activity} 
            className="border-l-2 md:border-l-4 border-l-pink-500"
          />
          <StatCard 
            title="Rams" 
            value={activeRams} 
            loading={loadingAnimals} 
            icon={TrendingUp} 
            className="border-l-2 md:border-l-4 border-l-blue-500"
          />
          <StatCard 
            title="Lambs" 
            value={lambs} 
            loading={loadingAnimals} 
            icon={AlertTriangle} 
            className="border-l-2 md:border-l-4 border-l-yellow-500"
          />
        </div>

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
      </div>
    </Layout>
  );
}
