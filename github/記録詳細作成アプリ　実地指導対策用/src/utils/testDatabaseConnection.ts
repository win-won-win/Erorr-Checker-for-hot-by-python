import { supabase, isSupabaseConfigured } from '../lib/supabase';

// データベース接続テスト
export async function testDatabaseConnection() {
  console.log('=== データベース接続テスト開始 ===');
  
  if (!isSupabaseConfigured()) {
    console.error('❌ Supabase設定が不完全です');
    return false;
  }
  
  try {
    // 基本的な接続テスト
    const { data, error } = await supabase.from('users').select('count').limit(1);
    if (error) throw error;
    
    console.log('✅ データベース接続成功');
    return true;
  } catch (error) {
    console.error('❌ データベース接続失敗:', error);
    return false;
  }
}

// テーブル存在確認
export async function testTableExistence() {
  console.log('=== テーブル存在確認テスト開始 ===');
  
  const tables = [
    'users',
    'staff', 
    'service_patterns',
    'csv_service_records',
    'csv_import_logs',
    'user_time_patterns'
  ];
  
  const results: { [key: string]: boolean } = {};
  
  for (const table of tables) {
    try {
      const { data, error } = await supabase.from(table).select('count').limit(1);
      if (error) throw error;
      
      results[table] = true;
      console.log(`✅ テーブル ${table} 存在確認`);
    } catch (error) {
      results[table] = false;
      console.error(`❌ テーブル ${table} 存在しない:`, error);
    }
  }
  
  return results;
}

// データ挿入テスト
export async function testDataInsertion() {
  console.log('=== データ挿入テスト開始 ===');
  
  try {
    // テスト用利用者データ挿入
    const testUser = {
      name: 'テスト利用者',
      name_kana: 'テストリヨウシャ',
      user_code: 'TEST001',
      care_level: '要介護1'
    };
    
    const { data: userData, error: userError } = await supabase
      .from('users')
      .upsert(testUser, { onConflict: 'user_code' })
      .select()
      .single();
    
    if (userError) throw userError;
    console.log('✅ 利用者データ挿入成功:', userData);
    
    // テスト用職員データ挿入
    const testStaff = {
      name: 'テスト職員',
      staff_code: 'STAFF001',
      email: 'test@example.com'
    };
    
    const { data: staffData, error: staffError } = await supabase
      .from('staff')
      .upsert(testStaff, { onConflict: 'staff_code' })
      .select()
      .single();
    
    if (staffError) throw staffError;
    console.log('✅ 職員データ挿入成功:', staffData);
    
    // テスト用サービス記録挿入
    const testRecord = {
      user_name: testUser.name,
      staff_name: testStaff.name,
      service_date: new Date().toISOString().split('T')[0],
      start_time: '09:00',
      end_time: '10:00',
      duration_minutes: 60,
      service_content: 'テスト用サービス',
      special_notes: 'データベーステスト用記録',
      is_manually_created: true
    };
    
    const { data: recordData, error: recordError } = await supabase
      .from('csv_service_records')
      .insert(testRecord)
      .select()
      .single();
    
    if (recordError) throw recordError;
    console.log('✅ サービス記録挿入成功:', recordData);
    
    return {
      user: userData,
      staff: staffData,
      record: recordData
    };
    
  } catch (error) {
    console.error('❌ データ挿入テスト失敗:', error);
    return null;
  }
}

// データ取得テスト
export async function testDataRetrieval() {
  console.log('=== データ取得テスト開始 ===');
  
  try {
    // 利用者データ取得
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('*')
      .limit(5);
    
    if (usersError) throw usersError;
    console.log(`✅ 利用者データ取得成功: ${users.length}件`);
    
    // 職員データ取得
    const { data: staff, error: staffError } = await supabase
      .from('staff')
      .select('*')
      .limit(5);
    
    if (staffError) throw staffError;
    console.log(`✅ 職員データ取得成功: ${staff.length}件`);
    
    // サービス記録取得
    const { data: records, error: recordsError } = await supabase
      .from('csv_service_records')
      .select('*')
      .limit(5);
    
    if (recordsError) throw recordsError;
    console.log(`✅ サービス記録取得成功: ${records.length}件`);
    
    return {
      users,
      staff,
      records
    };
    
  } catch (error) {
    console.error('❌ データ取得テスト失敗:', error);
    return null;
  }
}

// 統合テスト実行
export async function runDatabaseTests() {
  console.log('🚀 データベース統合テスト開始');
  
  const connectionResult = await testDatabaseConnection();
  if (!connectionResult) {
    console.log('❌ 接続テスト失敗のため、テストを中断します');
    return false;
  }
  
  const tableResults = await testTableExistence();
  const insertionResult = await testDataInsertion();
  const retrievalResult = await testDataRetrieval();
  
  console.log('=== テスト結果サマリー ===');
  console.log('接続テスト:', connectionResult ? '✅' : '❌');
  console.log('テーブル存在確認:', Object.values(tableResults).every(Boolean) ? '✅' : '❌');
  console.log('データ挿入テスト:', insertionResult ? '✅' : '❌');
  console.log('データ取得テスト:', retrievalResult ? '✅' : '❌');
  
  const allTestsPassed = connectionResult && 
                        Object.values(tableResults).every(Boolean) && 
                        insertionResult && 
                        retrievalResult;
  
  console.log('🏁 統合テスト結果:', allTestsPassed ? '✅ 全テスト成功' : '❌ 一部テスト失敗');
  
  return allTestsPassed;
}