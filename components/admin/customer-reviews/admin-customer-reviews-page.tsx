"use client";

import Cropper, { type Area, type Point } from "react-easy-crop";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Crop,
  Eye,
  GripVertical,
  ImagePlus,
  Images,
  Pencil,
  Save,
  Search,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  type DragEvent,
  type ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  extractAdminErrors,
  readJsonPayload,
  shouldRedirectToLogin,
} from "@/components/admin/admin-api-client";
import { readAdminAccessToken } from "@/components/admin/admin-auth";
import { getAdminErrorMessage } from "@/components/admin/admin-error-messages";
import { AdminFeedback } from "@/components/admin/admin-feedback";
import { CspSafeImage as PreviewImage } from "@/components/ui/csp-safe-image";
import {
  CUSTOMER_REVIEW_HOMEPAGE_LAYOUTS,
  type CustomerReviewHomepageLayout,
  DEFAULT_CUSTOMER_REVIEW_HOMEPAGE_LAYOUT,
  type AdminCustomerReviewImage,
  type HomepageCustomerReviewData,
} from "@/lib/customer-reviews/types";
import { CustomerReviewSection } from "@/components/villas/home/customer-review-section";
import { createBrowserHomeConfigClient } from "@/lib/home-sections/supabase";

interface AdminCustomerReviewsResponse {
  images?: AdminCustomerReviewImage[];
  layout?: CustomerReviewHomepageLayout;
  queueImageIds?: string[];
}

interface AdminCustomerReviewUploadResponse {
  image?: AdminCustomerReviewImage;
}

interface AdminCustomerReviewSaveResponse {
  layout?: CustomerReviewHomepageLayout;
  queueImageIds?: string[];
}

interface AdminCustomerReviewUpdateResponse {
  image?: AdminCustomerReviewImage;
  warning?: string | null;
}

interface AdminCustomerReviewDeleteResponse {
  deletedImageId?: string;
  deletedImageIds?: string[];
  warning?: string | null;
  warnings?: string[];
}

const REVIEW_UPLOAD_MAX_BYTES = 6 * 1024 * 1024;
const REVIEW_UPLOAD_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const REVIEW_UPLOAD_EXTENSIONS = new Set(["jpeg", "jpg", "png", "webp"]);
const REVIEW_EXPORT_MIME_TYPE = "image/webp";
const LAYOUT_OPTIONS: Array<{
  description: string;
  label: string;
  value: CustomerReviewHomepageLayout;
}> = [
  {
    description: "รูปเด่นใหญ่และแถวรูปย่อย",
    label: "แถบเด่น",
    value: "featured_rail",
  },
  {
    description: "กริดหลายขนาด เห็นหลายรีวิวพร้อมกัน",
    label: "ผนังรีวิว",
    value: "proof_wall",
  },
  {
    description: "เลื่อนดูทีละรูป เหมาะกับมือถือ",
    label: "สไลด์",
    value: "carousel",
  },
];
const CROP_ASPECT_OPTIONS = [
  { label: "ตั้ง", value: 4 / 5 },
  { label: "จัตุรัส", value: 1 },
  { label: "กว้าง", value: 4 / 3 },
];

function isSupportedLayout(value: unknown): value is CustomerReviewHomepageLayout {
  return (
    typeof value === "string" &&
    CUSTOMER_REVIEW_HOMEPAGE_LAYOUTS.includes(
      value as CustomerReviewHomepageLayout,
    )
  );
}

function makeCustomerReviewSnapshot(
  layout: CustomerReviewHomepageLayout,
  imageIds: string[],
) {
  return JSON.stringify({ imageIds, layout });
}

function moveItem<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= items.length ||
    toIndex >= items.length ||
    fromIndex === toIndex
  ) {
    return items;
  }

  const nextItems = [...items];
  const [removed] = nextItems.splice(fromIndex, 1);
  nextItems.splice(toIndex, 0, removed);
  return nextItems;
}

function getFileExtension(fileName: string): string {
  return fileName.trim().split(".").pop()?.toLowerCase() ?? "";
}

function validateReviewImageFile(file: File): string[] {
  const errors: string[] = [];
  const extension = getFileExtension(file.name);

  if (!REVIEW_UPLOAD_TYPES.has(file.type)) {
    errors.push(`${file.name}: รองรับเฉพาะ JPG, PNG หรือ WebP`);
  }

  if (!REVIEW_UPLOAD_EXTENSIONS.has(extension)) {
    errors.push(`${file.name}: นามสกุลไฟล์ต้องเป็น .jpg, .jpeg, .png หรือ .webp`);
  }

  if (file.size > REVIEW_UPLOAD_MAX_BYTES) {
    errors.push(`${file.name}: ไฟล์ต้องไม่เกิน 6MB`);
  }

  return errors;
}

function getCroppedFileName(file: File): string {
  const baseName = file.name.replace(/\.[^.]+$/, "").trim() || "customer-review";

  return `${baseName}-cropped.webp`;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new window.Image();

    image.onload = () => {
      resolve(image);
    };
    image.onerror = () => {
      reject(new Error("Unable to load image for cropping."));
    };
    image.src = src;
  });
}

async function cropImageFile({
  area,
  file,
  imageSrc,
}: {
  area: Area;
  file: File;
  imageSrc: string;
}): Promise<File> {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Browser does not support image cropping.");
  }

  canvas.width = Math.max(1, Math.round(area.width));
  canvas.height = Math.max(1, Math.round(area.height));
  context.drawImage(
    image,
    area.x,
    area.y,
    area.width,
    area.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, REVIEW_EXPORT_MIME_TYPE, 0.9);
  });

  if (!blob || blob.type !== REVIEW_EXPORT_MIME_TYPE) {
    throw new Error("Browser does not support WebP image export.");
  }

  return new File([blob], getCroppedFileName(file), {
    type: REVIEW_EXPORT_MIME_TYPE,
  });
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

function CustomerReviewSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)_320px]">
      {Array.from({ length: 3 }, (_, index) => (
        <div
          aria-hidden="true"
          className="grid content-start gap-3 rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] p-4"
          key={index}
        >
          <span className="h-4 w-32 animate-pulse rounded-full bg-[var(--site-border)]" />
          <span className="h-3 w-48 max-w-full animate-pulse rounded-full bg-[var(--site-surface-tint)]" />
          <span className="h-40 animate-pulse rounded-md bg-[var(--site-surface-tint)]" />
        </div>
      ))}
    </div>
  );
}

