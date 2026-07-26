import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

// Shared chrome for the public policy pages (Privacy Policy, Terms of Use):
// Back button, card, numbered sections, contact line. Both pages are public —
// they sit outside RequireAuth so citizens and reviewers can read them without
// an account.

export const CONTACT_EMAIL = 'jokditakeerleek@gmail.com'

export const LAST_UPDATED = '26 July 2026'

export default function PolicyPage({ title, sections }) {
  const navigate = useNavigate()

  // react-router records a history index; index 0 means this page was opened
  // directly (fresh tab, pasted link), so there is nothing to go back to.
  function handleBack() {
    const idx = window.history.state?.idx ?? 0
    if (idx > 0) navigate(-1)
    else navigate('/login', { replace: true })
  }

  return (
    <div className="flex-1 bg-canvas px-4 py-10 sm:px-6 sm:py-14">
      <div className="mx-auto w-full max-w-3xl">
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center gap-1.5 rounded-full border border-line-strong px-4 py-2 text-sm font-semibold text-ink-soft transition hover:bg-surface hover:text-ink"
        >
          <ArrowLeft size={16} strokeWidth={1.8} />
          Back
        </button>

        <div className="mt-6 rounded-xl bg-surface p-6 sm:p-10">
          <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">{title}</h1>
          <p className="mt-2 text-sm text-muted">Last updated: {LAST_UPDATED}</p>

          <div className="mt-8 space-y-7">
            {sections.map((section, i) => (
              <section key={section.title}>
                <h2 className="text-base font-semibold text-ink sm:text-lg">
                  {i + 1}. {section.title}
                </h2>
                <p className="mt-1.5 text-[15px] leading-relaxed text-ink-soft">{section.body}</p>
              </section>
            ))}
          </div>

          <div className="mt-10 border-t border-line pt-6">
            <p className="text-sm text-muted">
              Questions about your data? Contact:{' '}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="font-semibold text-terra hover:underline"
              >
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
