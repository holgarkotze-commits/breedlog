import { useState } from "react";
import { ChevronDown, ChevronUp, BookOpen, HelpCircle, Download, Wifi, AlertTriangle, FileText, Bug, Info, ArrowLeft, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link, useLocation } from "wouter";
import { KNOWLEDGE_BASE, type KnowledgeEntry } from "@shared/breedlog-knowledge";
import { FIELD_TEST_VERSION_LABEL } from "@shared/version";
import { cn } from "@/lib/utils";

const SECTION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "Getting Started": BookOpen,
  "Installation": Download,
  "Access & Login": FileText,
  "My Herd": FileText,
  "Animal Management": FileText,
  "Rams": FileText,
  "Ewes": FileText,
  "Lambs": FileText,
  "Breeding": FileText,
  "Mating Groups": FileText,
  "Productivity": FileText,
  "Health": AlertTriangle,
  "Weights": FileText,
  "Records": FileText,
  "Exported Documents": FileText,
  "Exports": Download,
  "Data & Analysis": FileText,
  "Sync": Wifi,
  "Settings": FileText,
  "Issue Reporting": Bug,
  "Field Testing": FileText,
  "Troubleshooting": AlertTriangle,
  "FAQ": HelpCircle,
};

const HELP_SECTIONS = [
  { label: "Quick Start", knowledgeId: "getting-started" },
  { label: "Install BreedLog as an App", knowledgeId: "install-pwa" },
  { label: "Access Codes & Saved Login", knowledgeId: "access-codes" },
  { label: "My Herd and Active Animals", knowledgeId: "my-herd" },
  { label: "Adding and Editing Animals", knowledgeId: "add-edit-animals" },
  { label: "Rams and Sires", knowledgeId: "rams" },
  { label: "Ewes and Dams", knowledgeId: "ewes" },
  { label: "Lambs and Lamb Stages", knowledgeId: "lambs" },
  { label: "Breeding Records", knowledgeId: "breeding" },
  { label: "Mating Groups", knowledgeId: "mating-groups" },
  { label: "Productivity Logs", knowledgeId: "productivity-logs" },
  { label: "Health Records", knowledgeId: "health-records" },
  { label: "Weight and Performance Records", knowledgeId: "weight-records" },
  { label: "Records Tab", knowledgeId: "records-tab" },
  { label: "Exported Documents", knowledgeId: "exported-documents" },
  { label: "PDF and CSV Exports", knowledgeId: "exports" },
  { label: "Data Tab and Analysis", knowledgeId: "data-tab" },
  { label: "Sync and Offline Use", knowledgeId: "sync-offline" },
  { label: "Settings", knowledgeId: "settings" },
  { label: "Field Testing Guide", knowledgeId: "field-testing" },
  { label: "Report an Issue", knowledgeId: "issue-reporting", isAction: true },
  { label: "Troubleshooting", knowledgeId: "troubleshooting" },
  { label: "FAQ", knowledgeId: "faq" },
  { label: "About BreedLog", knowledgeId: "__about__" },
];

function MarkdownBody({ text }: { text: string }) {
  const lines = text.split("\n");
  const elements: JSX.Element[] = [];
  let key = 0;

  for (const line of lines) {
    if (line.startsWith("**") && line.endsWith("**") && line.length > 4) {
      elements.push(<p key={key++} className="font-semibold text-foreground mt-4 mb-1">{line.slice(2, -2)}</p>);
    } else if (line.startsWith("- ")) {
      elements.push(<li key={key++} className="ml-4 list-disc text-muted-foreground">{parseInline(line.slice(2))}</li>);
    } else if (/^\d+\.\s/.test(line)) {
      const content = line.replace(/^\d+\.\s/, "");
      elements.push(<li key={key++} className="ml-4 list-decimal text-muted-foreground">{parseInline(content)}</li>);
    } else if (line.startsWith("**Q:")) {
      elements.push(<p key={key++} className="font-semibold text-foreground mt-4 mb-0.5">{line.replace(/\*\*/g, "")}</p>);
    } else if (line.startsWith("**A:") || line.startsWith("A: ")) {
      elements.push(<p key={key++} className="text-muted-foreground mb-2">{line.replace(/\*\*A:\*\*\s?|^A:\s/, "")}</p>);
    } else if (line.trim() === "") {
      elements.push(<div key={key++} className="h-1" />);
    } else {
      elements.push(<p key={key++} className="text-muted-foreground leading-relaxed">{parseInline(line)}</p>);
    }
  }

  return <div className="space-y-0.5 text-sm">{elements}</div>;
}

function parseInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**")
      ? <strong key={i} className="text-foreground font-semibold">{part.slice(2, -2)}</strong>
      : part
  );
}

