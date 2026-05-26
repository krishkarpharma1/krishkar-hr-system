import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, HelpCircle, Lock, User } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "../lib/api";
import { useAuthStore } from "../store/authStore";
import { ROLE_PORTAL } from "../types";

export default function LoginPage() {
  const navigate = useNavigate({ from: "/" });
  const setSession = useAuthStore((s) => s.setSession);
  const setEffectiveRoles = useAuthStore((s) => s.setEffectiveRoles);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function clearError() {
    if (errorMsg) setErrorMsg(null);
  }

  /** Map backend error strings to friendly user-facing messages. */
  function getFriendlyError(raw: string): string {
    const lower = raw.toLowerCase();
    if (
      lower.includes("invalid") ||
      lower.includes("wrong") ||
      lower.includes("incorrect") ||
      lower.includes("credentials") ||
      lower.includes("password") ||
      lower.includes("username") ||
      lower.includes("not found")
    ) {
      return "Invalid username or password. Please check your credentials and try again.";
    }
    if (lower.includes("inactive") || lower.includes("deactivated")) {
      return "Account is inactive. Please contact your HR Administrator.";
    }
    if (
      lower.includes("session") ||
      lower.includes("expired") ||
      lower.includes("unauthorized")
    ) {
      return "Your session has expired. Please log in again.";
    }
    if (lower.includes("network") || lower.includes("fetch")) {
      return "Connection error. Please check your internet and try again.";
    }
    // Return the raw message if it looks meaningful, otherwise generic
    return raw.length > 2 && raw.length < 200
      ? raw
      : "Login failed. Please try again.";
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!username.trim() || !password.trim()) {
      setErrorMsg("Please enter your username and password.");
      return;
    }

    setLoading(true);
    try {
      let result: Awaited<ReturnType<typeof api.login>>;
      try {
        result = await api.login(username.trim(), password);
      } catch (networkErr) {
        // Actor initialisation or network failure
        const msg =
          networkErr instanceof Error ? networkErr.message : String(networkErr);
        const friendly = msg.toLowerCase().includes("fetch")
          ? "Connection error — please check your internet and try again."
          : "Could not reach the server. Please try again in a moment.";
        setErrorMsg(friendly);
        toast.error(friendly, { duration: 5000 });
        return;
      }

      if (result.__kind__ === "ok") {
        const s = result.ok;
        setSession({
          token: s.token,
          userId: s.userId,
          role: s.role,
          employeeId: s.employeeId,
          name: s.name,
        });
        // Load effective roles (primary + additional charges) in the background
        try {
          const roles = await api.getEffectiveRoles(s.token, s.userId);
          setEffectiveRoles(roles);
        } catch {
          // Non-critical — additional role tabs simply won't show
        }
        toast.success(`Welcome, ${s.name}!`, { duration: 3000 });
        navigate({ to: ROLE_PORTAL[s.role] });
      } else {
        const friendly = getFriendlyError(result.err || "");
        setErrorMsg(friendly);
        toast.error(friendly, { duration: 5000 });
      }
    } catch (unexpectedErr) {
      const msg =
        unexpectedErr instanceof Error
          ? unexpectedErr.message
          : String(unexpectedErr);
      const friendly = getFriendlyError(msg);
      setErrorMsg(friendly);
      toast.error(friendly, { duration: 5000 });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header bar */}
      <header className="bg-card border-b border-border px-6 py-3 flex items-center gap-3">
        <img
          src="/assets/krishkar_logo.png"
          alt="Krishkar Pharmaceuticals"
          className="h-11 md:h-14 w-auto object-contain flex-shrink-0"
        />
        <span className="font-display font-semibold text-foreground tracking-wide text-sm uppercase">
          Krishkar Pharmaceuticals
        </span>
      </header>

      {/* Login form centered */}
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          {/* Brand block */}
          <div className="mb-8 text-center">
            <div className="flex items-center justify-center mb-4">
              <img
                src="/assets/krishkar_logo.png"
                alt="Krishkar Pharmaceuticals"
                className="h-14 md:h-16 w-auto object-contain"
              />
            </div>
            <h1 className="font-display font-bold text-2xl text-foreground tracking-tight">
              SFA Portal Login
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Use credentials assigned by your Admin or HR Manager
            </p>
          </div>

          {/* Form card */}
          <div className="bg-card border border-border rounded-lg p-6 shadow-lg">
            {/* Inline error banner */}
            {errorMsg && (
              <div
                className="mb-4 rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2.5 flex items-start gap-2.5"
                role="alert"
                data-ocid="login.error_state"
              >
                <svg
                  className="w-4 h-4 text-destructive shrink-0 mt-0.5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
                <p className="text-sm text-destructive leading-snug">
                  {errorMsg}
                </p>
              </div>
            )}

            <form
              onSubmit={handleSubmit}
              className="space-y-5"
              data-ocid="login.form"
              noValidate
            >
              <div className="space-y-1.5">
                <Label
                  htmlFor="username"
                  className="text-xs uppercase tracking-wider text-muted-foreground font-display"
                >
                  Username
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="username"
                    type="text"
                    autoComplete="username"
                    placeholder="Enter your username"
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value);
                      clearError();
                    }}
                    className="pl-10 bg-background border-input font-body"
                    data-ocid="login.username_input"
                    disabled={loading}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="password"
                  className="text-xs uppercase tracking-wider text-muted-foreground font-display"
                >
                  Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      clearError();
                    }}
                    className="pl-10 pr-10 bg-background border-input font-body"
                    data-ocid="login.password_input"
                    disabled={loading}
                    required
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full font-display font-semibold tracking-wide mt-2"
                disabled={loading}
                data-ocid="login.submit_button"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin" />
                    Signing in…
                  </span>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>

            {/* Forgot password help text */}
            <div className="mt-4 flex items-start gap-2 text-xs text-muted-foreground">
              <HelpCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-muted-foreground/70" />
              <p>
                Forgot your password?{" "}
                <span className="text-foreground font-medium">
                  Contact your HR Administrator
                </span>{" "}
                to reset it. Only Admin and HR can manage passwords.
              </p>
            </div>
          </div>

          {/* Portal info */}
          <div className="mt-5 bg-muted/40 border border-border rounded-lg p-4">
            <p className="text-xs font-display uppercase tracking-wider text-muted-foreground mb-2">
              Available Portals
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              {["Admin", "HR Manager", "ZSM", "RSM", "ASM", "MR"].map(
                (role) => (
                  <span
                    key={role}
                    className="text-xs text-center px-2 py-1 bg-secondary/60 text-secondary-foreground rounded font-body"
                  >
                    {role}
                  </span>
                ),
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-card border-t border-border px-6 py-3 text-center">
        <p className="text-xs text-muted-foreground font-body">
          © {new Date().getFullYear()} Krishkar Pharmaceuticals. Built with love
          using{" "}
          <a
            href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            caffeine.ai
          </a>
        </p>
      </footer>
    </div>
  );
}
