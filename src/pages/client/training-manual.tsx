import { AdminLayout } from "@/components/admin/admin-layout";
import { ClientPageLinks } from "@/components/client/ClientPageLinks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OnboardingTutorial, useTutorial } from "@/components/onboarding/OnboardingTutorial";
import { buildApiUrl } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import { PlayCircle, Video, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { VideoPlayer } from "@/components/ui/video-player";

interface TutorialStep {
  id: number;
  title: string;
  description: string;
  videoUrl?: string;
  videoPlaceholder?: string;
  instructions?: string[];
  actionButton?: { label: string; href?: string };
}

interface TutorialModule {
  id: number;
  moduleOrder: number;
  title: string;
  description?: string;
  steps?: TutorialStep[];
}

export default function ClientTrainingManual() {
  const { resetTutorial, startTutorialFromModule } = useTutorial();
  const [expandedModules, setExpandedModules] = useState<Set<number>>(new Set());
  const [stepVideoState, setStepVideoState] = useState<Record<number, { loading: boolean; error: boolean }>>({});

  const { data: modulesData, isLoading: modulesLoading } = useQuery<{ success: boolean; data: TutorialModule[] }>({
    queryKey: ["/api/tutorial/modules", "client"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/tutorial/modules?role=client"), { credentials: "include" });
      if (!res.ok) return { success: false, data: [] };
      return res.json();
    },
    retry: false,
  });

  const { data: stepsData, isLoading: stepsLoading } = useQuery<{
    success: boolean;
    data: { modules: (TutorialModule & { steps: TutorialStep[] })[] };
  }>({
    queryKey: ["/api/tutorial/steps", "client", "with-modules"],
    queryFn: async () => {
      const res = await fetch(
        buildApiUrl("/api/tutorial/steps?role=client&includeModules=true"),
        { credentials: "include" }
      );
      if (!res.ok) return { success: false, data: { modules: [] } };
      return res.json();
    },
    retry: false,
  });

  const modules = (stepsData?.data?.modules ?? []) as (TutorialModule & { steps: TutorialStep[] })[];
  const isLoading = modulesLoading || stepsLoading;

  const toggleModule = (id: number) => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleStartTutorial = () => {
    resetTutorial();
  };

  const handleStartModuleTutorial = (moduleId: number) => {
    void startTutorialFromModule(moduleId);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">System Tutorial</h1>
          <p className="text-muted-foreground">Client onboarding and how to use the GLA portal—guided tutorial and step-by-step videos.</p>
        </div>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-primary text-xl">Help & Tutorials</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              Complete your client onboarding and learn portal procedures. Start the guided walkthrough or browse modules and videos below.
            </p>
            <button
              type="button"
              onClick={handleStartTutorial}
              className="mt-3 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <PlayCircle className="w-4 h-4" />
              Start Tutorial
            </button>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : modules.length === 0 ? (
          <Card className="bg-card border-border">
            <CardContent className="py-12 text-center text-muted-foreground">
              No client tutorial modules yet. Your admin can add them from the Admin System Tutorial page.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Expand a module to view its steps, videos, and instructions.
            </p>
            {modules.map((mod) => {
              const steps = mod.steps ?? [];
              const isExpanded = expandedModules.has(mod.id);
              return (
                <Card key={mod.id} className="bg-card border-border">
                  <CardHeader
                    className="cursor-pointer pb-3"
                    onClick={() => toggleModule(mod.id)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-primary flex-shrink-0" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-primary flex-shrink-0" />
                        )}
                        <span className="rounded border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary flex-shrink-0">
                          Module {mod.moduleOrder}
                        </span>
                        <CardTitle className="text-lg truncate">{mod.title}</CardTitle>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartModuleTutorial(mod.id);
                        }}
                        disabled={steps.length === 0}
                        className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                        title={steps.length === 0 ? "No steps available to start" : `Start tutorial from Module ${mod.moduleOrder}`}
                      >
                        <PlayCircle className="h-3.5 w-3.5" />
                        Start Tutorial
                      </button>
                    </div>
                    {mod.description && (
                      <p className="text-sm text-muted-foreground pl-6 whitespace-pre-line">{mod.description}</p>
                    )}
                    <p className="text-xs text-muted-foreground pl-6">
                      {steps.length} step{steps.length !== 1 ? "s" : ""}
                    </p>
                  </CardHeader>
                  {isExpanded && (
                    <CardContent className="pt-0">
                      <div className="grid gap-4 md:grid-cols-2">
                        {steps.map((step, stepIndex) => (
                          <Card key={step.id} className="bg-card border-border">
                            <CardContent className="p-4 space-y-3">
                              <div className="flex items-center gap-2">
                                <span className="rounded border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                                  Step {stepIndex + 1}
                                </span>
                                <h3 className="font-semibold">{step.title}</h3>
                              </div>
                              <p className="text-sm text-muted-foreground whitespace-pre-line">{step.description}</p>
                              {(step.videoUrl || step.videoPlaceholder) && (
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                                    <Video className="h-4 w-4" />
                                    Video
                                  </div>
                                  <VideoPlayer
                                    url={step.videoUrl}
                                    placeholder={step.videoPlaceholder}
                                    onStatusChange={(status) =>
                                      setStepVideoState((s) => ({ ...s, [step.id]: status }))
                                    }
                                  />
                                </div>
                              )}
                              {step.instructions && step.instructions.length > 0 && (
                                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                                  {step.instructions.map((inst, i) => (
                                    <li key={i}>{inst}</li>
                                  ))}
                                </ul>
                              )}
                              {step.actionButton?.label && (
                                <div className="text-sm">
                                  <span className="font-medium text-muted-foreground">Action: </span>
                                  {step.actionButton.href ? (
                                    <a
                                      href={step.actionButton.href}
                                      className="text-primary hover:underline"
                                    >
                                      {step.actionButton.label}
                                    </a>
                                  ) : (
                                    <span>{step.actionButton.label}</span>
                                  )}
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        <OnboardingTutorial autoPlay={false} />

        <ClientPageLinks />
      </div>
    </AdminLayout>
  );
}
