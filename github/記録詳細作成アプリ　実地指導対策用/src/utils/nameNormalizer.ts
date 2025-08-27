/**
 * 名前正規化ユーティリティ
 * 全角半角変換、ひらがなカタカナ変換、類似度計算、名前マッチング機能を提供
 */

export interface NameNormalizationResult {
  original: string;
  normalized: string;
  hiragana: string;
  katakana: string;
  halfWidth: string;
  fullWidth: string;
  cleanedName: string;
}

export interface NameMatchResult {
  score: number;
  isMatch: boolean;
  confidence: 'high' | 'medium' | 'low';
  matchType: 'exact' | 'normalized' | 'phonetic' | 'partial';
  details: {
    exactMatch: boolean;
    normalizedMatch: boolean;
    phoneticMatch: boolean;
    partialMatch: boolean;
    levenshteinDistance: number;
    jaccardSimilarity: number;
  };
}

/**
 * 全角文字を半角文字に変換
 */
export function toHalfWidth(str: string): string {
  return str.replace(/[Ａ-Ｚａ-ｚ０-９！-～]/g, (char) => {
    return String.fromCharCode(char.charCodeAt(0) - 0xFEE0);
  });
}

/**
 * 半角文字を全角文字に変換
 */
export function toFullWidth(str: string): string {
  return str.replace(/[A-Za-z0-9!-~]/g, (char) => {
    return String.fromCharCode(char.charCodeAt(0) + 0xFEE0);
  });
}

/**
 * ひらがなをカタカナに変換
 */
export function hiraganaToKatakana(str: string): string {
  return str.replace(/[\u3041-\u3096]/g, (char) => {
    return String.fromCharCode(char.charCodeAt(0) + 0x60);
  });
}

/**
 * カタカナをひらがなに変換
 */
export function katakanaToHiragana(str: string): string {
  return str.replace(/[\u30A1-\u30F6]/g, (char) => {
    return String.fromCharCode(char.charCodeAt(0) - 0x60);
  });
}

/**
 * 文字列から不要な文字を除去し、正規化
 */
export function cleanName(name: string): string {
  if (!name) return '';
  
  return name
    // 先頭の記号を除去（〇、●、※など）
    .replace(/^[〇●※◯○▲△▼▽■□◆◇★☆]/g, '')
    // 括弧内の文字を除去（例：田中太郎（仮名）→ 田中太郎）
    .replace(/[（(][^）)]*[）)]/g, '')
    // 複数の空白を単一の空白に統一
    .replace(/\s+/g, ' ')
    // 全角スペースを半角スペースに変換
    .replace(/　/g, ' ')
    // 前後の空白を除去
    .trim();
}

/**
 * 包括的な名前正規化処理
 */
export function normalizeName(name: string): NameNormalizationResult {
  if (!name) {
    const empty = '';
    return {
      original: name,
      normalized: empty,
      hiragana: empty,
      katakana: empty,
      halfWidth: empty,
      fullWidth: empty,
      cleanedName: empty
    };
  }

  const cleanedName = cleanName(name);
  const halfWidth = toHalfWidth(cleanedName);
  const fullWidth = toFullWidth(cleanedName);
  const hiragana = katakanaToHiragana(cleanedName);
  const katakana = hiraganaToKatakana(cleanedName);
  
  // 正規化された名前（最も標準的な形式）
  const normalized = cleanedName
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (char) => toHalfWidth(char)); // 英数字は半角（カタカナはそのまま保持）

  return {
    original: name,
    normalized,
    hiragana,
    katakana,
    halfWidth,
    fullWidth,
    cleanedName
  };
}

/**
 * レーベンシュタイン距離を計算
 */
export function calculateLevenshteinDistance(str1: string, str2: string): number {
  const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

  for (let i = 0; i <= str1.length; i++) {
    matrix[0][i] = i;
  }

  for (let j = 0; j <= str2.length; j++) {
    matrix[j][0] = j;
  }

  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1, // deletion
        matrix[j - 1][i] + 1, // insertion
        matrix[j - 1][i - 1] + indicator // substitution
      );
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * ジャッカード類似度を計算
 */
export function calculateJaccardSimilarity(str1: string, str2: string): number {
  const set1 = new Set(str1.split(''));
  const set2 = new Set(str2.split(''));
  
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  return union.size === 0 ? 0 : intersection.size / union.size;
}

/**
 * 音韻的類似度を計算（ひらがな・カタカナ変換による）
 */
export function calculatePhoneticSimilarity(name1: string, name2: string): number {
  const norm1 = normalizeName(name1);
  const norm2 = normalizeName(name2);
  
  // ひらがな同士で比較
  const hiraganaDistance = calculateLevenshteinDistance(norm1.hiragana, norm2.hiragana);
  const maxLength = Math.max(norm1.hiragana.length, norm2.hiragana.length);
  
  return maxLength === 0 ? 0 : 1 - (hiraganaDistance / maxLength);
}

/**
 * 名前の類似度を総合的に計算
 */
