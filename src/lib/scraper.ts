// Webスクレイピング処理

import * as cheerio from 'cheerio';
import type { ScrapedData } from '@/types';

// HTML本文の最大文字数
const MAX_HTML_LENGTH = 50000;
// fetchタイムアウト（ミリ秒）
const FETCH_TIMEOUT = 8000;

const USER_AGENT =
  'Mozilla/5.0 (compatible; SiteProbe/1.0; +https://siteprobe.example.com)';

/**
 * 指定URLからHTMLを取得しパースしてScrapedDataを返す
 */
export async function scrapeUrl(url: string): Promise<ScrapedData> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'ja,en;q=0.9',
      },
      signal: controller.signal,
      redirect: 'follow',
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('リクエストがタイムアウトしました（8秒）');
    }
    throw new Error(`ページの取得に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`);
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ページの取得に失敗しました`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
    throw new Error('HTMLページではありません');
  }

  const rawHtml = await response.text();
  const $ = cheerio.load(rawHtml);

  // title
  const title = $('title').first().text().trim();

  // meta description
  const description =
    $('meta[name="description"]').attr('content')?.trim() ||
    $('meta[property="og:description"]').attr('content')?.trim() ||
    '';

  // 見出し（h1-h6）
  const headings: string[] = [];
  $('h1, h2, h3, h4, h5, h6').each((_, el) => {
    const text = $(el).text().trim();
    if (text) {
      headings.push(`${el.tagName.toUpperCase()}: ${text}`);
    }
  });

  // リンク（最大100件）
  const links: { href: string; text: string }[] = [];
  $('a[href]').each((_, el) => {
    if (links.length >= 100) return false;
    const href = $(el).attr('href') || '';
    const text = $(el).text().trim();
    if (href && !href.startsWith('javascript:') && !href.startsWith('#')) {
      links.push({ href, text: text.slice(0, 200) });
    }
  });

  // 画像（最大50件）
  const images: { src: string; alt: string }[] = [];
  $('img[src]').each((_, el) => {
    if (images.length >= 50) return false;
    const src = $(el).attr('src') || '';
    const alt = $(el).attr('alt') || '';
    if (src) {
      images.push({ src, alt: alt.slice(0, 200) });
    }
  });

  // メタタグ
  const metaTags: Record<string, string> = {};
  $('meta').each((_, el) => {
    const name = $(el).attr('name') || $(el).attr('property') || $(el).attr('http-equiv') || '';
    const content = $(el).attr('content') || '';
    if (name && content) {
      metaTags[name] = content.slice(0, 500);
    }
  });

  // 構造化データ（JSON-LD）
  const structuredData: object[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const parsed = JSON.parse($(el).html() || '');
      structuredData.push(parsed);
    } catch {
      // JSON-LDのパースエラーは無視
    }
  });

  // CSSクラス（ユニーク、最大200件）
  const classSet = new Set<string>();
  $('[class]').each((_, el) => {
    const classes = $(el).attr('class')?.split(/\s+/) || [];
    for (const cls of classes) {
      if (cls && classSet.size < 200) {
        classSet.add(cls);
      }
    }
  });
  const cssClasses = Array.from(classSet);

  // スクリプトのsrc（最大30件）
  const scripts: string[] = [];
  $('script[src]').each((_, el) => {
    if (scripts.length >= 30) return false;
    const src = $(el).attr('src') || '';
    if (src) {
      scripts.push(src);
    }
  });

  // パフォーマンスヒント
  const hasSsl = url.startsWith('https://');
  const hasResponsiveMeta = !!$('meta[name="viewport"]').length;

  // 大きな画像の判定（width/height属性が大きい、またはdata-srcが指定されていない大きな画像）
  let hasLargeImages = false;
  $('img').each((_, el) => {
    const width = parseInt($(el).attr('width') || '0', 10);
    const height = parseInt($(el).attr('height') || '0', 10);
    if (width > 1200 || height > 1200) {
      hasLargeImages = true;
      return false;
    }
  });

  // ミニファイ判定（.min. を含むスクリプト/CSSがあるか）
  let hasMinifiedAssets = false;
  $('script[src], link[rel="stylesheet"][href]').each((_, el) => {
    const src = $(el).attr('src') || $(el).attr('href') || '';
    if (src.includes('.min.')) {
      hasMinifiedAssets = true;
      return false;
    }
  });

  // HTMLを制限サイズに切り詰め
  const html = rawHtml.slice(0, MAX_HTML_LENGTH);

  return {
    url,
    title,
    description,
    html,
    headings,
    links,
    images,
    metaTags,
    structuredData,
    cssClasses,
    scripts,
    performanceHints: {
      hasLargeImages,
      hasMinifiedAssets,
      hasResponsiveMeta,
      hasSsl,
    },
    fetchedAt: new Date().toISOString(),
  };
}
