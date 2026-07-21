export function TextArea({ label, value, placeholder, maxLength, disabled, onChange }: { label: string; value: string; placeholder?: string; maxLength?: number; disabled?: boolean; onChange: (value: string) => void }) {
  return (
    <label>
      {label}
      <textarea value={value} placeholder={placeholder} maxLength={maxLength} disabled={disabled} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}
