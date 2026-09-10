import { Breadcrumb, BreadcrumbItem } from "@repo/ui/components/ui/breadcrumb";
import { render, screen } from "@testing-library/react";

describe("Geist Breadcrumbs Primitive", () => {
  it("renders with default text type and accessible nav element", () => {
    render(
      <Breadcrumb type="text">
        <BreadcrumbItem>Home</BreadcrumbItem>
        <BreadcrumbItem>Dashboard</BreadcrumbItem>
        <BreadcrumbItem active>Overview</BreadcrumbItem>
      </Breadcrumb>,
    );

    const nav = screen.getByRole("navigation", { name: "Breadcrumbs" });
    expect(nav).toBeInTheDocument();

    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    const activeItem = screen.getByText("Overview");
    expect(activeItem).toBeInTheDocument();
    expect(activeItem).toHaveAttribute("aria-current", "page");
  });

  it("renders menu type with styled pill items", () => {
    render(
      <Breadcrumb type="menu">
        <BreadcrumbItem href="/home">Home</BreadcrumbItem>
        <BreadcrumbItem active>Dashboard</BreadcrumbItem>
      </Breadcrumb>,
    );

    const link = screen.getByRole("link", { name: "Home" });
    expect(link).toHaveAttribute("href", "/home");
    expect(link).toHaveClass("px-2.5", "py-1", "rounded-md");

    const activeItem = screen.getByText("Dashboard");
    expect(activeItem).toHaveAttribute("aria-current", "page");
    expect(activeItem).toHaveClass("bg-neutral-900");
  });

  it("renders disabled state with aria-disabled", () => {
    render(
      <Breadcrumb>
        <BreadcrumbItem>Home</BreadcrumbItem>
        <BreadcrumbItem disabled>Dashboard</BreadcrumbItem>
        <BreadcrumbItem>Overview</BreadcrumbItem>
      </Breadcrumb>,
    );

    const disabledItem = screen.getByText("Dashboard");
    expect(disabledItem).toHaveAttribute("aria-disabled", "true");
    expect(disabledItem).toHaveClass("opacity-40", "pointer-events-none");
  });

  it("renders custom separator between items with aria-hidden", () => {
    render(
      <Breadcrumb separator={<span data-testid="custom-sep">&gt;</span>}>
        <BreadcrumbItem>First</BreadcrumbItem>
        <BreadcrumbItem>Second</BreadcrumbItem>
      </Breadcrumb>,
    );

    const sep = screen.getByTestId("custom-sep");
    expect(sep).toBeInTheDocument();
    expect(sep.closest("[aria-hidden='true']")).toBeInTheDocument();
  });
});
