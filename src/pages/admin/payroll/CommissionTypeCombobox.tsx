import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { ChevronsUpDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { COMMISSION_TYPES } from "@/lib/commissionTypes";

interface CommissionTypeComboboxProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function CommissionTypeCombobox({
  value,
  onChange,
  disabled,
}: CommissionTypeComboboxProps) {
  const [open, setOpen] = useState(false);

  // Preserve a legacy/free-text value (e.g. when editing an older row) that
  // isn't in the canonical list, same as the plain <Select> did before.
  const options =
    value && !COMMISSION_TYPES.includes(value as (typeof COMMISSION_TYPES)[number])
      ? [value, ...COMMISSION_TYPES]
      : [...COMMISSION_TYPES];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between bg-card border-border text-foreground hover:bg-card hover:text-foreground font-normal"
        >
          <span className="truncate">{value || "Select type..."}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="min-w-[220px] w-[--radix-popover-trigger-width] p-0 bg-card border-border"
        align="start"
      >
        <Command className="bg-card">
          <CommandInput
            placeholder="Search or type a commission type..."
            className="text-foreground placeholder:text-muted-foreground border-b border-border"
          />
          <CommandList className="max-h-[280px]">
            <CommandEmpty className="text-muted-foreground py-4 text-sm text-center">
              No matching type.
            </CommandEmpty>
            <CommandGroup>
              {options.map((type) => (
                <CommandItem
                  key={type}
                  value={type}
                  onSelect={() => {
                    onChange(type);
                    setOpen(false);
                  }}
                  className="text-foreground data-[selected=true]:bg-primary/20 data-[selected=true]:text-foreground cursor-pointer"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4 shrink-0",
                      type === value ? "opacity-100 text-primary" : "opacity-0"
                    )}
                  />
                  <span>{type}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
