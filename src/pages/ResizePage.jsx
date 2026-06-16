import { useState, useRef, useEffect } from 'react'
import './ResizePage.css'

const PRESET_MAP = [
  { label: 'Instagram story', width: 1080, height: 1920 },
  { label: 'Instagram post', width: 1080, height: 1080 },
  { label: 'Twitter banner', width: 1500, height: 500 },
  { label: 'Facebook cover', width: 820, height: 312 },
  { label: 'YouTube thumbnail', width: 1280, height: 720 },
  { label: 'Mobile wallpaper', width: 1080, height: 1920 },
]

const parseResizePrompt = (prompt) => {
  const text = prompt.toLowerCase().trim()
  if (!text) return null

  const explicit = text.match(/(\d{2,5})\s*[x×]\s*(\d{2,5})/) || text.match(/(\d{2,5})\s*by\s*(\d{2,5})/)
  if (explicit) {
    return {
      width: Number(explicit[1]),
      height: Number(explicit[2]),
      message: `Parsed dimensions: ${explicit[1]} × ${explicit[2]}`,
    }
  }

  const square = text.match(/square\s*(\d{2,5})/) || text.match(/(\d{2,5})\s*px\s*square/)
  if (square) {
    const size = Number(square[1])
    return {
      width: size,
      height: size,
      message: `Parsed square size: ${size} × ${size}`,
    }
  }

  for (const preset of PRESET_MAP) {
    if (text.includes(preset.label.toLowerCase()) || text.includes(preset.label.toLowerCase().replace(' ', ''))) {
      return {
        width: preset.width,
        height: preset.height,
        message: `Detected preset: ${preset.label}`,
      }
    }
  }

  if (text.includes('story')) {
    return {
      width: 1080,
      height: 1920,
      message: 'Detected Instagram story size',
    }
  }

  if (text.includes('post') || text.includes('square')) {
    return {
      width: 1080,
      height: 1080,
      message: 'Detected square post size',
    }
  }

  if (text.includes('portrait')) {
    return {
      width: 1080,
      height: 1350,
      message: 'Detected portrait size',
    }
  }

  if (text.includes('landscape')) {
    return {
      width: 1920,
      height: 1080,
      message: 'Detected landscape size',
    }
  }

  if (text.includes('wallpaper')) {
    return {
      width: 1080,
      height: 1920,
      message: 'Detected mobile wallpaper size',
    }
  }

  return null
}

const askGeminiWorker = async (prompt) => {
  const res = await fetch(import.meta.env.VITE_RESIZE_WORKER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt })
  })

  // Always read response text so we can show useful errors when the worker fails
  const text = await res.text()

  let data
  try {
    data = text ? JSON.parse(text) : null
  } catch (err) {
    // If the worker returned non-JSON, include the raw text in the error
    throw new Error(`Worker returned invalid response: ${text || '[empty]'}`)
  }

  if (!res.ok) {
    const msg = data?.error || `Worker responded ${res.status}`
    throw new Error(msg)
  }

  if (data?.error) throw new Error(data.error)
  if (!data?.width || !data?.height) throw new Error('Invalid dimensions')

  return {
    width: data.width,
    height: data.height,
    message: ` AI parsed: ${data.width} x ${data.height}px`
  }
}

const resizeImage = async (file, width, height) => {
  const image = new Image()
  const imageUrl = URL.createObjectURL(file)
  image.src = imageUrl
  await new Promise((resolve, reject) => {
    image.onload = resolve
    image.onerror = reject
  })

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(image, 0, 0, width, height)

  URL.revokeObjectURL(imageUrl)

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(blob)
    }, 'image/png')
  })
}

