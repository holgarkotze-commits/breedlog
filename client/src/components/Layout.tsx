import { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, Beef, Dna, FileText, Settings, Syringe, LogOut, LogIn, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/ui/logo";
import { useFarmSettings } from "@/hooks/use-farm-settings";
import { useRecentVisits } from "@/hooks/use-recent-visits";
import { NetworkStatusIndicator, GlobalRefreshButton, SyncStatusBadge, StorageWarningBanner } from "@/components/NetworkStatusIndicator";
import { performLogout } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";

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
  const { addVisit } = useRecentVisits();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const pageLabels: Record<string, string> = {
      "/animals": "My Herd",
      "/analysis": "Analysis",
      "/breeding": "Breeding",
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

  const navItems = [
    { href: "/", icon: LayoutDashboard, label: "Home" },
    { href: "/animals", icon: Beef, label: "My Herd" },
    { href: "/analysis", icon: BarChart3, label: "Analysis" },
    { href: "/breeding", icon: Dna, label: "Breeding" },
    { href: "/health", icon: Syringe, label: "Health" },
    { href: "/records", icon: FileText, label: "Records" },
    { href: "/settings", icon: Settings, label: "Settings" },
  ];

  const displayName = farmSettings?.studName || farmSettings?.farmName || null;

  return (
    <div className="min-h-screen bg-background abstract-bg flex flex-col pb-28 md:flex-row md:pb-0">
      <StorageWarningBanner />

      <aside className="hidden md:fixed md:z-50 md:flex h-full w-72 flex-col border-r border-sidebar-border bg-[linear-gradient(175deg,#1f2a44_0%,#1e3350_42%,#111827_100%)] text-sidebar-foreground shadow-2xl">
        <Link href="/" className="sidebar-logo-area border-b border-white/10 px-4 py-5 transition-colors hover:bg-white/5">
          <Logo size="lg" showTagline />
        </Link>

        <nav className="flex-1 space-y-2 px-4 py-5">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
              className={cn(
                "flex items-center gap-3 rounded-xl border px-4 py-3 text-[1.05rem] font-semibold uppercase tracking-[0.02em] transition-all duration-200",
                location === item.href
                  ? "border-cyan-300/40 bg-cyan-500/22 text-white shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_10px_24px_rgba(14,116,144,0.35)]"
                  : "border-transparent text-slate-100/88 hover:border-white/15 hover:bg-white/10 hover:text-white"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
              {location === item.href && <span className="ml-auto h-2.5 w-2.5 rounded-full bg-cyan-300" />}
            </Link>
          ))}
        </nav>

        <div className="space-y-2 border-t border-white/10 px-4 pb-4 pt-3">
          <button
            onClick={() => void performLogout()}
            data-testid="button-logout-desktop"
            className="flex w-full items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm font-medium text-slate-200/85 transition-colors hover:bg-white/10 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
            Log Out
          </button>
          <div className="rounded-lg border border-white/10 bg-black/20 p-3 backdrop-blur-sm">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-mono text-slate-100/75">BreedLog v1.0.0</p>
              <SyncStatusBadge />
            </div>
            <NetworkStatusIndicator />
            <p className="mt-2 text-center text-[10px] font-medium tracking-wide text-cyan-100/70">Breeding Livestock Management</p>
          </div>
        </div>
      </aside>

      <div className="fixed right-2 top-[max(env(safe-area-inset-top,0px),0.5rem)] z-[60] flex items-center gap-1 rounded-xl border border-border/70 bg-card/90 p-1.5 shadow-md backdrop-blur">
        <SyncStatusBadge />
        <GlobalRefreshButton location="header" />
      </div>

      <header className={cn("sticky top-0 z-40 border-b border-border/70 bg-background/90 backdrop-blur md:hidden", isScrolled ? "py-2" : "py-4")}>
        <Link href="/" className="flex flex-col items-center px-4">
          <div className={cn("transition-all duration-300", isScrolled ? "scale-75" : "scale-100")}>
            <Logo size={isScrolled ? "sm" : "md"} />
          </div>
          <div className={cn("overflow-hidden transition-all duration-300", isScrolled ? "max-h-0 opacity-0" : "mt-2 max-h-20 opacity-100")}>
            <ScrambleText text={displayName || "Breed Smart, Farm Better"} className="text-xs font-medium text-muted-foreground" />
          </div>
        </Link>
      </header>

      <main className="min-h-[calc(100vh-4rem)] flex-1 overflow-y-auto p-2.5 md:ml-72 md:min-h-screen md:p-8">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>

      <div className="fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))] left-0 right-0 z-50 px-3 pb-2 md:hidden">
        <button
          onClick={() => void performLogout()}
          data-testid="button-logout-mobile-bottom"
          className="mx-auto flex w-full max-w-sm items-center justify-center gap-2 rounded-xl border border-border/70 bg-card/95 px-4 py-2.5 text-sm font-semibold text-foreground shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/80"
          aria-label={isAuthenticated ? "Log out" : "Go to login"}
        >
          {isAuthenticated ? <LogOut className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}
          {isAuthenticated ? "Log Out" : "Log In"}
        </button>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-14 items-center justify-around border-t border-border bg-card px-1 pb-[env(safe-area-inset-bottom,0px)] md:hidden">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            data-testid={`mobile-nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
            className={cn(
              "flex h-full w-full flex-col items-center justify-center rounded-md p-1 transition-colors",
              location === item.href ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-primary"
            )}
          >
            <item.icon className="h-5 w-5" />
            <span className="mt-0.5 text-[10px] font-semibold uppercase">{item.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
