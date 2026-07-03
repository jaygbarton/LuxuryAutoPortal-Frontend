import { useState } from "react";
import { AdminLayout } from "@/components/admin/admin-layout";
import { AdminPageLinks } from "@/components/admin/AdminPageLinks";
import { ClientPageLinks } from "@/components/client/ClientPageLinks";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TripsOverviewTab } from "./operations/TripsOverviewTab";
import { TuroInspectionTab } from "./operations/TuroInspectionTab";
import { CarInspectionsTab } from "./operations/CarInspectionsTab";
import { ClaimsTab } from "./operations/ClaimsTab";
import { MaintenanceTab } from "./operations/MaintenanceTab";
import { NoCarIssuesTab } from "./operations/NoCarIssuesTab";
import { CarBlockOffTab } from "./operations/CarBlockOffTab";
import { DayScheduleTab } from "./operations/DayScheduleTab";
import { TvTimelineTab } from "./operations/TvTimelineTab";

const TAB_IDS = ["trips", "turo-inspection", "inspections", "claims", "maintenance", "completed", "car-block-off", "day-schedule", "tv-timeline"] as const;
type TabId = typeof TAB_IDS[number];

// Renders a tab's content only after it has been activated for the first time,
// then keeps it mounted (hidden) so state and cache are preserved on re-visit.
function LazyTab({ value, activeTab, mountedTabs, children }: {
  value: TabId;
  activeTab: TabId;
  mountedTabs: Set<TabId>;
  children: React.ReactNode;
}) {
  if (!mountedTabs.has(value)) return null;
  return (
    <TabsContent value={value} className={value !== activeTab ? "hidden" : ""} forceMount>
      {children}
    </TabsContent>
  );
}

export default function OperationsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("trips");
  const [mountedTabs, setMountedTabs] = useState<Set<TabId>>(new Set(["trips"]));

  const handleTabChange = (value: string) => {
    const tab = value as TabId;
    setActiveTab(tab);
    setMountedTabs(prev => {
      if (prev.has(tab)) return prev;
      const next = new Set(prev);
      next.add(tab);
      return next;
    });
  };

  return (
    <AdminLayout>
      <div className="flex flex-col">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-primary">Operations</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Vehicle operations workflow — trips, tasks, inspections, and maintenance.
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <div className="-mx-2 sm:mx-0 mb-6 overflow-x-auto">
            <TabsList className="bg-muted border border-border h-auto gap-1 p-1 inline-flex w-max min-w-full sm:w-auto sm:min-w-0 sm:flex-wrap">
              <TabsTrigger value="trips" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-sm whitespace-nowrap">
                Trips Overview
              </TabsTrigger>
              <TabsTrigger value="turo-inspection" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-sm whitespace-nowrap">
                Turo Messages
              </TabsTrigger>
              <TabsTrigger value="inspections" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-sm whitespace-nowrap">
                Car Issues
              </TabsTrigger>
              <TabsTrigger value="claims" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-sm whitespace-nowrap">
                Claims
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
              <TabsTrigger value="day-schedule" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-sm whitespace-nowrap">
                Day Schedule
              </TabsTrigger>
              <TabsTrigger value="tv-timeline" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-sm whitespace-nowrap">
                TV Timeline
              </TabsTrigger>
            </TabsList>
          </div>

          <LazyTab value="trips" activeTab={activeTab} mountedTabs={mountedTabs}>
            <TripsOverviewTab />
          </LazyTab>
          <LazyTab value="turo-inspection" activeTab={activeTab} mountedTabs={mountedTabs}>
            <TuroInspectionTab />
          </LazyTab>
          <LazyTab value="inspections" activeTab={activeTab} mountedTabs={mountedTabs}>
            <CarInspectionsTab />
          </LazyTab>
          <LazyTab value="claims" activeTab={activeTab} mountedTabs={mountedTabs}>
            <ClaimsTab />
          </LazyTab>
          <LazyTab value="maintenance" activeTab={activeTab} mountedTabs={mountedTabs}>
            <MaintenanceTab />
          </LazyTab>
          <LazyTab value="completed" activeTab={activeTab} mountedTabs={mountedTabs}>
            <NoCarIssuesTab />
          </LazyTab>
          <LazyTab value="car-block-off" activeTab={activeTab} mountedTabs={mountedTabs}>
            <CarBlockOffTab />
          </LazyTab>
          <LazyTab value="day-schedule" activeTab={activeTab} mountedTabs={mountedTabs}>
            <DayScheduleTab />
          </LazyTab>
          <LazyTab value="tv-timeline" activeTab={activeTab} mountedTabs={mountedTabs}>
            <TvTimelineTab />
          </LazyTab>
        </Tabs>
      </div>
      <ClientPageLinks />
      <AdminPageLinks />
    </AdminLayout>
  );
}
