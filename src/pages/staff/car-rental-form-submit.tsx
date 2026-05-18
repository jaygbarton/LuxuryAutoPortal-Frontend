import { AdminLayout } from "@/components/admin/admin-layout";
import { EmployeePageLinks } from "@/components/staff/EmployeePageLinks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText } from "lucide-react";
import { Link, useLocation, useSearch } from "wouter";
import { CarGoingOutForm } from "@/pages/staff/car-rental/CarGoingOutForm";
import { CarComingBackForm } from "@/pages/staff/car-rental/CarComingBackForm";

const FORM_NAMES: Record<string, string> = {
  "car-going-out": "Car going out for rental",
  "car-coming-back": "Car coming back from rental",
  "26": "Car going out for rental",
  "62": "Car coming back from rental",
};

function isGoingOut(formTypeId: string): boolean {
  return formTypeId === "car-going-out" || formTypeId === "26";
}

function isComingBack(formTypeId: string): boolean {
  return formTypeId === "car-coming-back" || formTypeId === "62";
}

export default function StaffCarRentalFormSubmit() {
  const search = useSearch();
  const [, setLocation] = useLocation();
  const params = new URLSearchParams(search);
  const formTypeId = params.get("formTypeId") ?? "";
  const formName = FORM_NAMES[formTypeId] ?? "Car rental form";
  const onBack = () => setLocation("/staff/car-rental/forms");

  if (!formTypeId || (!isGoingOut(formTypeId) && !isComingBack(formTypeId))) {
    return (
      <AdminLayout>
        <div className="space-y-6">
          <h1 className="text-2xl font-semibold text-primary">Submit form</h1>
          <Card className="bg-card border-border">
            <CardContent className="pt-6">
              <p className="text-muted-foreground">Unknown form type. Please choose a form from the list.</p>
              <Link href="/staff/car-rental/forms">
                <span className="text-primary hover:underline text-sm font-medium mt-2 inline-block">Back to forms</span>
              </Link>
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-primary">Submit form</h1>
          <p className="text-muted-foreground">{formName}</p>
        </div>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <FileText className="w-5 h-5" />
              {formName}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isGoingOut(formTypeId) && (
              <CarGoingOutForm onBack={onBack} />
            )}
            {isComingBack(formTypeId) && (
              <CarComingBackForm onBack={onBack} />
            )}
          </CardContent>
        </Card>
      </div>
      <EmployeePageLinks />
    </AdminLayout>
  );
}
