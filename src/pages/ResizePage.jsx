import { useState, useRef, useEffect, useCallback } from 'react'
import Cropper from 'react-easy-crop'
import JSZip from 'jszip'
import './ResizePage.css'

const OUTPUT_FORMATS = [
  { label: 'PNG', value: 'png' },
  { label: 'JPG', value: 'jpeg' },
  { label: 'WebP', value: 'webp' },
  { label: 'AVIF', value: 'avif' },
]

const PRESET_MAP = [
  { label: 'Instagram story', width: 1080, height: 1920 },
  { label: 'Instagram post', width: 1080, height: 1080 },
  { label: 'Twitter banner', width: 1500, height: 500 },
  { label: 'Facebook cover', width: 820, height: 312 },
  { label: 'YouTube thumbnail', width: 1280, height: 720 },
  { label: 'Mobile wallpaper', width: 1080, height: 1920 },
]

// --- Logic Helpers (Hidden from UI) ---
const parseResizePrompt = (prompt) => {
  const text = prompt.toLowerCase().trim()
  if (!text) return null
  const explicit = text.match(/(\d{2,5})\s*[x×]\s*(\d{2,5})/) || text.match(/(\d{2,5})\s*by\s*(\d{2,5})/)
  if (explicit) return { width: Number(explicit[1]), height: Number(explicit[2]), message: `Parsed: ${explicit[1]}×${explicit[2]}` }
  for (const preset of PRESET_MAP) {
    if (text.includes(preset.label.toLowerCase()) || text.includes(preset.label.toLowerCase().replace(' ', ''))) {
      return { width: preset.width, height: preset.height, message: `Preset: ${preset.label}` }
    }
  }
  return null
}

const askGeminiWorker = async (prompt) => {
  const res = await fetch(import.meta.env.VITE_RESIZE_WORKER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Worker Error')
  return { width: data.width, height: data.height, message: `AI: ${data.width}x${data.height}px` }
}

const createImage = (src) => new Promise((resolve, reject) => {
  const image = new Image(); image.crossOrigin = 'anonymous';
  image.onload = () => resolve(image); image.onerror = reject; image.src = src;
})

const getCroppedImageBlob = async (file, cropAreaPixels, width, height, format, quality) => {
  const imageUrl = URL.createObjectURL(file)
  const image = await createImage(imageUrl)
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = format === 'jpeg' ? '#fff' : 'transparent'
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(image, cropAreaPixels.x, cropAreaPixels.y, cropAreaPixels.width, cropAreaPixels.height, 0, 0, width, height)
  URL.revokeObjectURL(imageUrl)
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), format === 'jpeg' ? 'image/jpeg' : `image/${format}`, quality)
  })
}

