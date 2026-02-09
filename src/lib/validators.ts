// URL検証 + SSRF対策

// プライベートIPレンジの正規表現パターン
const PRIVATE_IP_PATTERNS = [
  /^127\./, // ループバック
  /^10\./, // クラスA プライベート
  /^172\.(1[6-9]|2[0-9]|3[01])\./, // クラスB プライベート
  /^192\.168\./, // クラスC プライベート
  /^169\.254\./, // リンクローカル / クラウドメタデータ
  /^0\./, // 0.0.0.0/8
  /^::1$/, // IPv6 ループバック
  /^fc00:/i, // IPv6 ユニークローカル
  /^fe80:/i, // IPv6 リンクローカル
];

// 禁止ホスト名
const BLOCKED_HOSTNAMES = [
  'localhost',
  'metadata.google.internal',
  'instance-data',
];

// 許可プロトコル
const ALLOWED_PROTOCOLS = ['http:', 'https:'];

interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * URLを検証しSSRF攻撃を防止する
 * @param url - 検証対象のURL文字列
 * @returns 検証結果
 */
export function validateUrl(url: string): ValidationResult {
  // 空チェック
  if (!url || typeof url !== 'string') {
    return { valid: false, error: 'URLが入力されていません' };
  }

  // 長さ制限（過度に長いURLを拒否）
  if (url.length > 2048) {
    return { valid: false, error: 'URLが長すぎます（2048文字以内）' };
  }

  // URLパース
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { valid: false, error: '無効なURL形式です' };
  }

  // プロトコルチェック
  if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
    return { valid: false, error: 'http または https のURLを入力してください' };
  }

  // ホスト名の存在チェック
  if (!parsed.hostname) {
    return { valid: false, error: 'ホスト名が指定されていません' };
  }

  // 禁止ホスト名チェック
  const lowerHostname = parsed.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.includes(lowerHostname)) {
    return { valid: false, error: 'このホストへのアクセスは許可されていません' };
  }

  // プライベートIPチェック
  for (const pattern of PRIVATE_IP_PATTERNS) {
    if (pattern.test(parsed.hostname)) {
      return { valid: false, error: 'プライベートIPアドレスへのアクセスは許可されていません' };
    }
  }

  // ユーザー情報（user:pass@host）を含むURLを拒否
  if (parsed.username || parsed.password) {
    return { valid: false, error: 'ユーザー情報を含むURLは許可されていません' };
  }

  return { valid: true };
}
