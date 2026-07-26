import PolicyPage from '../components/PolicyPage'

const sections = [
  {
    title: 'What data we collect',
    body:
      'We collect only your phone number and your county. We do not collect your name, precise location, or any financial information. This is ‘data minimisation’: we hold the least data needed to send you a warning.',
  },
  {
    title: 'Why we collect it',
    body:
      'Your phone number is used for one purpose only: to send you food-price warnings by SMS and to let you check risk by USSD. It is never used for anything else and never sold or shared with advertisers.',
  },
  {
    title: 'Consent and withdrawal',
    body:
      'You join freely and you may stop at any time by replying STOP to any message, with no reason required. Test participants also signed a written consent form before taking part.',
  },
  {
    title: 'How we protect your data',
    body:
      'Your phone number is stored in a secured database and is masked in all staff screens and shared materials. Only the system uses the full number, to send your alert.',
  },
  {
    title: 'Data retention and deletion',
    body:
      'For the research study, personal data is deleted after the study ends unless you gave written permission to keep it. We do not keep data longer than needed.',
  },
  {
    title: 'Accuracy and honesty of warnings',
    body:
      'Warnings are predictions, not certainties. They say prices ‘may rise’ by an estimated amount. We are honest that the system can be wrong, and we log every prediction so errors can be found and fixed.',
  },
  {
    title: 'Your rights',
    body:
      'You have the right to know what data we hold about you, to ask for it to be deleted, and to withdraw at any time. These rights follow Rwanda’s Law N° 058/2021 on data protection.',
  },
]

export default function PrivacyPolicy() {
  return <PolicyPage title="Privacy Policy" sections={sections} />
}
