"use client";

import {
  ArrowLeft,
  ArrowRight,
  Images,
  RefreshCcw,
  Save,
  Search,
  SearchX,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  extractAdminErrors,
  readJsonPayload,
  shouldRedirectToLogin,
} from "@/components/admin/admin-api-client";
import { readAdminAccessToken } from "@/components/admin/admin-auth";
import { AdminFeedback } from "@/components/admin/admin-feedback";
import { CspSafeImage as Image } from "@/components/ui/csp-safe-image";
import { IMAGE_ZONE_LABELS } from "@/components/villas/detail/constants";
import { VillaCard } from "@/components/villas/listing/villa-card";
import { VillaCardStyleProvider } from "@/components/villas/listing/villa-card-style-context";
import { createBrowserHomeConfigClient } from "@/lib/home-sections/supabase";
import type { SiteSettings, SiteVillaCardStyle } from "@/lib/site-settings/types";
import type { PublicVillaImage } from "@/lib/villas/public-dto";
import type { VillaListing } from "@/lib/villas/types";

import {
  buildSettingsFormData,
  mapSettingsToDraft,
} from "../settings/settings-helpers";

interface AdminVillaCardImageConfig {
  houseId: string;
  id: string;
  imageIds: number[];
  isActive: boolean;
  pageKey: string;
}

interface AdminVillaCardHouseOption {
  coverImage: string | null;
  id: string;
  title: string;
  zoneLabel: string;
}

interface AdminVillaCardHousePagination {
  hasMore: boolean;
  page: number;
  pageCount: number;
  pageSize: number;
  search: string;
  total: number;
}

interface AdminVillaCardImagesResponse {
  configs?: AdminVillaCardImageConfig[];
  houses?: AdminVillaCardHouseOption[];
  pagination?: AdminVillaCardHousePagination;
}

interface AdminVillaCardImageSaveResponse {
  config?: AdminVillaCardImageConfig;
  error?: string;
  errors?: string[];
}

interface AdminSiteSettingsResponse {
  error?: string;
  errors?: string[];
  settings?: SiteSettings;
}

interface VillaImagesResponse {
  images?: PublicVillaImage[];
}

const ALL_ZONE_KEY = "__all__";
const HOUSE_PICKER_PAGE_SIZE = 7;
const VILLA_CARD_PREVIEW_COVER_IMAGE_URL =
  "/images/villa-card-preview-cover.png";
const VILLA_CARD_PREVIEW_IMAGE_URLS = [
  "/images/villa-card-preview-1.jpg",
  "/images/villa-card-preview-2.jpg",
  "/images/villa-card-preview-3.jpg",
  "/images/villa-card-preview-4.jpg",
];
const VILLA_CARD_PREVIEW_VILLA: VillaListing = {
  amenities: [
    { key: "grill", label: "เตาปิ้งย่าง" },
    { key: "karaoke", label: "คาราโอเกะ" },
    { key: "slider", label: "สไลด์เดอร์" },
    { key: "fancyring", label: "ห่วงยางแฟนซี" },
  ],
  bathrooms: 4,
  bedrooms: 5,
  coverImage: null,
  distanceToSea: "500m",
  id: "501",
  people: 12,
  poolType: "private",
  price: 12000,
  title: "Preview Pool Villa",
  zone: "pattaya",
  zoneLabel: "พัทยา",
};
const VILLA_CARD_STYLE_OPTIONS: Array<{
  label: string;
  value: SiteVillaCardStyle;
}> = [
  { label: "แบบเก่า", value: "classic" },
  { label: "แบบใหม่", value: "gallery" },
];

function getHousePageItems(
  currentPage: number,
  pageCount: number,
): Array<"ellipsis" | number> {
  if (pageCount <= 4) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  if (currentPage <= 3) {
    return [1, 2, 3, "ellipsis", pageCount];
  }

  if (currentPage >= pageCount - 2) {
    return [1, "ellipsis", pageCount - 2, pageCount - 1, pageCount];
  }

  return [1, "ellipsis", currentPage, "ellipsis", pageCount];
}

function getImageZoneKey(image: PublicVillaImage): string {
  return image.zone?.trim().toLowerCase() || "uncategorized";
}

function getZoneLabel(zone: string): string {
  if (zone === ALL_ZONE_KEY) {
    return "ทั้งหมด";
  }

  return IMAGE_ZONE_LABELS[zone] ?? zone.replace(/[_-]+/g, " ");
}

function moveId(ids: number[], fromIndex: number, toIndex: number): number[] {
  if (toIndex < 0 || toIndex >= ids.length) {
    return ids;
  }

  const nextIds = [...ids];
  const [removed] = nextIds.splice(fromIndex, 1);
  nextIds.splice(toIndex, 0, removed);
  return nextIds;
}

function isUsableImage(image: PublicVillaImage): boolean {
  return typeof image.id === "number" && image.id > 0 && Boolean(image.imageUrl);
}