function LayoutMiniPreview({
  images,
  value,
}: {
  images: AdminCustomerReviewImage[];
  value: CustomerReviewHomepageLayout;
}) {
  const previewImages = images.slice(0, 5);

  if (previewImages.length === 0) {
    return (
      <div className="grid h-20 grid-cols-4 gap-1">
        {Array.from({ length: value === "carousel" ? 3 : 5 }, (_, index) => (
          <span
            className="rounded bg-[var(--site-surface-tint)]"
            key={index}
          />
        ))}
      </div>
    );
  }

  if (value === "carousel") {
    return (
      <div className="grid h-20 grid-cols-[1fr_2fr_1fr] gap-1 overflow-hidden">
        {previewImages.slice(0, 3).map((image, index) => (
          <span
            className={`relative overflow-hidden rounded bg-[var(--site-surface-tint)] ${
              index === 1 ? "scale-100" : "scale-90 opacity-60"
            }`}
            key={image.id}
          >
            <PreviewImage
              alt=""
              className="object-cover"
              fill
              loading="lazy"
              sizes="80px"
              src={image.url}
            />
          </span>
        ))}
      </div>
    );
  }

  if (value === "featured_rail") {
    return (
      <div className="grid h-20 grid-cols-[1.5fr_1fr] gap-1 overflow-hidden">
        <span className="relative overflow-hidden rounded bg-[var(--site-surface-tint)]">
          <PreviewImage
            alt=""
            className="object-cover"
            fill
            loading="lazy"
            sizes="120px"
            src={previewImages[0].url}
          />
        </span>
        <span className="grid gap-1">
          {previewImages.slice(1, 4).map((image) => (
            <span
              className="relative overflow-hidden rounded bg-[var(--site-surface-tint)]"
              key={image.id}
            >
              <PreviewImage
                alt=""
                className="object-cover"
                fill
                loading="lazy"
                sizes="80px"
                src={image.url}
              />
            </span>
          ))}
        </span>
      </div>
    );
  }

  return (
    <div className="grid h-20 grid-cols-4 grid-rows-2 gap-1 overflow-hidden">
      {previewImages.map((image, index) => (
        <span
          className={`relative overflow-hidden rounded bg-[var(--site-surface-tint)] ${
            index === 0 ? "col-span-2 row-span-2" : ""
          }`}
          key={image.id}
        >
          <PreviewImage
            alt=""
            className="object-cover"
            fill
            loading="lazy"
            sizes="80px"
            src={image.url}
          />
        </span>
      ))}
    </div>
  );
}

