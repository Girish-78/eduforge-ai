import { ToolGenerator } from "@/components/tools/tool-generator";

export default function EmailPage() {
  return (
    <ToolGenerator
      title="School Email Generator"
      description="Draft a professional and polished school email quickly."
      type="email"
      placeholder="Enter the context. Example: Parent communication about tomorrow's science exhibition."
    />
  );
}

