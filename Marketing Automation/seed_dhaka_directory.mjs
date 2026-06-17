#!/usr/bin/env node
/**
 * Seeds CRM Competitor Intel from Dhaka_Education_Consultancy_Directory.xlsx (120 consultancies).
 * Matches seed_competitors.mjs: idempotent-by-competitor (skips names already present), retries on transient errors.
 *
 * Run:      node seed_dhaka_directory.mjs
 * Preview:  DRY=1 node seed_dhaka_directory.mjs
 * Override: BASE=https://crm.eduexpressint.com API_KEY=eduexpress-n8n-2024 node seed_dhaka_directory.mjs
 */
const BASE = process.env.BASE || 'https://crm.eduexpressint.com';
const KEY  = process.env.API_KEY || 'eduexpress-n8n-2024';
const DRY  = process.env.DRY === '1';
const H = { 'Content-Type':'application/json','x-api-key':KEY,'Accept':'application/json','User-Agent':'EduExpress-Seeder/1.0','Connection':'close' };
const TODAY = new Date().toISOString().slice(0,10);
const sleep = ms => new Promise(r=>setTimeout(r,ms));
const isTransient = e => /ECONNRESET|fetch failed|ETIMEDOUT|EAI_AGAIN|socket hang up|UND_ERR/i.test(`${e.message} ${e.cause?.code||''}`);
async function req(path,opts={},tries=5){ for(let i=1;i<=tries;i++){ try{ const r=await fetch(`${BASE}/api/marketing/${path}`,{headers:H,...opts}); if(!r.ok) throw new Error(`${opts.method||'GET'} ${path} → ${r.status} ${await r.text()}`); const t=await r.text(); return t?JSON.parse(t):{}; }catch(e){ if(i<tries&&isTransient(e)){ await sleep(700*i); continue;} throw e; } } }

