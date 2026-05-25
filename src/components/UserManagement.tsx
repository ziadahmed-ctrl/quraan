import React, { useState, useEffect } from "react";
import { Shield, Users, RefreshCw, Layers, Edit, Save, CheckCircle2, UserCheck, XCircle, Trash2 } from "lucide-react";
import { SupervisorProfile } from "../types";
import { fetchSupervisors, updateSupervisorGroup, registerSupervisorProfile, removeSupervisor } from "../lib/dbManager";

interface UserManagementProps {
  onRefreshNeeded: () => void;
}

const PREBUILT_GROUPS = [
  { id: "group_mahmoud", name: "حلقة الشاطبي" },
  { id: "group_sudeis", name: "مجموع التميز" },
  { id: "group_ali", name: "حلقة النور" },
  { id: "group_omar", name: "حلقة الهمم" },
];

export default function UserManagement({ onRefreshNeeded }: UserManagementProps) {
  const [supervisors, setSupervisors] = useState<SupervisorProfile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  
  // Selection edits
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<"GroupSupervisor" | "GeneralSupervisor">("GroupSupervisor");
  const [feedback, setFeedback] = useState<{ status: "success" | "error"; text: string } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // New supervisor form states
  const [newName, setNewName] = useState<string>("");
  const [newEmail, setNewEmail] = useState<string>("");
  const [newGroup, setNewGroup] = useState<string>("group_mahmoud");
  const [newRole, setNewRole] = useState<"GroupSupervisor" | "GeneralSupervisor">("GroupSupervisor");
  const [isSubmitLoading, setIsSubmitLoading] = useState<boolean>(false);

  const handleRemoveSupervisor = async (uid: string, name: string) => {
    setActionLoadingId(uid);
    setFeedback(null);
    setConfirmDeleteId(null);
    try {
      await removeSupervisor(uid);
      setFeedback({
        status: "success",
        text: `✨ تم حذف المعلم [${name}] بنجاح وإلغاء تسجيل صلاحياته.`
      });
      await loadData();
      onRefreshNeeded();
    } catch (err: any) {
      console.error(err);
      setFeedback({
        status: "error",
        text: `🚨 فشل حذف المعلم: ${err.message || err}`
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const sups = await fetchSupervisors();
      setSupervisors(sups);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleStartEdit = (sup: SupervisorProfile) => {
    setEditingId(sup.uid);
    setSelectedGroup(sup.groupId || "");
    setSelectedRole(sup.role as "GroupSupervisor" | "GeneralSupervisor");
    setFeedback(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setSelectedGroup("");
    setSelectedRole("GroupSupervisor");
  };

  const handleSaveGroup = async (uid: string) => {
    setActionLoadingId(uid);
    setFeedback(null);
    
    // Find name corresponding to selected id
    const matchedGroup = PREBUILT_GROUPS.find(g => g.id === selectedGroup);
    const resolvedName = matchedGroup ? matchedGroup.name : "حلقة مخصصة";
    
    try {
      await updateSupervisorGroup(uid, selectedGroup || null, resolvedName, selectedRole);
      setFeedback({
        status: "success",
        text: "✨ تم تحديث تعيين الحلقة والترتيب الإشرافي والتبويب الصلاحي بنجاح."
      });
      setEditingId(null);
      await loadData();
      onRefreshNeeded();
    } catch (error: any) {
      console.error(error);
      setFeedback({
        status: "error",
        text: "🚨 عذراً، فشل تنفيذ التعديل على السحابة، يرجى التحقق من أخطاء الـ Security Rules."
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleAddSupervisor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newEmail) {
      setFeedback({ status: "error", text: "🚨 يرجى ملء حقل الاسم والبريد الإلكتروني للتمكن من إضافة المعلم." });
      return;
    }
    setIsSubmitLoading(true);
    setFeedback(null);
    try {
      const emailLower = newEmail.toLowerCase().trim();
      const safeId = emailLower
        .replace(/@/g, "_at_")
        .replace(/\./g, "_dot_")
        .replace(/[^a-z0-9_\-]/g, "");

      const matchedGroup = PREBUILT_GROUPS.find(g => g.id === newGroup);
      const groupName = newRole === "GeneralSupervisor" ? "الإشراف العام" : (matchedGroup ? matchedGroup.name : "حلقة مخصصة");

      await registerSupervisorProfile(safeId, {
        uid: safeId,
        email: emailLower,
        name: newName,
        role: newRole,
        groupId: newRole === "GeneralSupervisor" ? null : newGroup,
        groupName: groupName
      });

      setFeedback({
        status: "success",
        text: `✨ تم تسجيل المعلم [${newName}] بنجاح كحساب مسبق الصلاحية برتبة [${newRole === "GeneralSupervisor" ? "مشرف عام" : "معلم حلقة"}]!`
      });

      // Clear fields
      setNewName("");
      setNewEmail("");
      
      await loadData();
      onRefreshNeeded();
    } catch (err: any) {
      console.error(err);
      setFeedback({
        status: "error",
        text: `🚨 حدث خطأ أثناء إضافة المعلم: ${err.message || err}`
      });
    } finally {
      setIsSubmitLoading(false);
    }
  };

  return (
    <div className="bg-[#0a0f13] border border-slate-800/80 rounded-3xl p-6 sm:p-8 shadow-xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-indigo-950/20 mb-6">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-emerald-400" />
            <span>إدارة شؤون المعلمين والمشرفين</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            صلاحيات المشرف العام: مراجعة كافة مشرفي الحلقات وتعديل وتصنيف تعييناتهم الدراسية
          </p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-1 bg-[#121a21] border border-slate-800 text-xs text-slate-300 hover:text-white px-3 py-1.5 rounded-xl hover:bg-slate-900 transition-all cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>تحديث القائمة</span>
        </button>
      </div>

      {feedback && (
        <div 
          className={`p-4 rounded-2xl mb-6 text-xs sm:text-sm flex items-start gap-2.5 border ${
            feedback.status === "success" 
              ? "bg-emerald-950/20 border-emerald-900/40 text-emerald-400" 
              : "bg-red-950/20 border-red-900/40 text-red-400"
          }`}
        >
          {feedback.status === "success" ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
          ) : (
            <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Add New Supervisor Form Panel */}
      <div className="bg-[#0b1014] border border-slate-800/60 rounded-2xl p-5 mb-8">
        <h3 className="text-sm font-semibold text-emerald-400 flex items-center gap-2 mb-4 border-b border-slate-800 pb-2">
          <Users className="w-4 h-4" />
          <span>تسجيل مسبق لمشرف أو معلم حلقة جديد</span>
        </h3>
        <form onSubmit={handleAddSupervisor} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-[11px] text-slate-400 mb-1.5 font-medium">الاسم الكامل</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="الشيخ صالح السند"
              className="block w-full px-3 py-2 bg-[#121920] border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
              required
            />
          </div>
          <div>
            <label className="block text-[11px] text-slate-400 mb-1.5 font-medium">البريد الإلكتروني</label>
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="saleh@sakinah.org"
              className="block w-full px-3 py-2 bg-[#121920] border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-mono"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] text-slate-400 mb-1.5 font-medium">رتبة الصلاحية</label>
              <select
                value={newRole}
                onChange={(e) => {
                  const r = e.target.value as "GroupSupervisor" | "GeneralSupervisor";
                  setNewRole(r);
                }}
                className="block w-full px-2 py-2 bg-[#121920] border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                <option value="GroupSupervisor">معلم حلقة</option>
                <option value="GeneralSupervisor">مشرف عام</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1.5 font-medium">الحلقة المعينة</label>
              <select
                value={newGroup}
                onChange={(e) => setNewGroup(e.target.value)}
                disabled={newRole === "GeneralSupervisor"}
                className="block w-full px-2 py-2 bg-[#121920] border border-slate-805 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-500 disabled:opacity-50"
              >
                {PREBUILT_GROUPS.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <button
              type="submit"
              disabled={isSubmitLoading}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-2 rounded-xl transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-md shadow-emerald-950/20"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>{isSubmitLoading ? "جاري التسجيل..." : "تسجيل مسبق للمعلم"}</span>
            </button>
          </div>
        </form>
        <p className="text-[10px] text-slate-500 mt-2">
          💡 التسجيل المسبق يسمح للمعلم بالدخول مباشرة (بـ Google أو البريد) بالمسمى والصلاحيات الممنوحة له هنا لضمان سلامة وأمن المقرأة.
        </p>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-emerald-950 border-t-emerald-500 animate-spin"></div>
          <span className="text-xs text-slate-400 font-mono">جاري تحميل سجل المشرفين من السحابة...</span>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-900 bg-[#0d1318]">
          <table className="min-w-full text-right divide-y divide-slate-800">
            <thead className="bg-[#121a21] text-xs font-semibold text-slate-400 uppercase tracking-wider">
              <tr>
                <th scope="col" className="px-5 py-4">المعلم / المشرف</th>
                <th scope="col" className="px-5 py-4">البريد الإلكتروني</th>
                <th scope="col" className="px-5 py-4">الرتبة</th>
                <th scope="col" className="px-5 py-4">الحلقة المعينة حالياً</th>
                <th scope="col" className="px-5 py-4 text-left">التحكم</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-xs sm:text-sm text-slate-300">
              {supervisors.map((sup) => {
                const isEditing = editingId === sup.uid;
                const isSaving = actionLoadingId === sup.uid;
                
                return (
                  <tr key={sup.uid} className="hover:bg-[#121920]/40 transition-colors">
                    <td className="px-5 py-4 font-semibold text-white">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center font-bold text-slate-400 text-xs font-mono">
                          {sup.name.slice(0, 2)}
                        </div>
                        <div>
                          <div>{sup.name}</div>
                          <div className="text-[10px] text-slate-500 font-mono font-medium">{sup.uid}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-slate-400 font-mono">{sup.email || `${sup.uid}@sakinah.org`}</td>
                    <td className="px-5 py-4">
                      {isEditing ? (
                        <select
                          value={selectedRole}
                          onChange={(e) => {
                            const val = e.target.value as "GroupSupervisor" | "GeneralSupervisor";
                            setSelectedRole(val);
                            if (val === "GeneralSupervisor") {
                              setSelectedGroup("");
                            }
                          }}
                          className="pr-2 pl-6 py-1.5 border border-slate-755 bg-[#16212b] rounded-lg text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        >
                          <option value="GroupSupervisor">معلم حلقة</option>
                          <option value="GeneralSupervisor">مشرف عام</option>
                        </select>
                      ) : (
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          sup.role === "GeneralSupervisor" 
                            ? "bg-red-950/40 text-red-400 border border-red-900/40" 
                            : "bg-blue-950/40 text-blue-400 border border-blue-900/40"
                        }`}>
                          {sup.role === "GeneralSupervisor" ? "مشرف عام" : "معلم حلقة"}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {isEditing ? (
                        <select
                          value={selectedGroup}
                          onChange={(e) => setSelectedGroup(e.target.value)}
                          disabled={selectedRole === "GeneralSupervisor"}
                          className="pr-2 pl-6 py-1.5 border border-slate-750 bg-[#16212b] rounded-lg text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-55"
                        >
                          <option value="">-- بدون حلقة (غير معين) --</option>
                          {PREBUILT_GROUPS.map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="flex items-center gap-1.5 text-slate-200">
                          <Layers className="w-3.5 h-3.5 text-emerald-500" />
                          <span>{sup.groupName || "غير معين حالياً"}</span>
                          <span className="text-[10px] text-slate-500 font-mono">({sup.groupId || "null"})</span>
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4 text-left">
                      {isEditing ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleSaveGroup(sup.uid)}
                            disabled={isSaving}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1.5 rounded-lg text-xs font-medium inline-flex items-center gap-1 cursor-pointer transition-all shadow-md shadow-emerald-950/10"
                          >
                            <Save className="w-3.5 h-3.5" />
                            <span>{isSaving ? "حفظ..." : "حفظ"}</span>
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            disabled={isSaving}
                            className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all"
                          >
                            إلغاء
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleStartEdit(sup)}
                            disabled={sup.uid === "sup_all_access"}
                            className="text-slate-400 hover:text-emerald-400 border border-slate-805 bg-slate-900/60 hover:bg-emerald-950/20 px-2.5 py-1.5 rounded-lg text-xs font-medium inline-flex items-center gap-1 cursor-pointer transition-all disabled:opacity-35 disabled:cursor-not-allowed disabled:hover:text-slate-450"
                          >
                            <Edit className="w-3.5 h-3.5" />
                            <span>تعديل</span>
                          </button>
                          
                          {confirmDeleteId === sup.uid ? (
                            <div className="flex items-center gap-1 shrink-0 animate-fade-in">
                              <button
                                onClick={() => handleRemoveSupervisor(sup.uid, sup.name)}
                                className="bg-red-650 hover:bg-red-500 text-white px-2.5 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer transition-colors"
                              >
                                تأكيد
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(null)}
                                className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1.5 rounded-lg text-[10px] cursor-pointer transition-colors"
                              >
                                إلغاء
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmDeleteId(sup.uid)}
                              disabled={sup.uid === "sup_all_access" || sup.email === "ziad130512@gmail.com"}
                              className="text-red-400 hover:text-white border border-red-950/30 bg-red-955/10 hover:bg-red-650 px-2.5 py-1.5 rounded-lg text-xs font-medium inline-flex items-center gap-1 cursor-pointer transition-all disabled:opacity-35 disabled:cursor-not-allowed"
                              title="حذف المعلم"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
