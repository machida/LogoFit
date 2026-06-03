/**
 * 直列化 + コアレッシングのキュー。データ破損防止の中核。
 * - perform は同時に 1 つしか走らない（直列）。
 * - enqueue を連打すると「最後の要求」だけが実行され、中間要求は飛ばす（最新優先）。
 * - 各 enqueue が返す Promise は、自分または自分より後の要求の実行完了で settle する。
 *   実行が失敗（reject）した場合は、その実行を待っていた全要求へ同じエラーを伝播する。
 */
export function createCoalescingQueue<T>(perform: (value: T) => Promise<void>) {
  let pending: { value: T } | null = null;
  let flushing = false;
  let waiters: Array<(err: unknown) => void> = [];

  async function flush(): Promise<void> {
    if (flushing) return;
    flushing = true;
    try {
      while (pending) {
        const { value } = pending;
        pending = null;
        // この実行が完了するまでに溜まった待ち手を確定（以降の要求は次サイクルで処理）
        const current = waiters;
        waiters = [];
        let error: unknown = null;
        try {
          await perform(value);
        } catch (e) {
          error = e;
        }
        for (const notify of current) notify(error);
      }
    } finally {
      flushing = false;
    }
  }

  return function enqueue(value: T): Promise<void> {
    pending = { value }; // 直前の保留要求は上書き（＝最新だけを実行）
    return new Promise<void>((resolve, reject) => {
      waiters.push((err) => (err ? reject(err) : resolve()));
      void flush();
    });
  };
}
