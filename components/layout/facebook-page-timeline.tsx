"use client";

import { useEffect, useRef, useState } from "react";

interface FacebookPageTimelineProps {
  src: string;
}

export function FacebookPageTimeline({ src }: FacebookPageTimelineProps) {
  const containerRef = useRef<HTMLElement>(null);
  const [pluginWidth, setPluginWidth] = useState(500);

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
    </section>
  );
}