function ResizePage() {
  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [prompt, setPrompt] = useState('')
  const [parsed, setParsed] = useState(null)
  const [status, setStatus] = useState('idle')
  const [resultUrl, setResultUrl] = useState(null)
  const [error, setError] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (!prompt) {
      setParsed(null)
      return
    }
    setParsed(parseResizePrompt(prompt))
  }, [prompt])

  useEffect(() => {
    return () => {
      if (resultUrl) {
        URL.revokeObjectURL(resultUrl)
      }
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [resultUrl, previewUrl])

  const handleFileChange = (files) => {
    const imageFile = Array.from(files).find((f) => f.type.startsWith('image/'))
    if (!imageFile) return

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }

    setFile(imageFile)
    setPreviewUrl(URL.createObjectURL(imageFile))
    setResultUrl(null)
    setStatus('idle')
    setError(null)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    handleFileChange(e.dataTransfer.files)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDropzoneKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      fileInputRef.current?.click()
    }
  }

  const handleResize = async () => {
    if (!file) {
      setError('Upload an image first.')
      return
    }
    if (!prompt.trim()) {
      setError('Please enter a size prompt')
      return
    }

    setError(null)
    setStatus('processing')

    try {
      let dimensions = parseResizePrompt(prompt)
      if (!dimensions) {
        setStatus('asking-ai')
        dimensions = await askGeminiWorker(prompt)
      }

      setStatus('processing')
      const blob = await resizeImage(file, dimensions.width, dimensions.height)
      const url = URL.createObjectURL(blob)
      setResultUrl(url)
      setParsed(dimensions)
      setStatus('done')
    } catch (err) {
      console.error(err)
      setError(err.message || 'Could not understand that prompt. Try something like "1080x1920" or "Instagram story size".')
      setStatus('error')
    }
  }

  const handleDownload = () => {
    if (!resultUrl || !file) return
    const a = document.createElement('a')
    a.href = resultUrl
    a.download = file.name.replace(/\.[^.]+$/, '') + `_${parsed?.width}x${parsed?.height}.png`
    a.click()
  }

  return (
    <div className="resize-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">AI-style Image Resize</h1>
          <p className="page-sub">
            Upload an image, type a prompt, and resize instantly with smart prompt parsing.
          </p>
        </div>
      </div>

      <div className="resize-content">
        <div className="resize-panel">
          <label
            className={`upload-card ${isDragging ? 'dragging' : ''}`}
            htmlFor="resize-upload"
            role="button"
            tabIndex="0"
            aria-label="Upload or drop an image"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onKeyDown={handleDropzoneKeyDown}
          >
            <input
              id="resize-upload"
              type="file"
              accept="image/*"
              hidden
              ref={fileInputRef}
              onChange={(e) => handleFileChange(e.target.files)}
            />
            <div className="upload-preview">
              {file ? (
                <img src={previewUrl} alt="Uploaded" className="upload-image" />
              ) : (
                <div className="upload-placeholder">
                  <span>📁</span>
                  <p>Select an image</p>
                  <small>PNG, JPEG, or WebP</small>
                </div>
              )}
            </div>
            <button 
              type="button" 
              className="btn-primary upload-button"
              onClick={() => fileInputRef.current?.click()}
            >
              {file ? 'Change Image' : 'Upload Image'}
            </button>
          </label>

          <div className="prompt-card">
            <label className="label" htmlFor="resize-prompt">
              Resize with AI prompt
            </label>
            <textarea
              id="resize-prompt"
              className="prompt-input"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              aria-describedby="prompt-hint"
              placeholder="e.g. resize to 1080x1920, make it square 500px, Instagram story size"
            />
            <div className="prompt-meta">
              <span id="prompt-hint" className="prompt-hint">Try: 1080x1920, square 500px, Instagram story.</span>
              {parsed && (
                <span className="prompt-result" aria-live="polite">{parsed.message}</span>
              )}
            </div>
            <button
              type="button"
              className="btn-primary btn-full"
              onClick={handleResize}
              disabled={!file || status === 'processing' || status === 'asking-ai'}
            >
              {status === 'processing' ? 'Resizing...' : status === 'asking-ai' ? 'Asking AI...' 
              : 'Resize Image'}
            </button>
            {error && <p className="error-text" role="alert" aria-live="assertive">{error}</p>}
          </div>
        </div>

        <div className="result-panel">
          <div className="result-card">
            <div className="result-header">
              <h2>Result</h2>
              {resultUrl && (
                <button type="button" className="btn-download" onClick={handleDownload} aria-label="Download resized image as PNG">
                  ⬇ Download PNG
                </button>
              )}
            </div>

            <div className="result-preview">
              {status === 'done' && resultUrl ? (
                <img src={resultUrl} alt="Resized result" className="result-image" />
              ) : (
                <div className="result-empty">
                  <p>{status === 'processing' ? 'Processing your image...' : 'Your resized image will appear here.'}</p>
                </div>
              )}
            </div>
          </div>
          <div className="examples-card">
            <h3>Try prompts like</h3>
            <ul>
              <li>resize to 1080x1920</li>
              <li>make it square 500px</li>
              <li>Instagram story size</li>
              <li>Twitter banner</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ResizePage