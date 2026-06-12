import type { Metadata } from "next";
import { Prompt } from "next/font/google";

import { buildGlobalMetadata } from "@/lib/seo";

import "./globals.css";

const prompt = Prompt({
  display: "swap",
  preload: false,
  variable: "--font-prompt",
  subsets: ["latin", "thai"],
  weight: ["400", "700"],
});

// Render routes per request while preserving explicit tagged data caches.
export const revalidate = 0;

export const metadata: Metadata = buildGlobalMetadata();

const CHUNK_LOAD_RECOVERY_SCRIPT = `
(() => {
  const retryKey = "bpv:chunk-reload-retried";
  const retryFailedKey = "bpv:chunk-reload-failed";
  const chunkPattern = "/_next/static/chunks/";

  function isChunkLoadFailure(value) {
    const message = String(value?.message || value || "");
    return (
      message.includes("ChunkLoadError") ||
      message.includes("Loading chunk") ||
      message.includes(chunkPattern)
    );
  }

  function showRecoveryMessage() {
    if (document.querySelector("[data-bpv-chunk-recovery-message='true']")) {
      return;
    }

    const message = document.createElement("div");
    message.setAttribute("data-bpv-chunk-recovery-message", "true");
    message.setAttribute("role", "alert");
    message.style.cssText = [
      "position:fixed",
      "inset:auto 16px 16px 16px",
      "z-index:2147483647",
      "border:1px solid rgba(146,64,14,0.35)",
      "border-radius:12px",
      "background:#fffbeb",
      "color:#78350f",
      "box-shadow:0 18px 45px rgba(15,23,42,0.18)",
      "font:600 14px/1.5 system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
      "padding:14px 42px 14px 16px",
    ].join(";");
    message.textContent =
      "Page failed to load resources. Check your internet connection or clear cache and try again.";

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.setAttribute("aria-label", "Dismiss message");
    closeButton.style.cssText = [
      "position:absolute",
      "right:10px",
      "top:8px",
      "border:0",
      "background:transparent",
      "color:inherit",
      "cursor:pointer",
      "font:700 20px/1 system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
    ].join(";");
    closeButton.textContent = "x";
    closeButton.addEventListener("click", () => {
      message.remove();
    });
    message.appendChild(closeButton);
    document.body.appendChild(message);
  }

  function reloadOnce() {
    try {
      if (sessionStorage.getItem(retryKey) === "1") {
        sessionStorage.setItem(retryFailedKey, "1");
        showRecoveryMessage();
        return;
      }
      sessionStorage.setItem(retryKey, "1");
    } catch {
      return;
    }
    location.reload();
  }

  try {
    if (sessionStorage.getItem(retryFailedKey) === "1") {
      showRecoveryMessage();
    }
  } catch {}

  window.addEventListener("error", (event) => {
    const target = event.target;
    const source = typeof target?.src === "string" ? target.src : "";
    if (source.includes(chunkPattern) || isChunkLoadFailure(event.error)) {
      reloadOnce();
    }
  }, true);

  window.addEventListener("unhandledrejection", (event) => {
    if (isChunkLoadFailure(event.reason)) {
      reloadOnce();
    }
  });

  window.setTimeout(() => {
    try {
      sessionStorage.removeItem(retryKey);
    } catch {}
  }, 30000);
})();
`;

/**
 * Root layout component that provides the document <html> and <body> wrapper with global styles and font variable.
 *
 * @param children - The content to render inside the page body
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" className={`${prompt.variable} h-full antialiased`}>
      <body className="min-h-full bg-[#f4f7f4] text-[#063f35]">
        <script
          data-bpv-chunk-recovery="true"
          dangerouslySetInnerHTML={{ __html: CHUNK_LOAD_RECOVERY_SCRIPT }}
        />
        {children}
      </body>
    </html>
  );
}
