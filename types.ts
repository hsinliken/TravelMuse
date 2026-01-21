
export enum ToneType {
  EMOTIONAL = '感性敘事',
  PRACTICAL = '實用指南',
  LUXURY = '奢華極簡',
  VINTAGE = '懷舊復古'
}

export interface TravelTemplate {
  id: string;
  name: string;
  description: string;
  tone: ToneType;
  keywords: string[];
}

export interface Paragraph {
  id: string;
  type: 'intro' | 'destination' | 'transport' | 'food' | 'conclusion';
  title: string;
  content: string;
  imagePrompt?: string;
  promptHistory?: string[]; // 新增：紀錄過往使用的 Prompt
  uploadedImage?: string;
  status: 'draft' | 'refined';
  // 樣式屬性
  fontFamily?: string;
  fontSize?: string; 
  color?: string;
}

export interface Project {
  id: string;
  title: string;
  destination: string;
  templateId?: string;
  paragraphs: Paragraph[];
  updatedAt: number;
}

export interface CustomFont {
  name: string;
  url: string;
}
