"use client";

import { useState, type FormEvent } from "react";
import { Capacitor } from "@capacitor/core";
import { supabase } from "../supabase";
import { TRACK_LIMITS, USERNAME_PATTERN } from "../trackConstants";
import { InlineLoadingSkeleton } from "./LoadingSkeletons";

export function normalizeLoginUsername(value: string) {
  return value.trim().replace(/^@+/, "").replace(/\s+/g, "").toLowerCase();
}

function isUsernameLoginIdentifier(value: string) {
  const trimmed = value.trim();
  const normalized = normalizeLoginUsername(trimmed);
  return USERNAME_PATTERN.test(normalized) && (!trimmed.includes("@") || trimmed.startsWith("@"));
}

export async function invokeUsernameAuth(body: {
  action: "sign-in" | "reset";
  username: string;
  password?: string;
  redirectTo?: string;
}) {
  try {
    const result = await supabase.functions.invoke("username-auth", { body });
    const session = result.data?.session;
    if (session?.access_token && session?.refresh_token) {
      const { error } = await supabase.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });
      if (!error) return { ok: true as const, available: true as const };
      return { ok: false as const, available: true as const, error: error.message };
    }
    if (!result.error && body.action === "reset" && result.data?.message)
      return { ok: true as const, available: true as const, message: result.data.message };
    const rawError = result.data?.error || result.error?.message || "";
    const requestFailed = /failed to send a request|failed to fetch|network|fetch/i.test(rawError);
    return {
      ok: false as const,
      available: !result.error,
      error: requestFailed
        ? "Track II couldn’t reach the username sign-in service. Check your connection and try email sign-in if needed."
        : rawError,
    };
  } catch {
    return {
      ok: false as const,
      available: false as const,
      error: "Track II couldn’t reach the username sign-in service. Check your connection and try again.",
    };
  }
}

function authErrorMessage(error: { code?: string; message?: string } | null | undefined) {
  const code = String(error?.code ?? "").toLowerCase();
  const message = String(error?.message ?? "");
  if (code === "email_not_confirmed" || /email.*confirm|confirm.*email/i.test(message))
    return "Confirm your email before signing in. We can send the confirmation link again.";
  if (/failed to fetch|network|fetch/i.test(message))
    return "Track II couldn’t reach the sign-in service. Check your connection and try again.";
  if (/invalid login credentials|invalid credentials/i.test(message)) return "The email or password is incorrect.";
  if (/expired|invalid.*token/i.test(message)) return "This sign-in link has expired. Request a new one and try again.";
  return message || "We couldn’t complete that request. Try again shortly.";
}

