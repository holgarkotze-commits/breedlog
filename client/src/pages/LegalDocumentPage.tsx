import { ArrowLeft, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link, useLocation, useRoute } from "wouter";
import { LEGAL_DOCUMENTS, type LegalDocumentKey } from "@/content/legal";

const LEGAL_LINKS: Array<{ href: string; key: LegalDocumentKey; label: string }> = [
  { href: "/legal/privacy", key: "privacy", label: "Privacy" },
  { href: "/legal/terms", key: "terms", label: "Terms" },
  { href: "/legal/subscription", key: "subscription", label: "Subscription Terms" },
  { href: "/legal/account-deletion", key: "account-deletion", label: "Account Deletion" },
];

export default function LegalDocumentPage() {
  const [, navigate] = useLocation();
  const [, params] = useRoute("/legal/:document");
  const key = params?.document as LegalDocumentKey | undefined;
  const document = key ? LEGAL_DOCUMENTS[key] : undefined;

  if (!document) {
    return (
      <div className="min-h-screen bg-background px-4 py-8">
        <div className="mx-auto max-w-3xl">
          <Button variant="ghost" className="-ml-3 mb-4" onClick={() => navigate("/")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Card>
            <CardContent className="p-6">
              <h1 className="text-xl font-bold">Legal document not found</h1>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-6 md:py-10">
      <div className="mx-auto max-w-4xl space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" className="-ml-3" onClick={() => navigate("/")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          {LEGAL_LINKS.map((item) => (
            <Button
              key={item.href}
              variant={item.key === document.key ? "default" : "outline"}
              size="sm"
              asChild
            >
              <Link href={item.href}>{item.label}</Link>
            </Button>
          ))}
        </div>

        <Card className="rugged-card">
          <CardHeader className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <CardTitle className="text-2xl md:text-3xl">{document.title}</CardTitle>
                <p className="text-sm text-muted-foreground">{document.subtitle}</p>
              </div>
              <Badge variant="outline">{document.lastUpdated}</Badge>
            </div>
            <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-300">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>{document.reviewStatus}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {document.sections.map((section) => (
              <section key={section.heading} className="space-y-2">
                <h2 className="text-lg font-semibold">{section.heading}</h2>
                {section.body.map((paragraph) => (
                  <p key={paragraph} className="text-sm leading-7 text-muted-foreground">
                    {paragraph}
                  </p>
                ))}
              </section>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
