"use client";

import {
  ArrowDownUp,
  ArrowLeft,
  ArrowRight,
  Images,
  RefreshCcw,
  Save,
  Search,
  SearchX,
  Trash2,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ChangeEvent } from "react";
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
import type { SiteVillaCardStyle } from "@/lib/site-web-styles/types";
import type { PublicVillaImage } from "@/lib/villas/public-dto";
import type { VillaListing } from "@/lib/villas/types";

interface AdminVillaCardImageConfig {
  coverImage?: AdminVillaCardCoverImage | null;
  houseId: string;
  id: string;
  imageIds: number[];
  isActive: boolean;
  pageKey: string;
}

interface AdminVillaCardCoverImage {
  alt: string;
  path: string;
  url: string;
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
  villaCardStyle?: SiteVillaCardStyle;
}

interface AdminVillaCardImageSaveResponse {
  config?: AdminVillaCardImageConfig;
  error?: string;
  errors?: string[];
  villaCardStyle?: SiteVillaCardStyle;
}

interface VillaImagesResponse {
  images?: PublicVillaImage[];
}

const ALL_ZONE_KEY = "__all__";
const OUTSIDE_ZONE_KEY = "outside";
const HOUSE_PICKER_PAGE_SIZE = 7;
const VILLA_COVER_UPLOAD_MAX_BYTES = 6 * 1024 * 1024;
const VILLA_COVER_UPLOAD_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const VILLA_COVER_UPLOAD_EXTENSIONS = new Set(["jpeg", "jpg", "png", "webp"]);
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

