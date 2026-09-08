import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import {
  CommandMenu,
  CommandMenuInput,
  CommandMenuList,
  CommandMenuGroup,
  CommandMenuItem,
  CommandMenuDivider,
} from "@repo/ui/components/ui/command-menu";
import {
  Combobox,
  ComboboxInput,
  ComboboxList,
  ComboboxOption,
} from "@repo/ui/components/ui/combobox";
import { ContextCardTrigger } from "@repo/ui/components/ui/context-card";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
} from "@repo/ui/components/ui/context-menu";
import { CopyButton } from "@repo/ui/components/ui/copy-button";
import { Description } from "@repo/ui/components/ui/description";
import { DotsMenu, MenuItem } from "@repo/ui/components/ui/dots-menu";

describe("Geist Batch 3 Components", () => {
  describe("CommandMenu", () => {
    it("renders when open and handles item selection", () => {
      const setOpen = jest.fn();
      const callback = jest.fn();

      render(
        <CommandMenu open={true} setOpen={setOpen}>
          <CommandMenuInput placeholder="Type a command..." />
          <CommandMenuList>
            <CommandMenuGroup heading="Suggestions">
              <CommandMenuItem callback={callback} suffix={<span data-testid="suffix">⌘P</span>}>
                Projects
              </CommandMenuItem>
              <CommandMenuDivider />
              <CommandMenuItem callback={jest.fn()}>Settings</CommandMenuItem>
            </CommandMenuGroup>
          </CommandMenuList>
        </CommandMenu>,
      );

      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Type a command...")).toBeInTheDocument();
      expect(screen.getByText("Projects")).toBeInTheDocument();
      expect(screen.getByTestId("suffix")).toHaveTextContent("⌘P");

      fireEvent.click(screen.getByText("Projects"));
      expect(callback).toHaveBeenCalled();
    });

    it("filters items based on search query", () => {
      render(
        <CommandMenu open={true}>
          <CommandMenuInput placeholder="Search..." />
          <CommandMenuList emptyMessage="No matches">
            <CommandMenuGroup heading="General">
              <CommandMenuItem>Alpha Option</CommandMenuItem>
              <CommandMenuItem>Beta Option</CommandMenuItem>
            </CommandMenuGroup>
          </CommandMenuList>
        </CommandMenu>,
      );

      const input = screen.getByPlaceholderText("Search...");
      expect(screen.getByText("Alpha Option")).toBeInTheDocument();
      expect(screen.getByText("Beta Option")).toBeInTheDocument();

      fireEvent.change(input, { target: { value: "Alpha" } });
      expect(screen.getByText("Alpha Option")).toBeInTheDocument();
      expect(screen.queryByText("Beta Option")).not.toBeInTheDocument();

      fireEvent.change(input, { target: { value: "Gamma" } });
      expect(screen.getByText("No matches")).toBeInTheDocument();
    });

    it("does not render when open is false", () => {
      render(
        <CommandMenu open={false}>
          <CommandMenuInput />
          <CommandMenuList>
            <CommandMenuItem>Hidden</CommandMenuItem>
          </CommandMenuList>
        </CommandMenu>,
      );

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  describe("Combobox", () => {
    it("renders options and selects a value", () => {
      const onChange = jest.fn();
      render(
        <Combobox aria-label="Select Country" onChange={onChange}>
          <ComboboxInput placeholder="Choose..." />
          <ComboboxList>
            <ComboboxOption value="us">United States</ComboboxOption>
            <ComboboxOption value="fr">France</ComboboxOption>
            <ComboboxOption value="de" disabled>
              Germany
            </ComboboxOption>
          </ComboboxList>
        </Combobox>,
      );

      const input = screen.getByPlaceholderText("Choose...");
      fireEvent.click(input);

      expect(screen.getByText("United States")).toBeInTheDocument();
      expect(screen.getByText("France")).toBeInTheDocument();

      fireEvent.click(screen.getByText("France"));
      expect(onChange).toHaveBeenCalledWith("fr");
    });

    it("supports clearable button", () => {
      const onChange = jest.fn();
      render(
        <Combobox clearable value="us" onChange={onChange}>
          <ComboboxInput placeholder="Search..." />
          <ComboboxList>
            <ComboboxOption value="us">United States</ComboboxOption>
          </ComboboxList>
        </Combobox>,
      );

      const clearBtn = screen.getByLabelText("Clear selection");
      expect(clearBtn).toBeInTheDocument();

      fireEvent.click(clearBtn);
      expect(onChange).toHaveBeenCalledWith(null);
    });

    it("handles multi-line option with ignoreDefaultHeight", () => {
      render(
        <Combobox defaultValue="env">
          <ComboboxInput />
          <ComboboxList>
            <ComboboxOption value="env" ignoreDefaultHeight>
              <div>
                <strong>DATABASE_URL</strong>
                <p>Production cluster</p>
              </div>
            </ComboboxOption>
          </ComboboxList>
        </Combobox>,
      );

      fireEvent.click(screen.getByRole("textbox"));
      expect(screen.getByText("DATABASE_URL")).toBeInTheDocument();
      expect(screen.getByText("Production cluster")).toBeInTheDocument();
    });
  });

  describe("ContextCard", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("displays content on hover with entry delay", () => {
      render(
        <ContextCardTrigger
          content={<div data-testid="card-content">Entity Metadata</div>}
          side="top"
          align="center"
          delay={150}
        >
          <span>Hover Me</span>
        </ContextCardTrigger>,
      );

      const trigger = screen.getByText("Hover Me");
      expect(screen.queryByTestId("card-content")).not.toBeInTheDocument();

      fireEvent.mouseEnter(trigger);
      act(() => {
        jest.advanceTimersByTime(150);
      });

      expect(screen.getByTestId("card-content")).toBeInTheDocument();
      expect(screen.getByText("Entity Metadata")).toBeInTheDocument();
    });

    it("supports custom render prop element", () => {
      render(
        <ContextCardTrigger
          content={<div>Link details</div>}
          render={
            <a href="https://example.com" data-testid="custom-link">
              Documentation
            </a>
          }
        />,
      );

      const link = screen.getByTestId("custom-link");
      expect(link).toHaveAttribute("href", "https://example.com");
      expect(link).toHaveTextContent("Documentation");
    });
  });

  describe("ContextMenu", () => {
    it("opens on right click and handles item activation", () => {
      const onClick = jest.fn();
      render(
        <ContextMenu>
          <ContextMenuTrigger>
            <div data-testid="trigger-zone">Right click area</div>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem value="edit" onClick={onClick}>
              Edit Entry
            </ContextMenuItem>
            <ContextMenuItem value="delete" destructive onClick={jest.fn()}>
              Delete Entry
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>,
      );

      const zone = screen.getByTestId("trigger-zone");
      expect(screen.queryByText("Edit Entry")).not.toBeInTheDocument();

      fireEvent.contextMenu(zone, { clientX: 100, clientY: 200 });

      expect(screen.getByText("Edit Entry")).toBeInTheDocument();
      expect(screen.getByText("Delete Entry")).toBeInTheDocument();

      fireEvent.click(screen.getByText("Edit Entry"));
      expect(onClick).toHaveBeenCalledWith("edit");
    });

    it("supports disabled item in context menu", () => {
      const onClick = jest.fn();
      render(
        <ContextMenu>
          <ContextMenuTrigger>
            <div>Right click</div>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem disabled value="disabled" onClick={onClick}>
              Disabled Option
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>,
      );

      fireEvent.contextMenu(screen.getByText("Right click"));
      const item = screen.getByText("Disabled Option");
      fireEvent.click(item);
      expect(onClick).not.toHaveBeenCalled();
    });
  });

  describe("CopyButton", () => {
    const originalClipboard = { ...navigator.clipboard };

    beforeEach(() => {
      const mockClipboard = {
        writeText: jest.fn().mockResolvedValue(undefined),
      };
      Object.assign(navigator, { clipboard: mockClipboard });
    });

    afterEach(() => {
      Object.assign(navigator, { clipboard: originalClipboard });
    });

    it("copies text on click and shows feedback", async () => {
      render(<CopyButton textToCopy="pnpm build" label="Copy build command" />);

      const button = screen.getByLabelText("Copy build command");
      expect(button).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(button);
      });

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith("pnpm build");
      expect(button).toHaveAttribute("aria-label", "Copied");
    });
  });

  describe("Description", () => {
    it("renders definition list semantics with title and content", () => {
      render(
        <Description
          title="Deployment ID"
          content="dpl_7x92KmL4"
          tooltip="Unique identifier for deployment."
        />,
      );

      expect(screen.getByRole("term")).toHaveTextContent("Deployment ID");
      expect(screen.getByRole("definition")).toHaveTextContent("dpl_7x92KmL4");
    });

    it("applies right-alignment and ellipsis classes", () => {
      const { container } = render(
        <Description title="Status" content="Active and Healthy" right ellipsis />,
      );

      const dl = container.querySelector("dl");
      const dd = container.querySelector("dd");

      expect(dl).toHaveClass("flex-row");
      expect(dd).toHaveClass("truncate");
      expect(dd).toHaveClass("text-right");
    });
  });

  describe("DotsMenu", () => {
    it("toggles overflow menu and triggers item onClick", () => {
      const onClick = jest.fn();
      render(
        <DotsMenu buttonAriaLabel="Row actions">
          <MenuItem onClick={onClick}>View Details</MenuItem>
          <MenuItem disabled>Export PDF</MenuItem>
        </DotsMenu>,
      );

      const button = screen.getByLabelText("Row actions");
      expect(screen.queryByText("View Details")).not.toBeInTheDocument();

      fireEvent.click(button);
      expect(screen.getByText("View Details")).toBeInTheDocument();

      fireEvent.click(screen.getByText("View Details"));
      expect(onClick).toHaveBeenCalled();
    });
  });
});
