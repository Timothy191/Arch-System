import { useNavigationState } from "./useNavigationState";

describe("useNavigationState", () => {
  beforeEach(() => {
    useNavigationState.setState({
      scrollY: 0,
      activeSection: "function",
      hoveredElement: null,
      activeDepartment: null,
    });
  });

  it("exposes default state", () => {
    expect(useNavigationState.getState()).toMatchObject({
      scrollY: 0,
      activeSection: "function",
      hoveredElement: null,
      activeDepartment: null,
    });
  });

  it("setScrollY updates the scroll position", () => {
    useNavigationState.getState().setScrollY(420);
    expect(useNavigationState.getState().scrollY).toBe(420);
  });

  it("setActiveSection toggles between function and content", () => {
    useNavigationState.getState().setActiveSection("content");
    expect(useNavigationState.getState().activeSection).toBe("content");
    useNavigationState.getState().setActiveSection("function");
    expect(useNavigationState.getState().activeSection).toBe("function");
  });

  it("setHoveredElement stores and clears the hovered element", () => {
    useNavigationState.getState().setHoveredElement("drilling-card");
    expect(useNavigationState.getState().hoveredElement).toBe("drilling-card");
    useNavigationState.getState().setHoveredElement(null);
    expect(useNavigationState.getState().hoveredElement).toBeNull();
  });

  it("setActiveDepartment stores the department", () => {
    useNavigationState.getState().setActiveDepartment("control-room");
    expect(useNavigationState.getState().activeDepartment).toBe("control-room");
  });
});
