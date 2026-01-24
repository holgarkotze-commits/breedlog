import { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, Beef, Dna, FileText, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import logo from "@assets/BREEDLOG_LOGO_1768730745128.png";
import { useFarmSettings } from "@/hooks/use-farm-settings";
import { useRecentVisits } from "@/hooks/use-recent-visits";

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
            if (char === " " || char === ".") return char;
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
  const [isScrolled, setIsScrolled] = useState(false);
  const { addVisit } = useRecentVisits();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Track page visits
  useEffect(() => {
    const pageLabels: Record<string, string> = {
      "/animals": "Animals",
      "/breeding": "Breeding",
      "/settings": "Settings",
    };
    // Also track animal detail pages
    if (location.startsWith("/animals/")) {
      addVisit(location, `Animal ${location.split("/")[2]}`);
    } else if (pageLabels[location]) {
      addVisit(location, pageLabels[location]);
    }
  }, [location, addVisit]);

  const navItems = [
    { href: "/", icon: LayoutDashboard, label: "Home" },
    { href: "/animals", icon: Beef, label: "Animals" },
    { href: "/breeding", icon: Dna, label: "Breeding" },
    { href: "/records", icon: FileText, label: "Records" },
    { href: "/settings", icon: Settings, label: "Settings" },
  ];

  const displayName = farmSettings?.studName || farmSettings?.farmName || null;

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row pb-14 md:pb-0 font-sans">
      {/* Sidebar (Desktop) */}
      <aside className="hidden md:flex flex-col w-64 border-r border-border bg-card fixed h-full z-50">
        <Link href="/" className="p-6 border-b border-border flex flex-col items-center cursor-pointer hover:bg-secondary/30 transition-colors">
          <img src={logo} alt="BreedLog" className="w-32 h-32 object-contain" data-testid="logo-desktop" />
          <p className="text-xs text-primary/80 mt-2 uppercase tracking-widest font-semibold drop-shadow-[0_0_6px_rgba(255,195,0,0.4)]">Breed Smart. Farm Better.</p>
        </Link>
        
        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`} className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-md transition-all duration-200 font-medium uppercase tracking-wide text-sm",
              location === item.href 
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 font-bold" 
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            )}>
              <item.icon className="w-5 h-5" />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-border">
          <div className="bg-secondary/50 p-3 rounded-md">
            <p className="text-xs text-muted-foreground font-mono">BreedLog v1.0.0</p>
            <p className="text-xs text-primary/80 mt-1 font-bold">ONLINE</p>
          </div>
        </div>
      </aside>

      {/* Mobile Header - Collapses to icon on scroll */}
      <header className={cn(
        "md:hidden bg-background sticky top-0 z-40 transition-all duration-300",
        isScrolled ? "py-2" : "py-4"
      )}>
        <Link href="/" className="flex flex-col items-center px-4">
          {/* Logo with box frame */}
          <div className={cn(
            "relative flex items-center justify-center transition-all duration-300 rounded-lg border-2 border-primary/50 bg-gradient-to-br from-primary/10 via-transparent to-primary/5 shadow-[0_0_20px_rgba(255,195,0,0.15)]",
            isScrolled ? "w-12 h-12 p-1" : "w-28 h-28 p-3"
          )}>
            <img 
              src={logo} 
              alt="BreedLog" 
              className="w-full h-full object-contain drop-shadow-[0_0_12px_rgba(255,195,0,0.4)]" 
              data-testid="logo-mobile" 
            />
          </div>
          
          {/* Tagline - hidden when scrolled */}
          <div className={cn(
            "flex flex-col items-center overflow-hidden transition-all duration-300",
            isScrolled ? "max-h-0 opacity-0 mt-0" : "max-h-12 opacity-100 mt-3"
          )}>
            <ScrambleText 
              text="Breed Smart. Farm Better." 
              className="text-[11px] uppercase tracking-[0.2em] font-semibold text-primary drop-shadow-[0_0_8px_rgba(255,195,0,0.6)]"
            />
          </div>
        </Link>
      </header>

      {/* Main Content - Compact padding on mobile */}
      <main className="flex-1 md:ml-64 p-2.5 md:p-8 overflow-y-auto min-h-[calc(100vh-4rem)] md:min-h-screen">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>

      {/* Bottom Nav (Mobile) - Compact but readable */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border h-14 flex items-center justify-around z-50 px-1 pb-safe">
        {navItems.map((item) => (
          <Link key={item.href} href={item.href} data-testid={`mobile-nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`} className={cn(
            "flex flex-col items-center justify-center p-1 rounded-md transition-colors w-full h-full",
            location === item.href 
              ? "text-primary" 
              : "text-muted-foreground hover:text-primary"
          )}>
            <item.icon className={cn("w-5 h-5 text-primary", location === item.href && "fill-current")} />
            <span className="text-[10px] font-semibold uppercase mt-0.5 text-primary">{item.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
