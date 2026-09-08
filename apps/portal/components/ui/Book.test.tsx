import { Book } from "@repo/ui/components/ui/book";
import { render, screen } from "@testing-library/react";
import React from "react";

describe("Geist Book Primitive", () => {
  it("renders with default stripe variant and title heading", () => {
    render(<Book title="The user experience of the Frontend Cloud" />);

    const book = screen.getByRole("group", {
      name: "Book: The user experience of the Frontend Cloud",
    });
    expect(book).toBeInTheDocument();

    const heading = screen.getByRole("heading", { level: 3 });
    expect(heading).toHaveTextContent("The user experience of the Frontend Cloud");
    expect(screen.getByText("Volume")).toBeInTheDocument();
  });

  it("renders simple variant without stripe volume tag", () => {
    render(<Book title="Design Engineering at Vercel" variant="simple" />);

    const heading = screen.getByRole("heading", { level: 3 });
    expect(heading).toHaveTextContent("Design Engineering at Vercel");
    expect(screen.queryByText("Volume")).not.toBeInTheDocument();
  });

  it("applies custom background color and text color", () => {
    const { container } = render(
      <Book title="Custom Color Book" color="#9D2127" textColor="#ece4db" />
    );

    const book = container.firstChild as HTMLElement;
    expect(book).toHaveStyle({ backgroundColor: "#9D2127", color: "#ece4db" });
  });

  it("renders custom icon and illustration with aria-hidden", () => {
    render(
      <Book
        title="Illustrated Book"
        icon={<span data-testid="custom-icon">★</span>}
        illustration={<div data-testid="custom-illustration">Graphic</div>}
      />
    );

    const icon = screen.getByTestId("custom-icon");
    const illustration = screen.getByTestId("custom-illustration");

    expect(icon).toBeInTheDocument();
    expect(illustration).toBeInTheDocument();

    expect(icon.closest("[aria-hidden='true']")).toBeInTheDocument();
    expect(illustration.closest("[aria-hidden='true']")).toBeInTheDocument();
  });

  it("applies textured overlay when textured=true", () => {
    const { container, rerender } = render(<Book title="Textured Book" textured={true} />);

    expect(container.querySelector(".mix-blend-overlay")).toBeInTheDocument();

    rerender(<Book title="Non-Textured Book" textured={false} />);
    expect(container.querySelector(".mix-blend-overlay")).not.toBeInTheDocument();
  });

  it("supports numeric width", () => {
    const { container } = render(<Book title="Fixed Width" width={300} />);
    const book = container.firstChild as HTMLElement;
    expect(book).toHaveStyle({ "--book-w": "300px" });
    expect(book.className).toContain("w-[var(--book-w)]");
  });

  it("supports responsive width object with breakpoint styles", () => {
    const { container } = render(
      <Book title="Responsive Width" width={{ sm: 150, md: 196, lg: 240 }} />
    );
    const book = container.firstChild as HTMLElement;
    expect(book).toHaveStyle({
      "--book-w": "150px",
      "--book-w-sm": "150px",
      "--book-w-md": "196px",
      "--book-w-lg": "240px",
    });
    expect(book.className).toContain("sm:w-[var(--book-w-sm)]");
    expect(book.className).toContain("md:w-[var(--book-w-md)]");
    expect(book.className).toContain("lg:w-[var(--book-w-lg)]");
  });

  it("renders custom heading level and subtitle", () => {
    render(<Book title="Custom Heading" subtitle="Volume 1" headingLevel="h2" />);

    const h2 = screen.getByRole("heading", { level: 2 });
    expect(h2).toHaveTextContent("Custom Heading");
    expect(screen.getByText("Volume 1")).toBeInTheDocument();
  });

  it("forwards ref and merges custom className", () => {
    const ref = React.createRef<HTMLDivElement>();
    render(<Book ref={ref} title="Ref Book" className="my-custom-book" />);

    expect(ref.current).not.toBeNull();
    expect(ref.current?.tagName).toBe("DIV");
    expect(ref.current).toHaveClass("my-custom-book");
  });
});
