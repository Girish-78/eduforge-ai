import { ToolGenerator } from "@/components/tools/tool-generator";

export default function NotesPage() {
  return (
    <ToolGenerator
      title="Notes Generator"
      description="Generate concise study notes from your topic input."
      type="essay"
      placeholder="Enter a chapter or topic. Example: Human digestive system summary for class 7."
    />
  );
}

