import { AdminLayout } from "@/components/admin/admin-layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TripsOverviewTab } from "./operations/TripsOverviewTab";
import { TripTasksTab } from "./operations/TripTasksTab";
import { TuroInspectionTab } from "./operations/TuroInspectionTab";
import { CarInspectionsTab } from "./operations/CarInspectionsTab";
import { MaintenanceTab } from "./operations/MaintenanceTab";

export default function OperationsPage() {
  return (
    <AdminLayout>
      <div className="flex flex-col h-full overflow-x-hidden">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-primary">Operations</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Vehicle operations workflow — trips, tasks, inspections, and maintenance.
          </p>
        </div>

        <Tabs defaultValue="trips" className="flex-1">
          <TabsList className="bg-muted border border-border mb-6 flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="trips" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-sm">
              Trips Overview
            </TabsTrigger>
            <TabsTrigger value="tasks" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-sm">
              Trip Tasks
            </TabsTrigger>
            <TabsTrigger value="turo-inspection" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-sm">
              Turo Messages
            </TabsTrigger>
            <TabsTrigger value="inspections" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-sm">
              Car Inspections
            </TabsTrigger>
            <TabsTrigger value="maintenance" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-sm">
              Maintenance
            </TabsTrigger>
          </TabsList>

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
          <TabsContent value="maintenance">
            <MaintenanceTab />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
