import { render, screen } from "@testing-library/react";
import { TrustLogos } from "./TrustLogos";

describe("TrustLogos", () => {
  it("renders placeholder badges when no logos are provided", () => {
    render(<TrustLogos />);
    expect(screen.getByText("Arch Mining")).toBeInTheDocument();
    expect(screen.getByText("Sector-01")).toBeInTheDocument();
    expect(screen.getByText("ISO 27001")).toBeInTheDocument();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("renders logo images when logos are provided", () => {
    render(
      <TrustLogos
        logos={[
          { src: "/logo/arch-mining.svg", alt: "Arch Mining" },
          { src: "/logo/iso-27001.svg", alt: "ISO 27001 Certified" },
        ]}
      />,
    );

    const images = screen.getAllByRole("img");
    expect(images).toHaveLength(2);
    expect(images[0]).toHaveAttribute("src", "/logo/arch-mining.svg");
    expect(images[1]).toHaveAttribute("alt", "ISO 27001 Certified");
    expect(screen.queryByText("Sector-01")).toBeNull();
  });
});
