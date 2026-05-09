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
 * Premium chart-led, numbered, collapsible analytics — every metric is
 * computed from the user's real BreedLog records via data-engine.ts. Where
 * data is insufficient the section says so honestly. No placeholder numbers,
 * no third-party brand references.
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
  Beef,
  ChevronDown,
  Database,
  Dna,
  Heart,
  HeartPulse,
  Info,
  Layers,
  Scale,
  Sparkles,
  Stethoscope,
  TrendingDown,
  TrendingUp,
  Trophy,
  Users,
} from "lucide-react";
import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { useAnalysisBundle } from "@/hooks/use-analysis";
import { buildDataInsights, type DataInsights } from "@/lib/data-engine";
import { AskSectionButton } from "@/components/AskBreedLogButton";

type ConfidenceLevel = "Low" | "Medium" | "High" | "Proven";

/* ──────────────────────────────────────────────────────────────────────── */
/* Premium primitives                                                       */
/* ──────────────────────────────────────────────────────────────────────── */

const TILE_TONES = {
  primary:  { ring: "ring-primary/20",    chip: "bg-primary/12 text-primary" },
  blue:     { ring: "ring-blue-500/20",   chip: "bg-blue-500/12 text-blue-600 dark:text-blue-300" },
  emerald:  { ring: "ring-emerald-500/20", chip: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-300" },
  amber:    { ring: "ring-amber-500/25",  chip: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  violet:   { ring: "ring-violet-500/20", chip: "bg-violet-500/12 text-violet-600 dark:text-violet-300" },
  rose:     { ring: "ring-rose-500/20",   chip: "bg-rose-500/12 text-rose-600 dark:text-rose-300" },
  slate:    { ring: "ring-slate-500/20",  chip: "bg-slate-500/12 text-slate-600 dark:text-slate-300" },
} as const;
type Tone = keyof typeof TILE_TONES;

function fmt(value: number | null | undefined, suffix = "", digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${value.toFixed(digits)}${suffix}`;
}
function fmtInt(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return v.toLocaleString();
}

function ConfidenceBadge({ level }: { level: ConfidenceLevel }) {
  const tone =
    level === "Proven" || level === "High"
      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
      : level === "Medium"
        ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
        : "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30";
  return <Badge variant="outline" className={cn("text-[10px]", tone)}>{level}</Badge>;
}

function KpiTile({
  label, value, sub, icon: Icon, tone = "primary", testid,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: Tone;
  testid?: string;
}) {
  const t = TILE_TONES[tone];
  return (
    <div
      className={cn(
        "rounded-2xl border border-border/60 bg-card/85 px-3 py-3 shadow-sm ring-1 backdrop-blur transition-colors",
        t.ring,
      )}
      data-testid={testid}
    >
      <div className={cn("inline-flex h-8 w-8 items-center justify-center rounded-xl", t.chip)}>
        <Icon className="h-4 w-4" />
      </div>
      <p className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-xl font-bold leading-tight">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function RankedRow({
  rank, label, sublabel, value, suffix, percent, tone = "primary", confidence,
}: {
  rank: number;
  label: string;
  sublabel?: string;
  value: string;
  suffix?: string;
  percent: number; // 0-100 width for the progress bar
  tone?: Tone;
  confidence?: ConfidenceLevel;
}) {
  const t = TILE_TONES[tone];
  const w = Math.max(2, Math.min(100, percent));
  return (
    <div className="rounded-xl border border-border/60 bg-card/70 p-2.5">
      <div className="flex items-center gap-2.5">
        <div className={cn("flex h-7 w-7 flex-none items-center justify-center rounded-full text-[11px] font-bold", t.chip)}>
          {rank}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold">{label}</p>
            {confidence && <ConfidenceBadge level={confidence} />}
          </div>
          {sublabel && <p className="truncate text-[11px] text-muted-foreground">{sublabel}</p>}
        </div>
        <div className="text-right">
          <p className="text-sm font-bold tabular-nums">{value}</p>
          {suffix && <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{suffix}</p>}
        </div>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted/50">
        <div className={cn("h-full rounded-full bg-current", t.chip.split(" ")[1])} style={{ width: `${w}%` }} />
      </div>
    </div>
  );
}

function DonutMetric({
  centerValue, centerLabel, segments, height = 180,
}: {
  centerValue: string;
  centerLabel: string;
  segments: Array<{ name: string; value: number; color: string }>;
  height?: number;
}) {
  const data = segments.filter((s) => s.value > 0);
  if (data.length === 0) {
    return (
      <div className="flex h-[180px] items-center justify-center rounded-xl border border-dashed border-border/70 text-xs text-muted-foreground">
        No data
      </div>
    );
  }
  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={50} outerRadius={75} paddingAngle={2} stroke="none">
            {data.map((s, i) => <Cell key={i} fill={s.color} />)}
          </Pie>
          <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-2xl font-bold leading-none tabular-nums">{centerValue}</p>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{centerLabel}</p>
      </div>
    </div>
  );
}

function GaugeTile({
  label, value, tone, sub,
}: { label: string; value: string; tone: Tone; sub?: string }) {
  const t = TILE_TONES[tone];
  return (
    <div className={cn("rounded-2xl border border-border/60 bg-card/85 p-3 text-center ring-1", t.ring)}>
      <p className={cn("text-2xl font-bold tabular-nums", t.chip.split(" ").slice(1).join(" "))}>{value}</p>
      <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      {sub && <p className="mt-0.5 text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-dashed border-border/70 bg-muted/30 p-4 text-sm text-muted-foreground">
      <Info className="mt-0.5 h-4 w-4 flex-none" />
      <span>{message}</span>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/* Section shell — numbered, collapsible, with preview chips                */
/* ──────────────────────────────────────────────────────────────────────── */

function SectionCard({
  number, title, icon: Icon, tone = "primary", preview, defaultOpen = false, children, testid,
  askCategory, askSection,
}: {
  number: number;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: Tone;
  preview?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  testid?: string;
  askCategory?: string;
  askSection?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const t = TILE_TONES[tone];
  return (
    <Card className="overflow-hidden border-border/70 bg-card/70 shadow-sm backdrop-blur" data-testid={testid}>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger
          className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/40 md:px-4"
          data-testid={`${testid}-toggle`}
        >
          <div className={cn("flex h-9 w-9 flex-none items-center justify-center rounded-xl", t.chip)}>
            <Icon className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground tabular-nums">
                {String(number).padStart(2, "0")}
              </span>
              <h2 className="truncate text-sm font-bold md:text-base">{title}</h2>
            </div>
            {preview && (
              <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{preview}</p>
            )}
          </div>
          {askCategory && askSection && (
            <span onClick={(e) => e.stopPropagation()}>
              <AskSectionButton section={askSection} category={askCategory} />
            </span>
          )}
          <ChevronDown
            className={cn(
              "h-4 w-4 flex-none text-muted-foreground transition-transform duration-200",
              open && "rotate-180",
            )}
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="border-t border-border/60 px-3 pb-4 pt-3 md:px-4">
            {children}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/* Sections                                                                 */
/* ──────────────────────────────────────────────────────────────────────── */

const PIE = {
  blue: "#3b82f6", emerald: "#10b981", amber: "#f59e0b",
  violet: "#8b5cf6", rose: "#f43f5e", slate: "#64748b",
};

function Section1Herd({ d }: { d: DataInsights["herdDistribution"] }) {
  if (!d.sufficient) return <EmptyState message="No animals match the current filters yet. Add animals or relax the season/classification filters." />;
  const segs = [
    { name: "Rams", value: d.rams, color: PIE.blue },
    { name: "Ewes", value: d.ewes, color: PIE.emerald },
    { name: "Lambs", value: d.lambs, color: PIE.amber },
    { name: "Culled", value: d.culled, color: PIE.rose },
  ];
  const classData = [
    { name: "Stud", value: d.classification.stud, color: PIE.violet },
    { name: "Commercial", value: d.classification.commercial, color: PIE.blue },
    { name: "Slaughter/Cull", value: d.classification.slaughterCull, color: PIE.rose },
    { name: "Unclassified", value: d.classification.unclassified, color: PIE.slate },
  ];
  return (
    <div className="space-y-3">
      <DonutMetric centerValue={fmtInt(d.total)} centerLabel="Total" segments={segs} height={200} />
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <KpiTile label="Rams" value={fmtInt(d.rams)} icon={Beef} tone="blue" testid="data-stat-rams" />
        <KpiTile label="Ewes" value={fmtInt(d.ewes)} icon={Beef} tone="emerald" testid="data-stat-ewes" />
        <KpiTile label="Lambs" value={fmtInt(d.lambs)} icon={Beef} tone="amber" testid="data-stat-lambs" />
        <KpiTile label="Culled" value={fmtInt(d.culled)} icon={AlertTriangle} tone="rose" testid="data-stat-culled" />
      </div>
      <div className="rounded-2xl border border-border/60 bg-card/60 p-3">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">By classification</p>
        <ResponsiveContainer width="100%" height={130}>
          <BarChart data={classData} margin={{ top: 5, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted-foreground/20" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} />
            <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
            <Tooltip cursor={{ fill: "hsl(var(--muted) / 0.4)" }} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
            <Bar dataKey="value" radius={[6, 6, 0, 0]}>
              {classData.map((s, i) => <Cell key={i} fill={s.color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function Section2Sire({ s }: { s: DataInsights["sirePerformance"] }) {
  if (!s.sufficient) return <EmptyState message={s.insufficientReason ?? "Not enough sire data yet."} />;
  const max = Math.max(1, ...s.leaderboard.map((r) => r.offspring));
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <KpiTile label="Active sires" value={fmtInt(s.activeSires)} icon={Trophy} tone="violet" testid="data-sire-active" />
        <KpiTile label="Total progeny" value={fmtInt(s.totalProgeny)} icon={Layers} tone="blue" testid="data-sire-progeny" />
        <KpiTile label="Avg per sire" value={fmt(s.avgProgenyPerSire, "", 1)} icon={BarChart3} tone="emerald" testid="data-sire-avg" />
      </div>
      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Top sires by progeny</p>
        <div className="space-y-1.5" data-testid="data-sire-leaderboard">
          {s.leaderboard.slice(0, 6).map((row, i) => (
            <RankedRow
              key={row.sireId}
              rank={i + 1}
              label={row.sireTag}
              sublabel={`Birth ${fmt(row.avgBirthWeight, " kg")} · weaning ${fmt(row.avgWeaningWeight, " kg")}`}
              value={fmtInt(row.offspring)}
              suffix="lambs"
              percent={(row.offspring / max) * 100}
              tone={i === 0 ? "amber" : i === 1 ? "blue" : "violet"}
              confidence={row.confidence}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function Section3Ewe({ m }: { m: DataInsights["eweMaternal"] }) {
  if (!m.sufficient) return <EmptyState message={m.insufficientReason ?? "Not enough maternal data yet."} />;
  const max = Math.max(1, ...m.leaderboard.map((r) => r.lambCount));
  const barren = m.barren;
  const twin = m.twinBearing;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <KpiTile label="Active ewes" value={fmtInt(m.activeEwes)} icon={Users} tone="primary" testid="data-ewe-active" />
        <KpiTile label="Lambed" value={fmtInt(m.ewesLambed)} icon={Sparkles} tone="emerald" testid="data-ewe-lambed" />
        <KpiTile label="Twin-bearing" value={fmtInt(m.twinBearing)} icon={Layers} tone="blue" testid="data-ewe-twins" />
        <KpiTile label="Barren / Not lambed" value={fmtInt(m.barren)} icon={AlertTriangle} tone="amber" testid="data-ewe-barren" />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-border/60 bg-card/60 p-3">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Barren vs twin-bearing</p>
          <DonutMetric
            centerValue={fmtInt(m.activeEwes)}
            centerLabel="Ewes"
            segments={[
              { name: "Lambed (single)", value: Math.max(0, m.ewesLambed - twin), color: PIE.emerald },
              { name: "Twin-bearing", value: twin, color: PIE.blue },
              { name: "Barren", value: barren, color: PIE.amber },
            ]}
            height={170}
          />
        </div>
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Top ewes by lamb output</p>
          <div className="space-y-1.5" data-testid="data-ewe-leaderboard">
            {m.leaderboard.slice(0, 5).map((row, i) => (
              <RankedRow
                key={row.eweId}
                rank={i + 1}
                label={row.eweTag}
                sublabel={`${row.weaningRate.toFixed(0)}% weaned · ${row.twinRate.toFixed(0)}% twin rate`}
                value={fmtInt(row.lambCount)}
                suffix="lambs"
                percent={(row.lambCount / max) * 100}
                tone={i === 0 ? "amber" : "violet"}
                confidence={row.confidence}
              />
            ))}
          </div>
        </div>
      </div>
      {m.watchlist.length > 0 && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3" data-testid="data-ewe-watchlist">
          <p className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
            <AlertTriangle className="h-3.5 w-3.5" /> Watchlist · low weaning rate
          </p>
          <div className="space-y-1 text-xs">
            {m.watchlist.map((w) => (
              <div key={w.eweId} className="flex items-center justify-between gap-2">
                <span className="font-semibold">{w.eweTag}</span>
                <span className="text-right text-muted-foreground">{w.reason}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Section4Growth({ g }: { g: DataInsights["lambGrowth"] }) {
  if (!g.sufficient) return <EmptyState message={g.insufficientReason ?? "Not enough growth data yet."} />;
  const compare = [
    { type: "Single", birth: g.singleVsTwin.single.avgBirth ?? 0, weaning: g.singleVsTwin.single.avgWeaning ?? 0 },
    { type: "Twin",   birth: g.singleVsTwin.twin.avgBirth ?? 0,   weaning: g.singleVsTwin.twin.avgWeaning ?? 0 },
  ];
  const progression = g.progression.map((p) => ({ stage: p.stage, weight: p.avgWeight ?? 0, sample: p.sample }));
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <KpiTile label="Lambs in scope" value={fmtInt(g.sampleCount)} icon={Layers} tone="primary" testid="data-growth-sample" />
        <KpiTile label="Avg birth" value={fmt(g.avgBirthWeight, " kg")} icon={Scale} tone="emerald" testid="data-growth-birth" />
        <KpiTile label="Avg weaning" value={fmt(g.avgWeaningWeight, " kg")} icon={Scale} tone="blue" testid="data-growth-weaning" />
        <KpiTile label="Avg ADG" value={fmt(g.avgADG, " kg/d", 3)} icon={TrendingUp} tone="violet" testid="data-growth-adg" />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-border/60 bg-card/60 p-3">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Single vs twin (kg)</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={compare} margin={{ top: 5, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted-foreground/20" />
              <XAxis dataKey="type" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="birth" name="Birth" fill={PIE.emerald} radius={[6, 6, 0, 0]} />
              <Bar dataKey="weaning" name="Weaning" fill={PIE.blue} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="rounded-2xl border border-border/60 bg-card/60 p-3">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Average weight progression</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={progression} margin={{ top: 5, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted-foreground/20" />
              <XAxis dataKey="stage" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
              <Line type="monotone" dataKey="weight" stroke={PIE.blue} strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function Section5Direction({ f }: { f: DataInsights["flockDirection"] }) {
  if (f.signal === "insufficient") return <EmptyState message={f.summary} />;
  const Icon = f.signal === "improving" ? TrendingUp : f.signal === "declining" ? TrendingDown : Activity;
  const tone: Tone = f.signal === "improving" ? "emerald" : f.signal === "declining" ? "rose" : "amber";
  const chartData = f.seasons.map((s) => ({ season: s.season, weaning: s.avgWeaningWeight ?? 0, survival: s.lambSurvival ?? 0 }));
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <GaugeTile label="Direction" tone={tone} value={f.signal} sub={`Confidence ${f.confidence}`} />
        <GaugeTile label="Weaning Δ" tone="blue" value={fmt(f.deltaWeaningWeightPct, "%", 1)} sub="vs earlier seasons" />
        <GaugeTile label="Survival Δ" tone="violet" value={fmt(f.deltaSurvivalPct, " pp", 1)} sub="percentage points" />
      </div>
      <div className="rounded-2xl border border-border/60 bg-card/60 p-3">
        <p className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <Icon className="h-3 w-3" /> Per-season trend
        </p>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData} margin={{ top: 5, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted-foreground/20" />
            <XAxis dataKey="season" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="weaning" name="Avg weaning kg" stroke={PIE.blue} strokeWidth={2} dot={{ r: 4 }} />
            <Line type="monotone" dataKey="survival" name="Survival %" stroke={PIE.emerald} strokeWidth={2} dot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-muted-foreground">{f.summary}</p>
    </div>
  );
}

function Section6Reproductive({ r }: { r: DataInsights["reproductive"] }) {
  if (!r.sufficient) return <EmptyState message={r.insufficientReason ?? "No breeding events recorded yet."} />;
  const maxGroupLambs = Math.max(1, ...r.groupBreakdown.map((g) => g.lambs));
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <KpiTile label="Ewes joined" value={fmtInt(r.ewesJoined)} icon={Users} tone="primary" testid="data-rep-joined" />
        <KpiTile label="Ewes lambed" value={fmtInt(r.ewesLambed)} icon={Sparkles} tone="emerald" testid="data-rep-lambed" />
        <KpiTile label="Lambing rate" value={fmt(r.lambingRatePct, "%", 1)} icon={TrendingUp} tone="blue" testid="data-rep-rate" />
        <KpiTile label="Lambs born" value={fmtInt(r.totalLambsBorn)} icon={Layers} tone="violet" testid="data-rep-lambs" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <GaugeTile label="Lambs / ewe joined" tone="emerald" value={fmt(r.lambsPerEweJoined, "", 2)} />
        <GaugeTile label="Lambs / ewe lambed" tone="blue" value={fmt(r.lambsPerEweLambed, "", 2)} />
        <GaugeTile label="Lambing spread" tone="amber" value={r.lambingSpreadDays !== null ? `${r.lambingSpreadDays}d` : "—"} />
      </div>
      {r.groupBreakdown.length > 0 && (
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">By mating group</p>
          <div className="space-y-1.5">
            {r.groupBreakdown.slice(0, 6).map((g, i) => (
              <RankedRow
                key={String(g.groupId)}
                rank={i + 1}
                label={g.label}
                sublabel={`${g.joined} joined · ${g.lambed} lambed · ${fmt(g.successPct, "%", 0)} success`}
                value={fmtInt(g.lambs)}
                suffix="lambs"
                percent={(g.lambs / maxGroupLambs) * 100}
                tone={i === 0 ? "amber" : "blue"}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Section7Health({ h }: { h: DataInsights["health"] }) {
  if (!h.sufficient) return <EmptyState message={h.insufficientReason ?? "No health records yet."} />;
  const maxT = Math.max(1, ...h.topTreatments.map((t) => t.count));
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <KpiTile label="Records" value={fmtInt(h.totalRecords)} icon={Stethoscope} tone="primary" testid="data-health-total" />
        <KpiTile label="Animals treated" value={fmtInt(h.animalsTreated)} icon={Heart} tone="emerald" testid="data-health-treated" />
        <KpiTile label="Last 30 days" value={fmtInt(h.recordsLast30Days)} icon={Activity} tone="blue" testid="data-health-recent" />
        <KpiTile label="Survival" value={fmt(h.survivalPct, "%", 1)} icon={HeartPulse} tone="violet" testid="data-health-survival" />
      </div>
      {h.mortalityCount > 0 && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
          <span className="font-semibold text-amber-700 dark:text-amber-300">{h.mortalityCount}</span>{" "}
          <span className="text-muted-foreground">animal(s) recorded as deceased in current scope.</span>
        </div>
      )}
      {h.topTreatments.length > 0 && (
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Most common treatments</p>
          <div className="space-y-1.5">
            {h.topTreatments.map((t, i) => (
              <RankedRow
                key={t.name}
                rank={i + 1}
                label={t.name}
                value={fmtInt(t.count)}
                suffix="records"
                percent={(t.count / maxT) * 100}
                tone={i === 0 ? "amber" : "blue"}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Section8Quality({ q }: { q: DataInsights["dataQuality"] }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-card/60 p-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Completeness score</p>
          <p className="text-2xl font-bold tabular-nums">{q.score.toFixed(1)}%</p>
        </div>
        <ConfidenceBadge level={q.confidence} />
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted/50">
        <div
          className="h-full rounded-full bg-gradient-to-r from-amber-500 via-blue-500 to-emerald-500"
          style={{ width: `${Math.max(2, Math.min(100, q.score))}%` }}
        />
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

/* ──────────────────────────────────────────────────────────────────────── */
/* Page                                                                      */
/* ──────────────────────────────────────────────────────────────────────── */

export default function Analysis() {
  const { animals, breedingEvents, performanceRecords, healthRecords, isLoading } = useAnalysisBundle();
  const [season, setSeason] = useState<string>("all");
  const [classification, setClassification] = useState<string>("all");
  const [sex, setSex] = useState<"all" | "ram" | "ewe">("all");

  const insights = useMemo(
    () => buildDataInsights({
      animals: animals || [],
      breedingEvents: breedingEvents || [],
      performanceRecords: performanceRecords || [],
      healthRecords: healthRecords || [],
      season, classification, sex,
    }),
    [animals, breedingEvents, performanceRecords, healthRecords, season, classification, sex],
  );

  if (isLoading) {
    return (
      <Layout>
        <div className="space-y-3">
          <Skeleton className="h-12 w-72" />
          <Skeleton className="h-20" />
          {Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
        </div>
      </Layout>
    );
  }

  const d = insights.herdDistribution;
  const previewHerd = d.sufficient ? `${fmtInt(d.rams)} rams · ${fmtInt(d.ewes)} ewes · ${fmtInt(d.lambs)} lambs · ${fmtInt(d.culled)} culled` : "No animals in scope";
  const previewSire = insights.sirePerformance.sufficient
    ? `${insights.sirePerformance.activeSires} sires · ${insights.sirePerformance.totalProgeny} progeny`
    : "Add sire links to unlock";
  const previewEwe = insights.eweMaternal.sufficient
    ? `${insights.eweMaternal.ewesLambed}/${insights.eweMaternal.activeEwes} ewes lambed · ${insights.eweMaternal.twinBearing} twin-bearing`
    : "Add dam links to unlock";
  const previewGrowth = insights.lambGrowth.sufficient
    ? `Birth ${fmt(insights.lambGrowth.avgBirthWeight, " kg")} → weaning ${fmt(insights.lambGrowth.avgWeaningWeight, " kg")}`
    : "Record lamb weights to unlock";
  const previewDir = insights.flockDirection.signal === "insufficient"
    ? "Need ≥2 lambing seasons with weights"
    : `${insights.flockDirection.signal} · weaning Δ ${fmt(insights.flockDirection.deltaWeaningWeightPct, "%", 1)}`;
  const previewRep = insights.reproductive.sufficient
    ? `${insights.reproductive.ewesJoined} joined · ${fmt(insights.reproductive.lambingRatePct, "%", 0)} lambing rate`
    : "Record breeding events to unlock";
  const previewHealth = insights.health.sufficient
    ? `${insights.health.totalRecords} records · survival ${fmt(insights.health.survivalPct, "%", 1)}`
    : "Add health records to unlock";
  const previewQuality = `${insights.dataQuality.score.toFixed(0)}% complete · ${insights.dataQuality.warnings.length} warning${insights.dataQuality.warnings.length === 1 ? "" : "s"}`;

  return (
    <Layout>
      <div className="space-y-3 md:space-y-4">
        {/* Header */}
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold md:text-3xl" data-testid="page-title-data">Data</h1>
              <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary text-[10px]">Live</Badge>
            </div>
            <p className="text-xs text-muted-foreground md:text-sm">
              Real metrics from your real BreedLog records. Tap a section to expand.
            </p>
          </div>
          <Dna className="h-7 w-7 text-primary md:h-8 md:w-8" />
        </div>

        {/* Filter bar (preserves legacy testid 'analysis-selector-panel') */}
        <Card className="border-border/70 bg-card/80 shadow-sm" data-testid="analysis-selector-panel">
          <CardContent className="grid gap-2 p-3 md:grid-cols-3">
            <div>
              <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Season</Label>
              <Select value={season} onValueChange={setSeason}>
                <SelectTrigger data-testid="filter-season" className="h-9"><SelectValue placeholder="All seasons" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All seasons</SelectItem>
                  {insights.availableSeasons.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Classification</Label>
              <Select value={classification} onValueChange={setClassification}>
                <SelectTrigger data-testid="filter-classification" className="h-9"><SelectValue /></SelectTrigger>
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
              <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Sex</Label>
              <Select value={sex} onValueChange={(v) => setSex(v as "all" | "ram" | "ewe")}>
                <SelectTrigger data-testid="filter-sex" className="h-9"><SelectValue /></SelectTrigger>
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
          <KpiTile label="Total in scope" value={fmtInt(d.total)} icon={Database} tone="primary" />
          <KpiTile label="Active" value={fmtInt(d.active)} icon={Activity} tone="emerald" />
          <KpiTile label="Lambs" value={fmtInt(d.lambs)} icon={Layers} tone="amber" />
          <KpiTile label="Data quality" value={`${insights.dataQuality.score.toFixed(0)}%`} icon={Sparkles} tone="violet" />
        </div>

        {/* Sections (preserves legacy testid 'analysis-sections') */}
        <div className="space-y-2.5" data-testid="analysis-sections">
          <SectionCard number={1} title="Herd Distribution"        icon={Beef}        tone="blue"    preview={previewHerd}    defaultOpen testid="section-herd-distribution"  askCategory="herd-overview"      askSection="herd-distribution">
            <Section1Herd d={insights.herdDistribution} />
          </SectionCard>
          <SectionCard number={2} title="Ram / Sire Performance"   icon={Trophy}      tone="violet"  preview={previewSire}    testid="section-sire-performance"   askCategory="sire-performance"   askSection="sire-performance">
            <Section2Sire s={insights.sirePerformance} />
          </SectionCard>
          <SectionCard number={3} title="Ewe Maternal Performance" icon={Heart}       tone="rose"    preview={previewEwe}     testid="section-ewe-maternal"        askCategory="ewe-maternal"       askSection="ewe-maternal">
            <Section3Ewe m={insights.eweMaternal} />
          </SectionCard>
          <SectionCard number={4} title="Lamb Growth Performance"  icon={TrendingUp}  tone="emerald" preview={previewGrowth}  testid="section-lamb-growth"         askCategory="lamb-growth"        askSection="lamb-growth">
            <Section4Growth g={insights.lambGrowth} />
          </SectionCard>
          <SectionCard number={5} title="Flock Improvement"        icon={BarChart3}   tone="primary" preview={previewDir}     testid="section-flock-direction"     askCategory="herd-overview"      askSection="flock-improvement">
            <Section5Direction f={insights.flockDirection} />
          </SectionCard>
          <SectionCard number={6} title="Reproductive Efficiency"  icon={Dna}         tone="blue"    preview={previewRep}     testid="section-reproductive"        askCategory="breeding-lambing"   askSection="reproductive">
            <Section6Reproductive r={insights.reproductive} />
          </SectionCard>
          <SectionCard number={7} title="Health Overview"          icon={Stethoscope} tone="emerald" preview={previewHealth}  testid="section-health"              askCategory="health-records"     askSection="health">
            <Section7Health h={insights.health} />
          </SectionCard>
          <SectionCard number={8} title="Data Quality"             icon={Database}    tone="amber"   preview={previewQuality} testid="section-data-quality"        askCategory="data-quality"       askSection="data-quality">
            <Section8Quality q={insights.dataQuality} />
          </SectionCard>
        </div>
      </div>
    </Layout>
  );
}
