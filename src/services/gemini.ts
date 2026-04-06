export interface VideoScene {
  visualPrompt: string;
  scriptText: string;
}

export interface VideoScript {
  title: string;
  scenes: VideoScene[];
}

export const generateScript = async (topic: string): Promise<VideoScript> => {
  const response = await fetch("/api/ai/generate-script", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topic }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Failed to generate script");
  return data;
};

export const generateVoiceover = async (text: string): Promise<string> => {
  const response = await fetch("/api/ai/generate-voiceover", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Failed to generate voiceover");
  return data.audioUrl;
};

export const generateVideoScene = async (visualPrompt: string): Promise<string> => {
  const response = await fetch("/api/ai/generate-video", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ visualPrompt }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Failed to generate video");
  return data.videoUrl;
};