function CropDialog({
  aspect,
  crop,
  cropFile,
  cropFileUrl,
  croppedAreaPixels,
  isUploading,
  onAspectChange,
  onCancel,
  onCropChange,
  onCropComplete,
  onUpload,
  onZoomChange,
  pendingCount,
  submitLabel,
  title,
  zoom,
}: {
  aspect: number;
  crop: Point;
  cropFile: File;
  cropFileUrl: string;
  croppedAreaPixels: Area | null;
  isUploading: boolean;
  onAspectChange: (aspect: number) => void;
  onCancel: () => void;
  onCropChange: (crop: Point) => void;
  onCropComplete: (croppedArea: Area, croppedAreaPixels: Area) => void;
  onUpload: () => void;
  onZoomChange: (zoom: number) => void;
  pendingCount: number;
  submitLabel: string;
  title: string;
  zoom: number;
}) {
  return (
    <div
      aria-labelledby="customer-review-crop-title"
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-3"
      role="dialog"
    >
      <div className="grid max-h-[calc(100dvh-1.5rem)] w-full max-w-5xl grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] shadow-xl">
        <header className="flex items-start justify-between gap-3 border-b border-[var(--site-border)] px-4 py-3">
          <div className="min-w-0">
            <h2
              className="text-lg font-bold text-[var(--site-text)]"
              id="customer-review-crop-title"
            >
              {title}
            </h2>
            <p className="mt-1 truncate text-sm text-[var(--site-muted)]">
              {cropFile.name}
            </p>
          </div>
          <button
            aria-label="ปิดหน้าต่าง Crop"
            className="grid size-9 shrink-0 place-items-center rounded-md border border-[var(--site-border)] text-[var(--site-muted)] hover:bg-[var(--site-surface-soft)]"
            disabled={isUploading}
            onClick={onCancel}
            type="button"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </header>

        <div className="grid min-h-0 gap-4 overflow-y-auto p-4 lg:grid-cols-[minmax(0,1fr)_260px]">
          <div className="relative h-[56dvh] min-h-[22rem] overflow-hidden rounded-lg bg-zinc-950">
            <Cropper
              aspect={aspect}
              crop={crop}
              image={cropFileUrl}
              onCropChange={onCropChange}
              onCropComplete={onCropComplete}
              onZoomChange={onZoomChange}
              restrictPosition
              showGrid
              zoom={zoom}
            />
          </div>

          <aside className="grid content-start gap-4">
            <section className="grid gap-3 rounded-lg border border-[var(--site-border)] bg-[var(--site-surface-soft)] p-3">
              <h3 className="text-sm font-bold text-[var(--site-text)]">
                สัดส่วนรูป
              </h3>
              <div className="grid grid-cols-3 gap-2">
                {CROP_ASPECT_OPTIONS.map((option) => {
                  const isActive = option.value === aspect;

                  return (
                    <button
                      className={`h-10 rounded-md border text-sm font-semibold transition ${
                        isActive
                          ? "border-[var(--site-primary)] bg-[var(--site-primary)] text-[var(--site-on-primary)]"
                          : "border-[var(--site-border)] bg-[var(--site-surface)] text-[var(--site-text)]"
                      }`}
                      disabled={isUploading}
                      key={option.label}
                      onClick={() => {
                        onAspectChange(option.value);
                      }}
                      type="button"
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </section>

            <label className="grid gap-2 text-sm font-semibold text-[var(--site-text)]">
              Zoom
              <input
                className="accent-[var(--site-primary)]"
                disabled={isUploading}
                max={3}
                min={1}
                onChange={(event) => {
                  onZoomChange(Number(event.target.value));
                }}
                step={0.05}
                type="range"
                value={zoom}
              />
            </label>

            {pendingCount > 0 ? (
              <p className="rounded-md border border-[var(--site-border)] bg-[var(--site-surface-soft)] px-3 py-2 text-sm text-[var(--site-muted)]">
                เหลือในคิวอัปโหลด {pendingCount.toLocaleString("th-TH")} รูป
              </p>
            ) : null}
          </aside>
        </div>

        <footer className="flex flex-wrap justify-end gap-2 border-t border-[var(--site-border)] px-4 py-3">
          <button
            className="inline-flex h-10 items-center gap-2 rounded-md border border-[var(--site-border)] bg-[var(--site-surface)] px-4 text-sm font-semibold text-[var(--site-text)]"
            disabled={isUploading}
            onClick={onCancel}
            type="button"
          >
            <X aria-hidden="true" className="size-4" />
            ข้ามรูปนี้
          </button>
          <button
            className="inline-flex h-10 items-center gap-2 rounded-md bg-[var(--site-primary)] px-5 text-sm font-semibold text-[var(--site-on-primary)] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isUploading || !croppedAreaPixels}
            onClick={onUpload}
            type="button"
          >
            <Crop aria-hidden="true" className="size-4" />
            {isUploading ? "กำลังอัปโหลด..." : submitLabel}
          </button>
        </footer>
      </div>
    </div>
  );
}

export function AdminCustomerReviewsPage() {
  const { getAccessToken, redirectToLogin } = useAdminToken();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const draggedQueueImageIdRef = useRef<string | null>(null);
  const [images, setImages] = useState<AdminCustomerReviewImage[]>([]);
  const [selectedImageIds, setSelectedImageIds] = useState<string[]>([]);
  const [layout, setLayout] = useState<CustomerReviewHomepageLayout>(
    DEFAULT_CUSTOMER_REVIEW_HOMEPAGE_LAYOUT,
  );
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingImageId, setEditingImageId] = useState<string | null>(null);
  const [altDraft, setAltDraft] = useState("");
  const [busyImageId, setBusyImageId] = useState<string | null>(null);
  const [pendingDeleteImageId, setPendingDeleteImageId] = useState<
    string | null
  >(null);
  const [selectedDeleteImageIds, setSelectedDeleteImageIds] = useState<
    string[]
  >([]);
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isBulkDeleteConfirming, setIsBulkDeleteConfirming] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [cropFileUrl, setCropFileUrl] = useState<string | null>(null);
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [aspect, setAspect] = useState(4 / 5);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const cropFileUrlRef = useRef<string | null>(null);

  const selectedImages = useMemo(
    () =>
      selectedImageIds
        .map((imageId) => images.find((image) => image.id === imageId) ?? null)
        .filter((image): image is AdminCustomerReviewImage => image !== null),
    [images, selectedImageIds],
  );
  const previewCustomerReviews = useMemo<HomepageCustomerReviewData | null>(() => {
    if (selectedImages.length === 0) {
      return null;
    }

    return {
      images: selectedImages.map((image, index) => ({
        alt: image.alt,
        id: image.id,
        order: index + 1,
        url: image.url,
      })),
      layout,
    };
  }, [layout, selectedImages]);
  const filteredImages = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    if (!normalizedSearch) {
      return images;
    }

    return images.filter((image) =>
      `${image.alt} ${image.path}`.toLowerCase().includes(normalizedSearch),
    );
  }, [images, searchQuery]);
  const selectedDeleteImageIdSet = useMemo(
    () => new Set(selectedDeleteImageIds),
    [selectedDeleteImageIds],
  );
  const areFilteredImagesSelectedForDelete =
    filteredImages.length > 0 &&
    filteredImages.every((image) => selectedDeleteImageIdSet.has(image.id));
  const currentSnapshot = useMemo(
    () => makeCustomerReviewSnapshot(layout, selectedImageIds),
    [layout, selectedImageIds],
  );
  const hasUnsavedChanges =
    savedSnapshot !== null && currentSnapshot !== savedSnapshot;

  const loadReviews = useCallback(async () => {
    const token = await getAccessToken();

    if (!token) {
      return;
    }

    setIsLoading(true);
    setErrors([]);
    setNotice(null);

    try {
      const response = await fetch("/api/admin/customer-reviews", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload =
        (await readJsonPayload(response)) as AdminCustomerReviewsResponse | null;

      if (shouldRedirectToLogin(response.status, payload)) {
        redirectToLogin();
        return;
      }

      if (!response.ok || !payload?.images) {
        setErrors(extractAdminErrors(payload, "โหลดรูปรีวิวลูกค้าไม่ได้"));
        return;
      }

      const nextLayout = isSupportedLayout(payload.layout)
        ? payload.layout
        : DEFAULT_CUSTOMER_REVIEW_HOMEPAGE_LAYOUT;
      const nextImageIds = Array.isArray(payload.queueImageIds)
        ? payload.queueImageIds.filter((imageId) =>
            payload.images?.some((image) => image.id === imageId),
          )
        : [];

      setImages(payload.images);
      setLayout(nextLayout);
      setSelectedImageIds(nextImageIds);
      setSavedSnapshot(makeCustomerReviewSnapshot(nextLayout, nextImageIds));
    } catch (caughtError) {
      setErrors([getAdminErrorMessage(caughtError, "โหลดรูปรีวิวลูกค้าไม่ได้")]);
    } finally {
      setIsLoading(false);
    }
  }, [getAccessToken, redirectToLogin]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadReviews();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loadReviews]);

  useEffect(() => {
    return () => {
      if (cropFileUrlRef.current) {
        URL.revokeObjectURL(cropFileUrlRef.current);
        cropFileUrlRef.current = null;
      }
    };
  }, []);

  const setNextCropFile = useCallback((file: File | null) => {
    if (cropFileUrlRef.current) {
      URL.revokeObjectURL(cropFileUrlRef.current);
      cropFileUrlRef.current = null;
    }

    if (!file) {
      setCropFile(null);
      setCropFileUrl(null);
      return;
    }

    const nextObjectUrl = URL.createObjectURL(file);

    cropFileUrlRef.current = nextObjectUrl;
    setCropFile(file);
    setCropFileUrl(nextObjectUrl);
  }, []);

  const enqueueFiles = useCallback(
    (files: File[]) => {
      const nextErrors: string[] = [];
      const acceptedFiles = files.filter((file) => {
        const fileErrors = validateReviewImageFile(file);

        if (fileErrors.length > 0) {
          nextErrors.push(...fileErrors);
          return false;
        }

        return true;
      });

      if (nextErrors.length > 0) {
        setErrors(nextErrors);
      } else {
        setErrors([]);
      }

      if (acceptedFiles.length === 0) {
        return;
      }

      setNotice(
        `เพิ่มเข้าคิว Crop ${acceptedFiles.length.toLocaleString("th-TH")} รูป`,
      );

      if (cropFile) {
        setPendingFiles((currentFiles) => [...currentFiles, ...acceptedFiles]);
        return;
      }

      const [firstFile, ...restFiles] = acceptedFiles;

      setNextCropFile(firstFile);
      setPendingFiles((currentFiles) => [...currentFiles, ...restFiles]);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
    },
    [
      cropFile,
      setCrop,
      setCroppedAreaPixels,
      setErrors,
      setNextCropFile,
      setNotice,
      setPendingFiles,
      setZoom,
    ],
  );

  useEffect(() => {
    function handlePaste(event: ClipboardEvent) {
      const files = Array.from(event.clipboardData?.files ?? []).filter((file) =>
        file.type.startsWith("image/"),
      );

      if (files.length === 0) {
        return;
      }

      enqueueFiles(files);
    }

    window.addEventListener("paste", handlePaste);

    return () => {
      window.removeEventListener("paste", handlePaste);
    };
  }, [enqueueFiles]);

  function openNextCropFile() {
    const [nextFile, ...restFiles] = pendingFiles;

    setPendingFiles(restFiles);
    setNextCropFile(nextFile ?? null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
  }

  function handleFileInputChange(event: ChangeEvent<HTMLInputElement>) {
    enqueueFiles(Array.from(event.currentTarget.files ?? []));
    event.currentTarget.value = "";
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    enqueueFiles(Array.from(event.dataTransfer.files));
  }

  async function uploadCroppedImage() {
    if (!cropFile || !cropFileUrl || !croppedAreaPixels) {
      return;
    }

    setIsUploading(true);
    setErrors([]);
    setNotice(null);

    try {
      const token = await getAccessToken();

      if (!token) {
        return;
      }

      const croppedFile = await cropImageFile({
        area: croppedAreaPixels,
        file: cropFile,
        imageSrc: cropFileUrl,
      });

      const formData = new FormData();

      formData.set("image", croppedFile);
      formData.set("alt", "รีวิวจากลูกค้า");

      const response = await fetch("/api/admin/customer-reviews", {
        body: formData,
        headers: { Authorization: `Bearer ${token}` },
        method: "POST",
      });
      const payload =
        (await readJsonPayload(response)) as AdminCustomerReviewUploadResponse | null;

      if (shouldRedirectToLogin(response.status, payload)) {
        redirectToLogin();
        return;
      }

      if (!response.ok || !payload?.image) {
        setErrors(extractAdminErrors(payload, "อัปโหลดรูปรีวิวไม่ได้"));
        return;
      }

      setImages((currentImages) => [payload.image as AdminCustomerReviewImage, ...currentImages]);
      setNotice("อัปโหลดรูปรีวิวแล้ว");
      openNextCropFile();
    } catch (caughtError) {
      setErrors([getAdminErrorMessage(caughtError, "อัปโหลดรูปรีวิวไม่ได้")]);
    } finally {
      setIsUploading(false);
      setBusyImageId(null);
    }
  }

  function beginAltEdit(image: AdminCustomerReviewImage) {
    setEditingImageId(image.id);
    setAltDraft(image.alt);
    setPendingDeleteImageId(null);
    setErrors([]);
    setNotice(null);
  }

  async function updateReviewImage(
    image: AdminCustomerReviewImage,
    updates: { alt?: string },
    successNotice: string,
  ) {
    const token = await getAccessToken();

    if (!token) {
      return null;
    }

    setBusyImageId(image.id);
    setErrors([]);
    setNotice(null);

    try {
      const response = await fetch("/api/admin/customer-reviews", {
        body: JSON.stringify({
          action: "update-image",
          id: image.id,
          ...updates,
        }),
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        method: "PATCH",
      });
      const payload =
        (await readJsonPayload(response)) as AdminCustomerReviewUpdateResponse | null;

      if (shouldRedirectToLogin(response.status, payload)) {
        redirectToLogin();
        return null;
      }

      if (!response.ok || !payload?.image) {
        setErrors(extractAdminErrors(payload, "บันทึกข้อมูลรูปไม่ได้"));
        return null;
      }

      const nextImage = payload.image;

      setImages((currentImages) =>
        currentImages.map((currentImage) =>
          currentImage.id === nextImage.id ? nextImage : currentImage,
        ),
      );

      setNotice(successNotice);
      return nextImage;
    } catch (caughtError) {
      setErrors([getAdminErrorMessage(caughtError, "บันทึกข้อมูลรูปไม่ได้")]);
      return null;
    } finally {
      setBusyImageId(null);
    }
  }

  async function saveAltEdit(image: AdminCustomerReviewImage) {
    if (altDraft.trim().length > 160) {
      setErrors(["ชื่อ/alt ของรูปต้องไม่เกิน 160 ตัวอักษร"]);
      return;
    }

    const updatedImage = await updateReviewImage(
      image,
      { alt: altDraft },
      "แก้ชื่อรูปแล้ว",
    );

    if (updatedImage) {
      setEditingImageId(null);
      setAltDraft("");
    }
  }

  async function deleteReviewImage(image: AdminCustomerReviewImage) {
    if (pendingDeleteImageId !== image.id) {
      setPendingDeleteImageId(image.id);
      setErrors([]);
      setNotice("กดลบอีกครั้งเพื่อยืนยันการลบรูปนี้");
      return;
    }

    const token = await getAccessToken();

    if (!token) {
      return;
    }

    const wasUnsaved = hasUnsavedChanges;
    const nextSelectedImageIds = selectedImageIds.filter(
      (selectedImageId) => selectedImageId !== image.id,
    );

    setBusyImageId(image.id);
    setErrors([]);
    setNotice(null);

    try {
      const response = await fetch(
        `/api/admin/customer-reviews?id=${encodeURIComponent(image.id)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          method: "DELETE",
        },
      );
      const payload =
        (await readJsonPayload(response)) as AdminCustomerReviewDeleteResponse | null;

      if (shouldRedirectToLogin(response.status, payload)) {
        redirectToLogin();
        return;
      }

      if (!response.ok || payload?.deletedImageId !== image.id) {
        setErrors(extractAdminErrors(payload, "ลบรูปไม่ได้"));
        return;
      }

      setImages((currentImages) =>
        currentImages.filter((currentImage) => currentImage.id !== image.id),
      );
      setSelectedImageIds(nextSelectedImageIds);
      setSelectedDeleteImageIds((currentIds) =>
        currentIds.filter((currentId) => currentId !== image.id),
      );

      if (!wasUnsaved) {
        setSavedSnapshot(makeCustomerReviewSnapshot(layout, nextSelectedImageIds));
      }

      if (editingImageId === image.id) {
        setEditingImageId(null);
        setAltDraft("");
      }

      setPendingDeleteImageId(null);
      setIsBulkDeleteConfirming(false);
      setNotice(
        payload.warning
          ? `ลบรูปแล้ว แต่ cleanup ไฟล์มีคำเตือน: ${payload.warning}`
          : "ลบรูปแล้ว",
      );
    } catch (caughtError) {
      setErrors([getAdminErrorMessage(caughtError, "ลบรูปไม่ได้")]);
    } finally {
      setBusyImageId(null);
    }
  }

  function toggleDeleteMode() {
    setErrors([]);
    setNotice(null);
    setPendingDeleteImageId(null);
    setEditingImageId(null);
    setAltDraft("");
    draggedQueueImageIdRef.current = null;
    setIsDeleteMode((currentMode) => {
      if (currentMode) {
        setSelectedDeleteImageIds([]);
        setIsBulkDeleteConfirming(false);
      }

      return !currentMode;
    });
  }

  function toggleDeleteImageSelection(imageId: string) {
    if (!isDeleteMode) {
      return;
    }

    setErrors([]);
    setNotice(null);
    setPendingDeleteImageId(null);
    setIsBulkDeleteConfirming(false);
    setSelectedDeleteImageIds((currentIds) =>
      currentIds.includes(imageId)
        ? currentIds.filter((currentId) => currentId !== imageId)
        : [...currentIds, imageId],
    );
  }

  function toggleFilteredDeleteSelection() {
    const filteredImageIds = filteredImages.map((image) => image.id);

    if (filteredImageIds.length === 0) {
      return;
    }

    setErrors([]);
    setNotice(null);
    setPendingDeleteImageId(null);
    setIsBulkDeleteConfirming(false);
    setSelectedDeleteImageIds((currentIds) => {
      const filteredIdSet = new Set(filteredImageIds);
      const allFilteredSelected = filteredImageIds.every((imageId) =>
        currentIds.includes(imageId),
      );

      if (allFilteredSelected) {
        return currentIds.filter((imageId) => !filteredIdSet.has(imageId));
      }

      return [...new Set([...currentIds, ...filteredImageIds])];
    });
  }

  function clearDeleteSelection() {
    setSelectedDeleteImageIds([]);
    setIsBulkDeleteConfirming(false);
    setErrors([]);
    setNotice(null);
  }

  async function deleteSelectedReviewImages() {
    const imageIds = selectedDeleteImageIds.filter((imageId) =>
      images.some((image) => image.id === imageId),
    );

    if (imageIds.length === 0) {
      clearDeleteSelection();
      return;
    }

    if (!isBulkDeleteConfirming) {
      setErrors([]);
      setNotice(
        `กดลบที่เลือกอีกครั้งเพื่อยืนยันการลบ ${imageIds.length.toLocaleString(
          "th-TH",
        )} รูป`,
      );
      setIsBulkDeleteConfirming(true);
      return;
    }

    const token = await getAccessToken();

    if (!token) {
      return;
    }

    const wasUnsaved = hasUnsavedChanges;

    setIsBulkDeleting(true);
    setErrors([]);
    setNotice(null);

    try {
      const response = await fetch(
        `/api/admin/customer-reviews?ids=${imageIds
          .map((imageId) => encodeURIComponent(imageId))
          .join(",")}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          method: "DELETE",
        },
      );
      const payload =
        (await readJsonPayload(response)) as AdminCustomerReviewDeleteResponse | null;
      const deletedImageIds =
        payload?.deletedImageIds ?? (payload?.deletedImageId ? [payload.deletedImageId] : []);

      if (shouldRedirectToLogin(response.status, payload)) {
        redirectToLogin();
        return;
      }

      if (!response.ok || deletedImageIds.length === 0) {
        setErrors(extractAdminErrors(payload, "ลบรูปที่เลือกไม่ได้"));
        return;
      }

      const deletedImageIdSet = new Set(deletedImageIds);
      const nextSelectedImageIds = selectedImageIds.filter(
        (imageId) => !deletedImageIdSet.has(imageId),
      );

      setImages((currentImages) =>
        currentImages.filter((image) => !deletedImageIdSet.has(image.id)),
      );
      setSelectedImageIds(nextSelectedImageIds);
      setSelectedDeleteImageIds((currentIds) =>
        currentIds.filter((imageId) => !deletedImageIdSet.has(imageId)),
      );

      if (!wasUnsaved) {
        setSavedSnapshot(makeCustomerReviewSnapshot(layout, nextSelectedImageIds));
      }

      if (editingImageId && deletedImageIdSet.has(editingImageId)) {
        setEditingImageId(null);
        setAltDraft("");
      }

      if (pendingDeleteImageId && deletedImageIdSet.has(pendingDeleteImageId)) {
        setPendingDeleteImageId(null);
      }

      setIsBulkDeleteConfirming(false);
      setIsDeleteMode(false);

      const warnings = payload?.warnings ?? (payload?.warning ? [payload.warning] : []);
      setNotice(
        warnings.length > 0
          ? `ลบรูป ${deletedImageIds.length.toLocaleString(
              "th-TH",
            )} รูปแล้ว แต่ cleanup ไฟล์มีคำเตือน: ${warnings.join("; ")}`
          : `ลบรูป ${deletedImageIds.length.toLocaleString("th-TH")} รูปแล้ว`,
      );
    } catch (caughtError) {
      setErrors([getAdminErrorMessage(caughtError, "ลบรูปที่เลือกไม่ได้")]);
    } finally {
      setIsBulkDeleting(false);
    }
  }

  function toggleImage(imageId: string) {
    setErrors([]);
    setNotice(null);

    const image = images.find((currentImage) => currentImage.id === imageId);

    if (!image?.isActive) {
      setErrors(["เปิดใช้งานรูปก่อนเลือกขึ้นหน้าแรก"]);
      return;
    }

    if (!selectedImageIds.includes(imageId) && selectedImageIds.length >= 20) {
      setErrors(["เลือกแสดงหน้าแรกได้สูงสุด 20 รูป"]);
      return;
    }

    setSelectedImageIds((currentIds) => {
      if (currentIds.includes(imageId)) {
        return currentIds.filter((id) => id !== imageId);
      }

      return [...currentIds, imageId];
    });
  }

  function moveSelectedImage(fromIndex: number, toIndex: number) {
    setSelectedImageIds((currentIds) => moveItem(currentIds, fromIndex, toIndex));
  }

  function moveSelectedImageById(sourceId: string, targetId: string) {
    setSelectedImageIds((currentIds) =>
      moveItem(
        currentIds,
        currentIds.indexOf(sourceId),
        currentIds.indexOf(targetId),
      ),
    );
  }

  async function saveHomepageQueue() {
    const token = await getAccessToken();

    if (!token) {
      return;
    }

    setIsSaving(true);
    setErrors([]);
    setNotice(null);

    try {
      const response = await fetch("/api/admin/customer-reviews", {
        body: JSON.stringify({ imageIds: selectedImageIds, layout }),
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        method: "PATCH",
      });
      const payload =
        (await readJsonPayload(response)) as AdminCustomerReviewSaveResponse | null;

      if (shouldRedirectToLogin(response.status, payload)) {
        redirectToLogin();
        return;
      }

      if (!response.ok || !payload?.queueImageIds || !payload.layout) {
        setErrors(extractAdminErrors(payload, "บันทึกคิวรูปหน้าแรกไม่ได้"));
        return;
      }

      setImages((currentImages) =>
        currentImages.map((image) => {
          const order = payload.queueImageIds?.indexOf(image.id) ?? -1;

          return {
            ...image,
            homepageOrder: order >= 0 ? order + 1 : null,
            isHomepage: order >= 0,
          };
        }),
      );
      setSelectedImageIds(payload.queueImageIds);
      setLayout(payload.layout);
      setSavedSnapshot(
        makeCustomerReviewSnapshot(payload.layout, payload.queueImageIds),
      );
      setNotice("บันทึกคิวรูปรีวิวหน้าแรกแล้ว");
    } catch (caughtError) {
      setErrors([
        getAdminErrorMessage(caughtError, "บันทึกคิวรูปหน้าแรกไม่ได้"),
      ]);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex w-full flex-col gap-6 text-[var(--site-text)]">
      <div className="sticky top-[73px] z-20 -mx-4 -mt-4 border-b border-[var(--site-border)] bg-[var(--site-background)]/90 px-4 pb-4 pt-4 backdrop-blur-xl lg:top-0 lg:z-30 lg:-mx-6 lg:-mt-6 lg:px-6 lg:pt-6">
        <header className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="hidden min-w-0 lg:block">
            <p className="text-xs font-bold uppercase text-[var(--site-primary)]">
              Customer reviews
            </p>
            <h1 className="mt-2 text-3xl font-bold text-[var(--site-text)]">
              รูปเครดิตและรีวิวลูกค้า
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--site-muted)]">
              จัดคลังรูปแชทและสลิป เลือกรูปหน้าแรกได้สูงสุด 20 รูป พร้อมเลือกรูปแบบการแสดงผล
            </p>
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
              disabled={isSaving || isLoading || !hasUnsavedChanges}
              onClick={() => {
                void saveHomepageQueue();
              }}
              type="button"
            >
              <Save aria-hidden="true" className="size-4" />
              {isSaving ? "กำลังบันทึก..." : "บันทึกหน้าแรก"}
            </button>
          </div>
        </header>
      </div>

      <AdminFeedback
        errors={errors}
        errorTitle="ตรวจสอบอีกครั้ง:"
        notice={notice}
      />

      {isLoading ? (
        <CustomerReviewSkeleton />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)_320px]">
          <aside className="grid content-start gap-4">
            <section
              className="grid gap-4 rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] p-4 shadow-sm"
              onDragOver={(event) => {
                event.preventDefault();
              }}
              onDrop={handleDrop}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-[var(--site-text)]">
                    อัปโหลดรูป
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-[var(--site-muted)]">
                    JPG, PNG หรือ WebP สูงสุด 6MB ต่อรูป ระบบจะแปลงเป็น WebP หลัง Crop
                  </p>
                </div>
                <ImagePlus
                  aria-hidden="true"
                  className="size-5 text-[var(--site-primary)]"
                />
              </div>

              <button
                className="grid min-h-36 place-items-center rounded-lg border border-dashed border-[var(--site-border-strong)] bg-[var(--site-surface-soft)] px-4 py-6 text-center transition hover:border-[var(--site-primary)] hover:bg-[var(--site-primary-soft)]"
                onClick={() => {
                  fileInputRef.current?.click();
                }}
                type="button"
              >
                <span className="grid gap-2">
                  <span className="mx-auto grid size-11 place-items-center rounded-md bg-[var(--site-primary)] text-[var(--site-on-primary)]">
                    <UploadCloud aria-hidden="true" className="size-5" />
                  </span>
                  <span className="text-sm font-bold text-[var(--site-text)]">
                    เลือกไฟล์ / วางรูป / ลากไฟล์
                  </span>
                </span>
              </button>
              <input
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                multiple
                onChange={handleFileInputChange}
                ref={fileInputRef}
                type="file"
              />
            </section>

            <section className="grid gap-3 rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] p-4 shadow-sm">
              <h2 className="text-base font-bold text-[var(--site-text)]">
                รูปแบบหน้าแรก
              </h2>
              <div className="grid gap-2">
                {LAYOUT_OPTIONS.map((option) => {
                  const isSelected = layout === option.value;

                  return (
                    <button
                      aria-pressed={isSelected}
                      className={`grid gap-3 rounded-lg border p-3 text-left transition ${
                        isSelected
                          ? "border-[var(--site-primary)] bg-[var(--site-primary-soft)]"
                          : "border-[var(--site-border)] bg-[var(--site-surface-soft)]"
                      }`}
                      key={option.value}
                      onClick={() => {
                        setLayout(option.value);
                        setNotice(null);
                        setErrors([]);
                      }}
                      type="button"
                    >
                      <span className="flex items-start justify-between gap-3">
                        <span>
                          <span className="block text-sm font-bold text-[var(--site-text)]">
                            {option.label}
                          </span>
                          <span className="mt-1 block text-xs leading-5 text-[var(--site-muted)]">
                            {option.description}
                          </span>
                        </span>
                        {isSelected ? (
                          <CheckCircle2
                            aria-hidden="true"
                            className="size-4 shrink-0 text-[var(--site-primary)]"
                          />
                        ) : null}
                      </span>
                      <LayoutMiniPreview
                        images={selectedImages}
                        value={option.value}
                      />
                    </button>
                  );
                })}
              </div>
            </section>
          </aside>

          <section className="flex min-h-[34rem] flex-col gap-4 rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-[var(--site-text)]">
                  คลังรูปรีวิว
                </h2>
                <p className="mt-1 text-sm text-[var(--site-muted)]">
                  ทั้งหมด {images.length.toLocaleString("th-TH")} รูป
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex h-9 items-center gap-2 rounded-md border border-[var(--site-border)] px-3 text-sm font-semibold text-[var(--site-muted)]">
                  <Images aria-hidden="true" className="size-4" />
                  เลือกแล้ว {selectedImageIds.length}/20
                </span>
              <button
                className={`inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-bold transition ${
                  isDeleteMode
                    ? "border-red-200 bg-red-50 text-red-700"
                    : "border-[var(--site-border)] bg-[var(--site-surface)] text-[var(--site-text)]"
                }`}
                data-review-delete-mode-toggle
                disabled={isBulkDeleting}
                onClick={toggleDeleteMode}
                type="button"
              >
                <Trash2 aria-hidden="true" className="size-4" />
                {isDeleteMode ? "ออกจากโหมดลบ" : "เลือกลบหลายรูป"}
              </button>
              </div>
            </div>

            <div className="grid gap-2">
              <label className="relative block">
                <span className="sr-only">ค้นหารูปรีวิว</span>
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--site-muted)]"
                />
                <input
                  className="h-10 w-full rounded-md border border-[var(--site-border)] bg-[var(--site-surface-soft)] pl-9 pr-3 text-sm text-[var(--site-text)] outline-none transition placeholder:text-[var(--site-muted)] focus:border-[var(--site-primary)]"
                  onChange={(event) => {
                    setSearchQuery(event.currentTarget.value);
                  }}
                  placeholder="ค้นหาชื่อหรือ path"
                  type="search"
                  value={searchQuery}
                />
              </label>
            </div>

            {isDeleteMode ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 p-2">
                <span className="text-sm font-semibold text-red-700">
                  เลือกลบ {selectedDeleteImageIds.length.toLocaleString("th-TH")} รูป
                </span>
                <span className="flex flex-wrap gap-2">
                  <button
                    className="h-9 rounded-md border border-[var(--site-border)] bg-[var(--site-surface)] px-3 text-xs font-bold text-[var(--site-text)] disabled:opacity-50"
                    data-review-delete-select-all
                    disabled={filteredImages.length === 0 || isBulkDeleting}
                    onClick={toggleFilteredDeleteSelection}
                    type="button"
                  >
                    {areFilteredImagesSelectedForDelete
                      ? "ยกเลิกทั้งหมด"
                      : "เลือกทั้งหมด"}
                  </button>
                  <button
                    className="h-9 rounded-md border border-[var(--site-border)] bg-[var(--site-surface)] px-3 text-xs font-bold text-[var(--site-text)] disabled:opacity-50"
                    data-review-delete-clear
                    disabled={selectedDeleteImageIds.length === 0 || isBulkDeleting}
                    onClick={clearDeleteSelection}
                    type="button"
                  >
                    ล้าง
                  </button>
                  <button
                    className="inline-flex h-9 items-center gap-1 rounded-md border border-red-200 bg-white px-3 text-xs font-bold text-red-700 disabled:opacity-50"
                    data-review-delete-submit
                    disabled={selectedDeleteImageIds.length === 0 || isBulkDeleting}
                    onClick={() => {
                      void deleteSelectedReviewImages();
                    }}
                    type="button"
                  >
                    <Trash2 aria-hidden="true" className="size-3.5" />
                    {isBulkDeleteConfirming ? "ยืนยันลบที่เลือก" : "ลบที่เลือก"}
                  </button>
                </span>
              </div>
            ) : null}

            {images.length === 0 ? (
              <div className="grid flex-1 place-items-center rounded-lg border border-dashed border-[var(--site-border)] bg-[var(--site-surface-soft)] p-8 text-center">
                <div className="max-w-sm">
                  <div className="mx-auto grid size-12 place-items-center rounded-md bg-[var(--site-primary-soft)] text-[var(--site-primary)]">
                    <Images aria-hidden="true" className="size-5" />
                  </div>
                  <h3 className="mt-4 text-base font-bold text-[var(--site-text)]">
                    ยังไม่มีรูปรีวิว
                  </h3>
                </div>
              </div>
            ) : filteredImages.length === 0 ? (
              <div className="grid flex-1 place-items-center rounded-lg border border-dashed border-[var(--site-border)] bg-[var(--site-surface-soft)] p-8 text-center text-sm font-semibold text-[var(--site-muted)]">
                ไม่พบรูปตามเงื่อนไขที่เลือก
              </div>
            ) : (
              <div className="grid min-h-0 flex-1 auto-rows-max grid-cols-2 gap-3 overflow-y-auto pr-1 md:grid-cols-3 xl:grid-cols-4">
                {filteredImages.map((image) => {
                  const selectedIndex = selectedImageIds.indexOf(image.id);
                  const isSelected = selectedIndex !== -1;
                  const isDeleteSelected = selectedDeleteImageIdSet.has(image.id);

                  return (
                    <div
                      className={`grid min-w-0 gap-2 rounded-lg border p-2 text-left transition ${
                        isDeleteMode && isDeleteSelected
                          ? "border-red-300 bg-red-50"
                          : !isDeleteMode && isSelected
                          ? "border-[var(--site-primary)] bg-[var(--site-primary-soft)]"
                          : image.isActive
                            ? "border-[var(--site-border)] bg-[var(--site-surface-soft)]"
                            : "border-[var(--site-border)] bg-[var(--site-surface-soft)] opacity-70"
                      }`}
                      key={image.id}
                    >
                      <div className="relative">
                        {isDeleteMode ? (
                          <label className="absolute left-2 top-2 z-10">
                            <span className="sr-only">เลือกเพื่อลบ</span>
                            <input
                              checked={isDeleteSelected}
                              className="peer sr-only"
                              disabled={isBulkDeleting}
                              onChange={() => {
                                toggleDeleteImageSelection(image.id);
                              }}
                              type="checkbox"
                            />
                            <span className="grid size-7 place-items-center rounded-md bg-white/90 text-[var(--site-muted)] shadow ring-1 ring-[var(--site-border)] transition peer-checked:bg-red-600 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-red-500">
                              <CheckCircle2 aria-hidden="true" className="size-4" />
                            </span>
                          </label>
                        ) : null}
                      <button
                        className="relative block aspect-[4/5] w-full overflow-hidden rounded-md bg-[var(--site-surface-tint)] text-left disabled:cursor-not-allowed"
                        data-review-library-image-id={image.id}
                        disabled={
                          busyImageId === image.id ||
                          isBulkDeleting ||
                          (!isDeleteMode && !image.isActive)
                        }
                        onClick={() => {
                          if (isDeleteMode) {
                            toggleDeleteImageSelection(image.id);
                            return;
                          }

                          toggleImage(image.id);
                        }}
                        type="button"
                      >
                        <PreviewImage
                          alt={image.alt}
                          className="object-cover"
                          fill
                          loading="lazy"
                          quality={60}
                          sizes="(min-width: 1280px) 180px, 45vw"
                          src={image.url}
                        />
                        {isSelected && !isDeleteMode ? (
                          <span className="absolute right-2 top-2 rounded-md bg-[var(--site-primary)] px-2 py-1 text-xs font-bold text-[var(--site-on-primary)] shadow">
                            #{selectedIndex + 1}
                          </span>
                        ) : null}
                        {!image.isActive ? (
                          <span
                            className={`absolute ${
                              isDeleteMode ? "left-10" : "left-2"
                            } top-2 rounded-md bg-zinc-950/75 px-2 py-1 text-xs font-bold text-white`}
                          >
                            ซ่อนแล้ว
                          </span>
                        ) : null}
                      </button>
                      </div>

                      {isDeleteMode ? (
                        <div
                          className={`rounded-md px-2 py-2 text-xs font-bold ${
                            isDeleteSelected
                              ? "bg-red-100 text-red-700"
                              : "bg-[var(--site-surface)] text-[var(--site-muted)]"
                          }`}
                        >
                          {isDeleteSelected ? "เลือกเพื่อลบแล้ว" : "คลิกรูปเพื่อเลือกลบ"}
                        </div>
                      ) : editingImageId === image.id ? (
                        <div className="grid gap-2">
                          <label className="grid gap-1">
                            <span className="sr-only">แก้ชื่อรูป</span>
                            <input
                              className="h-9 min-w-0 rounded-md border border-[var(--site-border)] bg-[var(--site-surface)] px-2 text-xs text-[var(--site-text)] outline-none focus:border-[var(--site-primary)]"
                              disabled={busyImageId === image.id}
                              maxLength={160}
                              onChange={(event) => {
                                setAltDraft(event.currentTarget.value);
                              }}
                              value={altDraft}
                            />
                          </label>
                          <span className="grid grid-cols-2 gap-1">
                            <button
                              className="h-8 rounded-md bg-[var(--site-primary)] px-2 text-xs font-bold text-[var(--site-on-primary)] disabled:opacity-60"
                              disabled={busyImageId === image.id}
                              onClick={() => {
                                void saveAltEdit(image);
                              }}
                              type="button"
                            >
                              บันทึก
                            </button>
                            <button
                              className="h-8 rounded-md border border-[var(--site-border)] bg-[var(--site-surface)] px-2 text-xs font-bold text-[var(--site-text)]"
                              disabled={busyImageId === image.id}
                              onClick={() => {
                                setEditingImageId(null);
                                setAltDraft("");
                              }}
                              type="button"
                            >
                              ยกเลิก
                            </button>
                          </span>
                        </div>
                      ) : (
                        <div className="flex min-w-0 items-start justify-between gap-2">
                          <span className="min-w-0">
                            <span className="block truncate text-xs font-semibold text-[var(--site-text)]">
                              {image.alt || image.path}
                            </span>
                            <span className="block truncate text-[11px] text-[var(--site-muted)]">
                              {image.path}
                            </span>
                          </span>
                          <button
                            aria-label="แก้ชื่อรูป"
                            className="grid size-8 shrink-0 place-items-center rounded-md border border-[var(--site-border)] bg-[var(--site-surface)] text-[var(--site-muted)]"
                            disabled={busyImageId === image.id}
                            onClick={() => {
                              beginAltEdit(image);
                            }}
                            type="button"
                          >
                            <Pencil aria-hidden="true" className="size-4" />
                          </button>
                        </div>
                      )}

                      {!isDeleteMode ? (
                        <button
                          className="inline-flex h-8 items-center justify-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 text-xs font-bold text-red-700 disabled:opacity-60"
                          disabled={busyImageId === image.id}
                          onClick={() => {
                            void deleteReviewImage(image);
                          }}
                          type="button"
                        >
                          <Trash2 aria-hidden="true" className="size-3.5" />
                          {pendingDeleteImageId === image.id ? "ยืนยัน" : "ลบ"}
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <aside className="grid content-start gap-4">
            <section className="grid gap-4 rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] p-4 shadow-sm lg:sticky lg:top-24">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-[var(--site-text)]">
                    คิวหน้าแรก
                  </h2>
                  <p className="mt-1 text-sm text-[var(--site-muted)]">
                    {selectedImageIds.length.toLocaleString("th-TH")} / 20 รูป
                  </p>
                </div>
                {hasUnsavedChanges ? (
                  <span className="rounded-md bg-amber-50 px-2 py-1 text-xs font-bold text-amber-800 ring-1 ring-amber-200">
                    ยังไม่บันทึก
                  </span>
                ) : (
                  <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200">
                    บันทึกแล้ว
                  </span>
                )}
              </div>

              {isDeleteMode ? (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
                  ปิดการลากและเรียงคิวชั่วคราวระหว่างเลือกลบหลายรูป
                </div>
              ) : null}

              {selectedImages.length === 0 ? (
                <div className="rounded-lg border border-dashed border-[var(--site-border)] bg-[var(--site-surface-soft)] p-4 text-sm text-[var(--site-muted)]">
                  ยังไม่ได้เลือกรูปสำหรับหน้าแรก
                </div>
              ) : (
                <div className="grid max-h-[62dvh] gap-2 overflow-y-auto pr-1">
                  {selectedImages.map((image, index) => (
                    <div
                      className="grid grid-cols-[auto_54px_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-[var(--site-border)] bg-[var(--site-surface-soft)] p-2"
                      draggable={!isDeleteMode}
                      key={image.id}
                      onDragEnd={() => {
                        draggedQueueImageIdRef.current = null;
                      }}
                      onDragOver={(event) => {
                        if (isDeleteMode) {
                          return;
                        }

                        event.preventDefault();
                        const draggedImageId = draggedQueueImageIdRef.current;

                        if (draggedImageId && draggedImageId !== image.id) {
                          moveSelectedImageById(draggedImageId, image.id);
                        }
                      }}
                      onDragStart={(event) => {
                        if (isDeleteMode) {
                          event.preventDefault();
                          return;
                        }

                        draggedQueueImageIdRef.current = image.id;
                        event.dataTransfer.effectAllowed = "move";
                      }}
                    >
                      <GripVertical
                        aria-hidden="true"
                        className={`size-4 text-[var(--site-muted)] ${
                          isDeleteMode ? "opacity-30" : ""
                        }`}
                      />
                      <span className="relative block aspect-[4/5] overflow-hidden rounded-md bg-[var(--site-surface-tint)]">
                        <PreviewImage
                          alt={image.alt}
                          className="object-cover"
                          fill
                          loading="lazy"
                          sizes="54px"
                          src={image.url}
                        />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-bold text-[var(--site-text)]">
                          #{index + 1}
                        </span>
                        <span className="block truncate text-xs text-[var(--site-muted)]">
                          {image.alt || image.path}
                        </span>
                      </span>
                      <span className="grid grid-cols-3 gap-1">
                        <button
                          aria-label="เลื่อนขึ้น"
                          className="grid size-8 place-items-center rounded-md border border-[var(--site-border)] bg-[var(--site-surface)] disabled:opacity-40"
                          data-review-queue-action="move-up"
                          disabled={isDeleteMode || index === 0}
                          onClick={() => {
                            moveSelectedImage(index, index - 1);
                          }}
                          type="button"
                        >
                          <ArrowUp aria-hidden="true" className="size-4" />
                        </button>
                        <button
                          aria-label="เลื่อนลง"
                          className="grid size-8 place-items-center rounded-md border border-[var(--site-border)] bg-[var(--site-surface)] disabled:opacity-40"
                          data-review-queue-action="move-down"
                          disabled={isDeleteMode || index === selectedImages.length - 1}
                          onClick={() => {
                            moveSelectedImage(index, index + 1);
                          }}
                          type="button"
                        >
                          <ArrowDown aria-hidden="true" className="size-4" />
                        </button>
                        <button
                          aria-label="เอาออกจากคิว"
                          className="grid size-8 place-items-center rounded-md border border-red-200 bg-red-50 text-red-700 disabled:opacity-40"
                          data-review-queue-action="remove"
                          disabled={isDeleteMode}
                          onClick={() => {
                            toggleImage(image.id);
                          }}
                          type="button"
                        >
                          <Trash2 aria-hidden="true" className="size-4" />
                        </button>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </aside>
        </div>
      )}

      {previewCustomerReviews ? (
        <section className="grid gap-4 rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] p-4 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-[var(--site-text)]">
                ตัวอย่างหน้าแรก
              </h2>
              <p className="mt-1 text-sm text-[var(--site-muted)]">
                แสดงจากคิวและรูปแบบที่เลือกอยู่ตอนนี้
              </p>
            </div>
            {hasUnsavedChanges ? (
              <span className="rounded-md bg-amber-50 px-2 py-1 text-xs font-bold text-amber-800 ring-1 ring-amber-200">
                Preview ยังไม่บันทึก
              </span>
            ) : null}
          </div>
          <div className="overflow-hidden rounded-md bg-[var(--site-background)]">
            <CustomerReviewSection data={previewCustomerReviews} />
          </div>
        </section>
      ) : null}

      {cropFile && cropFileUrl ? (
        <CropDialog
          aspect={aspect}
          crop={crop}
          cropFile={cropFile}
          cropFileUrl={cropFileUrl}
          croppedAreaPixels={croppedAreaPixels}
          isUploading={isUploading}
          onAspectChange={(nextAspect) => {
            setAspect(nextAspect);
            setCrop({ x: 0, y: 0 });
            setZoom(1);
            setCroppedAreaPixels(null);
          }}
          onCancel={openNextCropFile}
          onCropChange={setCrop}
          onCropComplete={(_croppedArea, nextCroppedAreaPixels) => {
            setCroppedAreaPixels(nextCroppedAreaPixels);
          }}
          onUpload={() => {
            void uploadCroppedImage();
          }}
          onZoomChange={setZoom}
          pendingCount={pendingFiles.length}
          submitLabel="Crop และอัปโหลด"
          title="Crop รูปก่อนอัปโหลด"
          zoom={zoom}
        />
      ) : null}
    </div>
  );
}
