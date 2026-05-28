"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { createBrowserHomeConfigClient } from "@/lib/home-sections/supabase";
import type { SiteSettings } from "@/lib/site-settings/types";

import {
  buildSettingsFormData,
  extractErrors,
  extractWarnings,
  makeSettingsSnapshot,
  mapSettingsToDraft,
  readJsonPayload,
  shouldRedirectToLogin,
} from "./settings-helpers";
import { SettingsForm } from "./settings-form";
import type {
  AdminSettingsDraft,
  AdminSiteSettingsResponse,
} from "./types";

export function AdminSettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [draft, setDraft] = useState<AdminSettingsDraft | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const hasUnsavedChanges = useMemo(() => {
    if (!draft || savedSnapshot === null) {
      return false;
    }

    return makeSettingsSnapshot(draft) !== savedSnapshot;
  }, [draft, savedSnapshot]);

  const redirectToLogin = useCallback(() => {
    router.replace("/admin/login");
  }, [router]);

  const getAccessToken = useCallback(async () => {
    const supabase = createBrowserHomeConfigClient();
    const { data, error } = await supabase.auth.getSession();
    const token = data.session?.access_token;

    if (error || !token) {
      redirectToLogin();
      return null;
    }

    return token;
  }, [redirectToLogin]);

  const loadSettings = useCallback(
    async (token: string, showLoading: boolean) => {
      if (showLoading) {
        setIsLoading(true);
      }

      setErrors([]);
      setNotice(null);
      setWarnings([]);

      try {
        const response = await fetch("/api/admin/site-settings", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const payload = (await readJsonPayload(
          response,
        )) as AdminSiteSettingsResponse | null;

        if (shouldRedirectToLogin(response.status, payload)) {
          redirectToLogin();
          return;
        }

        if (!response.ok || !payload?.settings) {
          setErrors(extractErrors(payload, "Unable to load site settings."));
          return;
        }

        const nextDraft = mapSettingsToDraft(payload.settings);

        setSettings(payload.settings);
        setDraft(nextDraft);
        setSavedSnapshot(makeSettingsSnapshot(nextDraft));
      } catch (caughtError) {
        setErrors([
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to load site settings.",
        ]);
      } finally {
        if (showLoading) {
          setIsLoading(false);
        }
      }
    },
    [redirectToLogin],
  );

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        const token = await getAccessToken();

        if (!token || !isMounted) {
          return;
        }

        await loadSettings(token, true);
      } catch (caughtError) {
        if (!isMounted) {
          return;
        }

        setErrors([
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to initialize settings.",
        ]);
        setIsLoading(false);
      }
    }

    void load();

    return () => {
      isMounted = false;
    };
  }, [getAccessToken, loadSettings]);

  function updateDraft(changes: Partial<AdminSettingsDraft>) {
    setNotice(null);
    setErrors([]);
    setWarnings([]);
    setDraft((currentDraft) =>
      currentDraft ? { ...currentDraft, ...changes } : currentDraft,
    );
  }

  async function handleSave() {
    if (!draft) {
      return;
    }

    if (!hasUnsavedChanges) {
      setNotice("No settings changes to save.");
      return;
    }

    const token = await getAccessToken();

    if (!token) {
      return;
    }

    setIsSaving(true);
    setErrors([]);
    setNotice(null);
    setWarnings([]);

    try {
      const response = await fetch("/api/admin/site-settings", {
        body: buildSettingsFormData(draft),
        headers: {
          Authorization: `Bearer ${token}`,
        },
        method: "PUT",
      });
      const payload = (await readJsonPayload(
        response,
      )) as AdminSiteSettingsResponse | null;

      if (shouldRedirectToLogin(response.status, payload)) {
        redirectToLogin();
        return;
      }

      if (!response.ok || !payload?.settings) {
        setErrors(extractErrors(payload, "Unable to save site settings."));
        return;
      }

      const nextDraft = mapSettingsToDraft(payload.settings);

      setSettings(payload.settings);
      setDraft(nextDraft);
      setSavedSnapshot(makeSettingsSnapshot(nextDraft));
      setWarnings(extractWarnings(payload));
      setNotice("Site settings saved.");
    } catch (caughtError) {
      setErrors([
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to save site settings.",
      ]);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex w-full flex-col gap-4 text-[#0f332d]">
      <header className="flex flex-col gap-3 rounded-md border border-[#dbe7e3] bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-normal text-[#687d76]">
            Site settings
          </p>
          <h1 className="text-xl font-semibold text-[#063f35]">
            Website identity
          </h1>
        </div>
        <div className="rounded-md border border-[#dbe7e3] bg-[#f8fbf9] px-3 py-2 text-xs font-semibold text-[#506862]">
          {hasUnsavedChanges ? "Unsaved changes" : "Saved"}
        </div>
      </header>

      {errors.length > 0 ? (
        <div
          className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          role="alert"
        >
          <p className="font-semibold">Fix these settings before saving:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {notice ? (
        <p
          className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"
          role="status"
        >
          {notice}
        </p>
      ) : null}

      {warnings.length > 0 ? (
        <div
          className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          role="status"
        >
          <p className="font-semibold">Saved with warnings:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {isLoading ? (
        <div className="rounded-md border border-[#c9d9d3] bg-white px-4 py-8 text-center text-sm text-[#506862]">
          Loading site settings...
        </div>
      ) : settings && draft ? (
        <SettingsForm
          draft={draft}
          hasUnsavedChanges={hasUnsavedChanges}
          isSaving={isSaving}
          onChange={updateDraft}
          onSave={handleSave}
          settings={settings}
        />
      ) : null}
    </div>
  );
}
