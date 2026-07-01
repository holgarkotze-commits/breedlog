import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Dna, Plus, Pencil, Trash2, Archive, AlertTriangle,
  CheckCircle2, HelpCircle, BookOpen, TrendingUp, GitFork, ChevronDown, ChevronUp, Zap
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Bloodline {
  id: number;
  name: string;
  type: string;
  originFarmOrBreeder?: string | null;
  selectedTraits?: string | null;
  knownWeaknesses?: string | null;
  notes?: string | null;
  status: string;
  evidenceStatus: string;
}

interface GeneticLine {
  id: number;
  lineName: string;
  lineGoal?: string | null;
  primaryTraits?: string | null;
  selectionNotes?: string | null;
  activeStatus: boolean;
}

interface Animal {
  id: number;
  tagId: string;
  name?: string | null;
  sex: string;
  sireId?: number | null;
  damId?: number | null;
  breed?: string | null;
}

interface MatingRiskResult {
  risk: string;
  level: string;
  explanation: string;
}

// ─── Constants ─────────────────────────────────────────────────────────────────
const BLOODLINE_TYPES = [
  { value: "sire_line", label: "Sire Line" },
  { value: "dam_line", label: "Dam Line" },
  { value: "external_line", label: "External Line" },
  { value: "foundation_line", label: "Foundation Line" },
  { value: "terminal_line", label: "Terminal Line" },
  { value: "maternal_line", label: "Maternal Line" },
  { value: "composite_line", label: "Composite Line" },
  { value: "unknown", label: "Unknown" },
];

const EVIDENCE_STATUS = [
  { value: "proven", label: "Proven" },
  { value: "promising", label: "Promising" },
  { value: "unproven", label: "Unproven" },
  { value: "unknown", label: "Unknown" },
];

const RISK_COLORS: Record<string, string> = {
  critical: "bg-destructive/15 border-destructive/50 text-destructive",
  high: "bg-orange-500/15 border-orange-500/50 text-orange-700 dark:text-orange-400",
  managed: "bg-amber-500/15 border-amber-500/50 text-amber-700 dark:text-amber-400",
  safe: "bg-emerald-500/15 border-emerald-500/50 text-emerald-700 dark:text-emerald-500",
  unknown: "bg-muted border-border text-muted-foreground",
};

const RISK_ICONS: Record<string, any> = {
  critical: AlertTriangle,
  high: AlertTriangle,
  managed: GitFork,
  safe: CheckCircle2,
  unknown: HelpCircle,
};

