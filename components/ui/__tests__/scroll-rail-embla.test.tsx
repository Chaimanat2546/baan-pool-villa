/**
 * @vitest-environment jsdom
 */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { autoScrollPlugin, useEmblaCarousel } = vi.hoisted(() => ({
  autoScrollPlugin: vi.fn(() => ({})),
  useEmblaCarousel: vi.fn(),
}));

vi.mock("embla-carousel-react", () => ({
  default: useEmblaCarousel,
}));

vi.mock("embla-carousel-auto-scroll", () => ({
  default: autoScrollPlugin,
}));

import { ScrollRail } from "../scroll-rail";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("ScrollRail Embla controls", () => {
  const scrollNext = vi.fn();
  const scrollPrev = vi.fn();
  const stopAutoScroll = vi.fn();
  const playAutoScroll = vi.fn();
  const selectedScrollSnap = vi.fn(() => 0);
  const emblaOn = vi.fn();
  const emblaOff = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("matchMedia", () => ({
      addEventListener: vi.fn(),
      matches: false,
      removeEventListener: vi.fn(),
    }));
    scrollNext.mockReset();
    scrollPrev.mockReset();
    stopAutoScroll.mockReset();
    playAutoScroll.mockReset();
    selectedScrollSnap.mockReset();
    selectedScrollSnap.mockReturnValue(0);
    emblaOn.mockReset();
    emblaOff.mockReset();
    useEmblaCarousel.mockReset();
    useEmblaCarousel.mockReturnValue([
      vi.fn(),
      {
        canScrollNext: () => true,
        canScrollPrev: () => true,
        off: emblaOff,
        on: emblaOn,
        plugins: () => ({
          autoScroll: { play: playAutoScroll, stop: stopAutoScroll },
        }),
        scrollNext,
        scrollPrev,
        selectedScrollSnap,
      },
    ]);
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
  });

  it("moves the rail using Embla previous and next controls", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    document.body.append(container);

    await act(async () => {
      root.render(
        <ScrollRail label={"\u0e1a\u0e49\u0e32\u0e19\u0e1e\u0e31\u0e01"}>
          <div>Card</div>
        </ScrollRail>,
      );
    });

    expect(useEmblaCarousel).toHaveBeenCalledWith(
      expect.objectContaining({ axis: "x", loop: false }),
      expect.any(Array),
    );

    const buttons = container.querySelectorAll<HTMLButtonElement>("button");

    await act(async () => {
      buttons[0]?.click();
      buttons[1]?.click();
    });

    expect(scrollPrev).toHaveBeenCalledTimes(1);
    expect(scrollNext).toHaveBeenCalledTimes(1);

    await act(async () => {
      root.unmount();
    });
  });

  it("does not drag the parent rail from a nested gallery", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    document.body.append(container);

    await act(async () => {
      root.render(
        <ScrollRail label={"\u0e1a\u0e49\u0e32\u0e19\u0e1e\u0e31\u0e01"}>
          <div>Card</div>
        </ScrollRail>,
      );
    });

    const options = useEmblaCarousel.mock.calls.at(-1)?.[0];
    const galleryTarget = document.createElement("button");
    galleryTarget.setAttribute("data-scroll-rail-ignore-drag", "true");

    expect(options.watchDrag).toEqual(expect.any(Function));
    expect(options.watchDrag(null, { target: galleryTarget })).toBe(false);

    await act(async () => {
      root.unmount();
    });
  });
  it("pauses auto-scroll before manual arrows and resumes after four seconds", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    document.body.append(container);

    await act(async () => {
      root.render(
        <ScrollRail autoScroll label={"\u0e1a\u0e49\u0e32\u0e19\u0e1e\u0e31\u0e01"}>
          <div>Card</div>
        </ScrollRail>,
      );
    });

    const buttons = container.querySelectorAll<HTMLButtonElement>("button");

    await act(async () => {
      buttons[1]?.click();
    });

    expect(stopAutoScroll).toHaveBeenCalledTimes(1);
    expect(playAutoScroll).toHaveBeenCalledWith(4_000);
    expect(scrollNext).toHaveBeenCalledTimes(1);

    await act(async () => {
      root.unmount();
    });
  });

  it("pauses auto-scroll while the pointer hovers and resumes after it leaves", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    document.body.append(container);

    await act(async () => {
      root.render(
        <ScrollRail autoScroll label={"\u0e1a\u0e49\u0e32\u0e19\u0e1e\u0e31\u0e01"}>
          <div>Card</div>
        </ScrollRail>,
      );
    });

    const viewport = container.querySelector("[data-scroll-rail-viewport]");

    await act(async () => {
      viewport?.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    });
    expect(stopAutoScroll).toHaveBeenCalledTimes(1);

    await act(async () => {
      viewport?.dispatchEvent(new MouseEvent("mouseout", { bubbles: true }));
    });
    expect(playAutoScroll).toHaveBeenCalledWith(4_000);

    await act(async () => {
      root.unmount();
    });
  });

  it("suppresses a card click after a mouse drag but preserves intentional clicks", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    const onCardClick = vi.fn();
    document.body.append(container);

    await act(async () => {
      root.render(
        <ScrollRail label="บ้านพัก">
          <a
            href="/villas/1"
            onClick={(event) => {
              event.preventDefault();
              onCardClick();
            }}
          >
            Card
          </a>
        </ScrollRail>,
      );
    });

    const card = container.querySelector<HTMLAnchorElement>('a[href="/villas/1"]');
    card?.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, clientX: 0, clientY: 0 }));
    card?.dispatchEvent(new MouseEvent("pointermove", { bubbles: true, clientX: 12, clientY: 0 }));
    card?.dispatchEvent(new MouseEvent("pointerup", { bubbles: true, clientX: 12, clientY: 0 }));
    card?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    expect(onCardClick).not.toHaveBeenCalled();

    card?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    expect(onCardClick).toHaveBeenCalledTimes(1);

    await act(async () => root.unmount());
  });

  it("reports the active Embla snap and cleans up its select listener", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    const onActiveIndexChange = vi.fn();
    document.body.append(container);

    await act(async () => {
      root.render(
        <ScrollRail
          label={"\u0e1a\u0e49\u0e32\u0e19\u0e1e\u0e31\u0e01"}
          onActiveIndexChange={onActiveIndexChange}
        >
          <div>Card</div>
        </ScrollRail>,
      );
    });

    expect(onActiveIndexChange).toHaveBeenCalledWith(0);
    expect(emblaOn).toHaveBeenCalledWith("select", expect.any(Function));
    const onSelect = emblaOn.mock.calls[0]?.[1];

    selectedScrollSnap.mockReturnValue(2);
    await act(async () => {
      onSelect?.();
    });
    expect(onActiveIndexChange).toHaveBeenLastCalledWith(2);

    await act(async () => {
      root.unmount();
    });
    expect(emblaOff).toHaveBeenCalledWith("select", onSelect);
  });
});

it("configures official auto-scroll only when the rail is enabled", async () => {
  const container = document.createElement("div");
  const root = createRoot(container);
  document.body.append(container);

  autoScrollPlugin.mockClear();
  vi.stubGlobal("matchMedia", () => ({
    addEventListener: vi.fn(),
    matches: false,
    removeEventListener: vi.fn(),
  }));
  await act(async () => {
    root.render(
      <ScrollRail
        autoScroll
        label={"\u0e1a\u0e49\u0e32\u0e19\u0e1e\u0e31\u0e01"}
      >
        <div>Card</div>
      </ScrollRail>,
    );
  });

  expect(autoScrollPlugin).toHaveBeenCalledWith(
    expect.objectContaining({
      speed: 0.35,
      stopOnFocusIn: false,
      stopOnInteraction: true,
      stopOnMouseEnter: false,
    }),
  );
  expect(useEmblaCarousel).toHaveBeenLastCalledWith(
    expect.objectContaining({
      containScroll: "trimSnaps",
      loop: false,
    }),
    expect.any(Array),
  );

  await act(async () => {
    root.unmount();
  });
});
