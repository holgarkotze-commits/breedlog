import { useMemo, useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAnalysisBundle } from "@/hooks/use-analysis";
import { buildAdvancedAnalysisReport, type AnalysisFilters } from "@/lib/analysis-engine";

function ConfidenceBadge({ level }: { level: "Low" | "Medium" | "High" | "Proven" }) {
  const tone = level === "High" || level === "Proven" ? "bg-emerald-100 text-emerald-700" : level === "Medium" ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700";
  return <Badge className={tone}>{level}</Badge>;
}

export default function Analysis() {
  const { bundle, animals, breedingEvents, performanceRecords, healthRecords, isLoading } = useAnalysisBundle();
  const [filters, setFilters] = useState<AnalysisFilters>({
    scope: "total_herd",
    sex: "all",
    status: "all",
    classification: "all",
    familyLine: "all",
    birthType: "all",
    minAgeDays: null,
    maxAgeDays: null,
  });

  const report = useMemo(() => {
    return buildAdvancedAnalysisReport(
      { animals, breedingEvents, performanceRecords, healthRecords },
      filters,
    );
  }, [animals, breedingEvents, performanceRecords, healthRecords, filters]);

  const sireOptions = animals.filter((a) => a.sex === "ram");
  const familyLineOptions = [...new Set(animals.map((a) => a.managementGroup).filter(Boolean))] as string[];

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

  return (
    <Layout>
      <div className="space-y-4 md:space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-bold">BreedLog Analysis</h1>
          <p className="text-sm text-muted-foreground">Data-driven insights from your real herd records.</p>
        </div>

        <Card className="rugged-card" data-testid="analysis-selector-panel">
          <CardHeader><CardTitle>Analysis Selector</CardTitle></CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-4">
            <div>
              <Label>Scope</Label>
              <Select value={filters.scope} onValueChange={(v: any) => setFilters((p) => ({ ...p, scope: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="total_herd">Total Herd</SelectItem>
                  <SelectItem value="individual">Individual Animal</SelectItem>
                  <SelectItem value="offspring_of_sire">Offspring of Sire</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Sex</Label>
              <Select value={filters.sex || "all"} onValueChange={(v: any) => setFilters((p) => ({ ...p, sex: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="ram">Rams</SelectItem>
                  <SelectItem value="ewe">Ewes</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={filters.status || "all"} onValueChange={(v) => setFilters((p) => ({ ...p, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="sold">Sold</SelectItem>
                  <SelectItem value="dead">Dead</SelectItem>
                  <SelectItem value="culled">Culled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Classification</Label>
              <Select value={filters.classification || "all"} onValueChange={(v) => setFilters((p) => ({ ...p, classification: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="stud">Stud</SelectItem>
                  <SelectItem value="commercial">Commercial</SelectItem>
                  <SelectItem value="unclassified">Unclassified</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Sire</Label>
              <Select value={String(filters.sireId || "all")} onValueChange={(v) => setFilters((p) => ({ ...p, sireId: v === "all" ? null : Number(v) }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {sireOptions.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.tagId}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Family Line</Label>
              <Select value={filters.familyLine || "all"} onValueChange={(v) => setFilters((p) => ({ ...p, familyLine: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {familyLineOptions.map((line) => <SelectItem key={line} value={line}>{line}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Birth Type</Label>
              <Select value={filters.birthType || "all"} onValueChange={(v) => setFilters((p) => ({ ...p, birthType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="single">Single</SelectItem>
                  <SelectItem value="twin">Twin</SelectItem>
                  <SelectItem value="triplet">Triplet</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Min age (days)</Label>
                <Input type="number" value={filters.minAgeDays ?? ""} onChange={(e) => setFilters((p) => ({ ...p, minAgeDays: e.target.value ? Number(e.target.value) : null }))} />
              </div>
              <div>
                <Label>Max age (days)</Label>
                <Input type="number" value={filters.maxAgeDays ?? ""} onChange={(e) => setFilters((p) => ({ ...p, maxAgeDays: e.target.value ? Number(e.target.value) : null }))} />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="analysis-summary-cards">
          <Card className="rugged-card"><CardContent className="p-3"><p className="text-xs text-muted-foreground">Selected</p><p className="text-2xl font-bold">{report.filteredCount}</p></CardContent></Card>
          <Card className="rugged-card"><CardContent className="p-3"><p className="text-xs text-muted-foreground">Rams</p><p className="text-2xl font-bold">{report.herdComposition.rams}</p></CardContent></Card>
          <Card className="rugged-card"><CardContent className="p-3"><p className="text-xs text-muted-foreground">Ewes</p><p className="text-2xl font-bold">{report.herdComposition.ewes}</p></CardContent></Card>
          <Card className="rugged-card"><CardContent className="p-3"><p className="text-xs text-muted-foreground">Lambs</p><p className="text-2xl font-bold">{report.herdComposition.lambs}</p></CardContent></Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2" data-testid="analysis-sections">
          <Card className="rugged-card">
            <CardHeader><CardTitle>Data Completeness</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm">Completeness score: <strong>{report.dataCompleteness.score.toFixed(1)}%</strong></p>
                <ConfidenceBadge level={report.dataCompleteness.confidence} />
              </div>
              {report.dataCompleteness.warnings.length > 0 ? (
                <Alert><AlertDescription className="text-xs">{report.dataCompleteness.warnings[0]}</AlertDescription></Alert>
              ) : <p className="text-xs text-muted-foreground">No major completeness blockers in current selection.</p>}
            </CardContent>
          </Card>

          <Card className="rugged-card">
            <CardHeader><CardTitle>Birth Type Split</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {Object.entries(report.birthTypeSplit).length === 0 && <p className="text-xs text-muted-foreground">More data required: record birth type (single/twin/triplet).</p>}
              {Object.entries(report.birthTypeSplit).map(([key, value]) => (
                <div key={key} className="text-xs flex justify-between"><span>{key}</span><strong>{value}</strong></div>
              ))}
            </CardContent>
          </Card>

          <Card className="rugged-card">
            <CardHeader><CardTitle>Birth/Weaning Weight Comparison</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-xs">
              <p>Actual birth avg: <strong>{report.weights.actualBirthAvg ? `${report.weights.actualBirthAvg.toFixed(2)} kg` : "—"}</strong></p>
              <p>Estimated birth avg: <strong>{report.weights.estimatedBirthAvg ? `${report.weights.estimatedBirthAvg.toFixed(2)} kg` : "—"}</strong></p>
              <p>Actual weaning avg: <strong>{report.weights.actualWeaningAvg ? `${report.weights.actualWeaningAvg.toFixed(2)} kg` : "—"}</strong></p>
              <p>Estimated weaning avg: <strong>{report.weights.estimatedWeaningAvg ? `${report.weights.estimatedWeaningAvg.toFixed(2)} kg` : "—"}</strong></p>
            </CardContent>
          </Card>

          <Card className="rugged-card">
            <CardHeader><CardTitle>Sire Comparison</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-xs">
              {report.sireComparison.length === 0 && <p className="text-muted-foreground">More data required: add sire links and offspring records.</p>}
              {report.sireComparison.slice(0, 6).map((row) => (
                <div key={row.sireId} className="border-b border-border/50 pb-1">
                  <div className="flex justify-between"><strong>{row.sireTag}</strong><ConfidenceBadge level={row.confidence} /></div>
                  <div>Offspring: {row.offspring} • Birth avg: {row.avgBirthWeight?.toFixed(1) ?? "—"} • Weaning avg: {row.avgWeaningWeight?.toFixed(1) ?? "—"}</div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="rugged-card">
            <CardHeader><CardTitle>Maternal Performance Ranking</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-xs">
              {report.maternalRanking.length === 0 && <p className="text-muted-foreground">More data required: add dam links for lambs.</p>}
              {report.maternalRanking.slice(0, 6).map((row) => (
                <div key={row.eweId} className="flex justify-between"><span>{row.eweTag}</span><span>{row.lambCount} lambs • {row.weaningRate.toFixed(0)}% weaned</span></div>
              ))}
            </CardContent>
          </Card>

          <Card className="rugged-card">
            <CardHeader><CardTitle>Growth Ranking</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-xs">
              {report.growthRanking.length === 0 && <p className="text-muted-foreground">More data required: add birth + weaning weights and dates.</p>}
              {report.growthRanking.slice(0, 8).map((row) => (
                <div key={row.animalId} className="flex justify-between"><span>{row.tagId}</span><span>{row.metric.toFixed(3)} kg/day</span></div>
              ))}
            </CardContent>
          </Card>

          <Card className="rugged-card">
            <CardHeader><CardTitle>Family-line Comparison</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-xs">
              {report.familyLineComparison.length === 0 && <p className="text-muted-foreground">More data required: populate family-line values (currently uses management group).</p>}
              {report.familyLineComparison.slice(0, 8).map((row) => (
                <div key={row.familyLine} className="flex justify-between"><span>{row.familyLine}</span><span>{row.animals} animals • BW {row.avgBirthWeight?.toFixed(1) ?? "—"}</span></div>
              ))}
            </CardContent>
          </Card>

          <Card className="rugged-card">
            <CardHeader><CardTitle>Legacy Summary</CardTitle></CardHeader>
            <CardContent className="text-xs space-y-1">
              <p>Total Animals: <strong>{bundle.flockOverview.totalAnimals}</strong></p>
              <p>Data Completeness: <strong>{bundle.flockOverview.dataCompletenessScore.toFixed(1)}%</strong></p>
              <p>Lamb Survival: <strong>{bundle.flockOverview.lambSurvivalPercentage?.toFixed(1) ?? "—"}%</strong></p>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
