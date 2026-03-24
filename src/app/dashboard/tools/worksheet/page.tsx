import { ToolGenerator } from "@/components/tools/tool-generator";

export default function WorksheetPage() {
  return (
    <ToolGenerator
      title="Worksheet Generator"
      description="Generate conceptual and numerical worksheet questions aligned to your topic."
      type="worksheet"
      placeholder="Enter topic and grade level. Example: Linear equations for class 9."
    />
  );
}