// ─── Bloodline Dialog ────────────────────────────────────────────────────────
function BloodlineDialog({ existing, onClose }: { existing?: Bloodline; onClose: () => void }) {
  const { toast } = useToast();
  const [name, setName] = useState(existing?.name ?? "");
  const [type, setType] = useState(existing?.type ?? "unknown");
  const [origin, setOrigin] = useState(existing?.originFarmOrBreeder ?? "");
  const [traits, setTraits] = useState(existing?.selectedTraits ?? "");
  const [weaknesses, setWeaknesses] = useState(existing?.knownWeaknesses ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [status, setStatus] = useState(existing?.status ?? "active");
  const [evidenceStatus, setEvidenceStatus] = useState(existing?.evidenceStatus ?? "unknown");

  const mutation = useMutation({
    mutationFn: async () => {
      const body = { name, type, originFarmOrBreeder: origin, selectedTraits: traits, knownWeaknesses: weaknesses, notes, status, evidenceStatus };
      if (existing) return apiRequest("PUT", `/api/genetics/bloodlines/${existing.id}`, body);
      return apiRequest("POST", "/api/genetics/bloodlines", body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/genetics/bloodlines"] });
      toast({ title: existing ? "Bloodline updated" : "Bloodline created" });
      onClose();
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4 py-2">
      <div className="space-y-3">
        <div className="space-y-1">
          <Label>Bloodline Name *</Label>
          <Input data-testid="input-bloodline-name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Baksteen" />
        </div>
        <div className="grid grid-cols-1 xs:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger data-testid="select-bloodline-type"><SelectValue /></SelectTrigger>
              <SelectContent>{BLOODLINE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Evidence Status</Label>
            <Select value={evidenceStatus} onValueChange={setEvidenceStatus}>
              <SelectTrigger data-testid="select-bloodline-evidence"><SelectValue /></SelectTrigger>
              <SelectContent>{EVIDENCE_STATUS.map(e => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1">
          <Label>Origin Farm / Breeder</Label>
          <Input data-testid="input-bloodline-origin" value={origin} onChange={e => setOrigin(e.target.value)} placeholder="Farm or breeder name" />
        </div>
        <div className="space-y-1">
          <Label>Selected Traits</Label>
          <Input data-testid="input-bloodline-traits" value={traits} onChange={e => setTraits(e.target.value)} placeholder="Growth, Hardiness, Fertility..." />
        </div>
        <div className="space-y-1">
          <Label>Known Weaknesses</Label>
          <Input data-testid="input-bloodline-weaknesses" value={weaknesses} onChange={e => setWeaknesses(e.target.value)} placeholder="Any recorded weaknesses" />
        </div>
        <div className="space-y-1">
          <Label>Notes</Label>
          <Textarea data-testid="input-bloodline-notes" value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Additional notes..." />
        </div>
        <div className="space-y-1">
          <Label>Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger data-testid="select-bloodline-status"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="under_observation">Under Observation</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex gap-2 justify-end pt-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button data-testid="button-save-bloodline" onClick={() => mutation.mutate()} disabled={!name.trim() || mutation.isPending}>
          {mutation.isPending ? "Saving..." : existing ? "Update" : "Create Bloodline"}
        </Button>
      </div>
    </div>
  );
}

// ─── Bloodlines Tab ───────────────────────────────────────────────────────────
function BloodlinesTab() {
  const { toast } = useToast();
  const [openDialog, setOpenDialog] = useState<"create" | number | null>(null);

  const { data: bloodlines = [], isLoading } = useQuery<Bloodline[]>({ queryKey: ["/api/genetics/bloodlines"] });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/genetics/bloodlines/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/genetics/bloodlines"] }); toast({ title: "Bloodline deleted" }); },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const evidenceBadge: Record<string, string> = {
    proven: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
    promising: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    unproven: "bg-muted text-muted-foreground",
    unknown: "bg-muted text-muted-foreground",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Named bloodline families in your flock. Evidence status reflects recorded performance — not opinion.</p>
        <Dialog open={openDialog === "create"} onOpenChange={open => setOpenDialog(open ? "create" : null)}>
          <DialogTrigger asChild>
            <Button size="sm" data-testid="button-add-bloodline"><Plus className="w-4 h-4 mr-1" /> Add Bloodline</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Bloodline</DialogTitle></DialogHeader>
            <BloodlineDialog onClose={() => setOpenDialog(null)} />
          </DialogContent>
        </Dialog>
      </div>

      {isLoading && <div className="text-sm text-muted-foreground py-4 text-center">Loading...</div>}

      {!isLoading && bloodlines.length === 0 && (
        <Card className="rugged-card border-dashed">
          <CardContent className="py-10 text-center space-y-2">
            <Dna className="w-10 h-10 mx-auto text-muted-foreground/40" />
            <p className="text-sm font-medium">No bloodlines recorded</p>
            <p className="text-xs text-muted-foreground">Add the bloodline families present in your flock. A bloodline's value must be proved by recorded performance.</p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3">
        {bloodlines.map(bl => (
          <Card key={bl.id} className="rugged-card" data-testid={`card-bloodline-${bl.id}`}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-base">{bl.name}</span>
                    <Badge variant="outline" className="text-[10px] uppercase">{bl.type.replace(/_/g, " ")}</Badge>
                    <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", evidenceBadge[bl.evidenceStatus] ?? "bg-muted")}>{bl.evidenceStatus}</span>
                    {bl.status !== "active" && <Badge variant="secondary" className="text-[10px]">{bl.status.replace(/_/g, " ")}</Badge>}
                  </div>
                  {bl.originFarmOrBreeder && <p className="text-xs text-muted-foreground mt-1">Origin: {bl.originFarmOrBreeder}</p>}
                  {bl.selectedTraits && <p className="text-xs mt-1"><span className="text-muted-foreground">Traits:</span> {bl.selectedTraits}</p>}
                  {bl.knownWeaknesses && <p className="text-xs mt-0.5 text-orange-600 dark:text-orange-400"><span className="text-muted-foreground">Weaknesses:</span> {bl.knownWeaknesses}</p>}
                  {bl.notes && <p className="text-xs text-muted-foreground mt-1 italic">{bl.notes}</p>}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Dialog open={openDialog === bl.id} onOpenChange={open => setOpenDialog(open ? bl.id : null)}>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`button-edit-bloodline-${bl.id}`}><Pencil className="w-3.5 h-3.5" /></Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Edit Bloodline</DialogTitle></DialogHeader>
                      <BloodlineDialog existing={bl} onClose={() => setOpenDialog(null)} />
                    </DialogContent>
                  </Dialog>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" data-testid={`button-delete-bloodline-${bl.id}`}
                    onClick={() => { if (confirm(`Delete bloodline "${bl.name}"?`)) deleteMutation.mutate(bl.id); }}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── Genetic Lines Tab ────────────────────────────────────────────────────────
function GeneticLineDialog({ existing, onClose }: { existing?: GeneticLine; onClose: () => void }) {
  const { toast } = useToast();
  const [lineName, setLineName] = useState(existing?.lineName ?? "");
  const [lineGoal, setLineGoal] = useState(existing?.lineGoal ?? "");
  const [primaryTraits, setPrimaryTraits] = useState(existing?.primaryTraits ?? "");
  const [selectionNotes, setSelectionNotes] = useState(existing?.selectionNotes ?? "");
  const [activeStatus, setActiveStatus] = useState(existing?.activeStatus !== false);

  const mutation = useMutation({
    mutationFn: async () => {
      const body = { lineName, lineGoal, primaryTraits, selectionNotes, activeStatus };
      if (existing) return apiRequest("PUT", `/api/genetics/lines/${existing.id}`, body);
      return apiRequest("POST", "/api/genetics/lines", body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/genetics/lines"] });
      toast({ title: existing ? "Genetic line updated" : "Genetic line created" });
      onClose();
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4 py-2">
      <div className="space-y-3">
        <div className="space-y-1">
          <Label>Line Name *</Label>
          <Input data-testid="input-line-name" value={lineName} onChange={e => setLineName(e.target.value)} placeholder="e.g. Maternal Ewe Line" />
        </div>
        <div className="space-y-1">
          <Label>Line Goal</Label>
          <Input data-testid="input-line-goal" value={lineGoal} onChange={e => setLineGoal(e.target.value)} placeholder="What are you selecting for?" />
        </div>
        <div className="space-y-1">
          <Label>Primary Traits Selected</Label>
          <Input data-testid="input-line-traits" value={primaryTraits} onChange={e => setPrimaryTraits(e.target.value)} placeholder="Mothering, Growth, Hardiness..." />
        </div>
        <div className="space-y-1">
          <Label>Selection Notes</Label>
          <Textarea data-testid="input-line-notes" value={selectionNotes} onChange={e => setSelectionNotes(e.target.value)} rows={2} placeholder="How are animals selected into this line?" />
        </div>
        <div className="flex items-center gap-2">
          <input type="checkbox" id="active-status" checked={activeStatus} onChange={e => setActiveStatus(e.target.checked)} className="rounded" />
          <Label htmlFor="active-status">Active line</Label>
        </div>
      </div>
      <div className="flex gap-2 justify-end pt-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button data-testid="button-save-line" onClick={() => mutation.mutate()} disabled={!lineName.trim() || mutation.isPending}>
          {mutation.isPending ? "Saving..." : existing ? "Update" : "Create Line"}
        </Button>
      </div>
    </div>
  );
}

function GeneticLinesTab() {
  const { toast } = useToast();
  const [openDialog, setOpenDialog] = useState<"create" | number | null>(null);

  const { data: lines = [], isLoading } = useQuery<GeneticLine[]>({ queryKey: ["/api/genetics/lines"] });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/genetics/lines/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/genetics/lines"] }); toast({ title: "Genetic line deleted" }); },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Managed selection directions within your flock — each line has a specific goal and trait focus.</p>
        <Dialog open={openDialog === "create"} onOpenChange={open => setOpenDialog(open ? "create" : null)}>
          <DialogTrigger asChild>
            <Button size="sm" data-testid="button-add-genetic-line"><Plus className="w-4 h-4 mr-1" /> Add Line</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Genetic Line</DialogTitle></DialogHeader>
            <GeneticLineDialog onClose={() => setOpenDialog(null)} />
          </DialogContent>
        </Dialog>
      </div>

      {isLoading && <div className="text-sm text-muted-foreground py-4 text-center">Loading...</div>}

      {!isLoading && lines.length === 0 && (
        <Card className="rugged-card border-dashed">
          <CardContent className="py-10 text-center space-y-2">
            <GitFork className="w-10 h-10 mx-auto text-muted-foreground/40" />
            <p className="text-sm font-medium">No genetic lines defined</p>
            <p className="text-xs text-muted-foreground">Define the selection directions in your flock — e.g. Maternal Ewe Line, Terminal Meat Line, Stud Replacement Line.</p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3">
        {lines.map(line => (
          <Card key={line.id} className="rugged-card" data-testid={`card-genetic-line-${line.id}`}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-base">{line.lineName}</span>
                    <Badge variant={line.activeStatus ? "default" : "secondary"} className="text-[10px]">{line.activeStatus ? "Active" : "Inactive"}</Badge>
                  </div>
                  {line.lineGoal && <p className="text-xs mt-1"><span className="text-muted-foreground">Goal:</span> {line.lineGoal}</p>}
                  {line.primaryTraits && <p className="text-xs mt-0.5"><span className="text-muted-foreground">Traits:</span> {line.primaryTraits}</p>}
                  {line.selectionNotes && <p className="text-xs text-muted-foreground mt-1 italic">{line.selectionNotes}</p>}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Dialog open={openDialog === line.id} onOpenChange={open => setOpenDialog(open ? line.id : null)}>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`button-edit-line-${line.id}`}><Pencil className="w-3.5 h-3.5" /></Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Edit Genetic Line</DialogTitle></DialogHeader>
                      <GeneticLineDialog existing={line} onClose={() => setOpenDialog(null)} />
                    </DialogContent>
                  </Dialog>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" data-testid={`button-delete-line-${line.id}`}
                    onClick={() => { if (confirm(`Delete line "${line.lineName}"?`)) deleteMutation.mutate(line.id); }}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── Mating Risk Tab ──────────────────────────────────────────────────────────
function MatingRiskTab() {
  const { toast } = useToast();
  const [ramId, setRamId] = useState("");
  const [eweId, setEweId] = useState("");
  const [result, setResult] = useState<MatingRiskResult | null>(null);

  const { data: animals = [] } = useQuery<Animal[]>({ queryKey: ["/api/animals"] });

  const rams = animals.filter(a => a.sex === "ram" && (a as any).status === "active");
  const ewes = animals.filter(a => a.sex === "ewe" && (a as any).status === "active");

  const checkMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/genetics/mating-risk", { ramId: parseInt(ramId), eweId: parseInt(eweId) }),
    onSuccess: (data: any) => setResult(data),
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const RiskIcon = result ? (RISK_ICONS[result.level] ?? HelpCircle) : null;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm text-muted-foreground mb-4">Select a ram and ewe to assess the relationship risk before mating. BreedLog scans up to 5 recorded generations.</p>
        <Card className="rugged-card">
          <CardContent className="p-4 space-y-4">
            <div className="grid grid-cols-1 xs:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Ram *</Label>
                <Select value={ramId} onValueChange={setRamId}>
                  <SelectTrigger data-testid="select-mating-ram"><SelectValue placeholder="Select ram..." /></SelectTrigger>
                  <SelectContent>
                    {rams.map(a => (
                      <SelectItem key={a.id} value={String(a.id)}>
                        {a.tagId}{a.name ? ` — ${a.name}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Ewe *</Label>
                <Select value={eweId} onValueChange={setEweId}>
                  <SelectTrigger data-testid="select-mating-ewe"><SelectValue placeholder="Select ewe..." /></SelectTrigger>
                  <SelectContent>
                    {ewes.map(a => (
                      <SelectItem key={a.id} value={String(a.id)}>
                        {a.tagId}{a.name ? ` — ${a.name}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              className="w-full"
              data-testid="button-check-mating-risk"
              disabled={!ramId || !eweId || checkMutation.isPending}
              onClick={() => { setResult(null); checkMutation.mutate(); }}
            >
              <Zap className="w-4 h-4 mr-2" />
              {checkMutation.isPending ? "Analysing..." : "Check Mating Risk"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {result && RiskIcon && (
        <Card className={cn("rugged-card border-2", RISK_COLORS[result.level])} data-testid="card-mating-risk-result">
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <RiskIcon className="w-6 h-6 mt-0.5 shrink-0" />
              <div>
                <p className="font-bold text-base">{result.risk}</p>
                <p className="text-sm mt-1 leading-relaxed">{result.explanation}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="rugged-card bg-muted/30">
        <CardContent className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Classification Guide</p>
          <div className="space-y-2 text-xs">
            {[
              { level: "critical", label: "Critical Inbreeding Risk", desc: "Same animal, parent-offspring, or full/half-siblings." },
              { level: "high", label: "High Relationship Risk", desc: "Grandparent-grandchild, uncle/aunt to niece/nephew." },
              { level: "managed", label: "Managed Linebreeding", desc: "Shared ancestor 3–5 generations back — acceptable if ancestor is desired type." },
              { level: "safe", label: "Outbreeding / Crossbreeding", desc: "No shared ancestor within 5 recorded generations, or different breeds." },
              { level: "unknown", label: "Unknown Risk", desc: "Pedigree too incomplete to classify — record parentage first." },
            ].map(({ level, label, desc }) => {
              const Icon = RISK_ICONS[level];
              return (
                <div key={level} className={cn("flex gap-2 items-start p-2 rounded-lg border", RISK_COLORS[level])}>
                  <Icon className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <div><span className="font-semibold">{label}: </span>{desc}</div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Line Performance Tab ─────────────────────────────────────────────────────
function LinePerformanceTab() {
  const [selectedBloodlineId, setSelectedBloodlineId] = useState("");

  const { data: bloodlines = [] } = useQuery<Bloodline[]>({ queryKey: ["/api/genetics/bloodlines"] });

  const { data: perf, isLoading } = useQuery<any>({
    queryKey: ["/api/genetics/line-performance", selectedBloodlineId],
    queryFn: () => fetch(`/api/genetics/line-performance/${selectedBloodlineId}`, { credentials: "include" }).then(r => r.json()),
    enabled: !!selectedBloodlineId,
  });

  const active = bloodlines.filter(b => b.status === "active");

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">View aggregated performance metrics for a bloodline, derived from your actual recorded flock data. No invented numbers.</p>

      <div className="space-y-1.5">
        <Label>Select Bloodline</Label>
        <Select value={selectedBloodlineId} onValueChange={setSelectedBloodlineId}>
          <SelectTrigger data-testid="select-line-performance"><SelectValue placeholder="Choose a bloodline..." /></SelectTrigger>
          <SelectContent>
            {active.map(b => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}
            {active.length === 0 && <SelectItem value="none" disabled>No active bloodlines — create one first</SelectItem>}
          </SelectContent>
        </Select>
      </div>

      {isLoading && <div className="text-sm text-muted-foreground py-6 text-center">Calculating...</div>}

      {perf && !isLoading && (
        <div className="grid grid-cols-2 gap-3 xs:grid-cols-3">
          {[
            { label: "Active Animals", value: perf.activeAnimals },
            { label: "Breeding Rams", value: perf.breedingRams },
            { label: "Breeding Ewes", value: perf.breedingEwes },
            { label: "Matings Recorded", value: perf.matingsRecorded },
            { label: "Lambs Born", value: perf.lambsBorn },
            { label: "Avg Birth Weight", value: perf.avgBirthWeight ? `${perf.avgBirthWeight} kg` : "No data" },
            { label: "Animals Sold", value: perf.animalsSold },
            { label: "Animals Culled", value: perf.animalsCulled },
            { label: "Mortalities", value: perf.animalsDead },
          ].map(({ label, value }) => (
            <Card key={label} className="rugged-card">
              <CardContent className="p-3 text-center">
                <div className="text-2xl font-black text-primary">{value ?? "—"}</div>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mt-0.5">{label}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!selectedBloodlineId && (
        <Card className="rugged-card border-dashed">
          <CardContent className="py-10 text-center space-y-2">
            <TrendingUp className="w-10 h-10 mx-auto text-muted-foreground/40" />
            <p className="text-sm font-medium">Select a bloodline to view its performance</p>
            <p className="text-xs text-muted-foreground">Metrics are calculated from your actual recorded animal, breeding, and health data.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Reference Library Tab ────────────────────────────────────────────────────
const REFERENCE_ITEMS = [
  { term: "Pure-Breeding", def: "Mating animals of the same breed to maintain breed characteristics. Produces consistent, predictable offspring." },
  { term: "Out-Breeding", def: "Mating unrelated animals of the same breed. Reduces inbreeding depression and can improve performance." },
  { term: "Inbreeding", def: "Mating closely related animals (parent-offspring, siblings). Increases genetic uniformity but risks inbreeding depression — avoid unless intentional." },
  { term: "Linebreeding", def: "A mild form of inbreeding focused on a specific desired ancestor. Aims to concentrate the genetics of an outstanding individual without extreme inbreeding coefficients." },
  { term: "Crossbreeding", def: "Mating animals of different breeds. Can produce heterosis (hybrid vigor) — offspring may outperform both parent breeds in certain traits." },
  { term: "Terminal Crossing", def: "Using a terminal sire breed on commercial ewes to produce fast-growing slaughter lambs. All progeny are slaughtered — no replacements kept." },
  { term: "Rotational Crossing", def: "Alternating between two or more breeds in a planned rotation. Maintains some heterosis while still producing replacement females." },
  { term: "Roto-Terminal Crossing", def: "Combines a rotational cross for replacement ewe production with a terminal cross for slaughter lambs. Maximizes both replacement and slaughter performance." },
  { term: "Grading Up", def: "Repeatedly mating crossbred females to a purebred sire to progressively increase the percentage of that breed in the flock over generations." },
  { term: "Composite Breeding", def: "Stabilising a specific combination of breeds into a new synthetic breed. Aims to fix a desired breed composition with predictable genetics." },
  { term: "Heterosis / Hybrid Vigor", def: "The tendency for crossbred offspring to outperform the average of both parent breeds. Strongest in traits like fertility, survival, and growth rate." },
  { term: "Breed Complementarity", def: "Choosing breeds whose strengths and weaknesses complement each other. E.g., a dam breed with high fertility + a sire breed with heavy muscling." },
  { term: "EBV — Estimated Breeding Value", def: "A statistically estimated genetic merit for a specific trait (e.g. birth weight, weaning weight). Based on own performance and pedigree records. Used in stud selection." },
  { term: "ASBV — Australian Sheep Breeding Value", def: "The Australian national system for publishing EBVs for Merino and terminal breeds. Allows direct comparison of animals across flocks." },
];

function ReferenceTab() {
  const [expanded, setExpanded] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground mb-4">Farmer-friendly definitions for genetics and breeding system terminology. Practical and honest — no unsupported claims.</p>
      {REFERENCE_ITEMS.map(({ term, def }) => (
        <Card key={term} className="rugged-card overflow-hidden" data-testid={`ref-item-${term.toLowerCase().replace(/\W+/g, '-')}`}>
          <button
            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/30 transition-colors"
            onClick={() => setExpanded(expanded === term ? null : term)}
          >
            <span className="font-semibold text-sm">{term}</span>
            {expanded === term ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>
          {expanded === term && (
            <div className="px-4 pb-4 text-sm text-muted-foreground border-t border-border/50 pt-3">{def}</div>
          )}
        </Card>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Genetics() {
  return (
    <Layout>
      <div className="space-y-5 pb-8">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/15 p-2.5">
            <Dna className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight">Genetics & Bloodlines</h1>
            <p className="text-xs text-muted-foreground">Pedigree, bloodline management, mating risk, and breeding systems</p>
          </div>
        </div>

        <Tabs defaultValue="bloodlines">
          <TabsList className="w-full h-auto flex-wrap bg-card border border-border gap-0.5 p-1">
            <TabsTrigger value="bloodlines" className="flex-1 text-[11px] font-semibold uppercase py-2" data-testid="tab-genetics-bloodlines">Bloodlines</TabsTrigger>
            <TabsTrigger value="lines" className="flex-1 text-[11px] font-semibold uppercase py-2" data-testid="tab-genetics-lines">Genetic Lines</TabsTrigger>
            <TabsTrigger value="mating" className="flex-1 text-[11px] font-semibold uppercase py-2" data-testid="tab-genetics-mating">Mating Risk</TabsTrigger>
            <TabsTrigger value="performance" className="flex-1 text-[11px] font-semibold uppercase py-2" data-testid="tab-genetics-performance">Performance</TabsTrigger>
            <TabsTrigger value="reference" className="flex-1 text-[11px] font-semibold uppercase py-2" data-testid="tab-genetics-reference"><BookOpen className="w-3.5 h-3.5 mr-1 inline" />Reference</TabsTrigger>
          </TabsList>

          <TabsContent value="bloodlines" className="mt-4"><BloodlinesTab /></TabsContent>
          <TabsContent value="lines" className="mt-4"><GeneticLinesTab /></TabsContent>
          <TabsContent value="mating" className="mt-4"><MatingRiskTab /></TabsContent>
          <TabsContent value="performance" className="mt-4"><LinePerformanceTab /></TabsContent>
          <TabsContent value="reference" className="mt-4"><ReferenceTab /></TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
