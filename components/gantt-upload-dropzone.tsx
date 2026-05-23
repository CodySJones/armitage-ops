"use client";

import { useRef, useState } from "react";

export function GanttUploadDropzone() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  function acceptFile(file: File | null) {
    if (!file) {
      return;
    }

    setFileName(file.name);
  }

  return (
    <div className="form-grid">
      <div className="eyebrow">Upload Materio Gantt PDF</div>
      <button
        type="button"
        className={`dropzone ${isDragging ? "dragging" : ""}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          acceptFile(event.dataTransfer.files?.[0] ?? null);
        }}
      >
        <div className="dropzone-copy">
          <strong>Drag the exported Materio Gantt PDF here</strong>
          <span className="muted">or click to choose the file from your computer</span>
          <span className="muted">Accepted for now: PDF schedule export</span>
        </div>
      </button>

      <input
        ref={inputRef}
        type="file"
        name="scheduleFile"
        accept="application/pdf"
        className="sr-only"
        onChange={(event) => acceptFile(event.target.files?.[0] ?? null)}
      />

      <div className="list-item">
        <strong>Selected file</strong>
        <p className="muted">{fileName ?? "No file selected yet."}</p>
      </div>

      <p className="muted" style={{ margin: 0 }}>
        This scaffold now accepts the PDF in the browser. The next backend step is storing that file on the
        project record after you click save.
      </p>
    </div>
  );
}
