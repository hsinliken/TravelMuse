import React, { useState, useRef, useEffect } from 'react';
import { Project, Paragraph, CustomFont } from '../types';
import { refineParagraph, analyzeImage, generateImagePrompt, generateAIImage } from '../services/gemini';
import { 
  ArrowLeft, Save, Globe, Image as ImageIcon, 
  Sparkles, Loader2, CheckCircle, ChevronRight,
  RefreshCw, Type as TypeIcon, Palette as PaletteIcon, X,
  CaseSensitive, Eye, Wand2, LogOut, ChevronUp, ChevronDown, 
  History, Zap, MousePointer2
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
  const [isGeneratingImg, setIsGeneratingImg] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [editedProject, setEditedProject] = useState<Project>(project);
  const [imgModel, setImgModel] = useState<'gemini-2.5-flash-image' | 'gemini-3-pro-image-preview'>('gemini-2.5-flash-image');
  const [showHistory, setShowHistory] = useState(false);
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

  const handleRefine = async (focus: string) => {
    if (!activePara) return;
    setIsRefining(true);
    try {
      const refined = await refineParagraph(activePara.content, focus, editedProject.templateId || '高端');
      updateActivePara({ content: refined || activePara.content, status: 'refined' });
    } catch (e) {
      console.error(e);
      alert("文案優化失敗，請檢查網路連線。");
    } finally {
      setIsRefining(false);
    }
  };

  const handleGenerateAIImage = async () => {
    if (!activePara || !activePara.imagePrompt) return;
    
    if (imgModel.includes('pro') && window.aistudio) {
      if (!(await window.aistudio.hasSelectedApiKey())) {
        await window.aistudio.openSelectKey();
      }
    }

    setIsGeneratingImg(true);
    try {
      const imgUrl = await generateAIImage(activePara.imagePrompt, imgModel);
      if (imgUrl) {
        updateActivePara({ 
          uploadedImage: imgUrl, 
          promptHistory: [activePara.imagePrompt, ...(activePara.promptHistory || [])].slice(0, 10) 
        });
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
    finally { setIsGeneratingImg(false); }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      updateActivePara({ uploadedImage: base64 });
      try {
        await analyzeImage(base64); // Silent analysis
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
      <div className="flex items-center justify-between mb-4">
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
          <button className="bg-stone-900 text-white px-6 py-2 rounded-full font-bold hover:bg-stone-800 transition-all shadow-md">發佈</button>
        </div>
      </div>

      <div className="flex-1 flex gap-6 min-h-0">
        {/* 左側結構與排序 */}
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

        {/* 中間主編輯區 */}
        <div className="flex-1 flex flex-col bg-white rounded-[2rem] border border-stone-100 shadow-sm overflow-hidden">
          {activePara ? (
            <div className="flex flex-col h-full">
              {/* 樣式工具列 */}
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
                  <div className="p-20 border-2 border-dashed border-stone-100 rounded-[2rem] flex flex-col items-center justify-center space-y-4 animate-pulse bg-stone-50/30">
                    <Loader2 className="animate-spin text-stone-200" size={48}/>
                    <p className="text-xs font-bold text-stone-300 uppercase tracking-widest">影像生成中...</p>
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

        {/* 右側 1-2-3 AI 面板 */}
        <div className="w-80 space-y-6">
          <div className="bg-white rounded-[2rem] border border-stone-100 p-8 shadow-sm space-y-8">
            <h4 className="text-[10px] font-bold flex items-center gap-2 border-b border-stone-50 pb-4 uppercase tracking-widest">
              <Sparkles size={14} className="text-amber-400"/> AI 創作引導
            </h4>
            
            {/* Step 1 */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 bg-black text-white rounded-lg flex items-center justify-center font-black text-xs">1</div>
                <div className="text-xs font-bold">文案拋光</div>
              </div>
              <div className="pl-10 grid grid-cols-1 gap-2">
                {['渲染氛圍', '增強實用性', '美食誘惑'].map(opt => (
                  <button 
                    key={opt} 
                    onClick={() => handleRefine(opt)} 
                    disabled={isRefining || !activeParaId}
                    className="text-[10px] font-bold text-stone-500 bg-stone-50 hover:bg-black hover:text-white px-4 py-2 rounded-xl transition-all text-left disabled:opacity-30"
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            {/* Step 2 */}
            <div className="space-y-4 pt-6 border-t border-stone-50">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 bg-black text-white rounded-lg flex items-center justify-center font-black text-xs">2</div>
                  <div className="text-xs font-bold">繪圖提示詞</div>
                </div>
                <button onClick={() => setShowHistory(!showHistory)} className={`p-1.5 rounded-lg transition-colors ${showHistory ? 'bg-black text-white' : 'text-stone-300 hover:text-black'}`}><History size={14}/></button>
              </div>
              <div className="pl-10 space-y-3">
                {showHistory ? (
                  <div className="max-h-32 overflow-y-auto space-y-2 pr-1">
                    {activePara?.promptHistory?.map((h, i) => (
                      <button key={i} onClick={() => updateActivePara({imagePrompt: h})} className="w-full text-left p-2 bg-stone-50 rounded-lg text-[9px] text-stone-400 hover:text-black line-clamp-2 transition-colors">{h}</button>
                    ))}
                    {(!activePara?.promptHistory || activePara.promptHistory.length === 0) && <p className="text-[10px] text-stone-300 italic text-center">無紀錄</p>}
                  </div>
                ) : (
                  <textarea 
                    value={activePara?.imagePrompt || ''} 
                    onChange={e => updateActivePara({imagePrompt: e.target.value})} 
                    disabled={!activeParaId}
                    className="w-full h-24 p-3 bg-stone-50 rounded-xl text-[10px] italic outline-none border border-transparent focus:border-stone-900 resize-none transition-all disabled:opacity-30" 
                    placeholder="輸入或由 AI 生成..."
                  />
                )}
                <button 
                  onClick={async () => {
                    const p = await generateImagePrompt(activePara?.content || '');
                    updateActivePara({imagePrompt: p});
                  }} 
                  disabled={!activeParaId || isRefining}
                  className="w-full text-[9px] font-bold text-stone-300 hover:text-black flex items-center justify-center gap-1 uppercase tracking-tighter disabled:opacity-30 transition-colors"
                >
                  <RefreshCw size={10}/> 重新 AI 建議
                </button>
              </div>
            </div>

            {/* Step 3 */}
            <div className="space-y-4 pt-6 border-t border-stone-50">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 bg-black text-white rounded-lg flex items-center justify-center font-black text-xs">3</div>
                <div className="text-xs font-bold">影像生成</div>
              </div>
              <div className="pl-10 space-y-4">
                <div className="flex gap-2 bg-stone-50 p-1 rounded-xl">
                  <button onClick={() => setImgModel('gemini-2.5-flash-image')} className={`flex-1 py-2 text-[9px] font-bold rounded-lg transition-all ${imgModel === 'gemini-2.5-flash-image' ? 'bg-white shadow-sm text-black' : 'text-stone-300'}`}>極速</button>
                  <button onClick={() => setImgModel('gemini-3-pro-image-preview')} className={`flex-1 py-2 text-[9px] font-bold rounded-lg transition-all ${imgModel === 'gemini-3-pro-image-preview' ? 'bg-white shadow-sm text-black' : 'text-stone-300'}`}>高品質</button>
                </div>
                <button 
                  onClick={handleGenerateAIImage} 
                  disabled={isGeneratingImg || !activePara?.imagePrompt} 
                  className="w-full bg-black text-white py-4 rounded-2xl text-[11px] font-black shadow-lg hover:bg-stone-800 disabled:opacity-10 transition-all active:scale-95"
                >
                  立即生成影像
                </button>
                <div className="text-center">
                  <input type="file" ref={fileInputRef} onChange={handleImageUpload} className="hidden" />
                  <button onClick={() => fileInputRef.current?.click()} className="text-[10px] font-bold text-stone-300 hover:text-stone-500 underline transition-colors">或手動上傳</button>
                </div>
              </div>
            </div>
          </div>
        </div>
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