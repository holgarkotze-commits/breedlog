import { useState, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Check, Clipboard, KeyRound, LockKeyhole, ShieldCheck, Sprout } from "lucide-react";
import { accountRequest, type AccountResult } from "@/lib/account-session";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Mode = "login" | "register" | "recovery" | "reset";
type Notice = { tone: "success" | "error"; text: string };

function modeFromPath(path: string): Mode {
  if (path === "/auth/register") return "register";
  if (path === "/auth/recovery") return "recovery";
  if (path === "/auth/reset") return "reset";
  return "login";
}

function errorDetails(error: unknown): { message: string; status?: number; code?: string } {
  const candidate = error as { message?: string; status?: number; code?: string; response?: { status?: number } };
  const message = candidate?.message || "Something went wrong. Please try again.";
  const status = candidate?.status ?? candidate?.response?.status;
  let code = candidate?.code;
  try {
    const parsed = JSON.parse(message.replace(/^\d{3}:\s*/, ""));
    code = code || parsed.code;
    return { message: parsed.message || message, status: status ?? (Number(message.slice(0, 3)) || undefined), code };
  } catch {
    return { message: message.replace(/^\d{3}:\s*/, ""), status: status ?? (Number(message.slice(0, 3)) || undefined), code };
  }
}

const fieldClass = "h-11 rounded-xl bg-background";

export interface AccountAccessProps {
  onAuthenticated: (result: AccountResult) => Promise<void>;
  onLegacy: () => void;
}

