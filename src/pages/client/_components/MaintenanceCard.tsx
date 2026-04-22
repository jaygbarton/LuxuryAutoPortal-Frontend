import React from "react";
import { AlertCircle } from "lucide-react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ClientCar, MaintenanceRecord } from "./types";

interface MaintenanceCardProps {
  maintenanceRecords: MaintenanceRecord[];
  activeCar?: ClientCar;
}

export function MaintenanceCard({ maintenanceRecords, activeCar }: MaintenanceCardProps) {
  return (
    <Card className="border-border bg-card overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-bold uppercase text-foreground tracking-wide">
          Maintenance History
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 overflow-x-auto p-0">
        {maintenanceRecords.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow style={{ backgroundColor: "#1a1a1a" }}>
                <TableHead className="text-white font-semibold text-xs py-3">Maintenance</TableHead>
                <TableHead className="text-white font-semibold text-xs py-3">Date Completed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {maintenanceRecords.map((record, i) => (
                <TableRow key={i} className="border-border hover:bg-muted/30">
                  <TableCell className="text-sm py-2">{record.maintenanceType ?? record.type ?? "—"}</TableCell>
                  <TableCell className="text-sm py-2 text-muted-foreground">{record.dateCompleted ?? record.date_completed ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="flex flex-col items-center justify-center h-24 text-muted-foreground">
            <AlertCircle className="w-6 h-6 mb-2 opacity-40" />
            <p className="text-sm">No maintenance records found</p>
            {activeCar?.id && (
              <Link href={`/admin/cars/${activeCar.id}/maintenance`} className="text-xs text-[#d3bc8d] hover:underline mt-1">
                View full maintenance page →
              </Link>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
