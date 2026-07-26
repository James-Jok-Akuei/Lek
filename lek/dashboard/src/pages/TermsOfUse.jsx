import { Link } from 'react-router-dom'
import PolicyPage from '../components/PolicyPage'

const sections = [
  {
    title: 'About this service',
    body:
      'Lëk is a food-price early warning service for South Sudan. It sends warnings by SMS and lets you check risk by dialling a USSD code. It is provided by a student research project at African Leadership University.',
  },
  {
    title: 'Warnings are predictions, not guarantees',
    body:
      'Lëk uses a machine learning model to estimate how food prices may change. Warnings say prices “may rise” by an estimated amount. They can be wrong. You should use them as one input to your decisions, not as certain fact.',
  },
  {
    title: 'No liability for decisions you make',
    body:
      'Because warnings are predictions, we are not liable for financial or other losses that result from acting on them. You remain responsible for your own decisions about buying, saving, or planning.',
  },
  {
    title: 'Acceptable use',
    body:
      'You may use Lëk to receive and check food-price warnings for yourself and your household. You may not resell the service, send spam through it, or attempt to disrupt, overload, or attack the system.',
  },
  {
    title: 'Joining and leaving',
    body:
      'You join freely and may leave at any time by replying STOP to any message, with no reason required. We may also pause or end the service, for example at the end of the research study.',
  },
  {
    title: 'Your data',
    // Same wording as the printed terms; the cross-reference is a live link.
    body: (
      <>
        Your use of Lëk is also governed by our{' '}
        <Link to="/privacy" className="font-semibold text-terra hover:underline">
          Privacy Policy
        </Link>
        , which explains what data we collect and how we protect it. Please read it together with
        these Terms.
      </>
    ),
  },
  {
    title: 'Governing law',
    body:
      'These Terms are governed by the laws of Rwanda, where the service was developed and tested, including Law N° 058/2021 on the protection of personal data and privacy.',
  },
]

export default function TermsOfUse() {
  return <PolicyPage title="Terms of Use" sections={sections} />
}
