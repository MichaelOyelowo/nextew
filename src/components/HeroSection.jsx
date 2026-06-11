import { useState, useRef } from 'react'
import imageCompression from 'browser-image-compression'
import JSZip from 'jszip'
import './HeroSection.css';

function HeroSection() {
  const [autoConvert, setAutoConvert] = useState(false);
  const [isDragging, setIsDragging] = useState(false)
  const [isSelected, setIsSelected] = useState([])
  const [files, setFiles] = useState([]);
  const fileInputRef = useRef(null)

  const handleFileChange = (e) => {
    const selected = Array.from(e.target.files).map((file) => ({
      file,
      name: file.name,
      size: file.size,
      preview: URL.createObjectURL(file)
    }))
    setFiles(selected);
    
    // Auto-convert if enabled and formats are selected
    if (autoConvert && isSelected.length > 0) {
      performConvert(selected, isSelected);
    }
  }

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = Array.from(e.dataTransfer.files).map((file) => ({
      file,
      name: file.name,
      size: file.size,
      preview: URL.createObjectURL(file)
    }))
    setFiles(dropped);
    
    // Auto-convert if enabled and formats are selected
    if (autoConvert && isSelected.length > 0) {
      performConvert(dropped, isSelected);
    }
  }

  const handleRemoveFile = (index) => {
    setFiles((prev) => {
      const fileToRemove = prev[index];
      if (!fileToRemove) return prev;

      URL.revokeObjectURL(fileToRemove.preview);
      if (fileToRemove.results) {
        Object.values(fileToRemove.results).forEach((result) => {
          URL.revokeObjectURL(result.resultUrl);
        });
      }

      return prev.filter((_, idx) => idx !== index);
    });
  }

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  }

  const handleDragLeave = () => {
    setIsDragging(false);
  }

  const toggleFileSelection = (fmt) => {
    const nextSelection = isSelected.includes(fmt)
      ? isSelected.filter((f) => f !== fmt)
      : [...isSelected, fmt];

    setIsSelected(nextSelection);

    // Auto-convert when a new format is selected and files already exist
    if (autoConvert && files.length > 0 && !isSelected.includes(fmt)) {
      performConvert(files, nextSelection);
    }
  };

  const detectAVIFSupport = async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        resolve(blob && blob.type === 'image/avif');
      }, 'image/avif', 0.5);
    });
  };

  const convertImage = async (file, format) => {
    // For AVIF, check browser support first
    if (format === 'AVIF') {
      const avifSupported = await detectAVIFSupport();
      if (!avifSupported) {
        throw new Error('Your browser does not support AVIF. Converting to WEBP instead.');
      }

      // Use Canvas for AVIF conversion
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);

          canvas.toBlob((blob) => {
            if (!blob) return reject(new Error('AVIF conversion failed'));
            resolve(blob);
          }, 'image/avif', 0.5);
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = file.preview;
      });
    }

    // For JPEG, PNG, WEBP use browser-image-compression
    const mimeMap = {
      JPEG: 'image/jpeg',
      PNG: 'image/png',
      WEBP: 'image/webp'
    };

    const qualityMap = {
      JPEG: 0.75,
      PNG: 0.95,
      WEBP: 0.7
    };

    const options = {
      maxSizeMB: 50,
      maxWidthOrHeight: 4096,
      useWebWorker: true,
      fileType: mimeMap[format],
      quality: qualityMap[format]
    };

    try {
      const compressedFile = await imageCompression(file.file, options);
      return compressedFile;
    } catch (err) {
      throw new Error(`${format} conversion failed: ${err.message}`);
    }
  };

  const performConvert = async (filesToConvert, formats) => {
    if (filesToConvert.length === 0 || formats.length === 0) return;

    // Update UI state to show processing
    setFiles((prev) =>
      prev.map((f) => 
        filesToConvert.some(fc => fc.name === f.name && fc.size === f.size) 
          ? { ...f, status: 'processing' }
          : f
      )
    );

    const updated = await Promise.all(
      filesToConvert.map(async (f) => {
        try {
          // Convert to all selected formats
          const results = {};
          
          for (const format of formats) {
            const blob = await convertImage(f, format);
            
            if (blob.size > f.size && format !== 'PNG') {
              console.warn(`${f.name}: ${format} is larger than original`);
            }

            const resultUrl = URL.createObjectURL(blob);
            const baseName = f.name.replace(/\.[^.]+$/, '');
            const ext = format.toLowerCase();

            results[format] = {
              resultUrl,
              resultSize: blob.size,
              resultName: `${baseName}.${ext}`,
              isLarger: blob.size > f.size
            };
          }

          return {
            ...f,
            status: 'done',
            results
          };
        } catch (err) {
          return { ...f, status: 'error', error: err.message };
        }
      })
    );

    // Update the files in state, merging with existing ones
    setFiles((prev) =>
      prev.map((pf) => {
        const updated_file = updated.find((uf) => uf.name === pf.name && uf.size === pf.size);
        return updated_file || pf;
      })
    );
  };

  const handleConvert = async () => {
    if (files.length === 0) return
    if (isSelected.length === 0) {
      alert('Please select at least one format')
      return
    }

    await performConvert(files, isSelected);
  }

  return (
    <section className="hero">
      <div className="hero-shape-bg" />
      <div className="mesh-gradient" />

      <div className="hero-content">
        <div className="hero-badge">
          <span className="badge-dot"></span>
          <span className="badge-text">100% Client-Side Processing</span>
        </div>

        <h1 className="hero-title">
          The Future of <br />
          <span className="hero-title-accent">Image Optimization</span>
        </h1>

        <div className="glass-container">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept='image/*'
            multiple
            style={{ display: 'none' }}
          />

          <div
            className={`hero-dropzone ${isDragging ? 'dragging' : ''}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current.click()}
          >
            <div className="dropzone-inner">
              <div className="dropzone-icon">🚀</div>
              <h3 className="dropzone-title">Drop your images here</h3>
              <p className="dropzone-sub">Max 50MB per file · All formats</p>
              <button
                className="dropzone-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  fileInputRef.current.click()
                }}
              >
                Browse files
              </button>
            </div>
          </div>

          <div className="dropzone-settings">
            <div className="toggle-group">
              <label className="switch">
                <input
                  type="checkbox"
                  checked={autoConvert}
                  onChange={() => {
                    const nextAuto = !autoConvert;
                    setAutoConvert(nextAuto);
                    if (nextAuto && isSelected.length > 0 && files.length > 0) {
                      performConvert(files, isSelected);
                    }
                  }}
                />
                <span className="slider round"></span>
              </label>
              <span>Convert automatically</span>
            </div>

            <div className="format-chips">
              <span>To:</span>
              {['AVIF', 'WEBP', 'JPEG', 'PNG'].map((fmt) => (
                <button
                  key={fmt}
                  className={`chip ${isSelected.includes(fmt) ? 'chip-active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleFileSelection(fmt)
                  }}
                >
                  {isSelected.includes(fmt) && <span className="chip-check">✓</span>}
                  {fmt}
                </button>
              ))}
            </div>
          </div>
        </div>

        {files.length > 0 && (
          <div className="file-preview-list">
            <button className="btn-convert" onClick={handleConvert}>
              Convert {files.length} image{files.length > 1 ? 's' : ''}
              {isSelected.length > 0 ? ` to ${isSelected.join(', ')}` : ''}
            </button>

            {files.map((file, index) => (
              <div key={index} className="file-preview-item">
                <button
                  className="btn-remove-file"
                  onClick={() => handleRemoveFile(index)}
                  aria-label={`Remove ${file.name}`}
                >
                  x
                </button>
                <img src={file.preview} alt={file.name} className="file-thumb" />

                <div className="file-info">
                  <span className="file-name">{file.name}</span>
                  <div className="file-sizes">
                    <span className="file-size original">
                      {(file.size / 1024).toFixed(1)} KB
                    </span>
                    {file.status === 'done' && file.results && (
                      <div className="format-results">
                        {Object.entries(file.results).map(([format, result]) => (
                          <div key={format} className="format-result">
                            <span className="arrow">→</span>
                            <span className="format-name">{format}</span>
                            <span className="file-size result">
                              {(result.resultSize / 1024).toFixed(1)} KB
                            </span>
                            <span className={`savings ${result.isLarger ? 'savings-negative' : ''}`}>
                              {result.isLarger
                                ? `+${Math.round((result.resultSize / file.size - 1) * 100)}%`
                                : `-${Math.round((1 - result.resultSize / file.size) * 100)}%`
                              }
                            </span>
                            <a
                              href={result.resultUrl}
                              download={result.resultName}
                              className="btn-download-format"
                            >
                              ⬇
                            </a>
                          </div>
                        ))}
                      </div>
                    )}
                    {file.status === 'error' && (
                      <span className="status-error">{file.error}</span>
                    )}
                  </div>
                </div>

                <div className="file-action">
                  {file.status === 'processing' && <div className="spinner" />}
                </div>
              </div>
            ))}

            {files.filter(f => f.status === 'done').length > 0 && (
              <button
                className="btn-download-all"
                onClick={async () => {
                  const zip = new JSZip();
                  
                  for (const f of files.filter(f => f.status === 'done')) {
                    if (f.results) {
                      // Create a folder for each image
                      const folder = zip.folder(f.name.replace(/\.[^.]+$/, ''));
                      
                      for (const [format, result] of Object.entries(f.results)) {
                        try {
                          const response = await fetch(result.resultUrl);
                          const blob = await response.blob();
                          folder.file(result.resultName, blob);
                        } catch (err) {
                          console.error(`Failed to add ${result.resultName} to zip:`, err);
                        }
                      }
                    }
                  }
                  
                  // Generate and download the zip
                  const zipBlob = await zip.generateAsync({ type: 'blob' });
                  const zipUrl = URL.createObjectURL(zipBlob);
                  const a = document.createElement('a');
                  a.href = zipUrl;
                  a.download = 'converted-images.zip';
                  a.click();
                  URL.revokeObjectURL(zipUrl);
                }}
              >
                ⬇ Download all as ZIP
              </button>
            )}
          </div>
        )}

        <div className="hero-stats">
          <div className="stat"><strong>50MB</strong><span>Limit</span></div>
          <div className="stat-divider" />
          <div className="stat"><strong>20+</strong><span>Files</span></div>
          <div className="stat-divider" />
          <div className="stat"><strong>Zero</strong><span>Data Stored</span></div>
        </div>
      </div>
    </section>
  );
}

export default HeroSection;