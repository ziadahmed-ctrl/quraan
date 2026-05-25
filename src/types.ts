export type UserRole = "Guest" | "GroupSupervisor" | "GeneralSupervisor";

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  groupId: string | null;
  groupName?: string;
}

export interface Student {
  id: string;
  name: string;
  age: number;
  supervisorId: string; // supervisor profile UID
  groupId?: string | null;
}

export interface AttendanceLog {
  id: string;
  studentId: string;
  studentName?: string; // transient/populated for display
  studentAge?: number; // transient
  date: string; // format YYYY-MM-DD
  oldMemorization: string; // alphanumeric range, e.g., "سورة البقرة آية ١٢"
  newMemorization: string; // alphanumeric range, e.g., "سورة آل عمران آية ١"
  rating: number; // 1 to 10 scale
  supervisorId: string; // copies student's supervisorId for fast group-level reads
  groupId: string | null;
}

export interface ChatMessage {
  id: string;
  sender: "user" | "ai";
  text: string;
  timestamp: string;
}

export interface SupervisorProfile {
  uid: string;
  name: string;
  email?: string;
  role: "GroupSupervisor" | "GeneralSupervisor";
  groupId: string | null;
  groupName?: string;
}
