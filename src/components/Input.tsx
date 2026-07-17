type InputProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  inputMode?: "none" | "text" | "tel" | "url" | "email" | "numeric" | "decimal" | "search";
  maxLength?: number;
  autoComplete?: string;
  format?: (value: string) => string;
};

export function Input({ label, value, onChange, type = "text", placeholder, inputMode, maxLength, autoComplete, format }: InputProps) {
  return (
    <label>
      {label}
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        inputMode={inputMode}
        maxLength={maxLength}
        autoComplete={autoComplete}
        onChange={(event) => onChange(format ? format(event.target.value) : event.target.value)}
      />
    </label>
  );
}
