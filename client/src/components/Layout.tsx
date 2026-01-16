import { Link, useLocation } from "wouter";
import { Home, Clipboard, Activity, BrainCircuit, Settings, Plus, Menu } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const navItems = [
    { href: "/", label: "Dashboard", icon: Home },
    { href: "/animals", label: "Animals", icon: Clipboard },
    { href: "/breeding", label: "Breeding", icon: Activity },
    { href: "/ai-valuation", label: "AI Val", icon: BrainCircuit },
    { href: "/settings", label: "Settings", icon: Settings },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground font-sans">
      {/* Mobile Header */}
      <header className="sticky top-0 z-50 flex items-center justify-between p-4 bg-background/80 backdrop-blur-md border-b border-border md:hidden">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary text-black font-black flex items-center justify-center rounded-sm">
            BL
          </div>
          <span className="font-display font-black text-xl tracking-tighter">BREEDLOG</span>
        </div>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="text-foreground">
              <Menu className="w-6 h-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[80%] bg-card border-r border-border p-0">
            <div className="p-6 border-b border-border bg-secondary/30">
              <h2 className="font-display font-black text-2xl text-primary">MENU</h2>
            </div>
            <nav className="flex flex-col p-4 gap-2">
              {navItems.map((item) => (
                <Link key={item.href} href={item.href} className={cn(
                  "flex items-center gap-4 px-4 py-3 rounded-md text-lg font-bold transition-all",
                  location === item.href 
                    ? "bg-primary text-black shadow-md translate-x-2" 
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}>
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </Link>
              ))}
            </nav>
          </SheetContent>
        </Sheet>
      </header>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col fixed left-0 top-0 h-full w-64 bg-card border-r border-border">
        <div className="p-8 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary text-black font-black text-xl flex items-center justify-center rounded-md shadow-[0_0_15px_rgba(255,195,0,0.3)]">
              BL
            </div>
            <span className="font-display font-black text-2xl tracking-tighter">BREEDLOG</span>
          </div>
        </div>
        
        <nav className="flex-1 flex flex-col p-6 gap-2">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-md text-sm font-bold uppercase tracking-wider transition-all duration-200 group",
              location === item.href 
                ? "bg-primary text-primary-foreground shadow-[0_4px_12px_rgba(255,195,0,0.2)]" 
                : "text-muted-foreground hover:bg-secondary hover:text-foreground hover:translate-x-1"
            )}>
              <item.icon className={cn("w-5 h-5", location === item.href ? "stroke-2" : "stroke-1.5")} />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="p-6 border-t border-border">
          <div className="bg-secondary/50 rounded-lg p-4 border border-border/50">
            <p className="text-xs text-muted-foreground font-mono">BreedLog v1.0.0</p>
            <p className="text-xs text-primary/80 mt-1">Status: Online</p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 md:ml-64 p-4 md:p-8 overflow-x-hidden pb-24 md:pb-8">
        <div className="max-w-7xl mx-auto w-full">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full bg-card border-t border-border z-40 pb-safe">
        <div className="flex justify-around items-center h-16">
          {navItems.slice(0, 4).map((item) => (
            <Link key={item.href} href={item.href} className={cn(
              "flex flex-col items-center justify-center w-full h-full gap-1 transition-colors",
              location === item.href ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )}>
              <item.icon className={cn("w-6 h-6", location === item.href && "fill-current/20")} />
              <span className="text-[10px] font-bold uppercase">{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
