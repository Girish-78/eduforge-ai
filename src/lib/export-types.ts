import type { GenerateType } from "@/lib/prompt-templates";

export interface ExportLogoPayload {
  downloadUrl: string;
  imageType: "jpg" | "png";
  width: number;
  height: number;
}

export interface ExportFilePayload {
  title: string;
  content: string;
  toolType: GenerateType;
  schoolName?: string;
  className?: string;
  subject?: string;
  chapter?: string;
  periods?: string;
  logo?: ExportLogoPayload | null;
}
