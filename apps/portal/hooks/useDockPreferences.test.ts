import { useDockPreferences } from "./useDockPreferences";

describe("useDockPreferences", () => {
  beforeEach(() => {
    localStorage.clear();
    useDockPreferences.setState({ autoHide: true });
  });

  it("defaults to autoHide enabled", () => {
    expect(useDockPreferences.getState().autoHide).toBe(true);
  });

  it("toggleAutoHide flips the autoHide flag", () => {
    useDockPreferences.getState().toggleAutoHide();
    expect(useDockPreferences.getState().autoHide).toBe(false);
    useDockPreferences.getState().toggleAutoHide();
    expect(useDockPreferences.getState().autoHide).toBe(true);
  });

  it("setAutoHide sets the value explicitly", () => {
    useDockPreferences.getState().setAutoHide(false);
    expect(useDockPreferences.getState().autoHide).toBe(false);
    useDockPreferences.getState().setAutoHide(true);
    expect(useDockPreferences.getState().autoHide).toBe(true);
  });
});
