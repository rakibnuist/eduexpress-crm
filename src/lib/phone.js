export const COUNTRY_CODES = {
  'Bangladesh': '88',
  'India': '91',
  'Pakistan': '92',
  'Nepal': '977',
  'Sri Lanka': '94',
  'China': '86',
  'Malaysia': '60',
  'United Arab Emirates': '971',
  'United Kingdom': '44',
  'United States': '1',
  'Canada': '1',
  'Australia': '61'
};

export const formatPhoneDisplay = (phone, nationality) => {
  if (!phone) return '';
  let clean = phone.replace(/[^\d+]/g, '');
  if (!clean.startsWith('+')) {
     const code = COUNTRY_CODES[nationality] || '88';
     // Default BD prefix rules
     if (code === '88' && clean.startsWith('01') && clean.length === 11) {
       clean = '+' + code + clean;
     } else if (clean.startsWith('0')) {
       clean = '+' + code + clean.substring(1);
     } else if (!clean.startsWith(code)) {
       clean = '+' + code + clean;
     } else {
       clean = '+' + clean;
     }
  }
  return clean;
};

export const WA_TEMPLATES = {
  initial: (lead) => {
    const name = lead?.client_name || lead?.name || 'শিক্ষার্থী';
    const dest = lead?.destination || 'চায়না';
    const lastEdu = lead?.last_education || lead?.degree;
    const gpa = lead?.gpa;
    const eduInfo = lastEdu ? ` (${lastEdu}${gpa ? `, GPA: ${gpa}` : ''})` : '';
    return `আসসালামু আলাইকুম ${name}, এডুএক্সপ্রেস ইন্টারন্যাশনাল (ধানমন্ডি, ঢাকা) থেকে কাউন্সেলিং টিম বলছি। আপনি ${dest}-এ উচ্চশিক্ষা ও স্কলারশিপের ব্যাপারে অনুসন্ধান করেছিলেন। আপনার প্রোফাইল${eduInfo} অনুযায়ী এডমিশন ও উপযুক্ত স্কলারশিপ সুযোগ নিয়ে বিস্তারিত আলোচনা করতে আমরা কি কথা বলতে পারি?`;
  },
  documents: (lead) => {
    const name = lead?.client_name || lead?.name || 'শিক্ষার্থী';
    const dest = lead?.destination || 'চায়না';
    return `আসসালামু আলাইকুম ${name}, এডুএক্সপ্রেস ইন্টারন্যাশনাল থেকে বলছি। ${dest}-এ আপনার কাঙ্ক্ষিত প্রোগ্রামের স্কলারশিপ অ্যাপ্লিকেশন রেডি করার জন্য অনুগ্রহ করে আপনার এসএসসি/এইচএসসি/অনার্সের সার্টিফিকেট, মার্কশিট ও পাসপোর্টের স্ক্যান কপি আমাদের হোয়াট্‌সঅ্যাপে পাঠান। ধন্যবাদ!`;
  },
  office_visit: (lead) => {
    const name = lead?.client_name || lead?.name || 'শিক্ষার্থী';
    return `আসসালামু আলাইকুম ${name}, এডুএক্সপ্রেস ইন্টারন্যাশনাল অফিসে আপনাকে স্বাগতম! আপনার প্রোফাইল মূল্যায়ন ও ভিসা প্রসেসিং নিয়ে সরাসরি অভিজ্ঞ কাউন্সেলরের সাথে পরামর্শ করতে আমাদের ধানমন্ডি অফিসে আমন্ত্রণ জানাচ্ছি। ঠিকানা: এডুএক্সপ্রেস ইন্টারন্যাশনাল, ধানমন্ডি, ঢাকা।`;
  },
  portal_invite: (lead, portalUrl) => {
    const name = lead?.client_name || lead?.name || 'শিক্ষার্থী';
    const dest = lead?.destination || 'চায়না';
    return `আসসালামু আলাইকুম ${name}, এডুএক্সপ্রেস ইন্টারন্যাশনাল-এ আপনার ${dest} উচ্চশিক্ষা ও স্কলারশিপ ফাইল প্রসেসিং শুরু হয়েছে। আপনার ফাইলের লাইভ অগ্রগতি (Application Submitted ➔ University Review ➔ Admission Notice ➔ JW202/DQ Permit ➔ Embassy Visa ➔ Flight) ঘরে বসেই ট্র্যাক করতে এই সিকিউর পোর্টালটি ব্যবহার করুন:\n\n🔗 ${portalUrl}\n\nযেকোনো তথ্যের জন্য আমাদের কাউন্সেলিং টিম সর্বদা আপনার পাশে রয়েছে। ধন্যবাদ!`;
  }
};

export const getWAUrl = (phone, nationality, message) => {
  if (!phone) return '#';
  let formatted = formatPhoneDisplay(phone, nationality);
  const clean = formatted.replace(/\D/g, '');
  if (!clean) return '#';
  let url = `https://wa.me/${clean}`;
  if (message) {
    url += `?text=${encodeURIComponent(message)}`;
  }
  return url;
};
