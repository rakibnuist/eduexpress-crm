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

export const getWAUrl = (phone, nationality) => {
  if (!phone) return '#';
  let formatted = formatPhoneDisplay(phone, nationality);
  return `https://wa.me/${formatted.replace(/\D/g, '')}`;
};
