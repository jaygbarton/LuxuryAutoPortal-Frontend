import { focusVisibleOnboardingField } from '@/lib/onboardingFieldFocus';
import { onboardingDate, onboardingSubmissionError } from '@/lib/onboardingSubmission';
import {ListYourCarHero,ListYourCarConsultation,ListYourCarTestimonials} from '@/components/onboarding/ListYourCarIntro';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CreateAccountForm } from '@/components/auth/CreateAccountForm';
import { ListYourCarApplicationLayout } from '@/components/onboarding/ListYourCarApplicationLayout';
import { LycQuestionnaire } from '@/components/onboarding/LycQuestionnaire';
import { lycRequest,personalFields,questionnaireFields } from '@/lib/lyc';
import { optionKeywords } from "@/lib/select-search";
import { useEffect, useState, useRef } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SensitiveInput } from "@/components/ui/sensitive-input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useSalesReps } from "@/hooks/use-sales-reps";
import {
  Check,
  ArrowRight,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import { buildApiUrl, buildUploadApiUrl } from "@/lib/queryClient";
import { wizardSteps } from "@/lib/onboardingSteps";
import { getPreferredPublicLocation, withLocationPath } from "@/lib/location-config";

const onboardingSchema = z
  .object({
  date: z.string().min(1, "Date is required"),
  tshirtSize: z.string().min(1, "T-Shirt Size is required"),
  firstNameOwner: z.string().min(2, "First name is required"),
  lastNameOwner: z.string().min(2, "Last name is required"),
  phoneOwner: z.string().min(10, "Phone is required"),
  emailOwner: z.string().email("Valid email is required"),
  representative: z.string().min(1, "Representative is required"),
  heardAboutUs: z.string().min(1, "How you heard about us is required"),
  streetAddress: z.string().min(1, "Street address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  zipCode: z.string().min(1, "Zip code is required"),
  birthday: z.string().min(1, "Birthday is required"),
  emergencyContactName: z.string().min(1, "Emergency contact name is required"),
  emergencyContactPhone: z
    .string()
    .min(10, "Emergency contact phone is required"),
  vehicleYear: z.string().min(1, "Vehicle year is required"),
  vehicleMake: z.string().min(1, "Vehicle make is required"),
  vehicleModel: z.string().min(1, "Vehicle model is required"),
  vehicleTrim: z.string().min(1, "Vehicle trim is required"),
  vehicleMiles: z.string().min(1, "Vehicle miles is required"),
  exteriorColor: z.string().min(1, "Exterior color is required"),
  interiorColor: z.string().min(1, "Interior color is required"),
  titleType: z.string().min(1, "Title type is required"),
  vinNumber: z.string().length(17, "VIN number must be exactly 17 characters"),
  licensePlate: z.string().min(1, "License plate is required"),
  registrationExpiration: z
    .string()
    .min(1, "Registration expiration is required"),
  vehicleRecall: z.string().min(1, "Vehicle recall is required"),
  numberOfSeats: z.string().min(1, "Number of seats is required"),
  numberOfDoors: z.string().min(1, "Number of doors is required"),
  skiRacks: z.string().min(1, "Ski racks is required"),
  skiCrossBars: z.string().min(1, "Ski cross bars is required"),
  roofRails: z.string().min(1, "Roof rails is required"),
  lastOilChange: z.string().min(1, "Last oil change is required"),
  oilType: z.string().min(1, "Oil type is required"),
  freeDealershipOilChanges: z.enum(["Yes", "No"], {
    required_error: "Free dealership oil changes is required",
  }),
  oilPackageDetails: z.string().optional(),
  dealershipAddress: z.string().optional(),
  fuelType: z.string().min(1, "Fuel type is required"),
  tireSize: z.string().min(1, "Tire size is required"),
  vehicleFeatures: z.array(z.string()).min(1, "At least one feature must be selected"),
  insuranceProvider: z.string().min(1, "Insurance provider is required"),
  insurancePhone: z.string().min(10, "Insurance phone is required"),
  policyNumber: z.string().min(1, "Policy number is required"),
  insuranceExpiration: z.string().min(1, "Insurance expiration is required"),
  purchasePrice: z.string().min(1, "Purchase price is required"),
  interestRate: z.string().min(1, "Interest rate is required"),
  monthlyPayment: z.string().min(1, "Monthly payment is required"),
  downPayment: z.string().min(1, "Down payment is required"),
  transportCityToCity: z.string().min(1, "Transport option is required"),
  ultimateGoal: z.string().min(1, "Ultimate goal is required"),
  bankName: z.string().min(1, "Bank name is required"),
  taxClassification: z.string().min(1, "Tax classification is required"),
  routingNumber: z.string().min(9, "Routing number is required").max(9, "Routing number must be exactly 9 digits"),
  accountNumber: z.string().min(1, "Account number is required"),
  businessName: z.string().optional(),
  ein: z.string().optional(),
  ssn: z.string().min(1, "SSN is required"),
  carManufacturerWebsite: z.string().url("Valid URL is required"),
  carManufacturerUsername: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
  confirmAgreement: z.boolean().refine((val) => val === true, "You must confirm"),
})
  .superRefine((data, ctx) => {
    if (data.freeDealershipOilChanges === "Yes" && !data.oilPackageDetails?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["oilPackageDetails"],
        message:
          "Oil package details is required when free dealership oil changes is Yes",
      });
    }
});

type OnboardingFormData = z.infer<typeof onboardingSchema>;

const sections = [
  { id: 1, title: "Getting started" },
  { id: 2, title: "Owner details & driver’s license" },
  { id: 3, title: "Vehicle details" },
  { id: 4, title: "Insurance" },
  { id: 5, title: "Purchase details & goals" },
  { id: 6, title: "Payment & tax information" },
  { id: 7, title: "Vehicle account access" },
];


