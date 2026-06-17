import { useState, useRef } from 'react'
import './BgRemovePage.css'

const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)

const convertToPngBlob = (file, maxDim = 1500) => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      let { naturalWidth: w, naturalHeight: h } = img
      if (w > maxDim || h > maxDim) {
        const scale = Math.min(maxDim / w, maxDim / h)
        w = Math.round(w * scale)
        h = Math.round(h * scale)
      }
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(url)
      canvas.toBlob(blob => {
        if (!blob) return reject(new Error('Conversion failed'))
        resolve(blob)
      }, 'image/png')
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image'))
    }
    img.src = url
  })
}

function BgRemovePage() {
  const [files, setFiles] = useState([])
  const [isDragging, setIsDragging] = useState(false)
  const [modelLoaded, setModelLoaded] = useState(false)
  const fileInputRef = useRef(null)
  const removeBackgroundRef = useRef(null)

  const handleFiles = (incoming) => {
    const imageFiles = Array.from(incoming).filter(f =>
      f.type.startsWith('image/')
    )
    const mapped = imageFiles.map(f => ({
      id: crypto.randomUUID(),
      file: f,
      name: f.name,
      size: f.size,
      preview: URL.createObjectURL(f),
      status: 'idle',
      resultUrl: null,
      resultBlob: null,
      error: null,
    }))
    setFiles(prev => [...prev, ...mapped])
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    handleFiles(e.dataTransfer.files)
  }

  const handleDropzoneKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      fileInputRef.current.click()
    }
  }

  const updateFile = (id, updates) => {
    setFiles(prev =>
      prev.map(f => f.id === id ? { ...f, ...updates } : f)
    )
  }

  const removeFile = (id) => {
    setFiles(prev => prev.filter(f => f.id !== id))
  }

  const clearAll = () => setFiles([])

  const processAll = async () => {
  if (!removeBackgroundRef.current) {
    const { removeBackground } = await import('@imgly/background-removal')
    removeBackgroundRef.current = removeBackground
    setModelLoaded(true)
  }

  const idle = files.filter(f => f.status === 'idle')

  for (const f of idle) {
    updateFile(f.id, { status: 'processing' })
    try {
      const maxDim = isMobile ? 600 : 1500
      const pngBlob = await convertToPngBlob(f.file, maxDim)

      const blob = await removeBackgroundRef.current(pngBlob, {
        model: 'small',
        progress: (key, current, total) => {
          console.log(`${f.name} — ${key}: ${current}/${total}`)
        },
      })

      // Free the png blob from memory immediately
      const resultUrl = URL.createObjectURL(blob)
      updateFile(f.id, {
        status: 'done',
        resultUrl,
        resultBlob: blob,
      })

      // Small delay between images on mobile — lets browser breathe
      if (isMobile) {
        await new Promise(resolve => setTimeout(resolve, 800))
      }

    } catch (err) {
      console.error(err)
      updateFile(f.id, {
        status: 'error',
        error: isMobile
          ? 'Failed — try a smaller image (under 500KB)'
          : 'Failed to process this image.',
      })
    }
  }
}

  const downloadFile = (f) => {
    const a = document.createElement('a')
    a.href = f.resultUrl
    a.download = f.name.replace(/\.[^.]+$/, '') + '_nobg.png'
    a.click()
  }

  const downloadAll = () => {
    files.filter(f => f.status === 'done').forEach(downloadFile)
  }

  const isProcessing = files.some(f => f.status === 'processing')
  const doneCount = files.filter(f => f.status === 'done').length
  const idleCount = files.filter(f => f.status === 'idle').length

  return (
    <div className="bgremove-page">

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Remove Background</h1>
          <p className="page-sub">
            AI-powered · Batch processing · Runs entirely in your browser
          </p>
        </div>
        {files.length > 0 && (
          <button
            type="button"
            className="btn-ghost-sm"
            onClick={clearAll}
            aria-label="Clear all selected images"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Mobile warning */}
      {isMobile && (
        <div className="model-notice warning">
          ⚠️ Mobile processing works best with images under 500KB.
          Large images may take longer or fail due to memory limits.
        </div>
      )}

      {/* Drop Zone */}
      {files.length === 0 ? (
        <div
          className={`dropzone ${isDragging ? 'dragging' : ''}`}
          role="button"
          tabIndex="0"
          aria-label="Upload images by drag and drop or click to browse files"
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onKeyDown={handleDropzoneKeyDown}
          onClick={() => fileInputRef.current.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: 'none' }}
            aria-label="Upload images"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <div className="dropzone-icon">
            {isDragging ? '📂' : '✂️'}
          </div>
          <h3 className="dropzone-title">
            {isDragging
              ? 'Release to upload'
              : 'Upload images to remove background'}
          </h3>
          <button className="dropzone-btn">Upload Images</button>
          <p className="dropzone-sub">
            Drop multiple images · PNG, JPEG, WebP, AVIF supported
          </p>
        </div>
      ) : (
        <div className="workspace">

          {/* Action Bar */}
          <div className="action-bar" role="region" aria-label="Background removal actions">
            <div className="action-bar-left">
              <button
                type="button"
                className="btn-primary"
                onClick={processAll}
                disabled={isProcessing || idleCount === 0}
                aria-busy={isProcessing}
              >
                {isProcessing
                  ? 'Processing...'
                  : idleCount === 0
                  ? '✅ All done'
                  : `✂️ Remove BG from ${idleCount} image${idleCount !== 1 ? 's' : ''}`}
              </button>

              <button
                type="button"
                className="btn-ghost"
                onClick={() => fileInputRef.current.click()}
              >
                + Add more
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                style={{ display: 'none' }}
                onChange={(e) => handleFiles(e.target.files)}
              />
            </div>

            {doneCount > 1 && (
              <div className="action-bar-right">
                <button
                  type="button"
                  className="btn-download"
                  onClick={downloadAll}
                  aria-label={`Download all ${doneCount} processed images`}
                >
                  ⬇ Download all ({doneCount})
                </button>
              </div>
            )}
          </div>

          {/* Model loading notice */}
          {!modelLoaded && (
            <div className="model-notice">
              ℹ️ First run downloads the AI model (~20MB). It's cached after that.
            </div>
          )}

          {/* File Grid */}
          <div className="file-grid">
            {files.map(f => (
              <div key={f.id} className={`file-card status-${f.status}`}>

                <div className="card-images">
                  <div className="card-img-wrap">
                    <img src={f.preview} alt={f.name} className="card-img" />
                    <span className="card-img-label">Before</span>
                  </div>

                  <div className="card-img-wrap">
                    {f.status === 'done' && f.resultUrl ? (
                      <>
                        <img
                          src={f.resultUrl}
                          alt="result"
                          className="card-img checkerboard"
                        />
                        <span className="card-img-label">After</span>
                      </>
                    ) : (
                      <div className="card-img-placeholder">
                        {f.status === 'processing' && (
                          <>
                            <div className="spinner" />
                            <span>Processing...</span>
                          </>
                        )}
                        {f.status === 'idle' && <span>Queued</span>}
                        {f.status === 'error' && (
                          <span className="error-text">Failed</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="card-info">
                  <span className="card-name" title={f.name}>{f.name}</span>
                  <span className="card-size">
                    {(f.size / 1024).toFixed(1)} KB
                  </span>
                </div>

                <div className="card-actions">
                  {f.status === 'done' && (
                    <button
                      type="button"
                      className="btn-download-sm"
                      onClick={() => downloadFile(f)}
                      aria-label={`Download processed image ${f.name}`}
                    >
                      ⬇ Download
                    </button>
                  )}
                  {f.status === 'error' && (
                    <span className="error-text">{f.error}</span>
                  )}
                  <button
                    type="button"
                    className="btn-remove-sm"
                    onClick={() => removeFile(f.id)}
                    aria-label={`Remove ${f.name}`}
                  >
                    ✕
                  </button>
                </div>

              </div>
            ))}
          </div>

          <p className="privacy-note">
            🔒 Your images never leave your device. All processing happens locally.
          </p>

        </div>
      )}

    </div>
  )
}

export default BgRemovePage