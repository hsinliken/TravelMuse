import React, { useState } from 'react';
import { TravelTemplate, Project, ToneType, Paragraph } from '../types';
import { generateTravelPlan } from '../services/gemini';
import { Sparkles, MapPin, Palette, Loader2, ArrowRight, X, Edit3, Key } from 'lucide-react';

interface ProjectWizardProps {
  templates: TravelTemplate[];
  onCancel: () => void;
  onComplete: (project: Project) => void;
}

const ProjectWizard: React.FC<ProjectWizardProps> = ({ templates, onCancel, onComplete }) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [destination, setDestination] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [customToneInput, setCustomToneInput] = useState('');
  const [isCustomStyle, setIsCustomStyle] = useState(false);
  const [keyError, setKeyError] = useState(false);

  const handleStart = async () => {
    // 1. 環境檢測：如果 API_KEY 變數為空，說明需要手動授權
    if (window.aistudio && (!process.env.API_KEY || process.env.API_KEY.trim() === "")) {
      await window.aistudio.openSelectKey();
      // 點擊後不中斷流程，嘗試繼續，系統會自動在背景注入 key
    }

    setKeyError(false);
    setLoading(true);

    try {
      const template = templates.find(t => t.id === selectedTemplateId);
      const tone = isCustomStyle ? customToneInput : (template ? template.name : '標準商務行銷');
      
      // 呼叫 API
      const data = await generateTravelPlan(destination, tone);
      
      const sections = data.sections || [];
      const paragraphs: Paragraph[] = sections.map((s: any, index: number) => ({
        id: s.id || `para-${index}-${Math.random().toString(36).substr(2, 5)}`,
        type: s.type || 'destination',
        title: s.title || `區塊 ${index + 1}`,
        content: s.content || '',
        status: 'draft' as const
      }));

      const newProject: Project = {
        id: Math.random().toString(36).substring(7),
        title: data.title || `${destination} 創作`,
        destination,
        templateId: selectedTemplateId || (isCustomStyle ? 'custom' : undefined),
        updatedAt: Date.now(),
        paragraphs: paragraphs.length > 0 ? paragraphs : [
          { id: 'default', type: 'intro', title: '開始您的創作', content: '內容生成中...', status: 'draft' }
        ]
      };
      
      onComplete(newProject);
    } catch (error: any) {
      console.error("Detailed Error:", error);
      
      // 2. 錯誤捕捉：如果報錯中提到 API Key，引導使用者重新選取
      const errorMsg = error?.message || "";
      if (errorMsg.includes("API Key") || errorMsg.includes("403") || errorMsg.includes("401")) {
        setKeyError(true);
        if (window.aistudio) {
          await window.aistudio.openSelectKey();
        }
      } else {
        alert("生成文案時發生錯誤。請確認您的 API Key 已啟用付費專案且網路連線正常。");
      }
    } finally {
      setLoading(false);
    }
  };

  const canProceed = destination && (selectedTemplateId || isCustomStyle ? (isCustomStyle ? customToneInput.length > 0 : true) : true);

  return (
    <div className="fixed inset-0 z-[60] bg-stone-900/40 backdrop-blur-xl flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="px-8 py-6 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
          <h2 className="text-xl font-bold serif text-stone-800">建立新文案</h2>
          <button onClick={onCancel} className="text-stone-400 hover:text-stone-900 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-8 space-y-8 max-h-[80vh] overflow-y-auto">
          {step === 1 && (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-stone-500 uppercase tracking-wider flex items-center gap-2">
                  <MapPin size={14} />
                  您的文案主題是？
                </label>
                <input 
                  type="text"
                  placeholder="例如：台南鐵道環島攻略、京都賞櫻遊記..."
                  className="w-full text-2xl font-bold border-b-2 border-stone-100 focus:border-stone-900 outline-none pb-2 transition-all serif"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="space-y-4">
                <label className="text-sm font-semibold text-stone-500 uppercase tracking-wider flex items-center gap-2">
                  <Palette size={14} />
                  選擇或輸入品牌風格
                </label>
                <div className="grid grid-cols-1 gap-3">
                  <div 
                    onClick={() => { setSelectedTemplateId(null); setIsCustomStyle(false); }}
                    className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${!selectedTemplateId && !isCustomStyle ? 'border-stone-900 bg-stone-50' : 'border-stone-100 hover:border-stone-200'}`}
                  >
                    <div className="font-bold text-sm">系統預設引擎</div>
                    <div className="text-xs text-stone-400">標準行銷敘事風格。</div>
                  </div>
                  {templates.map(t => (
                    <div 
                      key={t.id}
                      onClick={() => { setSelectedTemplateId(t.id); setIsCustomStyle(false); }}
                      className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${selectedTemplateId === t.id ? 'border-stone-900 bg-stone-50' : 'border-stone-100 hover:border-stone-200'}`}
                    >
                      <div className="font-bold text-sm">{t.name}</div>
                      <div className="text-xs text-stone-400">{t.description}</div>
                    </div>
                  ))}
                  <div 
                    onClick={() => { setSelectedTemplateId(null); setIsCustomStyle(true); }}
                    className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col gap-2 ${isCustomStyle ? 'border-stone-900 bg-stone-50' : 'border-stone-100 hover:border-stone-200'}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-sm flex items-center gap-2"><Edit3 size={14} /> 自定義風格</div>
                    </div>
                    {isCustomStyle && (
                      <input 
                        type="text"
                        placeholder="請描述您的品牌風格 (如：優雅極簡、活潑潮流...)"
                        className="w-full bg-white border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-stone-900"
                        value={customToneInput}
                        onChange={(e) => setCustomToneInput(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        autoFocus
                      />
                    )}
                  </div>
                </div>
              </div>

              <button 
                disabled={!canProceed}
                onClick={() => setStep(2)}
                className="w-full bg-stone-900 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-stone-800 transition-all"
              >
                繼續設定基礎資訊 <ArrowRight size={18} />
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-8 animate-in slide-in-from-right-4 duration-500 text-center py-12">
              <div className="mx-auto w-20 h-20 bg-stone-900 rounded-3xl flex items-center justify-center text-white shadow-xl rotate-3">
                {loading ? <Loader2 size={32} className="animate-spin" /> : <Sparkles size={32} />}
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-bold serif">準備好具象化您的靈感了嗎？</h3>
                <p className="text-stone-500 max-w-sm mx-auto">
                  Gemini 將根據 <b>{isCustomStyle ? customToneInput : (selectedTemplateId ? templates.find(t=>t.id===selectedTemplateId)?.name : '系統預設')}</b> 風格，為 <b>{destination}</b> 生成初步內容。
                </p>
              </div>

              {keyError && (
                <div className="bg-amber-50 p-4 rounded-2xl flex items-center gap-3 text-amber-700 text-xs text-left max-w-md mx-auto border border-amber-100 animate-in slide-in-from-top-2">
                  <Key size={16} className="shrink-0" />
                  <p>偵測到 API Key 無法讀取。請點擊下方按鈕選取一個<b>已啟用付費專案（Paid Project）</b>的金鑰以繼續使用。</p>
                </div>
              )}

              <div className="flex flex-col gap-3">
                <button 
                  disabled={loading}
                  onClick={handleStart}
                  className="bg-stone-900 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-stone-800 transition-all shadow-lg disabled:opacity-70"
                >
                  {loading ? '正在分析內容構想...' : keyError ? '點此選取金鑰並重試' : '確認並開始生成'} 
                </button>
                <button 
                  disabled={loading}
                  onClick={() => setStep(1)}
                  className="text-stone-400 font-medium hover:text-stone-900 transition-colors"
                >
                  返回上一步
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectWizard;