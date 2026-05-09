import { Bot } from "lucide-react";
import { useAIAssistant } from "@/lib/ai-assistant-context";
import { cn } from "@/lib/utils";

export function AskBreedLogButton({ className }: { className?: string }) {
  const { openPanel } = useAIAssistant();

  return (
    <button
      onClick={() => openPanel()}
      data-testid="button-ask-breedlog"
      aria-label="Ask BreedLog Assistant"
      className={cn(
        "fixed bottom-[5.5rem] right-4 z-50 flex items-center gap-2 rounded-full border border-border/70",
        "bg-primary px-3.5 py-2.5 shadow-[0_4px_20px_rgba(0,0,0,0.25)] transition-all",
        "hover:scale-105 hover:shadow-[0_6px_24px_rgba(0,0,0,0.3)] active:scale-95",
        "md:bottom-6 md:right-6",
        className,
      )}
    >
      <Bot className="h-4 w-4 text-primary-foreground" />
      <span className="text-xs font-bold uppercase tracking-wide text-primary-foreground">Ask BreedLog</span>
    </button>
  );
}

export function AskSectionButton({
  section,
  category,
  prompt,
  className,
}: {
  section: string;
  category: string;
  prompt?: string;
  className?: string;
}) {
  const { openPanel } = useAIAssistant();

  return (
    <button
      onClick={() => openPanel({ category, contextSection: section, prompt })}
      data-testid={`button-ask-section-${section}`}
      aria-label={`Ask about ${section}`}
      className={cn(
        "flex items-center gap-1 rounded-full border border-primary/25 bg-primary/8 px-2.5 py-1",
        "text-[10px] font-semibold uppercase tracking-wide text-primary transition-colors",
        "hover:bg-primary/15",
        className,
      )}
    >
      <Bot className="h-3 w-3" />
      Ask
    </button>
  );
}
