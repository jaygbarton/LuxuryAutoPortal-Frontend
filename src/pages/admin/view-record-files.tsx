import React, { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/admin-layout";
import { AdminPageLinks } from "@/components/admin/AdminPageLinks";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, ExternalLink, Plus, Search, Edit, Trash2, List, ChevronLeft, ChevronRight, Download, Eye, Grid3x3, Folder, Archive, History } from "lucide-react";
import { RecordFilesLogModal } from "@/components/modals/RecordFilesLogModal";
import { RecordFileViewModal } from "@/components/modals/RecordFileViewModal";
import { FileViewerModal } from "@/components/modals/FileViewerModal";
import { buildApiUrl } from "@/lib/queryClient";
import { CarDetailSkeleton } from "@/components/ui/skeletons";
import { cn } from "@/lib/utils";

interface CarDetail {
  id: number;
  vin: string;
  makeModel: string;
  licensePlate?: string;
  year?: number;
  mileage: number;
  status: "ACTIVE" | "INACTIVE";
  clientId?: number | null;
  owner?: {
    firstName: string;
    lastName: string;
    email: string | null;
    phone?: string | null;
  } | null;
}

interface RecordFile {
  recordFilesAid: number;
  recordFilesDocName: string;
  recordFilesIsActive: boolean;
  recordFilesDate: string;
  recordFilesRemarks?: string;
  recordFilesGdrive?: string;
  recordFilesClientId: number;
  recordFilesCarId: number;
  recordFilesCreated: string;
  recordFilesDatetime: string;
}

interface RecordFileView {
  recordsFileViewAid: number;
  recordsFileViewName: string;
  recordsFileViewFolderId: string;
  recordsFileViewGoogleId: string;
  recordsFileViewClientId: string;
  recordsFileViewCarId: string;
  recordsFileViewRemarks: string;
  recordsFileViewIsActive: boolean;
  recordsFileViewCreated: string;
  recordsFileViewDatetime: string;
}

// Cache for image blobs to avoid re-fetching
const imageBlobCache = new Map<number, string>();

interface PageData {
  data: RecordFileView[];
  page: number;
  total: number;
  count: number;
}

