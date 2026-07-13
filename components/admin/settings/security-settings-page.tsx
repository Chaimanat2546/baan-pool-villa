import { AdminPasswordSecurityCard } from "./admin-password-security-card";
import { SettingsSectionHeader } from "./settings-section-header";

export function SecuritySettingsPage() {
  return <section className="grid min-w-0 gap-6"><SettingsSectionHeader description="ยืนยันตัวตนด้วย OTP ก่อนตั้งรหัสผ่านใหม่" title="เปลี่ยนรหัสผ่าน" /><AdminPasswordSecurityCard /></section>;
}
