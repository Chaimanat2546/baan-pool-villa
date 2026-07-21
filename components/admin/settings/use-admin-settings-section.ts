"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  extractAdminErrors,
  readJsonPayload,
  shouldRedirectToLogin,
} from "@/components/admin/admin-api-client";
import { readAdminAccessToken } from "@/components/admin/admin-auth";
import { getAdminErrorMessage } from "@/components/admin/admin-error-messages";
import type { SiteSettingsSection } from "@/lib/site-settings/admin-section-contracts";
import type { WebStyleType } from "@/lib/site-web-styles/types";

import { useSettingsDirtyState } from "./settings-dirty-state";

export interface UseAdminSettingsSectionOptions<TDraft> {
  section: SiteSettingsSection | WebStyleType | "contact";
  endpoint?: string;
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
  endpoint,
  mapResponse,
  makeSnapshot,
  buildRequest,
  validate,
}: UseAdminSettingsSectionOptions<TDraft>): AdminSettingsSectionState<TDraft> {
  const router = useRouter();
  const { setDirtySource } = useSettingsDirtyState();
  const generationRef = useRef(0);
  const saveInFlightGenerationRef = useRef<number | null>(null);
  const callbacksRef = useRef({
    mapResponse,
    makeSnapshot,
    buildRequest,
    validate,
  });
  const [draft, setDraft] = useState<TDraft | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const hasUnsavedChanges =
    draft !== null &&
    savedSnapshot !== null &&
    makeSnapshot(draft) !== savedSnapshot;

  const redirectToLogin = useCallback(() => {
    router.replace("/admin/login");
  }, [router]);

  useEffect(() => {
    callbacksRef.current = { mapResponse, makeSnapshot, buildRequest, validate };
  }, [buildRequest, makeSnapshot, mapResponse, validate]);

  useEffect(() => {
    return () => {
      generationRef.current += 1;
    };
  }, []);

  useEffect(() => {
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    const isCurrentGeneration = () => generationRef.current === generation;

    async function load() {
      setDraft(null);
      setSavedSnapshot(null);
      setIsLoading(true);
      setErrors([]);
      setWarnings([]);
      setNotice(null);
      setIsSaving(false);
      try {
        const token = await readAdminAccessToken();
        if (!isCurrentGeneration()) return;
        if (!token) {
          redirectToLogin();
          return;
        }

        const response = await fetch(endpoint ?? `/api/admin/site-settings/${section}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await readJsonPayload(response);
        if (!isCurrentGeneration()) return;

        if (shouldRedirectToLogin(response.status, payload)) {
          redirectToLogin();
          return;
        }
        if (!response.ok) {
          setErrors(extractAdminErrors(payload, "ไม่สามารถโหลดข้อมูลการตั้งค่าได้"));
          return;
        }

        const nextDraft = callbacksRef.current.mapResponse(payload);
        setDraft(nextDraft);
        setSavedSnapshot(callbacksRef.current.makeSnapshot(nextDraft));
      } catch (caughtError) {
        if (isCurrentGeneration()) {
          setErrors([
            getAdminErrorMessage(caughtError, "ไม่สามารถโหลดข้อมูลการตั้งค่าได้"),
          ]);
        }
      } finally {
        if (isCurrentGeneration()) setIsLoading(false);
      }
    }

    void load();
  }, [endpoint, redirectToLogin, section]);

  useEffect(() => {
    setDirtySource(section, hasUnsavedChanges);
  }, [hasUnsavedChanges, section, setDirtySource]);

  useEffect(
    () => () => {
      setDirtySource(section, false);
    },
    [section, setDirtySource],
  );

  const updateDraft = useCallback((changes: Partial<TDraft>) => {
    setErrors([]);
    setWarnings([]);
    setNotice(null);
    setDraft((current) => (current ? { ...current, ...changes } : current));
  }, []);

  const save = useCallback(async () => {
    if (!draft) return;

    const generation = generationRef.current;
    if (saveInFlightGenerationRef.current === generation) return;

    saveInFlightGenerationRef.current = generation;
    const isCurrentGeneration = () => generationRef.current === generation;
    const submittedDraft = draft;
    const {
      buildRequest: buildSubmittedRequest,
      makeSnapshot: makeSubmittedSnapshot,
      mapResponse: mapSubmittedResponse,
      validate: validateSubmittedDraft,
    } = callbacksRef.current;
    const submittedSnapshot = makeSubmittedSnapshot(submittedDraft);

    try {
      const validationErrors = validateSubmittedDraft(submittedDraft);
      if (validationErrors.length > 0) {
        setErrors(validationErrors);
        setWarnings([]);
        setNotice(null);
        return;
      }

      setIsSaving(true);
      setErrors([]);
      setWarnings([]);
      setNotice(null);

      const token = await readAdminAccessToken();
      if (!isCurrentGeneration()) return;
      if (!token) {
        redirectToLogin();
        return;
      }

      const request = buildSubmittedRequest(submittedDraft);
      const headers = new Headers(request.headers);
      headers.set("Authorization", `Bearer ${token}`);
      const response = await fetch(endpoint ?? `/api/admin/site-settings/${section}`, {
        body: request.body,
        headers,
        method: "PATCH",
      });
      const payload = await readJsonPayload(response);
      if (!isCurrentGeneration()) return;

      if (shouldRedirectToLogin(response.status, payload)) {
        redirectToLogin();
        return;
      }
      if (!response.ok) {
        setErrors(extractAdminErrors(payload, "ไม่สามารถบันทึกการตั้งค่าได้"));
        return;
      }

      const nextDraft = mapSubmittedResponse(payload);
      const nextSavedSnapshot = makeSubmittedSnapshot(nextDraft);
      setDraft((currentDraft) =>
        currentDraft &&
        makeSubmittedSnapshot(currentDraft) === submittedSnapshot
          ? nextDraft
          : currentDraft,
      );
      setSavedSnapshot(nextSavedSnapshot);
      setWarnings(readWarnings(payload));
      setNotice("บันทึกการตั้งค่าสำเร็จ");
    } catch (caughtError) {
      if (isCurrentGeneration()) {
        setErrors([
          getAdminErrorMessage(caughtError, "ไม่สามารถบันทึกการตั้งค่าได้"),
        ]);
      }
    } finally {
      if (saveInFlightGenerationRef.current === generation) {
        saveInFlightGenerationRef.current = null;
      }
      if (isCurrentGeneration()) {
        setIsSaving(false);
      }
    }
  }, [draft, endpoint, redirectToLogin, section]);

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
