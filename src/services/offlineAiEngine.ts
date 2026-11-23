import { DocumentChunk, SupportedLanguage } from '../types';
import { db } from './db';
import { documentProcessor } from './documentProcessor';

export interface OfflineAIContext {
  history?: { role: 'user' | 'assistant'; content: string }[];
  documentChunks?: DocumentChunk[];
  language?: SupportedLanguage;
  temperature?: number;
}

export interface OfflineAIResult {
  text: string;
  sources?: { documentName: string; page: number; text: string }[];
  suggestedActions?: string[];
}

interface KnowledgeEntry {
  keywords: RegExp;
  en: string;
  romanUr: string;
  actions?: string[];
}

const KNOWLEDGE_BASE: KnowledgeEntry[] = [
  {
    keywords: /\b(offnex|who are you|what are you|tum kaun|ap kaun|aap kaun|introduce yourself)\b/i,
    en: `I am **Offnex Ai**, your private on-device AI assistant. Even in **100% Offline Mode** with zero internet, I can help you with:\n\n- **Unlimited Chat & Q&A** (English, Roman Urdu, and Urdu)\n- **Math, Percentages & Unit Conversions**\n- **Coding & Debugging** (Python, JS/TS, React, HTML/CSS, SQL)\n- **Writing & Drafting** (Emails, essays, reports, CVs, study plans)\n- **Uploaded PDFs & Notes Analysis** (Summaries & quizzes on your device)\n- **Offline Image Studio & Voice Playback**`,
    romanUr: `Main **Offnex Ai** hoon — aap ka private on-device AI assistant! **100% Offline Mode** mein baghair internet ke bhi main aap ki har kaam mein madad kar sakta hoon:\n\n- **Unlimited Free Chat** (English, Roman Urdu aur Urdu)\n- **Math, Percentages aur Unit Conversions**\n- **Coding Help** (Python, JavaScript, HTML/CSS, React, SQL)\n- **Emails, Essays, Reports aur Applications likhna**\n- **Uploaded PDFs aur Notes** ka summary aur quiz banana\n- **Offline Image Studio aur Voice Playback**`,
    actions: ['Write Email', 'Solve Math', 'Generate Code'],
  },
  {
    keywords: /\b(pakistan)\b.*\b(economy|maeeshat|gdp|business|finance|trade|report)\b|\b(economy|maeeshat)\b.*\b(pakistan)\b/i,
    en: `### Pakistan Economy — Key Overview (Offline Knowledge Brief)\n\n**1. Core Sectors**\n- **Services (~58% of GDP):** Telecom, banking, retail, transport, and fast-growing **IT & Freelance software exports**.\n- **Agriculture (~23% of GDP):** Wheat, rice, cotton, sugarcane, maize, livestock, and dairy — employing nearly 37% of the workforce.\n- **Industry & Manufacturing (~19% of GDP):** Textiles (largest export earner), cement, fertilizers, pharmaceuticals, and automobiles.\n\n**2. Growth Drivers & Opportunities**\n- Expanding IT & digital freelance remittances.\n- Renewable solar & hydro energy transition to cut imported fuel bills.\n- Agro-processing, value-added textiles, and regional trade corridors.\n\n**3. Key Challenges**\n- Circular debt & energy cost, inflation pressure, narrow tax base, and import-export trade balance.`,
    romanUr: `### Pakistan ki Economy (Maeeshat) — Mukhtasar Report\n\n**1. Bunyadi Sectors (GDP ka Hissa)**\n- **Services Sector (~58%):** Banking, telecom, transport, retail aur tezi se barhta hua **IT & Freelancing** sector.\n- **Agriculture / Ziraat (~23%):** Gandum, chawal, kapas (cotton), ganna aur livestock — jo taqreeban 37% logon ko rozgar deta hai.\n- **Industry (~19%):** Textile (sab se bari export), cement, khad (fertilizer), medicines aur surgical goods.\n\n**2. Behtari ke Mawaqay**\n- **IT Exports & Freelancing** se foreign exchange barhana.\n- **Solar aur Hydel Energy** se mehngay oil import par inhisar kam karna.\n- Value-added agriculture aur local startups ko support dena.\n\n**3. Bunyadi Challenges**\n- Bijli/gas ki qeemat, mehangai (inflation), tax system aur import-export ka farq.`,
    actions: ['Summary', 'Generate Code', 'More Details'],
  },
  {
    keywords: /\b(pakistan|islamabad|karachi|lahore|peshawar|quetta|k2|urdu)\b/i,
    en: `### Pakistan — Essential Facts\n\n- **Capital:** Islamabad\n- **Largest City & Economic Hub:** Karachi\n- **Cultural & Historical Hub:** Lahore\n- **National Language:** Urdu (Official: Urdu & English)\n- **Provinces & Regions:** Punjab, Sindh, Khyber Pakhtunkhwa (KP), Balochistan, Gilgit-Baltistan, Azad Jammu & Kashmir\n- **Highest Peak:** **K2** (8,611 m — second highest mountain in the world)\n- **Major River:** Indus River (Sindh)\n- **Independence Day:** August 14, 1947`,
    romanUr: `### Pakistan — Aham Maloomat\n\n- **Dar-ul-Hukumat (Capital):** Islamabad\n- **Sab se bara Shehar:** Karachi (Karobar aur port city)\n- **Dil-e-Pakistan / Saqafati Shehar:** Lahore\n- **Qaumi Zuban:** Urdu\n- **Subay (Provinces):** Punjab, Sindh, Khyber Pakhtunkhwa, Balochistan (+ Gilgit-Baltistan & Azad Kashmir)\n- **Sab se Ooncha Pahar:** **K2** (8,611 meter — duniya ki doosri sab se oonchi choti)\n- **Sab se Bara Darya:** Darya-e-Sindh (Indus River)\n- **Azadi ka Din:** 14 August 1947`,
    actions: ['Pakistan Economy', 'Summary', 'More Details'],
  },
  {
    keywords: /\b(artificial intelligence|machine learning|deep learning|neural network|llm|what is ai|ai kya hai)\b/i,
    en: `### Artificial Intelligence (AI) Explained\n\n**Artificial Intelligence (AI)** is computer science focused on building systems capable of reasoning, learning from patterns, understanding language, and solving problems.\n\n- **Machine Learning (ML):** Algorithms that learn patterns from data instead of fixed rules.\n- **Deep Learning:** Multi-layered neural networks inspired by the human brain (used for vision, speech, and text).\n- **Large Language Models (LLMs):** Predict and generate human-like text, code, and reasoning.\n- **Real-world uses:** Medical diagnostics, coding assistants, translation, fraud detection, and smart automation.`,
    romanUr: `### Artificial Intelligence (AI) Kya Hai?\n\n**AI (Masnooi Zahanat)** aisi technology hai jis mein computers aur software insanon ki tarah seekhne, samajhne, aur maslay hal karne ki salahiyat hasil karte hain.\n\n- **Machine Learning (ML):** Computer data aur tajurbay se khud seekhta hai.\n- **Deep Learning:** Human brain ki tarah layered neural networks par kaam karta hai (images, voice aur text ke liye).\n- **LLMs (Language Models):** Text likhna, translate karna, aur coding mein madad karna.\n- **Rozmarra Istimal:** Medicine, education, software development, translation aur security.`,
    actions: ['Explain Simply', 'Python AI Example', 'Summary'],
  },
  {
    keywords: /\b(photosynthesis|gravity|relativity|atom|solar system|planets|water cycle|electricity|human body|dna|cell)\b/i,
    en: `### Science Quick Guide\n\n- **Photosynthesis:** Plants convert sunlight + $CO_2$ + water into glucose (energy) and oxygen ($6CO_2 + 6H_2O \\rightarrow C_6H_{12}O_6 + 6O_2$).\n- **Gravity:** Earth pulls objects downward at **$g \\approx 9.81\\text{ m/s}^2$** ($F = G\\frac{m_1 m_2}{r^2}$).\n- **Solar System Planets (in order):** Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, Neptune.\n- **Electricity (Ohm's Law):** $V = I \\times R$ (Voltage = Current $\\times$ Resistance).\n- **Human DNA & Cells:** DNA carries genetic instructions inside cell nuclei; mitochondria generate cellular energy (ATP).\n\nTell me which exact science topic you want explained in detail!`,
    romanUr: `### Science — Aham Concepts\n\n- **Photosynthesis:** Poday (plants) dhoop, pani aur $CO_2$ ki madad se apni khurak (glucose) aur oxygen banate hain.\n- **Gravity:** Zameen har cheez ko **$9.81\\text{ m/s}^2$** ki quwat se apni taraf kheenchtii hai.\n- **Solar System ke Sayaray:** Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, Neptune.\n- **Ohm's Law (Bijli):** $V = I \\times R$ (Voltage = Current × Resistance).\n- **Cell & DNA:** Jism ke har cell mein DNA hota hai jo hamari genetic maloomat rakhta hai.\n\nAgar kisi ek topic ki detail chahiye to us ka naam likhein!`,
    actions: ['Explain Photosynthesis', 'Explain Gravity', 'Solar System'],
  },
  {
    keywords: /\b(study plan|exam|timetable|learn fast|how to study|parhai|imtihan|taiyari)\b/i,
    en: `### Smart Offline Study Plan & Exam Strategy\n\n1. **Pomodoro Focus Blocks:** Study **25–45 mins** with zero distractions, then take a **5–10 min** break.\n2. **Active Recall:** Instead of just re-reading, close your notes and write/speak key points from memory.\n3. **Spaced Repetition:** Review difficult topics after **1 day, 3 days, and 7 days**.\n4. **Sample Daily Schedule:**\n   - **Morning (Hardest Subject):** 90 mins deep practice\n   - **Afternoon (Notes & Practice Questions):** 60 mins\n   - **Evening (Revision & Past Papers):** 45 mins\n   - **Night:** Quick 15-min recap before 7–8 hours of sleep.`,
    romanUr: `### Exam aur Parhai ka Behtareen Time Table\n\n1. **Pomodoro Technique:** 40 minute poori tawajjo se parhein, phir 10 minute break lein.\n2. **Active Recall:** Kitab band kar ke jo parha hai usay khud likh kar check karein — yeh sab se tez yaad rakhne ka tareeqa hai.\n3. **Rozana Schedule:**\n   - **Subah:** Mushkil subject (Math / Science / Coding) — 1.5 ghanta\n   - **Dopahar:** Notes banana aur questions solve karna — 1 ghanta\n   - **Shaam:** Purane papers aur revision — 45 minute\n   - **Raat:** Sone se pehle 15 min quick revision + 7–8 ghantay neend.`,
    actions: ['Make 7-Day Plan', 'Quiz Tips', 'Summary'],
  },
  {
    keywords: /\b(health|fitness|diet|weight|sleep|water|exercise|sehat|neend)\b/i,
    en: `### Practical Daily Health & Wellness Habits\n\n- **Hydration:** Drink **2–3 liters** (8–10 glasses) of clean water daily.\n- **Movement:** Aim for **30 minutes** of brisk walking, stretching, or bodyweight exercise 5 days a week.\n- **Balanced Plate:** Half vegetables/fruits, quarter lean protein (eggs, lentils, chicken, fish), quarter whole grains.\n- **Sleep Hygiene:** 7–8 hours consistent sleep; avoid bright screens 30 mins before bed.`,
    romanUr: `### Sehatmand Zindagi ke Aasan Usool\n\n- **Pani:** Rozana kam az kam **8 se 10 glass** saaf pani piyen.\n- **Walk aur Exercise:** Din mein **30 minute** tezi se walk ya halki exercise karein.\n- **Mutawazan Khurak:** Taaza sabziyan, phal, daalein, anday/gosht aur kam cheeni/tala hua khana.\n- **Neend:** Rozana **7 se 8 ghantay** ki poori neend lein aur sone se pehle mobile screen kam karein.`,
    actions: ['Workout Plan', 'Healthy Diet', 'Summary'],
  },
  {
    keywords: /\b(freelancing|earn money|upwork|fiverr|remote work|business idea|online earning|paisay)\b/i,
    en: `### High-Demand Skills & Freelancing Roadmap\n\n1. **Pick One Core Skill:**\n   - Web Development (Next.js, React, Tailwind CSS)\n   - AI Automation & Prompt Workflows\n   - Graphic / UI-UX Design & Video Editing\n   - Digital Marketing, SEO & Content Writing\n2. **Build 3 Real Portfolio Samples:** Solve real problems (landing page, dashboard, brand kit, script).\n3. **Client Outreach:** Write short, outcome-focused proposals explaining *how* you save the client time or increase revenue.\n4. **Deliver Fast & Communicate Clearly:** Clear milestones win repeat long-term clients.`,
    romanUr: `### Freelancing aur Online Skill Seekhne ka Roadmap\n\n1. **Ek Skill Chunein:** Web Development (React/Next.js), UI/UX Design, Video Editing, AI Workflows, ya SEO/Content Writing.\n2. **3 Practice Projects Banayein:** Apna portfolio strong karein taa-ke client aap ka kaam dekh sake.\n3. **Fiverr / Upwork / LinkedIn:** Clear profile banayein aur client ki problem par focused proposal likhein.\n4. **Quality & Time:** Waqt par kaam deliver karein taa-ke 5-star reviews aur permanent clients milein.`,
    actions: ['Proposal Template', 'Portfolio Ideas', 'Summary'],
  },
];

