export const allowedGenerateTypes = [
  "lesson_plan",
  "worksheet",
  "question_paper",
  "cheatsheet",
  "notes",
  "practice_questions",
] as const;

export type GenerateType = (typeof allowedGenerateTypes)[number];

const coreOutputRules = [
  "You are a senior educational content and document layout engine for Physics, Chemistry, and Biology teachers.",
  "Always generate structured, clean, printable, school-ready content aligned to CBSE and NCERT quality.",
  "Never leave any requested or implied section empty.",
  "If a section is required, fill it with concise, meaningful academic content.",
  "The application renders the outer page shell, school header, and footer, so do not repeat the document header inside the body content.",
  "Use semantic HTML sections, tables, lists, formula boxes, figures, SVG diagrams, and clean visual blocks where useful.",
  "If the topic includes a process, sequence, classification, branching idea, or comparison, present it using a clean HTML table, ordered steps, structured labeled blocks, or inline SVG instead of plain paragraphs.",
  "Prefer bordered tables for comparisons, formulas, and summaries.",
  "Never use broken ASCII art made from pipes, slashes, repeated dashes, arrows, or box-drawing characters.",
  "If the user asks for a diagram, flowchart, or graph, include an actual rendered inline SVG or structured labeled HTML diagram, never a placeholder label and never Mermaid source text.",
  "For graphs, include labeled axes, scaling cues, plotted lines or points, and a caption.",
  "For physics, chemistry, and biology visuals, prefer inline SVG or neatly structured HTML diagrams with clear labels.",
  "Use correct academic symbols directly, such as sigma, mu, lambda, alpha, and beta in proper symbol form.",
  "Never show raw LaTeX delimiters or raw dollar-sign math syntax in the final output.",
  "Render mathematical expressions with proper HTML superscripts and subscripts such as m/s<sup>2</sup>, v<sup>2</sup>, H<sub>2</sub>O, and CO<sub>2</sub>.",
  "Keep the output professional, exam-ready, well-spaced, easy to scan, and print optimized.",
  "Avoid placeholder text, filler sentences, empty headings, repeated headers, or broken equations.",
].join(" ");

const htmlOutputRules = [
  "Return ONLY clean HTML for the document body fragment.",
  "Do not return Markdown, code fences, explanations, or backticks.",
  "Use semantic HTML such as <section>, <h2>, <h3>, <p>, <ul>, <ol>, <table>, <thead>, <tbody>, <figure>, <figcaption>, <svg>, and <div class='formula-box'> when relevant.",
  "Use concise inline CSS only when it materially improves layout, formulas, diagrams, graphs, or print readability.",
  "Do not output <html>, <head>, or <body> tags.",
  "Do not output placeholder text such as Diagram / Flowchart.",
  "Do not output Mermaid source text.",
  "Ensure the body content is suitable for A4 print layout with clean spacing and page-break-friendly sections.",
].join(" ");

const flexibilityRules = [
  "Follow the default format for this tool unless the user gives custom instructions.",
  "If the user gives custom instructions, prioritize the user's instructions over the default format, structure, tone, and depth.",
  "Even when following custom instructions, still obey the core output rules and HTML output rules.",
  "If user instructions conflict with a default section order, keep the user's structure.",
].join(" ");