const ROWS = [
  {
    "competitor": "HOQUE CONSULTANCY",
    "channel": "Facebook, Website",
    "observation": "[Directory] Educational consultant · ⭐4.8 (76 reviews) · Tower 129,Green Landmark,12D Mirpur Rd,Dhaka 1205 · ☎888801979577891 · ✉info@hclimited.org.uk",
    "link": "https://www.hclimited.org.uk/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "Helpline Global Education Consultant",
    "channel": "Facebook, Website",
    "observation": "[Directory] Consultant · ⭐4.9 (68 reviews) · Level 9,Haque Chamber,89/2 Panthapath,Dhaka 1215 · ☎888801711536477 · ✉info@helplinebd.net",
    "link": "http://www.helplinebd.net/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "Centre For Education - Dhaka",
    "channel": "Facebook, Website",
    "observation": "[Directory] Educational consultant · ⭐4.6 (30 reviews) · 4th Floor,Mir Noor Square, H-43, Road No. 2,Dhanmondi R/A,Dhaka 1205 · ☎8801711 · ✉dhaka@cfeuk.com,info@cfeuk.com",
    "link": "http://www.cfeuk.com/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "Rongdhonu Education Consultancy",
    "channel": "Facebook, Website",
    "observation": "[Directory] Educational consultant · ⭐5 (6 reviews) · House- 17,Besides Japan Bangladesh Friendship Hospital,3 Rd 3A,Dhaka 1205 · ☎8801759 · ✉rongdhonuedu@gmail.com,rongdhonuedu.syl23@gmail.com",
    "link": "https://www.rongdhonuedu.com/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "World Wide Education Bd",
    "channel": "Facebook, Website",
    "observation": "[Directory] Educational consultant · ⭐4.9 (46 reviews) · House: 20/2 (5th floor), West Panthapath,Opposite side of Square Hospital (Near Hot cake),Dhaka 1205 · ☎8801300 · ✉admin@wwedubd.com,office.wwedubd@gmail.com",
    "link": "https://www.wwedubd.com/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "GRC Education",
    "channel": "Facebook, Website",
    "observation": "[Directory] Educational consultant;Consultant;Education center;Educational institution;English language camp;English language school;German language school;Student career counseling office;Students support association;Visa consulting service · ⭐4.7 (63 reviews) · Mir Taj Square (8th Floor), 63/C, Lake Circus,West Panthapath,Dhaka 1205 · ☎8801613 · ✉support@grcbangladesh.com",
    "link": "https://www.grcbangladesh.com/grc/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "Axiom Education & Immigration",
    "channel": "Facebook, Website",
    "observation": "[Directory] Educational consultant;Immigration & naturalization service;Language school;Travel agency · ⭐4.4 (40 reviews) · 6/A,4th Floor,Satmasjid Road,Dhaka 1209 · ☎8801714 · ✉info@studyabroadonline.com,hr@studyabroadonline.com",
    "link": "http://www.studyabroadonline.com/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "NICE Education Consultants [Highly Trusted Study Abroad Agency in Bangladesh since 2000]",
    "channel": "Website",
    "observation": "[Directory] Educational consultant;Counselor;English language school;Foreign languages program school · ⭐5 (26 reviews) · Suite # 541,R H Home Centre,74/B, 1 Green Rd,Dhaka 1205 · ☎8801713",
    "link": "http://niceeducation.net/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "Outdoor Study Consultancy Firm Bangladesh",
    "channel": "Facebook, Website",
    "observation": "[Directory] Educational consultant;Consultant;Student career counseling office · ⭐5 (1 reviews) · House : 17/2, Level: 8801,Road No. 3A,Dhaka 1209 · ☎8801712 · ✉info@outdoorstudybd.com",
    "link": "https://outdoorstudybd.com/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "Education Connect Dhaka",
    "channel": "Facebook, Website",
    "observation": "[Directory] Educational consultant · ⭐5 (64 reviews) · Level 3, Gazi Tower,151/6 Green Road,Panthapath,Dhaka 1205 · ☎09606 · ✉sydney@educationconnect.com.au,dhaka@educationconnect.com.au,chattogram@educationconnect.com.au,nepal@educationconnect.com.au,perth@educationconnect.com.au,enquiry@educationconnect.com.au",
    "link": "https://educationconnect.com.au/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "Eduko Pathways Bangladesh",
    "channel": "Website",
    "observation": "[Directory] Educational consultant · ⭐4.9 (43 reviews) · House 5, Level 8,Road No. 16,Dhaka 1209 · ☎09614",
    "link": "https://edukopathwaysbd.com/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "IDP Education Bangladesh - Study Abroad Consultants in Dhanmondi Dhaka",
    "channel": "Facebook, Website",
    "observation": "[Directory] Educational consultant;Consultant;Student career counseling office · ⭐4.4 (426 reviews) · Level 8, Green Rowshanara Tower (Opposite of Abahani Field),755 Satmasjid Road,Dhanmondi,Dhaka 1209 · ☎09666",
    "link": "https://www.idp.com/bangladesh/?utm_source=local&utm_medium=organic&utm_campaign=gmb&utm_term=cta-website&utm_content=dhanmondi",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "Pinnacle Consultancy Group",
    "channel": "Facebook, Website",
    "observation": "[Directory] Educational consultant · ⭐3.9 (90 reviews) · BAY’S PARK HEIGHTS, Level-06, House-02, Road-09,Near Kalabagan Bus Stand, Mirpur RD,Dhanmondi, Dhaka-1205,Dhaka 1205 · ☎8801322 · ✉info@pinnacle-bd.com",
    "link": "https://pinnacle-bd.com/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "Global Education Consultant",
    "channel": "Facebook, Website",
    "observation": "[Directory] Educational consultant · ⭐4 (1 reviews) · 44/14, Level 8,Sekander Heighs,West Panthapath,Dhaka 1205 · ☎8801931 · ✉infogecdb@gmail.com,20infogecdb@gmail.com",
    "link": "https://www.globaleducationbd.com/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "SM Global Education",
    "channel": "Unknown",
    "observation": "[Directory] Educational consultant · ⭐5 (16 reviews) · 89/2,Haque Chamber,West Panthapath,Dhaka 1215 · ☎8801717",
    "link": "",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "Career Paths",
    "channel": "Facebook, Website",
    "observation": "[Directory] Educational consultant · ⭐4.8 (1391 reviews) · House no,102 Park Rd,Dhaka 1212 · ☎8801970 · ✉20info@careerpaths.com.bd,info@careerpaths.com.bd",
    "link": "https://careerpaths.com.bd/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "SamSwiss Study Abroad Ltd.",
    "channel": "Website",
    "observation": "[Directory] Educational consultant · ⭐5 (31 reviews) · 44/9,Haque Tower,Level 4, West Panthapath,Dhaka 1205 · ☎09611",
    "link": "http://www.samswiss.com.bd/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "Bright Pathway Education Consultancy",
    "channel": "Website",
    "observation": "[Directory] Consultant · House 21 Road No. 9A,Dhaka 1209 · ☎8801804",
    "link": "https://brightpathwayec.com/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "EducationUSA Advising Center",
    "channel": "Website",
    "observation": "[Directory] Educational consultant · ⭐4.5 (320 reviews) · Road No. 16 House No. 05 Midas Center (9th Floor),Dhaka 1209 · ☎8801703 · ✉educationusa@state.gov",
    "link": "https://educationusa.state.gov/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "Global Education Care Dhaka Office",
    "channel": "Facebook, Website",
    "observation": "[Directory] Educational consultant · ⭐4.8 (13 reviews) · 3rd floor,56 - Lake Circus,West Panthapath,Dhaka 1205 · ☎09611 · ✉info@gecare.co.uk",
    "link": "http://www.gecare.co.uk/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "KSC CANDID",
    "channel": "Unknown",
    "observation": "[Directory] Educational consultant · ⭐5 (1 reviews) · House No. 69,2 Rd No. 7A,Dhaka 1209 · ☎nan",
    "link": "",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "UCA Education Consultancy",
    "channel": "Facebook, Website",
    "observation": "[Directory] Educational consultant · ⭐5 (12 reviews) · সাইন্সল্যাব,33 Mirpur Rd,1205 · ☎8801841 · ✉dhaka@uca4u.com,global@uca4u.com,info@uca4u.com",
    "link": "https://www.uca4u.com/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "HBD Services Bangladesh",
    "channel": "Facebook, Website",
    "observation": "[Directory] Educational consultant;Student career counseling office · ⭐4.9 (469 reviews) · 7th Floor 27,Standard Centre,1 New Eskaton Road,Dhaka 1000 · ☎09617 · ✉info@hbdservices.com",
    "link": "http://www.hbdservices.com/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "EduCareBD",
    "channel": "Facebook, Website",
    "observation": "[Directory] Educational consultant · ⭐4.8 (20 reviews) · 147/H, Green Road, Darul Huda Bhaban,,Lift- 05, (Near Panthapath signal),Dhaka 1215 · ☎8801711 · ✉info@educarebd.net",
    "link": "https://www.educarebd.net/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "NRC Educational Consultants",
    "channel": "Website",
    "observation": "[Directory] Educational consultant · 8/A (Old,Keari Plaza:,Room-509, Level-4, 15 Satmasjid Road,Dhaka 1209 · ☎8801812",
    "link": "https://nrclondon.co.uk/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "uniThink - Study Abroad | Best Education Consultancy Firm in Bangladesh",
    "channel": "Website",
    "observation": "[Directory] Educational consultant · ⭐4.9 (28 reviews) · 74/B,R H Home Centre,Suite 106-107, 1st Floor, 1 Green Rd,Dhaka 1215 · ☎8801988",
    "link": "http://unithink.co/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "Orbit Education BD",
    "channel": "Website",
    "observation": "[Directory] Educational consultant · ⭐5 (7 reviews) · House No-18801,Level-04,BVCL OFFICE,Dhanmondi Road No-32, Mirpur Rd,Dhaka 1209 · ☎8801706",
    "link": "https://orbiteducationbd.com/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "Sunshine Global Consultant",
    "channel": "Website",
    "observation": "[Directory] Educational consultant · ⭐5 (1 reviews) · 44/10, North Dhanmondi, Panthopath, Dhaka-1205 ( Opposite Of Samorita Hospital), Dhaka, Bangladesh,Dhaka 1205 · ☎8801676",
    "link": "https://sunshineglobalconsultant.com/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "Kompass Education and Visa Consultancy",
    "channel": "Facebook, Website",
    "observation": "[Directory] Educational consultant · ⭐4.6 (35 reviews) · 2nd Floor,56 Siddheswari Rd,Dhaka 1217 · ☎8801736 · ✉info@kompass.cc",
    "link": "https://www.kompass.cc/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "Uni Consultants - Study Abroad",
    "channel": "Website",
    "observation": "[Directory] Educational consultant · ⭐5 (9 reviews) · 7th Floor,Ali Bhaban,92 Kazi Nazrul Islam Ave,Dhaka 1215 · ☎8801603",
    "link": "http://www.uniconsultants.co.uk/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "Sunrise Education Consultants",
    "channel": "Facebook, Website",
    "observation": "[Directory] Educational consultant · ⭐4.1 (86 reviews) · House 61 (1st Floor,Block F Road 08,Dhaka 1213 · ☎8801811 · ✉info@sunrise-bd.net,ceo@sunrise-bd.net",
    "link": "http://sunrise-bd.net/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "Moves International Education and Migration - Bangladesh",
    "channel": "Website",
    "observation": "[Directory] Educational consultant · ⭐4.9 (54 reviews) · Floor 12, House- 43 Road- 2/A, Mir Noor Square (Beside BGB 4 No. Gate , Satmasjid Road,R/A,Dhaka 1209 · ☎8801304",
    "link": "https://movesinternational.com.bd/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "Prolance Education Consultancy",
    "channel": "Website",
    "observation": "[Directory] Educational consultant;Student career counseling office · Sekandar Heights (Samsung Building), Level 7, 44/14 West Panthapath, North,Dhanmondi, Dhaka 1205. Opposite of,Pubali Bank Ltd,Dhaka 1205 · ☎8801770",
    "link": "http://www.prolancebd.com/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "GIC Education Limited",
    "channel": "Facebook, Website",
    "observation": "[Directory] Educational consultant;Consultant;Visa consulting service · ⭐4.7 (706 reviews) · 8th floor,Tower of Aakash,plot 54/B Rd 132,Dhaka 1212 · ☎09678 · ✉info@gicbdedu.com",
    "link": "http://www.gicbdedu.com/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "Global Education Counselling - Bangladesh",
    "channel": "Unknown",
    "observation": "[Directory] Educational consultant;Counselor · ⭐4.5 (10 reviews) · House: 69/B, Road: 6/A,Dhanmondi,Dhaka 1206 · ☎nan",
    "link": "",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "Education At",
    "channel": "Facebook, Website",
    "observation": "[Directory] Consultant · ⭐4.6 (406 reviews) · House-45 (Flat-A4), Road-27, Block-A,Dhaka 1213 · ☎8801703 · ✉info@educationat.org",
    "link": "https://educationat.org/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "Ready To Study, Dhaka",
    "channel": "Website",
    "observation": "[Directory] Educational consultant · House 9, Road 13,New Sobhanbag Rd,1209 · ☎880198801 · ✉info@readytostudy.com",
    "link": "https://www.readytostudy.com.au/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "PFEC Global - Student Visa & Education Consultant in Banani",
    "channel": "Facebook, Website",
    "observation": "[Directory] Educational consultant · ⭐4.9 (337 reviews) · House no. 50, (7th Floor) RSR Tower,Block - C Rd No. 11,Dhaka 1213 · ☎09609 · ✉it.admin@pfecglobal.com",
    "link": "https://www.pfecglobal.com.bd/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "Scholars Zone",
    "channel": "Facebook, Website",
    "observation": "[Directory] Educational consultant · ⭐4.5 (143 reviews) · Bay’s Park Heights, Level & Lift 05, Plot-02, Road-09, Near Kalabagan Bus Stand, Dhanmondi,Dhaka 1205 · ☎8801714 · ✉contact@scholarszone.com.bd,support@scholarszone.com.bd",
    "link": "http://scholarszone.com.bd/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "4S Education Consultancy",
    "channel": "Unknown",
    "observation": "[Directory] Student career counseling office · ⭐4.6 (21 reviews) · 2/8, 4th Floor,Moni Kunjo,Dhaka 1207 · ☎nan",
    "link": "",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "DESH Education",
    "channel": "Website",
    "observation": "[Directory] Educational consultant · ⭐4.8 (38 reviews) · SUITE- 11 D,11TH FLOOR 27/1/B,ROAD NO-03,Dhaka 1207 · ☎8801711",
    "link": "http://www.desheducation.com/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "IJA STUDY CONSULTANCY BD",
    "channel": "Website",
    "observation": "[Directory] Educational consultant · ⭐5 (2 reviews) · Suite #538, 5th Floor,R H Home Centre,Dhaka 1215 · ☎8801327",
    "link": "http://ijastudy-bd.com/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "Study Abroad with MACES",
    "channel": "Facebook, Website",
    "observation": "[Directory] Educational consultant · ⭐4.8 (344 reviews) · 9th Floor,45 Gulshan Ave,Dhaka 1212 · ☎8801755",
    "link": "https://macesbd.com/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "Universal Education",
    "channel": "Facebook, Website",
    "observation": "[Directory] Educational consultant · ⭐3.8 (13 reviews) · 2nd floor, Haque Tower (44/9),West Panthapath (Opposite of Samorita Hospital),Dhaka, Bangladesh,Dhaka 1215 · ☎8801894 · ✉info@uiecglobal.com",
    "link": "https://uiecglobal.com/#",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "Global Study Limited",
    "channel": "Website",
    "observation": "[Directory] Educational consultant · ⭐4.5 (39 reviews) · Building -1,Hotel Intercontinental,2nd floor, BSL Office Complex, 1 Minto Rd,Dhaka 1000 · ☎8801913 · ✉sylhet@globalstudyltd.com,mymensingh@globalstudyltd.com",
    "link": "http://globalstudyonline.com/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "STUDY EXPRESS BD",
    "channel": "Website",
    "observation": "[Directory] Educational consultant · ⭐5 (10 reviews) · 63 Pantho Nibas-1(Flat B-1), Lake Circus,Dolphin Goli,Dhaka 1205 · ☎8801317",
    "link": "http://www.studyexpressbd.com/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "Boost Education Service | Student Consultancy Firm In Dhaka",
    "channel": "Website",
    "observation": "[Directory] Educational consultant · ⭐4.9 (65 reviews) · Level 14,Tropical Mollah tower,1212 Gulshan Badda Link Rd,Dhaka 1212 · ☎8801407",
    "link": "https://www.boosteducationservice.co.uk/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "Pacific Academics Education and Immigration Consultants",
    "channel": "Unknown",
    "observation": "[Directory] Educational consultant · ⭐5 (6 reviews) · Level -9,DK Tower,Sonargaon Road,Dhaka 1205 · ☎nan",
    "link": "",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "Pro Info & Edu Consultant",
    "channel": "Facebook, Website",
    "observation": "[Directory] Educational consultant · ⭐4.7 (107 reviews) · 15, Block-D,Al-Minar, House-37 (Level-3,& Rd Number 4,Dhaka 1213 · ☎8801799 · ✉admin@proinfoedu.com,ceo@proinfoedu.com,contact@proinfoedu.com",
    "link": "https://proinfoedu.com/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "GoEdu - Global Overseas Educational Consultancy Bangladesh",
    "channel": "Website",
    "observation": "[Directory] Educational consultant · ⭐4.6 (10 reviews) · 21,1 Pushporaj Saha Lane,Dhaka 1211 · ☎8801772",
    "link": "http://fb.com/goedubd",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "KC Overseas Education Dhaka",
    "channel": "Facebook, Website",
    "observation": "[Directory] Educational consultant · ⭐4.3 (129 reviews) · Concord Morning Glory, House#19 (5th Floor), Block#E,Road No 13C,Dhaka 1213 · ☎8801721 · ✉chennai@studies-overseas.com",
    "link": "https://www.studies-overseas.com/contact-us/study-abroad-consultants-in-dhaka",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "Ideal Consultancy",
    "channel": "Website",
    "observation": "[Directory] Educational consultant · ⭐5 (2 reviews) · 44,13 Panthapath,Dhaka 1205 · ☎8801703",
    "link": "http://idealconsultancybd.com/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "Smart BeeE BD/Best education consultants to Study Abroad.",
    "channel": "Facebook, Website",
    "observation": "[Directory] Educational consultant;Consultant · ⭐4.9 (25 reviews) · ERECTORS HOUSE,Kemal Ataturk Avenue,18 Central Avenue,Dhaka 1213 · ☎8801317 · ✉info@smartbeee.co.uk,info.nigeria@smartbeee.co.uk,admission-nepal@smartbeee.co.uk,admissionsupport-ghana@smartbeee.co.uk",
    "link": "https://smartbeee.co.uk/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "IECC : Bangladesh - Study Abroad Consultancy Centre",
    "channel": "Facebook, Website",
    "observation": "[Directory] Educational consultant · ⭐4.6 (424 reviews) · House 39,Road No. 17/A,Dhaka 1213 · ☎8801885 · ✉study@iecc.co.uk,info@iecc.co.uk,dhanmondi@iecc.co.uk,chattogram@iecc.co.uk,sylhet@iecc.co.uk,admin@iecc.co.uk,globaladmission@iecc.co.uk",
    "link": "http://www.iecc.co.uk/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "MGC Mega Global Consultancy",
    "channel": "Website",
    "observation": "[Directory] Educational consultant · ⭐5 (2 reviews) · Tower (Lift-4) 44 F/7,Rongon,West Panthapath,Dhaka 1205 · ☎8801715",
    "link": "https://mgceducation.com/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "Pencil Education Consultancy | Study Abroad Consultants | Higher Study",
    "channel": "Facebook, Website",
    "observation": "[Directory] Educational consultant · Level #5, Suit No. 512-516,Alpana Plaza,51 New Elephant Rd,Dhaka 1205 · ☎8801759 · ✉pencileducon@gmail.com,info@penciledu.com",
    "link": "https://penciledu.com/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "AIMS Education Banani",
    "channel": "Facebook, Website",
    "observation": "[Directory] Educational consultant;Consultant;Student career counseling office · ⭐4.9 (144 reviews) · House No: 3, Road No: 7 ( Banani Thana Road,Road 11 (Entry Road,Dhaka 1213 · ☎8801894 · ✉shefat@aimseducation.co.uk,uk@aimseducation.co.uk,kochi@aimseducation.co.uk,calicut@aimseducation.co.uk,nigeria@aimseducation.co.uk,ikeja@aimseducation.co.uk,algeria@aimseducation.co.uk,ghana@aimseducation.co.uk,kenya@aimseducation.co.uk,lahore@aimseducation.co.uk,pakistan@aimseducation.co.uk,info.dubai@aimseducation.co.uk,dhaka@aimseducation.co.uk,sylhet@aimseducation.co.uk,info@aimseducation.co.uk,ctg@aimseducation.co.uk",
    "link": "https://aimseducation.co.uk/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "Education Consultancy",
    "channel": "Unknown",
    "observation": "[Directory] Educational consultant · Flat 3B,2,Dhaka 1207 · ☎8801938",
    "link": "",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "Express Consultancy Ltd",
    "channel": "Website",
    "observation": "[Directory] Educational consultant · ⭐5 (3 reviews) · 4th Floor, 57/15 East,Panthapath,Dhaka 1215 · ☎09638",
    "link": "http://www.econsultancybd.com/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "EA Consultancy Ltd. Dhaka",
    "channel": "Facebook, Website",
    "observation": "[Directory] Educational consultant · Ramna Shopping Complex,Dhaka 1217 · ☎8801723 · ✉support@eaconsultancy.info",
    "link": "https://eaconsultancy.org/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "Daily Bangladesh Media",
    "channel": "Website",
    "observation": "[Directory] Educational consultant · ⭐4.3 (16 reviews) · Western Panthonibash, 1st floor,69/O, Bir Uttam Kazi Nuruzzaman Road, Panthapath,Dhaka 1205 · ☎8801913",
    "link": "http://www.dailybangladeshmedia.com/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "Scholars Education",
    "channel": "Unknown",
    "observation": "[Directory] Educational consultant · ⭐5 (10 reviews) · Suite: L-265, 1st Floor,Pan Pacific Sonargaon Dhaka,107 Kazi Nazrul Islam Ave,Dhaka 1215 · ☎8801932",
    "link": "",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "Glorious Consultancy",
    "channel": "Facebook, Website",
    "observation": "[Directory] Educational consultant · ⭐4.8 (16 reviews) · 151, Heritage Dewan Palace (2nd Floor), Long Life Hospital /Singer Goli,Lake Circus Kola Bagan,Dhaka 1205 · ☎8801619 · ✉info@gloriousconsultancy.com,monira.moni@gloriousconsultancy.com,afrida.jannat@gloriousconsultancy.com,nafisha.hoque@gloriousconsultancy.com,20info@gloriousconsultancy.com,madhabi.halder@gloriousconsultancy.com,20mominul.islam@gloriousconsultancy.com,mominul.islam@gloriousconsultancy.com",
    "link": "http://www.gloriousconsultancy.com/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "Global Assistant Education Consultant",
    "channel": "Facebook, Website",
    "observation": "[Directory] Educational consultant;Student career counseling office;Travel agency;Visa consulting service · ⭐4.8 (97 reviews) · Level 15 (Lift-14) Razzak Plaza, 02, Shaheed Tajuddin Ahmed Avenue,Moghbazar Rd,Dhaka 1217 · ☎8801911 · ✉globalassistant.cf@gmail.com,globalassistant288015@gmail.com",
    "link": "https://globalassistant.info/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "Edu Link | The Best Education Consultancy Firm in Dhaka",
    "channel": "Unknown",
    "observation": "[Directory] Educational consultant · ⭐5 (1 reviews) · 23 f,Flat A-2, Panthapath,1 Box Culvert Rd,1205 · ☎8801716",
    "link": "",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "EduQuantica bd Ltd.",
    "channel": "Facebook, Website",
    "observation": "[Directory] Educational consultant · Level- 6,Keari Plaza,83 Satmasjid Road, Dhanmondi – 8/A,Dhaka 1209 · ☎8801799",
    "link": "https://www.eduquantica.com/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "Chandrabindu Student Consultancy",
    "channel": "Facebook, Website",
    "observation": "[Directory] Educational consultant · ⭐4.2 (41 reviews) · 152/2L , Near Panthapath Signal,গ্রীন রোড,ঢাকা 1205 · ☎8801711 · ✉admin@chandrabinduedu.com",
    "link": "http://www.chandrabinduedu.com/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "KIIT University Bangladesh Office",
    "channel": "Facebook, Website",
    "observation": "[Directory] Educational consultant · ⭐5 (12 reviews) · Signal,147/ H, Darul Huda, Lift- 5, Green Road,Panthapath,Dhaka 1205 · ☎8801711 · ✉demo@gmail.com,company@gmai.com,demoemail@gmail.com",
    "link": "http://www.educarebd.org/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "AECC Study Abroad Consultants in Dhaka Bangladesh",
    "channel": "Facebook, Website",
    "observation": "[Directory] Educational consultant · ⭐4.8 (57 reviews) · 2nd Floor,BTI Landmark,16 Gulshan Ave,Dhaka 1212 · ☎8801322 · ✉info.dhaka@aeccglobal.com",
    "link": "https://aeccglobal.com.bd/overseas-education-consultants-in-dhaka/?utm_source=gmb&utm_medium=organic&utm_campaign=dhaka",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "Eduvisors",
    "channel": "Facebook, Website",
    "observation": "[Directory] Educational consultant · ⭐4.9 (107 reviews) · House: B/185, Lane: 21,1st Floor(North,Dhaka 1206 · ☎8801744 · ✉info@eduvisors.com.bd,apply.eduvisors@gmail.com",
    "link": "https://www.eduvisors.com.bd/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "FRIENDS' Consultancy",
    "channel": "Facebook, Website",
    "observation": "[Directory] Educational consultant · ⭐5 (5 reviews) · 51/A/Ka/5, 2nd Floor, West Panthapath (Near Square Hospital Dhaka,1215 · ☎8801799 · ✉info@friendseibd.com",
    "link": "https://friendseibd.com/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "Student Connect Dhaka",
    "channel": "Facebook, Website",
    "observation": "[Directory] Educational consultant;Educational institution · ⭐4.9 (62 reviews) · House: 33, Road: 4,Dhanmondi,1209 · ☎09678 · ✉dhaka@studentconnect.org,apply@studentconnect.org,sylhet@studentconnect.org,ctg@studentconnect.org,india@studentconnect.org,nigeria@studentconnect.org,ghana@studentconnect.org",
    "link": "https://www.studentconnect.org/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "SP Education Consultancy",
    "channel": "Website",
    "observation": "[Directory] Consultant · ⭐4.7 (12 reviews) · 56,R.B Tower,9 Bir Uttam Kazi Nuruzzaman Rd,Dhaka 1205 · ☎8801335",
    "link": "https://www.facebook.com/share/17SPZNtM8K/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "Education Doorway Bangladesh",
    "channel": "Website",
    "observation": "[Directory] Educational consultant;Consultant;Academic department;Visa consulting service · ⭐4.8 (17 reviews) · 5th floor,Rangs Nasim Square,Road No. 16,Dhaka 1209 · ☎880198801 · ✉info@educationdoorway.com,admission@educationdoorway.com,pakistan@educationdoorway.io",
    "link": "https://educationdoorway.com/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "ABEC",
    "channel": "Website",
    "observation": "[Directory] Educational consultant · ⭐4.2 (106 reviews) · সার্কেল,57 Kazi Nazrul Islam Ave,Dhaka 1215 · ☎8801730",
    "link": "http://www.abecedu.net/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "Mastermind Education Consultancy Ltd",
    "channel": "Facebook, Website",
    "observation": "[Directory] Educational consultant · ⭐5 (4 reviews) · 158, Greenroad,Panthapath,Dhaka 1205 · ☎8801894 · ✉info.mastermindec@gmail.com",
    "link": "https://mastermindedubd.com/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "Sure Success Education Consultancy",
    "channel": "Facebook, Website",
    "observation": "[Directory] Educational consultant · ⭐4.8 (22 reviews) · 56/2 Wahed Tower 2nd Floor Besides Square Hospital Domino's Pizza Building Panthapth, Dhaka, Bangladesh, 1215,Dhaka 1215 · ☎8801684 · ✉info@ssecbd.com",
    "link": "http://www.ssecbd.com/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "Education BD",
    "channel": "Website",
    "observation": "[Directory] Educational consultant;Consultant;Foreign exchange students organization;Student career counseling office;Students support association;Visa consulting service · ⭐5 (6 reviews) · House – 60,8th floor,Dolphin Street,Lake Circus Rd,Dhaka 1205 · ☎8801711",
    "link": "http://www.education-bd.com/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "Menz Education Consultancy",
    "channel": "Facebook, Website",
    "observation": "[Directory] Educational consultant · ⭐3.8 (12 reviews) · 1st Floor , Block-D,4/4 Satmasjid Road,Dhaka 1207 · ☎02 · ✉info@menzedu.com,founder@menzedu.com",
    "link": "http://www.menzedu.com/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "NWC Education, Dhaka, Bangladesh - Study Abroad Consultants",
    "channel": "Website",
    "observation": "[Directory] Educational consultant;Consultant;English language school;Student career counseling office;Academic department;Visa consulting service · ⭐4.7 (209 reviews) · A R Tower,24 Kemal Ataturk Ave,Dhaka 1213 · ☎8801703",
    "link": "https://nwc.education/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "IECC Dhanmondi - Study Abroad Consultancy Centre",
    "channel": "Facebook, Website",
    "observation": "[Directory] Educational consultant · ⭐4.8 (159 reviews) · Green Rowshanara Tower,,Level 3, Beside Star Kabab, 755 Satmasjid Road, Dhanmondi,Dhaka 1209 · ☎8801300 · ✉study@iecc.co.uk,info@iecc.co.uk,dhanmondi@iecc.co.uk,chattogram@iecc.co.uk,sylhet@iecc.co.uk,admin@iecc.co.uk,globaladmission@iecc.co.uk",
    "link": "https://iecc.co.uk/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "SANGEN Edu Ltd",
    "channel": "Facebook, Website",
    "observation": "[Directory] Educational consultant · ⭐4.8 (217 reviews) · 104, Meem Tower (3rd floor), Shukrabad, Dhanmondi,Just Opposite to Metro Shopping Center,Dhaka 1215 · ☎8801615",
    "link": "https://www.sangenbd.com/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "EDUWISE",
    "channel": "Website",
    "observation": "[Directory] Educational consultant · ⭐4.8 (130 reviews) · 3rd Floor,Property Pride, House-15, Road- 8, Dhanmondi, Dhaka Flat. F-1,Dhaka 1205 · ☎8801715",
    "link": "http://eduwisebd.com/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "Study Abroad with MACES Dhanmondi Branch",
    "channel": "Facebook, Website",
    "observation": "[Directory] Educational consultant;Career guidance service;Student career counseling office;Visa consulting service · ⭐4.9 (78 reviews) · 12th Floor,Green City Squire,750 Satmasjid Road,Dhaka 1209 · ☎8801755",
    "link": "https://macesbd.com/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "UKWAY Global Education Consultants",
    "channel": "Website",
    "observation": "[Directory] Educational consultant · ⭐5 (60 reviews) · Level 5,Islam Tower,Opposite of Metro Shopping Mall, Dhanmondi 32, 102 Mirpur Rd,Dhaka 1207 · ☎8801896",
    "link": "https://ukwayec.co.uk/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "Luminedge Limited",
    "channel": "Facebook, Website",
    "observation": "[Directory] Educational consultant · ⭐4.7 (516 reviews) · Floor 12,743 Satmasjid Road,Dhaka 1205 · ☎8801400 · ✉info.dhaka@luminedge.com.au,info@luminedge.com.bd,khulna@luminedge.com.au",
    "link": "https://luminedge.com.bd/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "Peoples Global Consultancy",
    "channel": "Website",
    "observation": "[Directory] Educational consultant · ⭐5 (33 reviews) · House 60 (Flat: G-B,Road No. 9A,Dhaka 1209 · ☎8801600",
    "link": "https://www.peoplesgc.com/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "Confidence Consultancy",
    "channel": "Website",
    "observation": "[Directory] Educational consultant · ⭐4.6 (149 reviews) · TOWER, 8TH FLOOR,GREEN LANDMARK,129 KALABAGAN Mirpur Rd,Dhaka 1205 · ☎8801677",
    "link": "https://www.facebook.com/conconbd?mibextid=ZbWKwL",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "WISDOM EDUCATION-DHANMONDI",
    "channel": "Website",
    "observation": "[Directory] Educational consultant · ⭐4.6 (86 reviews) · 63/C, Mir Taj Square Level-7th, Lake Circus,West Panthapath,Dhaka 1205 · ☎8801330",
    "link": "https://thewisdombd.com/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "Shakil Education Group (Dhaka Head Office)",
    "channel": "Facebook, Website",
    "observation": "[Directory] Educational consultant;Career guidance service;Student career counseling office;Students support association;Studying center;Training center · ⭐4.8 (129 reviews) · 63/C, Mir Taj Square, Lift 3 & 5, Lake Circus Road,West Panthapath,Dhaka 1205 · ☎8801880 · ✉hello@shakiledu.com,info@shakiledu.org,denmark@shakiledu.com,info@shakiledu.com,dhaka@shakiledu.com,sylhet@shakiledu.com,germany@shakiledu.com,uk@shakiledu.com",
    "link": "https://www.shakiledu.com/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "BD Expert Education",
    "channel": "Facebook, Website",
    "observation": "[Directory] Educational consultant;Counselor;Student career counseling office;Visa consulting service · ⭐4.4 (78 reviews) · 44/7/A-B, Solid point Karim tower,Opposite of BRB Hospital,Dhaka 1205 · ☎8801896 · ✉info@bdexpertcon.com",
    "link": "https://bdexpertcon.com/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "PFEC Global",
    "channel": "Facebook, Website",
    "observation": "[Directory] Educational consultant · ⭐4.9 (1133 reviews) · SIMA Blossom (5th Floor) Plot 390 (Old), 03 (New), Road-27 (Old) 16 (New,Dhaka 1209 · ☎09609 · ✉it.admin@pfecglobal.com",
    "link": "https://www.pfecglobal.com.bd/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "Total Student Care (TSC) Bangladesh",
    "channel": "Facebook, Website",
    "observation": "[Directory] Educational consultant · ⭐4.8 (109 reviews) · Zebun Arcade, 4th Floor, House No- 4,Old Road No. 16,Dhaka 1209 · ☎8801712 · ✉info@totalstudentcare.com,admission@totalstudentcare.com,admissions@totalstudentcare.com",
    "link": "http://www.totalstudentcare.com/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "Global Express Education",
    "channel": "Facebook, Website",
    "observation": "[Directory] Educational consultant · ⭐5 (5 reviews) · 20/4, 2nd Floor, Beside Square Hospital, West Panthapath, North Dhanmondi, Dhaka,Dhaka 1205 · ☎8801325 · ✉hello@globalexpressedu.com",
    "link": "http://globalexpressedu.com/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "Axiom Education",
    "channel": "Website",
    "observation": "[Directory] Educational consultant · ⭐4.5 (95 reviews) · House 5,Road 1 Dhanmondi, Road,Dhaka 1205 · ☎8801711 · ✉webmaster@axiombd.com",
    "link": "http://www.axiombd.com/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "GlobEx Education",
    "channel": "Facebook, Website",
    "observation": "[Directory] Educational consultant · ⭐4.7 (76 reviews) · Level 5,Alta Plaza,House 8801 Road No. 10,Dhaka 1205 · ☎8801325 · ✉info@globexedu.com",
    "link": "https://globexedu.com/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "Executive Study Abroad",
    "channel": "Facebook, Website",
    "observation": "[Directory] Educational consultant;Recruiter · ⭐4.9 (530 reviews) · House 40,Road 16 new) 27 (old,Dhaka 1209 · ☎8801715 · ✉info@etibd.co.uk",
    "link": "https://executivestudyabroad.com/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "NHP Education Consultants",
    "channel": "Facebook, Website",
    "observation": "[Directory] Educational consultant;Adult education school;Career guidance service;Education center;Educational institution;Foreign languages program school;Student career counseling office;Students support association;Studying center;Visa consulting service · ⭐4.4 (61 reviews) · 2nd Floor,Rowshan Tower,152/2A-2, West Panthapath,1205 · ☎8801755 · ✉info@nhpeducationconsultants.com,headofadmin@nhpeducationconsultants.com",
    "link": "https://www.nhpeducationconsultants.com/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "Inspiren Global Education - Dhaka",
    "channel": "Facebook, Website",
    "observation": "[Directory] Educational consultant · ⭐4.9 (87 reviews) · Khan Plaza, (Lift 5),32/1 Mirpur Road.,Science Laboratory (opposite of Teachers Training College), Dhanmondi,Dhaka 1205 · ☎8801789 · ✉hello@igeducation.com,admin@igeducation.com,dhaka@igeducation.com,sylhet@igeducation.com,chittagong@igeducation.com,ctg.igeducation@gmail.com",
    "link": "http://www.igeducation.com/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "AHZ Dhanmondi Corporate Office",
    "channel": "Website",
    "observation": "[Directory] Educational consultant · ⭐4.9 (645 reviews) · 2nd Floor, Nahar Green Summit (Opposite of Meena Bazar),,Dhanmondi-27,Dhaka 1209 · ☎8801313",
    "link": "https://www.ahzassociates.com/bangladesh/global-offices/dhanmondi",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "Team Consultancy Dhaka",
    "channel": "Facebook, Website",
    "observation": "[Directory] Educational consultant · ⭐5 (2 reviews) · Opposite of Shomorita Hospital, Samsung Building (Lift 9), Panthapath,Dhaka 1205 · ☎8801782 · ✉contactinfo@team.com",
    "link": "https://teamconsultancy.co.uk/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "MBBS in Bangladesh I Fortune Education",
    "channel": "Facebook, Website",
    "observation": "[Directory] Educational consultant · ⭐5 (8 reviews) · 3rd Floor,Haque Mansion,Dhaka 1209 · ☎8801995 · ✉fortunebangladesh@gmail.com,alamfgn@hotmail.com",
    "link": "http://www.mbbsbd.com/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "Oziha consultancy",
    "channel": "Unknown",
    "observation": "[Directory] Consultant · ⭐3.8 (16 reviews) · 43/R,5C Panthapath,Dhaka 1207 · ☎8801841",
    "link": "",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "Eduzen Consultancy",
    "channel": "Facebook, Website",
    "observation": "[Directory] Educational consultant · Flat: A2, 2nd Floor), House: 7/10, Block: B,Rangs Revere,Dhaka 1207 · ☎8801324 · ✉info@eduzenconsultancy.com",
    "link": "https://eduzenconsultancy.com/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "International Admission Service (Bangladesh) Ltd.",
    "channel": "Facebook, Website",
    "observation": "[Directory] Educational consultant;Student career counseling office · ⭐4.6 (92 reviews) · House #313 Rd 21,Dhaka 1206 · ☎8801711 · ✉info@iasbd.co.uk,marketing@iasbd.co.uk,nazmul@iasbd.co.uk,tahsin@iasbd.co.uk,canada1@iasbd.co.uk,afzal@iasbd.co.uk,tuhana@iasbd.co.uk,canada@iasbd.co.uk",
    "link": "https://iasbd.co.uk/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "Shaheda Higher Education Consultancy",
    "channel": "Facebook, Website",
    "observation": "[Directory] Consultant · ⭐4.3 (76 reviews) · house 37, 4th Floor,1213 Road No.27,Dhaka 1212 · ☎8801713 · ✉info@shecbd.com",
    "link": "http://www.shecbd.com/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "VISA POINT INTERNATIONAL BANGLADESH",
    "channel": "Facebook, Website",
    "observation": "[Directory] Educational consultant · ⭐4.6 (9 reviews) · Regency Pantho Neer Flat A-2 House 23/F-1 Free School Street Box Culvert Road Opposite Basundhara City Shopping mall,Panthapath,Dhaka 1205 · ☎8801711 · ✉info@visapointint.com",
    "link": "https://visapointint.com/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "Educube Bangladesh Consultancy",
    "channel": "Website",
    "observation": "[Directory] Educational consultant · ⭐4.8 (19 reviews) · Sunny Season Tower (Level 2), Kha-168/2 Middle Badda (Opposite of Sonali,Bank),Dhaka 1212 · ☎09638 · ✉admission@educube.com.bd,rajshahi@educube.com.bd",
    "link": "http://www.educube.com.bd/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "Ireland Education Office Dhaka",
    "channel": "Facebook, Website",
    "observation": "[Directory] Educational consultant · ⭐5 (3 reviews) · 1925, 19th Floor,UTC BUILDING,Panthapath,Dhaka 1215 · ☎8801341 · ✉info@educationireland.net,bangladesh@educationireland.net,maryamr@educationireland.net,danish@educationireland.net,raza@educationireland.net,kosar@educationireland.net,haider@educationireland.net,rabia@educationireland.net,camillusdwane@educationireland.net,ali@educationireland.net,usama@educationireland.net,ammar@educationireland.net,aiman@educationireland.net,umama@educationireland.net,rimsha@educationireland.net,karachi@educationireland.net",
    "link": "https://educationireland.net/bangladesh/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "PEC-Education| Study In USA, Canada, UK & Australia",
    "channel": "Facebook, Website",
    "observation": "[Directory] Educational consultant;Student career counseling office;Students support association;Studying center;Visa consulting service · ⭐4.9 (14 reviews) · 128 Senpara Parbata,Begum Rokeya Avenue,Dhaka 1216 · ☎8801630 · ✉contact@pec-education.com",
    "link": "https://pec-education.com/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "CSB Study Abroad | The leading education consultancy firm in Bangladesh",
    "channel": "Facebook, Website",
    "observation": "[Directory] Educational consultant · ⭐4.5 (196 reviews) · House 32 Road No. 11,Dhaka 1213 · ☎8801711 · ✉info@csbbd.com",
    "link": "http://www.csbbd.com/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "NECL Consultancy",
    "channel": "Website",
    "observation": "[Directory] Consultant · ⭐4.6 (23 reviews) · Dynasty Wahid Tower,56/2,West Panthapath (3rd Floor) beside Square Hospital Dhaka,1205 · ☎8801708",
    "link": "http://www.necledu.com/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "Tawakkul Malaysia Education Consultancy",
    "channel": "Website",
    "observation": "[Directory] Educational consultant · ⭐4.7 (47 reviews) · H/S#711/7,Bunopakhi,Rd 11,Dhaka 1207 · ☎8801716",
    "link": "https://www.tawakkulmalaysia.com/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "Bright Education BD",
    "channel": "Unknown",
    "observation": "[Directory] Educational consultant · ⭐5 (5 reviews) · 3rd Floor,152,2/M Panthapath,Dhaka 1205 · ☎8801409",
    "link": "",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "HR Consultancy",
    "channel": "Unknown",
    "observation": "[Directory] Educational consultant · ⭐5 (13 reviews) · 68-69,Concept Tower,1205 Green Rd,Dhaka 1205 · ☎8801999",
    "link": "",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "Abroad Inquiry",
    "channel": "Website",
    "observation": "[Directory] Educational consultant · ⭐4.7 (130 reviews) · Block: C, House No: 47, 5th Floor, Road No: 6, Niketon,Dhaka 1212 · ☎8801711",
    "link": "https://www.abroadinquiry.com/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "EIE",
    "channel": "Website",
    "observation": "[Directory] Educational consultant · ⭐5 (2 reviews) · 152/2, A-2 8th Floor Signal,Rowshan Tower,Panthapath,Dhaka 1205 · ☎8801777",
    "link": "http://www.eiebd.com/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "Future Track Education Consulting Agency",
    "channel": "Facebook, Website",
    "observation": "[Directory] Educational consultant · ⭐4.7 (125 reviews) · Level 5,106 Gulshan Ave,Dhaka 1212 · ☎8801897 · ✉info@futuretrackbd.com",
    "link": "http://www.futuretrackbd.com/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "Revolution Education and Consultancy | Study Abroad",
    "channel": "Facebook, Website",
    "observation": "[Directory] Student career counseling office · ⭐4.9 (15 reviews) · Midnight Sun-1,89 DIT Rd,Dhaka 1217 · ☎8801841 · ✉m.islam@rec-bd.com,s.islam@rec-bd.com,s.arif@rec-bd.com,info@rec-bd.com",
    "link": "https://rec-bd.com/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  },
  {
    "competitor": "SMS Higher Education Group Bangladesh",
    "channel": "Facebook, Website",
    "observation": "[Directory] Educational consultant · 5th Floor,House no - 17,2 Road No. 3A,Dhaka 1209 · ☎8801324 · ✉info@smsheg.co.uk,dhaka@smsheg.co.uk",
    "link": "https://smsheg.co.uk/",
    "our_angle": "",
    "added_by": "dhaka-directory"
  }
];

(async () => {
  console.log(`Seeding ${ROWS.length} Dhaka-directory competitors -> ${BASE}${DRY?'  (DRY RUN)':''}`);
  let existing = [];
  try { existing = await req('competitors'); } catch (e) { console.error('Could not read existing competitors:', e.message); process.exit(1); }
  const have = new Set(existing.map(r => String(r.competitor||'').trim().toLowerCase()));
  let added = 0, skipped = 0;
  for (const row of ROWS) {
    const key = row.competitor.trim().toLowerCase();
    if (have.has(key)) { skipped++; continue; }
    const body = { log_date: TODAY, ...row };
    if (DRY) { console.log('WOULD ADD:', row.competitor); added++; have.add(key); continue; }
    try { await req('competitors', { method:'POST', body: JSON.stringify(body) }); have.add(key); added++; if (added % 20 === 0) console.log(`  ...${added} added`); }
    catch (e) { console.error('FAILED:', row.competitor, '-', e.message); }
  }
  console.log(`Done. Added ${added}, skipped ${skipped} (already present).`);
})();
