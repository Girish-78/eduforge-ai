import { ToolGenerator } from "@/components/tools/tool-generator";

export default function PracticeQuestionsPage() {
  return (
    <ToolGenerator
      title="Practice Questions Generator"
      description="Generate mixed-difficulty practice sets with hints and self-check sections."
      type="practice_questions"
      placeholder="Enter topic and level. Example: Algebraic expressions practice for class 8."
    />
  );
}
