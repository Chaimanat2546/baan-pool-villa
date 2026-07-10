import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/settings",
  useRouter: () => ({
    refresh: vi.fn(),
    replace: vi.fn(),
  }),
}));

vi.mock("@/lib/home-sections/supabase", () => ({
  createBrowserHomeConfigClient: vi.fn(() => ({
    auth: {
      getSession: vi.fn(),
      signOut: vi.fn(),
    },
  })),
}));

import DetailLayoutLoading from "../../../../app/(admin)/admin/detail-layout/loading";
import GuidesLoading from "../../../../app/(admin)/admin/guides/loading";
import SectionsLoading from "../../../../app/(admin)/admin/sections/loading";
import SettingsLoading from "../../../../app/(admin)/admin/settings/loading";
import TikTokLoading from "../../../../app/(admin)/admin/tiktok/loading";
import { AdminDetailLayoutPage } from "../../detail-layout/admin-detail-layout-page";
import { AdminGuidesPage } from "../../guides/admin-guides-page";
import { AdminSectionsPage } from "../../sections/admin-sections-page";
import { AdminSettingsPage } from "../../settings/admin-settings-page";
import { AdminTikTokPage } from "../../tiktok/admin-tiktok-page";

describe("admin loading skeletons", () => {
  it("renders the settings loading shell for both the page state and route wrapper", () => {
    expect(renderToStaticMarkup(<AdminSettingsPage />)).toContain(
      'data-admin-settings-skeleton="true"',
    );
    expect(renderToStaticMarkup(<SettingsLoading />)).toContain(
      'data-settings-section-skeleton="true"',
    );
  });

  it("renders the sections loading shell for both the page state and route wrapper", () => {
    expect(renderToStaticMarkup(<AdminSectionsPage />)).toContain(
      'data-admin-sections-skeleton="true"',
    );
    expect(renderToStaticMarkup(<SectionsLoading />)).toContain(
      'data-admin-sections-skeleton="true"',
    );
  });

  it("renders the guides loading shell for both the page state and route wrapper", () => {
    expect(renderToStaticMarkup(<AdminGuidesPage />)).toContain(
      'data-admin-guides-skeleton="true"',
    );
    expect(renderToStaticMarkup(<GuidesLoading />)).toContain(
      'data-admin-guides-skeleton="true"',
    );
  });

  it("renders the TikTok loading shell for both the page state and route wrapper", () => {
    expect(renderToStaticMarkup(<AdminTikTokPage />)).toContain(
      'data-admin-tiktok-skeleton="true"',
    );
    expect(renderToStaticMarkup(<TikTokLoading />)).toContain(
      'data-admin-tiktok-skeleton="true"',
    );
  });

  it("renders the detail layout loading shell for both the page state and route wrapper", () => {
    expect(renderToStaticMarkup(<AdminDetailLayoutPage />)).toContain(
      'data-admin-detail-layout-skeleton="true"',
    );
    expect(renderToStaticMarkup(<DetailLayoutLoading />)).toContain(
      'data-admin-detail-layout-skeleton="true"',
    );
  });
});
