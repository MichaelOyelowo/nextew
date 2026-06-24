import { useNavigate } from 'react-router-dom'
import './PricingPage.css'

const freeFeatures = [
  { label: 'Image resizing', included: true },
  { label: 'Background removal', included: true },
  { label: 'SVG conversion', included: true },
  { label: 'Preview upscaled images', included: true },
  { label: 'Full-resolution upscale downloads', included: false },
]

const paidFeatures = [
  { label: 'Everything in Free', included: true },
  { label: 'Full-resolution upscale downloads', included: true },
  { label: 'No watermark', included: true },
  { label: 'Lifetime access — pay once, use forever', included: true },
]

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M3 8.5L6.5 12L13 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function CrossIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export default function PricingPage() {
  const navigate = useNavigate()

  return (
    <div className="pricing-page">
      <div className="pricing-header">
        <span className="pricing-eyebrow">Pricing</span>
        <h1>Simple, honest pricing</h1>
        <p>Try every tool for free. Pay once, only when you need full-resolution downloads.</p>
      </div>

      <div className="pricing-grid">
        <div className="pricing-card">
          <div className="pricing-card-top">
            <h2>Free</h2>
            <div className="pricing-price">
              <span className="price-amount">₦0</span>
              <span className="price-period">forever</span>
            </div>
            <p className="pricing-tagline">Everything you need to try Nextew</p>
          </div>
          <ul className="pricing-features">
            {freeFeatures.map((f) => (
              <li key={f.label} className={f.included ? '' : 'feature-excluded'}>
                <span className="feature-icon">{f.included ? <CheckIcon /> : <CrossIcon />}</span>
                {f.label}
              </li>
            ))}
          </ul>
          <button className="btn-pricing btn-pricing-ghost" onClick={() => navigate('/upscale')}>
            Get started free
          </button>
        </div>

        <div className="pricing-card pricing-card-featured">
          <span className="pricing-badge">One-time payment</span>
          <div className="pricing-card-top">
            <h2>Paid</h2>
            <div className="pricing-price">
              <span className="price-amount">₦500</span>
              <span className="price-period">one-time</span>
            </div>
            <p className="pricing-tagline">Unlock full-resolution downloads, forever</p>
          </div>
          <ul className="pricing-features">
            {paidFeatures.map((f) => (
              <li key={f.label}>
                <span className="feature-icon"><CheckIcon /></span>
                {f.label}
              </li>
            ))}
          </ul>
          <button className="btn-pricing btn-pricing-primary" onClick={() => navigate('/upscale')}>
            Upscale & unlock
          </button>
        </div>
      </div>

      <p className="pricing-footnote">
        Payments are processed securely via Paystack. No subscriptions, no hidden fees.
      </p>
    </div>
  )
}