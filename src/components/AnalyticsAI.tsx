import React, { useState, useRef, useEffect } from "react";
import { 
  TrendingUp, Award, Users, Bot, Send, Sparkles, Check, 
  ChevronLeft, Trash2, ShieldAlert, MessageSquare, AlertCircle, HelpCircle 
} from "lucide-react";
import { Student, AttendanceLog } from "../types";

interface AnalyticsAIProps {
  students: Student[];
  attendanceLogs: AttendanceLog[];
}

export default function AnalyticsAI({ students, attendanceLogs }: AnalyticsAIProps) {
  // Conversational AI States
  const [messages, setMessages] = useState<Array<{ sender: "user" | "ai"; text: string; time: string }>>([
    {
      sender: "ai",
      text: "أهلاً بك في نظام السكينة الذكي للتحليل والمتابعة. أنا هنا لمساعدتك على قراءة وتقييم أداء الطلاب بالحلقات. يمكنك النقر على الأزرار السريعة بالأسفل أو كتابة أي سؤال تريده!",
      time: new Date().toLocaleTimeString("ar-EG", { hour: "numeric", minute: "2-digit" })
    }
  ]);
  const [chatInput, setChatInput] = useState("");
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoadingAI]);

  // --- COMPUTE ADVANCED STATISTICS METRICS ---
  
  // 1. Overall Average Rating
  const totalRatingPoints = attendanceLogs.reduce((sum, item) => sum + item.rating, 0);
  const overallAverageRating = attendanceLogs.length > 0 
    ? parseFloat((totalRatingPoints / attendanceLogs.length).toFixed(1)) 
    : 0;

  // 2. Average Rating per Student & Attendance distribution
  const studentMetricsMap: { [id: string]: { name: string; sum: number; count: number; lastMemo: string; age: number } } = {};
  
  students.forEach(s => {
    studentMetricsMap[s.id] = { name: s.name, sum: 0, count: 0, lastMemo: "لا يوجد بعد", age: s.age };
  });

  attendanceLogs.forEach(log => {
    if (studentMetricsMap[log.studentId]) {
      studentMetricsMap[log.studentId].sum += log.rating;
      studentMetricsMap[log.studentId].count += 1;
      // Capture latest
      studentMetricsMap[log.studentId].lastMemo = log.newMemorization;
    }
  });

  const studentAverages = Object.entries(studentMetricsMap)
    .map(([id, s]) => ({
      id,
      name: s.name,
      age: s.age,
      count: s.count,
      avg: s.count > 0 ? parseFloat((s.sum / s.count).toFixed(1)) : 0,
      latestMemo: s.lastMemo
    }))
    .filter(s => s.count > 0);

  // Average Rating per active student
  const activeStudentCount = studentAverages.length;
  const averageRatingPerStudent = activeStudentCount > 0 
    ? parseFloat((studentAverages.reduce((sum, s) => sum + s.avg, 0) / activeStudentCount).toFixed(1))
    : 0;

  // 3. Top 5 Scores (Ranked highest to lowest)
  const topScoresList = [...studentAverages]
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 5);

  // 4. Students who need extra review (students with average ratings less than 7.5 or who have very low daily score)
  const needsReviewCount = studentAverages.filter(s => s.avg < 7.5).length;

  // --- DISPATCH GEMINI API CALL WITH GROUNDED DATABASE ---
  const handleSendMessage = async (customText?: string) => {
    const textToSend = customText || chatInput;
    if (!textToSend.trim() || isLoadingAI) return;

    // Attach User query to chat
    const userMsg = {
      sender: "user" as const,
      text: textToSend,
      time: new Date().toLocaleTimeString("ar-EG", { hour: "numeric", minute: "2-digit" })
    };
    setMessages(prev => [...prev, userMsg]);
    setChatInput("");
    setIsLoadingAI(true);

    // Dynamic ground context dictionary containing clean stats for Gemini to parse
    const contextData = {
      overallAverages: {
        schoolAverageRating: overallAverageRating,
        activeStudentRatingsAverage: averageRatingPerStudent,
        totalRegisteredStudents: students.length,
        totalAttendanceEntries: attendanceLogs.length,
        studentsRequiringExtraReviewCount: needsReviewCount
      },
      topPerformingStudents: topScoresList.map(s => ({
        studentName: s.name,
        age: s.age,
        averageRecitationRating: s.avg,
        latestQuranMemorizedCap: s.latestMemo,
        totalClassesAttended: s.count
      })),
      needsReviewStudents: studentAverages
        .filter(s => s.avg < 7.5)
        .map(s => ({
          studentName: s.name,
          age: s.age,
          averageScore: s.avg,
          latestMemoRange: s.latestMemo,
          totalSubmissions: s.count
        })),
      recentLogs: attendanceLogs.slice(0, 8).map(log => {
        const matchingStudent = students.find(s => s.id === log.studentId);
        return {
          studentName: matchingStudent?.name || "مجهول",
          date: log.date,
          reviewRange: log.oldMemorization,
          newMemorizeRange: log.newMemorization,
          dailyEvaluationRating: log.rating
        };
      })
    };

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: textToSend,
          history: messages.slice(-5).map(m => ({
            sender: m.sender,
            text: m.text
          })),
          contextData
        })
      });

      const data = await response.json();
      if (response.ok) {
        setMessages(prev => [...prev, {
          sender: "ai",
          text: data.text || "عذراً لم أستطع صياغة رد مناسب، الرجاء تكرار المحاولة.",
          time: new Date().toLocaleTimeString("ar-EG", { hour: "numeric", minute: "2-digit" })
        }]);
      } else {
        setMessages(prev => [...prev, {
          sender: "ai",
          text: data.error || "عذراً واجهتني مشكلة أثناء الاتصال بجلسة جمناي. ربما لم يتم تفعيل الـ API Key بعد.",
          time: new Date().toLocaleTimeString("ar-EG", { hour: "numeric", minute: "2-digit" })
        }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        sender: "ai",
        text: "تعذر إرسال المحادثة إلى الخادم المباشر الداخلي. تأكد من تفعيل خدمة الاتصال بالخادم.",
        time: new Date().toLocaleTimeString("ar-EG", { hour: "numeric", minute: "2-digit" })
      }]);
    } finally {
      setIsLoadingAI(false);
    }
  };

  // Pre-cooked shortcut prompts
  const suggestions = [
    { title: "من يحتاج إلى مراجعة إضافية؟", query: "اعتماداً على التقييمات الحالية وحالات الضعف، من هم الطلاب الذين يحتاجون إلى مراجعة مكثفة أو تقوية؟" },
    { title: "لخص أداء اليوم والمقرات", query: "أعطني ملخصاً بيانياً شاملاً للأداء اليوم ومعدلات الحضور ومتوسط الدرجات، وما هي أبرز النقاط؟" },
    { title: "اقتراح خطة تحسين عاجلة", query: "بناءً على الطلاب الموجدين بالتقوية، اقترح خطة نصائح تربوية عملية للمشرفين لتحسين تمكن الطلاب للحفظ." }
  ];

  return (
    <div className="space-y-8">
      
      {/* 1. BENTO GRID OF METRICS CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        
        {/* Metric 1 */}
        <div className="bg-[#0a0f13] border border-slate-800/80 p-6 rounded-3xl flex items-center justify-between shadow-xl">
          <div>
            <span className="block text-xs font-semibold text-slate-400">التقييم العام للمدرسة</span>
            <div className="flex items-baseline gap-1 mt-1.5">
              <span className="text-3xl font-extrabold text-white font-mono">{overallAverageRating}</span>
              <span className="text-xs text-slate-500 font-semibold">/ ١٠</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-emerald-400 mt-2 font-semibold">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>مستقر للتصاعد الحفظي</span>
            </div>
          </div>
          <div className="w-12 h-12 bg-emerald-950/20 text-emerald-400 border border-emerald-900/35 rounded-2xl flex items-center justify-center">
            <Award className="w-6 h-6" />
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-[#0a0f13] border border-slate-800/80 p-6 rounded-3xl flex items-center justify-between shadow-xl">
          <div>
            <span className="block text-xs font-semibold text-slate-400">متوسط تقييم كل طالب</span>
            <div className="flex items-baseline gap-1 mt-1.5">
              <span className="text-3xl font-extrabold text-white font-mono">{averageRatingPerStudent}</span>
              <span className="text-xs text-slate-500">/ ١٠</span>
            </div>
            <span className="block text-[11px] text-slate-500 mt-2">محسوب من {activeStudentCount} طالب فاعل</span>
          </div>
          <div className="w-12 h-12 bg-amber-950/20 text-amber-500 border border-amber-900/30 rounded-2xl flex items-center justify-center">
            <Award className="w-6 h-6" />
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-[#0a0f13] border border-slate-800/80 p-6 rounded-3xl flex items-center justify-between shadow-xl">
          <div>
            <span className="block text-xs font-semibold text-slate-400">حالات الاستدراك والمراجعة</span>
            <div className="flex items-baseline mt-1.5">
              <span className="text-3xl font-extrabold text-white font-mono">{needsReviewCount}</span>
              <span className="text-xs text-slate-500 pr-1.5">طلاب بحاجة لدعم</span>
            </div>
            <span className="block text-[11px] text-slate-500 mt-2">متوسط تسميعهم دون ٧.٥ درجات</span>
          </div>
          <div className="w-12 h-12 bg-rose-950/20 text-rose-500 border border-rose-900/30 rounded-2xl flex items-center justify-center">
            <AlertCircle className="w-6 h-6" />
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-[#0a0f13] border border-slate-800/80 p-6 rounded-3xl flex items-center justify-between shadow-xl">
          <div>
            <span className="block text-xs font-semibold text-slate-400">إجمالي حصص التدقيق</span>
            <div className="flex items-baseline mt-1.5">
              <span className="text-3xl font-extrabold text-white font-mono">{attendanceLogs.length}</span>
              <span className="text-xs text-slate-500 pr-1.5">حضور وتسميع</span>
            </div>
            <span className="block text-[11px] text-slate-500 mt-2">مسجل بقاعدة البيانات</span>
          </div>
          <div className="w-12 h-12 bg-sky-950/20 text-sky-450 border border-sky-900/30 rounded-2xl flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
        </div>

      </div>

      {/* 2. SPLIT ROW: CHARTS VISUALIZER & LEADERBOARD MARKS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEADERBOARD (Top 5 scores) */}
        <div className="lg:col-span-4 bg-[#0a0f13] border border-slate-800/80 p-6 rounded-3xl flex flex-col justify-between shadow-xl">
          <div>
            <h3 className="text-base font-bold text-white mb-1 pr-3 border-r-2 border-emerald-500">لوحة التميز (أعلى ٥ مراتب)</h3>
            <p className="text-xs text-slate-400 mb-5">أعلى الطلاب متوسط تقييم لمستويات الإتقان اليومية</p>
            
            <div className="space-y-3.5">
              {topScoresList.length > 0 ? (
                topScoresList.map((stud, idx) => (
                  <div key={stud.id} className="flex items-center justify-between p-3 rounded-2xl bg-[#121a21]/50 border border-slate-850 transition-all">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-6 h-6 font-bold text-xs rounded-full flex items-center justify-center ${
                        idx === 0 ? "bg-amber-500/10 text-amber-400 border border-amber-500/30" :
                        idx === 1 ? "bg-slate-300/10 text-slate-300 border border-slate-300/30" :
                        idx === 2 ? "bg-amber-600/10 text-amber-500 border border-amber-600/30" :
                        "bg-slate-800/20 text-slate-400"
                      }`}>
                        {idx + 1}
                      </div>
                      <div>
                        <span className="block text-xs font-bold text-slate-200">{stud.name}</span>
                        <span className="block text-[10px] text-slate-500">{stud.latestMemo}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-extrabold text-emerald-400 font-mono">{stud.avg} / ١٠</div>
                      <div className="text-[10px] text-slate-500">({stud.count} تلاوات)</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-10 text-slate-500 text-xs">لا يوجد بيانات للتصنيف حالياً</div>
              )}
            </div>
          </div>
          <div className="text-[11px] text-center text-slate-500 border-t border-slate-850 pt-4 mt-4">
            تحدث اللوحة تلقائياً فور رصد حصص المقارئ
          </div>
        </div>

        {/* CUSTOM SVG RESPONSIVE CHARTS GRAPHIC PANEL */}
        <div className="lg:col-span-8 bg-[#0a0f13] border border-slate-800/80 p-6 rounded-3xl shadow-xl">
          <h3 className="text-base font-bold text-white mb-1 pr-3 border-r-2 border-emerald-500">منحنى توزيع درجات الحفظ والتقدم التراكمي</h3>
          <p className="text-xs text-slate-400 mb-6">رسم بياني يعبر عن عدد الطلاب الفاعلين عبر مستويات التقاطعات التقييمية للحلقات</p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            
            {/* Chart 1: Rating distribution curves */}
            <div className="space-y-2.5">
              <span className="block text-xs font-bold text-slate-400 text-center">توزيع تقييم رتب الحفظ (عدد الطلاب بالمجموعة)</span>
              <div className="h-44 w-full bg-[#121a21] rounded-2xl p-3 flex items-end justify-between relative border border-slate-800">
                
                {/* Visual guidelines */}
                <div className="absolute top-4 right-0 left-0 border-t border-slate-800/30 pointer-events-none"></div>
                <div className="absolute top-1/2 right-0 left-0 border-t border-slate-800/30 pointer-events-none"></div>
                
                {/* Generating dynamic scale pillars */}
                {Array.from({ length: 5 }).map((_, i) => {
                  const ratingLower = (i * 2) + 1;
                  const ratingUpper = (i * 2) + 2;
                  const studentCount = studentAverages.filter(s => s.avg >= ratingLower && s.avg <= ratingUpper).length;
                  const ratio = studentAverages.length > 0 ? (studentCount / studentAverages.length) : 0;
                  const barHeight = Math.max(8, ratio * 100); // minimum visual representation

                  return (
                    <div key={i} className="flex flex-col items-center flex-1 space-y-2 z-10 group cursor-pointer">
                      <div className="text-[10px] font-bold text-emerald-400 font-mono scale-0 group-hover:scale-105 transition-all bg-emerald-950/80 border border-emerald-900/30 px-1.5 py-0.5 rounded">
                        {studentCount} طفل
                      </div>
                      <div 
                        style={{ height: `${barHeight}px` }} 
                        className="w-8 bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-all shadow-md shadow-emerald-950/20"
                      ></div>
                      <span className="text-[10px] text-slate-500 font-mono">{ratingLower}-{ratingUpper}⭐</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Chart 2: Student Age Distribution */}
            <div className="space-y-2.5">
              <span className="block text-xs font-bold text-slate-400 text-center">توزيع فئات الطلاب العمرية (سنين)</span>
              <div className="h-44 w-full bg-[#121a21] rounded-2xl p-3 flex items-end justify-between relative border border-slate-800">
                <div className="absolute top-4 right-0 left-0 border-t border-slate-800/30 pointer-events-none"></div>
                <div className="absolute top-1/2 right-0 left-0 border-t border-slate-800/30 pointer-events-none"></div>

                {["4-8", "9-12", "13-16", "17+"].map((fClass, idx) => {
                  let cnt = 0;
                  students.forEach(s => {
                    if (idx === 0 && s.age <= 8) cnt++;
                    else if (idx === 1 && s.age >= 9 && s.age <= 12) cnt++;
                    else if (idx === 2 && s.age >= 13 && s.age <= 16) cnt++;
                    else if (idx === 3 && s.age >= 17) cnt++;
                  });
                  const ratio = students.length > 0 ? (cnt / students.length) : 0;
                  const barHeight = Math.max(8, ratio * 110);

                  return (
                    <div key={fClass} className="flex flex-col items-center flex-1 space-y-2 z-10 group cursor-pointer">
                      <div className="text-[10px] font-bold text-amber-400 scale-0 group-hover:scale-105 transition-all bg-amber-950/80 border border-amber-900/35 px-1.5 py-0.5 rounded">
                        {cnt} طلاب
                      </div>
                      <div 
                        style={{ height: `${barHeight}px` }} 
                        className="w-8 bg-amber-500 hover:bg-amber-400 rounded-lg transition-all shadow-md shadow-amber-950/20"
                      ></div>
                      <span className="text-[10px] text-slate-500 font-mono">{fClass}</span>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        </div>

      </div>

      {/* 3. CORE AI CONVERSATIONAL ANALYTICS ASSISTANT */}
      <div id="ai_assistant_panel" className="bg-[#0a0f13] border border-slate-800/80 rounded-3xl overflow-hidden p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 mb-5 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-600 text-white rounded-2xl flex items-center justify-center shadow-md shadow-emerald-900/10">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-1.5 leading-tight">
                المساعد التحليلي الذكي (Sakinah AI)
                <span className="text-[10px] bg-emerald-950/40 text-emerald-400 border border-emerald-900/40 font-bold px-1.5 py-0.5 rounded-lg">Gemini 3.5</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">تحليل معزز مبني على البيانات المباشرة لفرص الدعم ومراجعة تقارير جودة الإعجاز</p>
            </div>
          </div>
          <div className="text-[11px] text-emerald-400 font-semibold bg-emerald-950/20 border border-emerald-900/40 px-3 py-1.5 rounded-xl">
            ● الحصص معززة بالاستدلال الفوري بجداولك النشطة
          </div>
        </div>

        {/* CHAT MESSAGES STREAM DISPLAY OUTLET */}
        <div className="space-y-4 max-h-80 overflow-y-auto pr-1 pl-1 mb-5 bg-[#121a21] p-4 rounded-2xl border border-slate-800/80 scrollbar-thin">
          {messages.map((m, idx) => {
            const isUser = m.sender === "user";
            return (
              <div 
                key={idx} 
                className={`flex max-w-[85%] ${isUser ? "mr-auto flex-row-reverse" : "ml-auto"} gap-3 items-end`}
              >
                {!isUser && (
                  <div className="w-7 h-7 bg-emerald-600 text-white text-[10px] font-bold rounded-lg flex items-center justify-center shrink-0">
                    ذكاء
                  </div>
                )}
                <div className={`p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                  isUser 
                    ? "bg-slate-800 text-slate-100 rounded-bl-none border border-slate-700/50" 
                    : "bg-[#0a0f13] border border-slate-800 text-slate-200 rounded-br-none shadow-md"
                }`}>
                  <div className="whitespace-pre-line leading-relaxed">{m.text}</div>
                  <span className="block text-[10px] mt-2.5 font-mono text-left text-slate-500">
                    {m.time}
                  </span>
                </div>
              </div>
            );
          })}

          {isLoadingAI && (
            <div className="flex ml-auto max-w-[80%] gap-3 items-center">
              <div className="w-7 h-7 bg-emerald-600 text-white text-[10px] font-bold rounded-lg flex items-center justify-center shrink-0 animate-pulse">
                ذكاء
              </div>
              <div className="bg-[#0a0f13] border border-slate-800 p-4 rounded-2xl rounded-br-none flex items-center gap-2 text-xs text-slate-400 font-semibold">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce"></span>
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce delay-100"></span>
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce delay-200"></span>
                <span>جاري صياغة قراءة بيانية دقيقة لحلقاتك...</span>
              </div>
            </div>
          )}
          <div ref={chatBottomRef} />
        </div>

        {/* CLICKABLE PRESET QUICK PROMPTS CHIPS */}
        <div className="mb-5 space-y-1.5">
          <span className="block text-[11px] font-bold text-slate-450">أسئلة تحليلية سريعة بالتعلم المباشر:</span>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s, idx) => (
              <button
                key={idx}
                type="button"
                disabled={isLoadingAI}
                onClick={() => handleSendMessage(s.query)}
                className="text-xs font-semibold bg-[#121a21] border border-slate-800 hover:border-emerald-500 hover:text-emerald-400 text-slate-300 p-2.5 rounded-xl transition-all cursor-pointer select-none text-right flex items-center gap-1.5 disabled:opacity-55"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                {s.title}
              </button>
            ))}
          </div>
        </div>

        {/* INPUT DISPATCH PANEL */}
        <div className="flex gap-2 relative">
          <input
            type="text"
            placeholder={isLoadingAI ? "جاري تدقيق التحليلات..." : "اسأل جمناي: من تعثر بالحفظ؟ لخص درجات اليوم..."}
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            disabled={isLoadingAI}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSendMessage();
            }}
            className="w-full px-4 py-3.5 text-xs sm:text-sm bg-[#121a21] border border-slate-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-550 text-slate-100 placeholder-slate-600 transition-all disabled:opacity-75"
          />
          <button
            type="button"
            disabled={isLoadingAI || !chatInput.trim()}
            onClick={() => handleSendMessage()}
            className="px-5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl transition-all flex items-center justify-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed text-xs sm:text-sm shadow-md"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>

      </div>

    </div>
  );
}
