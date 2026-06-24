import { useState, useRef, useCallback, useEffect } from 'react'
import { usePaystackPayment } from 'react-paystack'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import './UpscalePage.css'

// ===== ICONS =====
function UploadIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
      <rect x="6" y="8" width="28" height="24" rx="4" stroke="currentColor" strokeWidth="2" />
      <path d="M6 26L14 18L20 24L28 16L34 22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="14" cy="14" r="2.5" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}
function SparkleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 1L9.4 6.6L15 8L9.4 9.4L8 15L6.6 9.4L1 8L6.6 6.6L8 1Z" />
    </svg>
  )
}
function LockIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <rect x="5" y="10" width="12" height="9" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M7.5 10V7a3.5 3.5 0 117 0v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}
function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M3 8.5L6.5 12L13 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function CheckCircleIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
      <circle cx="18" cy="18" r="17" stroke="currentColor" strokeWidth="2" />
      <path d="M11 18.5L15.5 23L25 12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8 2V11M8 11L4.5 7.5M8 11L11.5 7.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 13.5H13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}
function SwapIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M5 6L2 8L5 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M11 6L14 8L11 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ===== LANCZOS UPSCALING ALGORITHM =====
const lanczosKernel = (x) => {
  if (x === 0) return 1
  if (Math.abs(x) >= 2) return 0
  const pix = Math.PI * x
  return (2 * Math.sin(pix) * Math.sin(pix / 2)) / (pix * pix)
}

const lanczosResize = (sourceCanvas, targetWidth, targetHeight) => {
  const src = sourceCanvas.getContext('2d')
  const srcWidth = sourceCanvas.width
  const srcHeight = sourceCanvas.height
  const srcData = src.getImageData(0, 0, srcWidth, srcHeight).data

  const destCanvas = document.createElement('canvas')
  destCanvas.width = targetWidth
  destCanvas.height = targetHeight
  const dest = destCanvas.getContext('2d')
  const destData = dest.createImageData(targetWidth, targetHeight)

  const scaleX = srcWidth / targetWidth
  const scaleY = srcHeight / targetHeight

  for (let y = 0; y < targetHeight; y++) {
    for (let x = 0; x < targetWidth; x++) {
      const srcX = x * scaleX
      const srcY = y * scaleY
      let r = 0, g = 0, b = 0, a = 0, weight = 0

      for (let ky = -1; ky <= 2; ky++) {
        for (let kx = -1; kx <= 2; kx++) {
          const px = Math.min(Math.max(Math.floor(srcX) + kx, 0), srcWidth - 1)
          const py = Math.min(Math.max(Math.floor(srcY) + ky, 0), srcHeight - 1)
          const w = lanczosKernel(srcX - Math.floor(srcX) - kx) *
                    lanczosKernel(srcY - Math.floor(srcY) - ky)
          const idx = (py * srcWidth + px) * 4
          r += srcData[idx] * w
          g += srcData[idx + 1] * w
          b += srcData[idx + 2] * w
          a += srcData[idx + 3] * w
          weight += w
        }
      }

      const destIdx = (y * targetWidth + x) * 4
      destData.data[destIdx] = Math.min(Math.max(r / weight, 0), 255)
      destData.data[destIdx + 1] = Math.min(Math.max(g / weight, 0), 255)
      destData.data[destIdx + 2] = Math.min(Math.max(b / weight, 0), 255)
      destData.data[destIdx + 3] = Math.min(Math.max(a / weight, 0), 255)
    }
  }

  dest.putImageData(destData, 0, 0)
  return destCanvas
}

// ===== SHARPEN FILTER =====
const sharpenCanvas = (canvas) => {
  const ctx = canvas.getContext('2d')
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const data = imageData.data
  const w = canvas.width

  const kernel = [0, -1, 0, -1, 5, -1, 0, -1, 0]
  const copy = new Uint8ClampedArray(data)

  for (let y = 1; y < canvas.height - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      for (let c = 0; c < 3; c++) {
        let val = 0
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = ((y + ky) * w + (x + kx)) * 4 + c
            val += copy[idx] * kernel[(ky + 1) * 3 + (kx + 1)]
          }
        }
        data[(y * w + x) * 4 + c] = Math.min(Math.max(val, 0), 255)
      }
    }
  }

  ctx.putImageData(imageData, 0, 0)
  return canvas
}

