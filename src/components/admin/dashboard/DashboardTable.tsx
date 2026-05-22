import React from "react";
import { cn } from "@/lib/utils";

/** Column definition for the dashboard table */
interface DashboardTableColumn {
  /** Key used to look up cell values from each row */
  key: string;
  /** Column header label */
  label: string;
  /** Text alignment for the column */
  align?: "left" | "right" | "center";
}

/** Props for the DashboardTable component */
interface DashboardTableProps {
  /** Column definitions */
  columns: DashboardTableColumn[];
  /** Array of row data keyed by column key */
  rows: Record<string, React.ReactNode>[];
  /** Optional totals row rendered at the bottom with bold styling */
  totalsRow?: Record<string, React.ReactNode>;
  /** Additional CSS classes */
  className?: string;
}

export function DashboardTable({
  columns,
  rows,
  totalsRow,
  className,
}: DashboardTableProps) {
  return (
    <div className={cn("w-full overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0", className)}>
      <table className="w-full border-y border-[#FFCC00] border-collapse" style={{ minWidth: `${Math.max(480, columns.length * 110)}px` }}>
        <thead>
          <tr className="bg-black border-y border-[#FFCC00]">
            {columns.map((col) => (
              <th
                key={col.key}
                className="px-3 py-2 text-center text-xs font-bold uppercase text-white whitespace-nowrap"
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr
              key={idx}
              className="bg-white border-y border-[#FFCC00]"
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className="px-3 py-2 text-center text-sm text-gray-900 whitespace-nowrap"
                >
                  {row[col.key]}
                </td>
              ))}
            </tr>
          ))}
          {totalsRow && (
            <tr className="bg-[#FFCC00] font-bold border-y border-[#FFCC00]">
              {columns.map((col) => (
                <td
                  key={col.key}
                  className="px-3 py-2 text-center text-sm text-black"
                >
                  {totalsRow[col.key]}
                </td>
              ))}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
