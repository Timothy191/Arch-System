function deriveInputId(label: string, id?: string, name?: string): string {
  if (id) return id;
  if (name) return `field-${name}`;
  return `field-${label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}`;
}

import { cn } from "../lib/utils";

const inputStyles =
  "w-full bg-white/60 backdrop-blur-md border border-white/60 rounded-lg px-3 py-2.5 text-[var(--text-heading)] placeholder:text-[var(--text-muted)] text-sm shadow-[inset_0_1px_2px_rgba(0,0,0,0.03),inset_0_-0.5px_0_rgba(255,255,255,0.7)] focus:outline-none focus:border-[var(--accent-blue)] focus:ring-2 focus:ring-[var(--accent-blue)]/20 focus:bg-white/80 transition-all duration-200";

interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  optional?: boolean;
}

export function FormInput({
  label,
  error,
  optional,
  className,
  id: idProp,
  name,
  ...props
}: FormInputProps) {
  const inputId = deriveInputId(label, idProp, name);
  const errorId = error ? `${inputId}-error` : undefined;
  return (
    <div className="space-y-2">
      <label htmlFor={inputId} className="block text-sm text-[var(--text-secondary)]">
        {label}
        {optional && <span className="text-[var(--text-muted)]"> (Optional)</span>}
        {!optional && props.required && <span className="text-[var(--accent-red)]"> *</span>}
      </label>
      <input
        id={inputId}
        aria-describedby={errorId}
        className={cn(inputStyles, className)}
        name={name}
        {...props}
      />
      {error && (
        <p id={errorId} className="text-[var(--accent-red)] text-xs" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

interface FormSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  optional?: boolean;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export function FormSelect({
  label,
  error,
  optional,
  options,
  placeholder = "Select...",
  className,
  id: idProp,
  name,
  ...props
}: FormSelectProps) {
  const inputId = deriveInputId(label, idProp, name);
  const errorId = error ? `${inputId}-error` : undefined;
  return (
    <div className="space-y-2">
      <label htmlFor={inputId} className="block text-sm text-[var(--text-secondary)]">
        {label}
        {optional && <span className="text-[var(--text-muted)]"> (Optional)</span>}
      </label>
      <select
        id={inputId}
        aria-describedby={errorId}
        className={cn(inputStyles, className)}
        name={name}
        {...props}
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && (
        <p id={errorId} className="text-[var(--accent-red)] text-xs" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

interface FormTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  optional?: boolean;
}

export function FormTextarea({
  label,
  error,
  optional,
  className,
  id: idProp,
  name,
  ...props
}: FormTextareaProps) {
  const inputId = deriveInputId(label, idProp, name);
  const errorId = error ? `${inputId}-error` : undefined;
  return (
    <div className="space-y-2">
      <label htmlFor={inputId} className="block text-sm text-[var(--text-secondary)]">
        {label}
        {optional && <span className="text-[var(--text-muted)]"> (Optional)</span>}
      </label>
      <textarea
        id={inputId}
        aria-describedby={errorId}
        className={cn(inputStyles, "resize-none", className)}
        name={name}
        {...props}
      />
      {error && (
        <p id={errorId} className="text-[var(--accent-red)] text-xs" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

interface SubmitButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
}

export function SubmitButton({ loading, children, className, ...props }: SubmitButtonProps) {
  return (
    <button
      type="submit"
      disabled={loading || props.disabled}
      className={cn(
        "bg-[var(--accent-blue)] hover:bg-[var(--accent-blue)]/90 disabled:bg-[var(--bg-tertiary)] disabled:text-[var(--text-muted)]",
        "text-[var(--bg-secondary)] font-medium py-2.5 px-6 rounded-lg transition-colors",
        className,
      )}
      {...props}
    >
      {loading ? "Saving..." : children}
    </button>
  );
}
