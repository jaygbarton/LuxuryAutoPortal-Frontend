import { useState, useRef, useEffect, useCallback, memo, useMemo } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { PDFDocument, rgb } from "pdf-lib";
import SignatureCanvas from "react-signature-canvas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, Printer, Type, PenTool, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";

interface TextAnnotation {
  id: string;
  x: number;
  y: number;
  text: string;
  width: number;
  height: number;
  page: number;
  fontSize: number;
  color: string;
}

interface SignatureAnnotation {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
  imageData: string;
}

interface PDFEditorProps {
  pdfUrl: string;
  onSign?: (signedPdfBlob: Blob) => Promise<void>;
  contractId?: number;
  onSignReady?: (signFn: () => Promise<Blob>) => void;
}

// Memoized Text Annotation Component with drag and resize
const TextAnnotationBox = memo(
  ({
    annotation,
    scale,
    isEditing,
    onEdit,
    onChange,
    onBlur,
    onRemove,
    onPositionChange,
    onSizeChange,
  }: {
    annotation: TextAnnotation;
    scale: number;
    isEditing: boolean;
    onEdit: () => void;
    onChange: (text: string) => void;
    onBlur: () => void;
    onRemove: () => void;
    onPositionChange: (x: number, y: number) => void;
    onSizeChange: (width: number, height: number) => void;
  }) => {
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const dragStartRef = useRef({ x: 0, y: 0, startX: 0, startY: 0 });
    const resizeStartRef = useRef({
      width: 0,
      height: 0,
      mouseX: 0,
      mouseY: 0,
    });
    const inputRef = useRef<HTMLInputElement>(null);
    const measureRef = useRef<HTMLSpanElement>(null);

    const handlePointerDown = useCallback(
      (e: React.PointerEvent) => {
        if (isEditing) return;
        e.stopPropagation();
        e.preventDefault();
        setIsDragging(true);
        // Store initial pointer position (screen coords) and annotation position (PDF coords)
        dragStartRef.current = {
          x: e.clientX, // Initial mouse X in screen coordinates
          y: e.clientY, // Initial mouse Y in screen coordinates
          startX: annotation.x, // Initial annotation X in PDF coordinates
          startY: annotation.y, // Initial annotation Y in PDF coordinates
        };
        // Capture pointer for smooth dragging
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
      },
      [isEditing, annotation.x, annotation.y]
    );

    const handleResizePointerDown = useCallback(
      (e: React.PointerEvent) => {
        e.stopPropagation();
        e.preventDefault();
        setIsResizing(true);
        resizeStartRef.current = {
          width: annotation.width,
          height: annotation.height,
          mouseX: e.clientX,
          mouseY: e.clientY,
        };
        // Capture pointer for smooth resizing
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
      },
      [annotation.width, annotation.height]
    );

    useEffect(() => {
      if (!isDragging && !isResizing) return;

      const handlePointerMove = (e: PointerEvent) => {
        e.preventDefault();
        if (isDragging) {
          // Calculate mouse movement delta in screen coordinates
          const deltaX = e.clientX - dragStartRef.current.x;
          const deltaY = e.clientY - dragStartRef.current.y;
          // Convert screen delta to PDF coordinates
          const pdfDeltaX = deltaX / scale;
          const pdfDeltaY = deltaY / scale;
          // Add delta to initial PDF position for pixel-perfect 1:1 movement
          const newX = dragStartRef.current.startX + pdfDeltaX;
          const newY = dragStartRef.current.startY + pdfDeltaY;
          onPositionChange(newX, newY);
        } else if (isResizing) {
          // Instant resize - direct delta calculation
          const deltaX = e.clientX - resizeStartRef.current.mouseX;
          const deltaY = e.clientY - resizeStartRef.current.mouseY;
          const newWidth = Math.max(
            annotation.fontSize,
            resizeStartRef.current.width + deltaX / scale
          ); // Min width matches current font size
          const newHeight = Math.max(
            14,
            resizeStartRef.current.height + deltaY / scale
          ); // Min 14px (12px font + 2px padding)
          onSizeChange(newWidth, newHeight);
        }
      };

      const handlePointerUp = () => {
        setIsDragging(false);
        setIsResizing(false);
      };

      document.addEventListener("pointermove", handlePointerMove);
      document.addEventListener("pointerup", handlePointerUp);

      return () => {
        document.removeEventListener("pointermove", handlePointerMove);
        document.removeEventListener("pointerup", handlePointerUp);
      };
    }, [
      isDragging,
      isResizing,
      scale,
      onPositionChange,
      onSizeChange,
      annotation.fontSize,
    ]);

    // Position cursor at the start when editing begins
    useEffect(() => {
      if (isEditing && inputRef.current) {
        inputRef.current.focus();
        inputRef.current.setSelectionRange(0, 0);
      }
    }, [isEditing]);

    return (
      <div
        className={cn(
          "absolute rounded group annotation-box",
          !isDragging && "transition-all duration-200", // Only transition when not dragging
          isEditing
            ? "border border-black bg-white/95 shadow-lg"
            : "border border-transparent bg-transparent hover:border hover:border-gray-300 hover:bg-white/5 cursor-move"
        )}
        style={{
          left: `${annotation.x * scale}px`,
          top: `${annotation.y * scale}px`,
          width: `${annotation.width * scale}px`,
          height: `${annotation.height * scale}px`,
          minWidth: `${annotation.fontSize * scale}px`, // Min width matches current font size
          minHeight: `${14 * scale}px`, // Min height for 12px font + 2px padding
          zIndex: isEditing ? 1000 : 999,
          padding: "1px 0", // 1px top/bottom padding
          transition: isDragging ? "none" : undefined, // Disable transition during drag for instant movement
        }}
        onPointerDown={handlePointerDown}
        onClick={(e) => {
          e.stopPropagation();
          // Don't trigger edit if clicking on delete button or resize handle
          const target = e.target as HTMLElement;
          if (
            target.closest('button[title="Remove text"]') ||
            target.closest(".cursor-se-resize")
          ) {
            return;
          }
          if (!isEditing && !isDragging && !isResizing) {
            onEdit();
          }
        }}
      >
        {isEditing ? (
          <>
            {/* Hidden span for measuring text width */}
            <span
              ref={measureRef}
              style={{
                position: "absolute",
                visibility: "hidden",
                whiteSpace: "pre",
                fontFamily: "'Courier New', monospace",
                fontSize: `${annotation.fontSize}px`,
                padding: "1px 1px 1px 1px",
              }}
            >
              {annotation.text || " "}
            </span>
            <input
              ref={inputRef}
              type="text"
              value={annotation.text}
              onChange={(e) => {
                e.stopPropagation();
                const newText = e.target.value;
                onChange(newText);

                // Calculate width: (text.length * fontSize) - matches font size
                const newWidth = Math.max(
                  annotation.fontSize,
                  (newText.length * annotation.fontSize) / 5
                );
                // Only update width, keep height and font size unchanged when typing
                onSizeChange(newWidth, annotation.height);
              }}
              onBlur={(e) => {
                e.stopPropagation();
                // Final width calculation on blur: (text.length * fontSize)
                if (annotation.text) {
                  const finalWidth = Math.max(
                    annotation.fontSize,
                    (annotation.text.length * annotation.fontSize) / 5
                  );
                  // Only update width, keep height and font size unchanged when typing
                  onSizeChange(finalWidth, annotation.height);
                }
                onBlur();
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter" || e.key === "Escape") {
                  e.preventDefault();
                  // Final width calculation before blur: (text.length * fontSize)
                  if (annotation.text) {
                    const finalWidth = Math.max(
                      annotation.fontSize,
                      (annotation.text.length * annotation.fontSize) / 5
                    );
                    // Only update width, keep height and font size unchanged when typing
                    onSizeChange(finalWidth, annotation.height);
                  }
                  onBlur();
                }
              }}
              className="h-full border-none outline-none bg-transparent text-left"
              style={{
                fontFamily: "'Courier New', monospace",
                fontSize: `${annotation.fontSize}px`,
                color: annotation.color,
                padding: "1px 1px 1px 1px", // 1px top/bottom, 0px left/right
                textAlign: "left",
                width: "100%",
                transition: "font-size 0.15s ease",
              }}
            />
          </>
        ) : (
          <div
            className="w-full h-full flex items-center overflow-hidden pointer-events-none text-left"
            style={{
              fontFamily: "'Courier New', monospace",
              fontSize: `${annotation.fontSize}px`,
              color: annotation.color,
              padding: "1px 5px", // 1px top/bottom, 5px left/right
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              textAlign: "left",
              transition: "font-size 0.15s ease",
            }}
          >
            {annotation.text || ""}
          </div>
        )}

        {/* Resize Handle - only visible when editing */}
        {isEditing && (
          <div
            className="absolute bottom-0 right-0 w-4 h-4 bg-background cursor-se-resize rounded-tl hover:bg-gray-700 transition-colors"
            onPointerDown={handleResizePointerDown}
            onClick={(e) => e.stopPropagation()}
          />
        )}

        {/* Delete button - only visible when editing */}
        {isEditing && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onRemove();
            }}
            onMouseDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
            }}
            className="absolute -top-2 -right-2 bg-red-500 text-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-500/20 text-red-700 border-red-500/50 transition-colors cursor-pointer"
            style={{
              zIndex: 1001,
              pointerEvents: "auto",
            }}
            title="Remove text"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison to prevent unnecessary re-renders
    return (
      prevProps.annotation.id === nextProps.annotation.id &&
      prevProps.annotation.text === nextProps.annotation.text &&
      prevProps.annotation.x === nextProps.annotation.x &&
      prevProps.annotation.y === nextProps.annotation.y &&
      prevProps.annotation.width === nextProps.annotation.width &&
      prevProps.annotation.height === nextProps.annotation.height &&
      prevProps.annotation.fontSize === nextProps.annotation.fontSize &&
      prevProps.scale === nextProps.scale &&
      prevProps.isEditing === nextProps.isEditing
    );
  }
);

