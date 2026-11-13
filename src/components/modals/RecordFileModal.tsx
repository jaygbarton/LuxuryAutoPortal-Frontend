import React, { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { buildApiUrl } from "@/lib/queryClient";
import { mtTodayKey } from "@/lib/mt-datetime";

interface RecordFileModalProps {
  isOpen: boolean;
  onClose: () => void;
  carId: number;
  clientId?: number;
}

export function RecordFileModal({
  isOpen,
  onClose,
  carId,
  clientId,
}: RecordFileModalProps) {
  const [formData, setFormData] = useState({
    record_files_doc_name: "",
    record_files_date: "",
    record_files_remarks: "",
  });

  const queryClient = useQueryClient();

  // Initialize form data for new record
  useEffect(() => {
    if (isOpen) {
      // Set default date to today for new records
      const today = mtTodayKey();
      setFormData({
        record_files_doc_name: "",
        record_files_date: today,
        record_files_remarks: "",
      });
    }
  }, [isOpen]);

  const mutation = useMutation({
    mutationFn: async (values: any) => {
      // Validate required fields
      if (!values.record_files_doc_name || !values.record_files_date) {
        throw new Error("Document name and date are required");
      }

      if (!carId || carId <= 0) {
        throw new Error("Invalid car ID. Please refresh the page and try again.");
      }

      const url = buildApiUrl("/api/record-files");
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          record_files_doc_name: values.record_files_doc_name.trim(),
          record_files_date: values.record_files_date,
          record_files_remarks: values.record_files_remarks || "",
          record_files_car_id: carId,
        }),
      });

      if (!response.ok) {
        let errorMessage = "Failed to create record file";
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
          
          // Provide more specific error messages
          if (response.status === 400) {
            if (errorData.error?.includes("already exists")) {
              errorMessage = "A record with this document name already exists for this car.";
            } else if (errorData.error?.includes("Missing required")) {
              errorMessage = "Please fill in all required fields.";
            } else if (errorData.error?.includes("Car not found")) {
              errorMessage = "Car not found. Please refresh the page and try again.";
            } else if (errorData.error?.includes("Invalid") && (errorData.error?.includes("ID") || errorData.error?.includes("client") || errorData.error?.includes("car"))) {
              errorMessage = errorData.error;
            } else {
              errorMessage = errorData.error || errorMessage;
            }
          } else if (response.status === 401) {
            errorMessage = "You are not authorized to perform this action. Please log in again.";
          } else if (response.status === 500) {
            // Handle database configuration errors
            if (errorData.message?.includes("could not verify") || errorData.message?.includes("check the Records and Files page")) {
              errorMessage = "The record may have been created successfully. Please check the Records and Files table to confirm. If it's not there, please try again.";
            } else if (errorData.message?.includes("attempted to fix") || errorData.message?.includes("try again")) {
              errorMessage = "The system detected and attempted to fix a database configuration issue. Please try submitting again. If the problem persists, contact support.";
            } else if (errorData.message?.includes("auto-increment") || errorData.message?.includes("PRIMARY") || errorData.error?.includes("Database configuration")) {
              errorMessage = "Database configuration error detected. The system administrator needs to reset the database auto-increment. Please contact support.";
            } else if (errorData.message?.includes("Duplicate entry")) {
              errorMessage = "Database error: A record with this information already exists or there's a configuration issue. Please contact support.";
            } else {
              errorMessage = errorData.message || errorData.error || "Server error. Please try again later.";
            }
          }
        } catch (e) {
          // If JSON parsing fails, use status text
          errorMessage = `Failed to create record file: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      return response.json();
    },
    onSuccess: async (response) => {
      console.log("Record file created successfully with ID:", response?.data?.id || "unknown");
      
      // Invalidate all record-files queries to ensure UI updates
      // This will cause all queries starting with "/api/record-files" to refetch
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === "string" && key.startsWith("/api/record-files");
        }
      });
      
      // Small delay to ensure backend has committed the transaction
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Refetch all record-files queries to get the latest data
      await queryClient.refetchQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === "string" && key.startsWith("/api/record-files");
        }
      });
      
      // Close modal after successful creation
      onClose();
    },
  });

  if (!isOpen) return null;

  // Validate carId before allowing submission
  if (!carId || carId <= 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/50 p-4">
        <div className="bg-card border border-border rounded-lg w-full max-w-2xl p-6 relative">
          <div className="text-red-700 text-sm">
            Invalid car ID. Please go back and try again.
          </div>
          <Button
            onClick={onClose}
            className="mt-4 bg-primary text-black hover:bg-primary/80"
          >
            Close
          </Button>
        </div>
      </div>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent event bubbling
    
    // Prevent double submission
    if (mutation.isPending) {
      return;
    }
    
    // Additional validation before submission
    if (!formData.record_files_doc_name.trim()) {
      return;
    }
    if (!formData.record_files_date) {
      return;
    }
    
    // Only mutate if not already pending
    if (!mutation.isPending) {
      mutation.mutate(formData);
    }
  };

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
          Add Record File
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="doc_name" className="text-muted-foreground">
              Document Name *
            </Label>
            <Input
              id="doc_name"
              type="text"
              value={formData.record_files_doc_name}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  record_files_doc_name: e.target.value,
                }))
              }
              disabled={mutation.isPending}
              className="bg-card border-border text-foreground mt-1"
              required
            />
          </div>

          <div>
            <Label htmlFor="date" className="text-muted-foreground">
              Date *
            </Label>
            <Input
              id="date"
              type="date"
              value={formData.record_files_date}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  record_files_date: e.target.value,
                }))
              }
              disabled={mutation.isPending}
              className="bg-card border-border text-foreground mt-1 [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:brightness-0 [&::-webkit-calendar-picker-indicator]:contrast-100"
              required
            />
          </div>

          <div>
            <Label htmlFor="remarks" className="text-muted-foreground">
              Remarks
            </Label>
            <Textarea
              id="remarks"
              value={formData.record_files_remarks}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  record_files_remarks: e.target.value,
                }))
              }
              disabled={mutation.isPending}
              className="bg-card border-border text-foreground mt-1"
              rows={3}
              placeholder="Enter any additional notes or remarks about this record..."
            />
          </div>

          <div className="p-3 bg-blue-900/20 border border-blue-800/50 rounded">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-700 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-700">
                <p className="font-medium mb-1">New Record File</p>
                <p className="text-xs text-blue-700/80">
                  After creating this record, you can add individual files to it. The record will be created as Active by default.
                </p>
              </div>
            </div>
          </div>

          {mutation.isError && (
            <div className="p-3 bg-red-900/20 border border-red-800/50 rounded">
              <div className="text-red-700 text-sm font-medium">
                {mutation.error instanceof Error
                  ? mutation.error.message
                  : "An error occurred while creating the record file"}
              </div>
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
              disabled={mutation.isPending || !formData.record_files_doc_name || !formData.record_files_date}
              className="bg-primary text-black hover:bg-primary/80"
            >
              {mutation.isPending ? "Saving..." : "Add"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default RecordFileModal;
