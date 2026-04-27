import { Layout } from "@/components/Layout";
import type { ComponentType, ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAnalysisBundle } from "@/hooks/use-analysis";
import { cn } from "@/lib/utils";
import { BarChart3, TrendingUp, ShieldAlert, Heart, Dna, Target, AlertTriangle, Database, Activity } from "lucide-react";

function ConfidenceBadge({ level }: { level: "Low" | "Medium" | "High" | "Proven" }) {
  const tone =
    level === "Proven"
      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
      : level === "High"
        ? "bg-blue-500/20 text-blue-300 border-blue-500/40"
        : level === "Medium"
          ? "bg-yellow-500/20 text-yellow-300 border-yellow-500/40"
          : "bg-red-500/20 text-red-300 border-red-500/40";
  return <Badge className={cn("text-[10px] uppercase", tone)}>{level}</Badge>;
}

function ModuleCard({
  title,
  icon: Icon,
  confidence,
  reason,
  warnings,
  children,
}: {
  title: string;
  icon: ComponentType<{ className?: string }>;
  confidence: "Low" | "Medium" | "High" | "Proven";
  reason: string;
  warnings?: string[];
  children: ReactNode;
}) {
  return (
    <Card className="rugged-card">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base md:text-lg flex items-center gap-2">
            <Icon className="w-4 h-4 text-primary" />
            {title}
          </CardTitle>
          <ConfidenceBadge level={confidence} />
        </div>
        <p className="text-xs text-muted-foreground">{reason}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {warnings && warnings.length > 0 && (
          <Alert>
            <AlertDescription className="text-xs">{warnings[0]}</AlertDescription>
          </Alert>
        )}
        {children}
      </CardContent>
    </Card>
  );
}

