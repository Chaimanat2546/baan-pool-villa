export function AdminMarketingTagsPage() {
  return (
    <div className="grid gap-5 text-[var(--site-text)]">
      <header>
        <h1 className="text-2xl font-bold">โฆษณา Google Search</h1>
        <p className="mt-2 text-sm text-[var(--site-muted)]">
          ใช้ Google Ads เพื่อนำผู้เข้าชมจากผลค้นหามายังเว็บไซต์
        </p>
      </header>
      <section className="rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] p-5">
        <h2 className="font-bold">ไม่ใช้การวัดผล Google บนเว็บไซต์</h2>
        <p className="mt-2 text-sm leading-6">
          เว็บไซต์ไม่โหลด GTM หรือ GA4 และไม่ส่ง conversion หรือข้อมูล
          remarketing ให้ Google การตั้งค่าแคมเปญ Search จัดการในบัญชี Google
          Ads
        </p>
        <p className="mt-3 text-sm leading-6 text-[var(--site-muted)]">
          สถิติการเปิดหน้า กดติดต่อ
          และเปิดรูปเก็บด้วยระบบของเว็บไซต์แบบนับเหตุการณ์โดยไม่สร้างรหัสผู้เข้าชมหรือประวัติรายบุคคล
        </p>
      </section>
    </div>
  );
}
