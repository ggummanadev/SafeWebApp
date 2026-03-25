export interface AnalysisResult {
  id?: string;
  url: string;
  name: string;
  category: string;
  serviceDescription: string;
  securitySummary: string;
  isBasicVerified: boolean;
  isDeepVerified: boolean;
  basicReport?: string;
  deepGuide?: string;
  structuredPoints?: { icon: string; title: string; desc: string }[];
  owaspAnalysis?: { item: string; status: 'safe' | 'warning' | 'danger'; desc: string }[];
  timestamp: number;
  thumbnail?: string;
  isSafe?: boolean;
  password?: string;
  mainMenus?: string[];
}

export interface AppInfo {
  id: string;
  name: string;
  category: string;
  serviceDescription: string;
  securitySummary: string;
  isBasicVerified: boolean;
  isDeepVerified: boolean;
  thumbnail?: string;
  isSafe?: boolean;
}

export interface Post {
  id: string;
  title: string;
  content: string;
  authorName: string;
  authorEmail: string;
  authorUid: string;
  timestamp: number;
}

export interface AdminSettings {
  adminEmails: string[];
}
