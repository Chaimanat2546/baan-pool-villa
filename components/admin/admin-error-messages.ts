const ADMIN_ERROR_TRANSLATIONS = new Map<string, string>([
  ["access denied.", "ไม่มีสิทธิ์เข้าถึงข้อมูลนี้"],
  ["body must be an object.", "ข้อมูลที่ส่งมาต้องเป็นออบเจ็กต์"],
  ["body must contain a guide id.", "ข้อมูลที่ส่งมาต้องมีรหัสบทความ"],
  ["body must contain a guide object.", "ข้อมูลบทความที่ส่งมาไม่ครบ"],
  ["body must contain a legalpage object.", "ข้อมูลหน้ากฎหมายที่ส่งมาไม่ครบ"],
  ["email not confirmed", "อีเมลนี้ยังไม่ได้ยืนยัน กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ"],
  ["guide image role must be cover or inline.", "ประเภทตำแหน่งรูปบทความไม่ถูกต้อง"],
  ["invalid home section data.", "ข้อมูลส่วนหน้าแรกไม่ถูกต้อง"],
  ["invalid or expired supabase session. please sign in again.", "เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง"],
  ["missing bearer token.", "กรุณาเข้าสู่ระบบอีกครั้ง"],
  ["request body must be json.", "รูปแบบข้อมูลที่ส่งไม่ถูกต้อง"],
  ["request body must be multipart/form-data.", "รูปแบบข้อมูลอัปโหลดไม่ถูกต้อง"],
  ["sections must be an array.", "ข้อมูลส่วนหน้าแรกต้องเป็นรายการ"],
  ["at least one section is required.", "ต้องมีส่วนหน้าแรกอย่างน้อย 1 ส่วน"],
  ["signed-in user is not listed as an active home config admin.", "บัญชีนี้ยังไม่มีสิทธิ์แอดมินสำหรับจัดการเว็บไซต์"],
  ["unable to create detail layout settings.", "ไม่สามารถสร้างการตั้งค่า layout หน้า Details ได้"],
  ["unable to delete guide post.", "ไม่สามารถลบบทความได้"],
  ["unable to load detail layout.", "ไม่สามารถโหลด layout หน้า Details ได้"],
  ["unable to load guide posts.", "ไม่สามารถโหลดบทความได้"],
  ["unable to load guide slugs.", "ไม่สามารถตรวจสอบ slug บทความได้"],
  ["unable to load home sections.", "ไม่สามารถโหลดส่วนหน้าแรกได้"],
  ["unable to load legal pages.", "ไม่สามารถโหลดหน้ากฎหมายได้"],
  ["unable to load site settings.", "ไม่สามารถโหลดการตั้งค่าเว็บไซต์ได้"],
  ["unable to load tiktok settings.", "ไม่สามารถโหลดการตั้งค่า TikTok ได้"],
  ["unable to record guide image upload history.", "ไม่สามารถบันทึกประวัติการอัปโหลดรูปบทความได้"],
  ["unable to record site asset upload history.", "ไม่สามารถบันทึกประวัติการอัปโหลดไฟล์เว็บไซต์ได้"],
  ["unable to reload saved site settings.", "ไม่สามารถโหลดการตั้งค่าที่บันทึกแล้วได้"],
  ["unable to save detail layout.", "ไม่สามารถบันทึก layout หน้า Details ได้"],
  ["unable to save guide post.", "ไม่สามารถบันทึกบทความได้"],
  ["unable to save home sections.", "ไม่สามารถบันทึกส่วนหน้าแรกได้"],
  ["unable to save legal page.", "ไม่สามารถบันทึกหน้ากฎหมายได้"],
  ["unable to save site settings.", "ไม่สามารถบันทึกการตั้งค่าเว็บไซต์ได้"],
  ["unable to save tiktok settings.", "ไม่สามารถบันทึกการตั้งค่า TikTok ได้"],
  ["unable to upload guide image.", "ไม่สามารถอัปโหลดรูปบทความได้"],
  ["unauthorized", "กรุณาเข้าสู่ระบบอีกครั้ง"],
  ["unsupported external villa cache refresh scope.", "ขอบเขตการรีเฟรชข้อมูลบ้านพักไม่ถูกต้อง"],
  ["user already registered", "อีเมลนี้ถูกใช้งานในระบบแล้ว"],
]);

