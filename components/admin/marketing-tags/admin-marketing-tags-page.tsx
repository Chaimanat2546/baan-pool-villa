"use client";

import { CheckCircle2, Eye, Save, Tags, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { getAdminErrorMessage } from "@/components/admin/admin-error-messages";
import {
  extractAdminErrors,
  readJsonPayload,
  shouldRedirectToLogin,
} from "@/components/admin/admin-api-client";
import { readAdminAccessToken } from "@/components/admin/admin-auth";
import { AdminFeedback } from "@/components/admin/admin-feedback";
import { AdminSettingsSkeleton } from "@/components/admin/loading/admin-settings-skeleton";

interface AdminMarketingTagsDraft {
  googleTagManagerId: string;
}

interface AdminMarketingTagsResponse {
  error?: string;
  errors?: string[];
  settings?: AdminMarketingTagsDraft;
}

const EMPTY_DRAFT: AdminMarketingTagsDraft = {
  googleTagManagerId: "",
};

interface MarketingGuideTable {
  title: string;
  description?: string;
  headers: readonly string[];
  rows: readonly (readonly string[])[];
}

interface MarketingSetupGuide {
  id: string;
  title: string;
  summary: string;
  path?: string;
  tables: readonly MarketingGuideTable[];
  notes?: readonly string[];
}

const MARKETING_SETUP_GUIDES = [
  {
    id: "gtm",
    summary: "เอาแค่ Container ID มาใส่ CMS ไม่ต้องวาง script เอง",
    title: "ตั้งค่า GTM บนเว็บไซต์",
    tables: [
      {
        title: "ค่าที่ต้องใช้",
        headers: ["อยู่ที่ไหน", "ชื่อช่อง", "ใส่อะไร"],
        rows: [
          ["Google Tag Manager", "Container ID", "GTM-XXXXXXX"],
          ["CMS หน้านี้", "GTM ID", "วางเฉพาะ GTM-XXXXXXX"],
          ["CMS หน้านี้", "บันทึก", "กดบันทึกแล้วเปิดเว็บจริงทดสอบ"],
        ],
      },
      {
        title: "ตรวจหลังบันทึก",
        headers: ["ทำที่ไหน", "ทำอะไร", "ผลที่ต้องเห็น"],
        rows: [
          ["GTM", "กด Preview", "Tag Assistant เปิดขึ้นมา"],
          ["Tag Assistant", "ใส่ URL เว็บ", "ขึ้น Connected"],
          ["เว็บจริง", "เปิด /villas/[id]", "เห็น event จากเว็บใน Preview"],
        ],
      },
    ],
    notes: [
      "ห้ามวางโค้ด <script> ในช่อง GTM ID เพราะระบบฝัง script ให้เองแล้ว",
      "ถ้ามีหลายเว็บ ควรใช้ GTM Container แยกต่อเว็บหรือแยก staging/production",
    ],
  },
  {
    id: "variables",
    path: "GTM > Variables > User-Defined Variables > New > Variable Configuration > Data Layer Variable",
    summary: "สร้างตัวแปรให้ GTM อ่านค่าที่เว็บส่งมาใน dataLayer",
    title: "สร้าง Data Layer Variables",
    tables: [
      {
        title: "Built-in Variables ที่ควรเปิดก่อน",
        headers: ["ไปที่", "กด", "ติ๊กชื่อเหล่านี้"],
        rows: [
          [
            "Variables > Built-In Variables",
            "Configure",
            "Event, Page URL, Page Path, Page Hostname, Referrer, Click URL, Click Text",
          ],
        ],
      },
      {
        title: "User-Defined Variables ที่ต้องสร้าง",
        headers: [
          "Variable Name",
          "Variable Type",
          "Data Layer Variable Name",
          "Data Layer Version",
          "Set Default Value",
        ],
        rows: [
          ["DLV - value", "Data Layer Variable", "value", "Version 2", "ไม่ต้องติ๊ก"],
          ["DLV - currency", "Data Layer Variable", "currency", "Version 2", "ไม่ต้องติ๊ก"],
          [
            "DLV - ecommerce.items",
            "Data Layer Variable",
            "ecommerce.items",
            "Version 2",
            "ไม่ต้องติ๊ก",
          ],
          [
            "DLV - contact_channel",
            "Data Layer Variable",
            "contact_channel",
            "Version 2",
            "ไม่ต้องติ๊ก",
          ],
          [
            "DLV - contact_location",
            "Data Layer Variable",
            "contact_location",
            "Version 2",
            "ไม่ต้องติ๊ก",
          ],
        ],
      },
    ],
    notes: [
      "Variable Name คือชื่อที่ตั้งใน GTM เพื่อเอาไปเลือกใน Tag/Trigger เช่น {{DLV - value}}",
      "Data Layer Variable Name คือชื่อ key ที่เว็บส่งมา เช่น value หรือ ecommerce.items",
      "ecommerce.items ต้องใช้ Version 2 เพราะจุดในชื่อหมายถึงข้อมูลซ้อนกัน ecommerce > items",
    ],
  },
  {
    id: "triggers",
    path: "GTM > Triggers > New > Trigger Configuration > Custom Event",
    summary: "สร้าง Trigger ให้ tag ยิงตอนเว็บส่ง view_item หรือกดปุ่มติดต่อ",
    title: "สร้าง Triggers",
    tables: [
      {
        title: "Custom Event Triggers",
        headers: [
          "Trigger Name",
          "Trigger Type",
          "Event name",
          "This trigger fires on",
          "ช่องซ้าย",
          "Operator",
          "ช่องขวา",
        ],
        rows: [
          ["CE - view_item", "Custom Event", "view_item", "All Custom Events", "-", "-", "-"],
          [
            "CE - booking_contact_click",
            "Custom Event",
            "booking_contact_click",
            "All Custom Events",
            "-",
            "-",
            "-",
          ],
          [
            "CE - booking_contact_click - LINE",
            "Custom Event",
            "booking_contact_click",
            "Some Custom Events",
            "DLV - contact_channel",
            "equals",
            "line",
          ],
          [
            "CE - booking_contact_click - Messenger",
            "Custom Event",
            "booking_contact_click",
            "Some Custom Events",
            "DLV - contact_channel",
            "equals",
            "messenger",
          ],
        ],
      },
    ],
    notes: [
      "ถ้าเลือก Some Custom Events ให้ใส่เงื่อนไขบรรทัดล่างสุด: ช่องซ้ายเลือกตัวแปร, ช่องกลางเลือก operator, ช่องขวาพิมพ์ค่า",
      "LINE/Messenger trigger แยกช่องทางเป็น optional ใช้เมื่ออยากยิง tag คนละตัวหรือดูรายงานแยกช่องทาง",
    ],
  },
  {
    id: "ga4",
    path: "GTM > Tags > New",
    summary: "สร้าง Google Tag และ GA4 Event tags พร้อม Event Parameters",
    title: "ตั้งค่า Tags สำหรับ GA4",
    tables: [
      {
        title: "Google Tag หลัก",
        headers: ["Tag Name", "Tag Type", "Tag ID / Measurement ID", "Triggering"],
        rows: [
          ["GA4 - Google Tag", "Google Tag", "G-XXXXXXXXXX", "Initialization - All Pages"],
        ],
      },
      {
        title: "GA4 - view_item",
        headers: ["Tag Name", "Tag Type", "Measurement ID", "Event Name", "Triggering"],
        rows: [
          [
            "GA4 - view_item",
            "Google Analytics: GA4 Event",
            "G-XXXXXXXXXX",
            "view_item",
            "CE - view_item",
          ],
        ],
      },
      {
        title: "Event Parameters สำหรับ view_item",
        headers: ["Parameter Name", "Value"],
        rows: [
          ["items", "{{DLV - ecommerce.items}}"],
          ["value", "{{DLV - value}}"],
          ["currency", "{{DLV - currency}}"],
        ],
      },
      {
        title: "GA4 - generate_lead",
        headers: ["Tag Name", "Tag Type", "Measurement ID", "Event Name", "Triggering"],
        rows: [
          [
            "GA4 - generate_lead",
            "Google Analytics: GA4 Event",
            "G-XXXXXXXXXX",
            "generate_lead",
            "CE - booking_contact_click",
          ],
        ],
      },
      {
        title: "Event Parameters สำหรับ generate_lead",
        headers: ["Parameter Name", "Value"],
        rows: [
          ["items", "{{DLV - ecommerce.items}}"],
          ["value", "{{DLV - value}}"],
          ["currency", "{{DLV - currency}}"],
          ["contact_channel", "{{DLV - contact_channel}}"],
          ["contact_location", "{{DLV - contact_location}}"],
        ],
      },
    ],
    notes: [
      "ถ้าหน้าจอไม่มีส่วน Ecommerce ให้ใส่เองใน Event Parameters ตามตารางนี้",
      "ถ้า GTM แจ้งว่า Google tag found in this container ให้ใช้ Measurement ID ตัวเดิมต่อได้",
      "อย่าลืมกด Save ทุก tag แล้วทดสอบใน Preview ก่อน Submit/Publish",
    ],
  },
  {
    id: "preview",
    path: "GTM > Preview",
    summary: "เช็ค Data Layer, Variables และ Tags Fired ก่อน Publish",
    title: "ทดสอบใน GTM Preview",
    tables: [
      {
        title: "Flow ที่ต้องทดสอบ",
        headers: ["ขั้นตอน", "เลือก event ใน Tag Assistant", "ต้องเห็น"],
        rows: [
          [
            "เปิด /villas/[id]",
            "view_item",
            "Data Layer มี ecommerce.items, value, currency และ Tags Fired มี GA4 - view_item",
          ],
          [
            "กดปุ่ม LINE",
            "booking_contact_click",
            "Variables เห็น DLV - contact_channel = line และ Tags Fired มี GA4 - generate_lead",
          ],
          [
            "กดปุ่ม Messenger",
            "booking_contact_click",
            "Variables เห็น DLV - contact_channel = messenger และ Tags Fired มี GA4 - generate_lead",
          ],
        ],
      },
      {
        title: "ค่าที่ควรเห็นใน Variables",
        headers: ["Variable", "ตัวอย่างค่า"],
        rows: [
          ["DLV - value", "9900"],
          ["DLV - currency", "THB"],
          ["DLV - ecommerce.items", "array ของ item_id, item_name, item_category, price"],
          ["DLV - contact_channel", "line หรือ messenger"],
          ["DLV - contact_location", "booking_sidebar"],
        ],
      },
    ],
    notes: [
      "ถ้า Data Layer มีค่าแต่ Variables ว่าง ให้กลับไปเช็ค Data Layer Variable Name และ Version 2",
      "ถ้า Tags Fired แล้ว GA4 ไม่ขึ้น ให้เช็ค Measurement ID, DebugView/Realtime และ network/CSP",
    ],
  },
  {
    id: "key-event",
    path: "GA4 > Admin > Data display > Events / Key events",
    summary: "ทำให้ generate_lead ถูกนับเป็น lead สำคัญใน GA4",
    title: "ตั้ง generate_lead เป็น Key event",
    tables: [
      {
        title: "ตั้งค่า Key event",
        headers: ["ช่อง / หน้าจอ", "ใส่หรือเลือกค่า"],
        rows: [
          ["Event name", "generate_lead"],
          ["Mark as key event", "เปิด"],
          ["Default key event value", "Don't set a default key event value"],
          ["Counting method", "Once per event"],
        ],
      },
    ],
    notes: [
      "เว็บส่ง value และ currency ไปกับ event แล้ว จึงไม่ต้องตั้ง default value ทับ",
      "Realtime/DebugView มักขึ้นเร็วกว่า Reports ปกติ รายงานบางส่วนมี delay",
    ],
  },
  {
    id: "google-ads",
    summary: "ยังไม่ต้องทำถ้ายังไม่ยิง Ads แต่เตรียมต่อได้จาก trigger เดิม",
    title: "ต่อ Google Ads ภายหลัง",
    tables: [
      {
        title: "เลือกวิธีต่อ Google Ads",
        headers: ["วิธี", "เหมาะกับ", "ต้องทำอะไร"],
        rows: [
          [
            "Import จาก GA4",
            "อยากใช้ generate_lead ที่ตั้งไว้แล้ว",
            "Link GA4 กับ Google Ads แล้ว import key event generate_lead",
          ],
          [
            "Google Ads Conversion Tag ใน GTM",
            "อยากควบคุม conversion tag ใน GTM โดยตรง",
            "สร้าง Conversion Action แล้วนำ Conversion ID/Label มาใส่ tag",
          ],
        ],
      },
      {
        title: "ถ้าสร้าง Google Ads Conversion Tag ใน GTM",
        headers: ["ช่อง", "ใส่ค่า"],
        rows: [
          ["Conversion ID", "AW-XXXXXXX จาก Google Ads"],
          ["Conversion Label", "Label ของ conversion action"],
          ["Conversion Value", "{{DLV - value}}"],
          ["Currency Code", "{{DLV - currency}}"],
          ["Triggering", "CE - booking_contact_click หรือ trigger แยก LINE/Messenger"],
        ],
      },
    ],
    notes: [
      "ยังไม่ต้องมี Google Ads ก็ทดสอบ GTM/GA4 ได้ครบ",
      "เมื่อเริ่มยิง Ads ค่อยเลือก import จาก GA4 หรือเพิ่ม Google Ads tag",
    ],
  },
] as const satisfies readonly MarketingSetupGuide[];

function makeSnapshot(draft: AdminMarketingTagsDraft): string {
  return JSON.stringify({
    googleTagManagerId: draft.googleTagManagerId.trim(),
  });
}

function buildFormData(draft: AdminMarketingTagsDraft): FormData {
  const formData = new FormData();
  formData.set("googleTagManagerId", draft.googleTagManagerId);

  return formData;
}

function extractErrors(payload: unknown, fallback: string): string[] {
  return extractAdminErrors(payload, fallback);
}

export function AdminMarketingTagsPage() {
  const router = useRouter();
  const [draft, setDraft] = useState<AdminMarketingTagsDraft>(EMPTY_DRAFT);
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);
  const [selectedGuide, setSelectedGuide] = useState<MarketingSetupGuide | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const hasUnsavedChanges = useMemo(() => {
    if (savedSnapshot === null) {
      return false;
    }

    return makeSnapshot(draft) !== savedSnapshot;
  }, [draft, savedSnapshot]);

  const selectedGuideOrder = selectedGuide
    ? MARKETING_SETUP_GUIDES.findIndex((guide) => guide.id === selectedGuide.id) + 1
    : 0;

  useEffect(() => {
    if (!selectedGuide) {
      return;
    }

    const previousBodyOverflow = document.body.style.overflow;
    const previousDocumentOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousDocumentOverflow;
    };
  }, [selectedGuide]);

  const redirectToLogin = useCallback(() => {
    router.replace("/admin/login");
  }, [router]);

  const getAccessToken = useCallback(async () => {
    const token = await readAdminAccessToken();

    if (!token) {
      redirectToLogin();
      return null;
    }

    return token;
  }, [redirectToLogin]);

  const applyResponse = useCallback((payload: AdminMarketingTagsResponse) => {
    const nextDraft = payload.settings ?? EMPTY_DRAFT;

    setDraft(nextDraft);
    setSavedSnapshot(makeSnapshot(nextDraft));
  }, []);

  const loadSettings = useCallback(
    async (token: string) => {
      setIsLoading(true);
      setErrors([]);
      setNotice(null);

      try {
        const response = await fetch("/api/admin/marketing-tags", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const payload = (await readJsonPayload(
          response,
        )) as AdminMarketingTagsResponse | null;

        if (shouldRedirectToLogin(response.status, payload)) {
          redirectToLogin();
          return;
        }

        if (!response.ok || !payload?.settings) {
          setErrors(extractErrors(payload, "ไม่สามารถโหลด Marketing Tags ได้"));
          return;
        }

        applyResponse(payload);
      } catch (caughtError) {
        setErrors([
          getAdminErrorMessage(caughtError, "ไม่สามารถโหลด Marketing Tags ได้"),
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [applyResponse, redirectToLogin],
  );

  useEffect(() => {
    let isMounted = true;

    async function load() {
      const token = await getAccessToken();

      if (!token || !isMounted) {
        return;
      }

      await loadSettings(token);
    }

    void load();

    return () => {
      isMounted = false;
    };
  }, [getAccessToken, loadSettings]);

  function updateDraft(changes: Partial<AdminMarketingTagsDraft>) {
    setErrors([]);
    setNotice(null);
    setDraft((currentDraft) => ({ ...currentDraft, ...changes }));
  }

  async function handleSave() {
    if (!hasUnsavedChanges) {
      setNotice("ยังไม่มีการเปลี่ยนแปลงที่ต้องบันทึก");
      return;
    }

    setIsSaving(true);
    setErrors([]);
    setNotice(null);

    try {
      const token = await getAccessToken();

      if (!token) {
        return;
      }

      const response = await fetch("/api/admin/marketing-tags", {
        body: buildFormData(draft),
        headers: {
          Authorization: `Bearer ${token}`,
        },
        method: "PUT",
      });
      const payload = (await readJsonPayload(
        response,
      )) as AdminMarketingTagsResponse | null;

      if (shouldRedirectToLogin(response.status, payload)) {
        redirectToLogin();
        return;
      }

      if (!response.ok || !payload?.settings) {
        setErrors(extractErrors(payload, "ไม่สามารถบันทึก Marketing Tags ได้"));
        return;
      }

      applyResponse(payload);
      setNotice("บันทึก Marketing Tags สำเร็จ");
    } catch (caughtError) {
      setErrors([
        getAdminErrorMessage(caughtError, "ไม่สามารถบันทึก Marketing Tags ได้"),
      ]);
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return <AdminSettingsSkeleton />;
  }

  return (
    <div className="flex w-full flex-col gap-6 text-[var(--site-text)]">
      <div
        className="sticky top-[73px] z-20 -mx-4 -mt-4 border-b border-[var(--site-border)] bg-[var(--site-background)]/90 px-4 pb-4 pt-4 backdrop-blur-xl lg:top-0 lg:z-30 lg:-mx-6 lg:-mt-6 lg:px-6 lg:pt-6"
        id="marketingTagsPageHeader"
      >
        <header className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--site-primary)]">
              Google Ads / GTM
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-normal text-[var(--site-text)]">
              Marketing Tags
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--site-muted)]">
              จัดการ GTM ID และดูจุดที่พร้อมส่ง event สำหรับวัดผลการจอง
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 ring-1 ${
                  hasUnsavedChanges
                    ? "bg-amber-50 text-amber-800 ring-amber-200"
                    : "bg-emerald-50 text-emerald-700 ring-emerald-200"
                }`}
              >
                <CheckCircle2 aria-hidden="true" className="size-3.5" />
                {hasUnsavedChanges
                  ? "มีการเปลี่ยนแปลงที่ยังไม่บันทึก"
                  : "บันทึกล่าสุดแล้ว"}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 lg:justify-end">
            <a
              className="inline-flex h-12 items-center gap-2 rounded-md border border-[var(--site-border-strong)] bg-[var(--site-surface)] px-5 text-sm font-semibold text-[var(--site-primary)] shadow-sm transition hover:bg-[var(--site-primary-soft)]"
              href="/"
              rel="noopener noreferrer"
              target="_blank"
            >
              <Eye aria-hidden="true" className="size-4" />
              ดูหน้าเว็บจริง
            </a>
            <button
              className="inline-flex h-12 items-center gap-2 rounded-md bg-[var(--site-primary)] px-6 text-sm font-semibold text-[var(--site-on-primary)] shadow-lg shadow-[var(--site-primary)]/20 transition hover:bg-[var(--site-primary-hover)] disabled:cursor-not-allowed disabled:bg-[var(--site-border-strong)] disabled:text-[var(--site-on-primary)]/80 disabled:shadow-none"
              data-save-marketing-tags
              disabled={isSaving || !hasUnsavedChanges}
              onClick={() => {
                void handleSave();
              }}
              type="button"
            >
              <Save aria-hidden="true" className={`size-4 ${isSaving ? "animate-pulse" : ""}`} />
              {isSaving ? "กำลังบันทึก..." : "บันทึก"}
            </button>
          </div>
        </header>
      </div>

      <AdminFeedback
        errors={errors}
        errorTitle="ไม่สามารถบันทึกหรือโหลดได้:"
        notice={notice}
      />

      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="grid min-w-0 gap-5">
          <div className="rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-md bg-[var(--site-primary-soft)] text-[var(--site-primary)]">
                <Tags aria-hidden="true" className="size-5" />
              </span>
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-[var(--site-text)]">
                  Google Tag Manager
                </h2>
                <p className="mt-1 text-sm leading-6 text-[var(--site-muted)]">
                  ใส่เฉพาะ Container ID เช่น GTM-ABC1234 ไม่ต้องใส่โค้ด script
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-2">
              <label
                className="text-sm font-semibold text-[var(--site-text)]"
                htmlFor="googleTagManagerId"
              >
                GTM ID
              </label>
              <input
                autoCapitalize="characters"
                className="h-12 rounded-md border border-[var(--site-border-strong)] bg-[var(--site-surface)] px-4 font-mono text-sm text-[var(--site-text)] outline-none transition focus:border-[var(--site-primary)] focus:ring-2 focus:ring-[var(--site-primary)]/20"
                id="googleTagManagerId"
                inputMode="text"
                onChange={(event) => {
                  updateDraft({ googleTagManagerId: event.target.value });
                }}
                placeholder="GTM-ABC1234"
                spellCheck={false}
                value={draft.googleTagManagerId}
              />
              <p className="text-xs leading-5 text-[var(--site-muted)]">
                เว้นว่างไว้เพื่อปิด GTM บนหน้า public ทั้งหมด
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] p-5 shadow-sm">
            <h2 className="text-lg font-bold text-[var(--site-text)]">
              คู่มือการตั้งค่า Tracking
            </h2>
            <p className="mt-1 text-sm leading-6 text-[var(--site-muted)]">
              เลือกหัวข้อเพื่อดูขั้นตอนตั้งค่า GTM, GA4 และ Google Ads โดยไม่ต้องออกจากหน้านี้
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {MARKETING_SETUP_GUIDES.map((guide, guideIndex) => (
                <article
                  className="rounded-md border border-[var(--site-border)] bg-[var(--site-surface-soft)] p-4"
                  key={guide.id}
                >
                  <div className="flex items-start gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-md bg-[var(--site-primary)] text-sm font-bold text-[var(--site-on-primary)]">
                      {guideIndex + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--site-primary)]">
                        ขั้นตอนที่ {guideIndex + 1}
                      </p>
                      <h3 className="text-sm font-bold text-[var(--site-text)]">
                        {guideIndex + 1}. {guide.title}
                      </h3>
                      <p className="mt-1 text-sm leading-6 text-[var(--site-muted)]">
                        {guide.summary}
                      </p>
                    </div>
                  </div>
                  <button
                    className="mt-4 inline-flex h-10 items-center rounded-md border border-[var(--site-border-strong)] bg-[var(--site-surface)] px-4 text-sm font-semibold text-[var(--site-primary)] transition hover:bg-[var(--site-primary-soft)]"
                    data-marketing-guide={guide.id}
                    onClick={() => {
                      setSelectedGuide(guide);
                    }}
                    type="button"
                  >
                    ดูวิธีตั้ง
                  </button>
                </article>
              ))}
            </div>
          </div>
        </section>

        <aside className="grid min-w-0 content-start gap-4 xl:sticky xl:top-36">
          <div className="rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] p-5 shadow-sm">
            <h2 className="text-base font-bold text-[var(--site-text)]">
              สถานะการติดตั้ง
            </h2>
            <dl className="mt-4 grid gap-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-[var(--site-muted)]">GTM ID</dt>
                <dd className="font-mono font-semibold text-[var(--site-text)]">
                  {draft.googleTagManagerId || "ยังไม่ตั้งค่า"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-[var(--site-muted)]">Public script</dt>
                <dd className="font-semibold text-[var(--site-text)]">
                  {draft.googleTagManagerId ? "เปิดใช้งาน" : "ปิดอยู่"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-[var(--site-muted)]">DataLayer</dt>
                <dd className="font-semibold text-[var(--site-text)]">
                  Villa detail + booking buttons
                </dd>
              </div>
            </dl>
          </div>
        </aside>
      </div>

      {selectedGuide ? (
        <div
          aria-labelledby="marketingGuideDialogTitle"
          aria-modal="true"
          className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
          data-marketing-guide-dialog
          role="dialog"
        >
          <div className="max-h-[calc(100vh-2rem)] w-full max-w-5xl overflow-y-auto rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] p-5 text-[var(--site-text)] shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--site-primary)]">
                  Setup Guide · ขั้นตอนที่ {selectedGuideOrder}
                </p>
                <h2
                  className="mt-1 text-xl font-bold"
                  id="marketingGuideDialogTitle"
                >
                  {selectedGuideOrder}. {selectedGuide.title}
                </h2>
                <p className="mt-2 text-sm leading-6 text-[var(--site-muted)]">
                  {selectedGuide.summary}
                </p>
                {selectedGuide.path ? (
                  <p className="mt-3 rounded-md bg-[var(--site-primary-soft)] px-3 py-2 font-mono text-xs leading-5 text-[var(--site-primary)]">
                    {selectedGuide.path}
                  </p>
                ) : null}
              </div>
              <button
                aria-label="ปิดคู่มือ"
                className="grid size-9 shrink-0 place-items-center rounded-md border border-[var(--site-border)] text-[var(--site-muted)] transition hover:bg-[var(--site-primary-soft)] hover:text-[var(--site-primary)]"
                onClick={() => {
                  setSelectedGuide(null);
                }}
                type="button"
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            </div>
            <div className="mt-5 grid gap-5">
              {selectedGuide.tables.map((table) => (
                <section
                  className="rounded-md border border-[var(--site-border)] bg-[var(--site-surface-soft)] p-4"
                  key={table.title}
                >
                  <h3 className="text-sm font-bold text-[var(--site-text)]">
                    {table.title}
                  </h3>
                  {table.description ? (
                    <p className="mt-1 text-xs leading-5 text-[var(--site-muted)]">
                      {table.description}
                    </p>
                  ) : null}
                  <div className="mt-3 overflow-x-auto">
                    <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
                      <thead>
                        <tr>
                          {table.headers.map((header) => (
                            <th
                              className="border-b border-[var(--site-border)] bg-[var(--site-surface)] px-3 py-2 text-xs font-bold tracking-normal text-[var(--site-muted)]"
                              key={header}
                              scope="col"
                            >
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {table.rows.map((row, rowIndex) => (
                          <tr key={`${table.title}-${rowIndex}`}>
                            {row.map((cell, cellIndex) => (
                              <td
                                className="border-b border-[var(--site-border)] px-3 py-2 font-mono text-xs leading-5 text-[var(--site-text)] last:border-r-0"
                                key={`${table.title}-${rowIndex}-${cellIndex}`}
                              >
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ))}
            </div>
            {selectedGuide.notes?.length ? (
              <div className="mt-5 rounded-md border border-[var(--site-border)] bg-[var(--site-surface-soft)] p-4">
                <h3 className="text-sm font-bold text-[var(--site-text)]">
                  หมายเหตุ
                </h3>
                <ul className="mt-2 grid gap-2 text-sm leading-6 text-[var(--site-muted)]">
                  {selectedGuide.notes.map((note) => (
                    <li className="flex gap-2" key={note}>
                      <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-[var(--site-primary)]" />
                      <span>{note}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="mt-5 flex justify-end">
              <button
                className="inline-flex h-10 items-center rounded-md bg-[var(--site-primary)] px-4 text-sm font-semibold text-[var(--site-on-primary)] transition hover:bg-[var(--site-primary-hover)]"
                onClick={() => {
                  setSelectedGuide(null);
                }}
                type="button"
              >
                เข้าใจแล้ว
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
