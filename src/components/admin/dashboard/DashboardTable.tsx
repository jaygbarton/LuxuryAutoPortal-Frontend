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
    <div className={cn("w-full max-w-full overflow-x-auto rounded-sm border border-[#D3BC8D]", className)}>
      <table className="w-full border-collapse" style={{ minWidth: `${Math.max(480, columns.length * 110)}px` }}>
        <thead>
          <tr className="bg-black border-b border-[#D3BC8D]">
            {columns.map((col) => (
              <th
                key={col.key}
                className="px-3 py-2 text-center text-xs font-bold uppercase text-white whitespace-nowrap border-r border-[#D3BC8D] last:border-r-0"
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
              className="bg-white border-b border-[#D3BC8D] last:border-b-0"
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className="px-3 py-2 text-center text-sm text-gray-900 whitespace-nowrap border-r border-[#D3BC8D] last:border-r-0"
                >
                  {row[col.key]}
                </td>
              ))}
            </tr>
          ))}
          {totalsRow && (
            <tr className="bg-[#D3BC8D] font-bold border-t border-[#D3BC8D]">
              {columns.map((col) => (
                <td
                  key={col.key}
                  className="px-3 py-2 text-center text-sm text-black border-r border-black/10 last:border-r-0"
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