function parseHousePage(value: string | undefined): number {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function getHouseListQueryString(page: number, search: string): string {
  const params = new URLSearchParams();
  const trimmedSearch = search.trim();

  if (page > 1) {
    params.set("page", String(page));
  }

  if (trimmedSearch) {
    params.set("search", trimmedSearch);
  }

  return params.toString();
}

function getHouseListHref(page: number, search: string): string {
  const queryString = getHouseListQueryString(page, search);
  return queryString
    ? `/admin/card-images/houses?${queryString}`
    : "/admin/card-images/houses";
}

function getHouseDetailHref(
  houseId: string,
  page: number,
  search: string,
): string {
  const queryString = getHouseListQueryString(page, search);
  const baseHref = `/admin/card-images/houses/${encodeURIComponent(houseId)}`;

  return queryString ? `${baseHref}?${queryString}` : baseHref;
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

function sortImageZoneKeys(zones: string[]): string[] {
  return [...zones].sort((left, right) => {
    if (left === right) {
      return 0;
    }

    if (left === OUTSIDE_ZONE_KEY) {
      return -1;
    }

    if (right === OUTSIDE_ZONE_KEY) {
      return 1;
    }

    return left.localeCompare(right, "th");
  });
}

function getInitialImageZone(images: PublicVillaImage[]): string {
  return (
    sortImageZoneKeys([...new Set(images.map(getImageZoneKey))])[0] ??
    ALL_ZONE_KEY
  );
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

function isAllowedVillaCoverFile(file: File): boolean {
  const extension = file.name.split(".").pop()?.toLowerCase();

  return (
    VILLA_COVER_UPLOAD_TYPES.has(file.type) &&
    Boolean(extension && VILLA_COVER_UPLOAD_EXTENSIONS.has(extension))
  );
}

function VillaCardStyleSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="grid gap-4 rounded-2xl border border-[var(--site-border)] bg-[var(--site-surface)] p-4 shadow-sm"
      data-villa-card-style-skeleton
    >
      <span className="h-4 w-40 max-w-full animate-pulse rounded-full bg-[var(--site-border)]" />
      <span className="h-3 w-64 max-w-full animate-pulse rounded-full bg-[var(--site-surface-tint)]" />
      <div className="grid gap-3 md:grid-cols-2">
        {Array.from({ length: 2 }, (_, index) => (
          <div
            className="grid min-w-0 gap-3 rounded-xl border border-[var(--site-border)] bg-[var(--site-surface-soft)] p-3"
            key={index}
          >
            <span className="h-4 w-24 max-w-full animate-pulse rounded-full bg-[var(--site-border)]" />
            <div className="mx-auto w-full max-w-[300px]">
              <span className="block aspect-[3/4] w-full animate-pulse rounded-xl bg-[var(--site-surface-tint)]" />
            </div>
            <span className="h-10 w-full animate-pulse rounded-md bg-[var(--site-surface-tint)]" />
          </div>
        ))}
      </div>
    </div>
  );
}

function VillaCardStylePreview({ style }: { style: SiteVillaCardStyle }) {
  return (
    <div className="mx-auto w-full max-w-[300px]" data-villa-card-style-preview>
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

export function AdminVillaCardImagesPage({ embedded = false }: { embedded?: boolean }) {
  const { getAccessToken, redirectToLogin } = useAdminToken();
  const [style, setStyle] = useState<SiteVillaCardStyle>("classic");
  const [savedStyle, setSavedStyle] = useState<SiteVillaCardStyle | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadedStyle, setHasLoadedStyle] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const loadSettings = useCallback(async () => {
    const token = await getAccessToken();

    if (!token) {
      return;
    }

    setIsLoading(true);
    setHasLoadedStyle(false);
    setErrors([]);

    try {
      const response = await fetch("/api/admin/villa-card-images", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload =
        (await readJsonPayload(response)) as AdminVillaCardImagesResponse | null;

      if (shouldRedirectToLogin(response.status, payload)) {
        redirectToLogin();
        return;
      }

      if (!response.ok || !payload?.villaCardStyle) {
        setErrors(extractAdminErrors(payload, "ไม่สามารถโหลด settings ได้"));
        return;
      }

      setStyle(payload.villaCardStyle);
      setSavedStyle(payload.villaCardStyle);
      setHasLoadedStyle(true);
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
    if (!hasLoadedStyle) {
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
        body: JSON.stringify({ villaCardStyle: style }),
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

      if (!response.ok || !payload?.villaCardStyle) {
        setErrors(extractAdminErrors(payload, "ไม่สามารถบันทึกรูปแบบการ์ดได้"));
        return;
      }

      setStyle(payload.villaCardStyle);
      setSavedStyle(payload.villaCardStyle);
      setNotice("บันทึกรูปแบบการ์ดบ้านแล้ว");
    } catch {
      setErrors(["ไม่สามารถบันทึกรูปแบบการ์ดได้"]);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex w-full flex-col gap-6 text-[var(--site-text)]">
      {!embedded ? <div className="sticky top-[73px] z-20 -mx-4 -mt-4 border-b border-[var(--site-border)] bg-[var(--site-background)]/90 px-4 pb-4 pt-4 backdrop-blur-xl lg:top-0 lg:z-30 lg:-mx-6 lg:-mt-6 lg:px-6 lg:pt-6">
        <header className="mx-auto grid w-full max-w-5xl gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="hidden min-w-0 lg:block">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--site-primary)]">
              Card images
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-normal text-[var(--site-text)]">
              ตั้งค่าการ์ดบ้าน
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--site-muted)]">
              เลือกรูปแบบการ์ดที่หน้าเว็บใช้ และจัดการรูปปกบ้านแยกจากรูปแบบการ์ด
            </p>
          </div>
        </header>
      </div> : null}

      <div className={embedded ? "grid gap-4" : "mx-auto grid w-full max-w-5xl gap-6"}>
        <AdminFeedback
          errors={errors}
          errorTitle="ตรวจสอบข้อมูลอีกครั้ง"
          notice={notice}
        />

        <section className="grid gap-4 rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-4">
              <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-[var(--site-primary-soft)] text-[var(--site-primary)]">
                <Images className="size-5" />
              </span>
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-[var(--site-text)]">
                  รูปแบบการ์ดบ้าน
                </h2>
                <p className="mt-1 text-sm leading-6 text-[var(--site-muted)]">
                  เลือกรูปแบบที่ใช้กับรายการบ้านทั้งเว็บไซต์
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                className="inline-flex h-10 items-center gap-2 rounded-md border border-[var(--site-border-strong)] bg-[var(--site-surface)] px-4 text-sm font-semibold text-[var(--site-primary)] shadow-sm transition hover:bg-[var(--site-primary-soft)]"
                data-villa-card-house-list-link
                href="/admin/card-images/houses"
                prefetch={false}
              >
                <Images className="h-4 w-4" />
                จัดการรูปปกบ้าน
              </Link>
              <button
                className="inline-flex h-10 items-center gap-2 rounded-md bg-[var(--site-primary)] px-4 text-sm font-semibold text-[var(--site-on-primary)] shadow-sm transition hover:bg-[var(--site-primary-hover)] disabled:cursor-not-allowed disabled:bg-[var(--site-border-strong)] disabled:text-[var(--site-on-primary)]/80 disabled:shadow-none"
                data-villa-card-save-style
                disabled={isSaving || isLoading || !hasLoadedStyle || style === savedStyle}
                type="button"
                onClick={() => {
                  void saveStyle();
                }}
              >
                <Save className="h-4 w-4" />
                {isSaving ? "กำลังบันทึก..." : "บันทึกรูปแบบ"}
              </button>
            </div>
          </div>

          {isLoading ? (
            <VillaCardStyleSkeleton />
          ) : (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)]">
            <div className="flex items-center justify-center overflow-hidden rounded-lg" data-villa-card-selected-preview data-villa-card-selected-state={style}>
              <VillaCardStylePreview style={style} />
            </div>
            <div className="grid content-start gap-3 lg:grid-rows-2" data-villa-card-style-options>
            {VILLA_CARD_STYLE_OPTIONS.map((option) => {
              const isSelected = style === option.value;

              return (
                <label
                  className={`flex cursor-pointer gap-3 rounded-lg border p-4 text-left transition ${
                    isSelected
                      ? "border-[var(--site-primary)] bg-[var(--site-primary-soft)]"
                      : "border-[var(--site-border)] bg-[var(--site-surface-soft)]"
                  }`}
                  data-villa-card-preview-option={option.value}
                  key={option.value}
                  onClick={() => setStyle(option.value)}
                >
                  <input
                    aria-label={`เลือกรูปแบบ ${option.label}`}
                    checked={isSelected}
                    className="mt-1 size-4 shrink-0 accent-[var(--site-primary)]"
                    name="villaCardStyle"
                    onChange={() => setStyle(option.value)}
                    type="radio"
                    value={option.value}
                  />
                  <span>
                    <span className="block font-semibold text-[var(--site-text)]">
                      {option.label}
                    </span>
                    <span className="mt-1 block text-sm text-[var(--site-text-muted)]">
                      เลือกเพื่อแสดงตัวอย่างด้านล่าง
                    </span>
                  </span>
                </label>
              );
            })}
            </div>
          </div>
          )}
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
  const activeRequestIdRef = useRef(0);
  const activeAbortControllerRef = useRef<AbortController | null>(null);

  const loadConfigs = useCallback(async () => {
    const requestId = activeRequestIdRef.current + 1;
    activeRequestIdRef.current = requestId;
    activeAbortControllerRef.current?.abort();
    const abortController = new AbortController();
    activeAbortControllerRef.current = abortController;
    const isActiveRequest = () => activeRequestIdRef.current === requestId;

    setIsLoading(true);
    setErrors([]);

    const token = await getAccessToken();

    if (!token) {
      if (isActiveRequest()) {
        setIsLoading(false);
      }

      return;
    }

    if (!isActiveRequest()) {
      return;
    }

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
        signal: abortController.signal,
      });
      const payload =
        (await readJsonPayload(response)) as AdminVillaCardImagesResponse | null;

      if (!isActiveRequest()) {
        return;
      }

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
    } catch (error) {
      if (!isActiveRequest() || (error instanceof Error && error.name === "AbortError")) {
        return;
      }

      setErrors(["ไม่สามารถโหลด config รูปการ์ดได้"]);
    } finally {
      if (isActiveRequest()) {
        activeAbortControllerRef.current = null;
        setIsLoading(false);
      }
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
    let shouldLoad = true;

    queueMicrotask(() => {
      if (shouldLoad) {
        void loadConfigs();
      }
    });

    return () => {
      shouldLoad = false;
      activeRequestIdRef.current += 1;
      activeAbortControllerRef.current?.abort();
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
      className="col-span-full grid grid-cols-2 content-start gap-2 sm:grid-cols-1"
      data-villa-card-house-list-skeleton
    >
      {Array.from({ length: HOUSE_PICKER_PAGE_SIZE }, (_, index) => (
        <div
          className="grid min-w-0 gap-3 rounded-xl border border-[var(--site-border)] bg-[var(--site-surface-soft)] p-3 sm:flex sm:items-center sm:p-2"
          data-villa-card-house-list-skeleton-row
          key={index}
        >
          <span className="block h-24 w-full shrink-0 animate-pulse rounded-lg bg-[var(--site-surface-tint)] sm:h-14 sm:w-20" />
          <span className="grid min-w-0 flex-1 gap-2">
            <span className="h-3 w-24 max-w-full animate-pulse rounded-full bg-[var(--site-border)] sm:w-36" />
            <span className="h-2.5 w-20 max-w-full animate-pulse rounded-full bg-[var(--site-border)] sm:w-24" />
          </span>
          <span
            className="h-5 w-24 max-w-full animate-pulse rounded-full bg-[var(--site-border)] sm:w-14 sm:shrink-0"
            data-villa-card-house-skeleton-badge
          />
        </div>
      ))}
    </div>
  );
}

function VillaCardImagePickerSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="grid h-full min-h-0 min-w-0 gap-3 overflow-hidden lg:grid-cols-[180px_minmax(0,1fr)]"
      data-villa-card-image-picker-skeleton
    >
      <div className="flex gap-2 overflow-hidden rounded-xl border border-[var(--site-border)] bg-[var(--site-surface-soft)] p-2 lg:block lg:space-y-2">
        {Array.from({ length: 4 }, (_, index) => (
          <span
            className="block h-9 min-w-32 animate-pulse rounded-lg bg-[var(--site-border)] lg:w-full"
            key={index}
          />
        ))}
      </div>
      <div
        className="grid min-h-0 min-w-0 auto-rows-max grid-cols-2 gap-3 overflow-y-auto pr-1 md:grid-cols-3 xl:grid-cols-4"
        data-villa-card-image-grid-skeleton
      >
        {Array.from({ length: 8 }, (_, index) => (
          <div
            className="grid min-w-0 gap-2 overflow-hidden rounded-xl border border-[var(--site-border)] bg-[var(--site-surface-soft)] p-2"
            key={index}
          >
            <span className="block aspect-[4/3] animate-pulse rounded-lg bg-[var(--site-surface-tint)]" />
            <span className="h-3 w-28 max-w-full animate-pulse rounded-full bg-[var(--site-border)]" />
            <span className="h-3 w-16 max-w-full animate-pulse rounded-full bg-[var(--site-border)]" />
          </div>
        ))}
      </div>
    </div>
  );
}

interface AdminVillaCardHouseListPageProps {
  initialPage?: string;
  initialSearch?: string;
}

export function AdminVillaCardHouseListPage({
  initialPage,
  initialSearch,
}: AdminVillaCardHouseListPageProps = {}) {
  const [houseSearch, setHouseSearch] = useState(initialSearch ?? "");
  const [housePage, setHousePage] = useState(() =>
    parseHousePage(initialPage),
  );
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
  const houseListHref = getHouseListHref(housePage, houseSearch);

  useEffect(() => {
    const currentHref = `${window.location.pathname}${window.location.search}`;

    if (currentHref !== houseListHref) {
      window.history.replaceState(null, "", houseListHref);
    }
  }, [houseListHref]);

  return (
    <div className="flex w-full flex-col gap-6 text-[var(--site-text)]">
      <div className="sticky top-[73px] z-20 -mx-4 -mt-4 border-b border-[var(--site-border)] bg-[var(--site-background)]/90 px-4 pb-4 pt-4 backdrop-blur-xl lg:top-0 lg:z-30 lg:-mx-6 lg:-mt-6 lg:px-6 lg:pt-6">
        <header className="mx-auto grid w-full max-w-5xl gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="min-w-0">
            <Link
              className="inline-flex items-center gap-2 text-xs font-bold text-[var(--site-primary)] transition hover:text-[var(--site-primary-hover)]"
              data-villa-card-back-link
              href="/admin/card-images"
              prefetch={false}
            >
              <ArrowLeft aria-hidden="true" className="size-3.5" />
              กลับไปตั้งค่าการ์ดบ้าน
            </Link>
            <h1 className="mt-2 hidden text-3xl font-bold tracking-normal text-[var(--site-text)] lg:block">
              เลือกบ้านสำหรับจัดเรียงรูป
            </h1>
            <p className="mt-2 hidden max-w-2xl text-sm leading-6 text-[var(--site-muted)] lg:block">
              เลือกบ้านที่ต้องการจัดรูปปกหรือรูปการ์ด
            </p>
          </div>
          <div className="flex flex-wrap gap-2 lg:justify-end">
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
            className={
              !isLoading && houses.length === 0
                ? "flex h-full min-h-0 items-center justify-center overflow-y-auto rounded-xl border border-[var(--site-border)] bg-[var(--site-surface-soft)] p-2"
                : "grid min-h-0 grid-cols-2 auto-rows-max content-start gap-2 overflow-y-auto pr-1 sm:grid-cols-1"
            }
            data-villa-card-house-card-list
            data-villa-card-house-list
          >
            {isLoading ? (
              <VillaCardHouseListSkeleton />
            ) : houses.length === 0 ? (
              <div
                className="flex flex-col items-center gap-3 px-4 py-10 text-center text-sm text-[var(--site-muted)]"
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
                const customConfig = configsByHouseId.get(house.id);
                const hasCustom = Boolean(
                  customConfig?.coverImage || customConfig?.imageIds.length,
                );
                const houseCoverImage =
                  customConfig?.coverImage?.url ?? house.coverImage;

                return (
                  <Link
                    className="grid min-w-0 gap-3 rounded-xl border border-[var(--site-border)] bg-[var(--site-surface-soft)] p-3 text-left transition hover:border-[var(--site-border-strong)] sm:flex sm:items-center sm:p-2"
                    data-villa-card-house-option={house.id}
                    href={getHouseDetailHref(house.id, housePage, houseSearch)}
                    key={house.id}
                    prefetch={false}
                  >
                    <span
                      className="relative block h-24 w-full shrink-0 overflow-hidden rounded-lg bg-[var(--site-surface-tint)] sm:h-14 sm:w-20"
                      data-villa-card-house-thumb
                    >
                      {houseCoverImage ? (
                        <Image
                          alt=""
                          className="object-cover"
                          fill
                          loading="lazy"
                          quality={50}
                          sizes="80px"
                          src={houseCoverImage}
                        />
                      ) : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-[var(--site-text)]">
                        {house.title}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-[var(--site-muted)]">
                        DV-{house.id} · {house.zoneLabel}
                      </span>
                    </span>
                    {hasCustom ? (
                      <span className="shrink-0 rounded-full bg-[var(--site-primary)] px-2 py-0.5 text-xs font-bold text-[var(--site-on-primary)]">
                        ตั้งค่าแล้ว
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
                  disabled={isLoading || currentHousePage <= 1}
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
                      } disabled:cursor-not-allowed disabled:opacity-40`}
                      data-villa-card-house-page-button={pageNumber}
                      disabled={isLoading || isCurrentPage}
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
                  disabled={isLoading || currentHousePage >= housePageCount}
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

interface AdminVillaCardHouseCustomPageProps {
  houseId: string;
  returnPage?: string;
  returnSearch?: string;
}

export function AdminVillaCardHouseCustomPage({
  houseId,
  returnPage,
  returnSearch,
}: AdminVillaCardHouseCustomPageProps) {
  const [selectedImageIds, setSelectedImageIds] = useState<number[]>([]);
  const houseListHref = getHouseListHref(
    parseHousePage(returnPage),
    returnSearch ?? "",
  );
  const handleConfigsLoaded = useCallback(
    (nextConfigs: AdminVillaCardImageConfig[]) => {
      setSelectedImageIds(
        nextConfigs.find((item) => item.houseId === houseId)?.imageIds ?? [],
      );
    },
    [houseId],
  );
  const {
    configs,
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
  const [isSavingCover, setIsSavingCover] = useState(false);
  const [isLoadingImages, setIsLoadingImages] = useState(false);
  const [selectedZone, setSelectedZone] = useState(ALL_ZONE_KEY);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [isDeleteCoverDialogOpen, setIsDeleteCoverDialogOpen] = useState(false);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const coverPreviewUrlRef = useRef<string | null>(null);
  const draggedSelectedImageIdRef = useRef<number | null>(null);
  const sortDialogInitialImageIdsRef = useRef<number[]>([]);
  const activeZoneButtonRef = useRef<HTMLButtonElement | null>(null);
  const [images, setImages] = useState<PublicVillaImage[]>([]);
  const currentConfig = useMemo(
    () => configs.find((config) => config.houseId === houseId) ?? null,
    [configs, houseId],
  );
  const selectedHouse =
    houses.find((house) => house.id === houseId) ??
    ({
      coverImage: null,
      id: houseId,
      title: `บ้าน ${houseId}`,
      zoneLabel: "",
    } satisfies AdminVillaCardHouseOption);
  const savedCoverImage = currentConfig?.coverImage ?? null;
  const coverPreviewSrc =
    coverPreviewUrl ?? savedCoverImage?.url ?? selectedHouse.coverImage;
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
      ...sortImageZoneKeys([...counts.keys()]).map((zone) => ({
        count: counts.get(zone) ?? 0,
        zone,
      })),
      { count: images.length, zone: ALL_ZONE_KEY },
    ];
  }, [images]);
  const visibleImages = useMemo(
    () =>
      selectedZone === ALL_ZONE_KEY
        ? images
        : images.filter((image) => getImageZoneKey(image) === selectedZone),
    [images, selectedZone],
  );

  useEffect(
    () => () => {
      const previewUrl = coverPreviewUrlRef.current;

      if (previewUrl && typeof URL.revokeObjectURL === "function") {
        URL.revokeObjectURL(previewUrl);
      }

      coverPreviewUrlRef.current = null;
    },
    [],
  );

  useEffect(() => {
    if (!isConfirmDialogOpen && !isDeleteCoverDialogOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isConfirmDialogOpen, isDeleteCoverDialogOpen]);

  useEffect(() => {
    const button = activeZoneButtonRef.current;

    if (!button) {
      return;
    }

    const container = button.parentElement;

    if (!container || !("scrollLeft" in container)) {
      return;
    }

    // On mobile the zone nav is a horizontal scroll strip. Move the selected
    // zone to the start so it stays visible without changing the sort order.
    container.scrollLeft = button.offsetLeft - container.offsetLeft;
  }, [selectedZone, imageZoneOptions.length]);

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

        const usableImages = payload.images.filter(isUsableImage);
        setImages(usableImages);
        setSelectedZone(getInitialImageZone(usableImages));
      } catch {
        setErrors(["ไม่สามารถโหลดรูปบ้านนี้ได้"]);
      } finally {
        setIsLoadingImages(false);
      }
    }

    void loadHouseImages();
  }, [houseId, setErrors]);

  function replaceCoverFile(nextFile: File | null) {
    const previousPreviewUrl = coverPreviewUrlRef.current;

    if (previousPreviewUrl && typeof URL.revokeObjectURL === "function") {
      URL.revokeObjectURL(previousPreviewUrl);
    }

    coverPreviewUrlRef.current = null;
    setCoverFile(nextFile);

    if (nextFile && typeof URL.createObjectURL === "function") {
      const previewUrl = URL.createObjectURL(nextFile);
      coverPreviewUrlRef.current = previewUrl;
      setCoverPreviewUrl(previewUrl);
      return;
    }

    setCoverPreviewUrl(null);
  }

  function handleCoverFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;

    setNotice(null);

    if (!file) {
      replaceCoverFile(null);
      return;
    }

    if (!isAllowedVillaCoverFile(file)) {
      replaceCoverFile(null);
      event.target.value = "";
      setErrors(["รองรับไฟล์รูปปก JPG, PNG หรือ WebP เท่านั้น"]);
      return;
    }

    if (file.size > VILLA_COVER_UPLOAD_MAX_BYTES) {
      replaceCoverFile(null);
      event.target.value = "";
      setErrors(["รูปปกต้องมีขนาดไม่เกิน 6MB"]);
      return;
    }

    setErrors([]);
    replaceCoverFile(file);
    void saveCoverImage(file);
  }

  async function saveCoverImage(file: File) {
    const token = await getAccessToken();

    if (!token) {
      return;
    }

    setIsSavingCover(true);
    setErrors([]);
    setNotice(null);

    try {
      const formData = new FormData();
      formData.set("houseId", houseId);
      formData.set("coverImageAlt", selectedHouse.title || `Villa ${houseId}`);
      formData.set("coverImage", file);

      const response = await fetch("/api/admin/villa-card-images", {
        body: formData,
        headers: { Authorization: `Bearer ${token}` },
        method: "PUT",
      });
      const payload =
        (await readJsonPayload(response)) as AdminVillaCardImageSaveResponse | null;

      if (shouldRedirectToLogin(response.status, payload)) {
        redirectToLogin();
        return;
      }

      if (!response.ok || !payload?.config) {
        setErrors(extractAdminErrors(payload, "ไม่สามารถบันทึกรูปปกบ้านได้"));
        return;
      }

      const savedConfig = payload.config;

      setConfigs((currentConfigs) => [
        ...currentConfigs.filter((config) => config.houseId !== savedConfig.houseId),
        savedConfig,
      ]);
      replaceCoverFile(null);

      setNotice("บันทึกรูปปกบ้านแล้ว");
    } catch {
      setErrors(["ไม่สามารถบันทึกรูปปกบ้านได้"]);
    } finally {
      if (coverInputRef.current) {
        coverInputRef.current.value = "";
      }

      setIsSavingCover(false);
    }
  }

  async function deleteCoverImage() {
    if (!savedCoverImage) {
      setIsDeleteCoverDialogOpen(false);
      return;
    }

    const token = await getAccessToken();

    if (!token) {
      return;
    }

    setIsDeleteCoverDialogOpen(false);
    setIsSavingCover(true);
    setErrors([]);
    setNotice(null);

    try {
      const response = await fetch(
        `/api/admin/villa-card-images?houseId=${encodeURIComponent(houseId)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          method: "DELETE",
        },
      );
      const payload =
        (await readJsonPayload(response)) as AdminVillaCardImageSaveResponse | null;

      if (shouldRedirectToLogin(response.status, payload)) {
        redirectToLogin();
        return;
      }

      if (!response.ok || !payload?.config) {
        setErrors(extractAdminErrors(payload, "ไม่สามารถลบรูปปกบ้านได้"));
        return;
      }

      const savedConfig = payload.config;

      setConfigs((currentConfigs) => [
        ...currentConfigs.filter((config) => config.houseId !== savedConfig.houseId),
        savedConfig,
      ]);
      replaceCoverFile(null);

      if (coverInputRef.current) {
        coverInputRef.current.value = "";
      }

      setNotice("ลบรูปปกที่อัพโหลดแล้ว กลับไปใช้รูปเดิม");
    } catch {
      setErrors(["ไม่สามารถลบรูปปกบ้านได้"]);
    } finally {
      setIsSavingCover(false);
    }
  }

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

  function openSortDialog() {
    if (selectedImageIds.length < 3) {
      setErrors(["ควรมีอย่างน้อย 3 รูป"]);
      setNotice(null);
      return;
    }

    setErrors([]);
    setNotice(null);
    sortDialogInitialImageIdsRef.current = [...selectedImageIds];
    setIsConfirmDialogOpen(true);
  }

  function cancelSortDialog() {
    setSelectedImageIds(sortDialogInitialImageIdsRef.current);
    setIsConfirmDialogOpen(false);
  }

  function requestSaveConfig() {
    if (selectedImageIds.length < 3) {
      setErrors(["ควรมีอย่างน้อย 3 รูป"]);
      setNotice(null);
      return;
    }

    void saveConfig();
  }

  async function saveConfig() {
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
        setErrors(extractAdminErrors(payload, "ไม่สามารถบันทึกรูปการ์ดได้"));
        return;
      }

      const savedConfig = payload.config;

      setConfigs((currentConfigs) => [
        ...currentConfigs.filter((config) => config.houseId !== savedConfig.houseId),
        savedConfig,
      ]);
      setIsConfirmDialogOpen(false);
      setNotice("บันทึกรูปการ์ดแล้ว");
    } catch {
      setErrors(["ไม่สามารถบันทึกรูปการ์ดได้"]);
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
              data-villa-card-back-link
              href={houseListHref}
              prefetch={false}
            >
              <ArrowLeft className="h-4 w-4" />
              กลับไปรายการบ้าน
            </Link>
            <h1 className="text-2xl font-bold text-[var(--site-text)]">
              จัดเรียงรูปบ้านพัก {selectedHouse.title}
            </h1>
            <p className="mt-1 text-sm text-[var(--site-muted)]">
              DV-{selectedHouse.id}
              {selectedHouse.zoneLabel ? ` · ${selectedHouse.zoneLabel}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 lg:justify-end">
            <button
              type="button"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-md border border-[var(--site-border-strong)] bg-[var(--site-surface)] px-5 text-sm font-semibold text-[var(--site-primary)] shadow-sm transition hover:bg-[var(--site-primary-soft)] disabled:cursor-not-allowed disabled:opacity-40"
              data-villa-card-sort-images
              disabled={
                isSavingCover ||
                isSaving ||
                isLoading ||
                isLoadingImages ||
                selectedImageIds.length < 1
              }
              onClick={() => {
                openSortDialog();
              }}
            >
              <ArrowDownUp className="h-4 w-4" />
              เรียงรูป
            </button>
            <button
              type="button"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-[var(--site-primary)] px-6 text-sm font-semibold text-[var(--site-on-primary)] shadow-lg shadow-[var(--site-primary)]/20 transition hover:bg-[var(--site-primary-hover)] disabled:cursor-not-allowed disabled:bg-[var(--site-border-strong)] disabled:text-[var(--site-on-primary)]/80 disabled:shadow-none"
              data-villa-card-save-custom
              disabled={isSavingCover || isSaving || isLoading || isLoadingImages}
              onClick={() => {
                requestSaveConfig();
              }}
            >
              <Save className="h-4 w-4" />
              {isSaving ? "กำลังบันทึก..." : "บันทึก"}
            </button>
          </div>
        </header>
      </div>

      <div className="mx-auto grid w-full max-w-6xl gap-6">
        <AdminFeedback
          errors={errors}
          errorTitle="ตรวจสอบข้อมูลอีกครั้ง"
          notice={notice}
        />

        <section className="grid gap-4 rounded-2xl border border-[var(--site-border)] bg-[var(--site-surface)] p-4 shadow-sm">
          <div className="grid gap-4 md:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] md:items-start">
            <div
              className="relative aspect-[4/3] min-w-0 overflow-hidden rounded-xl bg-[var(--site-surface-tint)]"
              data-villa-cover-preview
            >
              {coverPreviewSrc ? (
                <Image
                  alt={savedCoverImage?.alt || selectedHouse.title}
                  className="object-cover"
                  fill
                  loading="lazy"
                  quality={70}
                  sizes="(min-width: 768px) 288px, 100vw"
                  src={coverPreviewSrc}
                />
              ) : (
                <span className="grid h-full place-items-center px-4 text-center text-sm font-semibold text-[var(--site-muted)]">
                  ยังไม่มีรูปปก
                </span>
              )}
            </div>

            <div className="grid min-w-0 content-start gap-3">
              <div>
                <h2 className="text-base font-bold text-[var(--site-text)]">
                  รูปปกบ้าน
                </h2>
                <p className="mt-1 text-sm text-[var(--site-muted)]">
                  JPG, PNG หรือ WebP สูงสุด 6MB
                </p>
              </div>

              <div className="flex items-center gap-2">
                <label className="inline-flex h-9 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-[var(--site-border-strong)] bg-[var(--site-surface)] px-3 text-xs font-semibold text-[var(--site-primary)] shadow-sm transition hover:bg-[var(--site-primary-soft)]">
                  <Upload className="h-3.5 w-3.5" />
                  อัพโหลดรูปปก
                  <input
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    data-villa-cover-input
                    disabled={isSavingCover || isSaving || isLoading}
                    ref={coverInputRef}
                    type="file"
                    onChange={handleCoverFileChange}
                  />
                </label>
                {savedCoverImage ? (
                  <button
                    className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-3 text-xs font-semibold text-red-700 shadow-sm transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                    data-villa-cover-delete
                    disabled={isSavingCover || isSaving || isLoading}
                    type="button"
                    onClick={() => {
                      setIsDeleteCoverDialogOpen(true);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    ลบรูปที่อัพโหลด
                  </button>
                ) : null}
              </div>

              {coverFile ? (
                <p
                  className="min-w-0 truncate text-sm font-semibold text-[var(--site-text)]"
                  data-villa-cover-file-name
                >
                  {coverFile.name}
                </p>
              ) : null}

              {savedCoverImage ? (
                <p
                  className="text-sm font-semibold text-[var(--site-primary)]"
                  data-villa-cover-current
                >
                  ใช้รูปปกที่อัพโหลดแล้ว
                </p>
              ) : null}
            </div>
          </div>
        </section>

      <section className="grid h-[calc(100dvh-14rem)] min-h-[32rem] min-w-0 grid-rows-[auto_minmax(0,1fr)] gap-4 overflow-hidden rounded-2xl border border-[var(--site-border)] bg-[var(--site-surface)] p-4 shadow-sm">
        {isLoadingImages ? (
          <VillaCardImagePickerSkeleton />
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
                    ref={isActive ? activeZoneButtonRef : undefined}
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
                    className={`grid min-w-0 gap-2 overflow-hidden rounded-xl border p-2 text-left transition ${
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
                    <span
                      className="block min-w-0 truncate text-xs font-semibold text-[var(--site-text)]"
                      data-villa-card-image-name
                    >
                      {image.imageName ?? image.id}
                    </span>
                    <span
                      className="block min-w-0 truncate text-xs text-[var(--site-muted)]"
                      data-villa-card-image-zone
                    >
                      {getZoneLabel(getImageZoneKey(image))}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        </section>
      </div>

      {isDeleteCoverDialogOpen ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-3"
          data-villa-cover-delete-dialog
          role="dialog"
        >
          <div className="grid w-full max-w-md gap-4 rounded-2xl border border-[var(--site-border)] bg-[var(--site-surface)] p-5 shadow-xl">
            <div className="grid gap-2">
              <div className="grid h-11 w-11 place-items-center rounded-full bg-red-50 text-red-600">
                <Trash2 className="h-5 w-5" />
              </div>
              <h2 className="text-lg font-bold text-[var(--site-text)]">
                ลบรูปปกที่อัพโหลด?
              </h2>
              <p className="text-sm leading-6 text-[var(--site-muted)]">
                บ้านนี้จะกลับไปใช้รูปปกเดิมจากระบบ และรูปที่อัพโหลดจะไม่แสดงใน
                Card หรือหน้า Detail
              </p>
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <button
                className="inline-flex h-10 items-center justify-center rounded-xl border border-[var(--site-border)] bg-[var(--site-surface)] px-4 text-sm font-bold text-[var(--site-text)]"
                data-villa-cover-delete-cancel
                disabled={isSavingCover}
                type="button"
                onClick={() => {
                  setIsDeleteCoverDialogOpen(false);
                }}
              >
                ยกเลิก
              </button>
              <button
                className="inline-flex h-10 items-center justify-center rounded-xl bg-red-600 px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
                data-villa-cover-delete-confirm
                disabled={isSavingCover}
                type="button"
                onClick={() => {
                  void deleteCoverImage();
                }}
              >
                {isSavingCover ? "กำลังลบ..." : "ลบรูปปก"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

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
                เรียงลำดับรูป
              </h2>
              <p className="mt-1 text-sm text-[var(--site-muted)]">
                ลากหรือใช้ปุ่มลูกศรจัดลำดับ จากนั้นกด บันทึก
              </p>
            </header>

            <div className="min-h-0 overflow-y-auto p-4">
              <div
                className="grid min-w-0 grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-3"
                data-villa-card-confirm-order={selectedImageIds.join(",")}
              >
                {selectedImages.map((image, index) => (
                  <div
                    className="relative grid min-w-0 cursor-grab gap-2 overflow-hidden rounded-xl border border-[var(--site-border)] bg-[var(--site-surface-soft)] p-2 transition-transform duration-150 ease-out active:cursor-grabbing"
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
                    onDragStart={(event) => {
                      draggedSelectedImageIdRef.current = image.id;
                      const card = event.currentTarget;

                      // Use the whole card as the drag preview so the browser
                      // shows the card, not just the image inside it.
                      if (event.dataTransfer && card) {
                        event.dataTransfer.setDragImage(
                          card,
                          card.offsetWidth / 2,
                          20,
                        );
                      }
                    }}
                  >
                    <button
                      aria-label="เอารูปออก"
                      className="absolute right-2 top-2 z-10 grid h-7 w-7 place-items-center rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] text-[var(--site-muted)] shadow-sm transition hover:border-red-300 hover:bg-red-50 hover:text-red-600"
                      data-villa-card-confirm-remove
                      type="button"
                      onClick={() => {
                        toggleImage(image.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
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
                      <p
                        className="truncate text-xs text-[var(--site-muted)]"
                        data-villa-card-confirm-image-name
                      >
                        {image.imageName ?? image.id}
                      </p>
                      <p
                        className="truncate text-xs text-[var(--site-muted)]"
                        data-villa-card-confirm-image-zone
                      >
                        {getZoneLabel(getImageZoneKey(image))}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      <button
                        aria-label="เลื่อนไปซ้าย"
                        className="grid h-8 place-items-center rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] transition disabled:opacity-40"
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
                        aria-label="เลื่อนไปขวา"
                        className="grid h-8 place-items-center rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] transition disabled:opacity-40"
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
                className="inline-flex h-10 items-center justify-center rounded-xl border border-[var(--site-border)] bg-[var(--site-surface)] px-4 text-sm font-bold text-[var(--site-text)]"
                data-villa-card-confirm-cancel
                disabled={isSaving}
                type="button"
                onClick={cancelSortDialog}
              >
                ยกเลิก
              </button>
              <button
                className="inline-flex h-10 items-center justify-center rounded-xl bg-[var(--site-primary)] px-4 text-sm font-bold text-[var(--site-on-primary)]"
                data-villa-card-confirm-done
                disabled={isSaving}
                type="button"
                onClick={() => {
                  void saveConfig();
                }}
              >
                {isSaving ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </footer>
          </div>
        </div>
      ) : null}
    </div>
  );
}
