import { useState, useRef } from 'react'
import imageCompression from 'browser-image-compression'
import './BgRemovePage.css'

function BgRemovePage() {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [prompt, setPrompt] = useState('')
  const [resultUrl, setResultUrl] = useState(null)
  const [resultName, setResultName] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState(null)
  const [processing, setProcessing] = useState(false)
  const inputRef = useRef(null)

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0]
    if (!selected) return
    setError(null)
    setFile(selected)
    setPreview(URL.createObjectURL(selected))
    setResultUrl(null)
    setResultName('')
    setMessage('')
  }

  const handleRemoveFile = () => {
    if (preview) URL.revokeObjectURL(preview)
    if (resultUrl) URL.revokeObjectURL(resultUrl)
    setFile(null)
    setPreview(null)
    setPrompt('')
    setResultUrl(null)
    setResultName('')
    setMessage('')
    setError(null)
  }

  const getPromptOptions = () => {
    const promptText = prompt.toLowerCase()
    const outputTypeMatch = promptText.match(/\b(png|webp|jpe?g|jpeg)\b/)
    const widthHeightMatch = promptText.match(/(\d{2,4})\s*[xX]\s*(\d{2,4})/)

    const options = {
      maxSizeMB: 1,
      useWebWorker: true,
      fileType: file.type,
      maxWidthOrHeight: 1600,
      initialQuality: 0.75,
      alwaysKeepResolution: false
    }

    if (outputTypeMatch) {
      const type = outputTypeMatch[1].toLowerCase()
      options.fileType = `image/${type === 'jpg' ? 'jpeg' : type}`
    }

    if (widthHeightMatch) {
      options.maxWidthOrHeight = Math.max(
        Number(widthHeightMatch[1]),
        Number(widthHeightMatch[2])
      )
    }

    if (promptText.includes('reduce') || promptText.includes('compress') || promptText.includes('small')) {
      options.maxSizeMB = 0.5
      options.initialQuality = 0.7
    }

    if (promptText.includes('high quality') || promptText.includes('best quality') || promptText.includes('retain detail')) {
      options.initialQuality = 0.9
    }

    if (promptText.includes('low quality') || promptText.includes('lightweight') || promptText.includes('faster')) {
      options.initialQuality = 0.6
    }

    return options
  }

  const handleProcessPrompt = async () => {
    if (!file) {
      setError('Please upload an image first.')
      return
    }
    if (!prompt.trim()) {
      setError('Please enter a prompt for what you want.')
      return
    }

    const promptText = prompt.toLowerCase()
    if (promptText.includes('remove background') || promptText.includes('remove bg')) {
      setError('Background removal is not implemented yet. This page is preparing the AI prompt UI.')
      setMessage('Future update: AI background removal will be powered by a backend or API.')
      return
    }

    setError(null)
    setMessage('Processing based on your prompt...')
    setProcessing(true)

    try {
      const options = getPromptOptions()
      const compressedFile = await imageCompression(file, options)
      const url = URL.createObjectURL(compressedFile)
      setResultUrl(url)
      setResultName(`${file.name.replace(/\.[^.]+$/, '')}-processed.${options.fileType.split('/')[1]}`)
      setMessage('Prompt processed successfully. Download the result below.')
    } catch (err) {
      setError(err.message || 'Failed to process prompt')
      setMessage('')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="bg-remove-page">
      <div className="bg-remove-card">
        <h1>AI BG Remove & Prompt Assistant</h1>
        <p>Upload an image, enter your prompt, and let the app prepare the conversion settings for you.</p>

        <div className="bg-remove-actions">
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

        <textarea
          className="prompt-input"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Type a prompt like 'Reduce size to 200KB and convert to WebP' or 'Remove background and keep subject'"
          rows={5}
        />

        <div className="convert-actions">
          <button
            className="btn-primary"
            onClick={handleProcessPrompt}
            disabled={processing || !file}
          >
            {processing ? 'Processing...' : 'Run Prompt'}
          </button>
        </div>

        {error && <div className="error-text">{error}</div>}
        {message && <div className="message-text">{message}</div>}

        {resultUrl && (
          <div className="result-block">
            <p>Result ready. Download it below.</p>
            <a href={resultUrl} download={resultName} className="btn-primary">
              Download Result
            </a>
          </div>
        )}
      </div>
    </div>
  )
}

export default BgRemovePage