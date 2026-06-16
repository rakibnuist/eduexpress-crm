// Pre-built automation templates, tags, and rules for EduExpress
// Loaded at runtime by server.js to keep the main file small

module.exports = {
  templates: [
    { name: 'Welcome — New Inquiry', category: 'Greeting', language: 'English', content: 'Hello {{name}}! Welcome to EduExpress International 🎓\n\nWe help students study in China, Malaysia, South Korea, Hungary, Malta, Cyprus, and Georgia.\n\nYour consultant {{consultant}} will assist you shortly. Please share your academic details so we can guide you better.\n\n📞 +880 1840-757595\n🌐 eduexpressint.com', variables: 'name,consultant', approved: 1 },
    { name: 'Welcome — Bengali', category: 'Greeting', language: 'Bengali', content: 'আসসালামু আলাইকুম {{name}}! 🎓\n\nEduExpress International-এ আপনাকে স্বাগতম। আমরা চীন, মালয়েশিয়া, দক্ষিণ কোরিয়া, হাঙ্গেরি, মাল্টা, সাইপ্রাস এবং জর্জিয়ায় পড়াশোনার সুযোগ দিয়ে থাকি।\n\nআপনার কনসালট্যান্ট {{consultant}} শীঘ্রই আপনাকে সাহায্য করবেন। দয়া করে আপনার একাডেমিক তথ্য শেয়ার করুন।\n\n📞 +880 1840-757595', variables: 'name,consultant', approved: 1 },
    { name: 'After-Hours Auto-Reply', category: 'Greeting', language: 'English', content: 'Hi {{name}}! 👋\n\nThank you for reaching out to EduExpress International. Our office is currently closed.\n\n🕐 Office Hours: Sunday–Thursday, 9:00 AM – 6:00 PM (Bangladesh Time)\n\nWe will get back to you as soon as we open. For urgent matters, please call: +880 1840-757595', variables: 'name', approved: 1 },
    { name: 'After-Hours — Bengali', category: 'Greeting', language: 'Bengali', content: 'হাই {{name}}! 👋\n\nEduExpress International-এ যোগাযোগ করার জন্য ধন্যবাদ। আমাদের অফিস এখন বন্ধ।\n\n🕐 অফিস সময়: রবিবার–বৃহস্পতিবার, সকাল ৯টা – সন্ধ্যা ৬টা\n\nআমরা অফিস খোলার সাথে সাথেই আপনাকে জানাবো। জরুরি প্রয়োজনে কল করুন: +880 1840-757595', variables: 'name', approved: 1 },
    { name: 'Fee Inquiry Reply', category: 'Follow-up', language: 'English', content: 'Hi {{name}}! 💰\n\nOur service fees vary by destination and university. Here is a general overview:\n\n🇨🇳 China: ৳50,000–৳80,000\n🇲🇾 Malaysia: ৳60,000–৳90,000\n🇰🇷 South Korea: ৳80,000–৳120,000\n🇭🇺 Hungary: ৳70,000–৳100,000\n\nTuition fees are separate and vary by program. Would you like to schedule a free consultation with {{consultant}}?', variables: 'name,consultant', approved: 1 },
    { name: 'Scholarship Info', category: 'Follow-up', language: 'English', content: 'Hi {{name}}! 🏆\n\nWe have scholarship opportunities for many destinations!\n\n🇨🇳 China: CSC Scholarship (full tuition + stipend)\n🇭🇺 Hungary: Stipendium Hungaricum (full tuition + monthly allowance)\n🇰🇷 South Korea: KGSP (full tuition + living expenses)\n\nRequirements vary by program. Would you like us to assess your eligibility?', variables: 'name', approved: 1 },
    { name: 'Office Visit Invitation', category: 'Follow-up', language: 'English', content: 'Hi {{name}}! 📍\n\nWe would love to meet you in person at our office:\n\nEduExpress International\nHouse #12, Road #7, Dhanmondi, Dhaka\n\nPlease visit us Sunday–Thursday, 9 AM–6 PM. We can discuss your study options, check your documents, and guide you step-by-step.\n\nSee you soon! 🎓', variables: 'name', approved: 1 },
    { name: 'Document Checklist', category: 'Follow-up', language: 'English', content: 'Hi {{name}}! 📋\n\nPlease prepare the following documents for your application:\n\n1. Passport (valid for 6+ months)\n2. Academic transcripts & certificates\n3. Police clearance certificate\n4. Medical fitness certificate\n5. Bank statement (3–6 months)\n6. Passport-size photos (white background)\n\nSend them to {{consultant}} and we will start your application immediately!', variables: 'name,consultant', approved: 1 },
    { name: 'Follow-Up — No Response', category: 'Follow-up', language: 'English', content: 'Hi {{name}}! 👋\n\nWe noticed you haven\'t replied to our last message. We wanted to check if you need any help with your study abroad plans.\n\nFeel free to ask us anything — we are here to help! 🎓', variables: 'name', approved: 1 },
    { name: 'Application Submitted', category: 'Closing', language: 'English', content: 'Great news, {{name}}! 🎉\n\nYour application has been submitted to {{destination}}. We will update you once we receive the admission decision.\n\nNext steps:\n1. Wait for JW202 / admission letter\n2. Apply for visa\n3. Book flight & accommodation\n\nYour consultant {{consultant}} will guide you through each step. Stay tuned! ✈️', variables: 'name,destination,consultant', approved: 1 },
    { name: 'Office Address & Contact', category: 'General', language: 'English', content: 'Hi {{name}}! 📍\n\nVisit our office at:\n\n🏢 EduExpress International\n📍 House #12, Road #7, Dhanmondi, Dhaka-1209, Bangladesh\n\n📞 Hotline: +880 1840-757595\n📧 Email: info@eduexpressint.com\n🌐 Website: eduexpressint.com\n\n🕐 Office Hours: Sunday–Thursday, 9:00 AM – 6:00 PM (Bangladesh Time)\n🗓️ Closed: Friday & Saturday\n\n📍 Google Maps: https://maps.google.com/?q=23.7452,90.3782\n\nWe look forward to meeting you! 🎓', variables: 'name', approved: 1 },
    { name: 'Office Address — Bengali', category: 'General', language: 'Bengali', content: 'হাই {{name}}! 📍\n\nআমাদের অফিসে আসুন:\n\n🏢 EduExpress International\n📍 হাউস #12, রোড #7, ধানমন্ডি, ঢাকা-1209, বাংলাদেশ\n\n📞 হটলাইন: +880 1840-757595\n📧 ইমেইল: info@eduexpressint.com\n🌐 ওয়েবসাইট: eduexpressint.com\n\n🕐 অফিস সময়: রবিবার–বৃহস্পতিবার, সকাল ৯টা – সন্ধ্যা ৬টা\n🗓️ বন্ধ: শুক্রবার ও শনিবার\n\n📍 গুগল ম্যাপ: https://maps.google.com/?q=23.7452,90.3782\n\nআপনাকে দেখা পেয়ে খুশি হব! 🎓', variables: 'name', approved: 1 },
  ],

  tags: [
    { name: 'China', color: '#ef4444' },
    { name: 'Malaysia', color: '#f97316' },
    { name: 'South Korea', color: '#84cc16' },
    { name: 'Hungary', color: '#10b981' },
    { name: 'Malta', color: '#06b6d4' },
    { name: 'Cyprus', color: '#3b82f6' },
    { name: 'Georgia', color: '#8b5cf6' },
    { name: 'Scholarship', color: '#ec4899' },
    { name: 'VIP', color: '#f59e0b' },
    { name: 'B2B', color: '#64748b' },
    { name: 'Priority', color: '#dc2626' },
    { name: 'No Response', color: '#94a3b8' },
  ],

  defaultRules: [
    { name: 'Welcome — New WhatsApp Inquiry', trigger_type: 'new_conversation', trigger_config: '{}', action_type: 'reply', action_template: 'Welcome — New Inquiry', priority: 8 },
    { name: 'After-Hours Office Reply', trigger_type: 'keyword', trigger_config: { keywords: ['hello', 'hi', 'hey', 'asalamu', 'salam', 'assalamu'], match_type: 'contains' }, action_type: 'reply', action_template: 'After-Hours Auto-Reply', priority: 7 },
    { name: 'Auto-Reply: Fee Inquiry', trigger_type: 'keyword', trigger_config: { keywords: ['fee', 'cost', 'price', 'tk', 'taka', 'charge', 'money'], match_type: 'contains' }, action_type: 'reply', action_template: 'Fee Inquiry Reply', priority: 6 },
    { name: 'Auto-Reply: Scholarship Inquiry', trigger_type: 'keyword', trigger_config: { keywords: ['scholarship', 'full free', 'stipend', 'csc', 'stipendium'], match_type: 'contains' }, action_type: 'reply', action_template: 'Scholarship Info', priority: 6 },
    { name: 'Auto-Create Lead from New Chat', trigger_type: 'new_conversation', trigger_config: '{}', action_type: 'create_lead', priority: 5 },
    { name: 'Auto-Reply: Office Address & Contact', trigger_type: 'keyword', trigger_config: { keywords: ['address', 'office', 'location', 'map', 'where is your office', 'direction', 'dhaka', 'dhanmondi', 'visit office', 'office address', 'contact details', 'how to reach', 'phone number'], match_type: 'contains' }, action_type: 'reply', action_template: 'Office Address & Contact', priority: 6 },
  ],
};
