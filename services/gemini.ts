import { GoogleGenAI, Type } from "@google/genai";

const getAIClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    // 拋出明確的診斷訊息，由 UI 捕捉顯示
    throw new Error("DIAGNOSTIC_ERROR: API_KEY_MISSING_OR_EMPTY (環境變數 API_KEY 未設定或為空值)");
  }
  return new GoogleGenAI({ apiKey });
};

export const generateTravelPlan = async (destination: string, tone: string) => {
  const ai = getAIClient();
  
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
  const ai = getAIClient();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `優化旅遊文案。重點：${focus}。品牌風格：${tone}。原文： "${currentContent}"。請使用繁體中文。請提供三種不同切入點的優化版本。每個版本必須包含「規劃說明（短）」與「文案內容（完整）」。`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          suggestions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                plan: { type: Type.STRING, description: "此版本的創作規劃與策略說明" },
                content: { type: Type.STRING, description: "優化後的完整文案內容" }
              },
              required: ["plan", "content"]
            },
            description: "三個不同版本的優化建議"
          }
        },
        required: ["suggestions"]
      }
    }
  });
  try {
    const data = JSON.parse(response.text || '{"suggestions":[]}');
    return data.suggestions;
  } catch (e) {
    console.error("Parse suggestions error", e);
    return []; 
  }
};

export const generateAIImage = async (prompt: string, modelName: string = 'gemini-2.5-flash-image') => {
  const ai = getAIClient();
  const isPro = modelName.includes('pro');
  const imageConfig: any = { aspectRatio: "16:9" };
  if (isPro) imageConfig.imageSize = "4K";

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: { parts: [{ text: prompt }] },
      config: { imageConfig: imageConfig }
    });
    if (!response.candidates?.[0]?.content?.parts) return null;
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    }
    return null;
  } catch (error) {
    throw error;
  }
};

export const analyzeImage = async (base64Image: string) => {
  const ai = getAIClient();
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
  const ai = getAIClient();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `根據這段文案撰寫一段適合 AI 繪圖的英文 Prompt： "${text}"。只需要回傳 Prompt 內容文字。`
  });
  return response.text;
};