import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { buildApiUrl } from "@/lib/queryClient";
import { ChevronsUpDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface CarOption {
  id: number;
  makeModel: string;
  licensePlate: string | null;
  vin: string;
  status: string;
  year?: number | null;
  make?: string | null;
  model?: string | null;
}

interface CarSelectComboboxProps {
  value: string;
  onChange: (value: string) => void;
  /** Optional: receive the full selected car (id + make + model + plate + year)
   *  so the caller can store the id alongside the legacy string. */
  onSelectCar?: (car: CarOption | null) => void;
  disabled?: boolean;
}

export function CarSelectCombobox({ value, onChange, onSelectCar, disabled }: CarSelectComboboxProps) {
  const [open, setOpen] = useState(false);

  const { data: carsData, isLoading, isError, error } = useQuery<{ data: CarOption[] }>({
    queryKey: ["/api/cars", "active-only"],
    queryFn: async () => {
      const response = await fetch(buildApiUrl("/api/cars?status=ACTIVE&limit=500"), { credentials: "include" });
      if (!response.ok) {
        // Surface the HTTP status so admins can see "403 Forbidden" or "401
        // Unauthorized" in the empty state instead of a silent "No cars found".
        // The most common cause of an empty list was the endpoint being
        // gated by requireAdmin while the user had switched to an Employee
        // role — fixed on the backend, but if the error returns, this makes
        // diagnosis a single glance instead of a network-tab dive.
        throw new Error(`Failed to fetch cars (${response.status})`);
      }
      return response.json();
    },
    staleTime: 1000 * 60 * 5,
    retry: false,
  });

  const activeCars = (carsData?.data || []).filter(
    (c) => c.status === "ACTIVE" || c.status === "active"
  );

  // Admin-requested standard label: "Car Name Model Year - Plate # - Vin #"
  // (e.g. "BMW X2 2026 - ABC123 - 123456789"). Year is appended to the name
  // when present; blank plate/vin segments are skipped to avoid dangling " - ".
  const formatCarLabel = (car: CarOption) => {
    const name = [car.makeModel, car.year].filter(Boolean).join(" ").trim();
    return [name, car.licensePlate?.trim(), car.vin?.trim()]
      .filter((s) => s && String(s).length > 0)
      .join(" - ");
  };

  const selectedLabel = value
    ? activeCars.find((c) => c.makeModel === value)
      ? formatCarLabel(activeCars.find((c) => c.makeModel === value)!)
      : value
    : "";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between bg-card border-border text-foreground hover:bg-card hover:text-foreground mt-1 font-normal"
        >
          <span className="truncate">{selectedLabel || "Select a car..."}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0 bg-card border-border"
        align="start"
      >
        <Command className="bg-card">
          <CommandInput
            placeholder="Search cars..."
            className="text-foreground placeholder:text-muted-foreground border-b border-border"
          />
          <CommandList className="max-h-[220px]">
            <CommandEmpty className="text-muted-foreground py-4 text-sm text-center px-2">
              {isLoading
                ? "Loading cars…"
                : isError
                  ? `Couldn't load cars — ${error instanceof Error ? error.message : "unknown error"}. Try refreshing or check your account permissions.`
                  : "No cars found."}
            </CommandEmpty>
            <CommandGroup>
              {activeCars.map((car) => (
                <CommandItem
                  key={car.id}
                  value={formatCarLabel(car)}
                  onSelect={() => {
                    onChange(car.makeModel);
                    onSelectCar?.(car);
                    setOpen(false);
                  }}
                  className="text-foreground data-[selected=true]:bg-primary/20 data-[selected=true]:text-foreground cursor-pointer"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4 shrink-0",
                      value === car.makeModel ? "opacity-100 text-primary" : "opacity-0"
                    )}
                  />
                  {formatCarLabel(car)}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
