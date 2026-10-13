export default function OwlMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 24" className={className} aria-hidden="true">
      <circle cx="11" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="29" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="13" cy="12" r="3.5" fill="currentColor" />
      <circle cx="31" cy="12" r="3.5" fill="currentColor" />
    </svg>
  );
}
