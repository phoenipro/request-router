import { describe, it, expect } from 'vitest';
import {
  classify,
  detectPriority,
  normalize,
  route,
  FALLBACK_ASSIGNEE,
  type RoutingRule,
} from './routing';

describe('normalize', () => {
  it('全角英数を半角にして小文字化する', () => {
    expect(normalize('ＰＣ')).toBe('pc');
    expect(normalize('  Login  ')).toBe('login');
  });
});

describe('classify', () => {
  it('キーワードが一致したカテゴリと担当者を返す', () => {
    const r = classify('パスワードが分かりません');
    expect(r.category).toBe('system');
    expect(r.assignee).toBe('情報システム担当');
    expect(r.matched).toContain('パスワード');
  });

  it('全角で書かれていても一致する', () => {
    expect(classify('ＰＣが起動しません').category).toBe('system');
  });

  it('一致が多いカテゴリを選ぶ', () => {
    // system: パスワード・ログイン の2件 / hr: 勤怠 の1件
    const r = classify('勤怠システムのログインでパスワードが通りません');
    expect(r.category).toBe('system');
  });

  it('同数の場合は先に定義されたルールを優先する', () => {
    const rules: RoutingRule[] = [
      { category: 'system', keywords: ['共通語'], assignee: 'A' },
      { category: 'hr', keywords: ['共通語'], assignee: 'B' },
    ];
    expect(classify('共通語です', rules).assignee).toBe('A');
  });

  it('一致しなければ other と一次受付になる', () => {
    const r = classify('来客用のお茶菓子について');
    expect(r.category).toBe('other');
    expect(r.assignee).toBe(FALLBACK_ASSIGNEE);
    expect(r.matched).toEqual([]);
  });
});

describe('detectPriority', () => {
  it('緊急語があれば high', () => {
    expect(detectPriority('至急対応をお願いします')).toBe('high');
    expect(detectPriority('メールが動かない')).toBe('high');
  });

  it('低優先語があれば low', () => {
    expect(detectPriority('いつでも構いません')).toBe('low');
  });

  it('どちらも無ければ normal', () => {
    expect(detectPriority('備品の補充をお願いします')).toBe('normal');
  });

  it('緊急語と低優先語が混在する場合は取りこぼさないよう high にする', () => {
    expect(detectPriority('急ぎませんが、システムが止まっています')).toBe('high');
  });
});

describe('route', () => {
  it('件名と本文をまとめて判定する', () => {
    const r = route('ログインできない', '至急みてほしいです');
    expect(r).toMatchObject({
      category: 'system',
      assignee: '情報システム担当',
      priority: 'high',
    });
  });

  it('本文側のキーワードでも判定できる', () => {
    const r = route('相談です', '有給の残日数を知りたい');
    expect(r.category).toBe('hr');
  });
});