const ROMAN_URDU_WORDS: Record<string, { en: string; ur: string }> = {
  hello: { en: 'Hello', ur: 'ہیلو / السلام علیکم' },
  hi: { en: 'Hi', ur: 'سلام' },
  thanks: { en: 'Thank you', ur: 'شکریہ (Shukriya)' },
  'thank you': { en: 'Thank you', ur: 'بہت شکریہ (Bahut Shukriya)' },
  water: { en: 'Water', ur: 'پانی (Pani)' },
  food: { en: 'Food', ur: 'کھانا (Khana)' },
  book: { en: 'Book', ur: 'کتاب (Kitab)' },
  house: { en: 'House / Home', ur: 'گھر (Ghar)' },
  home: { en: 'Home', ur: 'گھر (Ghar)' },
  school: { en: 'School', ur: 'اسکول (School)' },
  friend: { en: 'Friend', ur: 'دوست (Dost)' },
  love: { en: 'Love', ur: 'محبت (Mohabbat)' },
  peace: { en: 'Peace', ur: 'امن (Aman)' },
  work: { en: 'Work', ur: 'کام (Kaam)' },
  time: { en: 'Time', ur: 'وقت (Waqt)' },
  money: { en: 'Money', ur: 'پیسہ (Paisa)' },
  computer: { en: 'Computer', ur: 'کمپیوٹر' },
  internet: { en: 'Internet', ur: 'انٹرنیٹ' },
  offline: { en: 'Offline', ur: 'آف لائن (Baghair internet)' },
  knowledge: { en: 'Knowledge', ur: 'علم (Ilm)' },
  success: { en: 'Success', ur: 'کامیابی (Kamyabi)' },
  hardwork: { en: 'Hard work', ur: 'محنت (Mehnat)' },
  good: { en: 'Good', ur: 'اچھا (Acha)' },
  morning: { en: 'Morning', ur: 'صبح (Subah)' },
  night: { en: 'Night', ur: 'رات (Raat)' },
  pakistan: { en: 'Pakistan', ur: 'پاکستان' },
  please: { en: 'Please', ur: 'براہ مہربانی (Meharbani)' },
  sorry: { en: 'Sorry', ur: 'معذرت (Maazrat)' },
  yes: { en: 'Yes', ur: 'جی ہاں (Haan)' },
  no: { en: 'No', ur: 'نہیں (Nahi)' },
  help: { en: 'Help', ur: 'مدد (Madad)' },
  madad: { en: 'Help', ur: 'مدد' },
  shukriya: { en: 'Thank you', ur: 'شکریہ' },
  kamyabi: { en: 'Success', ur: 'کامیابی' },
  mehnat: { en: 'Hard work', ur: 'محنت' },
  waqt: { en: 'Time', ur: 'وقت' },
  dost: { en: 'Friend', ur: 'دوست' },
  kitab: { en: 'Book', ur: 'کتاب' },
  pani: { en: 'Water', ur: 'پانی' },
};

