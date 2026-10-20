"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Megaphone, Plus, Save, Trash2 } from "lucide-react";
import { readAdminAccessToken } from "@/components/admin/admin-auth";
import {
  extractAdminErrors,
  readJsonPayload,
  shouldRedirectToLogin,
} from "@/components/admin/admin-api-client";
import { AdminFeedback } from "@/components/admin/admin-feedback";
import { ADVERTISEMENT_IMAGE_LIMIT, type AdminAdvertisement } from "@/lib/advertisements/types";
import {
  ADVERTISEMENT_ZONES,
  isRecord,
  parseAdvertisementDraft,
} from "@/lib/advertisements/validation";
import {
  AdvertisementImagesEditor,
  type DraftImage,
} from "./advertisement-images-editor";

type Editor = Omit<AdminAdvertisement, "updatedAt" | "images"> & {
  updatedAt: string | null;
  images: DraftImage[];
};
const inputClass =
  "h-10 w-full min-w-0 rounded-lg border border-[var(--site-border-strong)] bg-[var(--site-surface)] px-3 text-sm outline-none focus:border-[var(--site-primary)] focus:ring-2 focus:ring-[var(--site-primary)]/20";
const panelClass =
  "min-w-0 rounded-xl border border-[var(--site-border)] bg-[var(--site-surface)] p-4";
const buttonClass =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[var(--site-border)] px-3 text-sm font-semibold transition hover:bg-[var(--site-primary-soft)] focus-visible:outline-2 focus-visible:outline-[var(--site-primary)] disabled:opacity-40";
function toEditor(ad: AdminAdvertisement): Editor {
  return {
    ...ad,
    images: ad.images.map((image) => ({
      id: image.id,
      key: image.id,
      url: image.url,
    })),
  };
}

