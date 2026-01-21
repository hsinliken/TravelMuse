
import React from 'react';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-stone-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-stone-900 rounded-full flex items-center justify-center">
            <span className="text-white font-bold text-xs">TM</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-stone-800 serif">TravelMuse <span className="text-stone-400 font-normal">2026</span></h1>
        </div>
        <nav className="hidden md:flex items-center gap-6">
          <a href="#" className="text-sm font-medium text-stone-600 hover:text-stone-900 transition-colors">所有文案</a>
          <a href="#" className="text-sm font-medium text-stone-600 hover:text-stone-900 transition-colors">風格庫</a>
          <a href="#" className="text-sm font-medium text-stone-600 hover:text-stone-900 transition-colors">同步狀態</a>
          <button className="bg-stone-900 text-white px-4 py-1.5 rounded-full text-sm font-medium hover:bg-stone-800 transition-all">
            新文案
          </button>
        </nav>
      </header>
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-8">
        {children}
      </main>
      <footer className="border-t border-stone-100 py-8 px-6 text-center">
        <p className="text-xs text-stone-400 tracking-widest uppercase">TravelMuse AI v4.0 • 由 Gemini 2.0 驅動</p>
      </footer>
    </div>
  );
};

export default Layout;
