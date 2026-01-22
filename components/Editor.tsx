import React, { useState, useRef, useEffect } from 'react';
import { Project, Paragraph, CustomFont } from '../types';
import { refineParagraph, analyzeImage, generateImagePrompt, generateAIImage } from '../services/gemini';
import { 
  ArrowLeft, Save, Globe, Image as ImageIcon, 
  Sparkles, Loader2, CheckCircle, ChevronRight,
  RefreshCw, Type as TypeIcon, Palette as PaletteIcon, X,
  CaseSensitive, Eye, Wand2, LogOut, ChevronUp, ChevronDown, 
  History, Zap, MousePointer2, Printer, Check, ChevronRightSquare,
  Cpu, AlertCircle
} from 'lucide-react';

declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
  interface Window {
    aistudio?: AIStudio;
  }
}

interface Suggestion {
  plan: string;
  content: string;
}

interface EditorProps {
  project: Project;
  customFonts: CustomFont[];
  onSave: (project: Project) => void;
  onClose: () => void;
}

const Editor: React.FC<EditorProps> = ({ project, customFonts, onSave, onClose }) => {
  const [activeParaId, setActiveParaId] = useState<string | null>(project.paragraphs[0]?.id || null);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [refineSuggestions, setRefineSuggestions] = useState<Suggestion[] | null>(null);
  const [isGeneratingImg, setIsGeneratingImg] = useState(false);
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);
  const [imageProgress, setImageProgress] = useState<string>('');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [editedProject, setEditedProject] = useState<Project>(project);
  const [imgModel, setImgModel] = useState<'gemini-2.5-flash-image' | 'gemini-3-pro-image-preview'>('gemini-2.5-flash-image');
  const [showHistory, setShowHistory] = useState(false);
  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(1);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isPreviewOpen) setIsPreviewOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPreviewOpen]);

  const activePara = editedProject.paragraphs.find(p => p.id === activeParaId);

  const updateActivePara = (updates: Partial<Paragraph>) => {
    if (!activeParaId) return;
    const newParas = editedProject.paragraphs.map(p => 
      p.id === activeParaId ? { ...p, ...updates } : p
    );
    setEditedProject({ ...editedProject, paragraphs: newParas });
  };

  const moveSection = (index: number, direction: 'up' | 'down') => {
    const newParas = [...editedProject.paragraphs];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newParas.length) return;
    [newParas[index], newParas[targetIndex]] = [newParas[targetIndex], newParas[index]];
    setEditedProject({ ...editedProject, paragraphs: newParas });
  };

  const handleSave = () => {
    setIsSaving(true);
    const updatedProject = { ...editedProject, updatedAt: Date.now() };
    onSave(updatedProject);
    setTimeout(() => setIsSaving(false), 800);
  };

  // 解決沙盒列印問題的「安全模式」
  const handlePrint = () => {
    try {
      // 先嘗試直接列印
      window.print();
    } catch (e) {
      console.warn("Direct printing blocked by sandbox, attempting fallback...");
      // 備案：開啟新分頁渲染列印內容
      const printContent = document.getElementById('print-section')?.innerHTML;
      if (!printContent) return;

      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>${editedProject.title}</title>
              <style>
                body { font-family: 'Inter', 'Noto Serif TC', serif; padding: 40px; color: #1c1917; line-height: 1.6; }
                h1 { font-size: 32pt; margin-bottom: 10px; }
                h2 { font-size: 24pt; border-bottom: 1px solid #e5e7eb; padding-bottom: 10px; margin-top: 40px; }
                p { font-size: 12pt; white-space: pre-wrap; }
                img { max-width: 100%; height: auto; border-radius: 12px; margin-top: 20px; }
                footer { margin-top: 60px; font-size: 9pt; color: #a8a29e; text-align: center; }
                @media print { .no-print { display: none; } }
              </style>
            </head>
            <body>
              ${printContent}
              <script>
                setTimeout(() => { window.print(); window.close(); }, 500);
              </script>
            </body>
          </html>
        `);
        printWindow.document.close();
      } else {
        alert("列印視窗被瀏覽器攔截。請點擊預覽模式，並使用右鍵選擇「列印」或手動儲存為 PDF。");
      }
    }
  };

  const handleRefine = async (focus: string) => {
    if (!activePara) return;
    setIsRefining(true);
    setActiveStep(1);
    setRefineSuggestions(null);
    try {
      const suggestions = await refineParagraph(activePara.content, focus, editedProject.templateId || '高端');
      setRefineSuggestions(suggestions);
    } catch (e) {
      console.error(e);
      alert("文案優化失敗，請檢查網路連線。");
    } finally {
      setIsRefining(false);
    }
  };

  const handlePromptGen = async () => {
    if (!activeParaId || !activePara) return;
    setIsGeneratingPrompt(true);
    setActiveStep(2);
    try {
      const p = await generateImagePrompt(activePara.content);
      updateActivePara({ imagePrompt: p });
    } catch (e) {
      console.error(e);
    } finally {
      setIsGeneratingPrompt(false);
    }
  };

  const applySuggestion = (s: Suggestion) => {
    updateActivePara({ content: s.content, status: 'refined' });
    setRefineSuggestions(null);
    setActiveStep(2); 
  };

  const handleGenerateAIImage = async () => {
    if (!activePara || !activePara.imagePrompt || isGeneratingImg) return;
    
    if (imgModel.includes('pro') && window.aistudio) {
      if (!(await window.aistudio.hasSelectedApiKey())) {
        await window.aistudio.openSelectKey();
      }
    }

    setIsGeneratingImg(true);
    setActiveStep(3);
    
    const steps = ["正在解析提示詞...", "構思視覺佈局...", "渲染光影細節...", "進行最後修飾..."];
    let stepIdx = 0;
    const interval = setInterval(() => {
      setImageProgress(steps[stepIdx % steps.length]);
      stepIdx++;
    }, 2500);

    try {
      const imgUrl = await generateAIImage(activePara.imagePrompt, imgModel);
      if (imgUrl) {
        updateActivePara({ 
          uploadedImage: imgUrl, 
          promptHistory: [activePara.imagePrompt, ...(activePara.promptHistory || [])].slice(0, 10) 
        });
        setImageProgress("生成成功！");
      } else {
        throw new Error("No image generated");
      }
    } catch (e) { 
      if (e instanceof Error && e.message.includes("Requested entity was not found.")) {
        if (window.aistudio) await window.aistudio.openSelectKey();
      } else {
        console.error(e);
        alert("影像生成失敗，請更換模型或稍後再試。"); 
      }
    } 
    finally { 
      clearInterval(interval);
      setIsGeneratingImg(false); 
      setTimeout(() => setImageProgress(''), 3000);
    } 
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      updateActivePara({ uploadedImage: base64 });
      try {
        await analyzeImage(base64);
      } catch (e) { console.error(e); }
    };
    reader.readAsDataURL(file);
  };

  const fonts = [
    { name: '系統預設', value: 'inherit' },
    { name: '思源宋體', value: "'Noto Serif TC', serif" },
    { name: '思源黑體', value: "'Inter', sans-serif" },
    ...customFonts.map(f => ({ name: f.name, value: f.name }))
  ];

  const fontSizes = ['14px', '16px', '18px', '24px', '32px', '48px'];
  const colors = ['#1c1917', '#1e3a8a', '#064e3b', '#991b1b', '#4b5563', '#92400e'];

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] animate-in fade-in duration-500">
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * { visibility: hidden; }
          #print-section, #print-section * { visibility: visible; }
          #print-section {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 2cm;
            background: white;
            z-index: 9999;
          }
          .no-print { display: none !important; }
          section { page-break-inside: avoid; margin-bottom: 2cm; }
        }
      `}} />

      <div className="flex items-center justify-between mb-4 print:hidden">
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="p-2 hover:bg-stone-100 rounded-full transition-colors"><ArrowLeft size={20} /></button>
          <h2 className="text-xl font-bold serif truncate max-w-[300px]">{editedProject.title}</h2>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setIsPreviewOpen(true)} className="px-3 py-2 font-bold text-stone-500 hover:text-stone-900 flex items-center gap-2 transition-colors"><Eye size={16} /> 預覽</button>
          <button onClick={handleSave} disabled={isSaving} className="px-3 py-2 font-bold text-stone-500 hover:text-stone-900 flex items-center gap-2 transition-colors">
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {isSaving ? '儲存中' : '儲存'}
          </button>
          <button onClick={handlePrint} className="px-3 py-2 font-bold text-stone-500 hover:text-stone-900 flex items-center gap-2 transition-colors">
            <Printer size={16} /> 列印成 PDF
          </button>
          <button className="bg-stone-900 text-white px-6 py-2 rounded-full font-bold hover:bg-stone-800 transition-all shadow-md">發佈</button>
        </div>
      </div>

      <div className="flex-1 flex gap-6 min-h-0 print:hidden">
        <div className="w-56 overflow-y-auto space-y-2 border-r border-stone-100 pr-2">
          <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-4">文案架構</p>
          {editedProject.paragraphs.map((p, idx) => (
            <div key={p.id} className="relative group">
              <button 
                onClick={() => setActiveParaId(p.id)}
                className={`w-full text-left p-4 rounded-2xl border transition-all ${activeParaId === p.id ? 'bg-stone-900 text-white border-stone-900 shadow-lg' : 'bg-white border-stone-100 hover:border-stone-300 shadow-sm'}`}
              >
                <div className="flex justify-between text-[10px] mb-1">
                  <span>PART 0{idx+1}</span>
                  {p.status === 'refined' && <CheckCircle size={10} className="text-emerald-400" />}
                </div>
                <div className="font-bold text-xs truncate">{p.title}</div>
              </button>
              <div className="absolute -right-2 top-1/2 -translate-y-1/2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 z-10 transition-opacity">
                <button onClick={(e) => { e.stopPropagation(); moveSection(idx, 'up'); }} disabled={idx === 0} className="p-1 bg-white border border-stone-200 rounded-full shadow-md hover:bg-stone-50 disabled:opacity-20"><ChevronUp size={12}/></button>
                <button onClick={(e) => { e.stopPropagation(); moveSection(idx, 'down'); }} disabled={idx === editedProject.paragraphs.length - 1} className="p-1 bg-white border border-stone-200 rounded-full shadow-md hover:bg-stone-50 disabled:opacity-20"><ChevronDown size={12}/></button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex-1 flex flex-col bg-white rounded-[2rem] border border-stone-100 shadow-sm overflow-hidden relative">
          {activePara ? (
            <div className="flex flex-col h-full relative">
              <div className="px-8 py-4 border-b border-stone-50 flex flex-wrap items-center gap-6 bg-stone-50/50 sticky top-0 z-20">
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] font-bold text-stone-400 uppercase">字體</span>
                  <select value={activePara.fontFamily || 'inherit'} onChange={e => updateActivePara({fontFamily: e.target.value})} className="block w-32 text-xs font-bold bg-white border border-stone-200 rounded-lg p-1.5 shadow-sm outline-none">
                    {fonts.map(f => <option key={f.value} value={f.value}>{f.name}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] font-bold text-stone-400 uppercase">大小</span>
                  <select value={activePara.fontSize || '18px'} onChange={e => updateActivePara({fontSize: e.target.value})} className="block w-20 text-xs font-bold bg-white border border-stone-200 rounded-lg p-1.5 shadow-sm outline-none">
                    {fontSizes.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] font-bold text-stone-400 uppercase">顏色</span>
                  <div className="flex gap-2 p-1.5 bg-white border border-stone-200 rounded-lg shadow-sm">
                    {colors.map(c => <button key={c} onClick={() => updateActivePara({color: c})} className={`w-4 h-4 rounded-full border border-white ring-1 transition-transform hover:scale-110 ${activePara.color === c ? 'ring-black scale-125' : 'ring-transparent'}`} style={{backgroundColor: c}} />)}
                    <button onClick={() => updateActivePara({color: undefined})} className="w-4 h-4 rounded-full border border-stone-200 bg-white text-[8px] flex items-center justify-center font-bold text-stone-400">X</button>
                  </div>
                </div>
              </div>

              {/* 優化文案選擇器 Overlay */}
              {refineSuggestions && (
                <div className="absolute inset-0 z-50 bg-stone-900/40 backdrop-blur-sm flex items-center justify-center p-8 animate-in fade-in duration-300">
                  <div className="bg-white w-full max-w-5xl rounded-[2.5rem] shadow-2xl p-10 flex flex-col gap-8 max-h-full overflow-y-auto">
                    <div className="flex justify-between items-center border-b border-stone-100 pb-6">
                      <div className="space-y-1">
                        <h5 className="text-2xl font-bold serif text-stone-800 flex items-center gap-3">
                          <Sparkles size={24} className="text-amber-400" /> AI 創作建議
                        </h5>
                        <p className="text-sm text-stone-400">根據您的需求，我們構思了三種不同的表達策略：</p>
                      </div>
                      <button onClick={() => setRefineSuggestions(null)} className="w-10 h-10 flex items-center justify-center rounded-full bg-stone-50 text-stone-400 hover:bg-stone-100 hover:text-stone-900 transition-all"><X size={20}/></button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1">
                      {refineSuggestions.map((s, idx) => (
                        <div key={idx} className="group flex flex-col bg-stone-50 hover:bg-white hover:ring-2 hover:ring-stone-900 transition-all duration-300 rounded-[2rem] border border-stone-100 overflow-hidden shadow-sm">
                          <div className="bg-stone-900/5 px-6 py-4 border-b border-stone-100 group-hover:bg-stone-900 transition-colors">
                            <span className="text-[10px] font-black uppercase tracking-widest text-stone-400 group-hover:text-stone-500">規劃策略 {idx + 1}</span>
                            <p className="text-xs font-bold text-stone-700 mt-1 line-clamp-2 group-hover:text-white">{s.plan}</p>
                          </div>
                          <div className="p-6 flex-1">
                            <p className="text-sm leading-relaxed text-stone-600 italic whitespace-pre-wrap">{s.content}</p>
                          </div>
                          <div className="p-6 pt-0 mt-auto">
                            <button 
                              onClick={() => applySuggestion(s)}
                              className="w-full py-3.5 bg-white text-stone-900 font-bold text-xs rounded-2xl border border-stone-200 group-hover:bg-stone-900 group-hover:text-white group-hover:border-stone-900 transition-all shadow-sm active:scale-95 flex items-center justify-center gap-2"
                            >
                              <Check size={16} /> 套用此文案
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex-1 p-10 overflow-y-auto space-y-8 scroll-smooth">
                <input value={activePara.title} onChange={e => updateActivePara({title: e.target.value})} className="w-full text-4xl font-bold serif outline-none bg-transparent" style={{color: activePara.color, fontFamily: activePara.fontFamily}} placeholder="區塊標題..." />
                <textarea value={activePara.content} onChange={e => updateActivePara({content: e.target.value, status: 'draft'})} className="w-full h-1/2 text-lg leading-relaxed outline-none resize-none bg-transparent" style={{color: activePara.color, fontFamily: activePara.fontFamily, fontSize: activePara.fontSize}} placeholder="內容撰寫..." />
                {activePara.uploadedImage && (
                  <div className="relative group max-w-xl mx-auto rounded-[2rem] overflow-hidden shadow-2xl border border-stone-50">
                    <img src={activePara.uploadedImage} alt="Para Visual" className="w-full h-auto" />
                    <button onClick={() => updateActivePara({uploadedImage: undefined})} className="absolute top-4 right-4 bg-black/50 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><X size={16} /></button>
                  </div>
                )}
                {isGeneratingImg && (
                  <div className="p-20 border-2 border-dashed border-stone-100 rounded-[2rem] flex flex-col items-center justify-center space-y-6 animate-pulse bg-stone-50/30">
                    <div className="relative w-16 h-16">
                      <Loader2 className="animate-spin text-stone-400 absolute inset-0" size={64}/>
                      <Sparkles className="text-amber-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" size={24} />
                    </div>
                    <div className="space-y-2 text-center">
                      <p className="text-sm font-bold text-stone-500 uppercase tracking-widest">{imageProgress || '構思影像中...'}</p>
                      <div className="w-48 h-1 bg-stone-100 rounded-full overflow-hidden mx-auto">
                        <div className="h-full bg-stone-900 animate-[loading_10s_ease-in-out_infinite]" style={{width: '60%'}}></div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-stone-200 gap-4">
              <MousePointer2 size={48} />
              <p className="text-xs font-bold uppercase tracking-widest">請點選左側區塊開始編輯</p>
            </div>
          )}
        </div>

        <div className="w-80 space-y-6">
          <div className="bg-white rounded-[2rem] border border-stone-100 p-8 shadow-sm space-y-8 h-full overflow-y-auto">
            <h4 className="text-[10px] font-bold flex items-center gap-2 border-b border-stone-50 pb-4 uppercase tracking-widest">
              <Sparkles size={14} className="text-amber-400"/> AI 創作引導
            </h4>
            
            {/* Step 1: 文案風格 */}
            <div className={`space-y-4 transition-all duration-300 p-4 rounded-2xl ${activeStep === 1 ? 'bg-stone-900 text-white shadow-xl ring-4 ring-stone-900/10' : 'bg-stone-50 opacity-60'}`} onClick={() => setActiveStep(1)}>
              <div className="flex items-center gap-3">
                <div className={`w-7 h-7 ${activeStep === 1 ? 'bg-white text-stone-900' : 'bg-stone-300 text-white'} rounded-lg flex items-center justify-center font-black text-xs`}>1</div>
                <div className="text-xs font-bold">文案風格</div>
              </div>
              <div className="pl-10 grid grid-cols-1 gap-2">
                {['渲染氛圍', '增強實用性', '美食誘惑'].map(opt => (
                  <button 
                    key={opt} 
                    onClick={(e) => { e.stopPropagation(); handleRefine(opt); }} 
                    disabled={isRefining || !activeParaId}
                    className={`text-[10px] font-bold px-4 py-3 rounded-xl transition-all text-left shadow-sm flex items-center justify-between group ${activeStep === 1 ? 'bg-white/10 hover:bg-white text-white hover:text-stone-900' : 'bg-white text-stone-500 hover:bg-stone-900 hover:text-white'}`}
                  >
                    <span>{opt}</span>
                    {isRefining ? <Loader2 size={12} className="animate-spin"/> : <ChevronRight size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Step 2 */}
            <div className={`space-y-4 pt-6 border-t border-stone-50 transition-all duration-300 p-4 rounded-2xl ${activeStep === 2 ? 'bg-stone-900 text-white shadow-xl ring-4 ring-stone-900/10' : 'bg-stone-50 opacity-60'}`} onClick={() => setActiveStep(2)}>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className={`w-7 h-7 ${activeStep === 2 ? 'bg-white text-stone-900' : 'bg-stone-300 text-white'} rounded-lg flex items-center justify-center font-black text-xs`}>2</div>
                  <div className="text-xs font-bold">繪圖提示詞</div>
                </div>
                <button onClick={(e) => { e.stopPropagation(); setShowHistory(!showHistory); }} className={`p-1.5 rounded-lg transition-colors ${showHistory ? 'bg-white text-stone-900' : 'text-stone-400 hover:text-white'}`}><History size={14}/></button>
              </div>
              <div className="pl-10 space-y-4">
                {showHistory ? (
                  <div className="max-h-32 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                    {activePara?.promptHistory?.map((h, i) => (
                      <button key={i} onClick={(e) => { e.stopPropagation(); updateActivePara({imagePrompt: h}); }} className="w-full text-left p-3 bg-white/5 border border-white/10 rounded-xl text-[9px] text-white/50 hover:text-white hover:bg-white/10 line-clamp-2 transition-all">{h}</button>
                    ))}
                    {(!activePara?.promptHistory || activePara.promptHistory.length === 0) && <p className="text-[10px] text-stone-500 italic text-center py-4">尚無紀錄</p>}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <textarea 
                      value={activePara?.imagePrompt || ''} 
                      onChange={e => updateActivePara({imagePrompt: e.target.value})} 
                      disabled={!activeParaId}
                      className={`w-full h-28 p-4 rounded-2xl text-[10px] italic outline-none resize-none transition-all shadow-inner border ${activeStep === 2 ? 'bg-white/5 border-white/10 text-white placeholder-white/30' : 'bg-white border-stone-200 text-stone-900'}`} 
                      placeholder="點擊下方按鈕由 AI 生成描述..."
                    />
                    
                    <button 
                      onClick={(e) => { e.stopPropagation(); handlePromptGen(); }} 
                      disabled={!activeParaId || isGeneratingPrompt}
                      className={`w-full py-4 rounded-2xl text-[10px] font-black flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg border border-transparent ${activeStep === 2 ? 'bg-amber-400 text-stone-900 hover:bg-amber-300' : 'bg-stone-900 text-white hover:bg-stone-800'}`}
                    >
                      {isGeneratingPrompt ? <Loader2 size={14} className="animate-spin" /> : <Cpu size={14} />}
                      {isGeneratingPrompt ? '解析文中...' : activePara?.imagePrompt ? '重新生成 AI 描述' : '點我生成 AI 提示詞'}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Step 3 */}
            <div className={`space-y-4 pt-6 border-t border-stone-50 transition-all duration-300 p-4 rounded-2xl ${activeStep === 3 ? 'bg-stone-900 text-white shadow-xl ring-4 ring-stone-900/10' : 'bg-stone-50 opacity-60'}`} onClick={() => setActiveStep(3)}>
              <div className="flex items-center gap-3">
                <div className={`w-7 h-7 ${activeStep === 3 ? 'bg-white text-stone-900' : 'bg-stone-300 text-white'} rounded-lg flex items-center justify-center font-black text-xs`}>3</div>
                <div className="text-xs font-bold">視覺具象化</div>
              </div>
              <div className="pl-10 space-y-4">
                <div className={`flex gap-1 p-1 rounded-xl border ${activeStep === 3 ? 'bg-white/5 border-white/10' : 'bg-white border-stone-100'}`}>
                  <button onClick={(e) => { e.stopPropagation(); setImgModel('gemini-2.5-flash-image'); }} className={`flex-1 py-2.5 text-[9px] font-black rounded-lg transition-all ${imgModel === 'gemini-2.5-flash-image' ? 'bg-white text-stone-900 shadow-md' : 'text-stone-400'}`}>高效模型</button>
                  <button onClick={(e) => { e.stopPropagation(); setImgModel('gemini-3-pro-image-preview'); }} className={`flex-1 py-2.5 text-[9px] font-black rounded-lg transition-all ${imgModel === 'gemini-3-pro-image-preview' ? 'bg-white text-stone-900 shadow-md' : 'text-stone-400'}`}>大師 4K</button>
                </div>
                <div className="space-y-2">
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleGenerateAIImage(); }} 
                    disabled={isGeneratingImg || !activePara?.imagePrompt} 
                    className={`w-full py-5 rounded-[1.5rem] text-[11px] font-black shadow-xl transition-all active:scale-95 flex flex-col items-center justify-center gap-1 border-b-4 ${activeStep === 3 ? 'bg-white text-stone-900 hover:bg-stone-50 border-stone-200' : 'bg-stone-900 text-white hover:bg-stone-800 border-black'}`}
                  >
                    {isGeneratingImg ? (
                      <>
                        <Loader2 size={16} className="animate-spin mb-1" />
                        <span className="text-[9px] uppercase tracking-widest text-stone-400">{imageProgress || '處理中...'}</span>
                      </>
                    ) : (
                      <>
                        <ImageIcon size={18} className="mb-0.5" />
                        <span>立即生成視覺影像</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="text-center">
                  <input type="file" ref={fileInputRef} onChange={handleImageUpload} className="hidden" />
                  <button onClick={(e) => { e.stopPropagation(); setActiveStep(3); fileInputRef.current?.click(); }} className={`text-[10px] font-bold underline transition-colors ${activeStep === 3 ? 'text-white/40 hover:text-white' : 'text-stone-300 hover:text-stone-500'}`}>手動上傳參考圖</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div id="print-section" className="hidden print:block bg-white text-stone-900">
        <header className="mb-20 text-center">
          <h1 className="text-5xl font-bold serif mb-4">{editedProject.title}</h1>
          <p className="text-stone-400 uppercase tracking-widest text-sm">{editedProject.destination}</p>
        </header>
        {editedProject.paragraphs.map((p, idx) => (
          <section key={p.id} className="mb-24 space-y-8">
            <div className="space-y-4">
              <h2 className="text-3xl font-bold serif" style={{color: p.color, fontFamily: p.fontFamily}}>
                <span className="text-stone-200 mr-4 font-light italic">0{idx + 1}</span> {p.title}
              </h2>
              <p className="text-lg leading-loose whitespace-pre-wrap" style={{color: p.color, fontFamily: p.fontFamily, fontSize: p.fontSize}}>
                {p.content}
              </p>
            </div>
            {p.uploadedImage && (
              <div className="w-full">
                <img src={p.uploadedImage} alt={p.title} className="max-w-full h-auto rounded-3xl" />
              </div>
            )}
          </section>
        ))}
        <footer className="mt-20 pt-10 border-t border-stone-100 text-center text-xs text-stone-300 uppercase tracking-[0.2em]">
          TravelMuse AI Marketing Asset • Generated for {editedProject.destination}
        </footer>
      </div>

      {isPreviewOpen && (
        <div className="fixed inset-0 z-[200] bg-stone-950/90 backdrop-blur-md flex items-center justify-center p-4 md:p-12 overflow-y-auto" onClick={() => setIsPreviewOpen(false)}>
          <button className="fixed top-8 right-8 bg-white text-black px-8 py-4 rounded-full font-black shadow-2xl z-50 hover:scale-105 transition-transform" onClick={() => setIsPreviewOpen(false)}>
            <LogOut size={16} className="inline mr-2" /> EXIT PREVIEW
          </button>
          <div className="bg-white w-full max-w-5xl min-h-[90vh] rounded-[3rem] p-8 md:p-24 space-y-32 cursor-default animate-in slide-in-from-bottom-8 duration-500" onClick={e => e.stopPropagation()}>
             <header className="text-center space-y-10">
               <h1 className="text-6xl md:text-8xl font-bold serif leading-tight">{editedProject.title}</h1>
               <p className="text-stone-400 tracking-[0.5em] text-sm font-bold uppercase">{editedProject.destination}</p>
             </header>
             <div className="space-y-48">
               {editedProject.paragraphs.map((p, idx) => (
                 <section key={p.id} className={`flex flex-col md:flex-row gap-16 md:gap-32 items-start ${idx % 2 !== 0 ? 'md:flex-row-reverse' : ''}`}>
                   <div className="flex-1 space-y-10">
                     <div className="flex items-center gap-4">
                        <span className="text-6xl font-light text-stone-100 italic serif">0{idx + 1}</span>
                        <h2 className="text-4xl font-bold serif" style={{color: p.color, fontFamily: p.fontFamily}}>{p.title}</h2>
                     </div>
                     <p className="text-xl md:text-2xl text-stone-600 leading-[2.4]" style={{color: p.color, fontFamily: p.fontFamily, fontSize: p.fontSize}}>{p.content}</p>
                   </div>
                   {p.uploadedImage && (
                     <div className="flex-1 w-full">
                       <img src={p.uploadedImage} className="w-full rounded-[2rem] shadow-2xl border border-stone-100" alt={p.title} />
                     </div>
                   )}
                 </section>
               ))}
             </div>
             <footer className="pt-24 text-center border-t border-stone-100">
               <p className="text-xs text-stone-300 font-bold uppercase tracking-[0.3em]">Cinematic Travel Content Engine • TM2026</p>
             </footer>
          </div>
        </div>
      )}
    </div>
  );
};

export default Editor;