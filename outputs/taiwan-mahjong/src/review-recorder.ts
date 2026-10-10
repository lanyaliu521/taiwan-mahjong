import { captureDecision } from './decision-snapshot.js';
import type { DecisionSnapshot } from './decision-snapshot.js';
import { REVIEW_KEY, REVIEW_LIMITS, readReviewArchive, appendReviewLocked, clearReviewLocked } from './review-store.js';

export type ReviewStatus = { count: number; pending: number; busy: boolean; failed: boolean; notice: string };
/** Optional local history: failures never propagate into a game transition. */
export function createReviewRecorder(storage: Pick<Storage, 'getItem' | 'setItem'>,
  changed: () => void, locks: Pick<LockManager, 'request'> | undefined = globalThis.navigator?.locks) {
  const pending: DecisionSnapshot[] = [];
  let count = 0, busy = false, notice = '', blocked = false;
  const errorText = (error: unknown) => {
    const message = error instanceof Error ? error.message : '';
    if (message === 'REVIEW_LOCK_UNAVAILABLE') return '此瀏覽器無法安全保存檢討；對戰仍可繼續。';
    if (message === 'REVIEW_BUSY' || message === 'REVIEW_CONFLICT') return '另一頁正在更新檢討。待處理記錄暫留此頁，請稍後重試。';
    return '檢討未能保存，原資料已保留。請保持此頁開啟並重試；對戰存檔不受影響。';
  };
  const notify = () => { try { changed(); } catch { /* Optional status rendering cannot affect play or storage. */ } };
  function inspect() {
    try { count = readReviewArchive(storage).records.length; }
    catch (error) { blocked = true; notice = errorText(error); }
  }
  inspect();
  async function flush() {
    if (busy || blocked) return;
    busy = true; notify();
    try {
      while (pending.length) {
        const { raw } = readReviewArchive(storage);
        await appendReviewLocked(storage, raw, pending[0], locks);
        pending.shift(); count = readReviewArchive(storage).records.length;
      }
      notice = '';
    } catch (error) { blocked = true; notice = errorText(error); }
    finally { busy = false; notify(); }
  }
  return {
    status: (): ReviewStatus => ({ count, pending: pending.length, busy, failed: blocked, notice }),
    skipUnsavedGame() { notice = '牌局尚未存妥，這次未收錄檢討；請先處理牌局儲存。'; notify(); },
    record(...args: Parameters<typeof captureDecision>) {
      try {
        // ponytail: keep at most 20 unsaved records in memory; no unbounded queue or background retries.
        if (pending.length >= REVIEW_LIMITS.records) { notice = '待存檢討已達20筆，後續記錄暫停收集。請重試保存；牌局仍可繼續。'; notify(); return; }
        pending.push(captureDecision(...args));
        void flush(); notify();
      } catch { notice = '這次檢討無法建立，已略過；牌局操作與存檔不受影響。'; notify(); }
    },
    async retry() { if (busy) return; blocked = false; await flush(); if (!pending.length) { inspect(); notify(); } },
    async clear() {
      if (busy) return;
      busy = true; notify();
      try {
        // Read raw without decoding so explicitly confirmed corrupt archives can also be cleared.
        await clearReviewLocked(storage, storage.getItem(REVIEW_KEY), locks);
        pending.length = 0; count = 0; blocked = false; notice = '檢討記錄已清除；對戰與練習進度保留。';
      } catch (error) { blocked = true; notice = errorText(error); }
      finally { busy = false; notify(); }
    },
    externalChange() { inspect(); notify(); },
  };
}
