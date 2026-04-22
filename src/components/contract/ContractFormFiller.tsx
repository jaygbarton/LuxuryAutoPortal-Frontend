import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import SignatureCanvas from "react-signature-canvas";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, PenTool, Type, Check, X } from "lucide-react";
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";
import { Textarea } from "../ui/textarea";

// PDF.js worker setup
// IMPORTANT: This must be set synchronously before any PDF components load
// Use unpkg CDN with full HTTPS URL - this is the most reliable option
// The version must match react-pdf's bundled pdfjs-dist version (4.8.69)
const WORKER_VERSION = '4.8.69'; // Match react-pdf's pdfjs-dist version
const workerUrl = `https://unpkg.com/pdfjs-dist@${WORKER_VERSION}/build/pdf.worker.min.mjs`;

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
console.log('✅ PDF worker configured:', workerUrl);
console.log('   Worker version:', WORKER_VERSION);

// ============================================================================
// Zod Validation Schema
// ============================================================================

const contractFormSchema = z.object({
  owner: z.string().min(1, "Owner name is required").max(20, "Max 20 characters"),
  firstName: z.string().min(1, "First name is required").max(50, "First name must be 50 characters or less"),
  lastName: z.string().min(1, "Last name is required").max(50, "Last name must be 50 characters or less"),
  phone: z.string().min(1, "Phone number is required").max(20, "Phone number must be 20 characters or less"),
  email: z.string().min(1, "Email is required").email("Invalid email format").max(100, "Email must be 100 characters or less"),
  vehicleMake: z.string().min(1, "Vehicle make is required").max(50, "Vehicle make must be 50 characters or less"),
  vehicleModel: z.string().min(1, "Vehicle model is required").max(50, "Vehicle model must be 50 characters or less"),
  vehicleTrim: z.string().max(50, "Vehicle trim must be 50 characters or less").optional().or(z.literal("")),
  exteriorColor: z.string().min(1, "Exterior color is required").max(30, "Exterior color must be 30 characters or less"),
  interiorColor: z.string().max(30, "Interior color must be 30 characters or less").optional().or(z.literal("")),
  licensePlate: z.string().min(1, "License plate is required").max(20, "License plate must be 20 characters or less"),
  vin: z.string().length(17, "VIN number must be exactly 17 characters"),
  modelYear: z.string().min(1, "Year is required").max(4, "Year must be 4 characters or less"),
  fuelType: z.string().max(20, "Fuel type must be 20 characters or less").optional().or(z.literal("")),
  expectedStartDate: z.string().min(1, "Estimated Start Date is required"),
  vehicleMileage: z.string().max(10, "Mileage must be 10 characters or less").optional().or(z.literal("")),
  contractDate: z.string().min(1, "Contract date is required"),
  vehicleOwner: z.string().min(1, "Vehicle owner is required").max(50, "Vehicle owner must be 50 characters or less"),
});

type ContractFormData = z.infer<typeof contractFormSchema>;

// ============================================================================
// TEXT WRAPPING UTILITY
// ============================================================================

/**
 * Wraps text into multiple lines with word-aware splitting
 * Splits at spaces when possible, otherwise at character limit
 * @param text - The text to wrap
 * @param maxCharsPerLine - Maximum characters per line (default 20)
 * @returns Array of text lines
 */
function wrapText(text: string, maxCharsPerLine: number = 20): string[] {
  if (!text || text.length <= maxCharsPerLine) {
    return [text];
  }

  const lines: string[] = [];
  let remainingText = text;

  while (remainingText.length > 0) {
    if (remainingText.length <= maxCharsPerLine) {
      lines.push(remainingText);
      break;
    }

    // Try to break at a space within the limit
    let breakPoint = maxCharsPerLine;
    const substring = remainingText.substring(0, maxCharsPerLine + 1);
    const lastSpaceIndex = substring.lastIndexOf(' ');

    if (lastSpaceIndex > 0 && lastSpaceIndex >= maxCharsPerLine * 0.5) {
      // Break at space if it's not too early (at least 50% of max length)
      breakPoint = lastSpaceIndex;
    }

    lines.push(remainingText.substring(0, breakPoint).trim());
    remainingText = remainingText.substring(breakPoint).trim();
  }

  return lines;
}

// ============================================================================
// PDF FIELD COORDINATES CONFIGURATION
// ============================================================================
// Replace the coordinates below with your exact PDF template coordinates.
// 
// PDF Coordinate System:
// - Origin (0,0) is at the BOTTOM-LEFT corner of the page
// - X increases to the RIGHT
// - Y increases UPWARD
// - Page numbers are 1-based (first page = 1)
//
// To find coordinates:
// 1. Open your PDF in a PDF editor (Adobe Acrobat, PDF-XChange, etc.)
// 2. Use the measurement tool or coordinate display
// 3. Note the X,Y position of each blank field
//
// Format: { fieldName: { page: number, x: number, y: number } }
// ============================================================================
const PDF_FIELD_COORDINATES: Record<string, { page: number; x: number; y: number }> = {
  // Owner information - exact coordinates as specified
  owner: { page: 1, x: 300, y: 618 },
  firstName: { page: 1, x: 144, y: 386 },
  lastName: { page: 1, x: 360, y: 386 },
  phone: { page: 1, x: 144, y: 361 }, // Mobile Phone Number
  email: { page: 1, x: 360, y: 361 },
  
  // Vehicle information - exact coordinates as specified
  vehicleMake: { page: 1, x: 114, y: 311 },
  vehicleModel: { page: 1, x: 300, y: 311 },
  vehicleTrim: { page: 1, x: 440, y: 311 },
  exteriorColor: { page: 1, x: 150, y: 282 },
  interiorColor: { page: 1, x: 330, y: 282 },
  licensePlate: { page: 1, x: 470, y: 282 },
  vin: { page: 1, x: 105, y: 256 },
  modelYear: { page: 1, x: 290, y: 256 }, // Year
  fuelType: { page: 1, x: 455, y: 256 },
  
  // Additional contract fields - exact coordinates as specified
  expectedStartDate: { page: 2, x: 170, y: 496 },
  vehicleMileage: { page: 3, x: 190, y: 191 },
  contractDate: { page: 11, x: 260, y: 343 },
  vehicleOwner: { page: 11, x: 345, y: 263 },
};

// Signature coordinates - exact position on Page 11
// Two signature fields: left (owner/client) and right (company)
const SIGNATURE_COORDINATES = {
  page: 11, // Page 11 as specified
  left: {
    x: 100, // Left signature X coordinate (owner/client signature)
    y: 130, // Y coordinate (PDF coordinate system: bottom-left origin)
  },
  right: {
    x: 340, // Right signature X coordinate (company signature)
    y: 130, // Y coordinate (same Y as left signature - aligned on same line)
  },
  dateX: 450, // X position for date (to the right of "Date:" label, same line)
  dateY: 130, // Y position for date (same Y as signature - aligned on same line)
} as const;

// Checkbox coordinates for options/notes (X marks)
// Adjust these coordinates to match the exact checkboxes in your PDF template.
const PDF_CHECKBOX_COORDINATES: Record<
  string,
  { page: number; x: number; y: number }