export function AdminAdvertisementsPage() {
  const router = useRouter();
  const [items, setItems] = useState<AdminAdvertisement[]>([]);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [page, setPage] = useState(1),
    [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<string[]>([]),
    [warnings, setWarnings] = useState<string[]>([]),
    [notice, setNotice] = useState<string | null>(null);
  const objectUrls = useRef(new Set<string>());
  const loadVersion = useRef(0);
  const revokeUrls = useCallback(() => {
    objectUrls.current.forEach((url) => URL.revokeObjectURL(url));
    objectUrls.current.clear();
  }, []);
  useEffect(() => () => revokeUrls(), [revokeUrls]);
  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const beforeLink = (event: MouseEvent) => {
      const anchor =
        event.target instanceof Element
          ? event.target.closest("a[href]")
          : null;
      if (
        anchor &&
        !window.confirm(
          "มีการแก้ไขที่ยังไม่บันทึก ต้องการออกจากหน้านี้หรือไม่?",
        )
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", beforeLink, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", beforeLink, true);
    };
  }, [dirty]);
  const api = useCallback(
    async (url: string, init?: RequestInit) => {
      const token = await readAdminAccessToken();
      if (!token) {
        router.replace("/admin/login");
        throw new Error("กรุณาเข้าสู่ระบบใหม่");
      }
      const response = await fetch(url, {
        ...init,
        headers: { ...init?.headers, Authorization: `Bearer ${token}` },
      });
      const body = await readJsonPayload(response);
      if (!response.ok) {
        if (shouldRedirectToLogin(response.status, body))
          router.replace("/admin/login");
        throw new Error(
          extractAdminErrors(body, "ดำเนินการไม่สำเร็จ กรุณาลองอีกครั้ง").join(
            "\n",
          ),
        );
      }
      if (!isRecord(body)) throw new Error("รูปแบบข้อมูลตอบกลับไม่ถูกต้อง");
      return body;
    },
    [router],
  );
  const load = useCallback(
    (nextPage: number, selectFirst = true) => {
      const version = ++loadVersion.current;
      return api(`/api/admin/advertisements?page=${nextPage}`)
        .then((body) => {
          if (version !== loadVersion.current) return;
          if (
            !Array.isArray(body.advertisements) ||
            typeof body.total !== "number"
          )
            throw new Error("รูปแบบรายการโฆษณาไม่ถูกต้อง");
          const records = body.advertisements as AdminAdvertisement[];
          setItems(records);
          setTotal(body.total);
          setPage(nextPage);
          if (selectFirst) {
            revokeUrls();
            setEditor(records[0] ? toEditor(records[0]) : null);
            setDirty(false);
          }
        })
        .catch((error: unknown) => {
          if (version === loadVersion.current)
            setErrors([
              error instanceof Error ? error.message : "โหลดโฆษณาไม่สำเร็จ",
            ]);
        })
        .finally(() => {
          if (version === loadVersion.current) setLoading(false);
        });
    },
    [api, revokeUrls],
  );
  useEffect(() => {
    void load(1);
  }, [load]);
  const mayDiscard = () =>
    !dirty ||
    window.confirm("มีการแก้ไขที่ยังไม่บันทึก ต้องการละทิ้งการแก้ไขหรือไม่?");
  const reload = (nextPage: number) => {
    if (busy || loading || !mayDiscard()) return;
    setLoading(true);
    setErrors([]);
    void load(nextPage);
  };
  const select = (ad?: AdminAdvertisement) => {
    if (busy || loading || !mayDiscard()) return;
    revokeUrls();
    setEditor(
      ad
        ? toEditor(ad)
        : {
            id: crypto.randomUUID(),
            title: "",
            zone: "all",
            isActive: true,
            sortOrder: 0,
            updatedAt: null,
            images: [],
          },
    );
    setDirty(false);
    setErrors([]);
    setNotice(null);
    setWarnings([]);
  };
  const update = (changes: Partial<Editor>) => {
    setEditor((current) => (current ? { ...current, ...changes } : null));
    setDirty(true);
    setNotice(null);
  };
  const changeImages = (images: DraftImage[]) => {
    for (const image of editor?.images ?? []) {
      if (
        !images.some((next) => next.url === image.url) &&
        objectUrls.current.has(image.url)
      ) {
        URL.revokeObjectURL(image.url);
        objectUrls.current.delete(image.url);
      }
    }
    update({ images });
  };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!editor || busy || loading) return;
    const files: File[] = [];
    const images = editor.images.map((image) =>
      image.file
        ? { uploadIndex: files.push(image.file) - 1 }
        : { id: image.id },
    );
    const { draft, errors: validationErrors } = parseAdvertisementDraft({
      ...editor,
      images,
    });
    if (!draft) {
      setErrors(validationErrors);
      return;
    }
    setBusy(true);
    setErrors([]);
    setWarnings([]);
    setNotice(null);
    try {
      const form = new FormData();
      form.set("advertisement", JSON.stringify(draft));
      files.forEach((file) => form.append("images", file));
      const body = await api("/api/admin/advertisements", {
        method: "POST",
        body: form,
      });
      if (
        typeof body.updatedAt !== "string" ||
        !Array.isArray(body.images) ||
        body.images.length !== editor.images.length
      )
        throw new Error("ยังยืนยันผลบันทึกไม่ได้ กรุณาโหลดข้อมูลล่าสุด");
      const savedImages = body.images as { id: string }[];
      setEditor({
        ...editor,
        title: draft.title,
        updatedAt: body.updatedAt,
        images: editor.images.map((image, index) => ({
          key: savedImages[index].id,
          id: savedImages[index].id,
          url: image.url,
        })),
      });
      setDirty(false);
      setNotice("บันทึกโฆษณาแล้ว");
      setWarnings(
        Array.isArray(body.warnings) ? (body.warnings as string[]) : [],
      );
      await load(page, false);
    } catch (error) {
      setErrors([
        error instanceof Error ? error.message : "บันทึกโฆษณาไม่สำเร็จ",
      ]);
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (
      !editor?.updatedAt ||
      busy ||
      !window.confirm(`ลบโฆษณา “${editor.title}” และรูปที่เกี่ยวข้องหรือไม่?`)
    )
      return;
    setBusy(true);
    setErrors([]);
    setNotice(null);
    try {
      const body = await api("/api/admin/advertisements", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editor.id, updatedAt: editor.updatedAt }),
      });
      revokeUrls();
      setEditor(null);
      setDirty(false);
      setWarnings(
        Array.isArray(body.warnings) ? (body.warnings as string[]) : [],
      );
      setNotice("ลบโฆษณาแล้ว");
      await load(items.length === 1 && page > 1 ? page - 1 : page);
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "ลบโฆษณาไม่สำเร็จ"]);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="@container grid min-w-0 gap-3 text-[var(--site-text)]">
      <header
        className={`${panelClass} flex flex-wrap items-center justify-between gap-3`}
      >
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-xl font-bold">
            <Megaphone className="size-5 text-[var(--site-primary)]" />
            จัดการโฆษณา
          </h1>
          <p className="mt-1 text-xs leading-5 text-[var(--site-muted)]">
            จัดการรูปและกิจกรรมของเว็บนี้ แสดงตามโซนสูงสุด 3 รายการ
            {" · "}
            <Link href="/admin/detail-layout" prefetch={false} className="font-semibold text-[var(--site-primary)] underline">
              ตั้งชื่อหัวข้อและตำแหน่ง
            </Link>
          </p>
        </div>
        <button
          data-create-advertisement
          type="button"
          disabled={busy || loading}
          className={buttonClass}
          onClick={() => select()}
        >
          <Plus className="size-4" />
          เพิ่มโฆษณา
        </button>
      </header>
      <AdminFeedback
        errors={errors}
        errorTitle="ดำเนินการไม่สำเร็จ"
        notice={notice}
        warnings={warnings}
      />
      <div className="grid min-w-0 items-start gap-3 @3xl:grid-cols-[190px_minmax(0,1fr)]">
        <aside className={`${panelClass} grid gap-3`} aria-label="รายการโฆษณา">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-bold">รายการ ({total})</h2>
            <button
              type="button"
              disabled={busy || loading}
              className="text-xs underline"
              onClick={() => reload(page)}
            >
              โหลดใหม่
            </button>
          </div>
          {loading ? (
            <p
              role="status"
              className="animate-pulse py-5 text-sm text-[var(--site-muted)]"
            >
              กำลังโหลดโฆษณา…
            </p>
          ) : items.length === 0 ? (
            <p className="py-5 text-sm text-[var(--site-muted)]">
              ยังไม่มีโฆษณา
            </p>
          ) : (
            <>
            <label className="grid gap-2 text-xs font-semibold @3xl:hidden">
              เลือกโฆษณา
              <select
                className={inputClass}
                disabled={busy || loading}
                value={items.some((ad) => ad.id === editor?.id) ? (editor?.id ?? "") : ""}
                onChange={(event) => {
                  const ad = items.find((item) => item.id === event.target.value);
                  if (ad) select(ad);
                }}
              >
                <option value="" disabled>เลือกรายการที่ต้องการแก้ไข</option>
                {items.map((ad) => <option key={ad.id} value={ad.id}>{ad.title}</option>)}
              </select>
            </label>
            <ul className="hidden gap-2 @3xl:grid @3xl:max-h-[65dvh] @3xl:overflow-y-auto">
              {items.map((ad) => (
                <li key={ad.id}>
                  <button
                    type="button"
                    disabled={busy || loading}
                    aria-pressed={editor?.id === ad.id}
                    onClick={() => select(ad)}
                    className={`grid w-full min-w-0 gap-2 rounded-lg border p-3 text-left hover:border-[var(--site-primary)] ${editor?.id === ad.id ? "border-[var(--site-primary)] bg-[var(--site-primary-soft)]" : "border-[var(--site-border)]"}`}
                  >
                    <span className="line-clamp-2 break-words text-sm font-semibold">
                      {ad.title}
                    </span>
                    <span className="text-xs text-[var(--site-muted)]">
                      {ad.isActive ? "เปิดแสดง" : "ปิดแสดง"} · ลำดับ{" "}
                      {ad.sortOrder}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            </>
          )}
          {total > 20 && (
          <div className="flex items-center justify-between text-xs">
            <button
              type="button"
              disabled={busy || loading || page === 1}
              onClick={() => reload(page - 1)}
              className="rounded border border-[var(--site-border)] p-2 disabled:opacity-30"
            >
              ก่อนหน้า
            </button>
            <span>หน้า {page}</span>
            <button
              type="button"
              disabled={busy || loading || page * 20 >= total}
              onClick={() => reload(page + 1)}
              className="rounded border border-[var(--site-border)] p-2 disabled:opacity-30"
            >
              ถัดไป
            </button>
          </div>
          )}
        </aside>
        {editor ? (
          <form id="advertisement-editor" onSubmit={save} className={`${panelClass} grid gap-4`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-bold">
                {editor.updatedAt ? "แก้ไขโฆษณา" : "เพิ่มโฆษณาใหม่"}
              </h2>
              <span className="text-xs text-[var(--site-muted)]">{editor.images.length}/{ADVERTISEMENT_IMAGE_LIMIT} รูป</span>
            </div>
            <fieldset disabled={busy || loading} className="grid min-w-0 gap-4">
              <label className="grid gap-2 text-sm font-semibold">
                ชื่อโฆษณา
                <input
                  name="title"
                  maxLength={160}
                  required
                  className={inputClass}
                  value={editor.title}
                  onChange={(event) => update({ title: event.target.value })}
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-semibold">
                  โซนที่แสดง
                  <select
                    className={inputClass}
                    value={editor.zone}
                    onChange={(event) => update({ zone: event.target.value })}
                  >
                    {ADVERTISEMENT_ZONES.map((zone) => (
                      <option key={zone.value} value={zone.value}>
                        {zone.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-semibold">
                  ลำดับการแสดง
                  <input
                    type="number"
                    min={0}
                    max={9999}
                    required
                    className={inputClass}
                    value={editor.sortOrder}
                    onChange={(event) =>
                      update({ sortOrder: Number(event.target.value) })
                    }
                  />
                </label>
              </div>
              <p className="text-xs text-[var(--site-muted)]">
                เลขน้อยแสดงก่อน ระบบแสดงเฉพาะโซนของบ้านและรายการทุกโซน
              </p>
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input
                  type="checkbox"
                  checked={editor.isActive}
                  onChange={(event) =>
                    update({ isActive: event.target.checked })
                  }
                  className="size-4 accent-[var(--site-primary)]"
                />
                เปิดแสดงบนเว็บไซต์
              </label>
              <AdvertisementImagesEditor
                images={editor.images}
                disabled={busy || loading}
                onChange={changeImages}
                onError={setErrors}
                onObjectUrl={(url) => objectUrls.current.add(url)}
              />
            </fieldset>
            {editor.updatedAt && <div className="border-t border-[var(--site-border)] pt-3">
              <button
                type="button"
                disabled={busy || !editor.updatedAt}
                className={`${buttonClass} text-red-700`}
                onClick={() => void remove()}
              >
                <Trash2 className="size-4" />
                ลบโฆษณา
              </button>
            </div>}
          </form>
        ) : (
          <div
            className={`${panelClass} py-12 text-center text-sm text-[var(--site-muted)]`}
          >
            เลือกรายการหรือเพิ่มโฆษณาเพื่อเริ่มจัดการ
          </div>
        )}
      </div>
      {editor && (
        <div className="sticky bottom-0 z-20 flex min-w-0 items-center justify-between gap-3 rounded-xl border border-[var(--site-border-strong)] bg-[var(--site-surface)] px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-lg">
          <div className="min-w-0 text-xs text-[var(--site-muted)]" role="status">
            <p className="font-semibold text-[var(--site-text)]">{dirty ? "มีการแก้ไขที่ยังไม่บันทึก" : editor.updatedAt ? "ข้อมูลที่บันทึกแล้ว" : "โฆษณาใหม่"}</p>
            <p className="mt-1">{editor.images.length} รูป · {editor.isActive ? "เปิดแสดง" : "ปิดแสดง"}</p>
          </div>
          <button type="submit" form="advertisement-editor" disabled={busy || loading}
            className={`${buttonClass} shrink-0 bg-[var(--site-primary)] text-[var(--site-on-primary)] hover:opacity-90`}>
            <Save className="size-4" />
            {busy ? "กำลังบันทึก…" : "บันทึกโฆษณา"}
          </button>
        </div>
      )}
    </div>
  );
}
