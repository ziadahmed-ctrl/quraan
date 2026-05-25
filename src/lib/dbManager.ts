import { collection, doc, addDoc, getDocs, setDoc, updateDoc, deleteDoc, getDoc, query, where, getDocFromServer } from "firebase/firestore";
import { db, isConfigured, handleFirestoreError, OperationType } from "./firebase";
import { Student, AttendanceLog, UserProfile, SupervisorProfile } from "../types";

// Prebuilt high-fidelity seeds to ensure no "empty screens" on initial load with groupId mapping
const SEED_STUDENTS: Student[] = [
  { id: "STU-1042", name: "أحمد عبد الله المري", age: 14, supervisorId: "sup_mahmoud", groupId: "group_mahmoud" },
  { id: "STU-1043", name: "عمر خالد الشمري", age: 12, supervisorId: "sup_sudeis", groupId: "group_sudeis" },
  { id: "STU-1044", name: "أحمد يوسف خليل", age: 12, supervisorId: "sup_mahmoud", groupId: "group_mahmoud" },
  { id: "STU-1045", name: "فاطمة علي ورده", age: 14, supervisorId: "sup_ali", groupId: "group_ali" },
  { id: "STU-1046", name: "عمر خالد الشروقي", age: 15, supervisorId: "sup_sudeis", groupId: "group_sudeis" }
];

const SEED_ATTENDANCE: AttendanceLog[] = [
  {
    id: "LOG-101",
    studentId: "STU-1044",
    date: "2026-05-23",
    oldMemorization: "سورة الكهف ١",
    newMemorization: "سورة الكهف ١٠",
    rating: 10,
    supervisorId: "sup_mahmoud",
    groupId: "group_mahmoud"
  },
  {
    id: "LOG-102",
    studentId: "STU-1045",
    date: "2026-05-23",
    oldMemorization: "سورة مريم ١",
    newMemorization: "سورة مريم ١٥",
    rating: 9,
    supervisorId: "sup_ali",
    groupId: "group_ali"
  },
  {
    id: "LOG-103",
    studentId: "STU-1046",
    date: "2026-05-22",
    oldMemorization: "سورة يس ١",
    newMemorization: "سورة يس ٤٠",
    rating: 8,
    supervisorId: "sup_sudeis",
    groupId: "group_sudeis"
  },
  {
    id: "LOG-104",
    studentId: "STU-1042",
    date: "2026-05-22",
    oldMemorization: "سورة البقرة ١",
    newMemorization: "سورة البقرة ٥ أجزاء",
    rating: 8,
    supervisorId: "sup_mahmoud",
    groupId: "group_mahmoud"
  },
  {
    id: "LOG-105",
    studentId: "STU-1043",
    date: "2026-05-21",
    oldMemorization: "سورة آل عمران ١",
    newMemorization: "سورة آل عمران ٢ أجزاء",
    rating: 6,
    supervisorId: "sup_sudeis",
    groupId: "group_sudeis"
  }
];

const SEED_SUPERVISORS: SupervisorProfile[] = [
  { uid: "sup_mahmoud", name: "الشيخ محمود خليل", role: "GroupSupervisor", groupId: "group_mahmoud", groupName: "حلقة الشاطبي", email: "mahmoud@sakinah.org" },
  { uid: "sup_sudeis", name: "الشيخ عبد الرحمن السديس", role: "GroupSupervisor", groupId: "group_sudeis", groupName: "مجموع التميز", email: "sudeis@sakinah.org" },
  { uid: "sup_ali", name: "الشيخ عبد الرحمن العلي", role: "GroupSupervisor", groupId: "group_ali", groupName: "حلقة النور", email: "ali@sakinah.org" },
  { uid: "sup_omar", name: "الشيخ عمر الفارس", role: "GroupSupervisor", groupId: "group_omar", groupName: "حلقة الهمم", email: "omar@sakinah.org" }
];

// Helper to load/save offline state
function getLocal<T>(key: string, seed: T[]): T[] {
  const local = localStorage.getItem(key);
  if (!local) {
    localStorage.setItem(key, JSON.stringify(seed));
    return seed;
  }
  return JSON.parse(local);
}

function saveLocal<T>(key: string, data: T[]) {
  localStorage.setItem(key, JSON.stringify(data));
}

// Session storage keys for Guest actions
const SESSION_STUDENTS_KEY = "sakinah_guest_students";
const SESSION_LOGS_KEY = "sakinah_guest_logs";

