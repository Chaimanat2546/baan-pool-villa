import { build } from "esbuild";
import { Miniflare } from "miniflare";
import { expect, it } from "vitest";

it("loads review validation and checks both languages in the Workers runtime", async () => {
  const bundle = await build({
    stdin: {
      resolveDir: process.cwd(),
      contents: `
        export default { async fetch() {
          const load = import('./lib/villa-reviews/validation.ts').then(({validateReviewSubmission}) => {
            const input = {villaId:'1630', bookingCode:'TEST', phone:'0812345678', rating:5};
            return {
              clean: validateReviewSubmission({...input, comment:'บ้านสะอาด great stay'}),
              prohibited: validateReviewSubmission({...input, comment:'บ้านเหี้ย but fuck'}),
            };
          });
          return Response.json(await Promise.race([
            load,
            new Promise(resolve => setTimeout(() => resolve({error:'validation module hung'}), 4000)),
          ]));
        }};
      `,
    },
    // Match Workers' Node compatibility for the old CLD3 dependency as well.
    banner: { js: 'import {createRequire} from "node:module"; const require=createRequire("file:///worker.js"); const __dirname="/";' },
    bundle: true,
    write: false,
    format: "esm",
    platform: "node",
    external: ["node:*", "fs", "path", "crypto"],
  });
  const worker = new Miniflare({
    modules: true,
    script: bundle.outputFiles[0].text,
    compatibilityDate: "2026-05-27",
    compatibilityFlags: ["nodejs_compat"],
  });
  try {
    const response = await worker.dispatchFetch("http://localhost/");
    expect(await response.json()).toMatchObject({
      clean: { ok: true, detectedWords: [] },
      prohibited: { ok: false, detectedWords: ["เหี้ย", "fuck"] },
    });
  } finally {
    await worker.dispose();
  }
}, 15_000);
