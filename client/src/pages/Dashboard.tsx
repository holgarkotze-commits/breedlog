import { useAnimals } from "@/hooks/use-animals";
import { useBreedingEvents } from "@/hooks/use-breeding";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Users, TrendingUp, AlertTriangle } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export default function Dashboard() {
  const { data: animals, isLoading: loadingAnimals } = useAnimals();
  const { data: breeding, isLoading: loadingBreeding } = useBreedingEvents();

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
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl md:text-5xl font-black uppercase text-foreground tracking-tight">Farm Overview</h1>
            <p className="text-muted-foreground mt-2 text-lg">Daily digest and performance metrics.</p>
          </div>
          <div className="bg-secondary/50 px-4 py-2 rounded border border-border font-mono text-sm text-primary">
            {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard 
            title="Total Herd" 
            value={totalAnimals} 
            loading={loadingAnimals} 
            icon={Users} 
            trend="+12% from last month"
          />
          <StatCard 
            title="Active Ewes" 
            value={activeEwes} 
            loading={loadingAnimals} 
            icon={Activity} 
            className="border-l-4 border-l-pink-500"
          />
          <StatCard 
            title="Active Rams" 
            value={activeRams} 
            loading={loadingAnimals} 
            icon={TrendingUp} 
            className="border-l-4 border-l-blue-500"
          />
          <StatCard 
            title="Lambs (<1yr)" 
            value={lambs} 
            loading={loadingAnimals} 
            icon={AlertTriangle} 
            className="border-l-4 border-l-yellow-500"
          />
        </div>

        {/* Charts & Activity Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Chart */}
          <Card className="lg:col-span-2 rugged-card bg-card">
            <CardHeader>
              <CardTitle className="font-display uppercase tracking-wide">Avg. Herd Weight Trend</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={weightData}>
                  <defs>
                    <linearGradient id="colorAvg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#FFC300" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#FFC300" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                  <XAxis dataKey="month" stroke="#666" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#666" fontSize={12} tickLine={false} axisLine={false} unit="kg" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#18181b', borderColor: '#333', borderRadius: '4px' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Area type="monotone" dataKey="avg" stroke="#FFC300" strokeWidth={3} fillOpacity={1} fill="url(#colorAvg)" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Recent Activity Feed */}
          <Card className="rugged-card bg-card">
            <CardHeader>
              <CardTitle className="font-display uppercase tracking-wide">Recent Events</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingBreeding ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full bg-secondary" />)}
                </div>
              ) : (
                <div className="space-y-6">
                  {breeding?.slice(0, 5).map((event, i) => (
                    <div key={i} className="flex gap-4 items-start border-l-2 border-border pl-4 relative">
                      <div className="absolute -left-[5px] top-0 w-2 h-2 rounded-full bg-primary" />
                      <div>
                        <p className="text-sm font-bold text-foreground">
                          Mating: {event.matingType}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(event.matingDate).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                  {(!breeding || breeding.length === 0) && (
                    <p className="text-muted-foreground text-sm italic">No recent breeding events.</p>
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

function StatCard({ title, value, loading, icon: Icon, trend, className }: any) {
  return (
    <Card className={cn("rugged-card bg-card hover:-translate-y-1 transition-transform", className)}>
      <CardContent className="p-6">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider">{title}</p>
            {loading ? (
              <Skeleton className="h-10 w-20 mt-2 bg-secondary" />
            ) : (
              <h3 className="text-4xl font-black mt-2 text-foreground font-display">{value}</h3>
            )}
          </div>
          <div className="p-3 bg-secondary rounded-full text-primary">
            <Icon className="w-6 h-6" />
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
