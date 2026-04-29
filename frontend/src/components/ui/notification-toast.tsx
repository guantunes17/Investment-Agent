"use client";

import { Toaster as SonnerToaster } from "sonner";

export function Toaster() {
  return (
    <SonnerToaster
      position="top-right"
      toastOptions={{
        className:
          "!bg-glass !border !border-glass-border !backdrop-blur-xl !text-text-primary !shadow-[0_8px_32px_rgba(0,0,0,0.4)]",
        descriptionClassName: "!text-text-secondary",
      }}
      gap={8}
    />
  );
}
