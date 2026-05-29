import { AdminLayout } from "@/components/admin/admin-layout";
import CarOffboardingForm from "@/components/forms/CarOffboardingForm";
import { ClientPageLinks } from "@/components/client/ClientPageLinks";

export default function ClientOffboardingForm() {
  return (
    <AdminLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-primary leading-tight">
            Off-boarding Form
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Submit this form when requesting your car back from GLA.
          </p>
        </div>
        <CarOffboardingForm />
      </div>
      <ClientPageLinks />
    </AdminLayout>
  );
}
