'use client';

import { useEffect, useState, type FormEvent } from 'react';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { getFirebaseAuth, isFirebaseConfigured } from '@/lib/firebase';
import {
  createRequest,
  subscribeRequests,
  updateStatus,
  STATUS_LABEL,
  STATUSES,
  type RequestDoc,
  type Status,
} from '@/lib/requests';
import { CATEGORY_LABEL, PRIORITY_LABEL, route } from '@/lib/routing';

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  // Firebase 未設定なら認証の解決を待つ必要がないため、初期値で確定させる
  const [ready, setReady] = useState(!isFirebaseConfigured);
  const [items, setItems] = useState<RequestDoc[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    return onAuthStateChanged(getFirebaseAuth(), (u) => {
      setUser(u);
      setReady(true);
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    return subscribeRequests(setItems, (e) => setError(e.message));
  }, [user]);

  // ログアウト直後に前のユーザーの一覧が残らないよう、描画側で絞る
  const visibleItems = user ? items : [];

  // 入力中に、どこへ振り分けられるかを即時プレビューする
  const preview = title || body ? route(title, body) : null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user || !title.trim()) return;
    setSending(true);
    setError(null);
    try {
      await createRequest({
        title: title.trim(),
        body: body.trim(),
        uid: user.uid,
        displayName: user.displayName,
      });
      setTitle('');
      setBody('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '送信に失敗しました');
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">依頼受付・振り分けボード</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            依頼内容から担当者と優先度を自動で判定します
          </p>
        </div>
        {user && (
          <button
            onClick={() => signOut(getFirebaseAuth())}
            className="shrink-0 rounded border px-3 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            ログアウト
          </button>
        )}
      </header>

      {!isFirebaseConfigured && (
        <div className="rounded border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-bold">Firebase が未設定です</p>
          <p className="mt-1">
            <code>.env.local.example</code> をコピーして <code>.env.local</code> を作り、
            Firebase コンソールの設定値を入れてください。振り分けロジック自体は設定なしでも動作します。
          </p>
        </div>
      )}

      {isFirebaseConfigured && ready && !user && (
        <button
          onClick={() => signInWithPopup(getFirebaseAuth(), new GoogleAuthProvider())}
          className="rounded bg-black px-4 py-2 text-white hover:opacity-80 dark:bg-white dark:text-black"
        >
          Google でログイン
        </button>
      )}

      {user && (
        <>
          <form onSubmit={handleSubmit} className="mb-8 space-y-3">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="件名（例：ログインできません）"
              aria-label="件名"
              className="w-full rounded border p-2"
            />
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="内容"
              aria-label="内容"
              rows={3}
              className="w-full rounded border p-2"
            />

            {preview && (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                振り分け先：<b>{preview.assignee}</b>（{CATEGORY_LABEL[preview.category]} ／ 優先度{' '}
                {PRIORITY_LABEL[preview.priority]}）
                {preview.matched.length > 0 && `　判定語：${preview.matched.join('、')}`}
              </p>
            )}

            <button
              type="submit"
              disabled={!title.trim() || sending}
              className="rounded bg-black px-4 py-2 text-white disabled:opacity-40 dark:bg-white dark:text-black"
            >
              {sending ? '送信中…' : '依頼を登録'}
            </button>
          </form>

          {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

          <ul className="space-y-3">
            {visibleItems.map((it) => (
              <li key={it.id} className="rounded border p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded bg-gray-100 px-2 py-0.5 text-xs dark:bg-gray-800">
                    {CATEGORY_LABEL[it.category]}
                  </span>
                  {it.priority === 'high' && (
                    <span className="rounded bg-red-100 px-2 py-0.5 text-xs text-red-700">至急</span>
                  )}
                  <b>{it.title}</b>
                </div>
                {it.body && <p className="mt-1 text-sm whitespace-pre-wrap">{it.body}</p>}
                <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                  <span>担当：{it.assignee}</span>
                  <span>依頼者：{it.createdByName ?? '不明'}</span>
                  <select
                    value={it.status}
                    onChange={(e) => updateStatus(it.id, e.target.value as Status)}
                    aria-label={`${it.title} のステータス`}
                    className="rounded border px-2 py-1"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABEL[s]}
                      </option>
                    ))}
                  </select>
                </div>
              </li>
            ))}
          </ul>

          {visibleItems.length === 0 && (
            <p className="text-sm text-gray-500">まだ依頼がありません。</p>
          )}
        </>
      )}
    </main>
  );
}
