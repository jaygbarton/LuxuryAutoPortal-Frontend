import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Upload, X, Image as ImageIcon } from "lucide-react";
import { buildUploadApiUrl } from "@/lib/queryClient";

interface PhotoUploadProps {
  photos: string[];
  onPhotosChange: (photos: string[]) => void;
  entityType: "inspection" | "maintenance";
  entityId?: number;
  disabled?: boolean;
}

export function PhotoUpload({ photos, onPhotosChange, entityType, entityId, disabled }: PhotoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const formData = new FormData();
      Array.from(files).forEach((file) => formData.append("photos", file));
      formData.append("entityType", entityType);
      if (entityId) formData.append("entityId", String(entityId));

      const response = await fetch(buildUploadApiUrl("/api/operations/upload-photos"), {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!response.ok) throw new Error("Upload failed");
      const data = await response.json();
      if (data.urls) {
        onPhotosChange([...photos, ...data.urls]);
      }
    } catch (err) {
      console.error("Photo upload failed:", err);
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = (index: number) => {
    onPhotosChange(photos.filter((_, i) => i !== index));
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {photos.map((url, index) => (
          <div
            key={index}
            className="relative w-16 h-16 rounded border border-border overflow-hidden group cursor-pointer"
            onClick={() => { setSelectedPhoto(url); setGalleryOpen(true); }}
          >
            <img src={url} alt={`Photo ${index + 1}`} className="w-full h-full object-cover" />
            {!disabled && (
              <button
                onClick={(e) => { e.stopPropagation(); removePhoto(index); }}
                className="absolute top-0 right-0 bg-black/60 text-white p-0.5 rounded-bl opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}
        {!disabled && (
          <label className="w-16 h-16 rounded border border-dashed border-border flex flex-col items-center justify-center cursor-pointer hover:border-primary transition-colors">
            {uploading ? (
              <span className="text-[10px] text-muted-foreground">...</span>
            ) : (
              <>
                <Upload className="w-4 h-4 text-muted-foreground" />
                <span className="text-[8px] text-muted-foreground mt-0.5">Upload</span>
              </>
            )}
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={handleUpload}
              className="hidden"
              disabled={uploading}
            />
          </label>
        )}
      </div>

      {photos.length > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setGalleryOpen(true)}
          className="text-muted-foreground hover:text-primary mt-1 h-auto p-0 text-xs"
        >
          <ImageIcon className="w-3 h-3 mr-1" />
          View all ({photos.length})
        </Button>
      )}

      {/* Photo Gallery Modal */}
      <Dialog open={galleryOpen} onOpenChange={setGalleryOpen}>
        <DialogContent className="bg-card border-border text-foreground max-w-3xl">
          <DialogHeader>
            <DialogTitle>Photos ({photos.length})</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[60vh] overflow-y-auto">
            {photos.map((url, index) => (
              <div
                key={index}
                className={`relative rounded border overflow-hidden cursor-pointer ${selectedPhoto === url ? "border-primary border-2" : "border-border"}`}
                onClick={() => setSelectedPhoto(url)}
              >
                <img src={url} alt={`Photo ${index + 1}`} className="w-full aspect-square object-cover" />
              </div>
            ))}
          </div>
          {selectedPhoto && (
            <div className="mt-3 flex justify-center">
              <img src={selectedPhoto} alt="Selected" className="max-h-[40vh] rounded object-contain" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