export default function Onboarding() {
  const [currentPath]=useLocation();
  const search=useSearch();
  const params=new URLSearchParams(search);
  // Marketing stays public. Only an explicit application action mounts the
  // account check, reusable private details and form-saving hooks.
  if(params.get('start')==='1'||params.get('new')==='1'||params.has('draft')) {
    return <OnboardingApplication/>;
  }
  const location=getPreferredPublicLocation(currentPath);
  const suggestedCarsHref=location?.availablePages.suggestedCars===false?null:withLocationPath('/suggested-cars',location);
  params.set('start','1');
  return <div className="min-h-screen bg-background">
    <Navbar/>
    <main className="pb-16 pt-20 lg:pt-24">
      <ListYourCarHero/>
      <div className="mx-auto grid max-w-7xl items-start gap-6 px-4 py-8 sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-12">
        <aside aria-label="About the List Your Car program">
          <ListYourCarConsultation suggestedCarsHref={suggestedCarsHref}/>
          <ListYourCarTestimonials allTestimonialsHref={withLocationPath('/testimonials',location)}/>
        </aside>
        <section className="rounded-xl border border-border bg-card p-6 sm:p-8" aria-labelledby="lyc-get-started-title">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary">Your next step</p>
          <h2 id="lyc-get-started-title" className="font-serif text-3xl">Ready to list your car?</h2>
          <p className="mb-6 mt-4 text-sm leading-7 text-muted-foreground">Start your application, save your progress and return whenever you’re ready. Already have an account? You can use your saved details.</p>
          <Button asChild size="lg" className="w-full sm:w-auto"><Link href={`${currentPath}?${params}`} data-testid="button-lyc-get-started">Get Started<ArrowRight className="ml-2 h-4 w-4" aria-hidden="true"/></Link></Button>
        </section>
      </div>
    </main>
    <Footer/>
  </div>;
}

