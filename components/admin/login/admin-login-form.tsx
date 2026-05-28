"use client";

import { LogIn } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { createBrowserHomeConfigClient } from "@/lib/home-sections/supabase";

export function AdminLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const errorId = "admin-login-error";
  const hasError = error !== null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedEmail = email.trim();

    if (!trimmedEmail || !password) {
      setError("กรอกอีเมลและรหัสผ่านให้ครบ");
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const supabase = createBrowserHomeConfigClient();
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      if (loginError) {
        setError(loginError.message || "เข้าสู่ระบบไม่สำเร็จ");
        return;
      }

      router.replace("/admin/sections");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "ไม่สามารถเปิดหน้าเข้าสู่ระบบได้",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      className="w-full max-w-sm rounded-md border border-[#c9d9d3] bg-white p-5 shadow-sm"
      onSubmit={handleSubmit}
    >
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-[#063f35]">
          เข้าสู่ระบบหลังบ้าน
        </h1>
        <p className="mt-1 text-sm text-[#4b625b]">
          จัดชุดบ้านพักบนหน้าแรก
        </p>
      </div>

      <div className="space-y-4">
        <label className="block text-sm font-medium text-[#173f36]">
          อีเมล
          <input
            aria-describedby={hasError ? errorId : undefined}
            aria-invalid={hasError}
            autoComplete="email"
            className="mt-1 h-10 w-full rounded-md border border-[#c9d9d3] bg-white px-3 text-sm text-[#063f35] outline-none transition focus:border-[var(--site-primary)] focus:ring-2 focus:ring-[var(--site-primary)]/15 disabled:bg-[#f3f6f4]"
            disabled={isSubmitting}
            inputMode="email"
            name="email"
            onChange={(event) => {
              setEmail(event.target.value);
            }}
            required
            type="email"
            value={email}
          />
        </label>

        <label className="block text-sm font-medium text-[#173f36]">
          รหัสผ่าน
          <input
            aria-describedby={hasError ? errorId : undefined}
            aria-invalid={hasError}
            autoComplete="current-password"
            className="mt-1 h-10 w-full rounded-md border border-[#c9d9d3] bg-white px-3 text-sm text-[#063f35] outline-none transition focus:border-[var(--site-primary)] focus:ring-2 focus:ring-[var(--site-primary)]/15 disabled:bg-[#f3f6f4]"
            disabled={isSubmitting}
            name="password"
            onChange={(event) => {
              setPassword(event.target.value);
            }}
            required
            type="password"
            value={password}
          />
        </label>
      </div>

      {error ? (
        <p
          className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          id={errorId}
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <button
        className="mt-5 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[var(--site-primary)] px-4 text-sm font-semibold text-[var(--site-on-primary)] transition hover:brightness-95 disabled:cursor-not-allowed disabled:bg-[#8aa39b]"
        disabled={isSubmitting}
        type="submit"
      >
        <LogIn aria-hidden="true" className="size-4" />
        {isSubmitting ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
      </button>
    </form>
  );
}
