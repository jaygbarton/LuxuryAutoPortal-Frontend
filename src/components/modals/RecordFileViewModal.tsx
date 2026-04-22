import React, { useState, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Upload, ExternalLink, Info, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { buildApiUrl } from "@/lib/queryClient";

interface RecordFileViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  carId: number;
  recordId: number;
  folderId: string;
  itemEdit?: {
    recordsFileViewAid: number;
    recordsFileViewName: string;
    recordsFileViewGoogleId: string;
    recordsFileViewRemarks?: string;
    recordsFileViewIsActive?: boolean;
  } | null;
}

export function RecordFileViewModal({
  isOpen,
  onClose,
  carId,
  recordId,
  folderId,
  itemEdit,
}: RecordFileViewModalProps) {
  const [formData, setFormData] = useState({
    records_file_view_name: "",
    records_file_view_remarks: "",
    file: null as File | null,
  });
  const [fileList, setFileList] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const queryClient = useQueryClient();

  // Initialize form data
  useEffect(() => {
    if (isOpen) {
      if (itemEdit) {
        // Validate that itemEdit has required ID for updates
        if (!itemEdit.recordsFileViewAid || itemEdit.recordsFileViewAid <= 0) {
          console.error("RecordFileViewModal: itemEdit missing valid recordsFileViewAid", itemEdit);
        }
        setFormData({
          records_file_view_name: itemEdit.recordsFileViewName || "",
          records_file_view_remarks: itemEdit.recordsFileViewRemarks || "",
          file: null,
        });
        setFileList([]);
      } else {
        // Reset form for new file
        setFormData({
          records_file_view_name: "",
          records_file_view_remarks: "",
          file: null,
        });
        setFileList([]);
      }
    }
  }, [isOpen, itemEdit]);

  const mutation = useMutation({
    mutationFn: async (values: any) => {
      // Note: If folder ID is missing, the backend will automatically create one

      // Validate that we have an ID for update operations
      if (itemEdit && (!itemEdit.recordsFileViewAid || itemEdit.recordsFileViewAid <= 0)) {
        throw new Error("File ID is required for update");
      }

      if (!itemEdit && fileList.length === 0 && !values.file) {
        throw new Error("Please select at least one file to upload");
      }

      // For new files, upload multiple files
      if (!itemEdit && (fileList.length > 0 || values.file)) {
        const filesToUpload = fileList.length > 0 ? fileList : (values.file ? [values.file] : []);
        const uploadResults = [];
        const errors: string[] = [];

        // Upload each file separately
        for (const file of filesToUpload) {
          // Use the file's own name for each file (as per reference implementation)
          const fileName = file.name;
          
          const formData = new FormData();
          formData.append("file", file);
          formData.append("records_file_view_name", fileName);
          formData.append("records_file_view_folder_id", folderId);
          formData.append("records_file_view_car_id", carId.toString());
          formData.append("records_file_view_record_id", recordId.toString());
          formData.append("records_file_view_remarks", values.records_file_view_remarks || "");

          const url = buildApiUrl("/api/record-file-views");
          try {
            const response = await fetch(url, {
              method: "POST",
              credentials: "include",
              body: formData,
            });

            if (!response.ok) {
              const error = await response.json();
              errors.push(`${file.name}: ${error.error || "Upload failed"}`);
              continue; // Continue with next file even if one fails
            }

            const result = await response.json();
            uploadResults.push(result);
          } catch (error: any) {
            errors.push(`${file.name}: ${error.message || "Upload failed"}`);
          }
        }

        // If all files failed, throw error
        if (uploadResults.length === 0 && errors.length > 0) {
          throw new Error(`Failed to upload files:\n${errors.join("\n")}`);
        }

        // If some files failed, return partial success with warnings
        if (errors.length > 0) {
          console.warn("Some files failed to upload:", errors);
        }

        return {
          success: true,
          message: `Successfully uploaded ${uploadResults.length} of ${filesToUpload.length} file(s)${errors.length > 0 ? ` (${errors.length} failed)` : ""}`,
          data: uploadResults,
          errors: errors.length > 0 ? errors : undefined,
        };
      }

      // For updates, only update metadata
      if (itemEdit && itemEdit.recordsFileViewAid) {
        const endpoint = `/api/record-file-views/${itemEdit.recordsFileViewAid}`;
        const url = buildApiUrl(endpoint);
        const response = await fetch(url, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            records_file_view_name: values.records_file_view_name,
            records_file_view_remarks: values.records_file_view_remarks || "",
            records_file_view_name_old: itemEdit.recordsFileViewName || "",
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to update file");
        }

        return response.json();
      }

      throw new Error("Invalid operation");
    },
    onSuccess: async () => {
      // Invalidate all record-file-views queries to ensure UI updates
      await queryClient.invalidateQueries({ 
        queryKey: ["/api/record-file-views"],
        exact: false 
      });
      // Refetch to ensure immediate UI update
      await queryClient.refetchQueries({ 
        queryKey: ["/api/record-file-views"],
        exact: false 
      });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const fileArray = Array.from(files);
      
      // Limit to 20 files
      if (fileArray.length > 20) {
        alert("Maximum 20 files allowed. Please select fewer files.");
        return;
      }

      // Sort files by name
      const sortedFiles = fileArray.sort((a, b) => {
        if (a.name < b.name) return -1;
        if (a.name > b.name) return 1;
        return 0;
      });

      setFileList((prev) => {
        const newList = [...prev, ...sortedFiles];
        // Auto-fill file name from first file if not editing and name is empty
        if (!itemEdit && !formData.records_file_view_name && newList.length > 0) {
          setFormData((prevData) => ({
            ...prevData,
            records_file_view_name: newList[0].name,
          }));
        }
        return newList;
      });
    }
  };

  const handleRemoveFile = (index: number) => {
    setFileList((prev) => {
      const newList = prev.filter((_, i) => i !== index);
      // Update file name if list becomes empty
      if (newList.length === 0) {
        setFormData((prevData) => ({
          ...prevData,
          records_file_view_name: "",
        }));
      } else if (index === 0 && newList.length > 0) {
        // Update to first file name if first file was removed
        setFormData((prevData) => ({
          ...prevData,
          records_file_view_name: newList[0].name,
        }));
      }
      return newList;
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const fileArray = Array.from(files);
      
      // Limit to 20 files
      if (fileArray.length > 20) {
        alert("Maximum 20 files allowed. Please select fewer files.");
        return;
      }

      // Sort files by name
      const sortedFiles = fileArray.sort((a, b) => {
        if (a.name < b.name) return -1;
        if (a.name > b.name) return 1;
        return 0;
      });

      setFileList((prev) => {
        const newList = [...prev, ...sortedFiles];
        // Auto-fill file name from first file if not editing and name is empty
        if (!itemEdit && !formData.records_file_view_name && newList.length > 0) {
          setFormData((prevData) => ({
            ...prevData,
            records_file_view_name: newList[0].name,
          }));
        }
        return newList;
      });
    }
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  if (!isOpen) return null;

  // Check if folder ID is valid (not just recordId fallback)
  const hasValidFolderId = folderId && folderId.trim() !== "" && folderId !== recordId.toString();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/50 p-4">
      <div className="bg-card border border-border rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
          disabled={mutation.isPending}
        >
          <X className="w-5 h-5" />
        </button>

        <h3 className="text-lg font-semibold text-foreground mb-6">
          {itemEdit ? "Edit File" : "Add File"}
        </h3>

        {/* Info if folder ID is missing */}
        {!hasValidFolderId && !itemEdit && (
          <div className="mb-4 p-3 bg-blue-900/20 border border-blue-800/50 rounded">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-700 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-700">
                <p className="font-medium mb-1">Google Drive Folder Will Be Created</p>
                <p className="text-xs text-blue-700/80">
                  This record does not have a Google Drive folder ID. A folder will be automatically created when you upload your first file.
                </p>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!itemEdit && (
            <div>
              <Label className="text-muted-foreground">File *</Label>
              {/* Drag & Drop Zone */}
              <div
                ref={dropZoneRef}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={handleBrowseClick}
                className={`mt-1 relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  isDragging
                    ? "border-primary bg-primary/10 cursor-pointer"
                    : "border-border hover:border-primary/50 bg-card cursor-pointer"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleFileChange}
                  disabled={mutation.isPending}
                  className="hidden"
                  accept="*"
                />
                <div className="flex flex-col items-center justify-center gap-2">
                  <Upload className={`w-8 h-8 ${isDragging ? "text-[#D3BC8D]" : "text-muted-foreground"}`} />
                  <div className="text-sm">
                    <span className="text-[#D3BC8D]">Drag & Drop</span>{" "}
                    <span className="text-muted-foreground">multiple files here or</span>{" "}
                    <span className="text-[#D3BC8D]">Browse</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Supported formats: PDF, Images, Documents. Maximum 20 files.
                  </p>
                </div>
              </div>

              {/* File List */}
              {fileList.length > 0 && (
                <div className="mt-4 p-3 bg-card border border-border rounded">
                  <Label className="text-muted-foreground text-sm mb-2 block">
                    Selected Files ({fileList.length})
                  </Label>
                  <ol className="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
                    {fileList.map((file, index) => (
                      <li
                        key={index}
                        className="flex items-center justify-between text-sm text-muted-foreground p-2 bg-card rounded hover:bg-muted transition-colors"
                      >
                        <span className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="text-muted-foreground">{index + 1}.</span>
                          <span className="truncate" title={file.name}>
                            {file.name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            ({(file.size / 1024 / 1024).toFixed(2)} MB)
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveFile(index);
                          }}
                          disabled={mutation.isPending}
                          className="ml-2 text-red-700 hover:text-red-700 transition-colors"
                          title="Remove file"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          )}

          {itemEdit && (
            <div>
              <Label htmlFor="file_name" className="text-muted-foreground">
                File Name *
              </Label>
              <Input
                id="file_name"
                type="text"
                value={formData.records_file_view_name}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    records_file_view_name: e.target.value,
                  }))
                }
                disabled={mutation.isPending}
                className="bg-card border-border text-foreground mt-1"
                required
              />
              <p className="text-xs text-muted-foreground mt-1">
                Update the file name as it appears in the system
              </p>
            </div>
          )}

          <div>
            <Label htmlFor="remarks" className="text-muted-foreground">
              Remarks
            </Label>
            <Textarea
              id="remarks"
              value={formData.records_file_view_remarks}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  records_file_view_remarks: e.target.value,
                }))
              }
              disabled={mutation.isPending}
              className="bg-card border-border text-foreground mt-1"
              rows={3}
              placeholder="Enter any additional notes or remarks about this file..."
            />
          </div>

          {itemEdit && itemEdit.recordsFileViewGoogleId && (
            <div>
              <Label className="text-muted-foreground flex items-center gap-2">
                <span>Google Drive File</span>
                <span title="The Google Drive file ID for this file">
                  <Info className="w-4 h-4 text-muted-foreground" />
                </span>
              </Label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  type="text"
                  value={itemEdit.recordsFileViewGoogleId}
                  disabled
                  className="bg-card border-border text-muted-foreground flex-1"
                />
                <a
                  href={`https://drive.google.com/file/d/${itemEdit.recordsFileViewGoogleId}/view`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 bg-card border border-border rounded hover:bg-muted transition-colors"
                  title="Open in Google Drive"
                >
                  <ExternalLink className="w-4 h-4 text-[#D3BC8D]" />
                </a>
              </div>
            </div>
          )}

          {!itemEdit && (
            <div className="p-3 bg-blue-900/20 border border-blue-800/50 rounded">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-700 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-blue-700">
                  <p className="font-medium mb-1">New File Upload</p>
                  <p className="text-xs text-blue-700/80">
                    The file will be uploaded to Google Drive and linked to this record. The file will be created as Active by default.
                  </p>
                </div>
              </div>
            </div>
          )}

          {mutation.isError && (
            <div className="text-red-700 text-sm">
              {mutation.error instanceof Error
                ? mutation.error.message
                : "An error occurred"}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={mutation.isPending}
              className="border-border text-muted-foreground hover:bg-muted"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                mutation.isPending ||
                (itemEdit && !formData.records_file_view_name) ||
                (!itemEdit && fileList.length === 0 && !formData.file)
              }
              className="bg-primary text-black hover:bg-primary/80 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {mutation.isPending
                ? itemEdit
                  ? "Saving..."
                  : fileList.length > 1
                  ? `Uploading ${fileList.length} files...`
                  : "Uploading..."
                : itemEdit
                ? "Save"
                : fileList.length > 1
                ? `Upload ${fileList.length} Files`
                : "Upload"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

