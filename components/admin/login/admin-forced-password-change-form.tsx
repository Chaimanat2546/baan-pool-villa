"use client";

import { KeyRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";

import {
  readAdminAccessToken,
  readAdminSessionState,
} from "@/components/admin/admin-auth";
import { validateAdminPasswordChange } from "@/components/admin/admin-password-validation";
import { createBrowserHomeConfigClient } from "@/lib/home-sections/supabase";

const ERROR_MESSAGES: Record<string, string> = {
  temporary_password_invalid: "รหัสผ่านชั่วคราวไม่ถูกต้อง",
  lease_conflict: "มีการเปลี่ยนรหัสผ่านรายการนี้อยู่ กรุณารอสักครู่แล้วลองใหม่",
  provider_ambiguous:
    "ยังยืนยันผลการเปลี่ยนรหัสผ่านไม่ได้ บัญชียังคงถูกบังคับให้เปลี่ยนรหัสผ่าน กรุณาติดต่อผู้ดูแล",
  late_fence:
    "ข้อมูลสิทธิ์มีการเปลี่ยนแปลงระหว่างดำเนินการ กรุณาเข้าสู่ระบบใหม่",
};

export function AdminForcedPasswordChangeForm() {
  const router = useRouter();
  const operationIdRef = useRef<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let mounted = true;
    void readAdminAccessToken().then(async (token) => {
      if (!mounted) {
        return;
      }
      if (!token) {
        router.replace("/admin/login");
        return;
      }
      const state = await readAdminSessionState(token);
      if (!mounted) {
        return;
      }
      if (state === "active") {
        router.replace("/admin/sections");
        return;
      }
      if (state !== "forced") {
        await createBrowserHomeConfigClient().auth.signOut({ scope: "local" });
        router.replace("/admin/login?error=admin-access");
        return;
      }
      setAccessToken(token);
      setIsReady(true);
    });
    return () => {
      mounted = false;
    };
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken || !isReady) {
      return;
    }
    if (!currentPassword) {
      setError("กรอกรหัสผ่านชั่วคราว");
      return;
    }
    const validationError = validateAdminPasswordChange({
      newPassword,
      confirmPassword,
    });
    if (validationError) {
      setError(validationError);
      return;
    }
    if (currentPassword === newPassword) {
      setError("รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านชั่วคราว");
      return;
    }

    setError(null);
    setIsSubmitting(true);
    operationIdRef.current ??= crypto.randomUUID();
    try {
      const response = await fetch("/api/admin/change-password", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          operationId: operationIdRef.current,
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });
      const result = (await response.json()) as {
        ok?: boolean;
        code?: string;
        clearSession?: boolean;
      };
      if (result.clearSession) {
        await createBrowserHomeConfigClient().auth.signOut({ scope: "local" });
      }
      if (result.ok) {
        router.replace("/admin/login?password=changed");
        return;
      }
      if (result.clearSession) {
        router.replace("/admin/login?error=admin-access");
        return;
      }
      setError(
        (result.code && ERROR_MESSAGES[result.code]) ??
          "เปลี่ยนรหัสผ่านไม่สำเร็จ กรุณาลองใหม่",
      );
    } catch {
      setError("เชื่อมต่อระบบเปลี่ยนรหัสผ่านไม่ได้ กรุณาลองใหม่");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      className="w-full max-w-md rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] p-5 sm:p-6"
      onSubmit={handleSubmit}
    >
      <div className="mb-5">
        <span className="inline-flex size-10 items-center justify-center rounded-lg bg-[var(--site-primary-soft)] text-[var(--site-primary)]">
          <KeyRound aria-hidden="true" className="size-5" />
        </span>
        <h1 className="mt-3 text-xl font-semibold text-[var(--site-text)]">
          ตั้งรหัสผ่านใหม่
        </h1>
        <p className="mt-1 text-sm leading-6 text-[var(--site-muted)]">
          บัญชีนี้ใช้รหัสผ่านชั่วคราว กรุณาตั้งรหัสผ่านใหม่ก่อนใช้งานหลังบ้าน
        </p>
      </div>

      <div className="space-y-4">
        <label className="block text-sm font-medium text-[var(--site-text)]">
          รหัสผ่านชั่วคราว
          <input
            autoComplete="current-password"
            className="mt-1 h-10 w-full rounded-md border border-[var(--site-border)] bg-[var(--site-surface)] px-3 outline-none focus:border-[var(--site-primary)] focus:ring-2 focus:ring-[var(--site-primary)]/15"
            disabled={!isReady || isSubmitting}
            maxLength={128}
            onChange={(event) => setCurrentPassword(event.target.value)}
            required
            type="password"
            value={currentPassword}
          />
        </label>
        <label className="block text-sm font-medium text-[var(--site-text)]">
          รหัสผ่านใหม่
          <input
            autoComplete="new-password"
            className="mt-1 h-10 w-full rounded-md border border-[var(--site-border)] bg-[var(--site-surface)] px-3 outline-none focus:border-[var(--site-primary)] focus:ring-2 focus:ring-[var(--site-primary)]/15"
            disabled={!isReady || isSubmitting}
            maxLength={128}
            onChange={(event) => setNewPassword(event.target.value)}
            required
            type="password"
            value={newPassword}
          />
        </label>
        <label className="block text-sm font-medium text-[var(--site-text)]">
          ยืนยันรหัสผ่านใหม่
          <input
            autoComplete="new-password"
            className="mt-1 h-10 w-full rounded-md border border-[var(--site-border)] bg-[var(--site-surface)] px-3 outline-none focus:border-[var(--site-primary)] focus:ring-2 focus:ring-[var(--site-primary)]/15"
            disabled={!isReady || isSubmitting}
            maxLength={128}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
            type="password"
            value={confirmPassword}
          />
        </label>
      </div>

      {error ? (
        <p
          className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <button
        className="mt-5 inline-flex h-10 w-full items-center justify-center rounded-md bg-[var(--site-primary)] px-4 text-sm font-semibold text-[var(--site-on-primary)] disabled:cursor-not-allowed disabled:opacity-60"
        disabled={!isReady || isSubmitting}
        type="submit"
      >
        {isSubmitting ? "กำลังเปลี่ยนรหัสผ่าน..." : "ตั้งรหัสผ่านใหม่"}
      </button>
    </form>
  );
}
