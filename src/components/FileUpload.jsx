import { useState, useCallback } from 'react';
import { parseCSV } from '../utils/csvParser';
import '../styles/FileUpload.css';

export default function FileUpload({ onDataLoaded }) {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fileName, setFileName] = useState('');

  const handleFile = async (file) => {
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      setError('Please upload a CSV file');
      return;
    }

    setIsLoading(true);
    setError(null);
    setFileName(file.name);

    try {
      const data = await parseCSV(file);

      if (data.length === 0) {
        setError('No valid data found in CSV file');
        setIsLoading(false);
        return;
      }

      onDataLoaded(data);
    } catch (err) {
      setError(err.message || 'Failed to parse CSV file');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    handleFile(file);
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileInput = (e) => {
    const file = e.target.files[0];
    handleFile(file);
  };

  return (
    <div className="file-upload">
      <div
        className={`drop-zone ${isDragging ? 'dragging' : ''} ${isLoading ? 'loading' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {isLoading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Processing {fileName}...</p>
          </div>
        ) : (
          <>
            <div className="upload-icon">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <h3>Upload Course Completion Data</h3>
            <p>Drag and drop your CSV file here, or click to browse</p>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileInput}
              id="file-input"
              style={{ display: 'none' }}
            />
            <label htmlFor="file-input" className="browse-button">
              Browse Files
            </label>
            <p className="file-format-hint">
              Expected format: UKG Learning Pro export (CSV)
            </p>
          </>
        )}
      </div>

      {error && (
        <div className="error-message">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
