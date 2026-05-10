import { ArrowDown } from "lucide-react";
import type { RefObject } from "react";

interface ScrollToBottomProps {
  targetRef?: RefObject<HTMLElement | null>;
  label?: string;
}

export default function ScrollToBottom({
  targetRef,
  label = "Jump to bottom",
}: ScrollToBottomProps) {
  function handleClick() {
    if (targetRef?.current) {
      targetRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    } else {
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={label}
      data-ocid="scroll-to-bottom"
      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-cyan-500/90 hover:bg-cyan-500 text-white text-xs font-medium shadow transition-all duration-200 hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 min-h-[44px] min-w-[44px] justify-center"
    >
      <ArrowDown className="w-4 h-4" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
