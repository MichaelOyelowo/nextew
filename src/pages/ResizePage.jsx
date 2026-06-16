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
    body: JSON.stringify({ prompt }),
  })

  const text = await res.text()

  let data
  try {
    data = text ? JSON.parse(text) : null
  } catch (err) {
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
    message: `AI parsed: ${data.width} x ${data.height}px`,
  }
}

const createImage = (src) => new Promise((resolve, reject) => {
  const image = new Image()
  image.crossOrigin = 'anonymous'
  image.onload = () => resolve(image)
  image.onerror = reject
  image.src = src
})

const createDefaultCrop = (imageWidth, imageHeight, width, height) => {
  const targetAspect = width / height
  const imageAspect = imageWidth / imageHeight

  if (imageAspect > targetAspect) {
    const cropWidth = imageHeight * targetAspect
    return {
      x: (imageWidth - cropWidth) / 2,
      y: 0,
      width: cropWidth,
      height: imageHeight,
    }
  }

  const cropHeight = imageWidth / targetAspect
  return {
    x: 0,
    y: (imageHeight - cropHeight) / 2,
    width: imageWidth,
    height: cropHeight,
  }
}

const getOutputMimeType = (format) => {
  if (format === 'jpeg') return 'image/jpeg'
  if (format === 'webp') return 'image/webp'
  if (format === 'avif') return 'image/avif'
  return 'image/png'
}

const getExtension = (format) => (format === 'jpeg' ? 'jpg' : format)

const getCroppedImageBlob = async (file, cropAreaPixels, width, height, format) => {
  const imageUrl = URL.createObjectURL(file)
  const image = await createImage(imageUrl)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, width, height)

  ctx.drawImage(
    image,
    cropAreaPixels.x,
    cropAreaPixels.y,
    cropAreaPixels.width,
    cropAreaPixels.height,
    0,
    0,
    width,
    height,
  )

  URL.revokeObjectURL(imageUrl)

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(blob)
    }, getOutputMimeType(format), 0.92)
  })
}

