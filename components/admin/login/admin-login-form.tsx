"use client";

import { LogIn } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

import {
  readAdminAccessToken,
  readAdminSessionState,
} from "@/components/admin/admin-auth";
import { translateAdminErrorMessage } from "@/components/admin/admin-error-messages";
import { createBrowserHomeConfigClient } from "@/lib/home-sections/supabase";

const ADMIN_AFTER_LOGIN_PATH = "/admin/sections";
const TURNSTILE_SCRIPT_ID = "admin-login-turnstile-script";
const TURNSTILE_SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const TURNSTILE_MISSING_CHALLENGE_MESSAGE =
  "กรุณายืนยันตัวตนก่อนเข้าสู่ระบบ";
const TURNSTILE_FAILED_MESSAGE = "ยืนยันตัวตนไม่สำเร็จ กรุณาลองอีกครั้ง";
const TURNSTILE_CONFIG_MESSAGE = "ระบบยืนยันตัวตนยังไม่พร้อมใช้งาน";
const RESET_PASSWORD_SENT_MESSAGE =
  "ถ้าอีเมลนี้อยู่ในระบบ เราจะส่งลิงก์รีเซ็ตรหัสผ่านให้";
const ADMIN_ACCESS_REDIRECT_MESSAGE =
  "เซสชันหมดอายุหรือบัญชีนี้ยังไม่มีสิทธิ์แอดมิน กรุณาเข้าสู่ระบบอีกครั้ง";
const ADMIN_SUSPENDED_MESSAGE = "บัญชีแอดมินนี้ถูกระงับการใช้งาน";

const ADMIN_RESET_PASSWORD_PATH = "/admin/reset-password";
const ADMIN_ACCESS_ERROR_QUERY_VALUE = "admin-access";

type TurnstileWidgetId = string;

interface TurnstileRenderOptions {
  "error-callback": (errorCode?: string) => boolean;
  "expired-callback": () => void;
  action?: string;
  callback: (token: string) => void;
  size?: "compact" | "flexible" | "normal";
  sitekey: string;
  theme?: "auto" | "dark" | "light";
}

