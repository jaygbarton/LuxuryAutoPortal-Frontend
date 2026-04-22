import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { PlayCircle, Edit, Trash2, Plus, Loader2, Save, X, Video, CheckCircle2, AlertCircle, RotateCcw, Archive } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { OnboardingTutorial, useTutorial, TutorialStep, TutorialModule } from "@/components/onboarding/OnboardingTutorial";
import { buildApiUrl } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { VideoPlayer } from "@/components/ui/video-player";
import { parseVideoSource } from "@/lib/video-utils";

// Check if user is admin
function useIsAdmin() {
  const { data: userData } = useQuery<{ user?: { isAdmin?: boolean } }>({
    queryKey: ["/api/auth/me"],
    retry: false,
  });
  return userData?.user?.isAdmin === true;
}

// Form schema for tutorial step
const tutorialStepSchema = z.object({
  role: z.enum(['admin', 'client', 'employee']),
  moduleId: z.number().optional(),
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  videoUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  videoPlaceholder: z.string().optional(),
  instructions: z.array(z.string().min(1, "Instruction cannot be empty")).min(1, "At least one instruction is required"),
  actionButtonLabel: z.string().optional(),
  actionButtonHref: z.string().optional(),
});

// Form schema for tutorial module
const tutorialModuleSchema = z.object({
  role: z.enum(['admin', 'client', 'employee']),
  moduleOrder: z.number().min(1, "Module order is required"),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
});

type TutorialStepFormData = z.infer<typeof tutorialStepSchema>;
type TutorialModuleFormData = z.infer<typeof tutorialModuleSchema>;

