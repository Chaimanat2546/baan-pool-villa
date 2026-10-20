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
import { Megaphone, Plus, RefreshCw } from "lucide-react";
import { readAdminAccessToken } from "@/components/admin/admin-auth";
import {
  extractAdminErrors,
  readJsonPayload,
  shouldRedirectToLogin,
} from "@/components/admin/admin-api-client";
import { AdminFeedback } from "@/components/admin/admin-feedback";
import type { AdminAdvertisement } from "@/lib/advertisements/types";
import {
  isRecord,
  parseAdvertisementDraft,
} from "@/lib/advertisements/validation";
import type { DraftImage } from "./advertisement-images-editor";
import { AdvertisementEditor, type AdvertisementEditorDraft as Editor } from "./advertisement-editor";
import { AdvertisementList } from "./advertisement-list";

const buttonClass =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[var(--site-border)] px-3 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-[var(--site-primary)] disabled:opacity-40";
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
  const listHeading = useRef<HTMLHeadingElement>(null);
  const loadVersion = useRef(0);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 3000);
    return () => window.clearTimeout(timer);
  }, [notice]);
  useEffect(() => { if (!editor) listHeading.current?.focus(); }, [editor]);
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
    (nextPage: number, resetEditor = true) => {
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
          if (resetEditor) {
            revokeUrls();
            setEditor(null);
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
  const backToList = () => {
    if (busy || loading || !mayDiscard()) return;
    revokeUrls();
    setEditor(null);
    setDirty(false);
    setErrors([]);
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
      setNotice("บันทึกแล้ว");
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
  const feedback = <AdminFeedback errors={errors} errorTitle="ดำเนินการไม่สำเร็จ" notice={editor ? null : notice} warnings={warnings} />;
  return (
    <div className="grid min-w-0 gap-4 text-[var(--site-text)]">
      {editor ? (
        <AdvertisementEditor
          key={editor.id}
          editor={editor}
          dirty={dirty}
          disabled={busy || loading}
          notice={notice}
          feedback={feedback}
          onChange={update}
          onImages={changeImages}
          onObjectUrl={(url) => objectUrls.current.add(url)}
          onError={setErrors}
          onSave={save}
          onBack={backToList}
          onDelete={() => void remove()}
        />
      ) : (
        <>
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 ref={listHeading} tabIndex={-1} className="flex items-center gap-2 text-xl font-bold outline-none">
                <Megaphone className="size-5 text-[var(--site-primary)]" />จัดการโฆษณา
              </h1>
              <p className="mt-1 text-xs leading-5 text-[var(--site-muted)]">
                กิจกรรมและรูปของเว็บนี้ · <Link href="/admin/detail-layout" prefetch={false} className="font-semibold text-[var(--site-primary)] underline">ตั้งชื่อหัวข้อและตำแหน่ง</Link>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" disabled={busy || loading} className={`${buttonClass} hover:bg-[var(--site-primary-soft)]`} onClick={() => reload(page)}><RefreshCw className="size-4" />โหลดใหม่</button>
              <button data-create-advertisement type="button" disabled={busy || loading} className={`${buttonClass} bg-[var(--site-primary)] text-[var(--site-on-primary)] hover:opacity-90`} onClick={() => select()}><Plus className="size-4" />เพิ่มโฆษณา</button>
            </div>
          </header>
          {feedback}
          <AdvertisementList items={items} page={page} total={total} loading={loading || busy} onEdit={select} onPage={reload} />
        </>
      )}
    </div>
  );
}
