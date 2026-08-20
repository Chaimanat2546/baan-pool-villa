"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

export const ImageActivationContext = createContext(true);

export function useImageActivation(): boolean {
  return useContext(ImageActivationContext);
}

export function NearViewportActivation({
  children,
  initiallyActive = false,
  rootMargin = "1000px",
}: {
  children: ReactNode;
  initiallyActive?: boolean;
  rootMargin?: string;
}): ReactNode {
  const [active, setActive] = useState(initiallyActive);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (active) {
      return;
    }

    if (typeof IntersectionObserver === "undefined") {
      const timeout = globalThis.setTimeout(() => setActive(true), 0);

      return () => globalThis.clearTimeout(timeout);
    }

    const root = rootRef.current;
    if (!root) {
      return;
    }

    let disconnect = () => undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setActive(true);
          disconnect();
        }
      },
      { rootMargin },
    );

    let disconnected = false;
    disconnect = () => {
      if (!disconnected) {
        disconnected = true;
        observer.disconnect();
      }
    };

    observer.observe(root);
    return disconnect;
  }, [active, rootMargin]);

  return (
    <div ref={rootRef} data-near-viewport-activation>
      <ImageActivationContext value={active}>{children}</ImageActivationContext>
    </div>
  );
}