export default function TrainingManualPage() {
  const { isOpen: tutorialOpen, openTutorial, closeTutorial, resetTutorial, startTutorialFromModule } = useTutorial();
  
  // Handler for Start Tutorial button
  const handleStartTutorial = () => {
    // Reset tutorial - this sets isOpen to true in context
    resetTutorial();
  };

  // Start tutorial from a specific module (Module 1, 2, 3...)
  const handleStartModuleTutorial = (moduleId: number) => {
    void startTutorialFromModule(moduleId);
  };
  const isAdmin = useIsAdmin();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingStep, setEditingStep] = useState<TutorialStep | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAddingStep, setIsAddingStep] = useState(false);
  const [instructionInput, setInstructionInput] = useState("");
  const [deletingStepId, setDeletingStepId] = useState<number | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [videoValid, setVideoValid] = useState<boolean | null>(null);
  const [selectedRole, setSelectedRole] = useState<'admin' | 'client' | 'employee'>('client');

  // Video state for each step (for inline video display)
  const [stepVideoStates, setStepVideoStates] = useState<Record<number, { loading: boolean; error: boolean }>>({});
  
  // Module management state
  const [editingModule, setEditingModule] = useState<TutorialModule | null>(null);
  const [isModuleDialogOpen, setIsModuleDialogOpen] = useState(false);
  const [isAddingModule, setIsAddingModule] = useState(false);
  const [deletingModuleId, setDeletingModuleId] = useState<number | null>(null);
  const [expandedModules, setExpandedModules] = useState<Set<number>>(new Set());

  // Fetch tutorial modules for selected role
  const { data: tutorialModulesData, isLoading: modulesLoading } = useQuery<{ success: boolean; data: TutorialModule[] }>({
    queryKey: ["/api/tutorial/modules", selectedRole],
    queryFn: async () => {
      const response = await fetch(buildApiUrl(`/api/tutorial/modules?role=${selectedRole}`), {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch tutorial modules");
      }
      const data = await response.json();
      return data;
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    retry: 1,
    placeholderData: keepPreviousData,
  });

  // Fetch tutorial steps grouped by modules for selected role
  const { data: tutorialStepsData, isLoading, isError, isFetching } = useQuery<{ success: boolean; data: { modules: Array<TutorialModule & { steps: TutorialStep[] }> } | TutorialStep[] }>({
    queryKey: ["/api/tutorial/steps", selectedRole, "with-modules"],
    queryFn: async () => {
      const response = await fetch(buildApiUrl(`/api/tutorial/steps?role=${selectedRole}&includeModules=true`), {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch tutorial steps");
      }
      const data = await response.json();
      return data;
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    retry: 1,
    placeholderData: keepPreviousData,
  });

  // Safely extract tutorial modules
  const tutorialModules = tutorialModulesData?.success 
    ? (tutorialModulesData?.data || [])
    : (Array.isArray(tutorialModulesData) ? tutorialModulesData : []);

  // Extract steps grouped by modules or flat list
  const tutorialDataWithModules = tutorialStepsData?.success && tutorialStepsData?.data
    ? (typeof tutorialStepsData.data === 'object' && 'modules' in tutorialStepsData.data
        ? tutorialStepsData.data
        : { modules: [] })
    : { modules: [] };

  // Flatten all steps for backwards compatibility
  const allSteps: TutorialStep[] = tutorialDataWithModules.modules.flatMap((module: any) => module.steps || []);

  // Create tutorial step mutation
  const createMutation = useMutation({
    mutationFn: async ({ stepOrder, data }: { stepOrder: number; data: TutorialStepFormData }) => {
      const response = await fetch(buildApiUrl("/api/admin/tutorial/steps"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          role: data.role || selectedRole,
          moduleId: data.moduleId || undefined,
          stepOrder,
          title: data.title,
          description: data.description,
          videoUrl: data.videoUrl || undefined,
          videoPlaceholder: data.videoPlaceholder || undefined,
          instructions: data.instructions,
          actionButton: data.actionButtonLabel ? {
            label: data.actionButtonLabel,
            href: data.actionButtonHref || undefined,
          } : undefined,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create tutorial step");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tutorial/steps", selectedRole] });
      queryClient.invalidateQueries({ queryKey: ["/api/tutorial/modules", selectedRole] });
      queryClient.refetchQueries({ queryKey: ["/api/tutorial/steps", selectedRole, "with-modules"] });
      toast({
        title: "Success",
        description: "Tutorial step created successfully",
      });
      setIsEditDialogOpen(false);
      setIsAddingStep(false);
      setEditingStep(null);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create tutorial step",
        variant: "destructive",
      });
    },
  });

  // Delete tutorial step mutation
  const deleteMutation = useMutation({
    mutationFn: async (stepId: number) => {
      const response = await fetch(buildApiUrl(`/api/admin/tutorial/steps/${stepId}?role=${selectedRole}`), {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete tutorial step");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tutorial/steps", selectedRole] });
      queryClient.refetchQueries({ queryKey: ["/api/tutorial/steps", selectedRole] }); // Force immediate refetch
      toast({
        title: "Success",
        description: "Tutorial step deleted successfully",
      });
      setDeletingStepId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete tutorial step",
        variant: "destructive",
      });
    },
  });

  // Update tutorial step mutation
  const updateMutation = useMutation({
    mutationFn: async ({ stepId, data }: { stepId: number; data: TutorialStepFormData }) => {
      const response = await fetch(buildApiUrl(`/api/admin/tutorial/steps/${stepId}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          role: data.role || selectedRole,
          moduleId: data.moduleId || undefined,
          title: data.title,
          description: data.description,
          videoUrl: data.videoUrl || undefined,
          videoPlaceholder: data.videoPlaceholder || undefined,
          instructions: data.instructions,
          actionButton: data.actionButtonLabel ? {
            label: data.actionButtonLabel,
            href: data.actionButtonHref || undefined,
          } : undefined,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update tutorial step");
      }
      return response.json();
    },
    onSuccess: (_, variables) => {
      const roleUsed = variables.data.role || selectedRole;
      const originalRole = editingStep ? (editingStep as any).role || selectedRole : selectedRole;
      queryClient.invalidateQueries({ queryKey: ["/api/tutorial/steps", roleUsed] });
      queryClient.invalidateQueries({ queryKey: ["/api/tutorial/steps", originalRole] });
      queryClient.invalidateQueries({ queryKey: ["/api/tutorial/steps", selectedRole, "with-modules"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tutorial/modules", selectedRole] });
      toast({
        title: "Success",
        description: "Tutorial step updated successfully",
      });
      setIsEditDialogOpen(false);
      setIsAddingStep(false);
      setEditingStep(null);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update tutorial step",
        variant: "destructive",
      });
    },
  });

  // Module mutations
  const createModuleMutation = useMutation({
    mutationFn: async (data: TutorialModuleFormData) => {
      const response = await fetch(buildApiUrl("/api/admin/tutorial/modules"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create module");
      }
      return response.json();
    },
    onSuccess: () => {
      // Invalidate all role queries to refresh the list
      queryClient.invalidateQueries({ queryKey: ["/api/tutorial/modules"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tutorial/steps"] });
      toast({
        title: "Success",
        description: "Module created successfully",
      });
      setIsModuleDialogOpen(false);
      setIsAddingModule(false);
      setEditingModule(null);
      moduleForm.reset({
        role: selectedRole,
        moduleOrder: 1,
        title: "",
        description: "",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create module",
        variant: "destructive",
      });
    },
  });

  const updateModuleMutation = useMutation({
    mutationFn: async ({ moduleId, data }: { moduleId: number; data: TutorialModuleFormData }) => {
      const response = await fetch(buildApiUrl(`/api/admin/tutorial/modules/${moduleId}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update module");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tutorial/modules", selectedRole] });
      queryClient.invalidateQueries({ queryKey: ["/api/tutorial/steps", selectedRole, "with-modules"] });
      toast({
        title: "Success",
        description: "Module updated successfully",
      });
      setIsModuleDialogOpen(false);
      setIsAddingModule(false);
      setEditingModule(null);
      moduleForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update module",
        variant: "destructive",
      });
    },
  });

  const deleteModuleMutation = useMutation({
    mutationFn: async (moduleId: number) => {
      const response = await fetch(buildApiUrl(`/api/admin/tutorial/modules/${moduleId}`), {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete module");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tutorial/modules", selectedRole] });
      queryClient.invalidateQueries({ queryKey: ["/api/tutorial/modules/deleted", selectedRole] });
      queryClient.invalidateQueries({ queryKey: ["/api/tutorial/steps", selectedRole, "with-modules"] });
      toast({
        title: "Module moved to Deleted Modules",
        description: "The module can be restored from the Deleted Modules section.",
      });
      setDeletingModuleId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete module",
        variant: "destructive",
      });
    },
  });

  // Deleted modules query
  const { data: deletedModulesData } = useQuery<{ success: boolean; data: TutorialModule[] }>({
    queryKey: ["/api/tutorial/modules/deleted", selectedRole],
    queryFn: async () => {
      const response = await fetch(
        buildApiUrl(`/api/admin/tutorial/modules/deleted?role=${selectedRole}`),
        { credentials: "include" }
      );
      if (!response.ok) {
        throw new Error("Failed to fetch deleted modules");
      }
      return response.json();
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    retry: 1,
    placeholderData: keepPreviousData,
  });

  const deletedModules: Array<TutorialModule & { deletedAt?: string; stepsCount?: number }> =
    deletedModulesData?.success ? (deletedModulesData?.data || []) as any : [];

  const restoreModuleMutation = useMutation({
    mutationFn: async (moduleId: number) => {
      const response = await fetch(
        buildApiUrl(`/api/admin/tutorial/modules/${moduleId}/restore`),
        { method: "POST", credentials: "include" }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to restore module");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tutorial/modules", selectedRole] });
      queryClient.invalidateQueries({ queryKey: ["/api/tutorial/modules/deleted", selectedRole] });
      queryClient.invalidateQueries({ queryKey: ["/api/tutorial/steps", selectedRole, "with-modules"] });
      toast({
        title: "Module restored",
        description: "The module and its steps are available again.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to restore module",
        variant: "destructive",
      });
    },
  });

  const permanentDeleteModuleMutation = useMutation({
    mutationFn: async (moduleId: number) => {
      const response = await fetch(
        buildApiUrl(`/api/admin/tutorial/modules/${moduleId}/permanent`),
        { method: "DELETE", credentials: "include" }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to permanently delete module");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tutorial/modules/deleted", selectedRole] });
      queryClient.invalidateQueries({ queryKey: ["/api/tutorial/modules", selectedRole] });
      queryClient.invalidateQueries({ queryKey: ["/api/tutorial/steps", selectedRole, "with-modules"] });
      toast({
        title: "Module permanently deleted",
        description: "This action cannot be undone.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to permanently delete module",
        variant: "destructive",
      });
    },
  });

  const seedEmployeeMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(buildApiUrl("/api/admin/tutorial/seed-employee"), {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to seed employee tutorial");
      }
      return response.json();
    },
    onSuccess: (data: { message?: string }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tutorial/modules", "employee"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tutorial/steps", "employee", "with-modules"] });
      toast({
        title: "Success",
        description: data?.message || "Employee tutorial guide seeded. Employee accounts will see it in System Tutorial.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to seed",
        variant: "destructive",
      });
    },
  });

  const form = useForm<TutorialStepFormData>({
    resolver: zodResolver(tutorialStepSchema),
    defaultValues: {
      role: selectedRole,
      moduleId: undefined,
      title: "",
      description: "",
      videoUrl: "",
      videoPlaceholder: "",
      instructions: [],
      actionButtonLabel: "",
      actionButtonHref: "",
    },
  });

  // Update form when selectedRole changes (for new steps only)
  useEffect(() => {
    if (!isEditDialogOpen && !editingStep && isAddingStep) {
      form.setValue("role", selectedRole);
      form.setValue("moduleId", undefined);
    }
  }, [selectedRole, isEditDialogOpen, editingStep, isAddingStep, form]);

  const moduleForm = useForm<TutorialModuleFormData>({
    resolver: zodResolver(tutorialModuleSchema),
    defaultValues: {
      role: selectedRole,
      moduleOrder: 1,
      title: "",
      description: "",
    },
  });

  // Update module form role when selectedRole changes (only when not editing)
  useEffect(() => {
    if (!isModuleDialogOpen && !editingModule) {
      moduleForm.setValue("role", selectedRole);
    }
  }, [selectedRole, isModuleDialogOpen, editingModule, moduleForm]);

  // Test video URL validity (supports YouTube, Vimeo, and direct files)
  const testVideoUrl = async (url: string) => {
    setVideoLoading(true);
    setVideoError(null);
    setVideoValid(null);

    try {
      new URL(url);
    } catch {
      setVideoLoading(false);
      setVideoValid(false);
      setVideoError("Invalid URL format. Please enter a valid video URL.");
      return;
    }

    const source = parseVideoSource(url);

    // YouTube / Vimeo can't be probed with a <video> element — trust the URL
    // if we can parse a valid video ID out of it.
    if (source.type === "youtube" || source.type === "vimeo") {
      setVideoLoading(false);
      setVideoValid(true);
      setVideoError(null);
      return;
    }

    if (source.type === "unknown") {
      setVideoLoading(false);
      setVideoValid(false);
      setVideoError(
        "Unsupported video URL. Use a YouTube/Vimeo link or a direct video file (.mp4, .webm, etc.)."
      );
      return;
    }

    // Direct file — verify it actually loads.
    const video = document.createElement("video");
    video.src = source.url;
    video.muted = true;

    video.oncanplay = () => {
      setVideoLoading(false);
      setVideoValid(true);
      setVideoError(null);
    };

    video.onerror = () => {
      setVideoLoading(false);
      setVideoValid(false);
      setVideoError("Video failed to load. Please check the URL is accessible.");
    };

    setTimeout(() => {
      if (video.readyState === 0) {
        setVideoLoading(false);
        setVideoValid(false);
        setVideoError(
          "Video is taking too long to load. URL may be invalid or inaccessible."
        );
      }
    }, 5000);
  };

  const handleEditClick = (step: TutorialStep & { role?: string; moduleId?: number }) => {
    setEditingStep(step);
    setIsAddingStep(false);
    const videoUrl = step.videoUrl || "";
    form.reset({
      role: (step as any).role || selectedRole,
      moduleId: (step as any).moduleId || undefined,
      title: step.title,
      description: step.description,
      videoUrl: videoUrl,
      videoPlaceholder: step.videoPlaceholder || "",
      instructions: step.instructions || [],
      actionButtonLabel: step.actionButton?.label || "",
      actionButtonHref: step.actionButton?.href || "",
    });
    setInstructionInput("");
    if (videoUrl) {
      setVideoPreviewUrl(videoUrl);
      testVideoUrl(videoUrl);
    } else {
      setVideoPreviewUrl(null);
      setVideoValid(null);
      setVideoError(null);
    }
    setIsEditDialogOpen(true);
  };

  const handleAddModuleClick = () => {
    setEditingModule(null);
    setIsAddingModule(true);
    // Calculate next order based on modules for the selected role
    const roleModules = tutorialModules.filter(m => m.role === selectedRole);
    const nextOrder = roleModules.length > 0 
      ? Math.max(...roleModules.map(m => m.moduleOrder)) + 1 
      : 1;
    moduleForm.reset({
      role: selectedRole,
      moduleOrder: nextOrder,
      title: "",
      description: "",
    });
    setIsModuleDialogOpen(true);
  };

  const handleEditModuleClick = (module: TutorialModule) => {
    setEditingModule(module);
    setIsAddingModule(false);
    moduleForm.reset({
      role: module.role,
      moduleOrder: module.moduleOrder,
      title: module.title,
      description: module.description || "",
    });
    setIsModuleDialogOpen(true);
  };

  const handleModuleSubmit = (data: TutorialModuleFormData) => {
    // Validate module order is a positive integer
    if (!data.moduleOrder || data.moduleOrder < 1) {
      toast({
        title: "Validation Error",
        description: "Module order must be at least 1",
        variant: "destructive",
      });
      return;
    }

    // Validate title is not empty
    if (!data.title || data.title.trim() === "") {
      toast({
        title: "Validation Error",
        description: "Module title is required",
        variant: "destructive",
      });
      return;
    }

    if (isAddingModule) {
      createModuleMutation.mutate(data);
    } else if (editingModule) {
      updateModuleMutation.mutate({ moduleId: editingModule.id, data });
    }
  };

  const toggleModule = (moduleId: number) => {
    const newExpanded = new Set(expandedModules);
    if (newExpanded.has(moduleId)) {
      newExpanded.delete(moduleId);
    } else {
      newExpanded.add(moduleId);
    }
    setExpandedModules(newExpanded);
  };

  const handleAddStepClick = (moduleId?: number) => {
    setEditingStep(null);
    setIsAddingStep(true);
    // Calculate next step order based on existing steps for the selected role
    const roleSteps = allSteps.filter(s => (s as any).role === selectedRole);
    const nextStepOrder = roleSteps.length > 0 
      ? Math.max(...roleSteps.map(s => (s as any).stepOrder || s.id)) + 1 
      : 1;
    form.reset({
      role: selectedRole,
      moduleId: moduleId || undefined,
      title: "",
      description: "",
      videoUrl: "",
      videoPlaceholder: "",
      instructions: [],
      actionButtonLabel: "",
      actionButtonHref: "",
    });
    setInstructionInput("");
    setVideoPreviewUrl(null);
    setVideoValid(null);
    setVideoError(null);
    setIsEditDialogOpen(true);
  };

  const handleAddInstruction = () => {
    if (instructionInput.trim()) {
      const currentInstructions = form.getValues("instructions");
      form.setValue("instructions", [...currentInstructions, instructionInput.trim()]);
      setInstructionInput("");
    }
  };

  const handleRemoveInstruction = (index: number) => {
    const currentInstructions = form.getValues("instructions");
    form.setValue("instructions", currentInstructions.filter((_, i) => i !== index));
  };

  const onSubmit = (data: TutorialStepFormData) => {
    if (isAddingStep) {
      // Calculate next step order based on existing steps for the same role
      const roleSteps = allSteps.filter(s => (s as any).role === data.role);
      const maxOrder = roleSteps.length > 0 
        ? Math.max(...roleSteps.map(step => (step as any).stepOrder || step.id))
        : 0;
      const nextOrder = maxOrder + 1;
      createMutation.mutate({ stepOrder: nextOrder, data });
    } else if (editingStep) {
      updateMutation.mutate({ stepId: editingStep.id, data });
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-serif text-primary italic mb-2">System Tutorial</h1>
          <p className="text-muted-foreground text-sm">Learn how to use the GLA portal with our guided tutorial</p>
        </div>

        {/* Help & Tutorials Section */}
        <Card className="bg-background border-border">
          <CardHeader>
            <CardTitle className="text-primary text-xl">Help & Tutorials</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-foreground font-medium">System Tutorial</p>
                <p className="text-muted-foreground text-sm">
                  Learn how to use the GLA portal with our guided tutorial
                </p>
              </div>
              <Button
                onClick={handleStartTutorial}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <PlayCircle className="w-4 h-4 mr-2" />
                Start Tutorial
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Admin Tutorial Management Section */}
        {isAdmin && (
          <Card className="bg-background border-border">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-primary text-xl">Tutorial Configuration</CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-muted-foreground">Manage tutorial (modules, steps, videos) by role:</span>
                  <Select value={selectedRole} onValueChange={(value: 'admin' | 'client' | 'employee') => {
                    setSelectedRole(value);
                    setExpandedModules(new Set()); // Reset expanded modules when role changes
                  }}>
                    <SelectTrigger className="w-[150px] bg-card border-border text-foreground">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border text-foreground">
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="client">Client</SelectItem>
                      <SelectItem value="employee">Employee</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={handleAddModuleClick}
                    className="bg-primary text-primary-foreground hover:bg-primary/80 font-medium"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Module
                  </Button>
                  <Button
                    onClick={() => handleAddStepClick()}
                    className="bg-primary text-primary-foreground hover:bg-primary/80 font-medium"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Step
                  </Button>
                  {selectedRole === "employee" && (
                    <Button
                      type="button"
                      variant="outline"
                      className="border-primary text-primary hover:bg-primary/10 font-medium"
                      onClick={() => seedEmployeeMutation.mutate()}
                      disabled={seedEmployeeMutation.isPending}
                    >
                      {seedEmployeeMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                      Seed employee tutorial guide
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading || modulesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : isError ? (
                <div className="text-center py-8">
                  <p className="text-red-700 mb-4">Error loading tutorial data. Please try refreshing the page.</p>
                </div>
              ) : (tutorialDataWithModules.modules.length === 0 && allSteps.length === 0 && !isFetching && !isLoading) ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">No modules or steps found. Click "Add Module" or "Add Step" to get started.</p>
                  {selectedRole === "employee" && (
                    <p className="text-sm text-muted-foreground">Or use <strong>Seed employee tutorial guide</strong> above to add the default employee onboarding tutorial (1 module, 4 steps with videos) so it appears for employee accounts.</p>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Display modules with their steps */}
                  {tutorialDataWithModules.modules.length > 0 && tutorialDataWithModules.modules.map((module: any) => {
                    const isExpanded = expandedModules.has(module.id);
                    const moduleSteps = module.steps || [];
                    return (
                      <Card key={module.id} className="bg-card border-border">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 flex-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleModule(module.id)}
                                className="text-primary hover:bg-primary/10"
                              >
                                {isExpanded ? (
                                  <X className="w-4 h-4" />
                                ) : (
                                  <Plus className="w-4 h-4" />
                                )}
                              </Button>
                              <Badge variant="outline" className="bg-[#D3BC8D]/20 text-primary border-primary/30">
                                Module {module.moduleOrder}
                              </Badge>
                              <div className="flex-1">
                                <h3 className="text-lg font-semibold text-foreground">{module.title}</h3>
                                {module.description && (
                                  <p className="text-sm text-muted-foreground mt-1 whitespace-pre-line">{module.description}</p>
                                )}
                                <p className="text-xs text-muted-foreground mt-1">
                                  {moduleSteps.length} {moduleSteps.length !== 1 ? 'steps' : 'step'}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleStartModuleTutorial(module.id)}
                                disabled={moduleSteps.length === 0}
                                className="bg-primary text-primary-foreground hover:bg-primary/80 font-medium"
                                title={moduleSteps.length === 0 ? "Add a step before starting this module" : `Start tutorial from Module ${module.moduleOrder}`}
                              >
                                <PlayCircle className="w-4 h-4 mr-2" />
                                Start Tutorial
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditModuleClick(module)}
                                className="text-primary hover:bg-primary/10"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <ConfirmDialog
                                trigger={
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-red-700 hover:bg-red-500/10"
                                    disabled={deleteModuleMutation.isPending && deletingModuleId === module.id}
                                  >
                                    {deleteModuleMutation.isPending && deletingModuleId === module.id ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <Trash2 className="w-4 h-4" />
                                    )}
                                  </Button>
                                }
                                title="Delete Module"
                                description={`Are you sure you want to delete "${module.title}"? This will also delete all steps in this module. This action cannot be undone.`}
                                confirmText="Delete"
                                cancelText="Cancel"
                                variant="destructive"
                                onConfirm={() => {
                                  setDeletingModuleId(module.id);
                                  deleteModuleMutation.mutate(module.id);
                                }}
                              />
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleAddStepClick(module.id)}
                                className="text-primary hover:bg-primary/10"
                                title="Add step to this module"
                              >
                                <Plus className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        {isExpanded && (
                          <CardContent className="pt-0">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                              {moduleSteps.length === 0 ? (
                                <div className="col-span-2 text-center py-4 text-muted-foreground text-sm">
                                  No steps in this module. Click the + button to add a step.
                                </div>
                              ) : (
                                moduleSteps.map((step: TutorialStep, stepIndex: number) => (
                                  <Card key={step.id} className="bg-card border-border hover:border-primary/30 transition-colors">
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-4">
                            {/* Step Header */}
                            <div className="flex items-center gap-3">
                              <Badge variant="outline" className="bg-[#D3BC8D]/20 text-primary border-primary/30 text-sm font-semibold px-3 py-1">
                                Step {stepIndex + 1}
                              </Badge>
                              <h3 className="text-xl font-semibold text-foreground">{step.title}</h3>
                            </div>

                            {/* Description */}
                            <div>
                              <p className="text-sm font-medium text-muted-foreground mb-1">Description:</p>
                              <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-line">{step.description}</p>
                            </div>

                                          {/* Video Display */}
                            {(step.videoUrl || step.videoPlaceholder) && (
                              <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                  <Video className="w-4 h-4 text-primary" />
                                                <p className="text-sm font-medium text-muted-foreground">Video:</p>
                                </div>

                                              <VideoPlayer
                                                url={step.videoUrl}
                                                placeholder={step.videoPlaceholder}
                                                onStatusChange={(status) =>
                                                  setStepVideoStates(prev => ({
                                                    ...prev,
                                                    [step.id]: status,
                                                  }))
                                                }
                                              />

                                              {/* Video URL Info (if video is available) */}
                                              {step.videoUrl && !stepVideoStates[step.id]?.error && (
                                  <div className="space-y-2">
                                    <div>
                                      <p className="text-xs text-muted-foreground mb-1">Video URL:</p>
                                      <div className="flex items-center gap-2">
                                        <p className="text-xs text-muted-foreground break-all bg-background p-2 rounded border border-border flex-1">
                                          {step.videoUrl}
                                        </p>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => {
                                            window.open(step.videoUrl, "_blank");
                                          }}
                                          className="text-primary hover:text-primary hover:bg-primary/10"
                                          title="Open video in new tab"
                                        >
                                          <PlayCircle className="w-4 h-4" />
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Instructions */}
                            {step.instructions && step.instructions.length > 0 && (
                              <div>
                                <p className="text-sm font-medium text-muted-foreground mb-2">
                                  Instructions ({step.instructions.length}):
                                </p>
                                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1.5 bg-background p-3 rounded border border-border">
                                  {step.instructions.map((instruction, idx) => (
                                    <li key={idx} className="leading-relaxed">{instruction}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Action Button */}
                            {step.actionButton && (
                              <div>
                                <p className="text-sm font-medium text-muted-foreground mb-1">Action Button:</p>
                                <div className="flex items-center gap-2 bg-background p-2 rounded border border-border">
                                  <Badge variant="outline" className="bg-[#D3BC8D]/10 text-primary border-primary/30">
                                    {step.actionButton.label}
                                  </Badge>
                                  {step.actionButton.href && (
                                    <span className="text-xs text-muted-foreground">
                                      → {step.actionButton.href}
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Action Buttons */}
                          <div className="flex flex-col items-center gap-2 pt-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditClick(step)}
                              className="text-primary hover:text-primary hover:bg-primary/10 border border-primary/20"
                              title="Edit Step"
                            >
                              <Edit className="w-4 h-4 mr-2" />
                              Edit
                            </Button>
                            <ConfirmDialog
                              trigger={
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-700 hover:text-red-500 hover:bg-red-500/10 border border-red-500/20"
                                  title="Delete Step"
                                                disabled={deleteMutation.isPending && deletingStepId === step.id}
                                              >
                                                {deleteMutation.isPending && deletingStepId === step.id ? (
                                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                ) : (
                                                  <Trash2 className="w-4 h-4 mr-2" />
                                                )}
                                                Delete
                                              </Button>
                                            }
                                            title="Delete Tutorial Step"
                                            description={`Are you sure you want to delete "${step.title}"? This action cannot be undone.`}
                                            confirmText="Delete"
                                            cancelText="Cancel"
                                            variant="destructive"
                                            onConfirm={() => {
                                              setDeletingStepId(step.id);
                                              deleteMutation.mutate(step.id);
                                            }}
                                          />
                                        </div>
                                      </div>
                                    </CardContent>
                                  </Card>
                                ))
                              )}
                            </div>
                          </CardContent>
                        )}
                      </Card>
                    );
                  })}
                  
                  {/* Display steps without modules */}
                  {(() => {
                    const stepsWithoutModule = allSteps.filter((step: any) => !step.moduleId);
                    return stepsWithoutModule.length > 0 && (
                      <Card className="bg-card border-border">
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="text-lg font-semibold text-foreground">Steps without Module</h3>
                              <p className="text-xs text-muted-foreground mt-1">
                                {stepsWithoutModule.length} {stepsWithoutModule.length !== 1 ? 'steps' : 'step'}
                              </p>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {stepsWithoutModule.map((step: TutorialStep, stepIndex: number) => (
                            <Card key={step.id} className="bg-card border-border hover:border-primary/30 transition-colors">
                              <CardContent className="p-6">
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex-1 space-y-4">
                                    <div className="flex items-center gap-3">
                                      <Badge variant="outline" className="bg-[#D3BC8D]/20 text-primary border-primary/30 text-sm font-semibold px-3 py-1">
                                        Step {stepIndex + 1}
                                      </Badge>
                                      <h3 className="text-xl font-semibold text-foreground">{step.title}</h3>
                                    </div>
                                    <div>
                                      <p className="text-sm font-medium text-muted-foreground mb-1">Description:</p>
                                      <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-line">{step.description}</p>
                                    </div>

                                    {/* Video Display */}
                                    {(step.videoUrl || step.videoPlaceholder) && (
                                      <div className="space-y-3">
                                        <div className="flex items-center gap-2">
                                          <Video className="w-4 h-4 text-primary" />
                                          <p className="text-sm font-medium text-muted-foreground">Video:</p>
                                        </div>

                                        <VideoPlayer
                                          url={step.videoUrl}
                                          placeholder={step.videoPlaceholder}
                                          onStatusChange={(status) =>
                                            setStepVideoStates(prev => ({
                                              ...prev,
                                              [step.id]: status,
                                            }))
                                          }
                                        />

                                        {/* Video URL Info (if video is available) */}
                                        {step.videoUrl && !stepVideoStates[step.id]?.error && (
                                          <div className="space-y-2">
                                            <div>
                                              <p className="text-xs text-muted-foreground mb-1">Video URL:</p>
                                              <div className="flex items-center gap-2">
                                                <p className="text-xs text-muted-foreground break-all bg-background p-2 rounded border border-border flex-1">
                                                  {step.videoUrl}
                                                </p>
                                                <Button
                                                  type="button"
                                                  variant="ghost"
                                                  size="sm"
                                                  onClick={() => {
                                                    window.open(step.videoUrl, "_blank");
                                                  }}
                                                  className="text-primary hover:text-primary hover:bg-primary/10"
                                                  title="Open video in new tab"
                                                >
                                                  <PlayCircle className="w-4 h-4" />
                                                </Button>
                                              </div>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex flex-col items-center gap-2 pt-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleEditClick(step)}
                                      className="text-primary hover:text-primary hover:bg-primary/10 border border-primary/20"
                                    >
                                      <Edit className="w-4 h-4 mr-2" />
                                      Edit
                                    </Button>
                                    <ConfirmDialog
                                      trigger={
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="text-red-700 hover:text-red-500 hover:bg-red-500/10 border border-red-500/20"
                                  disabled={deleteMutation.isPending && deletingStepId === step.id}
                                >
                                  {deleteMutation.isPending && deletingStepId === step.id ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  ) : (
                                    <Trash2 className="w-4 h-4 mr-2" />
                                  )}
                                  Delete
                                </Button>
                              }
                              title="Delete Tutorial Step"
                              description={`Are you sure you want to delete "${step.title}"? This action cannot be undone.`}
                              confirmText="Delete"
                              cancelText="Cancel"
                              variant="destructive"
                              onConfirm={() => {
                                setDeletingStepId(step.id);
                                deleteMutation.mutate(step.id);
                              }}
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })()}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Deleted Modules Section */}
        {isAdmin && deletedModules.length > 0 && (
          <Card className="bg-background border-border border-dashed">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Archive className="w-5 h-5 text-muted-foreground" />
                <CardTitle className="text-muted-foreground text-xl">
                  Deleted Modules ({selectedRole})
                </CardTitle>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Modules here are hidden from users but not permanently deleted. You can restore
                them or remove them permanently.
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {deletedModules.map((module) => {
                  const isRestoring =
                    restoreModuleMutation.isPending &&
                    (restoreModuleMutation.variables as any) === module.id;
                  const isPermDeleting =
                    permanentDeleteModuleMutation.isPending &&
                    (permanentDeleteModuleMutation.variables as any) === module.id;
                  return (
                    <Card
                      key={module.id}
                      className="bg-card border-border opacity-90"
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <Badge
                              variant="outline"
                              className="bg-muted text-muted-foreground border-muted-foreground/30"
                            >
                              Module {module.moduleOrder}
                            </Badge>
                            <div className="flex-1 min-w-0">
                              <h3 className="text-base font-semibold text-foreground truncate">
                                {module.title}
                              </h3>
                              {module.description && (
                                <p className="text-xs text-muted-foreground truncate mt-0.5">
                                  {module.description}
                                </p>
                              )}
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {module.stepsCount ?? 0}{" "}
                                {module.stepsCount === 1 ? "step" : "steps"}
                                {module.deletedAt && (
                                  <>
                                    {" · deleted "}
                                    {new Date(module.deletedAt).toLocaleString()}
                                  </>
                                )}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2 flex-shrink-0">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => restoreModuleMutation.mutate(module.id)}
                              disabled={isRestoring}
                              className="text-primary hover:bg-primary/10 border border-primary/20"
                              title="Restore module"
                            >
                              {isRestoring ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              ) : (
                                <RotateCcw className="w-4 h-4 mr-2" />
                              )}
                              Restore
                            </Button>
                            <ConfirmDialog
                              trigger={
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-700 hover:text-red-500 hover:bg-red-500/10 border border-red-500/20"
                                  disabled={isPermDeleting}
                                  title="Permanently delete module"
                                >
                                  {isPermDeleting ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  ) : (
                                    <Trash2 className="w-4 h-4 mr-2" />
                                  )}
                                  Remove Permanently
                                </Button>
                              }
                              title="Permanently Delete Module"
                              description={`This will permanently delete "${module.title}" and all of its steps. This action cannot be undone. Are you sure?`}
                              confirmText="Delete Permanently"
                              cancelText="Cancel"
                              variant="destructive"
                              onConfirm={() =>
                                permanentDeleteModuleMutation.mutate(module.id)
                              }
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Add/Edit Module Dialog */}
        <Dialog open={isModuleDialogOpen}         onOpenChange={(open) => {
          if (!open) {
            setIsModuleDialogOpen(false);
            setIsAddingModule(false);
            setEditingModule(null);
            moduleForm.reset({
              role: selectedRole,
              moduleOrder: 1,
              title: "",
              description: "",
            });
          }
        }}>
          <DialogContent className="bg-card border-border text-foreground max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold text-primary">
                {isAddingModule ? "Add New Module" : `Edit Module ${editingModule?.id}`}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                {isAddingModule 
                  ? "Create a new tutorial module to organize tutorial steps"
                  : "Update the module information"}
              </DialogDescription>
            </DialogHeader>

            <Form {...moduleForm}>
              <form onSubmit={moduleForm.handleSubmit(handleModuleSubmit)} className="space-y-4 mt-4">
                <FormField
                  control={moduleForm.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-muted-foreground">Role *</FormLabel>
                      <Select 
                        value={field.value} 
                        onValueChange={(value) => {
                          field.onChange(value);
                          // When role changes, recalculate module order for that role
                          const roleModules = tutorialModules.filter(m => m.role === value);
                          const nextOrder = roleModules.length > 0 
                            ? Math.max(...roleModules.map(m => m.moduleOrder)) + 1 
                            : 1;
                          moduleForm.setValue("moduleOrder", nextOrder);
                        }}
                      >
                        <FormControl>
                          <SelectTrigger className="bg-card border-border text-foreground focus:border-primary">
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-card border-border text-foreground">
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="client">Client</SelectItem>
                          <SelectItem value="employee">Employee</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={moduleForm.control}
                  name="moduleOrder"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-muted-foreground">Module Order *</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          min="1"
                          className="bg-card border-border text-foreground focus:border-primary"
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={moduleForm.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-muted-foreground">Title *</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          className="bg-card border-border text-foreground focus:border-primary"
                          placeholder="Module title"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={moduleForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-muted-foreground">Description</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          className="bg-card border-border text-foreground focus:border-primary"
                          placeholder="Module description"
                          rows={3}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setIsModuleDialogOpen(false);
                      setIsAddingModule(false);
                      setEditingModule(null);
                      moduleForm.reset();
                    }}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="bg-primary text-primary-foreground hover:bg-primary/80 font-medium"
                    disabled={createModuleMutation.isPending || updateModuleMutation.isPending}
                  >
                    {(createModuleMutation.isPending || updateModuleMutation.isPending) && (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    )}
                    <Save className="w-4 h-4 mr-2" />
                    {isAddingModule ? "Create Module" : "Save Changes"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Add/Edit Tutorial Step Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
          if (!open) {
            setIsEditDialogOpen(false);
            setIsAddingStep(false);
            setEditingStep(null);
            setVideoPreviewUrl(null);
            setVideoValid(null);
            setVideoError(null);
            setInstructionInput("");
            form.reset({
              role: selectedRole,
              moduleId: undefined,
              title: "",
              description: "",
              videoUrl: "",
              videoPlaceholder: "",
              instructions: [],
              actionButtonLabel: "",
              actionButtonHref: "",
            });
          }
        }}>
          <DialogContent className="bg-card border-border text-foreground max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold text-primary">
                {isAddingStep ? "Add New Tutorial Step" : `Edit Tutorial Step ${editingStep?.id}`}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                {isAddingStep 
                  ? "Create a new tutorial step with content, video URL, and instructions"
                  : "Update the tutorial step content, video URL, and instructions"}
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-muted-foreground">Role *</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger className="bg-card border-border text-foreground focus:border-primary">
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-card border-border text-foreground">
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="client">Client</SelectItem>
                          <SelectItem value="employee">Employee</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="moduleId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-muted-foreground">Module (Optional)</FormLabel>
                      <Select
                        value={field.value?.toString() || "none"}
                        onValueChange={(value) => field.onChange(value === "none" ? undefined : parseInt(value))}
                      >
                        <FormControl>
                          <SelectTrigger className="bg-card border-border text-foreground focus:border-primary">
                            <SelectValue placeholder="Select module (optional)" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-card border-border text-foreground">
                          <SelectItem value="none">No Module</SelectItem>
                          {tutorialModules
                            .filter(m => m.role === form.watch("role"))
                            .map((module) => (
                              <SelectItem key={module.id} value={module.id.toString()}>
                                {module.title}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-muted-foreground">Title *</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          className="bg-card border-border text-foreground focus:border-primary"
                          placeholder="Step title"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-muted-foreground">Description *</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          className="bg-card border-border text-foreground focus:border-primary"
                          placeholder="Step description"
                          rows={3}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Video Management Section */}
                <div className="space-y-4 p-4 bg-background rounded-lg border border-border">
                  <div className="flex items-center gap-2 mb-2">
                    <Video className="w-5 h-5 text-primary" />
                    <Label className="text-primary font-semibold">Video Management</Label>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="videoUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-muted-foreground flex items-center gap-2">
                            Tutorial guide video URL
                            {videoValid === true && (
                              <CheckCircle2 className="w-4 h-4 text-green-700" />
                            )}
                            {videoValid === false && (
                              <AlertCircle className="w-4 h-4 text-red-700" />
                            )}
                          </FormLabel>
                          <FormDescription className="text-xs">
                            This video is shown to users for this step. For Employee role, it appears on the employee System Tutorial page and in the guided walkthrough.
                          </FormDescription>
                          <FormControl>
                            <div className="space-y-2">
                              <Input
                                {...field}
                                type="url"
                                className="bg-card border-border text-foreground focus:border-primary"
                                placeholder="https://example.com/video.mp4"
                                onChange={(e) => {
                                  field.onChange(e);
                                  const url = e.target.value;
                                  if (url && url.trim()) {
                                    setVideoPreviewUrl(url.trim());
                                    setVideoValid(null);
                                    setVideoError(null);
                                    // Test video URL
                                    testVideoUrl(url.trim());
                                  } else {
                                    setVideoPreviewUrl(null);
                                    setVideoValid(null);
                                    setVideoError(null);
                                  }
                                }}
                              />
                              {videoError && (
                                <p className="text-xs text-red-700 flex items-center gap-1">
                                  <AlertCircle className="w-3 h-3" />
                                  {videoError}
                                </p>
                              )}
                              {videoValid === true && (
                                <p className="text-xs text-green-700 flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Video URL is valid and accessible
                                </p>
                              )}
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="videoPlaceholder"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-muted-foreground">Video Placeholder</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              className="bg-card border-border text-foreground focus:border-primary"
                              placeholder="Placeholder text when video is unavailable"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Video Preview */}
                  {videoPreviewUrl && (
                    <div className="mt-4 space-y-2">
                      <Label className="text-muted-foreground text-sm">Video Preview</Label>
                      <VideoPlayer url={videoPreviewUrl} />
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-muted-foreground">Instructions *</Label>
                  <div className="space-y-2">
                    {form.watch("instructions").map((instruction, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Input
                          value={instruction}
                          onChange={(e) => {
                            const instructions = form.getValues("instructions");
                            instructions[index] = e.target.value;
                            form.setValue("instructions", instructions);
                          }}
                          className="bg-card border-border text-foreground focus:border-primary"
                          placeholder={`Instruction ${index + 1}`}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveInstruction(index)}
                          className="text-red-700 hover:text-red-500"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                    <div className="flex items-center gap-2">
                      <Input
                        value={instructionInput}
                        onChange={(e) => setInstructionInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddInstruction();
                          }
                        }}
                        className="bg-card border-border text-foreground focus:border-primary"
                        placeholder="Add new instruction"
                      />
                      <Button
                        type="button"
                        onClick={handleAddInstruction}
                        className="bg-primary text-primary-foreground hover:bg-primary/80"
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  {form.formState.errors.instructions && (
                    <p className="text-sm text-red-700">{form.formState.errors.instructions.message}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="actionButtonLabel"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-muted-foreground">Action Button Label</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            className="bg-card border-border text-foreground focus:border-primary"
                            placeholder="Button label"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="actionButtonHref"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-muted-foreground">Action Button Link</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            className="bg-card border-border text-foreground focus:border-primary"
                            placeholder="/admin/forms"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setIsEditDialogOpen(false);
                      setIsAddingStep(false);
                      setEditingStep(null);
                      form.reset();
                    }}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="bg-primary text-primary-foreground hover:bg-primary/80 font-medium"
                    disabled={createMutation.isPending || updateMutation.isPending}
                  >
                    {(createMutation.isPending || updateMutation.isPending) && (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    )}
                    <Save className="w-4 h-4 mr-2" />
                    {isAddingStep ? "Create Step" : "Save Changes"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Tutorial Modal - Disable autoplay on system tutorial page */}
        <OnboardingTutorial autoPlay={false} />
      </div>
    </AdminLayout>
  );
}
