export const allowedGenerateTypes = [
  "lesson_plan",
  "worksheet",
  "question_paper",
  "cheatsheet",
  "notes",
  "practice_questions",
] as const;

export type GenerateType = (typeof allowedGenerateTypes)[number];

const markdownOutputRules = [
  "Output in STRICT Markdown only.",
  "Never use LaTeX syntax like \\section, \\subsection, \\item, \\begin, \\end.",
  "Use headings with ## and ### only.",
  "Use bullet points with maximum 12 words per bullet.",
  "Use Markdown tables when comparing or summarizing structured data.",
  "Bold key academic terms and action words with **double asterisks**.",
  "Keep writing clean, classroom-friendly, and easy to scan.",
  "Do not output code fences unless explicitly requested.",
].join(" ");

const templates: Record<GenerateType, (input: string) => string> = {
  lesson_plan: (input) =>
    [
      `Create a detailed CBSE lesson plan for: ${input}.`,
      "Include sections for objectives, prior knowledge, activities, assessment, differentiation, and homework.",
      "Map objectives to Bloom's taxonomy where relevant.",
      "Add competency-based tasks and at least 3 HOTS questions.",
      "Use practical examples suitable for Indian classrooms.",
    ].join(" "),
  worksheet: (input) =>
    [
      `Generate a CBSE-style worksheet for: ${input}.`,
      "Include conceptual, application-based, and numerical questions when relevant.",
      "Group content by Bloom's taxonomy levels with clear labels.",
      "Include competency-based prompts and at least 3 HOTS questions.",
      "Add a short answer key section for teachers.",
    ].join(" "),
  question_paper: (input) =>
    [
      `Create a school question paper for: ${input}.`,
      "Include section-wise marks and total marks summary.",
      "Balance easy, medium, and hard questions clearly.",
      "Cover objective, short-answer, and long-answer question formats.",
      "Add concise answer key points for teachers at the end.",
    ].join(" "),
  cheatsheet: (input) =>
    [
      `Generate a compact classroom cheatsheet for: ${input}.`,
      "Prioritize formulas, key terms, definitions, and quick memory cues.",
      "Include a summary table for fast revision.",
      "Keep each bullet short and exam-focused.",
    ].join(" "),
  notes: (input) =>
    [
      `Generate clean, printable student notes for: ${input}.`,
      "Return STRICT Markdown only.",
      "Use this exact section order: ## Topic Title, ## Key Concepts, ## Step-by-Step Explanation, ## Important Terms, ## Revision Table, ## Quick Recap.",
      "Start every section with a ## heading.",
      "Add a blank line between sections.",
      "Use bullet points with maximum 10 words per bullet.",
      "Do not compress ideas into single lines or merged sentences.",
      "Ensure the revision table uses valid Markdown with a header row.",
      "Keep the layout PDF-friendly, readable, and classroom-focused.",
    ].join(" "),
  practice_questions: (input) =>
    [
      `Generate practice questions for: ${input}.`,
      "Include at least 12 questions with mixed difficulty.",
      "Add short hints or expected answer points after each question.",
      "Provide a final self-check table for progress tracking.",
    ].join(" "),
};

export function isGenerateType(value: string): value is GenerateType {
  return allowedGenerateTypes.includes(value as GenerateType);
}

export function generatePrompt({
  toolType,
  inputs,
}: {
  toolType: GenerateType;
  inputs: string;
}) {
  const normalized = inputs.trim();
  const taskPrompt = templates[toolType](normalized);
  return `${taskPrompt} ${markdownOutputRules}`;
}

