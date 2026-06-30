import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConversationalBar } from "./ConversationalBar";

jest.mock("@/hooks/useSplitWindow", () => ({
  useSplitWindow: (selector: (state: { isOpen: boolean }) => unknown) =>
    selector({ isOpen: false }),
}));

describe("ConversationalBar", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        mode: "browser",
        model: null,
        integratedReady: false,
        browserProviders: [
          {
            id: "groq",
            label: "Groq",
            url: "https://chat.groq.com/",
            description: "Fast open models",
          },
        ],
      }),
    }) as jest.Mock;
  });

  it("renders after config loads", async () => {
    render(<ConversationalBar />);
    expect(await screen.findByTestId("conversational-bar")).toBeInTheDocument();
    expect(screen.getByLabelText("Ask Arch Agent")).toBeInTheDocument();
  });

  it("expands and stores browser-mode prompts locally", async () => {
    const user = userEvent.setup();
    render(<ConversationalBar />);

    const input = await screen.findByLabelText("Ask Arch Agent");
    await user.type(input, "Shift A tonnage variance?");
    await user.click(screen.getByLabelText("Send to Arch Agent"));

    await waitFor(() => {
      expect(screen.getByText("Shift A tonnage variance?")).toBeInTheDocument();
    });
    expect(screen.getByText("Operator")).toBeInTheDocument();
  });
});
