import { AdminLayout } from "@/components/admin/admin-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Users } from "lucide-react";
import { useLocation } from "wouter";

export default function HumanResourcesPage() {
  const [, setLocation] = useLocation();

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-serif text-primary italic mb-1 sm:mb-2">
            Human Resources
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm">
            Manage employee onboarding and employee records
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-5 flex items-start justify-between gap-4">
              <div className="space-y-1">
                <h2 className="text-foreground font-semibold">Applications</h2>
                <p className="text-muted-foreground text-sm">
                  Review, download, archive, or delete public job applications.
                </p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <FileText className="w-6 h-6 text-primary" />
                <Button
                  onClick={() => setLocation("/admin/hr/applications")}
                  className="bg-primary text-primary-foreground hover:bg-primary/80"
                >
                  Open
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-5 flex items-start justify-between gap-4">
              <div className="space-y-1">
                <h2 className="text-foreground font-semibold">Employees</h2>
                <p className="text-muted-foreground text-sm">
                  Add employees, approve pending onboarding submissions, import/export.
                </p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <Users className="w-6 h-6 text-primary" />
                <Button
                  onClick={() => setLocation("/admin/hr/employees")}
                  className="bg-primary text-primary-foreground hover:bg-primary/80"
                >
                  Open
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
