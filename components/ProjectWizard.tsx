import React, { useState, useEffect } from 'react';
import { TravelTemplate, Project, ToneType, Paragraph } from '../types';
import { generateTravelPlan } from '../services/gemini';
import { Sparkles, MapPin, Palette, Loader2, ArrowRight, X, Edit3, Key, AlertTriangle, ShieldCheck } from 'lucide-react';

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
  const [keyError, setKeyError] = useState<string | null>(null);
  const [hasAiStudio, setHasAiStudio] = useState(false);

  useEffect(() => {
    // 檢查環境是否支援 AI Studio 金鑰選取
    setHasAiStudio(!!window.aistudio);
  }, []);

  const openKeyDialog = async () => {
    if (window.aistudio) {
      try {
        await window.aistudio.openSelectKey();
        setKeyError(null); // 嘗試開啟後清除錯誤狀態
      } catch (e) {
        console.error("Failed to open key dialog", e);
      }
    } else {
      alert("目前的環境不支援 AI Studio 金鑰選取工具，請確認是否在正確的預覽視窗中開啟。");
    }
  };

  const handleStart = async () => {
    // 如果已有錯誤，點擊主按鈕直接開啟對話框
    if (keyError) {
      await openKeyDialog();
      return;
    }

    setKeyError(null);
    setLoading(true);

    try {
      const template = templates.find(t => t.id === selectedTemplateId);
      const tone = isCustomStyle ? customToneInput : (template ? template.name : '標準商務行銷');
      
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
      console.error("Project Generation Detailed Error:", error);
      
      const errorMsg = error?.message || "";
      // 捕捉金鑰相關錯誤
      if (
        errorMsg.includes("API Key") || 
        errorMsg.includes("DIAGNOSTIC_ERROR") ||
        errorMsg.includes("403") || 
        errorMsg.includes("401")
      ) {
        setKeyError(errorMsg);
      } else {
        alert(`生成失敗: ${errorMsg}`);
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
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold serif text-stone-800">建立新文案</h2>
            {hasAiStudio && (
              <span className="bg-emerald-50 text-emerald-600 text-[9px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                <ShieldCheck size={10} /> AI Studio 已連線
              </span>
            )}
          </div>
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
                <div className="bg-amber-50 p-6 rounded-2xl space-y-3 text-left max-w-md mx-auto border border-amber-200 animate-in slide-in-from-top-2">
                  <div className="flex items-center gap-3 text-amber-700 font-bold text-sm">
                    <AlertTriangle size={18} className="text-amber-500" />
                    金鑰設定診斷
                  </div>
                  <div className="text-[10px] text-amber-800 bg-white/50 p-3 rounded-lg font-mono break-all leading-relaxed">
                    <span className="text-amber-400 font-bold">ERROR:</span> {keyError}
                  </div>
                  <p className="text-[11px] text-amber-600 leading-relaxed">
                    請點擊下方按鈕選取金鑰。如果是 Vercel 環境，請確保已在專案 Settings -> Environment Variables 中加入 <code className="bg-amber-100 px-1 rounded">API_KEY</code> 並重新部署。
                  </p>
                </div>
              )}

              <div className="flex flex-col gap-3">
                <button 
                  disabled={loading}
                  onClick={handleStart}
                  className={`py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-xl active:scale-95 disabled:opacity-70 ${keyError ? 'bg-amber-500 text-white hover:bg-amber-600' : 'bg-stone-900 text-white hover:bg-stone-800'}`}
                >
                  {loading ? '正在分析內容構想...' : keyError ? '開啟金鑰選取視窗' : '確認並開始生成'} 
                </button>
                <button 
                  disabled={loading}
                  onClick={() => { setStep(1); setKeyError(null); }}
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