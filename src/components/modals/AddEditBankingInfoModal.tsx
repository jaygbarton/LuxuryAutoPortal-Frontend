import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { buildApiUrl } from "@/lib/queryClient";

interface BankingInfo {
  banking_info_aid: number;
  banking_info_client_id: number;
  banking_info_car_id: number | null;
  banking_info_bank_name: string;
  banking_info_routing_number: string;
  banking_info_account_number: string;
  banking_info_tax_classification: string;
  banking_info_ssn: string;
  banking_info_ein: string;
  banking_info_business_name: string;
  banking_info_is_default: number;
  car_make_model?: string;
  car_year?: number;
  car_license_plate?: string;
  car_vin?: string;
}

interface Car {
  id: number;
  makeModel: string;
  year?: number;
  licensePlate?: string;
  vin?: string;
}

interface AddEditBankingInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: number;
  bankingInfo?: BankingInfo | null;
  cars: Car[];
}

export function AddEditBankingInfoModal({
  isOpen,
  onClose,
  clientId,
  bankingInfo,
  cars,
}: AddEditBankingInfoModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEdit = !!bankingInfo;

  // Form state
  const [carId, setCarId] = useState<string>("none");
  const [bankName, setBankName] = useState("");
  const [routingNumber, setRoutingNumber] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [taxClassification, setTaxClassification] = useState("");
  const [ssn, setSsn] = useState("");
  const [ein, setEin] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [isDefault, setIsDefault] = useState(false);

  // Initialize form with existing data when editing
  useEffect(() => {
    if (bankingInfo) {
      setCarId(
        bankingInfo.banking_info_car_id
          ? String(bankingInfo.banking_info_car_id)
          : "none"
      );
      setBankName(bankingInfo.banking_info_bank_name || "");
      setRoutingNumber(bankingInfo.banking_info_routing_number || "");
      setAccountNumber(bankingInfo.banking_info_account_number || "");
      setTaxClassification(bankingInfo.banking_info_tax_classification || "");
      setSsn(bankingInfo.banking_info_ssn || "");
      setEin(bankingInfo.banking_info_ein || "");
      setBusinessName(bankingInfo.banking_info_business_name || "");
      setIsDefault(bankingInfo.banking_info_is_default === 1);
    } else {
      // Reset form for new entry
      setCarId("none");
      setBankName("");
      setRoutingNumber("");
      setAccountNumber("");
      setTaxClassification("");
      setSsn("");
      setEin("");
      setBusinessName("");
      setIsDefault(false);
    }
  }, [bankingInfo, isOpen]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch(buildApiUrl("/api/clients/banking-info"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create banking information");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId] });
      queryClient.invalidateQueries({
        queryKey: [`/api/clients/${clientId}/banking-info`],
      });
      toast({
        title: "Success",
        description: "Banking information created successfully",
      });
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch(
        buildApiUrl(`/api/clients/banking-info/${bankingInfo?.banking_info_aid}`),
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
          credentials: "include",
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update banking information");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId] });
      queryClient.invalidateQueries({
        queryKey: [`/api/clients/${clientId}/banking-info`],
      });
      toast({
        title: "Success",
        description: "Banking information updated successfully",
      });
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!bankName.trim()) {
      toast({
        title: "Validation Error",
        description: "Bank name is required",
        variant: "destructive",
      });
      return;
    }

    if (!routingNumber.trim()) {
      toast({
        title: "Validation Error",
        description: "Routing number is required",
        variant: "destructive",
      });
      return;
    }

    if (!accountNumber.trim()) {
      toast({
        title: "Validation Error",
        description: "Account number is required",
        variant: "destructive",
      });
      return;
    }

    const data = {
      banking_info_client_id: clientId,
      banking_info_car_id: carId && carId !== "none" ? parseInt(carId) : null,
      banking_info_bank_name: bankName,
      banking_info_routing_number: routingNumber,
      banking_info_account_number: accountNumber,
      banking_info_tax_classification: taxClassification,
      banking_info_ssn: ssn,
      banking_info_ein: ein,
      banking_info_business_name: businessName,
      banking_info_is_default: isDefault ? 1 : 0,
    };

    if (isEdit) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-background border-border text-foreground max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[#D3BC8D]">
            {isEdit ? "Edit Banking Information" : "Add Banking Information"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Car Selection */}
          <div>
            <Label htmlFor="car" className="text-muted-foreground">
              Associated Car (Optional)
            </Label>
            <Select value={carId} onValueChange={setCarId}>
              <SelectTrigger className="bg-card border-border text-foreground">
                <SelectValue placeholder="Default (No specific car)" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border text-foreground">
                <SelectItem value="none">Default (No specific car)</SelectItem>
                {cars.map((car) => (
                  <SelectItem key={car.id} value={String(car.id)}>
                    {car.makeModel}{" "}
                    {car.year && `${car.year}`}
                    {car.licensePlate && ` - #${car.licensePlate}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Bank Name */}
          <div>
            <Label htmlFor="bankName" className="text-muted-foreground">
              Bank Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="bankName"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              className="bg-card border-border text-foreground"
              placeholder="Enter bank name"
              required
            />
          </div>

          {/* Routing Number */}
          <div>
            <Label htmlFor="routingNumber" className="text-muted-foreground">
              Routing Number <span className="text-red-500">*</span>
            </Label>
            <Input
              id="routingNumber"
              value={routingNumber}
              onChange={(e) => setRoutingNumber(e.target.value)}
              className="bg-card border-border text-foreground font-mono"
              placeholder="Enter routing number"
              required
            />
          </div>

          {/* Account Number */}
          <div>
            <Label htmlFor="accountNumber" className="text-muted-foreground">
              Account Number <span className="text-red-500">*</span>
            </Label>
            <Input
              id="accountNumber"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              className="bg-card border-border text-foreground font-mono"
              placeholder="Enter account number"
              required
            />
          </div>

          {/* Tax Classification */}
          <div>
            <Label htmlFor="taxClassification" className="text-muted-foreground">
              Tax Classification
            </Label>
            <Input
              id="taxClassification"
              value={taxClassification}
              onChange={(e) => setTaxClassification(e.target.value)}
              className="bg-card border-border text-foreground"
              placeholder="e.g., Individual, LLC, Corporation"
            />
          </div>

          {/* SSN */}
          <div>
            <Label htmlFor="ssn" className="text-muted-foreground">
              SSN
            </Label>
            <Input
              id="ssn"
              value={ssn}
              onChange={(e) => setSsn(e.target.value)}
              className="bg-card border-border text-foreground font-mono"
              placeholder="XXX-XX-XXXX"
            />
          </div>

          {/* EIN */}
          <div>
            <Label htmlFor="ein" className="text-muted-foreground">
              EIN
            </Label>
            <Input
              id="ein"
              value={ein}
              onChange={(e) => setEin(e.target.value)}
              className="bg-card border-border text-foreground font-mono"
              placeholder="XX-XXXXXXX"
            />
          </div>

          {/* Business Name */}
          <div>
            <Label htmlFor="businessName" className="text-muted-foreground">
              Business Name
            </Label>
            <Input
              id="businessName"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="bg-card border-border text-foreground"
              placeholder="Enter business name (if applicable)"
            />
          </div>

          {/* Is Default */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="isDefault"
              checked={isDefault}
              onCheckedChange={(checked) => setIsDefault(checked as boolean)}
              className="border-border"
            />
            <Label htmlFor="isDefault" className="text-muted-foreground cursor-pointer">
              Set as default banking information
            </Label>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="border-border text-muted-foreground hover:bg-card"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-primary text-primary-foreground hover:bg-primary/80"
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending
                ? isEdit
                  ? "Updating..."
                  : "Creating..."
                : isEdit
                ? "Update"
                : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

