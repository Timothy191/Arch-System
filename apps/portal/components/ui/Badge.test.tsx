import { Badge, badgeVariants } from "@repo/ui/components/ui/badge";
import { render, screen } from "@testing-library/react";
import React from "react";

describe("Geist Badge Primitive", () => {
  it("renders with default gray variant and medium size", () => {
    render(<Badge>Default Badge</Badge>);
    const badge = screen.getByText("Default Badge");
    expect(badge).toBeInTheDocument();
    // Default variant has bg-neutral-900
    expect(badge.closest("div")).toHaveClass("bg-neutral-900");
    expect(badge.closest("div")).toHaveClass("h-6"); // md size
  });

  it("renders different sizes correctly (sm, md, lg)", () => {
    const { rerender } = render(<Badge size="sm">Small</Badge>);
    expect(screen.getByText("Small").closest("div")).toHaveClass("h-5");

    rerender(<Badge size="md">Medium</Badge>);
    expect(screen.getByText("Medium").closest("div")).toHaveClass("h-6");

    rerender(<Badge size="lg">Large</Badge>);
    expect(screen.getByText("Large").closest("div")).toHaveClass("h-7");
  });

  it("renders solid color variants", () => {
    const { rerender } = render(<Badge variant="blue">Blue</Badge>);
    expect(screen.getByText("Blue").closest("div")).toHaveClass("bg-blue-600");

    rerender(<Badge variant="green">Green</Badge>);
    expect(screen.getByText("Green").closest("div")).toHaveClass("bg-emerald-600");

    rerender(<Badge variant="red">Red</Badge>);
    expect(screen.getByText("Red").closest("div")).toHaveClass("bg-red-600");

    rerender(<Badge variant="amber">Amber</Badge>);
    expect(screen.getByText("Amber").closest("div")).toHaveClass("bg-amber-500");

    rerender(<Badge variant="purple">Purple</Badge>);
    expect(screen.getByText("Purple").closest("div")).toHaveClass("bg-purple-600");

    rerender(<Badge variant="pink">Pink</Badge>);
    expect(screen.getByText("Pink").closest("div")).toHaveClass("bg-pink-600");

    rerender(<Badge variant="teal">Teal</Badge>);
    expect(screen.getByText("Teal").closest("div")).toHaveClass("bg-teal-600");
  });

  it("maps solid variants to subtle variants when contrast='low'", () => {
    const { rerender } = render(
      <Badge variant="green" contrast="low">
        Green Subtle
      </Badge>
    );
    // Green subtle class
    expect(screen.getByText("Green Subtle").closest("div")).toHaveClass("bg-emerald-50");
    expect(screen.getByText("Green Subtle").closest("div")).toHaveClass("text-emerald-700");

    rerender(
      <Badge variant="red" contrast="low">
        Red Subtle
      </Badge>
    );
    expect(screen.getByText("Red Subtle").closest("div")).toHaveClass("bg-red-50");
    expect(screen.getByText("Red Subtle").closest("div")).toHaveClass("text-red-700");

    rerender(
      <Badge variant="amber" contrast="low">
        Amber Subtle
      </Badge>
    );
    expect(screen.getByText("Amber Subtle").closest("div")).toHaveClass("bg-amber-50");
    expect(screen.getByText("Amber Subtle").closest("div")).toHaveClass("text-amber-700");

    rerender(
      <Badge variant="blue" contrast="low">
        Blue Subtle
      </Badge>
    );
    expect(screen.getByText("Blue Subtle").closest("div")).toHaveClass("bg-blue-50");
    expect(screen.getByText("Blue Subtle").closest("div")).toHaveClass("text-blue-700");
  });

  it("supports special branded and interactive variants (trial, turbo, pill)", () => {
    const { rerender } = render(<Badge variant="trial">Trial</Badge>);
    expect(screen.getByText("Trial").closest("div")).toHaveClass("from-blue-600");

    rerender(<Badge variant="turbo">Turbo</Badge>);
    expect(screen.getByText("Turbo").closest("div")).toHaveClass("from-red-500");

    rerender(<Badge variant="pill">Pill</Badge>);
    expect(screen.getByText("Pill").closest("div")).toHaveClass("cursor-pointer");
  });

  it("maintains backward compatibility with shadcn variants", () => {
    const { rerender } = render(<Badge variant="secondary">Secondary</Badge>);
    expect(screen.getByText("Secondary").closest("div")).toHaveClass("bg-neutral-100");

    rerender(<Badge variant="destructive">Destructive</Badge>);
    expect(screen.getByText("Destructive").closest("div")).toHaveClass("bg-red-600");

    rerender(<Badge variant="outline">Outline</Badge>);
    expect(screen.getByText("Outline").closest("div")).toHaveClass("border-neutral-200");
  });

  it("renders icon when provided with proper accessibility hiding", () => {
    render(
      <Badge variant="green" contrast="low" icon={<span data-testid="status-icon">●</span>}>
        Verified
      </Badge>
    );

    const iconEl = screen.getByTestId("status-icon");
    expect(iconEl).toBeInTheDocument();
    expect(iconEl.closest("span[aria-hidden='true']")).toBeInTheDocument();
    expect(screen.getByText("Verified")).toBeInTheDocument();
  });

  it("forwards ref and merges custom className", () => {
    const ref = React.createRef<HTMLDivElement>();
    render(
      <Badge ref={ref} className="custom-class" data-testid="badge-ref">
        Custom
      </Badge>
    );

    expect(ref.current).not.toBeNull();
    expect(ref.current?.tagName).toBe("DIV");
    expect(ref.current).toHaveClass("custom-class");
  });

  it("provides badgeVariants cva helper function", () => {
    const classes = badgeVariants({ variant: "teal", size: "lg" });
    expect(classes).toContain("bg-teal-600");
    expect(classes).toContain("h-7");
  });
});
