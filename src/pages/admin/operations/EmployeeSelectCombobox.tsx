/**
 * Employee picker combobox used by Operations modals (Maintenance,
 * Inspections, etc.). Searchable list of active employees; matches the look
 * and feel of CarSelectCombobox.
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { buildApiUrl } from "@/lib/queryClient";
import { ChevronsUpDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmployeeOption {
  employee_aid: number;
  employee_first_name: string | null;
  employee_last_name: string | null;
  employee_email?: string | null;
  employee_status?: string | null;
  employee_is_active?: number | null;
}

interface EmployeeSelectComboboxProps {
  /** The currently selected employee's display name (free-form). Stored on the
   *  parent so legacy rows whose assigned_to is a name without an id still
   *  render correctly. */
  value: string;
  onChange: (value: string) => void;
  /** Receive the full selected employee record (id + names) so the caller can
   *  store assigned_to_id alongside the display string. */
  onSelectEmployee?: (employee: EmployeeOption | null) => void;
  placeholder?: string;
  disabled?: boolean;
}

function displayName(e: EmployeeOption): string {
  return (
    [e.employee_first_name, e.employee_last_name].filter(Boolean).join(" ").trim() ||
    e.employee_email ||
    `Employee #${e.employee_aid}`
  );
}

export function EmployeeSelectCombobox({
  value,
  onChange,
  onSelectEmployee,
  placeholder = "Select an employee...",
  disabled,
}: EmployeeSelectComboboxProps) {
  const [open, setOpen] = useState(false);

  const { data } = useQuery<{ success: boolean; data: EmployeeOption[] }>({
    queryKey: ["/api/employees", "active-list"],
    queryFn: async () => {
      const response = await fetch(buildApiUrl("/api/employees?limit=1000"), {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch employees");
      return response.json();
    },
    staleTime: 1000 * 60 * 5,
  });

  const employees = (data?.data ?? []).filter(
    (e) => (e.employee_is_active ?? 1) === 1
  );

  // Sort alphabetically by display name for predictable scanning.
  const sorted = [...employees].sort((a, b) =>
    displayName(a).localeCompare(displayName(b))
  );

  const matchedByName = sorted.find((e) => displayName(e) === value);

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
          <span className="truncate">{value || placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0 bg-card border-border"
        align="start"
      >
        <Command className="bg-card">
          <CommandInput
            placeholder="Search employees..."
            className="text-foreground placeholder:text-muted-foreground border-b border-border"
          />
          <CommandList className="max-h-[220px]">
            <CommandEmpty className="text-muted-foreground py-4 text-sm text-center">
              No employees found.
            </CommandEmpty>
            <CommandGroup>
              {sorted.map((e) => {
                const name = displayName(e);
                const isMatch = matchedByName?.employee_aid === e.employee_aid;
                return (
                  <CommandItem
                    key={e.employee_aid}
                    value={`${name} ${e.employee_email ?? ""}`}
                    onSelect={() => {
                      onChange(name);
                      onSelectEmployee?.(e);
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
                    <span className="truncate">{name}</span>
                    {e.employee_email && (
                      <span className="ml-2 text-xs text-muted-foreground truncate">
                        {e.employee_email}
                      </span>
                    )}
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
