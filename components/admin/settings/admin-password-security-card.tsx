"use client";

import { KeyRound, Mail, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { getAdminErrorMessage } from "@/components/admin/admin-error-messages";
import { readAdminAccessToken } from "@/components/admin/admin-auth";
import { createBrowserHomeConfigClient } from "@/lib/home-sections/supabase";

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;
const OTP_RESEND_COOLDOWN_SECONDS = 60;
const OTP_PATTERN = /^\d{6}$/;
const PRINTABLE_ASCII_PATTERN = /^[\x20-\x7E]+$/;
const PASSWORD_SYMBOLS = "!@#$%^&*()_+-=[]{};'\":|<>?,./`~";

function readErrorMessage(caughtError: unknown): string {
  if (caughtError instanceof Error) {
    return caughtError.message;
  }

  if (typeof caughtError === "object" && caughtError !== null) {
    const message =
      "message" in caughtError && typeof caughtError.message === "string"
        ? caughtError.message
        : "";
    const status =
      "status" in caughtError &&
      (typeof caughtError.status === "number" ||
        typeof caughtError.status === "string")
        ? String(caughtError.status)
        : "";
    const code =
      "code" in caughtError && typeof caughtError.code === "string"
        ? caughtError.code
        : "";

    return [status, code, message].filter(Boolean).join(" ");
  }

  return "";
}

function isOtpRateLimitError(caughtError: unknown): boolean {
  const message = readErrorMessage(caughtError).toLowerCase();

  return (
    message.includes("429") ||
    message.includes("too many requests") ||
    message.includes("rate limit") ||
    message.includes("over_email_send_rate_limit") ||
    message.includes("over_request_rate_limit") ||
    message.includes("over_sms_send_rate_limit")
  );
}

function getOtpSendErrorMessage(caughtError: unknown): string {
  if (isOtpRateLimitError(caughtError)) {
    return `ส่ง OTP ถี่เกินไป กรุณารอ ${OTP_RESEND_COOLDOWN_SECONDS} วินาทีแล้วลองใหม่`;
  }

  return getAdminErrorMessage(caughtError, "ไม่สามารถส่งรหัส OTP ได้");
}

function validatePasswordChange({
  confirmPassword,
  newPassword,
  otp,
}: {
  confirmPassword: string;
  newPassword: string;
  otp: string;
}): string | null {
  if (!OTP_PATTERN.test(otp.trim())) {
    return "รหัส OTP ต้องเป็นตัวเลข 6 หลัก";
  }

  if (!newPassword) {
    return "กรอกรหัสผ่านใหม่";
  }

  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return `รหัสผ่านใหม่ต้องมีอย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร`;
  }

  if (newPassword.length > MAX_PASSWORD_LENGTH) {
    return `รหัสผ่านใหม่ต้องไม่เกิน ${MAX_PASSWORD_LENGTH} ตัวอักษร`;
  }

  if (!PRINTABLE_ASCII_PATTERN.test(newPassword)) {
    return "รหัสผ่านใหม่ต้องใช้เฉพาะอักขระ ASCII ที่พิมพ์ได้";
  }

  if (!/[a-z]/.test(newPassword)) {
    return "รหัสผ่านใหม่ต้องมีตัวพิมพ์เล็กอย่างน้อย 1 ตัว";
  }

  if (!/[A-Z]/.test(newPassword)) {
    return "รหัสผ่านใหม่ต้องมีตัวพิมพ์ใหญ่อย่างน้อย 1 ตัว";
  }

  if (!/[0-9]/.test(newPassword)) {
    return "รหัสผ่านใหม่ต้องมีตัวเลขอย่างน้อย 1 ตัว";
  }

  if (![...newPassword].some((character) => PASSWORD_SYMBOLS.includes(character))) {
    return "รหัสผ่านใหม่ต้องมีสัญลักษณ์อย่างน้อย 1 ตัว";
  }

  if (!confirmPassword) {
    return "กรอกยืนยันรหัสผ่านใหม่";
  }

  if (newPassword !== confirmPassword) {
    return "รหัสผ่านใหม่ทั้งสองช่องต้องตรงกัน";
  }

  return null;
}

