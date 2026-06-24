"use client";

import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ShareButton({ title }: { title?: string }) {
  async function handleShare() {
    const url = window.location.href;

    if (navigator.share) {
      await navigator.share({
        title: title || document.title,
        url,
      });
      return;
    }

    await navigator.clipboard.writeText(url);
  }

  return (
    <Button variant="outline" size="sm" onClick={handleShare}>
      <Share2 data-icon="inline-start" />
      แชร์
    </Button>
  );
}