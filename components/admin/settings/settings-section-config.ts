export const SETTINGS_NAV_ITEMS = [
  {
    id: "brand",
    href: "/admin/settings/brand",
    label: "ข้อมูลแบรนด์",
    description: "ชื่อเว็บไซต์ โลโก้ และ favicon",
  },
  {
    id: "theme",
    href: "/admin/settings/theme",
    label: "สีและธีม",
    description: "สีหลัก ลิงก์ และข้อมูลไฮไลต์",
  },
  {
    id: "header",
    href: "/admin/settings/header",
    label: "Header",
    description: "รูปแบบ Header บน Desktop",
  },
  {
    id: "hero",
    href: "/admin/settings/hero",
    label: "รูปหลัก",
    description: "ภาพหลักและคำอธิบาย",
  },
  {
    id: "seo",
    href: "/admin/settings/seo",
    label: "SEO และการแชร์",
    description: "Google และตัวอย่างแชร์ลิงก์",
  },
  {
    id: "contact",
    href: "/admin/settings/contact",
    label: "ติดต่อและชำระเงิน",
    description: "โทรศัพท์ แชต และบัญชีธนาคาร",
  },
  {
    id: "security",
    href: "/admin/settings/security",
    label: "เปลี่ยนรหัสผ่าน",
    description: "ยืนยันตัวตนด้วย OTP",
  },
] as const;
