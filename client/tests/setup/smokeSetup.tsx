/**
 * Global test setup.
 *
 * Registered for every suite, but every browser-facing block is guarded on
 * `document` so the existing `environment: "node"` pure-function suites are
 * unaffected. Route smoke tests opt into jsdom with a file-level docblock:
 *
 *   // @vitest-environment jsdom
 */
import type { ReactNode } from "react";
import { vi } from "vitest";

const isBrowserLike = typeof document !== "undefined";

/* ------------------------------------------------------------------ *
 * Module mocks — hoisted by vitest, so these must be top-level and
 * cannot be wrapped in the `isBrowserLike` guard. They are inert in
 * node-env suites because nothing there imports these modules.
 * ------------------------------------------------------------------ */

// Router. Surface verified against next@16.1.6
// node_modules/next/dist/client/components/navigation.d.ts
// Mutable state lives in ./navState so it can be imported by tests; the factory
// resolves it lazily at first import of `next/navigation`.
vi.mock("next/navigation", async () => {
  const { navState } = await import("./navState");
  return {
    useRouter: () => navState.router,
    usePathname: () => navState.pathname,
    useSearchParams: () => navState.searchParams,
    useParams: () => navState.params,
    useSelectedLayoutSegment: () => null,
    useSelectedLayoutSegments: () => [],
    notFound: vi.fn(),
    redirect: vi.fn(),
    permanentRedirect: vi.fn(),
    forbidden: vi.fn(),
    unauthorized: vi.fn(),
  };
});

// `next/link` needs router context it will not get in a bare render.
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string | { pathname?: string };
    children?: ReactNode;
  }) => {
    const to = typeof href === "string" ? href : (href?.pathname ?? "");
    return (
      <a href={to} {...rest}>
        {children}
      </a>
    );
  },
}));

// Strip the Next-only props before they reach a bare <img>, otherwise React
// warns ("Received `true` for a non-boolean attribute `fill`") and pollutes the
// console-error assertion in renderRoute.
const NEXT_IMAGE_ONLY_PROPS = [
  "fill",
  "priority",
  "quality",
  "placeholder",
  "blurDataURL",
  "loader",
  "unoptimized",
  "overrideSrc",
  "onLoadingComplete",
];

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    const safe: Record<string, unknown> = { ...props };
    for (const p of NEXT_IMAGE_ONLY_PROPS) delete safe[p];
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...safe} />;
  },
}));

// HTTP. There is no single choke point in this codebase: 20 service modules go
// through the shared axios instance, but 2 files import `axios` directly and
// 10+ use raw `fetch`. Both paths are stubbed.
const axiosResponse = () => Promise.resolve({ data: {}, status: 200 });

vi.mock("@/lib/api/axios", () => ({
  API_BASE_URL: "http://test.local/api",
  default: {
    get: vi.fn(axiosResponse),
    post: vi.fn(axiosResponse),
    put: vi.fn(axiosResponse),
    patch: vi.fn(axiosResponse),
    delete: vi.fn(axiosResponse),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  },
}));

vi.mock("socket.io-client", () => ({
  io: () => ({
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    connected: false,
  }),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
    custom: vi.fn(),
  }),
  Toaster: () => null,
}));

/* ------------------------------------------------------------------ *
 * Browser globals jsdom does not implement
 * ------------------------------------------------------------------ */

if (isBrowserLike) {
  await import("@testing-library/jest-dom/vitest");
  const { cleanup } = await import("@testing-library/react");
  const { afterEach, beforeEach } = await import("vitest");

  class NoopObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  }

  vi.stubGlobal("IntersectionObserver", NoopObserver);
  vi.stubGlobal("ResizeObserver", NoopObserver);

  if (!window.matchMedia) {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  }

  // jsdom has no layout engine; framer-motion and chart code touch these.
  if (!Element.prototype.getAnimations) {
    Element.prototype.getAnimations = () => [];
  }
  if (!window.scrollTo) {
    vi.stubGlobal("scrollTo", vi.fn());
  }

  beforeEach(async () => {
    // Raw `fetch` callers get an empty-but-valid JSON envelope.
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({}),
          text: () => Promise.resolve(""),
          headers: new Headers(),
        }),
      ),
    );
    localStorage.clear();
    (await import("./navState")).resetNavState();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });
}
