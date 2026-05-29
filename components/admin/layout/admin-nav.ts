import type { LucideIcon } from "lucide-react";
import {
  Home,
  Images,
  LayoutTemplate,
  Settings,
  Users,
  Warehouse,
} from "lucide-react";

export interface AdminNavItem {
  description: string;
  disabled?: boolean;
  href: string;
  icon: LucideIcon;
  label: string;
  pageTitle: string;
}

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  {
    description: "จัดชุดบ้านพักที่แสดงบนหน้าแรก",
    href: "/admin/sections",
    icon: Home,
    label: "หน้าแรก",
    pageTitle: "จัดหน้าแรก",
  },
  {
    description: "ข้อมูลบ้านพัก ราคา และสถานะ",
    disabled: true,
    href: "/admin/villas",
    icon: Warehouse,
    label: "บ้านพัก",
    pageTitle: "บ้านพัก",
  },
  {
    description: "จัด layout ของหน้ารายละเอียดบ้านพัก",
    href: "/admin/detail-layout",
    icon: LayoutTemplate,
    label: "หน้า Details",
    pageTitle: "จัดหน้า Details",
  },
  {
    description: "รูปภาพบ้านพักและแกลเลอรี",
    disabled: true,
    href: "/admin/images",
    icon: Images,
    label: "รูปภาพ",
    pageTitle: "รูปภาพ",
  },
  {
    description: "สิทธิ์และผู้ใช้งานหลังบ้าน",
    disabled: true,
    href: "/admin/users",
    icon: Users,
    label: "ผู้ดูแล",
    pageTitle: "ผู้ดูแล",
  },
  {
    description: "ข้อมูลเว็บและค่าทั่วไป",
    href: "/admin/settings",
    icon: Settings,
    label: "ตั้งค่าเว็บ",
    pageTitle: "ตั้งค่าเว็บ",
  },
];

export function getActiveAdminNavItem(pathname: string): AdminNavItem {
  return (
    ADMIN_NAV_ITEMS.find(
      (item) => !item.disabled && pathname.startsWith(item.href),
    ) ?? ADMIN_NAV_ITEMS[0]
  );
}
