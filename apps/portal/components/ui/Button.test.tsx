import { Button, ButtonLink, CustomButton } from "@repo/ui/components/ui/button";
import { render, screen } from "@testing-library/react";
import React from "react";

describe("Geist Button Primitive", () => {
  it("renders with default variant and medium size", () => {
    render(<Button>Upload</Button>);
    const btn = screen.getByRole("button", { name: "Upload" });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveClass("h-9", "bg-neutral-900");
  });

  it("renders different sizes (tiny, small, medium, large)", () => {
    const { rerender } = render(<Button size="tiny">Tiny</Button>);
    expect(screen.getByRole("button")).toHaveClass("h-6");

    rerender(<Button size="small">Small</Button>);
    expect(screen.getByRole("button")).toHaveClass("h-8");

    rerender(<Button size="medium">Medium</Button>);
    expect(screen.getByRole("button")).toHaveClass("h-9");

    rerender(<Button size="large">Large</Button>);
    expect(screen.getByRole("button")).toHaveClass("h-10");
  });

  it("renders Geist variants (secondary, tertiary, error, warning)", () => {
    const { rerender } = render(<Button variant="secondary">Secondary</Button>);
    expect(screen.getByRole("button")).toHaveClass("bg-neutral-100");

    rerender(<Button variant="tertiary">Tertiary</Button>);
    expect(screen.getByRole("button")).toHaveClass("bg-transparent");

    rerender(<Button variant="error">Error</Button>);
    expect(screen.getByRole("button")).toHaveClass("bg-red-600");

    rerender(<Button variant="warning">Warning</Button>);
    expect(screen.getByRole("button")).toHaveClass("bg-amber-500");
  });

  it("renders shapes (square, circle, rounded with shadow)", () => {
    const { rerender } = render(
      <Button shape="square" aria-label="Square Button" svgOnly>
        <span>■</span>
      </Button>
    );
    expect(screen.getByRole("button")).toHaveClass("aspect-square");

    rerender(
      <Button shape="circle" aria-label="Circle Button" svgOnly>
        <span>●</span>
      </Button>
    );
    expect(screen.getByRole("button")).toHaveClass("rounded-full", "aspect-square");

    rerender(
      <Button shape="rounded" shadow variant="secondary">
        Rounded
      </Button>
    );
    expect(screen.getByRole("button")).toHaveClass("rounded-full", "shadow-lg");
  });

  it("renders prefix and suffix elements with aria-hidden", () => {
    render(
      <Button
        prefix={<span data-testid="prefix-icon">&lt;</span>}
        suffix={<span data-testid="suffix-icon">&gt;</span>}
      >
        Upload
      </Button>
    );

    const prefix = screen.getByTestId("prefix-icon");
    const suffix = screen.getByTestId("suffix-icon");
    expect(prefix).toBeInTheDocument();
    expect(suffix).toBeInTheDocument();
    expect(prefix.closest("[aria-hidden='true']")).toBeInTheDocument();
    expect(suffix.closest("[aria-hidden='true']")).toBeInTheDocument();
  });

  it("renders loading state with spinner and aria-busy", () => {
    render(<Button loading>Upload</Button>);
    const btn = screen.getByRole("button");
    expect(btn).toHaveAttribute("aria-busy", "true");
    expect(btn).toBeDisabled();
    expect(btn.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("renders ButtonLink as an anchor element", () => {
    render(
      <ButtonLink href="/pricing" variant="default" size="small">
        Upgrade to Pro
      </ButtonLink>
    );

    const link = screen.getByRole("link", { name: "Upgrade to Pro" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/pricing");
    expect(link).toHaveClass("h-8");
  });

  it("renders CustomButton with custom state overrides", () => {
    render(
      <CustomButton
        width={160}
        normal={{
          foreground: "#fff",
          background: "#006fee",
          border: "#006fee",
        }}
      >
        Upgrade
      </CustomButton>
    );

    const btn = screen.getByRole("button", { name: "Upgrade" });
    expect(btn).toHaveStyle({
      width: "160px",
      backgroundColor: "#006fee",
      color: "#fff",
    });
  });
});
