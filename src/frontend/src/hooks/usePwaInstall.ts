import { useCallback, useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISSED_KEY = "pwa-install-dismissed";
const DISMISSED_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function isDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    if (!raw) return false;
    const ts = Number.parseInt(raw, 10);
    return Date.now() - ts < DISMISSED_TTL_MS;
  } catch {
    return false;
  }
}

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState<boolean>(isDismissed);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const installedHandler = () => setInstalled(true);

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", installedHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setInstalled(true);
    }
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  const dismissInstall = useCallback(() => {
    try {
      localStorage.setItem(DISMISSED_KEY, Date.now().toString());
    } catch {
      // ignore storage errors
    }
    setDismissed(true);
  }, []);

  const canInstall = !!deferredPrompt && !dismissed && !installed;

  return { canInstall, promptInstall, dismissInstall };
}