> = {
  // Mandatory agreements
  agreeMaintainInsurance: { page: 10, x: 80, y: 348 },
  agreeSplit730: { page: 10, x: 80, y: 308 },
  agreeParkingFee: { page: 10, x: 80, y: 288 },
  agreeCleaningFee: { page: 10, x: 80, y: 268 },
  agreeCarWashFee: { page: 10, x: 80, y: 248 },
  agreeOwnerReimbursesExpenses: { page: 10, x: 80, y: 210 },

  // Payment options
  payment_735: { page: 10, x: 80, y: 140 },
  payment_357: { page: 10, x: 80, y: 105 },
  payment_exitFee: { page: 11, x: 80, y: 715 },

  // Optional services
  optionalTintRoamy: { page: 11, x: 80, y: 640 },
  optionalGpsMonthly: { page: 11, x: 80, y: 620 },
  optionalGpsInstall: { page: 11, x: 80, y: 600 },
  optionalAirportDelivery: { page: 11, x: 80, y: 580 },
  optionalHomePickup: { page: 11, x: 80, y: 560 },

  // Additional earnings options
  authorizeRelocation: { page: 11, x: 80, y: 485 },
  authorizeOtherPlatforms: { page: 11, x: 80, y: 450 },
  authorizeChauffeurUse: { page: 11, x: 80, y: 415 },
};
// ============================================================================

/**
 * Renders typed signature text in Dancing Script font to a canvas image
 * @param text - The signature text to render
 * @returns Promise<string> - Base64 data URL of the signature image
 */
async function renderTypedSignatureAsImage(text: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // Create a canvas element
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      reject(new Error("Could not get canvas context"));
      return;
    }

    // Set canvas size (adjust as needed)
    canvas.width = 400;
    canvas.height = 100;

    // Set font style - Dancing Script, 24pt
    ctx.font = "24pt 'Dancing Script', cursive";
    ctx.fillStyle = "black";
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";

    // Measure text to center it
    const textMetrics = ctx.measureText(text);
    const textWidth = textMetrics.width;
    const x = (canvas.width - textWidth) / 2;
    const y = canvas.height / 2;

    // Draw the text
    ctx.fillText(text, x, y);

    // Convert to base64 image
    const dataUrl = canvas.toDataURL("image/png");
    resolve(dataUrl);
  });
}

async function renderCheckmarkAsImage(): Promise<string> {
  return new Promise((resolve, reject) => {
    // Create a canvas element
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      reject(new Error("Could not get canvas context"));
      return;
    }

    // Set canvas size for 12px checkmark (with some padding)
    canvas.width = 24;
    canvas.height = 24;

    // Set font style - Arial, bold, 12px
    ctx.font = "bold 12px Arial, Helvetica, sans-serif";
    ctx.fillStyle = "black";
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";

    // Draw the checkmark centered
    const x = canvas.width / 2;
    const y = canvas.height / 2;
    ctx.fillText("✓", x, y);

    // Convert to base64 image
    const dataUrl = canvas.toDataURL("image/png");
    resolve(dataUrl);
  });
}

// ============================================================================

interface FormField {
  name: string;
  label: string;
  value: string;
  required: boolean;
  type?: "text" | "email" | "tel" | "date";
  error?: string;
  maxLength?: number;
}

interface ContractFormFillerProps {
  pdfUrl: string;
  onboardingData: any;
  onSubmit: (signedPdfBlob: Blob, signatureType: "typed" | "drawn") => Promise<void>;
  onDecline?: () => void;
}

interface TextAnnotation {
  id: string;
  page: number;
  x: number; // PDF coordinate X
  y: number; // PDF coordinate Y
  text: string;
}

