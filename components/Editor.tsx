
import React, { useState, useRef, useEffect } from 'react';
import { Project, Paragraph, ToneType, CustomFont } from '../types';
import { refineParagraph, analyzeImage, generateImagePrompt, generateAIImage } from '../services/gemini';
import { 
  ArrowLeft, Save, Globe, Image as ImageIcon, 
  Sparkles, MessageSquare, Loader2, CheckCircle, ChevronRight,
  RefreshCw, Layers, Type as TypeIcon, Palette as PaletteIcon, X,
  CaseSensitive, Send, Eye, Wand2, LogOut, ChevronUp, ChevronDown, 
  History, Settings2, Zap, Palette, Type, MousePointer2
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
  const [customRefineInput, setCustomRefineInput] = useState('');
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

  const handleRefine = async (focus: string) => {
    if (!activePara) return;
    setIsRefining(true);
    try {
      const tone = editedProject.templateId || '高端行銷';
      const refined = await refineParagraph(activePara.content, focus, tone);
      updateActivePara({ content: refined || activePara.content, status: 'refined' as const });
      setCustomRefineInput('');
    } catch (e) { console.error(e); } finally { setIsRefining(false); }
  };

  const handleGenerateAIImage = async () => {
    if (!activePara || !activePara.imagePrompt) return;

    if (imgModel.includes('pro') && window.aistudio) {
      const hasKey = await window.aistudio.hasSelectedApiKey();
      if (!hasKey) await window.aistudio.openSelectKey();
    }

    setIsGeneratingImg(true);
    try {
      const imgUrl = await generateAIImage(activePara.imagePrompt, imgModel);
      if (imgUrl) {
        const history = activePara.promptHistory || [];
        updateActivePara({ 
          uploadedImage: imgUrl, 
          promptHistory: [activePara.imagePrompt, ...history].slice(0, 10) 
        });
      }
    } catch (e) {
      console.error(e);
      alert("生成失敗，請更換模型或稍後再試。若持續失敗，可能是 API 配額問題或提示詞過於敏感。");
    } finally { setIsGeneratingImg(false); }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeParaId) return;
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      setIsRefining(true);
      try {
        const analysis = await analyzeImage(base64);
        const prompt = await generateImagePrompt(activePara?.content || '');
        updateActivePara({ uploadedImage: base64, imagePrompt: prompt || activePara?.imagePrompt });
      } catch (e) { console.error(e); } finally { setIsRefining(false); }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => { onSave(editedProject); setIsSaving(false); }, 800);
  };

  const fonts = [
    { name: '系統預設', value: 'inherit' },
    { name: '思源宋體', value: "'Noto Serif TC', serif" },
    { name: '思源黑體', value: "'Inter', sans-serif" },
    ...customFonts.map(f => ({ name: f.name, value: f.name }))
  ];

  const fontSizes = [
    { name: '14px', value: '0.875rem' },
    { name: '16px', value: '1rem' },
    { name: '18px', value: '1.125rem' },
    { name: '20px', value: '1.25rem' },
    { name: '24px', value: '1.5rem' },
    { name: '32px', value: '2rem' }
  ];

  const colors = [
    { name: '石炭黑', value: '#1c1917' },
    { name: '海軍藍', value: '#1e3a8a' },
    { name: '典雅綠', value: '#064e3b' },
    { name: '夕陽紅', value: '#991b1b' },
    { name: '石板灰', value: '#4b5563' },
    { name: '黃金棕', value: '#92400e' }
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] animate-in fade-in duration-500">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-xl font-bold serif text-stone-800">{editedProject.title}</h2>
            <div className="flex items-center gap-2 text-[10px] text-stone-400 font-bold uppercase tracking-widest">
              {editedProject.destination} • {editedProject.paragraphs.length} 個區塊
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setIsPreviewOpen(true)} className="flex items-center gap-2 text-stone-600 hover:text-stone-900 font-bold px-4 py-2 text-sm">
            <Eye size={16} /> 預覽
          </button>
          <button onClick={handleSave} disabled={isSaving} className="flex items-center gap-2 text-stone-600 hover:text-stone-900 font-bold px-4 py-2 text-sm">
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} 儲存
          </button>
          <button className="flex items-center gap-2 bg-stone-900 text-white px-5 py-2 rounded-full text-sm font-bold hover:bg-stone-800 transition-all shadow-md">
            <Globe size={16} /> 發佈
          </button>
        </div>
      </div>

      <div className="flex-1 flex gap-6 min-h-0">
        {/* 左側：結構導航與排序 */}
        <div className="w-60 overflow-y-auto space-y-3 pr-2 border-r border-stone-100">
          <p className="text-[10px] font-bold text-stone-400 uppercase tracking-tighter mb-4">文案架構</p>
          {editedProject.paragraphs.map((p, idx) => (
            <div key={p.id} className="relative group/card">
              <button
                onClick={() => setActiveParaId(p.id)}
                className={`w-full text-left p-4 rounded-2xl border transition-all flex flex-col gap-2 ${activeParaId === p.id ? 'border-stone-900 bg-stone-900 text-white shadow-lg' : 'border-stone-100 bg-white hover:border-stone-300 shadow-sm'}`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-bold uppercase ${activeParaId === p.id ? 'text-stone-400' : 'text-stone-300'}`}>0{idx+1}</span>
                  {p.status === 'refined' && <CheckCircle size={12} className="text-emerald-400" />}
                </div>
                <span className="font-bold text-xs truncate">{p.title}</span>
              </button>
              
              <div className="absolute -right-2 top-1/2 -translate-y-1/2 flex flex-col gap-1 opacity-0 group-hover/card:opacity-100 transition-opacity">
                <button 
                  onClick={(e) => { e.stopPropagation(); moveSection(idx, 'up'); }}
                  disabled={idx === 0}
                  className="p-1 bg-white border border-stone-200 rounded-full shadow-sm hover:bg-stone-50 disabled:opacity-30"
                >
                  <ChevronUp size={12} />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); moveSection(idx, 'down'); }}
                  disabled={idx === editedProject.paragraphs.length - 1}
                  className="p-1 bg-white border border-stone-200 rounded-full shadow-sm hover:bg-stone-50 disabled:opacity-30"
                >
                  <ChevronDown size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* 中間：編輯器與樣式控制 */}
        <div className="flex-1 flex flex-col bg-white rounded-3xl border border-stone-100 overflow-hidden shadow-sm">
          {activePara ? (
            <div className="flex flex-col h-full">
              {/* 樣式工具列 */}
              <div className="px-6 py-3 border-b border-stone-100 flex items-center gap-6 bg-stone-50/50">
                <div className="flex items-center gap-2 shrink-0">
                  <Type size={14} className="text-stone-400" />
                  <select 
                    value={activePara.fontFamily || 'inherit'}
                    onChange={(e) => updateActivePara({ fontFamily: e.target.value })}
                    className="text-xs font-bold bg-transparent outline-none cursor-pointer"
                  >
                    {fonts.map(f => <option key={f.value} value={f.value}>{f.name}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <CaseSensitive size={14} className="text-stone-400" />
                  <select 
                    value={activePara.fontSize || '1.125rem'}
                    onChange={(e) => updateActivePara({ fontSize: e.target.value })}
                    className="text-xs font-bold bg-transparent outline-none cursor-pointer"
                  >
                    {fontSizes.map(s => <option key={s.value} value={s.value}>{s.name}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Palette size={14} className="text-stone-400" />
                  <div className="flex gap-1">
                    {colors.map(c => (
                      <button 
                        key={c.value}
                        onClick={() => updateActivePara({ color: c.value })}
                        className={`w-4 h-4 rounded-full border border-white ring-1 transition-all ${activePara.color === c.value ? 'ring-stone-900 scale-110' : 'ring-transparent'}`}
                        style={{ backgroundColor: c.value }}
                      />
                    ))}
                    <button onClick={() => updateActivePara({ color: undefined })} className="w-4 h-4 rounded-full border border-stone-200 bg-white text-[8px] flex items-center justify-center">X</button>
                  </div>
                </div>
              </div>
              
              <div className="flex-1 p-10 overflow-y-auto space-y-8">
                <input 
                  type="text"
                  value={activePara.title}
                  onChange={(e) => updateActivePara({ title: e.target.value })}
                  className="w-full text-4xl font-bold serif text-stone-900 outline-none placeholder:text-stone-200"
                  placeholder="輸入標題..."
                  style={{ color: activePara.color, fontFamily: activePara.fontFamily }}
                />
                <textarea 
                  value={activePara.content}
                  onChange={(e) => updateActivePara({ content: e.target.value, status: 'draft' })}
                  className="w-full h-2/3 leading-relaxed outline-none resize-none placeholder:text-stone-200"
                  placeholder="在此開始撰寫文案內容..."
                  style={{ color: activePara.color, fontFamily: activePara.fontFamily, fontSize: activePara.fontSize || '1.125rem' }}
                />

                {activePara.uploadedImage && (
                  <div className="relative group rounded-[2rem] overflow-hidden border border-stone-100 max-w-2xl mx-auto shadow-2xl">
                    <img src={activePara.uploadedImage} alt="Visual" className="w-full h-auto" />
                    <button onClick={() => updateActivePara({ uploadedImage: undefined })} className="absolute top-6 right-6 bg-black/50 text-white p-3 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                      <X size={20} />
                    </button>
                  </div>
                )}
                
                {isGeneratingImg && (
                  <div className="flex flex-col items-center justify-center p-16 border-2 border-dashed border-stone-100 rounded-[2rem] space-y-4 bg-stone-50/50">
                    <div className="relative">
                       <Loader2 size={48} className="text-stone-300 animate-spin" />
                       <ImageIcon size={20} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-stone-400" />
                    </div>
                    <p className="text-stone-400 font-bold text-sm tracking-widest uppercase">
                      {imgModel.includes('flash') ? '極速繪圖中' : '高品質渲染中'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-stone-300 space-y-4">
              <MousePointer2 size={48} />
              <p className="font-bold uppercase tracking-widest text-xs">請選擇一個區塊進行創作</p>
            </div>
          )}
        </div>

        {/* 右側：AI 流程面板 (1-2-3 步驟) */}
        <div className="w-80 flex flex-col gap-6 overflow-y-auto pb-6">
          <div className="bg-white rounded-3xl border border-stone-100 p-6 shadow-sm space-y-6">
            <h4 className="text-xs font-bold text-stone-900 uppercase tracking-widest flex items-center gap-2 border-b border-stone-50 pb-4">
              <Sparkles size={14} /> AI 創作流程
            </h4>

            {/* Step 1: 文字優化 */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-stone-900 text-white text-[10px] flex items-center justify-center font-bold">1</span>
                <span className="text-xs font-bold text-stone-700">優化文案內容</span>
              </div>
              <div className="grid grid-cols-1 gap-2 pl-7">
                {['渲染氛圍', '增強實用性', '美食誘惑'].map(opt => (
                  <button key={opt} onClick={() => handleRefine(opt)} className="w-full text-left px-3 py-2 rounded-xl border border-stone-50 hover:border-stone-900 bg-stone-50/30 hover:bg-white transition-all text-[11px] font-bold text-stone-500 hover:text-stone-900">
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            {/* Step 2: 繪圖指令 */}
            <div className="space-y-3 pt-4 border-t border-stone-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-stone-900 text-white text-[10px] flex items-center justify-center font-bold">2</span>
                  <span className="text-xs font-bold text-stone-700">調整繪圖提示詞</span>
                </div>
                <button 
                  onClick={() => setShowHistory(!showHistory)}
                  className={`p-1.5 rounded-lg transition-colors ${showHistory ? 'bg-stone-900 text-white' : 'text-stone-300 hover:text-stone-900'}`}
                >
                  <History size={14} />
                </button>
              </div>
              
              <div className="pl-7 space-y-3">
                {showHistory ? (
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {activePara?.promptHistory?.map((h, i) => (
                      <button key={i} onClick={() => updateActivePara({ imagePrompt: h })} className="w-full text-left p-2 bg-stone-50 rounded-lg text-[9px] text-stone-400 border border-transparent hover:border-stone-900 line-clamp-2">{h}</button>
                    ))}
                    {(!activePara?.promptHistory || activePara.promptHistory.length === 0) && <p className="text-[10px] text-stone-300 italic">無紀錄</p>}
                  </div>
                ) : (
                  <>
                    <textarea 
                      value={activePara?.imagePrompt || ''}
                      onChange={(e) => updateActivePara({ imagePrompt: e.target.value })}
                      className="w-full h-24 p-3 bg-stone-50 border border-stone-100 rounded-xl text-[11px] italic text-stone-600 outline-none focus:border-stone-900 resize-none transition-all"
                      placeholder="等待 AI 建議指令..."
                    />
                    <button 
                      onClick={async () => {
                        const newPrompt = await generateImagePrompt(activePara?.content || '');
                        updateActivePara({ imagePrompt: newPrompt });
                      }}
                      className="text-[10px] font-bold text-stone-400 hover:text-stone-900 flex items-center gap-1 mx-auto"
                    >
                      <RefreshCw size={10} /> 重新 AI 建議
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Step 3: 影像生成 */}
            <div className="space-y-4 pt-4 border-t border-stone-50">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-stone-900 text-white text-[10px] flex items-center justify-center font-bold">3</span>
                <span className="text-xs font-bold text-stone-700">選擇模型並生成</span>
              </div>
              
              <div className="pl-7 space-y-4">
                <div className="flex items-center gap-2 bg-stone-50 p-1 rounded-xl">
                  <button 
                    onClick={() => setImgModel('gemini-2.5-flash-image')}
                    className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-[10px] font-bold transition-all ${imgModel === 'gemini-2.5-flash-image' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-400 hover:text-stone-600'}`}
                  >
                    <Zap size={10} /> 極速
                  </button>
                  <button 
                    onClick={() => setImgModel('gemini-3-pro-image-preview')}
                    className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-[10px] font-bold transition-all ${imgModel === 'gemini-3-pro-image-preview' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-400 hover:text-stone-600'}`}
                  >
                    <Sparkles size={10} /> 高品質
                  </button>
                </div>
                
                <button 
                  onClick={handleGenerateAIImage} 
                  disabled={isGeneratingImg || !activePara?.imagePrompt} 
                  className="w-full bg-stone-900 text-white py-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-stone-800 disabled:opacity-20 transition-all shadow-lg shadow-stone-100"
                >
                  {isGeneratingImg ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />}
                  立即生成影像
                </button>
                <div className="flex items-center gap-2 justify-center">
                  <input type="file" ref={fileInputRef} onChange={handleImageUpload} className="hidden" />
                  <button onClick={() => fileInputRef.current?.click()} className="text-[10px] font-bold text-stone-300 hover:text-stone-500">
                    或者手動上傳
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 預覽 Modal */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-[200] bg-stone-950/98 backdrop-blur-xl flex items-center justify-center p-0 md:p-8 overflow-y-auto cursor-pointer" onClick={() => setIsPreviewOpen(false)}>
          <button onClick={() => setIsPreviewOpen(false)} className="fixed top-8 right-8 flex items-center gap-3 px-8 py-4 bg-white text-stone-900 rounded-full font-bold shadow-2xl z-[250] hover:scale-105 active:scale-95 transition-all border border-stone-100">
            <LogOut size={20} /> 結束預覽
          </button>
          
          <div className="bg-white w-full max-w-5xl rounded-none md:rounded-[4rem] shadow-2xl min-h-screen md:min-h-[90vh] flex flex-col relative animate-in slide-in-from-bottom-12 duration-700 cursor-default" onClick={(e) => e.stopPropagation()}>
            <div className="flex-1 overflow-y-auto p-12 md:p-24 lg:p-32 space-y-40">
              <header className="text-center space-y-12">
                <h1 className="text-6xl md:text-8xl font-bold serif text-stone-900 leading-[1.1]">{editedProject.title}</h1>
                <p className="text-stone-400 uppercase tracking-[0.6em] text-xs font-bold">{editedProject.destination}</p>
                <div className="w-16 h-1 bg-stone-900 mx-auto rounded-full" />
              </header>

              <div className="space-y-64">
                {editedProject.paragraphs.map((p, idx) => (
                  <section key={p.id} className={`flex flex-col ${idx % 2 !== 0 ? 'md:flex-row-reverse' : 'md:flex-row'} gap-24 items-center md:items-start`}>
                    <div className="flex-1 space-y-12">
                      <div className="flex items-center gap-6">
                         <span className="text-7xl font-light text-stone-50 italic serif">0{idx + 1}</span>
                         <h2 className="text-4xl md:text-5xl font-bold serif text-stone-800 leading-tight" style={{ color: p.color, fontFamily: p.fontFamily }}>{p.title}</h2>
                      </div>
                      <p className="text-2xl text-stone-600 leading-[2.6] whitespace-pre-wrap font-medium" style={{ color: p.color, fontFamily: p.fontFamily, fontSize: p.fontSize }}>{p.content}</p>
                    </div>
                    {p.uploadedImage && (
                      <div className="flex-1 w-full"><img src={p.uploadedImage} className="w-full h-full object-cover rounded-[3rem] shadow-[0_40px_80px_rgba(0,0,0,0.1)] border border-stone-50" alt={p.title} /></div>
                    )}
                  </section>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Editor;
