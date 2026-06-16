import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Upload, X, Image as ImageIcon } from "lucide-react";
import { buildUploadApiUrl, getProxiedImageUrl } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface PhotoUploadProps {
  photos: string[];
  onPhotosChange: (photos: string[]) => void;
  entityType: "inspection" | "maintenance";
  entityId?: number;
  disabled?: boolean;
  compact?: boolean;
}

const IMAGE_TYPES = /^image\/(jpeg|jpg|png|webp|heic|heif|gif)$/i;

function isImageFile(file: File): boolean {
  if (IMAGE_TYPES.test(file.type)) return true;
  // HEIC/HEIF often have empty type on Safari/iOS — fall back to extension
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return ["jpg", "jpeg", "png", "webp", "heic", "heif", "gif"].includes(ext);
}

export function PhotoUpload({ photos, onPhotosChange, entityType, entityId, disabled, compact }: PhotoUploadProps) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);
  const dragCounter = useRef(0);

  const processFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter(isImageFile);
    if (fileArray.length === 0) return;
    if (!entityId) {
      toast({ title: "Error", description: "Save the record first before uploading photos.", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      fileArray.forEach((file) => formData.append("photos", file));

      const endpoint = entityType === "inspection"
        ? `/api/operations/inspections/${entityId}/photos`
        : `/api/operations/maintenance/${entityId}/photos`;

      const response = await fetch(buildUploadApiUrl(endpoint), {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!response.ok) {
        let errMsg = "Upload failed";
        try { const b = await response.json(); if (b?.message) errMsg = b.message; } catch {}
        throw new Error(errMsg);
      }
      const data = await response.json();
      if (data.data?.photos) {
        onPhotosChange(data.data.photos);
      }
    } catch (err: any) {
      console.error("Photo upload failed:", err);
      toast({ title: "Upload failed", description: err?.message || "Could not upload photo. Please try again.", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }, [photos, onPhotosChange, entityType, entityId, toast]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    await processFiles(files);
    e.target.value = "";
  };

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      await processFiles(files);
    }
  }, [processFiles]);

  const removePhoto = (index: number) => {
    onPhotosChange(photos.filter((_, i) => i !== index));
  };

  if (compact && photos.length > 0) {
    return (
      <div className="flex flex-col items-center gap-1">
        <div
          className="w-14 h-14 rounded border border-border overflow-hidden cursor-pointer shrink-0"
          onClick={() => { setSelectedPhoto(photos[0]); setGalleryOpen(true); }}
        >
          <img src={getProxiedImageUrl(photos[0])} alt="Photo 1" className="w-full h-full object-cover" />
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setGalleryOpen(true)}
          className="text-muted-foreground hover:text-primary h-auto p-0 text-xs"
        >
          <ImageIcon className="w-3 h-3 mr-1" />
          View all ({photos.length})
        </Button>
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
                  <img src={getProxiedImageUrl(url)} alt={`Photo ${index + 1}`} className="w-full aspect-square object-cover" />
                </div>
              ))}
            </div>
            {selectedPhoto && (
              <div className="mt-3 flex justify-center">
                <img src={getProxiedImageUrl(selectedPhoto)} alt="Selected" className="max-h-[40vh] rounded object-contain" />
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div>
      <div
        ref={dropRef}
        onDragEnter={!disabled ? handleDragEnter : undefined}
        onDragLeave={!disabled ? handleDragLeave : undefined}
        onDragOver={!disabled ? handleDragOver : undefined}
        onDrop={!disabled ? handleDrop : undefined}
        className={`flex flex-wrap gap-2 p-2 rounded-lg border-2 border-dashed transition-colors min-h-[80px] ${
          isDragging
            ? "border-primary bg-primary/10"
            : disabled
            ? "border-transparent"
            : "border-border hover:border-muted-foreground/40"
        }`}
      >
        {photos.map((url, index) => (
          <div
            key={index}
            className="relative w-16 h-16 rounded border border-border overflow-hidden group cursor-pointer"
            onClick={() => { setSelectedPhoto(url); setGalleryOpen(true); }}
          >
            <img src={getProxiedImageUrl(url)} alt={`Photo ${index + 1}`} className="w-full h-full object-cover" />
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
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
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
        {!disabled && photos.length === 0 && !isDragging && (
          <div className="flex items-center justify-center flex-1 min-w-[120px]">
            <p className="text-[10px] text-muted-foreground text-center">
              Drag & drop photos here
            </p>
          </div>
        )}
        {isDragging && (
          <div className="flex items-center justify-center flex-1 min-w-[120px]">
            <p className="text-xs text-primary font-medium">Drop photos here</p>
          </div>
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
                <img src={getProxiedImageUrl(url)} alt={`Photo ${index + 1}`} className="w-full aspect-square object-cover" />
              </div>
            ))}
          </div>
          {selectedPhoto && (
            <div className="mt-3 flex justify-center">
              <img src={getProxiedImageUrl(selectedPhoto)} alt="Selected" className="max-h-[40vh] rounded object-contain" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
