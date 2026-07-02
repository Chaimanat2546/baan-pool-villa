"use client";

import { useEffect } from "react";

export function getAdminRecoveryHashRedirect(hash: string): string | null {
  const hashParams = new URLSearchParams(hash.replace(/^#/, ""));

  if (
    hashParams.get("type") !== "recovery" ||
    !hashParams.get("access_token")
  ) {
    return null;
  }

  return `/admin/reset-password${hash}`;
}

export function AdminRecoveryHashRedirect() {
  useEffect(() => {
    const redirectPath = getAdminRecoveryHashRedirect(window.location.hash);

    if (redirectPath) {
      window.location.replace(redirectPath);
    }
  }, []);

  return null;
}
