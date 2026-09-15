/**
 * Searchable car-picker combobox used by the operations incident modals
 * (ticket violation, towing & impound, ...) to select a car by name, plate,
 * or VIN from a fleet list.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { ChevronsUpDown, Check } from "lucide-react";

export interface CarComboboxOption {
  id: number;
  label: string;
}

export function CarComboboxField({
  cars,
  value,
  onChange,
}: {
  cars: CarComboboxOption[];
  value: string;
  onChange: (carId: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between bg-card border-border text-foreground hover:bg-card hover:text-foreground font-normal"
        >
          <span className="truncate">
            {value ? cars.find((c) => String(c.id) === value)?.label || "Select a car" : "Select a car"}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0 bg-card border-border" align="start">
        <Command className="bg-card">
          <CommandInput
            placeholder="Search by name, plate, or VIN…"
            className="text-foreground placeholder:text-muted-foreground border-b border-border"
          />
          <CommandList className="max-h-[220px]">
            <CommandEmpty className="text-muted-foreground py-4 text-sm text-center px-2">
              No cars found.
            </CommandEmpty>
            <CommandGroup>
              {cars.map((c) => (
                <CommandItem
                  key={c.id}
                  value={c.label}
                  onSelect={() => {
                    onChange(String(c.id));
                    setOpen(false);
                  }}
                  className="text-foreground data-[selected=true]:bg-primary/20 data-[selected=true]:text-foreground cursor-pointer"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4 shrink-0",
                      value === String(c.id) ? "opacity-100 text-primary" : "opacity-0",
                    )}
                  />
                  {c.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
