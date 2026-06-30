import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Plus, Copy, Ban, Users, Key, Calendar, Loader2, ArrowLeft, ShieldCheck, LogOut, RefreshCw, Trash2, Pencil, Check, X, Monitor, Smartphone, Search, RotateCcw, CalendarPlus, Bug, ChevronDown, ChevronUp, MessageSquare, Activity, Clock, TrendingUp, Zap, Download, Timer, Wifi, BarChart2, UserCheck } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, formatDistanceToNow } from "date-fns";
import { Link } from "wouter";

interface FieldIssue {
  id: number;
  userId: string | null;
  inviteCodeRef: string | null;
  title: string;
  description: string;
  area: string;
  severity: string;
  deviceType: string | null;
  appMode: string | null;
  contactName: string | null;
  currentRoute: string | null;
  appVersion: string | null;
  status: string;
  adminNotes: string | null;
  emailSent: boolean;
  createdAt: string;
  updatedAt: string;
}

interface InviteCode {
  id: number;
  code: string;
  status: string;
  expiresAt: string;
  maxUses: number;
  usesCount: number;
  notes: string | null;
  createdAt: string;
  slots?: {
    desktop: { taken: boolean; activatedAt?: string };
    mobile: { taken: boolean; activatedAt?: string };
  };
}

interface InviteCodesResponse {
  codes: InviteCode[];
  activeTesters: number;
  maxTesters: number;
}

interface AdminActivityUser {
  userId: string;
  deviceId: string;
  deviceType: string | null;
  inviteCode: string | null;
  activatedAt: string | null;
  lastSeen: string | null;
  lastSync: string | null;
  lastSessionStart: string | null;
  lastSessionEnd: string | null;
  estimatedTimeSpentSeconds: number;
  sessionCount: number;
  activityScore: number;
  exportDownloadCount: number;
  lastFeatureUsed: string | null;
  status: string;
}

interface AdminActivitySummary {
  totalActivatedUsers: number;
  activeToday: number;
  activeLast7Days: number;
  recentlySeen: number;
  usersWithSyncActivity: number;
  usersWithNoActivity: number;
  totalSessions: number;
  avgSessionDurationSeconds: number;
  exportDownloadCount: number;
  mostActiveTesters: AdminActivityUser[];
}

interface AdminActivityUserDetail extends AdminActivityUser {
  recentEvents: Array<{
    id: number;
    eventType: string;
    eventCategory: string | null;
    route: string | null;
    feature: string | null;
    occurredAt: string;
  }>;
  sessions7d: Array<{
    id: number;
    sessionId: string;
    startedAt: string;
    lastHeartbeatAt: string;
    endedAt: string | null;
    durationSeconds: number | null;
    isActive: boolean;
  }>;
}

interface DbInfo {
  env: string;
  isProduction: boolean;
  dbHost: string;
  dbName: string;
  totalCodesCount: number;
  activationsCount: number;
  codesList: string;
  serverTime: string;
  appVersion: string;
}

const ADMIN_AUTH_KEY = "breedlog_admin_authed";
const ADMIN_AUTH_TIME_KEY = "breedlog_admin_authed_at";
const ADMIN_PIN_KEY = "breedlog_admin_pin";
const ADMIN_SESSION_DURATION_MS = 24 * 60 * 60 * 1000;

function checkAdminAuth(): boolean {
  try {
    const authed = localStorage.getItem(ADMIN_AUTH_KEY);
    const authedAt = localStorage.getItem(ADMIN_AUTH_TIME_KEY);
    const pin = localStorage.getItem(ADMIN_PIN_KEY);
    
    console.log("[Admin Guard] Checking auth:", { authed, authedAt, hasPin: !!pin });
    
    if (authed !== "true" || !authedAt || !pin) {
      console.log("[Admin Guard] Not authenticated - missing keys");
      return false;
    }
    
    const authedTime = new Date(authedAt).getTime();
    const now = Date.now();
    const elapsed = now - authedTime;
    
    if (elapsed > ADMIN_SESSION_DURATION_MS) {
      console.log("[Admin Guard] Session expired:", { elapsed, max: ADMIN_SESSION_DURATION_MS });
      clearAdminAuth();
      return false;
    }
    
    console.log("[Admin Guard] Valid session, remaining:", Math.round((ADMIN_SESSION_DURATION_MS - elapsed) / 1000 / 60), "minutes");
    return true;
  } catch (err) {
    console.error("[Admin Guard] Error checking auth:", err);
    return false;
  }
}

function setAdminAuth(pin: string): void {
  const now = new Date().toISOString();
  localStorage.setItem(ADMIN_AUTH_KEY, "true");
  localStorage.setItem(ADMIN_AUTH_TIME_KEY, now);
  localStorage.setItem(ADMIN_PIN_KEY, pin);
  console.log("[Admin Login] Auth stored:", { key: ADMIN_AUTH_KEY, time: now });
}

function getAdminPin(): string | null {
  return localStorage.getItem(ADMIN_PIN_KEY);
}

function clearAdminAuth(): void {
  localStorage.removeItem(ADMIN_AUTH_KEY);
  localStorage.removeItem(ADMIN_AUTH_TIME_KEY);
  localStorage.removeItem(ADMIN_PIN_KEY);
  console.log("[Admin Logout] Auth cleared");
}

async function adminApiRequest(method: string, url: string, body?: any): Promise<Response> {
  const pin = getAdminPin();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Cache-Control": "no-cache, no-store, must-revalidate",
    "Pragma": "no-cache",
  };
  
  if (pin) {
    headers["Authorization"] = `AdminPin ${pin}`;
  }
  
  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include",
    cache: "no-store",
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: "Request failed" }));
    throw new Error(errorData.message || `Request failed: ${response.status}`);
  }
  
  return response;
}

