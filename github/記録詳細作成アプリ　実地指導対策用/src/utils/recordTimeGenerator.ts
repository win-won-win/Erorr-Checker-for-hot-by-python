import { addMinutes, subMinutes, addHours } from 'date-fns';

/**
 * サービス提供記録の作成時間をランダムに生成する（仕様書準拠）
 *
 * 確率分布：
 * - サービス終了時間の10分〜1分前：15％
 * - サービス提供時間の前後3分：50％
 * - 終了後3分から15分：30％
 * - 終了後1時間：5％
 */
export function generateRecordTime(serviceStart: Date, serviceEnd: Date): Date {
  const random = Math.random() * 100;
  
  if (random <= 15) {
    // 終了1-10分前（15％）
    const minBefore = subMinutes(serviceEnd, 10);
    const maxBefore = subMinutes(serviceEnd, 1);
    return randomTimeBetween(minBefore, maxBefore);
  } else if (random <= 65) {
    // 前後3分（50％）
    const minTime = subMinutes(serviceStart, 3);
    const maxTime = addMinutes(serviceEnd, 3);
    return randomTimeBetween(minTime, maxTime);
  } else if (random <= 95) {
    // 終了後3-15分（30％）
    const minAfter = addMinutes(serviceEnd, 3);
    const maxAfter = addMinutes(serviceEnd, 15);
    return randomTimeBetween(minAfter, maxAfter);
  } else {
    // 終了後1時間（5％）
    return addHours(serviceEnd, 1);
  }
}

/**
 * 印刷日時をランダムに生成する（1週間に1度の印刷をシミュレート）
 * 仕様書準拠：営業時間内（9:00-18:00）にランダム設定
 */
export function generatePrintTime(serviceDate: Date): Date {
  const baseDate = new Date(serviceDate);
  const daysToAdd = Math.floor(Math.random() * 7) + 1; // 1-7日後
  const printDate = new Date(baseDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
  
  // 営業時間内（9:00-18:00）にランダム設定
  const hour = Math.floor(Math.random() * 9) + 9; // 9-17時
  const minute = Math.floor(Math.random() * 60);
  const second = Math.floor(Math.random() * 60);
  
  printDate.setHours(hour, minute, second, 0);
  return printDate;
}

/**
 * 指定された時間範囲内でランダムな時間を生成
 */
function randomTimeBetween(start: Date, end: Date): Date {
  const startTime = start.getTime();
  const endTime = end.getTime();
  const randomTime = startTime + Math.random() * (endTime - startTime);
  return new Date(randomTime);
}

/**
 * 時間文字列（HH:mm）をDateオブジェクトに変換
 */
export function timeStringToDate(dateStr: string, timeStr: string): Date {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const date = new Date(dateStr);
  date.setHours(hours, minutes, 0, 0);
  return date;
}