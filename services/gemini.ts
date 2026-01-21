import { GoogleGenAI, Type } from "@google/genai";

export const generateTravelPlan = async (destination: string, tone: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `請為「${destination}」創作深度行銷文案。品牌風格要求：${tone}。必須使用繁體中文。總共 4 個區塊。`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          sections: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                type: { type: Type.STRING, enum: ['intro', 'destination', 'transport', 'food', 'conclusion'] },
                title: { type: Type.STRING },
                content: { type: Type.STRING }
              },
              required: ["id", "type", "title", "content"]
            }
          }
        },
        required: ["title", "sections"]
      }
    }
  });
  
  try {
    const text = response.text || '{}';
    return JSON.parse(text);
  } catch (error) {
    console.error("JSON Parsing Error", error);
    return { title: destination, sections: [] };
  }
};

export const refineParagraph = async (currentContent: string, focus: string, tone: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `優化旅遊文案。重點：${focus}。品牌風格：${tone}。原文： "${currentContent}"。請使用繁體中文。`,
  });
  return response.text;
};

export const generateAIImage = async (prompt: string, modelName: string = 'gemini-2.5-flash-image') => {
  const imageAi = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const isPro = modelName.includes('pro');
  
  const imageConfig: any = {
    aspectRatio: "16:9"
  };

  if (isPro) {
    imageConfig.imageSize = "4K";
  }

  try {
    const response = await imageAi.models.generateContent({
      model: modelName,
      contents: { parts: [{ text: prompt }] },
      config: {
        imageConfig: imageConfig
      }
    });

    if (!response.candidates?.[0]?.content?.parts) return null;

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (error) {
    console.error("Image generation failed", error);
    throw error;
  }
};

export const analyzeImage = async (base64Image: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: {
      parts: [
        { inlineData: { data: base64Image.split(',')[1], mimeType: 'image/jpeg' } },
        { text: "分析此圖片視覺特徵。" }
      ]
    }
  });
  return response.text;
};

export const generateImagePrompt = async (text: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `根據這段文案撰寫一段適合 AI 繪圖的英文 Prompt： "${text}"。只回傳 Prompt 內容文字。`
  });
  return response.text;
};