const PHRASE_TRANSLATIONS: { en: string; romanUr: string; ur: string }[] = [
  { en: 'How are you?', romanUr: 'Aap kaise hain?', ur: 'آپ کیسے ہیں؟' },
  { en: 'I am fine, thank you.', romanUr: 'Main theek hoon, shukriya.', ur: 'میں ٹھیک ہوں، شکریہ۔' },
  { en: 'Please help me with this.', romanUr: 'Meharbani kar ke is mein meri madad karein.', ur: 'براہ مہربانی اس میں میری مدد کریں۔' },
  { en: 'I need some more information.', romanUr: 'Mujhe thori mazeed maloomat chahiye.', ur: 'مجھے تھوڑی مزید معلومات چاہئیں۔' },
  { en: 'Let us schedule a meeting tomorrow.', romanUr: 'Chalein kal ek meeting schedule karte hain.', ur: 'آئیے کل ایک میٹنگ طے کرتے ہیں۔' },
  { en: 'Have a great day!', romanUr: 'Aap ka din acha guzre!', ur: 'آپ کا دن اچھا گزرے!' },
];

export class OfflineAIEngine {
  private detectRomanOrUrdu(prompt: string, language?: SupportedLanguage): boolean {
    if (language === 'ur' || language === 'roman_ur') {
      // Respect user text: if explicitly Roman Urdu or Urdu script, definitely true;
      // if pure English prompt even with default setting 'ur', check if prompt has Urdu cues
      const hasUrduScript = /[\u0600-\u06FF]/.test(prompt);
      const hasRomanUrdu =
        /\b(kya|hai|hain|karo|batao|mujhe|kaise|tareeqa|samjhao|likho|chahiye|aap|tum|main|ka|ki|ke|ko|se|mein|nahi|haan|acha|theek|shukriya|madad|salam|assalam|per|par|wajah|faiday|nuqsan|banayein|likhein)\b/i.test(
          prompt
        );
      if (hasUrduScript || hasRomanUrdu) return true;
      return false;
    }
    return (
      /[\u0600-\u06FF]/.test(prompt) ||
      /\b(kya|hai|hain|karo|batao|mujhe|kaise|tareeqa|samjhao|likho|chahiye|aap|tum|ka|ki|ke|ko|se|mein|nahi|salam|assalam|per|wajah)\b/i.test(
        prompt
      )
    );
  }