interface TurnstileApi {
  remove: (widgetId: TurnstileWidgetId) => void;
  render: (
    container: HTMLElement,
    options: TurnstileRenderOptions,
  ) => TurnstileWidgetId;
  reset: (widgetId?: TurnstileWidgetId) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

function getThaiLoginErrorMessage(message: string | undefined): string {
  if (!message) {
    return "เข้าสู่ระบบไม่สำเร็จ";
  }

  const normalizedMessage = message.trim().toLowerCase();

  if (normalizedMessage === "invalid login credentials") {
    return "อีเมลหรือรหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบแล้วลองอีกครั้ง";
  }

  return translateAdminErrorMessage(message);
}

function getTurnstileSiteKey(): string {
  return process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? "";
}

function isDevelopmentTurnstileBypass(): boolean {
  return process.env.NODE_ENV === "development";
}

function getTurnstileLoginErrorMessage(status: number | undefined): string {
  return status === 503 ? TURNSTILE_CONFIG_MESSAGE : TURNSTILE_FAILED_MESSAGE;
}

export function getAdminResetPasswordRedirectUrl(currentOrigin: string): string {
  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (configuredSiteUrl) {
    try {
      const siteUrl = new URL(configuredSiteUrl);

      if (siteUrl.protocol === "https:") {
        return new URL(ADMIN_RESET_PASSWORD_PATH, siteUrl.origin).toString();
      }
    } catch {
      // Fall back to the current origin when local env is missing or invalid.
    }
  }

  return `${currentOrigin}${ADMIN_RESET_PASSWORD_PATH}`;
}

export function AdminLoginForm() {
  const router = useRouter();
  const turnstileSiteKey = getTurnstileSiteKey();
  const isTurnstileEnabled =
    turnstileSiteKey.length > 0 && !isDevelopmentTurnstileBypass();
  const turnstileContainerRef = useRef<HTMLDivElement>(null);
  const turnstileWidgetIdRef = useRef<TurnstileWidgetId | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [turnstileToken, setTurnstileToken] = useState("");
  const errorId = "admin-login-error";
  const hasError = error !== null;

  useEffect(() => {
    let isMounted = true;
    const hasAdminAccessError =
      new URLSearchParams(window.location.search).get("error") ===
      ADMIN_ACCESS_ERROR_QUERY_VALUE;

    if (hasAdminAccessError) {
      void Promise.resolve().then(() => {
        if (isMounted) {
          setError(ADMIN_ACCESS_REDIRECT_MESSAGE);
        }
      });
    }

    void readAdminAccessToken().then(async (token) => {
      if (!isMounted || !token) {
        return;
      }
      const state = await readAdminSessionState(token);
      if (!isMounted) {
        return;
      }
      if (state === "active") {
        router.replace(ADMIN_AFTER_LOGIN_PATH);
      } else if (state === "forced") {
        router.replace("/admin/change-password");
      } else {
        await createBrowserHomeConfigClient().auth.signOut({ scope: "local" });
        if (isMounted) {
          setError(
            state === "inactive"
              ? ADMIN_SUSPENDED_MESSAGE
              : ADMIN_ACCESS_REDIRECT_MESSAGE,
          );
        }
      }
    });

    return () => {
      isMounted = false;
    };
  }, [router]);

  const resetTurnstile = useCallback(() => {
    setTurnstileToken("");

    const widgetId = turnstileWidgetIdRef.current;

    if (widgetId && window.turnstile) {
      window.turnstile.reset(widgetId);
    }
  }, []);

  useEffect(() => {
    if (!isTurnstileEnabled) {
      return undefined;
    }

    let isMounted = true;
    let script: HTMLScriptElement | null = null;

    const renderTurnstile = () => {
      if (
        !isMounted ||
        turnstileWidgetIdRef.current ||
        !turnstileContainerRef.current ||
        !window.turnstile
      ) {
        return;
      }

      turnstileWidgetIdRef.current = window.turnstile.render(
        turnstileContainerRef.current,
        {
          "error-callback": () => {
            setTurnstileToken("");
            setError(TURNSTILE_FAILED_MESSAGE);
            return true;
          },
          "expired-callback": () => {
            setTurnstileToken("");
          },
          action: "admin_login",
          callback: (token: string) => {
            setTurnstileToken(token);
            setError(null);
          },
          size: "flexible",
          sitekey: turnstileSiteKey,
          theme: "auto",
        },
      );
    };

    const handleScriptError = () => {
      setTurnstileToken("");
      setError(TURNSTILE_FAILED_MESSAGE);
    };

    if (window.turnstile) {
      renderTurnstile();
    } else {
      script = document.getElementById(
        TURNSTILE_SCRIPT_ID,
      ) as HTMLScriptElement | null;

      if (!script) {
        script = document.createElement("script");
        script.async = true;
        script.defer = true;
        script.id = TURNSTILE_SCRIPT_ID;
        script.src = TURNSTILE_SCRIPT_SRC;
        document.head.append(script);
      }

      script.addEventListener("load", renderTurnstile);
      script.addEventListener("error", handleScriptError);
    }

    return () => {
      isMounted = false;

      if (script) {
        script.removeEventListener("load", renderTurnstile);
        script.removeEventListener("error", handleScriptError);
      }

      const widgetId = turnstileWidgetIdRef.current;

      if (widgetId && window.turnstile) {
        window.turnstile.remove(widgetId);
      }

      turnstileWidgetIdRef.current = null;
    };
  }, [isTurnstileEnabled, turnstileSiteKey]);

  async function verifyTurnstile(): Promise<boolean> {
    if (isTurnstileEnabled && !turnstileToken) {
      setError(TURNSTILE_MISSING_CHALLENGE_MESSAGE);
      return false;
    }

    try {
      const response = await fetch("/api/admin/login/turnstile", {
        body: JSON.stringify({ token: turnstileToken }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      if (!response.ok) {
        setError(getTurnstileLoginErrorMessage(response.status));
        resetTurnstile();
        return false;
      }

      return true;
    } catch {
      setError(TURNSTILE_FAILED_MESSAGE);
      resetTurnstile();
      return false;
    }
  }

  async function handleLoginSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedEmail = email.trim();

    if (!trimmedEmail || !password) {
      setError("กรอกอีเมลและรหัสผ่านให้ครบ");
      return;
    }

    setError(null);
    setNotice(null);
    setIsSubmitting(true);

    try {
      const isTurnstileVerified = await verifyTurnstile();

      if (!isTurnstileVerified) {
        return;
      }

      const supabase = createBrowserHomeConfigClient();
      const { data: loginData, error: loginError } =
        await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        });

      if (loginError) {
        setError(getThaiLoginErrorMessage(loginError.message));
        resetTurnstile();
        return;
      }

      const accessToken = loginData?.session?.access_token;
      const state = accessToken
        ? await readAdminSessionState(accessToken)
        : "invalid";
      if (state === "active") {
        router.replace(ADMIN_AFTER_LOGIN_PATH);
      } else if (state === "forced") {
        router.replace("/admin/change-password");
      } else {
        await supabase.auth.signOut({ scope: "local" });
        setError(
          state === "inactive"
            ? ADMIN_SUSPENDED_MESSAGE
            : ADMIN_ACCESS_REDIRECT_MESSAGE,
        );
      }
    } catch (caughtError) {
      resetTurnstile();
      setError(
        caughtError instanceof Error
          ? getThaiLoginErrorMessage(caughtError.message)
          : "ไม่สามารถเปิดหน้าเข้าสู่ระบบได้",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleForgotPasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setError("กรอกอีเมลสำหรับส่งลิงก์รีเซ็ตรหัสผ่าน");
      setNotice(null);
      return;
    }

    setError(null);
    setNotice(null);
    setIsSubmitting(true);

    try {
      const isTurnstileVerified = await verifyTurnstile();

      if (!isTurnstileVerified) {
        return;
      }

      const supabase = createBrowserHomeConfigClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: getAdminResetPasswordRedirectUrl(window.location.origin),
      });

      if (resetError) {
        setError("ไม่สามารถส่งลิงก์รีเซ็ตรหัสผ่านได้");
        return;
      }

      setNotice(RESET_PASSWORD_SENT_MESSAGE);
      resetTurnstile();
    } catch {
      setError("ไม่สามารถส่งลิงก์รีเซ็ตรหัสผ่านได้");
    } finally {
      setIsSubmitting(false);
    }
  }

