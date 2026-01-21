
import { GoogleGenAI, Type } from "@google/genai";
import { ToneType } from "../types";

// 每次 API 調用前建立新實例以確保 Key 的時效性
export const generateTravelPlan = async (destination: string, tone: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `請為「${destination}」創作深度行銷文案。
    品牌風格要求：${tone}。
    
    指令要求：
    1. 內容必須優美、專業且具備商業感染力。
    2. 禁止出現字句重複或邏輯迴圈。
    3. 總共提供 4 個區塊，每個區塊都要有吸引人的子標題。
    4. 必須使用繁體中文。`,
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
    const text = response.text;
    if (!text) throw new Error("Empty response from AI");
    return JSON.parse(text);
  } catch (error) {
    console.error("JSON Parsing Error:", error);
    return {
      title: `${destination} 行銷企劃`,
      sections: [
        { id: "1", type: "intro", title: "探索開始", content: "精彩內容正在準備中..." }
      ]
    };
  }
};

export const refineParagraph = async (currentContent: string, focus: string, tone: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `請優化以下旅遊文案。重點：${focus}。品牌風格：${tone}。原文： "${currentContent}"。請使用繁體中文。`,
    config: {
      systemInstruction: "你是一位資深旅遊行銷顧問，擅長運用精煉且具情緒渲染力的文字。"
    }
  });
  return response.text;
};

/**
 * 生成影像
 * 修正：針對 nano banana 系列 (2.5-flash-image) 不可設定 responseMimeType 或 responseSchema
 */
export const generateAIImage = async (prompt: string, modelName: string = 'gemini-2.5-flash-image') => {
  const imageAi = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const isPro = modelName.includes('pro');
  
  // 重要：影像生成模型只接受特定的 config
  const response = await imageAi.models.generateContent({
    model: modelName,
    contents: {
      parts: [
        { text: prompt }
      ]
    },
    config: {
      imageConfig: {
        aspectRatio: "16:9",
        imageSize: isPro ? "4K" : "1K"
      }
      // 注意：此處嚴禁出現 responseMimeType，否則會觸發 400 INVALID_ARGUMENT
    }
  });

  if (!response.candidates?.[0]?.content?.parts) return null;

  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  return null;
};

export const analyzeImage = async (base64Image: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: {
      parts: [
        { inlineData: { data: base64Image.split(',')[1], mimeType: 'image/jpeg' } },
        { text: "分析此圖片視覺特徵並建議敘事氛圍（繁體中文）。" }
      ]
    }
  });
  return JSON.parse(response.text || '{}');
};

export const generateImagePrompt = async (text: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `根據這段文案內容，撰寫一段適合 AI 生成高品質商業攝影圖片的英文提示詞 (Prompt)： "${text}"。提示詞應包含構圖、光影與氛圍描述。請只回傳 Prompt 內容文字。`
  });
  return response.text;
};
