import React, { useState } from "react";
import { 
  ArrowUpDown, Edit, Trash2, Search, Filter, X, 
  Check, Eye, EyeOff, AlertCircle, FileText, BarChart2 
} from "lucide-react";
import { Student, AttendanceLog, SupervisorProfile } from "../types";
import { editAttendanceLog, removeAttendanceLog, editStudent, removeStudent } from "../lib/dbManager";

interface EditDisplayTableProps {
  students: Student[];
  attendanceLogs: AttendanceLog[];
  supervisors: SupervisorProfile[];
  currentUserId: string | null;
  currentUserRole: string;
  guestCreatedLogIds: string[];
  guestCreatedStudentIds: string[];
  onDataRefresh: () => void;
}

export default function EditDisplayTable({
  students,
  attendanceLogs,
  supervisors,
  currentUserId,
  currentUserRole,
  guestCreatedLogIds,
  guestCreatedStudentIds,
  onDataRefresh
}: EditDisplayTableProps) {
  // Toggle layout views: "Summary" or "Log"
  const [activeView, setActiveView] = useState<"Summary" | "Log">("Log");

  // Sorting columns state manager
  const [sortField, setSortField] = useState<string>("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Multi-column filter state manager (horizontal filters below column headers)
  const [filters, setFilters] = useState({
    studentName: "",
    age: "",
    oldMemorization: "",
    newMemorization: "",
    date: "",
    rating: "",
    supervisor: ""
  });

  // Modal Editor state
  const [editingLog, setEditingLog] = useState<AttendanceLog | null>(null);
  const [editOldMemo, setEditOldMemo] = useState("");
  const [editNewMemo, setEditNewMemo] = useState("");
  const [editRating, setEditRating] = useState(10);
  const [editDate, setEditDate] = useState("");
  const [editError, setEditError] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Student Profile Modal Editor state
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [editStudentName, setEditStudentName] = useState("");
  const [editStudentAge, setEditStudentAge] = useState("");
  const [studentEditError, setStudentEditError] = useState("");
  const [isSavingStudentEdit, setIsSavingStudentEdit] = useState(false);

  // Helper resolvers
  const getStudentInfo = (studentId: string) => {
    return students.find(s => s.id === studentId);
  };

  const getSupervisorInfo = (supervisorId: string) => {
    return supervisors.find(s => s.uid === supervisorId);
  };

  // Enforces item-level action permissions
  const canModifyRecord = (log: AttendanceLog) => {
    if (currentUserRole === "GeneralSupervisor") return true;
    if (currentUserRole === "GroupSupervisor") return true;
    if (currentUserRole === "Guest" && guestCreatedLogIds.includes(log.id)) return true;
    return false;
  };

  const canModifyStudent = (studentId: string) => {
    if (currentUserRole === "GeneralSupervisor") return true;
    const student = students.find(s => s.id === studentId);
    if (currentUserRole === "GroupSupervisor" && student) return true;
    if (currentUserRole === "Guest" && guestCreatedStudentIds.includes(studentId)) return true;
    return false;
  };

  // Click on column header to trigger sort state
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const handleFilterChange = (column: string, value: string) => {
    setFilters(prev => ({ ...prev, [column]: value }));
  };

  const clearAllFilters = () => {
    setFilters({
      studentName: "",
      age: "",
      oldMemorization: "",
      newMemorization: "",
      date: "",
      rating: "",
      supervisor: ""
    });
  };

  // --- COMPILING DETAILED HISTORIC LOG VIEW LIST ---
  const compiledLogRows = attendanceLogs.map(log => {
    const student = getStudentInfo(log.studentId);
    const superv = getSupervisorInfo(log.supervisorId || student?.supervisorId || "");
    return {
      ...log,
      studentName: student ? student.name : "طالب غير مكتمل",
      studentAge: student ? student.age : 0,
      supervisorName: superv ? superv.name : "مشرف الحلقة",
      groupName: superv ? superv.groupName : ""
    };
  });

  // Apply filters on Detailed Log view dataset
  const filteredLogRows = compiledLogRows.filter(row => {
    const sName = (row.studentName || "").toLowerCase();
    const sAge = (row.studentAge || "").toString();
    const oldMem = (row.oldMemorization || "").toLowerCase();
    const newMem = (row.newMemorization || "").toLowerCase();
    const logDate = (row.date || "").toLowerCase();
    const logRate = (row.rating || "").toString();
    const sVisor = (row.supervisorName || "").toLowerCase();

    return (
      sName.includes(filters.studentName.toLowerCase()) &&
      sAge.includes(filters.age) &&
      oldMem.includes(filters.oldMemorization.toLowerCase()) &&
      newMem.includes(filters.newMemorization.toLowerCase()) &&
      logDate.includes(filters.date.toLowerCase()) &&
      logRate.includes(filters.rating) &&
      sVisor.includes(filters.supervisor.toLowerCase())
    );
  });

  // Apply sorting on Detailed Log view dataset
  const sortedLogRows = [...filteredLogRows].sort((a, b) => {
    let aVal: any = a[sortField as keyof typeof a] || "";
    let bVal: any = b[sortField as keyof typeof b] || "";

    if (typeof aVal === "string") {
      return sortDirection === "asc" 
        ? aVal.localeCompare(bVal) 
        : bVal.localeCompare(aVal);
    } else {
      return sortDirection === "asc" 
        ? (aVal as number) - (bVal as number) 
        : (bVal as number) - (aVal as number);
    }
  });

  // --- COMPILING STUDENT SUMMARY SUMMARY VIEW ---
  // Aggregate details: Student Name, Age, Latest Memorization, Average Rating, Record Count
  const compiledSummaryRows = students
    .filter(student => {
      // Filter summary rows to supervisor ownership if logged in as Group Supervisor
      if (currentUserRole === "GroupSupervisor" && student.supervisorId !== currentUserId) {
        return false;
      }
      if (currentUserRole === "Guest") {
        return guestCreatedStudentIds.includes(student.id);
      }
      return true;
    })
    .map(student => {
      // Find logs for this student
      const studentLogs = attendanceLogs.filter(log => log.studentId === student.id);
      
      let latestMemo = "لا يوجد سجل";
      let avgRating = 0;
      let logCount = studentLogs.length;

      if (studentLogs.length > 0) {
        // Find latest log by date
        const sortedLogs = [...studentLogs].sort((a, b) => b.date.localeCompare(a.date));
        latestMemo = sortedLogs[0].newMemorization || "لا يوجد";
        
        const totalRating = studentLogs.reduce((sum, log) => sum + log.rating, 0);
        avgRating = parseFloat((totalRating / studentLogs.length).toFixed(1));
      }

      const superv = getSupervisorInfo(student.supervisorId);

      return {
        studentId: student.id,
        studentName: student.name,
        studentAge: student.age,
        latestMemo,
        avgRating,
        logCount,
        supervisorName: superv ? superv.name : "مشرف الحلقة"
      };
    });

  // Apply filters on Summary View dataset
  const filteredSummaryRows = compiledSummaryRows.filter(row => {
    const sName = row.studentName.toLowerCase();
    const sAge = row.studentAge.toString();
    const latest = row.latestMemo.toLowerCase();
    const avgR = row.avgRating.toString();
    const sVisor = row.supervisorName.toLowerCase();

    return (
      sName.includes(filters.studentName.toLowerCase()) &&
      sAge.includes(filters.age) &&
      latest.includes(filters.newMemorization.toLowerCase()) &&
      avgR.includes(filters.rating) &&
      sVisor.includes(filters.supervisor.toLowerCase())
    );
  });

  // Apply sorting on Summary View dataset
  const sortedSummaryRows = [...filteredSummaryRows].sort((a, b) => {
    let aVal: any = a[sortField as keyof typeof a] || "";
    let bVal: any = b[sortField as keyof typeof b] || "";

    if (typeof aVal === "string") {
      return sortDirection === "asc" 
        ? aVal.localeCompare(bVal) 
        : bVal.localeCompare(aVal);
    } else {
      return sortDirection === "asc" 
        ? (aVal as number) - (bVal as number) 
        : (bVal as number) - (aVal as number);
    }
  });

  // --- CRUD DISPATCH MODALS ---
  const handleOpenEdit = (log: AttendanceLog) => {
    const compiled = compiledLogRows.find(cl => cl.id === log.id);
    setEditingLog(log);
    setEditOldMemo(log.oldMemorization);
    setEditNewMemo(log.newMemorization);
    setEditRating(log.rating);
    setEditDate(log.date);
    setEditError("");
  };

  const handleSaveEdit = async () => {
    if (!editingLog) return;
    setEditError("");

    if (!editOldMemo.trim() || !editNewMemo.trim()) {
      setEditError("الرجاء استكمال حقول المراجعة والجديد.");
      return;
    }

    if (editRating < 1 || editRating > 10) {
      setEditError("يجب أن يكون التقييم رقماً بين ١ و ١٠.");
      return;
    }

    setIsSavingEdit(true);
    try {
      await editAttendanceLog(editingLog.id, {
        oldMemorization: editOldMemo.trim(),
        newMemorization: editNewMemo.trim(),
        rating: editRating,
        date: editDate
      });
      setEditingLog(null);
      onDataRefresh();
    } catch (err) {
      setEditError("حدث خطأ أثناء حفظ التعديل. الرجاء مراجعة الصلاحيات.");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDeleteLog = async (id: string, name: string) => {
    if (confirm(`هل أنت متأكد من حذف سجل تسميع الطالب (${name})؟ لا يمكن التراجع عن هذا الإجراء.`)) {
      try {
        await removeAttendanceLog(id);
        onDataRefresh();
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleOpenEditStudent = (studentId: string) => {
    const student = students.find(s => s.id === studentId);
    if (!student) return;
    setEditingStudent(student);
    setEditStudentName(student.name);
    setEditStudentAge(String(student.age || ""));
    setStudentEditError("");
  };

  const handleSaveEditStudent = async () => {
    if (!editingStudent) return;
    setStudentEditError("");

    if (!editStudentName.trim() || !editStudentAge.trim()) {
      setStudentEditError("الرجاء استكمال كافة الحقول.");
      return;
    }

    const ageValue = parseInt(editStudentAge, 10);
    if (isNaN(ageValue) || ageValue < 1 || ageValue > 120) {
      setStudentEditError("العمر يجب أن يكون رقماً صحيحاً بين ١ و ١٢٠.");
      return;
    }

    setIsSavingStudentEdit(true);
    try {
      await editStudent(editingStudent.id, {
        name: editStudentName.trim(),
        age: ageValue
      });
      setEditingStudent(null);
      onDataRefresh();
    } catch (err: any) {
      console.error(err);
      setStudentEditError(`فشلت العملية: ${err.message || err}`);
    } finally {
      setIsSavingStudentEdit(false);
    }
  };

  const handleDeleteStudent = async (studentId: string, studentName: string) => {
    if (confirm(`⚠️ تحذير مهم:\nهل أنت متأكد من حذف ملف الطالب (${studentName}) نهائياً؟\nسيؤدي هذا لحذف كافة سجلات الحضور والتسميع التابعة له من السحابة ولا يمكن للعامة التراجع عن هذا الإجراء.`)) {
      try {
        await removeStudent(studentId);
        onDataRefresh();
      } catch (err: any) {
        console.error(err);
        alert(`فشل حذف معطيات الطالب: ${err.message || err}`);
      }
    }
  };

  return (
    <div id="records_panel" className="bg-[#0a0f13] border border-slate-800/80 rounded-3xl p-6 shadow-xl">
      
      {/* Table Toggle and Stats Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-5 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white font-sans tracking-tight border-r-2 border-emerald-500 pr-3">سجل درجات وحضور الطلاب</h2>
          <p className="text-xs text-slate-400 mt-1.5">عرض وتدقيق ومراجعة أداء حلقات تحفيظ كتاب الله الكريم لمجموعتك النشطة</p>
        </div>

        {/* View Switch Selectors */}
        <div className="flex items-center gap-1.5 p-1 bg-[#121a21] border border-slate-800 rounded-2xl select-none">
          <button
            onClick={() => {
              setActiveView("Log");
              setSortField("date");
              setSortDirection("desc");
              clearAllFilters();
            }}
            className={`px-4 py-2 text-xs font-bold rounded-xl flex items-center gap-2 transition-all cursor-pointer ${
              activeView === "Log"
                ? "bg-emerald-600 text-white shadow-md shadow-emerald-955/20"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <FileText className="w-4 h-4 text-white" />
            سجل المقرأة التفصيلي
          </button>
          
          <button
            onClick={() => {
              setActiveView("Summary");
              setSortField("avgRating");
              setSortDirection("desc");
              clearAllFilters();
            }}
            className={`px-4 py-2 text-xs font-bold rounded-xl flex items-center gap-2 transition-all cursor-pointer ${
              activeView === "Summary"
                ? "bg-emerald-600 text-white shadow-md shadow-emerald-955/20"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <BarChart2 className="w-4 h-4 text-white" />
            جدول ملخص الحفظ والتقييم العالمي
          </button>
        </div>
      </div>

      {/* Filter Clearance Alert Line */}
      <div className="flex justify-between items-center mb-4 text-xs gap-3 flex-wrap">
        <span className="text-slate-400">
          يظهر الآن: <span className="font-extrabold text-emerald-400 font-mono">
            {activeView === "Log" ? sortedLogRows.length : sortedSummaryRows.length}
          </span> سجل من اجمالي حلقات المقابلة المصفاة.
        </span>
        
        {Object.values(filters).some(v => v !== "") && (
          <button
            onClick={clearAllFilters}
            className="text-red-400 hover:text-red-300 font-bold flex items-center gap-1 pb-1 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            إعادة تعيين حقول التصفية
          </button>
        )}
      </div>

      {/* RENDER TABLE CONTAINER */}
      <div className="overflow-x-auto border border-slate-800/80 bg-[#0a0f13] rounded-2xl">
        <table className="w-full text-right border-collapse text-sm">
          
          {/* Main Headers Row with interactive sorting */}
          <thead>
            <tr className="bg-[#0c1319] border-b border-slate-800 text-slate-300 font-semibold text-xs">
              <th className="py-4 px-4 font-bold shrink-0">
                <button 
                  onClick={() => handleSort(activeView === "Log" ? "studentName" : "studentName")}
                  className="flex items-center gap-1.5 focus:outline-none hover:text-white"
                >
                  اسم الطالب
                  <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
                </button>
              </th>
              
              <th className="py-4 px-4 font-bold">
                <button 
                  onClick={() => handleSort("studentAge")}
                  className="flex items-center gap-1.5 focus:outline-none hover:text-white"
                >
                  السن
                  <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
                </button>
              </th>

              {activeView === "Log" ? (
                <>
                  <th className="py-4 px-4 font-bold">المراجعة (القديم)</th>
                  <th className="py-4 px-4 font-bold">تسميع الجديد</th>
                  <th className="py-4 px-4 font-bold">
                    <button 
                      onClick={() => handleSort("date")}
                      className="flex items-center gap-1.5 focus:outline-none hover:text-white"
                    >
                      تاريخ التدقيق
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
                    </button>
                  </th>
                </>
              ) : (
                <th className="py-4 px-4 font-bold">نهاية مدى الحفظ</th>
              )}

              <th className="py-4 px-4 font-bold">
                <button 
                  onClick={() => handleSort(activeView === "Log" ? "rating" : "avgRating")}
                  className="flex items-center gap-1.5 focus:outline-none hover:text-white"
                >
                  {activeView === "Log" ? "التقييم اليومي" : "التقييم العام المتوسط"}
                  <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
                </button>
              </th>

              <th className="py-4 px-4 font-bold">
                <button 
                  onClick={() => handleSort("supervisorName")}
                  className="flex items-center gap-1.5 focus:outline-none hover:text-white"
                >
                  الشيخ المشرف
                  <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
                </button>
              </th>

              <th className="py-4 px-4 font-bold text-center w-28">العمليات</th>
            </tr>

            {/* SECONDARY ROW OF COLUMN-SPECIFIC FILTER INPUTS (Horizontal Filters Below Headers) */}
            <tr className="bg-[#0e141a] border-b border-slate-800">
              <td className="py-2.5 px-4">
                <input
                  type="text"
                  placeholder="فلترة بالاسم..."
                  value={filters.studentName}
                  onChange={(e) => handleFilterChange("studentName", e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-[#121a21] border border-slate-800 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                />
              </td>
              <td className="py-2.5 px-4 w-20">
                <input
                  type="number"
                  placeholder="فلترة عمر..."
                  value={filters.age}
                  onChange={(e) => handleFilterChange("age", e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-[#121a21] border border-slate-800 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-mono"
                />
              </td>

              {activeView === "Log" ? (
                <>
                  <td className="py-2.5 px-4">
                    <input
                      type="text"
                      placeholder="فلترة القديم..."
                      value={filters.oldMemorization}
                      onChange={(e) => handleFilterChange("oldMemorization", e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-[#121a21] border border-slate-800 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none"
                    />
                  </td>
                  <td className="py-2.5 px-4">
                    <input
                      type="text"
                      placeholder="فلترة الجديد..."
                      value={filters.newMemorization}
                      onChange={(e) => handleFilterChange("newMemorization", e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-[#121a21] border border-slate-800 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none"
                    />
                  </td>
                  <td className="py-2.5 px-4">
                    <input
                      type="text"
                      placeholder="تاريخ (مثال: 05)..."
                      value={filters.date}
                      onChange={(e) => handleFilterChange("date", e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-[#121a21] border border-slate-800 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none font-mono"
                    />
                  </td>
                </>
              ) : (
                <td className="py-2.5 px-4">
                  <input
                    type="text"
                    placeholder="فلترة آخر حفظ..."
                    value={filters.newMemorization}
                    onChange={(e) => handleFilterChange("newMemorization", e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-[#121a21] border border-slate-800 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none"
                  />
                </td>
              )}

              <td className="py-2.5 px-4 w-28">
                <input
                  type="number"
                  placeholder="فلترة تقييم..."
                  value={filters.rating}
                  onChange={(e) => handleFilterChange("rating", e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-[#121a21] border border-slate-800 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none font-mono"
                />
              </td>

              <td className="py-2.5 px-4">
                <input
                  type="text"
                  placeholder="فلترة الشيخ..."
                  value={filters.supervisor}
                  onChange={(e) => handleFilterChange("supervisor", e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-[#121a21] border border-slate-800 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none"
                />
              </td>

              <td className="py-2.5 px-4 text-center">
                <button 
                  onClick={clearAllFilters}
                  className="text-[10px] text-slate-500 hover:text-red-400 font-bold underline"
                >
                  تصفير
                </button>
              </td>
            </tr>
          </thead>

          {/* TABLE ROWS BODY */}
          <tbody className="divide-y divide-slate-850 bg-[#0a0f13]">
            {activeView === "Log" ? (
              sortedLogRows.length > 0 ? (
                sortedLogRows.map(row => {
                  const editable = canModifyRecord(row);
                  return (
                    <tr key={row.id} className="hover:bg-slate-800/20 text-slate-350 border-b border-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-white">{row.studentName}</td>
                      <td className="py-3.5 px-4 font-mono text-xs">{row.studentAge}</td>
                      <td className="py-3.5 px-4 text-xs text-slate-400">{row.oldMemorization}</td>
                      <td className="py-3.5 px-4 text-xs font-semibold text-emerald-400">{row.newMemorization}</td>
                      <td className="py-3.5 px-4 font-mono text-slate-400 text-xs">{row.date}</td>
                      <td className="py-3.5 px-4 font-bold font-mono">
                        <span className="flex items-center gap-1">
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-bold font-mono border ${
                            row.rating >= 9 
                              ? "bg-emerald-950/20 border-emerald-900/30 text-emerald-400"
                              : row.rating >= 7
                              ? "bg-amber-950/20 border-amber-950 text-amber-500"
                              : "bg-rose-950/20 border-rose-950 text-rose-500"
                          }`}>
                            {row.rating} / ١٠
                          </span>
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-400">
                        <div className="font-semibold leading-tight">{row.supervisorName}</div>
                        {row.groupName && <span className="text-[10px] text-emerald-500 font-sans tracking-wide">{row.groupName}</span>}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            disabled={!editable}
                            onClick={() => handleOpenEdit(row)}
                            title={editable ? "تعديل التقييم اليومي" : "لا تملك صلاحية لتعديل هذا السجل"}
                            className="px-2 py-1 select-none text-xs bg-[#121a21] border border-slate-800 hover:border-emerald-600/50 text-slate-300 hover:text-emerald-400 font-bold rounded-lg transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            تعديل
                          </button>
                          <button
                            disabled={!editable}
                            onClick={() => handleDeleteLog(row.id, row.studentName)}
                            title={editable ? "حذف التسميع" : "لا تملك صلاحية لحذف هذا السجل"}
                            className="px-2 py-1 select-none text-xs bg-[#121a21] border border-slate-800 hover:border-red-650/50 text-slate-300 hover:text-red-400 font-bold rounded-lg transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            حذف
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    لا توجد سجلات حضور تسميع تطابق شروط الفلترة المحددة.
                  </td>
                </tr>
              )
            ) : (
              sortedSummaryRows.length > 0 ? (
                sortedSummaryRows.map(row => {
                  return (
                    <tr key={row.studentId} className="hover:bg-slate-800/20 text-slate-350 border-b border-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-white">{row.studentName}</td>
                      <td className="py-3.5 px-4 font-mono text-xs">{row.studentAge}</td>
                      <td className="py-3.5 px-4 text-xs font-semibold text-emerald-400">{row.latestMemo}</td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-bold font-mono border ${
                            row.avgRating >= 9 
                              ? "bg-[#091510] border-emerald-900/30 text-emerald-400"
                              : row.avgRating >= 7
                              ? "bg-[#151109] border-amber-950 text-amber-500"
                              : "bg-[#15090f] border-rose-950 text-rose-500"
                          }`}>
                            {row.avgRating} / ١٠
                          </span>
                          <span className="text-[10px] text-slate-500">({row.logCount} حضور)</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-400">{row.supervisorName}</td>
                      <td className="py-3.5 px-4 text-center">
                        {(() => {
                          const editable = canModifyStudent(row.studentId);
                          return (
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                disabled={!editable}
                                onClick={() => handleOpenEditStudent(row.studentId)}
                                title={editable ? "تعديل بيانات الطالب" : "لا تملك صلاحية لتعديل بيانات هذا الطالب"}
                                className="px-2 py-1 select-none text-xs bg-[#121a21] border border-slate-800 hover:border-emerald-600/50 text-slate-300 hover:text-emerald-400 font-bold rounded-lg transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                              >
                                تعديل
                              </button>
                              <button
                                disabled={!editable}
                                onClick={() => handleDeleteStudent(row.studentId, row.studentName)}
                                title={editable ? "حذف الطالب نهائياً" : "لا تملك صلاحية لحذف هذا الطالب"}
                                className="px-2 py-1 select-none text-xs bg-[#121a21] border border-slate-800 hover:border-red-650/50 text-slate-300 hover:text-red-400 font-bold rounded-lg transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                              >
                                حذف
                              </button>
                            </div>
                          );
                        })()}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    لا يوجد ملخص تطابق معايير الفلترة المذكورة.
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL POPUP DIALOG EDITOR */}
      {editingLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs px-4" dir="rtl">
          <div className="bg-[#0a0f13] border border-slate-800 rounded-3xl w-full max-w-lg p-6 sm:p-8 shadow-2xl relative transition-all">
            <button
              onClick={() => setEditingLog(null)}
              className="absolute top-4 left-4 p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-900/40 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-bold text-white mb-2 pr-3 border-r-2 border-emerald-500">تعديل سجل الحفظ والتقييم اليومي</h3>
            <p className="text-xs text-slate-400 mb-6 font-sans">تعديل بيانات تسميع الطالب: <span className="font-extrabold text-emerald-400">{compiledLogRows.find(l=>l.id===editingLog.id)?.studentName}</span></p>

            <div className="space-y-4">
              
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">تاريخ التسميع</label>
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="block w-full px-3 py-2 border border-slate-800 rounded-xl bg-[#121a21] text-slate-100 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">المراجعة (القديم)</label>
                  <input
                    type="text"
                    value={editOldMemo}
                    onChange={(e) => setEditOldMemo(e.target.value)}
                    className="block w-full px-3 py-2 border border-slate-800 rounded-xl bg-[#121a21] text-slate-100 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">الحفظ الجديد اليومي</label>
                  <input
                    type="text"
                    value={editNewMemo}
                    onChange={(e) => setEditNewMemo(e.target.value)}
                    className="block w-full px-3 py-2 border border-slate-800 rounded-xl bg-[#121a21] text-slate-100 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Slider for Rating */}
              <div className="bg-[#0e141a] p-4 border border-slate-850 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-slate-400">تقييم إتقان التلاوة</label>
                  <span className="text-xs font-bold text-emerald-400 font-mono">{editRating} / ١٠</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={editRating}
                  onChange={(e) => setEditRating(parseInt(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer text-sm"
                />
              </div>

              {editError && (
                <div className="flex items-center gap-1.5 p-3 rounded-xl bg-[#130b0e] border border-red-900/30 text-red-400 text-xs">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                  <span className="font-semibold">{editError}</span>
                </div>
              )}

              <div className="flex justify-end gap-2.5 pt-4">
                <button
                  type="button"
                  onClick={() => setEditingLog(null)}
                  className="px-5 py-2.5 bg-[#121a21] border border-slate-800 hover:bg-[#16222b] text-slate-300 font-bold rounded-xl text-xs transition-all cursor-pointer"
                >
                  إلغاء الأمر
                </button>
                <button
                  type="button"
                  disabled={isSavingEdit}
                  onClick={handleSaveEdit}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-75 shadow-lg shadow-emerald-950/20"
                >
                  {isSavingEdit ? "جاري الحفظ..." : "حفظ التعديلات"}
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* STUDENT PROFILE EDITOR MODAL */}
      {editingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs px-4" dir="rtl">
          <div className="bg-[#0a0f13] border border-slate-800 rounded-3xl w-full max-w-md p-6 sm:p-8 shadow-2xl relative transition-all">
            <button
              onClick={() => setEditingStudent(null)}
              className="absolute top-4 left-4 p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-900/40 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-bold text-white mb-2 pr-3 border-r-2 border-emerald-500">تعديل ملف الطالب التعريفي</h3>
            <p className="text-xs text-slate-400 mb-6 font-sans">تحديث المعطيات الأساسية للطالب: <span className="font-extrabold text-emerald-400">{editingStudent.name}</span></p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">الاسم الكامل للطالب</label>
                <input
                  type="text"
                  value={editStudentName}
                  onChange={(e) => setEditStudentName(e.target.value)}
                  placeholder="مثال: عبد الرحمن بن صخر"
                  className="block w-full px-3 py-2 border border-slate-800 rounded-xl bg-[#121a21] text-slate-100 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">العمر (سن الطالب)</label>
                <input
                  type="number"
                  value={editStudentAge}
                  onChange={(e) => setEditStudentAge(e.target.value)}
                  placeholder="١٢"
                  className="block w-full px-3 py-2 border border-slate-800 rounded-xl bg-[#121a21] text-slate-100 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                />
              </div>

              {studentEditError && (
                <div className="flex items-center gap-1.5 p-3 rounded-xl bg-[#130b0e] border border-red-900/30 text-red-400 text-xs">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                  <span className="font-semibold">{studentEditError}</span>
                </div>
              )}

              <div className="flex justify-end gap-2.5 pt-4">
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="px-5 py-2.5 bg-[#121a21] border border-slate-800 hover:bg-[#16222b] text-slate-300 font-bold rounded-xl text-xs transition-all cursor-pointer"
                >
                  إلغاء الأمر
                </button>
                <button
                  type="button"
                  disabled={isSavingStudentEdit}
                  onClick={handleSaveEditStudent}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-75 shadow-lg shadow-emerald-950/20"
                >
                  {isSavingStudentEdit ? "جاري الحفظ..." : "حفظ التغييرات"}
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
