import type { LegalPage, LegalPageSlug } from "./types";

export const LEGAL_PAGE_DEFAULTS: Record<LegalPageSlug, LegalPage> = {
  terms: {
    id: "default-terms",
    slug: "terms",
    title: "Terms and Conditions",
    seoDescription: "Booking terms and conditions for Baan Pool Villa.",
    contentBlocks: [
      {
        type: "paragraph",
        content: [{ type: "text", text: "Please contact us for the latest booking terms." }],
      },
    ],
    status: "published",
    publishedAt: null,
    createdAt: "",
    updatedAt: "",
  },
  privacy: {
    id: "default-privacy",
    slug: "privacy",
    title: "Privacy Policy",
    seoDescription: "Privacy policy for Baan Pool Villa.",
    contentBlocks: [
      {
        type: "paragraph",
        content: [{ type: "text", text: "Please contact us for the latest privacy policy." }],
      },
    ],
    status: "published",
    publishedAt: null,
    createdAt: "",
    updatedAt: "",
  },
};
