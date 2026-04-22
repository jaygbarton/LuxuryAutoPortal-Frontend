import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  ChevronLeft,
  ChevronRight,
  Play,
  CheckCircle2,
  FileText,
  LogOut,
  User,
  Navigation,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { buildApiUrl } from "@/lib/queryClient";
import { VideoPlayer } from "@/components/ui/video-player";

// Tutorial module interface
export interface TutorialModule {
  id: number;
  role: 'admin' | 'client' | 'employee';
  moduleOrder: number;
  title: string;
  description: string;
  steps?: TutorialStep[];
}

// Tutorial step interface
export interface TutorialStep {
  id: number;
  moduleId?: number;
  role?: 'admin' | 'client' | 'employee';
  title: string;
  description: string;
  videoUrl?: string;
  videoPlaceholder?: string;
  instructions: string[];
  actionButton?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
}

// Tutorial context
interface TutorialContextType {
  isOpen: boolean;
  currentModule: number | null;
  currentStep: number;
  completedSteps: Set<number>;
  openTutorial: () => void;
  closeTutorial: () => void;
  nextStep: () => void;
  previousStep: () => void;
  goToStep: (step: number) => void;
  goToModule: (moduleId: number) => void;
  startTutorialFromModule: (moduleId: number) => Promise<void> | void;
  markStepComplete: (step: number) => void;
  resetTutorial: () => void;
  hasCompletedTutorial: boolean;
  tutorialSteps: TutorialStep[];
  tutorialModules: TutorialModule[];
}

const TutorialContext = createContext<TutorialContextType | undefined>(undefined);

// Default tutorial steps (fallback if API fails)
const DEFAULT_TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 1,
    title: "Complete the Onboarding Form",
    description: "Learn how to complete the onboarding form when returning your vehicle to the GLA office.",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    videoPlaceholder: "Step 1: Complete the onboarding form when returning the vehicle to the GLA office.",
    instructions: [
      "Navigate to the Forms page from the main menu",
      "Select the 'Onboarding' tab",
      "Fill in all required vehicle information",
      "Select your vehicle from the dropdown",
      "Enter the drop-off date and time",
      "Submit the form to notify GLA office",
    ],
    actionButton: {
      label: "Forms",
      href: "/admin/forms",
    },
  },
  {
    id: 2,
    title: "Complete the Offboarding Form",
    description: "Learn how to complete the offboarding form when picking up your vehicle from GLA.",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
    videoPlaceholder: "Step 2: Complete the offboarding form when picking up the vehicle from GLA.",
    instructions: [
      "Navigate to the Forms page from the main menu",
      "Select the 'Offboarding' tab",
      "Fill in all required vehicle information",
      "Select your vehicle from the dropdown",
      "Enter the pick-up date and time",
      "Submit the form to notify GLA office",
    ],
    actionButton: {
      label: "Forms",
      href: "/admin/forms",
    },
  },
  {
    id: 3,
    title: "Access Your Profile",
    description: "Learn how to check your user information, contract copy, and shortcut links in your profile.",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    videoPlaceholder: "Step 3: You can check your user information, contract copy, and shortcut links in your profile.",
    instructions: [
      "Navigate to your Profile page from the main menu",
      "View your personal information and account details",
      "Access your signed contract documents",
      "Use Quick Links for quick navigation",
      "Download contract copies when needed",
      "Update your information if necessary",
    ],
    actionButton: {
      label: "Profile",
      href: "/profile",
    },
  },
  {
    id: 4,
    title: "In-Vehicle Navigation",
    description: "This feature will be available soon. Stay tuned for updates!",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
    videoPlaceholder: "Step 4: (To be added once the in-vehicle navigation function is completed)",
    instructions: [
      "This feature is currently under development",
      "In-vehicle navigation functionality will be added soon",
      "You'll receive a notification when this feature is available",
      "Check back later for updates",
    ],
    actionButton: {
      label: "Coming Soon",
    },
  },
];

