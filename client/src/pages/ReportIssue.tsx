import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, Bug, CheckCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { isInstalledBreedLogRuntime } from "@/lib/runtime-updates";
import { FIELD_TEST_VERSION_LABEL } from "@shared/version";
import { usePWAInstall } from "@/hooks/use-pwa-install";

const APP_AREAS = [
  "Login / Access Code",
  "Install / PWA",
  "My Herd",
  "Add / Edit Animal",
  "Rams",
  "Ewes",
  "Lambs",
  "Breeding",
  "Mating Groups",
  "Health",
  "Weights",
  "Records",
  "Exported Documents",
  "Exports",
  "Sync",
  "Ask BreedLog",
  "Settings",
  "Data Tab",
  "Other",
] as const;

const SEVERITY_OPTIONS = [
  { value: "low", label: "Low — minor issue, app still works" },
  { value: "medium", label: "Medium — feature not working correctly" },
  { value: "high", label: "High — significant feature broken" },
  { value: "blocking", label: "Blocking — cannot use the app" },
] as const;

const DEVICE_TYPES = [
  { value: "phone", label: "Phone" },
  { value: "tablet", label: "Tablet" },
  { value: "desktop", label: "Desktop / Laptop" },
] as const;

const issueSchema = z.object({
  title: z.string().min(5, "Please provide a short title (at least 5 characters)").max(120),
  description: z.string().min(10, "Please describe what happened (at least 10 characters)").max(2000),
  area: z.string().min(1, "Please select the area of the app"),
  severity: z.enum(["low", "medium", "high", "blocking"]),
  deviceType: z.enum(["phone", "tablet", "desktop"]),
  contactName: z.string().max(80).optional(),
});

type IssueFormValues = z.infer<typeof issueSchema>;

function detectAppMode(isInstalled: boolean): string {
  if (isInstalled) return "installed";
  if (isInstalledBreedLogRuntime()) return "installed";
  if (window.location.protocol === "file:") return "unknown";
  return "browser";
}

function detectDeviceType(): "phone" | "tablet" | "desktop" {
  const ua = navigator.userAgent.toLowerCase();
  if (/ipad|tablet|playbook|silk/.test(ua)) return "tablet";
  if (/iphone|android.*mobile|mobile/.test(ua)) return "phone";
  return "desktop";
}

export default function ReportIssuePage() {
  const [, navigate] = useLocation();
  const [submitted, setSubmitted] = useState(false);
  const [submittedId, setSubmittedId] = useState<number | null>(null);
  const { isInstalled } = usePWAInstall();

  const currentRoute = window.location.pathname;
  const appMode = detectAppMode(isInstalled);
  const defaultDevice = detectDeviceType();

  const form = useForm<IssueFormValues>({
    resolver: zodResolver(issueSchema),
    defaultValues: {
      title: "",
      description: "",
      area: "",
      severity: "medium",
      deviceType: defaultDevice,
      contactName: "",
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (values: IssueFormValues) => {
      const payload = {
        ...values,
        appMode,
        currentRoute,
        appVersion: FIELD_TEST_VERSION_LABEL,
      };
      const res = await apiRequest("POST", "/api/field-issues", payload);
      return res.json();
    },
    onSuccess: (data) => {
      setSubmittedId(data.id ?? null);
      setSubmitted(true);
    },
  });

  const onSubmit = (values: IssueFormValues) => {
    submitMutation.mutate(values);
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-background pb-24 md:pb-8">
        <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" className="-ml-1" onClick={() => navigate(-1 as any)} data-testid="button-report-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="font-bold text-base">Report an Issue</h1>
        </div>
        <div className="max-w-lg mx-auto px-4 pt-12 text-center">
          <div className="flex justify-center mb-4">
            <CheckCircle className="h-14 w-14 text-green-500" />
          </div>
          <h2 className="text-xl font-bold mb-2">Report Submitted</h2>
          <p className="text-muted-foreground mb-2">
            Thank you — your report has been received by the BreedLog team.
          </p>
          {submittedId && (
            <p className="text-sm text-muted-foreground mb-6">
              Reference: Issue <span className="font-mono font-semibold">#{submittedId}</span>
            </p>
          )}
          <div className="flex flex-col gap-3 max-w-xs mx-auto">
            <Button onClick={() => { setSubmitted(false); form.reset(); }} data-testid="button-report-another">
              Report Another Issue
            </Button>
            <Button variant="outline" onClick={() => navigate(-1 as any)} data-testid="button-report-done">
              Done
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-8">
      <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3 flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="-ml-1"
          onClick={() => history.length > 1 ? history.back() : navigate("/settings")}
          data-testid="button-report-back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="font-bold text-base leading-tight">Report an Issue</h1>
          <p className="text-xs text-muted-foreground">BreedLog field test feedback</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4">
        <Alert className="mb-4">
          <Bug className="h-4 w-4" />
          <AlertDescription className="text-sm">
            Found a problem? Tell us what happened. Your feedback helps improve BreedLog before full release.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Issue Details</CardTitle>
            <CardDescription>
              Be as specific as possible — describe exactly what you did and what went wrong.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Issue Title <span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g. Sync button does not respond when offline"
                          {...field}
                          data-testid="input-issue-title"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description <span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="What happened? What did you expect? What steps led to the problem?"
                          className="min-h-[100px] resize-none"
                          {...field}
                          data-testid="input-issue-description"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="area"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Area of App <span className="text-destructive">*</span></FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-issue-area">
                              <SelectValue placeholder="Select area..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {APP_AREAS.map((area) => (
                              <SelectItem key={area} value={area}>{area}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="severity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Severity <span className="text-destructive">*</span></FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-issue-severity">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {SEVERITY_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="deviceType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Device Type <span className="text-destructive">*</span></FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-issue-device">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {DEVICE_TYPES.map((d) => (
                            <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="contactName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Your Name <span className="text-muted-foreground text-xs">(optional)</span></FormLabel>
                      <FormControl>
                        <Input
                          placeholder="First name or farm name"
                          {...field}
                          data-testid="input-issue-contact"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground space-y-0.5">
                  <p><span className="font-medium">Auto-captured:</span> App mode ({appMode}) · Route ({currentRoute}) · Version ({FIELD_TEST_VERSION_LABEL})</p>
                </div>

                {submitMutation.isError && (
                  <Alert variant="destructive">
                    <AlertDescription>
                      Failed to submit your report. Please check your connection and try again.
                    </AlertDescription>
                  </Alert>
                )}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={submitMutation.isPending}
                  data-testid="button-submit-issue"
                >
                  {submitMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Bug className="mr-2 h-4 w-4" />
                      Submit Report
                    </>
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