export default function AdminPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newCodeNotes, setNewCodeNotes] = useState("");
  const [newCodeExpiry, setNewCodeExpiry] = useState(30);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [adminPin, setAdminPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  
  useEffect(() => {
    const authed = checkAdminAuth();
    console.log("[Admin Page] Initial auth check result:", authed);
    setIsAuthenticated(authed);
  }, []);
  
  const handleLogin = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log("[Admin Login] Form submitted, PIN length:", adminPin.length);
    
    if (!adminPin.trim()) {
      setPinError("Please enter a PIN");
      return;
    }
    
    setIsLoggingIn(true);
    setPinError("");
    
    try {
      console.log("[Admin Login] Sending login request...");
      const response = await apiRequest("POST", "/api/admin/login", { pin: adminPin });
      const data = await response.json();
      
      console.log("[Admin Login] Server response:", data);
      
      if (data.success) {
        setAdminAuth(adminPin);
        setIsAuthenticated(true);
        setAdminPin("");
        console.log("[Admin Login] SUCCESS - user is now authenticated");
        toast({
          title: "Welcome",
          description: "Admin access granted",
        });
      } else {
        console.log("[Admin Login] Failed - invalid response");
        setPinError("Login failed");
      }
    } catch (err: any) {
      console.error("[Admin Login] Error:", err);
      setPinError(err.message || "Invalid PIN");
    } finally {
      setIsLoggingIn(false);
    }
  }, [adminPin, toast]);
  
  const handleLogout = useCallback(() => {
    console.log("[Admin Logout] Logging out...");
    clearAdminAuth();
    setIsAuthenticated(false);
    apiRequest("POST", "/api/admin/logout", {}).catch(() => {});
    toast({
      title: "Logged Out",
      description: "You have been logged out of the admin panel.",
    });
  }, [toast]);
  
  const { data: codesData, isLoading: loadingCodes, error } = useQuery<InviteCodesResponse>({
    queryKey: ["/api/admin/invite-codes"],
    queryFn: async () => {
      const response = await adminApiRequest("GET", "/api/admin/invite-codes");
      return response.json();
    },
    enabled: isAuthenticated === true,
  });
  
  const { data: dbInfo } = useQuery<DbInfo>({
    queryKey: ["/api/admin/db-info"],
    queryFn: async () => {
      const response = await adminApiRequest("GET", "/api/admin/db-info");
      return response.json();
    },
    enabled: isAuthenticated === true,
  });
  
  const createCodeMutation = useMutation({
    mutationFn: async () => {
      const response = await adminApiRequest("POST", "/api/admin/invite-codes", {
        notes: newCodeNotes || null,
        expiryDays: newCodeExpiry,
        maxUses: 1
      });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/invite-codes"] });
      toast({
        title: "Code Created",
        description: `New code: ${data.code}`,
      });
      setNewCodeNotes("");
      setIsDialogOpen(false);
    },
    onError: (err: Error) => {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive"
      });
    }
  });
  
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const handleHardRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      // Force cache bust with timestamp
      const timestamp = Date.now();
      await Promise.all([
        adminApiRequest("GET", `/api/admin/invite-codes?t=${timestamp}`),
        adminApiRequest("GET", `/api/admin/db-info?t=${timestamp}`)
      ]);
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/invite-codes"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/db-info"] });
      toast({
        title: "Data Refreshed",
        description: "Loaded latest data from database",
      });
    } catch (err: any) {
      toast({
        title: "Refresh Failed",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setIsRefreshing(false);
    }
  }, [queryClient, toast]);
  
  const deleteCodeMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await adminApiRequest("DELETE", `/api/admin/invite-codes/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/invite-codes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/db-info"] });
      toast({
        title: "Code Deleted",
        description: "The unused code has been permanently removed.",
      });
    },
    onError: (err: Error) => {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive"
      });
    }
  });
  
  const revokeCodeMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await adminApiRequest("POST", `/api/admin/invite-codes/${id}/revoke`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/invite-codes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/db-info"] });
      toast({
        title: "Code Revoked",
        description: "The access code has been revoked and all linked users have lost access.",
      });
    },
    onError: (err: Error) => {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive"
      });
    }
  });
  
  // Max Testers editing state
  const [isEditingMaxTesters, setIsEditingMaxTesters] = useState(false);
  const [editMaxTestersValue, setEditMaxTestersValue] = useState("");
  
  const updateMaxTestersMutation = useMutation({
    mutationFn: async (newMax: number) => {
      const response = await adminApiRequest("PUT", "/api/admin/settings/max-testers", {
        maxTesters: newMax
      });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/invite-codes"] });
      setIsEditingMaxTesters(false);
      toast({
        title: "Limit Updated",
        description: `Max testers changed to ${data.maxTesters}`,
      });
    },
    onError: (err: Error) => {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive"
      });
    }
  });
  
  const handleEditMaxTesters = () => {
    setEditMaxTestersValue(String(codesData?.maxTesters ?? 50));
    setIsEditingMaxTesters(true);
  };
  
  const handleSaveMaxTesters = () => {
    const newMax = parseInt(editMaxTestersValue, 10);
    if (isNaN(newMax) || newMax < 1) {
      toast({
        title: "Invalid Value",
        description: "Please enter a positive number",
        variant: "destructive"
      });
      return;
    }
    updateMaxTestersMutation.mutate(newMax);
  };
  
  // Diagnostic code lookup state
  const [lookupCode, setLookupCode] = useState("");
  const [lookupResult, setLookupResult] = useState<any>(null);
  const [lookupLoading, setLookupLoading] = useState(false);

  // Field Issues state
  const [issueStatusFilter, setIssueStatusFilter] = useState("all");
  const [issueSeverityFilter, setIssueSeverityFilter] = useState("all");
  const [expandedIssue, setExpandedIssue] = useState<number | null>(null);
  const [issueNotesMap, setIssueNotesMap] = useState<Record<number, string>>({});

  const { data: fieldIssues = [], isLoading: loadingIssues } = useQuery<FieldIssue[]>({
    queryKey: ["/api/admin/field-issues", issueStatusFilter, issueSeverityFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (issueStatusFilter !== "all") params.set("status", issueStatusFilter);
      if (issueSeverityFilter !== "all") params.set("severity", issueSeverityFilter);
      const res = await adminApiRequest("GET", `/api/admin/field-issues?${params.toString()}`);
      return res.json();
    },
    enabled: isAuthenticated === true,
  });

  const updateIssueMutation = useMutation({
    mutationFn: async ({ id, status, adminNotes }: { id: number; status?: string; adminNotes?: string }) => {
      const res = await adminApiRequest("PATCH", `/api/admin/field-issues/${id}`, { status, adminNotes });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/field-issues"] });
      toast({ title: "Issue updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  // ── Activity Dashboard state ────────────────────────────────────────────────
  const [activitySortBy, setActivitySortBy] = useState("activityScore");
  const [activityFilterBy, setActivityFilterBy] = useState("all");
  const [selectedActivityUser, setSelectedActivityUser] = useState<string | null>(null);

  const { data: activitySummary, isLoading: loadingActivitySummary, refetch: refetchActivitySummary } = useQuery<AdminActivitySummary>({
    queryKey: ["/api/admin/activity/summary"],
    queryFn: async () => {
      const res = await adminApiRequest("GET", "/api/admin/activity/summary");
      return res.json();
    },
    enabled: isAuthenticated === true,
    refetchInterval: 60_000,
  });

  const { data: activityUsers = [], isLoading: loadingActivityUsers } = useQuery<AdminActivityUser[]>({
    queryKey: ["/api/admin/activity/users", activitySortBy, activityFilterBy],
    queryFn: async () => {
      const params = new URLSearchParams({ sortBy: activitySortBy });
      if (activityFilterBy !== "all") params.set("filterBy", activityFilterBy);
      const res = await adminApiRequest("GET", `/api/admin/activity/users?${params.toString()}`);
      return res.json();
    },
    enabled: isAuthenticated === true,
  });

  const { data: selectedUserDetail, isLoading: loadingUserDetail } = useQuery<AdminActivityUserDetail>({
    queryKey: ["/api/admin/activity/users", selectedActivityUser],
    queryFn: async () => {
      const res = await adminApiRequest("GET", `/api/admin/activity/users/${selectedActivityUser}`);
      return res.json();
    },
    enabled: isAuthenticated === true && selectedActivityUser !== null,
  });

  const handleLookupCode = async () => {
    if (!lookupCode.trim()) return;
    setLookupLoading(true);
    setLookupResult(null);
    try {
      const response = await adminApiRequest("GET", `/api/admin/invite-codes/lookup/${lookupCode.trim().toUpperCase()}`);
      const data = await response.json();
      setLookupResult({ ...data, error: false });
    } catch (err: any) {
      setLookupResult({ error: true, message: err.message });
    } finally {
      setLookupLoading(false);
    }
  };

  // Reset a device slot for a code
  const resetSlotMutation = useMutation({
    mutationFn: async ({ id, slotType }: { id: number; slotType: string }) => {
      const response = await adminApiRequest("POST", `/api/admin/invite-codes/${id}/reset-slot`, { slotType });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/invite-codes"] });
      toast({ title: "Slot Reset", description: data.message });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({
      title: "Copied",
      description: "Code copied to clipboard",
    });
  };
  
  // Status reflects ONLY the code's own usability (revoked / expired / active).
  // Slot occupancy is shown separately in the "Device Slots" column — a code with
  // both slots taken is still "Active" (it just has no free slots right now).
  const getStatusBadge = (code: InviteCode) => {
    if (code.status === "revoked") {
      return <Badge variant="destructive">Revoked</Badge>;
    }
    if (code.status === "expired" || new Date(code.expiresAt) < new Date()) {
      return <Badge variant="secondary">Expired</Badge>;
    }
    return <Badge variant="default">Active</Badge>;
  };

  const reactivateCodeMutation = useMutation({
    mutationFn: async ({ id, extendDays }: { id: number; extendDays?: number }) => {
      const response = await adminApiRequest("POST", `/api/admin/invite-codes/${id}/reactivate`, { extendDays });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/invite-codes"] });
      toast({ title: "Code Reactivated", description: data.message ?? "Code is active again." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const extendExpiryMutation = useMutation({
    mutationFn: async ({ id, days }: { id: number; days: number }) => {
      const response = await adminApiRequest("POST", `/api/admin/invite-codes/${id}/extend-expiry`, { days });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/invite-codes"] });
      toast({
        title: "Expiry Extended",
        description: `New expiry: ${data.code?.expiresAt ? format(new Date(data.code.expiresAt), "MMM d, yyyy") : "updated"}`,
      });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleExtendExpiry = (id: number) => {
    const input = window.prompt("Extend expiry by how many days?", "30");
    if (!input) return;
    const days = parseInt(input, 10);
    if (Number.isNaN(days) || days <= 0) {
      toast({ title: "Invalid Value", description: "Enter a positive number of days", variant: "destructive" });
      return;
    }
    extendExpiryMutation.mutate({ id, days });
  };

  const handleReactivate = (id: number) => {
    const input = window.prompt(
      "Reactivate this code. If the code is past expiry, enter days to extend it for (leave blank for default 30).",
      ""
    );
    if (input === null) return;
    const trimmed = input.trim();
    const extendDays = trimmed.length > 0 ? parseInt(trimmed, 10) : undefined;
    if (trimmed.length > 0 && (Number.isNaN(extendDays!) || (extendDays as number) <= 0)) {
      toast({ title: "Invalid Value", description: "Days must be a positive number", variant: "destructive" });
      return;
    }
    reactivateCodeMutation.mutate({ id, extendDays });
  };
  
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <ShieldCheck className="h-8 w-8 text-primary" />
            </div>
            <CardTitle>Admin Access</CardTitle>
            <CardDescription>
              Enter the admin PIN to manage beta access codes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <Input
                  type="password"
                  placeholder="Enter admin PIN"
                  value={adminPin}
                  onChange={(e) => setAdminPin(e.target.value)}
                  className="text-center text-lg tracking-widest"
                  data-testid="input-admin-pin"
                  autoFocus
                  autoComplete="off"
                />
              </div>
              
              {pinError && (
                <Alert variant="destructive">
                  <AlertDescription>{pinError}</AlertDescription>
                </Alert>
              )}
              
              <Button 
                type="submit" 
                className="w-full" 
                disabled={!adminPin.trim() || isLoggingIn}
                data-testid="button-admin-login"
              >
                {isLoggingIn ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Key className="mr-2 h-4 w-4" />
                )}
                Access Admin Panel
              </Button>
            </form>
            
            <Button asChild variant="ghost" className="w-full mt-4">
              <Link href="/">Return to App</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <ShieldCheck className="h-6 w-6 text-primary" />
                Beta Access Admin
              </h1>
              <p className="text-muted-foreground">Manage invite codes and testers</p>
            </div>
          </div>
          <Button 
            variant="outline" 
            onClick={handleLogout}
            data-testid="button-admin-logout"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>
        
        {/* Database Identity - CRITICAL for verifying prod/dev consistency */}
        <Alert className="mb-4 border-primary/50 bg-primary/10">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <span className="text-sm">
                <span className="font-semibold">Database:</span>{" "}
                {dbInfo ? (
                  <>
                    {dbInfo.isProduction ? (
                      <Badge variant="default" className="mx-1 bg-green-600">PRODUCTION MODE</Badge>
                    ) : (
                      <Badge variant="outline" className="mx-1 border-amber-500 text-amber-500">DEVELOPMENT MODE</Badge>
                    )}
                    <span className="text-muted-foreground">{dbInfo.dbName} @ {dbInfo.dbHost}</span>
                    <span className="mx-2">|</span>
                    <span className="font-medium">{dbInfo.totalCodesCount} codes</span>
                    <span className="mx-1">|</span>
                    <span className="font-medium">{dbInfo.activationsCount} activations</span>
                    <span className="mx-1">|</span>
                    <span className="text-xs text-muted-foreground">v{dbInfo.appVersion}</span>
                  </>
                ) : (
                  <span className="text-muted-foreground">Loading...</span>
                )}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleHardRefresh}
              disabled={isRefreshing}
              data-testid="button-hard-refresh"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              Hard Refresh Data
            </Button>
          </div>
        </Alert>
        
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Testers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {codesData?.activeTesters ?? 0} / {codesData?.maxTesters ?? 50}
              </div>
              {isEditingMaxTesters ? (
                <div className="flex items-center gap-2 mt-2">
                  <Input
                    type="number"
                    min="1"
                    value={editMaxTestersValue}
                    onChange={(e) => setEditMaxTestersValue(e.target.value)}
                    className="h-8 w-20"
                    data-testid="input-max-testers"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={handleSaveMaxTesters}
                    disabled={updateMaxTestersMutation.isPending}
                    data-testid="button-save-max-testers"
                  >
                    {updateMaxTestersMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4 text-green-500" />
                    )}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setIsEditingMaxTesters(false)}
                    data-testid="button-cancel-max-testers"
                  >
                    <X className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <p className="text-xs text-muted-foreground">
                    Max: {codesData?.maxTesters ?? 50}
                  </p>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleEditMaxTesters}
                    data-testid="button-edit-max-testers"
                  >
                    <Pencil className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Codes</CardTitle>
              <Key className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {codesData?.codes.filter(c => c.status === "active" && new Date(c.expiresAt) > new Date()).length ?? 0}
              </div>
              <p className="text-xs text-muted-foreground">
                Codes available for use
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Codes</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {codesData?.codes.length ?? 0}
              </div>
              <p className="text-xs text-muted-foreground">
                All time codes created
              </p>
            </CardContent>
          </Card>
        </div>
        
        {/* Diagnostic Code Lookup */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Search className="h-4 w-4" /> Code Diagnostic Lookup</CardTitle>
            <CardDescription>Verify if a code exists in the database and check its activation slots</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                placeholder="Enter code to check (e.g. PM3YAMEK)"
                value={lookupCode}
                onChange={(e) => setLookupCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && handleLookupCode()}
                className="font-mono"
                data-testid="input-lookup-code"
              />
              <Button onClick={handleLookupCode} disabled={lookupLoading || !lookupCode.trim()} data-testid="button-lookup-code">
                {lookupLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>
            {lookupResult && (
              <div className="mt-3">
                {lookupResult.error ? (
                  <Alert>
                    <AlertDescription className="text-destructive font-mono text-sm">{lookupResult.message}</AlertDescription>
                  </Alert>
                ) : !lookupResult.found ? (
                  <Alert>
                    <AlertDescription>
                      <div className="font-semibold text-destructive">Code not found in database</div>
                      <div className="text-sm mt-1">{lookupResult.hint}</div>
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="border rounded p-3 space-y-2 text-sm" data-testid="lookup-result">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-base">{lookupResult.code?.code}</span>
                      {lookupResult.codeStatus === 'active' && <Badge variant="default" data-testid="badge-code-status">Active</Badge>}
                      {lookupResult.codeStatus === 'revoked' && <Badge variant="destructive" data-testid="badge-code-status">Revoked</Badge>}
                      {lookupResult.codeStatus === 'expired' && <Badge variant="secondary" data-testid="badge-code-status">Expired</Badge>}
                      {lookupResult.blockReason && (
                        <span className="text-xs text-muted-foreground">— {lookupResult.blockReason}</span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {(['desktop', 'mobile'] as const).map((slotKey) => {
                        const slot = lookupResult.slots?.[slotKey];
                        const Icon = slotKey === 'desktop' ? Monitor : Smartphone;
                        const accent = slotKey === 'desktop' ? 'blue' : 'green';
                        const taken = !!slot?.taken;
                        const canActivate = !!slot?.canActivate;
                        const label = slotKey.charAt(0).toUpperCase() + slotKey.slice(1);
                        return (
                          <div key={slotKey} className={`flex items-start gap-2 p-2 rounded border ${taken ? `border-${accent}-500/40 bg-${accent}-500/10` : 'border-border'}`} data-testid={`slot-${slotKey}`}>
                            <Icon className={`h-4 w-4 text-${accent}-400 mt-0.5`} />
                            <div className="min-w-0">
                              <div className="font-medium">{label}</div>
                              <div className="text-xs text-muted-foreground">
                                {taken
                                  ? `Taken${slot.activatedAt ? ` — activated ${format(new Date(slot.activatedAt), 'MMM d, HH:mm')}` : ''}`
                                  : (canActivate ? 'Free — can activate' : `Free — blocked: ${slot?.reason ?? 'code unusable'}`)}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      {lookupResult.licenseActivatedAt && (
                        <div>License first activated: {format(new Date(lookupResult.licenseActivatedAt), 'MMM d, yyyy HH:mm')}</div>
                      )}
                      {lookupResult.code?.expiresAt && (
                        <div>Expires: {format(new Date(lookupResult.code.expiresAt), 'MMM d, yyyy')}</div>
                      )}
                      {lookupResult.workspace?.userId && (
                        <div>
                          Workspace: <span className="font-mono">{String(lookupResult.workspace.userId).slice(0, 8)}…</span>
                          {typeof lookupResult.workspace.animalCount === 'number' && (
                            <> · {lookupResult.workspace.animalCount} animal{lookupResult.workspace.animalCount === 1 ? '' : 's'}</>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
            <div>
              <CardTitle>Invite Codes</CardTitle>
              <CardDescription>Manage beta access codes for testers. Each code allows 1 desktop + 1 mobile device.</CardDescription>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-create-code">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Code
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Invite Code</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="notes">Tester Name / Notes</Label>
                    <Input
                      id="notes"
                      placeholder="e.g., John Smith - Farm X"
                      value={newCodeNotes}
                      onChange={(e) => setNewCodeNotes(e.target.value)}
                      data-testid="input-code-notes"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="expiry">Expiry (days)</Label>
                    <Input
                      id="expiry"
                      type="number"
                      min={1}
                      max={365}
                      value={newCodeExpiry}
                      onChange={(e) => setNewCodeExpiry(parseInt(e.target.value) || 30)}
                      data-testid="input-code-expiry"
                    />
                  </div>
                  
                  {(codesData?.activeTesters ?? 0) >= (codesData?.maxTesters ?? 10) && (
                    <Alert>
                      <AlertDescription>
                        Maximum tester limit reached. New codes can be created but won't be activatable until a slot opens.
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  <Button 
                    onClick={() => createCodeMutation.mutate()}
                    disabled={createCodeMutation.isPending}
                    className="w-full"
                    data-testid="button-confirm-create"
                  >
                    {createCodeMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      "Create Code"
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {loadingCodes ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : error ? (
              <Alert variant="destructive">
                <AlertDescription>Failed to load invite codes</AlertDescription>
              </Alert>
            ) : codesData?.codes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Key className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No invite codes created yet</p>
                <p className="text-sm">Create your first code to invite beta testers</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Device Slots</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {codesData?.codes.map((code) => (
                      <TableRow key={code.id} data-testid={`row-code-${code.id}`}>
                        <TableCell className="font-mono font-bold tracking-wider">
                          {code.code}
                        </TableCell>
                        <TableCell>{getStatusBadge(code)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {/* Desktop slot */}
                            <div className={`flex items-center gap-1 text-xs px-1.5 py-0.5 rounded border ${code.slots?.desktop.taken ? 'bg-blue-500/10 border-blue-500/40 text-blue-400' : 'border-border text-muted-foreground'}`} title={code.slots?.desktop.taken ? `Desktop activated ${code.slots.desktop.activatedAt ? format(new Date(code.slots.desktop.activatedAt), 'MMM d') : ''}` : 'Desktop slot free'}>
                              <Monitor className="h-3 w-3" />
                              <span>{code.slots?.desktop.taken ? '✓' : '—'}</span>
                            </div>
                            {/* Mobile slot */}
                            <div className={`flex items-center gap-1 text-xs px-1.5 py-0.5 rounded border ${code.slots?.mobile.taken ? 'bg-green-500/10 border-green-500/40 text-green-400' : 'border-border text-muted-foreground'}`} title={code.slots?.mobile.taken ? `Mobile activated ${code.slots.mobile.activatedAt ? format(new Date(code.slots.mobile.activatedAt), 'MMM d') : ''}` : 'Mobile slot free'}>
                              <Smartphone className="h-3 w-3" />
                              <span>{code.slots?.mobile.taken ? '✓' : '—'}</span>
                            </div>
                            {/* Reset slot buttons */}
                            {code.slots?.desktop.taken && (
                              <Button size="icon" variant="ghost" className="h-5 w-5" title="Reset desktop slot" onClick={() => resetSlotMutation.mutate({ id: code.id, slotType: 'desktop' })} disabled={resetSlotMutation.isPending}>
                                <X className="h-3 w-3 text-blue-400" />
                              </Button>
                            )}
                            {code.slots?.mobile.taken && (
                              <Button size="icon" variant="ghost" className="h-5 w-5" title="Reset mobile slot" onClick={() => resetSlotMutation.mutate({ id: code.id, slotType: 'mobile' })} disabled={resetSlotMutation.isPending}>
                                <X className="h-3 w-3 text-green-400" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[160px] truncate">
                          {code.notes || "-"}
                        </TableCell>
                        <TableCell>
                          {format(new Date(code.expiresAt), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button 
                              size="icon" 
                              variant="ghost"
                              onClick={() => copyCode(code.code)}
                              data-testid={`button-copy-${code.id}`}
                              title="Copy code"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button 
                              size="icon" 
                              variant="ghost"
                              onClick={() => deleteCodeMutation.mutate(code.id)}
                              disabled={deleteCodeMutation.isPending}
                              data-testid={`button-delete-${code.id}`}
                              title="Delete code"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                            {code.status === "active" && new Date(code.expiresAt) > new Date() && (
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => revokeCodeMutation.mutate(code.id)}
                                disabled={revokeCodeMutation.isPending}
                                data-testid={`button-revoke-${code.id}`}
                                title="Revoke code (preserves workspace data)"
                              >
                                <Ban className="h-4 w-4" />
                              </Button>
                            )}
                            {(code.status === "revoked" || code.status === "expired" || new Date(code.expiresAt) < new Date()) && (
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleReactivate(code.id)}
                                disabled={reactivateCodeMutation.isPending}
                                data-testid={`button-reactivate-${code.id}`}
                                title="Reactivate code (preserves workspace data)"
                              >
                                <RotateCcw className="h-4 w-4 text-primary" />
                              </Button>
                            )}
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleExtendExpiry(code.id)}
                              disabled={extendExpiryMutation.isPending}
                              data-testid={`button-extend-${code.id}`}
                              title="Extend expiry"
                            >
                              <CalendarPlus className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
        {/* Field Test Issues */}
        <Card data-testid="card-field-issues">
          <CardHeader>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Bug className="h-4 w-4 text-primary" /> Field Test Issues
                </CardTitle>
                <CardDescription>
                  Reports submitted by testers via the Report an Issue form.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Select value={issueSeverityFilter} onValueChange={setIssueSeverityFilter}>
                  <SelectTrigger className="w-32" data-testid="select-issue-severity-filter">
                    <SelectValue placeholder="Severity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All severities</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="major">Major</SelectItem>
                    <SelectItem value="minor">Minor</SelectItem>
                    <SelectItem value="feedback">Feedback</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={issueStatusFilter} onValueChange={setIssueStatusFilter}>
                  <SelectTrigger className="w-32" data-testid="select-issue-status-filter">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="wont_fix">Won't Fix</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loadingIssues ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : fieldIssues.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Bug className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p className="text-sm">No issues reported yet.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {fieldIssues.map((issue) => {
                  const isExpanded = expandedIssue === issue.id;
                  const severityColor =
                    issue.severity === "critical" ? "destructive" :
                    issue.severity === "major" ? "secondary" :
                    "outline";
                  const statusColor =
                    issue.status === "resolved" ? "default" :
                    issue.status === "in_progress" ? "secondary" :
                    issue.status === "wont_fix" ? "outline" :
                    "secondary";
                  return (
                    <div key={issue.id} className="border rounded-lg overflow-hidden" data-testid={`issue-row-${issue.id}`}>
                      <button
                        className="w-full text-left px-4 py-3 flex items-start justify-between gap-3 hover:bg-muted/40 transition-colors"
                        onClick={() => setExpandedIssue(isExpanded ? null : issue.id)}
                      >
                        <div className="flex flex-col gap-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant={severityColor} className="uppercase text-xs shrink-0">{issue.severity}</Badge>
                            <Badge variant={statusColor} className="text-xs shrink-0">{issue.status.replace("_", " ")}</Badge>
                            <span className="font-medium truncate">{issue.title}</span>
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                            <span>{issue.area}</span>
                            {issue.contactName && <span>· {issue.contactName}</span>}
                            {issue.deviceType && <span>· {issue.deviceType}</span>}
                            <span>· {format(new Date(issue.createdAt), "MMM d, yyyy HH:mm")}</span>
                          </div>
                        </div>
                        {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />}
                      </button>
                      {isExpanded && (
                        <div className="px-4 pb-4 space-y-4 border-t bg-muted/20">
                          <div className="pt-3 space-y-2">
                            <div className="text-xs text-muted-foreground uppercase font-medium">Description</div>
                            <p className="text-sm whitespace-pre-wrap">{issue.description}</p>
                          </div>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            {issue.appVersion && <div><span className="font-medium">Version:</span> {issue.appVersion}</div>}
                            {issue.currentRoute && <div><span className="font-medium">Route:</span> {issue.currentRoute}</div>}
                            {issue.appMode && <div><span className="font-medium">Mode:</span> {issue.appMode}</div>}
                            {issue.inviteCodeRef && <div><span className="font-medium">Code:</span> {issue.inviteCodeRef}</div>}
                          </div>
                          {issue.adminNotes && (
                            <div className="space-y-1">
                              <div className="text-xs text-muted-foreground uppercase font-medium flex items-center gap-1">
                                <MessageSquare className="h-3 w-3" /> Admin Notes
                              </div>
                              <p className="text-sm whitespace-pre-wrap border rounded p-2 bg-background">{issue.adminNotes}</p>
                            </div>
                          )}
                          <div className="flex flex-col gap-3 pt-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs text-muted-foreground font-medium">Update status:</span>
                              {["new", "in_progress", "resolved", "wont_fix"].map((s) => (
                                <Button
                                  key={s}
                                  size="sm"
                                  variant={issue.status === s ? "default" : "outline"}
                                  className="text-xs h-7"
                                  onClick={() => updateIssueMutation.mutate({ id: issue.id, status: s })}
                                  disabled={updateIssueMutation.isPending}
                                  data-testid={`button-issue-status-${s}-${issue.id}`}
                                >
                                  {s.replace("_", " ")}
                                </Button>
                              ))}
                            </div>
                            <div className="space-y-1">
                              <div className="text-xs text-muted-foreground font-medium">Admin notes (optional):</div>
                              <Textarea
                                placeholder="Add admin notes..."
                                className="text-sm min-h-[60px]"
                                value={issueNotesMap[issue.id] ?? issue.adminNotes ?? ""}
                                onChange={(e) => setIssueNotesMap((prev) => ({ ...prev, [issue.id]: e.target.value }))}
                                data-testid={`textarea-issue-notes-${issue.id}`}
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs"
                                onClick={() => updateIssueMutation.mutate({ id: issue.id, adminNotes: issueNotesMap[issue.id] ?? "" })}
                                disabled={updateIssueMutation.isPending}
                                data-testid={`button-save-notes-${issue.id}`}
                              >
                                Save Notes
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── User Activity & Testing Section ─────────────────────────────── */}
        <Card data-testid="activity-dashboard-section">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">User Activity &amp; Testing</CardTitle>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs h-7"
                onClick={() => refetchActivitySummary()}
                disabled={loadingActivitySummary}
                data-testid="button-refresh-activity"
              >
                {loadingActivitySummary ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* KPI cards */}
            {loadingActivitySummary ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-20 rounded-lg bg-muted/30 animate-pulse" />
                ))}
              </div>
            ) : activitySummary ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" data-testid="activity-kpi-grid">
                <div className="rounded-lg border bg-card p-3 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Users className="h-3 w-3" /> Activated
                  </div>
                  <div className="text-2xl font-bold" data-testid="kpi-total-activated">{activitySummary.totalActivatedUsers}</div>
                </div>
                <div className="rounded-lg border bg-card p-3 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Zap className="h-3 w-3" /> Active today
                  </div>
                  <div className="text-2xl font-bold text-primary" data-testid="kpi-active-today">{activitySummary.activeToday}</div>
                </div>
                <div className="rounded-lg border bg-card p-3 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <TrendingUp className="h-3 w-3" /> Last 7 days
                  </div>
                  <div className="text-2xl font-bold" data-testid="kpi-active-7d">{activitySummary.activeLast7Days}</div>
                </div>
                <div className="rounded-lg border bg-card p-3 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <UserCheck className="h-3 w-3" /> Recently seen
                  </div>
                  <div className="text-2xl font-bold" data-testid="kpi-recently-seen">{activitySummary.recentlySeen}</div>
                </div>
                <div className="rounded-lg border bg-card p-3 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Wifi className="h-3 w-3" /> With sync
                  </div>
                  <div className="text-2xl font-bold">{activitySummary.usersWithSyncActivity}</div>
                </div>
                <div className="rounded-lg border bg-card p-3 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Timer className="h-3 w-3" /> Total sessions
                  </div>
                  <div className="text-2xl font-bold">{activitySummary.totalSessions}</div>
                </div>
                <div className="rounded-lg border bg-card p-3 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Download className="h-3 w-3" /> Exports
                  </div>
                  <div className="text-2xl font-bold">{activitySummary.exportDownloadCount}</div>
                </div>
                <div className="rounded-lg border bg-card p-3 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" /> Avg session
                  </div>
                  <div className="text-2xl font-bold">
                    {activitySummary.avgSessionDurationSeconds > 0
                      ? `${Math.round(activitySummary.avgSessionDurationSeconds / 60)}m`
                      : "—"}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No activity data yet.</div>
            )}

            {/* Filter / sort row */}
            <div className="flex flex-wrap gap-2 items-center" data-testid="activity-filter-row">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <BarChart2 className="h-3 w-3" /> Sort:
              </div>
              <Select value={activitySortBy} onValueChange={setActivitySortBy}>
                <SelectTrigger className="h-7 w-36 text-xs" data-testid="select-activity-sort">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="activityScore">Activity score</SelectItem>
                  <SelectItem value="lastSeen">Last seen</SelectItem>
                  <SelectItem value="lastSync">Last sync</SelectItem>
                  <SelectItem value="sessionCount">Session count</SelectItem>
                  <SelectItem value="activatedAt">Activated date</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex items-center gap-1.5 text-xs text-muted-foreground ml-2">
                Filter:
              </div>
              <Select value={activityFilterBy} onValueChange={setActivityFilterBy}>
                <SelectTrigger className="h-7 w-36 text-xs" data-testid="select-activity-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All users</SelectItem>
                  <SelectItem value="active_today">Active today</SelectItem>
                  <SelectItem value="dormant">Dormant (&gt;7d)</SelectItem>
                  <SelectItem value="no_activity">No activity</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* User activity table */}
            {loadingActivityUsers ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading users…
              </div>
            ) : activityUsers.length === 0 ? (
              <div className="text-sm text-muted-foreground py-4 text-center">No activated users yet.</div>
            ) : (
              <div className="overflow-x-auto rounded-lg border" data-testid="activity-users-table">
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs">
                      <TableHead className="whitespace-nowrap">User / Device</TableHead>
                      <TableHead className="whitespace-nowrap">Code</TableHead>
                      <TableHead className="whitespace-nowrap">Status</TableHead>
                      <TableHead className="whitespace-nowrap">Activated</TableHead>
                      <TableHead className="whitespace-nowrap">Last seen</TableHead>
                      <TableHead className="whitespace-nowrap">Last sync</TableHead>
                      <TableHead className="whitespace-nowrap">Sessions</TableHead>
                      <TableHead className="whitespace-nowrap">Time spent</TableHead>
                      <TableHead className="whitespace-nowrap">Exports</TableHead>
                      <TableHead className="whitespace-nowrap">Score</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activityUsers.map((user) => (
                      <TableRow key={user.userId} className="text-xs" data-testid={`activity-user-row-${user.userId}`}>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            {user.deviceType === "mobile"
                              ? <Smartphone className="h-3 w-3 text-muted-foreground shrink-0" />
                              : <Monitor className="h-3 w-3 text-muted-foreground shrink-0" />}
                            <span className="font-mono text-[10px] truncate max-w-[80px]" title={user.deviceId}>
                              {user.deviceId.slice(0, 12)}…
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-[10px]">{user.inviteCode ?? "—"}</span>
                        </TableCell>
                        <TableCell>
                          <ActivityStatusBadge status={user.status} />
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {user.activatedAt ? format(new Date(user.activatedAt), "MMM d") : "—"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {user.lastSeen
                            ? formatDistanceToNow(new Date(user.lastSeen), { addSuffix: true })
                            : "Never"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {user.lastSync
                            ? formatDistanceToNow(new Date(user.lastSync), { addSuffix: true })
                            : "—"}
                        </TableCell>
                        <TableCell>{user.sessionCount}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {user.estimatedTimeSpentSeconds > 0
                            ? `${Math.round(user.estimatedTimeSpentSeconds / 60)}m`
                            : "—"}
                        </TableCell>
                        <TableCell>{user.exportDownloadCount > 0 ? user.exportDownloadCount : "—"}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 min-w-[70px]">
                            <Progress value={user.activityScore} className="h-1.5 w-12" />
                            <span className="text-[10px] font-medium">{user.activityScore}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs px-2"
                            onClick={() => setSelectedActivityUser(user.userId)}
                            data-testid={`button-activity-detail-${user.userId}`}
                          >
                            Detail
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Per-user detail drawer ──────────────────────────────────────── */}
        <Dialog open={selectedActivityUser !== null} onOpenChange={(open) => { if (!open) setSelectedActivityUser(null); }}>
          <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <Activity className="h-4 w-4 text-primary" />
                User Activity Detail
              </DialogTitle>
            </DialogHeader>
            {loadingUserDetail ? (
              <div className="flex items-center gap-2 py-8 justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Loading…</span>
              </div>
            ) : selectedUserDetail ? (
              <ScrollArea className="flex-1 overflow-y-auto pr-1">
                <div className="space-y-5 pb-4">
                  {/* Identity */}
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
                    <div><span className="text-muted-foreground">Device ID:</span> <span className="font-mono text-xs">{selectedUserDetail.deviceId}</span></div>
                    <div><span className="text-muted-foreground">Type:</span> {selectedUserDetail.deviceType ?? "unknown"}</div>
                    <div><span className="text-muted-foreground">Code:</span> {selectedUserDetail.inviteCode ?? "—"}</div>
                    <div><span className="text-muted-foreground">Activated:</span> {selectedUserDetail.activatedAt ? format(new Date(selectedUserDetail.activatedAt), "MMM d, yyyy") : "—"}</div>
                    <div><span className="text-muted-foreground">First seen:</span> {selectedUserDetail.activatedAt ? format(new Date(selectedUserDetail.activatedAt), "MMM d, yyyy HH:mm") : "—"}</div>
                    <div><span className="text-muted-foreground">Last seen:</span> {selectedUserDetail.lastSeen ? format(new Date(selectedUserDetail.lastSeen), "MMM d, yyyy HH:mm") : "Never"}</div>
                    <div><span className="text-muted-foreground">Last sync:</span> {selectedUserDetail.lastSync ? formatDistanceToNow(new Date(selectedUserDetail.lastSync), { addSuffix: true }) : "—"}</div>
                    <div><span className="text-muted-foreground">Time spent:</span> {selectedUserDetail.estimatedTimeSpentSeconds > 0 ? `${Math.round(selectedUserDetail.estimatedTimeSpentSeconds / 60)} min` : "—"}</div>
                  </div>

                  {/* Score + status */}
                  <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/30">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-muted-foreground">Activity Score</span>
                        <span className="font-bold text-sm">{selectedUserDetail.activityScore} / 100</span>
                      </div>
                      <Progress value={selectedUserDetail.activityScore} className="h-2" />
                    </div>
                    <ActivityStatusBadge status={selectedUserDetail.status} />
                  </div>

                  {/* Sessions 7d */}
                  <div>
                    <div className="text-xs font-medium uppercase text-muted-foreground mb-2 flex items-center gap-1.5">
                      <Timer className="h-3 w-3" /> Sessions (last 7 days) — {selectedUserDetail.sessions7d.length}
                    </div>
                    {selectedUserDetail.sessions7d.length === 0 ? (
                      <div className="text-xs text-muted-foreground">No sessions in the last 7 days.</div>
                    ) : (
                      <div className="space-y-1.5">
                        {selectedUserDetail.sessions7d.map((s) => (
                          <div key={s.id} className="flex items-center justify-between text-xs border rounded px-3 py-1.5">
                            <span>{format(new Date(s.startedAt), "MMM d HH:mm")}</span>
                            <span className="text-muted-foreground">
                              {s.durationSeconds != null ? `${Math.round(s.durationSeconds / 60)}m` : s.isActive ? "active" : "—"}
                            </span>
                            {s.isActive && <Badge variant="secondary" className="text-[10px] h-4 px-1.5">Live</Badge>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Recent events timeline */}
                  <div>
                    <div className="text-xs font-medium uppercase text-muted-foreground mb-2 flex items-center gap-1.5">
                      <Activity className="h-3 w-3" /> Recent Events (last 50)
                    </div>
                    {selectedUserDetail.recentEvents.length === 0 ? (
                      <div className="text-xs text-muted-foreground">No events recorded.</div>
                    ) : (
                      <div className="space-y-1">
                        {selectedUserDetail.recentEvents.map((ev) => (
                          <div key={ev.id} className="flex items-start gap-2 text-xs border-l-2 border-muted pl-3 py-0.5">
                            <span className="text-muted-foreground whitespace-nowrap">
                              {format(new Date(ev.occurredAt), "MMM d HH:mm")}
                            </span>
                            <span className="font-medium">{ev.eventType}</span>
                            {ev.route && <span className="text-muted-foreground truncate">{ev.route}</span>}
                            {ev.feature && <Badge variant="outline" className="text-[9px] h-3.5 px-1 ml-auto shrink-0">{ev.feature}</Badge>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </ScrollArea>
            ) : null}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

function ActivityStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    "Strong tester": { label: "Strong tester", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
    "Active tester": { label: "Active", className: "bg-primary/10 text-primary" },
    "Light activity": { label: "Light", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
    "Low use": { label: "Low use", className: "bg-muted text-muted-foreground" },
    "No activity": { label: "No activity", className: "bg-muted text-muted-foreground" },
  };
  const config = map[status] ?? { label: status, className: "bg-muted text-muted-foreground" };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${config.className}`}>
      {config.label}
    </span>
  );
}
