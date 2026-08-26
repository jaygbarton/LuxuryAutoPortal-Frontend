import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { AdminLayout } from "@/components/admin/admin-layout";
import { AdminPageLinks } from "@/components/admin/AdminPageLinks";
import { ClientPageLinks } from "@/components/client/ClientPageLinks";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TripsOverviewTab } from "./operations/TripsOverviewTab";
import { TuroInspectionTab } from "./operations/TuroInspectionTab";
import { CarInspectionsTab } from "./operations/CarInspectionsTab";
import { ClaimsTab } from "./operations/ClaimsTab";
import { TicketViolationTab } from "./operations/TicketViolationTab";
import { MaintenanceTab } from "./operations/MaintenanceTab";
import { ServiceDueTab } from "./operations/ServiceDueTab";
import { NoCarIssuesTab } from "./operations/NoCarIssuesTab";
import { CarRepairedTab } from "./operations/CarRepairedTab";
import { CarBlockOffTab } from "./operations/CarBlockOffTab";
import { DayScheduleTab } from "./operations/DayScheduleTab";
import { TvTimelineTab } from "./operations/TvTimelineTab";
import {
  OPERATION_LOCATION_OPTIONS,
  OperationLocationFilter,
  OperationLocationFilterProvider,
} from "./operations/OperationLocationFilter";

const TAB_IDS = ["trips", "turo-inspection", "inspections", "claims", "ticket-violation", "maintenance", "service-due", "completed", "car-repaired", "car-block-off", "day-schedule", "tv-timeline"] as const;
type TabId = typeof TAB_IDS[number];

const TAB_LABELS: Record<TabId, string> = {
  trips: "Trips Overview",
  "turo-inspection": "Turo Messages",
  inspections: "Car Issues",
  claims: "Claims",
  "ticket-violation": "Ticket Violation",
  maintenance: "Maintenance",
  "service-due": "Service Due",
  completed: "No Car Issues",
  "car-repaired": "Car Repaired",
  "car-block-off": "Car Block Off",
  "day-schedule": "Day Schedule",
  "tv-timeline": "TV Timeline",
};

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

function tabFromSearch(search: string): TabId {
  const t = new URLSearchParams(search).get("tab");
  return t && (TAB_IDS as readonly string[]).includes(t) ? (t as TabId) : "trips";
}

export default function OperationsPage() {
  // The URL is the single source of truth for which tab is open. The tabs are
  // now sidebar sub-items (see OPERATIONS_TABS in admin-layout), and wouter's
  // <Link> pushes history WITHOUT firing popstate — so the old
  // useState+popstate pairing silently ignored every sidebar click. Reading
  // wouter's own search hook makes those navigations drive the page.
  const search = useSearch();
  const [, setLocation] = useLocation();
  const activeTab = tabFromSearch(search);
  const [mountedTabs, setMountedTabs] = useState<Set<TabId>>(() => new Set(["trips", tabFromSearch(search)]));
  const [locationFilter, setLocationFilter] = useState<OperationLocationFilter>("all");

  const handleTabChange = (value: string) => {
    const tab = value as TabId;
    const params = new URLSearchParams(search);
    if (tab === "trips") params.delete("tab");
    else params.set("tab", tab);
    const qs = params.toString();
    setLocation(`/admin/operations${qs ? `?${qs}` : ""}`);
  };

  // Keep a tab mounted (hidden) once visited, preserving its state and cache.
  useEffect(() => {
    setMountedTabs((prev) => {
      if (prev.has(activeTab)) return prev;
      const next = new Set(prev);
      next.add(activeTab);
      return next;
    });
  }, [activeTab]);

  return (
    <AdminLayout>
      <div className="flex flex-col">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-primary">Operations</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Vehicle operations workflow — trips, tasks, inspections, and maintenance.
          </p>
        </div>

        <OperationLocationFilterProvider value={locationFilter}>
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Location</div>
            <Select value={locationFilter} onValueChange={(value) => setLocationFilter(value as OperationLocationFilter)}>
              <SelectTrigger className="h-9 w-full sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OPERATION_LOCATION_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="-mx-2 mb-6 overflow-x-auto sm:mx-0">
            <TabsList className="inline-flex h-auto w-max min-w-full gap-1 border border-border bg-muted p-1 sm:min-w-0 sm:flex-wrap">
              {TAB_IDS.map((tab) => (
                <TabsTrigger
                  key={tab}
                  value={tab}
                  className="whitespace-nowrap text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  {TAB_LABELS[tab]}
                </TabsTrigger>
              ))}
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
          <LazyTab value="ticket-violation" activeTab={activeTab} mountedTabs={mountedTabs}>
            <TicketViolationTab />
          </LazyTab>
          <LazyTab value="maintenance" activeTab={activeTab} mountedTabs={mountedTabs}>
            <MaintenanceTab />
          </LazyTab>
          <LazyTab value="service-due" activeTab={activeTab} mountedTabs={mountedTabs}>
            <ServiceDueTab />
          </LazyTab>
          <LazyTab value="completed" activeTab={activeTab} mountedTabs={mountedTabs}>
            <NoCarIssuesTab />
          </LazyTab>
          <LazyTab value="car-repaired" activeTab={activeTab} mountedTabs={mountedTabs}>
            <CarRepairedTab />
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
        </OperationLocationFilterProvider>
      </div>
      <ClientPageLinks />
      <AdminPageLinks />
    </AdminLayout>
  );
}
