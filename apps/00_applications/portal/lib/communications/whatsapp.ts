/** Opens WhatsApp Web in a dedicated side window (ops comms). */
export function openWhatsAppWebWindow() {
  if (typeof window === "undefined") return;

  window.open(
    "https://web.whatsapp.com",
    "whatsapp-web",
    `width=400,height=${window.innerHeight},left=${window.screen.width - 400},top=0`,
  );
}

/** Opens WhatsApp in the in-app split pane. */
export function openWhatsAppSplitView() {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent("open-split-view", {
      detail: { service: "whatsapp" },
    }),
  );
}
