
import React, { useState, useRef, useEffect } from 'react';
import { Project, Paragraph, ToneType, CustomFont } from '../types';
import { refineParagraph, analyzeImage, generateImagePrompt, generateAIImage } from '../services/gemini';
import { 
  ArrowLeft, Save, Globe, Image as ImageIcon, 
  Sparkles, MessageSquare, Loader2, CheckCircle, ChevronRight,
  RefreshCw, Layers, Type as TypeIcon, Palette as PaletteIcon, X,
  CaseSensitive, Send, Eye, Wand2, LogOut, ChevronUp, ChevronDown, 
  History, Settings2, Zap, Palette, Type, MousePointer2, AlignLeft
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
      alert("生成失敗。極速模型可能有流量限制，或提示詞違反安全政策。請嘗試切換模型。");
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
      <div className="flex items-center justify-between mb-4 px-2">
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
        <div className="w-56 overflow-y-auto space-y-2 pr-2 border-r border-stone-100">
          <p className="text-[10px] font-bold text-stone-400 uppercase tracking-tighter mb-4 pl-1">文案架構</p>
          {editedProject.paragraphs.map((p, idx) => (
            <div key={p.id} className="relative group/card">
              <button
                onClick={() => setActiveParaId(p.id)}
                className={`w-full text-left p-4 rounded-2xl border transition-all flex flex-col gap-1.5 ${activeParaId === p.id ? 'border-stone-900 bg-stone-900 text-white shadow-lg' : 'border-stone-100 bg-white hover:border-stone-300 shadow-sm'}`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-[9px] font-bold uppercase ${activeParaId === p.id ? 'text-stone-400' : 'text-stone-300'}`}>Part 0{idx+1}</span>
                  {p.status === 'refined' && <CheckCircle size={10} className="text-emerald-400" />}
                </div>
                <span className="font-bold text-xs truncate">{p.title}</span>
              </button>
              
              <div className="absolute -right-2 top-1/2 -translate-y-1/2 flex flex-col gap-1 opacity-0 group-hover/card:opacity-100 transition-opacity z-10">
                <button 
                  onClick={(e) => { e.stopPropagation(); moveSection(idx, 'up'); }}
                  disabled={idx === 0}
                  className="p-1 bg-white border border-stone-200 rounded-full shadow-lg hover:bg-stone-50 disabled:opacity-30"
                >
                  <ChevronUp size={14} />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); moveSection(idx, 'down'); }}
                  disabled={idx === editedProject.paragraphs.length - 1}
                  className="p-1 bg-white border border-stone-200 rounded-full shadow-lg hover:bg-stone-50 disabled:opacity-30"
                >
                  <ChevronDown size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* 中間：主編輯區與顯眼的字體控制欄 */}
        <div className="flex-1 flex flex-col bg-white rounded-[2.5rem] border border-stone-100 overflow-hidden shadow-sm relative">
          {activePara ? (
            <div className="flex flex-col h-full">
              {/* 強化的字體樣式工具列 - 確保始終可見 */}
              <div className="px-8 py-4 border-b border-stone-100 flex items-center gap-10 bg-stone-50/80 backdrop-blur-sm sticky top-0 z-20">
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] font-bold text-stone-400 uppercase tracking-widest">字體選擇</span>
                  <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-stone-200 shadow-sm">
                    <TypeIcon size={14} className="text-stone-400" />
                    <select 
                      value={activePara.fontFamily || 'inherit'}
                      onChange={(e) => updateActivePara({ fontFamily: e.target.value })}
                      className="text-xs font-bold bg-transparent outline-none cursor-pointer min-w-[100px]"
                    >
                      {fonts.map(f => <option key={f.value} value={f.value}>{f.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-[9px] font-bold text-stone-400 uppercase tracking-widest">文字大小</span>
                  <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-stone-200 shadow-sm">
                    <CaseSensitive size={14} className="text-stone-400" />
                    <select 
                      value={activePara.fontSize || '1.125rem'}
                      onChange={(e) => updateActivePara({ fontSize: e.target.value })}
                      className="text-xs font-bold bg-transparent outline-none cursor-pointer"
                    >
                      {fontSizes.map(s => <option key={s.value} value={s.value}>{s.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-[9px] font-bold text-stone-400 uppercase tracking-widest">品牌色彩</span>
                  <div className="flex items-center gap-3 bg-white px-4 py-1.5 rounded-xl border border-stone-200 shadow-sm">
                    <PaletteIcon size={14} className="text-stone-400" />
                    <div className="flex gap-2">
                      {colors.map(c => (
                        <button 
                          key={c.value}
                          onClick={() => updateActivePara({ color: c.value })}
                          className={`w-5 h-5 rounded-full border border-white ring-2 transition-all ${activePara.color === c.value ? 'ring-stone-900 scale-125' : 'ring-transparent'}`}
                          style={{ backgroundColor: c.value }}
                          title={c.name}
                        />
                      ))}
                      <button 
                        onClick={() => updateActivePara({ color: undefined })} 
                        className="w-5 h-5 rounded-full border border-stone-200 bg-white text-[10px] font-bold flex items-center justify-center text-stone-400 hover:text-stone-900"
                        title="重設顏色"
                      >
                        X
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex-1 p-12 overflow-y-auto space-y-8 scroll-smooth">
                <input 
                  type="text"
                  value={activePara.title}
                  onChange={(e) => updateActivePara({ title: e.target.value })}
                  className="w-full text-4xl font-bold serif text-stone-900 outline-none placeholder:text-stone-100 transition-all border-l-4 border-transparent focus:border-stone-900 pl-4"
                  placeholder="文案區塊標題..."
                  style={{ color: activePara.color, fontFamily: activePara.fontFamily }}
                />
                <textarea 
                  value={activePara.content}
                  onChange={(e) => updateActivePara({ content: e.target.value, status: 'draft' })}
                  className="w-full h-2/3 leading-relaxed outline-none resize-none placeholder:text-stone-100 pl-4"
                  placeholder="在此撰寫您的故事..."
                  style={{ 
                    color: activePara.color, 
                    fontFamily: activePara.fontFamily, 
                    fontSize: activePara.fontSize || '1.125rem' 
                  }}
                />

                {activePara.uploadedImage && (
                  <div className="relative group rounded-[3rem] overflow-hidden border border-stone-100 max-w-2xl mx-auto shadow-2xl transition-all hover:scale-[1.01]">
                    <img src={activePara.uploadedImage} alt="Content Visual" className="w-full h-auto" />
                    <button 
                      onClick={() => updateActivePara({ uploadedImage: undefined })} 
                      className="absolute top-6 right-6 bg-black/60 backdrop-blur-md text-white p-4 rounded-full opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500"
                    >
                      <X size={20} />
                    </button>
                  </div>
                )}
                
                {isGeneratingImg && (
                  <div className="flex flex-col items-center justify-center p-24 border-4 border-dashed border-stone-50 rounded-[4rem] space-y-6 bg-stone-50/30 animate-pulse">
                    <div className="relative">
                       <Loader2 size={64} className="text-stone-200 animate-spin" />
                       <ImageIcon size={24} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-stone-400" />
                    </div>
                    <div className="text-center">
                      <p className="text-stone-500 font-bold text-lg tracking-widest uppercase mb-1">
                        {imgModel.includes('flash') ? '極速繪圖中' : '高品質渲染中'}
                      </p>
                      <p className="text-xs text-stone-300">正在具象化您的文字靈魂...</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-stone-200 space-y-6">
              <div className="w-24 h-24 rounded-full bg-stone-50 flex items-center justify-center">
                <MousePointer2 size={40} className="animate-bounce" />
              </div>
              <p className="font-bold uppercase tracking-[0.3em] text-sm">請從左側點選區塊開始編輯</p>
            </div>
          )}
        </div>

        {/* 右側：標示明確的 1-2-3 AI 導引面板 */}
        <div className="w-80 flex flex-col gap-6 overflow-y-auto pb-8 pr-1">
          <div className="bg-white rounded-[2rem] border border-stone-100 p-8 shadow-sm space-y-8">
            <h4 className="text-[11px] font-bold text-stone-900 uppercase tracking-[0.2em] flex items-center gap-3 border-b border-stone-50 pb-5">
              <Sparkles size={16} className="text-amber-400" /> AI 創作引導
            </h4>

            {/* Step 1: 文字優化 */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-2xl bg-stone-900 text-white text-xs flex items-center justify-center font-black shadow-lg shadow-stone-200">1</div>
                <div>
                  <h5 className="text-xs font-black text-stone-800">拋光文案內容</h5>
                  <p className="text-[10px] text-stone-400">選擇優化方向</p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-2.5 pl-11">
                {['渲染氛圍', '增強實用性', '美食誘惑'].map(opt => (
                  <button 
                    key={opt} 
                    onClick={() => handleRefine(opt)} 
                    disabled={isRefining || !activeParaId}
                    className="w-full text-left px-4 py-3 rounded-2xl border border-stone-50 hover:border-stone-900 bg-stone-50/40 hover:bg-white transition-all text-[11px] font-bold text-stone-500 hover:text-stone-900 flex items-center justify-between group disabled:opacity-30"
                  >
                    {opt}
                    <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
                  </button>
                ))}
              </div>
            </div>

            {/* Step 2: 繪圖指令 */}
            <div className="space-y-4 pt-6 border-t border-stone-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-2xl bg-stone-900 text-white text-xs flex items-center justify-center font-black shadow-lg shadow-stone-200">2</div>
                  <div>
                    <h5 className="text-xs font-black text-stone-800">生成繪圖指令</h5>
                    <p className="text-[10px] text-stone-400">AI 輔助撰寫</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowHistory(!showHistory)}
                  className={`p-2 rounded-xl transition-all ${showHistory ? 'bg-stone-900 text-white shadow-md' : 'text-stone-300 hover:text-stone-900 bg-stone-50'}`}
                  title="查看歷史紀錄"
                >
                  <History size={16} />
                </button>
              </div>
              
              <div className="pl-11 space-y-4">
                {showHistory ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {activePara?.promptHistory?.map((h, i) => (
                      <button 
                        key={i} 
                        onClick={() => updateActivePara({ imagePrompt: h })} 
                        className="w-full text-left p-3 bg-stone-50 rounded-xl text-[10px] text-stone-400 border border-transparent hover:border-stone-900 hover:text-stone-900 transition-all"
                      >
                        {h}
                      </button>
                    ))}
                    {(!activePara?.promptHistory || activePara.promptHistory.length === 0) && <p className="text-[10px] text-stone-300 italic text-center py-4">目前尚無歷史指令</p>}
                    <button onClick={() => setShowHistory(false)} className="w-full text-[10px] font-black text-stone-300 hover:text-stone-900 pt-2">返回編輯模式</button>
                  </div>
                ) : (
                  <>
                    <textarea 
                      value={activePara?.imagePrompt || ''}
                      onChange={(e) => updateActivePara({ imagePrompt: e.target.value })}
                      disabled={!activeParaId}
                      className="w-full h-32 p-4 bg-stone-50/50 border border-stone-100 rounded-[1.5rem] text-[11px] italic text-stone-600 outline-none focus:border-stone-900 focus:bg-white resize-none transition-all leading-relaxed disabled:opacity-30"
                      placeholder="等待 AI 建議指令..."
                    />
                    <button 
                      onClick={async () => {
                        const newPrompt = await generateImagePrompt(activePara?.content || '');
                        updateActivePara({ imagePrompt: newPrompt });
                      }}
                      disabled={!activeParaId || isRefining}
                      className="text-[10px] font-black text-stone-400 hover:text-stone-900 flex items-center gap-2 mx-auto uppercase tracking-widest disabled:opacity-30"
                    >
                      <RefreshCw size={12} className={isRefining ? 'animate-spin' : ''} /> 重新 AI 建議
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Step 3: 影像生成 */}
            <div className="space-y-5 pt-6 border-t border-stone-50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-2xl bg-stone-900 text-white text-xs flex items-center justify-center font-black shadow-lg shadow-stone-200">3</div>
                <div>
                  <h5 className="text-xs font-black text-stone-800">最終影像生成</h5>
                  <p className="text-[10px] text-stone-400">選擇繪圖引擎</p>
                </div>
              </div>
              
              <div className="pl-11 space-y-5">
                <div className="flex items-center gap-2 bg-stone-50 p-1.5 rounded-2xl">
                  <button 
                    onClick={() => setImgModel('gemini-2.5-flash-image')}
                    className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 rounded-xl transition-all ${imgModel === 'gemini-2.5-flash-image' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-400 hover:text-stone-600'}`}
                  >
                    <Zap size={14} className={imgModel === 'gemini-2.5-flash-image' ? 'text-amber-400' : ''} />
                    <span className="text-[9px] font-black uppercase">極速 Express</span>
                  </button>
                  <button 
                    onClick={() => setImgModel('gemini-3-pro-image-preview')}
                    className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 rounded-xl transition-all ${imgModel === 'gemini-3-pro-image-preview' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-400 hover:text-stone-600'}`}
                  >
                    <Sparkles size={14} className={imgModel === 'gemini-3-pro-image-preview' ? 'text-indigo-400' : ''} />
                    <span className="text-[9px] font-black uppercase">高品質 4K</span>
                  </button>
                </div>
                
                <button 
                  onClick={handleGenerateAIImage} 
                  disabled={isGeneratingImg || !activePara?.imagePrompt} 
                  className="w-full bg-stone-900 text-white py-5 rounded-[1.5rem] text-xs font-black flex items-center justify-center gap-3 hover:bg-stone-800 disabled:opacity-10 transition-all shadow-xl shadow-stone-100 hover:-translate-y-1 active:translate-y-0"
                >
                  {isGeneratingImg ? <Loader2 size={18} className="animate-spin" /> : <Wand2 size={18} />}
                  立即生成影像資產
                </button>
                
                <div className="flex items-center gap-3 justify-center">
                  <input type="file" ref={fileInputRef} onChange={handleImageUpload} className="hidden" />
                  <button 
                    onClick={() => fileInputRef.current?.click()} 
                    className="text-[10px] font-bold text-stone-300 hover:text-stone-600 transition-colors underline underline-offset-4"
                  >
                    或手動上傳在地素材
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 預覽 Modal - 樣式與排版優化 */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-[200] bg-stone-950/98 backdrop-blur-3xl flex items-center justify-center p-0 md:p-12 overflow-y-auto cursor-pointer" onClick={() => setIsPreviewOpen(false)}>
          <button onClick={() => setIsPreviewOpen(false)} className="fixed top-12 right-12 flex items-center gap-4 px-10 py-5 bg-white text-stone-900 rounded-full font-black shadow-[0_30px_60px_rgba(0,0,0,0.5)] z-[250] hover:scale-110 active:scale-95 transition-all border border-stone-100">
            <LogOut size={24} /> 退出全螢幕預覽
          </button>
          
          <div className="bg-white w-full max-w-6xl rounded-none md:rounded-[5rem] shadow-2xl min-h-screen md:min-h-[90vh] flex flex-col relative animate-in zoom-in-95 fade-in duration-700 cursor-default shadow-[0_100px_200px_rgba(0,0,0,0.4)]" onClick={(e) => e.stopPropagation()}>
            <div className="flex-1 overflow-y-auto p-16 md:p-32 lg:p-40 space-y-48">
              <header className="text-center space-y-16">
                <div className="inline-block px-6 py-2 border-2 border-stone-900 rounded-full text-[10px] font-black uppercase tracking-[0.5em] mb-4">TravelMuse Original</div>
                <h1 className="text-7xl md:text-9xl font-bold serif text-stone-900 leading-[1.05] tracking-tight">{editedProject.title}</h1>
                <p className="text-stone-400 uppercase tracking-[0.8em] text-sm font-black italic">{editedProject.destination}</p>
                <div className="w-24 h-1.5 bg-stone-900 mx-auto rounded-full" />
              </header>

              <div className="space-y-80">
                {editedProject.paragraphs.map((p, idx) => (
                  <section key={p.id} className={`flex flex-col ${idx % 2 !== 0 ? 'md:flex-row-reverse' : 'md:flex-row'} gap-32 items-center md:items-start`}>
                    <div className="flex-1 space-y-16">
                      <div className="flex items-center gap-8">
                         <span className="text-8xl font-light text-stone-50 italic serif select-none">0{idx + 1}</span>
                         <h2 className="text-5xl md:text-6xl font-bold serif text-stone-800 leading-tight" style={{ color: p.color, fontFamily: p.fontFamily }}>{p.title}</h2>
                      </div>
                      <p className="text-3xl text-stone-600 leading-[2.6] whitespace-pre-wrap font-medium" style={{ color: p.color, fontFamily: p.fontFamily, fontSize: p.fontSize }}>{p.content}</p>
                    </div>
                    {p.uploadedImage && (
                      <div className="flex-1 w-full perspective-1000">
                        <img 
                          src={p.uploadedImage} 
                          className="w-full h-full object-cover rounded-[4rem] shadow-[0_60px_120px_rgba(0,0,0,0.15)] border border-stone-50 transition-transform duration-1000 hover:scale-[1.02]" 
                          alt={p.title} 
                        />
                      </div>
                    )}
                  </section>
                ))}
              </div>

              <footer className="text-center pt-64 pb-20 space-y-10 border-t border-stone-100">
                <div className="flex items-center justify-center gap-4 text-stone-200">
                   <div className="w-20 h-px bg-current"></div>
                   <Sparkles size={24} />
                   <div className="w-20 h-px bg-current"></div>
                </div>
                <p className="text-stone-300 serif italic tracking-[0.4em] text-xs uppercase">
                  Cinematic Marketing Asset Generated by TravelMuse AI v4.0
                </p>
                <button onClick={() => setIsPreviewOpen(false)} className="text-stone-900 font-black text-sm border-b-2 border-stone-900 pb-1 hover:text-stone-400 hover:border-stone-400 transition-all">
                  BACK TO STUDIO
                </button>
              </footer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Editor;
