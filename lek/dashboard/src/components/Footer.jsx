import { Link } from 'react-router-dom'

// Thin site-wide footer. Rendered once in App so it sits below every page,
// including the login screen and the public privacy page. Not fixed — it is
// the last item in the app's flex column, so it is pushed to the bottom on
// short pages and simply follows the content on long ones.
export default function Footer() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto flex w-full max-w-400 flex-col gap-2 px-6 py-5 text-[13px] text-muted sm:flex-row sm:items-center sm:justify-between sm:gap-6 lg:px-10">
        <p>&copy; 2026 Lëk — African Leadership University</p>

        <p className="order-last sm:order-0 sm:text-center">
          Food price early warnings by SMS for South Sudan.
        </p>

        <span className="flex items-center gap-2 sm:shrink-0">
          <Link to="/privacy" className="font-semibold text-terra transition hover:underline">
            Privacy Policy
          </Link>
          <span aria-hidden="true" className="text-line-strong">
            |
          </span>
          <Link to="/terms" className="font-semibold text-terra transition hover:underline">
            Terms of Use
          </Link>
        </span>
      </div>
    </footer>
  )
}