export function getGuestCreatedIds(): { studentIds: string[]; logIds: string[] } {
  try {
    const studentIds = JSON.parse(sessionStorage.getItem(SESSION_STUDENTS_KEY) || "[]");
    const logIds = JSON.parse(SESSION_LOGS_KEY) || getGuestSessionLogs();
    return { studentIds, logIds };
  } catch {
    return { studentIds: [], logIds: [] };
  }
}

function getGuestSessionLogs(): string[] {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_LOGS_KEY) || "[]");
  } catch {
    return [];
  }
}

export function trackGuestCreatedId(type: "student" | "log", id: string) {
  try {
    const key = type === "student" ? SESSION_STUDENTS_KEY : SESSION_LOGS_KEY;
    const current = JSON.parse(sessionStorage.getItem(key) || "[]");
    if (!current.includes(id)) {
      current.push(id);
      sessionStorage.setItem(key, JSON.stringify(current));
    }
  } catch (e) {
    console.error(e);
  }
}

export function clearGuestSessionData() {
  try {
    sessionStorage.removeItem(SESSION_STUDENTS_KEY);
    sessionStorage.removeItem(SESSION_LOGS_KEY);
    console.log("Guest session data cleared successfully.");
  } catch (e) {
    console.error("Failed clearing session storage:", e);
  }
}

// Synchronizes connection status test
export async function validateConnection() {
  if (!isConfigured) return false;
  try {
    const testRef = doc(db, 'test', 'connection');
    await getDocFromServer(testRef);
    return true;
  } catch (error: any) {
    if (error.message && error.message.includes('offline')) {
      console.warn("Firestore running in offline caching mode.");
    }
    return false;
  }
}

// Core DB operations with dynamic fallback, logging, and strict group criteria

export async function fetchStudents(role?: string, groupId?: string | null): Promise<Student[]> {
  if (isConfigured) {
    try {
      const colRef = collection(db, "students");
      let snapshot;
      
      // Enforce server-side security queries when role is restricted
      if (role === "GroupSupervisor" && groupId) {
        const q = query(colRef, where("groupId", "==", groupId));
        snapshot = await getDocs(q);
      } else {
        snapshot = await getDocs(colRef);
      }
      
      let studentList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Student[];
      
      // If server collection is empty, seed it to ensure visual pristine-ness
      if (studentList.length === 0 && (!role || role === "GeneralSupervisor")) {
        for (const stud of SEED_STUDENTS) {
          await setDoc(doc(db, "students", stud.id), stud);
        }
        return SEED_STUDENTS;
      }
      return studentList;
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, "students");
    }
  }
  
  // Offline Local Fallback Filtering
  const localList = getLocal<Student>("sakinah_students", SEED_STUDENTS);
  if (role === "GroupSupervisor" && groupId) {
    return localList.filter(s => s.groupId === groupId);
  }
  return localList;
}

export async function fetchAttendanceLogs(role?: string, groupId?: string | null): Promise<AttendanceLog[]> {
  if (isConfigured) {
    try {
      const colRef = collection(db, "attendance");
      let snapshot;
      
      if (role === "GroupSupervisor" && groupId) {
        const q = query(colRef, where("groupId", "==", groupId));
        snapshot = await getDocs(q);
      } else {
        snapshot = await getDocs(colRef);
      }
      
      let logList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as AttendanceLog[];
      
      // Seed if empty and general loader
      if (logList.length === 0 && (!role || role === "GeneralSupervisor")) {
        for (const log of SEED_ATTENDANCE) {
          await setDoc(doc(db, "attendance", log.id), log);
        }
        return SEED_ATTENDANCE;
      }

      // Guest Active Session boundary enforcer directly at raw DB fetching format
      if (role === "Guest") {
        const guestIds = getGuestSessionLogs();
        return logList.filter(l => guestIds.includes(l.id));
      }

      return logList;
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, "attendance");
    }
  }
  
  const localList = getLocal<AttendanceLog>("sakinah_attendance", SEED_ATTENDANCE);
  if (role === "GroupSupervisor" && groupId) {
    return localList.filter(l => l.groupId === groupId);
  }
  if (role === "Guest") {
    const guestIds = getGuestSessionLogs();
    return localList.filter(l => guestIds.includes(l.id));
  }
  return localList;
}