export function AdminPasswordSecurityCard() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpCooldownSeconds, setOtpCooldownSeconds] = useState(0);
  const [otpEmail, setOtpEmail] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (otpCooldownSeconds <= 0) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setOtpCooldownSeconds((seconds) => Math.max(0, seconds - 1));
    }, 1000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [otpCooldownSeconds]);

  function resetModal() {
    setOtp("");
    setOtpEmail(null);
    setNewPassword("");
    setConfirmPassword("");
    setError(null);
    setNotice(null);
  }

  function closeModal() {
    resetModal();
    setIsOpen(false);
  }

  async function requireAdminSession(): Promise<boolean> {
    const token = await readAdminAccessToken();

    if (!token) {
      router.replace("/admin/login");
      return false;
    }

    return true;
  }

  async function handleSendOtp() {
    if (otpCooldownSeconds > 0) {
      return;
    }

    setIsSendingOtp(true);
    setError(null);
    setNotice(null);

    try {
      const hasSession = await requireAdminSession();

      if (!hasSession) {
        return;
      }

      const supabase = createBrowserHomeConfigClient();
      const { data: userData, error: userError } = await supabase.auth.getUser();
      const email = userData.user?.email?.trim();

      if (userError || !email) {
        setError(
          getAdminErrorMessage(userError, "ไม่พบอีเมลของบัญชีนี้สำหรับส่ง OTP"),
        );
        return;
      }

      const { error: otpError } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false },
      });

      if (otpError) {
        if (isOtpRateLimitError(otpError)) {
          setOtpCooldownSeconds(OTP_RESEND_COOLDOWN_SECONDS);
        }

        setError(getOtpSendErrorMessage(otpError));
        return;
      }

      setOtp("");
      setOtpEmail(email);
      setOtpCooldownSeconds(OTP_RESEND_COOLDOWN_SECONDS);
      setNotice("ส่งรหัส OTP แล้ว กรุณาตรวจสอบอีเมล");
    } catch (caughtError) {
      if (isOtpRateLimitError(caughtError)) {
        setOtpCooldownSeconds(OTP_RESEND_COOLDOWN_SECONDS);
      }

      setError(getOtpSendErrorMessage(caughtError));
    } finally {
      setIsSendingOtp(false);
    }
  }

  async function handleChangePassword() {
    const validationError = validatePasswordChange({
      confirmPassword,
      newPassword,
      otp,
    });

    if (validationError) {
      setError(validationError);
      setNotice(null);
      return;
    }

    setIsChangingPassword(true);
    setError(null);
    setNotice(null);

    try {
      const hasSession = await requireAdminSession();

      if (!hasSession) {
        return;
      }

      const supabase = createBrowserHomeConfigClient();
      let email = otpEmail;

      if (!email) {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        email = userData.user?.email?.trim() ?? null;

        if (userError || !email) {
          setError(
            getAdminErrorMessage(userError, "ไม่พบอีเมลของบัญชีนี้สำหรับตรวจสอบ OTP"),
          );
          return;
        }
      }

      const { error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: otp.trim(),
        type: "email",
      });

      if (verifyError) {
        setError(getAdminErrorMessage(verifyError, "รหัส OTP ไม่ถูกต้องหรือหมดอายุ"));
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        setError(
          getAdminErrorMessage(updateError, "ไม่สามารถเปลี่ยนรหัสผ่านได้"),
        );
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
        getAdminErrorMessage(caughtError, "ไม่สามารถเปลี่ยนรหัสผ่านได้"),
      );
    } finally {
      setIsChangingPassword(false);
    }
  }

  const isBusy = isSendingOtp || isChangingPassword;
  const isOtpSendDisabled = isBusy || otpCooldownSeconds > 0;

  return (
    <section
      className="scroll-mt-32 rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] p-5 shadow-sm"
      id="security"
    >
      <div className="flex items-start gap-4">
        <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-[var(--site-primary-soft)] text-[var(--site-primary)]">
          <KeyRound aria-hidden="true" className="size-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-[var(--site-text)]">
            เปลี่ยนรหัสผ่าน
          </h2>
          <p className="mt-1 text-sm leading-6 text-[var(--site-muted)]">
            เปลี่ยนรหัสผ่านของบัญชีแอดมินนี้ด้วยรหัส OTP ที่ส่งไปทางอีเมล
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-lg border border-[var(--site-border)] bg-[var(--site-surface-soft)] p-4">
        <button
          className="inline-flex h-11 items-center gap-2 rounded-md bg-[var(--site-primary)] px-4 text-sm font-semibold text-[var(--site-on-primary)] transition hover:bg-[var(--site-primary-hover)]"
          onClick={() => {
            resetModal();
            setIsOpen(true);
          }}
          type="button"
        >
          <KeyRound aria-hidden="true" className="size-4" />
          เปลี่ยนรหัสผ่าน
        </button>
      </div>

      {isOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[var(--site-primary)]/45 px-4 py-6">
          <div
            aria-modal="true"
            className="max-h-[calc(100dvh-3rem)] w-full max-w-md overflow-y-auto rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] p-5 shadow-xl"
            role="dialog"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-[var(--site-text)]">
                  เปลี่ยนรหัสผ่าน
                </h3>
                <p className="mt-1 text-sm leading-6 text-[var(--site-muted)]">
                  ส่ง OTP ไปยังอีเมลของบัญชีนี้ แล้วกรอกรหัสเพื่อยืนยันการเปลี่ยนรหัสผ่าน
                </p>
              </div>
              <button
                aria-label="ปิดหน้าต่างเปลี่ยนรหัสผ่าน"
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-[var(--site-border)] text-[var(--site-muted)]"
                disabled={isBusy}
                onClick={closeModal}
                type="button"
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            </div>

            <button
              className="mt-4 inline-flex h-10 items-center gap-2 rounded-md border border-[var(--site-border-strong)] bg-[var(--site-surface)] px-3 text-sm font-semibold text-[var(--site-primary)] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isOtpSendDisabled}
              onClick={() => {
                void handleSendOtp();
              }}
              type="button"
            >
              <Mail aria-hidden="true" className="size-4" />
              {isSendingOtp
                ? "กำลังส่ง OTP..."
                : otpCooldownSeconds > 0
                  ? `ส่ง OTP อีกครั้งใน ${otpCooldownSeconds} วิ`
                  : "ส่งรหัส OTP ไปอีเมล"}
            </button>

            {notice ? (
              <p
                className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
                role="status"
              >
                {notice}
              </p>
            ) : null}

            {error ? (
              <p
                className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
                role="alert"
              >
                {error}
              </p>
            ) : null}

            <div className="mt-4 grid gap-4">
              <label
                className="block text-sm font-semibold text-[var(--site-text)]"
                htmlFor="adminPasswordOtp"
              >
                รหัส OTP<span className=" text-red-600">*</span>
                <input
                  autoComplete="one-time-code"
                  className="mt-2 h-11 w-full rounded-md border border-[var(--site-border)] bg-[var(--site-surface)] px-3 text-sm text-[var(--site-text)] outline-none focus:border-[var(--site-primary)] focus:ring-2 focus:ring-[var(--site-primary)]/15"
                  id="adminPasswordOtp"
                  inputMode="numeric"
                  maxLength={6}
                  onChange={(event) => {
                    setOtp(event.target.value.trim());
                  }}
                  value={otp}
                />
              </label>
              <label
                className="block text-sm font-semibold text-[var(--site-text)]"
                htmlFor="adminNewPassword"
              >
                รหัสผ่านใหม่<span className=" text-red-600">*</span>
                <input
                  autoComplete="new-password"
                  className="mt-2 h-11 w-full rounded-md border border-[var(--site-border)] bg-[var(--site-surface)] px-3 text-sm text-[var(--site-text)] outline-none focus:border-[var(--site-primary)] focus:ring-2 focus:ring-[var(--site-primary)]/15"
                  id="adminNewPassword"
                  maxLength={MAX_PASSWORD_LENGTH}
                  minLength={MIN_PASSWORD_LENGTH}
                  onChange={(event) => {
                    setNewPassword(event.target.value);
                  }}
                  type="password"
                  value={newPassword}
                />
                <span className="mt-2 block text-xs font-normal leading-5 text-[var(--site-muted)]">
                  รหัสผ่านต้องมีอย่างน้อย 8 ตัว และประกอบด้วย:
                </span>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-xs font-normal leading-5 text-[var(--site-muted)]">
                  <li>ตัวอักษรภาษาอังกฤษพิมพ์เล็ก เช่น a-z</li>
                  <li>ตัวอักษรภาษาอังกฤษพิมพ์ใหญ่ เช่น A-Z</li>
                  <li>ตัวเลข เช่น 0-9</li>
                  <li>สัญลักษณ์พิเศษ เช่น ! @ # $</li>
                </ul>
              </label>
              <label
                className="block text-sm font-semibold text-[var(--site-text)]"
                htmlFor="adminConfirmPassword"
              >
                ยืนยันรหัสผ่านใหม่<span className=" text-red-600">*</span>
                <input
                  autoComplete="new-password"
                  className="mt-2 h-11 w-full rounded-md border border-[var(--site-border)] bg-[var(--site-surface)] px-3 text-sm text-[var(--site-text)] outline-none focus:border-[var(--site-primary)] focus:ring-2 focus:ring-[var(--site-primary)]/15"
                  id="adminConfirmPassword"
                  maxLength={MAX_PASSWORD_LENGTH}
                  minLength={MIN_PASSWORD_LENGTH}
                  onChange={(event) => {
                    setConfirmPassword(event.target.value);
                  }}
                  type="password"
                  value={confirmPassword}
                />
              </label>
              <button
                className="inline-flex h-11 items-center justify-center rounded-md bg-[var(--site-primary)] px-4 text-sm font-semibold text-[var(--site-on-primary)] transition hover:bg-[var(--site-primary-hover)] disabled:cursor-not-allowed disabled:bg-[var(--site-border-strong)]"
                disabled={isBusy}
                onClick={() => {
                  void handleChangePassword();
                }}
                type="button"
              >
                {isChangingPassword
                  ? "กำลังเปลี่ยนรหัสผ่าน..."
                  : "ยืนยันและเปลี่ยนรหัสผ่าน"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
