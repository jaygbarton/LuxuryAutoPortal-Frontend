import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const signupSchema = z
  .object({
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    email: z.string().email("Invalid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(8, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type SignupFormData = z.infer<typeof signupSchema>;

export default function Signup() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Get email, firstName, and lastName from URL query parameters if present
  const urlParams = new URLSearchParams(window.location.search);
  const emailFromUrl = urlParams.get('email') || '';
  const firstNameFromUrl = urlParams.get('firstName') || '';
  const lastNameFromUrl = urlParams.get('lastName') || '';

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      email: emailFromUrl,
      firstName: firstNameFromUrl,
      lastName: lastNameFromUrl,
    },
  });

  // Pre-fill form fields if provided in URL
  useEffect(() => {
    if (emailFromUrl) {
      setValue('email', emailFromUrl);
    }
    if (firstNameFromUrl) {
      setValue('firstName', firstNameFromUrl);
    }
    if (lastNameFromUrl) {
      setValue('lastName', lastNameFromUrl);
    }
  }, [emailFromUrl, firstNameFromUrl, lastNameFromUrl, setValue]);

  const signupMutation = useMutation({
    mutationFn: async (data: Omit<SignupFormData, "confirmPassword">) => {
      const response = await apiRequest("POST", "/api/auth/signup", data);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Signup failed");
      }
      return response.json();
    },
    onSuccess: () => {
      // Mark that this is a new signup so tutorial can be shown after login
      localStorage.setItem("gla_new_signup", "true");
      toast({
        title: "Account created successfully!",
        description: "Please log in with your credentials.",
      });
      setLocation("/admin/login");
    },
    onError: (error: any) => {
      toast({
        title: "Signup failed",
        description: error.message || "Failed to create account. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: SignupFormData) => {
    const { confirmPassword, ...signupData } = data;
    signupMutation.mutate(signupData);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <img
            src="/logo.png"
            alt="Golden Luxury Auto"
            className="h-[200px] w-auto mx-auto object-contain mb-6 drop-shadow-[0_0_15px_rgba(234,235,128,0.5)]"
          />
          <h1 className="text-2xl font-semibold text-foreground mb-2">Create Your Account</h1>
          <p className="text-muted-foreground text-sm">
            {emailFromUrl ? "Welcome! Set your password to complete your registration" : "Sign up to access your account"}
          </p>
          {emailFromUrl && (
            <p className="text-primary text-sm mt-2">
              ✓ Your information has been pre-filled from your onboarding
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Hidden fields for firstName and lastName - pre-filled from URL params */}
          <input type="hidden" {...register("firstName")} />
          <input type="hidden" {...register("lastName")} />

          <div className="space-y-2">
            <Label htmlFor="email" className="text-muted-foreground text-sm">
              Email {emailFromUrl && <span className="text-primary text-xs">(pre-filled)</span>}
            </Label>
            <Input
              id="email"
              type="email"
              {...register("email")}
              className={`bg-card border-border222222] text-foreground focus:border-primary focus:ring-[#D3BC8D] h-11 ${
                emailFromUrl ? 'cursor-not-allowed opacity-75' : ''
              }`}
              placeholder="john.doe@example.com"
              readOnly={!!emailFromUrl}
            />
            {errors.email && (
              <p className="text-red-700 text-xs">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-muted-foreground text-sm">
              Password
            </Label>
            <Input
              id="password"
              type="password"
              {...register("password")}
              className="bg-card border-border222222] text-foreground focus:border-primary focus:ring-[#D3BC8D] h-11"
              placeholder="••••••••"
            />
            {errors.password && (
              <p className="text-red-700 text-xs">{errors.password.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="text-muted-foreground text-sm">
              Confirm Password
            </Label>
            <Input
              id="confirmPassword"
              type="password"
              {...register("confirmPassword")}
              className="bg-card border-border222222] text-foreground focus:border-primary focus:ring-[#D3BC8D] h-11"
              placeholder="••••••••"
            />
            {errors.confirmPassword && (
              <p className="text-red-700 text-xs">{errors.confirmPassword.message}</p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full bg-primary text-primary-foreground hover:bg-primary/80 font-medium h-11"
            disabled={signupMutation.isPending}
          >
            {signupMutation.isPending ? "Creating account..." : "Sign Up"}
          </Button>
        </form>

        <p className="text-center text-muted-foreground text-sm mt-6">
          Already have an account?{" "}
          <button
            onClick={() => setLocation("/admin/login")}
            className="text-blue-700 hover:underline"
          >
            Sign in
          </button>
        </p>
      </div>
    </div>
  );
}

