"use client";

import { useEffect, useMemo, useRef } from "react";

interface AdminFeedbackProps {
  errors: string[];
  errorTitle: string;
  notice: string | null;
  warningTitle?: string;
  warnings?: string[];
}

function makeFeedbackKey({
  errors,
  notice,
  warnings,
}: {
  errors: string[];
  notice: string | null;
  warnings: string[];
}) {
  if (errors.length > 0) {
    return `errors:${errors.join("\n")}`;
  }

  if (notice) {
    return `notice:${notice}`;
  }

  if (warnings.length > 0) {
    return `warnings:${warnings.join("\n")}`;
  }

  return "";
}

export function AdminFeedback({
  errors,
  errorTitle,
  notice,
  warningTitle = "คำเตือน:",
  warnings = [],
}: AdminFeedbackProps) {
  const feedbackRef = useRef<HTMLDivElement | HTMLParagraphElement | null>(null);
  const feedbackKey = useMemo(
    () => makeFeedbackKey({ errors, notice, warnings }),
    [errors, notice, warnings],
  );

  useEffect(() => {
    const feedbackElement = feedbackRef.current;

    if (!feedbackElement || !feedbackKey) {
      return;
    }

    if (typeof feedbackElement.scrollIntoView === "function") {
      feedbackElement.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    if (typeof feedbackElement.focus === "function") {
      feedbackElement.focus({ preventScroll: true });
    }
  }, [feedbackKey]);

  if (errors.length > 0) {
    return (
      <div
        className="scroll-mt-52 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 lg:scroll-mt-48"
        ref={feedbackRef}
        role="alert"
        tabIndex={-1}
      >
        <p className="font-semibold">{errorTitle}</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <>
      {notice ? (
        <p
          className="scroll-mt-52 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 lg:scroll-mt-48"
          ref={feedbackRef}
          role="status"
          tabIndex={-1}
        >
          {notice}
        </p>
      ) : null}

      {warnings.length > 0 ? (
        <div
          className="scroll-mt-52 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 lg:scroll-mt-48"
          ref={notice ? null : feedbackRef}
          role="status"
          tabIndex={-1}
        >
          <p className="font-semibold">{warningTitle}</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );
}
