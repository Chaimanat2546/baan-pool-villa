import type { LucideIcon } from "lucide-react";
import {
  Home,
  Images,
  LayoutTemplate,
  MessageSquareText,
  Newspaper,
  ScrollText,
  Settings,
  Tags,
  Users,
  Video,
  Warehouse,
} from "lucide-react";

export interface AdminNavItem {
  compactLabel: string;
  description: string;
  disabled?: boolean;
  href: string;
  icon: LucideIcon;
  label: string;
  pageTitle: string;
}

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  {
    compactLabel: "ชุดบ้าน",
    description: "จัดชุดบ้านพักที่แสดงบนหน้าแรก",
    href: "/admin/sections",
    icon: Home,
    label: "ชุดบ้านพัก",
    pageTitle: "จัดชุดบ้านพัก",
  },
  {
    compactLabel: "บ้านพัก",
    description: "ข้อมูลบ้านพัก ราคา และสถานะ",
    disabled: true,
    href: "/admin/villas",
    icon: Warehouse,
    label: "บ้านพัก",
    pageTitle: "บ้านพัก",
  },
  {
    compactLabel: "รายละเอียด",
    description: "จัด layout ของหน้ารายละเอียดบ้านพัก",
    href: "/admin/detail-layout",
    icon: LayoutTemplate,
    label: "หน้ารายละเอียดบ้านพัก",
    pageTitle: "จัดหน้ารายละเอียดบ้านพัก",
  },
  {
    compactLabel: "บทความ",
    description: "บทความแนะนำบ้านพักและช่วยปิดการจอง",
    href: "/admin/guides",
    icon: Newspaper,
    label: "บทความ",
    pageTitle: "จัดการบทความ",
  },
  {
    compactLabel: "รีวิว",
    description: "อัปโหลดและจัดคิวรูปรีวิวลูกค้าสำหรับหน้าแรก",
    href: "/admin/customer-reviews",
    icon: MessageSquareText,
    label: "รีวิวลูกค้า",
    pageTitle: "รูปเครดิตและรีวิวลูกค้า",
  },
  {
    compactLabel: "รูปภาพ",
    description: "รูปภาพบ้านพักและแกลเลอรี",
    disabled: true,
    href: "/admin/images",
    icon: Images,
    label: "รูปภาพ",
    pageTitle: "รูปภาพ",
  },
  {
    compactLabel: "รูปปก",
    description: "เลือกรูปและอัปโหลดรูปปกสำหรับการ์ดบ้านพัก",
    href: "/admin/card-images/houses",
    icon: Images,
    label: "จัดการรูปปกบ้าน",
    pageTitle: "จัดการรูปปกบ้าน",
  },
  {
    compactLabel: "ผู้ดูแล",
    description: "สิทธิ์และผู้ใช้งานหลังบ้าน",
    disabled: true,
    href: "/admin/users",
    icon: Users,
    label: "ผู้ดูแล",
    pageTitle: "ผู้ดูแล",
  },
  {
    compactLabel: "TikTok",
    description: "จัดการลิงก์ TikTok ที่แสดงบนหน้าแรกเว็บไซต์",
    href: "/admin/tiktok",
    icon: Video,
    label: "TikTok",
    pageTitle: "TikTok",
  },
  {
    compactLabel: "Marketing",
    description: "ตั้งค่า GTM ID และดูจุดส่ง DataLayer สำหรับวัดผล Google Ads",
    href: "/admin/marketing-tags",
    icon: Tags,
    label: "Marketing Tags",
    pageTitle: "Marketing Tags",
  },
  {
    compactLabel: "กฎหมาย",
    description: "แก้ไขเงื่อนไขการใช้งานและนโยบายความเป็นส่วนตัว",
    href: "/admin/legal",
    icon: ScrollText,
    label: "หน้ากฎหมาย",
    pageTitle: "จัดการหน้ากฎหมาย",
  },
  {
    compactLabel: "ตั้งค่า",
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
