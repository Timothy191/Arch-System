import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { Checkbox } from "@repo/ui/components/ui/checkbox";
import { ClearableInput } from "@repo/ui/components/ui/clearable-input";
import { Code } from "@repo/ui/components/ui/code";
import { CodeBlock } from "@repo/ui/components/ui/code-block";
import { Collapse, CollapseGroup } from "@repo/ui/components/ui/collapse";
import { Calendar } from "@repo/ui/components/ui/calendar";

describe("Geist Extended Primitives", () => {
  describe("Checkbox", () => {
    it("renders checked and unchecked states", () => {
      const onChange = jest.fn();
      const onCheckedChange = jest.fn();
      const { rerender } = render(
        <Checkbox checked={false} onChange={onChange} onCheckedChange={onCheckedChange}>
          Option 1
        </Checkbox>,
      );

      const checkbox = screen.getByRole("checkbox");
      expect(checkbox).not.toBeChecked();
      expect(screen.getByText("Option 1")).toBeInTheDocument();

      fireEvent.click(checkbox);
      expect(onChange).toHaveBeenCalled();
      expect(onCheckedChange).toHaveBeenCalledWith(true);

      rerender(
        <Checkbox checked={true} onChange={onChange}>
          Option 1
        </Checkbox>,
      );
      expect(screen.getByRole("checkbox")).toBeChecked();
    });

    it("renders indeterminate state", () => {
      render(<Checkbox indeterminate>Indeterminate</Checkbox>);
      const checkbox = screen.getByRole("checkbox");
      expect(checkbox).toHaveAttribute("aria-checked", "mixed");
    });

    it("supports disabled state", () => {
      const onChange = jest.fn();
      render(
        <Checkbox disabled onChange={onChange}>
          Disabled Checkbox
        </Checkbox>,
      );
      const checkbox = screen.getByRole("checkbox");
      expect(checkbox).toBeDisabled();
      fireEvent.click(checkbox);
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe("ClearableInput", () => {
    it("renders input and clears value on clear button click", () => {
      const onChange = jest.fn();
      const onClear = jest.fn();

      render(
        <ClearableInput
          value="Test value"
          onChange={onChange}
          onClear={onClear}
          placeholder="Type here..."
        />,
      );

      const input = screen.getByPlaceholderText("Type here...");
      expect(input).toHaveValue("Test value");

      const clearBtn = screen.getByRole("button", { name: "Clear input" });
      expect(clearBtn).toBeInTheDocument();

      fireEvent.click(clearBtn);
      expect(onClear).toHaveBeenCalled();
    });

    it("clears on Escape key press", () => {
      const onClear = jest.fn();
      render(
        <ClearableInput
          value="Some text"
          onChange={() => {}}
          onClear={onClear}
          placeholder="Input"
        />,
      );

      const input = screen.getByPlaceholderText("Input");
      fireEvent.keyDown(input, { key: "Escape" });
      expect(onClear).toHaveBeenCalled();
    });

    it("renders cmdk badge and label", () => {
      render(
        <ClearableInput
          label="Search Database"
          placeholder="Search..."
          value=""
          onChange={() => {}}
          cmdk
        />,
      );

      expect(screen.getByText("Search Database")).toBeInTheDocument();
      expect(screen.getByText("⌘K")).toBeInTheDocument();
    });
  });

  describe("Code & CodeBlock", () => {
    it("renders inline Code snippet", () => {
      render(<Code syntax="typescript">const a: number = 10;</Code>);
      const code = screen.getByText("const a: number = 10;");
      expect(code).toBeInTheDocument();
      expect(code).toHaveAttribute("data-syntax", "typescript");
    });

    it("renders CodeBlock with filename, line numbers, and copy button", () => {
      const source = `const x = 1;\nconst y = 2;\nconst z = 3;`;
      render(
        <CodeBlock filename="example.ts" language="typescript" highlightedLinesNumbers={[2]}>
          {source}
        </CodeBlock>,
      );

      expect(screen.getByText("example.ts")).toBeInTheDocument();
      expect(screen.getByText("const x = 1;")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Copy code" })).toBeInTheDocument();
    });

    it("renders diff additions and deletions in CodeBlock", () => {
      const source = `line1\nline2\nline3`;
      render(
        <CodeBlock addedLinesNumbers={[2]} removedLinesNumbers={[3]}>
          {source}
        </CodeBlock>,
      );

      expect(screen.getByText("+")).toBeInTheDocument();
      expect(screen.getByText("-")).toBeInTheDocument();
    });

    it("supports tabs language switcher", () => {
      const onChange = jest.fn();
      render(
        <CodeBlock
          tabs={{
            options: [
              { label: "JS", value: "js" },
              { label: "TS", value: "ts" },
            ],
            value: "js",
            onChange,
          }}
        >
          {`console.log("hello");`}
        </CodeBlock>,
      );

      const tsTab = screen.getByRole("button", { name: "TS" });
      fireEvent.click(tsTab);
      expect(onChange).toHaveBeenCalledWith("ts");
    });
  });

  describe("Collapse & CollapseGroup", () => {
    it("toggles single Collapse panel on click", () => {
      render(
        <Collapse title="Section Header">
          <p>Secret content</p>
        </Collapse>,
      );

      const trigger = screen.getByRole("button", { name: /Section Header/ });
      expect(trigger).toHaveAttribute("aria-expanded", "false");
      expect(screen.queryByText("Secret content")).not.toBeInTheDocument();

      fireEvent.click(trigger);
      expect(trigger).toHaveAttribute("aria-expanded", "true");
      expect(screen.getByText("Secret content")).toBeInTheDocument();

      fireEvent.click(trigger);
      expect(trigger).toHaveAttribute("aria-expanded", "false");
      expect(screen.queryByText("Secret content")).not.toBeInTheDocument();
    });

    it("supports defaultExpanded and multiple mode in CollapseGroup", () => {
      render(
        <CollapseGroup multiple>
          <Collapse title="Item 1" defaultExpanded>
            <p>Content 1</p>
          </Collapse>
          <Collapse title="Item 2">
            <p>Content 2</p>
          </Collapse>
        </CollapseGroup>,
      );

      expect(screen.getByText("Content 1")).toBeInTheDocument();
      expect(screen.queryByText("Content 2")).not.toBeInTheDocument();

      const trigger2 = screen.getByRole("button", { name: /Item 2/ });
      fireEvent.click(trigger2);

      expect(screen.getByText("Content 1")).toBeInTheDocument();
      expect(screen.getByText("Content 2")).toBeInTheDocument();
    });
  });

  describe("Calendar", () => {
    it("renders month, days, and responds to day clicks", () => {
      const onChange = jest.fn();
      render(<Calendar onChange={onChange} allowClear />);

      expect(screen.getByRole("region", { name: "Calendar" })).toBeInTheDocument();

      // Click on day 15
      const day15 = screen.getByRole("button", { name: "15" });
      fireEvent.click(day15);
      expect(onChange).toHaveBeenCalled();

      // Clear button
      const clearBtn = screen.getByRole("button", { name: "Clear" });
      fireEvent.click(clearBtn);
      expect(onChange).toHaveBeenCalledWith(null);
    });

    it("supports presets", () => {
      const onChange = jest.fn();
      const presets = {
        "last-7-days": {
          text: "Last 7 Days",
          start: new Date(2026, 8, 1),
          end: new Date(2026, 8, 8),
        },
      };

      render(<Calendar presets={presets} onChange={onChange} />);

      const presetBtn = screen.getByRole("button", { name: "Last 7 Days" });
      fireEvent.click(presetBtn);

      expect(onChange).toHaveBeenCalledWith({
        start: new Date(2026, 8, 1),
        end: new Date(2026, 8, 8),
      });
    });
  });
});