// Hook to fetch tutorial modules from API
function useTutorialModules(role: 'admin' | 'client' | 'employee' = 'client') {
  return useQuery<TutorialModule[]>({
    queryKey: ["/api/tutorial/modules", role],
    queryFn: async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
        
        const response = await fetch(buildApiUrl(`/api/tutorial/modules?role=${role}`), {
          credentials: "include",
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          console.warn("Failed to fetch tutorial modules");
          return [];
        }
        const data = await response.json();
        return data.success ? data.data : [];
      } catch (error) {
        // If fetch fails (network error, timeout, etc.), return empty array
        console.warn("⚠️ [TUTORIAL] Failed to fetch tutorial modules (non-critical):", error);
        return [];
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false, // Don't retry to prevent blocking
    throwOnError: false, // Don't throw errors
  });
}

// Hook to fetch tutorial steps grouped by modules from API
function useTutorialStepsWithModules(role: 'admin' | 'client' | 'employee' = 'client') {
  return useQuery<{ modules: Array<TutorialModule & { steps: TutorialStep[] }> }>({
    queryKey: ["/api/tutorial/steps", role, "with-modules"],
    queryFn: async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
        
        const response = await fetch(buildApiUrl(`/api/tutorial/steps?role=${role}&includeModules=true`), {
          credentials: "include",
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          console.warn("Failed to fetch tutorial steps with modules, using defaults");
          return { modules: [] };
        }
        const data = await response.json();
        return data.success ? data.data : { modules: [] };
      } catch (error) {
        // If fetch fails (network error, timeout, etc.), return empty modules
        console.warn("⚠️ [TUTORIAL] Failed to fetch tutorial steps with modules (non-critical):", error);
        return { modules: [] };
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false, // Don't retry to prevent blocking
    throwOnError: false, // Don't throw errors
  });
}

// Hook to fetch tutorial steps from API (backwards compatibility - flat list)
function useTutorialSteps(role: 'admin' | 'client' | 'employee' = 'client') {
  return useQuery<TutorialStep[]>({
    queryKey: ["/api/tutorial/steps", role],
    queryFn: async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
        
        const response = await fetch(buildApiUrl(`/api/tutorial/steps?role=${role}`), {
          credentials: "include",
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
      if (!response.ok) {
        console.warn("Failed to fetch tutorial steps, using defaults");
        return DEFAULT_TUTORIAL_STEPS;
      }
      const data = await response.json();
        // Handle both response formats: { success: true, data: [...] } or { success: true, data: { modules: [...] } }
        if (data.success) {
          if (Array.isArray(data.data)) {
        return data.data;
          } else if (data.data.modules) {
            // Flatten modules into steps
            const allSteps: TutorialStep[] = [];
            data.data.modules.forEach((module: any) => {
              if (module.steps && Array.isArray(module.steps)) {
                allSteps.push(...module.steps);
              }
            });
            return allSteps.length > 0 ? allSteps : DEFAULT_TUTORIAL_STEPS;
          }
      }
      return DEFAULT_TUTORIAL_STEPS;
      } catch (error) {
        // If fetch fails (network error, timeout, etc.), return default steps
        console.warn("⚠️ [TUTORIAL] Failed to fetch tutorial steps (non-critical):", error);
        return DEFAULT_TUTORIAL_STEPS;
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false, // Don't retry to prevent blocking
    placeholderData: DEFAULT_TUTORIAL_STEPS,
    throwOnError: false, // Don't throw errors
  });
}

// Tutorial Provider Component
export function TutorialProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentModule, setCurrentModule] = useState<number | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [hasCompletedTutorial, setHasCompletedTutorial] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [location] = useLocation();
  
  // Don't fetch user data on login/signup pages
  const isAuthPage = location === '/login' || location === '/signup' || location === '/';
  
  // Reuse the shared ["/api/auth/me"] query key so React Query deduplicates
  // with AdminLayout / AuthGuard instead of firing a separate request.
  const { data: userData } = useQuery<{ user?: { isAdmin?: boolean; isClient?: boolean; isEmployee?: boolean } }>({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      if (isAuthPage) return { user: undefined };
      try {
        const response = await fetch(buildApiUrl("/api/auth/me"), {
          credentials: "include",
        });
        if (!response.ok) return { user: undefined };
        return response.json();
      } catch {
        return { user: undefined };
      }
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
    enabled: !isAuthPage,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    throwOnError: false,
  });

  // Determine role from user data
  const userRole = userData?.user?.isAdmin ? 'admin' : userData?.user?.isClient ? 'client' : userData?.user?.isEmployee ? 'employee' : 'client';
  
  const { data: tutorialSteps = DEFAULT_TUTORIAL_STEPS, refetch: refetchTutorialSteps } = useTutorialSteps(userRole);
  const { data: tutorialModules = [], refetch: refetchTutorialModules } = useTutorialModules(userRole);
  // useTutorialStepsWithModules is fetched inside OnboardingTutorial component only when dialog is active

  // Mutation to mark tour as completed
  const completeTourMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(buildApiUrl("/api/auth/complete-tour"), {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to mark tour as completed");
      }
      return response.json();
    },
    onSuccess: () => {
      // Invalidate user query to refresh user data
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
    onError: (error) => {
      console.error("Failed to mark tour as completed:", error);
      toast({
        title: "Error",
        description: "Failed to mark tutorial as completed. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Save tutorial state to localStorage
  const saveState = (updates: {
    isOpen?: boolean;
    currentStep?: number;
    completedSteps?: Set<number>;
    completed?: boolean;
  }) => {
    const currentState = {
      completed: hasCompletedTutorial,
      currentStep,
      completedSteps: Array.from(completedSteps),
    };

    const newState = {
      ...currentState,
      ...updates,
      completedSteps: updates.completedSteps
        ? Array.from(updates.completedSteps)
        : currentState.completedSteps,
    };

    localStorage.setItem("gla_tutorial_state", JSON.stringify(newState));
  };

  // Load tutorial state from localStorage (but don't auto-open)
  // Auto-opening is now handled explicitly by the dashboard page
  useEffect(() => {
    // Load saved state for existing users (step position, completed steps, etc.)
    // But do NOT auto-open the tutorial - that's handled by dashboard page
    const savedState = localStorage.getItem("gla_tutorial_state");
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState);
        setHasCompletedTutorial(parsed.completed || false);
        setCompletedSteps(new Set(parsed.completedSteps || []));
        if (parsed.currentStep) {
          // Validate that the saved step exists in the tutorial steps
          if (Array.isArray(tutorialSteps) && tutorialSteps.length > 0) {
            const stepExists = tutorialSteps.some(step => step.id === parsed.currentStep);
            if (stepExists) {
              setCurrentStep(parsed.currentStep);
            } else {
              // If saved step doesn't exist, use first step
              const firstStep = tutorialSteps[0].id;
              setCurrentStep(firstStep);
            }
          } else {
            // Fallback if steps not loaded yet
            setCurrentStep(parsed.currentStep);
          }
        }
        // Do NOT set setIsOpen(true) here - tutorial should only open when explicitly called
      } catch (e) {
        console.error("Error loading tutorial state:", e);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tutorialSteps]);

  // Update current step when tutorialSteps change (e.g., when new steps are added)
  useEffect(() => {
    if (Array.isArray(tutorialSteps) && tutorialSteps.length > 0) {
      // If current step doesn't exist in the new steps, reset to first step
      const stepExists = tutorialSteps.some(step => step.id === currentStep);
      if (!stepExists) {
        const firstStep = tutorialSteps[0].id;
        setCurrentStep(firstStep);
        saveState({ currentStep: firstStep });
      }
    }
  }, [tutorialSteps, currentStep]);

  const openTutorial = async () => {
    // Refetch tutorial steps to ensure we have the latest data
    await refetchTutorialSteps();
    
    // Get the latest tutorial steps after refetch
    const latestSteps = queryClient.getQueryData<TutorialStep[]>(["/api/tutorial/steps"]) || tutorialSteps;
    const safeLatestSteps = Array.isArray(latestSteps) && latestSteps.length > 0 ? latestSteps : DEFAULT_TUTORIAL_STEPS;
    
    // Always start from the first step (lowest step_order/id) when opening tutorial
    const firstStep = safeLatestSteps[0].id;
    setCurrentStep(firstStep);
    setIsOpen(true);
    saveState({ currentStep: firstStep, isOpen: true });
  };

  const closeTutorial = () => {
    setIsOpen(false);
    saveState({ isOpen: false });
  };

  const nextStep = () => {
    // Ensure tutorialSteps is an array
    if (!Array.isArray(safeTutorialSteps) || safeTutorialSteps.length === 0) {
      console.warn("Tutorial steps not available");
      return;
    }
    
    // Find the next step by id (step_order from database)
    const currentStepIndex = safeTutorialSteps.findIndex(step => step.id === currentStep);
    if (currentStepIndex >= 0 && currentStepIndex < safeTutorialSteps.length - 1) {
      const nextStepData = safeTutorialSteps[currentStepIndex + 1];
      setCurrentStep(nextStepData.id);
      saveState({ currentStep: nextStepData.id });
    } else {
      // Tutorial completed - find the last step id
      const lastStep = safeTutorialSteps[safeTutorialSteps.length - 1];
      if (lastStep) {
        setHasCompletedTutorial(true);
        saveState({ completed: true, currentStep: lastStep.id });
        // Mark tour as completed in database
        completeTourMutation.mutate();
        closeTutorial();
      }
    }
  };

  const previousStep = () => {
    // Ensure tutorialSteps is an array
    if (!Array.isArray(safeTutorialSteps) || safeTutorialSteps.length === 0) {
      console.warn("Tutorial steps not available");
      return;
    }
    
    // Find the previous step by id (step_order from database)
    const currentStepIndex = safeTutorialSteps.findIndex(step => step.id === currentStep);
    if (currentStepIndex > 0) {
      const prevStepData = safeTutorialSteps[currentStepIndex - 1];
      setCurrentStep(prevStepData.id);
      saveState({ currentStep: prevStepData.id });
    }
  };

  const goToModule = (moduleId: number) => {
    setCurrentModule(moduleId);
    // Find the first step in the module using the flat steps list
    const steps = Array.isArray(tutorialSteps) ? tutorialSteps : DEFAULT_TUTORIAL_STEPS;
    const moduleSteps = steps.filter(s => s.moduleId === moduleId);
    if (moduleSteps.length > 0) {
      setCurrentStep(moduleSteps[0].id);
      saveState({ currentStep: moduleSteps[0].id });
    }
  };

  const startTutorialFromModule = async (moduleId: number) => {
    // Refetch the latest steps/modules so we always open at the correct first step.
    await refetchTutorialSteps();
    await refetchTutorialModules();

    const latestSteps =
      queryClient.getQueryData<TutorialStep[]>(["/api/tutorial/steps"]) || tutorialSteps;
    const safeLatestSteps =
      Array.isArray(latestSteps) && latestSteps.length > 0
        ? latestSteps
        : DEFAULT_TUTORIAL_STEPS;

    const moduleSteps = safeLatestSteps.filter(s => s.moduleId === moduleId);
    // Fall back to the module's first step if available, otherwise fall back to the
    // very first tutorial step so the dialog never opens in an empty state.
    const firstStep = moduleSteps.length > 0 ? moduleSteps[0].id : safeLatestSteps[0].id;

    setCurrentModule(moduleId);
    setCurrentStep(firstStep);
    setIsOpen(true);
    saveState({ currentStep: firstStep, isOpen: true });
  };

  const goToStep = (step: number) => {
    // Ensure tutorialSteps is an array
    if (!Array.isArray(safeTutorialSteps) || safeTutorialSteps.length === 0) {
      console.warn("Tutorial steps not available");
      return;
    }
    
    // Find step by id (step_order from database)
    const stepData = safeTutorialSteps.find(s => s.id === step);
    if (stepData) {
      setCurrentStep(stepData.id);
      saveState({ currentStep: stepData.id });
    }
  };

  const markStepComplete = (step: number) => {
    const newCompleted = new Set(completedSteps);
    newCompleted.add(step);
    setCompletedSteps(newCompleted);
    saveState({ completedSteps: newCompleted });
  };

  // Ensure tutorialSteps is always an array (create this before functions that use it)
  // Also ensure it updates when tutorialSteps changes
  const safeTutorialSteps = Array.isArray(tutorialSteps) && tutorialSteps.length > 0 
    ? tutorialSteps 
    : DEFAULT_TUTORIAL_STEPS;

  const resetTutorial = async () => {
    // Refetch tutorial steps to ensure we have the latest data before resetting
    await refetchTutorialSteps();
    
    // Get the latest tutorial steps after refetch
    const latestSteps = queryClient.getQueryData<TutorialStep[]>(["/api/tutorial/steps"]) || tutorialSteps;
    const safeLatestSteps = Array.isArray(latestSteps) && latestSteps.length > 0 ? latestSteps : DEFAULT_TUTORIAL_STEPS;
    
    // Always start from the first step (lowest step_order/id) when resetting tutorial
    const firstStep = safeLatestSteps[0].id;
    setCurrentStep(firstStep);
    setCompletedSteps(new Set());
    setHasCompletedTutorial(false);
    setIsOpen(true);
    saveState({
      currentStep: firstStep,
      completedSteps: new Set(),
      completed: false,
      isOpen: true,
    });
  };

  return (
    <TutorialContext.Provider
      value={{
        isOpen,
        currentModule,
        currentStep,
        completedSteps,
        openTutorial,
        closeTutorial,
        nextStep,
        previousStep,
        goToStep,
        goToModule,
        startTutorialFromModule,
        markStepComplete,
        resetTutorial,
        hasCompletedTutorial,
        tutorialSteps: safeTutorialSteps, // Expose steps to context (always an array)
        tutorialModules: tutorialModules, // Expose modules to context
      }}
    >
      {children}
    </TutorialContext.Provider>
  );
}

// Hook to use tutorial context
export function useTutorial() {
  const context = useContext(TutorialContext);
  if (context === undefined) {
    throw new Error("useTutorial must be used within a TutorialProvider");
  }
  return context;
}

// Main Tutorial Component
interface OnboardingTutorialProps {
  isOpen?: boolean;
  onClose?: () => void;
  autoStart?: boolean;
  autoPlay?: boolean; // Control video autoplay
}

export function OnboardingTutorial({
  isOpen: controlledIsOpen,
  onClose: controlledOnClose,
  autoStart = false,
  autoPlay = true, // Default to autoplay for dashboard, but can be disabled for System Tutorial page
}: OnboardingTutorialProps) {
  const [, setLocation] = useLocation();
  const [videoError, setVideoError] = useState(false);
  const [videoLoading, setVideoLoading] = useState(true);
  
  const {
    isOpen: contextIsOpen,
    currentModule,
    currentStep,
    completedSteps,
    closeTutorial,
    nextStep,
    previousStep,
    goToStep,
    goToModule,
    markStepComplete,
    hasCompletedTutorial,
    openTutorial: contextOpenTutorial,
    tutorialSteps: contextTutorialSteps = DEFAULT_TUTORIAL_STEPS,
    tutorialModules: contextTutorialModules = [],
  } = useTutorial();

  // Use controlled props if provided, otherwise use context
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : contextIsOpen;
  const handleClose = controlledOnClose || closeTutorial;

  // Note: Auto-start is now handled by TutorialProvider for new signups only
  // This component no longer auto-starts on its own

  // Use tutorial steps and modules from context (which are fetched from API)
  // Ensure tutorialSteps is always an array
  const tutorialSteps = Array.isArray(contextTutorialSteps) ? contextTutorialSteps : DEFAULT_TUTORIAL_STEPS;
  const tutorialModules = Array.isArray(contextTutorialModules) ? contextTutorialModules : [];
  
  // Find current step data by matching step id with currentStep
  const currentStepData = tutorialSteps.find(step => step.id === currentStep) || tutorialSteps[currentStep - 1] || tutorialSteps[0];
  
  // Find current module based on current step
  const currentModuleData = currentStepData?.moduleId 
    ? tutorialModules.find(m => m.id === currentStepData.moduleId)
    : null;
  
  // Get steps for current module from the flat list (no extra API call needed)
  const currentModuleSteps = currentModuleData
    ? tutorialSteps.filter(s => s.moduleId === currentModuleData.id)
    : tutorialSteps;
  
  // Reset video state when step changes or video URL changes
  useEffect(() => {
    setVideoError(false);
    setVideoLoading(true);
  }, [currentStep, currentStepData?.videoUrl]);
  
  if (!currentStepData) {
    return null; // Don't render if no step data
  }
  
  // Calculate progress within current module or overall
  const stepsForProgress = currentModuleData ? currentModuleSteps : tutorialSteps;
  const currentStepIndex = stepsForProgress.findIndex(step => step.id === currentStep);
  const progress = currentStepIndex >= 0 ? ((currentStepIndex + 1) / stepsForProgress.length) * 100 : 0;
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === stepsForProgress.length - 1;
  
  const handleVideoError = () => {
    setVideoError(true);
    setVideoLoading(false);
    console.warn("Video failed to load:", currentStepData.videoUrl);
  };
  
  const handleVideoLoad = () => {
    setVideoLoading(false);
    setVideoError(false);
  };
  
  const handleVideoLoadStart = () => {
    setVideoLoading(true);
    setVideoError(false);
  };
  
  // Check if video URL is valid
  const hasValidVideoUrl = currentStepData.videoUrl && 
    typeof currentStepData.videoUrl === 'string' && 
    currentStepData.videoUrl.trim() !== '';

  const handleActionClick = () => {
    if (currentStepData.actionButton?.href) {
      setLocation(currentStepData.actionButton.href);
      handleClose();
    } else if (currentStepData.actionButton?.onClick) {
      currentStepData.actionButton.onClick();
    }
  };

  const handleStepClick = (stepNumber: number) => {
    goToStep(stepNumber);
  };

  const getStepIcon = (stepId: number) => {
    switch (stepId) {
      case 1:
        return <FileText className="w-5 h-5" />;
      case 2:
        return <LogOut className="w-5 h-5" />;
      case 3:
        return <User className="w-5 h-5" />;
      case 4:
        return <Navigation className="w-5 h-5" />;
      default:
        return <Sparkles className="w-5 h-5" />;
    }
  };

  return (
    <Dialog 
      open={isOpen} 
      onOpenChange={(open) => {
        // Only close when user explicitly closes the dialog
        // Don't close when open is true (that's a programmatic open)
        if (!open) {
          handleClose();
        }
      }}
    >
      <DialogContent className="max-w-4xl max-h-[95vh] flex flex-col bg-background border-border text-foreground">
        <DialogHeader className="space-y-2 pb-2">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-bold text-[#D3BC8D] flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              Welcome Tutorial
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            {currentModuleData ? (
              <>
                Module: {currentModuleData.title} - Step {currentStepIndex >= 0 ? currentStepIndex + 1 : 1} of {currentModuleSteps.length}
              </>
            ) : (
              <>
                Step {currentStepIndex >= 0 ? currentStepIndex + 1 : 1} of {tutorialSteps.length}
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Module Navigation - Show if modules exist */}
        {tutorialModules.length > 0 && (
          <div className="flex gap-2 pb-2 overflow-x-auto">
            {tutorialModules.map((module) => (
              <Button
                key={module.id}
                variant={currentModuleData?.id === module.id ? "default" : "outline"}
                size="sm"
                onClick={() => goToModule(module.id)}
                className={cn(
                  "whitespace-nowrap",
                  currentModuleData?.id === module.id
                    ? "bg-primary text-black hover:bg-primary/90"
                    : "border-border text-muted-foreground hover:bg-muted/50"
                )}
              >
                {module.title}
              </Button>
            ))}
          </div>
        )}

        {/* Progress Bar */}
        <div className="space-y-1 pb-2">
          <Progress value={progress} className="h-2 bg-gray-800" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{Math.round(progress)}% Complete</span>
            <span>
              {currentStepIndex >= 0 ? currentStepIndex + 1 : currentStep} / {stepsForProgress.length}
            </span>
          </div>
        </div>

        {/* Current Step Content */}
        <div className="space-y-4 py-2 flex-1 overflow-hidden flex flex-col min-h-0">
           {/* Video Section */}
           <div className="h-[400px] flex-shrink-0">
             <VideoPlayer
               key={`${currentStep}-${currentStepData.videoUrl}`}
               url={currentStepData.videoUrl}
               placeholder={currentStepData.videoPlaceholder || "Video will be available soon"}
               autoPlay={autoPlay}
               muted
               loop
               className="h-full aspect-auto"
               onStatusChange={({ loading, error }) => {
                 if (error) handleVideoError();
                 else if (loading) handleVideoLoadStart();
                 else handleVideoLoad();
               }}
             />
           </div>

          {/* Step Title and Description */}
          <div className="space-y-1 flex-shrink-0">
            <h3 className="text-lg font-semibold text-foreground">{currentStepData.title}</h3>
            <p className="text-sm text-muted-foreground whitespace-pre-line">{currentStepData.description}</p>
          </div>

          {/* Instructions List - Two Columns */}
          <div className="space-y-2 flex-1 min-h-0">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Instructions:
            </h4>
            {currentStepData.instructions && Array.isArray(currentStepData.instructions) && currentStepData.instructions.length > 0 ? (
              <ul className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                {currentStepData.instructions.map((instruction, index) => (
                  <li key={index} className="flex items-start gap-2 text-muted-foreground">
                    <div className="mt-0.5 w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-[#D3BC8D] text-xs font-bold">{index + 1}</span>
                    </div>
                    <span className="flex-1 leading-relaxed">{instruction}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground italic">No instructions available for this step.</p>
            )}
          </div>
        </div>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between gap-4 pt-3 border-t border-gray-800 flex-shrink-0">
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleClose}
              className="border-border text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            >
              Skip Tutorial
            </Button>
            {!isFirstStep && (
              <Button
                variant="outline"
                onClick={previousStep}
                className="border-border text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              >
                <ChevronLeft className="w-4 h-4 mr-2" />
                Previous
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            {currentStepData.actionButton && currentStepData.actionButton.label !== "Coming Soon" && (
              <Button
                onClick={handleActionClick}
                variant="outline"
                className="border-primary/30 text-[#D3BC8D] hover:bg-primary/10"
              >
                <Play className="w-4 h-4 mr-2" />
                {currentStepData.actionButton.label}
              </Button>
            )}
            {!isLastStep ? (
              <Button
                onClick={() => {
                  markStepComplete(currentStep);
                  nextStep();
                }}
                className="bg-primary text-black hover:bg-primary/80"
              >
                Next
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button
                onClick={() => {
                  markStepComplete(currentStep);
                  nextStep(); // This will complete the tutorial
                }}
                className="bg-green-600 text-foreground hover:bg-green-700"
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Complete Tutorial
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
