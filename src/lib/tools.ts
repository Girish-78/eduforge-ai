import type { GenerateType } from "@/lib/prompt-templates";
import type { UserRole } from "@/lib/roles";

export type ToolSlug =
  | "lesson-plan"
  | "worksheet"
  | "question-paper"
  | "cheatsheet"
  | "notes"
  | "practice-questions";

export type ToolFieldType = "text" | "number" | "textarea";

export interface ToolFieldDefinition {
  name: string;
  label: string;
  type: ToolFieldType;
  placeholder: string;
  required?: boolean;
  helperText?: string;
  min?: number;
  max?: number;
  rows?: number;
}

export interface ToolDefinition {
  type: GenerateType;
  slug: ToolSlug;
  title: string;
  navLabel: string;
  description: string;
  summary: string;
  roles: UserRole[];
  fields: ToolFieldDefinition[];
}

export interface ToolAttachmentSummary {
  name: string;
  size: number;
  type: string;
}

const sharedFields = {
  schoolName: {
    name: "schoolName",
    label: "School Name",
    type: "text",
    placeholder: "Enter your school name",
    required: true,
  },
  subject: {
    name: "subject",
    label: "Subject",
    type: "text",
    placeholder: "Example: Science",
    required: true,
  },
  className: {
    name: "className",
    label: "Class",
    type: "text",
    placeholder: "Example: Class 8",
    required: true,
  },
  chapter: {
    name: "chapter",
    label: "Chapter / Topic",
    type: "text",
    placeholder: "Example: Photosynthesis",
    required: true,
  },
  customInstructions: {
    name: "customInstructions",
    label: "Prompt Box",
    type: "textarea",
    placeholder: "Add any custom instructions for layout, format, depth, style, or question pattern.",
    helperText:
      "Optional instructions are treated as highest-priority user guidance and override the default tool format.",
    rows: 5,
  },
} as const satisfies Record<string, ToolFieldDefinition>;

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    type: "lesson_plan",
    slug: "lesson-plan",
    title: "Lesson Plan Generator",
    navLabel: "Lesson Plan",
    description:
      "Create detailed classroom lesson plans with objectives, activities, assessments, and homework.",
    summary: "Build structured daily and weekly class plans in seconds.",
    roles: ["teacher"],
    fields: [
      sharedFields.schoolName,
      sharedFields.subject,
      sharedFields.className,
      sharedFields.chapter,
      {
        name: "periods",
        label: "No. of Periods",
        type: "number",
        placeholder: "Example: 2",
        required: true,
        min: 1,
        max: 12,
      },
      {
        name: "duration",
        label: "Duration",
        type: "text",
        placeholder: "Example: 45 minutes each",
        required: true,
      },
      sharedFields.customInstructions,
    ],
  },
  {
    type: "worksheet",
    slug: "worksheet",
    title: "Worksheet Generator",
    navLabel: "Worksheet",
    description:
      "Generate conceptual and numerical worksheet questions aligned to your topic.",
    summary: "Create classroom worksheets with questions and activities.",
    roles: ["teacher"],
    fields: [
      sharedFields.schoolName,
      sharedFields.subject,
      sharedFields.className,
      sharedFields.chapter,
      {
        name: "questionCount",
        label: "No. of Questions",
        type: "number",
        placeholder: "Example: 12",
        required: true,
        min: 1,
        max: 50,
      },
      {
        name: "worksheetFocus",
        label: "Worksheet Focus",
        type: "text",
        placeholder: "Example: Conceptual + HOTS + MCQs",
      },
      sharedFields.customInstructions,
    ],
  },
  {
    type: "question_paper",
    slug: "question-paper",
    title: "Question Paper Generator",
    navLabel: "Question Paper",
    description:
      "Generate section-wise school question papers with balanced difficulty.",
    summary: "Generate exam-ready papers with balanced difficulty levels.",
    roles: ["teacher"],
    fields: [
      sharedFields.schoolName,
      sharedFields.subject,
      sharedFields.className,
      sharedFields.chapter,
      {
        name: "examName",
        label: "Exam / Assessment Name",
        type: "text",
        placeholder: "Example: Unit Test 1",
      },
      {
        name: "totalMarks",
        label: "Total Marks",
        type: "number",
        placeholder: "Example: 40",
        required: true,
        min: 1,
        max: 200,
      },
      {
        name: "duration",
        label: "Duration",
        type: "text",
        placeholder: "Example: 90 minutes",
        required: true,
      },
      sharedFields.customInstructions,
    ],
  },
  {
    type: "cheatsheet",
    slug: "cheatsheet",
    title: "Cheatsheet Generator",
    navLabel: "Cheatsheet",
    description:
      "Create quick-reference concept sheets for revision and retention.",
    summary: "Create quick, high-retention revision sheets.",
    roles: ["teacher", "student"],
    fields: [
      sharedFields.schoolName,
      sharedFields.subject,
      sharedFields.className,
      sharedFields.chapter,
      {
        name: "focusAreas",
        label: "Focus Areas",
        type: "text",
        placeholder: "Example: Formulas, definitions, diagrams",
      },
      sharedFields.customInstructions,
    ],
  },
  {
    type: "notes",
    slug: "notes",
    title: "Notes Generator",
    navLabel: "Notes",
    description: "Generate concise study notes from your topic input.",
    summary: "Summarize concepts into clear revision notes.",
    roles: ["student"],
    fields: [
      sharedFields.schoolName,
      sharedFields.subject,
      sharedFields.className,
      sharedFields.chapter,
      {
        name: "learningGoal",
        label: "Learning Goal",
        type: "text",
        placeholder: "Example: Exam revision or concept clarity",
      },
      sharedFields.customInstructions,
    ],
  },
  {
    type: "practice_questions",
    slug: "practice-questions",
    title: "Practice Questions Generator",
    navLabel: "Practice Questions",
    description:
      "Generate mixed-difficulty practice sets with hints and self-check sections.",
    summary: "Prepare targeted practice sets with answer guidance.",
    roles: ["student"],
    fields: [
      sharedFields.schoolName,
      sharedFields.subject,
      sharedFields.className,
      sharedFields.chapter,
      {
        name: "questionCount",
        label: "No. of Questions",
        type: "number",
        placeholder: "Example: 15",
        required: true,
        min: 1,
        max: 50,
      },
      {
        name: "difficultyMix",
        label: "Difficulty Mix",
        type: "text",
        placeholder: "Example: 5 easy, 5 medium, 5 hard",
      },
      sharedFields.customInstructions,
    ],
  },
];

