// Log page for viewing edit history of income and expenses
import React, { useState } from "react";
import { AdminLayout } from "@/components/admin/admin-layout";
import { AdminPageLinks } from "@/components/admin/AdminPageLinks";
import { useLocation, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { buildApiUrl } from "@/lib/queryClient";
import { ArrowLeft, Calendar, User, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

interface LogEntry {
  logId: number;
  carId: number;
  year: number;
  month: number;
  category: string;
  fieldName: string;
  fieldLabel: string;
  oldValue: number;
  newValue: number;
  changedBy: number;
  changedByName: string;
  changedByEmail: string;
  changedAt: string;
  remarks: string;
  ipAddress: string;
}

export default function IncomeExpenseLogPage() {
  const params = useParams();
  const carId = params.id ? parseInt(params.id) : null;
  const [, setLocation] = useLocation();
  const [selectedYear, setSelectedYear] = useState("2025");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: logData, isLoading } = useQuery<{
    success: boolean;
    data: LogEntry[];
  }>({
    queryKey: ["/api/income-expense/log", carId, selectedYear],
    queryFn: async () => {
      const response = await fetch(
        buildApiUrl(`/api/income-expense/log/${carId}/${selectedYear}`),
        { credentials: "include" }
      );
      if (!response.ok) throw new Error("Failed to fetch log");
      return response.json();
    },
    enabled: !!carId,
  });

  const logs = logData?.data || [];

  // Filter logs
  const filteredLogs = logs.filter((log) => {
    const matchesCategory = selectedCategory === "all" || log.category === selectedCategory;
    const matchesSearch =
      searchQuery === "" ||
      log.fieldLabel?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.changedByName?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getMonthName = (month: number) => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return months[month - 1] || month;
  };

  const getCategoryLabel = (category: string) => {
    const labels: { [key: string]: string } = {
      income: "Income & Expenses",
      directDelivery: "Direct Delivery",
      cogs: "COGS",
      parkingFeeLabor: "Parking Fee & Labor",
      reimbursedBills: "Reimbursed Bills",
      history: "History",
      managementSplit: "Management Split",
    };
    return labels[category] || category;
  };

  return (
    <AdminLayout>
      <div className="flex flex-col w-full h-full overflow-hidden">
        {/* Header */}
        <div className="mb-4">
          <button
            onClick={() => setLocation(`/admin/cars/${carId}/income-expense`)}
            className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Income & Expense</span>
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground leading-tight">Edit History & Log</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Track all changes made to income and expense data
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 mb-6">
          <div className="w-[150px]">
            <label className="block text-sm font-medium text-muted-foreground mb-2">Year</label>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="bg-card border-border text-foreground">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border text-foreground">
                <SelectItem value="2026">2026</SelectItem>
                <SelectItem value="2025">2025</SelectItem>
                <SelectItem value="2024">2024</SelectItem>
                <SelectItem value="2023">2023</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="w-[250px]">
            <label className="block text-sm font-medium text-muted-foreground mb-2">Category</label>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="bg-card border-border text-foreground">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border text-foreground">
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="income">Income & Expenses</SelectItem>
                <SelectItem value="directDelivery">Direct Delivery</SelectItem>
                <SelectItem value="cogs">COGS</SelectItem>
                <SelectItem value="parkingFeeLabor">Parking Fee & Labor</SelectItem>
                <SelectItem value="reimbursedBills">Reimbursed Bills</SelectItem>
                <SelectItem value="history">History</SelectItem>
                <SelectItem value="managementSplit">Management Split</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1">
            <label className="block text-sm font-medium text-muted-foreground mb-2">Search</label>
            <Input
              type="text"
              placeholder="Search by field or user..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-card border-border text-foreground"
            />
          </div>
        </div>

        {/* Log Entries */}
        <div className="flex-1 overflow-auto bg-card border border-border rounded-lg">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading history...</div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No edit history found for the selected filters
            </div>
          ) : (
            <div className="p-4 space-y-3">
              {filteredLogs.map((log) => (
                <Card key={log.logId} className="bg-card border-border transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-3 flex-wrap">
                          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-primary text-primary-foreground">
                            {getCategoryLabel(log.category)}
                          </span>
                          <span className="text-foreground font-medium truncate">
                            {log.fieldLabel || log.fieldName}
                          </span>
                          <span className="text-muted-foreground">•</span>
                          <span className="text-muted-foreground text-sm whitespace-nowrap">
                            {getMonthName(log.month)} {log.year}
                          </span>
                        </div>

                        <div className="flex items-center gap-4 text-sm mb-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">Old:</span>
                            <span className="text-red-700 font-mono">
                              ${Number(log.oldValue || 0).toFixed(2)}
                            </span>
                          </div>
                          <span className="text-muted-foreground">→</span>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">New:</span>
                            <span className="text-green-700 font-mono">
                              ${Number(log.newValue || 0).toFixed(2)}
                            </span>
                          </div>
                          <span className="text-muted-foreground">•</span>
                          <span className="text-yellow-700 font-mono">
                            Δ ${(Number(log.newValue || 0) - Number(log.oldValue || 0)).toFixed(2)}
                          </span>
                        </div>

                        {log.remarks && (
                          <div className="text-muted-foreground text-sm italic mt-2 bg-card p-2 rounded border border-border">
                            "{log.remarks}"
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col items-end text-xs text-muted-foreground ml-4 shrink-0">
                        <div className="flex items-center gap-1 mb-2">
                          <User className="w-3 h-3" />
                          <span className="whitespace-nowrap">{log.changedByName || 'Unknown'}</span>
                        </div>
                        <div className="flex items-center gap-1 mb-2">
                          <Clock className="w-3 h-3" />
                          <span className="whitespace-nowrap">{formatDate(log.changedAt)}</span>
                        </div>
                        {log.ipAddress && (
                          <div className="text-muted-foreground text-xs">
                            {log.ipAddress}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
      <AdminPageLinks />
    </AdminLayout>
  );
}
