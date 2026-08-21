import React from "react";
import { render, screen } from "@testing-library/react";
import { Divider } from "@repo/ui/Divider";
import { BorderBox } from "@repo/ui/BorderBox";

describe("Borders and Dividers Design Techniques", () => {
  describe("Divider Component", () => {
    it("renders default horizontal divider", () => {
      render(<Divider data-testid="divider-default" />);
      const el = screen.getByTestId("divider-default");
      expect(el).toBeInTheDocument();
      expect(el).toHaveAttribute("role", "separator");
      expect(el).toHaveAttribute("aria-orientation", "horizontal");
    });

    it("renders dotted divider technique", () => {
      render(<Divider variant="dotted" data-testid="divider-dotted" />);
      const el = screen.getByTestId("divider-dotted");
      expect(el).toHaveClass("divider-arch-dotted");
    });

    it("renders fading divider technique", () => {
      render(<Divider variant="fading" data-testid="divider-fading" />);
      const el = screen.getByTestId("divider-fading");
      expect(el).toHaveClass("divider-arch-fading");
    });

    it("renders vertical dotted divider", () => {
      render(<Divider variant="dotted" orientation="vertical" data-testid="divider-dotted-v" />);
      const el = screen.getByTestId("divider-dotted-v");
      expect(el).toHaveAttribute("aria-orientation", "vertical");
      expect(el).toHaveClass("divider-arch-dotted-v");
    });

    it("renders divider with labeled content", () => {
      render(<Divider variant="dotted" label="OPERATIONAL BREAK" data-testid="divider-labeled" />);
      expect(screen.getByText("OPERATIONAL BREAK")).toBeInTheDocument();
    });
  });

  describe("BorderBox Component Techniques", () => {
    it("renders 1. Dotted Border technique", () => {
      render(
        <BorderBox variant="dotted" data-testid="box-dotted">
          Dotted Content
        </BorderBox>,
      );
      const el = screen.getByTestId("box-dotted");
      expect(el).toHaveClass("border-arch-dotted");
    });

    it("renders 2. Double Border technique", () => {
      render(
        <BorderBox variant="double" data-testid="box-double">
          Double Border Content
        </BorderBox>,
      );
      const el = screen.getByTestId("box-double");
      expect(el).toHaveClass("border-arch-double");
    });

    it("renders 3. Gradient Border technique", () => {
      render(
        <BorderBox variant="gradient" data-testid="box-gradient">
          Gradient Content
        </BorderBox>,
      );
      const el = screen.getByTestId("box-gradient");
      expect(el).toHaveClass("border-arch-gradient");
    });

    it("renders 4. Bevelled Border technique", () => {
      render(
        <BorderBox variant="bevelled" data-testid="box-bevelled">
          Bevelled Content
        </BorderBox>,
      );
      const el = screen.getByTestId("box-bevelled");
      expect(el).toHaveClass("border-arch-bevelled");
    });

    it("renders 5. Hand-Drawn Border technique", () => {
      render(
        <BorderBox variant="handdrawn" data-testid="box-handdrawn">
          Hand-Drawn Content
        </BorderBox>,
      );
      const el = screen.getByTestId("box-handdrawn");
      expect(el).toHaveClass("border-arch-handdrawn");
    });

    it("renders 6. Patterned Border technique", () => {
      render(
        <BorderBox variant="patterned" data-testid="box-patterned">
          Patterned Content
        </BorderBox>,
      );
      const el = screen.getByTestId("box-patterned");
      expect(el).toHaveClass("border-arch-patterned");
    });

    it("renders 7. Thick Transparent Border technique", () => {
      render(
        <BorderBox variant="thick-transparent" data-testid="box-thick-glass">
          Thick Glass Content
        </BorderBox>,
      );
      const el = screen.getByTestId("box-thick-glass");
      expect(el).toHaveClass("border-arch-thick-transparent");
    });

    it("renders 8. Fading Borders technique", () => {
      render(
        <BorderBox variant="fading" data-testid="box-fading">
          Fading Edge Content
        </BorderBox>,
      );
      const el = screen.getByTestId("box-fading");
      expect(el).toHaveClass("border-arch-fading");
    });
  });
});
