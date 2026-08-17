import { useFocusMode } from "./useFocusMode";

describe("useFocusMode", () => {
  beforeEach(() => {
    localStorage.clear();
    useFocusMode.setState({ enabled: false });
  });

  it("starts disabled", () => {
    expect(useFocusMode.getState().enabled).toBe(false);
  });

  it("toggle flips the enabled flag", () => {
    useFocusMode.getState().toggle();
    expect(useFocusMode.getState().enabled).toBe(true);
    useFocusMode.getState().toggle();
    expect(useFocusMode.getState().enabled).toBe(false);
  });

  it("setEnabled sets the value explicitly", () => {
    useFocusMode.getState().setEnabled(true);
    expect(useFocusMode.getState().enabled).toBe(true);
    useFocusMode.getState().setEnabled(false);
    expect(useFocusMode.getState().enabled).toBe(false);
  });
});
