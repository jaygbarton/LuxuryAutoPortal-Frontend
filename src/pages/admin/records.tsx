import React, { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/admin-layout";
import { AdminPageLinks } from "@/components/admin/AdminPageLinks";
import { ClientPageLinks } from "@/components/client/ClientPageLinks";
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
import { ArrowLeft, ExternalLink, Plus, Search, Edit, Trash2, List, ChevronLeft, ChevronRight, Archive, History } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { buildApiUrl } from "@/lib/queryClient";
import { CarDetailSkeleton } from "@/components/ui/skeletons";
import { cn } from "@/lib/utils";
import { RecordFileModal } from "@/components/modals/RecordFileModal";
import { EditRecordFileModal } from "@/components/modals/EditRecordFileModal";
import { RecordFilesLogModal } from "@/components/modals/RecordFilesLogModal";

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
  turoLink?: string | null;
  adminTuroLink?: string | null;
  fuelType?: string | null;
  tireSize?: string | null;
  oilType?: string | null;
}

interface Document {
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

interface PageData {
  data: Document[];
  page: number;
  total: number;
  count: number;
}

export default function RecordsPage() {
  const [, params] = useRoute("/admin/cars/:id/records");
  const [, setLocation] = useLocation();
  const carId = params?.id ? parseInt(params.id, 10) : null;
  const [filterStatus, setFilterStatus] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [itemsPerPage, setItemsPerPage] = useState<10 | 20 | 50>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [onSearch, setOnSearch] = useState(false);
  const [isFilter, setIsFilter] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [itemEdit, setItemEdit] = useState<Document | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    type: "archive" | "restore" | "delete" | null;
    doc: Document | null;
  }>({ open: false, type: null, doc: null });
  const queryClient = useQueryClient();

