import { useState, useRef, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { buildApiUrl } from "@/lib/queryClient";

export interface ExistingImage {
  id: string;
  url: string;
  filename: string;
}

export function useImageUpload(carId: number, year: string, category: string, field: string, month: number) {
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [existingImages, setExistingImages] = useState<ExistingImage[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingImages, setIsLoadingImages] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fetchingRef = useRef<string | null>(null);
  const { toast } = useToast();

  // Shared acceptance logic for both <input type="file"> change events and
  // drag-and-drop drops. Filters for supported image types and notifies the
  // user if any dropped/selected files were rejected.
  const acceptFiles = useCallback((incoming: File[]) => {
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
    const accepted = incoming.filter((file) => validTypes.includes(file.type));

    if (accepted.length !== incoming.length) {
      toast({
        title: "Invalid file type",
        description: "Only image files (JPEG, PNG, GIF, WebP) are allowed",
        variant: "destructive",
      });
    }

    if (accepted.length > 0) {
      setImageFiles((prev) => [...prev, ...accepted]);
    }
  }, [toast]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    acceptFiles(Array.from(e.target.files));

    // Reset input so selecting the same file again still triggers change
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleFilesDropped = useCallback((files: File[]) => {
    acceptFiles(files);
  }, [acceptFiles]);

  const fetchExistingImages = useCallback(async () => {
    // Create a unique key for this fetch request
    const fetchKey = `${carId}-${year}-${month}-${category}-${field}`;
    
    // Prevent duplicate simultaneous requests
    if (fetchingRef.current === fetchKey) {
      return;
    }
    
    fetchingRef.current = fetchKey;
    setIsLoadingImages(true);
    
    try {
      const url = buildApiUrl(
        `/api/income-expense/images?carId=${carId}&year=${year}&month=${month}&category=${category}&field=${field}`
      );
      
      const response = await fetch(url, { credentials: "include" });
      
      if (response.ok) {
        const data = await response.json();
        const images = data.images || data.data?.images || [];
        setExistingImages(images);
      }
    } catch (error) {
      // Failed to fetch images
    } finally {
      setIsLoadingImages(false);
      fetchingRef.current = null;
    }
  }, [carId, year, category, field, month]);

  // Fetch existing images when modal opens
  useEffect(() => {
    if (carId && year && category && field && month) {
      fetchExistingImages();
    }
  }, [carId, year, category, field, month, fetchExistingImages]);

  const handleRemoveImage = (index: number) => {
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRemoveExistingImage = async (imageId: string) => {
    if (!window.confirm("Are you sure you want to delete this image?")) {
      return;
    }

    try {
      const response = await fetch(
        buildApiUrl(`/api/income-expense/images/${imageId}`),
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to delete image");
      }

      // Remove from UI immediately
      setExistingImages((prev) => prev.filter((img) => img.id !== imageId));
      
      toast({
        title: "Success",
        description: "Image deleted successfully",
      });
    } catch (error: any) {
      toast({
        title: "Deletion failed",
        description: error.message || "Failed to delete image",
        variant: "destructive",
      });
    }
  };

  const uploadImages = async () => {
    setIsUploading(true);

    try {
      // Upload new images
      if (imageFiles.length > 0) {
      const formData = new FormData();
      imageFiles.forEach((file) => {
        formData.append("images", file);
      });
      formData.append("carId", carId.toString());
      formData.append("year", year);
      formData.append("month", month.toString());
      formData.append("category", category);
      formData.append("field", field);

      const response = await fetch(buildApiUrl("/api/income-expense/images/upload"), {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to upload images");
      }

        // Refresh existing images after upload
        await fetchExistingImages();
      }

      // Clear new image files
      setImageFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload images",
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsUploading(false);
    }
  };

  const resetImages = () => {
    setImageFiles([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return {
    imageFiles,
    existingImages,
    isUploading,
    isLoadingImages,
    fileInputRef,
    handleFileChange,
    handleFilesDropped,
    handleRemoveImage,
    handleRemoveExistingImage,
    uploadImages,
    resetImages,
  };
}
