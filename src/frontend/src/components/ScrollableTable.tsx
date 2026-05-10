import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { useRef } from "react";

interface ScrollableTableProps {
  children: ReactNode;
  className?: string;
}

const SCROLL_AMOUNT = 300;

export default function ScrollableTable({
  children,
  className = "",
}: ScrollableTableProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  function scrollLeft() {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: -SCROLL_AMOUNT, behavior: "smooth" });
    }
  }

  function scrollRight() {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: SCROLL_AMOUNT, behavior: "smooth" });
    }
  }

  return (
    <div className={`relative ${className}`} data-ocid="scrollable-table-wrap">
      {/* Left arrow */}
      <button
        type="button"
        onClick={scrollLeft}
        aria-label="Scroll table left"
        data-ocid="table-scroll-left"
        className="absolute left-0 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center w-10 h-10 rounded-full bg-cyan-500 text-white shadow-md hover:bg-cyan-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 -translate-x-1/2"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>

      {/* Right arrow */}
      <button
        type="button"
        onClick={scrollRight}
        aria-label="Scroll table right"
        data-ocid="table-scroll-right"
        className="absolute right-0 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center w-10 h-10 rounded-full bg-cyan-500 text-white shadow-md hover:bg-cyan-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 translate-x-1/2"
      >
        <ChevronRight className="w-5 h-5" />
      </button>

      {/* Left fade */}
      <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-background/60 to-transparent pointer-events-none z-[5]" />
      {/* Right fade */}
      <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background/60 to-transparent pointer-events-none z-[5]" />

      {/* Scrollable content */}
      <div
        ref={scrollRef}
        className="overflow-x-auto"
        style={{ scrollbarWidth: "thin" }}
      >
        {children}
      </div>
    </div>
  );
}