  private evaluateMathAndConversions(prompt: string, isUrdu: boolean): string | null {
    const trimmed = prompt.trim();

    // Percentage queries: "20% of 500" or "500 ka 20%"
    const pctEn = trimmed.match(/(\d+(?:\.\d+)?)\s*%\s*(?:of|x|\*)\s*(\d+(?:\.\d+)?)/i);
    const pctUr = trimmed.match(/(\d+(?:\.\d+)?)\s*(?:ka|ke|ki)\s*(\d+(?:\.\d+)?)\s*%/i);
    if (pctEn) {
      const pct = parseFloat(pctEn[1]);
      const base = parseFloat(pctEn[2]);
      const ans = (pct / 100) * base;
      return isUrdu
        ? `**${base}** ka **${pct}%** = **${Number(ans.toFixed(4))}**\n\n- Formula: \`(${pct} / 100) × ${base} = ${Number(ans.toFixed(4))}\``
        : `**${pct}%** of **${base}** = **${Number(ans.toFixed(4))}**\n\n- Formula: \`(${pct} / 100) × ${base} = ${Number(ans.toFixed(4))}\``;
    }
    if (pctUr) {
      const base = parseFloat(pctUr[1]);
      const pct = parseFloat(pctUr[2]);
      const ans = (pct / 100) * base;
      return `**${base}** ka **${pct}%** = **${Number(ans.toFixed(4))}**\n\n- Formula: \`(${pct} / 100) × ${base} = ${Number(ans.toFixed(4))}\``;
    }

    // Unit conversions
    const convMatch = trimmed.match(
      /(?:convert\s+)?(-?\d+(?:\.\d+)?)\s*(km|kilometers?|miles?|mi|kg|kilograms?|lbs?|pounds?|c|celsius|f|fahrenheit|gb|gigabytes?|mb|megabytes?|cm|m|meters?|ft|feet|hours?|hrs?|minutes?|mins?)\s+(?:to|in|into|mein)\s+(km|kilometers?|miles?|mi|kg|kilograms?|lbs?|pounds?|c|celsius|f|fahrenheit|gb|gigabytes?|mb|megabytes?|cm|m|meters?|ft|feet|hours?|hrs?|minutes?|mins?)/i
    );
    if (convMatch) {
      const val = parseFloat(convMatch[1]);
      const from = convMatch[2].toLowerCase().replace(/s$/, '');
      const to = convMatch[3].toLowerCase().replace(/s$/, '');
      const norm = (u: string) => {
        if (u === 'kilometer') return 'km';
        if (u === 'mile') return 'mi';
        if (u === 'kilogram') return 'kg';
        if (u === 'pound' || u === 'lb') return 'lb';
        if (u === 'celsius') return 'c';
        if (u === 'fahrenheit') return 'f';
        if (u === 'gigabyte') return 'gb';
        if (u === 'megabyte') return 'mb';
        if (u === 'meter') return 'm';
        if (u === 'foot' || u === 'feet') return 'ft';
        if (u === 'hour' || u === 'hr') return 'hr';
        if (u === 'minute' || u === 'min') return 'min';
        return u;
      };
      const f = norm(from);
      const t = norm(to);
      let res: number | null = null;
      if (f === 'km' && t === 'mi') res = val * 0.621371;
      else if (f === 'mi' && t === 'km') res = val * 1.60934;
      else if (f === 'kg' && t === 'lb') res = val * 2.20462;
      else if (f === 'lb' && t === 'kg') res = val * 0.453592;
      else if (f === 'c' && t === 'f') res = (val * 9) / 5 + 32;
      else if (f === 'f' && t === 'c') res = ((val - 32) * 5) / 9;
      else if (f === 'gb' && t === 'mb') res = val * 1024;
      else if (f === 'mb' && t === 'gb') res = val / 1024;
      else if (f === 'm' && t === 'cm') res = val * 100;
      else if (f === 'cm' && t === 'm') res = val / 100;
      else if (f === 'm' && t === 'ft') res = val * 3.28084;
      else if (f === 'ft' && t === 'm') res = val * 0.3048;
      else if (f === 'hr' && t === 'min') res = val * 60;
      else if (f === 'min' && t === 'hr') res = val / 60;

      if (res !== null) {
        return `**${val} ${convMatch[2]}** = **${Number(res.toFixed(4))} ${convMatch[3]}**`;
      }
    }

    // Square root
    const sqrtMatch = trimmed.match(/(?:sqrt|square root of|under root)\s*\(?\s*(\d+(?:\.\d+)?)\s*\)?/i);
    if (sqrtMatch) {
      const n = parseFloat(sqrtMatch[1]);
      if (n >= 0) {
        return `Square root of **${n}** ($\\sqrt{${n}}$) = **${Number(Math.sqrt(n).toFixed(6))}**`;
      }
    }

    // Direct arithmetic expression (supports + - * / ( ) % ^)
    const cleaned = trimmed
      .replace(/what is|calculate|solve|evaluate|find|kitna hota hai|kitnay hotay hain|batao|=|\?/gi, '')
      .trim();
    if (cleaned && /^[0-9+\-*/().\s%^]+$/.test(cleaned) && /[+\-*/%^]/.test(cleaned)) {
      try {
        const expr = cleaned.replace(/\^/g, '**');
        const result = Function(`"use strict"; return (${expr})`)();
        if (typeof result === 'number' && Number.isFinite(result)) {
          return isUrdu
            ? `**Hisaab (Calculation):**\n\n\`${cleaned}\` = **${Number(result.toFixed(6))}**`
            : `**Result:**\n\n\`${cleaned}\` = **${Number(result.toFixed(6))}**`;
        }
      } catch {
        return null;
      }
    }

    return null;
  }

