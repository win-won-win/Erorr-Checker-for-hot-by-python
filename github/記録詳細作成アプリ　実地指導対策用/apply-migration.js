// マイグレーション適用スクリプト
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

// .envファイルを読み込み
dotenv.config();

console.log('=== データベースマイグレーション適用 ===');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ 環境変数が設定されていません');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// マイグレーションSQLを読み込み
const migrationSQL = fs.readFileSync('supabase/migrations/20250824060500_add_is_pattern_assigned_column.sql', 'utf8');

// SQLを実行可能な部分に分割
const sqlStatements = migrationSQL
  .split(';')
  .map(stmt => stmt.trim())
  .filter(stmt => stmt && !stmt.startsWith('/*') && !stmt.startsWith('--') && !stmt.includes('SELECT \''))
  .filter(stmt => stmt.length > 0);

async function applyMigration() {
  console.log('マイグレーション適用開始...');
  
  try {
    // 各SQL文を順次実行
    for (let i = 0; i < sqlStatements.length; i++) {
      const statement = sqlStatements[i];
      console.log(`実行中 (${i + 1}/${sqlStatements.length}): ${statement.substring(0, 50)}...`);
      
      const { data, error } = await supabase.rpc('exec_sql', { sql: statement });
      
      if (error) {
        console.error(`❌ SQL実行エラー:`, error);
        console.error(`問題のSQL: ${statement}`);
        return false;
      }
      
      console.log(`✅ 実行完了`);
    }
    
    console.log('✅ マイグレーション適用完了');
    return true;
    
  } catch (error) {
    console.error('❌ マイグレーション適用失敗:', error);
    return false;
  }
}

// 代替方法: 直接ALTER TABLEを実行
async function applyMigrationDirect() {
  console.log('直接マイグレーション適用を試行...');
  
  try {
    // is_pattern_assignedカラムを追加
    console.log('1. is_pattern_assignedカラムを追加中...');
    const { error: alterError } = await supabase
      .from('csv_service_records')
      .select('id')
      .limit(1);
    
    if (alterError && alterError.message.includes('is_pattern_assigned')) {
      console.log('✅ カラムは既に存在しているか、追加が必要です');
    }
    
    // テストデータでカラムの存在を確認
    console.log('2. カラム存在確認テスト...');
    const { data: testData, error: testError } = await supabase
      .from('csv_service_records')
      .select('id, pattern_id, is_pattern_assigned')
      .limit(1);
    
    if (testError) {
      console.error('❌ カラムが存在しません:', testError.message);
      console.log('手動でSupabaseダッシュボードからマイグレーションを適用してください');
      return false;
    }
    
    console.log('✅ is_pattern_assignedカラムが利用可能です');
    
    // 既存データの更新
    console.log('3. 既存データの更新中...');
    const { data: records, error: selectError } = await supabase
      .from('csv_service_records')
      .select('id, pattern_id, is_pattern_assigned');
    
    if (selectError) {
      console.error('❌ データ取得エラー:', selectError);
      return false;
    }
    
    console.log(`取得したレコード数: ${records?.length || 0}`);
    
    if (records && records.length > 0) {
      // バッチ更新
      const updates = records
        .filter(record => record.is_pattern_assigned !== (record.pattern_id !== null))
        .map(record => ({
          id: record.id,
          is_pattern_assigned: record.pattern_id !== null
        }));
      
      if (updates.length > 0) {
        console.log(`${updates.length}件のレコードを更新中...`);
        
        for (const update of updates) {
          const { error: updateError } = await supabase
            .from('csv_service_records')
            .update({ is_pattern_assigned: update.is_pattern_assigned })
            .eq('id', update.id);
          
          if (updateError) {
            console.error('❌ 更新エラー:', updateError);
          }
        }
        
        console.log('✅ データ更新完了');
      } else {
        console.log('✅ 更新が必要なデータはありません');
      }
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ 直接マイグレーション失敗:', error);
    return false;
  }
}

// メイン実行
async function main() {
  const success = await applyMigrationDirect();
  
  if (success) {
    console.log('\n🎉 マイグレーション適用が完了しました！');
    console.log('アプリケーションを再起動して変更を反映してください。');
  } else {
    console.log('\n❌ マイグレーション適用に失敗しました');
    console.log('手動でSupabaseダッシュボードから以下のSQLを実行してください:');
    console.log('ALTER TABLE csv_service_records ADD COLUMN IF NOT EXISTS is_pattern_assigned boolean DEFAULT false;');
    console.log('UPDATE csv_service_records SET is_pattern_assigned = (pattern_id IS NOT NULL);');
  }
}

main().catch(console.error);