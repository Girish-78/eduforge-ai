import { ToolGenerator } from "@/components/tools/tool-generator";

export default function ReportsPage() {
  return (
    <ToolGenerator
      title="Reports Generator"
      description="Draft clear school/admin reports with structured sections."
      type="email"
      placeholder="Enter reporting context. Example: Monthly attendance and performance summary."
    />
  );
}

