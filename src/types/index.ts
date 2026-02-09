// ペルソナ関連の型定義
export type PersonaCategory = 'marketing' | 'design' | 'technical' | 'business' | 'user';

export interface Persona {
  id: string;
  name: string;
  specialty: string;
  analysisPoints: string;
  category: PersonaCategory;
  icon: string; // Lucide icon名
  isDefault: boolean;
  enabled: boolean;
}

// スクレイピング結果
export interface ScrapedData {
  url: string;
  title: string;
  description: string;
  html: string; // サイズ制限あり
  headings: string[];
  links: { href: string; text: string }[];
  images: { src: string; alt: string }[];
  metaTags: Record<string, string>;
  structuredData: object[];
  cssClasses: string[];
  scripts: string[];
  performanceHints: {
    hasLargeImages: boolean;
    hasMinifiedAssets: boolean;
    hasResponsiveMeta: boolean;
    hasSsl: boolean;
  };
  fetchedAt: string;
}

// 分析結果
export type AnalysisStatus = 'idle' | 'preparing' | 'analyzing' | 'completed' | 'error' | 'cancelled';
export type PersonaAnalysisStatus = 'waiting' | 'analyzing' | 'completed' | 'error';
export type Severity = 'high' | 'medium' | 'low';

export interface Finding {
  id: string;
  category: string;
  severity: Severity;
  title: string;
  description: string;
  recommendation: string;
  codeExample?: string;
}

export interface PersonaResult {
  personaId: string;
  personaName: string;
  personaIcon: string;
  personaCategory: PersonaCategory;
  status: PersonaAnalysisStatus;
  score: number; // 0-100
  summary: string;
  findings: Finding[];
  thinkingProcess: string; // 分析過程
  completedAt?: string;
  error?: string;
}

export interface CategoryScore {
  category: PersonaCategory;
  label: string;
  score: number;
  color: string;
}

export interface AnalysisResult {
  id: string;
  url: string;
  createdAt: string;
  status: AnalysisStatus;
  scrapedData: ScrapedData | null;
  personaResults: PersonaResult[];
  overallScore: number; // 0-100
  categoryScores: CategoryScore[];
  elapsedTime: number; // ミリ秒
}

// 履歴用の軽量版
export interface AnalysisHistoryItem {
  id: string;
  url: string;
  createdAt: string;
  overallScore: number;
  categoryScores: CategoryScore[];
  personaCount: number;
  completedPersonaCount: number;
}

// ストアの型
export interface AnalysisState {
  status: AnalysisStatus;
  currentAnalysis: AnalysisResult | null;
  startAnalysis: (url: string, personas: Persona[]) => void;
  updatePersonaStatus: (personaId: string, status: PersonaAnalysisStatus) => void;
  setPersonaResult: (personaId: string, result: Partial<PersonaResult>) => void;
  setScrapedData: (data: ScrapedData) => void;
  completeAnalysis: () => void;
  cancelAnalysis: () => void;
  setError: (error: string) => void;
  reset: () => void;
}

// APIレスポンス型
export interface ScrapeResponse {
  success: boolean;
  data?: ScrapedData;
  error?: string;
}

export interface PersonaAnalyzeRequest {
  scrapedData: ScrapedData;
  persona: Persona;
}

export interface PersonaAnalyzeResponse {
  success: boolean;
  result?: {
    score: number;
    summary: string;
    findings: Finding[];
    thinkingProcess: string;
  };
  error?: string;
}