function OnboardingApplication() {
  const queryClient=useQueryClient();
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [stepError, setStepError] = useState("");
  const [insuranceCardFile, setInsuranceCardFile] = useState<File | null>(null);
  const [driversLicenseFile, setDriversLicenseFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isDraggingLicense, setIsDraggingLicense] = useState(false);
  const { toast } = useToast();
  const { salesReps } = useSalesReps();
  const [currentPath, setLocation] = useLocation();
  const auth=useQuery({queryKey:['/api/auth/me'],queryFn:()=>lycRequest('/api/auth/me')});
  const [loaded,setLoaded]=useState(false),[loadError,setLoadError]=useState('');
  const savingRef=useRef(false);
  const stepFocusFrame=useRef<number | null>(null);
  useEffect(() => () => { if(stepFocusFrame.current !== null) cancelAnimationFrame(stepFocusFrame.current); }, []);
  const [saving,setSaving]=useState(false),[savedMessage,setSavedMessage]=useState('');
  const [draft,setDraft]=useState<any>(null);
  const [reusedBank,setReusedBank]=useState(false);
  const [answers,setAnswers]=useState<any>({hasVehicle:null});
  const [initialDraftId]=useState(()=>new URLSearchParams(window.location.search).get('draft'));
  const publicLocation = getPreferredPublicLocation(currentPath);
  const suggestedCarsHref = publicLocation?.availablePages.suggestedCars === false
    ? null : withLocationPath('/suggested-cars', publicLocation);

  const form = useForm<OnboardingFormData, any, OnboardingFormData>({
    resolver: zodResolver(onboardingSchema),
    // The wizard owns navigation; RHF must not also focus a field in an old
    // step (including its delayed submit-error focus) and scroll the page again.
    shouldFocusError: false,
    defaultValues: {
      date: "",
      tshirtSize: "",
      firstNameOwner: "",
      lastNameOwner: "",
      phoneOwner: "",
      emailOwner: "",
      representative: "",
      heardAboutUs: "",
      streetAddress: "",
      city: "",
      state: "",
      zipCode: "",
      birthday: "",
      emergencyContactName: "",
      emergencyContactPhone: "",
      vehicleYear: "",
      vehicleMake: "",
      vehicleModel: "",
      vehicleTrim: "",
      vehicleMiles: "",
      exteriorColor: "",
      interiorColor: "",
      titleType: "",
      vinNumber: "",
      licensePlate: "",
      registrationExpiration: "",
      vehicleRecall: "",
      numberOfSeats: "",
      numberOfDoors: "",
      skiRacks: "",
      skiCrossBars: "",
      roofRails: "",
      lastOilChange: "",
      oilType: "",
      freeDealershipOilChanges: undefined,
      oilPackageDetails: "",
      dealershipAddress: "",
      fuelType: "",
      tireSize: "",
      vehicleFeatures: [],
      insuranceProvider: "",
      insurancePhone: "",
      policyNumber: "",
      insuranceExpiration: "",
      purchasePrice: "",
      interestRate: "",
      monthlyPayment: "",
      downPayment: "",
      transportCityToCity: "",
      ultimateGoal: "",
      bankName: "",
      taxClassification: "",
      routingNumber: "",
      accountNumber: "",
      ssn: "",
      carManufacturerWebsite: "",
      carManufacturerUsername: "",
      password: "",
      confirmAgreement: false,
    },
  });

  useEffect(()=>{
    if(!auth.data?.user || loaded) return;
    let active=true;
    (async()=>{
      try {
        const [reusable,saved]=await Promise.all([lycRequest('/api/lyc/reusable'),initialDraftId?lycRequest(`/api/lyc/drafts/${initialDraftId}`):Promise.resolve(null)]);
        if(!active) return;
        if(saved?.draft.submissionId){setLocation('/lyc/status');return;}
        const {profile,banking}=reusable;
        setReusedBank(!!banking?.accountNumber);
        const values={...form.getValues(),...profile,...banking,...(saved?.draft.fields || {}),date:onboardingDate()};
        // The displayed account identity is authoritative; draft fields cannot replace it.
        values.emailOwner=profile.emailOwner;values.firstNameOwner=profile.firstNameOwner;values.lastNameOwner=profile.lastNameOwner;
        form.reset(values);setDraft(saved?.draft || null);
        setAnswers({hasVehicle:saved?.draft.hasVehicle ?? null,...Object.fromEntries(questionnaireFields.map(key=>[key,saved?.draft.fields[key] || '']))});
        if(new URLSearchParams(window.location.search).get('step')==='vehicle') setCurrentStep(1);
        else if(wizardSteps[0].fields.every(key=>!!values[key as keyof typeof values])) setCurrentStep(1);
        setLoaded(true);setLoadError('');
      }catch(e:any){if(active)setLoadError(e.message);}
    })();
    return ()=>{active=false;};
  },[auth.data?.user?.id,loaded,initialDraftId]);

  const saveProgress=async()=>{
    if(savingRef.current) throw new Error('A save is already in progress.');
    savingRef.current=true;setSaving(true);setSavedMessage('');
    try {
      const values=form.getValues();
      await lycRequest('/api/lyc/profile','PATCH',Object.fromEntries(personalFields.map(key=>[key,values[key as keyof OnboardingFormData] || ''])));
      const fields=Object.fromEntries([...wizardSteps[1].fields,...wizardSteps[2].fields].filter(key=>values[key as keyof OnboardingFormData]!==undefined).map(key=>[key,values[key as keyof OnboardingFormData]]));
      for(const key of questionnaireFields) if(answers[key]) fields[key]=answers[key];
      let result=await lycRequest(draft?`/api/lyc/drafts/${draft.id}`:'/api/lyc/drafts',draft?'PATCH':'POST',{hasVehicle:answers.hasVehicle,fields,...(draft?{version:draft.version}:{})});
      // Keep the new version even if document upload fails so Retry is safe.
      setDraft(result.draft);
      window.history.replaceState(null,'',`${currentPath}?draft=${result.draft.id}`);
      if(insuranceCardFile||driversLicenseFile){
        const body=new FormData();if(insuranceCardFile)body.append('insuranceCard',insuranceCardFile);if(driversLicenseFile)body.append('driversLicense',driversLicenseFile);
        const response=await fetch(buildUploadApiUrl(`/api/lyc/drafts/${result.draft.id}/documents`),{method:'POST',credentials:'include',body});
        const uploaded=await response.json();if(!response.ok)throw new Error(uploaded.error || 'Documents could not be saved. Please retry.');
        result=uploaded;setDraft(result.draft);setInsuranceCardFile(null);setDriversLicenseFile(null);
      }
      await queryClient.invalidateQueries({queryKey:['/api/lyc/applications']});
      await queryClient.invalidateQueries({queryKey:['/api/lyc/profile']});
      setSavedMessage('Progress saved. You can safely return later.');
      return result.draft;
    }finally{savingRef.current=false;setSaving(false);}
  };
  const saveAndGo=async(step?:number)=>{
    try{await saveProgress();if(step!==undefined){goToStep(step);}}
    catch(e:any){setStepError(e.message);}
  };

  const freeOilChanges = form.watch("freeDealershipOilChanges");

  // Keep dependent field clean when "No" is selected
  useEffect(() => {
    if (freeOilChanges !== "Yes") {
      form.setValue("oilPackageDetails", "");
    }
  }, [freeOilChanges, form]);

  const focusStepHeading = () => {
    if(stepFocusFrame.current !== null) cancelAnimationFrame(stepFocusFrame.current);
    stepFocusFrame.current = requestAnimationFrame(() => {
      stepFocusFrame.current = null;
      const heading = document.getElementById("onboarding-step-title");
      if (!heading) return;
      heading.focus({ preventScroll: true });
      // Ignore the site's smooth scrolling here: one deliberate movement after
      // a step action must finish before the applicant starts typing again.
      heading.scrollIntoView({ block: "start", behavior: "instant" });
    });
  };
  const goToStep = (step: number) => {
    setCurrentStep(step);
    setStepError("");
    focusStepHeading();
  };
  const continueStep = async () => {
    if(currentStep===1&&answers.hasVehicle===null){setStepError('Please choose whether you already have a vehicle. You can add its details later.');return;}
    if(currentStep===1&&answers.hasVehicle===false&&!vehiclePlanReady()){setStepError('Choose your plan, say whether you know the car, and confirm the vehicle requirement.');return;}
    const fields=currentStep===1&&answers.hasVehicle!==true?[]:currentStep===2&&answers.hasVehicle!==true?wizardSteps[currentStep].fields.filter(key=>!["carManufacturerWebsite","carManufacturerUsername","password"].includes(key)):wizardSteps[currentStep].fields;
    const valid = await form.trigger(fields as (keyof OnboardingFormData)[], { shouldFocus: false });
    if (valid) {await saveAndGo(currentStep + 1);}
    else {setStepError("Please complete the highlighted fields before continuing.");focusStepHeading();}
  };
  const showErrors = (errors: typeof form.formState.errors) => {
    const firstStep = wizardSteps.findIndex(step => step.fields.some(field => field in errors));
    if (firstStep >= 0) goToStep(firstStep);
    setStepError("Please review the highlighted fields. Your information has not been submitted.");
  };

  const vehiclePlanReady=()=>['purchase','finance','unsure'].includes(answers.acquisitionPlan)&&['yes','no'].includes(answers.knowsPlannedCar)&&answers.requirementsAcknowledged==='yes';
  const submitPending = async () => {
    if(answers.hasVehicle!==false){goToStep(1);setStepError('Please choose whether you already have a vehicle. You can add its details later.');return;}
    const required=[...wizardSteps[0].fields,...wizardSteps[2].fields] as (keyof OnboardingFormData)[];
    if(!await form.trigger(required)) {
      goToStep(wizardSteps[0].fields.some(key=>form.getFieldState(key as keyof OnboardingFormData).error)?0:2);
      setStepError('Complete the highlighted details before submitting. Only car information can wait.');return;
    }
    if(!driversLicenseFile&&!draft?.documents?.driversLicenseUrls?.length){goToStep(0);setStepError('Please upload your driver’s license before submitting your pending application.');return;}
    if(!vehiclePlanReady()){goToStep(1);setStepError('Choose your plan, say whether you know the car, and confirm the vehicle requirement.');return;}
    if(!form.getValues('confirmAgreement')){form.setError('confirmAgreement',{message:'Please confirm before submitting your pending application.'});return;}
    form.clearErrors('confirmAgreement');
    setIsSubmitting(true);setStepError('');
    try {
      const saved=await saveProgress();
      const result=await lycRequest(`/api/lyc/drafts/${saved.id}/submit-pending`,'POST',{version:saved.version,confirmAgreement:true});
      setDraft(result.draft);
      await queryClient.invalidateQueries({queryKey:['/api/lyc/applications']});
      setLocation('/lyc/status');
    } catch(e:any) {setStepError(e.message || 'Your pending application could not be submitted. Please retry.');}
    finally {setIsSubmitting(false);}
  };

  const onSubmit = async (data: OnboardingFormData) => {
    setIsSubmitting(true);
    setStepError('');
    try {
      if(answers.hasVehicle!==true) throw new Error('Save your progress and add your actual vehicle details when ready. All required steps must be complete before review.');
      const saved=await saveProgress();
      const submittedData={...data,draftId:saved.id,draftVersion:saved.version};
      // Documents were persisted with this owned draft by Save progress.
      const endpoint=buildApiUrl('/api/onboarding/submit');
      const headers={'Content-Type':'application/json'};
      const requestBody=JSON.stringify(submittedData);

      const response = await fetch(endpoint, {
        method: "POST",
        headers: headers,
        body: requestBody,
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        
        // If error has a specific field (like VIN duplicate), set form error
        if (error.field && error.message) {
          form.setError(error.field as keyof OnboardingFormData, {
            type: "manual",
            message: error.message,
          });
          const fieldStep = wizardSteps.findIndex(step => step.fields.includes(error.field));
          if (fieldStep >= 0) goToStep(fieldStep);
        }
        
        throw new Error(onboardingSubmissionError(error));
      }

      await response.json();

      await queryClient.invalidateQueries({queryKey:["/api/lyc/applications"]});
      setIsSubmitted(true);
      setLocation("/lyc/status");
    } catch (error: any) {
      setStepError(error.message || 'Please try again later.');
      toast({
        title: "Submission Failed",
        description: error.message || "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if(auth.isLoading) return <ListYourCarApplicationLayout><p role="status">Loading your account…</p></ListYourCarApplicationLayout>;
  if(auth.error) return <ListYourCarApplicationLayout><p role="alert">Unable to check your account. <Button variant="outline" onClick={()=>void auth.refetch()}>Retry</Button></p></ListYourCarApplicationLayout>;
  if(!auth.data?.user) return <ListYourCarApplicationLayout><div className="rounded-xl border border-border bg-card p-6 sm:p-8"><CreateAccountForm next={currentPath+window.location.search}/></div></ListYourCarApplicationLayout>;
  if(loadError) return <ListYourCarApplicationLayout><div role="alert">{loadError} <Button variant="outline" onClick={()=>window.location.reload()}>Retry</Button></div></ListYourCarApplicationLayout>;
  if(!loaded) return <ListYourCarApplicationLayout><p role="status">Loading your saved details…</p></ListYourCarApplicationLayout>;
  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="pt-20 lg:pt-24">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
            <Card className="bg-card border-border text-center">
              <CardContent className="py-16">
                <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-6">
                  <Check className="w-10 h-10 text-primary" />
                </div>
                <h2 className="font-serif text-3xl font-medium text-foreground mb-4">
                  Thank You!
                </h2>
                <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                  Your application is saved for GLA review. After approval, we will email your contract and account instructions. Once the contract is signed, you can complete the vehicle drop-off form.
                </p>
                <Button
                  onClick={() => (window.location.href = "/fleet")}
                  data-testid="button-browse-fleet"
                >
                  Browse Our Fleet
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </CardContent>
            </Card>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <ListYourCarApplicationLayout>
              <div className="mb-5">
                <h2 className="text-2xl font-semibold text-foreground">Your LYC onboarding steps</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Complete each step. Save and return at any time.
                </p>
              </div>

          <div className="mb-4 flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={saving||isSubmitting} onClick={async()=>{try{await saveProgress();setLocation('/lyc/status');}catch(e:any){setStepError(e.message);}}}>Save & exit</Button></div>
          {reusedBank&&currentStep===2&&<p className="mb-3 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">Your saved payment and tax details are included. Please check they’re current.</p>}
          {savedMessage&&<p role="status" className="mb-4 text-sm text-green-800">{savedMessage}</p>}
          {currentStep===0&&!!draft?.documents?.driversLicenseUrls?.length&&<p className="mb-2 text-sm">Driver’s license saved with this application.</p>}
          {currentStep===1&&!!draft?.documents?.insuranceCardUrl&&<p className="mb-2 text-sm">Insurance document saved with this application.</p>}
          <Form {...form}>
            <form noValidate onPointerDownCapture={event => {
              if (focusVisibleOnboardingField(event) && stepFocusFrame.current !== null) {
                cancelAnimationFrame(stepFocusFrame.current);
                stepFocusFrame.current = null;
              }
            }} onSubmit={event => {
              if (currentStep < wizardSteps.length - 1) { event.preventDefault(); void continueStep(); }
              else if(answers.hasVehicle!==true){event.preventDefault();void submitPending();}
              else void form.handleSubmit(onSubmit, showErrors)(event);
            }} className="space-y-4">
              <ol aria-label="Onboarding progress" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {wizardSteps.map((step, index) => <li key={step.title} aria-current={currentStep === index ? "step" : undefined} className={`rounded-lg border p-3 text-sm ${currentStep === index ? "border-primary bg-primary/10 font-semibold" : "text-muted-foreground"}`}>
                  <button type="button" className="w-full text-left" disabled={saving||isSubmitting} onClick={()=>void saveAndGo(index)}>{index + 1}. {step.title}</button>
                </li>)}
              </ol>
              <div>
                <h3 id="onboarding-step-title" tabIndex={-1} className="scroll-mt-28 text-xl font-semibold outline-none">{wizardSteps[currentStep].title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{wizardSteps[currentStep].description}</p>
              </div>
              {stepError && <p role="alert" className="text-sm text-destructive">{stepError}</p>}
              {currentStep===1&&<LycQuestionnaire answers={answers} onChange={setAnswers} busy={saving||isSubmitting} suggestedCarsHref={suggestedCarsHref}/>}
              {sections.filter(section => wizardSteps[currentStep].sections.includes(section.id) && !(answers.hasVehicle!==true&&[3,4,5,7].includes(section.id))).map((step) => (
                <Card key={step.id} className="bg-card border-primary/20 overflow-hidden">
                  <h4 className="p-4 text-base font-semibold">{step.title}</h4>
                  <CardContent className="p-4 space-y-4 border-t border-primary/20">
                      {step.id === 1 && (
                        <>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="date"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    Date *
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      type="date"
                                      {...field}
                                      className="bg-background border-border"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="tshirtSize"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    T-Shirt Size *
                                  </FormLabel>
                                  <Select
                                    onValueChange={field.onChange}
                                    defaultValue={field.value}
                                  >
                                    <FormControl>
                                      <SelectTrigger className="bg-background border-border">
                                        <SelectValue placeholder="Select" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {["XS", "S", "M", "L", "XL", "XXL"].map(
                                        (s) => (
                                          <SelectItem searchKeywords={optionKeywords(s)} key={s} value={s}>
                                            {s}
                                          </SelectItem>
                                        )
                                      )}
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="firstNameOwner"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    Vehicle Owner First Name *
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      className="bg-background border-border"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="lastNameOwner"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    Vehicle Owner Last Name *
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      className="bg-background border-border"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="phoneOwner"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    Vehicle Owner Phone Number *
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      className="bg-background border-border"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="emailOwner"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    Vehicle Owner Email Address *
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      type="email"
                                      className="bg-background border-border"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="representative"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    Golden Luxury Auto Representative *
                                  </FormLabel>
                                  <Select
                                    onValueChange={field.onChange}
                                    defaultValue={field.value}
                                  >
                                    <FormControl>
                                      <SelectTrigger className="bg-background border-border">
                                        <SelectValue placeholder="Select" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {[...salesReps, "Other"].map((rep) => (
                                        <SelectItem searchKeywords={optionKeywords(rep)} key={rep} value={rep}>
                                          {rep}
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
                              name="heardAboutUs"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    How did you hear about us? *
                                  </FormLabel>
                                  <Select
                                    onValueChange={field.onChange}
                                    defaultValue={field.value}
                                  >
                                    <FormControl>
                                      <SelectTrigger className="bg-background border-border">
                                        <SelectValue placeholder="Select" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="Friend">
                                        Friend
                                      </SelectItem>
                                      <SelectItem value="Google">
                                        Google
                                      </SelectItem>
                                      <SelectItem value="Social Media">
                                        Social Media
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        </>
                      )}
                      {step.id === 2 && (
                        <>
                          <FormField
                            control={form.control}
                            name="streetAddress"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-muted-foreground">
                                  Street Address *
                                </FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    className="bg-background border-border"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="city"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    City *
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      className="bg-background border-border"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="state"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    State *
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      className="bg-background border-border"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="zipCode"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    Zip Code *
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      className="bg-background border-border"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="birthday"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    Birthday *
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      type="date"
                                      {...field}
                                      className="bg-background border-border"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="emergencyContactName"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    Emergency Contact Name *
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      className="bg-background border-border"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="emergencyContactPhone"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    Emergency Contact Phone *
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      className="bg-background border-border"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <FormItem>
                            <FormLabel className="text-muted-foreground">
                              Drivers License Upload
                            </FormLabel>
                            <div
                              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                                isDraggingLicense
                                  ? "border-primary bg-[#D3BC8D]/10"
                                  : "border-primary/30"
                              }`}
                              onDragOver={(e) => {
                                e.preventDefault();
                                setIsDraggingLicense(true);
                              }}
                              onDragLeave={() => setIsDraggingLicense(false)}
                              onDrop={(e) => {
                                e.preventDefault();
                                setIsDraggingLicense(false);
                                const file = e.dataTransfer.files[0];
                                if (file) {
                                  if (
                                    file.type.startsWith("image/") ||
                                    file.type === "application/pdf"
                                  ) {
                                    setDriversLicenseFile(file);
                                  } else {
                                    toast({
                                      title: "Invalid file type",
                                      description:
                                        "Please upload an image or PDF file",
                                      variant: "destructive",
                                    });
                                  }
                                }
                              }}
                            >
                              <input
                                type="file"
                                id="drivers-license-upload"
                                accept="image/*,.pdf"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    if (
                                      file.type.startsWith("image/") ||
                                      file.type === "application/pdf"
                                    ) {
                                      setDriversLicenseFile(file);
                                    } else {
                                      toast({
                                        title: "Invalid file type",
                                        description:
                                          "Please upload an image or PDF file",
                                        variant: "destructive",
                                      });
                                      // Reset the input
                                      e.target.value = "";
                                    }
                                  }
                                }}
                              />
                              <label
                                htmlFor="drivers-license-upload"
                                className="cursor-pointer"
                              >
                                <p className="text-primary text-sm">
                                  Drag & drop files here or click to browse
                                </p>
                                <p className="text-muted-foreground text-xs mt-1">
                                  Supports images and PDF files
                                </p>
                              </label>
                              {driversLicenseFile && (
                                <div className="mt-4 p-3 bg-card rounded border border-primary/20">
                                  <p className="text-foreground text-sm">
                                    Selected: {driversLicenseFile.name}
                                  </p>
                                  <button
                                    type="button"
                                    onClick={() => setDriversLicenseFile(null)}
                                    className="text-red-700 text-xs mt-2 hover:underline"
                                  >
                                    Remove
                                  </button>
                                </div>
                              )}
                            </div>
                          </FormItem>
                        </>
                      )}
                      {step.id === 3 && (
                        <>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="vehicleYear"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    Vehicle Year *
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      className="bg-background border-border"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="vehicleMake"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    Vehicle Make *
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      placeholder="e.g., Mercedes-Benz"
                                      className="bg-background border-border"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="vehicleModel"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    Vehicle Model *
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      className="bg-background border-border"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="vehicleTrim"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    Vehicle Trim *
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      className="bg-background border-border"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="vehicleMiles"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    Vehicle Miles *
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      className="bg-background border-border"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="exteriorColor"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    Exterior Color *
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      className="bg-background border-border"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="interiorColor"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    Interior Color *
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      className="bg-background border-border"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="titleType"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    Title Type *
                                  </FormLabel>
                                  <Select
                                    onValueChange={field.onChange}
                                    defaultValue={field.value}
                                  >
                                    <FormControl>
                                      <SelectTrigger className="bg-background border-border">
                                        <SelectValue placeholder="Select" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="Clean">
                                        Clean
                                      </SelectItem>
                                      <SelectItem value="Salvage">
                                        Salvage
                                      </SelectItem>
                                      <SelectItem value="Rebuilt">
                                        Rebuilt
                                      </SelectItem>
                                      <SelectItem value="Branded">
                                        Branded
                                      </SelectItem>
                                      <SelectItem value="Other">
                                        Other
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="vinNumber"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    VIN Number *
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      className="bg-background border-border"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="licensePlate"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    License Plate *
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      className="bg-background border-border"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="registrationExpiration"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    Registration Expiration *
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      type="date"
                                      {...field}
                                      className="bg-background border-border"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="vehicleRecall"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    Vehicle Recall *
                                  </FormLabel>
                                  <Select
                                    onValueChange={field.onChange}
                                    defaultValue={field.value}
                                  >
                                    <FormControl>
                                      <SelectTrigger className="bg-background border-border">
                                        <SelectValue placeholder="Select" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="Yes">Yes</SelectItem>
                                      <SelectItem value="No">No</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          {/* NHTSA Recall Check Link */}
                          <div className="mt-2 mb-2 text-center">
                            <p className="text-sm text-muted-foreground mb-1">
                              If Your Not Sure If Your Vehicle May Have a Recall You Can Check Here:
                            </p>
                            <a
                              href="https://www.nhtsa.gov/recalls"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:text-[#d4d570] underline font-medium"
                              style={{ fontSize: '1.3em' }}
                            >
                              National Highway Traffic Safety Administration (NHTSA)
                            </a>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="numberOfSeats"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    Number of Seats *
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      type="number"
                                      min="1"
                                      placeholder="e.g., 5"
                                      className="bg-background border-border"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="numberOfDoors"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    Number of Doors *
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      type="number"
                                      min="1"
                                      placeholder="e.g., 4"
                                      className="bg-background border-border"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="skiRacks"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    Ski Racks *
                                  </FormLabel>
                                  <Select
                                    onValueChange={field.onChange}
                                    defaultValue={field.value}
                                  >
                                    <FormControl>
                                      <SelectTrigger className="bg-background border-border">
                                        <SelectValue placeholder="Select" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="Yes">Yes</SelectItem>
                                      <SelectItem value="No">No</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="skiCrossBars"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    Ski Cross Bars *
                                  </FormLabel>
                                  <Select
                                    onValueChange={field.onChange}
                                    defaultValue={field.value}
                                  >
                                    <FormControl>
                                      <SelectTrigger className="bg-background border-border">
                                        <SelectValue placeholder="Select" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="Yes">Yes</SelectItem>
                                      <SelectItem value="No">No</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="roofRails"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    Roof Rails *
                                  </FormLabel>
                                  <Select
                                    onValueChange={field.onChange}
                                    defaultValue={field.value}
                                  >
                                    <FormControl>
                                      <SelectTrigger className="bg-background border-border">
                                        <SelectValue placeholder="Select" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="Yes">Yes</SelectItem>
                                      <SelectItem value="No">No</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="lastOilChange"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    Last Oil Change *
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      type="date"
                                      {...field}
                                      className="bg-background border-border"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="oilType"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    Oil Type *
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      placeholder="e.g., 5W-30"
                                      className="bg-background border-border"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            {/* Right column: dropdown (matches screenshot) */}
                            <div className="space-y-4">
                            <FormField
                              control={form.control}
                              name="freeDealershipOilChanges"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                      Does Your Vehicle Have Free Dealership Oil Changes? *
                                  </FormLabel>
                                  <Select
                                    onValueChange={field.onChange}
                                    defaultValue={field.value}
                                  >
                                    <FormControl>
                                      <SelectTrigger className="bg-background border-border">
                                        <SelectValue placeholder="Select" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="Yes">Yes</SelectItem>
                                        <SelectItem value="No">No</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          </div>

                          {/* Full-width row (spans both columns) */}
                          <div className="grid grid-cols-1 gap-4">
                            <FormField
                              control={form.control}
                              name="oilPackageDetails"
                              render={({ field }) => (
                                <FormItem className="w-full">
                                  <FormLabel className="text-muted-foreground">
                                    If Yes, For How Many Years of Oil Changes OR What Oil Package
                                    {freeOilChanges === "Yes" ? " *" : ""}
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      placeholder={
                                        freeOilChanges === "Yes"
                                          ? "e.g., 2 years / Premium oil package"
                                          : "Select “Yes” above to enable"
                                      }
                                      disabled={freeOilChanges !== "Yes"}
                                      className="w-full bg-background border-border disabled:opacity-60"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          <div className="grid grid-cols-1 gap-4">
                            <FormField
                              control={form.control}
                              name="dealershipAddress"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    Address of Dealership (If Applicable)
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      placeholder="Dealership address (optional)"
                                      className="bg-background border-border"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="fuelType"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    Fuel Type *
                                  </FormLabel>
                                  <Select
                                    onValueChange={field.onChange}
                                    defaultValue={field.value}
                                  >
                                    <FormControl>
                                      <SelectTrigger className="bg-background border-border">
                                        <SelectValue placeholder="Select" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="Regular">Regular</SelectItem>
                                      <SelectItem value="Premium">Premium</SelectItem>
                                      <SelectItem value="Premium 91 Unleaded">Premium 91 Unleaded</SelectItem>
                                      <SelectItem value="Regular Unleaded">Regular Unleaded</SelectItem>
                                      <SelectItem value="91 Unleaded">91 Unleaded</SelectItem>
                                      <SelectItem value="Gasoline">Gasoline</SelectItem>
                                      <SelectItem value="Electric">Electric</SelectItem>
                                      <SelectItem value="Diesel">Diesel</SelectItem>
                                      <SelectItem value="Others">Others</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="tireSize"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    Tire Size *
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      placeholder="e.g., 225/45R17"
                                      className="bg-background border-border"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <FormField
                            control={form.control}
                            name="vehicleFeatures"
                            render={() => (
                              <FormItem>
                                <div className="mb-4">
                                  <FormLabel className="text-muted-foreground text-base font-semibold">
                                    Features (check all that apply)
                                    <span className="text-red-500 ml-1">* Required</span>
                                  </FormLabel>
                                </div>
                                <div className="border border-red-500 rounded-lg p-4">
                                  <div className="grid grid-cols-2 gap-3">
                                    {[
                                      "All-wheel drive",
                                      "AUX input",
                                      "Blind Spot Warning",
                                      "Convertible",
                                      "Keyless Entry",
                                      "Snow Tires or Chains",
                                      "USB Charger",
                                      "Android Auto",
                                      "Back Up Camera",
                                      "Bluetooth",
                                      "GPS",
                                      "Pet Friendly",
                                      "Sunroof",
                                      "USB Input",
                                      "Apple CarPlay",
                                      "Bike Rack",
                                      "Toll Pass",
                                      "Wheelchair Accessible",
                                    ].map((feature) => (
                                      <FormField
                                        key={feature}
                                        control={form.control}
                                        name="vehicleFeatures"
                                        render={({ field }) => {
                                          return (
                                            <FormItem
                                              key={feature}
                                              className="flex flex-row items-start space-x-3 space-y-0"
                                            >
                                              <FormControl>
                                                <Checkbox
                                                  checked={field.value?.includes(feature) || false}
                                                  onCheckedChange={(checked) => {
                                                    const currentValue = field.value || [];
                                                    return checked
                                                      ? field.onChange([...currentValue, feature])
                                                      : field.onChange(
                                                          currentValue.filter(
                                                            (value) => value !== feature
                                                          )
                                                        );
                                                  }}
                                                />
                                              </FormControl>
                                              <FormLabel className="text-muted-foreground text-sm font-normal cursor-pointer">
                                                {feature}
                                              </FormLabel>
                                            </FormItem>
                                          );
                                        }}
                                      />
                                    ))}
                                  </div>
                                </div>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                        </>
                      )}
                      {step.id === 4 && (
                        <>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="insuranceProvider"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    Insurance Provider *
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      className="bg-background border-border"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="insurancePhone"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    Insurance Phone *
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      className="bg-background border-border"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="policyNumber"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    Policy # *
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      className="bg-background border-border"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="insuranceExpiration"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    Expiration *
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      type="date"
                                      {...field}
                                      className="bg-background border-border"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <FormItem>
                            <FormLabel className="text-muted-foreground">
                              Insurance Card
                            </FormLabel>
                            <div
                              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                                isDragging
                                  ? "border-primary bg-[#D3BC8D]/10"
                                  : "border-primary/30"
                              }`}
                              onDragOver={(e) => {
                                e.preventDefault();
                                setIsDragging(true);
                              }}
                              onDragLeave={() => setIsDragging(false)}
                              onDrop={(e) => {
                                e.preventDefault();
                                setIsDragging(false);
                                const file = e.dataTransfer.files[0];
                                if (file) {
                                  if (
                                    file.type.startsWith("image/") ||
                                    file.type === "application/pdf"
                                  ) {
                                    setInsuranceCardFile(file);
                                  } else {
                                    toast({
                                      title: "Invalid file type",
                                      description:
                                        "Please upload an image or PDF file",
                                      variant: "destructive",
                                    });
                                  }
                                }
                              }}
                            >
                              <input
                                type="file"
                                id="insurance-card-upload"
                                accept="image/*,.pdf"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    if (
                                      file.type.startsWith("image/") ||
                                      file.type === "application/pdf"
                                    ) {
                                      setInsuranceCardFile(file);
                                    } else {
                                      toast({
                                        title: "Invalid file type",
                                        description:
                                          "Please upload an image or PDF file",
                                        variant: "destructive",
                                      });
                                      // Reset the input
                                      e.target.value = "";
                                    }
                                  }
                                }}
                              />
                              <label
                                htmlFor="insurance-card-upload"
                                className="cursor-pointer"
                              >
                                <p className="text-primary text-sm">
                                  Drag & drop files here or click to browse
                                </p>
                                <p className="text-muted-foreground text-xs mt-1">
                                  Supports images and PDF files
                                </p>
                              </label>
                              {insuranceCardFile && (
                                <div className="mt-4 p-3 bg-card rounded border border-primary/20">
                                  <p className="text-foreground text-sm">
                                    Selected: {insuranceCardFile.name}
                                  </p>
                                  <button
                                    type="button"
                                    onClick={() => setInsuranceCardFile(null)}
                                    className="text-red-700 text-xs mt-2 hover:underline"
                                  >
                                    Remove
                                  </button>
                                </div>
                              )}
                            </div>
                          </FormItem>
                        </>
                      )}
                      {step.id === 5 && (
                        <>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="purchasePrice"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    Purchase Price *
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      placeholder="e.g., 50000"
                                      className="bg-background border-border"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="interestRate"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    Interest Rate *
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      placeholder="e.g., 3.5"
                                      className="bg-background border-border"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="monthlyPayment"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    Monthly Payment *
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      placeholder="e.g., 750"
                                      className="bg-background border-border"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="downPayment"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    Down Payment *
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      placeholder="e.g., 10000"
                                      className="bg-background border-border"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <FormField
                            control={form.control}
                            name="transportCityToCity"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-muted-foreground">
                                  To maximize profits, would you like us to transport the vehicle from city to city if necessary? (US only)
                                </FormLabel>
                                <Select
                                  onValueChange={field.onChange}
                                  defaultValue={field.value}
                                >
                                  <FormControl>
                                    <SelectTrigger className="bg-background border-border">
                                      <SelectValue placeholder="Select" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="Yes">Yes</SelectItem>
                                    <SelectItem value="No">No</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="ultimateGoal"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-muted-foreground">
                                  What is your ultimate goal we can help you achieve with our program *
                                </FormLabel>
                                <FormControl>
                                  <Textarea
                                    {...field}
                                    placeholder="Tell us about your goals..."
                                    className="bg-background border-border resize-none"
                                    rows={4}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </>
                      )}
                      {step.id === 6 && (
                        <>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="bankName"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    Bank Name *
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      className="bg-background border-border"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="taxClassification"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    Tax Classification *
                                  </FormLabel>
                                  <Select
                                    onValueChange={field.onChange}
                                    defaultValue={field.value}
                                  >
                                    <FormControl>
                                      <SelectTrigger className="bg-background border-border">
                                        <SelectValue placeholder="Select" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="Individual">
                                        Individual
                                      </SelectItem>
                                      <SelectItem value="Business">
                                        Business
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="routingNumber"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    Routing Number *
                                  </FormLabel>
                                  <FormControl>
                                    <SensitiveInput visibilityLabel="routing number" inputMode="numeric"
                                      {...field}
                                      placeholder="9 digits"
                                      maxLength={9}
                                      className="bg-background border-border"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="accountNumber"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    Account Number *
                                  </FormLabel>
                                  <FormControl>
                                    <SensitiveInput visibilityLabel="account number" inputMode="numeric"
                                      {...field}
                                      className="bg-background border-border"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="businessName"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    Business Name
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      className="bg-background border-border"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="ein"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    EIN
                                  </FormLabel>
                                  <FormControl>
                                    <SensitiveInput visibilityLabel="EIN" inputMode="numeric"
                                      {...field}
                                      placeholder="XX-XXXXXXX"
                                      className="bg-background border-border"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <FormField
                            control={form.control}
                            name="ssn"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-muted-foreground">
                                  SSN *
                                </FormLabel>
                                <FormControl>
                                  <SensitiveInput visibilityLabel="SSN" inputMode="numeric"
                                    {...field}
                                    placeholder="XXX-XX-XXXX"
                                    className="bg-background border-border"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </>
                      )}
                      {step.id === 7 && (
                        <>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="carManufacturerWebsite"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    Car Manufacturer Website *
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      placeholder="https://..."
                                      className="bg-background border-border"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="carManufacturerUsername"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    Car Manufacturer Username *
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      className="bg-background border-border"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <FormField
                            control={form.control}
                            name="password"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-muted-foreground">
                                  Password *
                                </FormLabel>
                                <FormControl>
                                  <Input
                                    type="password"
                                    {...field}
                                    className="bg-background border-border"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                        </>
                      )}
                    </CardContent>
                </Card>
              ))}

              {currentStep === 3 && <div className="space-y-4 rounded-lg border p-4" aria-label="Review your onboarding">
                {[{title: "Personal information", value: `${form.getValues("firstNameOwner")} ${form.getValues("lastNameOwner")} · ${form.getValues("emailOwner")}`, detail: driversLicenseFile ? `License: ${driversLicenseFile.name}` : draft?.documents?.driversLicenseUrls?.length?"Driver’s license saved":"Driver’s license not attached"},
                  {title: "Vehicle information", value: answers.hasVehicle===true?`${form.getValues("vehicleMake")} ${form.getValues("vehicleModel")} ${form.getValues("vehicleYear")}`:answers.hasVehicle===false?'Vehicle details to follow':'Vehicle plan not selected', detail: answers.hasVehicle===true?`VIN: ${form.getValues("vinNumber")} · Plate: ${form.getValues("licensePlate")}`:[answers.acquisitionPlan,...['plannedVehicleYear','plannedVehicleMake','plannedVehicleModel'].map(key=>answers[key])].filter(Boolean).join(' ')},
                  {title: "Secure information", value: `Bank: ${form.getValues("bankName")}`, detail: "Bank account and tax numbers are hidden in this summary."}].map((section, index) => <div key={section.title} className="flex items-start justify-between gap-3 border-b pb-3">
                    <div className="min-w-0 break-words"><h4 className="font-medium">{section.title}</h4><p className="text-sm">{section.value}</p><p className="text-xs text-muted-foreground">{section.detail}</p></div>
                    <Button type="button" variant="outline" size="sm" onClick={() => goToStep(index)}>Edit<span className="sr-only"> {section.title}</span></Button>
                  </div>)}
                          <div className="bg-background border border-border rounded p-4">
                            <p className="text-sm text-muted-foreground mb-4">
                              {answers.hasVehicle===false?'Submit your personal and secure information now. Your application stays pending until you return and add the car details for approval.':'After GLA approves your application, we will email your contract. Sign it before completing the vehicle drop-off form.'}
                            </p>
                            <FormField
                              control={form.control}
                              name="confirmAgreement"
                              render={({ field }) => (
                                <FormItem className="flex items-center space-x-2">
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                    />
                                  </FormControl>
                                  <FormLabel className="text-muted-foreground font-normal">
                                    {answers.hasVehicle===false?'Confirm and submit pending application':'Confirm and submit for review'}
                                  </FormLabel>
                                </FormItem>
                              )}
                            />
                          </div>
                <FormMessage>{form.formState.errors.confirmAgreement?.message}</FormMessage>
              </div>}
              <div className="flex flex-wrap gap-3 pt-4 border-t border-primary/20">
                <Button type="button" variant="outline" disabled={saving||isSubmitting} onClick={()=>void saveAndGo()}>Save this step</Button>
                {currentStep > 0 && <Button type="button" variant="outline" disabled={isSubmitting} onClick={() => void saveAndGo(currentStep - 1)}><ArrowLeft className="mr-2 h-4 w-4" />Back</Button>}
                <Button type="submit" className="ml-auto min-h-11" disabled={isSubmitting||saving}>
                  {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting…</> : currentStep === 3 ? (answers.hasVehicle===false?'Submit pending application':'Submit for review') : <>Continue<ArrowRight className="ml-2 h-4 w-4" /></>}
                </Button>
              </div>
            </form>
          </Form>
    </ListYourCarApplicationLayout>
  );
}