function ResizePage() {
  const [files, setFiles] = useState([])
  const [prompt, setPrompt] = useState('')
  const [parsed, setParsed] = useState(null)
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)
  const [outputFormat, setOutputFormat] = useState('webp')
  const [quality, setQuality] = useState(0.92)
  const [activeFileId, setActiveFileId] = useState(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const fileInputRef = useRef(null)

  useEffect(() => {
    setParsed(parseResizePrompt(prompt))
  }, [prompt])

  const updateFile = useCallback((id, updates) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f))
  }, [])

  const handleFiles = async (incoming) => {
    const newFiles = await Promise.all(Array.from(incoming).filter(f => f.type.startsWith('image/')).map(async f => {
      const preview = URL.createObjectURL(f)
      const img = await createImage(preview)
      return { id: crypto.randomUUID(), file: f, name: f.name, preview, status: 'idle', resultUrl: null, resultBlob: null, width: img.width, height: img.height, crop: { x: 0, y: 0 }, zoom: 1, croppedAreaPixels: null }
    }))
    setFiles(prev => [...prev, ...newFiles])
    if (!activeFileId) setActiveFileId(newFiles[0]?.id)
  }

  const handleCropComplete = useCallback((_, pixels) => {
    if (activeFileId) updateFile(activeFileId, { croppedAreaPixels: pixels, crop, zoom })
  }, [activeFileId, updateFile, crop, zoom])

  useEffect(() => {
    const active = files.find(f => f.id === activeFileId)
    if (active) { setCrop(active.crop); setZoom(active.zoom) }
  }, [activeFileId])

  const handleResizeAll = async () => {
    if (!files.length || !prompt.trim()) return setError('Please upload images and enter a prompt.')
    setError(null); setStatus('processing')
    let dims = parsed
    try {
      if (!dims) { setStatus('asking-ai'); dims = await askGeminiWorker(prompt) }
      setStatus('processing'); setParsed(dims)
      await Promise.all(files.map(async (f) => {
        updateFile(f.id, { status: 'processing' })
        const area = f.croppedAreaPixels || { x: 0, y: 0, width: f.width, height: f.height }
        const blob = await getCroppedImageBlob(f.file, area, dims.width, dims.height, outputFormat, quality)
        updateFile(f.id, { status: 'done', resultUrl: URL.createObjectURL(blob), resultBlob: blob, finalW: dims.width, finalH: dims.height })
      }))
      setStatus('done')
    } catch (err) { setStatus('error'); setError(err.message) }
  }

  const downloadZip = async () => {
    const zip = new JSZip()
    files.filter(f => f.resultBlob).forEach(f => zip.file(`${f.name.split('.')[0]}_resized.${outputFormat === 'jpeg' ? 'jpg' : outputFormat}`, f.resultBlob))
    const blob = await zip.generateAsync({ type: 'blob' })
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'resized_images.zip'; link.click()
  }

  return (
    <div className="resize-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">AI Bulk Resize + Draggable Crop</h1>
          <p className="page-sub">Upload, choose a prompt, drag frame, and export in bulk.</p>
        </div>
      </div>

      <div className="resize-content">
        <div className="resize-panel">
          {/* ORIGINAL UI: Add Images Card */}
          <div className="upload-card upload-grid" onClick={() => fileInputRef.current?.click()}>
            <input ref={fileInputRef} type="file" multiple hidden onChange={(e) => handleFiles(e.target.files)} />
            <div className="upload-placeholder">
              <span>??</span>
              <p>{files.length > 0 ? `${files.length} image(s) ready` : 'Click or drop images here'}</p>
              <small>PNG, JPEG, WebP supported. Drag each image into the frame after upload.</small>
            </div>
            <button type="button" className="btn-primary upload-button">Add Images</button>
          </div>

          {/* ORIGINAL UI: Prompt Card */}
          <div className="prompt-card">
            <label className="label">Resize prompt</label>
            <textarea className="prompt-input" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="e.g. resize to 1080x1920, make it square 500px, Instagram story size" />
            <div className="prompt-meta">
              <span className="prompt-hint">Try: 1080x1920, square 500px, Instagram story.</span>
              {parsed && <span className="prompt-result">{parsed.message}</span>}
            </div>
            
            <div className="bulk-options" style={{ marginTop: '15px' }}>
              <label className="label">Output format</label>
              <select className="format-select" value={outputFormat} onChange={(e) => setOutputFormat(e.target.value)}>
                {OUTPUT_FORMATS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>

              {/* NEW ADDITION: Quality Control (styled to match your UI) */}
              {outputFormat !== 'png' && (
                <div style={{ marginTop: '15px' }}>
                  <label className="label">Quality: {Math.round(quality * 100)}%</label>
                  <input type="range" min="0.1" max="1" step="0.01" value={quality} onChange={(e) => setQuality(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--primary)' }} />
                </div>
              )}
            </div>

            <button type="button" className="btn-primary btn-full" style={{ marginTop: '20px' }} onClick={handleResizeAll} disabled={status.includes('process')}>
              {status === 'processing' ? 'Resizing...' : 'Resize all images'}
            </button>
            {error && <p className="error-text">{error}</p>}
          </div>

          {/* ORIGINAL UI: File List */}
          {files.length > 0 && (
            <div className="file-list">
              {files.map((f) => (
                <div key={f.id} className={`file-item ${f.id === activeFileId ? 'active' : ''}`} onClick={() => setActiveFileId(f.id)} style={{ position: 'relative' }}>
                  <img src={f.preview} alt="" />
                  <span>{f.name}</span>
                  <small style={{ color: f.status === 'done' ? '#10b981' : 'inherit' }}>{f.status.toUpperCase()}</small>
                  {/* Logic Addition: Remove button */}
                  <button onClick={(e) => { e.stopPropagation(); setFiles(prev => prev.filter(x => x.id !== f.id)) }} style={{ position: 'absolute', right: '10px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}>✕</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="result-panel">
          {/* ORIGINAL UI: Drag Crop Frame */}
          <div className="crop-board">
            <div className="crop-header">
              <h2>Drag crop frame</h2>
              <button type="button" className="btn-ghost-sm" onClick={() => setFiles([])}>Clear all</button>
            </div>
            <div className="crop-preview">
              {files.find(f => f.id === activeFileId) && parsed ? (
                <Cropper 
                  image={files.find(f => f.id === activeFileId).preview} 
                  crop={crop} zoom={zoom} 
                  aspect={parsed.width / parsed.height} 
                  onCropChange={setCrop} onZoomChange={setZoom} 
                  onCropComplete={handleCropComplete} 
                />
              ) : <div className="result-empty"><p>Enter a prompt first to set the frame size.</p></div>}
            </div>
            {activeFileId && parsed && (
              <div className="crop-controls">
                <label className="label">Zoom</label>
                <input type="range" min="1" max="3" step="0.01" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} />
              </div>
            )}
          </div>

          {/* ORIGINAL UI: Processed Images Export */}
          <div className="result-card">
            <div className="result-header">
              <h2>Processed images</h2>
              <button type="button" className="btn-download" onClick={downloadZip} disabled={!files.some(f => f.status === 'done')}>
                Download ZIP ({files.filter(f => f.status === 'done').length})
              </button>
            </div>
            <div className="processed-list">
              {files.filter(f => f.resultUrl).map(f => (
                <div key={f.id} className="processed-item">
                  <img src={f.resultUrl} alt="" />
                  <div><strong>{f.finalW} x {f.finalH}</strong></div>
                  <button type="button" className="btn-download-sm" onClick={() => { const a = document.createElement('a'); a.href = f.resultUrl; a.download = `resized_${f.name}`; a.click(); }}>Download</button>
                </div>
              ))}
            </div>
          </div>

          {/* ORIGINAL UI: Examples Card */}
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