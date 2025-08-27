// データベース接続診断スクリプト
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// .envファイルを読み込み
dotenv.config();

console.log('=== データベース診断テスト開始 ===');

// 環境変数確認
console.log('環境変数確認:');
console.log('VITE_SUPABASE_URL:', process.env.VITE_SUPABASE_URL ? '設定済み' : '未設定');
console.log('VITE_SUPABASE_ANON_KEY:', process.env.VITE_SUPABASE_ANON_KEY ? '設定済み' : '未設定');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ 環境変数が設定されていません');
  console.log('解決方法:');
  console.log('1. .envファイルにVITE_SUPABASE_URLとVITE_SUPABASE_ANON_KEYを設定');
  console.log('2. 開発サーバーを再起動');
  process.exit(1);
}

// Supabaseクライアント作成
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 接続テスト
async function testConnection() {
  try {
    console.log('\n=== 接続テスト開始 ===');
    const { data, error } = await supabase.from('users').select('count').limit(1);
    
    if (error) {
      console.error('❌ データベース接続エラー:', error.message);
      return false;
    }
    
    console.log('✅ データベース接続成功');
    return true;
  } catch (error) {
    console.error('❌ 接続テスト失敗:', error.message);
    return false;
  }
}

// テーブル存在確認
async function testTables() {
  console.log('\n=== テーブル存在確認 ===');
  const tables = ['users', 'staff', 'service_patterns', 'csv_service_records'];
  
  for (const table of tables) {
    try {
      const { data, error } = await supabase.from(table).select('count').limit(1);
      if (error) throw error;
      console.log(`✅ テーブル ${table} 存在確認`);
    } catch (error) {
      console.error(`❌ テーブル ${table} エラー:`, error.message);
    }
  }
}

// データ挿入テスト
async function testInsert() {
  console.log('\n=== データ挿入テスト ===');
  
  try {
    const testUser = {
      name: 'テスト利用者_' + Date.now(),
      name_kana: 'テストリヨウシャ',
      user_code: 'TEST_' + Date.now(),
      care_level: '要介護1'
    };
    
    const { data, error } = await supabase
      .from('users')
      .insert(testUser)
      .select()
      .single();
    
    if (error) throw error;
    
    console.log('✅ データ挿入成功:', data.name);
    
    // 挿入したテストデータを削除
    await supabase.from('users').delete().eq('id', data.id);
    console.log('✅ テストデータ削除完了');
    
    return true;
  } catch (error) {
    console.error('❌ データ挿入テスト失敗:', error.message);
    return false;
  }
}

// メイン実行
async function main() {
  const connectionOk = await testConnection();
  if (!connectionOk) {
    console.log('\n❌ 接続テストが失敗したため、以降のテストをスキップします');
    return;
  }
  
  await testTables();
  await testInsert();
  
  console.log('\n=== 診断完了 ===');
}

main().catch(console.error);