import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Gemini AI Proxy Routes
  app.post("/api/ai/generate-script", async (req, res) => {
    try {
      const { topic } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;
      
      if (!apiKey || apiKey.trim() === "" || apiKey === "MY_GEMINI_API_KEY") {
        console.error("CRITICAL: GEMINI_API_KEY is missing or invalid in server environment.");
        return res.status(500).json({ 
          error: "Server API Key belum dikonfigurasi. Silakan tambahkan GEMINI_API_KEY di menu Secrets/Settings." 
        });
      }

      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Create a viral short video script (YouTube Shorts/TikTok style) about: ${topic}. 
        
        IMPORTANT:
        1. If the topic is in Indonesian, write the script and title in Indonesian.
        2. Use a strong "HOOK" in the first scene to grab attention.
        3. Keep the pace fast and the language engaging.
        4. Provide detailed visual prompts for AI video generation (cinematic, high quality).
        
        Return the response in JSON format with a title and an array of scenes. 
        Each scene should have a 'visualPrompt' (detailed description for AI video generation) and 'scriptText' (the voiceover text).
        Keep it short, engaging, and fast-paced (max 5 scenes).`,
        config: {
          responseMimeType: "application/json",
        },
      });

      res.json(JSON.parse(response.text));
    } catch (error: any) {
      console.error("AI Script Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/ai/generate-video", async (req, res) => {
    try {
      const { visualPrompt } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("GEMINI_API_KEY is not configured on server");

      const ai = new GoogleGenAI({ apiKey });
      let operation = await ai.models.generateVideos({
        model: 'veo-3.1-lite-generate-preview',
        prompt: visualPrompt,
        config: {
          numberOfVideos: 1,
          resolution: '720p',
          aspectRatio: '9:16'
        }
      });

      while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        operation = await ai.operations.getVideosOperation({ operation });
      }

      const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
      if (!downloadLink) throw new Error("Failed to generate video URL");

      // We return the proxy URL or the direct link with key
      res.json({ videoUrl: `${downloadLink}?x-goog-api-key=${apiKey}` });
    } catch (error: any) {
      console.error("AI Video Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/ai/generate-voiceover", async (req, res) => {
    try {
      const { text } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("GEMINI_API_KEY is not configured on server");

      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `Say cheerfully: ${text}` }] }],
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Zephyr' },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) throw new Error("Failed to generate audio");

      res.json({ audioUrl: `data:audio/wav;base64,${base64Audio}` });
    } catch (error: any) {
      console.error("AI Voiceover Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
