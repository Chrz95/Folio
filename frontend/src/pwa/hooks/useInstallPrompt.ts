import { useState, useEffect } from 'react';
import { PWA } from '../pwa.constants';
interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
/** Capture install eligibility without interrupting the user's first visit.
 * @returns {object} User-driven installation and dismissal controls. */
export function useInstallPrompt() {
  const [event, setEvent] = useState<InstallEvent | null>(null);
  const [isDismissed, setDismissed] = useState(
    () => Date.now() - Number(localStorage.getItem(PWA.dismissalKey) ?? 0) < PWA.dismissalExpiry,
  );
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator && Boolean(navigator.standalone));
  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent);
  useEffect(() => {
    /** Retain the browser-provided install invitation until a user asks for it.
     * @param {Event} installEvent - Browser install event. */
    function capture(installEvent: Event) {
      installEvent.preventDefault();
      setEvent(installEvent as InstallEvent);
    }
    /** Hide the install action after a successful installation. */
    function installed() {
      setEvent(null);
      setDismissed(true);
    }
    window.addEventListener('beforeinstallprompt', capture);
    window.addEventListener('appinstalled', installed);
    return () => {
      window.removeEventListener('beforeinstallprompt', capture);
      window.removeEventListener('appinstalled', installed);
    };
  }, []);
  /** Open the native install prompt only after an explicit button action.
   * @returns {Promise<void>} Tracks a dismissal without repeated prompting. */
  async function install() {
    if (!event) {
      return;
    }
    await event.prompt();
    const choice = await event.userChoice;
    if (choice.outcome === 'dismissed') {
      dismiss();
    }
    setEvent(null);
  }
  /** Remember a temporary dismissal without touching financial data. */
  function dismiss() {
    setDismissed(true);
    localStorage.setItem(PWA.dismissalKey, String(Date.now()));
  }
  return {
    canInstall: Boolean(event) && !isStandalone && !isDismissed,
    showIosHint: isIos && !isStandalone && !isDismissed,
    install,
    dismiss,
  };
}
