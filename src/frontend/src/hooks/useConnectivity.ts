import { useEffect, useRef, useState } from "react";
export function useConnectivity(): { isOnline: boolean } {
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const checkConnectivity = async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      try {
        await fetch("/", {
          method: "HEAD",
          signal: controller.signal,
          cache: "no-store",
        });
        clearTimeout(timeoutId);
        setIsOnline(true);
      } catch {
        clearTimeout(timeoutId);
        setIsOnline(false);
      }
    };
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    intervalRef.current = setInterval(checkConnectivity, 30000);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);
  return { isOnline };
}
