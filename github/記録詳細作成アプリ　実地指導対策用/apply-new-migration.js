import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase環境変数が設定されていません');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration(migrationFile) {
  try {
    console.log('=== 新しいマイグレーション適用 ===');
    console.log(`マイグレーションファイル: ${migrationFile}`);
    
    // マイグレーションファイルを読み込み
    const migrationSQL = fs.readFileSync(migrationFile, 'utf8');
    
    console.log('1. マイグレーションSQL実行中...');
    
    // SQLを実行
    const { data, error } = await supabase.rpc('exec_sql', { sql: migrationSQL });
    
    if (error) {
      console.error('❌ マイグレーション実行エラー:', error);
      
      // 直接クエリを試行
      console.log('2. 直接クエリ実行を試行中...');
      
      // SQLを分割して実行
      const statements = migrationSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));
      
      for (const statement of statements) {
        if (statement.trim()) {
          console.log(`実行中: ${statement.substring(0, 50)}...`);
          const { error: stmtError } = await supabase.rpc('exec_sql', { sql: statement });
          if (stmtError) {
            console.error(`❌ ステートメント実行エラー: ${stmtError.message}`);
            // 一部のエラーは無視して続行
            if (!stmtError.message.includes('already exists')) {
              throw stmtError;
            }
          }
        }
      }
    }
    
    console.log('3. テーブル存在確認...');
    
    // users_masterテーブルの確認
    const { data: usersData, error: usersError } = await supabase
      .from('users_master')
      .select('count(*)')
      .limit(1);
    
    if (usersError) {
      console.error('❌ users_masterテーブル確認エラー:', usersError);
    } else {
      console.log('✅ users_masterテーブルが利用可能です');
    }
    
    // staff_masterテーブルの確認
    const { data: staffData, error: staffError } = await supabase
      .from('staff_master')
      .select('count(*)')
      .limit(1);
    
    if (staffError) {
      console.error('❌ staff_masterテーブル確認エラー:', staffError);
    } else {
      console.log('✅ staff_masterテーブルが利用可能です');
    }
    
    console.log('\n🎉 マイグレーション適用が完了しました！');
    
  } catch (error) {
    console.error('❌ マイグレーション適用に失敗しました:', error);
    process.exit(1);
  }
}

// コマンドライン引数からマイグレーションファイルを取得
const migrationFile = process.argv[2];
if (!migrationFile) {
  console.error('❌ マイグレーションファイルを指定してください');
  console.log('使用方法: node apply-new-migration.js <migration-file>');
  process.exit(1);
}

applyMigration(migrationFile);