// ===== MAIN COMPONENT =====
function UpscalePage() {
  const [file, setFile] = useState(null)
  const [originalUrl, setOriginalUrl] = useState(null)
  const [resultUrl, setResultUrl] = useState(null)
  const [scale, setScale] = useState(2)
  const [status, setStatus] = useState('idle')
  const [sliderPos, setSliderPos] = useState(50)
  const [isDragging, setIsDragging] = useState(false)
  const [resultBlob, setResultBlob] = useState(null)
  const [imgAspect, setImgAspect] = useState(null)
  const fileInputRef = useRef(null)
  const sliderRef = useRef(null)

  // Real auth/payment state, sourced from Supabase — not local guesses
  const [user, setUser] = useState(null)
  const [isPaid, setIsPaid] = useState(false)
  const [profileLoading, setProfileLoading] = useState(true)
  const [verifying, setVerifying] = useState(false)
  const [justPaid, setJustPaid] = useState(false)

  useEffect(() => {
    const loadUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        setUser(session.user)
        const { data } = await supabase
          .from('profiles')
          .select('plan')
          .eq('id', session.user.id)
          .single()
        setIsPaid(data?.plan === 'paid')
      }
      setProfileLoading(false)
    }
    loadUser()
  }, [])

  const handleFile = (incoming) => {
    const f = Array.from(incoming).find(f => f.type.startsWith('image/'))
    if (!f) return
    setFile(f)
    const url = URL.createObjectURL(f)
    setOriginalUrl(url)
    setResultUrl(null)
    setResultBlob(null)
    setStatus('idle')

    const probe = new Image()
    probe.onload = () => setImgAspect(probe.naturalWidth / probe.naturalHeight)
    probe.src = url
  }

  const handleUpscale = async () => {
    if (!file) return
    setStatus('processing')

    try {
      const img = new Image()
      const url = URL.createObjectURL(file)
      img.src = url

      await new Promise((resolve, reject) => {
        img.onload = resolve
        img.onerror = reject
      })

      const sourceCanvas = document.createElement('canvas')
      sourceCanvas.width = img.naturalWidth
      sourceCanvas.height = img.naturalHeight
      const ctx = sourceCanvas.getContext('2d')
      ctx.drawImage(img, 0, 0)
      URL.revokeObjectURL(url)

      const targetWidth = img.naturalWidth * scale
      const targetHeight = img.naturalHeight * scale
      const upscaled = lanczosResize(sourceCanvas, targetWidth, targetHeight)
      const sharpened = sharpenCanvas(upscaled)

      const blob = await new Promise(resolve => sharpened.toBlob(resolve, 'image/png'))
      const result = URL.createObjectURL(blob)
      setResultUrl(result)
      setResultBlob(blob)
      setStatus('done')
    } catch (err) {
      console.error(err)
      setStatus('error')
    }
  }

  const handleSliderMove = useCallback((e) => {
    if (!sliderRef.current) return
    const rect = sliderRef.current.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const pos = ((clientX - rect.left) / rect.width) * 100
    setSliderPos(Math.min(Math.max(pos, 0), 100))
  }, [])

  const startDrag = useCallback((e) => {
    setIsDragging(true)
    handleSliderMove(e)
  }, [handleSliderMove])

  const paystackConfig = {
    reference: `nextew_${Date.now()}`,
    email: user?.email,
    amount: 50000,
    publicKey: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY,
    metadata: { user_id: user?.id },
  }

  const initializePayment = usePaystackPayment(paystackConfig)

  const pollForPaidStatus = async () => {
    for (let i = 0; i < 8; i++) {
      await new Promise(r => setTimeout(r, 2000))
      const { data } = await supabase.from('profiles').select('plan').eq('id', user.id).single()
      if (data?.plan === 'paid') {
        setIsPaid(true)
        setJustPaid(true)
        setVerifying(false)
        return
      }
    }
    setVerifying(false)
  }

  const handlePayment = () => {
    if (!user) return
    initializePayment({
      onSuccess: () => {
        setVerifying(true)
        pollForPaidStatus()
      },
      onClose: () => {
        console.log('Payment cancelled')
      }
    })
  }

  const handleDownload = () => {
    if (!resultBlob || !file) return
    const a = document.createElement('a')
    a.href = URL.createObjectURL(resultBlob)
    a.download = file.name.replace(/\.[^.]+$/, '') + `_${scale}x_upscaled.png`
    a.click()
  }

  return (
    <div className="upscale-page">

      <div className="page-header">
        <span className="page-eyebrow">Image upscaler</span>
        <h1 className="page-title">Make low-res images look high-res</h1>
        <p className="page-sub">
          Upload an image and enhance it up to 4× using Lanczos resampling with edge sharpening — entirely in your browser, nothing leaves your device until you choose to download.
        </p>
      </div>

      {!file && (
        <div
          className="dropzone"
          onClick={() => fileInputRef.current.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={e => handleFile(e.target.files)}
          />
          <div className="dropzone-icon"><UploadIcon /></div>
          <h3 className="dropzone-title">Upload an image to upscale</h3>
          <p className="dropzone-sub">Best results with small, low-resolution images</p>
          <button type="button" className="dropzone-btn">Choose image</button>
        </div>
      )}

      {file && (
        <div className="upscale-workspace">

          <div className="upscale-controls">
            <div className="control-group">
              <span className="control-label">Scale factor</span>
              <div className="scale-selector">
                <button className={`scale-btn ${scale === 2 ? 'active' : ''}`} onClick={() => setScale(2)}>
                  <span className="scale-number">2×</span>
                  <span className="scale-caption">Standard</span>
                </button>
                <button className={`scale-btn ${scale === 4 ? 'active' : ''}`} onClick={() => setScale(4)}>
                  <span className="scale-number">4×</span>
                  <span className="scale-caption">Ultra HD</span>
                </button>
              </div>
            </div>

            <div className="control-actions">
              <button className="btn-primary" onClick={handleUpscale} disabled={status === 'processing'}>
                <SparkleIcon />
                {status === 'processing' ? 'Upscaling...' : 'Upscale image'}
              </button>
              <button
                className="btn-ghost"
                onClick={() => {
                  setFile(null)
                  setOriginalUrl(null)
                  setResultUrl(null)
                  setImgAspect(null)
                  setStatus('idle')
                }}
              >
                Change image
              </button>
            </div>
          </div>

          {resultUrl && (
            <div
              className="comparison-slider"
              ref={sliderRef}
              style={{ aspectRatio: imgAspect || 4 / 3 }}
              onMouseDown={startDrag}
              onMouseMove={isDragging ? handleSliderMove : undefined}
              onMouseUp={() => setIsDragging(false)}
              onMouseLeave={() => setIsDragging(false)}
              onTouchStart={startDrag}
              onTouchMove={handleSliderMove}
            >
              <img src={resultUrl} alt="Upscaled result" className="comparison-img" draggable={false} />
              <div className="comparison-before" style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}>
                <img src={originalUrl} alt="Original" className="comparison-img" draggable={false} />
              </div>
              <div className="comparison-divider" style={{ left: `${sliderPos}%` }}>
                <div className="divider-handle"><SwapIcon /></div>
              </div>
              <span className="comparison-label label-before">Before</span>
              <span className="comparison-label label-after">After</span>
            </div>
          )}

          {!resultUrl && originalUrl && (
            <div className="original-preview" style={{ aspectRatio: imgAspect || 4 / 3 }}>
              <img src={originalUrl} alt="Original" draggable={false} />
              {status === 'processing' && (
                <div className="processing-overlay">
                  <div className="spinner" />
                  <p>Upscaling with Lanczos resampling...</p>
                  <span>This may take a few seconds for larger images</span>
                </div>
              )}
            </div>
          )}

          {status === 'done' && !profileLoading && (
            <div className="payment-section">
              {isPaid ? (
                <div className="download-section">
                  {justPaid && (
                    <div className="download-success">
                      <span className="success-icon"><CheckCircleIcon /></span>
                      <div>
                        <h3>Payment successful</h3>
                        <p>Your upscaled image is ready to download.</p>
                      </div>
                    </div>
                  )}
                  <button className="btn-download" onClick={handleDownload}>
                    <DownloadIcon />
                    Download {scale}× PNG
                  </button>
                </div>
              ) : verifying ? (
                <div className="verifying-state">
                  <div className="spinner" />
                  <p>Confirming your payment...</p>
                  <span>This usually takes just a few seconds</span>
                </div>
              ) : (
                <div className="paywall">
                  <div className="paywall-content">
                    <div className="paywall-icon"><LockIcon /></div>
                    <h3>Unlock full-resolution download</h3>
                    <p>Your image has been upscaled. Pay ₦500 to download the full-quality PNG.</p>
                    <ul className="paywall-features">
                      <li><span className="feature-icon"><CheckIcon /></span>Full-resolution {scale}× upscaled PNG</li>
                      <li><span className="feature-icon"><CheckIcon /></span>No watermark</li>
                      <li><span className="feature-icon"><CheckIcon /></span>Instant download</li>
                      <li><span className="feature-icon"><CheckIcon /></span>Lifetime access — pay once, use forever</li>
                    </ul>

                    {user ? (
                      <button className="btn-pay" onClick={handlePayment}>Pay ₦500 to unlock</button>
                    ) : (
                      <Link to="/login" target="_blank" className="btn-pay btn-pay-link">
                        Log in to continue
                      </Link>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      )}

    </div>
  )
}

export default UpscalePage