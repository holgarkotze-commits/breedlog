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
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Plus, Copy, Ban, Users, Key, Calendar, Loader2, ArrowLeft, ShieldCheck, LogOut, RefreshCw, Trash2, Pencil, Check, X } from "lucide-react";
import { format } from "date-fns";
import { Link } from "wouter";

interface InviteCode {
  id: number;
  code: string;
  status: string;
  expiresAt: string;
  maxUses: number;
  usesCount: number;
  notes: string | null;
  createdAt: string;
}

interface InviteCodesResponse {
  codes: InviteCode[];
  activeTesters: number;
  maxTesters: number;
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
  
  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({
      title: "Copied",
      description: "Code copied to clipboard",
    });
  };
  
  const getStatusBadge = (code: InviteCode) => {
    if (code.status === "revoked") {
      return <Badge variant="destructive">Revoked</Badge>;
    }
    if (new Date(code.expiresAt) < new Date()) {
      return <Badge variant="secondary">Expired</Badge>;
    }
    if (code.usesCount >= code.maxUses) {
      return <Badge variant="secondary">Used</Badge>;
    }
    return <Badge variant="default">Active</Badge>;
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
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={handleEditMaxTesters}
                    data-testid="button-edit-max-testers"
                  >
                    <Pencil className="h-3 w-3" />
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
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
            <div>
              <CardTitle>Invite Codes</CardTitle>
              <CardDescription>Manage beta access codes for testers</CardDescription>
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
                      <TableHead>Notes</TableHead>
                      <TableHead>Uses</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead>Created</TableHead>
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
                        <TableCell className="max-w-[200px] truncate">
                          {code.notes || "-"}
                        </TableCell>
                        <TableCell>{code.usesCount} / {code.maxUses}</TableCell>
                        <TableCell>
                          {format(new Date(code.expiresAt), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell>
                          {format(new Date(code.createdAt), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button 
                              size="icon" 
                              variant="ghost"
                              onClick={() => copyCode(code.code)}
                              data-testid={`button-copy-${code.id}`}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            {code.status === "active" && code.usesCount === 0 && (
                              <Button 
                                size="icon" 
                                variant="ghost"
                                onClick={() => deleteCodeMutation.mutate(code.id)}
                                disabled={deleteCodeMutation.isPending}
                                data-testid={`button-delete-${code.id}`}
                                title="Delete unused code"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                            {code.status === "active" && code.usesCount > 0 && (
                              <Button 
                                size="icon" 
                                variant="ghost"
                                onClick={() => revokeCodeMutation.mutate(code.id)}
                                disabled={revokeCodeMutation.isPending}
                                data-testid={`button-revoke-${code.id}`}
                                title="Revoke used code"
                              >
                                <Ban className="h-4 w-4" />
                              </Button>
                            )}
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
      </div>
    </div>
  );
}