  // Get user data to check role
  const { data: userData } = useQuery<{ user?: any }>({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      try {
        const response = await fetch(buildApiUrl("/api/auth/me"), { credentials: "include" });
        if (!response.ok) return { user: undefined };
        return response.json();
      } catch (error) {
        return { user: undefined };
      }
    },
    retry: false,
  });

  const user = userData?.user;
  const isClient = user?.isClient === true;

  const { data: carData, isLoading, error } = useQuery<{
    success: boolean;
    data: CarDetail;
  }>({
    queryKey: ["/api/cars", carId],
    queryFn: async () => {
      if (!carId) throw new Error("Invalid car ID");
      const url = buildApiUrl(`/api/cars/${carId}`);
      const response = await fetch(url, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch car");
      return response.json();
    },
    enabled: !!carId,
    retry: false,
  });

  const car = carData?.data;

  // Fetch onboarding data for additional car info
  const { data: onboardingData } = useQuery<{
    success: boolean;
    data: any;
  }>({
    queryKey: ["/api/onboarding/vin", car?.vin, "onboarding"],
    queryFn: async () => {
      if (!car?.vin) throw new Error("No VIN");
      const url = buildApiUrl(`/api/onboarding/vin/${encodeURIComponent(car.vin)}`);
      const response = await fetch(url, {
        credentials: "include",
      });
      if (!response.ok) {
        if (response.status === 404) {
          return { success: false, data: null };
        }
        throw new Error("Failed to fetch onboarding");
      }
      return response.json();
    },
    enabled: !!car?.vin,
    retry: false,
  });

  const onboarding = onboardingData?.success ? onboardingData?.data : null;

  // Get client ID from car - need to fetch from car table in backend
  const clientId = undefined; // Will be fetched from car table in backend

  // Reset to page 1 when filter, search, or items per page changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filterStatus, searchQuery, itemsPerPage, isFilter, onSearch]);

  // Fetch record files with pagination
  const {
    data: recordsData,
    error: recordsError,
    isFetching,
    status,
  } = useQuery<PageData>({
    queryKey: [
      "/api/record-files",
      carId || 0,
      clientId || 0,
      currentPage,
      itemsPerPage,
      onSearch,
      searchQuery,
      filterStatus,
      isFilter,
    ],
    queryFn: async (): Promise<PageData> => {
      const params = new URLSearchParams({
        carId: carId!.toString(),
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
      });

      // Client ID will be fetched from car table in backend

      if (searchQuery && searchQuery.trim() !== "") {
        params.append("searchValue", searchQuery);
      }

      if (isFilter && filterStatus !== "All") {
        params.append("isFilter", "true");
        params.append("recordFilesIsActive", filterStatus === "Active" ? "1" : "0");
      }

      const url = buildApiUrl(`/api/record-files?${params.toString()}`);
      const response = await fetch(url, {
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || errorData.message || `Failed to fetch records: ${response.statusText}`);
      }

      const result = await response.json();

      return {
        data: result.data || [],
        page: result.page || currentPage,
        total: result.total || 0,
        count: result.count || 0,
      };
    },
    enabled: !!carId && !!car,
    refetchOnWindowFocus: true,
  });

  const documents = recordsData?.data || [];
  const totalDocuments = recordsData?.total || 0;
  const totalPages = Math.ceil(totalDocuments / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + documents.length;

  // Ensure current page is valid when filtered results change
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

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

  // Archive mutation
  const archiveMutation = useMutation({
    mutationFn: async (doc: Document) => {
      const url = buildApiUrl(`/api/record-files/${doc.recordFilesAid}/status`);
      const response = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          isActive: false,
          record_files_doc_name: doc.recordFilesDocName,
          record_files_date: doc.recordFilesDate,
          record_files_remarks: doc.recordFilesRemarks,
        }),
      });
      if (!response.ok) throw new Error("Failed to archive");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/record-files"] });
    },
  });

  // Restore mutation
  const restoreMutation = useMutation({
    mutationFn: async (doc: Document) => {
      const url = buildApiUrl(`/api/record-files/${doc.recordFilesAid}/status`);
      const response = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          isActive: true,
          record_files_doc_name: doc.recordFilesDocName,
          record_files_date: doc.recordFilesDate,
          record_files_remarks: doc.recordFilesRemarks,
        }),
      });
      if (!response.ok) throw new Error("Failed to restore");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/record-files"] });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (doc: Document) => {
      const url = buildApiUrl(`/api/record-files/${doc.recordFilesAid}`);
      const response = await fetch(url, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          record_files_gdrive: doc.recordFilesGdrive,
          record_files_doc_name: doc.recordFilesDocName,
          record_files_date: doc.recordFilesDate,
          record_files_remarks: doc.recordFilesRemarks,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/record-files"] });
    },
  });

  const handleArchive = (doc: Document) => {
    setConfirmDialog({ open: true, type: "archive", doc });
  };

  const handleRestore = (doc: Document) => {
    setConfirmDialog({ open: true, type: "restore", doc });
  };

  const handleDelete = (doc: Document) => {
    setConfirmDialog({ open: true, type: "delete", doc });
  };

  const handleConfirmAction = () => {
    if (!confirmDialog.doc || !confirmDialog.type) return;

    switch (confirmDialog.type) {
      case "archive":
        archiveMutation.mutate(confirmDialog.doc);
        break;
      case "restore":
        restoreMutation.mutate(confirmDialog.doc);
        break;
      case "delete":
        deleteMutation.mutate(confirmDialog.doc);
        break;
    }

    setConfirmDialog({ open: false, type: null, doc: null });
  };

  // Reset search when cleared
  useEffect(() => {
    if (searchQuery === "") {
      setOnSearch(false);
    }
  }, [searchQuery]);

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
        <div className="flex flex-col items-center justify-center h-full">
          <p className="text-red-700">Failed to load car details</p>
          <button
            onClick={() => setLocation("/cars")}
            className="mt-4 text-blue-700 hover:underline"
          >
            ← Back to Cars
          </button>
        </div>
      </AdminLayout>
    );
  }

  const carName = car.makeModel || `${car.year || ""} ${car.vin}`.trim();
  const ownerName = car.owner
    ? `${car.owner.firstName} ${car.owner.lastName}`
    : "N/A";
  const ownerContact = car.owner?.phone || "N/A";
  const ownerEmail = car.owner?.email || "N/A";
  const fuelType = onboarding?.fuelType || car.fuelType || "N/A";
  const tireSize = onboarding?.tireSize || car.tireSize || "N/A";
  const oilType = onboarding?.oilType || car.oilType || "N/A";

  return (
    <AdminLayout>
      <div className="flex flex-col h-full overflow-x-hidden">
        {/* Header */}
        <div className="mb-4 sm:mb-6">
            <button
              onClick={() => setLocation("/cars")}
            className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 mb-2"
            >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Cars</span>
            </button>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-primary leading-tight">Records and Files</h1>
              {car && (
                <p className="text-sm text-muted-foreground mt-1">
                  Car: {car.makeModel || "Unknown Car"}
                </p>
              )}
          </div>
          {!isClient && (
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                onClick={() => {
                  setIsAddModalOpen(true);
                }}
                className="bg-card border-border text-foreground hover:bg-muted flex items-center gap-2 text-xs sm:text-sm px-2 sm:px-4 w-full sm:w-auto"
              >
                <Plus className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Add</span>
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsLogModalOpen(true)}
                className="bg-card border-border text-foreground hover:bg-muted flex items-center gap-2 text-xs sm:text-sm px-2 sm:px-4 w-full sm:w-auto"
              >
                <List className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Log</span>
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

            {/* Car Specifications & Links */}
            <div>
              <h3 className="text-xs sm:text-sm font-medium text-muted-foreground mb-2 sm:mb-3">Car Specifications & Links</h3>
              <div className="space-y-1.5 sm:space-y-2">
                <div>
                  <span className="text-muted-foreground text-xs sm:text-sm">Fuel/Gas: </span>
                  <span className="text-foreground text-xs sm:text-sm">{fuelType}</span>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs sm:text-sm">Tire Size: </span>
                  <span className="text-foreground text-xs sm:text-sm">{tireSize}</span>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs sm:text-sm">Oil Type: </span>
                  <span className="text-foreground text-xs sm:text-sm">{oilType}</span>
                </div>
                {car.turoLink && (
                  <div>
                    <span className="text-muted-foreground text-xs sm:text-sm">Turo Link: </span>
                    <a
                      href={car.turoLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-700 hover:underline text-xs sm:text-sm flex items-center gap-1 inline"
                    >
                      View Car
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
                {car.adminTuroLink && (
                  <div>
                    <span className="text-muted-foreground text-xs sm:text-sm">Admin Turo Link: </span>
                    <a
                      href={car.adminTuroLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-700 hover:underline text-xs sm:text-sm flex items-center gap-1 inline"
                    >
                      View Car
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Records And Files Section */}
        <div className="bg-card border border-border rounded-lg overflow-hidden" style={{ overflowY: 'auto' }}>
          <div className="p-4 sm:p-6">
            <h2 className="text-xl font-semibold text-foreground mb-4 sm:mb-6">Records And Files</h2>
            
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
                      className="text-muted-foreground hover:text-foreground underline h-9"
                    >
                      Clear
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Documents Table */}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-center text-foreground font-medium w-12">#</TableHead>
                    <TableHead className="text-left text-foreground font-medium">Document Name</TableHead>
                    <TableHead className="text-left text-foreground font-medium">Date</TableHead>
                    <TableHead className="text-left text-foreground font-medium">Remarks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(status === "pending" || isFetching) ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : recordsError ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-12 text-red-700">
                        <div className="mb-2">Error loading data.</div>
                        <div className="text-sm text-muted-foreground">
                          {recordsError instanceof Error ? recordsError.message : "Please try again."}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : documents.length > 0 ? (
                    documents.map((doc, index) => (
                      <TableRow
                        key={doc.recordFilesAid}
                        className="border-border hover:bg-card transition-colors"
                      >
                        <TableCell className="text-center text-muted-foreground">
                          {startIndex + index + 1}
                        </TableCell>
                        <TableCell className="text-foreground">
                          <button
                            onClick={() => {
                              setLocation(`/admin/cars/${carId}/records/${doc.recordFilesAid}/files`);
                            }}
                            className="text-primary hover:text-[#d4d570] hover:underline transition-colors text-left"
                          >
                            {doc.recordFilesDocName}
                          </button>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {doc.recordFilesDate ? (() => {
                            // Extract date string without timezone conversion
                            const dateMatch = doc.recordFilesDate.match(/(\d{4}-\d{2}-\d{2})/);
                            if (dateMatch) {
                              const [year, month, day] = dateMatch[1].split('-');
                              const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                              return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
                            }
                            // Fallback to original method if format doesn't match
                            const date = new Date(doc.recordFilesDate);
                            if (!isNaN(date.getTime())) {
                              // Use local date components to avoid timezone shift
                              const year = date.getFullYear();
                              const month = date.getMonth();
                              const day = date.getDate();
                              return new Date(year, month, day).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
                            }
                            return "N/A";
                          })() : "N/A"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge variant={doc.recordFilesIsActive ? "default" : "secondary"} className="mr-2">
                              {doc.recordFilesIsActive ? "Active" : "Inactive"}
                            </Badge>
                            <div className="flex items-center gap-1">
                              {doc.recordFilesIsActive ? (
                                <>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setItemEdit(doc);
                                      setIsEditModalOpen(true);
                                    }}
                                    className="text-muted-foreground hover:text-primary transition-colors p-1"
                                    aria-label="Edit document"
                                    title="Edit"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleArchive(doc);
                                    }}
                                    className="text-muted-foreground hover:text-yellow-700 transition-colors p-1"
                                    aria-label="Archive document"
                                    title="Archive"
                                  >
                                    <Archive className="w-4 h-4" />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRestore(doc);
                                    }}
                                    className="text-muted-foreground hover:text-green-700 transition-colors p-1"
                                    aria-label="Restore document"
                                    title="Restore"
                                  >
                                    <History className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDelete(doc);
                                    }}
                                    className="text-muted-foreground hover:text-red-700 transition-colors p-1"
                                    aria-label="Delete document"
                                    title="Delete"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                        No documents found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination Controls */}
            {totalDocuments > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 pt-4 border-t border-border">
                <div className="text-sm text-muted-foreground">
                  Showing {startIndex + 1} to {endIndex} of {totalDocuments} documents
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
                        // Show first page, last page, current page, and pages around current
                        const showPage =
                          page === 1 ||
                          page === totalPages ||
                          (page >= currentPage - 1 && page <= currentPage + 1);

                        if (!showPage) {
                          // Show ellipsis
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

            {totalDocuments === 0 && !isFetching && status !== "pending" && (
              <div className="text-center mt-6 text-muted-foreground text-sm">
                No documents found matching your search criteria.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Modal */}
      {isAddModalOpen && (
        <RecordFileModal
          isOpen={isAddModalOpen}
          onClose={() => {
            setIsAddModalOpen(false);
          }}
          carId={carId!}
          clientId={clientId}
        />
      )}

      {/* Edit Modal */}
      {isEditModalOpen && itemEdit && (
        <EditRecordFileModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setItemEdit(null);
          }}
          carId={carId!}
          clientId={clientId}
          itemEdit={itemEdit}
        />
      )}

      {/* Log Modal */}
      {isLogModalOpen && carId && (
        <RecordFilesLogModal
          isOpen={isLogModalOpen}
          onClose={() => setIsLogModalOpen(false)}
          carId={carId}
          carBacklogPage="records-and-files"
        />
      )}

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog({ open, type: null, doc: null })}>
        <AlertDialogContent className="bg-card border-border text-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmDialog.type === "archive" && "Archive Record"}
              {confirmDialog.type === "restore" && "Restore Record"}
              {confirmDialog.type === "delete" && "Delete Record"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              {confirmDialog.type === "archive" && "Are you sure you want to archive this record?"}
              {confirmDialog.type === "restore" && "Are you sure you want to restore this record?"}
              {confirmDialog.type === "delete" && "Are you sure you want to delete this record? This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-card border-border text-muted-foreground hover:bg-muted">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmAction}
              className={
                confirmDialog.type === "delete"
                  ? "bg-red-500/20 text-red-700 border-red-500/50 hover:bg-red-500/30 text-foreground"
                  : confirmDialog.type === "restore"
                  ? "bg-green-600 hover:bg-green-700 text-foreground"
                  : "bg-primary text-primary-foreground hover:bg-primary/80"
              }
            >
              {confirmDialog.type === "archive" && "Archive"}
              {confirmDialog.type === "restore" && "Restore"}
              {confirmDialog.type === "delete" && "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <ClientPageLinks />
      <AdminPageLinks />
    </AdminLayout>
  );
}

