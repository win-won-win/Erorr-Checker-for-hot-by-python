const { createClient } = require('@supabase/supabase-js');

// Supabase設定
// Node.jsスクリプトでは VITE_ プレフィックスなしの環境変数も確認
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

// 環境変数が設定されていない場合はエラーを出力
if (!supabaseUrl || !supabaseKey) {
  console.error('エラー: Supabase環境変数が設定されていません');
  console.error('必要な環境変数:');
  console.error('- SUPABASE_URL または VITE_SUPABASE_URL');
  console.error('- SUPABASE_ANON_KEY または VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// 記録作成日時と印刷時間を生成（仕様書準拠）
function generateTimesForRecord(record) {
  const serviceDate = new Date(record.service_date);
  const startTime = record.start_time;
  const endTime = record.end_time;
  
  // 開始・終了時間を解析（HH:MM形式）
  const [startHour, startMinute] = startTime.split(':').map(Number);
  const [endHour, endMinute] = endTime.split(':').map(Number);
  
  // サービス開始・終了時刻のDateオブジェクトを作成
  const serviceStart = new Date(serviceDate.getFullYear(), serviceDate.getMonth(), serviceDate.getDate(), startHour, startMinute, 0);
  const serviceEnd = new Date(serviceDate.getFullYear(), serviceDate.getMonth(), serviceDate.getDate(), endHour, endMinute, 0);
  
  // 記録作成時間の確率分布（仕様書準拠）
  const random = Math.random() * 100;
  let recordCreatedTime;
  
  if (random <= 15) {
    // 終了1-10分前（15％）
    const minBefore = new Date(serviceEnd.getTime() - 10 * 60 * 1000); // 10分前
    const maxBefore = new Date(serviceEnd.getTime() - 1 * 60 * 1000);  // 1分前
    recordCreatedTime = randomTimeBetween(minBefore, maxBefore);
  } else if (random <= 65) {
    // 前後3分（50％）
    const minTime = new Date(serviceStart.getTime() - 3 * 60 * 1000); // 開始3分前
    const maxTime = new Date(serviceEnd.getTime() + 3 * 60 * 1000);   // 終了3分後
    recordCreatedTime = randomTimeBetween(minTime, maxTime);
  } else if (random <= 95) {
    // 終了後3-15分（30％）
    const minAfter = new Date(serviceEnd.getTime() + 3 * 60 * 1000);  // 終了3分後
    const maxAfter = new Date(serviceEnd.getTime() + 15 * 60 * 1000); // 終了15分後
    recordCreatedTime = randomTimeBetween(minAfter, maxAfter);
  } else {
    // 終了後1時間（5％）
    recordCreatedTime = new Date(serviceEnd.getTime() + 60 * 60 * 1000); // 終了1時間後
  }
  
  // 印刷時間の生成（1週間に1度の印刷をシミュレート）
  const baseDate = new Date(serviceDate);
  const daysToAdd = Math.floor(Math.random() * 7) + 1; // 1-7日後
  const printDate = new Date(baseDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
  
  // 営業時間内（9:00-18:00）にランダム設定
  const hour = Math.floor(Math.random() * 9) + 9; // 9-17時
  const minute = Math.floor(Math.random() * 60);
  const second = Math.floor(Math.random() * 60);
  
  printDate.setHours(hour, minute, second, 0);
  
  return {
    recordCreatedAt: recordCreatedTime.toISOString(),
    printDateTime: printDate.toISOString()
  };
}

// 指定された時間範囲内でランダムな時間を生成
function randomTimeBetween(start, end) {
  const startTime = start.getTime();
  const endTime = end.getTime();
  const randomTime = startTime + Math.random() * (endTime - startTime);
  return new Date(randomTime);
}

async function updatePrintTimes() {
  try {
    console.log('既存記録の印刷時間を更新中...');
    
    // 全ての service_records を取得
    const { data: records, error: fetchError } = await supabase
      .from('service_records')
      .select('id, service_date, start_time, end_time, print_datetime');
    
    if (fetchError) {
      console.error('記録取得エラー:', fetchError);
      return;
    }
    
    console.log(`${records.length}件の記録を処理します...`);
    
    // 各記録に対して記録作成日時と印刷時間を生成・更新
    const updatePromises = records.map(async (record, index) => {
      const times = generateTimesForRecord(record);
      
      // 少しずつ時間をずらす（同時刻の重複を避ける）
      const adjustedPrintTime = new Date(times.printDateTime);
      adjustedPrintTime.setSeconds(adjustedPrintTime.getSeconds() + index * 2);
      
      const { error } = await supabase
        .from('service_records')
        .update({
          print_datetime: adjustedPrintTime.toISOString()
          // 注意: service_recordsテーブルにrecord_created_atカラムがないため、記録作成時間は更新しない
          // 記録作成時間は手動記録時やCSVインポート時に設定される
        })
        .eq('id', record.id);
      
      if (error) {
        console.error(`記録ID ${record.id} の更新エラー:`, error);
        return { success: false, id: record.id, error };
      }
      
      return { success: true, id: record.id };
    });
    
    const results = await Promise.all(updatePromises);
    const successCount = results.filter(r => r.success).length;
    const errorCount = results.filter(r => !r.success).length;
    
    console.log(`更新完了: 成功 ${successCount}件, エラー ${errorCount}件`);
    
    if (errorCount > 0) {
      console.log('エラーが発生した記録:');
      results.filter(r => !r.success).forEach(r => {
        console.log(`- ID: ${r.id}, エラー: ${r.error.message}`);
      });
    }
    
  } catch (error) {
    console.error('処理中にエラーが発生しました:', error);
  }
}

// スクリプト実行
if (require.main === module) {
  updatePrintTimes().then(() => {
    console.log('印刷時間更新処理が完了しました。');
    process.exit(0);
  }).catch(error => {
    console.error('処理が失敗しました:', error);
    process.exit(1);
  });
}

module.exports = { updatePrintTimes, generateTimesForRecord };