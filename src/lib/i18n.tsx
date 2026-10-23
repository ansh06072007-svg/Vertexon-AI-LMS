import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type Language = 'en' | 'hi';

const dictionary: Record<string, string> = {
  Dashboard: 'डैशबोर्ड',
  Learn: 'कोर्स',
  'AI Tutor': 'एआई ट्यूटर',
  Assignments: 'असाइनमेंट',
  Community: 'कम्युनिटी',
  Practice: 'अभ्यास',
  Achievements: 'उपलब्धियाँ',
  Certificates: 'सर्टिफिकेट',
  Overview: 'अवलोकन',
  'My courses': 'मेरे कोर्स',
  Analytics: 'एनालिटिक्स',
  Grading: 'ग्रेडिंग',
  Courses: 'कोर्स',
  'Users & roles': 'यूज़र्स और भूमिकाएँ',
  Moderation: 'मॉडरेशन',
  Settings: 'सेटिंग्स',
  'Sign out': 'साइन आउट',
  'Account settings': 'अकाउंट सेटिंग्स',
  'Search courses, lessons, notes...': 'कोर्स, लेसन, नोट्स खोजें...',
  Workspace: 'वर्कस्पेस',
  More: 'और',
  'Weekly streak': 'साप्ताहिक स्ट्रीक',
  days: 'दिन',
  Governance: 'गवर्नेंस',
  Studio: 'स्टूडियो',
  'Course catalog': 'कोर्स कैटलॉग',
  'Course-grounded assistance': 'कोर्स-आधारित सहायता',
  'Milestones & certificates': 'माइलस्टोन और सर्टिफिकेट',
  'Coursework & feedback': 'कोर्सवर्क और फीडबैक',
  'Discussions & study circle': 'चर्चाएँ और स्टडी सर्कल',
  'Teaching overview': 'टीचिंग अवलोकन',
  'Authoring & curriculum': 'ऑथरिंग और पाठ्यक्रम',
  'Learning intelligence': 'लर्निंग इंटेलिजेंस',
  'Platform governance': 'प्लेटफ़ॉर्म गवर्नेंस',
  'Content governance': 'कंटेंट गवर्नेंस',
  'Access control': 'एक्सेस कंट्रोल',
  'Trust & safety': 'ट्रस्ट और सेफ्टी',
  'Lesson Player': 'लेसन प्लेयर',
  'Data Structures & Algorithms': 'डेटा स्ट्रक्चर्स और एल्गोरिदम',
  'Graph Theory & Shortest Path': 'ग्राफ थ्योरी और शॉर्टेस्ट पाथ',
  'Instructor Studio': 'इंस्ट्रक्टर स्टूडियो',
  'Admin Console': 'एडमिन कंसोल',
  'Course Approvals': 'कोर्स अप्रूवल',
  'Users & Roles': 'यूज़र्स और भूमिकाएँ',
  'No new notifications. You are all caught up.': 'कोई नई नोटिफिकेशन नहीं। आप अप टू डेट हैं।',
  'Language switched to Hindi': 'भाषा हिंदी में बदल गई।',
  'Language switched to English': 'भाषा अंग्रेज़ी में बदल गई।',
  'Switch to Hindi': 'हिंदी में बदलें',
  'Switch to English': 'अंग्रेज़ी में बदलें',
};

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  toggleLanguage: () => void;
  t: (key: string) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => {
    try {
      return localStorage.getItem('vertexon-language') === 'hi' ? 'hi' : 'en';
    } catch {
      return 'en';
    }
  });

  useEffect(() => {
    document.documentElement.lang = language;
    try {
      localStorage.setItem('vertexon-language', language);
    } catch {
      // Language persistence is best-effort in restricted browsing modes.
    }
  }, [language]);

  const t = useCallback(
    (key: string) => (language === 'hi' ? dictionary[key] || key : key),
    [language],
  );

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      setLanguage,
      toggleLanguage: () => setLanguage((current) => (current === 'en' ? 'hi' : 'en')),
      t,
    }),
    [language, t],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useI18n() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useI18n must be used inside LanguageProvider.');
  return context;
}
