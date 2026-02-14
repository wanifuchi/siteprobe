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
  evaluationFramework?: string;  // 評価フレームワーク名（例: "E-E-A-T"）
  scoringCriteria?: string;      // ペルソナ固有のスコア基準（数値基準含む）
  exclusions?: string;           // 評価対象外の領域（他ペルソナとの境界）
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
  // ロードマップ用（ルールベース推定で付与）
  estimatedHours?: number;
  estimatedScoreImpact?: number;
  effortLevel?: 'quick' | 'moderate' | 'significant';
  priority?: number;
}

// 改善ロードマップ
export interface RoadmapPhase {
  phase: number;
  label: string;
  estimatedTotalHours: number;
  expectedScoreGain: number;
  findings: Finding[];
}

export interface ImprovementRoadmap {
  phases: RoadmapPhase[];
  totalEstimatedHours: number;
  expectedFinalScore: number;
  currentScore: number;
}

// 競合比較結果
export interface CompetitorComparison {
  mainSiteAdvantages: string[];   // メインサイトが優れている点
  competitorAdvantages: string[]; // 競合が優れている点
  suggestions: string[];          // 競合から学べる改善提案
  overallAssessment: string;      // 総合比較評価
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
  competitorComparison?: CompetitorComparison;
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
  competitorUrl?: string;
  competitorScrapedData?: ScrapedData | null;
  // 複数競合比較（機能2）
  competitorUrls?: string[];
  competitorQuickResults?: CompetitorQuickResult[];
}

// トレンドデータ（機能1）
export interface TrendDataPoint {
  analysisId: string;
  date: string;
  overallScore: number;
  categoryScores: CategoryScore[];
}

export interface UrlTrend {
  url: string;
  dataPoints: TrendDataPoint[];
}

// 競合簡易スコア結果（機能2）
export interface CompetitorQuickResult {
  url: string;
  title: string;
  categoryScores: CategoryScore[];
  overallScore: number;
  strengths: string[];
  weaknesses: string[];
}

export interface CompetitorQuickRequest {
  scrapedData: ScrapedData;
}

export interface CompetitorQuickResponse {
  success: boolean;
  result?: CompetitorQuickResult;
  error?: string;
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
  competitorUrl?: string;
  competitorUrls?: string[];
}

// ストアの型
export interface AnalysisState {
  status: AnalysisStatus;
  currentAnalysis: AnalysisResult | null;
  startAnalysis: (url: string, personas: Persona[], competitorUrl?: string) => void;
  updatePersonaStatus: (personaId: string, status: PersonaAnalysisStatus) => void;
  setPersonaResult: (personaId: string, result: Partial<PersonaResult>) => void;
  setScrapedData: (data: ScrapedData) => void;
  setCompetitorScrapedData: (data: ScrapedData) => void;
  setCompetitorQuickResults: (results: CompetitorQuickResult[]) => void;
  setCompetitorUrls: (urls: string[]) => void;
  completeAnalysis: () => void;
  cancelAnalysis: () => void;
  setError: (error: string) => void;
  reset: () => void;
}

// チャットメッセージ
export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
  timestamp: string;
}

// チャットAPIリクエスト
export interface PersonaChatRequest {
  persona: { name: string; specialty: string; analysisPoints: string };
  analysisContext: { url: string; summary: string; score: number; findings: Finding[] };
  conversationHistory: ChatMessage[];
  message: string;
}

// チャットAPIレスポンス
export interface PersonaChatResponse {
  success: boolean;
  message?: string;
  error?: string;
}

// ペルソナAIアシスト
export interface PersonaAssistRequest {
  theme: string;
}

export interface PersonaAssistResponse {
  success: boolean;
  persona?: {
    name: string;
    specialty: string;
    analysisPoints: string;
    category: PersonaCategory;
    evaluationFramework: string;
    scoringCriteria: string;
    exclusions: string;
  };
  error?: string;
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
  competitorScrapedData?: ScrapedData;
}

export interface PersonaAnalyzeResponse {
  success: boolean;
  result?: {
    score: number;
    summary: string;
    findings: Finding[];
    thinkingProcess: string;
    competitorComparison?: CompetitorComparison;
  };
  error?: string;
}
