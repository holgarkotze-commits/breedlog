import { Link } from "wouter";
import { ArrowRight, FileText, LockKeyhole, MonitorSmartphone, Sprout as Sheep } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function TrialWelcome() {
  return (
    <main className="abstract-bg min-h-[100dvh] px-4 py-8 sm:flex sm:items-center sm:justify-center">
      <Card className="rugged-card relative z-10 mx-auto w-full max-w-3xl overflow-hidden">
        <div className="grid md:grid-cols-[1.1fr_0.9fr]">
          <div className="p-6 sm:p-9">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Sheep className="h-6 w-6" /></div>
            <p className="mt-7 text-xs font-bold uppercase tracking-[0.2em] text-primary">Your farm book is ready</p>
            <CardHeader className="px-0 pb-0 pt-2">
              <CardTitle className="text-3xl leading-tight sm:text-4xl">Start with the flock you have.</CardTitle>
              <CardDescription className="mt-3 max-w-md text-sm leading-6">Your private BREEDLOG workspace is open. Add animals when you are ready; your records stay yours.</CardDescription>
            </CardHeader>
            <CardContent className="px-0 pb-0 pt-7">
              <Button asChild className="rugged-btn w-full sm:w-auto" data-testid="button-trial-add-animals">
                <Link href="/animals">Open animal register <ArrowRight /></Link>
              </Button>
              <p className="mt-5 text-xs text-muted-foreground">No card required. No charge. Start with the free trial limits.</p>
            </CardContent>
          </div>
          <aside className="border-t border-border bg-secondary/45 p-6 sm:p-8 md:border-l md:border-t-0">
            <h2 className="text-base font-bold">Included on the free plan</h2>
            <div className="mt-5 space-y-4">
              <div className="flex items-start gap-3"><div className="mt-0.5 rounded-lg bg-card p-2 text-primary"><Sheep className="h-4 w-4" /></div><div><p className="text-sm font-semibold">30 active animals</p><p className="mt-0.5 text-xs text-muted-foreground">Room for your working flock.</p></div></div>
              <div className="flex items-start gap-3"><div className="mt-0.5 rounded-lg bg-card p-2 text-primary"><MonitorSmartphone className="h-4 w-4" /></div><div><p className="text-sm font-semibold">1 active device</p><p className="mt-0.5 text-xs text-muted-foreground">Keep one signed-in device at a time.</p></div></div>
              <div className="flex items-start gap-3"><div className="mt-0.5 rounded-lg bg-card p-2 text-primary"><FileText className="h-4 w-4" /></div><div><p className="text-sm font-semibold">5 individual PDFs each month</p><p className="mt-0.5 text-xs text-muted-foreground">Print the records you need.</p></div></div>
            </div>
            <div className="mt-6 rounded-xl border border-border bg-card/75 p-4">
              <div className="flex items-center gap-2"><LockKeyhole className="h-4 w-4 text-primary" /><p className="text-sm font-semibold">Your data stays private</p></div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">Public sign-up starts an empty, private farm workspace. No invitation is needed. Paid plans and AI features are coming soon.</p>
            </div>
            <Button asChild variant="outline" className="mt-5 w-full" data-testid="button-trial-settings">
              <Link href="/settings">Review settings <ArrowRight /></Link>
            </Button>
            <p className="mt-6 text-[11px] text-muted-foreground">Made for sheep farmers by <span className="font-bold text-foreground">STITCH WORX</span></p>
          </aside>
        </div>
      </Card>
    </main>
  );
}
