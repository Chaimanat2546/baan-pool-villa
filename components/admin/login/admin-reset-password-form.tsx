"use client";

import { KeyRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { getAdminErrorMessage } from "@/components/admin/admin-error-messages";
import {
  MAX_ADMIN_PASSWORD_LENGTH,
  MIN_ADMIN_PASSWORD_LENGTH,
  validateAdminPasswordChange,
} from "@/components/admin/admin-password-validation";
import { createBrowserHomeConfigClient } from "@/lib/home-sections/supabase";

const INVALID_RESET_LINK_MESSAGE = "ลิงก์รีเซ็ตรหัสผ่านไม่ถูกต้องหรือหมดอายุ";

function readRecoveryAccessToken(): string | null {
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const accessToken = hashParams.get("access_token");

  if (hashParams.get("type") !== "recovery" || !accessToken) {
    return null;
  }

  return accessToken;
}

export function AdminResetPasswordForm() {
  const router = useRouter();
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newPassword, setNewPassword] = useState("");

  useEffect(() => {
    let isMounted = true;

    const recoveryAccessToken = readRecoveryAccessToken();

    if (!recoveryAccessToken) {
      void Promise.resolve().then(() => {
        if (isMounted) {
          setError(INVALID_RESET_LINK_MESSAGE);
        }
      });

      return () => {
        isMounted = false;
      };
    }

    const supabase = createBrowserHomeConfigClient();
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (
          isMounted &&
          event === "PASSWORD_RECOVERY" &&
          session?.access_token === recoveryAccessToken
        ) {
          setError(null);
          setIsReady(true);
        }
      },
    );

    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!isMounted) {
        return;
      }

      if (sessionError || data.session?.access_token !== recoveryAccessToken) {
        setError(INVALID_RESET_LINK_MESSAGE);
        setIsReady(false);
        return;
      }

      setError(null);
      setIsReady(true);
    });

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isReady) {
      setError(INVALID_RESET_LINK_MESSAGE);
      return;
    }

    const validationError = validateAdminPasswordChange({
      confirmPassword,
      newPassword,
    });

    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const supabase = createBrowserHomeConfigClient();
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        setError(getAdminErrorMessage(updateError, "ไม่สามารถตั้งรหัสผ่านใหม่ได้"));
        return;
      }

      const { error: signOutError } = await supabase.auth.signOut();

      if (signOutError) {
        setError(getAdminErrorMessage(signOutError, "ไม่สามารถออกจากระบบได้"));
        return;
      }

      router.replace("/admin/login");
    } catch (caughtError) {
      setError(
        getAdminErrorMessage(caughtError, "ไม่สามารถตั้งรหัสผ่านใหม่ได้"),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      className="w-full max-w-sm rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] p-5"
      onSubmit={handleSubmit}
    >
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-[var(--site-text)]">
          ตั้งรหัสผ่านใหม่
        </h1>
        <p className="mt-1 text-sm leading-6 text-[var(--site-muted)]">
          กรอกรหัสผ่านใหม่สำหรับบัญชีแอดมิน แล้วเข้าสู่ระบบอีกครั้ง
        </p>
      </div>

      {error ? (
        <p
          className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <div className="space-y-4">
        <label className="block text-sm font-medium text-[var(--site-text)]">
          รหัสผ่านใหม่
          <input
            autoComplete="new-password"
            className="mt-1 h-10 w-full rounded-md border border-[var(--site-border)] bg-[var(--site-surface)] px-3 text-sm text-[var(--site-text)] outline-none transition focus:border-[var(--site-primary)] focus:ring-2 focus:ring-[var(--site-primary)]/15 disabled:bg-[var(--site-surface-soft)]"
            disabled={isSubmitting || !isReady}
            id="adminResetNewPassword"
            maxLength={MAX_ADMIN_PASSWORD_LENGTH}
            minLength={MIN_ADMIN_PASSWORD_LENGTH}
            onChange={(event) => {
              setNewPassword(event.target.value);
            }}
            type="password"
            value={newPassword}
          />
          <span className="mt-2 block text-xs font-normal leading-5 text-[var(--site-muted)]">
            รหัสผ่านต้องมีอย่างน้อย 8 ตัว ห้ามเว้นวรรค และประกอบด้วย:
          </span>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-xs font-normal leading-5 text-[var(--site-muted)]">
            <li>ตัวอักษรภาษาอังกฤษพิมพ์เล็ก เช่น a-z</li>
            <li>ตัวอักษรภาษาอังกฤษพิมพ์ใหญ่ เช่น A-Z</li>
            <li>ตัวเลข เช่น 0-9</li>
            <li>สัญลักษณ์พิเศษ เช่น ! @ # $</li>
          </ul>
        </label>

        <label className="block text-sm font-medium text-[var(--site-text)]">
          ยืนยันรหัสผ่านใหม่
          <input
            autoComplete="new-password"
            className="mt-1 h-10 w-full rounded-md border border-[var(--site-border)] bg-[var(--site-surface)] px-3 text-sm text-[var(--site-text)] outline-none transition focus:border-[var(--site-primary)] focus:ring-2 focus:ring-[var(--site-primary)]/15 disabled:bg-[var(--site-surface-soft)]"
            disabled={isSubmitting || !isReady}
            id="adminResetConfirmPassword"
            maxLength={MAX_ADMIN_PASSWORD_LENGTH}
            minLength={MIN_ADMIN_PASSWORD_LENGTH}
            onChange={(event) => {
              setConfirmPassword(event.target.value);
            }}
            type="password"
            value={confirmPassword}
          />
        </label>

      </div>

      <button
        className="mt-5 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[var(--site-primary)] px-4 text-sm font-semibold text-[var(--site-on-primary)] transition hover:brightness-95 disabled:cursor-not-allowed disabled:bg-[var(--site-border-strong)]"
        disabled={isSubmitting || !isReady}
        type="submit"
      >
        <KeyRound aria-hidden="true" className="size-4" />
        {isSubmitting ? "กำลังตั้งรหัสผ่าน..." : "ตั้งรหัสผ่านใหม่"}
      </button>
      <button
        className="mt-3 w-full text-center text-sm font-semibold text-[var(--site-primary)]"
        disabled={isSubmitting}
        onClick={() => {
          router.replace("/admin/login");
        }}
        type="button"
      >
        กลับไปหน้าเข้าสู่ระบบ
      </button>
    </form>
  );
}