  const isForgotMode = mode === "forgot";

  return (
    <form
      className="w-full max-w-sm rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] p-5"
      onSubmit={isForgotMode ? handleForgotPasswordSubmit : handleLoginSubmit}
    >
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-[var(--site-text)]">
          {isForgotMode ? "ลืมรหัสผ่าน" : "เข้าสู่ระบบหลังบ้าน"}
        </h1>
        <p className="mt-1 text-sm text-[var(--site-muted)]">
          {isForgotMode
            ? "กรอกอีเมลแอดมินเพื่อรับลิงก์รีเซ็ตรหัสผ่าน"
            : "จัดชุดบ้านพักบนหน้าแรก"}
        </p>
      </div>

      <div className="space-y-4">
        <label className="block text-sm font-medium text-[var(--site-text)]">
          อีเมล
          <input
            aria-describedby={hasError ? errorId : undefined}
            aria-invalid={hasError}
            autoComplete="email"
            className="mt-1 h-10 w-full rounded-md border border-[var(--site-border)] bg-[var(--site-surface)] px-3 text-sm text-[var(--site-text)] outline-none transition focus:border-[var(--site-primary)] focus:ring-2 focus:ring-[var(--site-primary)]/15 disabled:bg-[var(--site-surface-soft)]"
            disabled={isSubmitting}
            inputMode="email"
            maxLength={254}
            name="email"
            onChange={(event) => {
              setEmail(event.target.value);
            }}
            required
            type="email"
            value={email}
          />
        </label>

        {isForgotMode ? null : (
          <label className="block text-sm font-medium text-[var(--site-text)]">
            รหัสผ่าน
            <input
              aria-describedby={hasError ? errorId : undefined}
              aria-invalid={hasError}
              autoComplete="current-password"
              className="mt-1 h-10 w-full rounded-md border border-[var(--site-border)] bg-[var(--site-surface)] px-3 text-sm text-[var(--site-text)] outline-none transition focus:border-[var(--site-primary)] focus:ring-2 focus:ring-[var(--site-primary)]/15 disabled:bg-[var(--site-surface-soft)]"
              disabled={isSubmitting}
              maxLength={128}
              name="password"
              onChange={(event) => {
                setPassword(event.target.value);
              }}
              required
              type="password"
              value={password}
            />
          </label>
        )}
      </div>

      {isTurnstileEnabled ? (
        <div className="mt-4 space-y-2">
          <div className="min-h-[65px]" ref={turnstileContainerRef} />
          <p className="text-xs leading-5 text-[var(--site-muted)]">
            ยืนยันว่าเป็นผู้ใช้งานจริงก่อนเข้าสู่ระบบ
          </p>
        </div>
      ) : null}

      {error ? (
        <p
          className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          id={errorId}
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {notice ? (
        <p
          className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
          role="status"
        >
          {notice}
        </p>
      ) : null}

      <button
        className="mt-5 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[var(--site-primary)] px-4 text-sm font-semibold text-[var(--site-on-primary)] transition hover:brightness-95 disabled:cursor-not-allowed disabled:bg-[var(--site-border-strong)]"
        disabled={isSubmitting}
        type="submit"
      >
        {isForgotMode ? null : <LogIn aria-hidden="true" className="size-4" />}
        {isSubmitting
          ? isForgotMode
            ? "กำลังส่งลิงก์..."
            : "กำลังเข้าสู่ระบบ..."
          : isForgotMode
            ? "ส่งลิงก์รีเซ็ตรหัสผ่าน"
            : "เข้าสู่ระบบ"}
      </button>

      <button
        className="mt-3 w-full text-center text-sm font-semibold text-[var(--site-primary)]"
        disabled={isSubmitting}
        onClick={() => {
          setError(null);
          setNotice(null);
          setMode(isForgotMode ? "login" : "forgot");
        }}
        type="button"
      >
        {isForgotMode ? "กลับไปเข้าสู่ระบบ" : "ลืมรหัสผ่าน"}
      </button>
    </form>
  );
}