const ADMIN_ACCESS_ERROR_PREFIX = "unable to verify admin access:";

function normalizeMessageKey(message: string): string {
  return message.trim().toLowerCase();
}

export function translateAdminErrorMessage(message: string): string {
  const trimmedMessage = message.trim();
  const normalizedMessage = normalizeMessageKey(trimmedMessage);
  const exactMatch = ADMIN_ERROR_TRANSLATIONS.get(normalizedMessage);

  if (exactMatch) {
    return exactMatch;
  }

  if (normalizedMessage.startsWith(ADMIN_ACCESS_ERROR_PREFIX)) {
    const detail = trimmedMessage.slice("Unable to verify admin access:".length).trim();

    return detail
      ? `ตรวจสอบสิทธิ์แอดมินไม่สำเร็จ: ${translateAdminErrorDetail(detail)}`
      : "ตรวจสอบสิทธิ์แอดมินไม่สำเร็จ";
  }

  if (normalizedMessage === "failed to fetch") {
    return "เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง";
  }

  if (normalizedMessage.includes("rate limit")) {
    return "มีการพยายามหลายครั้งเกินไป กรุณารอสักครู่แล้วลองใหม่";
  }

  if (normalizedMessage.includes("violates row-level security")) {
    return "ไม่มีสิทธิ์บันทึกข้อมูลนี้";
  }

  if (normalizedMessage.includes("permission denied")) {
    return "สิทธิ์ฐานข้อมูลไม่เพียงพอ";
  }

  if (normalizedMessage.includes("duplicate key")) {
    return "มีข้อมูลซ้ำในระบบ";
  }

  if (normalizedMessage.endsWith(" must be an object.")) {
    return `${readLeadingLabel(trimmedMessage, " must be an object.")} ต้องเป็นออบเจ็กต์`;
  }

  if (normalizedMessage.endsWith(" must be an array.")) {
    return `${readLeadingLabel(trimmedMessage, " must be an array.")} ต้องเป็นรายการ`;
  }

  if (normalizedMessage.endsWith(" must be a string.")) {
    return `${readLeadingLabel(trimmedMessage, " must be a string.")} ต้องเป็นข้อความ`;
  }

  if (normalizedMessage.endsWith(" must be a boolean.")) {
    return `${readLeadingLabel(trimmedMessage, " must be a boolean.")} ต้องเป็นค่าเปิด/ปิด`;
  }

  if (normalizedMessage.endsWith(" must be a number.")) {
    return `${readLeadingLabel(trimmedMessage, " must be a number.")} ต้องเป็นตัวเลข`;
  }

  return trimmedMessage;
}

export function formatAdminErrorMessage(
  message: string,
  detailParts: string[] = [],
): string {
  const translatedMessage = translateAdminErrorMessage(message);

  return detailParts.length > 0
    ? `${translatedMessage} (${detailParts.join(" / ")})`
    : translatedMessage;
}

export function getAdminErrorMessage(
  caughtError: unknown,
  fallback: string,
): string {
  return caughtError instanceof Error
    ? translateAdminErrorMessage(caughtError.message)
    : fallback;
}

export function translateAdminErrorMessages(errors: string[]): string[] {
  return errors.map(translateAdminErrorMessage);
}

function translateAdminErrorDetail(detail: string): string {
  const normalizedDetail = normalizeMessageKey(detail);

  if (normalizedDetail.includes("permission denied")) {
    return "สิทธิ์ฐานข้อมูลไม่เพียงพอ";
  }

  return detail;
}

function readLeadingLabel(message: string, suffix: string): string {
  return message.slice(0, Math.max(0, message.length - suffix.length)).trim();
}
