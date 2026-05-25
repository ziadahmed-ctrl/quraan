import React, { useState, useEffect, useRef } from "react";
import { User, Calendar, BookOpen, Star, AlertCircle, Sparkles, CheckCircle, Search, HelpCircle } from "lucide-react";
import { Student, AttendanceLog, SupervisorProfile } from "../types";
import { createStudent, createAttendanceLog, trackGuestCreatedId } from "../lib/dbManager";

interface RegistrationFormProps {
  students: Student[];
  attendanceLogs: AttendanceLog[];
  supervisors: SupervisorProfile[];
  currentUserId: string | null;
  currentUserRole: string;
  onDataRefresh: () => void;
}

export default function RegistrationForm({
  students,
  attendanceLogs,
  supervisors,
  currentUserId,
  currentUserRole,
  onDataRefresh
}: RegistrationFormProps) {
  // Configured inputs
  const [selectedSupervisorId, setSelectedSupervisorId] = useState<string>("");
  const [studentNameInput, setStudentNameInput] = useState<string>("");
  const [ageInput, setAgeInput] = useState<string>("");
  const [oldMemorizationInput, setOldMemorizationInput] = useState<string>("");
  const [newMemorizationInput, setNewMemorizationInput] = useState<string>("");
  const [ratingInput, setRatingInput] = useState<number>(10);

  // Autocomplete UI logic
  const [showAutocomplete, setShowAutocomplete] = useState<boolean>(false);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const autocompleteRef = useRef<HTMLDivElement>(null);

  // Errors and feedback states
  const [nameError, setNameError] = useState<string>("");
  const [submitError, setSubmitError] = useState<string>("");
  const [successMessage, setSuccessMessage] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Auto-set supervisor if the logged-in user is a Group Supervisor
  useEffect(() => {
    if (currentUserId && currentUserRole !== "Guest") {
      setSelectedSupervisorId(currentUserId);
    } else if (supervisors.length > 0 && !selectedSupervisorId) {
      setSelectedSupervisorId(supervisors[0].uid);
    }
  }, [currentUserId, currentUserRole, supervisors]);

  // Click outside autocomplete to dismiss
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (autocompleteRef.current && !autocompleteRef.current.contains(event.target as Node)) {
        setShowAutocomplete(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter students based on selected supervisor and typeahead name
  useEffect(() => {
    if (!selectedSupervisorId) {
      setFilteredStudents([]);
      return;
    }
    const filtered = students.filter(s => {
      const matchSupervisor = s.supervisorId === selectedSupervisorId;
      const matchSearch = s.name.toLowerCase().includes(studentNameInput.toLowerCase());
      return matchSupervisor && matchSearch;
    });
    setFilteredStudents(filtered);
  }, [studentNameInput, selectedSupervisorId, students]);

  // Helper to format date as local YYYY-MM-DD
  const getTodayDateString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // Convert Gregorian date to Hijri representation name
  const getHijriDateName = () => {
    const today = new Date();
    // In strict 2026 UTC, we approximate or write standard beautiful Hijri representations.
    const formatter = new Intl.DateTimeFormat("ar-SA-u-ca-islamic", {
      day: "numeric",
      month: "long",
      year: "numeric"
    });
    return formatter.format(today);
  };

  const getLatestMemorization = (studentId: string) => {
    const studentLogs = attendanceLogs
      .filter(l => l.studentId === studentId)
      .sort((a, b) => b.date.localeCompare(a.date));
    return studentLogs.length > 0 ? studentLogs[0].newMemorization : "لا يوجد سجل بعد";
  };

  // Student name text-only validation (only letters and spaces allowed)
  const handleStudentNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setStudentNameInput(val);
    setSubmitError("");
    setSuccessMessage("");

    // Validate that name only contains letters, spaces, or Arabic characters
    const textOnlyRegex = /^[\u0600-\u06FFa-zA-Z\s]*$/;
    if (val && !textOnlyRegex.test(val)) {
      setNameError("عذراً، يجب إدخال اسم الطالب بأحرف فقط دون استخدام أرقام أو رموز خاصة.");
    } else {
      setNameError("");
    }
    setShowAutocomplete(true);
  };

  // Handle student select from autocomplete list
  const handleSelectStudent = (student: Student) => {
    setStudentNameInput(student.name);
    setAgeInput(student.age.toString());
    setNameError("");
    setShowAutocomplete(false);

    // Grab latest review/memorization data if available to pre-fill recommendation
    const latest = getLatestMemorization(student.id);
    setOldMemorizationInput(latest !== "لا يوجد سجل بعد" ? latest : "");
  };

  // Checks if the typed student name matches any existing student
  const isExistingStudent = students.find(
    s => s.name.trim() === studentNameInput.trim() && s.supervisorId === selectedSupervisorId
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError("");
    setSuccessMessage("");

    if (!selectedSupervisorId) {
      setSubmitError("الرجاء اختيار مشرف الحلقة أولاً.");
      return;
    }

    if (!studentNameInput.trim()) {
      setSubmitError("الرجاء إدخال اسم الطالب.");
      return;
    }

    if (nameError) {
      setSubmitError("الرجاء تصحيح خطأ اسم الطالب.");
      return;
    }

    const ageValue = parseInt(ageInput);
    if (isNaN(ageValue) || ageValue < 4 || ageValue > 100) {
      setSubmitError("الرجاء إدخال عمر صحيح بين 4 و 100 سنة.");
      return;
    }

    if (!oldMemorizationInput.trim()) {
      setSubmitError("الرجاء إدخال مقدار المراجعة السابق (الحفظ القديم).");
      return;
    }

    if (!newMemorizationInput.trim()) {
      setSubmitError("الرجاء تحديد الحفظ الجديد المطلوب.");
      return;
    }

    // Check duplicate logger submission for today
    const activeDate = getTodayDateString();
    
    // Check if the student exists and has logging entries today
    if (isExistingStudent) {
      const alreadyHasLog = attendanceLogs.some(
        log => log.studentId === isExistingStudent.id && log.date === activeDate
      );
      if (alreadyHasLog) {
        setSubmitError(`🚨 تنبيه: هذا الطالب (${isExistingStudent.name}) لديه سجل حضور وتقييم مسجل بالفعل لهذا اليوم (${activeDate}) ولا يمكن تكراره.`);
        return;
      }
    }

    setIsSubmitting(true);

    try {
      let activeStudentId = "";
      
      const matchedSup = supervisors.find(s => s.uid === selectedSupervisorId);
      const targetGroupId = matchedSup?.groupId || null;

      // 1. Resolve student (create profile if not found)
      if (isExistingStudent) {
        activeStudentId = isExistingStudent.id;
      } else {
        // Create new student record on Firestore/local
        const newStud: Student = {
          id: `STU-${Date.now().toString().slice(-4)}`,
          name: studentNameInput.trim(),
          age: ageValue,
          supervisorId: selectedSupervisorId,
          groupId: targetGroupId
        };
        const savedStud = await createStudent(newStud);
        activeStudentId = savedStud.id;

        // If Guest represents the active creation role, track it inside sessionStorage
        if (currentUserRole === "Guest") {
          trackGuestCreatedId("student", activeStudentId);
        }
      }

      // 2. Resolve daily attendance record
      const newLog: AttendanceLog = {
        id: `LOG-${Date.now().toString().slice(-4)}`,
        studentId: activeStudentId,
        date: activeDate,
        oldMemorization: oldMemorizationInput.trim(),
        newMemorization: newMemorizationInput.trim(),
        rating: ratingInput,
        supervisorId: selectedSupervisorId,
        groupId: targetGroupId
      };

      const savedLog = await createAttendanceLog(newLog);
      
      if (currentUserRole === "Guest") {
        trackGuestCreatedId("log", savedLog.id);
      }

      // Success feedback & clear
      setSuccessMessage(`✨ تم تسجيل الحضور والحفظ بنجاح للطالب: ${studentNameInput}`);
      
      // Reset input fields (keep supervisor selected)
      setStudentNameInput("");
      setAgeInput("");
      setOldMemorizationInput("");
      setNewMemorizationInput("");
      setRatingInput(10);
      
      // Trigger update hooks
      onDataRefresh();
    } catch (err: any) {
      console.error(err);
      setSubmitError("فشل في تقديم الاستمارة في قاعدة البيانات. الرجاء التأكد من الصلاحيات.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div id="registration_panel" className="bg-[#0a0f13] border border-slate-800/80 rounded-3xl p-6 sm:p-8 shadow-xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 pb-5 border-b border-slate-800 gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white font-sans tracking-tight border-r-2 border-emerald-500 pr-3">تسجيل بيانات التسميع اليومي</h2>
          <p className="text-xs text-slate-400 mt-1.5">سجل حضور الطالب ومستوى تمكنه وتقييم الحفظ اليومي لمجموعة التلاوة</p>
        </div>
        
        {/* Read-Only Date Badges */}
        <div className="flex items-center gap-2.5 bg-emerald-950/20 px-4 py-2.5 rounded-2xl border border-emerald-900/40 text-emerald-400">
          <Calendar className="w-5 h-5 text-emerald-500" />
          <div className="text-xs sm:text-sm font-medium">
            <div>{getTodayDateString()}</div>
            <div className="text-[10px] sm:text-xs text-emerald-400/80 font-mono tracking-tight">{getHijriDateName()}</div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Supervisor Selection Field */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-300">مشرف الحلقة المتابع</label>
            <div className="relative">
              <span className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-500">
                <User className="w-5 h-5" />
              </span>
              <select
                disabled={currentUserRole === "GroupSupervisor"}
                value={selectedSupervisorId}
                onChange={(e) => {
                  setSelectedSupervisorId(e.target.value);
                  setStudentNameInput(""); // Clear name search to prevent supervisor mismatches
                  setAgeInput("");
                }}
                className="block w-full pr-10 pl-3 py-3 border border-slate-800 rounded-2xl bg-[#121a21] text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all disabled:opacity-75 disabled:bg-[#06080a]"
              >
                <option value="">-- اختر شيخ/مشرف الحلقة --</option>
                {supervisors.map(s => (
                  <option key={s.uid} value={s.uid}>
                    {s.name} {s.groupName ? `(${s.groupName})` : ""}
                  </option>
                ))}
              </select>
            </div>
            {currentUserRole === "GroupSupervisor" && (
              <p className="text-[11px] text-slate-500">تم تثبيتك تلقائياً كمشرف على هذه الحلقة طبقاً لحسابك الخاص.</p>
            )}
          </div>

          {/* Student Autocomplete Search Input */}
          <div className="space-y-2 relative" ref={autocompleteRef}>
            <label className="block text-xs font-semibold text-slate-300">اسم الطالب</label>
            <div className="relative">
              <span className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-500">
                <Search className="w-5 h-5" />
              </span>
              <input
                type="text"
                placeholder="ابحث عن الطالب أو اكتب اسماً جديداً لتسجيله..."
                value={studentNameInput}
                onChange={handleStudentNameChange}
                onFocus={() => {
                  if (selectedSupervisorId) setShowAutocomplete(true);
                }}
                className={`block w-full pr-10 pl-3 py-3 border rounded-2xl bg-[#121a21] text-slate-100 text-sm focus:outline-none focus:ring-2 transition-all ${
                  nameError 
                    ? "border-red-900 focus:ring-red-500/20 focus:border-red-500" 
                    : "border-slate-800 focus:ring-emerald-500/20 focus:border-emerald-500"
                }`}
              />
            </div>

            {/* Invalid name validator message */}
            {nameError && (
              <div className="flex items-center gap-1.5 text-xs text-red-400 mt-1">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{nameError}</span>
              </div>
            )}

            {/* Standard Autocomplete dropdown */}
            {showAutocomplete && selectedSupervisorId && (
              <div className="absolute z-10 w-full mt-1.5 bg-[#121a21] border border-slate-800 rounded-2xl shadow-2xl max-h-60 overflow-y-auto divide-y divide-slate-850">
                {filteredStudents.length > 0 ? (
                  filteredStudents.map(student => (
                    <button
                      key={student.id}
                      type="button"
                      onClick={() => handleSelectStudent(student)}
                      className="w-full text-right px-4 py-3 hover:bg-slate-800/40 flex items-center justify-between text-sm transition-colors cursor-pointer"
                    >
                      <div className="font-semibold text-slate-200">
                        {student.name}
                      </div>
                      <div className="text-xs text-emerald-500/85 font-mono">
                        عمر: {student.age} سنة | آخر مراجعة: {getLatestMemorization(student.id)}
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="px-4 py-3.5 text-xs text-slate-400">
                    لم نجد طلاب مسجلين باسم "{studentNameInput}" لهذه الحلقة. سيتم اعتباره طالباً جديداً عند التأكيد.
                  </div>
                )}
              </div>
            )}

            {/* New Student Profile Setup Alert Banner */}
            {studentNameInput.trim() && !nameError && !isExistingStudent && selectedSupervisorId && (
              <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-[#0e141a] border border-sky-950 text-sky-400 mt-2.5 transition-all">
                <Sparkles className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <div className="font-bold">✨ طالب جديد بالتسجيل</div>
                  <div className="opacity-95 leading-relaxed mt-0.5">
                    الاسم المدخل غير مدرج بحلقة هذا المشرف. سيقوم النظام بإنشاء ملف تعريفي للطالب ليكون متاحاً مستقبلاً.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {/* Student Age input */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-300">عمر الطالب (سنين)</label>
            <input
              type="number"
              min="4"
              max="100"
              placeholder="اكتب عمر الطالب..."
              value={ageInput}
              onChange={(e) => {
                setAgeInput(e.target.value);
                setSubmitError("");
              }}
              className="block w-full px-4 py-3 border border-slate-800 rounded-2xl bg-[#121a21] text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-mono"
            />
          </div>

          {/* Old memorization / review inputs */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-300">
              <span className="flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-emerald-500" />
                المراجعة (الحفظ القديم)
              </span>
            </label>
            <input
              type="text"
              placeholder="مثال: سورة البقرة ١ - ٥٠ أو جزأين"
              value={oldMemorizationInput}
              onChange={(e) => {
                setOldMemorizationInput(e.target.value);
                setSubmitError("");
              }}
              className="block w-full px-4 py-3 border border-slate-800 rounded-2xl bg-[#121a21] text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            />
          </div>

          {/* New memorization log */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-300">
              <span className="flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-emerald-500" />
                الحفظ الجديد اليومي
              </span>
            </label>
            <input
              type="text"
              placeholder="مثال: سورة البقرة ٥١ - ٧٥"
              value={newMemorizationInput}
              onChange={(e) => {
                setNewMemorizationInput(e.target.value);
                setSubmitError("");
              }}
              className="block w-full px-4 py-3 border border-slate-800 rounded-2xl bg-[#121a21] text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            />
          </div>
        </div>

        {/* Rating star/slider inputs */}
        <div className="bg-[#0e141a] border border-slate-850 p-5 rounded-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
            <div>
              <label className="block text-xs font-semibold text-slate-200">تقييم تمكن الحفظ والتلاوة</label>
              <p className="text-[11px] text-slate-400">تقييم معيار الإتقان من ١ (ضعيف جداً) إلى ١٠ (ممتاز كامل الأوجه)</p>
            </div>
            <div className="flex items-center gap-1.5 self-start sm:self-auto">
              <span className="font-mono text-lg font-bold text-emerald-400">{ratingInput}</span>
              <span className="text-xs text-slate-500">/ ١٠</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-xs text-slate-500 font-bold">١</span>
            <input
              type="range"
              min="1"
              max="10"
              value={ratingInput}
              onChange={(e) => setRatingInput(parseInt(e.target.value))}
              className="w-full accent-emerald-500 h-2 bg-[#121a21] border border-slate-800 rounded-lg cursor-pointer"
            />
            <span className="text-xs text-emerald-550 font-bold">١٠</span>
          </div>

          {/* Interactive Visual Star Preview */}
          <div className="flex items-center justify-center gap-1.5 mt-4">
            {Array.from({ length: 10 }).map((_, index) => {
              const active = index < ratingInput;
              return (
                <Star
                  key={index}
                  className={`w-5 h-5 transition-colors ${
                    active ? "text-amber-400 fill-amber-400" : "text-slate-800"
                  }`}
                />
              );
            })}
          </div>
        </div>

        {/* Action Error alert reporting */}
        {submitError && (
          <div className="flex items-start gap-2.5 p-4 rounded-2xl bg-[#130b0e] border border-red-900/40 text-red-400 text-xs">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div className="leading-relaxed font-semibold">{submitError}</div>
          </div>
        )}

        {/* Action Success feedback reporting */}
        {successMessage && (
          <div className="flex items-center gap-2.5 p-4 rounded-2xl bg-[#091510] border border-emerald-900/40 text-emerald-400 text-xs">
            <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
            <div className="font-semibold">{successMessage}</div>
          </div>
        )}

        {/* Apply Trigger Action Submission */}
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-8 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl text-xs transition-all shadow-lg shadow-emerald-950/40 hover:shadow-emerald-950/60 select-none flex items-center gap-2 cursor-pointer disabled:opacity-75"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                جاري تدوين السجل...
              </span>
            ) : (
              "تأكيد وحفظ بيانات التسميع"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
