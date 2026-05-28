import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";

export default function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-full pb-20 lg:pb-0">
      <SiteHeader />
      {children}
      <SiteFooter />
      <MobileBottomNav />
    </div>
  );
}
