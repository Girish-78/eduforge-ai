import { ToolGenerator } from "@/components/tools/tool-generator";

export default function ProjectsPage() {
  return (
    <ToolGenerator
      title="Projects Planner"
      description="Create structured project briefs with goals, milestones, and outcomes."
      type="lesson_plan"
      placeholder="Enter project theme and class. Example: Renewable energy model project for class 10."
    />
  );
}

