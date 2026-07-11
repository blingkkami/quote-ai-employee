export function Editable({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <input className="inline-input" value={value} onChange={(event) => onChange(event.target.value)} />;
}
