import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { Pagination } from "@repo/ui/Pagination";
import "@testing-library/jest-dom";

describe("Pagination Component", () => {
  it("renders correctly with total count", () => {
    const handlePageChange = jest.fn();
    render(
      <Pagination
        currentPage={2}
        totalPages={5}
        onPageChange={handlePageChange}
        pageSize={10}
        totalCount={45}
      />,
    );

    expect(
      screen.getByText((content, element) => {
        return element?.textContent === "Showing 11 to 20 of 45 entries";
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("2")).toHaveClass("bg-[var(--accent-blue)]");
  });

  it("triggers onPageChange when page button is clicked", () => {
    const handlePageChange = jest.fn();
    render(
      <Pagination
        currentPage={2}
        totalPages={5}
        onPageChange={handlePageChange}
        pageSize={10}
        totalCount={45}
      />,
    );

    fireEvent.click(screen.getByText("3"));
    expect(handlePageChange).toHaveBeenCalledWith(3);
  });

  it("disables prev button on first page", () => {
    render(
      <Pagination
        currentPage={1}
        totalPages={5}
        onPageChange={jest.fn()}
        pageSize={10}
        totalCount={45}
      />,
    );

    const prevBtn = screen.getByRole("button", { name: /Previous page/i });
    expect(prevBtn).toBeDisabled();
  });

  it("disables next button on last page", () => {
    render(
      <Pagination
        currentPage={5}
        totalPages={5}
        onPageChange={jest.fn()}
        pageSize={10}
        totalCount={45}
      />,
    );

    const nextBtn = screen.getByRole("button", { name: /Next page/i });
    expect(nextBtn).toBeDisabled();
  });

  it("triggers onPageSizeChange when selection changes", () => {
    const handlePageSizeChange = jest.fn();
    render(
      <Pagination
        currentPage={1}
        totalPages={5}
        onPageChange={jest.fn()}
        pageSize={10}
        onPageSizeChange={handlePageSizeChange}
        totalCount={45}
      />,
    );

    const select = screen.getByLabelText(/Show/i);
    fireEvent.change(select, { target: { value: "20" } });
    expect(handlePageSizeChange).toHaveBeenCalledWith(20);
  });
});
