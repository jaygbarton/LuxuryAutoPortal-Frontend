import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Full-screen viewer layer (document/receipt lightbox).
 *
 * Rendered as its own Radix dialog so it works when opened from INSIDE another
 * Dialog: a plain `fixed` div there sits under the parent's portaled content
 * (z-[4001]), gets no pointer events (Radix sets `pointer-events: none` on
 * <body> while a modal is open), and a click on it counts as "outside" and
 * dismisses the parent. A nested Radix layer is portaled above the parent,
 * receives pointer events, and Escape closes only this layer.
 */
export function FullscreenLayer({
  onClose,
  title,
  className,
  children,
}: {
  onClose: () => void;
  /** Screen-reader title for the layer. */
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <DialogPrimitive.Root open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className={cn("fixed inset-0 z-[4010] flex items-center justify-center outline-none", className)}
          onClick={onClose}
        >
          <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** Click-to-close full-size image viewer built on {@link FullscreenLayer}. */
export function ImageLightbox({ url, alt, onClose }: { url: string; alt: string; onClose: () => void }) {
  return (
    <FullscreenLayer onClose={onClose} title={alt} className="bg-black/80 p-4">
      <button
        className="absolute top-4 right-4 text-white/80 hover:text-white"
        onClick={onClose}
        aria-label="Close"
      >
        <X className="h-7 w-7" />
      </button>
      <img
        src={url}
        alt={alt}
        className="max-w-full max-h-full rounded-lg shadow-2xl object-contain"
        onClick={(e) => e.stopPropagation()}
      />
    </FullscreenLayer>
  );
}