TextAnnotationBox.displayName = "TextAnnotationBox";

// Memoized Signature Annotation Component with drag and resize
const SignatureAnnotationBox = memo(
  ({
    annotation,
    scale,
    tool,
    isSelected,
    onSelect,
    onRemove,
    onPositionChange,
    onSizeChange,
  }: {
    annotation: SignatureAnnotation;
    scale: number;
    tool: string;
    isSelected: boolean;
    onSelect: () => void;
    onRemove: () => void;
    onPositionChange: (x: number, y: number) => void;
    onSizeChange: (width: number, height: number) => void;
  }) => {
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const dragStartRef = useRef({ x: 0, y: 0, startX: 0, startY: 0 });
    const resizeStartRef = useRef({
      width: 0,
      height: 0,
      mouseX: 0,
      mouseY: 0,
    });

    const handlePointerDown = useCallback(
      (e: React.PointerEvent) => {
        e.stopPropagation();
        e.preventDefault();
        onSelect();
        setIsDragging(true);
        // Store initial pointer position (screen coords) and annotation position (PDF coords)
        dragStartRef.current = {
          x: e.clientX, // Initial mouse X in screen coordinates
          y: e.clientY, // Initial mouse Y in screen coordinates
          startX: annotation.x, // Initial annotation X in PDF coordinates
          startY: annotation.y, // Initial annotation Y in PDF coordinates
        };
        // Capture pointer for smooth dragging
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
      },
      [annotation.x, annotation.y, onSelect]
    );

    const handleResizePointerDown = useCallback(
      (e: React.PointerEvent) => {
        e.stopPropagation();
        e.preventDefault();
        setIsResizing(true);
        resizeStartRef.current = {
          width: annotation.width,
          height: annotation.height,
          mouseX: e.clientX,
          mouseY: e.clientY,
        };
        // Capture pointer for smooth resizing
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
      },
      [annotation.width, annotation.height]
    );

    useEffect(() => {
      if (!isDragging && !isResizing) return;

      const handlePointerMove = (e: PointerEvent) => {
        e.preventDefault();
        if (isDragging) {
          // Calculate mouse movement delta in screen coordinates
          const deltaX = e.clientX - dragStartRef.current.x;
          const deltaY = e.clientY - dragStartRef.current.y;
          // Convert screen delta to PDF coordinates
          const pdfDeltaX = deltaX / scale;
          const pdfDeltaY = deltaY / scale;
          // Add delta to initial PDF position for pixel-perfect 1:1 movement
          const newX = dragStartRef.current.startX + pdfDeltaX;
          const newY = dragStartRef.current.startY + pdfDeltaY;
          onPositionChange(newX, newY);
        } else if (isResizing) {
          // Instant resize - direct delta calculation
          const deltaX = e.clientX - resizeStartRef.current.mouseX;
          const deltaY = e.clientY - resizeStartRef.current.mouseY;
          const newWidth = Math.max(
            50,
            resizeStartRef.current.width + deltaX / scale
          );
          const newHeight = Math.max(
            25,
            resizeStartRef.current.height + deltaY / scale
          );
          onSizeChange(newWidth, newHeight);
        }
      };

      const handlePointerUp = () => {
        setIsDragging(false);
        setIsResizing(false);
      };

      document.addEventListener("pointermove", handlePointerMove);
      document.addEventListener("pointerup", handlePointerUp);

      return () => {
        document.removeEventListener("pointermove", handlePointerMove);
        document.removeEventListener("pointerup", handlePointerUp);
      };
    }, [isDragging, isResizing, scale, onPositionChange, onSizeChange]);

    return (
      <div
        className={cn(
          "absolute rounded group annotation-box",
          !isDragging && "transition-all duration-200", // Only transition when not dragging
          isSelected
            ? "border-2 border-black bg-white/5 shadow-lg cursor-move"
            : "border-0 bg-transparent hover:border hover:border-gray-300 hover:bg-white/5 cursor-move"
        )}
        style={{
          left: `${annotation.x * scale}px`,
          top: `${annotation.y * scale}px`,
          width: `${annotation.width * scale}px`,
          height: `${annotation.height * scale}px`,
          zIndex: isSelected ? 1000 : 999,
          padding: "1px",
          transition: isDragging ? "none" : undefined, // Disable transition during drag for instant movement
        }}
        onPointerDown={handlePointerDown}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
      >
        <img
          src={annotation.imageData}
          alt="Signature"
          className="w-full h-full object-contain pointer-events-none"
          draggable={false}
          style={{
            opacity: isSelected ? 1 : 0.95,
            filter: isSelected ? "none" : "none",
          }}
        />

        {/* Delete button - only visible when selected */}
        {isSelected && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onRemove();
            }}
            className="absolute -top-2 -right-2 bg-red-500 text-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-500/20 text-red-700 border-red-500/50 transition-colors z-10"
            title="Remove signature"
          >
            <X className="w-3 h-3" />
          </button>
        )}

        {/* Resize Handle - only visible when selected */}
        {isSelected && (
          <div
            className="absolute bottom-0 right-0 w-4 h-4 bg-background cursor-se-resize rounded-tl hover:bg-gray-700 transition-colors"
            onPointerDown={handleResizePointerDown}
            onClick={(e) => e.stopPropagation()}
          />
        )}
      </div>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.annotation.id === nextProps.annotation.id &&
      prevProps.annotation.x === nextProps.annotation.x &&
      prevProps.annotation.y === nextProps.annotation.y &&
      prevProps.annotation.width === nextProps.annotation.width &&
      prevProps.annotation.height === nextProps.annotation.height &&
      prevProps.scale === nextProps.scale &&
      prevProps.isSelected === nextProps.isSelected &&
      prevProps.tool === nextProps.tool
    );
  }
);

