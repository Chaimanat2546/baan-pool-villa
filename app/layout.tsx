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
  const chunkPattern = "/_next/static/chunks/";

  function isChunkLoadFailure(value) {
    const message = String(value?.message || value || "");
    return (
      message.includes("ChunkLoadError") ||
      message.includes("Loading chunk") ||
      message.includes(chunkPattern)
    );
  }

  function reloadOnce() {
    try {
      if (sessionStorage.getItem(retryKey) === "1") {
        return;
      }
      sessionStorage.setItem(retryKey, "1");
    } catch {
      return;
    }
    location.reload();
  }

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
