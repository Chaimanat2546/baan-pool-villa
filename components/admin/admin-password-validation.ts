export const MIN_ADMIN_PASSWORD_LENGTH = 8;
export const MAX_ADMIN_PASSWORD_LENGTH = 128;

const PRINTABLE_ASCII_NO_SPACE_PATTERN = /^[\x21-\x7E]+$/;
const SYMBOL_PATTERN = /[^a-zA-Z0-9]/;

export function validateAdminPasswordChange({
  confirmPassword,
  newPassword,
}: {
  confirmPassword: string;
  newPassword: string;
}): string | null {
  if (!newPassword) {
    return "กรอกรหัสผ่านใหม่";
  }

  if (newPassword.length < MIN_ADMIN_PASSWORD_LENGTH) {
    return `รหัสผ่านใหม่ต้องมีอย่างน้อย ${MIN_ADMIN_PASSWORD_LENGTH} ตัวอักษร`;
  }

  if (newPassword.length > MAX_ADMIN_PASSWORD_LENGTH) {
    return `รหัสผ่านใหม่ต้องไม่เกิน ${MAX_ADMIN_PASSWORD_LENGTH} ตัวอักษร`;
  }

  if (!PRINTABLE_ASCII_NO_SPACE_PATTERN.test(newPassword)) {
    return "รหัสผ่านใหม่ใช้ได้เฉพาะตัวอักษรอังกฤษ ตัวเลข และสัญลักษณ์ ห้ามเว้นวรรค";
  }

  if (!/[a-z]/.test(newPassword)) {
    return "รหัสผ่านใหม่ต้องมีตัวพิมพ์เล็กอย่างน้อย 1 ตัว";
  }

  if (!/[A-Z]/.test(newPassword)) {
    return "รหัสผ่านใหม่ต้องมีตัวพิมพ์ใหญ่อย่างน้อย 1 ตัว";
  }

  if (!/[0-9]/.test(newPassword)) {
    return "รหัสผ่านใหม่ต้องมีตัวเลขอย่างน้อย 1 ตัว";
  }

  if (!SYMBOL_PATTERN.test(newPassword)) {
    return "รหัสผ่านใหม่ต้องมีสัญลักษณ์อย่างน้อย 1 ตัว";
  }

  if (!confirmPassword) {
    return "กรอกยืนยันรหัสผ่านใหม่";
  }

  if (newPassword !== confirmPassword) {
    return "รหัสผ่านใหม่ทั้งสองช่องต้องตรงกัน";
  }

  return null;
}
