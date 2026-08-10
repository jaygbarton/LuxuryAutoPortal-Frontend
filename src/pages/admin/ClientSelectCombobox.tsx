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

interface ClientOption {
  id: number | string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
}

interface ClientSelectComboboxProps {
  clients: ClientOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

function displayName(c: ClientOption): string {
  return (
    `${c.firstName || ""} ${c.lastName || ""}`.trim() ||
    c.email ||
    `Client #${c.id}`
  );
}

export function ClientSelectCombobox({
  clients,
  value,
  onChange,
  placeholder = "— Unassigned —",
  disabled,
}: ClientSelectComboboxProps) {
  const [open, setOpen] = useState(false);

  const sorted = [...clients].sort((a, b) =>
    displayName(a).localeCompare(displayName(b))
  );

  const selected = sorted.find((c) => String(c.id) === value);
  const label = selected ? displayName(selected) : placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between bg-card border-border text-foreground hover:bg-card hover:text-foreground font-normal"
        >
          <span className="truncate">{label}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="min-w-[220px] w-[--radix-popover-trigger-width] p-0 bg-card border-border"
        align="start"
      >
        <Command className="bg-card">
          <CommandInput
            placeholder="Search clients..."
            className="text-foreground placeholder:text-muted-foreground border-b border-border"
          />
          <CommandList className="max-h-[280px]">
            <CommandEmpty className="text-muted-foreground py-4 text-sm text-center">
              No clients found.
            </CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="__none__ unassigned"
                onSelect={() => {
                  onChange("__none__");
                  setOpen(false);
                }}
                className="text-foreground data-[selected=true]:bg-primary/20 data-[selected=true]:text-foreground cursor-pointer"
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4 shrink-0",
                    !value || value === "__none__" ? "opacity-100 text-primary" : "opacity-0"
                  )}
                />
                <span>— Unassigned —</span>
              </CommandItem>
              {sorted.map((c) => {
                const name = displayName(c);
                const isMatch = String(c.id) === value;
                return (
                  <CommandItem
                    key={c.id}
                    value={`${name} ${c.email ?? ""}`}
                    onSelect={() => {
                      onChange(String(c.id));
                      setOpen(false);
                    }}
                    className="text-foreground data-[selected=true]:bg-primary/20 data-[selected=true]:text-foreground cursor-pointer"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4 shrink-0",
                        isMatch ? "opacity-100 text-primary" : "opacity-0"
                      )}
                    />
                    <span>{name}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