export default function AccountAccess({ onAuthenticated, onLegacy }: AccountAccessProps) {
  const [location, navigate] = useLocation();
  const mode = modeFromPath(location);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [token, setToken] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [pendingDeviceReplacement, setPendingDeviceReplacement] = useState(false);
  const [resultToAcknowledge, setResultToAcknowledge] = useState<AccountResult | null>(null);
  const [recoveryCode, setRecoveryCode] = useState("");
  const [savedAcknowledged, setSavedAcknowledged] = useState(false);
  const [copied, setCopied] = useState(false);
  const [recoveryComplete, setRecoveryComplete] = useState(false);

  const go = (next: Mode) => {
    setNotice(null);
    setPendingDeviceReplacement(false);
    setRecoveryComplete(false);
    navigate(`/auth/${next === "login" ? "login" : next}`);
  };

  const completeAuthentication = async (result: AccountResult) => {
    if (result.recoveryCode) {
      setResultToAcknowledge(result);
      setRecoveryCode(result.recoveryCode);
      setSavedAcknowledged(false);
      setCopied(false);
      return;
    }
    await onAuthenticated(result);
  };

  const submitAuth = async (event: FormEvent<HTMLFormElement>, replaceDevice = false) => {
    event.preventDefault();
    setNotice(null);
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setNotice({ tone: "error", text: "Enter a valid email address." });
      return;
    }
    if ((mode === "register" && password.length < 10) || !password.length || password.length > 128) {
      setNotice({ tone: "error", text: "Password must be between 10 and 128 characters." });
      return;
    }
    if (mode === "register" && !acceptedTerms) {
      setNotice({ tone: "error", text: "Please accept the Terms of Service and Privacy Policy to create your account." });
      return;
    }
    setBusy(true);
    try {
      const result = mode === "register"
        ? await accountRequest<AccountResult>("/api/auth/register", {
            email: email.trim(), password, acceptedTerms: true, website: "",
          })
        : await accountRequest<AccountResult>("/api/auth/login", {
            email: email.trim(), password, ...(replaceDevice ? { replaceDevice: true } : {}),
          });
      await completeAuthentication(result);
    } catch (error) {
      const details = errorDetails(error);
      if (details.code === "DEVICE_LIMIT_REACHED" && mode === "login" && !replaceDevice) {
        setPendingDeviceReplacement(true);
        setNotice({ tone: "error", text: "This account is already active on another device. You can sign in here and sign out the previous session. No records will be deleted." });
      } else {
        setNotice({ tone: "error", text: details.message });
      }
    } finally {
      setBusy(false);
    }
  };

  const submitRecoveryRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setNotice({ tone: "error", text: "Enter a valid email address." });
      return;
    }
    setBusy(true);
    try {
      await accountRequest<{ requested: true }>("/api/auth/recovery/request", { email: email.trim() });
      setNotice({ tone: "success", text: "If an account matches that address, recovery instructions will be sent. Check your inbox, then use your saved recovery code below if needed." });
    } catch (error) {
      const details = errorDetails(error);
      setNotice({
        tone: "error",
        text: details.status === 503
          ? "Email recovery is temporarily unavailable. Use your saved recovery code below to reset your password."
          : details.message,
      });
    } finally {
      setBusy(false);
    }
  };

  const submitReset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice(null);
    if (token.trim().length < 8) {
      setNotice({ tone: "error", text: "Enter the recovery code you saved when you created your account." });
      return;
    }
    if (newPassword.length < 10 || newPassword.length > 128) {
      setNotice({ tone: "error", text: "New password must be between 10 and 128 characters." });
      return;
    }
    setBusy(true);
    try {
      const result = await accountRequest<{ success: true; recoveryCode?: string }>("/api/auth/recovery/confirm", {
        token: token.trim(), newPassword,
      });
      setRecoveryComplete(true);
      setRecoveryCode(result.recoveryCode || "");
      setSavedAcknowledged(false);
      setCopied(false);
      setNotice({ tone: "success", text: result.recoveryCode ? "Password updated. Save your replacement recovery code somewhere safe." : "Password updated. You can now sign in with your new password." });
    } catch (error) {
      setNotice({ tone: "error", text: errorDetails(error).message });
    } finally {
      setBusy(false);
    }
  };

  const saveCodeAndContinue = async () => {
    if (!savedAcknowledged) return;
    if (resultToAcknowledge) {
      setBusy(true);
      try {
        await onAuthenticated(resultToAcknowledge);
      } catch (error) {
        setNotice({ tone: "error", text: errorDetails(error).message });
      } finally {
        setBusy(false);
      }
      return;
    }
    setRecoveryComplete(false);
    setToken("");
    setNewPassword("");
    setNotice({ tone: "success", text: "Recovery code saved. Sign in with your new password when you are ready." });
    go("login");
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(recoveryCode);
      setCopied(true);
    } catch {
      setCopied(false);
      setNotice({ tone: "error", text: "Copy is unavailable here. Select and copy the recovery code manually." });
    }
  };

  const isRecovery = mode === "recovery" || mode === "reset";
  const title = mode === "register" ? "Create your farm account" : mode === "recovery" ? "Recover your account" : mode === "reset" ? "Reset your password" : "Welcome back";

  if (resultToAcknowledge) {
    return (
      <main className="abstract-bg min-h-[100dvh] px-4 py-8 sm:flex sm:items-center sm:justify-center">
        <Card className="rugged-card relative z-10 mx-auto w-full max-w-lg">
          <CardHeader className="space-y-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><KeyRound className="h-6 w-6" /></div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">One-time recovery key</p>
            <CardTitle className="text-2xl">Save this code now</CardTitle>
            <CardDescription>This is the only time BREEDLOG will show this recovery code. It is valid for one year and can be used once. Keep it somewhere private and separate from your password.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {notice && <Alert variant={notice.tone === "error" ? "destructive" : "default"}><AlertDescription>{notice.text}</AlertDescription></Alert>}
            <div className="rounded-xl border border-primary/25 bg-primary/5 p-4">
              <Label htmlFor="new-recovery-code" className="text-xs uppercase tracking-wider text-muted-foreground">Your recovery code</Label>
              <textarea id="new-recovery-code" readOnly value={recoveryCode} rows={2} onFocus={(event) => event.currentTarget.select()} className="mt-2 w-full resize-none rounded-lg border border-border bg-background px-3 py-3 font-mono text-sm leading-6 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Recovery code, select to copy" />
              <Button type="button" variant="outline" className="mt-3 w-full" onClick={copyCode} data-testid="button-copy-recovery-code">
                {copied ? <Check /> : <Clipboard />}{copied ? "Copied" : "Copy recovery code"}
              </Button>
            </div>
            <div className="flex items-start gap-3">
              <Checkbox id="saved-recovery-code" checked={savedAcknowledged} onCheckedChange={(checked) => setSavedAcknowledged(checked === true)} />
              <Label htmlFor="saved-recovery-code" className="cursor-pointer text-sm leading-5">I have saved this recovery code somewhere safe.</Label>
            </div>
            <Button type="button" className="w-full rugged-btn" disabled={!savedAcknowledged || busy} onClick={saveCodeAndContinue} data-testid="button-save-recovery-code">
              {busy ? "Opening your farm…" : "Continue to BREEDLOG"}
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="abstract-bg min-h-[100dvh] px-4 py-6 sm:flex sm:items-center sm:justify-center sm:py-10">
      <div className="relative z-10 mx-auto grid w-full max-w-5xl overflow-hidden rounded-3xl border border-card-border bg-card/90 shadow-xl backdrop-blur-sm md:grid-cols-[0.88fr_1.12fr]">
        <aside className="relative flex flex-col justify-between overflow-hidden bg-primary p-7 text-primary-foreground sm:p-9 md:min-h-[620px]">
          <div className="pointer-events-none absolute -right-14 -top-12 h-60 w-60 rounded-full border border-white/15" />
          <div className="pointer-events-none absolute -right-2 top-0 h-44 w-44 rounded-full border border-white/10" />
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-white/10"><Sprout className="h-5 w-5" /></div>
              <div><p className="font-display text-lg font-black tracking-tight">BREEDLOG</p><p className="text-[10px] font-semibold uppercase tracking-[0.2em] opacity-70">A record book for the flock</p></div>
            </div>
            <div className="mt-12 max-w-sm">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/65">Made for the work</p>
              <h1 className="mt-3 text-3xl font-black leading-[1.08] sm:text-4xl">Good records.<br />Even out in the field.</h1>
              <p className="mt-4 max-w-xs text-sm leading-6 text-white/75">Keep your sheep records close at hand. BREEDLOG works offline, so the notebook comes with you.</p>
            </div>
          </div>
          <div className="mt-10 border-t border-white/20 pt-5 text-xs text-white/70">
            <p className="font-semibold text-white">Your account starts private</p>
            <p className="mt-1.5 max-w-xs leading-5">A new account opens an empty workspace for your farm. No invitation needed.</p>
            <p className="mt-6 tracking-wide">Built by <span className="font-bold text-white">STITCH WORX</span></p>
          </div>
        </aside>

        <section className="p-5 sm:p-9 md:px-11 md:py-10">
          <div className="mb-7 flex items-center justify-between gap-3">
            {isRecovery ? <button type="button" onClick={() => go("login")} className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"><ArrowLeft className="h-4 w-4" />Back to sign in</button> : <span className="text-sm font-medium text-muted-foreground">Secure account access</span>}
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/70 px-3 py-1.5 text-xs font-semibold text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5 text-primary" />Private by default</span>
          </div>
          <div className="mb-6">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">{mode === "register" ? "Start your farm book" : isRecovery ? "Account help" : "Your farm book"}</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {mode === "register" ? "Create a private workspace. No card required." : mode === "login" ? "Sign in to return to your livestock records." : "Get back in with your saved recovery code, or request help by email."}
            </p>
          </div>

          {notice && <Alert className="mb-5" variant={notice.tone === "error" ? "destructive" : "default"}><AlertDescription>{notice.text}</AlertDescription></Alert>}

          {mode === "login" || mode === "register" ? (
            <form onSubmit={(event) => submitAuth(event)} className="space-y-4" data-testid={mode === "register" ? "form-register" : "form-login"} noValidate>
              <div className="space-y-2">
                <Label htmlFor="account-email">Email address</Label>
                <Input id="account-email" className={fieldClass} type="email" autoComplete="email" inputMode="email" value={email} onChange={(event) => setEmail(event.target.value)} required maxLength={254} data-testid="input-account-email" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2"><Label htmlFor="account-password">{mode === "register" ? "Create password" : "Password"}</Label>{mode === "login" && <button type="button" onClick={() => go("recovery")} className="text-xs font-semibold text-primary underline-offset-4 hover:underline">Forgot password?</button>}</div>
                <Input id="account-password" className={fieldClass} type="password" autoComplete={mode === "register" ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} minLength={10} maxLength={128} required aria-describedby="password-hint" data-testid="input-account-password" />
                <p id="password-hint" className="text-xs text-muted-foreground">Use 10–128 characters.</p>
              </div>
              {mode === "register" && (
                <>
                  <div className="rounded-xl border border-border bg-background/70 px-4 py-3">
                    <p className="text-sm font-semibold">Free plan for your flock</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">30 active animals · 1 active device · 5 individual PDFs per month</p>
                    <p className="mt-1 text-xs text-muted-foreground">No card and no charge. Paid plans and AI features are coming soon.</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <Checkbox id="accepted-terms" checked={acceptedTerms} onCheckedChange={(checked) => setAcceptedTerms(checked === true)} data-testid="checkbox-accepted-terms" />
                    <Label htmlFor="accepted-terms" className="cursor-pointer text-sm leading-5 text-muted-foreground">
                      I agree to the <Link href="/legal/terms" className="font-semibold text-foreground underline underline-offset-2">Terms of Service</Link> and <Link href="/legal/privacy" className="font-semibold text-foreground underline underline-offset-2">Privacy Policy</Link>.
                    </Label>
                  </div>
                </>
              )}
              <Button type="submit" className="rugged-btn w-full" disabled={busy} data-testid="button-account-submit">
                {busy ? "Please wait…" : mode === "register" ? "Create account" : "Sign in"}
              </Button>
              {pendingDeviceReplacement && (
                <div className="space-y-3 rounded-xl border border-accent/40 bg-accent/10 p-4">
                  <p className="text-sm font-semibold">Replace the other active device?</p>
                  <p className="text-xs leading-5 text-muted-foreground">Only the previous session will be signed out. Your records will not be deleted.</p>
                  <Button type="button" variant="outline" className="w-full" disabled={busy} onClick={(event) => {
                    event.preventDefault();
                    void submitAuth({ preventDefault: () => {} } as FormEvent<HTMLFormElement>, true);
                  }} data-testid="button-replace-device">{busy ? "Signing in…" : "Sign out previous session and continue"}</Button>
                </div>
              )}
              <p className="pt-2 text-center text-sm text-muted-foreground">
                {mode === "register" ? <>Already have an account? <button type="button" onClick={() => go("login")} className="font-bold text-primary hover:underline">Sign in</button></> : <>New to BREEDLOG? <button type="button" onClick={() => go("register")} className="font-bold text-primary hover:underline">Create an account</button></>}
              </p>
            </form>
          ) : mode === "recovery" ? (
            <div className="space-y-6">
              <form onSubmit={submitRecoveryRequest} className="space-y-3" data-testid="form-recovery-request" noValidate>
                <h3 className="text-sm font-bold">Request email instructions</h3>
                <Label htmlFor="recovery-email">Account email</Label>
                <Input id="recovery-email" className={fieldClass} type="email" autoComplete="email" inputMode="email" value={email} onChange={(event) => setEmail(event.target.value)} required data-testid="input-recovery-email" />
                <Button type="submit" variant="outline" className="w-full" disabled={busy} data-testid="button-request-recovery">{busy ? "Requesting…" : "Send recovery instructions"}</Button>
              </form>
              <div className="relative flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">or use your saved code</div>
              <form onSubmit={(event) => { event.preventDefault(); go("reset"); }} className="space-y-3" data-testid="form-recovery-code-entry">
                <Label htmlFor="recovery-token">Saved recovery code</Label>
                <Input id="recovery-token" className={`${fieldClass} font-mono`} value={token} onChange={(event) => setToken(event.target.value)} autoComplete="off" required data-testid="input-recovery-token" />
                <Button type="submit" variant="secondary" className="w-full" data-testid="button-use-recovery-code">Continue with recovery code</Button>
              </form>
              <p className="text-xs leading-5 text-muted-foreground">Email recovery may not be available. Your saved recovery code is the reliable way to reset your password.</p>
            </div>
          ) : (
            recoveryComplete ? (
              <div className="space-y-5" data-testid="form-reset-complete">
                {recoveryCode && <div className="rounded-xl border border-primary/25 bg-primary/5 p-4">
                  <Label htmlFor="replacement-recovery-code" className="text-xs uppercase tracking-wider text-muted-foreground">Replacement recovery code</Label>
                  <textarea id="replacement-recovery-code" readOnly value={recoveryCode} rows={2} onFocus={(event) => event.currentTarget.select()} className="mt-2 w-full resize-none rounded-lg border border-border bg-background px-3 py-3 font-mono text-sm leading-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Replacement recovery code, select to copy" />
                  <Button type="button" variant="outline" className="mt-3 w-full" onClick={copyCode} data-testid="button-copy-replacement-code">{copied ? <Check /> : <Clipboard />}{copied ? "Copied" : "Copy recovery code"}</Button>
                  <div className="mt-4 flex items-start gap-3">
                    <Checkbox id="replacement-saved" checked={savedAcknowledged} onCheckedChange={(checked) => setSavedAcknowledged(checked === true)} />
                    <Label htmlFor="replacement-saved" className="cursor-pointer text-sm leading-5">I have saved this replacement code somewhere safe.</Label>
                  </div>
                </div>}
                <Button type="button" className="w-full" disabled={!!recoveryCode && !savedAcknowledged} onClick={recoveryCode ? saveCodeAndContinue : () => go("login")} data-testid="button-reset-sign-in">Continue to sign in</Button>
              </div>
            ) : (
              <form onSubmit={submitReset} className="space-y-4" data-testid="form-reset-password" noValidate>
                <div className="space-y-2"><Label htmlFor="reset-token">Saved recovery code</Label><Input id="reset-token" className={`${fieldClass} font-mono`} value={token} onChange={(event) => setToken(event.target.value)} autoComplete="off" required data-testid="input-reset-token" /></div>
                <div className="space-y-2"><Label htmlFor="new-password">New password</Label><Input id="new-password" className={fieldClass} type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={10} maxLength={128} required aria-describedby="new-password-hint" data-testid="input-new-password" /><p id="new-password-hint" className="text-xs text-muted-foreground">Use 10–128 characters.</p></div>
                <Button type="submit" className="w-full rugged-btn" disabled={busy} data-testid="button-reset-submit">{busy ? "Updating password…" : "Reset password"}</Button>
              </form>
            )
          )}

          <div className="mt-7 border-t border-border pt-5 text-center">
            <button type="button" onClick={onLegacy} className="text-sm font-semibold text-muted-foreground underline decoration-border underline-offset-4 transition-colors hover:text-foreground" data-testid="button-legacy-access">Already have beta access? Use existing access</button>
            <p className="mt-4 text-[11px] text-muted-foreground">BREEDLOG is built by STITCH WORX</p>
          </div>
        </section>
      </div>
    </main>
  );
}
