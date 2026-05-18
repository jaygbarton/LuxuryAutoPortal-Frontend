import { useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { VideoPreview } from "@/components/admin/video-preview";
import { buildApiUrl, buildUploadApiUrl } from "@/lib/queryClient";
import { Upload, X } from "lucide-react";

interface VideoFileInputProps {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  id?: string;
  allowImages?: boolean;
}

type Tab = "url" | "upload";

export function VideoFileInput({ value, onChange, label, id = "video-input", allowImages = false }: VideoFileInputProps) {
  const [tab, setTab] = useState<Tab>("url");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Resolve display URL — uploaded relative paths go through buildApiUrl
  const displayUrl = value?.startsWith("/uploads/") ? buildApiUrl(value) : value;

  async function handleFile(file: File) {
    setUploadError(null);
    setUploading(true);
    setProgress(0);

    const isImage = file.type.startsWith("image/");
    const formData = new FormData();
    formData.append(isImage ? "image" : "video", file);

    const url = buildUploadApiUrl(isImage ? "/api/upload/image" : "/api/upload/video");

    return new Promise<void>((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", url);
      xhr.withCredentials = true;

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          setProgress(Math.round((e.loaded / e.total) * 100));
        }
      };

      xhr.onload = () => {
        setUploading(false);
        if (xhr.status === 200) {
          try {
            const data = JSON.parse(xhr.responseText);
            if (data.success && data.url) {
              onChange(data.url);
              setProgress(100);
            } else {
              setUploadError(data.error || "Upload failed");
            }
          } catch {
            setUploadError("Invalid response from server");
          }
        } else {
          try {
            const data = JSON.parse(xhr.responseText);
            setUploadError(data.error || `Upload failed (${xhr.status})`);
          } catch {
            setUploadError(`Upload failed (${xhr.status})`);
          }
        }
        resolve();
      };

      xhr.onerror = () => {
        setUploading(false);
        setUploadError("Network error — upload failed");
        resolve();
      };

      xhr.send(formData);
    });
  }

  return (
    <div className="space-y-2">
      {label && <Label htmlFor={id}>{label}</Label>}

      {/* Tab switcher */}
      <div className="flex gap-1 rounded-md border p-0.5 w-fit text-sm">
        <button
          type="button"
          onClick={() => setTab("url")}
          className={`px-3 py-1 rounded transition-colors ${
            tab === "url"
              ? "bg-primary text-primary-foreground font-medium"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Paste URL
        </button>
        <button
          type="button"
          onClick={() => setTab("upload")}
          className={`px-3 py-1 rounded transition-colors ${
            tab === "upload"
              ? "bg-primary text-primary-foreground font-medium"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Upload File
        </button>
      </div>

      {tab === "url" && (
        <Input
          id={id}
          type="url"
          placeholder="https://youtube.com/... or direct video URL"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      {tab === "upload" && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              className="gap-1.5"
            >
              <Upload className="h-4 w-4" />
              {uploading ? "Uploading…" : allowImages ? "Choose file" : "Choose video"}
            </Button>
            {value && (
              <button
                type="button"
                onClick={() => { onChange(""); setProgress(0); setUploadError(null); }}
                className="text-muted-foreground hover:text-destructive"
                title="Clear"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            <span className="text-xs text-muted-foreground">
              {allowImages ? "MP4, WebM, MOV, JPG, PNG — video max 500 MB, image max 20 MB" : "MP4, WebM, MOV — max 500 MB"}
            </span>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept={allowImages
              ? "video/mp4,video/webm,video/ogg,video/quicktime,video/x-m4v,image/jpeg,image/png,image/gif,image/webp"
              : "video/mp4,video/webm,video/ogg,video/quicktime,video/x-m4v"}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              e.target.value = "";
            }}
          />

          {uploading && (
            <div className="space-y-1">
              <Progress value={progress} className="h-1.5" />
              <p className="text-xs text-muted-foreground">{progress}%</p>
            </div>
          )}

          {uploadError && (
            <p className="text-xs text-destructive">{uploadError}</p>
          )}
        </div>
      )}

      {/* Preview */}
      {displayUrl && (
        <div className="mt-2">
          <VideoPreview
            url={displayUrl}
            className="group relative h-24 w-40 overflow-hidden rounded border"
          />
        </div>
      )}
    </div>
  );
}
