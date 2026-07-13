/** @vitest-environment jsdom */
import { act, useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { mountAdminPage } from "@/components/admin/__tests__/admin-page-dom-test-utils";
import { AssetUploadField } from "../asset-upload-field";

afterEach(() => vi.unstubAllGlobals());

it("creates local previews and revokes them on replacement and unmount", async () => {
  const createObjectURL = vi.fn().mockReturnValueOnce("blob:first").mockReturnValueOnce("blob:second");
  const revokeObjectURL = vi.fn();
  vi.stubGlobal("URL", Object.assign(URL, { createObjectURL, revokeObjectURL }));
  function Harness() {
    const [file, setFile] = useState<File | null>(null);
    return <AssetUploadField currentAlt="current" currentLabel="current" currentUrl="/current.jpg" description="upload" id="asset" label="asset" onFileChange={setFile} selectedFile={file} />;
  }
  const page = await mountAdminPage(<Harness />);
  const input = page.container.querySelector("#asset") as HTMLInputElement;
  const choose = (file: File) => act(() => { Object.defineProperty(input, "files", { configurable: true, value: [file] }); input.dispatchEvent(new Event("change", { bubbles: true })); });
  choose(new File(["one"], "one.png", { type: "image/png" }));
  choose(new File(["two"], "two.png", { type: "image/png" }));
  expect(createObjectURL).toHaveBeenCalledTimes(2);
  expect(revokeObjectURL).toHaveBeenCalledWith("blob:first");
  await page.unmount();
  expect(revokeObjectURL).toHaveBeenCalledWith("blob:second");
});
