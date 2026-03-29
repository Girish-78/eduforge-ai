export type UserRole = "teacher" | "student";

export const allowedRoles: UserRole[] = ["teacher", "student"];

export function isUserRole(value: string): value is UserRole {
  return allowedRoles.includes(value as UserRole);
}

export const roleLabels: Record<UserRole, string> = {
  teacher: "Teacher",
  student: "Student",
};

export const roleTools: Record<UserRole, string[]> = {
  teacher: ["Lesson Plan", "Worksheet", "Question Paper", "Cheatsheet"],
  student: ["Notes", "Cheatsheet", "Practice Questions"],
};
