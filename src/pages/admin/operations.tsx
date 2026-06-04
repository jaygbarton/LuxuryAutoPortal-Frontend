import { AdminLayout } from "@/components/admin/admin-layout";
import { AdminPageLinks } from "@/components/admin/AdminPageLinks";
import { ClientPageLinks } from "@/components/client/ClientPageLinks";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TripsOverviewTab } from "./operations/TripsOverviewTab";
import { TripTasksTab } from "./operations/TripTasksTab";
import { TuroInspectionTab } from "./operations/TuroInspectionTab";
import { CarInspectionsTab } from "./operations/CarInspectionsTab";
import { MaintenanceTab } from "./operations/MaintenanceTab";
import { NoCarIssuesTab } from "./operations/NoCarIssuesTab";
import { CarBlockOffTab } from "./operations/CarBlockOffTab";

export default function OperationsPage() {
  return (
    <AdminLayout>
      <div className="flex flex-col">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-primary">Operations</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Vehicle operations workflow — trips, tasks, inspections, and maintenance.
          </p>
        </div>

        <Tabs defaultValue="trips">
          <div className="-mx-2 sm:mx-0 mb-6 overflow-x-auto">
            <TabsList className="bg-muted border border-border h-auto gap-1 p-1 inline-flex w-max min-w-full sm:w-auto sm:min-w-0 sm:flex-wrap">
              <TabsTrigger value="trips" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-sm whitespace-nowrap">
                Trips Overview
              </TabsTrigger>
              <TabsTrigger value="tasks" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-sm whitespace-nowrap">
                Trip Tasks
              </TabsTrigger>
              <TabsTrigger value="turo-inspection" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-sm whitespace-nowrap">
                Turo Messages
              </TabsTrigger>
              <TabsTrigger value="inspections" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-sm whitespace-nowrap">
                Car Issues
              </TabsTrigger>
              <TabsTrigger value="maintenance" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-sm whitespace-nowrap">
                Maintenance
              </TabsTrigger>
              <TabsTrigger value="completed" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-sm whitespace-nowrap">
                No Car Issues
              </TabsTrigger>
              <TabsTrigger value="car-block-off" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-sm whitespace-nowrap">
                Car Block Off
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="trips">
            <TripsOverviewTab />
          </TabsContent>
          <TabsContent value="tasks">
            <TripTasksTab />
          </TabsContent>
          <TabsContent value="turo-inspection">
            <TuroInspectionTab />
          </TabsContent>
          <TabsContent value="inspections">
            <CarInspectionsTab />
          </TabsContent>
          <TabsContent value="car-block-off">
            <CarBlockOffTab />
          </TabsContent>
          <TabsContent value="maintenance">
            <MaintenanceTab />
          </TabsContent>
          <TabsContent value="completed">
            <NoCarIssuesTab />
          </TabsContent>
        </Tabs>
      </div>
      <ClientPageLinks />
      <AdminPageLinks />
    </AdminLayout>
  );
}
