import { ArrowUp } from "lucide-react";
import { useEffect, useState } from "react";

export default function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function onScroll() {
      setVisible(window.scrollY > 300);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={scrollToTop}
      aria-label="Scroll to top"
      data-ocid="scroll-to-top"
      className="fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-50 flex items-center justify-center w-12 h-12 rounded-full bg-cyan-500/90 hover:bg-cyan-500 text-white shadow-lg backdrop-blur-sm transition-all duration-200 hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2"
    >
      <ArrowUp className="w-5 h-5" />
    </button>
  );
}
