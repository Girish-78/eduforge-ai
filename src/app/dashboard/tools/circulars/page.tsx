import { ToolGenerator } from "@/components/tools/tool-generator";

export default function CircularsPage() {
  return (
    <ToolGenerator
      title="Circulars Generator"
      description="Generate formal circular notices for students, staff, and parents."
      type="email"
      placeholder="Enter circular context. Example: School holiday notice for upcoming festival."
    />
  );
}

