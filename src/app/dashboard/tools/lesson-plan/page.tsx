import { ToolGenerator } from "@/components/tools/tool-generator";

export default function LessonPlanPage() {
  return (
    <ToolGenerator
      title="Lesson Plan Generator"
      description="Create detailed classroom lesson plans with objectives, activities, assessments, and homework."
      type="lesson_plan"
      placeholder="Enter topic and class context. Example: Photosynthesis for class 8, 45-minute session."
    />
  );
}

