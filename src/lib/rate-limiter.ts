// インメモリIPベースレート制限

// レート制限の設定
const WINDOW_MS = 60 * 1000; // 1分間
const MAX_REQUESTS = 10; // ウィンドウあたりの最大リクエスト数

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// インメモリストア（Edge Runtimeでも動作）
const store = new Map<string, RateLimitEntry>();

// 古いエントリを定期的にクリーンアップ（メモリリーク防止）
const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5分ごと
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;

  for (const [key, entry] of store) {
    if (entry.resetAt <= now) {
      store.delete(key);
    }
  }
}

interface RateLimitResult {
  allowed: boolean;
  retryAfter?: number; // 秒
}

/**
 * IPベースのレート制限チェック
 * @param ip - クライアントのIPアドレス
 * @returns レート制限の結果
 */
export function checkRateLimit(ip: string): RateLimitResult {
  cleanup();

  const now = Date.now();
  const entry = store.get(ip);

  // エントリがない、またはウィンドウがリセット済み
  if (!entry || entry.resetAt <= now) {
    store.set(ip, {
      count: 1,
      resetAt: now + WINDOW_MS,
    });
    return { allowed: true };
  }

  // ウィンドウ内でリクエスト数チェック
  if (entry.count >= MAX_REQUESTS) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, retryAfter };
  }

  // カウント増加
  entry.count += 1;
  return { allowed: true };
}
