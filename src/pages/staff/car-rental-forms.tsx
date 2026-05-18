import { AdminLayout } from "@/components/admin/admin-layout";
import { EmployeePageLinks } from "@/components/staff/EmployeePageLinks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FileText } from "lucide-react";
import { Link } from "wouter";

const CAR_RENTAL_FORMS = [
  { id: "car-going-out", name: "Car going out for rental", category: "car-rental" },
  { id: "car-coming-back", name: "Car coming back from rental", category: "car-rental" },
] as const;

export default function StaffCarRentalForms() {
  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-primary">Car rental – Forms</h1>
          <p className="text-muted-foreground">Submit car rental forms (going out / coming back).</p>
        </div>

        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-primary">
              <FileText className="w-5 h-5" />
              Forms
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border border-border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">#</TableHead>
                    <TableHead>Form</TableHead>
                    <TableHead className="w-32 text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {CAR_RENTAL_FORMS.map((form, idx) => (
                    <TableRow key={form.id}>
                      <TableCell>{idx + 1}.</TableCell>
                      <TableCell className="capitalize">{form.name}</TableCell>
                      <TableCell className="text-right">
                        <Link
                          href={`/staff/car-rental/forms/submit?formTypeId=${form.id}`}
                          className="text-primary hover:underline text-sm font-medium"
                        >
                          Submit form
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Use “Submit form” to fill out the car going out or coming back from rental forms. Submission links can be wired to the backend when the form API is available.
            </p>
          </CardContent>
        </Card>
      </div>
      <EmployeePageLinks />
    </AdminLayout>
  );
}
