import { act } from "react";
import type { ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

type FetchResponse = {
  body: unknown;
  status?: number;
};

type FetchRoute = {
  body: unknown;
  method?: string;
  status?: number;
  url: string;
};

export function makeJsonResponse({
  body,
  status = 200,
}: FetchResponse): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

export function makeFetchMock(routes: FetchRoute[]) {
  return vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const requestUrl = input instanceof Request ? input.url : String(input);
    const requestMethod = input instanceof Request
      ? input.method
      : init?.method ?? "GET";
    const route = routes.find((candidate) => {
      return (
        candidate.url === requestUrl &&
        (candidate.method ?? "GET") === requestMethod
      );
    });

    if (!route) {
      return Promise.resolve(
        makeJsonResponse({
          body: { error: `Unhandled ${requestMethod} ${requestUrl}` },
          status: 500,
        }),
      );
    }

    return Promise.resolve(makeJsonResponse(route));
  });
}

export async function flushEffects() {
  await Promise.resolve();
  await Promise.resolve();
  if (vi.isFakeTimers()) {
    return;
  }

  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

export async function mountAdminPage(element: ReactElement) {
  const container = document.createElement("div");
  document.body.append(container);

  const root = createRoot(container);

  act(() => {
    root.render(element);
  });
  await flushEffects();

  return {
    container,
    async unmount() {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

export async function click(element: HTMLElement) {
  act(() => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await flushEffects();
}

export async function changeInput(element: HTMLInputElement, value: string) {
  act(() => {
    const valueSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;

    valueSetter?.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await flushEffects();
}