SignatureAnnotationBox.displayName = "SignatureAnnotationBox";

// Memoized PDF Page Component - prevents re-render when annotations change
const PDFPageWithAnnotations = memo(
  ({
    pageNumber,
    scale,
    textAnnotations,
    signatureAnnotations,
    editingTextId,
    selectedSignatureId,
    tool,
    onTextEdit,
    onTextChange,
    onTextBlur,
    onTextRemove,
    onTextPositionChange,
    onTextSizeChange,
    onSignatureSelect,
    onSignatureRemove,
    onSignaturePositionChange,
    onSignatureSizeChange,
    onPageClick,
  }: {
    pageNumber: number;
    scale: number;
    textAnnotations: TextAnnotation[];
    signatureAnnotations: SignatureAnnotation[];
    editingTextId: string | null;
    selectedSignatureId: string | null;
    tool: string;
    onTextEdit: (id: string) => void;
    onTextChange: (id: string, text: string) => void;
    onTextBlur: () => void;
    onTextRemove: (id: string) => void;
    onTextPositionChange: (id: string, x: number, y: number) => void;
    onTextSizeChange: (id: string, width: number, height: number) => void;
    onSignatureSelect: (id: string) => void;
    onSignatureRemove: (id: string) => void;
    onSignaturePositionChange: (id: string, x: number, y: number) => void;
    onSignatureSizeChange: (id: string, width: number, height: number) => void;
    onPageClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  }) => {
    return (
      <div
        className="relative mb-4"
        onClick={onPageClick}
        style={{ cursor: "inherit" }}
      >
        <Page
          pageNumber={pageNumber}
          scale={scale}
          renderTextLayer={true}
          renderAnnotationLayer={true}
          className="shadow-lg"
        />

        {/* Text Annotations Overlay */}
        {textAnnotations
          .filter((ann) => ann.page === pageNumber)
          .map((annotation) => (
            <TextAnnotationBox
              key={annotation.id}
              annotation={annotation}
              scale={scale}
              isEditing={editingTextId === annotation.id}
              onEdit={() => onTextEdit(annotation.id)}
              onChange={(newText) => onTextChange(annotation.id, newText)}
              onBlur={onTextBlur}
              onRemove={() => onTextRemove(annotation.id)}
              onPositionChange={(x, y) =>
                onTextPositionChange(annotation.id, x, y)
              }
              onSizeChange={(width, height) =>
                onTextSizeChange(annotation.id, width, height)
              }
            />
          ))}

        {/* Signature Annotations Overlay */}
        {signatureAnnotations
          .filter((ann) => ann.page === pageNumber)
          .map((annotation) => (
            <SignatureAnnotationBox
              key={annotation.id}
              annotation={annotation}
              scale={scale}
              tool={tool}
              isSelected={selectedSignatureId === annotation.id}
              onSelect={() => onSignatureSelect(annotation.id)}
              onRemove={() => onSignatureRemove(annotation.id)}
              onPositionChange={(x, y) =>
                onSignaturePositionChange(annotation.id, x, y)
              }
              onSizeChange={(width, height) =>
                onSignatureSizeChange(annotation.id, width, height)
              }
            />
          ))}
      </div>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison function - only re-render if these specific props change
    return (
      prevProps.pageNumber === nextProps.pageNumber &&
      prevProps.scale === nextProps.scale &&
      prevProps.editingTextId === nextProps.editingTextId &&
      prevProps.selectedSignatureId === nextProps.selectedSignatureId &&
      prevProps.tool === nextProps.tool &&
      prevProps.textAnnotations === nextProps.textAnnotations &&
      prevProps.signatureAnnotations === nextProps.signatureAnnotations
    );
  }
);

PDFPageWithAnnotations.displayName = "PDFPageWithAnnotations";

export function PDFEditor({
  pdfUrl,
  onSign,
  contractId,
  onSignReady,
}: PDFEditorProps) {
  const [scale, setScale] = useState(1.0);
  const [numPages, setNumPages] = useState(0);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [tool, setTool] = useState<"select" | "text" | "signature">("select");
  const [textAnnotations, setTextAnnotations] = useState<TextAnnotation[]>([]);
  const [signatureAnnotations, setSignatureAnnotations] = useState<
    SignatureAnnotation[]
  >([]);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [selectedSignatureId, setSelectedSignatureId] = useState<string | null>(
    null
  );
  const [signatureModalOpen, setSignatureModalOpen] = useState(false);
  const [signatureType, setSignatureType] = useState<
    "type" | "draw" | "upload"
  >("draw");
  const [typedSignature, setTypedSignature] = useState("");
  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  const [pendingSignature, setPendingSignature] = useState<string | null>(null);
  const [signaturePlacementMode, setSignaturePlacementMode] = useState(false);

  const { toast } = useToast();
  const containerRef = useRef<HTMLDivElement>(null);
  const signatureCanvasRef = useRef<SignatureCanvas>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfDocRef = useRef<PDFDocument | null>(null);

  // Memoize Document options to prevent reloads (fixes the warning and reload issue)
  const documentOptions = useMemo(
    () => ({
      cMapPacked: true,
      httpHeaders: { Accept: "application/pdf" },
    }),
    []
  );

  // Memoize callbacks to prevent re-renders
  const handleTextEditCallback = useCallback((id: string) => {
    setEditingTextId(id);
  }, []);

  const handleTextBlurCallback = useCallback(() => {
    setEditingTextId(null);
  }, []);

  // Handle text annotation change with useCallback to prevent re-renders
  const handleTextChange = useCallback(
    (annotationId: string, newText: string) => {
      setTextAnnotations((prev) =>
        prev.map((ann) =>
          ann.id === annotationId ? { ...ann, text: newText } : ann
        )
      );
    },
    []
  );

  // Handle text annotation removal with useCallback
  const handleTextRemove = useCallback((annotationId: string) => {
    setTextAnnotations((prev) => prev.filter((ann) => ann.id !== annotationId));
    setEditingTextId(null);
  }, []);

  // Handle text position change (drag)
  const handleTextPositionChange = useCallback(
    (annotationId: string, x: number, y: number) => {
      setTextAnnotations((prev) =>
        prev.map((ann) => (ann.id === annotationId ? { ...ann, x, y } : ann))
      );
    },
    []
  );

  // Handle text size change (resize) - font size controlled by height only
  const handleTextSizeChange = useCallback(
    (annotationId: string, width: number, height: number) => {
      setTextAnnotations((prev) =>
        prev.map((ann) => {
          if (ann.id === annotationId) {
            // If only width changed (typing), preserve font size and height
            const heightChanged = Math.abs(height - ann.height) > 0.1;
            const widthOnlyChange =
              !heightChanged && Math.abs(width - ann.width) > 0.1;

            if (widthOnlyChange) {
              // Typing: only update width, preserve font size and height
              return { ...ann, width };
            }

            // Height changed: calculate font size from height
            // Font size = height - 2px (subtract padding)
            const newFontSize = Math.max(
              12,
              Math.min(80, Math.round(height - 2))
            );

            return {
              ...ann,
              width,
              height,
              fontSize: newFontSize,
            };
          }
          return ann;
        })
      );
    },
    []
  );

  // Handle signature removal with useCallback
  const handleSignatureRemove = useCallback((annotationId: string) => {
    setSignatureAnnotations((prev) =>
      prev.filter((ann) => ann.id !== annotationId)
    );
    setSelectedSignatureId(null);
  }, []);

  // Handle signature position change (drag)
  const handleSignaturePositionChange = useCallback(
    (annotationId: string, x: number, y: number) => {
      setSignatureAnnotations((prev) =>
        prev.map((ann) => (ann.id === annotationId ? { ...ann, x, y } : ann))
      );
    },
    []
  );

  // Handle signature size change (resize)
  const handleSignatureSizeChange = useCallback(
    (annotationId: string, width: number, height: number) => {
      setSignatureAnnotations((prev) =>
        prev.map((ann) =>
          ann.id === annotationId ? { ...ann, width, height } : ann
        )
      );
    },
    []
  );

  // Set initial scale to fit width on mount
  useEffect(() => {
    if (containerRef.current) {
      const containerWidth = containerRef.current.clientWidth - 64;
      const calculatedScale = containerWidth / 612; // Standard PDF page width
      setScale(calculatedScale);
    }
  }, []);

  // PDF load handlers
  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  const onDocumentLoadError = (error: Error) => {
    console.error("PDF load error:", error);
    setPdfError(error.message);
  };

  // Text tool - simplified (no modal, direct placement)
  const handleTextClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>, pageNum: number) => {
      if (tool !== "text") return;

      const rect = e.currentTarget.getBoundingClientRect();
      const x = (e.clientX - rect.left) / scale - 20;
      const y = (e.clientY - rect.top) / scale - 10;

      // Initial state: 20px width (1 char), 22px height (20px font + 2px padding), 20px font
      const initialWidth = 30; // One character at 20px font
      const initialFontSize = 30; // 20px font size fixed
      const initialHeight = initialFontSize; // Font size + 2px padding = 22px

      const newText: TextAnnotation = {
        id: `text-${Date.now()}`,
        x,
        y,
        text: "",
        width: initialWidth,
        height: initialHeight,
        page: pageNum,
        fontSize: initialFontSize,
        color: "#000000",
      };

      setTextAnnotations((prev) => [...prev, newText]);
      setEditingTextId(newText.id);
      setTool("select");
    },
    [tool, scale]
  );

  // Signature tool - place signature on PDF click
  const handleSignatureClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>, pageNum: number) => {
      console.log("🖱️ handleSignatureClick called", {
        signaturePlacementMode,
        hasPendingSignature: !!pendingSignature,
        tool,
      });

      if (!signaturePlacementMode || !pendingSignature) {
        console.log(
          "❌ Exiting early - no placement mode or no pending signature"
        );
        return;
      }

      e.stopPropagation();

      const rect = e.currentTarget.getBoundingClientRect();
      // Adjust position to match cursor hotspot (20, 40)
      const x = (e.clientX - rect.left) / scale - 20;
      const y = (e.clientY - rect.top) / scale - 40;

      console.log("✅ Creating signature at", { x, y, pageNum, scale });

      // Create a temporary image to get actual dimensions
      const img = new Image();
      img.src = pendingSignature;

      // Wait for image to load to get proper dimensions
      img.onload = () => {
        const aspectRatio = img.width / img.height;
        const width = 100; // Fixed width: 100px
        const height = width / aspectRatio; // Auto height to maintain aspect ratio

        const newSignature: SignatureAnnotation = {
          id: `sig-${Date.now()}`,
          x,
          y,
          width,
          height,
          page: pageNum,
          imageData: pendingSignature,
        };

        setSignatureAnnotations((prev) => [...prev, newSignature]);
        // DO NOT select the signature after placement - keeps it clean
        setSelectedSignatureId(null);

        // Show success toast with smooth animation
        toast({
          title: "✅ Signature added",
          description: "Your signature has been placed on the document.",
          duration: 2000,
          className: "bg-primary text-[#1a1a1a] border-primary",
        });

        console.log("✅ Signature placed successfully - no selection border!");
      };

      // Clear state immediately (don't wait for image load)
      setPendingSignature(null);
      setSignaturePlacementMode(false);
      setTool("select");
      document.body.style.cursor = "default";
    },
    [scale, pendingSignature, signaturePlacementMode, tool, toast]
  );

  // Signature modal handlers
  const handleDrawSignature = () => {
    if (signatureCanvasRef.current && !signatureCanvasRef.current.isEmpty()) {
      // Export with transparent background (PNG with transparency)
      const signatureDataURL =
        signatureCanvasRef.current.toDataURL("image/png");
      console.log("✅ Draw signature confirmed - transparent PNG created");

      // Set pending signature FIRST
      setPendingSignature(signatureDataURL);
      setSignaturePlacementMode(true);
      setTool("signature"); // Special tool mode for signature placement

      // Set cursor to crosshair (plus cursor) - professional and clean
      document.body.style.cursor = "crosshair";
      console.log("✅ Cursor set to crosshair (plus)");

      // Close modal after state is set
      setTimeout(() => {
        setSignatureModalOpen(false);
        console.log("✅ Modal closed - ready to place signature");
      }, 50); // Small delay to ensure state updates
    }
  };

  const handleTypeSignature = () => {
    if (typedSignature.trim()) {
      console.log("✅ Type signature confirmed");

      // Create signature image from text with transparent background
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (ctx) {
        // Measure text to get proper dimensions
        ctx.font = "italic 48px 'Brush Script MT', 'Dancing Script', cursive";
        const metrics = ctx.measureText(typedSignature);
        const textWidth = metrics.width;
        const textHeight = 60; // Approximate height for 48px font

        // Set canvas size to fit text with padding
        canvas.width = textWidth + 40; // 20px padding on each side
        canvas.height = textHeight + 20; // 10px padding top/bottom

        // Redraw with proper font (context resets after size change)
        ctx.font = "italic 48px 'Brush Script MT', 'Dancing Script', cursive";
        ctx.fillStyle = "#000000";
        ctx.textBaseline = "middle";
        ctx.fillText(typedSignature, 20, canvas.height / 2);
        const signatureDataURL = canvas.toDataURL("image/png"); // PNG with transparency

        // Set pending signature FIRST
        setPendingSignature(signatureDataURL);
        setSignaturePlacementMode(true);
        setTool("signature"); // Special tool mode for signature placement

        // Set cursor to crosshair (plus cursor) - professional and clean
        document.body.style.cursor = "crosshair";
        console.log("✅ Cursor set to crosshair (plus)");

        // Close modal after state is set
        setTimeout(() => {
          setSignatureModalOpen(false);
          console.log("✅ Modal closed - ready to place signature");
        }, 50);
      }
    }
  };

  const handleUploadSignature = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const signatureDataURL = event.target?.result as string;
        console.log("✅ Upload signature confirmed");

        // Set pending signature FIRST
        setSignatureImage(signatureDataURL);
        setPendingSignature(signatureDataURL);
        setSignaturePlacementMode(true);
        setTool("signature"); // Special tool mode for signature placement

        // Set cursor to crosshair (plus cursor) - professional and clean
        document.body.style.cursor = "crosshair";
        console.log("✅ Cursor set to crosshair (plus)");

        // Close modal after state is set
        setTimeout(() => {
          setSignatureModalOpen(false);
          console.log("✅ Modal closed - ready to place signature");
        }, 50);
      };
      reader.readAsDataURL(file);
    }
  };

  // Download PDF with annotations
  const handleDownload = async () => {
    try {
      const response = await fetch(pdfUrl);
      const arrayBuffer = await response.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      pdfDocRef.current = pdfDoc;

      const pages = pdfDoc.getPages();
      const helveticaFont = await pdfDoc.embedFont("Helvetica");

      // Add text annotations
      for (const annotation of textAnnotations) {
        const page = pages[annotation.page - 1];
        if (page) {
          try {
            // Convert hex color to RGB for pdf-lib
            const hex = annotation.color.replace("#", "");
            const r = parseInt(hex.substr(0, 2), 16) / 255;
            const g = parseInt(hex.substr(2, 2), 16) / 255;
            const b = parseInt(hex.substr(4, 2), 16) / 255;

            page.drawText(annotation.text, {
              x: annotation.x,
              y: page.getHeight() - annotation.y - annotation.height,
              size: annotation.fontSize,
              font: helveticaFont,
              color: rgb(r, g, b),
            });
          } catch (error) {
            console.error("Error adding text annotation:", error);
          }
        }
      }

      // Add signature annotations
      for (const annotation of signatureAnnotations) {
        const page = pages[annotation.page - 1];
        if (page) {
          try {
            if (annotation.imageData.startsWith("data:image/png")) {
              const base64Data =
                annotation.imageData.split(",")[1] || annotation.imageData;
              const imageBytes = Uint8Array.from(atob(base64Data), (c) =>
                c.charCodeAt(0)
              );
              const image = await pdfDoc.embedPng(imageBytes);
              page.drawImage(image, {
                x: annotation.x,
                y: page.getHeight() - annotation.y - annotation.height,
                width: annotation.width,
                height: annotation.height,
              });
            } else if (
              annotation.imageData.startsWith("data:image/jpeg") ||
              annotation.imageData.startsWith("data:image/jpg")
            ) {
              const base64Data =
                annotation.imageData.split(",")[1] || annotation.imageData;
              const imageBytes = Uint8Array.from(atob(base64Data), (c) =>
                c.charCodeAt(0)
              );
              const image = await pdfDoc.embedJpg(imageBytes);
              page.drawImage(image, {
                x: annotation.x,
                y: page.getHeight() - annotation.y - annotation.height,
                width: annotation.width,
                height: annotation.height,
              });
            }
          } catch (error) {
            console.error("Error adding signature annotation:", error);
          }
        }
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([new Uint8Array(pdfBytes)], {
        type: "application/pdf",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Golden_Luxury_Auto_Agreement_Signed.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download error:", error);
    }
  };

  // Print
  const handlePrint = () => {
    window.print();
  };

  // Final sign and save
  const handleFinalSign = useCallback(async (): Promise<Blob> => {
    const response = await fetch(pdfUrl);
    const arrayBuffer = await response.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer);

    const pages = pdfDoc.getPages();
    const helveticaFont = await pdfDoc.embedFont("Helvetica");

    // Add all text annotations
    for (const annotation of textAnnotations) {
      const page = pages[annotation.page - 1];
      if (page) {
        try {
          // Convert hex color to RGB for pdf-lib
          const hex = annotation.color.replace("#", "");
          const r = parseInt(hex.substr(0, 2), 16) / 255;
          const g = parseInt(hex.substr(2, 2), 16) / 255;
          const b = parseInt(hex.substr(4, 2), 16) / 255;

          page.drawText(annotation.text, {
            x: annotation.x,
            y: page.getHeight() - annotation.y - annotation.height,
            size: annotation.fontSize,
            font: helveticaFont,
            color: rgb(r, g, b),
          });
        } catch (error) {
          console.error("Error adding text annotation:", error);
        }
      }
    }

    // Add all signature annotations
    for (const annotation of signatureAnnotations) {
      const page = pages[annotation.page - 1];
      if (page) {
        try {
          // Convert data URL to image bytes
          let imageBytes: Uint8Array;
          if (annotation.imageData.startsWith("data:image/png")) {
            const base64Data =
              annotation.imageData.split(",")[1] || annotation.imageData;
            imageBytes = Uint8Array.from(atob(base64Data), (c) =>
              c.charCodeAt(0)
            );
            const image = await pdfDoc.embedPng(imageBytes);
            page.drawImage(image, {
              x: annotation.x,
              y: page.getHeight() - annotation.y - annotation.height,
              width: annotation.width,
              height: annotation.height,
            });
          } else if (
            annotation.imageData.startsWith("data:image/jpeg") ||
            annotation.imageData.startsWith("data:image/jpg")
          ) {
            const base64Data =
              annotation.imageData.split(",")[1] || annotation.imageData;
            imageBytes = Uint8Array.from(atob(base64Data), (c) =>
              c.charCodeAt(0)
            );
            const image = await pdfDoc.embedJpg(imageBytes);
            page.drawImage(image, {
              x: annotation.x,
              y: page.getHeight() - annotation.y - annotation.height,
              width: annotation.width,
              height: annotation.height,
            });
          }
        } catch (error) {
          console.error("Error adding signature annotation:", error);
        }
      }
    }

    const pdfBytes = await pdfDoc.save();
    return new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" });
  }, [textAnnotations, signatureAnnotations, pdfUrl]);

  // Expose handleFinalSign to parent
  useEffect(() => {
    if (onSignReady) {
      onSignReady(handleFinalSign);
    }
  }, [handleFinalSign, onSignReady]);

  // Maintain cursor state during signature placement mode
  useEffect(() => {
    if (signaturePlacementMode && pendingSignature) {
      // Set cursor to crosshair (plus cursor) for professional placement
      document.body.style.cursor = "crosshair";
      console.log("🖱️ Cursor set to crosshair");
    } else if (tool === "text") {
      document.body.style.cursor = "crosshair";
    } else {
      document.body.style.cursor = "default";
    }
  }, [signaturePlacementMode, pendingSignature, tool]);

  // Cleanup cursor on unmount
  useEffect(() => {
    return () => {
      document.body.style.cursor = "default";
    };
  }, []);

  return (
    <div
      className="relative w-full h-full bg-gray-100"
      onClick={(e) => {
        // Deselect annotations when clicking on empty space
        if (e.target === e.currentTarget) {
          setEditingTextId(null);
          setSelectedSignatureId(null);
          console.log("✅ Deselected all annotations - clicked empty space");
        }
      }}
    >
      {/* Global styles to remove any canvas outlines */}
      <style>{`
        canvas {
          outline: none !important;
          border: none !important;
        }
        canvas:focus {
          outline: none !important;
        }
      `}</style>
      {/* Fixed Toolbar - stays visible during scroll */}
      <div className="fixed top-4 right-4 z-[60] flex flex-col items-end gap-2">
        {/* Placement mode indicator */}
        {tool === "text" && (
          <div className="bg-primary text-[#1a1a1a] px-4 py-2 rounded-lg shadow-xl flex items-center gap-2 animate-pulse">
            <Type className="w-4 h-4" />
            <span className="text-sm font-semibold">
              Click on PDF to add text box
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setTool("select");
              }}
              className="ml-2 h-6 w-6 p-0 hover:bg-card/10"
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        )}

        {signaturePlacementMode && (
          <div className="bg-primary text-[#1a1a1a] px-4 py-2 rounded-lg shadow-xl flex items-center gap-2 animate-pulse">
            <PenTool className="w-4 h-4" />
            <span className="text-sm font-semibold">
              Click anywhere on the PDF to place your signature
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setPendingSignature(null);
                setSignaturePlacementMode(false);
                setTool("select");
                document.body.style.cursor = "default";
              }}
              className="ml-2 h-6 w-6 p-0 hover:bg-card/10"
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        )}

        {/* Toolbar */}
        <div className="flex items-center gap-2 bg-card border border-primary/30 rounded-lg p-2 shadow-2xl">
          {/* Tools */}
          <Button
            variant={tool === "text" ? "default" : "ghost"}
            size="sm"
            onClick={() => {
              setTool(tool === "text" ? "select" : "text");
            }}
            className={cn(
              tool === "text"
                ? "bg-primary text-[#1a1a1a]"
                : "text-[#D3BC8D] hover:bg-primary/20"
            )}
            title="Add Text (Click to activate, then click on PDF)"
          >
            <Type className="w-4 h-4" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSignatureModalOpen(true);
              setTool("select");
            }}
            className="text-[#D3BC8D] hover:bg-primary/20"
            title="Add Signature"
          >
            <PenTool className="w-4 h-4" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleDownload}
            className="text-[#D3BC8D] hover:bg-primary/20"
            title="Download"
          >
            <Download className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* PDF Viewer with Infinite Scroll */}
      <div
        ref={containerRef}
        className="w-full h-full overflow-y-auto overflow-x-hidden"
      >
        {pdfError ? (
          <div className="flex items-center justify-center h-full text-red-500">
            <p>Failed to load PDF: {pdfError}</p>
          </div>
        ) : (
          <div
            className="flex flex-col items-center py-8"
            style={{
              cursor:
                signaturePlacementMode && pendingSignature
                  ? "crosshair"
                  : tool === "text"
                  ? "crosshair"
                  : "default",
            }}
          >
            <Document
              file={pdfUrl}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={onDocumentLoadError}
              options={documentOptions}
            >
              {Array.from(new Array(numPages), (el, index) => {
                const pageNumber = index + 1;
                return (
                  <PDFPageWithAnnotations
                    key={`page-${pageNumber}`}
                    pageNumber={pageNumber}
                    scale={scale}
                    textAnnotations={textAnnotations}
                    signatureAnnotations={signatureAnnotations}
                    editingTextId={editingTextId}
                    selectedSignatureId={selectedSignatureId}
                    tool={tool}
                    onTextEdit={handleTextEditCallback}
                    onTextChange={handleTextChange}
                    onTextBlur={handleTextBlurCallback}
                    onTextRemove={handleTextRemove}
                    onTextPositionChange={handleTextPositionChange}
                    onTextSizeChange={handleTextSizeChange}
                    onSignatureSelect={setSelectedSignatureId}
                    onSignatureRemove={handleSignatureRemove}
                    onSignaturePositionChange={handleSignaturePositionChange}
                    onSignatureSizeChange={handleSignatureSizeChange}
                    onPageClick={(e) => {
                      console.log("Page clicked", {
                        signaturePlacementMode,
                        tool,
                        pageNumber,
                      });
                      setSelectedSignatureId(null);

                      // Check if clicked on empty space (not on annotation)
                      const target = e.target as HTMLElement;
                      const clickedOnAnnotation =
                        target.closest(".annotation-box");

                      if (!clickedOnAnnotation) {
                        // Clicked on empty PDF space
                        if (signaturePlacementMode) {
                          console.log("Calling handleSignatureClick");
                          handleSignatureClick(e, pageNumber);
                        } else if (tool === "text") {
                          handleTextClick(e, pageNumber);
                        } else {
                          // Deselect all when clicking empty space in select mode
                          setEditingTextId(null);
                          console.log(
                            "✅ Deselected all - clicked empty PDF space"
                          );
                          setSelectedSignatureId(null);
                        }
                      }
                    }}
                  />
                );
              })}
            </Document>
          </div>
        )}
      </div>

      {/* Signature Modal */}
      <Dialog
        open={signatureModalOpen}
        onOpenChange={(open) => {
          // Only handle opening the modal, not closing
          // When closing via "Use This Signature", the handlers already close it
          if (open) {
            setSignatureModalOpen(true);
          } else {
            // Only close if we're not in placement mode
            // (placement mode means user clicked "Use This Signature")
            setTimeout(() => {
              // Use setTimeout to check state after signature handlers have run
              if (!signaturePlacementMode) {
                setSignatureModalOpen(false);
                // Clear the signature canvas when closing without confirming
                signatureCanvasRef.current?.clear();
                setTypedSignature("");
                setSignatureImage(null);
              }
            }, 0);
          }
        }}
      >
        <DialogContent
          className="bg-card border-2 border-primary/30 text-foreground 
             max-w-md w-[90vw] sm:max-w-lg shadow-2xl 
             z-50 
             sm:z-[100] 
             md:z-[9999]"
        >
          <DialogHeader>
            <DialogTitle className="text-[#D3BC8D] text-xl font-semibold">
              Add Signature
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-sm">
              Choose how you want to add your signature
            </DialogDescription>
          </DialogHeader>

          <Tabs
            value={signatureType}
            onValueChange={(v) => setSignatureType(v as any)}
          >
            <TabsList className="bg-[#2d2d2d] border-primary/30">
              <TabsTrigger
                value="type"
                className="text-muted-foreground data-[state=active]:text-[#D3BC8D]"
              >
                Type
              </TabsTrigger>
              <TabsTrigger
                value="draw"
                className="text-muted-foreground data-[state=active]:text-[#D3BC8D]"
              >
                Draw
              </TabsTrigger>
              <TabsTrigger
                value="upload"
                className="text-muted-foreground data-[state=active]:text-[#D3BC8D]"
              >
                Upload
              </TabsTrigger>
            </TabsList>

            <TabsContent value="type" className="mt-4">
              <div className="space-y-3">
                <Input
                  placeholder="Type your name"
                  value={typedSignature}
                  onChange={(e) => setTypedSignature(e.target.value)}
                  className="bg-[#2d2d2d] border-primary/30 text-foreground"
                />
                {typedSignature && (
                  <div className="relative bg-white p-3 rounded-lg border-2 border-primary shadow-md w-fit mx-auto">
                    {/* Checkered pattern to show transparency */}
                    <div
                      className="absolute inset-0 rounded-lg"
                      style={{
                        backgroundImage: `
                          linear-gradient(45deg, #f9f9f9 25%, transparent 25%),
                          linear-gradient(-45deg, #f9f9f9 25%, transparent 25%),
                          linear-gradient(45deg, transparent 75%, #f9f9f9 75%),
                          linear-gradient(-45deg, transparent 75%, #f9f9f9 75%)
                        `,
                        backgroundSize: "12px 12px",
                        backgroundPosition: "0 0, 0 6px, 6px -6px, -6px 0px",
                      }}
                    />
                    <p
                      className="relative text-black italic text-4xl font-serif leading-tight px-4 py-2"
                      style={{
                        fontFamily:
                          "'Brush Script MT', 'Dancing Script', cursive",
                      }}
                    >
                      {typedSignature}
                    </p>
                  </div>
                )}
                <Button
                  onClick={handleTypeSignature}
                  disabled={!typedSignature.trim()}
                  className="w-full bg-primary text-[#1a1a1a] hover:bg-muted/50f4d03f] font-semibold"
                >
                  Confirm Signature
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  After clicking "Confirm", click anywhere on the PDF to place
                  your signature.
                </p>
              </div>
            </TabsContent>

            <TabsContent value="draw" className="mt-4">
              <div className="space-y-3">
                <div className="bg-white rounded-lg p-3 border-2 border-primary shadow-md relative">
                  {/* Checkered pattern background to show transparency */}
                  <div
                    className="absolute inset-3 rounded"
                    style={{
                      backgroundImage: `
                        linear-gradient(45deg, #f9f9f9 25%, transparent 25%),
                        linear-gradient(-45deg, #f9f9f9 25%, transparent 25%),
                        linear-gradient(45deg, transparent 75%, #f9f9f9 75%),
                        linear-gradient(-45deg, transparent 75%, #f9f9f9 75%)
                      `,
                      backgroundSize: "12px 12px",
                      backgroundPosition: "0 0, 0 6px, 6px -6px, -6px 0px",
                      zIndex: 0,
                    }}
                  />
                  <SignatureCanvas
                    ref={signatureCanvasRef}
                    canvasProps={{
                      className: "w-full h-32 touch-none relative z-10",
                      style: { touchAction: "none" },
                    }}
                    backgroundColor="rgba(255, 255, 255, 0)"
                    penColor="#000000"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      signatureCanvasRef.current?.clear();
                      // Also clear any pending signature state
                      setPendingSignature(null);
                      setSignaturePlacementMode(false);
                      document.body.style.cursor = "default";
                    }}
                    className="flex-1 border-primary/30 text-[#D3BC8D] hover:bg-primary/10"
                  >
                    Clear
                  </Button>
                  <Button
                    onClick={handleDrawSignature}
                    disabled={signatureCanvasRef.current?.isEmpty()}
                    className="flex-1 bg-primary text-[#1a1a1a] hover:bg-muted/50f4d03f] font-semibold"
                  >
                    Confirm Signature
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  Draw your signature above. After clicking "Confirm", click on
                  the PDF to place it.
                </p>
              </div>
            </TabsContent>

            <TabsContent value="upload" className="mt-4">
              <div className="space-y-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg"
                  onChange={handleUploadSignature}
                  className="hidden"
                />
                {signatureImage && (
                  <div className="relative bg-white p-3 rounded-lg border-2 border-primary shadow-md w-fit mx-auto max-w-full">
                    {/* Checkered pattern to show transparency */}
                    <div
                      className="absolute inset-3 rounded-lg"
                      style={{
                        backgroundImage: `
                          linear-gradient(45deg, #f9f9f9 25%, transparent 25%),
                          linear-gradient(-45deg, #f9f9f9 25%, transparent 25%),
                          linear-gradient(45deg, transparent 75%, #f9f9f9 75%),
                          linear-gradient(-45deg, transparent 75%, #f9f9f9 75%)
                        `,
                        backgroundSize: "12px 12px",
                        backgroundPosition: "0 0, 0 6px, 6px -6px, -6px 0px",
                      }}
                    />
                    <img
                      src={signatureImage}
                      alt="Uploaded signature"
                      className="relative max-w-full h-auto mx-auto max-h-32 object-contain"
                    />
                  </div>
                )}
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full bg-primary text-[#1a1a1a] hover:bg-muted/50f4d03f] font-semibold"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {signatureImage
                    ? "Choose Different Image"
                    : "Upload Signature Image"}
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Upload a transparent PNG for best results. After upload, click
                  on the PDF to place it.
                </p>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}
