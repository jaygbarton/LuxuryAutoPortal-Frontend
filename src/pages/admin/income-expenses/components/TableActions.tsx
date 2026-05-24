import React, { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Download, Upload, FileText, History } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useIncomeExpense } from "../context/IncomeExpenseContext";
import { exportAllAsZip, importFromFileWithReceipts } from "../utils/exportImportUtils";
import { buildApiUrl } from "@/lib/queryClient";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import type { IncomeExpenseData } from "../types";

interface TableActionsProps {
  selectedYear: string;
  setSelectedYear: (year: string) => void;
  carId: number;
  car: any;
}

export default function TableActions({
  selectedYear,
  setSelectedYear,
  carId,
  car,
}: TableActionsProps) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  // Import / Export / Template only make sense when a specific car is selected.
  // carId=0 means the all-cars aggregate view — hide those actions there.
  const isReadOnly = !carId;
  const { data, monthModes, year, dynamicSubcategories, skiRacksOwner } = useIncomeExpense();
  const queryClient = useQueryClient();
  
  // Get current year and generate year options (from 2019 to current year + 2 years)
  const currentYear = new Date().getFullYear();
  const startYear = 2019;
  const endYear = currentYear + 2;
  const yearOptions = Array.from({ length: endYear - startYear + 1 }, (_, i) => startYear + i);
  
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Fetch previous year data for January's Negative Balance Carry Over calculation
  const previousYear = String(parseInt(selectedYear) - 1);
  const { data: previousYearData } = useQuery<{
    success: boolean;
    data: IncomeExpenseData;
  }>({
    queryKey: ["/api/income-expense", carId, previousYear],
    queryFn: async () => {
      const response = await fetch(
        buildApiUrl(`/api/income-expense/${carId}/${previousYear}`),
        { credentials: "include" }
      );
      if (!response.ok) {
        return { success: true, data: null as any };
      }
      return response.json();
    },
    retry: false,
    enabled: !!carId && !!selectedYear,
  });

  // Fetch previous year's dynamic subcategories separately (they might not be in the main API response)
  const { data: prevYearDynamicSubcategories } = useQuery<{
    directDelivery: any[];
    cogs: any[];
    parkingFeeLabor: any[];
    reimbursedBills: any[];
  }>({
    queryKey: ["/api/income-expense/dynamic-subcategories", carId, previousYear],
    queryFn: async () => {
      if (!carId || !previousYear) return { directDelivery: [], cogs: [], parkingFeeLabor: [], reimbursedBills: [] };
      
      const categories: Array<'directDelivery' | 'cogs' | 'parkingFeeLabor' | 'reimbursedBills'> = [
        'directDelivery',
        'cogs',
        'parkingFeeLabor',
        'reimbursedBills',
      ];
      
      const promises = categories.map(async (categoryType) => {
        try {
          const response = await fetch(
            buildApiUrl(`/api/income-expense/dynamic-subcategories/${carId}/${previousYear}/${categoryType}`),
            { credentials: "include" }
          );
          if (response.ok) {
            const result = await response.json();
            return { categoryType, data: result.data || [] };
          }
          return { categoryType, data: [] };
        } catch (error) {
          console.error(`Error fetching previous year ${categoryType} subcategories:`, error);
          return { categoryType, data: [] };
        }
      });
      
      const results = await Promise.all(promises);
      const subcategories: any = {
        directDelivery: [],
        cogs: [],
        parkingFeeLabor: [],
        reimbursedBills: [],
      };
      
      results.forEach(({ categoryType, data }) => {
        subcategories[categoryType] = data;
      });
      
      return subcategories;
    },
    retry: false,
    enabled: !!carId && !!selectedYear && !!previousYearData?.data, // Only fetch if we have previous year data
  });

  const [isExporting, setIsExporting] = useState(false);

  const handleExportCSV = async () => {
    // Merge previous year's dynamic subcategories into previousYearData if they exist
    let prevYearDataForExport = previousYearData?.data || null;
    if (prevYearDataForExport && prevYearDynamicSubcategories) {
      prevYearDataForExport = {
        ...prevYearDataForExport,
        dynamicSubcategories: prevYearDynamicSubcategories,
      };
    }
    setIsExporting(true);
    try {
      const result = await exportAllAsZip(
        data,
        car,
        selectedYear,
        monthModes,
        carId,
        dynamicSubcategories,
        prevYearDataForExport,
        skiRacksOwner,
      );
      const carName = car?.makeModel || "car";
      const receiptMsg =
        result.receiptCount > 0
          ? ` (${result.receiptCount} receipt${result.receiptCount === 1 ? "" : "s"} bundled${result.missingCount ? `, ${result.missingCount} missing` : ""})`
          : "";
      toast({
        title: "Export Successful",
        description: `ZIP downloaded for ${carName} (${selectedYear})${receiptMsg}`,
      });
    } catch (e: any) {
      toast({
        title: "Export Failed",
        description: e?.message || "Could not build the export bundle",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportFile = async () => {
    if (!importFile) {
      toast({
        title: "No File Selected",
        description: "Please select a CSV or ZIP file to import",
        variant: "destructive",
      });
      return;
    }

    setIsImporting(true);

    try {
      const result = await importFromFileWithReceipts(
        importFile,
        carId,
        parseInt(selectedYear),
      );

      // Refresh I&E data and submission receipts
      queryClient.invalidateQueries({ queryKey: ["/api/income-expense", carId, selectedYear] });
      queryClient.invalidateQueries({ queryKey: ["/api/expense-form-submissions"] });

      const receiptMsg = result.receiptCount > 0
        ? ` + ${result.receiptCount} receipt${result.receiptCount === 1 ? "" : "s"} imported`
        : "";
      toast({
        title: "Import Successful",
        description: `All data has been imported successfully${receiptMsg}.${result.warnings.length ? ` (${result.warnings.length} warning${result.warnings.length === 1 ? "" : "s"})` : ""}`,
      });

      if (result.warnings.length) {
        result.warnings.forEach((w) =>
          console.warn("[Import]", w)
        );
      }

      setIsImportModalOpen(false);
      setImportFile(null);
    } catch (error: any) {
      toast({
        title: "Import Failed",
        description: error.message || "Failed to import data",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleViewLog = () => {
    setLocation(`/admin/cars/${carId}/income-expense/log`);
  };

  const handleDownloadTemplate = () => {
    // Read the template file content
    const templateContent = `INCOME & EXPENSES,Jan-${selectedYear.slice(-2)},Feb-${selectedYear.slice(-2)},Mar-${selectedYear.slice(-2)},Apr-${selectedYear.slice(-2)},May-${selectedYear.slice(-2)},Jun-${selectedYear.slice(-2)},Jul-${selectedYear.slice(-2)},Aug-${selectedYear.slice(-2)},Sep-${selectedYear.slice(-2)},Oct-${selectedYear.slice(-2)},Nov-${selectedYear.slice(-2)},Dec-${selectedYear.slice(-2)}
Rental Income,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00
Delivery Income,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00
Electric Prepaid Income,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00
Smoking Fines,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00
Gas Prepaid Income,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00
Ski Racks Income,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00
Miles Income,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00
Child Seat Income,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00
Coolers Income,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00
Income insurance and Client Wrecks,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00
Other Income,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00
,,,,,,,,,,,,
OPERATING EXPENSE (Direct Delivery),,,,,,,,,,,,
Category,Jan-${selectedYear.slice(-2)},Feb-${selectedYear.slice(-2)},Mar-${selectedYear.slice(-2)},Apr-${selectedYear.slice(-2)},May-${selectedYear.slice(-2)},Jun-${selectedYear.slice(-2)},Jul-${selectedYear.slice(-2)},Aug-${selectedYear.slice(-2)},Sep-${selectedYear.slice(-2)},Oct-${selectedYear.slice(-2)},Nov-${selectedYear.slice(-2)},Dec-${selectedYear.slice(-2)}
Labor - Cleaning,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00
Labor - Delivery,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00
Parking - Airport,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00
Parking - Lot,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00
Uber/Lyft/Lime,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00
,,,,,,,,,,,,
OPERATING EXPENSE (COGS - Per Vehicle),Jan-${selectedYear.slice(-2)},Feb-${selectedYear.slice(-2)},Mar-${selectedYear.slice(-2)},Apr-${selectedYear.slice(-2)},May-${selectedYear.slice(-2)},Jun-${selectedYear.slice(-2)},Jul-${selectedYear.slice(-2)},Aug-${selectedYear.slice(-2)},Sep-${selectedYear.slice(-2)},Oct-${selectedYear.slice(-2)},Nov-${selectedYear.slice(-2)},Dec-${selectedYear.slice(-2)}
Auto Body Shop / Wreck,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00
Alignment,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00
Battery,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00
Brakes,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00
Car Payment,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00
Car Insurance,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00
Car Seats,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00
Cleaning Supplies / Tools,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00
Emissions,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00
GPS System,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00
Key & Fob,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00
Labor - Cleaning,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00
License & Registration,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00
Mechanic,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00
Oil/Lube,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00
Parts,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00
Ski Racks,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00
Tickets & Tolls,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00
Tired Air Station,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00
Tires,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00
Towing / Impound Fees,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00
Uber/Lyft/Lime,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00
Windshield,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00
Wipers,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00
,,,,,,,,,,,,
PARKING FEE & LABOR CLEANING,Jan-${selectedYear.slice(-2)},Feb-${selectedYear.slice(-2)},Mar-${selectedYear.slice(-2)},Apr-${selectedYear.slice(-2)},May-${selectedYear.slice(-2)},Jun-${selectedYear.slice(-2)},Jul-${selectedYear.slice(-2)},Aug-${selectedYear.slice(-2)},Sep-${selectedYear.slice(-2)},Oct-${selectedYear.slice(-2)},Nov-${selectedYear.slice(-2)},Dec-${selectedYear.slice(-2)}
GLA Parking Fee,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00
Labor - Cleaning,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00
,,,,,,,,,,,,
REIMBURSE AND NON-REIMBURSE BILLS,Jan-${selectedYear.slice(-2)},Feb-${selectedYear.slice(-2)},Mar-${selectedYear.slice(-2)},Apr-${selectedYear.slice(-2)},May-${selectedYear.slice(-2)},Jun-${selectedYear.slice(-2)},Jul-${selectedYear.slice(-2)},Aug-${selectedYear.slice(-2)},Sep-${selectedYear.slice(-2)},Oct-${selectedYear.slice(-2)},Nov-${selectedYear.slice(-2)},Dec-${selectedYear.slice(-2)}
Electric - Reimbursed,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00
Electric - Not Reimbursed,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00
Gas - Reimbursed,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00
Gas - Not Reimbursed,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00
Gas - Service Run,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00
Parking Airport,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00
Uber/Lyft/Lime - Not Reimbursed,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00
Uber/Lyft/Lime - Reimbursed,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00,$0.00
,,,,,,,,,,,,
HISTORY,Jan-${selectedYear.slice(-2)},Feb-${selectedYear.slice(-2)},Mar-${selectedYear.slice(-2)},Apr-${selectedYear.slice(-2)},May-${selectedYear.slice(-2)},Jun-${selectedYear.slice(-2)},Jul-${selectedYear.slice(-2)},Aug-${selectedYear.slice(-2)},Sep-${selectedYear.slice(-2)},Oct-${selectedYear.slice(-2)},Nov-${selectedYear.slice(-2)},Dec-${selectedYear.slice(-2)}
Days Rented,0,0,0,0,0,0,0,0,0,0,0,0
Cars Available For Rent,10,1,1,1,1,1,1,1,1,1,1,1
Trips Taken,0,0,0,0,0,0,0,0,0,0,0,0`;

    const blob = new Blob([templateContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    const fileName = `Income and Expenses Import Template ${selectedYear}.csv`;
    
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Template Downloaded",
      description: `Template file downloaded for ${selectedYear}`,
    });
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
        {/* Year Selector */}
        <Select value={selectedYear} onValueChange={setSelectedYear}>
          <SelectTrigger className="w-full sm:w-[120px] bg-card border-border text-foreground text-sm">
            <SelectValue placeholder="Year" />
          </SelectTrigger>
          <SelectContent className="bg-card border-border text-foreground">
            {yearOptions.map((yr) => (
              <SelectItem key={yr} value={String(yr)}>
                {yr}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Import Button */}
        {!isReadOnly && (
          <Button
            onClick={() => setIsImportModalOpen(true)}
            variant="outline"
            size="sm"
            className="border-border text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <Upload className="w-4 h-4 mr-2" />
            Import
          </Button>
        )}

        {/* Download Template Button */}
        {!isReadOnly && (
          <Button
            onClick={handleDownloadTemplate}
            variant="outline"
            size="sm"
            className="border-border text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <FileText className="w-4 h-4 mr-2" />
            Download Template
          </Button>
        )}

        {/* Export Button — bundles CSV + receipts into a ZIP. */}
        <Button
          onClick={handleExportCSV}
          variant="outline"
          size="sm"
          className="border-border text-muted-foreground hover:text-foreground hover:bg-muted"
          disabled={isExporting}
        >
          <Download className="w-4 h-4 mr-2" />
          {isExporting ? "Exporting..." : "Export ZIP"}
        </Button>

        {/* View Log Button */}
        <Button
          onClick={handleViewLog}
          variant="outline"
          size="sm"
          className="border-border text-muted-foreground hover:text-foreground hover:bg-muted"
        >
          <History className="w-4 h-4 mr-2" />
          Log
        </Button>

      </div>

      {/* Import Modal */}
      <Dialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
        <DialogContent className="bg-card border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="text-foreground text-xl">
              Import Income and Expense Data
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Importing into: <strong className="text-foreground">{car?.makeModel || `Car #${carId}`}</strong> — Year <strong className="text-foreground">{selectedYear}</strong> (Car ID: {carId})
              <br />Upload a <strong>ZIP</strong> (exported from this app — includes receipts) or a legacy <strong>CSV</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="border-2 border-dashed border-border rounded-lg p-6">
              <input
                type="file"
                accept=".zip,.csv,application/zip,application/x-zip-compressed,text/csv"
                onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                className="w-full text-sm text-muted-foreground
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-md file:border-0
                  file:text-sm file:font-semibold
                  file:bg-primary file:text-primary-foreground
                  hover:file:bg-primary/90 file:cursor-pointer"
              />
              {importFile && (
                <p className="text-sm text-muted-foreground mt-2">
                  Selected: {importFile.name}
                </p>
              )}
            </div>

            <div className="bg-card border border-border rounded-lg p-4">
              <h4 className="text-foreground font-medium mb-2">What will be imported:</h4>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Car Management Owner Split (with mode settings)</li>
                <li>Income &amp; Expenses (all income categories)</li>
                <li>Operating Expense (Direct Delivery)</li>
                <li>Operating Expense (COGS – Per Vehicle)</li>
                <li>Parking Fee &amp; Labor Cleaning</li>
                <li>Reimburse and Non-Reimburse Bills</li>
                <li>History (days rented, trips, etc.)</li>
                <li className="font-medium text-foreground">Receipt images (ZIP only — click-to-view preserved)</li>
              </ul>
              <p className="text-yellow-700 text-xs mt-3">
                ⚠️ This will overwrite all data for the selected year.
              </p>
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              onClick={() => {
                setIsImportModalOpen(false);
                setImportFile(null);
              }}
              variant="outline"
              className="flex-1 border-border text-muted-foreground hover:text-foreground hover:bg-muted"
              disabled={isImporting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleImportFile}
              className="flex-1 bg-primary text-primary-foreground hover:bg-primary/80"
              disabled={!importFile || isImporting}
            >
              {isImporting ? "Importing..." : "Import Data"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
