/**
 * 依頼内容から「カテゴリ・担当者・優先度」を決めるロジック。
 *
 * Firestore や UI から独立した純粋関数にしてあります。
 * 振り分けルールは業務側の都合で頻繁に変わる部分なので、
 * 外部I/Oを持たせずテストで固定できる形にしておくのが狙いです。
 */

export const CATEGORIES = ['system', 'facility', 'hr', 'other'] as const;
export type Category = (typeof CATEGORIES)[number];

export const PRIORITIES = ['high', 'normal', 'low'] as const;
export type Priority = (typeof PRIORITIES)[number];

export interface RoutingRule {
  category: Exclude<Category, 'other'>;
  /** 部分一致で判定するキーワード */
  keywords: string[];
  assignee: string;
}

export interface RoutingResult {
  category: Category;
  assignee: string;
  priority: Priority;
  /** 判定の根拠になったキーワード。UI に理由を出すために返す */
  matched: string[];
}

/** 未分類のときの引き受け先 */
export const FALLBACK_ASSIGNEE = '一次受付';

/** 優先度を上げる語 */
const URGENT_WORDS = ['至急', '緊急', '今日中', '止まって', '動かない', '障害'];
/** 優先度を下げる語 */
const LOW_WORDS = ['いつでも', '急ぎません', '参考まで', '確認だけ'];

export const DEFAULT_RULES: RoutingRule[] = [
  {
    category: 'system',
    keywords: ['パソコン', 'PC', 'ログイン', 'パスワード', 'メール', 'ネットワーク', 'システム', 'エラー'],
    assignee: '情報システム担当',
  },
  {
    category: 'facility',
    keywords: ['備品', '什器', '鍵', '空調', '照明', '清掃', '駐車場'],
    assignee: '総務担当',
  },
  {
    category: 'hr',
    keywords: ['有給', '勤怠', '給与', '社会保険', '入社', '退職', '研修'],
    assignee: '人事担当',
  },
];

/**
 * 全角英数を半角に寄せ、小文字化する。
 * 「ＰＣ」と「pc」を同じものとして扱うため。
 */
export function normalize(text: string): string {
  return text
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .toLowerCase()
    .trim();
}

/**
 * 一致したキーワードが最も多いカテゴリを返す。
 * 同数の場合はルール配列で先に定義されている方を優先する（判定を安定させるため）。
 * 1つも一致しなければ 'other'。
 */
export function classify(
  text: string,
  rules: RoutingRule[] = DEFAULT_RULES
): { category: Category; assignee: string; matched: string[] } {
  const normalized = normalize(text);

  let best: { rule: RoutingRule; matched: string[] } | null = null;

  for (const rule of rules) {
    const matched = rule.keywords.filter((k) => normalized.includes(normalize(k)));
    if (matched.length === 0) continue;
    if (!best || matched.length > best.matched.length) {
      best = { rule, matched };
    }
  }

  if (!best) {
    return { category: 'other', assignee: FALLBACK_ASSIGNEE, matched: [] };
  }
  return { category: best.rule.category, assignee: best.rule.assignee, matched: best.matched };
}

/**
 * 優先度を判定する。緊急語が1つでもあれば high。
 * 緊急語と低優先語が両方ある場合は、取りこぼしを防ぐため high を優先する。
 */
export function detectPriority(text: string): Priority {
  const normalized = normalize(text);
  if (URGENT_WORDS.some((w) => normalized.includes(normalize(w)))) return 'high';
  if (LOW_WORDS.some((w) => normalized.includes(normalize(w)))) return 'low';
  return 'normal';
}

/** 件名と本文をまとめて判定する入口 */
export function route(
  title: string,
  body: string,
  rules: RoutingRule[] = DEFAULT_RULES
): RoutingResult {
  const text = `${title} ${body}`;
  const { category, assignee, matched } = classify(text, rules);
  return { category, assignee, priority: detectPriority(text), matched };
}

export const CATEGORY_LABEL: Record<Category, string> = {
  system: 'システム',
  facility: '設備・備品',
  hr: '人事・労務',
  other: 'その他',
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  high: '至急',
  normal: '通常',
  low: '低',
};
