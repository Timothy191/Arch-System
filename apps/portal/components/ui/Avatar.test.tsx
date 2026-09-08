import { Avatar } from "@repo/ui/components/ui/avatar";
import { AvatarGroup } from "@repo/ui/components/ui/avatar-group";
import { AvatarWithIcon } from "@repo/ui/components/ui/avatar-with-icon";
import { GitHubAvatar } from "@repo/ui/components/ui/git-avatar";
import { render, screen } from "@testing-library/react";
import React from "react";

describe("Geist Avatar Primitives", () => {
  describe("Avatar", () => {
    it("renders letter initials when provided", () => {
      render(<Avatar letter="sl" size={32} />);
      const el = screen.getByText("SL");
      expect(el).toBeInTheDocument();
      expect(screen.getByRole("img")).toHaveAttribute("aria-label", "Avatar with initials: SL");
    });

    it("derives uppercase 2-letter initials from title", () => {
      render(<Avatar title="Timothy Archer" size={24} />);
      expect(screen.getByText("TA")).toBeInTheDocument();
      expect(screen.getByRole("img")).toHaveAttribute("aria-label", "Timothy Archer");
    });

    it("renders loading skeleton placeholder when placeholder=true and no src or letter", () => {
      const { container } = render(<Avatar placeholder size={90} />);
      const placeholderEl = container.querySelector(".animate-pulse");
      expect(placeholderEl).toBeInTheDocument();
      expect(screen.getByRole("img")).toHaveAttribute("aria-label", "Loading avatar");
    });

    it("renders img tag when src is provided", () => {
      render(<Avatar src="https://example.com/photo.jpg" title="Jane Doe" size={32} />);
      const img = screen.getByRole("img", { name: "Jane Doe" });
      expect(img).toBeInTheDocument();
    });
  });

  describe("AvatarGroup", () => {
    it("renders stacked member avatars and limits visibility with overflow pill", () => {
      const members = [
        { username: "alice", letter: "AL" },
        { username: "bob", letter: "BO" },
        { username: "charlie", letter: "CH" },
        { username: "david", letter: "DA" },
        { username: "eve", letter: "EV" },
      ];

      render(<AvatarGroup members={members} limit={3} size={24} />);

      // Group accessibility
      expect(screen.getByRole("group")).toHaveAttribute("aria-label", "Group of 5 people");

      // Only first 3 members rendered
      expect(screen.getByText("AL")).toBeInTheDocument();
      expect(screen.getByText("BO")).toBeInTheDocument();
      expect(screen.getByText("CH")).toBeInTheDocument();
      expect(screen.queryByText("DA")).not.toBeInTheDocument();

      // Overflow pill
      expect(screen.getByText("+2")).toBeInTheDocument();
    });

    it("respects reverse stacking order", () => {
      const members = [
        { letter: "AA", username: "a" },
        { letter: "BB", username: "b" },
      ];

      const { container } = render(<AvatarGroup members={members} reverse size={32} />);
      const wrappers = container.querySelectorAll(".transition-transform");
      expect(wrappers).toHaveLength(2);
      // reverse=true means first item has lower z-index than second item
      expect((wrappers[0] as HTMLElement).style.zIndex).toBe("1");
      expect((wrappers[1] as HTMLElement).style.zIndex).toBe("2");
    });
  });

  describe("AvatarWithIcon", () => {
    it("renders custom status icon badge", () => {
      render(
        <AvatarWithIcon letter="JD" size={32} icon={<span data-testid="status-dot">●</span>} />
      );

      expect(screen.getByText("JD")).toBeInTheDocument();
      expect(screen.getByTestId("status-dot")).toBeInTheDocument();
    });
  });

  describe("GitHubAvatar", () => {
    it("constructs correct GitHub avatar image URL", () => {
      render(<GitHubAvatar username="rauchg" size={32} />);
      const img = screen.getByRole("img", { name: "@rauchg" });
      expect(img).toHaveAttribute("src", "https://github.com/rauchg.png?size=64");
    });
  });
});
