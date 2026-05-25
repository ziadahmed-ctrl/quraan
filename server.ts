import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Grounding & analysis chat endpoint (Secret Gemini API Calls handled Server-Side)
  app.post("/api/chat", async (req, res) => {
    try {
      const { message, history, contextData } = req.body;

      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({
          error: "بالمستقبل، الرجاء تفعيل مفتاح Gemini API في لوحة الأسرار (Secrets) لإتاحة المساعد الذكي."
        });
      }

      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      // We ground the assistant with current students details, rating aggregates, performance, metrics
      const systemInstruction = `
You are "Sakinah Tracker AI Assistant" (المساعد الذكي لتعقب السكينة), a friendly, highly intelligent counselor and performance analyzer for a Quran memorization school.
Your layout and interface is rendered in Arabic, so ALWAYS communicate and respond in elegant, clear Arabic.

Primary tasks:
1. Ground your analysis ONLY on the given contextual database of student records, ratings, and attendance history provided below.
2. Help the supervisor pinpoint "who needs more review", highlighting students with lower average ratings or trailing memorization goals.
3. Summarize performance stats (like overall averages, count of students registered, or who has reached top scores).
4. Never assume or fabricate student names, scores, or ages that are not explicitly present in the provided JSON dataset.
5. Provide actionable advice for Quran instructors to improve students' progress.

--- REAL-TIME DATASET GROUNDING CONTEXT ---
${JSON.stringify(contextData || {}, null, 2)}
`;

      const chat = ai.chats.create({
        model: "gemini-3.5-flash",
        config: {
          systemInstruction,
        }
      });

      // Stitch history for seamless conversation flow
      let messagePayload = message;
      if (history && history.length > 0) {
        const conversationLog = history
          .map((h: any) => `${h.sender === 'user' ? 'المستخدم' : 'المساعد'}: ${h.text}`)
          .join("\n");
        messagePayload = `السجل السابق للمحادثة:\n${conversationLog}\n\nالسؤال الجديد من المستخدم:\n${message}`;
      }

      const result = await chat.sendMessage({ message: messagePayload });
      res.json({ text: result.text });
    } catch (error: any) {
      console.error("Gemini API Error in /api/chat:", error);
      res.status(500).json({ error: error.message || "عذراً، حدث خطأ أثناء الاتصال بمساعد الذكاء الاصطناعي." });
    }
  });

  // Health endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "healthy" });
  });

  // Serve Vite app in dynamic development mode or static production mode
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite development middleware mounted.");
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("Static production assets configured.");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Sakinah Quran Tracker backend running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
