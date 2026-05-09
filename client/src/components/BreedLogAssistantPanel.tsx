import { useState, useEffect, useRef } from "react";
import { Bot, Send, X, AlertCircle, Sparkles, Lightbulb, Database } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
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

export function BreedLogAssistantPanel() {
  const { isOpen, initialOptions, closePanel } = useAIAssistant();
  const [categories, setCategories] = useState<PromptCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("herd-overview");
  const [question, setQuestion] = useState("");
  const [response, setResponse] = useState<AIResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
    }
  }, [isOpen, initialOptions]);

  const currentCategory = categories.find((c) => c.key === selectedCategory);

  async function handleSend() {
    const q = question.trim();
    if (!q || loading) return;
    setLoading(true);
    setError(null);
    setResponse(null);
    try {
      const result = await sendAIChat({
        question: q,
        category: selectedCategory !== "all" ? selectedCategory : undefined,
        contextSection: initialOptions.contextSection,
        animalId: initialOptions.animalId,
      });
      setResponse(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      // Strip any JSON blobs from client-side errors before showing
      const safe = msg.length > 200 ? msg.slice(0, 200) + "…" : msg;
      setError(safe);
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
    setTimeout(() => textareaRef.current?.focus(), 50);
  }

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) closePanel(); }}>
      <SheetContent
        side="bottom"
        className={cn(
          // Mobile: full-width bottom sheet, no side margins, rounded top corners
          "flex flex-col rounded-t-2xl p-0",
          "h-[92dvh] max-h-[92dvh]",
          "w-full max-w-full overflow-hidden",
          // Desktop: side drawer
          "md:right-4 md:top-4 md:h-[calc(100dvh-2rem)] md:max-h-none md:w-[440px] md:max-w-[440px] md:rounded-2xl md:border md:border-border/70",
        )}
        data-testid="ai-assistant-panel"
      >
        {/* Header */}
        <SheetHeader className="flex-none border-b border-border/60 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Bot className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-base font-bold leading-tight">BreedLog Assistant</SheetTitle>
              <p className="text-[11px] text-muted-foreground">Answers from your BreedLog records</p>
            </div>
            <SheetClose asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 flex-none"
                data-testid="button-close-ai-panel"
              >
                <X className="h-4 w-4" />
              </Button>
            </SheetClose>
          </div>
        </SheetHeader>

        {/* Scrollable body — constrained so it never pushes outside the sheet */}
        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-4 p-4">

            {/* Category selector */}
            <div>
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Category
              </label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="h-9 w-full" data-testid="select-trigger-ai-category">
                  <SelectValue placeholder="Choose a topic…" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Suggested prompts — wrap cleanly, no horizontal overflow */}
            {currentCategory && currentCategory.prompts.length > 0 && !loading && (
              <div>
                <label className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Suggested questions
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {currentCategory.prompts.map((p) => (
                    <button
                      key={p}
                      onClick={() => handlePromptChip(p)}
                      data-testid="button-prompt-chip"
                      className={cn(
                        "rounded-full border border-border/70 bg-muted/50 px-3 py-1",
                        "text-[11px] font-medium text-foreground/80",
                        "transition-colors hover:bg-muted hover:text-foreground",
                        // Wrap long prompts — never push past panel width
                        "max-w-full whitespace-normal text-left break-words",
                      )}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Answer display */}
            {response && (
              <div className="space-y-3 rounded-xl border border-border/70 bg-card/80 p-3" data-testid="ai-answer-container">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 flex-none text-primary" />
                    <span className="text-xs font-semibold text-foreground">Assistant</span>
                  </div>
                  <Badge
                    variant="secondary"
                    className={cn("flex-none text-[10px]", CONFIDENCE_STYLE[response.confidence])}
                    data-testid="ai-confidence-badge"
                  >
                    {response.confidence}
                  </Badge>
                </div>

                {/* Answer text — always wraps, never overflows */}
                <p className="break-words text-sm leading-relaxed text-foreground" data-testid="ai-answer-text">
                  {response.answer}
                </p>

                {response.usedData.length > 0 && (
                  <div className="rounded-lg border border-border/50 bg-muted/40 px-3 py-2">
                    <div className="mb-1.5 flex items-center gap-1.5">
                      <Database className="h-3 w-3 flex-none text-muted-foreground" />
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Data used</span>
                    </div>
                    <ul className="space-y-0.5">
                      {response.usedData.map((d, i) => (
                        <li key={i} className="break-words text-[11px] text-muted-foreground before:mr-1.5 before:content-['·']">{d}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {response.warnings.length > 0 && (
                  <div className="rounded-lg border border-amber-200/60 bg-amber-50/60 px-3 py-2 dark:border-amber-800/40 dark:bg-amber-900/10">
                    <div className="mb-1 flex items-center gap-1.5">
                      <AlertCircle className="h-3 w-3 flex-none text-amber-600 dark:text-amber-400" />
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">Caveats</span>
                    </div>
                    {response.warnings.map((w, i) => (
                      <p key={i} className="break-words text-[11px] text-amber-700 dark:text-amber-300">{w}</p>
                    ))}
                  </div>
                )}

                {response.suggestedNextQuestions.length > 0 && (
                  <div>
                    <div className="mb-1.5 flex items-center gap-1.5">
                      <Lightbulb className="h-3 w-3 flex-none text-muted-foreground" />
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Follow up</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      {response.suggestedNextQuestions.map((q, i) => (
                        <button
                          key={i}
                          onClick={() => handleFollowUp(q)}
                          data-testid="button-follow-up"
                          className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-1.5 text-left text-[11px] text-primary transition-colors hover:bg-primary/10 break-words"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Error state — compact, word-wrapped, never overflows */}
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
              <div className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-muted/30 px-4 py-3" data-testid="ai-loading-state">
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
        </ScrollArea>

        {/* Input area — fixed at the bottom, never overflows horizontally */}
        <div className="flex-none border-t border-border/60 px-3 pb-[max(env(safe-area-inset-bottom,0px),0.75rem)] pt-3">
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
