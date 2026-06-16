import { useState, useRef } from 'react'
import ImageTracer from 'imagetracerjs'
import './SvgConverterPage.css'

function SvgConverterPage() {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [svgUrl, setSvgUrl] = useState(null)
  const [svgText, setSvgText] = useState(null)
  const [error, setError] = useState(null)
  const [processing, setProcessing] = useState(false)
  const [mode, setMode] = useState('raster') // 'raster' or 'vector'
  const [numColors, setNumColors] = useState(16)
  const [maxDim, setMaxDim] = useState(1024)
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

  const handleEmbedRaster = async () => {
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
      setSvgText(svg)
    } catch (err) {
      setError(err.message || 'SVG conversion failed')
    } finally {
      setProcessing(false)
    }
  }

  const handleVectorize = async () => {
    if (!file) return
    setProcessing(true)
    setError(null)

    try {
      const dataUrl = await createDataUrl(file)
      const img = new Image()
      img.src = dataUrl
      await new Promise((resolve, reject) => {
        img.onload = resolve
        img.onerror = () => reject(new Error('Unable to load image for vectorization'))
      })

      // Resize down for performance
      const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      const src = canvas.toDataURL()

      const options = {
        numberofcolors: Number(numColors) || 16,
        strokewidth: 0,
        scale: 1,
        ltres: 1,
        qtres: 1,
        pathomit: 8
      }

      // ImageTracer.imageToSVG(src, options, callback)
      ImageTracer.imageToSVG(src, (svgstr) => {
        const blob = new Blob([svgstr], { type: 'image/svg+xml;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        setSvgUrl(url)
        setSvgText(svgstr)
      }, options)
    } catch (err) {
      setError(err.message || 'Vectorization failed')
    } finally {
      setProcessing(false)
    }
  }

  const handleConvert = async () => {
    if (mode === 'raster') return handleEmbedRaster()
    return handleVectorize()
  }

  return (
    <div className="svg-converter-page">
      <div className="svg-converter-card" role="main">
        <h1>SVG Converter</h1>
        <p>Upload a raster image and export it as an SVG. Choose embed or true vector tracing.</p>

        <div className="svg-actions">
          <button type="button" onClick={() => inputRef.current?.click()} className="btn-primary" aria-label="Upload image">
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
            <button type="button" onClick={handleRemoveFile} className="btn-secondary">
              Remove image
            </button>
          )}
        </div>

        <fieldset className="mode-select" aria-label="Conversion mode">
          <legend className="sr-only">Conversion mode</legend>
          <label>
            <input type="radio" name="mode" value="raster" checked={mode==='raster'} onChange={() => setMode('raster')} /> Embed raster
          </label>
          <label style={{ marginLeft: 12 }}>
            <input type="radio" name="mode" value="vector" checked={mode==='vector'} onChange={() => setMode('vector')} /> Vectorize (paths)
          </label>
        </fieldset>

        {mode === 'vector' && (
          <div className="vector-options">
            <label htmlFor="numColors">Colors:</label>
            <input id="numColors" type="number" value={numColors} min={2} max={64} onChange={(e) => setNumColors(e.target.value)} />
            <label htmlFor="maxDim" style={{ marginLeft: 12 }}>Max dimension:</label>
            <input id="maxDim" type="number" value={maxDim} min={64} max={4096} onChange={(e) => setMaxDim(e.target.value)} />
          </div>
        )}

        {preview && (
          <div className="preview-area">
            <img src={preview} alt={file?.name} className="preview-img" />
          </div>
        )}

        {file && (
          <div className="convert-actions">
            <button
              type="button"
              className="btn-primary"
              onClick={handleConvert}
              disabled={processing}
              aria-busy={processing}
            >
              {processing ? 'Processing...' : (mode==='raster' ? 'Convert to SVG (embed)' : 'Vectorize to SVG')}
            </button>
          </div>
        )}

        {error && <div className="error-text" role="alert">{error}</div>}

        {svgUrl && (
          <div className="result-block">
            <p>SVG ready. Download it or copy/embed below.</p>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
              <a href={svgUrl} download={`${file?.name.replace(/\.[^.]+$/, '')}.svg`} className="btn-primary">
                Download SVG
              </a>
              <button
                type="button"
                className="btn-secondary"
                aria-label="Copy SVG object URL to clipboard"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(svgUrl)
                    setError('Copied object URL to clipboard')
                    setTimeout(() => setError(null), 1500)
                  } catch (e) {
                    setError('Copy failed')
                  }
                }}
              >
                Copy object URL
              </button>
              <button
                type="button"
                className="btn-secondary"
                aria-label="Copy IMG snippet for embedded SVG"
                onClick={async () => {
                  try {
                    const snippet = `<img src=\"${svgUrl}\" alt=\"${file?.name}\" />`
                    await navigator.clipboard.writeText(snippet)
                    setError('Copied <img> snippet')
                    setTimeout(() => setError(null), 1500)
                  } catch (e) {
                    setError('Copy failed')
                  }
                }}
              >
                Copy <img /> snippet
              </button>
            </div>

            {svgText && (
              <div style={{ marginTop: 8 }}>
                <label style={{ display: 'block', marginBottom: 6 }}>Inline SVG (copy to embed inline):</label>
                <textarea readOnly value={svgText} rows={8} style={{ width: '100%', fontSize: 12 }} />
                <div style={{ marginTop: 8 }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    aria-label="Copy inline SVG text to clipboard"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(svgText)
                        setError('Copied SVG text')
                        setTimeout(() => setError(null), 1500)
                      } catch (e) {
                        setError('Copy failed')
                      }
                    }}
                  >
                    Copy SVG text
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default SvgConverterPage