import { useEffect } from "react";

export function useLockedBodyScroll(active: boolean) {
  useEffect(() => {
    if (!active) {
      return;
    }

    document.body.classList.add("body-scroll-locked");

    return () => {
      document.body.classList.remove("body-scroll-locked");
    };
  }, [active]);
}
