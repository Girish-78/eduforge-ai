export const allowedGenerateTypes = [
  "lesson_plan",
  "worksheet",
  "email",
  "essay",
] as const;

export type GenerateType = (typeof allowedGenerateTypes)[number];

const templates: Record<GenerateType, string> = {
  lesson_plan:
    [
      "Create a detailed CBSE lesson plan for {topic}.",
      "Use clear sections: Learning Objectives, Prior Knowledge, Teaching-Learning Activities, Formative Assessment, Differentiation, Homework.",
      "Map objectives to Bloom's taxonomy levels (Remember, Understand, Apply, Analyze, Evaluate, Create) with at least one objective in each relevant level.",
      "Include competency-based tasks aligned to real classroom outcomes.",
      "Add at least 3 HOTS (Higher Order Thinking Skills) questions.",
      "Keep language teacher-friendly and practical for Indian school classrooms.",
    ].join(" "),
  worksheet:
    [
      "Generate a CBSE-style worksheet for {topic}.",
      "Include conceptual, application-based, and numerical questions where relevant.",
      "Organize by Bloom's taxonomy levels and clearly label the level for each section.",
      "Include competency-based questions and at least 3 HOTS questions.",
      "Provide answer key hints for teachers at the end.",
      "Make it suitable for Indian school students.",
    ].join(" "),
  email: [
    "Write a professional school email for {context}.",
    "Tone should be clear, respectful, and suitable for Indian school communication.",
    "Include subject line, greeting, concise body, call-to-action, and formal closing.",
    "If context involves academics, include one competency-focused and one HOTS-oriented suggestion for parents/students.",
  ].join(" "),
  essay: [
    "Write a well-structured CBSE-aligned essay on {topic} suitable for students.",
    "Use introduction, body paragraphs, and conclusion with clear flow.",
    "Incorporate Bloom's progression: basic understanding to analysis/evaluation.",
    "Include competency-based examples from real life and at least 2 HOTS reflection prompts at the end.",
    "Keep vocabulary age-appropriate for Indian school learners.",
  ].join(" "),
};

const fieldByType: Record<GenerateType, string> = {
  lesson_plan: "topic",
  worksheet: "topic",
  email: "context",
  essay: "topic",
};

export function isGenerateType(value: string): value is GenerateType {
  return allowedGenerateTypes.includes(value as GenerateType);
}

export function buildPrompt(type: GenerateType, input: string) {
  const field = fieldByType[type];
  const normalized = input.trim();
  return templates[type].replace(`{${field}}`, normalized);
}

