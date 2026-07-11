export function SectionTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="section-title">
      <h2>{title}</h2>
      {hint && <p>{hint}</p>}
    </div>
  );
}
