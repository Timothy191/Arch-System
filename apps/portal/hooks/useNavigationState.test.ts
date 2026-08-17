import { useNavigationState } from "./useNavigationState";

describe("useNavigationState", () => {
  beforeEach(() => {
    useNavigationState.setState({
      scrollY: 0,
      activeSection: "function",
      hoveredElement: null,
      activeDepartment: null,
      previousDepartment: null,
      departmentHistory: [],
    });
  });

  it("exposes default state", () => {
    expect(useNavigationState.getState()).toMatchObject({
      scrollY: 0,
      activeSection: "function",
      hoveredElement: null,
      activeDepartment: null,
      previousDepartment: null,
      departmentHistory: [],
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

  it("setActiveDepartment stores the department, previousDepartment, and updates history", () => {
    useNavigationState.getState().setActiveDepartment("control-room");
    expect(useNavigationState.getState().activeDepartment).toBe("control-room");
    expect(useNavigationState.getState().previousDepartment).toBeNull();
    expect(useNavigationState.getState().departmentHistory).toEqual(["control-room"]);

    // Transition to another department
    useNavigationState.getState().setActiveDepartment("drilling");
    expect(useNavigationState.getState().activeDepartment).toBe("drilling");
    expect(useNavigationState.getState().previousDepartment).toBe("control-room");
    expect(useNavigationState.getState().departmentHistory).toEqual(["control-room", "drilling"]);

    // Setting same department does not duplicate history
    useNavigationState.getState().setActiveDepartment("drilling");
    expect(useNavigationState.getState().departmentHistory).toEqual(["control-room", "drilling"]);

    // Clearing active department updates active but retains previous and history
    useNavigationState.getState().setActiveDepartment(null);
    expect(useNavigationState.getState().activeDepartment).toBeNull();
    expect(useNavigationState.getState().previousDepartment).toBe("drilling");
    expect(useNavigationState.getState().departmentHistory).toEqual(["control-room", "drilling"]);
  });

  it("caps departmentHistory at 20 items", () => {
    for (let i = 0; i < 25; i++) {
      useNavigationState.getState().setActiveDepartment(`dept-${i}`);
    }
    const history = useNavigationState.getState().departmentHistory;
    expect(history.length).toBe(20);
    expect(history[0]).toBe("dept-5");
    expect(history[19]).toBe("dept-24");
  });
});