function HelpSectionRow({
  label,
  entry,
  isAction,
  onOpen,
}: {
  label: string;
  entry: KnowledgeEntry | null;
  isAction?: boolean;
  onOpen: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  if (isAction) {
    return (
      <Link href="/report-issue">
        <div
          className="flex items-center justify-between p-4 border-b border-border cursor-pointer hover:bg-muted/50 transition-colors"
          data-testid="help-section-report-issue"
        >
          <div className="flex items-center gap-3">
            <Bug className="h-4 w-4 text-primary shrink-0" />
            <span className="font-medium text-sm">{label}</span>
          </div>
          <ExternalLink className="h-4 w-4 text-muted-foreground" />
        </div>
      </Link>
    );
  }

  if (!entry) return null;

  const Icon = SECTION_ICONS[entry.category] || FileText;

  return (
    <div className="border-b border-border last:border-0" data-testid={`help-section-${entry.id}`}>
      <button
        className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors text-left"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-3 min-w-0">
          <Icon className="h-4 w-4 text-primary shrink-0" />
          <div className="min-w-0">
            <span className="font-medium text-sm block">{label}</span>
            {!expanded && (
              <span className="text-xs text-muted-foreground truncate block max-w-[260px]">
                {entry.summary}
              </span>
            )}
          </div>
        </div>
        {expanded
          ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0 ml-2" />
          : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 ml-2" />
        }
      </button>

      {expanded && (
        <div className="px-4 pb-5 pt-1 bg-muted/20">
          <MarkdownBody text={entry.body} />
        </div>
      )}
    </div>
  );
}

function AboutSection() {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="border-b border-border last:border-0" data-testid="help-section-about">
      <button
        className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors text-left"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-3">
          <Info className="h-4 w-4 text-primary shrink-0" />
          <div>
            <span className="font-medium text-sm block">About BreedLog</span>
            {!expanded && (
              <span className="text-xs text-muted-foreground">Version info and credits.</span>
            )}
          </div>
        </div>
        {expanded
          ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0 ml-2" />
          : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 ml-2" />
        }
      </button>

      {expanded && (
        <div className="px-4 pb-5 pt-1 bg-muted/20 space-y-3">
          <div className="space-y-1">
            <p className="font-bold text-base text-foreground">BreedLog</p>
            <p className="text-sm text-muted-foreground">Meatmaster sheep livestock management — offline-capable, field-ready.</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="font-mono text-xs">{FIELD_TEST_VERSION_LABEL}</Badge>
          </div>
          <div className="pt-2 border-t border-border/60">
            <p className="text-sm text-muted-foreground">
              Developed by{" "}
              <span className="font-semibold text-foreground">STITCH WORX</span>
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Software, systems & digital builds.</p>
          </div>
          <div className="text-xs text-muted-foreground pt-1">
            <p>BreedLog is a Progressive Web App (PWA). Use it installed on your phone and desktop for the best experience.</p>
            <p className="mt-1">Data is yours — stored on your device and synced to a secure cloud server. Never shared with third parties.</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function HelpPage() {
  const [, navigate] = useLocation();

  const findEntry = (id: string): KnowledgeEntry | null => {
    return KNOWLEDGE_BASE.find((e) => e.id === id) ?? null;
  };

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-8">
      <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3 flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 -ml-1"
          onClick={() => history.length > 1 ? history.back() : navigate("/settings")}
          data-testid="button-help-back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="font-bold text-base leading-tight">Help & Information</h1>
          <p className="text-xs text-muted-foreground">BreedLog field guide</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-0 md:px-4 pt-2">
        <Card className="rounded-none md:rounded-xl border-x-0 md:border-x overflow-hidden">
          <CardContent className="p-0">
            {HELP_SECTIONS.map((section) => {
              if (section.knowledgeId === "__about__") {
                return <AboutSection key="about" />;
              }
              return (
                <HelpSectionRow
                  key={section.knowledgeId}
                  label={section.label}
                  entry={findEntry(section.knowledgeId)}
                  isAction={section.isAction}
                  onOpen={() => {}}
                />
              );
            })}
          </CardContent>
        </Card>

        <div className="px-4 py-6 text-center">
          <p className="text-xs text-muted-foreground">
            BreedLog {FIELD_TEST_VERSION_LABEL}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Developed by <span className="font-medium">STITCH WORX</span>
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/legal/privacy">Privacy</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/legal/terms">Terms</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/legal/subscription">Subscription Terms</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/legal/account-deletion">Deletion Policy</Link>
            </Button>
          </div>
          <Button variant="outline" size="sm" className="mt-3" asChild>
            <Link href="/report-issue" data-testid="button-help-report-issue">
              <Bug className="h-3.5 w-3.5 mr-1.5" />
              Report an Issue
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
