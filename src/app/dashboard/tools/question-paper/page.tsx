import { ToolGenerator } from "@/components/tools/tool-generator";

export default function QuestionPaperPage() {
  return (
    <ToolGenerator
      title="Question Paper Generator"
      description="Generate section-wise school question papers with balanced difficulty."
      type="question_paper"
      placeholder="Enter subject, class, and chapter scope. Example: Class 9 Science - Motion and Force, 40 marks."
    />
  );
}
