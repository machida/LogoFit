import { useRef, useState } from 'react';

interface Props {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
}

export function Uploader({ onFiles, disabled = false }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    onFiles(Array.from(list));
  };

  return (
    <div
      className={`uploader${dragOver ? ' uploader--over' : ''}${disabled ? ' uploader--disabled' : ''}`}
      onClick={() => {
        if (!disabled) inputRef.current?.click();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        if (disabled) return;
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        if (disabled) return;
        handleFiles(e.dataTransfer.files);
      }}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        inputRef.current?.click();
      }}
      role="button"
      tabIndex={0}
      aria-disabled={disabled}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".svg,.png,.pdf,image/svg+xml,image/png,application/pdf"
        multiple
        disabled={disabled}
        hidden
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = '';
        }}
      />
      <div className="uploader__icon">⬆</div>
      <p className="uploader__title">ロゴをドラッグ&ドロップ</p>
      <p className="uploader__hint">またはクリックして選択（SVG / PNG / PDF・複数可）</p>
    </div>
  );
}
