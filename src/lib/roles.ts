export type UserRole = "teacher" | "student" | "admin";

export const roleLabels: Record<UserRole, string> = {
  teacher: "Teacher",
  student: "Student",
  admin: "Admin",
};

export const roleTools: Record<UserRole, string[]> = {
  teacher: ["Lesson Plan", "Worksheet", "Email"],
  student: ["Essay", "Notes", "Projects"],
  admin: ["Reports", "Circulars"],
};