  private handleDateAndTime(prompt: string, isUrdu: boolean): string | null {
    if (!/\b(time|date|today|day of week|tareekh|waqt|aaj kya din|aaj ki date)\b/i.test(prompt)) {
      return null;
    }
    if (/\b(time travel|date of birth|update|validate|database|sql)\b/i.test(prompt)) {
      return null;
    }
    const now = new Date();
    const dateStr = now.toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const timeStr = now.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    });
    return isUrdu
      ? `Aap ki device ke mutabiq:\n\n- **Tareekh (Date):** ${dateStr}\n- **Waqt (Time):** ${timeStr}`
      : `According to your device clock:\n\n- **Date:** ${dateStr}\n- **Time:** ${timeStr}`;
  }

  private handleTranslation(prompt: string, isUrdu: boolean): string | null {
    const p = prompt.toLowerCase();
    const isTranslateReq =
      /\b(translate|translation|meaning of|matlab|urdu mein|english mein|tarjuma|phrases)\b/i.test(p);
    if (!isTranslateReq) return null;

    // Check common phrase request (e.g. from Quick Tools)
    if (/\b(phrases|common|sentences|jumlay)\b/i.test(p)) {
      const lines = PHRASE_TRANSLATIONS.map(
        (item, idx) =>
          `${idx + 1}. **English:** ${item.en}\n   - **Roman Urdu:** ${item.romanUr}\n   - **Urdu:** ${item.ur}`
      ).join('\n\n');
      return isUrdu
        ? `### Aam Bolchal aur Professional Phrases (Offline Translator)\n\n${lines}`
        : `### Common English & Urdu Phrases (Offline Translator)\n\n${lines}`;
    }

    // Extract single word or short phrase
    const quoteMatch = prompt.match(/["']([^"']+)["']/);
    const cleanedTarget = (
      quoteMatch?.[1] ||
      prompt
        .replace(
          /\b(translate|translation|what is the|meaning of|in urdu|to urdu|to english|in english|urdu mein|english mein|ka matlab|tarjuma|karein|karo|batao|please)\b/gi,
          ''
        )
        .trim()
    ).toLowerCase();

    if (cleanedTarget && ROMAN_URDU_WORDS[cleanedTarget]) {
      const hit = ROMAN_URDU_WORDS[cleanedTarget];
      return `### Offline Translation: "${cleanedTarget}"\n\n- **English:** ${hit.en}\n- **Urdu / Roman:** ${hit.ur}`;
    }

    // Word-by-word lookup for multi-word text
    const tokens = cleanedTarget.split(/\s+/).filter(Boolean);
    const matchedTokens = tokens
      .map((t) => {
        const clean = t.replace(/[^a-z0-9]/gi, '');
        const entry = ROMAN_URDU_WORDS[clean];
        return entry ? `- **${clean}** → ${entry.en} / ${entry.ur}` : null;
      })
      .filter(Boolean);

    if (matchedTokens.length > 0) {
      return `### Offline Word-by-Word Translation\n\n${matchedTokens.join('\n')}\n\n*Tip: Full sentence neural translation activates automatically when you switch back to Online Mode.*`;
    }

    return `### Offline Translator Ready\n\n${PHRASE_TRANSLATIONS.slice(0, 4)
      .map((x) => `- **${x.en}** → ${x.romanUr} (${x.ur})`)
      .join('\n')}\n\nTry asking the meaning of any word (e.g. *"meaning of success"* or *"phrases"*).`;
  }

  private handleCoding(prompt: string, isUrdu: boolean): string | null {
    const p = prompt.toLowerCase();
    const isCodeReq =
      /\b(code|program|script|function|component|python|javascript|typescript|react|next\.?js|html|css|sql|java|c\+\+|algorithm|fibonacci|palindrome|factorial|sort|loop|api|fetch|regex|debug|error|login form|navbar|button|table)\b/i.test(
        p
      );
    if (!isCodeReq) return null;

    if (/\b(fibonacci)\b/i.test(p)) {
      return `${isUrdu ? 'Yeh raha **Fibonacci Series** ka clean offline code:' : 'Here is a clean **Fibonacci Sequence** implementation:'}\n\n\`\`\`python\ndef fibonacci(n: int) -> list[int]:\n    seq = [0, 1]\n    for _ in range(2, n):\n        seq.append(seq[-1] + seq[-2])\n    return seq[:n]\n\nprint(fibonacci(10))  # [0, 1, 1, 2, 3, 5, 8, 13, 21, 34]\n\`\`\`\n\n\`\`\`javascript\nfunction fibonacci(n) {\n  const seq = [0, 1];\n  for (let i = 2; i < n; i++) seq.push(seq[i - 1] + seq[i - 2]);\n  return seq.slice(0, n);\n}\nconsole.log(fibonacci(10));\n\`\`\``;
    }

    if (/\b(palindrome)\b/i.test(p)) {
      return `${isUrdu ? 'Yeh raha **Palindrome Check** ka code:' : 'Here is a clean **Palindrome Checker**:'}\n\n\`\`\`javascript\nfunction isPalindrome(text) {\n  const clean = text.toLowerCase().replace(/[^a-z0-9]/g, '');\n  return clean === clean.split('').reverse().join('');\n}\nconsole.log(isPalindrome('Racecar')); // true\n\`\`\``;
    }

    if (/\b(factorial)\b/i.test(p)) {
      return `\`\`\`python\ndef factorial(n: int) -> int:\n    result = 1\n    for i in range(2, n + 1):\n        result *= i\n    return result\n\nprint(factorial(5))  # 120\n\`\`\``;
    }

    if (/\b(sql|database|query|select|join)\b/i.test(p)) {
      return `### SQL Query Examples\n\n\`\`\`sql\n-- Fetch active users with recent orders\nSELECT u.id, u.name, COUNT(o.id) AS total_orders\nFROM users u\nLEFT JOIN orders o ON o.user_id = u.id\nWHERE u.is_active = TRUE\nGROUP BY u.id, u.name\nORDER BY total_orders DESC;\n\`\`\``;
    }

    if (/\b(html|css|navbar|login form|button|card|landing)\b/i.test(p)) {
      return `### Responsive HTML + CSS Example\n\n\`\`\`html\n<div class="card">\n  <h2>Welcome Back</h2>\n  <form>\n    <input type="email" placeholder="Email address" required />\n    <input type="password" placeholder="Password" required />\n    <button type="submit">Sign In</button>\n  </form>\n</div>\n\n<style>\n  .card { max-width: 360px; margin: 2rem auto; padding: 1.5rem; border-radius: 16px; background: #14182d; color: #fff; font-family: sans-serif; }\n  input, button { width: 100%; padding: 10px 12px; margin-top: 10px; border-radius: 10px; border: 1px solid #2b335c; }\n  button { background: #6b46ff; color: #fff; font-weight: 700; border: none; cursor: pointer; }\n</style>\n\`\`\``;
    }

    if (/\b(react|next\.?js|component|hook|usestate)\b/i.test(p)) {
      return `### React / Next.js Starter Component\n\n\`\`\`tsx\n'use client';\nimport { useState } from 'react';\n\nexport function QuickCounter() {\n  const [count, setCount] = useState(0);\n  return (\n    <div className="p-4 rounded-xl border border-purple-500/30 space-y-2">\n      <p className="font-bold">Count: {count}</p>\n      <button\n        onClick={() => setCount((c) => c + 1)}\n        className="px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-semibold"\n      >\n        Increment\n      </button>\n    </div>\n  );\n}\n\`\`\``;
    }

    if (/\b(python)\b/i.test(p)) {
      return `### Python Clean Template\n\n\`\`\`python\ndef process_items(items: list[str]) -> dict[str, int]:\n    summary = {}\n    for item in items:\n        key = item.strip().lower()\n        if key:\n            summary[key] = summary.get(key, 0) + 1\n    return summary\n\nif __name__ == "__main__":\n    print(process_items(["AI", "Offline", "AI", "Fast"]))\n\`\`\``;
    }

    // General JS/TS helper for any requested topic
    const topicClean = prompt.slice(0, 60).replace(/[`\n]/g, ' ');
    return `${isUrdu ? `### Code Solution ("${topicClean}")` : `### Code Starter for "${topicClean}"`}\n\n\`\`\`typescript\n// Modular TypeScript template\nexport async function runTask<T>(input: T): Promise<{ ok: boolean; data: T; timestamp: string }> {\n  try {\n    return {\n      ok: true,\n      data: input,\n      timestamp: new Date().toISOString(),\n    };\n  } catch (error) {\n    console.error('Task error:', error);\n    throw error;\n  }\n}\n\`\`\`\n\n${isUrdu ? 'Agar aap ko kisi specific language (Python, Java, C++, SQL) mein code chahiye to us ka naam likhein.' : 'Specify your preferred language (Python, SQL, HTML/CSS, React) if you want a language-specific version.'}`;
  }

  private handleWritingAndTemplates(prompt: string, isUrdu: boolean): string | null {
    const p = prompt.toLowerCase();

    if (/\b(email|application|leave|darkhwast|job apply|cover letter|chutti)\b/i.test(p)) {
      if (/\b(leave|sick|chutti|absent)\b/i.test(p)) {
        return `### Professional Leave Application Email\n\n**Subject:** Leave Application – [Your Name]\n\nDear [Manager / Sir / Madam],\n\nI am writing to kindly request leave for **[Number] day(s)** starting from **[Start Date]** to **[End Date]** due to **[personal / medical reason]**.\n\nI have ensured my urgent tasks are up to date, and I will resume full responsibilities promptly on **[Return Date]**.\n\nThank you for your understanding and support.\n\nBest regards,\n**[Your Name]**\n**[Designation / Contact]**`;
      }
      return `### Professional Email / Application Template\n\n**Subject:** Regarding [Topic / Position Name]\n\nDear [Recipient Name],\n\nI hope this message finds you well. I am reaching out regarding **[brief purpose of your email]**.\n\n- **Key Point 1:** [Main background or skill]\n- **Key Point 2:** [Value or outcome you bring]\n- **Next Step:** I would appreciate a brief call or reply at your convenience.\n\nThank you for your time and consideration.\n\nSincerely,\n**[Your Name]**`;
    }

    if (/\b(cv|resume|biodata)\b/i.test(p)) {
      return `### Clean Modern Resume / CV Structure\n\n1. **Header:** Full Name • Phone • Email • City • LinkedIn/Portfolio\n2. **Professional Summary (2–3 lines):** Highlight years of experience, core domain, and top measurable achievement.\n3. **Core Skills:** Group into Technical Skills, Tools, and Soft Skills.\n4. **Work Experience:** Use bullet points starting with strong verbs (*Built, Improved, Led, Automated*) + numbers.\n5. **Education & Certifications:** Degree, Institution, Year.`;
    }

    if (/\b(essay|mazmoon|article|speech|taqreer)\b/i.test(p)) {
      const topic =
        prompt
          .replace(/\b(write|an|essay|article|speech|mazmoon|likho|per|par|on|about)\b/gi, '')
          .trim() || 'Technology & Education';
      return isUrdu
        ? `### "${topic}" — Mukammal Essay / Speech Outline\n\n**1. Taaruf (Introduction):**\n**${topic}** aaj ke daur ka ek nihayat aham mauzoo hai jo hamari rozmarra zindagi, taleem aur taraqqi par gehra asar dalta hai.\n\n**2. Aham Nuqaat (Key Points):**\n- **Bunyadi Kirdar:** Is ke zariye naye mawaqay aur asaniyan paida hoti hain.\n- **Faiday:** Waqt ki bachat, behtar quality aur ilm tak asaan rasai.\n- **Challenges:** Sahi istimal, aagahi aur barabar mawaqay ki kami.\n\n**3. Nateeja (Conclusion):**\nAgar hum **${topic}** ko musbat tareeqay aur hikmat se apnayein to mustaqbil roshan aur taraqqi-yafta ho sakta hai.`
        : `### Structured Essay: ${topic}\n\n**1. Introduction**\n**${topic}** plays a decisive role in shaping modern society, productivity, and future opportunities. Understanding both its benefits and responsibilities is essential.\n\n**2. Core Arguments**\n- **Positive Impact:** Accelerates innovation, saves time, and expands access to knowledge.\n- **Challenges:** Requires discipline, equitable access, and thoughtful planning to avoid misuse.\n- **Way Forward:** Combine education, practical habits, and ethical standards.\n\n**3. Conclusion**\nWith balanced adoption and continuous learning, **${topic}** becomes a powerful driver of long-term progress.`;
    }

    if (/\b(tutor|learn|teach me|sikhao|parhao|step by step)\b/i.test(p)) {
      return isUrdu
        ? `Bilkul! Main aap ka **Personal Offline AI Tutor** hoon. Batayein aap kaun sa subject ya skill seekhna chahte hain?\n\n- **Math & Science** (Formulas + Examples)\n- **Coding** (Python, JavaScript, Web Development)\n- **English Grammar & Speaking**\n- **Exam Preparation** (Quiz aur Notes summary)`
        : `I am ready as your **Personal Offline AI Tutor**! Tell me the topic you want to learn step by step:\n\n1. **Math & Science** (Formulas & solved examples)\n2. **Coding** (Python, JavaScript, React, SQL)\n3. **English Writing & Grammar**\n4. **PDF/Document Quiz Mode** (Upload any file to test yourself)`;
    }

    return null;
  }

  private handleVideoScripts(prompt: string, isUrdu: boolean): string | null {
    const p = prompt.toLowerCase();
    const isVideoScriptReq =
      /\b(video|youtube|tiktok|reels?|shorts|storyboard|intro video|promo video)\b/i.test(p) &&
      /\b(script|storyboard|outline|idea|ideas|plan|editing|edit|title|caption|hashtags|kaise banayein|kaise banaen|guide|tips|tutorial)\b/i.test(
        p
      );
    if (!isVideoScriptReq) return null;

    const topic =
      prompt
        .replace(
          /\b(write|make|give|create|for|a|an|the|youtube|tiktok|reels?|shorts|video|script|storyboard|editing|guide|likho|do|dein|batao|ka|ki|ke|par|per|pe)\b/gi,
          ''
        )
        .replace(/\s+/g, ' ')
        .trim() || 'Creative Story';

    if (isUrdu) {
      return `### Video Script & Shot Plan: "${topic}" (Offline Mode)\n\n**1. Hook (0:00 – 0:05)**\n- **Visual:** Tez dynamic close-up / glowing title screen.\n- **Voiceover:** *"Kya aap ne kabhi socha hai ke **${topic}** aap ki soch se zyada aasan aur zabardast ho sakta hai?"*\n\n**2. Main Scenes (0:05 – 0:25)**\n- **Scene 1 (Problem/Context):** Audience ka real masla dikhayein aur clear visuals chalayein.\n- **Scene 2 (Solution / Magic Moment):** **${topic}** ke 3 aham points screen text (bold captions) ke sath dikhayein.\n- **Scene 3 (Proof / Example):** Smooth zoom-in shot + before/after ya live result dikhayein.\n\n**3. Outro & Call-to-Action (0:25 – 0:30)**\n- **Visual:** Clean end-screen card.\n- **Voiceover:** *"Agar yeh video pasand aayi to Like, Share aur Follow zaroor karein!"*\n\n**Tip:** Agar aap direct playable **animated video** banana chahtay hain to likhein: *"${topic} ki video banao"* ya **Studio** tab mein **Video** mode select karein.`;
    }

    return `### Video Script & Scene Breakdown: "${topic}" (Offline Mode)\n\n**1. Hook (0:00 – 0:05)**\n- **Visual:** Fast zoom-in opening shot with bold kinetic title text.\n- **Voiceover:** *"Here is everything you need to know about **${topic}** in under 30 seconds."*\n\n**2. Core Scenes (0:05 – 0:25)**\n- **Scene 1 — Context:** Introduce the key problem or question cleanly with crisp b-roll.\n- **Scene 2 — 3 Takeaways:** Highlight 3 actionable steps or facts with on-screen captions.\n- **Scene 3 — Visual Highlight:** Smooth cinematic pan over the main result.\n\n**3. Call to Action (0:25 – 0:30)**\n- **Visual:** Clean branded outro card.\n- **Voiceover:** *"Save this video for later and follow for more!"*\n\n*Tip: Want a real playable animated clip? Type **"Create a video of ${topic}"** or switch Studio to **Video** mode.*`;
  }

  private async handleDocumentsAndNotes(
    prompt: string,
    context?: OfflineAIContext
  ): Promise<OfflineAIResult | null> {
    const p = prompt.toLowerCase();

    // 1. Direct attached chunks (from right sidebar or ChatView upload)
    if (context?.documentChunks && context.documentChunks.length > 0) {
      const topChunks = context.documentChunks.slice(0, 3);
      const sources = topChunks.map((c) => ({
        documentName: `Document Page ${c.pageNumber}`,
        page: c.pageNumber,
        text: c.text,
      }));
      if (/\b(quiz|mcq|test|question)\b/i.test(p)) {
        const combined = topChunks.map((c) => c.text).join(' ');
        const quiz = documentProcessor.generateQuizFromText(combined);
        const formatted = quiz
          .map(
            (q, i) =>
              `**Q${i + 1}. ${q.question}**\n${q.options.map((o, j) => `  ${String.fromCharCode(65 + j)}) ${o}`).join('\n')}\n  *Answer:* ${q.options[q.correctIndex]}`
          )
          .join('\n\n');
        return { text: formatted, sources, suggestedActions: ['Full Summary', 'More Questions'] };
      }
      if (/\b(summary|summarize|khulasa)\b/i.test(p)) {
        const summary = documentProcessor.generateLocalSummary(topChunks.map((c) => c.text).join('\n'));
        return {
          text: `### Document Summary (On-Device)\n\n${summary}`,
          sources,
          suggestedActions: ['Generate Quiz', 'More Details'],
        };
      }
      return {
        text: `Based on your uploaded document (**Page ${topChunks[0].pageNumber}**):\n\n> "${topChunks[0].text}"\n\n${topChunks[1] ? `**Related context (Page ${topChunks[1].pageNumber}):** ${topChunks[1].text.slice(0, 260)}...` : ''}`,
        sources,
        suggestedActions: ['Generate Quiz', 'Full Summary'],
      };
    }

    // 2. Search IndexedDB stored documents & notes when user mentions doc/pdf/notes/summarize
    if (typeof window !== 'undefined' && /\b(pdf|document|file|note|notes|uploaded|quiz|khulasa|summarize)\b/i.test(p)) {
      try {
        await db.init();
        const docs = await db.getDocuments();
        if (docs.length > 0) {
          const allChunks = docs.flatMap((d) => d.chunks || []);
          const matches = documentProcessor.searchSimilarChunks(prompt, allChunks, 3);
          const chosen = matches.length > 0 ? matches : allChunks.slice(0, 2);
          if (chosen.length > 0) {
            const docName = docs[0].name;
            if (/\b(quiz|mcq|test)\b/i.test(p)) {
              const quiz = documentProcessor.generateQuizFromText(chosen.map((c) => c.text).join(' '));
              return {
                text: quiz
                  .map(
                    (q, i) =>
                      `**Q${i + 1}. ${q.question}**\n${q.options.map((o, j) => `  ${String.fromCharCode(65 + j)}) ${o}`).join('\n')}`
                  )
                  .join('\n\n'),
                sources: chosen.map((c) => ({ documentName: docName, page: c.pageNumber, text: c.text })),
                suggestedActions: ['Full Summary', 'More Details'],
              };
            }
            const summary = documentProcessor.generateLocalSummary(chosen.map((c) => c.text).join('\n'));
            return {
              text: `### Offline Knowledge Search: ${docName}\n\n${summary}`,
              sources: chosen.map((c) => ({ documentName: docName, page: c.pageNumber, text: c.text })),
              suggestedActions: ['Generate Quiz', 'More Details'],
            };
          }
        }
      } catch {
        // IndexedDB not ready
      }
    }

    return null;
  }

  private handleFollowUp(prompt: string, context: OfflineAIContext | undefined, isUrdu: boolean): string | null {
    const p = prompt.trim().toLowerCase();
    const prevAssistant = [...(context?.history || [])].reverse().find((m) => m.role === 'assistant');
    if (!prevAssistant) return null;

    if (/^(summary|summarize|short|shorter|mukhtasar|in short)$/i.test(p)) {
      const cleanLines = prevAssistant.content
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('```') && !l.startsWith('#'));
      const bullets = cleanLines.slice(0, 4).map((l) => `- ${l.replace(/^[-*•]\s*/, '')}`);
      return `${isUrdu ? '### Mukhtasar Khulasa (Summary)' : '### Quick Summary'}\n\n${bullets.join('\n')}`;
    }

    if (/^(more details|explain more|detail|mazeed|aur batao|elaborate)$/i.test(p)) {
      return `${isUrdu ? '### Mazeed Tafseel (Actionable Breakdown)' : '### Deeper Breakdown & Next Steps'}\n\n1. **Core Takeaway:** Focus first on the fundamental concepts outlined above before scaling complexity.\n2. **Practical Application:** Break the task into 3 small verifiable steps and test each step locally.\n3. **Follow-up Tip:** Ask a specific question (e.g., *"Give a Python example"* or *"Make a checklist"*) to zoom into any section.`;
    }

    if (/^(urdu mein|in urdu|roman urdu)$/i.test(p)) {
      const snippet = prevAssistant.content.slice(0, 320).replace(/\n+/g, ' ');
      return `### Roman Urdu Khulasa\n\nPichlay jawab ka bunyadi matlab yeh hai:\n\n> ${snippet}...\n\nAap apna sawal Roman Urdu mein likh kar pooch saktay hain taa-ke seedha Roman Urdu mein jawab mile.`;
    }

    return null;
  }

  public async generate(
    prompt: string,
    context?: OfflineAIContext
  ): Promise<OfflineAIResult> {
    const trimmed = prompt.trim();
    const p = trimmed.toLowerCase();
    const isUrdu = this.detectRomanOrUrdu(trimmed, context?.language);

    // 1. Document / Notes RAG offline search
    const docResult = await this.handleDocumentsAndNotes(trimmed, context);
    if (docResult) return docResult;

    // 2. Follow-up quick chips ("Summary", "More Details", etc.)
    const followUp = this.handleFollowUp(trimmed, context, isUrdu);
    if (followUp) {
      return { text: followUp, suggestedActions: ['Summary', 'New Topic'] };
    }

    // 3. Greetings
    if (
      /^(hi|hello|hey|hy|salam|assalam\w*|aoa|good\s+(morning|afternoon|evening)|kya\s+h[ae]+l|kaise\s+ho)(\s+(o\s+alaikum|alaikum|there|everyone|friend|bhai|sir|madam|all|ai|offnex))?[!.\s?]*$/i.test(
        p
      )
    ) {
      return {
        text: isUrdu
          ? 'Walaikum Assalam! Main **Offnex Ai** (Offline Mode) hoon. Baghair internet ke bhi aap mujh se **Chat, Math, Coding, Emails/Essays, Translation, aur Image Studio** sab kuch online ki tarah use kar saktay hain. Aaj kya kaam karein?'
          : 'Hello! **Offnex Ai** is active in **Offline Mode**. You can ask questions, solve math & unit conversions, write code, draft emails/essays, translate phrases, or generate images offline. How can I help you today?',
        suggestedActions: ['Pakistan Economy', 'Write Email', 'Generate Code'],
      };
    }

    // 4. Math & Unit conversions
    const mathRes = this.evaluateMathAndConversions(trimmed, isUrdu);
    if (mathRes) {
      return { text: mathRes, suggestedActions: ['Another Calculation', 'Unit Converter Tips'] };
    }

    // 5. Device date / time
    const dateTimeRes = this.handleDateAndTime(trimmed, isUrdu);
    if (dateTimeRes) {
      return { text: dateTimeRes, suggestedActions: ['Study Plan', 'Math Help'] };
    }

    // 6. Translator
    const translationRes = this.handleTranslation(trimmed, isUrdu);
    if (translationRes) {
      return { text: translationRes, suggestedActions: ['More Phrases', 'Summary'] };
    }

    // 7. Coding assistant
    const codeRes = this.handleCoding(trimmed, isUrdu);
    if (codeRes) {
      return { text: codeRes, suggestedActions: ['Explain Code', 'Summary'] };
    }

    // 8. Writing / Drafting / Tutoring
    const writingRes = this.handleWritingAndTemplates(trimmed, isUrdu);
    if (writingRes) {
      return { text: writingRes, suggestedActions: ['Summary', 'More Details'] };
    }

    // 8b. Video Scripts & Storyboards
    const videoScriptRes = this.handleVideoScripts(trimmed, isUrdu);
    if (videoScriptRes) {
      return { text: videoScriptRes, suggestedActions: ['Summary', 'More Details'] };
    }

    // 9. Curated Knowledge Base match
    for (const entry of KNOWLEDGE_BASE) {
      if (entry.keywords.test(trimmed)) {
        return {
          text: isUrdu ? entry.romanUr : entry.en,
          suggestedActions: entry.actions || ['Summary', 'More Details'],
        };
      }
    }

    // 10. Intelligent Structured Offline Synthesizer (never a dead-end error!)
    const topicLabel = trimmed.replace(/[?!.]+$/, '').slice(0, 72);
    const structuredFallback = isUrdu
      ? `### Offline AI Jawab: "${topicLabel}"\n\n**1. Bunyadi Khulasa:**\nAap ne **${topicLabel}** ke baray mein poocha hai. Offline Mode mein is topic ko samajhne aur apply karne ka behtareen tareeqa yeh hai ke isay 3 aham hisson mein taqseem kiya jaye:\n\n- **Bunyadi Tasawur (Core Concept):** Sab se pehle bunyadi maqsad aur aham terminologies clear karein.\n- **Amali Qadam (Practical Steps):** Chote aur qabil-e-amal targets set kar ke step-by-step kaam shuru karein.\n- **Behtareen Nateeja (Best Practice):** Jo seekha hai usay practical example ya notes ke sath verify karein.\n\n**Aap kya kar saktay hain:**\nAgar aap chahain to mujh se **code example**, **essay/report outline**, **math calculation**, ya **Urdu-English translation** maang saktay hain — sab kuch baghair internet ke kaam karta hai!`
      : `### Offline AI Response: "${topicLabel}"\n\n**1. Overview & Key Takeaways**\nRegarding **${topicLabel}**, here is a structured on-device breakdown to help you move forward right away:\n\n- **Core Concept:** Identify the primary goal, constraints, and key definitions involved in *${topicLabel}*.\n- **Practical Framework:** Break the task into clear steps — plan inputs, execute a small test/draft, and review results.\n- **Pro Tip:** Save important points or upload reference PDFs/TXT files so Offnex Ai can cross-reference your own documents completely offline.\n\n*Want something specific? Try asking for a **step-by-step guide**, **code snippet**, **draft email/essay**, or **math/unit conversion**.*`;

    return {
      text: structuredFallback,
      suggestedActions: ['Summary', 'More Details'],
    };
  }
}

export const offlineAiEngine = new OfflineAIEngine();
