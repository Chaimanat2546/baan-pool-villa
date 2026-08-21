"use client";

import { useEffect, useRef, useState } from "react";

interface FacebookPageTimelineProps {
  src: string;
}

export function FacebookPageTimeline({ src }: FacebookPageTimelineProps) {
  const containerRef = useRef<HTMLElement>(null);
  const [isTimelineActive, setIsTimelineActive] = useState(false);
  const [pluginWidth, setPluginWidth] = useState(500);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) return;

    if (typeof IntersectionObserver !== "function") {
      const timeout = globalThis.setTimeout(() => setIsTimelineActive(true), 0);

      return () => globalThis.clearTimeout(timeout);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setIsTimelineActive(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px" },
    );

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const updatePluginWidth = () => {
      const containerWidth = containerRef.current?.clientWidth;
      if (!containerWidth) return;

      setPluginWidth(Math.min(500, Math.max(180, Math.floor(containerWidth))));
    };

    updatePluginWidth();
    window.addEventListener("resize", updatePluginWidth);
    return () => window.removeEventListener("resize", updatePluginWidth);
  }, []);

  const pluginUrl = new URL(src);
  pluginUrl.searchParams.set("width", String(pluginWidth));

  return (
    <section
      ref={containerRef}
      aria-label="โพสต์ล่าสุดจาก Facebook"
      className="max-w-[500px] lg:col-start-1 lg:row-start-2 lg:-mt-5"
    >
      {isTimelineActive ? (
        <iframe
          allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
          className="block w-full overflow-hidden rounded-sm border-0 bg-white"
          height="500"
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          src={pluginUrl.toString()}
          title="โพสต์ล่าสุดจาก Facebook"
          width={pluginWidth}
        />
      ) : (
        <div
          aria-hidden="true"
          className="h-[500px] w-full rounded-sm bg-white/10"
          data-facebook-timeline-pending
        />
      )}
    </section>
  );
}