function VillaCardStylePreview({ style }: { style: SiteVillaCardStyle }) {
  return (
    <div className="mx-auto w-full max-w-[300px]">
      <VillaCardStyleProvider value={style}>
        <VillaCard
          coverImageSrcOverride={VILLA_CARD_PREVIEW_COVER_IMAGE_URL}
          galleryImageUrls={VILLA_CARD_PREVIEW_IMAGE_URLS}
          navigationMode="static"
          preload
          titleHeadingLevel="h3"
          villa={VILLA_CARD_PREVIEW_VILLA}
        />
      </VillaCardStyleProvider>
    </div>
  );
}

function useAdminToken() {
  const router = useRouter();

  const redirectToLogin = useCallback(() => {
    try {
      void createBrowserHomeConfigClient()
        .auth.signOut({ scope: "local" })
        .finally(() => {
          router.replace("/admin/login?error=admin-access");
        });
    } catch {
      router.replace("/admin/login?error=admin-access");
    }
  }, [router]);

  const getAccessToken = useCallback(async () => {
    const token = await readAdminAccessToken();

    if (!token) {
      redirectToLogin();
      return null;
    }

    return token;
  }, [redirectToLogin]);

  return { getAccessToken, redirectToLogin };
}

export function AdminVillaCardImagesPage() {
  const { getAccessToken, redirectToLogin } = useAdminToken();
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [style, setStyle] = useState<SiteVillaCardStyle>("classic");
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const loadSettings = useCallback(async () => {
    const token = await getAccessToken();

    if (!token) {
      return;
    }

    setIsLoading(true);
    setErrors([]);

    try {
      const response = await fetch("/api/admin/site-settings", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload =
        (await readJsonPayload(response)) as AdminSiteSettingsResponse | null;

      if (shouldRedirectToLogin(response.status, payload)) {
        redirectToLogin();
        return;
      }

      if (!response.ok || !payload?.settings) {
        setErrors(extractAdminErrors(payload, "ไม่สามารถโหลด settings ได้"));
        return;
      }

      setSettings(payload.settings);
      setStyle(payload.settings.villaCardStyle);
    } catch {
      setErrors(["ไม่สามารถโหลด settings ได้"]);
    } finally {
      setIsLoading(false);
    }
  }, [getAccessToken, redirectToLogin]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadSettings();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loadSettings]);

  async function saveStyle() {
    const token = await getAccessToken();

    if (!token || !settings) {
      return;
    }

    setIsSaving(true);
    setErrors([]);
    setNotice(null);

    try {
      const formData = buildSettingsFormData({
        ...mapSettingsToDraft(settings),
        villaCardStyle: style,
      });
      const response = await fetch("/api/admin/site-settings", {
        body: formData,
        headers: { Authorization: `Bearer ${token}` },
        method: "PUT",
      });
      const payload =
        (await readJsonPayload(response)) as AdminSiteSettingsResponse | null;

      if (shouldRedirectToLogin(response.status, payload)) {
        redirectToLogin();
        return;
      }

      if (!response.ok || !payload?.settings) {
        setErrors(extractAdminErrors(payload, "ไม่สามารถบันทึกรูปแบบการ์ดได้"));
        return;
      }

      setSettings(payload.settings);
      setStyle(payload.settings.villaCardStyle);
      setNotice("บันทึกรูปแบบการ์ดบ้านแล้ว");
    } catch {
      setErrors(["ไม่สามารถบันทึกรูปแบบการ์ดได้"]);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex w-full flex-col gap-6 text-[var(--site-text)]">
      <div className="sticky top-[73px] z-20 -mx-4 -mt-4 border-b border-[var(--site-border)] bg-[var(--site-background)]/90 px-4 pb-4 pt-4 backdrop-blur-xl lg:top-0 lg:z-30 lg:-mx-6 lg:-mt-6 lg:px-6 lg:pt-6">
        <header className="mx-auto grid w-full max-w-5xl gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="hidden min-w-0 lg:block">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--site-primary)]">
              Card images
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-normal text-[var(--site-text)]">
              ตั้งค่าการ์ดบ้าน
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--site-muted)]">
              เลือกรูปแบบการ์ดที่หน้าเว็บใช้ และตั้งค่ารูปสำหรับการ์ดแบบใหม่ในช่องเดียวกัน
            </p>
          </div>
          <div className="flex flex-wrap gap-2 lg:justify-end">
            <button
              className="inline-flex h-12 items-center gap-2 rounded-md bg-[var(--site-primary)] px-6 text-sm font-semibold text-[var(--site-on-primary)] shadow-lg shadow-[var(--site-primary)]/20 transition hover:bg-[var(--site-primary-hover)] disabled:cursor-not-allowed disabled:bg-[var(--site-border-strong)] disabled:text-[var(--site-on-primary)]/80 disabled:shadow-none"
              data-villa-card-save-style
              disabled={isSaving || isLoading || !settings}
              type="button"
              onClick={() => {
                void saveStyle();
              }}
            >
              <Save className="h-4 w-4" />
              {isSaving ? "กำลังบันทึก..." : "บันทึกรูปแบบ"}
            </button>
          </div>
        </header>
      </div>

      <div className="mx-auto grid w-full max-w-5xl gap-6">
        <AdminFeedback
          errors={errors}
          errorTitle="ตรวจสอบข้อมูลอีกครั้ง"
          notice={notice}
        />

        <section className="grid gap-4 rounded-2xl border border-[var(--site-border)] bg-[var(--site-surface)] p-4 shadow-sm">
          <div>
            <h2 className="text-base font-semibold text-[var(--site-text)]">
              รูปแบบการ์ดบ้าน
            </h2>
            {isLoading ? (
              <p className="mt-1 text-sm text-[var(--site-muted)]">
                กำลังโหลด...
              </p>
            ) : null}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {VILLA_CARD_STYLE_OPTIONS.map((option) => {
              const isSelected = style === option.value;

              return (
                <div
                  className={`grid min-w-0 content-start gap-3 rounded-xl border p-3 text-left transition ${
                    isSelected
                      ? "border-[var(--site-primary)] bg-[var(--site-primary-soft)]"
                      : "border-[var(--site-border)] bg-[var(--site-surface-soft)]"
                  }`}
                  key={option.value}
                >
                  <button
                    aria-pressed={isSelected}
                    className="flex min-w-0 items-center justify-between gap-3 text-left"
                    data-villa-card-preview-option={option.value}
                    type="button"
                    onClick={() => {
                      setStyle(option.value);
                    }}
                  >
                    <span className="text-sm font-bold text-[var(--site-text)]">
                      {option.label}
                    </span>
                    {isSelected ? (
                      <span className="rounded-md bg-[var(--site-primary)] px-2 py-1 text-xs font-bold text-[var(--site-on-primary)]">
                        กำลังเลือก
                      </span>
                    ) : null}
                  </button>
                  <VillaCardStylePreview style={option.value} />
                  {option.value === "gallery" ? (
                    <Link
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[var(--site-border-strong)] bg-[var(--site-surface)] px-4 text-sm font-semibold text-[var(--site-primary)] shadow-sm transition hover:bg-[var(--site-primary-soft)]"
                      data-villa-card-house-list-link
                      href="/admin/card-images/houses"
                      prefetch={false}
                      onClick={() => {
                        setStyle("gallery");
                      }}
                    >
                      <Images className="h-4 w-4" />
                      ตั้งค่ารูป card แบบใหม่
                    </Link>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

type VillaCardConfigLoadParams = {
  houseId?: string;
  page?: number;
  pageSize?: number;
  search?: string;
};

function useVillaCardConfigs(
  onLoaded?: (configs: AdminVillaCardImageConfig[]) => void,
  params: VillaCardConfigLoadParams = {},
) {
  const { getAccessToken, redirectToLogin } = useAdminToken();
  const [configs, setConfigs] = useState<AdminVillaCardImageConfig[]>([]);
  const [houses, setHouses] = useState<AdminVillaCardHouseOption[]>([]);
  const [pagination, setPagination] =
    useState<AdminVillaCardHousePagination | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadConfigs = useCallback(async () => {
    const token = await getAccessToken();

    if (!token) {
      return;
    }

    setIsLoading(true);
    setErrors([]);

    try {
      const requestParams = new URLSearchParams();

      if (params.houseId) {
        requestParams.set("houseId", params.houseId);
      } else {
        requestParams.set("page", String(params.page ?? 1));
        requestParams.set(
          "pageSize",
          String(params.pageSize ?? HOUSE_PICKER_PAGE_SIZE),
        );

        const search = params.search?.trim();

        if (search) {
          requestParams.set("search", search);
        }
      }

      const response = await fetch(`/api/admin/villa-card-images?${requestParams}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload =
        (await readJsonPayload(response)) as AdminVillaCardImagesResponse | null;

      if (shouldRedirectToLogin(response.status, payload)) {
        redirectToLogin();
        return;
      }

      if (
        !response.ok ||
        !payload ||
        !Array.isArray(payload.configs) ||
        !Array.isArray(payload.houses) ||
        !payload.pagination
      ) {
        setErrors(extractAdminErrors(payload, "ไม่สามารถโหลด config รูปการ์ดได้"));
        return;
      }

      setConfigs(payload.configs);
      setHouses(payload.houses);
      setPagination(payload.pagination);
      onLoaded?.(payload.configs);
    } catch {
      setErrors(["ไม่สามารถโหลด config รูปการ์ดได้"]);
    } finally {
      setIsLoading(false);
    }
  }, [
    getAccessToken,
    onLoaded,
    params.houseId,
    params.page,
    params.pageSize,
    params.search,
    redirectToLogin,
  ]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadConfigs();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loadConfigs]);

  return {
    configs,
    errors,
    getAccessToken,
    houses,
    isLoading,
    loadConfigs,
    pagination,
    redirectToLogin,
    setConfigs,
    setErrors,
  };
}

function VillaCardHouseListSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="grid content-start gap-2"
      data-villa-card-house-list-skeleton
    >
      {Array.from({ length: HOUSE_PICKER_PAGE_SIZE }, (_, index) => (
        <div
          className="flex min-w-0 items-center gap-3 rounded-xl border border-[var(--site-border)] bg-[var(--site-surface-soft)] p-2"
          data-villa-card-house-list-skeleton-row
          key={index}
        >
          <span className="block h-14 w-20 shrink-0 animate-pulse rounded-lg bg-[var(--site-surface-tint)]" />
          <span className="grid min-w-0 flex-1 gap-2">
            <span className="h-3 w-36 max-w-full animate-pulse rounded-full bg-[var(--site-border)]" />
            <span className="h-2.5 w-24 max-w-full animate-pulse rounded-full bg-[var(--site-border)]" />
          </span>
          <span className="h-6 w-14 shrink-0 animate-pulse rounded-full bg-[var(--site-border)]" />
        </div>
      ))}
    </div>
  );
}

export function AdminVillaCardHouseListPage() {
  const [houseSearch, setHouseSearch] = useState("");
  const [housePage, setHousePage] = useState(1);
  const { configs, errors, houses, isLoading, loadConfigs, pagination } =
    useVillaCardConfigs(undefined, {
      page: housePage,
      pageSize: HOUSE_PICKER_PAGE_SIZE,
      search: houseSearch,
    });
  const configsByHouseId = useMemo(
    () => new Map(configs.map((config) => [config.houseId, config])),
    [configs],
  );
  const totalHouses = pagination?.total ?? houses.length;
  const housePageCount =
    pagination?.pageCount ??
    Math.max(1, Math.ceil(totalHouses / HOUSE_PICKER_PAGE_SIZE));
  const currentHousePage = Math.min(housePage, housePageCount);
  const housePageItems = getHousePageItems(currentHousePage, housePageCount);

  return (
    <div className="flex w-full flex-col gap-6 text-[var(--site-text)]">
      <div className="sticky top-[73px] z-20 -mx-4 -mt-4 border-b border-[var(--site-border)] bg-[var(--site-background)]/90 px-4 pb-4 pt-4 backdrop-blur-xl lg:top-0 lg:z-30 lg:-mx-6 lg:-mt-6 lg:px-6 lg:pt-6">
        <header className="mx-auto grid w-full max-w-5xl gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="hidden min-w-0 lg:block">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--site-primary)]">
              Card images
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-normal text-[var(--site-text)]">
              เลือกบ้านสำหรับ custom
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--site-muted)]">
              เลือกบ้านที่ต้องการจัดรูป card แบบใหม่
            </p>
          </div>
          <div className="flex flex-wrap gap-2 lg:justify-end">
            <Link
              className="inline-flex h-12 items-center gap-2 rounded-md border border-[var(--site-border-strong)] bg-[var(--site-surface)] px-5 text-sm font-semibold text-[var(--site-primary)] shadow-sm transition hover:bg-[var(--site-primary-soft)]"
              data-villa-card-back-link
              href="/admin/card-images"
              prefetch={false}
            >
              <ArrowLeft aria-hidden="true" className="size-4" />
              ย้อนกลับ
            </Link>
            <button
              type="button"
              className="inline-flex h-12 items-center gap-2 rounded-md border border-[var(--site-border-strong)] bg-[var(--site-surface)] px-5 text-sm font-semibold text-[var(--site-primary)] shadow-sm transition hover:bg-[var(--site-primary-soft)]"
              onClick={() => {
                void loadConfigs();
              }}
            >
              <RefreshCcw className="h-4 w-4" />
              โหลดใหม่
            </button>
          </div>
        </header>
      </div>

      <div className="mx-auto grid w-full max-w-5xl gap-6">
        <AdminFeedback
          errors={errors}
          errorTitle="ตรวจสอบข้อมูลอีกครั้ง"
          notice={null}
        />

        <section className="grid h-[calc(100dvh-14rem)] min-h-[32rem] min-w-0 grid-rows-[auto_minmax(0,1fr)_auto] gap-4 overflow-hidden rounded-2xl border border-[var(--site-border)] bg-[var(--site-surface)] p-4 shadow-sm">
          <label className="relative block">
            <span className="sr-only">ค้นหาบ้านพัก</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--site-muted)]" />
            <input
              className="h-11 w-full rounded-xl border border-[var(--site-border)] bg-[var(--site-surface-soft)] pl-9 pr-3 text-sm"
              placeholder="ค้นหาบ้าน"
              value={houseSearch}
              onChange={(event) => {
                setHouseSearch(event.target.value);
                setHousePage(1);
              }}
            />
          </label>

          <div
            className="grid min-h-0 auto-rows-max content-start gap-2 overflow-y-auto pr-1"
            data-villa-card-house-list
          >
            {isLoading ? (
              <VillaCardHouseListSkeleton />
            ) : houses.length === 0 ? (
              <div
                className="flex min-h-40 flex-col items-center justify-start gap-3 rounded-xl bg-[var(--site-surface-soft)] px-4 py-10 text-center text-sm text-[var(--site-muted)]"
                data-villa-card-house-empty
              >
                <SearchX
                  aria-hidden="true"
                  className="size-10 text-[var(--site-primary)]"
                />
                <p className="font-semibold">ไม่พบบ้านพัก</p>
              </div>
            ) : (
              houses.map((house) => {
                const hasCustom = configsByHouseId.has(house.id);

                return (
                  <Link
                    className="flex min-w-0 items-center gap-3 rounded-xl border border-[var(--site-border)] bg-[var(--site-surface-soft)] p-2 text-left transition hover:border-[var(--site-border-strong)]"
                    data-villa-card-house-option={house.id}
                    href={`/admin/card-images/houses/${house.id}`}
                    key={house.id}
                    prefetch={false}
                  >
                    <span className="relative block h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-[var(--site-surface-tint)]">
                      {house.coverImage ? (
                        <Image
                          alt=""
                          className="object-cover"
                          fill
                          loading="lazy"
                          quality={50}
                          sizes="80px"
                          src={house.coverImage}
                        />
                      ) : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-[var(--site-text)]">
                        {house.title}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-[var(--site-muted)]">
                        #{house.id} · {house.zoneLabel}
                      </span>
                    </span>
                    {hasCustom ? (
                      <span className="shrink-0 rounded-full bg-[var(--site-primary)] px-2 py-0.5 text-xs font-bold text-[var(--site-on-primary)]">
                        custom
                      </span>
                    ) : null}
                  </Link>
                );
              })
            )}
          </div>

          {totalHouses > HOUSE_PICKER_PAGE_SIZE ? (
            <nav
              aria-label="pagination"
              className="border-t border-[var(--site-border)] pt-3"
              data-villa-card-house-pagination
            >
            <ul className="flex flex-wrap items-center justify-center gap-1">
              <li>
                <button
                  aria-label="หน้าก่อนหน้า"
                  className="inline-flex h-9 items-center justify-center gap-1 rounded-lg border border-[var(--site-border)] bg-[var(--site-surface-soft)] px-3 text-sm font-semibold text-[var(--site-text)] disabled:cursor-not-allowed disabled:opacity-40"
                  data-villa-card-house-page-prev
                  disabled={currentHousePage <= 1}
                  type="button"
                  onClick={() => {
                    setHousePage((page) => Math.max(1, page - 1));
                  }}
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">ก่อนหน้า</span>
                </button>
              </li>
              {housePageItems.map((item, index) => {
                if (item === "ellipsis") {
                  return (
                    <li key={`ellipsis-${index}`}>
                      <span
                        aria-hidden="true"
                        className="grid h-9 min-w-9 place-items-center text-sm font-bold text-[var(--site-muted)]"
                        data-villa-card-house-page-ellipsis
                      >
                        ...
                      </span>
                      <span className="sr-only">More pages</span>
                    </li>
                  );
                }

                const pageNumber = item;
                const isCurrentPage = pageNumber === currentHousePage;

                return (
                  <li key={pageNumber}>
                    <button
                      aria-current={isCurrentPage ? "page" : undefined}
                      aria-label={`ไปหน้า ${pageNumber}`}
                      className={`grid h-9 min-w-9 place-items-center rounded-lg border px-3 text-sm font-semibold ${
                        isCurrentPage
                          ? "border-[var(--site-primary)] bg-[var(--site-primary)] text-[var(--site-on-primary)]"
                          : "border-[var(--site-border)] bg-[var(--site-surface-soft)] text-[var(--site-text)]"
                      }`}
                      data-villa-card-house-page-button={pageNumber}
                      type="button"
                      onClick={() => {
                        setHousePage(pageNumber);
                      }}
                    >
                      {pageNumber}
                    </button>
                  </li>
                );
              })}
              <li>
                <button
                  aria-label="หน้าถัดไป"
                  className="inline-flex h-9 items-center justify-center gap-1 rounded-lg border border-[var(--site-border)] bg-[var(--site-surface-soft)] px-3 text-sm font-semibold text-[var(--site-text)] disabled:cursor-not-allowed disabled:opacity-40"
                  data-villa-card-house-page-next
                  disabled={currentHousePage >= housePageCount}
                  type="button"
                  onClick={() => {
                    setHousePage((page) => Math.min(housePageCount, page + 1));
                  }}
                >
                  <span className="hidden sm:inline">ถัดไป</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </li>
            </ul>
            </nav>
          ) : null}
        </section>
      </div>
    </div>
  );
}

export function AdminVillaCardHouseCustomPage({ houseId }: { houseId: string }) {
  const [selectedImageIds, setSelectedImageIds] = useState<number[]>([]);
  const handleConfigsLoaded = useCallback(
    (nextConfigs: AdminVillaCardImageConfig[]) => {
      setSelectedImageIds(
        nextConfigs.find((item) => item.houseId === houseId)?.imageIds ?? [],
      );
    },
    [houseId],
  );
  const {
    errors,
    getAccessToken,
    houses,
    isLoading,
    redirectToLogin,
    setConfigs,
    setErrors,
  } = useVillaCardConfigs(handleConfigsLoaded, { houseId });
  const [notice, setNotice] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingImages, setIsLoadingImages] = useState(false);
  const [selectedZone, setSelectedZone] = useState(ALL_ZONE_KEY);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const draggedSelectedImageIdRef = useRef<number | null>(null);
  const [images, setImages] = useState<PublicVillaImage[]>([]);
  const selectedHouse =
    houses.find((house) => house.id === houseId) ??
    ({
      coverImage: null,
      id: houseId,
      title: `บ้าน ${houseId}`,
      zoneLabel: "",
    } satisfies AdminVillaCardHouseOption);
  const imageById = useMemo(
    () => new Map(images.map((image) => [image.id, image])),
    [images],
  );
  const selectedImages = selectedImageIds
    .map((imageId) => imageById.get(imageId))
    .filter((image): image is PublicVillaImage => Boolean(image));
  const imageZoneOptions = useMemo(() => {
    const counts = new Map<string, number>();

    for (const image of images) {
      const zone = getImageZoneKey(image);
      counts.set(zone, (counts.get(zone) ?? 0) + 1);
    }

    return [
      { count: images.length, zone: ALL_ZONE_KEY },
      ...[...counts.entries()]
        .sort(([left], [right]) => left.localeCompare(right, "th"))
        .map(([zone, count]) => ({ count, zone })),
    ];
  }, [images]);
  const visibleImages = useMemo(
    () =>
      selectedZone === ALL_ZONE_KEY
        ? images
        : images.filter((image) => getImageZoneKey(image) === selectedZone),
    [images, selectedZone],
  );

  useEffect(() => {
    async function loadHouseImages() {
      setIsLoadingImages(true);
      setErrors([]);
      setNotice(null);

      try {
        const response = await fetch(
          `/api/villas/${encodeURIComponent(houseId)}/images`,
        );
        const payload =
          (await readJsonPayload(response)) as VillaImagesResponse | null;

        if (!response.ok || !payload || !Array.isArray(payload.images)) {
          setErrors(["ไม่สามารถโหลดรูปบ้านนี้ได้"]);
          return;
        }

        setImages(payload.images.filter(isUsableImage));
      } catch {
        setErrors(["ไม่สามารถโหลดรูปบ้านนี้ได้"]);
      } finally {
        setIsLoadingImages(false);
      }
    }

    void loadHouseImages();
  }, [houseId, setErrors]);

  function toggleImage(imageId: number) {
    setSelectedImageIds((currentIds) => {
      if (currentIds.includes(imageId)) {
        return currentIds.filter((id) => id !== imageId);
      }

      if (currentIds.length >= 10) {
        setErrors(["เลือกได้สูงสุด 10 รูป"]);
        return currentIds;
      }

      return [...currentIds, imageId];
    });
  }

  function moveSelectedImageById(imageId: number, targetImageId: number) {
    setSelectedImageIds((ids) => {
      const fromIndex = ids.indexOf(imageId);
      const toIndex = ids.indexOf(targetImageId);

      return fromIndex === -1 || toIndex === -1 || fromIndex === toIndex
        ? ids
        : moveId(ids, fromIndex, toIndex);
    });
  }

  function requestSaveConfig() {
    if (selectedImageIds.length < 3) {
      setErrors(["custom ควรมีอย่างน้อย 3 รูป"]);
      setNotice(null);
      return;
    }

    setErrors([]);
    setNotice(null);
    setIsConfirmDialogOpen(true);
  }

  async function saveConfig() {
    if (selectedImageIds.length < 3) {
      requestSaveConfig();
      return;
    }

    const token = await getAccessToken();

    if (!token) {
      return;
    }

    setIsSaving(true);
    setErrors([]);
    setNotice(null);

    try {
      const response = await fetch("/api/admin/villa-card-images", {
        body: JSON.stringify({
          houseId,
          imageIds: selectedImageIds,
          isActive: true,
        }),
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        method: "PUT",
      });
      const payload =
        (await readJsonPayload(response)) as AdminVillaCardImageSaveResponse | null;

      if (shouldRedirectToLogin(response.status, payload)) {
        redirectToLogin();
        return;
      }

      if (!response.ok || !payload?.config) {
        setErrors(extractAdminErrors(payload, "ไม่สามารถบันทึก config รูปการ์ดได้"));
        return;
      }

      const savedConfig = payload.config;

      setConfigs((currentConfigs) => [
        ...currentConfigs.filter((config) => config.houseId !== savedConfig.houseId),
        savedConfig,
      ]);
      setIsConfirmDialogOpen(false);
      setNotice("บันทึก custom รูปการ์ดแล้ว");
    } catch {
      setErrors(["ไม่สามารถบันทึก config รูปการ์ดได้"]);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex w-full flex-col gap-6 text-[var(--site-text)]">
      <div className="sticky top-[73px] z-20 -mx-4 -mt-4 border-b border-[var(--site-border)] bg-[var(--site-background)]/90 px-4 pb-4 pt-4 backdrop-blur-xl lg:top-0 lg:z-30 lg:-mx-6 lg:-mt-6 lg:px-6 lg:pt-6">
        <header className="mx-auto flex w-full max-w-6xl flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link
              className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--site-primary)]"
              href="/admin/card-images/houses"
              prefetch={false}
            >
              <ArrowLeft className="h-4 w-4" />
              กลับไปรายการบ้าน
            </Link>
            <h1 className="mt-2 text-2xl font-bold text-[var(--site-text)]">
              {selectedHouse.title}
            </h1>
            <p className="mt-1 text-sm text-[var(--site-muted)]">
              #{selectedHouse.id}
              {selectedHouse.zoneLabel ? ` · ${selectedHouse.zoneLabel}` : ""}
            </p>
          </div>
          <button
            type="button"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-[var(--site-primary)] px-6 text-sm font-semibold text-[var(--site-on-primary)] shadow-lg shadow-[var(--site-primary)]/20 transition hover:bg-[var(--site-primary-hover)] disabled:cursor-not-allowed disabled:bg-[var(--site-border-strong)] disabled:text-[var(--site-on-primary)]/80 disabled:shadow-none"
            data-villa-card-save-custom
            disabled={isSaving || isLoading || isLoadingImages}
            onClick={() => {
              requestSaveConfig();
            }}
          >
            <Save className="h-4 w-4" />
            {isSaving ? "กำลังบันทึก..." : "บันทึก custom"}
          </button>
        </header>
      </div>

      <div className="mx-auto grid w-full max-w-6xl gap-6">
        <AdminFeedback
          errors={errors}
          errorTitle="ตรวจสอบข้อมูลอีกครั้ง"
          notice={notice}
        />

      <section className="grid h-[calc(100dvh-14rem)] min-h-[32rem] min-w-0 grid-rows-[auto_minmax(0,1fr)] gap-4 overflow-hidden rounded-2xl border border-[var(--site-border)] bg-[var(--site-surface)] p-4 shadow-sm">
        {isLoadingImages ? (
          <p className="rounded-xl bg-[var(--site-surface-soft)] p-4 text-sm text-[var(--site-muted)]">
            กำลังโหลดรูป...
          </p>
        ) : images.length === 0 ? (
          <p className="rounded-xl bg-[var(--site-surface-soft)] p-4 text-sm text-[var(--site-muted)]">
            ไม่พบรูปบ้านนี้
          </p>
        ) : (
          <div className="grid h-full min-h-0 min-w-0 gap-3 overflow-hidden lg:grid-cols-[180px_minmax(0,1fr)]">
            <nav
              aria-label="หมวดรูปบ้าน"
              className="flex gap-2 overflow-x-auto rounded-xl border border-[var(--site-border)] bg-[var(--site-surface-soft)] p-2 lg:block lg:space-y-2 lg:overflow-y-auto"
            >
              {imageZoneOptions.map((option) => {
                const isActive = option.zone === selectedZone;

                return (
                  <button
                    className={`flex min-w-32 items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition lg:w-full ${
                      isActive
                        ? "bg-[var(--site-primary)] text-[var(--site-on-primary)]"
                        : "bg-[var(--site-surface)] text-[var(--site-text)]"
                    }`}
                    data-villa-card-zone-option={option.zone}
                    key={option.zone}
                    type="button"
                    onClick={() => {
                      setSelectedZone(option.zone);
                    }}
                  >
                    <span className="truncate">{getZoneLabel(option.zone)}</span>
                    <span className="shrink-0 text-xs">{option.count}</span>
                  </button>
                );
              })}
            </nav>

            <div
              className="grid min-h-0 min-w-0 auto-rows-max grid-cols-2 gap-3 overflow-y-auto pr-1 md:grid-cols-3 xl:grid-cols-4"
              data-villa-card-image-grid
            >
              {visibleImages.map((image) => {
                const selectedIndex = selectedImageIds.indexOf(image.id);
                const isSelected = selectedIndex !== -1;

                return (
                  <button
                    className={`grid min-w-0 overflow-hidden rounded-xl border p-2 text-left transition ${
                      isSelected
                        ? "border-[var(--site-primary)] bg-[var(--site-primary-soft)]"
                        : "border-[var(--site-border)] bg-[var(--site-surface-soft)]"
                    }`}
                    data-villa-card-image-option={image.id}
                    key={image.id}
                    type="button"
                    onClick={() => {
                      toggleImage(image.id);
                    }}
                  >
                    <span
                      className="relative block aspect-[4/3] overflow-hidden rounded-lg bg-[var(--site-surface-tint)]"
                      data-villa-card-image-frame
                    >
                      <Image
                        alt={image.imageName ?? `image ${image.id}`}
                        className="object-cover"
                        fill
                        loading="lazy"
                        quality={60}
                        sizes="180px"
                        src={image.imageUrl}
                      />
                      {isSelected ? (
                        <span
                          className="absolute right-2 top-2 rounded-full bg-[var(--site-primary)] px-2 py-0.5 text-xs font-bold text-[var(--site-on-primary)] shadow-sm"
                          data-villa-card-selected-index
                        >
                          #{selectedIndex + 1}
                        </span>
                      ) : null}
                    </span>
                    <span className="min-w-0 text-xs font-semibold text-[var(--site-text)]">
                      <span className="truncate">{image.imageName ?? image.id}</span>
                    </span>
                    <span className="text-xs text-[var(--site-muted)]">
                      {getImageZoneKey(image)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        </section>
      </div>

      {isConfirmDialogOpen ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-3"
          data-villa-card-confirm-dialog
          role="dialog"
        >
          <div className="grid max-h-[calc(100dvh-1.5rem)] w-full max-w-6xl min-w-0 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-2xl border border-[var(--site-border)] bg-[var(--site-surface)] shadow-xl">
            <header className="border-b border-[var(--site-border)] px-4 py-3">
              <h2 className="text-lg font-bold text-[var(--site-text)]">
                ยืนยันรูปที่เลือก
              </h2>
              <p className="mt-1 text-sm text-[var(--site-muted)]">
                ลากเพื่อจัดลำดับ หรือใช้ปุ่มซ้าย/ขวาก่อนบันทึกจริง
              </p>
            </header>

            <div className="min-h-0 overflow-y-auto p-4">
              <div
                className="grid min-w-0 grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-3"
                data-villa-card-confirm-order={selectedImageIds.join(",")}
              >
                {selectedImages.map((image, index) => (
                  <div
                    className="grid min-w-0 gap-2 overflow-hidden rounded-xl border border-[var(--site-border)] bg-[var(--site-surface-soft)] p-2"
                    data-villa-card-confirm-image={image.id}
                    draggable
                    key={image.id}
                    onDragEnd={() => {
                      draggedSelectedImageIdRef.current = null;
                    }}
                    onDragOver={(event) => {
                      event.preventDefault();
                      const draggedImageId = draggedSelectedImageIdRef.current;

                      if (
                        draggedImageId !== null &&
                        draggedImageId !== image.id
                      ) {
                        moveSelectedImageById(draggedImageId, image.id);
                      }
                    }}
                    onDragStart={() => {
                      draggedSelectedImageIdRef.current = image.id;
                    }}
                  >
                    <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-[var(--site-surface-tint)]">
                      <Image
                        alt={image.imageName ?? `image ${image.id}`}
                        className="object-cover"
                        fill
                        loading="lazy"
                        quality={60}
                        sizes="160px"
                        src={image.imageUrl}
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[var(--site-text)]">
                        #{index + 1}
                      </p>
                      <p className="truncate text-xs text-[var(--site-muted)]">
                        {image.imageName ?? image.id}
                      </p>
                      <p className="truncate text-xs text-[var(--site-muted)]">
                        {getImageZoneKey(image)}
                      </p>
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      <button
                        aria-label="เลื่อนไปซ้าย"
                        className="grid h-8 place-items-center rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] disabled:opacity-40"
                        disabled={index === 0}
                        type="button"
                        onClick={() => {
                          setSelectedImageIds((ids) =>
                            moveId(ids, index, index - 1),
                          );
                        }}
                      >
                        <ArrowLeft className="h-4 w-4" />
                      </button>
                      <button
                        aria-label="เอารูปออก"
                        className="grid h-8 place-items-center rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)]"
                        type="button"
                        onClick={() => {
                          toggleImage(image.id);
                        }}
                      >
                        <X className="h-4 w-4" />
                      </button>
                      <button
                        aria-label="เลื่อนไปขวา"
                        className="grid h-8 place-items-center rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] disabled:opacity-40"
                        disabled={index === selectedImages.length - 1}
                        type="button"
                        onClick={() => {
                          setSelectedImageIds((ids) =>
                            moveId(ids, index, index + 1),
                          );
                        }}
                      >
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <footer className="flex flex-wrap justify-end gap-2 border-t border-[var(--site-border)] px-4 py-3">
              <button
                className="inline-flex h-10 items-center justify-center rounded-xl border border-[var(--site-border)] bg-[var(--site-surface)] px-4 text-sm font-semibold text-[var(--site-text)]"
                disabled={isSaving}
                type="button"
                onClick={() => {
                  setIsConfirmDialogOpen(false);
                }}
              >
                ยกเลิก
              </button>
              <button
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[var(--site-primary)] px-4 text-sm font-bold text-[var(--site-on-primary)] disabled:cursor-not-allowed disabled:opacity-60"
                data-villa-card-confirm-save
                disabled={isSaving || selectedImageIds.length < 3}
                type="button"
                onClick={() => {
                  void saveConfig();
                }}
              >
                <Save className="h-4 w-4" />
                {isSaving ? "กำลังบันทึก..." : "ยืนยันบันทึก"}
              </button>
            </footer>
          </div>
        </div>
      ) : null}
    </div>
  );
}
