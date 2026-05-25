import React, { useState, useEffect } from "react";
import { 
  BookOpen, Sparkles, Moon, Sun, RefreshCw, UserCheck, 
  MapPin, HelpCircle, Shield, FileText, LayoutDashboard, Globe, 
  Lock, KeyRound, Mail, User, LogOut, ChevronDown, CheckCircle 
} from "lucide-react";
import RegistrationForm from "./components/RegistrationForm";
import EditDisplayTable from "./components/EditDisplayTable";
import AnalyticsAI from "./components/AnalyticsAI";
import UserManagement from "./components/UserManagement";
import SakinahLogo from "./components/SakinahLogo";
import { 
  fetchStudents, fetchAttendanceLogs, fetchSupervisors, 
  getGuestCreatedIds, validateConnection, clearGuestSessionData 
} from "./lib/dbManager";
import { Student, AttendanceLog, SupervisorProfile, UserRole } from "./types";
import { isConfigured } from "./lib/firebase";
import { AuthProvider, useAuth, ProtectedRoute } from "./components/AuthContext";

function SakinahApp() {
  // Theme state persisted / system aware
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem("sakinah_dark_mode");
    if (saved !== null) {
      return saved === "true";
    }
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  // Auth context states hook
  const { 
    user: firebaseUser, 
    role: currentUserRole, 
    groupId: currentGroupId,
    profile: currentUserProfile, 
    loading: isAuthLoading,
    loginWithGoogle, 
    loginWithEmail, 
    signUpWithEmail, 
    logout: handleLogout, 
    setSimulatedRole,
    isSimulating
  } = useAuth();

  // Active Tab
  const [activeTab, setActiveTab] = useState<"Register" | "Records" | "Analytics" | "Supervisors">("Register");

  // Core database collections
  const [students, setStudents] = useState<Student[]>([]);
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceLog[]>([]);
  const [supervisors, setSupervisors] = useState<SupervisorProfile[]>([]);
  const [guestLogIds, setGuestLogIds] = useState<string[]>([]);
  const [guestStudentIds, setGuestStudentIds] = useState<string[]>([]);

  // Connection Check Tag
  const [isCloudSyncing, setIsCloudSyncing] = useState<boolean>(false);
  const [isDbOnline, setIsDbOnline] = useState<boolean>(false);

  // Reset tab if role transitions and activeTab is protected
  useEffect(() => {
    if (currentUserRole === "Guest" && (activeTab === "Analytics" || activeTab === "Supervisors")) {
      setActiveTab("Register");
    } else if (currentUserRole === "GroupSupervisor" && activeTab === "Supervisors") {
      setActiveTab("Register");
    }
  }, [currentUserRole, activeTab]);

  // Synchronize Dark Theme
  useEffect(() => {
    const root = window.document.documentElement;
    if (darkMode) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("sakinah_dark_mode", String(darkMode));
  }, [darkMode]);

  // Sync data refresh routine with custom RBAC scope filters
  const loadApplicationData = async () => {
    setIsCloudSyncing(true);
    try {
      // Load raw datasets matching exact dynamic scopes for real secure separation
      const studs = await fetchStudents(currentUserRole, currentGroupId);
      const logs = await fetchAttendanceLogs(currentUserRole, currentGroupId);
      const sups = await fetchSupervisors();
      const guestTracker = getGuestCreatedIds();

      setStudents(studs);
      setAttendanceLogs(logs);
      setSupervisors(sups);
      setGuestLogIds(guestTracker.logIds);
      setGuestStudentIds(guestTracker.studentIds);

      // Validate actual sync database connection working
      const connectionWorking = await validateConnection();
      setIsDbOnline(connectionWorking);
    } catch (e) {
      console.error("Error synchronizing application data collections:", e);
    } finally {
      setIsCloudSyncing(false);
    }
  };

  // Re-fetch records automatically on scope or switcher modifications
  useEffect(() => {
    loadApplicationData();
  }, [currentUserRole, currentGroupId]);

  const handleGoogleLogin = async () => {
    try {
      await loginWithGoogle();
    } catch (err: any) {
      console.error(err);
      alert(err.message || "فشل تسجيل الدخول بواسطة Google.");
    }
  };

  // Dedicated guest session transition clean helper
  const handleClearGuestSession = () => {
    clearGuestSessionData();
    setGuestLogIds([]);
    loadApplicationData();
    alert("🧹 تم مسح كافة السجلات وعينات الحفظ المؤقتة بنجاح وتفريغ الذاكرة المحلية للجلسة.");
  };

  return (
    <div className="min-h-screen bg-[#06080a] font-sans text-slate-200 pb-12 transition-colors duration-200" dir="rtl">
      
      {/* 1. APP TOP BAR NAVIGATION */}
      <header className="sticky top-0 z-40 w-full bg-[#0a0f13] border-b border-emerald-900/30 shadow-md">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          {/* Logo Brand Title */}
          <div className="flex items-center gap-4">
            <SakinahLogo size={44} className="hover:scale-105 transition-transform duration-200" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-white leading-none font-sans">مقرأة السكينة للتحفيظ</h1>
              </div>
              <p className="text-[10px] text-emerald-500 uppercase tracking-widest mt-1">نظام تبيان للتحفيظ والأدوار الشرطية</p>
            </div>
          </div>

          {/* Action Hub (Authentication, Dark Mode) */}
          <div className="flex flex-wrap items-center gap-3">
            
            {/* Real Firebase Authentication UI */}
            {isConfigured && (
              <div className="relative">
                {isAuthLoading ? (
                  <span className="text-[10px] text-slate-500 font-mono">جاري التحقق...</span>
                ) : firebaseUser ? (
                  <div className="flex items-center gap-2 bg-slate-900 border border-emerald-950 rounded-full py-1.5 pl-3 pr-2 text-xs">
                    <div className="w-5 h-5 rounded-full bg-emerald-600 flex items-center justify-center text-[10px] font-bold text-white">
                      {(currentUserProfile?.name || firebaseUser.displayName || firebaseUser.email || "م").slice(0, 1).toUpperCase()}
                    </div>
                    <span className="text-white max-w-[120px] truncate">
                      {currentUserProfile?.name || firebaseUser.displayName || firebaseUser.email}
                    </span>
                    <span className="text-[9px] bg-slate-850 px-1.5 py-0.5 rounded text-slate-400 border border-slate-750">
                      {currentUserRole === "GeneralSupervisor" ? "مشرف عام" : "معلم حلقة"}
                    </span>
                    <button 
                      onClick={handleLogout}
                      title="تسجيل الخروج"
                      className="text-red-400 hover:text-red-300 p-1 flex items-center justify-center cursor-pointer transition-colors"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    {/* Fast Google Login Only */}
                    <button 
                      onClick={handleGoogleLogin}
                      className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3.5 py-1.5 rounded-full transition-colors cursor-pointer shadow-md shadow-emerald-950/20"
                    >
                      <Globe className="w-3.5 h-3.5 text-white/90" />
                      <span>دخول بـ Google</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Dark Mode Indicator Toggle Accent */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              title={darkMode ? "التبديل إلى الوضع المضيء" : "التبديل إلى الوضع المظلم"}
              className="w-10 h-10 rounded-full border border-slate-750 bg-slate-900 flex items-center justify-center text-slate-400 hover:text-amber-400 transition-colors cursor-pointer"
            >
              {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-emerald-400" />}
            </button>

          </div>
        </div>
      </header>

      {/* 3. MAIN APP TAB SWITCH SELECTORS BUTTONS */}
      <section className="max-w-7xl mx-auto px-6 mt-7">
        <div className="flex border-b border-slate-800 gap-2 overflow-x-auto">
          
          <button
            onClick={() => setActiveTab("Register")}
            className={`py-3.5 px-5 font-bold text-xs sm:text-sm border-b-2 transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
              activeTab === "Register"
                ? "border-emerald-500 text-emerald-400 bg-emerald-950/20"
                : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/30"
            }`}
          >
            <BookOpen className="w-4 h-4 text-emerald-500" />
            التسجيل اليومي
          </button>

          <button
            onClick={() => setActiveTab("Records")}
            className={`py-3.5 px-5 font-bold text-xs sm:text-sm border-b-2 transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
              activeTab === "Records"
                ? "border-emerald-500 text-emerald-400 bg-emerald-950/20"
                : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/30"
            }`}
          >
            <FileText className="w-4 h-4 text-emerald-500" />
            سجل درجات الطلاب
          </button>

          <button
            onClick={() => setActiveTab("Analytics")}
            className={`py-3.5 px-5 font-bold text-xs sm:text-sm border-b-2 transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
              activeTab === "Analytics"
                ? "border-emerald-500 text-emerald-400 bg-emerald-950/20"
                : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/30"
            }`}
          >
            <LayoutDashboard className="w-4 h-4 text-emerald-500" />
            التحليلات والمساعد الذكي
          </button>

          {currentUserRole === "GeneralSupervisor" && (
            <button
              onClick={() => setActiveTab("Supervisors")}
              className={`py-3.5 px-5 font-bold text-xs sm:text-sm border-b-2 transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
                activeTab === "Supervisors"
                  ? "border-emerald-500 text-emerald-400 bg-emerald-950/20"
                  : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/30"
              }`}
            >
              <UserCheck className="w-4 h-4 text-emerald-500" />
              إدارة المشرفين
            </button>
          )}

        </div>
      </section>

      {/* 4. MAIN INNER VIEWS OUTLET */}
      <main className="max-w-7xl mx-auto px-6 mt-8">
        
        {activeTab === "Register" && (
          <div className="space-y-6">
            <RegistrationForm
              students={students}
              attendanceLogs={attendanceLogs}
              supervisors={supervisors}
              currentUserId={currentUserRole === "GroupSupervisor" ? (currentUserProfile?.uid || "sup_mahmoud") : null}
              currentUserRole={currentUserRole}
              onDataRefresh={loadApplicationData}
            />
          </div>
        )}

        {activeTab === "Records" && (
          <div className="space-y-6">
            <EditDisplayTable
              students={students}
              attendanceLogs={attendanceLogs}
              supervisors={supervisors}
              currentUserId={currentUserProfile?.uid || (currentUserRole === "GroupSupervisor" ? "sup_mahmoud" : "sup_all_access")}
              currentUserRole={currentUserRole}
              guestCreatedLogIds={guestLogIds}
              guestCreatedStudentIds={guestStudentIds}
              onDataRefresh={loadApplicationData}
            />
          </div>
        )}

        {activeTab === "Analytics" && (
          <ProtectedRoute allowedRoles={["GroupSupervisor", "GeneralSupervisor"]}>
            <div className="space-y-6">
              <AnalyticsAI
                students={students}
                attendanceLogs={attendanceLogs}
              />
            </div>
          </ProtectedRoute>
        )}

        {activeTab === "Supervisors" && (
          <ProtectedRoute allowedRoles={["GeneralSupervisor"]}>
            <UserManagement onRefreshNeeded={loadApplicationData} />
          </ProtectedRoute>
        )}

      </main>

    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <SakinahApp />
    </AuthProvider>
  );
}
