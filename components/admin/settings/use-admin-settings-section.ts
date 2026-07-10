"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  extractAdminErrors,
  readJsonPayload,
  shouldRedirectToLogin,
} from "@/components/admin/admin-api-client";
import { readAdminAccessToken } from "@/components/admin/admin-auth";
import { getAdminErrorMessage } from "@/components/admin/admin-error-messages";
import type { SiteSettingsSection } from "@/lib/site-settings/admin-section-contracts";

import { useSettingsDirtyState } from "./settings-dirty-state";

export interface UseAdminSettingsSectionOptions<TDraft> {
  section: SiteSettingsSection;
  mapResponse: (value: unknown) => TDraft;
  makeSnapshot: (draft: TDraft) => string;
  buildRequest: (draft: TDraft) => { body: BodyInit; headers?: HeadersInit };
  validate: (draft: TDraft) => string[];
}

export interface AdminSettingsSectionState<TDraft> {
  draft: TDraft | null;
  errors: string[];
  warnings: string[];
  notice: string | null;
  isLoading: boolean;
  isSaving: boolean;
  hasUnsavedChanges: boolean;
  updateDraft: (changes: Partial<TDraft>) => void;
  save: () => Promise<void>;
}

function readWarnings(payload: unknown): string[] {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return [];

  const value = payload as { warning?: unknown; warnings?: unknown };
  const warnings = Array.isArray(value.warnings)
    ? value.warnings.filter(
        (warning): warning is string =>
          typeof warning === "string" && warning.length > 0,
      )
    : [];

  if (typeof value.warning === "string" && value.warning.length > 0) {
    warnings.push(value.warning);
  }

  return [...new Set(warnings)];
}

export function useAdminSettingsSection<TDraft>({
  section,
  mapResponse,
  makeSnapshot,
  buildRequest,
  validate,
}: UseAdminSettingsSectionOptions<TDraft>): AdminSettingsSectionState<TDraft> {
  const router = useRouter();
  const { setIsDirty } = useSettingsDirtyState();
  const mountedRef = useRef(true);
  const [draft, setDraft] = useState<TDraft | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const hasUnsavedChanges = useMemo(
    () =>
      draft !== null &&
      savedSnapshot !== null &&
      makeSnapshot(draft) !== savedSnapshot,
    [draft, makeSnapshot, savedSnapshot],
  );

  const redirectToLogin = useCallback(() => {
    router.replace("/admin/login");
  }, [router]);

  useEffect(() => {
    mountedRef.current = true;

    async function load() {
      setIsLoading(true);
      setErrors([]);
      setWarnings([]);
      setNotice(null);

      try {
        const token = await readAdminAccessToken();
        if (!mountedRef.current) return;
        if (!token) {
          redirectToLogin();
          return;
        }

        const response = await fetch(`/api/admin/site-settings/${section}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await readJsonPayload(response);
        if (!mountedRef.current) return;

        if (shouldRedirectToLogin(response.status, payload)) {
          redirectToLogin();
          return;
        }
        if (!response.ok) {
          setErrors(extractAdminErrors(payload, "ไม่สามารถโหลดข้อมูลการตั้งค่าได้"));
          return;
        }

        const nextDraft = mapResponse(payload);
        setDraft(nextDraft);
        setSavedSnapshot(makeSnapshot(nextDraft));
      } catch (caughtError) {
        if (mountedRef.current) {
          setErrors([
            getAdminErrorMessage(caughtError, "ไม่สามารถโหลดข้อมูลการตั้งค่าได้"),
          ]);
        }
      } finally {
        if (mountedRef.current) setIsLoading(false);
      }
    }

    void load();
    return () => {
      mountedRef.current = false;
    };
  }, [mapResponse, makeSnapshot, redirectToLogin, section]);

  useEffect(() => {
    setIsDirty(hasUnsavedChanges);
  }, [hasUnsavedChanges, setIsDirty]);

  useEffect(
    () => () => {
      setIsDirty(false);
    },
    [setIsDirty],
  );

  const updateDraft = useCallback((changes: Partial<TDraft>) => {
    setErrors([]);
    setWarnings([]);
    setNotice(null);
    setDraft((current) => (current ? { ...current, ...changes } : current));
  }, []);

  const save = useCallback(async () => {
    if (!draft) return;

    const validationErrors = validate(draft);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      setWarnings([]);
      setNotice(null);
      return;
    }

    const token = await readAdminAccessToken();
    if (!mountedRef.current) return;
    if (!token) {
      redirectToLogin();
      return;
    }

    setIsSaving(true);
    setErrors([]);
    setWarnings([]);
    setNotice(null);

    try {
      const request = buildRequest(draft);
      const headers = new Headers(request.headers);
      headers.set("Authorization", `Bearer ${token}`);
      const response = await fetch(`/api/admin/site-settings/${section}`, {
        body: request.body,
        headers,
        method: "PATCH",
      });
      const payload = await readJsonPayload(response);
      if (!mountedRef.current) return;

      if (shouldRedirectToLogin(response.status, payload)) {
        redirectToLogin();
        return;
      }
      if (!response.ok) {
        setErrors(extractAdminErrors(payload, "ไม่สามารถบันทึกการตั้งค่าได้"));
        return;
      }

      const nextDraft = mapResponse(payload);
      setDraft(nextDraft);
      setSavedSnapshot(makeSnapshot(nextDraft));
      setWarnings(readWarnings(payload));
      setNotice("บันทึกการตั้งค่าสำเร็จ");
    } catch (caughtError) {
      if (mountedRef.current) {
        setErrors([
          getAdminErrorMessage(caughtError, "ไม่สามารถบันทึกการตั้งค่าได้"),
        ]);
      }
    } finally {
      if (mountedRef.current) setIsSaving(false);
    }
  }, [buildRequest, draft, makeSnapshot, mapResponse, redirectToLogin, section, validate]);

  return {
    draft,
    errors,
    warnings,
    notice,
    isLoading,
    isSaving,
    hasUnsavedChanges,
    updateDraft,
    save,
  };
}
