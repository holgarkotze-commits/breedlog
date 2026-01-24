import { Link, useLocation } from "wouter";
import { LayoutDashboard, Beef, Dna, FileText, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import logo from "@assets/BREEDLOG_LOGO_1768730745128.png";
import { useFarmSettings } from "@/hooks/use-farm-settings";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { data: farmSettings } = useFarmSettings();

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
          <p className="text-xs text-muted-foreground mt-2 uppercase tracking-widest font-medium">Breed Smart. Farm Better.</p>
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

      {/* Mobile Header - Elegant centered design */}
      <header className="md:hidden bg-gradient-to-b from-card via-card to-background border-b border-border/50 sticky top-0 z-40">
        <Link href="/" className="flex flex-col items-center py-4 px-4">
          {/* Premium Logo Container with elegant glow */}
          <div className="relative mb-3">
            <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl scale-150" />
            <div className="relative w-20 h-20 flex items-center justify-center">
              <img 
                src={logo} 
                alt="BreedLog" 
                className="w-full h-full object-contain drop-shadow-[0_0_15px_rgba(255,195,0,0.4)]" 
                data-testid="logo-mobile" 
              />
            </div>
          </div>
          
          {/* App Name with premium gradient */}
          <span className="text-2xl font-black tracking-tight bg-gradient-to-r from-primary via-yellow-300 to-primary bg-clip-text text-transparent drop-shadow-sm mb-1">
            BREEDLOG
          </span>
          
          {/* Tagline with elegant styling */}
          <span className="text-[11px] text-muted-foreground uppercase tracking-[0.2em] font-medium">
            Breed Smart. Farm Better.
          </span>
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
              : "text-muted-foreground hover:text-foreground"
          )}>
            <item.icon className={cn("w-5 h-5", location === item.href && "fill-current")} />
            <span className="text-[10px] font-semibold uppercase mt-0.5">{item.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
