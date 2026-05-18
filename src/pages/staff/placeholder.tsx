import { AdminLayout } from "@/components/admin/admin-layout";
import { EmployeePageLinks } from "@/components/staff/EmployeePageLinks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface StaffPlaceholderProps {
  title: string;
  description?: string;
  icon: React.ReactNode;
}

export default function StaffPlaceholder({ title, description, icon }: StaffPlaceholderProps) {
  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-primary">{title}</h1>
          {description && <p className="text-muted-foreground">{description}</p>}
        </div>
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              {icon}
              {title}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground">
            <p>This section is available from the staff sidebar. Content can be added here.</p>
          </CardContent>
        </Card>
      </div>
      <EmployeePageLinks />
    </AdminLayout>
  );
}
