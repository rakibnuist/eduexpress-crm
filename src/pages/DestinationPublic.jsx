import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { GraduationCap, MapPin, CheckCircle2, ChevronRight, FileText, Banknote, Briefcase, GraduationCap as Cap } from 'lucide-react';

export default function DestinationPublic() {
  const { slug } = useParams();
  const [dest, setDest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`/api/public/destinations/${slug}`)
      .then(res => {
        if (!res.ok) throw new Error('Destination not found or not public');
        return res.json();
      })
      .then(data => {
        setDest(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium">Loading destination...</p>
        </div>
      </div>
    );
  }

  if (error || !dest) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <MapPin size={32} />
          </div>
          <h1 className="text-xl font-bold text-slate-800 mb-2">Destination Not Found</h1>
          <p className="text-slate-500 mb-6">The page you're looking for doesn't exist or is currently private.</p>
        </div>
      </div>
    );
  }

  const sections = [
    { id: 'requirements', title: 'Admission Requirements', icon: CheckCircle2, content: dest.requirements, color: 'emerald' },
    { id: 'programs', title: 'Top Programs & Universities', icon: Cap, content: dest.programs, color: 'blue' },
    { id: 'fees', title: 'Fees & Scholarships', icon: Banknote, content: dest.fees, color: 'amber' },
    { id: 'processing', title: 'Application Processing', icon: Briefcase, content: dest.application_processing, color: 'indigo' },
    { id: 'embassy', title: 'Embassy Documents', icon: FileText, content: dest.embassy_documents, color: 'rose' },
  ].filter(s => s.content && s.content.trim().length > 0);

  // Helper to render text with basic markdown-like list detection
  const renderContent = (text) => {
    if (!text) return null;
    const lines = text.split('\n');
    return (
      <div className="space-y-2 text-slate-600 leading-relaxed">
        {lines.map((line, i) => {
          if (line.trim().startsWith('-') || line.trim().startsWith('*')) {
            return (
              <div key={i} className="flex items-start gap-2 pl-4">
                <div className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-2 flex-shrink-0" />
                <span>{line.replace(/^[-*]\s*/, '')}</span>
              </div>
            );
          }
          return <p key={i} className="min-h-[1.5rem]">{line}</p>;
        })}
      </div>
    );
  };

  const colorMap = {
    emerald: { text: 'text-emerald-500', bg: 'bg-emerald-100', iconText: 'text-emerald-600' },
    blue: { text: 'text-blue-500', bg: 'bg-blue-100', iconText: 'text-blue-600' },
    amber: { text: 'text-amber-500', bg: 'bg-amber-100', iconText: 'text-amber-600' },
    indigo: { text: 'text-indigo-500', bg: 'bg-indigo-100', iconText: 'text-indigo-600' },
    rose: { text: 'text-rose-500', bg: 'bg-rose-100', iconText: 'text-rose-600' },
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white shadow-sm">
              <GraduationCap size={20} strokeWidth={2.5} />
            </div>
            <span className="font-bold text-xl text-slate-800 tracking-tight">EduExpress</span>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white py-16 sm:py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay"></div>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <span className="inline-block py-1 px-3 rounded-full bg-white/20 backdrop-blur-sm text-sm font-medium mb-4 text-blue-50 border border-white/10">
            Study Destination
          </span>
          <h1 className="text-4xl sm:text-6xl font-extrabold mb-6 tracking-tight">
            Study in {dest.name}
          </h1>
          <p className="text-lg sm:text-xl text-blue-100 max-w-2xl mx-auto font-medium">
            Everything you need to know about requirements, programs, fees, and the visa process for {dest.name}.
          </p>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          
          {/* Left Navigation (Desktop) */}
          <div className="hidden lg:block sticky top-24 space-y-1">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 pl-3">On this page</h3>
            {sections.map(section => (
              <a 
                key={section.id} 
                href={`#${section.id}`}
                className="flex items-center justify-between px-3 py-2 text-sm font-medium text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition group"
              >
                <div className="flex items-center gap-2">
                  <section.icon size={16} className={`${colorMap[section.color].text} group-hover:scale-110 transition-transform`} />
                  {section.title}
                </div>
                <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
              </a>
            ))}
            {dest.other_details && (
              <a 
                href="#other"
                className="flex items-center justify-between px-3 py-2 text-sm font-medium text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition group"
              >
                <div className="flex items-center gap-2">
                  <FileText size={16} className="text-slate-400" />
                  Additional Information
                </div>
              </a>
            )}
          </div>

          {/* Right Content */}
          <div className="lg:col-span-2 space-y-10">
            {sections.map((section, idx) => (
              <section key={section.id} id={section.id} className="scroll-mt-24">
                <div className="flex items-center gap-3 mb-6">
                  <div className={`w-10 h-10 rounded-xl ${colorMap[section.color].bg} ${colorMap[section.color].iconText} flex items-center justify-center shadow-sm`}>
                    <section.icon size={22} />
                  </div>
                  <h2 className="text-2xl font-bold text-slate-800">{section.title}</h2>
                </div>
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
                  {renderContent(section.content)}
                </div>
              </section>
            ))}

            {dest.other_details && (
              <section id="other" className="scroll-mt-24">
                <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6 sm:p-8">
                  <h3 className="text-lg font-bold text-slate-800 mb-4">Additional Information</h3>
                  {renderContent(dest.other_details)}
                </div>
              </section>
            )}
            
            {/* Call to action */}
            <div className="mt-12 bg-blue-600 rounded-2xl p-8 sm:p-10 text-center text-white shadow-lg relative overflow-hidden">
               <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay"></div>
               <h2 className="text-2xl font-bold mb-4 relative z-10">Ready to apply to {dest.name}?</h2>
               <p className="text-blue-100 mb-8 max-w-md mx-auto relative z-10">Contact our admission team today and we'll guide you through the entire process step by step.</p>
               <button className="bg-white text-blue-600 font-bold py-3 px-8 rounded-full hover:bg-slate-50 transition shadow-md relative z-10 transform hover:scale-105">
                 Contact EduExpress
               </button>
            </div>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-10 text-center border-t border-slate-800">
        <div className="flex items-center justify-center gap-2 mb-4">
          <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center text-white">
            <GraduationCap size={14} strokeWidth={2.5} />
          </div>
          <span className="font-bold text-white tracking-tight">EduExpress CRM</span>
        </div>
        <p className="text-sm">© {new Date().getFullYear()} EduExpress. All rights reserved.</p>
      </footer>
    </div>
  );
}
