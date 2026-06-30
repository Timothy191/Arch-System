import { openWhatsAppSplitView, openWhatsAppWebWindow } from "./whatsapp";

describe("whatsapp communications", () => {
  const openSpy = jest.fn();
  const dispatchSpy = jest.fn();

  beforeEach(() => {
    openSpy.mockReset();
    dispatchSpy.mockReset();
    window.open = openSpy;
    window.dispatchEvent = dispatchSpy;
    Object.defineProperty(window, "innerHeight", { value: 900, configurable: true });
    Object.defineProperty(window.screen, "width", { value: 1440, configurable: true });
  });

  it("opens WhatsApp Web in a side window", () => {
    openWhatsAppWebWindow();
    expect(openSpy).toHaveBeenCalledWith(
      "https://web.whatsapp.com",
      "whatsapp-web",
      "width=400,height=900,left=1040,top=0",
    );
  });

  it("dispatches split-view event for in-app pane", () => {
    openWhatsAppSplitView();
    expect(dispatchSpy).toHaveBeenCalled();
    const event = dispatchSpy.mock.calls[0]?.[0] as CustomEvent<{ service: string }>;
    expect(event.type).toBe("open-split-view");
    expect(event.detail.service).toBe("whatsapp");
  });
});