export async function createStudent(student: Student): Promise<Student> {
  const cleanStudent = { 
    ...student, 
    id: student.id || `STU-${Date.now().toString().slice(-4)}`,
    groupId: student.groupId || (student.supervisorId === "sup_mahmoud" ? "group_mahmoud" : `group_${student.supervisorId?.slice(-4)}`)
  };
  
  if (isConfigured) {
    try {
      await setDoc(doc(db, "students", cleanStudent.id), cleanStudent);
      return cleanStudent;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `students/${cleanStudent.id}`);
    }
  }
  
  const current = getLocal<Student>("sakinah_students", SEED_STUDENTS);
  current.push(cleanStudent);
  saveLocal("sakinah_students", current);
  return cleanStudent;
}

export async function editStudent(id: string, updatedFields: Partial<Student>): Promise<void> {
  if (isConfigured) {
    try {
      const docRef = doc(db, "students", id);
      await updateDoc(docRef, updatedFields);
      return;
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `students/${id}`);
    }
  }
  const current = getLocal<Student>("sakinah_students", SEED_STUDENTS);
  const index = current.findIndex(s => s.id === id);
  if (index !== -1) {
    current[index] = { ...current[index], ...updatedFields };
    saveLocal("sakinah_students", current);
  }
}

export async function removeStudent(id: string): Promise<void> {
  if (isConfigured) {
    try {
      const docRef = doc(db, "students", id);
      await deleteDoc(docRef);
      // Clean up linked attendance logs
      const colRef = collection(db, "attendance");
      const q = query(colRef, where("studentId", "==", id));
      const snapshot = await getDocs(q);
      for (const d of snapshot.docs) {
        await deleteDoc(doc(db, "attendance", d.id));
      }
      return;
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `students/${id}`);
    }
  }
  
  const current = getLocal<Student>("sakinah_students", SEED_STUDENTS);
  saveLocal("sakinah_students", current.filter(s => s.id !== id));
  
  const currentLogs = getLocal<AttendanceLog>("sakinah_attendance", SEED_ATTENDANCE);
  saveLocal("sakinah_attendance", currentLogs.filter(l => l.studentId !== id));
}

export async function createAttendanceLog(log: AttendanceLog): Promise<AttendanceLog> {
  const cleanLog = { 
    ...log, 
    id: log.id || `LOG-${Date.now().toString().slice(-4)}`,
    groupId: log.groupId || (log.supervisorId === "sup_mahmoud" ? "group_mahmoud" : `group_${log.supervisorId?.slice(-4)}`)
  };
  
  if (isConfigured) {
    try {
      await setDoc(doc(db, "attendance", cleanLog.id), cleanLog);
      return cleanLog;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `attendance/${cleanLog.id}`);
    }
  }
  
  const current = getLocal<AttendanceLog>("sakinah_attendance", SEED_ATTENDANCE);
  current.push(cleanLog);
  saveLocal("sakinah_attendance", current);
  return cleanLog;
}

export async function editAttendanceLog(id: string, updatedFields: Partial<AttendanceLog>): Promise<void> {
  if (isConfigured) {
    try {
      const docRef = doc(db, "attendance", id);
      await updateDoc(docRef, updatedFields);
      return;
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `attendance/${id}`);
    }
  }
  
  const current = getLocal<AttendanceLog>("sakinah_attendance", SEED_ATTENDANCE);
  const index = current.findIndex(l => l.id === id);
  if (index !== -1) {
    current[index] = { ...current[index], ...updatedFields };
    saveLocal("sakinah_attendance", current);
  }
}

export async function removeAttendanceLog(id: string): Promise<void> {
  if (isConfigured) {
    try {
      const docRef = doc(db, "attendance", id);
      await deleteDoc(docRef);
      return;
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `attendance/${id}`);
    }
  }
  
  const current = getLocal<AttendanceLog>("sakinah_attendance", SEED_ATTENDANCE);
  const filtered = current.filter(l => l.id !== id);
  saveLocal("sakinah_attendance", filtered);
}

export async function fetchSupervisors(): Promise<SupervisorProfile[]> {
  if (isConfigured) {
    try {
      const colRef = collection(db, "users");
      const snapshot = await getDocs(colRef);
      const usersList = snapshot.docs
        .map(doc => ({ uid: doc.id, ...doc.data() }))
        .filter((u: any) => u.role === "GroupSupervisor" || u.role === "GeneralSupervisor") as unknown as SupervisorProfile[];
      
      // If mock cloud is empty, return standard seed merged
      if (usersList.length === 0) {
        for (const sup of SEED_SUPERVISORS) {
          await setDoc(doc(db, "users", sup.uid), {
            uid: sup.uid,
            email: sup.email || `${sup.uid}@sakinah.org`,
            name: sup.name,
            role: sup.role,
            groupId: sup.groupId,
            groupName: sup.groupName || "حلقة جديدة"
          });
        }
        return SEED_SUPERVISORS;
      }
      return usersList;
    } catch (e) {
      console.warn("Firestore loaded user list access issue. Falling back to local supervisors.", e);
    }
  }
  return SEED_SUPERVISORS;
}

