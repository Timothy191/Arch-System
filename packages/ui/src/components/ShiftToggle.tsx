import * as React from "react";

interface ShiftToggleProps {
  value: "day" | "night";
  // eslint-disable-next-line no-unused-vars
  onChange: (value: "day" | "night") => void;
  name?: string;
}

export function ShiftToggle({ value, onChange, name = "shift-toggle" }: ShiftToggleProps) {
  return (
    <div className="cir-tabs" role="radiogroup" aria-label="Shift selector">
      {(["day", "night"] as const).map((shift) => {
        const id = `${name}-${shift}`;
        const isChecked = value === shift;
        return (
          <React.Fragment key={shift}>
            <input
              type="radio"
              id={id}
              name={name}
              checked={isChecked}
              onChange={() => onChange(shift)}
              className="cir-tabs-r"
            />
            <label htmlFor={id} className="cir-tabs-t">
              {shift === "day" ? "Day" : "Night"}
            </label>
          </React.Fragment>
        );
      })}
    </div>
  );
}

// AGENT-TRACE: getCurrentShift was consolidated into @repo/utils (timezone-aware,
// Africa/Johannesburg default). Import it from "@repo/utils" instead of here.
