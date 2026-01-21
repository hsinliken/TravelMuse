
import React, { useState, useEffect, useRef } from 'react';
import Layout from './components/Layout';
import { Project, TravelTemplate, ToneType, CustomFont } from './types';
import ProjectWizard from './components/ProjectWizard';
import Editor from './components/Editor';
import { Plus, FolderOpen, BookMarked, Globe, Cloud, LayoutTemplate as TemplateIcon, Type as TypeIcon, Upload } from 'lucide-react';

const App: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [templates, setTemplates] = useState<TravelTemplate[]>([
    { id: '1', name: '京都禪意春之祭', description: '柔和、極簡，專注於自然與寧靜。', tone: ToneType.LUXURY, keywords: ['櫻花', '寺廟', '寧靜'] },
    { id: '2', name: '台南復古老宅風', description: '懷舊、溫暖，專注於美食與歷史。', tone: ToneType.VINTAGE, keywords: ['傳承', '街頭小吃', '溫潤'] }
  ]);
  const [customFonts, setCustomFonts] = useState<CustomFont[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [view, setView] = useState<'dashboard' | 'wizard' | 'editor'>('dashboard');
  const fontUploadRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('travelmuse_projects');
    if (saved) setProjects(JSON.parse(saved));
    const savedFonts = localStorage.getItem('travelmuse_fonts');
    if (savedFonts) {
      const fonts: CustomFont[] = JSON.parse(savedFonts);
      setCustomFonts(fonts);
      // 重新載入 FontFace
      fonts.forEach(f => {
        const font = new FontFace(f.name, `url(${f.url})`);
        font.load().then((loaded) => {
          document.fonts.add(loaded);
        });
      });
    }
  }, []);

  const saveProject = (project: Project) => {
    const updated = projects.map(p => p.id === project.id ? project : p);
    if (!projects.find(p => p.id === project.id)) updated.push(project);
    setProjects(updated);
    localStorage.setItem('travelmuse_projects', JSON.stringify(updated));
  };

  const handleFontUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const url = reader.result as string;
      const name = file.name.split('.')[0].replace(/\s+/g, '-');
      const font = new FontFace(name, `url(${url})`);
      try {
        const loaded = await font.load();
        document.fonts.add(loaded);
        const newFonts = [...customFonts, { name, url }];
        setCustomFonts(newFonts);
        localStorage.setItem('travelmuse_fonts', JSON.stringify(newFonts));
        alert(`字體「${name}」已成功安裝！`);
      } catch (err) {
        alert("字體載入失敗，請確認檔案格式是否正確。");
      }
    };
    reader.readAsDataURL(file);
  };

  const startNewProject = () => setView('wizard');

  return (
    <Layout>
      {view === 'dashboard' && (
        <div className="space-y-12 animate-in fade-in duration-700">
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-bold text-stone-900 serif">文案資產庫</h2>
                <p className="text-stone-500 mt-1">管理您的旅遊行銷素材與品牌風格。</p>
              </div>
              <button 
                onClick={startNewProject}
                className="flex items-center gap-2 bg-stone-900 text-white px-6 py-3 rounded-xl font-medium shadow-lg hover:shadow-stone-200 transition-all hover:-translate-y-0.5"
              >
                <Plus size={18} />
                建立新文案
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white border border-stone-200 p-6 rounded-2xl hover:border-stone-400 transition-colors cursor-pointer group">
                <div className="w-10 h-10 bg-stone-50 rounded-lg flex items-center justify-center mb-4 text-stone-600 group-hover:bg-stone-900 group-hover:text-white transition-all">
                  <TemplateIcon size={20} />
                </div>
                <h3 className="font-bold text-lg">風格範本</h3>
                <p className="text-sm text-stone-500 mt-1">{templates.length} 個已儲存風格</p>
              </div>
              <div 
                onClick={() => fontUploadRef.current?.click()}
                className="bg-white border border-stone-200 p-6 rounded-2xl hover:border-stone-400 transition-colors cursor-pointer group"
              >
                <div className="w-10 h-10 bg-stone-50 rounded-lg flex items-center justify-center mb-4 text-stone-600 group-hover:bg-stone-900 group-hover:text-white transition-all">
                  <TypeIcon size={20} />
                </div>
                <h3 className="font-bold text-lg">字體管理</h3>
                <p className="text-sm text-stone-500 mt-1">{customFonts.length} 個自訂字體 (點擊上傳)</p>
                <input type="file" ref={fontUploadRef} onChange={handleFontUpload} className="hidden" accept=".ttf,.otf,.woff,.woff2" />
              </div>
              <div className="bg-white border border-stone-200 p-6 rounded-2xl hover:border-stone-400 transition-colors cursor-pointer group">
                <div className="w-10 h-10 bg-stone-50 rounded-lg flex items-center justify-center mb-4 text-stone-600 group-hover:bg-stone-900 group-hover:text-white transition-all">
                  <Cloud size={20} />
                </div>
                <h3 className="font-bold text-lg">雲端同步</h3>
                <p className="text-sm text-stone-500 mt-1">與 Notion 及 Google Drive 同步</p>
              </div>
              <div className="bg-white border border-stone-200 p-6 rounded-2xl hover:border-stone-400 transition-colors cursor-pointer group">
                <div className="w-10 h-10 bg-stone-50 rounded-lg flex items-center justify-center mb-4 text-stone-600 group-hover:bg-stone-900 group-hover:text-white transition-all">
                  <Globe size={20} />
                </div>
                <h3 className="font-bold text-lg">發佈網頁</h3>
                <p className="text-sm text-stone-500 mt-1">管理 Vercel 上的登錄頁面</p>
              </div>
            </div>
          </section>

          <section className="space-y-6">
            <h2 className="text-2xl font-bold text-stone-900 serif flex items-center gap-2">
              <FolderOpen size={22} className="text-stone-400" />
              最近文案
            </h2>
            {projects.length === 0 ? (
              <div className="border-2 border-dashed border-stone-200 rounded-3xl py-20 text-center flex flex-col items-center justify-center space-y-4">
                <BookMarked size={48} className="text-stone-200" />
                <p className="text-stone-400 font-medium">尚未建立文案。今天就開始您的第一篇創作吧。</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {projects.map(project => (
                  <div 
                    key={project.id} 
                    onClick={() => { setActiveProject(project); setView('editor'); }}
                    className="bg-white border border-stone-100 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all cursor-pointer group"
                  >
                    <div className="h-40 bg-stone-200 relative overflow-hidden">
                      <img src={`https://picsum.photos/seed/${project.id}/400/200`} alt={project.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                      <div className="absolute top-4 right-4 bg-white/90 backdrop-blur px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider text-stone-600">
                        {project.destination}
                      </div>
                    </div>
                    <div className="p-5">
                      <h4 className="font-bold text-stone-800 text-lg group-hover:text-stone-900 transition-colors">{project.title}</h4>
                      <p className="text-xs text-stone-400 mt-1">最後編輯於 {new Date(project.updatedAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {view === 'wizard' && (
        <ProjectWizard 
          templates={templates} 
          onCancel={() => setView('dashboard')} 
          onComplete={(p) => { saveProject(p); setActiveProject(p); setView('editor'); }} 
        />
      )}

      {view === 'editor' && activeProject && (
        <Editor 
          project={activeProject} 
          customFonts={customFonts}
          onSave={saveProject} 
          onClose={() => setView('dashboard')} 
        />
      )}
    </Layout>
  );
};

export default App;
