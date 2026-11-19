/* StudentPortal — the public-facing status tracking page at /s/<token>.
   High-trust, mobile-first experience for students and guardians.
   Features:
   - 6 Flagship Milestones (Application Submitted ➔ University Review ➔ Admission Notice ➔ JW202/DQ Permit ➔ Embassy Visa ➔ Flight to China)
   - Real-time progress bar & current active step highlight
   - Bilingual support (বাংলা / English toggle)
   - Direct 1-click WhatsApp & Call to Assigned Counselor
   - University application records & decision tracker
   - Document checklist & Drive share link submission
   - QR code sharing card
   - Secure interactive messaging with the admissions team
*/
import { useCallback, useEffect, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api';
import {
  GraduationCap, CheckCircle2, Clock, ExternalLink, AlertCircle, FileText,
  Building2, Send, Plane, MapPin, RefreshCw, Upload, AlertTriangle, QrCode, X,
  Share2, Download, Phone, MessageSquare, Award, ShieldCheck, Check, Sparkles, Globe
} from 'lucide-react';

const FLAGSHIP_MILESTONES = [
  {
    id: 1,
    key: 'submitted',
    icon: Send,
    titleEn: 'Application Submitted',
    titleBn: 'বিশ্ববিদ্যালয়ে আবেদন দাখিল',
    shortEn: 'Submitted',
    shortBn: 'দাখিল সম্পন্ন',
    descEn: 'Your academic credentials, transcripts, and application package have been officially submitted to the university admissions office.',
    descBn: 'আপনার সকল একাডেমিক মার্কশিট, সার্টিফিকেট ও আবেদনপত্র সংশ্লিষ্ট বিশ্ববিদ্যালয়ের আন্তর্জাতিক ভর্তি অফিসে সফলভাবে সাবমিট করা হয়েছে।',
    actionEn: 'Admissions team is awaiting acknowledgment from the faculty board.',
    actionBn: 'বিশ্ববিদ্যালয়ের আন্তর্জাতিক ফ্যাকাল্টি বোর্ড থেকে ভেরিফিকেশন ও স্বীকৃতির অপেক্ষায় রয়েছে।',
    estimatedTime: '১-২ সপ্তাহ',
  },
  {
    id: 2,
    key: 'review',
    icon: Building2,
    titleEn: 'University Review & Assessment',
    titleBn: 'বিশ্ববিদ্যালয় রিভিউ ও ইন্টারভিউ',
    shortEn: 'Under Review',
    shortBn: 'মূল্যায়ন চলছে',
    descEn: 'The university academic board and scholarship committee are actively reviewing your academic profile and statement of purpose.',
    descBn: 'বিশ্ববিদ্যালয় স্কলারশিপ কমিটি ও প্রফেসরদের প্যানেল আপনার একাডেমিক ফলাফল, এসওপি এবং যোগ্যতা পুঙ্খানুপুঙ্খভাবে মূল্যায়ন করছে।',
    actionEn: 'Prepare for any potential faculty interview or document clarification.',
    actionBn: 'কোনো ইন্টারভিউ বা অতিরিক্ত তথ্যের প্রয়োজন হলে এডুএক্সপ্রেস কাউন্সেলর আপনাকে আগেই প্রস্তুত করে দেবেন।',
    estimatedTime: '২-৪ সপ্তাহ',
  },
  {
    id: 3,
    key: 'admission',
    icon: Award,
    titleEn: 'Official Admission Notice',
    titleBn: 'অফিশিয়াল অ্যাডমিশন অনুমোদন',
    shortEn: 'Admission Approved',
    shortBn: 'ভর্তি অনুমোদিত',
    descEn: 'Congratulations! The university has approved your admission and granted your scholarship offer letter.',
    descBn: 'অভিনন্দন! বিশ্ববিদ্যালয় আপনার স্কলারশিপসহ ভর্তির আবেদন অনুমোদন করেছে এবং অফিশিয়াল অ্যাডমিশন নোটিশ (ভর্তি চিঠি) ইস্যু করেছে।',
    actionEn: 'University is now generating your state JW202/DQ visa authorization form.',
    actionBn: 'বিশ্ববিদ্যালয় এখন আপনার জন্য সরকারি JW202 / DQ স্টাডি ভিসা অনুমোদন ফরম প্রস্তুত করছে।',
    estimatedTime: '১-২ সপ্তাহ',
  },
  {
    id: 4,
    key: 'jw202',
    icon: ShieldCheck,
    titleEn: 'JW202 / DQ Form Issued',
    titleBn: 'সরকারি JW202 / DQ ভিসা ফরম অনুমোদন',
    shortEn: 'JW202 Issued',
    shortBn: 'JW202 রেডি',
    descEn: 'The Ministry of Education & Municipal Migration Authorities have officially issued your state JW202 / DQ study visa permit.',
    descBn: 'চীনা শিক্ষা মন্ত্রণালয় ও মাইগ্রেশন অথরিটি থেকে আপনার স্টুডেন্ট ভিসার অফিশিয়াল অনুমোদন পত্র (JW202 / DQ Form) সফলভাবে ইস্যু হয়েছে।',
    actionEn: 'Our visa desk is preparing your original embassy visa application file.',
    actionBn: 'এডুএক্সপ্রেস ভিসা টিম আপনার ঢাকাস্থ দূতাবাসে সাবমিশনের জন্য ফাইল প্রস্তুত করছে।',
    estimatedTime: '২-৩ সপ্তাহ',
  },
  {
    id: 5,
    key: 'visa',
    icon: Sparkles,
    titleEn: 'Embassy Visa Stamped',
    titleBn: 'চীনা দূতাবাস ভিসা অনুমোদন',
    shortEn: 'Visa Stamped',
    shortBn: 'ভিসা স্ট্যাম্পড',
    descEn: 'Your X1/X2 Student Visa sticker has been successfully granted and stamped on your passport by the Embassy of China in Dhaka.',
    descBn: 'আলহামদুলিল্লাহ! ঢাকাস্থ চীনা দূতাবাস থেকে আপনার পাসপোর্টে অফিশিয়াল এক্স১/এক্স২ স্টুডেন্ট ভিসা স্ট্যাম্পিং সফলভাবে সম্পন্ন হয়েছে।',
    actionEn: 'Passport ready for handover. Moving to air ticketing & flight briefing.',
    actionBn: 'পাসপোর্ট ডেলিভারির জন্য প্রস্তুত। এরপর ফ্লাইট টিকিট বুকিং ও প্রাক-যাত্রা ব্রিফিং শুরু হবে।',
    estimatedTime: '১ সপ্তাহ',
  },
  {
    id: 6,
    key: 'fly',
    icon: Plane,
    titleEn: 'Flight to China & Campus Enrollment',
    titleBn: 'যাত্রা ও ক্যাম্পাসে স্বাগতম',
    shortEn: 'Departed & Enrolled',
    shortBn: 'ক্যাম্পাসে পৌঁছানো',
    descEn: 'Air ticketing, pre-departure luggage briefing, arrival in China, dormitory check-in, and university enrollment complete!',
    descBn: 'এয়ার টিকিট বুকিং, প্রাক-যাত্রা অরিয়েন্টেশন, চায়নায় আগমন, ডরমেটরি রুম চেক-ইন এবং বিশ্ববিদ্যালয়ে সফলভাবে সেমিস্টার রেজিস্ট্রেশন সম্পন্ন!',
    actionEn: 'Welcome to your exciting higher education journey in China!',
    actionBn: 'চায়নায় আপনার উচ্চশিক্ষা জীবনের সুন্দর সূচনার জন্য শুভকামনা!',
    estimatedTime: 'ফাইনাল পর্যায়',
  },
];

function getCompletedMilestoneCount(stageKey) {
  if (!stageKey) return 0;
  const k = stageKey.toLowerCase();
  if (k === 'documents' || k === 'ready') return 0;
  if (k === 'submitted') return 1;
  if (k === 'interview' || k.includes('review') || k === 'processing' || k === 'initial_review_pass') return 1;
  if (k === 'pre_admission' || k === 'deposit') return 2;
  if (k === 'admitted') return 3;
  if (k === 'visa_applied') return 4;
  if (k === 'visa_approved' || k === 'passport_collection' || k === 'partial_payment' || k === 'air_ticket' || k === 'complete_payment' || k === 'pre_departure') return 5;
  if (k === 'fly') return 6;
  return 0;
}

const UNI_STATUS_LABEL = {
  documents: { en: 'Collecting documents', bn: 'ডকুমেন্ট প্রস্তুতি' },
  ready:     { en: 'Ready to submit',     bn: 'সাবমিশনের জন্য রেডি' },
  submitted: { en: 'Application submitted', bn: 'বিশ্ববিদ্যালয়ে সাবমিট করা হয়েছে' },
  admitted:  { en: 'Admitted — offer letter received', bn: 'ভর্তি অনুমোদিত (অফার লেটার প্রাপ্ত)' },
  returned:  { en: 'Returned for correction', bn: 'সংশোধনের জন্য ফেরত' },
  rejected:  { en: 'Not selected', bn: 'মনোনীত হয়নি' },
};

const UNI_STATUS_CLS = {
  documents: 'bg-slate-100 text-slate-700 border-slate-200',
  ready:     'bg-blue-100 text-blue-700 border-blue-200',
  submitted: 'bg-violet-100 text-violet-700 border-violet-200',
  admitted:  'bg-emerald-100 text-emerald-700 border-emerald-200 font-bold',
  returned:  'bg-amber-100 text-amber-700 border-amber-200',
  rejected:  'bg-rose-100 text-rose-700 border-rose-200',
};

const DOC_STATUS_LABEL = {
  pending:      { en: 'Pending', bn: 'জমা বাকি' },
  received:     { en: 'Received', bn: 'প্রাপ্ত হয়েছে' },
  verified:     { en: 'Verified', bn: 'যাচাইকৃত ✓' },
  rejected:     { en: 'Needs re-upload', bn: 'পুনরায় পাঠানো প্রয়োজন' },
  not_required: { en: 'Not required', bn: 'প্রয়োজন নেই' },
};

const ensureAbsoluteUrl = (url) => {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  return 'https://' + url;
};

export default function StudentPortal() {
  const { token } = useParams();
  const [data, setData]             = useState(null);
  const [thread, setThread]         = useState([]);
  const [error, setError]           = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showQR, setShowQR]         = useState(false);
  const [lang, setLang]             = useState('bn'); // 'bn' | 'en'

  const load = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const [d, t] = await Promise.all([
        api.studentPortal(token),
        api.studentThread(token).catch(() => []),
      ]);
      setData(d);
      setThread(t || []);
      setError(null);
    } catch (e) {
      setError(e.message || 'This portal link is no longer active.');
    }
    if (!silent) setRefreshing(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const t = setInterval(() => { if (!document.hidden) load(true); }, 60000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (data?.student?.name) {
      document.title = `${data.student.name} — Live Admission Tracker | EduExpress`;
    } else {
      document.title = "Live Student Tracking Portal | EduExpress International";
    }
  }, [data]);

  const portalUrl = typeof window !== 'undefined' ? window.location.href : '';

  const downloadQR = () => {
    const canvas = document.getElementById('student-qr-code');
    if (canvas) {
      const pngUrl = canvas.toDataURL('image/png').replace('image/png', 'image/octet-stream');
      const downloadLink = document.createElement('a');
      downloadLink.href = pngUrl;
      downloadLink.download = `${data?.student?.name || 'Student'}_Portal_QR.png`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 flex items-center justify-center p-4 font-sans">
        <div className="bg-white rounded-3xl shadow-xl p-8 max-w-md text-center border border-slate-100">
          <AlertCircle size={44} className="text-rose-500 mx-auto mb-4" />
          <h1 className="text-2xl font-extrabold text-slate-800 mb-2">Portal Unavailable</h1>
          <p className="text-slate-500 text-sm mb-4">{error}</p>
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs text-slate-600 space-y-1">
            <p className="font-semibold text-slate-700">EduExpress International (Dhanmondi, Dhaka)</p>
            <p>Hotline: <a href="tel:+8801886932822" className="text-blue-600 font-bold">+880 1886-932822</a></p>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-3">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Loading Live Tracking Portal…</p>
      </div>
    );
  }

  const { student, universities = [], documents = [] } = data;
  const completedCount = getCompletedMilestoneCount(student.application_stage);
  const activeMilestoneIdx = Math.min(completedCount, 5);
  const activeMilestone = FLAGSHIP_MILESTONES[activeMilestoneIdx];
  const progressPercent = Math.round((completedCount / 6) * 100);

  const requested = documents.filter(d => d.requested_by_student && d.status !== 'verified');
  const submitted = documents.filter(d => !d.requested_by_student || d.status === 'verified' || d.status === 'received');

  const counselorPhone = (student.consultant_phone || '+8801886932822').replace(/\D/g, '');
  const counselorWaUrl = `https://wa.me/${counselorPhone}?text=${encodeURIComponent(
    `আসসালামু আলাইকুম ${student.assigned_consultant || 'কাউন্সেলর'}, আমি ${student.name} (ID: ${student.ref_id})। আমার ${student.destination || 'চায়না'} অ্যাডমিশন ফাইল নিয়ে কথা বলতে চাচ্ছিলাম।`
  )}`;

  return (
    <div className="min-h-screen bg-slate-50/60 font-sans text-slate-800 selection:bg-blue-100 selection:text-blue-900 pb-24">
      
      {/* ─── Top Navigation Bar ─── */}
      <header className="bg-white/95 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-40 shadow-xs">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-tr from-blue-600 to-indigo-700 rounded-2xl flex items-center justify-center shadow-md shadow-blue-500/20 text-white font-black text-lg">
              <GraduationCap size={22} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-slate-900 text-sm tracking-tight">EduExpress</span>
                <span className="text-[10px] bg-blue-50 text-blue-700 font-bold px-1.5 py-0.5 rounded border border-blue-200/60">Live Tracker</span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">International Education Portal</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Language Switcher */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200/60 text-xs">
              <button
                onClick={() => setLang('bn')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  lang === 'bn' ? 'bg-white text-blue-600 shadow-xs scale-102' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                বাংলা
              </button>
              <button
                onClick={() => setLang('en')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  lang === 'en' ? 'bg-white text-blue-600 shadow-xs scale-102' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                EN
              </button>
            </div>

            <button
              onClick={() => setShowQR(true)}
              className="flex items-center justify-center w-9 h-9 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer border border-slate-200/70"
              title="Share QR"
            >
              <QrCode size={17} />
            </button>
            <button
              onClick={() => load()}
              disabled={refreshing}
              className="flex items-center justify-center w-9 h-9 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer border border-slate-200/70"
              title="Refresh status"
            >
              <RefreshCw size={15} className={refreshing ? 'animate-spin text-blue-600' : ''} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* ─── Hero Applicant Status Card ─── */}
        <section className="bg-white rounded-3xl shadow-sm border border-slate-200/90 overflow-hidden relative">
          <div className="h-2.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-500" />
          <div className="p-6 sm:p-8">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
              <div className="space-y-2 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200/80 px-2.5 py-1 rounded-lg">
                    ID: {student.ref_id}
                  </span>
                  {student.destination && (
                    <span className="text-xs font-bold flex items-center gap-1.5 text-slate-700 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg">
                      🇨🇳 {student.destination}
                    </span>
                  )}
                  {student.intake_term && (
                    <span className="text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg">
                      📅 {student.intake_term}
                    </span>
                  )}
                </div>

                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                  {student.name}
                </h1>
                
                <p className="text-sm font-medium text-slate-600 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span>🎓 {student.degree || 'Bachelor / Masters Program'}</span>
                  {student.major && <span className="text-slate-300">•</span>}
                  {student.major && <span className="text-slate-700 font-semibold">{student.major}</span>}
                  {student.university && <span className="text-slate-300">•</span>}
                  {student.university && <span className="text-blue-700 font-bold">{student.university}</span>}
                </p>
              </div>

              {/* Progress Ring / Percentage Box */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50/70 border border-blue-200/80 rounded-2xl p-4 flex items-center gap-4 min-w-[220px]">
                <div className="w-14 h-14 rounded-2xl bg-white border border-blue-200 flex flex-col items-center justify-center shadow-xs">
                  <span className="text-lg font-black text-blue-700 leading-none">{progressPercent}%</span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">Done</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    {lang === 'bn' ? 'বর্তমান পর্যায়' : 'Current Stage'}
                  </p>
                  <p className="text-xs font-extrabold text-slate-900 truncate mt-0.5">
                    {lang === 'bn' ? activeMilestone.shortBn : activeMilestone.shortEn}
                  </p>
                  <p className="text-[10px] text-blue-600 font-bold mt-1">
                    {completedCount === 6 
                      ? (lang === 'bn' ? '✓ সকল ধাপ সম্পন্ন!' : '✓ All Stages Complete!') 
                      : (lang === 'bn' ? `ধাপ ${activeMilestoneIdx + 1} / ৬ চলমান` : `Step ${activeMilestoneIdx + 1} of 6 In Progress`)
                    }
                  </p>
                </div>
              </div>
            </div>

            {/* Overall Progress Bar */}
            <div className="mt-6 pt-5 border-t border-slate-100">
              <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-2">
                <span>{lang === 'bn' ? 'ভর্তি ও ভিসা যাত্রা ট্র্যাকার' : 'Admission & Visa Journey Tracker'}</span>
                <span className="text-blue-600 font-extrabold">{completedCount} of 6 {lang === 'bn' ? 'ধাপ সম্পন্ন' : 'Milestones'}</span>
              </div>
              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden p-0.5">
                <div
                  className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full transition-all duration-700 shadow-sm"
                  style={{ width: `${Math.max(progressPercent, 6)}%` }}
                />
              </div>
            </div>
          </div>
        </section>

        {/* ─── 6 Flagship Milestones (The Core Tracking Pipeline) ─── */}
        <section className="bg-white rounded-3xl shadow-sm border border-slate-200/90 overflow-hidden">
          <div className="px-6 sm:px-8 py-5 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900 flex items-center gap-2">
                <ShieldCheck size={20} className="text-blue-600" />
                {lang === 'bn' ? 'চায়না অ্যাডমিশন ও ভিসা রোডম্যাপ' : 'China Admission & Visa Roadmap'}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {lang === 'bn' 
                  ? 'আপনার ফাইলের প্রতি মুহূর্তের রিয়েল-টাইম অগ্রগতি নিচে বিস্তারিত দেখুন' 
                  : 'Real-time timeline of your application from submission to arrival in China'}
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              {lang === 'bn' ? 'লাইভ সিঙ্ক সক্রিয়' : 'Live Sync Active'}
            </span>
          </div>

          <div className="p-6 sm:p-8 space-y-4">
            {FLAGSHIP_MILESTONES.map((m, idx) => {
              const isPast = idx < completedCount;
              const isCurrent = idx === completedCount;
              const isFuture = idx > completedCount;
              const IconComponent = m.icon;

              return (
                <div
                  key={m.id}
                  className={`rounded-2xl border transition-all p-4 sm:p-5 relative ${
                    isCurrent
                      ? 'bg-gradient-to-br from-blue-50/70 via-indigo-50/40 to-white border-blue-300 ring-2 ring-blue-500/20 shadow-sm'
                      : isPast
                        ? 'bg-white border-slate-200/80 hover:border-slate-300'
                        : 'bg-slate-50/40 border-slate-100 opacity-70'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    {/* Milestone Step Indicator Circle */}
                    <div
                      className={`w-10 h-10 rounded-2xl flex-shrink-0 flex items-center justify-center font-bold text-sm transition-all shadow-xs ${
                        isPast
                          ? 'bg-emerald-500 text-white shadow-emerald-500/20'
                          : isCurrent
                            ? 'bg-blue-600 text-white shadow-blue-600/30 ring-4 ring-blue-100'
                            : 'bg-slate-100 text-slate-400 border border-slate-200'
                      }`}
                    >
                      {isPast ? <Check size={18} strokeWidth={3} /> : <IconComponent size={18} />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-slate-400">Step {m.id}</span>
                          <h3 className={`text-base font-bold ${isCurrent ? 'text-blue-900 font-extrabold' : isPast ? 'text-slate-800' : 'text-slate-500'}`}>
                            {lang === 'bn' ? m.titleBn : m.titleEn}
                          </h3>
                        </div>

                        {/* Status Badge */}
                        <div className="flex items-center gap-2">
                          {isPast && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                              ✓ {lang === 'bn' ? 'সম্পন্ন' : 'Completed'}
                            </span>
                          )}
                          {isCurrent && (
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold px-3 py-1 rounded-full bg-blue-600 text-white shadow-xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                              {lang === 'bn' ? 'চলমান পর্যায়' : 'In Progress'}
                            </span>
                          )}
                          {isFuture && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-500">
                              {lang === 'bn' ? 'অপেক্ষমান' : 'Upcoming'}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Description */}
                      <p className={`text-xs sm:text-sm mt-1 leading-relaxed ${isCurrent ? 'text-slate-700 font-medium' : isPast ? 'text-slate-600' : 'text-slate-400'}`}>
                        {lang === 'bn' ? m.descBn : m.descEn}
                      </p>

                      {/* Active Step Specific Action Box */}
                      {isCurrent && (
                        <div className="mt-3.5 p-3 rounded-xl bg-white border border-blue-200/80 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2 text-xs font-semibold text-blue-900">
                            <span className="text-amber-500">⚡</span>
                            <span>{lang === 'bn' ? m.actionBn : m.actionEn}</span>
                          </div>
                          <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md w-fit whitespace-nowrap">
                            ⏱️ {lang === 'bn' ? `আনুমানিক: ${m.estimatedTime}` : `Est: ${m.estimatedTime}`}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ─── Two-Column Section: Assigned Counselor & Applied Universities ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* LEFT: Assigned Counselor Contact Card */}
          <div className="lg:col-span-1 space-y-6">
            <section className="bg-white rounded-3xl shadow-sm border border-slate-200/90 p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 text-white flex items-center justify-center font-bold text-lg shadow-md shadow-emerald-500/20">
                  <Phone size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    {lang === 'bn' ? 'আপনার ডেডিকেটেড কাউন্সেলর' : 'Assigned Counselor'}
                  </p>
                  <h3 className="text-base font-extrabold text-slate-900">
                    {student.assigned_consultant || 'Admissions Counselor'}
                  </h3>
                  <p className="text-xs text-emerald-600 font-semibold">
                    {student.consultant_role || 'China Admissions Specialist'}
                  </p>
                </div>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                {lang === 'bn'
                  ? 'আপনার ভর্তি বা ভিসা নিয়ে যেকোনো প্রশ্ন বা জানার থাকলে সরাসরি আপনার কাউন্সেলরের সাথে হোয়াটসঅ্যাপে কথা বলুন।'
                  : 'Have questions regarding your admission, JW202 form, or visa? Reach out to your counselor directly on WhatsApp.'}
              </p>

              <div className="space-y-2 pt-1">
                <a
                  href={counselorWaUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-2xl shadow-sm hover:shadow transition-all cursor-pointer"
                >
                  <svg className="w-4 h-4 fill-white" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                  </svg>
                  <span>{lang === 'bn' ? 'কাউন্সেলরকে হোয়াটসঅ্যাপ করুন' : 'WhatsApp Counselor'}</span>
                </a>

                <a
                  href={`tel:${counselorPhone}`}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-2xl transition-colors"
                >
                  <Phone size={14} />
                  <span>{lang === 'bn' ? 'সরাসরি কল দিন' : 'Call Directly'}</span>
                </a>
              </div>

              {/* Head Office Helpline */}
              <div className="pt-3 border-t border-slate-100 text-xs text-slate-500 space-y-1">
                <p className="font-bold text-slate-700">EduExpress International (Dhaka)</p>
                <p className="flex items-center gap-1.5"><MapPin size={12} className="text-slate-400" /> ধানমন্ডি, ঢাকা, বাংলাদেশ</p>
                <p className="flex items-center gap-1.5"><Phone size={12} className="text-slate-400" /> হটলাইন: +880 1886-932822</p>
              </div>
            </section>
          </div>

          {/* RIGHT: Universities & Document Checklist */}
          <div className="lg:col-span-2 space-y-6">

            {/* University Applications */}
            {universities.length > 0 && (
              <section className="bg-white rounded-3xl shadow-sm border border-slate-200/90 overflow-hidden">
                <div className="px-6 sm:px-8 py-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                  <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                    <Building2 size={18} className="text-blue-600" />
                    {lang === 'bn' ? 'আবেদনকৃত বিশ্ববিদ্যালয়সমূহ' : 'Applied Universities'}
                  </h2>
                  <span className="text-xs font-bold text-slate-500 bg-white border border-slate-200 px-2.5 py-0.5 rounded-full">
                    {universities.length} {lang === 'bn' ? 'টি বিশ্ববিদ্যালয়' : 'Universities'}
                  </span>
                </div>

                <div className="p-6 sm:p-8 space-y-3.5">
                  {universities.map((u) => {
                    const statusObj = UNI_STATUS_LABEL[u.status] || { en: u.status, bn: u.status };
                    const cls = UNI_STATUS_CLS[u.status] || 'bg-slate-100 text-slate-700 border-slate-200';
                    return (
                      <div key={u.id} className="p-4 sm:p-5 rounded-2xl border border-slate-200/80 bg-white hover:border-slate-300 transition-all shadow-2xs">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div>
                            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                              {u.university}
                              {u.country && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                                  {u.country}
                                </span>
                              )}
                            </h3>
                            <p className="text-xs text-slate-600 mt-1 font-medium">
                              Major: <strong className="text-slate-800">{u.program || student.major || 'Degree Program'}</strong>
                            </p>
                          </div>

                          <span className={`inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-extrabold border w-fit ${cls}`}>
                            {lang === 'bn' ? statusObj.bn : statusObj.en}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Requested Missing Documents */}
            {requested.length > 0 && (
              <section className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-3xl overflow-hidden shadow-xs">
                <div className="px-6 sm:px-8 py-5 border-b border-amber-200/60 flex items-center gap-2">
                  <Upload size={18} className="text-amber-600" />
                  <h2 className="text-base font-extrabold text-amber-900">
                    {lang === 'bn' ? 'জরুরি: প্রয়োজনীয় ডকুমেন্টস জমা দিন' : 'Action Required: Documents Needed'}
                  </h2>
                </div>
                <div className="p-6 sm:p-8">
                  <p className="text-xs text-amber-800 mb-5 bg-white/70 p-3.5 rounded-2xl border border-amber-100 leading-relaxed font-medium">
                    {lang === 'bn'
                      ? 'নিচের ডকুমেন্টটি গুগল ড্রাইভে আপলোড করে "Anyone with the link" শেয়ার পারমিশন দিয়ে লিংকটি পেস্ট করে সাবমিট করুন।'
                      : 'Upload the requested document to Google Drive, set permission to "Anyone with the link", and paste the link below.'}
                  </p>
                  <div className="space-y-3.5">
                    {requested.map((d) => (
                      <RequestedDoc key={d.id} doc={d} token={token} onUpdated={load} lang={lang} />
                    ))}
                  </div>
                </div>
              </section>
            )}

            {/* Submitted & Verified Documents */}
            {submitted.length > 0 && (
              <section className="bg-white rounded-3xl shadow-sm border border-slate-200/90 overflow-hidden">
                <div className="px-6 sm:px-8 py-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                  <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                    <FileText size={18} className="text-blue-600" />
                    {lang === 'bn' ? 'জমা দেওয়া ডকুমেন্ট ভল্ট' : 'Document Repository'}
                  </h2>
                  <span className="text-xs font-bold text-slate-500 bg-white border border-slate-200 px-2.5 py-0.5 rounded-full">
                    {submitted.length} {lang === 'bn' ? 'টি ফাইল' : 'Files'}
                  </span>
                </div>
                <div className="p-6 sm:p-8">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {submitted.map((d) => {
                      const st = DOC_STATUS_LABEL[d.status] || { en: d.status, bn: d.status };
                      const isVerified = d.status === 'verified';
                      return (
                        <div key={d.id} className="p-3.5 rounded-2xl border border-slate-100 bg-slate-50/60 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-800 truncate">{d.doc_type}</p>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md mt-1 inline-block ${
                              isVerified ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                            }`}>
                              {lang === 'bn' ? st.bn : st.en}
                            </span>
                          </div>
                          {d.student_uploaded_url && (
                            <a
                              href={ensureAbsoluteUrl(d.student_uploaded_url)}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-600 hover:text-blue-800 text-xs font-bold flex items-center gap-1"
                            >
                              <span>{lang === 'bn' ? 'ফাইল দেখুন' : 'View'}</span>
                              <ExternalLink size={11} />
                            </a>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>
            )}

            {/* Direct Message Thread with Admissions Team */}
            <section className="bg-white rounded-3xl shadow-sm border border-slate-200/90 overflow-hidden">
              <div className="px-6 sm:px-8 py-5 border-b border-slate-100 bg-slate-50/50">
                <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <MessageSquare size={18} className="text-blue-600" />
                  {lang === 'bn' ? 'কাউন্সেলিং টিমের সাথে মেসেজ' : 'Messages with Admissions Team'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {lang === 'bn'
                    ? 'আপনার ফাইলের ব্যাপারে কোনো নোট বা জিজ্ঞাসা থাকলে সরাসরি এখানে লিখুন'
                    : 'Send a note or question directly to your counselor timeline'}
                </p>
              </div>

              <div className="p-6 sm:p-8 space-y-4">
                <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                  {thread.length === 0 ? (
                    <div className="text-center py-8 text-xs text-slate-400 italic">
                      {lang === 'bn' ? 'এখনো কোনো মেসেজ হিস্ট্রি নেই।' : 'No messages yet.'}
                    </div>
                  ) : (
                    thread.map((m) => {
                      const fromStudent = m.type === 'student_doc_upload' || (m.details && String(m.details).includes('[via student portal]'));
                      return (
                        <div key={m.id} className={`flex ${fromStudent ? 'justify-end' : 'justify-start'}`}>
                          <div
                            className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed ${
                              fromStudent
                                ? 'bg-blue-600 text-white rounded-tr-xs'
                                : 'bg-slate-100 text-slate-800 rounded-tl-xs'
                            }`}
                          >
                            {!fromStudent && (
                              <p className="text-[10px] font-bold opacity-60 mb-1 uppercase tracking-wider">
                                {m.actor_name || 'EduExpress Admissions'}
                              </p>
                            )}
                            <p className="whitespace-pre-wrap">{m.details || m.message}</p>
                            <p className="text-[9px] mt-1.5 opacity-60">
                              {new Date(m.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <ThreadInput token={token} onSent={load} lang={lang} />
              </div>
            </section>

          </div>
        </div>

      </main>

      {/* ─── Share & QR Code Modal ─── */}
      {showQR && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden p-6 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-900">Student Portal QR</h3>
              <button onClick={() => setShowQR(false)} className="text-slate-400 hover:text-slate-700 p-1 rounded-full cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="flex flex-col items-center py-2">
              <div className="p-3 bg-white border-2 border-slate-100 rounded-2xl shadow-xs mb-3">
                <img
                  id="student-qr-code"
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(portalUrl)}`}
                  alt="Student Portal QR Code"
                  className="w-[200px] h-[200px] rounded-lg"
                />
              </div>
              <h4 className="text-lg font-bold text-slate-900">{student.name}</h4>
              <p className="text-xs text-slate-500 font-mono">ID: {student.ref_id}</p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(portalUrl);
                  alert(lang === 'bn' ? 'পোর্টাল লিংক কপি হয়েছে!' : 'Portal link copied to clipboard!');
                }}
                className="flex-1 flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-xl font-bold text-xs transition-colors cursor-pointer"
              >
                <Share2 size={14} /> {lang === 'bn' ? 'লিংক কপি' : 'Copy Link'}
              </button>
              <button
                onClick={downloadQR}
                className="flex-1 flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl font-bold text-xs shadow-sm transition-colors cursor-pointer"
              >
                <Download size={14} /> {lang === 'bn' ? 'QR সেভ করুন' : 'Save QR'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function RequestedDoc({ doc, token, onUpdated, lang }) {
  const [url, setUrl] = useState(doc.student_uploaded_url || '');
  const [saving, setSaving] = useState(false);
  const done = !!doc.student_uploaded_url && doc.student_uploaded_url === url;

  const save = async () => {
    if (!url || done) return;
    setSaving(true);
    try {
      await api.studentUploadDoc(token, doc.id, url);
      onUpdated(true);
    } catch (e) {
      alert(e.message);
    }
    setSaving(false);
  };

  return (
    <div className="bg-white p-4 rounded-2xl border border-amber-200 shadow-2xs">
      <div className="flex items-center gap-2 mb-2">
        <FileText size={15} className="text-amber-600" />
        <p className="text-xs font-bold text-slate-900">{doc.doc_type}</p>
      </div>
      <div className="flex gap-2">
        <input
          type="url"
          placeholder="https://drive.google.com/..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="flex-1 min-w-0 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all placeholder:text-slate-400"
        />
        <button
          onClick={save}
          disabled={saving || !url || done}
          className="bg-amber-600 hover:bg-amber-700 disabled:bg-amber-300 text-white font-bold px-4 py-2 rounded-xl text-xs transition-colors whitespace-nowrap shadow-xs cursor-pointer"
        >
          {saving ? '...' : done ? (lang === 'bn' ? 'আপডেট হয়েছে' : 'Updated') : (lang === 'bn' ? 'জমা দিন' : 'Submit Link')}
        </button>
      </div>
    </div>
  );
}

function ThreadInput({ token, onSent, lang }) {
  const [msg, setMsg] = useState('');
  const [sending, setSending] = useState(false);

  const send = async (e) => {
    e.preventDefault();
    if (!msg.trim()) return;
    setSending(true);
    try {
      await api.studentMessage(token, msg);
      setMsg('');
      onSent(true);
    } catch (err) {
      alert(err.message);
    }
    setSending(false);
  };

  return (
    <form onSubmit={send} className="flex gap-2">
      <input
        type="text"
        placeholder={lang === 'bn' ? 'কাউন্সেলরকে কোনো প্রশ্ন বা আপডেট লিখুন...' : 'Type a question or note for your counselor...'}
        value={msg}
        onChange={(e) => setMsg(e.target.value)}
        className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-slate-400"
      />
      <button
        type="submit"
        disabled={sending || !msg.trim()}
        className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white px-4 py-2.5 rounded-xl font-bold text-xs transition-all shadow-xs flex items-center justify-center cursor-pointer"
      >
        <Send size={14} />
      </button>
    </form>
  );
}