export function calculateNameSimilarity(name1: string, name2: string): number {
  if (!name1 || !name2) return 0;
  
  const norm1 = normalizeName(name1);
  const norm2 = normalizeName(name2);
  
  // 完全一致チェック
  if (norm1.normalized === norm2.normalized) return 1.0;
  
  // 各種類似度を計算
  const levenshteinDistance = calculateLevenshteinDistance(norm1.normalized, norm2.normalized);
  const maxLength = Math.max(norm1.normalized.length, norm2.normalized.length);
  const levenshteinSimilarity = maxLength === 0 ? 0 : 1 - (levenshteinDistance / maxLength);
  
  const jaccardSimilarity = calculateJaccardSimilarity(norm1.normalized, norm2.normalized);
  const phoneticSimilarity = calculatePhoneticSimilarity(name1, name2);
  
  // 重み付き平均で総合類似度を計算
  const weights = {
    levenshtein: 0.4,
    jaccard: 0.3,
    phonetic: 0.3
  };
  
  return (
    levenshteinSimilarity * weights.levenshtein +
    jaccardSimilarity * weights.jaccard +
    phoneticSimilarity * weights.phonetic
  );
}

/**
 * 名前マッチング処理
 */
export function matchNames(name1: string, name2: string, threshold: number = 0.8): NameMatchResult {
  if (!name1 || !name2) {
    return {
      score: 0,
      isMatch: false,
      confidence: 'low',
      matchType: 'partial',
      details: {
        exactMatch: false,
        normalizedMatch: false,
        phoneticMatch: false,
        partialMatch: false,
        levenshteinDistance: Infinity,
        jaccardSimilarity: 0
      }
    };
  }

  const norm1 = normalizeName(name1);
  const norm2 = normalizeName(name2);
  
  // 各種マッチングをチェック
  const exactMatch = name1 === name2;
  const normalizedMatch = norm1.normalized === norm2.normalized;
  const phoneticMatch = norm1.hiragana === norm2.hiragana || norm1.katakana === norm2.katakana;
  
  // 部分マッチング（一方が他方を含む）
  const partialMatch = norm1.normalized.includes(norm2.normalized) || 
                      norm2.normalized.includes(norm1.normalized);
  
  // 類似度計算
  const overallScore = calculateNameSimilarity(name1, name2);
  const levenshteinDistance = calculateLevenshteinDistance(norm1.normalized, norm2.normalized);
  const jaccardSimilarity = calculateJaccardSimilarity(norm1.normalized, norm2.normalized);
  
  // マッチタイプの決定
  let matchType: NameMatchResult['matchType'] = 'partial';
  if (exactMatch) matchType = 'exact';
  else if (normalizedMatch) matchType = 'normalized';
  else if (phoneticMatch) matchType = 'phonetic';
  
  // 信頼度の決定
  let confidence: NameMatchResult['confidence'] = 'low';
  if (overallScore >= 0.9) confidence = 'high';
  else if (overallScore >= 0.7) confidence = 'medium';
  
  const isMatch = overallScore >= threshold;
  
  return {
    score: overallScore,
    isMatch,
    confidence,
    matchType,
    details: {
      exactMatch,
      normalizedMatch,
      phoneticMatch,
      partialMatch,
      levenshteinDistance,
      jaccardSimilarity
    }
  };
}

/**
 * 名前リストから最も類似した名前を検索
 */
export function findBestMatch(
  targetName: string, 
  nameList: string[], 
  threshold: number = 0.8
): { name: string; result: NameMatchResult } | null {
  if (!targetName || !nameList.length) return null;
  
  let bestMatch: { name: string; result: NameMatchResult } | null = null;
  let bestScore = 0;
  
  for (const name of nameList) {
    const result = matchNames(targetName, name, threshold);
    if (result.score > bestScore && result.isMatch) {
      bestScore = result.score;
      bestMatch = { name, result };
    }
  }
  
  return bestMatch;
}

/**
 * 名前の候補リストを類似度順にソート
 */
export function rankNameCandidates(
  targetName: string, 
  candidates: string[], 
  minThreshold: number = 0.5
): Array<{ name: string; result: NameMatchResult }> {
  if (!targetName || !candidates.length) return [];
  
  return candidates
    .map(name => ({
      name,
      result: matchNames(targetName, name, minThreshold)
    }))
    .filter(item => item.result.score >= minThreshold)
    .sort((a, b) => b.result.score - a.result.score);
}

/**
 * 名前の正規化設定
 */
export interface NameNormalizationConfig {
  removeSymbols: boolean;
  removeBrackets: boolean;
  convertToHiragana: boolean;
  convertToHalfWidth: boolean;
  trimSpaces: boolean;
}

/**
 * カスタム設定による名前正規化
 */
export function normalizeNameWithConfig(
  name: string, 
  config: Partial<NameNormalizationConfig> = {}
): string {
  if (!name) return '';
  
  const defaultConfig: NameNormalizationConfig = {
    removeSymbols: true,
    removeBrackets: true,
    convertToHiragana: true,
    convertToHalfWidth: true,
    trimSpaces: true
  };
  
  const finalConfig = { ...defaultConfig, ...config };
  let result = name;
  
  if (finalConfig.removeSymbols) {
    result = result.replace(/^[〇●※◯○▲△▼▽■□◆◇★☆]/g, '');
  }
  
  if (finalConfig.removeBrackets) {
    result = result.replace(/[（(][^）)]*[）)]/g, '');
  }
  
  if (finalConfig.convertToHalfWidth) {
    result = toHalfWidth(result);
  }
  
  if (finalConfig.convertToHiragana) {
    result = katakanaToHiragana(result);
  }
  
  if (finalConfig.trimSpaces) {
    result = result.replace(/\s+/g, ' ').replace(/　/g, ' ').trim();
  }
  
  return result;
}