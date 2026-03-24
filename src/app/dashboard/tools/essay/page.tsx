import { ToolGenerator } from "@/components/tools/tool-generator";

export default function EssayPage() {
  return (
    <ToolGenerator
      title="Essay Generator"
      description="Create student-friendly, well-structured essays with clear flow."
      type="essay"
      placeholder="Enter essay topic. Example: Importance of environmental conservation."
    />
  );
}

