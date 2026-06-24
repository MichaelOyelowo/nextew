import './PlanBadge.css'

export default function PlanBadge({ plan }) {
  return (
    <span className={`plan-badge ${plan === 'paid' ? 'plan-paid' : 'plan-free'}`}>
      {plan === 'paid' ? 'Paid' : 'Free'}
    </span>
  )
}