import { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Beef,
  Dna,
  FileText,
  Settings,
  Syringe,
  LogOut,
  LogIn,
  BarChart3,
  MoreHorizontal,
  Shield,
  X,
  Bot,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useAIStatus } from "@/hooks/use-ai-status";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/ui/logo";
import { useFarmSettings } from "@/hooks/use-farm-settings";
import { useRecentVisits } from "@/hooks/use-recent-visits";
import {
  NetworkStatusIndicator,
  GlobalRefreshButton,
  SyncStatusBadge,
  StorageWarningBanner,
} from "@/components/NetworkStatusIndicator";
import { performLogout } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose } from "@/components/ui/sheet";
import { useNavigationHistory } from "@/lib/navigation-history-context";
import { BREEDLOG_RUNTIME_VERSION } from "@shared/update-runtime";

function ScrambleText({ text, className }: { text: string; className?: string }) {
  const [displayText, setDisplayText] = useState("");
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*";

  const scramble = useCallback(() => {
    let iteration = 0;
    const interval = setInterval(() => {
      setDisplayText(
        text
          .split("")
          .map((char, index) => {
            if (char === " " || char === "." || char === ",") return char;
            if (index < iteration) return text[index];
            return chars[Math.floor(Math.random() * chars.length)];
          })
          .join("")
      );
      iteration += 1 / 2;
      if (iteration >= text.length) {
        clearInterval(interval);
        setDisplayText(text);
      }
    }, 40);
    return () => clearInterval(interval);
  }, [text]);

  useEffect(() => {
    const timer = setTimeout(scramble, 300);
    return () => clearTimeout(timer);
  }, [scramble]);

  return <span className={className}>{displayText || text}</span>;
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { data: farmSettings } = useFarmSettings();
  const { isAuthenticated } = useAuth();
  const [isScrolled, setIsScrolled] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const { addVisit } = useRecentVisits();
  const { goBack, goForward, canGoBack, canGoForward } = useNavigationHistory();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const pageLabels: Record<string, string> = {
      "/animals": "My Herd",
      "/analysis": "Data",
      "/data": "Data",
      "/breeding": "Breeding",
      "/genetics": "Genetics",
      "/records": "Records",
      "/health": "Health",
      "/settings": "Settings",
    };
    if (location.startsWith("/animals/")) {
      addVisit(location, `Animal ${location.split("/")[2]}`);
    } else if (pageLabels[location]) {
      addVisit(location, pageLabels[location]);
    }
  }, [location, addVisit]);

  // Full nav (used for desktop sidebar and recent-visit page labels).
  const navItems = [
    { href: "/", icon: LayoutDashboard, label: "Home" },
    { href: "/animals", icon: Beef, label: "My Herd" },
    { href: "/analysis", icon: BarChart3, label: "Data" },
    { href: "/breeding", icon: Dna, label: "Breeding" },
    { href: "/genetics", icon: Dna, label: "Genetics" },
    { href: "/health", icon: Syringe, label: "Health" },
    { href: "/records", icon: FileText, label: "Records" },
    { href: "/settings", icon: Settings, label: "Settings" },
    { href: "/help", icon: HelpCircle, label: "Help & Info" },
  ];

  // Mobile/tablet bottom-bar primary tabs (4 + More).
  const mobilePrimary = [
    { href: "/", icon: LayoutDashboard, label: "Home" },
    { href: "/animals", icon: Beef, label: "Herd" },
    { href: "/analysis", icon: BarChart3, label: "Data" },
    { href: "/breeding", icon: Dna, label: "Breeding" },
  ];

  // Items in the More sheet.
  const moreItems = [
    { href: "/genetics", icon: Dna, label: "Genetics" },
    { href: "/health", icon: Syringe, label: "Health" },
    { href: "/records", icon: FileText, label: "Records" },
    { href: "/settings", icon: Settings, label: "Settings" },
    { href: "/help", icon: HelpCircle, label: "Help & Info" },
    { href: "/admin", icon: Shield, label: "Admin" },
  ];

  const isMoreActive =
    location === "/genetics" ||
    location === "/health" ||
    location === "/records" ||
    location === "/settings" ||
    location === "/help" ||
    location === "/report-issue" ||
    location.startsWith("/admin");

  const displayName = farmSettings?.studName || farmSettings?.farmName || null;
  const { quotaExhausted } = useAIStatus();

  return (
    <div className="h-dvh bg-background abstract-bg flex flex-col pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] lg:flex-row lg:pb-0 overflow-hidden">
      <StorageWarningBanner />

      {/* Desktop sidebar — visible only on large screens (laptop+) */}
      <aside className="hidden lg:fixed lg:z-50 lg:flex h-full w-72 flex-col border-r border-sidebar-border bg-[linear-gradient(175deg,#1f2a44_0%,#1e3350_42%,#111827_100%)] text-sidebar-foreground shadow-2xl">
        <Link href="/" className="sidebar-logo-area border-b border-white/10 px-4 py-5 transition-colors hover:bg-white/5">
          <Logo size="lg" showTagline />
        </Link>

        {/* Back / Forward navigation */}
        <div className="flex items-center gap-1 px-4 py-2 border-b border-white/10">
          <button
            onClick={() => goBack()}
            disabled={!canGoBack}
            data-testid="button-nav-back"
            title="Go back"
            className="flex items-center justify-center h-8 w-8 rounded-lg border border-white/10 text-slate-300 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => goForward()}
            disabled={!canGoForward}
            data-testid="button-nav-forward"
            title="Go forward"
            className="flex items-center justify-center h-8 w-8 rounded-lg border border-white/10 text-slate-300 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <span className="ml-1 text-[11px] text-slate-400/70 select-none">Navigate</span>
        </div>

        <nav className="flex-1 space-y-1.5 px-4 py-5 overflow-y-auto">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
              className={cn(
                "flex items-center gap-3 rounded-xl border px-4 py-3 text-[1rem] font-semibold uppercase tracking-[0.02em] transition-all duration-200",
                location === item.href
                  ? "border-cyan-300/40 bg-cyan-500/22 text-white shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_10px_24px_rgba(14,116,144,0.35)]"
                  : "border-transparent text-slate-100/88 hover:border-white/15 hover:bg-white/10 hover:text-white"
              )}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {item.label}
              {location === item.href && <span className="ml-auto h-2.5 w-2.5 rounded-full bg-cyan-300 shrink-0" />}
            </Link>
          ))}
        </nav>

        <div className="space-y-2 border-t border-white/10 px-4 pb-4 pt-3">
          <button
            onClick={() => void performLogout()}
            data-testid="button-logout-desktop"
            className="flex w-full items-center gap-2 rounded-lg border border-white/10 px-3 py-2.5 text-sm font-medium text-slate-200/85 transition-colors hover:bg-white/10 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
            Log Out
          </button>
          <div className="rounded-lg border border-white/10 bg-black/20 p-3 backdrop-blur-sm">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-mono text-slate-100/75">BreedLog v{BREEDLOG_RUNTIME_VERSION}</p>
              <div className="flex items-center gap-1.5">
                <SyncStatusBadge />
                <GlobalRefreshButton location="sidebar" />
              </div>
            </div>
            <NetworkStatusIndicator />
            <p className="mt-2 text-center text-[10px] font-medium tracking-wide text-cyan-100/70">Breeding Livestock Management</p>
          </div>
        </div>
      </aside>

      {/* Mobile / Tablet header — hidden on desktop */}
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/90 backdrop-blur lg:hidden">
        {/* Logo row */}
        <Link href="/" className={cn("flex flex-col items-center px-4 transition-all duration-300", isScrolled ? "pt-1.5 pb-1" : "pt-3 pb-1.5")}>
          <div className={cn("transition-all duration-300", isScrolled ? "scale-75 origin-top" : "scale-100")}>
            <Logo size={isScrolled ? "sm" : "md"} />
          </div>
          <div className={cn("overflow-hidden transition-all duration-300", isScrolled ? "max-h-0 opacity-0" : "max-h-8 opacity-100 mt-1")}>
            <ScrambleText text={displayName || "Breed Smart, Farm Better"} className="text-xs font-medium text-muted-foreground" />
          </div>
        </Link>

        {/* Status row */}
        <div className={cn("flex items-center justify-center gap-2 transition-all duration-300", isScrolled ? "pb-1" : "pb-2")}>
          <div className="flex items-center gap-1 rounded-full border border-border/60 bg-card/80 px-2.5 py-1 shadow-sm">
            <SyncStatusBadge />
            <GlobalRefreshButton location="header" />
          </div>
          {quotaExhausted && (
            <div className="flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 shadow-sm">
              <Bot className="h-3 w-3 text-amber-600 dark:text-amber-400" />
              <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400">Local AI</span>
            </div>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto px-4 py-4 tablet:px-5 tablet:py-5 lg:ml-72 lg:px-8 lg:py-8">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>

      {/* Mobile / Tablet floating bottom nav */}
      <nav
        className="fixed inset-x-0 bottom-0 z-50 px-3 pb-[max(env(safe-area-inset-bottom,0px),0.5rem)] pt-2 lg:hidden"
        aria-label="Primary"
      >
        <div className="mx-auto flex max-w-lg items-center justify-between gap-1 rounded-2xl border border-border/70 bg-card/95 px-2 py-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.18)] backdrop-blur supports-[backdrop-filter]:bg-card/85">
          {mobilePrimary.map((item) => {
            const active = location === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                data-testid={`mobile-nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                className={cn(
                  "flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-2 min-h-[3rem] touch-manipulation transition-all",
                  active
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "text-muted-foreground hover:text-primary hover:bg-primary/10 active:scale-95"
                )}
              >
                <item.icon className="h-[1.2rem] w-[1.2rem]" />
                <span className={cn("text-[10px] font-semibold uppercase tracking-wide")}>
                  {item.label}
                </span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            data-testid="mobile-nav-more"
            aria-label="More navigation"
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-2 min-h-[3rem] touch-manipulation transition-all",
              isMoreActive
                ? "bg-primary text-primary-foreground shadow-md"
                : "text-muted-foreground hover:text-primary hover:bg-primary/10 active:scale-95"
            )}
          >
            <MoreHorizontal className="h-[1.2rem] w-[1.2rem]" />
            <span className="text-[10px] font-semibold uppercase tracking-wide">More</span>
          </button>
        </div>
      </nav>

      {/* More sheet */}
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent
          side="bottom"
          className="rounded-t-3xl border-t border-border/70 pb-[max(env(safe-area-inset-bottom,0px),1rem)]"
          data-testid="more-sheet"
        >
          <SheetHeader className="text-left">
            <SheetTitle>More</SheetTitle>
          </SheetHeader>
          <div className="mt-3 grid grid-cols-2 gap-2.5 tablet:grid-cols-3">
            {moreItems.map((item) => {
              const active = location === item.href || (item.href === "/admin" && location.startsWith("/admin"));
              return (
                <SheetClose asChild key={item.href}>
                  <Link
                    href={item.href}
                    data-testid={`more-nav-${item.label.toLowerCase()}`}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl border px-4 py-3.5 min-h-[3.25rem] touch-manipulation transition-colors",
                      active
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-border/70 bg-card/80 text-foreground hover:bg-primary/5 hover:border-primary/30 active:scale-[0.98]"
                    )}
                  >
                    <div className="rounded-xl bg-primary/10 p-2 text-primary shrink-0">
                      <item.icon className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-semibold">{item.label}</span>
                  </Link>
                </SheetClose>
              );
            })}
          </div>
          <div className="mt-2.5 grid grid-cols-2 gap-2.5">
            <button
              onClick={() => {
                setMoreOpen(false);
                void performLogout();
              }}
              data-testid="more-button-logout"
              aria-label={isAuthenticated ? "Log out" : "Go to login"}
              className="flex items-center justify-center gap-2 rounded-2xl border border-border/70 bg-card/80 px-4 py-3.5 min-h-[3.25rem] text-sm font-semibold text-foreground touch-manipulation transition-colors hover:bg-rose-500/10 hover:text-rose-600 hover:border-rose-500/30 active:scale-[0.98]"
            >
              {isAuthenticated ? <LogOut className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}
              {isAuthenticated ? "Log Out" : "Log In"}
            </button>
            <SheetClose asChild>
              <button
                data-testid="more-button-close"
                className="flex items-center justify-center gap-2 rounded-2xl border border-border/50 px-4 py-3.5 min-h-[3.25rem] text-sm font-medium text-muted-foreground touch-manipulation hover:text-foreground active:scale-[0.98]"
              >
                <X className="h-4 w-4" /> Close
              </button>
            </SheetClose>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
