import { useState } from "react";
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
import { Plus, Copy, Ban, Users, Key, Calendar, Loader2, ArrowLeft, ShieldCheck, LogOut } from "lucide-react";
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

export default function AdminPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newCodeNotes, setNewCodeNotes] = useState("");
  const [newCodeExpiry, setNewCodeExpiry] = useState(30);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [adminPin, setAdminPin] = useState("");
  const [pinError, setPinError] = useState("");
  
  const { data: adminCheck, isLoading: checkingAdmin, refetch: refetchAdmin } = useQuery<{ isAdmin: boolean }>({
    queryKey: ["/api/admin/check"],
  });
  
  const loginMutation = useMutation({
    mutationFn: async (pin: string) => {
      const response = await apiRequest("POST", "/api/admin/login", { pin });
      return response.json();
    },
    onSuccess: () => {
      refetchAdmin();
      setPinError("");
      setAdminPin("");
    },
    onError: (err: Error) => {
      setPinError(err.message || "Invalid PIN");
    }
  });
  
  const { data: codesData, isLoading: loadingCodes, error } = useQuery<InviteCodesResponse>({
    queryKey: ["/api/admin/invite-codes"],
    enabled: adminCheck?.isAdmin === true,
  });
  
  const createCodeMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/admin/invite-codes", {
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
  
  const revokeCodeMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("POST", `/api/admin/invite-codes/${id}/revoke`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/invite-codes"] });
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

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/admin/logout", {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/check"] });
      toast({
        title: "Logged Out",
        description: "You have been logged out of the admin panel.",
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
  
  if (checkingAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (!adminCheck?.isAdmin) {
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
            <form onSubmit={(e) => { e.preventDefault(); loginMutation.mutate(adminPin); }} className="space-y-4">
              <div>
                <Input
                  type="password"
                  placeholder="Enter admin PIN"
                  value={adminPin}
                  onChange={(e) => setAdminPin(e.target.value)}
                  className="text-center text-lg tracking-widest"
                  data-testid="input-admin-pin"
                  autoFocus
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
                disabled={!adminPin.trim() || loginMutation.isPending}
                data-testid="button-admin-login"
              >
                {loginMutation.isPending ? (
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
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
            data-testid="button-admin-logout"
          >
            {logoutMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <LogOut className="mr-2 h-4 w-4" />
            )}
            Logout
          </Button>
        </div>
        
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Testers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {codesData?.activeTesters ?? 0} / {codesData?.maxTesters ?? 10}
              </div>
              <p className="text-xs text-muted-foreground">
                Maximum {codesData?.maxTesters ?? 10} testers allowed
              </p>
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
                            {code.status === "active" && (
                              <Button 
                                size="icon" 
                                variant="ghost"
                                onClick={() => revokeCodeMutation.mutate(code.id)}
                                disabled={revokeCodeMutation.isPending}
                                data-testid={`button-revoke-${code.id}`}
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
