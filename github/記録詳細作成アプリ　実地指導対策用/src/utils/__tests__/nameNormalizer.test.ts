/**
 * 名前正規化機能のテスト
 */

import {
  normalizeName,
  toHalfWidth,
  toFullWidth,
  hiraganaToKatakana,
  katakanaToHiragana,
  cleanName,
  calculateLevenshteinDistance,
  calculateJaccardSimilarity,
  calculateNameSimilarity,
  matchNames,
  findBestMatch,
  rankNameCandidates
} from '../nameNormalizer';

describe('名前正規化ユーティリティ', () => {
  describe('基本的な文字変換', () => {
    test('全角文字を半角文字に変換', () => {
      expect(toHalfWidth('１２３ＡＢＣ')).toBe('123ABC');
      expect(toHalfWidth('田中太郎')).toBe('田中太郎'); // 日本語はそのまま
    });

    test('半角文字を全角文字に変換', () => {
      expect(toFullWidth('123ABC')).toBe('１２３ＡＢＣ');
      expect(toFullWidth('田中太郎')).toBe('田中太郎'); // 日本語はそのまま
    });

    test('ひらがなをカタカナに変換', () => {
      expect(hiraganaToKatakana('たなかたろう')).toBe('タナカタロウ');
      expect(hiraganaToKatakana('田中太郎')).toBe('田中太郎'); // 漢字はそのまま
    });

    test('カタカナをひらがなに変換', () => {
      expect(katakanaToHiragana('タナカタロウ')).toBe('たなかたろう');
      expect(katakanaToHiragana('田中太郎')).toBe('田中太郎'); // 漢字はそのまま
    });
  });

  describe('名前のクリーニング', () => {
    test('先頭記号の除去', () => {
      expect(cleanName('〇田中太郎')).toBe('田中太郎');
      expect(cleanName('●佐藤花子')).toBe('佐藤花子');
      expect(cleanName('※山田次郎')).toBe('山田次郎');
    });

    test('括弧内文字の除去', () => {
      expect(cleanName('田中太郎（仮名）')).toBe('田中太郎');
      expect(cleanName('佐藤花子(退職)')).toBe('佐藤花子');
    });

    test('空白の正規化', () => {
      expect(cleanName('田中　太郎')).toBe('田中 太郎');
      expect(cleanName('佐藤  花子')).toBe('佐藤 花子');
      expect(cleanName(' 山田次郎 ')).toBe('山田次郎');
    });
  });

  describe('包括的な名前正規化', () => {
    test('複合的な正規化処理', () => {
      const result = normalizeName('〇田中　太郎（仮名）');
      expect(result.cleanedName).toBe('田中 太郎');
      expect(result.normalized).toBe('田中 太郎');
      expect(result.original).toBe('〇田中　太郎（仮名）');
    });

    test('空文字の処理', () => {
      const result = normalizeName('');
      expect(result.normalized).toBe('');
      expect(result.cleanedName).toBe('');
    });
  });

  describe('類似度計算', () => {
    test('レーベンシュタイン距離の計算', () => {
      expect(calculateLevenshteinDistance('田中太郎', '田中太郎')).toBe(0);
      expect(calculateLevenshteinDistance('田中太郎', '田中花子')).toBe(1);
      expect(calculateLevenshteinDistance('田中太郎', '佐藤太郎')).toBe(2);
    });

    test('ジャッカード類似度の計算', () => {
      expect(calculateJaccardSimilarity('田中太郎', '田中太郎')).toBe(1);
      expect(calculateJaccardSimilarity('田中太郎', '田中花子')).toBeCloseTo(0.6, 1);
      expect(calculateJaccardSimilarity('田中太郎', '佐藤次郎')).toBeCloseTo(0.2, 1);
    });

    test('名前の類似度計算', () => {
      expect(calculateNameSimilarity('田中太郎', '田中太郎')).toBe(1);
      expect(calculateNameSimilarity('田中太郎', '田中花子')).toBeGreaterThan(0.5);
      expect(calculateNameSimilarity('田中太郎', '佐藤次郎')).toBeLessThan(0.5);
    });
  });

  describe('名前マッチング', () => {
    test('完全一致', () => {
      const result = matchNames('田中太郎', '田中太郎');
      expect(result.isMatch).toBe(true);
      expect(result.matchType).toBe('exact');
      expect(result.confidence).toBe('high');
    });

    test('正規化後の一致', () => {
      const result = matchNames('〇田中　太郎', '田中 太郎');
      expect(result.isMatch).toBe(true);
      expect(result.matchType).toBe('normalized');
    });

    test('類似度による一致', () => {
      const result = matchNames('田中太郎', '田中花子', 0.6);
      expect(result.isMatch).toBe(true);
      expect(result.score).toBeGreaterThan(0.6);
    });

    test('一致しない場合', () => {
      const result = matchNames('田中太郎', '佐藤次郎', 0.8);
      expect(result.isMatch).toBe(false);
      expect(result.score).toBeLessThan(0.8);
    });
  });

  describe('最適マッチの検索', () => {
    const nameList = ['田中太郎', '田中花子', '佐藤次郎', '山田太郎'];

    test('最適マッチの検索', () => {
      const result = findBestMatch('田中太朗', nameList, 0.7);
      expect(result).not.toBeNull();
      expect(result?.name).toBe('田中太郎');
    });

    test('マッチしない場合', () => {
      const result = findBestMatch('鈴木一郎', nameList, 0.8);
      expect(result).toBeNull();
    });
  });

  describe('候補のランキング', () => {
    const candidates = ['田中太郎', '田中花子', '佐藤次郎', '山田太郎'];

    test('類似度順のランキング', () => {
      const results = rankNameCandidates('田中太朗', candidates, 0.3);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].name).toBe('田中太郎');
      expect(results[0].result.score).toBeGreaterThan(results[1]?.result.score || 0);
    });

    test('閾値以下の候補は除外', () => {
      const results = rankNameCandidates('鈴木一郎', candidates, 0.8);
      expect(results.length).toBe(0);
    });
  });
});