export default function ViewRecordFilesPage() {
  const [, params] = useRoute("/admin/cars/:carId/records/:recordId/files");
  const [, setLocation] = useLocation();
  const carId = params?.carId ? parseInt(params.carId, 10) : null;
  const recordId = params?.recordId ? parseInt(params.recordId, 10) : null;
  const [filterStatus, setFilterStatus] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [itemsPerPage, setItemsPerPage] = useState<10 | 20 | 50>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [onSearch, setOnSearch] = useState(false);
  const [isFilter, setIsFilter] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [isViewerModalOpen, setIsViewerModalOpen] = useState(false);
  const [itemEdit, setItemEdit] = useState<RecordFileView | null>(null);
  const [viewingFile, setViewingFile] = useState<RecordFileView | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "grid">("grid");
  const [imageUrls, setImageUrls] = useState<Map<number, string>>(new Map());
  const [imageErrors, setImageErrors] = useState<Set<number>>(new Set());
  const queryClient = useQueryClient();

  // Fetch user data
  const { data: userData } = useQuery<{ user?: any }>({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      const response = await fetch(buildApiUrl("/api/auth/me"), { credentials: "include" });
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });
  const user = userData?.user;

  // Fetch car details
  const { data: carData, isLoading, error } = useQuery<{
    success: boolean;
    data: CarDetail;
  }>({
    queryKey: ["/api/cars", carId],
    queryFn: async () => {
      if (!carId) throw new Error("Car ID is required");
      const url = buildApiUrl(`/api/cars/${carId}`);
      const response = await fetch(url, {
        credentials: "include",
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Failed to fetch car" }));
        throw new Error(errorData.error || "Failed to fetch car");
      }
      return response.json();
    },
    enabled: !!carId,
    retry: 1,
  });

  const car = carData?.success ? carData?.data : null;

  // Fetch record file details
  const { data: recordData, error: recordError } = useQuery<{
    success: boolean;
    data: RecordFile;
  }>({
    queryKey: ["/api/record-files", recordId],
    queryFn: async () => {
      if (!recordId) throw new Error("Record ID is required");
      const url = buildApiUrl(`/api/record-files/${recordId}`);
      const response = await fetch(url, {
        credentials: "include",
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Failed to fetch record" }));
        throw new Error(errorData.error || "Failed to fetch record");
      }
      return response.json();
    },
    enabled: !!recordId,
    retry: 1,
  });

  const record = recordData?.success ? recordData?.data : null;

  // Reset to page 1 when filter, search, or items per page changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filterStatus, searchQuery, itemsPerPage, isFilter, onSearch]);

  // Fetch record file views with pagination
  const {
    data: recordsData,
    error: recordsError,
    isFetching,
    status,
  } = useQuery<PageData>({
    queryKey: [
      "/api/record-file-views",
      record?.recordFilesGdrive || "",
      carId || 0,
      currentPage,
      itemsPerPage,
      onSearch,
      searchQuery,
      filterStatus,
      isFilter,
    ],
    queryFn: async (): Promise<PageData> => {
      // Only use recordFilesGdrive as folderId (don't use recordId as fallback)
      // If recordFilesGdrive is missing, the query should not run (handled by enabled condition)
      const folderId = record?.recordFilesGdrive || "";

      if (!folderId || folderId.trim() === "") {
        // Return empty result if no folder ID
        return {
          data: [],
          page: currentPage,
          total: 0,
          count: 0,
        };
      }

      const params = new URLSearchParams({
        folderId: folderId,
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
      });

      if (carId) {
        params.append("carId", carId.toString());
      }

      if (searchQuery && searchQuery.trim() !== "") {
        params.append("searchValue", searchQuery);
      }

      if (isFilter && filterStatus !== "All") {
        params.append("isFilter", "true");
        params.append("recordsFileViewIsActive", filterStatus === "Active" ? "1" : "0");
      }

      const url = buildApiUrl(`/api/record-file-views?${params.toString()}`);
      const response = await fetch(url, {
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || errorData.message || `Failed to fetch files: ${response.statusText}`);
      }

      const result = await response.json();

      return {
        data: result.data || [],
        page: result.page || currentPage,
        total: result.total || 0,
        count: result.count || 0,
      };
    },
    enabled: !!record && !!carId && !!recordId && !!record?.recordFilesGdrive,
    refetchOnWindowFocus: true,
    retry: 1,
  });

  const files = recordsData?.data || [];
  const totalFiles = Number(recordsData?.total) || 0;
  const totalPages = itemsPerPage > 0 ? Math.ceil(totalFiles / itemsPerPage) : 0;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + files.length;

  // Ensure current page is valid when filtered results change
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  // Load images as blobs with credentials (required for authenticated endpoints)
  useEffect(() => {
    if (!recordsData?.data) return;

    const loadImages = async () => {
      const newImageUrls = new Map<number, string>();
      const newImageErrors = new Set<number>();

      for (const file of recordsData.data) {
        // Check if it's an image file
        const fileExt = file.recordsFileViewName.split('.').pop()?.toLowerCase() || '';
        const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(fileExt);
        
        if (!isImage) {
          continue;
        }

        // Skip if already loaded or failed
        if (imageUrls.has(file.recordsFileViewAid) || imageErrors.has(file.recordsFileViewAid)) {
          continue;
        }

        try {
          const url = getFileContentUrl(file.recordsFileViewAid);
          const response = await fetch(url, {
            credentials: 'include',
            method: 'GET',
          });

          if (!response.ok) {
            throw new Error(`Failed to load image: ${response.status}`);
          }

          const blob = await response.blob();
          const objectUrl = URL.createObjectURL(blob);
          newImageUrls.set(file.recordsFileViewAid, objectUrl);
        } catch (error) {
          console.error(`Failed to load image for file ${file.recordsFileViewAid}:`, error);
          newImageErrors.add(file.recordsFileViewAid);
        }
      }

      if (newImageUrls.size > 0 || newImageErrors.size > 0) {
        setImageUrls(prev => new Map([...prev, ...newImageUrls]));
        setImageErrors(prev => new Set([...prev, ...newImageErrors]));
      }
    };

    loadImages();

    // Cleanup: revoke object URLs when component unmounts
    return () => {
      imageUrls.forEach((url) => {
        URL.revokeObjectURL(url);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordsData?.data]);

  // Handle search
  const handleSearch = () => {
    if (searchQuery.trim() !== "") {
      setOnSearch(true);
    } else {
      setOnSearch(false);
    }
  };

  // Handle filter change
  const handleFilterChange = (value: string) => {
    setFilterStatus(value);
    if (value !== "All") {
      setIsFilter(true);
      setOnSearch(true);
    } else {
      setIsFilter(false);
      setOnSearch(false);
    }
  };

  // Handle clear filters
  const handleClear = () => {
    setSearchQuery("");
    setFilterStatus("All");
    setIsFilter(false);
    setOnSearch(false);
  };

  // Handle archive
  const archiveMutation = useMutation({
    mutationFn: async (file: RecordFileView) => {
      const url = buildApiUrl(`/api/record-file-views/${file.recordsFileViewAid}/status`);
      const response = await fetch(url, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          isActive: false,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to archive file");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/record-file-views"] });
    },
  });

  const handleArchive = (file: RecordFileView) => {
    if (confirm(`Are you sure you want to archive "${file.recordsFileViewName}"?`)) {
      archiveMutation.mutate(file);
    }
  };

  // Handle restore
  const restoreMutation = useMutation({
    mutationFn: async (file: RecordFileView) => {
      const url = buildApiUrl(`/api/record-file-views/${file.recordsFileViewAid}/status`);
      const response = await fetch(url, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          isActive: true,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to restore file");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/record-file-views"] });
    },
  });

  const handleRestore = (file: RecordFileView) => {
    if (confirm(`Are you sure you want to restore "${file.recordsFileViewName}"?`)) {
      restoreMutation.mutate(file);
    }
  };

  // Handle delete
  const deleteMutation = useMutation({
    mutationFn: async (file: RecordFileView) => {
      const url = buildApiUrl(`/api/record-file-views/${file.recordsFileViewAid}`);
      const response = await fetch(url, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete file");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/record-file-views"] });
    },
  });

  const handleDelete = (file: RecordFileView) => {
    if (confirm(`Are you sure you want to delete "${file.recordsFileViewName}"? This action cannot be undone.`)) {
      deleteMutation.mutate(file);
    }
  };

  // Get file content URL from backend (uses service account authentication)
  const getFileContentUrl = (fileAid: number) => {
    return buildApiUrl(`/api/record-file-views/${fileAid}/content`);
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <CarDetailSkeleton />
      </AdminLayout>
    );
  }

  if (error || !car) {
    return (
      <AdminLayout>
        <div className="p-6 space-y-4">
          <div className="text-red-700">Failed to load car details</div>
          {error && (
            <div className="text-muted-foreground text-sm">
              {error instanceof Error ? error.message : "Unknown error occurred"}
            </div>
          )}
          {carId && (
            <Button
              onClick={() => setLocation(`/admin/cars/${carId}/records`)}
              variant="outline"
              className="border-border text-muted-foreground hover:bg-muted"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Records
            </Button>
          )}
        </div>
      </AdminLayout>
    );
  }

  if (recordError || (!record && recordId)) {
    return (
      <AdminLayout>
        <div className="p-6 space-y-4">
          <div className="text-red-700">Failed to load record details</div>
          {recordError && (
            <div className="text-muted-foreground text-sm">
              {recordError instanceof Error ? recordError.message : "Unknown error occurred"}
            </div>
          )}
          {carId && (
            <Button
              onClick={() => setLocation(`/admin/cars/${carId}/records`)}
              variant="outline"
              className="border-border text-muted-foreground hover:bg-muted"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Records
            </Button>
          )}
        </div>
      </AdminLayout>
    );
  }

  const carName = car.makeModel || "Unknown Car";
  const ownerName = car.owner
    ? `${car.owner.firstName} ${car.owner.lastName}`
    : "N/A";
  const ownerContact = car.owner?.phone || "N/A";
  const ownerEmail = car.owner?.email || "N/A";

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="mb-4">
          <button
            onClick={() => setLocation(`/admin/cars/${carId}/records`)}
            className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Records</span>
          </button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-primary">View Record Files</h1>
              {record && (
                <p className="text-sm text-muted-foreground mt-1">
                  Record: {record.recordFilesDocName}
                </p>
              )}
            </div>
            {user?.isClient !== true && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => setIsLogModalOpen(true)}
                  className="bg-card border-border text-foreground hover:bg-muted flex items-center gap-2 text-xs sm:text-sm px-2 sm:px-4"
                >
                  <List className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Log</span>
                </Button>
                <Button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setItemEdit(null);
                    setIsAddModalOpen(true);
                  }}
                  className="bg-primary text-primary-foreground hover:bg-primary/80"
                  type="button"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">Add File</span>
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Car and Owner Information Header */}
        <div className="bg-card border border-border rounded-lg p-4 sm:p-6 mb-4 sm:mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {/* Car Information */}
            <div>
              <h3 className="text-xs sm:text-sm font-medium text-muted-foreground mb-2 sm:mb-3">Car Information</h3>
              <div className="space-y-1.5 sm:space-y-2">
                <div>
                  <span className="text-muted-foreground text-xs sm:text-sm">Car Name: </span>
                  <span className="text-foreground text-xs sm:text-sm break-words">{carName}</span>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs sm:text-sm">VIN #: </span>
                  <span className="text-foreground font-mono text-xs sm:text-sm break-all">{car.vin}</span>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs sm:text-sm">License: </span>
                  <span className="text-foreground text-xs sm:text-sm">{car.licensePlate || "N/A"}</span>
                </div>
              </div>
            </div>

            {/* Owner Information */}
            <div>
              <h3 className="text-xs sm:text-sm font-medium text-muted-foreground mb-2 sm:mb-3">Owner Information</h3>
              <div className="space-y-1.5 sm:space-y-2">
                <div>
                  <span className="text-muted-foreground text-xs sm:text-sm">Name: </span>
                  {car?.clientId ? (
                    <button
                      onClick={() => setLocation(`/admin/clients/${car.clientId}`)}
                      className="text-[#B8860B] hover:text-[#9A7209] hover:underline transition-colors text-xs sm:text-sm break-words cursor-pointer font-semibold"
                    >
                      {ownerName}
                    </button>
                  ) : (
                    <span className="text-[#B8860B] text-xs sm:text-sm break-words font-semibold">{ownerName}</span>
                  )}
                </div>
                <div>
                  <span className="text-muted-foreground text-xs sm:text-sm">Contact #: </span>
                  <span className="text-foreground text-xs sm:text-sm">{ownerContact}</span>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs sm:text-sm">Email: </span>
                  <span className="text-foreground text-xs sm:text-sm break-all">{ownerEmail}</span>
                </div>
              </div>
            </div>

            {/* Record Information */}
            <div>
              <h3 className="text-xs sm:text-sm font-medium text-muted-foreground mb-2 sm:mb-3">Record Information</h3>
              <div className="space-y-1.5 sm:space-y-2">
                <div>
                  <span className="text-muted-foreground text-xs sm:text-sm">Document Name: </span>
                  <span className="text-foreground text-xs sm:text-sm break-words">{record?.recordFilesDocName || "N/A"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs sm:text-sm">Date: </span>
                  <span className="text-foreground text-xs sm:text-sm">
                    {record?.recordFilesDate ? new Date(record.recordFilesDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : "N/A"}
                  </span>
                </div>
                {record?.recordFilesGdrive && (
                  <div>
                    <span className="text-muted-foreground text-xs sm:text-sm">Google Drive: </span>
                    <a
                      href={`https://drive.google.com/drive/folders/${record.recordFilesGdrive}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-700 hover:underline text-xs sm:text-sm flex items-center gap-1 inline"
                    >
                      Open Folder
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Files Section */}
        <div className="bg-card border border-border rounded-lg overflow-hidden" style={{ overflowY: 'auto' }}>
          <div className="p-4 sm:p-6">
            <h2 className="text-xl font-semibold text-foreground mb-4 sm:mb-6">Files</h2>
            
            {/* Filter, Items Per Page, and Search */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4 sm:mb-6">
              <div className="flex flex-wrap items-center gap-4">
                <Select value={filterStatus} onValueChange={handleFilterChange}>
                  <SelectTrigger className="bg-card border-border text-foreground w-[120px]">
                    <SelectValue placeholder="Filter" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border text-foreground">
                    <SelectItem value="All">All</SelectItem>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>

                <div className="flex items-center gap-2">
                  <List className="w-4 h-4 text-muted-foreground" />
                  <Select
                    value={itemsPerPage.toString()}
                    onValueChange={(value) => setItemsPerPage(parseInt(value) as 10 | 20 | 50)}
                  >
                    <SelectTrigger className="bg-card border-border text-foreground w-[80px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border text-foreground">
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex-1 sm:max-w-md w-full">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Q Search here..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleSearch();
                        }
                      }}
                      className="pl-10 bg-card border-border text-foreground placeholder:text-gray-600 h-9"
                    />
                  </div>
                  <Button
                    onClick={handleSearch}
                    className="bg-primary text-primary-foreground hover:bg-primary/80 h-9"
                  >
                    <Search className="w-4 h-4" />
                  </Button>
                  {(isFilter || onSearch) && (
                    <Button
                      onClick={handleClear}
                      variant="ghost"
                      className="ml-2 text-muted-foreground hover:text-foreground underline h-9"
                    >
                      Clear
                    </Button>
                  )}
                </div>
              </div>

              {/* View Mode Toggle and File Count */}
              <div className="flex items-center gap-3">
                {totalFiles > 0 && (
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Folder className="w-4 h-4" />
                    <span>{Number.isNaN(totalFiles) ? 0 : totalFiles}</span>
                  </div>
                )}
                <div className="flex items-center gap-1 bg-card border border-border rounded p-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setViewMode("list")}
                    className={`h-7 px-2 ${viewMode === "list" ? "bg-muted text-primary" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    <List className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setViewMode("grid")}
                    className={`h-7 px-2 ${viewMode === "grid" ? "bg-muted text-primary" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    <Grid3x3 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Files Display - List or Grid View */}
            {recordsError ? (
              <div className="text-center text-red-700 py-12">
                <div className="mb-2">Error loading files.</div>
                <div className="text-sm text-muted-foreground">
                  {recordsError instanceof Error ? recordsError.message : "Please try again."}
                </div>
              </div>
            ) : !record?.recordFilesGdrive ? (
              <div className="text-center text-muted-foreground py-12">
                <div className="mb-2">No Google Drive Folder ID</div>
                <div className="text-sm text-muted-foreground">
                  This record does not have a Google Drive folder ID. Files cannot be displayed until a folder ID is assigned.
                </div>
              </div>
            ) : (status === "pending" || isFetching) ? (
              <div className="text-center text-muted-foreground py-12">
                Loading...
              </div>
            ) : files.length > 0 ? (
              viewMode === "grid" ? (
                // Grid View with Image Thumbnails
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {files.map((file: RecordFileView, index: number) => {
                    const fileNumber = startIndex + index + 1;
                    // Use backend endpoint for authenticated file access
                    const fileContentUrl = getFileContentUrl(file.recordsFileViewAid);
                    
                    return (
                      <div
                        key={file.recordsFileViewAid}
                        className="bg-card border border-border rounded-lg overflow-hidden hover:border-primary/50 transition-colors group"
                      >
                        {/* Image Thumbnail */}
                        <div className="relative aspect-square bg-card overflow-hidden">
                          <button
                            onClick={() => {
                              setViewingFile(file);
                              setIsViewerModalOpen(true);
                            }}
                            className="block w-full h-full cursor-pointer"
                          >
                            {imageUrls.has(file.recordsFileViewAid) ? (
                              <img
                                src={imageUrls.get(file.recordsFileViewAid)}
                                alt={file.recordsFileViewName}
                                className="w-full h-full object-contain"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  // Final fallback to placeholder
                                  target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Crect fill='%231a1a1a' width='200' height='200'/%3E%3Ctext fill='%23ffffff' font-family='Arial' font-size='14' x='50%25' y='50%25' text-anchor='middle' dy='.3em'%3ENo Preview%3C/text%3E%3C/svg%3E";
                                }}
                              />
                            ) : imageErrors.has(file.recordsFileViewAid) ? (
                              <div className="w-full h-full flex items-center justify-center bg-card">
                                <span className="text-muted-foreground text-sm">No Preview</span>
                              </div>
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-card">
                                <span className="text-muted-foreground text-sm animate-pulse">Loading...</span>
                              </div>
                            )}
                          </button>
                          {/* File Number Badge */}
                          <div className="absolute top-2 left-2 bg-primary text-primary-foreground text-xs font-semibold px-2 py-1 rounded">
                            {fileNumber}
                          </div>
                          {/* Action Buttons Overlay */}
                          {file.recordsFileViewIsActive && (
                            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => {
                                  setViewingFile(file);
                                  setIsViewerModalOpen(true);
                                }}
                                className="bg-card/90 hover:bg-muted p-1.5 rounded text-foreground"
                                title="View"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <a
                                href={fileContentUrl}
                                download={file.recordsFileViewName}
                                className="bg-card/90 hover:bg-muted p-1.5 rounded text-foreground"
                                title="Download"
                              >
                                <Download className="w-4 h-4" />
                              </a>
                              <button
                                onClick={() => {
                                  setItemEdit(file);
                                  setIsAddModalOpen(true);
                                }}
                                className="bg-card/90 hover:bg-muted p-1.5 rounded text-foreground"
                                title="Edit"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleArchive(file)}
                                className="bg-card/90 hover:bg-yellow-500/90 p-1.5 rounded text-foreground"
                                title="Archive"
                              >
                                <Archive className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                          {!file.recordsFileViewIsActive && (
                            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => handleRestore(file)}
                                className="bg-card/90 hover:bg-green-500/90 p-1.5 rounded text-foreground"
                                title="Restore"
                              >
                                <History className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(file)}
                                className="bg-card/90 hover:bg-red-500/90 p-1.5 rounded text-foreground"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </div>
                        {/* File Name */}
                        <div className="p-3 border-t border-border">
                          <p className="text-foreground text-sm truncate" title={file.recordsFileViewName}>
                            {file.recordsFileViewName}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                // List View (Table)
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border">
                        <TableHead className="text-center text-foreground font-medium w-16">#</TableHead>
                        <TableHead className="text-foreground font-medium">File Name</TableHead>
                        <TableHead className="text-foreground font-medium">Upload Date</TableHead>
                        <TableHead className="text-foreground font-medium">Status</TableHead>
                        <TableHead className="text-foreground font-medium">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {files.map((file: RecordFileView, index: number) => (
                        <TableRow
                          key={file.recordsFileViewAid}
                          className="border-border hover:bg-card transition-colors"
                        >
                          <TableCell className="text-center text-muted-foreground">
                            {startIndex + index + 1}
                          </TableCell>
                          <TableCell className="text-foreground">{file.recordsFileViewName}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {file.recordsFileViewCreated ? new Date(file.recordsFileViewCreated).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : "N/A"}
                          </TableCell>
                          <TableCell>
                            <Badge variant={file.recordsFileViewIsActive ? "default" : "secondary"} className="mr-2">
                              {file.recordsFileViewIsActive ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {file.recordsFileViewIsActive && (
                                <>
                                  <button
                                    onClick={() => {
                                      setViewingFile(file);
                                      setIsViewerModalOpen(true);
                                    }}
                                    className="text-muted-foreground hover:text-primary transition-colors"
                                    title="View"
                                  >
                                    <Eye className="w-5 h-5" />
                                  </button>
                                  <a
                                    href={getFileContentUrl(file.recordsFileViewAid)}
                                    download={file.recordsFileViewName}
                                    className="text-muted-foreground hover:text-blue-700 transition-colors"
                                    title="Download"
                                  >
                                    <Download className="w-5 h-5" />
                                  </a>
                                  <button
                                    onClick={() => {
                                      setItemEdit(file);
                                      setIsAddModalOpen(true);
                                    }}
                                    className="text-muted-foreground hover:text-primary transition-colors"
                                    aria-label="Edit file"
                                  >
                                    <Edit className="w-5 h-5" />
                                  </button>
                                  <button
                                    onClick={() => handleArchive(file)}
                                    className="text-muted-foreground hover:text-yellow-700 transition-colors"
                                    aria-label="Archive file"
                                    title="Archive"
                                  >
                                    <Archive className="w-5 h-5" />
                                  </button>
                                </>
                              )}
                              {!file.recordsFileViewIsActive && (
                                <>
                                  <button
                                    onClick={() => handleRestore(file)}
                                    className="text-muted-foreground hover:text-green-700 transition-colors"
                                    aria-label="Restore file"
                                    title="Restore"
                                  >
                                    <History className="w-5 h-5" />
                                  </button>
                                  <button
                                    onClick={() => handleDelete(file)}
                                    className="text-muted-foreground hover:text-red-700 transition-colors"
                                    aria-label="Delete file"
                                    title="Delete"
                                  >
                                    <Trash2 className="w-5 h-5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )
            ) : (
              <div className="text-center text-muted-foreground py-12">
                No files found
              </div>
            )}

            {/* Pagination Controls */}
            {totalFiles > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 pt-4 border-t border-border">
                <div className="text-sm text-muted-foreground">
                  Showing {Number.isNaN(startIndex) ? 0 : startIndex + 1} to {Number.isNaN(endIndex) ? 0 : endIndex} of {Number.isNaN(totalFiles) ? 0 : totalFiles} files
                </div>
                
                {totalPages > 1 && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                      disabled={currentPage === 1 || isFetching}
                      className="bg-card border-border text-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span className="hidden sm:inline">Previous</span>
                    </Button>

                    <div className="flex items-center gap-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                        const showPage =
                          page === 1 ||
                          page === totalPages ||
                          (page >= currentPage - 1 && page <= currentPage + 1);

                        if (!showPage) {
                          if (page === currentPage - 2 || page === currentPage + 2) {
                            return (
                              <span key={page} className="text-muted-foreground px-2">
                                ...
                              </span>
                            );
                          }
                          return null;
                        }

                        return (
                          <Button
                            key={page}
                            variant={currentPage === page ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentPage(page)}
                            disabled={isFetching}
                            className={
                              currentPage === page
                                ? "bg-primary text-primary-foreground hover:bg-primary/80"
                                : "bg-card border-border text-foreground hover:bg-muted"
                            }
                          >
                            {page}
                          </Button>
                        );
                      })}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages || isFetching}
                      className="bg-card border-border text-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span className="hidden sm:inline">Next</span>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* End of list message */}
            {currentPage >= totalPages && files.length > 0 && !isFetching && status !== "pending" && (
              <div className="text-center mt-6 text-muted-foreground text-sm">
                End of list.
              </div>
            )}

            {totalFiles === 0 && !isFetching && status !== "pending" && (
              <div className="text-center mt-6 text-muted-foreground text-sm">
                No files found matching your search criteria.
              </div>
            )}
          </div>
        </div>
      </div>


      {/* Add/Edit File Modal */}
      {isAddModalOpen && carId && recordId && (
        <RecordFileViewModal
          isOpen={isAddModalOpen}
          onClose={() => {
            setIsAddModalOpen(false);
            setItemEdit(null);
          }}
          carId={carId}
          recordId={recordId}
          folderId={record?.recordFilesGdrive || ""}
          itemEdit={itemEdit}
        />
      )}

      {/* File Viewer Modal */}
      {isViewerModalOpen && viewingFile && (
        <FileViewerModal
          isOpen={isViewerModalOpen}
          onClose={() => {
            setIsViewerModalOpen(false);
            setViewingFile(null);
          }}
          file={viewingFile}
        />
      )}

      {/* Log Modal */}
      {isLogModalOpen && carId && (
        <RecordFilesLogModal
          isOpen={isLogModalOpen}
          onClose={() => setIsLogModalOpen(false)}
          carId={carId}
          carBacklogPage="records-and-files-view"
        />
      )}
      <AdminPageLinks />
    </AdminLayout>
  );
}