export default function Analysis() {
  const { bundle, isLoading } = useAnalysisBundle();

  if (isLoading) {
    return (
      <Layout>
        <div className="space-y-4">
          <Skeleton className="h-10 w-72" />
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 8 }).map((_, index) => (
              <Skeleton key={index} className="h-48" />
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  const { flockOverview, growth, eweMaternal, sirePerformance, survival, fertility, selection, pedigreeRisk, dataQuality } = bundle;

  return (
    <Layout>
      <div className="space-y-4 md:space-y-6 animate-in fade-in duration-500">
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-bold">BreedLog Performance Intelligence</h1>
          <p className="text-sm text-muted-foreground">
            Deterministic analysis from your own farm records. No external AI models are used.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="rugged-card"><CardContent className="p-3"><p className="text-xs text-muted-foreground">Total Animals</p><p className="text-2xl font-bold">{flockOverview.totalAnimals}</p></CardContent></Card>
          <Card className="rugged-card"><CardContent className="p-3"><p className="text-xs text-muted-foreground">Active Herd</p><p className="text-2xl font-bold">{flockOverview.activeAnimals}</p></CardContent></Card>
          <Card className="rugged-card"><CardContent className="p-3"><p className="text-xs text-muted-foreground">Lamb Survival</p><p className="text-2xl font-bold">{flockOverview.lambSurvivalPercentage ? `${flockOverview.lambSurvivalPercentage.toFixed(1)}%` : "—"}</p></CardContent></Card>
          <Card className="rugged-card"><CardContent className="p-3"><p className="text-xs text-muted-foreground">Data Completeness</p><p className="text-2xl font-bold">{flockOverview.dataCompletenessScore.toFixed(1)}%</p></CardContent></Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <ModuleCard title="Flock Overview" icon={BarChart3} confidence={flockOverview.confidence} reason={flockOverview.reasonSummary} warnings={flockOverview.missingDataWarnings}>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>Rams: <strong>{flockOverview.rams}</strong></div>
              <div>Ewes: <strong>{flockOverview.ewes}</strong></div>
              <div>Lambs: <strong>{flockOverview.lambs}</strong></div>
              <div>Stud: <strong>{flockOverview.studAnimals}</strong></div>
              <div>Commercial: <strong>{flockOverview.commercialAnimals}</strong></div>
              <div>Avg Weaning: <strong>{flockOverview.averages.weaningWeight ? `${flockOverview.averages.weaningWeight.toFixed(1)} kg` : "—"}</strong></div>
            </div>
          </ModuleCard>

          <ModuleCard title="Growth Analysis" icon={TrendingUp} confidence={growth.confidence} reason={growth.reasonSummary}>
            <p className="text-sm">Lambs analyzed: <strong>{growth.totalLambsAnalyzed}</strong></p>
            <p className="text-sm">Group ADG: <strong>{growth.groupAverageAdg ? `${growth.groupAverageAdg.toFixed(3)} kg/day` : "—"}</strong></p>
            <div className="space-y-1">
              {growth.bestGrowing.slice(0, 3).map((row) => (
                <div key={row.animalId} className="text-xs flex justify-between">
                  <span>{row.tagId}</span>
                  <span className="font-semibold">{row.score.toFixed(1)} ({row.confidence})</span>
                </div>
              ))}
            </div>
          </ModuleCard>

          <ModuleCard title="Ewe Maternal Performance" icon={Heart} confidence={eweMaternal.confidence} reason="Maternal index uses lambing consistency, survival, weaning outcomes, growth, and repeatability.">
            <div className="space-y-1">
              {eweMaternal.top.slice(0, 4).map((row) => (
                <div key={row.animalId} className="text-xs flex justify-between">
                  <span>{row.tagId}</span>
                  <span className="font-semibold">{row.score.toFixed(1)} ({row.confidence})</span>
                </div>
              ))}
            </div>
          </ModuleCard>

          <ModuleCard title="Ram / Sire Performance" icon={Dna} confidence={sirePerformance.confidence} reason="Sire impact uses progeny count, progeny survival, growth, consistency across dams, and confidence.">
            <div className="space-y-1">
              {sirePerformance.top.slice(0, 4).map((row) => (
                <div key={row.animalId} className="text-xs flex justify-between">
                  <span>{row.tagId}</span>
                  <span className="font-semibold">{row.score.toFixed(1)} ({row.confidence})</span>
                </div>
              ))}
            </div>
          </ModuleCard>

          <ModuleCard title="Lamb Survival" icon={Activity} confidence={survival.confidence} reason={survival.reasonSummary} warnings={survival.missingDataWarnings}>
            <p className="text-sm">Born alive: <strong>{survival.bornAlive}</strong></p>
            <p className="text-sm">Weaned: <strong>{survival.weaned}</strong></p>
            <p className="text-sm">Survival to weaning: <strong>{survival.survivalToWeaning ? `${survival.survivalToWeaning.toFixed(1)}%` : "—"}</strong></p>
          </ModuleCard>

          <ModuleCard title="Fertility & Reproduction" icon={Target} confidence={fertility.confidence} reason={fertility.reasonSummary} warnings={fertility.missingDataWarnings}>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>Ewes exposed: <strong>{fertility.ewesExposed}</strong></div>
              <div>Ewes lambed: <strong>{fertility.ewesLambed}</strong></div>
              <div>Lambs born / ewe lambed: <strong>{fertility.lambsBornPerEweLambed ? fertility.lambsBornPerEweLambed.toFixed(2) : "—"}</strong></div>
              <div>Lambs weaned / ewe lambed: <strong>{fertility.lambsWeanedPerEweLambed ? fertility.lambsWeanedPerEweLambed.toFixed(2) : "—"}</strong></div>
            </div>
          </ModuleCard>

          <ModuleCard title="Selection Candidates" icon={ShieldAlert} confidence={dataQuality.confidence} reason="Classification is rule-based from growth, maternal, sire, survival, and confidence metrics.">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>Stud keep: <strong>{selection.keepStud.length}</strong></div>
              <div>Commercial keep: <strong>{selection.keepCommercial.length}</strong></div>
              <div>Watchlist: <strong>{selection.watchlist.length}</strong></div>
              <div>Cull candidates: <strong>{selection.cullCandidates.length}</strong></div>
            </div>
          </ModuleCard>

          <ModuleCard title="Pedigree / Inbreeding Risk" icon={AlertTriangle} confidence={pedigreeRisk.highRisk.length > 0 ? "High" : pedigreeRisk.unknown.length > 0 ? "Medium" : "Low"} reason="Version 1 checks direct conflicts, same-parent conflicts, half-sibling/shared line warnings, and unknown parentage.">
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>High: <strong>{pedigreeRisk.highRisk.length}</strong></div>
              <div>Medium: <strong>{pedigreeRisk.mediumRisk.length}</strong></div>
              <div>Unknown: <strong>{pedigreeRisk.unknown.length}</strong></div>
            </div>
          </ModuleCard>

          <ModuleCard title="Data Quality" icon={Database} confidence={dataQuality.confidence} reason={dataQuality.reasonSummary} warnings={dataQuality.majorWarnings}>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>Missing birth date: <strong>{dataQuality.missingBirthDate}</strong></div>
              <div>Missing sire: <strong>{dataQuality.missingSire}</strong></div>
              <div>Missing dam: <strong>{dataQuality.missingDam}</strong></div>
              <div>Missing weaning weight: <strong>{dataQuality.lambsMissingWeaningWeight}</strong></div>
              <div>Ewes no lambing links: <strong>{dataQuality.ewesMissingLambingRecords}</strong></div>
              <div>Rams too few progeny: <strong>{dataQuality.ramsTooFewProgeny}</strong></div>
            </div>
          </ModuleCard>
        </div>
      </div>
    </Layout>
  );
}
