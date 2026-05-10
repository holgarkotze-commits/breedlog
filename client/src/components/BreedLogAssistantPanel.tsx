import { useState, useEffect, useRef } from "react";
import { Bot, Send, X, AlertCircle, Sparkles, Lightbulb, Database, Info, ChevronDown, ChevronUp, Settings2 } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetClose } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { getDeviceToken } from "@/lib/queryClient";
import { useAIAssistant } from "@/lib/ai-assistant-context";

interface PromptCategory {
  key: string;
  label: string;
  prompts: string[];
}

interface AIResponse {
  answer: string;
  confidence: "high" | "medium" | "low" | "insufficient";
  usedData: string[];
  warnings: string[];
  suggestedNextQuestions: string[];
  category: string | null;
  contextSection: string | null;
}

const CONFIDENCE_STYLE: Record<string, string> = {
  high: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  low: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  insufficient: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
};

async function fetchPromptCategories(): Promise<PromptCategory[]> {
  try {
    const token = getDeviceToken();
    const res = await fetch("/api/ai/suggested-prompts", {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.categories || [];
  } catch {
    return [];
  }
}

async function sendAIChat(opts: {
  question: string;
  category?: string;
  contextSection?: string;
  animalId?: number;
}): Promise<AIResponse> {
  const token = getDeviceToken();
  const res = await fetch("/api/ai/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(opts),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Request failed (${res.status})`);
  }
  return res.json();
}

const MAX_VISIBLE_FOLLOWUPS = 2;

export function BreedLogAssistantPanel() {
  const { isOpen, initialOptions, closePanel } = useAIAssistant();
  const [categories, setCategories] = useState<PromptCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("herd-overview");
  const [question, setQuestion] = useState("");
  const [response, setResponse] = useState<AIResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Controls area (category + suggested questions) collapsed when an answer is showing
  const [showControls, setShowControls] = useState(true);
  // Details panel (Data used / caveats / warnings) — collapsed by default
  const [showDetails, setShowDetails] = useState(false);
  // Follow-up questions — show only first MAX_VISIBLE_FOLLOWUPS by default
  const [showAllFollowUp, setShowAllFollowUp] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const answerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchPromptCategories().then(setCategories);
  }, []);

  useEffect(() => {
    if (isOpen && initialOptions) {
      if (initialOptions.category) setSelectedCategory(initialOptions.category);
      if (initialOptions.prompt) setQuestion(initialOptions.prompt);
      if (!initialOptions.prompt) setQuestion("");
      setResponse(null);
      setError(null);
      setShowControls(true);
      setShowDetails(false);
      setShowAllFollowUp(false);
    }
  }, [isOpen, initialOptions]);

  const currentCategory = categories.find((c) => c.key === selectedCategory);

  const hasDetails =
    response &&
    (response.usedData.length > 0 || response.warnings.length > 0);

  async function handleSend() {
    const q = question.trim();
    if (!q || loading) return;
    setLoading(true);
    setError(null);
    setResponse(null);
    setShowDetails(false);
    setShowAllFollowUp(false);
    try {
      const result = await sendAIChat({
        question: q,
        category: selectedCategory !== "all" ? selectedCategory : undefined,
        contextSection: initialOptions.contextSection,
        animalId: initialOptions.animalId,
      });
      setResponse(result);
      // Auto-collapse controls so the answer is the first thing visible
      setShowControls(false);
      // Scroll answer into view after a tick
      setTimeout(() => answerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      const safe = msg.length > 200 ? msg.slice(0, 200) + "…" : msg;
      setError(safe);
      setShowControls(false);
    } finally {
      setLoading(false);
    }
  }

  function handlePromptChip(prompt: string) {
    setQuestion(prompt);
    setResponse(null);
    setError(null);
    setTimeout(() => textareaRef.current?.focus(), 50);
  }

  function handleFollowUp(q: string) {
    setQuestion(q);
    setResponse(null);
    setError(null);
    setShowControls(false);
    setShowDetails(false);
    setShowAllFollowUp(false);
    setTimeout(() => textareaRef.current?.focus(), 50);
  }

  const visibleFollowUps = response?.suggestedNextQuestions ?? [];
  const shownFollowUps = showAllFollowUp
    ? visibleFollowUps
    : visibleFollowUps.slice(0, MAX_VISIBLE_FOLLOWUPS);
  const hiddenFollowUpCount = visibleFollowUps.length - shownFollowUps.length;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) closePanel(); }}>
      <SheetContent
        side="bottom"
        className={cn(
          // Full-screen on mobile — no wasted gap at top
          "grid grid-rows-[auto_minmax(0,1fr)_auto] p-0",
          "h-[100dvh] max-h-[100dvh]",
          "w-full max-w-full overflow-hidden",
          // Rounded top corners for aesthetics
          "rounded-t-2xl",
          // Hide the Sheet's built-in absolute close button — we render our own
          "[&>button.absolute]:hidden",
          // Desktop: side drawer — compact height so it doesn't fill desktop screen
          "md:right-4 md:top-4 md:h-[calc(100dvh-2rem)] md:max-h-none md:w-[440px] md:max-w-[440px] md:rounded-2xl md:border md:border-border/70",
        )}
        data-testid="ai-assistant-panel"
      >
        {/* ── Row 1: Header ── */}
        <div className="flex flex-none items-center gap-2.5 border-b border-border/60 px-4 py-3">
          <div className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Bot className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <SheetTitle className="text-base font-bold leading-tight">BreedLog Assistant</SheetTitle>
            <p className="text-[11px] text-muted-foreground">Answers from your BreedLog records</p>
          </div>
          {/* Controls toggle button — compact, always visible */}
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-8 w-8 flex-none",
              showControls && "bg-primary/10 text-primary",
            )}
            onClick={() => setShowControls((v) => !v)}
            data-testid="button-toggle-controls"
            aria-label={showControls ? "Hide settings" : "Show settings"}
          >
            <Settings2 className="h-4 w-4" />
          </Button>
          <SheetClose asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 flex-none"
              data-testid="button-close-ai-panel"
            >
              <X className="h-4 w-4" />
            </Button>
          </SheetClose>
        </div>

        {/* ── Row 2: Scrollable body ── */}
        <div
          className="min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain"
          data-testid="ai-panel-scroll"
        >
          <div className="space-y-3 p-4 pb-6">

            {/* ── Collapsible controls: category + suggested questions ── */}
            {showControls && (
              <div
                className="space-y-3 rounded-xl border border-border/60 bg-muted/30 p-3"
                data-testid="ai-controls-area"
              >
                {/* Category selector */}
                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Category
                  </label>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger className="h-8 w-full text-xs" data-testid="select-trigger-ai-category">
                      <SelectValue placeholder="Choose a topic…" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Suggested prompts — wrap cleanly */}
                {currentCategory && currentCategory.prompts.length > 0 && !loading && (
                  <div>
                    <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Suggested questions
                    </label>
                    <div className="flex flex-wrap gap-1.5" data-testid="ai-suggested-questions">
                      {currentCategory.prompts.map((p) => (
                        <button
                          key={p}
                          onClick={() => handlePromptChip(p)}
                          data-testid="button-prompt-chip"
                          className={cn(
                            "rounded-full border border-border/70 bg-muted/50 px-2.5 py-1",
                            "text-[11px] font-medium text-foreground/80",
                            "transition-colors hover:bg-muted hover:text-foreground",
                            "max-w-full whitespace-normal text-left break-words",
                          )}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Answer card ── */}
            {response && (
              <div
                ref={answerRef}
                className="rounded-xl border border-border/70 bg-card/80"
                data-testid="ai-answer-container"
              >
                {/* Card header: AI label + confidence + info toggle */}
                <div className="flex items-center gap-2 border-b border-border/40 px-3 py-2">
                  <Sparkles className="h-3.5 w-3.5 flex-none text-primary" />
                  <span className="flex-1 text-xs font-semibold text-foreground">Assistant</span>
                  <Badge
                    variant="secondary"
                    className={cn("flex-none text-[10px]", CONFIDENCE_STYLE[response.confidence])}
                    data-testid="ai-confidence-badge"
                  >
                    {response.confidence}
                  </Badge>
                  {hasDetails && (
                    <button
                      onClick={() => setShowDetails((v) => !v)}
                      data-testid="button-toggle-details"
                      aria-label={showDetails ? "Hide data details" : "Show data details"}
                      className={cn(
                        "ml-1 flex h-6 w-6 flex-none items-center justify-center rounded-md transition-colors",
                        showDetails
                          ? "bg-primary/15 text-primary"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      <Info className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Main answer — always visible, prominent */}
                <div className="px-3 py-3">
                  <p
                    className="break-words text-sm leading-relaxed text-foreground"
                    data-testid="ai-answer-text"
                  >
                    {response.answer}
                  </p>
                </div>

                {/* Details section — Data used + Caveats — collapsed by default */}
                {showDetails && hasDetails && (
                  <div
                    className="space-y-2 border-t border-border/40 px-3 pb-3 pt-2"
                    data-testid="ai-details-section"
                  >
                    {response.usedData.length > 0 && (
                      <div className="rounded-lg border border-border/50 bg-muted/40 px-3 py-2">
                        <div className="mb-1 flex items-center gap-1.5">
                          <Database className="h-3 w-3 flex-none text-muted-foreground" />
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Data used
                          </span>
                        </div>
                        <ul className="space-y-0.5">
                          {response.usedData.map((d, i) => (
                            <li
                              key={i}
                              className="break-words text-[11px] text-muted-foreground before:mr-1.5 before:content-['·']"
                            >
                              {d}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {response.warnings.length > 0 && (
                      <div className="rounded-lg border border-amber-200/60 bg-amber-50/60 px-3 py-2 dark:border-amber-800/40 dark:bg-amber-900/10">
                        <div className="mb-1 flex items-center gap-1.5">
                          <AlertCircle className="h-3 w-3 flex-none text-amber-600 dark:text-amber-400" />
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                            Caveats
                          </span>
                        </div>
                        {response.warnings.map((w, i) => (
                          <p
                            key={i}
                            className="break-words text-[11px] text-amber-700 dark:text-amber-300"
                          >
                            {w}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Follow-up questions — compact chips, max 2 visible by default */}
                {visibleFollowUps.length > 0 && (
                  <div
                    className="border-t border-border/40 px-3 pb-3 pt-2"
                    data-testid="ai-follow-up-section"
                  >
                    <div className="mb-1.5 flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1">
                        <Lightbulb className="h-3 w-3 flex-none text-muted-foreground" />
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Follow up
                        </span>
                      </div>
                      {hiddenFollowUpCount > 0 && (
                        <button
                          onClick={() => setShowAllFollowUp(true)}
                          className="text-[10px] text-primary underline-offset-2 hover:underline"
                          data-testid="button-show-more-followup"
                        >
                          +{hiddenFollowUpCount} more
                        </button>
                      )}
                      {showAllFollowUp && visibleFollowUps.length > MAX_VISIBLE_FOLLOWUPS && (
                        <button
                          onClick={() => setShowAllFollowUp(false)}
                          className="text-[10px] text-muted-foreground underline-offset-2 hover:underline"
                          data-testid="button-collapse-followup"
                        >
                          Show less
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {shownFollowUps.map((q, i) => (
                        <button
                          key={i}
                          onClick={() => handleFollowUp(q)}
                          data-testid="button-follow-up"
                          className="rounded-full border border-primary/25 bg-primary/8 px-2.5 py-1 text-left text-[11px] text-primary break-words transition-colors hover:bg-primary/15 max-w-full"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Error state */}
            {error && (
              <div
                className="flex items-start gap-2 rounded-xl border border-border/60 bg-muted/30 p-3"
                data-testid="ai-error-state"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 flex-none text-muted-foreground" />
                <p className="min-w-0 break-words text-sm text-muted-foreground">{error}</p>
              </div>
            )}

            {/* Loading state */}
            {loading && (
              <div
                className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-muted/30 px-4 py-3"
                data-testid="ai-loading-state"
              >
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/60"
                      style={{ animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                </div>
                <span className="text-sm text-muted-foreground">Analysing your records…</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Row 3: Input composer — always visible, never clipped ── */}
        <div
          className="flex-none border-t border-border/60 bg-background px-3 pb-[max(env(safe-area-inset-bottom,0px),0.75rem)] pt-3"
        >
          <div className="flex items-end gap-2">
            <Textarea
              ref={textareaRef}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Ask about your herd, lambs, sires, health…"
              rows={2}
              maxLength={1000}
              className="min-w-0 flex-1 resize-none text-sm"
              disabled={loading}
              data-testid="input-ai-question"
            />
            <button
              onClick={handleSend}
              disabled={!question.trim() || loading}
              data-testid="button-ai-send"
              className={cn(
                "flex h-10 w-10 flex-none items-center justify-center rounded-xl transition-all",
                "bg-primary text-primary-foreground shadow-md",
                "hover:brightness-110 active:scale-95",
                "disabled:cursor-not-allowed disabled:opacity-40",
              )}
              aria-label="Send question"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-1.5 text-center text-[10px] text-muted-foreground">
            Read-only · Answers from your records only
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