export const TOOL_FILE_ACCEPT =
  ".pdf,.docx,.png,.jpg,.jpeg,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/png,image/jpeg";

export const TOOL_FILE_MAX_SIZE = 10 * 1024 * 1024;

export function getToolByType(type: GenerateType) {
  return TOOL_DEFINITIONS.find((tool) => tool.type === type) ?? null;
}

export function getToolBySlug(slug: ToolSlug) {
  return TOOL_DEFINITIONS.find((tool) => tool.slug === slug) ?? null;
}

export function getToolRoute(tool: ToolDefinition) {
  return `/dashboard/tools/${tool.slug}`;
}

export function getToolsForRole(role: UserRole) {
  return TOOL_DEFINITIONS.filter((tool) => tool.roles.includes(role));
}

export function userCanAccessTool(role: UserRole, type: GenerateType) {
  const tool = getToolByType(type);
  return Boolean(tool?.roles.includes(role));
}

export function buildToolPromptInput(
  tool: ToolDefinition,
  values: Record<string, string>,
  attachments: ToolAttachmentSummary[],
) {
  const lines = [`Tool: ${tool.navLabel}`];

  for (const field of tool.fields) {
    const value = values[field.name]?.trim() ?? "";
    if (!value) {
      continue;
    }

    if (field.name === "customInstructions") {
      lines.push(
        "User Priority Instructions: Follow these custom instructions over the default tool format unless they conflict with the core quality rules.",
      );
      lines.push(value);
      continue;
    }

    lines.push(`${field.label}: ${value}`);
  }

  if (attachments.length > 0) {
    lines.push(
      `Reference Files: ${attachments
        .map((file) => `${file.name} (${formatFileSize(file.size)}, ${file.type || "unknown type"})`)
        .join("; ")}`,
    );
  }

  return lines.join("\n");
}

export function getToolDocumentTitle(
  tool: ToolDefinition,
  values: Record<string, string>,
) {
  const subject = values.subject?.trim();
  const chapter = values.chapter?.trim();
  const className = values.className?.trim();

  return [tool.navLabel, subject, chapter, className].filter(Boolean).join(" - ");
}

function formatFileSize(size: number) {
  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${Math.round(size / 1024)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