function ResizePage() {
  const [files, setFiles] = useState([])
  const [prompt, setPrompt] = useState('')
  const [parsed, setParsed] = useState(null)
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)
  const [outputFormat, setOutputFormat] = useState('png')
  const [activeFileId, setActiveFileId] = useState(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null)
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
      files.forEach((fileItem) => {
        URL.revokeObjectURL(fileItem.preview)
        URL.revokeObjectURL(fileItem.resultUrl)
      })
    }
  }, [files])

  const updateFile = useCallback((id, updates) => {
    setFiles((prev) => prev.map((fileItem) => (fileItem.id === id ? { ...fileItem, ...updates } : fileItem)))
  }, [])

  const handleFiles = async (incoming) => {
    const imageFiles = Array.from(incoming).filter((f) => f.type.startsWith('image/'))
    if (imageFiles.length === 0) return

    const mapped = await Promise.all(imageFiles.map(async (fileItem) => {
      const preview = URL.createObjectURL(fileItem)
      let width = 0
      let height = 0
      try {
        const image = await createImage(preview)
        width = image.width
        height = image.height
      } catch (err) {
        console.warn('Failed to read image dimensions', err)
      }

      return {
        id: crypto.randomUUID(),
        file: fileItem,
        name: fileItem.name,
        preview,
        status: 'idle',
        resultUrl: null,
        resultBlob: null,
        error: null,
        width,
        height,
        crop: { x: 0, y: 0 },
        zoom: 1,
        croppedAreaPixels: null,
      }
    }))

    setFiles((prev) => [...prev, ...mapped])
    setActiveFileId((prev) => prev || mapped[0]?.id)
    setError(null)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    handleFiles(e.dataTransfer.files)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
  }

  const handleDropzoneKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      fileInputRef.current?.click()
    }
  }

  const handleCropComplete = useCallback((_, croppedPixels) => {
    setCroppedAreaPixels(croppedPixels)
    if (!activeFileId) return
    updateFile(activeFileId, { croppedAreaPixels: croppedPixels })
  }, [activeFileId, updateFile])

  const activeFile = files.find((fileItem) => fileItem.id === activeFileId)

  useEffect(() => {
    if (!activeFile) return
    setCrop(activeFile.crop || { x: 0, y: 0 })
    setZoom(activeFile.zoom || 1)
    setCroppedAreaPixels(activeFile.croppedAreaPixels || null)
  }, [activeFile])

  const handleResizeAll = async () => {
    if (files.length === 0) {
      setError('Upload at least one image first.')
      return
    }
    if (!prompt.trim()) {
      setError('Please enter a size prompt')
      return
    }

    setError(null)
    setStatus('processing')

    let dimensions = parseResizePrompt(prompt)
    try {
      if (!dimensions) {
        setStatus('asking-ai')
        dimensions = await askGeminiWorker(prompt)
      }
    } catch (err) {
      setStatus('error')
      setError(err.message || 'Unable to parse prompt')
      return
    }

    setStatus('processing')
    setParsed(dimensions)

    await Promise.all(files.map(async (fileItem) => {
      updateFile(fileItem.id, { status: 'processing', error: null })
      try {
        const cropArea = fileItem.croppedAreaPixels || createDefaultCrop(fileItem.width, fileItem.height, dimensions.width, dimensions.height)
        const blob = await getCroppedImageBlob(fileItem.file, cropArea, dimensions.width, dimensions.height, outputFormat)
        const resultUrl = URL.createObjectURL(blob)
        updateFile(fileItem.id, {
          status: 'done',
          resultUrl,
          resultBlob: blob,
          width: dimensions.width,
          height: dimensions.height,
        })
      } catch (err) {
        updateFile(fileItem.id, {
          status: 'error',
          error: err.message || 'Failed to process image',
        })
      }
    }))

    setStatus('done')
  }

  const handleDownloadFile = (fileItem) => {
    if (!fileItem.resultUrl) return
    const a = document.createElement('a')
    a.href = fileItem.resultUrl
    const ext = getExtension(outputFormat)
    a.download = fileItem.name.replace(/\.[^.]+$/, '') + `_${fileItem.width}x${fileItem.height}.${ext}`
    a.click()
  }

  const handleDownloadZip = async () => {
    const readyFiles = files.filter((fileItem) => fileItem.status === 'done' && fileItem.resultBlob)
    if (readyFiles.length === 0) {
      setError('Process images first before downloading a ZIP.')
      return
    }

    const zip = new JSZip()
    readyFiles.forEach((fileItem) => {
      const ext = getExtension(outputFormat)
      zip.file(`${fileItem.name.replace(/\.[^.]+$/, '')}_${fileItem.width}x${fileItem.height}.${ext}`, fileItem.resultBlob)
    })

    const blob = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `resized-images-${outputFormat}.zip`
    a.click()
    URL.revokeObjectURL(url)
  }

  const removeFile = (id) => {
    setFiles((prev) => prev.filter((fileItem) => fileItem.id !== id))
    if (activeFileId === id) {
      setActiveFileId((prevId) => {
        const remaining = files.filter((fileItem) => fileItem.id !== id)
        return remaining[0]?.id || null
      })
    }
  }

  const clearAll = () => {
    setFiles([])
    setActiveFileId(null)
    setStatus('idle')
    setError(null)
    setParsed(null)
  }

  return (
    <div className="resize-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">AI Bulk Resize + Draggable Crop</h1>
          <p className="page-sub">
            Upload one or more images, choose a prompt, drag each image inside the frame, and export in PNG, JPG, WebP, or AVIF.
          </p>
        </div>
      </div>

      <div className="resize-content">
        <div className="resize-panel">
          <div
            className="upload-card upload-grid"
            role="button"
            tabIndex="0"
            aria-label="Upload images"
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onKeyDown={handleDropzoneKeyDown}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => handleFiles(e.target.files)}
            />
            <div className="upload-placeholder">
              <span>??</span>
              <p>{files.length > 0 ? `${files.length} image(s) ready` : 'Click or drop images here'}</p>
              <small>PNG, JPEG, WebP supported. Drag each image into the frame after upload.</small>
            </div>
            <button type="button" className="btn-primary upload-button">Add Images</button>
          </div>

          <div className="prompt-card">
            <label className="label" htmlFor="resize-prompt">
              Resize prompt
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
            <div className="bulk-options">
              <label className="label" htmlFor="output-format">Output format</label>
              <select
                id="output-format"
                className="format-select"
                value={outputFormat}
                onChange={(e) => setOutputFormat(e.target.value)}
              >
                {OUTPUT_FORMATS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <button
              type="button"
              className="btn-primary btn-full"
              onClick={handleResizeAll}
              disabled={files.length === 0 || status === 'processing' || status === 'asking-ai'}
            >
              {status === 'processing' ? 'Resizing images...' : status === 'asking-ai' ? 'Asking AI...' : 'Resize all images'}
            </button>
            {error && <p className="error-text" role="alert" aria-live="assertive">{error}</p>}
          </div>

          {files.length > 0 && (
            <div className="file-list">
              {files.map((fileItem) => (
                <button
                  type="button"
                  key={fileItem.id}
                  className={`file-item ${fileItem.id === activeFileId ? 'active' : ''}`}
                  onClick={() => setActiveFileId(fileItem.id)}
                >
                  <img src={fileItem.preview} alt={fileItem.name} />
                  <span>{fileItem.name}</span>
                  <small>{fileItem.status === 'done' ? 'Ready' : fileItem.status === 'error' ? 'Error' : 'Idle'}</small>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="result-panel">
          <div className="crop-board">
            <div className="crop-header">
              <h2>Drag crop frame</h2>
              <button type="button" className="btn-ghost-sm" onClick={clearAll}>Clear all</button>
            </div>
            <div className="crop-preview">
              {activeFile ? (
                parsed ? (
                  <div className="cropper-wrapper">
                    <Cropper
                      image={activeFile.preview}
                      crop={crop}
                      zoom={zoom}
                      aspect={parsed.width / parsed.height}
                      cropShape="rect"
                      showGrid={false}
                      onCropChange={(next) => {
                        setCrop(next)
                        updateFile(activeFile.id, { crop: next })
                      }}
                      onZoomChange={(next) => {
                        setZoom(next)
                        updateFile(activeFile.id, { zoom: next })
                      }}
                      onCropComplete={handleCropComplete}
                    />
                  </div>
                ) : (
                  <div className="result-empty">
                    <p>Enter a prompt first to set the frame size.</p>
                  </div>
                )
              ) : (
                <div className="result-empty">
                  <p>Select an image to preview the drag crop frame.</p>
                </div>
              )}
            </div>
            {activeFile && parsed && (
              <div className="crop-controls">
                <label className="label">Zoom</label>
                <input
                  type="range"
                  min="1"
                  max="3"
                  step="0.01"
                  value={zoom}
                  onChange={(e) => {
                    const next = Number(e.target.value)
                    setZoom(next)
                    updateFile(activeFile.id, { zoom: next })
                  }}
                />
              </div>
            )}
          </div>

          <div className="result-card">
            <div className="result-header">
              <h2>Processed images</h2>
              <button type="button" className="btn-download" onClick={handleDownloadZip} disabled={!files.some((fileItem) => fileItem.status === 'done')}>
                ⬇ Download ZIP
              </button>
            </div>
            <div className="processed-list">
              {files.length === 0 ? (
                <div className="result-empty">
                  <p>No images uploaded yet.</p>
                </div>
              ) : (
                files.map((fileItem) => (
                  <div key={fileItem.id} className="processed-item">
                    <img src={fileItem.preview} alt={fileItem.name} />
                    <div>
                      <strong>{fileItem.name}</strong>
                      <p>{fileItem.status === 'done' ? `${fileItem.width}×${fileItem.height}` : fileItem.status}</p>
                      {fileItem.error && <p className="error-text">{fileItem.error}</p>}
                    </div>
                    {fileItem.status === 'done' && (
                      <button type="button" className="btn-download-sm" onClick={() => handleDownloadFile(fileItem)}>
                        Download
                      </button>
                    )}
                  </div>
                ))
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