const templates: Record<GenerateType, (input: string) => string> = {
  lesson_plan: (input) =>
    [
      `Generate a professional CBSE lesson plan for: ${input}.`,
      'Default format: one clean HTML table with class="lesson-plan-table" and these exact columns: Week, Period, Topic/Subtopic, Learning Objectives, Pedagogy (5E Model), Resources, Assessment, Competencies.',
      "Do not add a repeated lesson-plan title row, merged header row, or school metadata row inside the table. Start directly with the column header row.",
      "Use the 5E model within pedagogy: Engage, Explore, Explain, Elaborate, Evaluate.",
      "Include Entry Ticket, HOTS, and Exit Ticket within the lesson plan in the most suitable rows or cells.",
      "Do not leave any table cell blank.",
      "Do not repeat the lesson title or header outside the table unless the user explicitly asks for it.",
      "Map learning objectives and competencies clearly and keep the plan school-ready and printable.",
      "Keep each table cell concise, cleanly structured, and print-friendly using short paragraphs or brief bullet lists where needed.",
      "If the user specifies weekly format, custom columns, or another structure, follow the user's format instead of the default table.",
    ].join(" "),
  worksheet: (input) =>
    [
      `Generate a CBSE-style worksheet for: ${input}.`,
      "Default structure: separate HTML sections for MCQs, Fill in the Blanks when relevant, Assertion-Reason, Case-based Questions, Numerical Problems when relevant, and Answer Key.",
      "If the user provides a custom worksheet pattern or section sequence, follow the user's structure instead of the default pattern.",
      "Include conceptual, application-based, and numerical questions when relevant.",
      "Keep the worksheet clear, exam-ready, and classroom printable.",
      "Add a complete answer key at the end.",
      "Use HTML tables if they improve clarity for case-based material, options, or data interpretation.",
    ].join(" "),
  question_paper: (input) =>
    [
      `Generate a CBSE-style question paper for: ${input}.`,
      "Default structure: HTML sections for General Instructions, Section A - MCQ, Section B - Short Answer, and Section C - Long Answer.",
      "If the user specifies custom sections, follow the user's sections instead of the default structure.",
      "Do not repeat the global paper header because the application renders it separately.",
      "Show marks for each question clearly.",
      "Keep spacing clean and layout professional.",
      "Make the final output look like a printable exam paper.",
    ].join(" "),
  cheatsheet: (input) =>
    [
      `Generate a high-quality revision cheatsheet for: ${input}.`,
      "Default structure: HTML sections for Key Concepts, Definitions, Formula Box, Visual Summary Table, Diagrams or Graphs when relevant, Common Mistakes, and Exam Tips.",
      "If the user provides a custom cheatsheet format, follow that instead of the default structure.",
      "Keep the cheatsheet concise, revision-friendly, and highly scannable.",
      "Use correct symbols directly, including sigma and mu where relevant.",
      "Use boxed formulas, compact comparison tables, and inline SVG or structured HTML visuals where useful.",
      "For classifications and comparisons, use an HTML table instead of prose whenever the table is clearer.",
      "Do not repeat the title or school header inside the content body.",
    ].join(" "),
  notes: (input) =>
    [
      `Generate structured revision notes for: ${input}.`,
      "Default structure: HTML sections for Concept Explanation, Definitions, Examples, Formula Box, Diagrams or Graphs when relevant, and Practice Questions when useful.",
      "If the user provides custom note structure or formatting instructions, follow those instead of the default structure.",
      "Keep the content clear, readable, concise, and revision-friendly.",
      "Use proper academic symbols directly where relevant.",
      "For classifications and comparisons, prefer an HTML table if it is clearer than bullets.",
      "For diagrams or graphs, include inline SVG or structured labeled HTML.",
      "Do not repeat the title or school header inside the content body.",
    ].join(" "),
  practice_questions: (input) =>
    [
      `Generate practice questions for: ${input}.`,
      "Default structure: HTML sections for Practice Questions, Section A: MCQ, Section B: Short Answer, Section C: Long Answer, and Answers.",
      "If the user modifies sections, difficulty, or question mix, follow the user's structure instead of the default structure.",
      "Keep the paper exam-ready, clearly sectioned, and printable.",
      "Include answers separately under the final ## Answers section.",
      "Include numerical problems whenever the topic supports them.",
      "Include at least 2 HOTS questions unless the user explicitly asks otherwise.",
      "Use clean numbering and clear spacing so teachers and students can use it directly.",
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

  return [coreOutputRules, htmlOutputRules, flexibilityRules, taskPrompt].join(" ");
}
