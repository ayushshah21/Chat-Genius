import { useEffect, useState } from "react";
import { X } from "lucide-react";

interface FilePreviewProps {
  file: File;
  onRemove: (file: File) => void;
}

export default function FilePreview({ file, onRemove }: FilePreviewProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const isImageFile = (type: string) => {
    return type.startsWith("image/");
  };

  useEffect(() => {
    // Generate preview URL for images
    if (isImageFile(file.type)) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);

      // Cleanup URL on unmount
      return () => {
        URL.revokeObjectURL(url);
      };
    }
  }, [file]);

  return (
    <div className="flex items-center space-x-3 p-2 rounded-md bg-[var(--background-light)] border border-[var(--border)]">
      {/* Image thumbnail for image files */}
      {previewUrl && (
        <img
          src={previewUrl}
          alt={file.name}
          className="w-10 h-10 object-cover rounded"
        />
      )}

      {/* File details */}
      <div className="flex flex-col truncate">
        <span className="text-[var(--text)] text-sm truncate font-medium">
          {file.name}
        </span>
        <span className="text-xs text-[var(--text-muted)]">
          {(file.size / 1024).toFixed(1)} KB • {file.type}
        </span>
      </div>

      {/* Remove button */}
      <button
        type="button"
        onClick={() => onRemove(file)}
        className="ml-auto p-1.5 rounded hover:bg-[var(--background-hover)] text-[var(--text-muted)] hover:text-[var(--text)] transition-all"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
