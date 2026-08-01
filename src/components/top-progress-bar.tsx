"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

// Next.js's App Router doesn't expose navigation start/end events, so this
// approximates them: start on any same-origin, unmodified <a> click, finish
// once the route (pathname or search params) actually changes underneath us.
export function TopProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // A route change means whatever navigation was in flight has completed —
  // finish and hide the bar. Runs on mount too, but there's nothing to
  // finish yet since progress starts at 0.
  useEffect(() => {
    const finish = setTimeout(() => {
      if (!timerRef.current) return;
      clearInterval(timerRef.current);
      timerRef.current = null;
      setProgress(100);
      setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 200);
    }, 0);
    return () => clearTimeout(finish);
  }, [pathname, searchParams]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const anchor = (e.target as HTMLElement)?.closest("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;

      const currentSearch = searchParams.toString();
      const currentUrl = `${pathname}${currentSearch ? `?${currentSearch}` : ""}`;
      if (`${url.pathname}${url.search}` === currentUrl) return;

      if (timerRef.current) clearInterval(timerRef.current);
      setVisible(true);
      setProgress(15);
      timerRef.current = setInterval(() => {
        setProgress((p) => (p < 90 ? p + (90 - p) * 0.1 : p));
      }, 150);
    }

    // Capture phase: must run before Next.js's <Link> onClick handler,
    // which calls preventDefault() to do its own client-side navigation —
    // by the bubble phase (a plain addEventListener default) that's
    // already happened and there'd be nothing left to detect.
    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [pathname, searchParams]);

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-50 h-1 bg-transparent">
      <div className="h-full bg-indigo-600 transition-all duration-200 ease-out" style={{ width: `${progress}%` }} />
    </div>
  );
}
