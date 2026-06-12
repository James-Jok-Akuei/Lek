// Lëk wordmark — a contrasted serif, echoing the boutique feel of the
// reference. No mark/box; the typography carries it.
export default function Logo({ className = 'text-3xl' }) {
  return (
    <span
      className={`font-serif font-semibold leading-none tracking-tight text-ink ${className}`}
    >
      Lëk
    </span>
  )
}