export function AuthScreen({ initialMessage = "" }: { initialMessage?: string }) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [message, setMessage] = useState(initialMessage);
  const [busy, setBusy] = useState(false);
  const [verificationPending, setVerificationPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setVerificationPending(false);
    if (mode === "forgot") {
      const resetIdentifier = email.trim();
      if (!resetIdentifier) {
        setBusy(false);
        setMessage("Enter the username or email used for your Track II account.");
        return;
      }
      const normalizedResetUsername = normalizeLoginUsername(resetIdentifier);
      const resetLooksLikeUsername = isUsernameLoginIdentifier(resetIdentifier);
      if (resetLooksLikeUsername && USERNAME_PATTERN.test(normalizedResetUsername)) {
        const usernameResult = await invokeUsernameAuth({
          action: "reset",
          username: normalizedResetUsername,
          redirectTo: window.location.origin,
        });
        setBusy(false);
        if (usernameResult.ok) {
          setMessage(usernameResult.message || "If an account exists for that username, a reset link is on its way.");
          return;
        }
        setMessage(
          usernameResult.error ||
            "Username recovery is temporarily unavailable. Try again shortly or use your account email.",
        );
        return;
      }
      const { error } = await supabase.auth.resetPasswordForEmail(resetIdentifier, {
        redirectTo: window.location.origin,
      });
      setBusy(false);
      setMessage(error ? authErrorMessage(error) : "If an account exists for that email, a reset link is on its way.");
      return;
    }
    const normalizedUsername = username.trim().replace(/\s+/g, "");
    if (mode === "signin") {
      const loginIdentifier = email.trim();
      const loginUsername = normalizeLoginUsername(loginIdentifier);
      if (isUsernameLoginIdentifier(loginIdentifier)) {
        const usernameResult = await invokeUsernameAuth({ action: "sign-in", username: loginUsername, password });
        setBusy(false);
        if (usernameResult.ok) return;
        setMessage(
          usernameResult.error ||
            "Username sign-in is temporarily unavailable. Try again shortly or use your account email.",
        );
        return;
      }
      const result = await supabase.auth.signInWithPassword({ email: loginIdentifier, password });
      setBusy(false);
      if (result.error) {
        setMessage(authErrorMessage(result.error));
        setVerificationPending(
          result.error.code === "email_not_confirmed" || /email.*confirm/i.test(result.error.message),
        );
      }
      return;
    }
    if (!USERNAME_PATTERN.test(normalizedUsername)) {
      setBusy(false);
      setMessage("Choose a username with 2–24 letters, numbers, dots, underscores, or hyphens.");
      return;
    }
    const result = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { username: normalizedUsername } },
    });
    setBusy(false);
    if (result.error) setMessage(authErrorMessage(result.error));
    else if (!result.data.session) {
      setMessage("Check your email, then open the confirmation link.");
      setVerificationPending(true);
    }
  }

  async function resendConfirmation() {
    const address = email.trim();
    if (!address.includes("@")) {
      setMessage("Enter your account email to resend the confirmation link.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.resend({ type: "signup", email: address });
    setBusy(false);
    setMessage(error ? authErrorMessage(error) : "Confirmation email sent. Check your inbox and spam folder.");
    if (!error) setVerificationPending(false);
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="auth-brand">
          <div className="auth-logo">
            <span className="dumbbell-icon" />
          </div>
          <span>TRACK II</span>
          {!Capacitor.isNativePlatform() && <small className="brand-beta">BETA</small>}
        </div>
        <h1>
          {mode === "signin" ? "Welcome back" : mode === "signup" ? "Create your account" : "Reset your password"}
        </h1>
        <p>
          {mode === "forgot"
            ? "Enter your account email and we’ll send a secure password reset link."
            : "Your workout data will stay private and sync across your devices."}
        </p>
        <form onSubmit={submit}>
          {mode === "signup" && (
            <label>
              Username
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.slice(0, TRACK_LIMITS.maxUsernameChars))}
                autoComplete="username"
                minLength={TRACK_LIMITS.minUsernameChars}
                maxLength={TRACK_LIMITS.maxUsernameChars}
                required
              />
            </label>
          )}
          <label>
            {mode === "signin" || mode === "forgot" ? "Username or email" : "Email"}
            <input
              type={mode === "signin" || mode === "forgot" ? "text" : "email"}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete={mode === "signin" || mode === "forgot" ? "username" : "email"}
              placeholder={mode === "signin" || mode === "forgot" ? "username or email" : undefined}
              required
            />
          </label>
          {mode !== "forgot" && (
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                minLength={6}
                required
              />
            </label>
          )}
          {message && <div className="auth-message">{message}</div>}
          {verificationPending && (mode === "signin" || mode === "signup") && (
            <button type="button" className="auth-resend" onClick={() => void resendConfirmation()} disabled={busy}>
              Resend confirmation email
            </button>
          )}
          <button disabled={busy}>
            {busy ? (
              <InlineLoadingSkeleton label="Submitting account request" />
            ) : mode === "signin" ? (
              "Sign in"
            ) : mode === "signup" ? (
              "Create account"
            ) : (
              "Send reset link"
            )}
          </button>
        </form>
        {mode === "signin" && (
          <button
            type="button"
            className="auth-forgot"
            onClick={() => {
              setMode("forgot");
              setPassword("");
              setMessage("");
              setVerificationPending(false);
            }}
          >
            Forgot password?
          </button>
        )}
        <button
          type="button"
          className="auth-switch"
          onClick={() => {
            setMode(mode === "signup" ? "signin" : "signup");
            setUsername("");
            setEmail("");
            setPassword("");
            setMessage("");
            setVerificationPending(false);
          }}
        >
          {mode === "signup" ? "Already have an account? Sign in" : "New to Track II? Create an account"}
        </button>
        {mode === "forgot" && (
          <button
            type="button"
            className="auth-switch auth-back"
            onClick={() => {
              setMode("signin");
              setPassword("");
              setMessage("");
              setVerificationPending(false);
            }}
          >
            Back to sign in
          </button>
        )}
      </section>
    </main>
  );
}
