import { useState, useRef } from 'react'
import './SvgConverterPage.css'

function SvgConverterPage() {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [svgUrl, setSvgUrl] = useState(null)
  const [error, setError] = useState(null)
  const [processing, setProcessing] = useState(false)
  const inputRef = useRef(null)

  const createDataUrl = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  const handleFileChange = async (e) => {
    const selected = e.target.files?.[0]
    if (!selected) return
    setError(null)
    setFile(selected)
    setPreview(URL.createObjectURL(selected))
    setSvgUrl(null)
  }

  const handleRemoveFile = () => {
    if (preview) URL.revokeObjectURL(preview)
    if (svgUrl) URL.revokeObjectURL(svgUrl)
    setFile(null)
    setPreview(null)
    setSvgUrl(null)
    setError(null)
  }

  const handleConvertToSvg = async () => {
    if (!file) return
    setProcessing(true)
    setError(null)

    try {
      const dataUrl = await createDataUrl(file)
      const img = new Image()
      img.src = dataUrl
      await new Promise((resolve, reject) => {
        img.onload = resolve
        img.onerror = () => reject(new Error('Unable to load image for SVG conversion'))
      })

      const svg = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${img.naturalWidth}" height="${img.naturalHeight}" viewBox="0 0 ${img.naturalWidth} ${img.naturalHeight}">\n  <image href="${dataUrl}" width="${img.naturalWidth}" height="${img.naturalHeight}" preserveAspectRatio="xMidYMid meet" />\n</svg>`
      const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      setSvgUrl(url)
    } catch (err) {
      setError(err.message || 'SVG conversion failed')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="svg-converter-page">
      <div className="svg-converter-card">
        <h1>SVG Converter</h1>
        <p>Upload a raster image and export it as an SVG wrapper file.</p>

        <div className="svg-actions">
          <button onClick={() => inputRef.current?.click()} className="btn-primary">
            Upload image
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          {file && (
            <button onClick={handleRemoveFile} className="btn-secondary">
              Remove image
            </button>
          )}
        </div>

        {preview && (
          <div className="preview-area">
            <img src={preview} alt={file?.name} className="preview-img" />
          </div>
        )}

        {file && (
          <div className="convert-actions">
            <button
              className="btn-primary"
              onClick={handleConvertToSvg}
              disabled={processing}
            >
              {processing ? 'Converting...' : 'Convert to SVG'}
            </button>
          </div>
        )}

        {error && <div className="error-text">{error}</div>}

        {svgUrl && (
          <div className="result-block">
            <p>SVG ready. Download it below.</p>
            <a href={svgUrl} download={`${file?.name.replace(/\.[^.]+$/, '')}.svg`} className="btn-primary">
              Download SVG
            </a>
          </div>
        )}
      </div>
    </div>
  )
}

export default SvgConverterPage