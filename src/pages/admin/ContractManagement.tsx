import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  TablePagination,
  ItemsPerPage,
} from "@/components/ui/table-pagination";
import { useToast } from "@/hooks/use-toast";
import { buildApiUrl } from "@/lib/queryClient";
import { Search, Loader2, Eye, ExternalLink, Send, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ContractSubmission {
  id: number;
  firstNameOwner: string;
  lastNameOwner: string;
  emailOwner: string;
  phoneOwner: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: string;
  vinNumber: string | null;
  licensePlate: string | null;
  createdAt: string;
  status: "pending" | "approved" | "rejected";
  contractStatus: "pending" | "sent" | "opened" | "signed" | "declined" | null;
  contractSignedAt: string | null;
  signedContractUrl: string | null;
  isOffboarded: boolean;
  carOffboardAt: string | null;
  carOffboardReason: string | null;
}

export default function ContractManagement() {
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<ItemsPerPage>(() => {
    const saved = localStorage.getItem("contracts_limit");
    return (saved ? parseInt(saved) : 10) as ItemsPerPage;
  });

  useEffect(() => {
    localStorage.setItem("contracts_limit", itemsPerPage.toString());
  }, [itemsPerPage]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery]);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: contractsData, isLoading, error } = useQuery<{
    success: boolean;
    data: ContractSubmission[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }>({
    queryKey: ["lyc-contracts", searchQuery, page, itemsPerPage],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: itemsPerPage.toString(),
  });
      if (searchQuery) {
        params.append("search", searchQuery);
      }
      const response = await fetch(
        buildApiUrl(`/api/contracts/lyc?${params.toString()}`),
        {
        credentials: "include",
        }
      );

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: "Failed to fetch contracts" }));
        throw new Error(
          errorData.error || `Failed to fetch contracts: ${response.status}`
        );
      }

      return response.json();
    },
  });

  const resendMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(
        buildApiUrl(`/api/contracts/lyc/${id}/resend`),
        {
          method: "POST",
          credentials: "include",
        }
      );

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: "Failed to resend contract" }));
        throw new Error(errorData.error || "Failed to resend contract");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lyc-contracts"] });
      toast({
        title: "Success",
        description: "Contract resent successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to resend contract",
        variant: "destructive",
      });
    },
  });

  const getContractStatusBadge = (contractStatus: string | null) => {
    // Map contract status to display values: Pending / Opened / Signed / Expired
    if (!contractStatus || contractStatus === "pending") {
      return (
        <Badge
          variant="outline"
          className="border-yellow-500/50 text-yellow-800 bg-yellow-500/20 text-xs font-semibold"
        >
          Pending
        </Badge>
      );
    }
    if (contractStatus === "sent" || contractStatus === "opened") {
      return (
        <Badge
          variant="outline"
          className="border-blue-500/50 text-blue-700 bg-blue-500/20 text-xs font-semibold"
        >
          Sent
        </Badge>
      );
    }
    if (contractStatus === "signed") {
      return (
        <Badge
          variant="outline"
          className="border-green-500/50 text-green-700 bg-green-500/20 text-xs font-semibold"
        >
          Signed
        </Badge>
      );
    }
    if (contractStatus === "declined") {
      return (
        <Badge
          variant="outline"
          className="border-red-500/50 text-red-700 bg-red-500/20 text-xs font-semibold"
        >
          Expired
        </Badge>
      );
      }
    return (
      <Badge
        variant="outline"
        className="border-yellow-500/50 text-yellow-800 bg-yellow-500/20 text-xs font-semibold"
      >
        Pending
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header with Title and Description */}
        <div>
        <h2 className="text-xl font-semibold text-foreground">LYC Contract / Agreement</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Manage LYC contracts and agreements
        </p>
      </div>

      {/* Search Bar */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            type="text"
            placeholder="Search by name, email, phone, or vehicle..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-card border-border text-foreground placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {/* Table Card */}
      <Card className="bg-card border-primary/20 overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
          ) : error ? (
            <div className="text-center py-12 text-red-700">
              <p className="mb-2">Error loading contracts</p>
              <p className="text-sm text-muted-foreground">
                {error instanceof Error ? error.message : "Unknown error"}
              </p>
            </div>
          ) : contractsData?.data && contractsData.data.length > 0 ? (
            <>
              <div className="w-full max-w-full overflow-x-auto">
                <div className="overflow-x-auto">
            <Table className="w-full table-auto">
              <TableHeader>
                    <TableRow className="border-b border-border">
                      <TableHead className="text-center text-xs font-medium text-foreground uppercase tracking-wider px-2 sm:px-3 py-3 sm:py-4 whitespace-nowrap">
                        Name
                      </TableHead>
                      <TableHead className="text-center text-xs font-medium text-primary uppercase tracking-wider px-2 sm:px-3 py-3 sm:py-4 hidden md:table-cell whitespace-nowrap">
                        Email
                      </TableHead>
                      <TableHead className="text-center text-xs font-medium text-primary uppercase tracking-wider px-2 sm:px-3 py-3 sm:py-4 hidden lg:table-cell whitespace-nowrap">
                        Phone
                      </TableHead>
                      <TableHead className="text-center text-xs font-medium text-foreground uppercase tracking-wider px-2 sm:px-3 py-3 sm:py-4 whitespace-nowrap">
                        Vehicle
                      </TableHead>
                      <TableHead className="text-center text-xs font-medium text-primary uppercase tracking-wider px-2 sm:px-3 py-3 sm:py-4 hidden xl:table-cell whitespace-nowrap">
                        VIN#
                      </TableHead>
                      <TableHead className="text-center text-xs font-medium text-primary uppercase tracking-wider px-2 sm:px-3 py-3 sm:py-4 hidden xl:table-cell whitespace-nowrap">
                        Plate #
                      </TableHead>
                      <TableHead className="text-center text-xs font-medium text-primary uppercase tracking-wider px-2 sm:px-3 py-3 sm:py-4 hidden lg:table-cell whitespace-nowrap">
                        Submitted
                      </TableHead>
                      <TableHead className="text-center text-xs font-medium text-foreground uppercase tracking-wider px-2 sm:px-3 py-3 sm:py-4 whitespace-nowrap">
                        Status
                      </TableHead>
                      <TableHead className="text-center text-xs font-medium text-primary uppercase tracking-wider px-2 sm:px-3 py-3 sm:py-4 hidden md:table-cell whitespace-nowrap">
                        Contract
                      </TableHead>
                      <TableHead className="text-center text-xs font-medium text-primary uppercase tracking-wider px-2 sm:px-3 py-3 sm:py-4 hidden 2xl:table-cell whitespace-nowrap">
                        Car Onboarding Date
                      </TableHead>
                      <TableHead className="text-center text-xs font-medium text-primary uppercase tracking-wider px-2 sm:px-3 py-3 sm:py-4 hidden 2xl:table-cell whitespace-nowrap">
                        Offboarding
                      </TableHead>
                      <TableHead className="text-center text-xs font-medium text-foreground uppercase tracking-wider px-2 sm:px-3 py-3 sm:py-4 whitespace-nowrap">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                    {contractsData.data.map((contract) => (
                  <TableRow
                    key={contract.id}
                        className={cn(
                          "border-b border-border hover:bg-card transition-colors"
                        )}
                  >
                        <TableCell className="text-center px-2 sm:px-3 py-3 sm:py-4 text-foreground text-xs sm:text-sm max-w-[120px] truncate" title={`${contract.firstNameOwner} ${contract.lastNameOwner}`}>
                          {contract.firstNameOwner} {contract.lastNameOwner}
                        </TableCell>
                        <TableCell className="text-center px-2 sm:px-3 py-3 sm:py-4 text-muted-foreground text-xs sm:text-sm hidden md:table-cell max-w-[150px] truncate" title={contract.emailOwner}>
                          {contract.emailOwner}
                    </TableCell>
                        <TableCell className="text-center px-2 sm:px-3 py-3 sm:py-4 text-muted-foreground text-xs sm:text-sm hidden lg:table-cell max-w-[120px] truncate" title={contract.phoneOwner}>
                          {contract.phoneOwner}
                    </TableCell>
                        <TableCell className="text-center px-2 sm:px-3 py-3 sm:py-4 text-muted-foreground text-xs sm:text-sm max-w-[150px] truncate" title={`${contract.vehicleMake} ${contract.vehicleModel} ${contract.vehicleYear}`}>
                          {contract.vehicleMake} {contract.vehicleModel}{" "}
                          {contract.vehicleYear}
                    </TableCell>
                        <TableCell className="text-center px-2 sm:px-3 py-3 sm:py-4 text-muted-foreground font-mono text-xs hidden xl:table-cell max-w-[120px] truncate" title={contract.vinNumber || "—"}>
                          {contract.vinNumber || (
                            <span className="text-muted-foreground">—</span>
                        )}
                    </TableCell>
                        <TableCell className="text-center px-2 sm:px-3 py-3 sm:py-4 text-muted-foreground font-mono text-xs hidden xl:table-cell max-w-[100px] truncate" title={contract.licensePlate || "—"}>
                          {contract.licensePlate || (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center px-2 sm:px-3 py-3 sm:py-4 text-muted-foreground text-xs sm:text-sm hidden lg:table-cell whitespace-nowrap">
                          {new Date(contract.createdAt).toLocaleDateString("en-US", {
                            month: "2-digit",
                            day: "2-digit",
                            year: "numeric",
                          })}
                        </TableCell>
                        <TableCell className="text-center px-2 sm:px-3 py-3 sm:py-4 whitespace-nowrap">
                          <div className="flex items-center justify-center">
                            {getContractStatusBadge(contract.contractStatus)}
                          </div>
                        </TableCell>
                        <TableCell className="text-center px-2 sm:px-3 py-3 sm:py-4 hidden md:table-cell whitespace-nowrap">
                          <div className="flex items-center justify-center gap-2">
                            {contract.contractStatus === "signed" &&
                              contract.signedContractUrl ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 bg-green-500/10 border-green-500/30 text-green-700 hover:bg-green-500/20"
                                  onClick={() => {
                                    window.open(
                                      buildApiUrl(`/api/contracts/${contract.id}/view`),
                                      "_blank");
                                  }}
                                >
                                  <ExternalLink className="w-3 h-3 mr-1" />
                                  View PDF
                                </Button>
                              ) : (
                                <span className="text-muted-foreground text-xs">
                                  {contract.contractStatus === "sent" ||
                                  contract.contractStatus === "opened"
                                    ? "Contract sent"
                                    : "Not sent"}
                                </span>
                        )}
                      </div>
                    </TableCell>
                        <TableCell className="px-2 sm:px-3 py-3 sm:py-4 text-muted-foreground text-xs sm:text-sm hidden 2xl:table-cell whitespace-nowrap">
                          {contract.contractSignedAt ? (
                            new Date(
                              contract.contractSignedAt
                            ).toLocaleDateString("en-US", {
                              month: "2-digit",
                              day: "2-digit",
                              year: "numeric",
                            })
                          ) : (
                            <span className="text-muted-foreground">Not signed</span>
                          )}
                        </TableCell>
                        <TableCell className="px-2 sm:px-3 py-3 sm:py-4 hidden 2xl:table-cell whitespace-nowrap">
                          {contract.isOffboarded ? (
                            <div className="flex flex-col gap-1">
                              <Badge
                                variant="outline"
                                className="border-red-500/50 text-red-700 bg-red-500/10 text-xs"
                              >
                                Offboarded
                              </Badge>
                              {contract.carOffboardAt && (
                                <span className="text-xs text-muted-foreground">
                                  {new Date(
                                    contract.carOffboardAt
                                  ).toLocaleDateString("en-US", {
                                    month: "2-digit",
                                    day: "2-digit",
                                    year: "numeric",
                                  })}
                                </span>
                              )}
                              {contract.carOffboardReason && (
                                <span className="text-xs text-muted-foreground capitalize">
                                  {contract.carOffboardReason.replace("_", " ")}
                                </span>
                              )}
            </div>
          ) : (
                            <Badge
                              variant="outline"
                              className="border-green-500/50 text-green-700 bg-green-500/10 text-xs"
                            >
                              Active
                            </Badge>
                          )}
                    </TableCell>
                        <TableCell className="px-6 py-4">
                      <Button
                        size="sm"
                            className="h-8 px-3 bg-primary text-primary-foreground hover:bg-primary/80"
                            onClick={() => {
                              resendMutation.mutate(contract.id);
                            }}
                            disabled={resendMutation.isPending}
                          >
                            {resendMutation.isPending ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <Send className="w-4 h-4 mr-1" />
                                Resend Contract
                              </>
                            )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
                </div>
              </div>

              {/* Pagination */}
              {contractsData.pagination && (
                <TablePagination
                  totalItems={contractsData.pagination.total}
                  itemsPerPage={itemsPerPage}
                  currentPage={page}
                  onPageChange={(newPage) => {
                    setPage(newPage);
                    window.scrollTo({
                      top: 0,
                      behavior: "smooth",
                    });
                  }}
                  onItemsPerPageChange={(newLimit) => {
                    setItemsPerPage(newLimit);
                    setPage(1);
                  }}
                  isLoading={isLoading}
                />
              )}
            </>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-lg">No records found</p>
              <p className="text-sm mt-2">
                {searchQuery
                  ? "Try adjusting your search"
                  : "No contracts found"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
