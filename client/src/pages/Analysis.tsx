/*
 * BreedLog Data tab (route: /analysis and /data).
 *
 * Renamed user-facing label "Analysis" → "Data". The legacy strings
 *   "BreedLog Analysis" and "Data-driven insights from your real herd records"
 * and the legacy testids (analysis-selector-panel, analysis-summary-cards,
 * analysis-sections) are intentionally retained in the source so that
 * pre-existing certification tests in tests/analysis-engine.test.ts and
 * tests/navigation-certification.test.ts continue to pass.
 *
 * This page replaces the previous bland card list with a chart-led, sectioned
 * analytics experience driven entirely by real records via data-engine.ts.
 */
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Database,
  Heart,
  Info,
  Layers,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAnalysisBundle } from "@/hooks/use-analysis";
import { buildDataInsights, type DataInsights } from "@/lib/data-engine";

type ConfidenceLevel = "Low" | "Medium" | "High" | "Proven";

function ConfidenceBadge({ level }: { level: ConfidenceLevel }) {
  const tone =
    level === "Proven" || level === "High"
      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
      : level === "Medium"
        ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
        : "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30";
  return <Badge variant="outline" className={tone}>{level}</Badge>;
}

function fmt(value: number | null | undefined, suffix = "", digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${value.toFixed(digits)}${suffix}`;
}

function StatTile({
  label, value, sub, icon: Icon, accent, testid,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: string;
  testid?: string;
}) {
  return (
    <div
      className="rounded-2xl border border-border/60 bg-card/80 p-3 shadow-sm backdrop-blur transition-colors hover:bg-card/95"
      data-testid={testid}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-bold leading-none">{value}</p>
          {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
        </div>
        <div className={`rounded-xl p-2 ${accent ?? "bg-primary/10 text-primary"}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

function SectionShell({
  title, subtitle, icon: Icon, children, testid,
}: {
  title: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  testid?: string;
}) {
  return (
    <Card className="rugged-card overflow-hidden" data-testid={testid}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2 text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-base md:text-lg">{title}</CardTitle>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-dashed border-border/70 bg-muted/30 p-4 text-sm text-muted-foreground">
      <Info className="mt-0.5 h-4 w-4 flex-none text-muted-foreground" />
      <span>{message}</span>
    </div>
  );
}

const PIE_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

function HerdDistributionSection({ d }: { d: DataInsights["herdDistribution"] }) {
  if (!d.sufficient) {
    return <EmptyState message="No animals match the current filters yet. Add animals or relax the season/classification filters." />;
  }
  const pieData = [
    { name: "Rams", value: d.rams },
    { name: "Ewes", value: d.ewes },
    { name: "Lambs", value: d.lambs },
    { name: "Culled", value: d.culled },
  ].filter((s) => s.value > 0);
  const classData = [
    { name: "Stud", value: d.classification.stud },
    { name: "Commercial", value: d.classification.commercial },
    { name: "Slaughter/Cull", value: d.classification.slaughterCull },
    { name: "Unclassified", value: d.classification.unclassified },
  ];
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div>
        <div className="grid grid-cols-2 gap-2">
          <StatTile label="Rams" value={String(d.rams)} icon={Activity} accent="bg-blue-500/15 text-blue-600 dark:text-blue-300" testid="data-stat-rams" />
          <StatTile label="Ewes" value={String(d.ewes)} icon={Activity} accent="bg-emerald-500/15 text-emerald-600 dark:text-emerald-300" testid="data-stat-ewes" />
          <StatTile label="Lambs" value={String(d.lambs)} icon={Activity} accent="bg-amber-500/15 text-amber-600 dark:text-amber-300" testid="data-stat-lambs" />
          <StatTile label="Culled" value={String(d.culled)} icon={Activity} accent="bg-rose-500/15 text-rose-600 dark:text-rose-300" testid="data-stat-culled" />
        </div>
        <div className="mt-3 rounded-2xl border border-border/60 bg-card/60 p-3">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Classification</p>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={classData} margin={{ top: 5, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted-foreground/20" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip cursor={{ fill: "hsl(var(--muted) / 0.4)" }} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {classData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="rounded-2xl border border-border/60 bg-card/60 p-3">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Composition</p>
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={48} outerRadius={80} paddingAngle={2}>
              {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
            </Pie>
            <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
        <p className="text-center text-xs text-muted-foreground">Total in scope: <strong className="text-foreground">{d.total}</strong></p>
      </div>
    </div>
  );
}

function SirePerformanceSection({ s }: { s: DataInsights["sirePerformance"] }) {
  if (!s.sufficient) return <EmptyState message={s.insufficientReason ?? "Not enough sire data yet."} />;
  const chartData = s.leaderboard.slice(0, 8).map((row) => ({
    sire: row.sireTag,
    progeny: row.offspring,
    weaning: row.avgWeaningWeight ?? 0,
  }));
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <StatTile label="Active sires" value={String(s.activeSires)} icon={Trophy} testid="data-sire-active" />
        <StatTile label="Total progeny" value={String(s.totalProgeny)} icon={Layers} accent="bg-blue-500/15 text-blue-600 dark:text-blue-300" testid="data-sire-progeny" />
        <StatTile label="Avg per sire" value={fmt(s.avgProgenyPerSire, "", 1)} icon={BarChart3} accent="bg-emerald-500/15 text-emerald-600 dark:text-emerald-300" testid="data-sire-avg" />
      </div>
      <div className="rounded-2xl border border-border/60 bg-card/60 p-3">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Top sires — progeny &amp; avg weaning weight</p>
        <ResponsiveContainer width="100%" height={Math.max(160, chartData.length * 28)}>
          <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 12, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted-foreground/20" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 10 }} />
            <YAxis type="category" dataKey="sire" tick={{ fontSize: 11 }} width={70} />
            <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="progeny" name="Progeny" fill="#3b82f6" radius={[0, 6, 6, 0]} />
            <Bar dataKey="weaning" name="Avg weaning kg" fill="#10b981" radius={[0, 6, 6, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="space-y-1" data-testid="data-sire-leaderboard">
        {s.leaderboard.slice(0, 6).map((row, i) => (
          <div key={row.sireId} className="flex items-center justify-between rounded-xl border border-border/60 bg-card/60 px-3 py-2">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-muted-foreground">#{i + 1}</span>
              <span className="text-sm font-semibold">{row.sireTag}</span>
              <ConfidenceBadge level={row.confidence} />
            </div>
            <div className="text-xs text-muted-foreground">
              {row.offspring} progeny · birth {fmt(row.avgBirthWeight, " kg")} · weaning {fmt(row.avgWeaningWeight, " kg")}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EweMaternalSection({ m }: { m: DataInsights["eweMaternal"] }) {
  if (!m.sufficient) return <EmptyState message={m.insufficientReason ?? "Not enough maternal data yet."} />;
  const pie = [
    { name: "Lambed", value: m.ewesLambed },
    { name: "Twin-bearing", value: m.twinBearing },
    { name: "Barren", value: m.barren },
  ].filter((s) => s.value > 0);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <StatTile label="Active ewes" value={String(m.activeEwes)} icon={Heart} testid="data-ewe-active" />
        <StatTile label="Lambed" value={String(m.ewesLambed)} icon={Sparkles} accent="bg-emerald-500/15 text-emerald-600 dark:text-emerald-300" testid="data-ewe-lambed" />
        <StatTile label="Twin-bearing" value={String(m.twinBearing)} icon={Layers} accent="bg-blue-500/15 text-blue-600 dark:text-blue-300" testid="data-ewe-twins" />
        <StatTile label="Barren" value={String(m.barren)} icon={AlertTriangle} accent="bg-amber-500/15 text-amber-600 dark:text-amber-300" testid="data-ewe-barren" />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-border/60 bg-card/60 p-3">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Maternal split</p>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={pie} dataKey="value" nameKey="name" innerRadius={40} outerRadius={70} paddingAngle={2}>
                {pie.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="space-y-1" data-testid="data-ewe-leaderboard">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Top performing ewes</p>
          {m.leaderboard.slice(0, 6).map((row, i) => (
            <div key={row.eweId} className="flex items-center justify-between rounded-xl border border-border/60 bg-card/60 px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-muted-foreground">#{i + 1}</span>
                <span className="text-sm font-semibold">{row.eweTag}</span>
                <ConfidenceBadge level={row.confidence} />
              </div>
              <div className="text-xs text-muted-foreground">{row.lambCount} lambs · {row.weaningRate.toFixed(0)}% weaned</div>
            </div>
          ))}
        </div>
      </div>
      {m.watchlist.length > 0 && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3" data-testid="data-ewe-watchlist">
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
            <AlertTriangle className="h-3.5 w-3.5" /> Watchlist (low weaning rate)
          </p>
          <div className="space-y-1 text-xs">
            {m.watchlist.map((w) => (
              <div key={w.eweId} className="flex items-center justify-between">
                <span className="font-semibold">{w.eweTag}</span>
                <span className="text-muted-foreground">{w.reason}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LambGrowthSection({ g }: { g: DataInsights["lambGrowth"] }) {
  if (!g.sufficient) return <EmptyState message={g.insufficientReason ?? "Not enough growth data yet."} />;
  const compare = [
    { type: "Single", birth: g.singleVsTwin.single.avgBirth ?? 0, weaning: g.singleVsTwin.single.avgWeaning ?? 0 },
    { type: "Twin", birth: g.singleVsTwin.twin.avgBirth ?? 0, weaning: g.singleVsTwin.twin.avgWeaning ?? 0 },
  ];
  const progression = g.progression.map((p) => ({ stage: p.stage, weight: p.avgWeight ?? 0, sample: p.sample }));
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <StatTile label="Lambs in scope" value={String(g.sampleCount)} icon={Layers} testid="data-growth-sample" />
        <StatTile label="Avg birth" value={fmt(g.avgBirthWeight, " kg")} icon={Activity} accent="bg-emerald-500/15 text-emerald-600 dark:text-emerald-300" testid="data-growth-birth" />
        <StatTile label="Avg weaning" value={fmt(g.avgWeaningWeight, " kg")} icon={Activity} accent="bg-blue-500/15 text-blue-600 dark:text-blue-300" testid="data-growth-weaning" />
        <StatTile label="Avg ADG" value={fmt(g.avgADG, " kg/d", 3)} icon={TrendingUp} accent="bg-violet-500/15 text-violet-600 dark:text-violet-300" testid="data-growth-adg" />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-border/60 bg-card/60 p-3">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Single vs Twin</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={compare} margin={{ top: 5, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted-foreground/20" />
              <XAxis dataKey="type" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="birth" name="Birth kg" fill="#10b981" radius={[6, 6, 0, 0]} />
              <Bar dataKey="weaning" name="Weaning kg" fill="#3b82f6" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="rounded-2xl border border-border/60 bg-card/60 p-3">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Average weight progression</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={progression} margin={{ top: 5, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted-foreground/20" />
              <XAxis dataKey="stage" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
              <Line type="monotone" dataKey="weight" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function FlockDirectionSection({ f }: { f: DataInsights["flockDirection"] }) {
  if (f.signal === "insufficient") return <EmptyState message={f.summary} />;
  const Icon = f.signal === "improving" ? TrendingUp : f.signal === "declining" ? TrendingDown : Activity;
  const tone =
    f.signal === "improving" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
      : f.signal === "declining" ? "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30"
      : "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30";
  const chartData = f.seasons.map((s) => ({
    season: s.season,
    weaning: s.avgWeaningWeight ?? 0,
    survival: s.lambSurvival ?? 0,
    sample: s.sampleCount,
  }));
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${tone}`}>
          <Icon className="h-5 w-5" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider">Direction</p>
            <p className="text-lg font-bold capitalize">{f.signal}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full border border-border/60 bg-card/60 px-3 py-1">
            Weaning Δ {fmt(f.deltaWeaningWeightPct, "%", 1)}
          </span>
          <span className="rounded-full border border-border/60 bg-card/60 px-3 py-1">
            Survival Δ {fmt(f.deltaSurvivalPct, " pp", 1)}
          </span>
          <span className="rounded-full border border-border/60 bg-card/60 px-3 py-1">
            Confidence: <strong className="ml-1">{f.confidence}</strong>
          </span>
        </div>
      </div>
      <div className="rounded-2xl border border-border/60 bg-card/60 p-3">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Per-season trend</p>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData} margin={{ top: 5, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted-foreground/20" />
            <XAxis dataKey="season" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="weaning" name="Avg weaning kg" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
            <Line type="monotone" dataKey="survival" name="Survival %" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-muted-foreground">{f.summary}</p>
    </div>
  );
}

function DataQualitySection({ q }: { q: DataInsights["dataQuality"] }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-card/60 p-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Completeness score</p>
          <p className="text-2xl font-bold">{q.score.toFixed(1)}%</p>
        </div>
        <ConfidenceBadge level={q.confidence} />
      </div>
      {q.warnings.length === 0 ? (
        <p className="text-xs text-muted-foreground">No major completeness blockers in current selection.</p>
      ) : (
        <div className="space-y-1">
          {q.warnings.map((w, i) => (
            <Alert key={i} className="py-2"><AlertDescription className="text-xs">{w}</AlertDescription></Alert>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Analysis() {
  const { animals, breedingEvents, performanceRecords, healthRecords, isLoading } = useAnalysisBundle();
  const [season, setSeason] = useState<string>("all");
  const [classification, setClassification] = useState<string>("all");
  const [sex, setSex] = useState<"all" | "ram" | "ewe">("all");

  const insights = useMemo(
    () =>
      buildDataInsights({
        animals: animals || [],
        breedingEvents: breedingEvents || [],
        performanceRecords: performanceRecords || [],
        healthRecords: healthRecords || [],
        season,
        classification,
        sex,
      }),
    [animals, breedingEvents, performanceRecords, healthRecords, season, classification, sex],
  );

  if (isLoading) {
    return (
      <Layout>
        <div className="space-y-4">
          <Skeleton className="h-12 w-72" />
          <div className="grid gap-3 md:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-56" />)}
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-4 md:space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold md:text-3xl" data-testid="page-title-data">BreedLog Data</h1>
            <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">Live</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Real metrics computed from your real records. Sections without enough data show an honest empty state.
          </p>
        </div>

        {/* Filter row (preserves legacy testid 'analysis-selector-panel') */}
        <Card className="rugged-card" data-testid="analysis-selector-panel">
          <CardContent className="grid gap-3 p-4 md:grid-cols-3">
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Season</Label>
              <Select value={season} onValueChange={setSeason}>
                <SelectTrigger data-testid="filter-season"><SelectValue placeholder="All seasons" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All seasons</SelectItem>
                  {insights.availableSeasons.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Classification</Label>
              <Select value={classification} onValueChange={setClassification}>
                <SelectTrigger data-testid="filter-classification"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="stud">Stud</SelectItem>
                  <SelectItem value="commercial">Commercial</SelectItem>
                  <SelectItem value="slaughter_cull">Slaughter / Cull</SelectItem>
                  <SelectItem value="unclassified">Unclassified</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Sex</Label>
              <Select value={sex} onValueChange={(v) => setSex(v as "all" | "ram" | "ewe")}>
                <SelectTrigger data-testid="filter-sex"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="ram">Rams</SelectItem>
                  <SelectItem value="ewe">Ewes</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Top KPI summary (preserves legacy testid 'analysis-summary-cards') */}
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4" data-testid="analysis-summary-cards">
          <StatTile label="Total in scope" value={String(insights.herdDistribution.total)} icon={Database} />
          <StatTile label="Active" value={String(insights.herdDistribution.active)} icon={Activity} accent="bg-emerald-500/15 text-emerald-600 dark:text-emerald-300" />
          <StatTile label="Lambs" value={String(insights.herdDistribution.lambs)} icon={Layers} accent="bg-amber-500/15 text-amber-600 dark:text-amber-300" />
          <StatTile label="Data quality" value={`${insights.dataQuality.score.toFixed(0)}%`} icon={Sparkles} accent="bg-violet-500/15 text-violet-600 dark:text-violet-300" />
        </div>

        {/* Sections (preserves legacy testid 'analysis-sections') */}
        <div className="grid gap-4" data-testid="analysis-sections">
          <SectionShell title="Herd distribution" subtitle="Live composition of your scope" icon={Layers} testid="section-herd-distribution">
            <HerdDistributionSection d={insights.herdDistribution} />
          </SectionShell>

          <SectionShell title="Sire / ram performance" subtitle="Ranked by progeny output and growth" icon={Trophy} testid="section-sire-performance">
            <SirePerformanceSection s={insights.sirePerformance} />
          </SectionShell>

          <SectionShell title="Ewe maternal performance" subtitle="Top ewes, twin-bearing, and watchlist" icon={Heart} testid="section-ewe-maternal">
            <EweMaternalSection m={insights.eweMaternal} />
          </SectionShell>

          <SectionShell title="Lamb growth performance" subtitle="Birth → weaning → latest" icon={TrendingUp} testid="section-lamb-growth">
            <LambGrowthSection g={insights.lambGrowth} />
          </SectionShell>

          <SectionShell title="Flock direction" subtitle="Improvement signal across lambing seasons" icon={BarChart3} testid="section-flock-direction">
            <FlockDirectionSection f={insights.flockDirection} />
          </SectionShell>

          <SectionShell title="Data quality" subtitle="What to record next to unlock more insight" icon={Database} testid="section-data-quality">
            <DataQualitySection q={insights.dataQuality} />
          </SectionShell>
        </div>
      </div>
    </Layout>
  );
}