export function ContractFormFiller({
  pdfUrl,
  onboardingData,
  onSubmit,
  onDecline,
}: ContractFormFillerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0); // Initial zoom at 100%
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pdfLoadError, setPdfLoadError] = useState<string | null>(null);
  const [isPdfLoading, setIsPdfLoading] = useState(true);
  const [drawnSignatureDataUrl, setDrawnSignatureDataUrl] = useState<string | null>(null); // For real-time overlay
  const [isAddTextMode, setIsAddTextMode] = useState(false);
  const [textAnnotations, setTextAnnotations] = useState<TextAnnotation[]>([]);
  
  // No longer need filled PDF bytes or display URL for real-time preview
  // We'll render text overlays on top of the static PDF instead
  
  // Use refs to store latest values without causing re-renders
  const formFieldsRef = useRef<FormField[]>([]);
  const signatureTypeRef = useRef<"typed" | "drawn">("typed");
  const typedNameRef = useRef<string>("");
  const signatureCanvasRef = useRef<SignatureCanvas>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map()); // Track page divs for overlay positioning
  
  // Form fields - mapped to exact PDF coordinates with validation
  const [formFields, setFormFields] = useState<FormField[]>([
    // Owner information
    { name: "owner", label: "Owner Name", value: onboardingData ? `${onboardingData.firstNameOwner || ""} ${onboardingData.lastNameOwner || ""}`.trim() : "", required: true, maxLength: 20 },
    { name: "firstName", label: "First Name", value: onboardingData?.firstNameOwner || "", required: true, maxLength: 50 },
    { name: "lastName", label: "Last Name", value: onboardingData?.lastNameOwner || "", required: true, maxLength: 50 },
    { name: "phone", label: "Mobile Phone Number", value: onboardingData?.phoneOwner || "", required: true, type: "tel", maxLength: 20 },
    { name: "email", label: "Email", value: onboardingData?.emailOwner || "", required: true, type: "email", maxLength: 100 },
    
    // Vehicle information
    { name: "vehicleMake", label: "Vehicle Make", value: onboardingData?.vehicleMake || "", required: true, maxLength: 50 },
    { name: "vehicleModel", label: "Vehicle Model", value: onboardingData?.vehicleModel || "", required: true, maxLength: 50 },
    { name: "vehicleTrim", label: "Vehicle Trim", value: onboardingData?.vehicleTrim || "", required: false, maxLength: 50 },
    { name: "exteriorColor", label: "Exterior Color", value: onboardingData?.exteriorColor || "", required: true, maxLength: 30 },
    { name: "interiorColor", label: "Interior Color", value: onboardingData?.interiorColor || "", required: false, maxLength: 30 },
    { name: "licensePlate", label: "License Plate", value: onboardingData?.licensePlate || "", required: true, maxLength: 20 },
    { name: "vin", label: "VIN Number", value: onboardingData?.vinNumber || "", required: true, maxLength: 17 },
    { name: "modelYear", label: "Year", value: onboardingData?.vehicleYear || "", required: true, maxLength: 4 },
    { name: "fuelType", label: "Fuel Type", value: onboardingData?.fuelType || "", required: false, maxLength: 20 },
    
    // Additional contract fields
    { name: "expectedStartDate", label: "Estimated Start Date", value: onboardingData?.expectedStartDate || "", required: true, type: "date" },
    { name: "vehicleMileage", label: "Vehicle Mileage", value: onboardingData?.vehicleMiles || "", required: false, maxLength: 10 },
    { name: "contractDate", label: "Contract Date", value: new Date().toLocaleDateString(), required: true },
    { name: "vehicleOwner", label: "Vehicle Owner", value: onboardingData ? `${onboardingData.firstNameOwner || ""} ${onboardingData.lastNameOwner || ""}`.trim() : "", required: true, maxLength: 50 },
  ]);

  // Signature & agreement state
  const [signatureType, setSignatureType] = useState<"typed" | "drawn">("typed");
  const [typedName, setTypedName] = useState("");

  // Mandatory agreement checkboxes
  const [agreeMaintainInsurance, setAgreeMaintainInsurance] = useState(false);
  const [agreeSplit730, setAgreeSplit730] = useState(false);
  const [agreeParkingFee, setAgreeParkingFee] = useState(false);
  const [agreeCleaningFee, setAgreeCleaningFee] = useState(false);
  const [agreeCarWashFee, setAgreeCarWashFee] = useState(false);
  const [agreeOwnerReimbursesExpenses, setAgreeOwnerReimbursesExpenses] =
    useState(false);

  // Payment options (radio, required)
  const [paymentOption, setPaymentOption] = useState<"735" | "357" | "exit-fee" | "">("");

  // Optional services (not required)
  const [enrollRomeInsurance, setEnrollRomeInsurance] = useState(false);
  const [activateGpsTracking, setActivateGpsTracking] = useState(false);
  const [gpsInstallFee, setGpsInstallFee] = useState(false);
  const [airportDeliveryService, setAirportDeliveryService] = useState(false);
  const [homePickupService, setHomePickupService] = useState(false);

  // Additional earnings options (not required)
  const [authorizeRelocation, setAuthorizeRelocation] = useState(false);
  const [authorizeOtherPlatforms, setAuthorizeOtherPlatforms] = useState(false);
  const [authorizeChauffeurUse, setAuthorizeChauffeurUse] = useState(false);

  // UI validation flags for agreements / payment
  const [showAgreementsError, setShowAgreementsError] = useState(false);
  const [showPaymentError, setShowPaymentError] = useState(false);

  const { toast } = useToast();
  
  // Keep refs in sync with state
  useEffect(() => {
    formFieldsRef.current = formFields;
  }, [formFields]);
  
  useEffect(() => {
    signatureTypeRef.current = signatureType;
  }, [signatureType]);
  
  useEffect(() => {
    typedNameRef.current = typedName;
  }, [typedName]);

  // Load PDF bytes - keep the original PDF static, never reload it
  useEffect(() => {
    async function loadPdf() {
      setIsPdfLoading(true);
      setPdfLoadError(null);
      try {
        const response = await fetch(pdfUrl);
        if (!response.ok) {
          throw new Error(`Failed to load PDF: ${response.status} ${response.statusText}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        setPdfBytes(bytes);
        // Create a Blob URL for the PDF
        const blob = new Blob([bytes], { type: 'application/pdf' });
        const blobUrl = URL.createObjectURL(blob);
        setPdfBlobUrl(blobUrl);
        setIsPdfLoading(false);
      } catch (error) {
        console.error("Error loading PDF:", error);
        const errorMessage = error instanceof Error ? error.message : "Failed to load contract template";
        setPdfLoadError(errorMessage);
        setIsPdfLoading(false);
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        });
      }
    }
    loadPdf();
  }, [pdfUrl, toast]);
  
  // Cleanup: revoke blob URL when component unmounts or URL changes
  useEffect(() => {
    return () => {
      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl);
      }
    };
  }, [pdfBlobUrl]);
  
  // Memoize Document options to prevent unnecessary reloads
  const documentOptions = useMemo(() => ({
    cMapPacked: true,
    httpHeaders: { "Accept": "application/pdf" },
  }), []);

  // No real-time PDF update - we'll use HTML overlays instead
  // This prevents the PDF from reloading on every keystroke
  
  // Store page dimensions for coordinate conversion
  const [pageDimensions, setPageDimensions] = useState<Map<number, { width: number; height: number }>>(new Map());
  
  // Convert PDF coordinates to screen coordinates
  // PDF uses bottom-left origin (0,0), screen uses top-left origin
  // PDF.js Page component reports dimensions in PDF points (72 DPI)
  const pdfToScreenCoords = useCallback((pdfX: number, pdfY: number, page: number) => {
    const dims = pageDimensions.get(page);
    if (!dims) return { x: 0, y: 0 };
    
    // PDF coordinate system: (0,0) at bottom-left, Y increases upward
    // Screen coordinate system: (0,0) at top-left, Y increases downward
    // The Page component scales everything by 'scale' prop
    const screenX = pdfX * scale;
    const screenY = (dims.height - pdfY) * scale; // Flip Y axis and scale
    
    return { x: screenX, y: screenY };
  }, [pageDimensions, scale]);

  // Convert screen coordinates (relative to page) back to PDF coordinates
  const screenToPdfCoords = useCallback(
    (screenX: number, screenY: number, page: number) => {
      const dims = pageDimensions.get(page);
      if (!dims || scale === 0) {
        return { x: 0, y: 0 };
      }
      const pdfX = screenX / scale;
      const pdfY = dims.height - screenY / scale;
      return { x: pdfX, y: pdfY };
    },
    [pageDimensions, scale]
  );
  
  // Handle page load to get original PDF dimensions (before scaling)
  const handlePageLoadSuccess = useCallback((page: any, pageNumber: number) => {
    // page.originalWidth and page.originalHeight give us the PDF page size in points
    const { originalWidth, originalHeight } = page;
    setPageDimensions(prev => {
      const newMap = new Map(prev);
      newMap.set(pageNumber, { width: originalWidth, height: originalHeight });
      return newMap;
    });
  }, []);
  
  // Handle signature canvas end (when user finishes drawing) - capture for real-time overlay
  const handleSignatureEnd = useCallback(() => {
    if (signatureCanvasRef.current && !signatureCanvasRef.current.isEmpty()) {
      const dataUrl = signatureCanvasRef.current.toDataURL("image/png");
      setDrawnSignatureDataUrl(dataUrl);
    }
  }, []);

  // Handle "Add Text" clicks on the PDF
  const handlePdfClickForText = useCallback(
    (event: React.MouseEvent<HTMLDivElement>, pageNumber: number) => {
      if (!isAddTextMode) return;

      const pageDims = pageDimensions.get(pageNumber);
      if (!pageDims) return;

      const rect = (event.currentTarget as HTMLDivElement).getBoundingClientRect();
      const offsetX = event.clientX - rect.left;
      const offsetY = event.clientY - rect.top;

      const pdfCoords = screenToPdfCoords(offsetX, offsetY, pageNumber);

      const text = window.prompt("Enter the text you want to add to the contract:");
      if (text && text.trim()) {
        setTextAnnotations((prev) => [
          ...prev,
          {
            id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            page: pageNumber,
            x: pdfCoords.x,
            y: pdfCoords.y,
            text: text.trim(),
          },
        ]);
      }

      // Exit add-text mode after one placement
      setIsAddTextMode(false);
    },
    [isAddTextMode, pageDimensions, screenToPdfCoords]
  );

  const handleFieldChange = (name: string, value: string) => {
    console.log('handleFieldChange', name, value);
    setFormFields((prev) =>
      prev.map((field) => (field.name === name ? { ...field, value, error: undefined } : field))
    );
  };

  // Validate a single field
  const validateField = (name: string, value: string): string | undefined => {
    try {
      const fieldSchema = contractFormSchema.shape[name as keyof ContractFormData];
      if (fieldSchema) {
        fieldSchema.parse(value);
      }
      return undefined;
    } catch (error) {
      if (error instanceof z.ZodError) {
        return error.errors[0]?.message;
      }
      return undefined;
    }
  };

  // Handle field blur for validation
  const handleFieldBlur = (name: string, value: string) => {
    const error = validateField(name, value);
    setFormFields((prev) =>
      prev.map((field) => (field.name === name ? { ...field, error } : field))
    );
  };

  // Format date as mm/dd/yyyy for expectedStartDate
  const formatDateMMDDYYYY = (dateString: string): string => {
    if (!dateString) return "";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString; // Return original if invalid
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
  };

  const handleDateChange = (name: string, value: string) => {
    // For date fields, keep in YYYY-MM-DD format for the input
    setFormFields((prev) =>
      prev.map((field) => (field.name === name ? { ...field, value: value, error: undefined } : field))
    );
  };

  // Calculate dynamic X position for Owner Name based on length
  // Character width: ~8pt for Arial 12pt font
  const calculateOwnerNameX = (ownerName: string): number => {
    const baseX = 340; // Standard starting position
    const length = ownerName.length;
    const charWidth = 8; // 8pt character width for Arial 12pt
    
    if (length <= 15) {
      return baseX;
    }
    // Shift left by charWidth (8pt) per character over 15
    const shift = (length - 15) * charWidth;
    return baseX - shift;
  };

  const validateForm = (): boolean => {
    // Validate all fields with Zod
    const formData: Record<string, string> = {};
    formFields.forEach((field) => {
      formData[field.name] = field.value;
    });

    try {
      contractFormSchema.parse(formData);
    } catch (error) {
      if (error instanceof z.ZodError) {
        // Update form fields with errors
        const errorMap = new Map(error.errors.map((err) => [err.path[0] as string, err.message]));
        setFormFields((prev) =>
          prev.map((field) => ({
            ...field,
            error: errorMap.get(field.name),
          }))
        );

        toast({
          title: "Validation Error",
          description: "Please fix the errors in the form",
          variant: "destructive",
        });
        return false;
      }
    }

    // Check signature
    if (signatureType === "typed" && !typedName.trim()) {
      toast({
        title: "Signature Required",
        description: "Please type your full name to sign",
        variant: "destructive",
      });
      return false;
    }

    if (signatureType === "drawn" && signatureCanvasRef.current?.isEmpty()) {
      toast({
        title: "Signature Required",
        description: "Please draw your signature",
        variant: "destructive",
      });
      return false;
    }

    // Check mandatory agreements
    const hasAllMandatoryAgreements =
      agreeMaintainInsurance &&
      agreeSplit730 &&
      agreeParkingFee &&
      agreeCleaningFee &&
      agreeCarWashFee &&
      agreeOwnerReimbursesExpenses;
    if (!hasAllMandatoryAgreements) {
      setShowAgreementsError(true);
      toast({
        title: "Agreement Required",
        description:
          "Please check all mandatory agreement boxes before signing (insurance, split, fees, and reimbursement).",
        variant: "destructive",
      });
      return false;
    }

    // Check payment option
    if (!paymentOption) {
      setShowPaymentError(true);
      toast({
        title: "Payment Option Required",
        description: "Please select one of the payment options ($735 or $357).",
        variant: "destructive",
      });
      return false;
    }

    // Clear error highlights when valid
    setShowAgreementsError(false);
    setShowPaymentError(false);

    return true;
  };

  const generateSignedPdf = async (): Promise<Blob> => {
    if (!pdfBytes) throw new Error("PDF not loaded");

    const pdfDoc = await PDFDocument.load(pdfBytes);
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const pages = pdfDoc.getPages();

    // Font size: 12pt to match preview (was 11pt, causing misalignment)
    const fontSize = 12;
    const lineHeight = 14; // 14pt line height for 12pt font
    const textColor = rgb(0, 0, 0);

    // Fill each text field with user input at exact coordinates from configuration
    // Most fields are single-line; only owner name wraps if needed
    formFields.forEach((field) => {
      if (field.value && field.value.trim() && PDF_FIELD_COORDINATES[field.name]) {
        const pos = PDF_FIELD_COORDINATES[field.name];
        // Ensure page index is valid (0-based)
        const pageIndex = pos.page - 1;
        if (pageIndex >= 0 && pageIndex < pages.length) {
          const targetPage = pages[pageIndex];
          
          // Only wrap owner name; all other fields are single-line
          const shouldWrap = field.name === "owner";
          const dynamicX = field.name === "owner" ? calculateOwnerNameX(field.value.trim()) : pos.x;
          
          if (shouldWrap) {
            // Wrap text for owner name only
            const lines = wrapText(field.value.trim(), 20);
            lines.forEach((line, index) => {
              targetPage.drawText(line, {
                x: dynamicX,
                y: pos.y - (index * lineHeight), // Move down for each line
                size: fontSize,
                font: helveticaFont,
                color: textColor,
              });
            });
          } else {
            // Single-line fields - draw directly without wrapping
            // Format date fields (expectedStartDate) to mm/dd/yyyy for PDF
            const displayValue = field.name === "expectedStartDate" && field.type === "date"
              ? formatDateMMDDYYYY(field.value.trim())
              : field.value.trim();
            targetPage.drawText(displayValue, {
              x: dynamicX,
              y: pos.y,
              size: fontSize,
              font: helveticaFont,
              color: textColor,
            });
          }
        }
      }
    });

    // Draw checkmarks (✓) for all Additional Notes settings at their configured coordinates
    // Render as image to avoid WinAnsi encoding issues
    const checkmarkImageDataUrl = await renderCheckmarkAsImage();
    const checkmarkImage = await pdfDoc.embedPng(checkmarkImageDataUrl);
    const checkmarkDims = checkmarkImage.scale(1); // Keep original size (12px)
    
    const drawCheckbox = (key: string) => {
      const pos = PDF_CHECKBOX_COORDINATES[key];
      if (!pos) return;
      const pageIndex = pos.page - 1;
      if (pageIndex < 0 || pageIndex >= pages.length) return;
      const page = pages[pageIndex];
      // Draw checkmark as image, centered on the configured coordinates
      // Preview overlay treats (x, y) as the center with translate(-50%, -50%),
      // so we subtract half the image width/height here to match that anchor.
      const centeredX = pos.x - checkmarkDims.width / 2;
      const centeredY = pos.y - checkmarkDims.height / 2;
      page.drawImage(checkmarkImage, {
        x: centeredX,
        y: centeredY,
        width: checkmarkDims.width,
        height: checkmarkDims.height,
      });
    };

    // Mandatory agreements
    if (agreeMaintainInsurance) drawCheckbox("agreeMaintainInsurance");
    if (agreeSplit730) drawCheckbox("agreeSplit730");
    if (agreeParkingFee) drawCheckbox("agreeParkingFee");
    if (agreeCleaningFee) drawCheckbox("agreeCleaningFee");
    if (agreeCarWashFee) drawCheckbox("agreeCarWashFee");
    if (agreeOwnerReimbursesExpenses) drawCheckbox("agreeOwnerReimbursesExpenses");

    // Payment options (radio)
    if (paymentOption === "735") drawCheckbox("payment_735");
    if (paymentOption === "357") drawCheckbox("payment_357");
    if (paymentOption === "exit-fee") drawCheckbox("payment_exitFee");

    // Optional services
    if (enrollRomeInsurance) drawCheckbox("optionalTintRoamy");
    if (activateGpsTracking) {
      drawCheckbox("optionalGpsMonthly");
    }
    if (gpsInstallFee) {
      drawCheckbox("optionalGpsInstall");
    }
    if (airportDeliveryService) {
      drawCheckbox("optionalAirportDelivery");
    }
    if (homePickupService) {
      drawCheckbox("optionalHomePickup");
    }

    // Additional earnings options
    if (authorizeRelocation) drawCheckbox("authorizeRelocation");
    if (authorizeOtherPlatforms) drawCheckbox("authorizeOtherPlatforms");
    if (authorizeChauffeurUse) drawCheckbox("authorizeChauffeurUse");

    // Add signatures at exact coordinates from configuration (left and right)
    const signaturePageIndex = SIGNATURE_COORDINATES.page - 1;
    const signaturePage = signaturePageIndex >= 0 && signaturePageIndex < pages.length 
      ? pages[signaturePageIndex] 
      : pages[pages.length - 1]; // Fallback to last page if invalid

    // Helper function to draw signature at a specific position
    const drawSignatureAtPosition = async (x: number, y: number) => {
    if (signatureType === "typed" && typedName.trim()) {
      // Render typed signature as image with Dancing Script font (24pt)
      const signatureImageDataUrl = await renderTypedSignatureAsImage(typedName);
      const signatureImage = await pdfDoc.embedPng(signatureImageDataUrl);
      // Use a unified scale so typed and drawn signatures have similar visual size
      const signatureDims = signatureImage.scale(0.4);
      // Center the image vertically on the configured Y (to match preview overlay)
        const centeredY = y - signatureDims.height / 2;
      signaturePage.drawImage(signatureImage, {
          x: x,
        y: centeredY,
        width: signatureDims.width,
        height: signatureDims.height,
      });
    } else if (signatureType === "drawn" && signatureCanvasRef.current) {
      // Embed drawn signature as image
      const signatureDataUrl = signatureCanvasRef.current.toDataURL("image/png");
      if (signatureDataUrl && !signatureCanvasRef.current.isEmpty()) {
        const signatureImage = await pdfDoc.embedPng(signatureDataUrl);
        // Use the same scale factor as typed signature for consistent size
        const signatureDims = signatureImage.scale(0.4);
          const centeredY = y - signatureDims.height / 2;
        signaturePage.drawImage(signatureImage, {
            x: x,
          y: centeredY,
          width: signatureDims.width,
          height: signatureDims.height,
        });
      }
    }
    };

    // Draw signature in both left and right positions
    // Only draw signature on the right side (client signature)
    await drawSignatureAtPosition(SIGNATURE_COORDINATES.right.x, SIGNATURE_COORDINATES.right.y);

    // Date is NOT automatically added - leave blank for manual entry if needed

    // Render custom text annotations placed by the user
    textAnnotations.forEach((ann) => {
      // Ensure page index is valid (0-based)
      const pageIndex = ann.page - 1;
      if (pageIndex < 0 || pageIndex >= pages.length) return;
      const targetPage = pages[pageIndex];

      targetPage.drawText(ann.text, {
        x: ann.x,
        y: ann.y,
        size: fontSize,
        font: helveticaFont,
        color: textColor,
      });
    });

    const pdfBytesResult = await pdfDoc.save();
    return new Blob([new Uint8Array(pdfBytesResult)], { type: "application/pdf" });
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsProcessing(true);
    try {
      const signedPdfBlob = await generateSignedPdf();
      await onSubmit(signedPdfBlob, signatureType);
      toast({
        title: "Success!",
        description: "Thank you – agreement signed!",
      });
    } catch (error: any) {
      console.error("Error signing contract:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to sign contract",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      {/* Add Dancing Script font */}
      <link
        href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@400;700&display=swap"
        rel="stylesheet"
      />

      <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-200px)]">
        {/* Left 2/3: Full-Size PDF Preview */}
        <div className="flex-[2] flex flex-col bg-gradient-to-br from-[#2a2a2a] to-[#1f1f1f] rounded-lg border-2 border-primary/30 shadow-2xl overflow-hidden">
          <div className="p-4 border-b border-primary/20 flex items-center justify-between bg-card">
            <div>
              <h3 className="text-[#D3BC8D] font-semibold text-lg">Contract Preview</h3>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-muted-foreground text-sm">
                {numPages} {numPages === 1 ? "page" : "pages"}
              </span>
            </div>
          </div>

          {/* Scrollable PDF Viewer - All Pages in Continuous Scroll */}
          <div className="flex-1 overflow-auto bg-gray-100 p-4">
            <div className="flex flex-col items-center gap-4 py-4">
              {isPdfLoading && (
                <div className="flex items-center justify-center h-[600px]">
                  <Loader2 className="w-8 h-8 animate-spin text-[#D3BC8D]" />
                  <p className="ml-3 text-muted-foreground">Loading contract document...</p>
                </div>
              )}
              {pdfLoadError && (
                <div className="flex flex-col items-center justify-center h-[600px] p-8">
                  <X className="w-12 h-12 text-red-500 mb-4" />
                  <p className="text-red-500 font-semibold mb-2">Failed to load contract document</p>
                  <p className="text-muted-foreground text-sm text-center max-w-md">{pdfLoadError}</p>
                  <Button
                    onClick={() => {
                      setPdfLoadError(null);
                      setIsPdfLoading(true);
                      const loadPdf = async () => {
                        try {
                          const response = await fetch(pdfUrl);
                          if (!response.ok) {
                            throw new Error(`Failed to load PDF: ${response.status} ${response.statusText}`);
                          }
                          const arrayBuffer = await response.arrayBuffer();
                          const bytes = new Uint8Array(arrayBuffer);
                          setPdfBytes(bytes);
                          setIsPdfLoading(false);
                        } catch (error) {
                          const errorMessage = error instanceof Error ? error.message : "Failed to load contract template";
                          setPdfLoadError(errorMessage);
                          setIsPdfLoading(false);
                        }
                      };
                      loadPdf();
                    }}
                    className="mt-4 bg-primary text-[#1a1a1a] hover:bg-muted/50f4d03f]"
                  >
                    Retry
                  </Button>
                </div>
              )}
              {!isPdfLoading && !pdfLoadError && (pdfBlobUrl || pdfUrl) && (
                <Document
                  file={pdfBlobUrl || pdfUrl}
                  onLoadSuccess={({ numPages }) => {
                    setNumPages(numPages);
                    setIsPdfLoading(false);
                  }}
                  onLoadError={(error) => {
                    console.error("PDF Document load error:", error);
                    let errorMessage = error.message || "Failed to load PDF document";
                    
                    // Check if it's a worker error
                    if (errorMessage.includes('worker') || errorMessage.includes('pdf.worker')) {
                      console.warn('⚠️ PDF worker error detected, trying CDN fallback...');
                      // Try to set worker to CDN as fallback
                      const cdnWorkerUrl = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
                      pdfjs.GlobalWorkerOptions.workerSrc = cdnWorkerUrl;
                      errorMessage = `Worker error: ${errorMessage}. Trying CDN fallback. Please refresh the page.`;
                    }
                    
                    setPdfLoadError(errorMessage);
                    setIsPdfLoading(false);
                    toast({
                      title: "PDF Load Error",
                      description: errorMessage,
                      variant: "destructive",
                    });
                  }}
                  loading={
                    <div className="flex items-center justify-center h-[600px]">
                      <Loader2 className="w-8 h-8 animate-spin text-[#D3BC8D]" />
                    </div>
                  }
                  options={documentOptions}
                >
                {Array.from(new Array(numPages), (el, index) => {
                  const pageNumber = index + 1;
                  return (
                    <div
                      key={`page_${pageNumber}`}
                      className="relative bg-white shadow-lg cursor-crosshair"
                      onClick={(e) => handlePdfClickForText(e, pageNumber)}
                    >
                      <Page
                        pageNumber={pageNumber}
                        scale={scale}
                        renderTextLayer={true}
                        renderAnnotationLayer={true}
                        onLoadSuccess={(page) => handlePageLoadSuccess(page, pageNumber)}
                      />
                      
                      {/* Text overlays for real-time preview */}
                      {/* Text overlays for form fields - only owner name wraps */}
                      {formFields.map((field) => {
                        const coords = PDF_FIELD_COORDINATES[field.name];
                        if (!coords || coords.page !== pageNumber || !field.value) return null;
                        
                        // Calculate dynamic X for owner name
                        const dynamicX = field.name === "owner" ? calculateOwnerNameX(field.value) : coords.x;
                        
                        // Only wrap owner name; all other fields are single-line
                        // Format date fields (expectedStartDate) to mm/dd/yyyy for preview
                        const displayValue = field.name === "expectedStartDate" && field.type === "date"
                          ? formatDateMMDDYYYY(field.value)
                          : field.value;
                        const shouldWrap = field.name === "owner";
                        const lines = shouldWrap ? wrapText(displayValue, 20) : [displayValue];
                        const lineHeight = 14; // 14pt line height for 12pt font
                        
                        return (
                          <div key={field.name}>
                            {lines.map((line, lineIndex) => {
                              const screenCoords = pdfToScreenCoords(
                                dynamicX, 
                                shouldWrap ? coords.y - (lineIndex * lineHeight) : coords.y, 
                                pageNumber
                              );
                              
                              return (
                                <div
                                  key={`${field.name}-line-${lineIndex}`}
                                  className="absolute pointer-events-none"
                                  style={{
                                    left: `${screenCoords.x}px`,
                                    top: `${screenCoords.y}px`,
                                    fontSize: `${12 * scale}px`, // 12pt font
                                    fontFamily: 'Arial, Helvetica, sans-serif',
                                    color: 'black',
                                    whiteSpace: 'nowrap',
                                    transform: 'translateY(-50%)',
                                  }}
                                >
                                  {line}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                      
                      {/* Checkbox overlays for real-time preview (Additional Notes settings) */}
                      {Object.entries(PDF_CHECKBOX_COORDINATES)
                        .filter(([key, coords]) => coords.page === pageNumber)
                        .map(([key, coords]) => {
                          // Map component state -> active checkbox keys
                          const isActive =
                            (key === "agreeMaintainInsurance" && agreeMaintainInsurance) ||
                            (key === "agreeSplit730" && agreeSplit730) ||
                            (key === "agreeParkingFee" && agreeParkingFee) ||
                            (key === "agreeCleaningFee" && agreeCleaningFee) ||
                            (key === "agreeCarWashFee" && agreeCarWashFee) ||
                            (key === "agreeOwnerReimbursesExpenses" && agreeOwnerReimbursesExpenses) ||
                            (key === "payment_735" && paymentOption === "735") ||
                            (key === "payment_357" && paymentOption === "357") ||
                            (key === "payment_exitFee" && paymentOption === "exit-fee") ||
                            (key === "optionalTintRoamy" && enrollRomeInsurance) ||
                            (key === "optionalGpsMonthly" && activateGpsTracking) ||
                            (key === "optionalGpsInstall" && gpsInstallFee) ||
                            (key === "optionalAirportDelivery" && airportDeliveryService) ||
                            (key === "optionalHomePickup" && homePickupService) ||
                            (key === "authorizeRelocation" && authorizeRelocation) ||
                            (key === "authorizeOtherPlatforms" && authorizeOtherPlatforms) ||
                            (key === "authorizeChauffeurUse" && authorizeChauffeurUse);

                          if (!isActive) return null;

                          const screenCoords = pdfToScreenCoords(
                            coords.x,
                            coords.y,
                            pageNumber
                          );

                          return (
                            <div
                              key={`cb-${key}`}
                              className="absolute pointer-events-none"
                              style={{
                                left: `${screenCoords.x}px`,
                                top: `${screenCoords.y}px`,
                                // 12px bold checkmark for all Additional Notes settings
                                fontSize: `${12 * scale}px`,
                                fontFamily: "Arial, Helvetica, sans-serif",
                                fontWeight: "700",
                                color: "black",
                                transform: "translate(-50%, -50%)",
                              }}
                            >
                              ✓
                            </div>
                          );
                        })}

                      {/* Signature overlay for real-time preview - right side only (client signature) */}
                      {SIGNATURE_COORDINATES.page === pageNumber && (
                        <>
                          {/* Right typed signature only */}
                          {signatureType === "typed" && typedName && (
                              <div
                                className="absolute pointer-events-none"
                                style={{
                                  left: `${pdfToScreenCoords(SIGNATURE_COORDINATES.right.x, SIGNATURE_COORDINATES.right.y, pageNumber).x}px`,
                                  top: `${pdfToScreenCoords(SIGNATURE_COORDINATES.right.x, SIGNATURE_COORDINATES.right.y, pageNumber).y}px`,
                                  fontSize: `${24 * scale}px`,
                                  fontFamily: "'Dancing Script', cursive",
                                  color: 'black',
                                  fontStyle: 'italic',
                                  whiteSpace: 'nowrap',
                                  transform: 'translateY(-50%)',
                                }}
                              >
                                {typedName}
                              </div>
                          )}
                          
                          {/* Right drawn signature only */}
                          {signatureType === "drawn" && drawnSignatureDataUrl && (
                              <img
                                src={drawnSignatureDataUrl}
                                alt="Signature"
                                className="absolute pointer-events-none"
                                style={{
                                  left: `${pdfToScreenCoords(SIGNATURE_COORDINATES.right.x, SIGNATURE_COORDINATES.right.y, pageNumber).x}px`,
                                  top: `${pdfToScreenCoords(SIGNATURE_COORDINATES.right.x, SIGNATURE_COORDINATES.right.y, pageNumber).y}px`,
                                  width: `${200 * scale}px`,
                                  height: 'auto',
                                  transform: 'translateY(-50%)',
                                  maxWidth: 'none',
                                }}
                              />
                          )}
                        </>
                      )}

                      {/* Custom text annotations overlay */}
                      {textAnnotations
                        .filter((ann) => ann.page === pageNumber)
                        .map((ann) => {
                          const screenCoords = pdfToScreenCoords(ann.x, ann.y, pageNumber);
                          return (
                            <div
                              key={ann.id}
                              className="absolute pointer-events-none"
                              style={{
                                left: `${screenCoords.x}px`,
                                top: `${screenCoords.y}px`,
                                fontSize: `${12 * scale}px`,
                                fontFamily: "Arial, Helvetica, sans-serif",
                                color: "black",
                                whiteSpace: "nowrap",
                                transform: "translateY(-50%)",
                              }}
                            >
                              {ann.text}
                            </div>
                          );
                        })}
                    </div>
                  );
                })}
                </Document>
              )}
            </div>
          </div>

          {/* Zoom Controls */}
          <div className="p-4 border-t border-primary/20 flex items-center justify-center bg-card">
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setScale((s) => Math.max(0.5, s - 0.2))}
                variant="ghost"
                size="sm"
                className="text-[#D3BC8D] font-bold"
                style={{ fontSize: "2rem" }}
              >
                −
              </Button>
              <span className="text-[#D3BC8D] text-sm w-16 text-center font-semibold">
                {(scale * 100).toFixed(0)}%
              </span>
              <Button
                onClick={() => setScale((s) => Math.min(2.0, s + 0.2))}
                variant="ghost"
                size="sm"
                className="text-[#D3BC8D] font-bold"
                style={{ fontSize: "2rem" }}
              >
                +
              </Button>
            </div>
          </div>
        </div>

        {/* Right 1/3: Form Fields & Signature */}
        <div className="flex-1 flex flex-col gap-4 overflow-y-auto">
          {/* Your Information Card */}
          <Card className="bg-card border-primary/20 flex-shrink-0">
            <CardHeader>
              <CardTitle className="text-[#D3BC8D] text-lg">Your Information</CardTitle>
              <CardDescription className="text-muted-foreground text-sm">
                Fill in all required fields. The contract preview updates in real-time.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {formFields.map((field) => {
                const hasError = !!field.error;
                const isEmpty = field.required && !field.value.trim();
                
                // Special handling for date fields
                if (field.type === "date" && field.name === "expectedStartDate") {
                  return (
                    <div key={field.name} className="space-y-1">
                      <Label htmlFor={field.name} className="text-muted-foreground text-sm">
                        {field.label}
                        {field.required && <span className="text-[#D3BC8D] ml-1">*</span>}
                      </Label>
                      <Input
                        id={field.name}
                        type="date"
                        value={field.value}
                        onChange={(e) => handleDateChange(field.name, e.target.value)}
                        onBlur={(e) => handleFieldBlur(field.name, e.target.value)}
                        required={field.required}
                        className={`bg-muted border text-foreground focus:border-primary transition-colors ${
                          hasError || isEmpty ? "border-red-500 focus:border-red-500" : "border-primary/30"
                        }`}
                      />
                      {field.value && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Will appear as: {formatDateMMDDYYYY(field.value)}
                        </p>
                      )}
                      {field.error && (
                        <p className="text-xs text-red-500 mt-1">{field.error}</p>
                      )}
                    </div>
                  );
                }
                
                return (
                  <div key={field.name} className="space-y-1">
                    <Label htmlFor={field.name} className="text-muted-foreground text-sm">
                      {field.label}
                      {field.required && <span className="text-[#D3BC8D] ml-1">*</span>}
                      {field.name === "owner" && (
                        <span className="text-xs text-muted-foreground ml-2">(Max 20 chars)</span>
                      )}
                    </Label>
                    <Input
                      id={field.name}
                      type={field.type || "text"}
                      value={field.value}
                      onChange={(e) => handleFieldChange(field.name, e.target.value)}
                      onBlur={(e) => handleFieldBlur(field.name, e.target.value)}
                      required={field.required}
                      maxLength={field.name === "owner" ? 20 : 100}
                      className={`bg-muted border text-foreground focus:border-primary transition-colors ${
                        hasError || isEmpty ? "border-red-500 focus:border-red-500" : "border-primary/30"
                      }`}
                    />
                    {field.error && (
                      <p className="text-xs text-red-500 mt-1">{field.error}</p>
                    )}
                    {field.name === "owner" && field.value.length > 15 && !field.error && (
                      <p className="text-xs text-[#D3BC8D] mt-1">
                        Long name detected - text will auto-shift left ({field.value.length} chars)
                      </p>
                    )}

                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card className="bg-card border-primary/20 flex-shrink-0">
            <CardHeader>
              <CardTitle className="text-[#D3BC8D] text-lg">Additional Notes</CardTitle>
              <CardDescription className="text-muted-foreground text-sm">
                Add any additional notes to the contract here.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Mandatory Agreements */}
              <div className="mt-4 pt-4 border-t border-primary/20 space-y-3">
                <p className="text-sm font-semibold text-[#D3BC8D]">
                  Mandatory Agreements (all required)
                </p>
                <div className="space-y-2">
                  <div
                    className={`flex items-start space-x-3 rounded-md p-2 ${
                      showAgreementsError && !agreeMaintainInsurance
                        ? "border border-red-500 bg-red-500/5"
                        : ""
                    }`}
                  >
                    <Checkbox
                      id="agree-maintain-insurance"
                      checked={agreeMaintainInsurance}
                      onCheckedChange={(checked) => {
                        setAgreeMaintainInsurance(checked as boolean);
                        setShowAgreementsError(false);
                      }}
                      className="mt-1"
                    />
                    <Label
                      htmlFor="agree-maintain-insurance"
                      className="text-sm text-muted-foreground cursor-pointer leading-relaxed"
                    >
                      I agree to maintain full coverage insurance.
                    </Label>
                  </div>

                  <div
                    className={`flex items-start space-x-3 rounded-md p-2 ${
                      showAgreementsError && !agreeSplit730
                        ? "border border-red-500 bg-red-500/5"
                        : ""
                    }`}
                  >
                    <Checkbox
                      id="agree-split-730"
                      checked={agreeSplit730}
                      onCheckedChange={(checked) => {
                        setAgreeSplit730(checked as boolean);
                        setShowAgreementsError(false);
                      }}
                      className="mt-1"
                    />
                    <Label
                      htmlFor="agree-split-730"
                      className="text-sm text-muted-foreground cursor-pointer leading-relaxed"
                    >
                      I agree to the 70% ~ 30% split.
                    </Label>
                  </div>

                  <div
                    className={`flex items-start space-x-3 rounded-md p-2 ${
                      showAgreementsError && !agreeParkingFee
                        ? "border border-red-500 bg-red-500/5"
                        : ""
                    }`}
                  >
                    <Checkbox
                      id="agree-parking-fee"
                      checked={agreeParkingFee}
                      onCheckedChange={(checked) => {
                        setAgreeParkingFee(checked as boolean);
                        setShowAgreementsError(false);
                      }}
                      className="mt-1"
                    />
                    <Label
                      htmlFor="agree-parking-fee"
                      className="text-sm text-muted-foreground cursor-pointer leading-relaxed"
                    >
                      I agree to a monthly parking fee of $100.
                    </Label>
                  </div>

                  <div
                    className={`flex items-start space-x-3 rounded-md p-2 ${
                      showAgreementsError && !agreeCleaningFee
                        ? "border border-red-500 bg-red-500/5"
                        : ""
                    }`}
                  >
                    <Checkbox
                      id="agree-cleaning-fee"
                      checked={agreeCleaningFee}
                      onCheckedChange={(checked) => {
                        setAgreeCleaningFee(checked as boolean);
                        setShowAgreementsError(false);
                      }}
                      className="mt-1"
                    />
                    <Label
                      htmlFor="agree-cleaning-fee"
                      className="text-sm text-muted-foreground cursor-pointer leading-relaxed"
                    >
                      I agree to a monthly regular cleaning fee of $25.
                    </Label>
                  </div>

                  <div
                    className={`flex items-start space-x-3 rounded-md p-2 ${
                      showAgreementsError && !agreeCarWashFee
                        ? "border border-red-500 bg-red-500/5"
                        : ""
                    }`}
                  >
                    <Checkbox
                      id="agree-carwash-fee"
                      checked={agreeCarWashFee}
                      onCheckedChange={(checked) => {
                        setAgreeCarWashFee(checked as boolean);
                        setShowAgreementsError(false);
                      }}
                      className="mt-1"
                    />
                    <Label
                      htmlFor="agree-carwash-fee"
                      className="text-sm text-muted-foreground cursor-pointer leading-relaxed"
                    >
                      I agree to an annual car wash service fee of $499.
                    </Label>
                  </div>

                  <div
                    className={`flex items-start space-x-3 rounded-md p-2 ${
                      showAgreementsError && !agreeOwnerReimbursesExpenses
                        ? "border border-red-500 bg-red-500/5"
                        : ""
                    }`}
                  >
                    <Checkbox
                      id="agree-owner-expenses"
                      checked={agreeOwnerReimbursesExpenses}
                      onCheckedChange={(checked) => {
                        setAgreeOwnerReimbursesExpenses(checked as boolean);
                        setShowAgreementsError(false);
                      }}
                      className="mt-1"
                    />
                    <Label
                      htmlFor="agree-owner-expenses"
                      className="text-sm text-muted-foreground cursor-pointer leading-relaxed"
                    >
                      I agree that the owner will reimburse all vehicle-related expenses.
                    </Label>
                  </div>

                  {showAgreementsError && (
                    <p className="text-xs text-red-700 mt-1">
                      Please check all mandatory agreement boxes.
                    </p>
                  )}
                </div>
              </div>

              {/* Payment Options (radio, required) */}
              <div className="mt-4 pt-4 border-t border-primary/20 space-y-2">
                <p className="text-sm font-semibold text-[#D3BC8D]">
                  Payment Options (choose one – required)
                </p>
                <RadioGroup
                  value={paymentOption}
                  onValueChange={(value: "735" | "357" | "exit-fee") => {
                    setPaymentOption(value);
                    setShowPaymentError(false);
                  }}
                  className={`space-y-2 rounded-md p-2 ${
                    showPaymentError ? "border border-red-500 bg-red-500/5" : ""
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <RadioGroupItem value="735" id="payment-735" />
                    <Label htmlFor="payment-735" className="text-sm text-muted-foreground">
                      Pay $735. No early exit fee if removed before two years.
                    </Label>
                  </div>
                  <div className="flex items-center space-x-3">
                    <RadioGroupItem value="357" id="payment-357" />
                    <Label htmlFor="payment-357" className="text-sm text-muted-foreground">
                      Pay $357. No early exit fee if removed before two years.
                    </Label>
                  </div>
                  <div className="flex items-center space-x-3">
                    <RadioGroupItem value="exit-fee" id="payment-exit-fee" />
                    <Label htmlFor="payment-exit-fee" className="text-sm text-muted-foreground">
                      No setup fee. Pay $1,000 early exit fee if removed before two years.
                    </Label>
                  </div>
                </RadioGroup>
                {showPaymentError && (
                  <p className="text-xs text-red-700 mt-1">
                    Please select one payment option.
                  </p>
                )}
              </div>

              {/* Optional Services */}
              <div className="mt-4 pt-4 border-t border-primary/20 space-y-2">
                <p className="text-sm font-semibold text-[#D3BC8D]">
                  Optional Services (choose any)
                </p>
                <div className="space-y-2">
                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="optional-rome-insurance"
                      checked={enrollRomeInsurance}
                      onCheckedChange={(checked) =>
                        setEnrollRomeInsurance(checked as boolean)
                      }
                      className="mt-1"
                    />
                    <Label
                      htmlFor="optional-rome-insurance"
                      className="text-sm text-muted-foreground cursor-pointer leading-relaxed"
                    >
                      Enroll in Tint or Roamy Insurance at $97/month.
                    </Label>
                  </div>
                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="optional-gps"
                      checked={activateGpsTracking}
                      onCheckedChange={(checked) =>
                        setActivateGpsTracking(checked as boolean)
                      }
                      className="mt-1"
                    />
                    <Label
                      htmlFor="optional-gps"
                      className="text-sm text-muted-foreground cursor-pointer leading-relaxed"
                    >
                      Activate GPS tracking at $9.99/month.
                    </Label>
                  </div>
                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="optional-gps-install"
                      checked={gpsInstallFee}
                      onCheckedChange={(checked) =>
                        setGpsInstallFee(checked as boolean)
                      }
                      className="mt-1"
                    />
                    <Label
                      htmlFor="optional-gps-install"
                      className="text-sm text-muted-foreground cursor-pointer leading-relaxed"
                    >
                      One-time GPS purchase and installation fee of $199.
                    </Label>
                  </div>
                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="optional-airport"
                      checked={airportDeliveryService}
                      onCheckedChange={(checked) =>
                        setAirportDeliveryService(checked as boolean)
                      }
                      className="mt-1"
                    />
                    <Label
                      htmlFor="optional-airport"
                      className="text-sm text-muted-foreground cursor-pointer leading-relaxed"
                    >
                      Airport delivery and pick-up at $25 per use.
                    </Label>
                  </div>
                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="optional-home-pickup"
                      checked={homePickupService}
                      onCheckedChange={(checked) =>
                        setHomePickupService(checked as boolean)
                      }
                      className="mt-1"
                    />
                    <Label
                      htmlFor="optional-home-pickup"
                      className="text-sm text-muted-foreground cursor-pointer leading-relaxed"
                    >
                      Home or dealership pickup for $100, $75, or $50 based on distance.
                    </Label>
                  </div>
                </div>
              </div>

              {/* Additional Earnings Options */}
              <div className="mt-4 pt-4 border-t border-primary/20 space-y-2">
                <p className="text-sm font-semibold text-[#D3BC8D]">
                  Additional Earnings Options (optional)
                </p>
                <div className="space-y-2">
                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="optional-relocation"
                      checked={authorizeRelocation}
                      onCheckedChange={(checked) =>
                        setAuthorizeRelocation(checked as boolean)
                      }
                      className="mt-1"
                    />
                    <Label
                      htmlFor="optional-relocation"
                      className="text-sm text-muted-foreground cursor-pointer leading-relaxed"
                    >
                      Authorize relocation within the U.S. for rentals; up to $50 per move.
                    </Label>
                  </div>
                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="optional-other-platforms"
                      checked={authorizeOtherPlatforms}
                      onCheckedChange={(checked) =>
                        setAuthorizeOtherPlatforms(checked as boolean)
                      }
                      className="mt-1"
                    />
                    <Label
                      htmlFor="optional-other-platforms"
                      className="text-sm text-muted-foreground cursor-pointer leading-relaxed"
                    >
                      Authorize listing and renting on other websites and apps.
                    </Label>
                  </div>
                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="optional-chauffeur"
                      checked={authorizeChauffeurUse}
                      onCheckedChange={(checked) =>
                        setAuthorizeChauffeurUse(checked as boolean)
                      }
                      className="mt-1"
                    />
                    <Label
                      htmlFor="optional-chauffeur"
                      className="text-sm text-muted-foreground cursor-pointer leading-relaxed"
                    >
                      Authorize use for transportation and chauffeur services, including airport pickups.
                    </Label>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sign Here Card */}
          <Card className="bg-card border-primary/20 flex-shrink-0">
            <CardHeader>
              <CardTitle className="text-[#D3BC8D] text-lg">Sign Here</CardTitle>
              <CardDescription className="text-muted-foreground text-sm">
                Type your name or draw your signature below
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
            <Tabs value={signatureType} onValueChange={(v) => setSignatureType(v as "typed" | "drawn")}>
              <TabsList className="grid w-full grid-cols-2 bg-muted">
                <TabsTrigger value="typed" className="data-[state=active]:bg-primary data-[state=active]:text-black">
                  <Type className="w-4 h-4 mr-2" />
                  Type Name
                </TabsTrigger>
                <TabsTrigger value="drawn" className="data-[state=active]:bg-primary data-[state=active]:text-black">
                  <PenTool className="w-4 h-4 mr-2" />
                  Draw
                </TabsTrigger>
              </TabsList>

              <TabsContent value="typed" className="space-y-3 mt-4">
                <Input
                  type="text"
                  placeholder="Type your full name"
                  value={typedName}
                  onChange={(e) => setTypedName(e.target.value)}
                  className="bg-muted border-primary/30 text-foreground focus:border-primary"
                />
                {typedName && (
                  <div className="bg-white p-3 rounded-md border-2 border-primary/30">
                    <p
                      className="text-2xl text-black italic text-center"
                      style={{ fontFamily: "'Dancing Script', cursive" }}
                    >
                      {typedName}
                    </p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="drawn" className="mt-4">
                <div className="border-2 border-primary/30 rounded-md bg-white overflow-hidden">
                  <SignatureCanvas
                    ref={signatureCanvasRef}
                    onEnd={handleSignatureEnd}
                    canvasProps={{
                      className: "w-full h-32 border border-primary/30 rounded-md bg-white",
                    }}
                  />
                </div>
                <Button
                  onClick={() => {
                    signatureCanvasRef.current?.clear();
                    setDrawnSignatureDataUrl(null); // Clear the overlay
                  }}
                  variant="outline"
                  size="sm"
                  className="mt-2 w-full border-primary/30 text-muted-foreground"
                >
                  Clear
                </Button>
              </TabsContent>
            </Tabs>
              

              {/* Submit and Decline Buttons Row */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button
                  onClick={handleSubmit}
                  disabled={isProcessing}
                  className="flex-1 h-12 bg-primary text-black text-lg font-bold hover:bg-primary/80 disabled:opacity-50"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Check className="w-5 h-5 mr-2" />
                      Submit
                    </>
                  )}
                </Button>
                {onDecline && (
                  <Button
                    onClick={onDecline}
                    disabled={isProcessing}
                    className="flex-1 h-12 bg-[#ef4444] text-foreground text-lg font-bold hover:bg-muted/50dc2626] disabled:opacity-50"
                  >
                    <X className="w-5 h-5 mr-2" />
                    Decline Contract
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}


export default ContractFormFiller;


