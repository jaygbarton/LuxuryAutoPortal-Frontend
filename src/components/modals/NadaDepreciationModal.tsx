import { optionKeywords } from "@/lib/select-search";
import React, { useState, useEffect, useRef } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { buildApiUrl } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

interface NadaDepreciationModalProps {
  isOpen: boolean;
  onClose: () => void;
  carId: number;
  year: string;
  itemEdit?: any;
  isWithAdd?: boolean; // true for previous year, false for current year
  clientId?: number;
  userId?: number;
}

export function NadaDepreciationModal({
  isOpen,
  onClose,
  carId,
  year,
  itemEdit,
  isWithAdd = false,
  clientId,
  userId,
}: NadaDepreciationModalProps) {
  const [categoryName, setCategoryName] = useState("");
  const [formData, setFormData] = useState({
    date: "",
    categoryId: "",
    amount: "",
  });
  const isInitializedRef = useRef(false);
  const prevItemEditRef = useRef(itemEdit);

  const queryClient = useQueryClient();

  // Fetch categories for current year or previous year
  const { data: currentCostData, isLoading: isLoadingCategories } = useQuery({
    queryKey: [isWithAdd ? "/api/current-cost-with-add" : "/api/current-cost"],
    queryFn: async () => {
      const url = buildApiUrl(
        isWithAdd ? "/api/current-cost-with-add" : "/api/current-cost"
      );
      const response = await fetch(url, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch categories");
      return response.json();
    },
    enabled: isOpen,
  });

  // Fetch previous year categories to get MILES ID (needed for current year data)
  const { data: currentCostWithAddData } = useQuery({
    queryKey: ["/api/current-cost-with-add"],
    queryFn: async () => {
      const url = buildApiUrl("/api/current-cost-with-add");
      const response = await fetch(url, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch categories with add");
      return response.json();
    },
    enabled: isOpen && !isWithAdd, // Only fetch when creating current year data
  });

  // Default categories in case API hasn't loaded yet or returns empty
  const defaultCurrentCost = [
    { currentCostAid: 1, currentCostIsActive: true, currentCostName: "NADA - Retail", currentCostCompute: "", currentCostCreated: "", currentCostDatetime: "" },
    { currentCostAid: 2, currentCostIsActive: true, currentCostName: "NADA - Clean", currentCostCompute: "nada-clean", currentCostCreated: "", currentCostDatetime: "" },
    { currentCostAid: 3, currentCostIsActive: true, currentCostName: "NADA - Average", currentCostCompute: "nada-average", currentCostCreated: "", currentCostDatetime: "" },
    { currentCostAid: 4, currentCostIsActive: true, currentCostName: "NADA - Rough", currentCostCompute: "", currentCostCreated: "", currentCostDatetime: "" },
    { currentCostAid: 5, currentCostIsActive: true, currentCostName: "MILES", currentCostCompute: "", currentCostCreated: "", currentCostDatetime: "" },
    { currentCostAid: 6, currentCostIsActive: true, currentCostName: "Amounted Owed on Car $", currentCostCompute: "", currentCostCreated: "", currentCostDatetime: "" },
  ];

  const defaultCurrentCostWithAdd = [
    { currentCostWithAddAid: 1, currentCostWithAddIsActive: true, currentCostWithAddName: "NADA - Retail", currentCostWithAddCreated: "", currentCostWithAddDatetime: "" },
    { currentCostWithAddAid: 2, currentCostWithAddIsActive: true, currentCostWithAddName: "NADA - Clean", currentCostWithAddCreated: "", currentCostWithAddDatetime: "" },
    { currentCostWithAddAid: 3, currentCostWithAddIsActive: true, currentCostWithAddName: "NADA - Average", currentCostWithAddCreated: "", currentCostWithAddDatetime: "" },
    { currentCostWithAddAid: 4, currentCostWithAddIsActive: true, currentCostWithAddName: "NADA - Rough", currentCostWithAddCreated: "", currentCostWithAddDatetime: "" },
    { currentCostWithAddAid: 5, currentCostWithAddIsActive: true, currentCostWithAddName: "MILES", currentCostWithAddCreated: "", currentCostWithAddDatetime: "" },
  ];

  // Use API data if available, otherwise use defaults
  const categories = (currentCostData?.data && currentCostData.data.length > 0) 
    ? currentCostData.data 
    : (isWithAdd ? defaultCurrentCostWithAdd : defaultCurrentCost);
  
  const categoriesWithAdd = (currentCostWithAddData?.data && currentCostWithAddData.data.length > 0)
    ? currentCostWithAddData.data
    : defaultCurrentCostWithAdd;

  // Find MILES ID from previous year categories (for current year data)
  const milesId = categoriesWithAdd.find((item: any) =>
    item.currentCostWithAddName?.includes("MILES")
  )?.currentCostWithAddAid;

  const mutation = useMutation({
    mutationFn: async (values: any) => {
      const endpoint = isWithAdd
        ? itemEdit
          ? `/api/nada-depreciation-with-add/${itemEdit.nadaDepreciationWithAddAid}`
          : "/api/nada-depreciation-with-add"
        : itemEdit
        ? `/api/nada-depreciation/${itemEdit.nadaDepreciationAid}`
        : "/api/nada-depreciation";

      const method = itemEdit ? "PUT" : "POST";

      const url = buildApiUrl(endpoint);
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save");
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate all related queries to refresh the table
      // TanStack Query will match queries that start with these keys
      queryClient.invalidateQueries({
        queryKey: ["/api/nada-depreciation/read"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/nada-depreciation-with-add/read"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/current-cost"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/current-cost-with-add"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/car-backlog"],
      });
      // Reset form and close
      setFormData({
        date: "",
        categoryId: "",
        amount: "",
      });
      setCategoryName("");
      onClose();
    },
  });

  // Initialize form data when modal opens or itemEdit changes
  useEffect(() => {
    if (!isOpen) {
      // Reset form when modal closes
      setFormData({
        date: "",
        categoryId: "",
        amount: "",
      });
      setCategoryName("");
      isInitializedRef.current = false;
      prevItemEditRef.current = null;
      return;
    }

    // Check if itemEdit changed (for edit mode)
    const itemEditChanged = prevItemEditRef.current !== itemEdit;
    prevItemEditRef.current = itemEdit;

    // Only initialize once when modal opens, or when itemEdit changes
    if (!isInitializedRef.current || itemEditChanged) {
      if (itemEdit) {
        // Edit mode: populate with existing data (even if categories haven't loaded yet)
        const editCategoryId = itemEdit.nadaDepreciationId || itemEdit.nadaDepreciationWithAddId;
        setFormData({
          date:
            itemEdit.nadaDepreciationDate || itemEdit.nadaDepreciationWithAddDate || "",
          categoryId: editCategoryId?.toString() || "",
          amount:
            itemEdit.nadaDepreciationAmount ||
            itemEdit.nadaDepreciationWithAddAmount ||
            "",
        });
        isInitializedRef.current = true;
      } else {
        // Add mode: initialize with empty values (user must manually enter date)
        setFormData({
          date: "",
          categoryId: "",
          amount: "",
        });
        setCategoryName("");
        isInitializedRef.current = true;
      }
    }
  }, [itemEdit, isOpen]); // Removed categories and year from dependencies to prevent unnecessary resets

  // Update category name when categories load (for edit mode)
  useEffect(() => {
    if (isOpen && itemEdit && categories.length > 0 && formData.categoryId) {
      const editCategoryId = itemEdit.nadaDepreciationId || itemEdit.nadaDepreciationWithAddId;
      const category = categories.find(
        (cat: any) =>
          cat.currentCostAid?.toString() === editCategoryId?.toString() ||
          cat.currentCostWithAddAid?.toString() === editCategoryId?.toString()
      );
      if (category && !categoryName) {
        setCategoryName(
          category.currentCostName || category.currentCostWithAddName
        );
      }
    }
  }, [categories, isOpen, itemEdit, formData.categoryId, categoryName]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const payload = isWithAdd
      ? {
          nada_depreciation_with_add_car_id: carId,
          nada_depreciation_with_add_id: parseInt(formData.categoryId),
          nada_depreciation_with_add_date: formData.date,
          nada_depreciation_with_add_amount: parseFloat(formData.amount),
          car_backlog_item: `NADA-depreciation-schedule-${year}`,
          // Backend will get clientId from car table and userId from session
          car_backlog_category_name: categoryName,
          car_backlog_old_values: itemEdit
            ? itemEdit.nadaDepreciationWithAddAmount?.toString() || "0"
            : "0",
        }
      : {
          nada_depreciation_car_id: carId,
          nada_depreciation_id: parseInt(formData.categoryId),
          nada_depreciation_date: formData.date,
          nada_depreciation_amount: parseFloat(formData.amount),
          // Include MILES ID from previous year (matching original implementation)
          nada_depreciation_with_add_id: milesId || undefined,
          car_backlog_item: `NADA-depreciation-schedule-${year}`,
          // Backend will get clientId from car table and userId from session
          car_backlog_category_name: categoryName,
          car_backlog_old_values: itemEdit
            ? itemEdit.nadaDepreciationAmount?.toString() || "0"
            : "0",
        };

    mutation.mutate(payload);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/50">
      <div className="bg-card border border-border rounded-lg w-full max-w-md p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
          disabled={mutation.isPending}
        >
          <X className="w-5 h-5" />
        </button>

        <h3 className="text-lg font-semibold text-foreground mb-6">
          {itemEdit ? "Update" : "Add"} Current Cost {isWithAdd ? "with Add" : ""}
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="date" className="text-muted-foreground">
              Date
            </Label>
            <Input
              id="date"
              type="month"
              value={formData.date}
              onChange={(e) => {
                const selectedDate = e.target.value;
                setFormData((prev) => ({ ...prev, date: selectedDate }));
              }}
              onInput={(e) => {
                const selectedDate = (e.target as HTMLInputElement).value;
                if (selectedDate) {
                  setFormData((prev) => ({ ...prev, date: selectedDate }));
                }
              }}
              disabled={mutation.isPending || !!itemEdit}
              className="bg-card border-border text-foreground mt-1 [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:brightness-0 [&::-webkit-calendar-picker-indicator]:contrast-100"
              required
            />
          </div>

          <div>
            <Label htmlFor="category" className="text-muted-foreground">
              Category
            </Label>
            <Select
              value={formData.categoryId || undefined}
              onValueChange={(value) => {
                setFormData((prev) => ({ ...prev, categoryId: value }));
                const category = categories.find(
                  (cat: any) =>
                    cat.currentCostAid?.toString() === value ||
                    cat.currentCostWithAddAid?.toString() === value
                );
                if (category) {
                  setCategoryName(
                    category.currentCostName || category.currentCostWithAddName
                  );
                }
              }}
              disabled={mutation.isPending || !!itemEdit}
            >
              <SelectTrigger className="bg-card border-border text-foreground mt-1">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border text-foreground">
                {isLoadingCategories ? (
                  <SelectItem value="loading" disabled>
                    Loading categories...
                  </SelectItem>
                ) : categories.length === 0 ? (
                  <SelectItem value="no-data" disabled>
                    No categories available
                  </SelectItem>
                ) : (
                  categories
                    .filter((cat: any) => {
                      if (isWithAdd) {
                        // For "with add" modal, show only: Retail, Clean, Average, Rough (exclude MILES)
                        const name = (cat.currentCostWithAddName || cat.currentCostName || "").toUpperCase();
                        return (
                          (name.includes("RETAIL") ||
                           name.includes("CLEAN") ||
                           name.includes("AVERAGE") ||
                           name.includes("ROUGH")) &&
                          !name.includes("MILES")
                        );
                      } else {
                        // For current year, include all categories (Retail, Clean, Average, Rough, MILES, Amounted Owed)
                        // No filtering needed - show all categories
                        return true;
                      }
                    })
                    .sort((a: any, b: any) => {
                      // Sort by ID to ensure proper order: Retail (1), Clean (2), Average (3), Rough (4)
                      const aId = a.currentCostAid || a.currentCostWithAddAid || 0;
                      const bId = b.currentCostAid || b.currentCostWithAddAid || 0;
                      return aId - bId;
                    })
                    .map((cat: any) => {
                      const catName = cat.currentCostName || cat.currentCostWithAddName || "";
                      const catId = cat.currentCostAid || cat.currentCostWithAddAid;
                      if (!catName || !catId) return null;
                      return (
                        <SelectItem searchKeywords={optionKeywords(cat)}
                          key={catId}
                          value={catId.toString()}
                        >
                          {catName}
                        </SelectItem>
                      );
                    })
                    .filter(Boolean) // Remove any null entries
                )}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="amount" className="text-muted-foreground">
              Value
            </Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              value={formData.amount}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, amount: e.target.value }))
              }
              disabled={mutation.isPending}
              className="bg-card border-border text-foreground mt-1"
              required
            />
          </div>

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
              disabled={mutation.isPending || !formData.date || !formData.categoryId || !formData.amount}
              className="bg-primary text-black hover:bg-primary/80"
            >
              {mutation.isPending
                ? "Saving..."
                : itemEdit
                ? "Save"
                : "Add"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