export async function registerSupervisorProfile(uid: string, profile: Partial<UserProfile>): Promise<void> {
  if (isConfigured) {
    try {
      await setDoc(doc(db, "users", uid), {
        uid,
        email: profile.email || "",
        name: profile.name || "مشرف جديد",
        role: profile.role || "GroupSupervisor",
        groupId: profile.groupId || (uid === "sup_mahmoud" ? "group_mahmoud" : `group_${uid.slice(-4)}`),
        groupName: profile.groupName || "حلقة جديدة"
      });
      return;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `users/${uid}`);
    }
  }
}

// Dedicated GeneralSupervisor capability: Update supervisor group mappings explicitly
export async function updateSupervisorGroup(
  uid: string, 
  groupId: string | null, 
  groupName: string,
  role?: "GroupSupervisor" | "GeneralSupervisor"
): Promise<void> {
  if (isConfigured) {
    try {
      const docRef = doc(db, "users", uid);
      const payload: any = {
        groupId,
        groupName
      };
      if (role) {
        payload.role = role;
      }
      await updateDoc(docRef, payload);
      return;
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
    }
  }
  // Local persistence update
  const match = SEED_SUPERVISORS.find(s => s.uid === uid);
  if (match) {
    match.groupId = groupId;
    if (groupName) match.groupName = groupName;
    if (role) match.role = role;
  }
}

export async function fetchUserProfile(uid: string, email?: string): Promise<UserProfile | null> {
  if (isConfigured) {
    try {
      // 1. Try fetching by exact UID document
      const docRef = doc(db, "users", uid);
      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
        const data = snapshot.data();
        return {
          uid: data.uid,
          email: data.email || "",
          name: data.name || "مشرف المقرأة",
          role: data.role,
          groupId: data.groupId || null,
          groupName: data.groupName
        } as UserProfile;
      }

      // 2. Try fetching by sanitized email address document if provided
      if (email) {
        const safeId = email.toLowerCase().trim()
          .replace(/@/g, "_at_")
          .replace(/\./g, "_dot_")
          .replace(/[^a-z0-9_\-]/g, "");
        const emailDocRef = doc(db, "users", safeId);
        const emailSnapshot = await getDoc(emailDocRef);
        if (emailSnapshot.exists()) {
          const data = emailSnapshot.data();
          return {
            uid: uid, // will be promoted to this UID
            email: data.email || email,
            name: data.name || "مشرف المقرأة",
            role: data.role,
            groupId: data.groupId || null,
            groupName: data.groupName,
            isTempProfile: true,
            tempDocId: safeId
          } as any;
        }
      }
    } catch (error) {
      console.error("Failed fetching user profile:", error);
    }
    
    // First-time manual assignment for general supervisor: ziad130512@gmail.com
    if (email === "ziad130512@gmail.com") {
      return {
        uid,
        email,
        name: "زياد (المشرف العام)",
        role: "GeneralSupervisor",
        groupId: null,
        groupName: "الإشراف العام",
        isTempProfile: true,
        tempDocId: ""
      } as any;
    }
    return null;
  }
  
  // Offline Local Fallback
  const match = SEED_SUPERVISORS.find(s => s.uid === uid || (email && s.email === email));
  if (match) {
    return { 
      uid, 
      email: match.email || "supervisor@sakinah.org", 
      name: match.name, 
      role: match.role, 
      groupId: match.groupId, 
      groupName: match.groupName 
    };
  }
  return null;
}

export async function deleteUserProfileDoc(docId: string): Promise<void> {
  if (isConfigured) {
    try {
      const docRef = doc(db, "users", docId);
      await deleteDoc(docRef);
    } catch (error) {
      console.error("Failed deleting legacy user profile doc:", error);
    }
  }
}

export async function removeSupervisor(uid: string): Promise<void> {
  if (isConfigured) {
    try {
      const docRef = doc(db, "users", uid);
      await deleteDoc(docRef);
      return;
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${uid}`);
    }
  }
  // Local fallback
  const index = SEED_SUPERVISORS.findIndex(s => s.uid === uid);
  if (index !== -1) {
    SEED_SUPERVISORS.splice(index, 1);
  }
}
