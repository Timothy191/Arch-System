import { render, waitFor } from "@testing-library/react";
import UniverSheet from "./UniverSheet";

jest.mock("@univerjs/presets", () => ({
  createUniver: jest.fn(() => ({
    univerAPI: {
      createWorkbook: jest.fn(() => ({ id: "mock-workbook" })),
      dispose: jest.fn(),
    },
  })),
  LocaleType: { EN_US: "en-US" },
  mergeLocales: jest.fn((locales) => locales),
}));

jest.mock("@univerjs/preset-sheets-core", () => ({
  UniverSheetsCorePreset: jest.fn((config) => ({
    name: "sheets-core",
    ...config,
  })),
}));

jest.mock(
  "@univerjs/preset-sheets-core/locales/en-US",
  () => ({
    __esModule: true,
    default: { enUS: true },
  }),
  { virtual: true },
);

jest.mock("@univerjs/preset-sheets-core/lib/index.css", () => ({}), {
  virtual: true,
});

describe("UniverSheet", () => {
  it("renders a container div", () => {
    const { container } = render(<UniverSheet id="test-sheet" />);
    const div = container.querySelector("#test-sheet");
    expect(div).toBeInTheDocument();
  });

  it("calls onReady with the workbook when ready", async () => {
    const onReady = jest.fn();
    const { createUniver } = jest.requireMock("@univerjs/presets");
    const mockWorkbook = { id: "test-workbook" };

    createUniver.mockReturnValue({
      univerAPI: {
        createWorkbook: jest.fn(() => mockWorkbook),
        dispose: jest.fn(),
      },
    });

    render(<UniverSheet onReady={onReady} />);

    await waitFor(() => {
      expect(onReady).toHaveBeenCalledWith(mockWorkbook);
    });
  });

  it("disposes the univerAPI on unmount", () => {
    const { createUniver } = jest.requireMock("@univerjs/presets");
    const dispose = jest.fn();

    createUniver.mockReturnValue({
      univerAPI: {
        createWorkbook: jest.fn(),
        dispose,
      },
    });

    const { unmount } = render(<UniverSheet />);
    unmount();

    expect(dispose).toHaveBeenCalled();
  });
});
