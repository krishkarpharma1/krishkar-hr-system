/**
 * ScrollButtons — floating Scroll to Top and Scroll to Bottom buttons.
 * - Scroll to Top: appears after user scrolls 300px down in the page content.
 * - Scroll to Bottom: always visible (per user preferences for long-form pages).
 * Styled with the Aqua Blue primary theme color.
 *
 * Automatically finds the scrollable PageContent container via [data-scroll-container].
 */
import { ArrowDown, ArrowUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function ScrollButtons() {
  const [showTop, setShowTop] = useState(false);
  const containerRef = useRef<Element | null>(null);

  useEffect(() => {
    // Find the scroll container once mounted
    const findContainer = () => {
      const el = document.querySelector("[data-scroll-container]");
      containerRef.current = el;
      return el;
    };

    const el = findContainer();
    if (!el) return;

    function onScroll() {
      const scrollEl = containerRef.current;
      if (!scrollEl) return;
      setShowTop(scrollEl.scrollTop > 300);
    }

    el.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  function scrollToTop() {
    const el =
      containerRef.current ?? document.querySelector("[data-scroll-container]");
    if (el) {
      el.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function scrollToBottom() {
    const el =
      containerRef.current ?? document.querySelector("[data-scroll-container]");
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  }

  const btnBase =
    "flex items-center justify-center w-12 h-12 rounded-full shadow-lg transition-all duration-200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary bg-primary text-primary-foreground hover:opacity-90";

  return (
    <div
      className="fixed bottom-5 right-4 z-50 flex flex-col gap-2"
      aria-label="Page scroll controls"
    >
      {/* Scroll to Bottom — always visible per user preferences */}
      <button
        type="button"
        aria-label="Scroll to bottom"
        className={btnBase}
        onClick={scrollToBottom}
        data-ocid="btn-scroll-to-bottom"
      >
        <ArrowDown className="w-5 h-5" />
      </button>

      {/* Scroll to Top — appears once user scrolls 300px */}
      <button
        type="button"
        aria-label="Scroll to top"
        className={`${btnBase} transition-opacity duration-200 ${showTop ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        onClick={scrollToTop}
        data-ocid="btn-scroll-to-top"
        tabIndex={showTop ? 0 : -1}
      >
        <ArrowUp className="w-5 h-5" />
      </button>
    </div>
  );
}
