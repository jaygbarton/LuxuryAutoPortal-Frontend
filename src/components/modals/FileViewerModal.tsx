import React, { useState, useEffect } from "react";
import { X, Download, Maximize2, Minimize2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { buildApiUrl } from "@/lib/queryClient";

interface FileViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: {
    recordsFileViewAid: number;
    recordsFileViewName: string;
    recordsFileViewGoogleId: string;
  } | null;
}

export function FileViewerModal({
  isOpen,
  onClose,
  file,
}: FileViewerModalProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [imageObjectUrl, setImageObjectUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);

  const fileContentUrl = file
    ? buildApiUrl(`/api/record-file-views/${file.recordsFileViewAid}/content`)
    : "";

  // Load image via fetch with credentials so auth cookies are sent; display via blob URL
  useEffect(() => {
    if (!file || !isOpen) {
      setImageObjectUrl(null);
      setImageError(false);
      return;
    }

    const fileExtension = file.recordsFileViewName.split(".").pop()?.toLowerCase() ?? "";
    const isImage = ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"].includes(fileExtension);
    if (!isImage) {
      setImageObjectUrl(null);
      return;
    }

    let revoked = false;
    setImageError(false);
    setImageLoading(true);

    const loadImage = async () => {
      try {
        const response = await fetch(fileContentUrl, {
          method: "GET",
          credentials: "include",
        });
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          const detail = body?.driveError || body?.message || response.statusText;
          throw new Error(`Failed to load image: ${response.status} — ${detail}`);
        }
        const blob = await response.blob();
        if (revoked) return;
        const objectUrl = URL.createObjectURL(blob);
        setImageObjectUrl(objectUrl);
      } catch (err) {
        if (!revoked) setImageError(true);
        console.error("FileViewerModal: failed to load image", err);
      } finally {
        if (!revoked) setImageLoading(false);
      }
    };

    loadImage();

    return () => {
      revoked = true;
      setImageObjectUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, [file?.recordsFileViewAid, isOpen, fileContentUrl]);

  // Sync fullscreen state with browser events
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("mozfullscreenchange", handleFullscreenChange);
    document.addEventListener("MSFullscreenChange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
      document.removeEventListener("mozfullscreenchange", handleFullscreenChange);
      document.removeEventListener("MSFullscreenChange", handleFullscreenChange);
    };
  }, []);

  if (!file) return null;

  const fileExtension = file.recordsFileViewName.split(".").pop()?.toLowerCase() ?? "";
  const isImage = ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"].includes(fileExtension);
  const isPdf = fileExtension === "pdf";

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = fileContentUrl;
    link.download = file.recordsFileViewName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      const element = document.documentElement;
      if (element.requestFullscreen) {
        element.requestFullscreen().catch((err) => {
          console.error('Error attempting to enable fullscreen:', err);
        });
      } else if ((element as any).webkitRequestFullscreen) {
        (element as any).webkitRequestFullscreen();
      } else if ((element as any).mozRequestFullScreen) {
        (element as any).mozRequestFullScreen();
      } else if ((element as any).msRequestFullscreen) {
        (element as any).msRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch((err) => {
          console.error('Error attempting to exit fullscreen:', err);
        });
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      } else if ((document as any).mozCancelFullScreen) {
        (document as any).mozCancelFullScreen();
      } else if ((document as any).msExitFullscreen) {
        (document as any).msExitFullscreen();
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl w-[95vw] h-[95vh] p-0 bg-card border-border flex flex-col">
        <DialogHeader className="px-6 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-foreground text-lg font-semibold">
              {file.recordsFileViewName}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleFullscreen}
                className="text-muted-foreground hover:text-foreground hover:bg-muted"
                title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
              >
                {isFullscreen ? (
                  <Minimize2 className="w-4 h-4" />
                ) : (
                  <Maximize2 className="w-4 h-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDownload}
                className="text-muted-foreground hover:text-foreground hover:bg-muted"
                title="Download"
              >
                <Download className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="text-muted-foreground hover:text-foreground hover:bg-muted"
                title="Close"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-auto bg-card p-4 flex items-center justify-center">
          {isImage ? (
            <div className="w-full h-full flex items-center justify-center">
              {imageError ? (
                <div className="text-center text-muted-foreground">
                  <p className="mb-2">Failed to load image</p>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setImageError(false);
                      setImageObjectUrl(null);
                      setImageLoading(true);
                      fetch(fileContentUrl, { method: "GET", credentials: "include" })
                        .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
                        .then((blob) => {
                          const objectUrl = URL.createObjectURL(blob);
                          setImageObjectUrl(objectUrl);
                        })
                        .catch(() => setImageError(true))
                        .finally(() => setImageLoading(false));
                    }}
                    className="border-border text-muted-foreground hover:bg-muted"
                  >
                    Retry
                  </Button>
                </div>
              ) : imageLoading ? (
                <div className="text-muted-foreground">Loading image...</div>
              ) : imageObjectUrl ? (
                <img
                  id="file-viewer-image"
                  src={imageObjectUrl}
                  alt={file.recordsFileViewName}
                  className="max-w-full max-h-full object-contain"
                  onError={() => setImageError(true)}
                />
              ) : null}
            </div>
          ) : isPdf ? (
            <div className="w-full h-full">
              <iframe
                src={fileContentUrl}
                className="w-full h-full border-0"
                title={file.recordsFileViewName}
              />
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <p className="mb-4">Preview not available for this file type</p>
                <Button
                  variant="outline"
                  onClick={handleDownload}
                  className="border-border text-muted-foreground hover:bg-muted"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download to View
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

