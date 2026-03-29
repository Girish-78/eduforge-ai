import { ToolGenerator } from "@/components/tools/tool-generator";

export default function CheatsheetPage() {
  return (
    <ToolGenerator
      title="Cheatsheet Generator"
      description="Create quick-reference concept sheets for revision and retention."
      type="cheatsheet"
      placeholder="Enter topic and grade. Example: Trigonometry identities for class 10."
    />
  );
}
