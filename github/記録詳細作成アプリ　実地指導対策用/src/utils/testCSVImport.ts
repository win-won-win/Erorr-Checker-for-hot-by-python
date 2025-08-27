import { parseSimplifiedCSV, validateSimplifiedCSVData } from './csvParser';
import { supabase } from '../lib/supabase';

// テスト用CSVデータ
const testCSVContent = `日付,開始時刻,終了時刻,利用者名,担当職員,サービス内容
令和07年01月15日 (水),09:00,10:00,田中花子,佐藤太郎,身体介護
令和07年01月15日 (水),14:00,15:30,山田次郎,鈴木美香,生活援助
令和07年01月16日 (木),10:00,11:00,田中花子,佐藤太郎,身体介護`;

// テスト用Fileオブジェクトを作成
function createTestFile(content: string, filename: string = 'test.csv'): File {
  const blob = new Blob([content], { type: 'text/csv' });
  return new File([blob], filename, { type: 'text/csv' });
}

// CSV解析テスト
export async function testCSVParsing() {
  console.log('=== CSV解析テスト開始 ===');
  
  try {
    // テスト用Fileオブジェクトを作成
    const testFile = createTestFile(testCSVContent);
    
    // CSVデータを解析
    const parsedData = await parseSimplifiedCSV(testFile);
    console.log('✅ CSV解析成功:', parsedData.length, '件のデータ');
    
    // データ検証
    const validationResult = validateSimplifiedCSVData(parsedData);
    if (validationResult.valid.length > 0) {
      console.log('✅ CSVデータ検証成功:', validationResult.valid.length, '件の有効データ');
    }
    if (validationResult.errors.length > 0) {
      console.log('⚠️ CSVデータ検証エラー:', validationResult.errors);
    }
    
    // 解析されたデータの内容確認
    parsedData.forEach((record, index) => {
      console.log(`データ ${index + 1}:`, {
        日付: record.serviceDate,
        時間: `${record.startTime}-${record.endTime}`,
        利用者: record.userName,
        職員: record.staffName,
        サービス: record.serviceContent
      });
    });
    
    return {
      success: true,
      data: parsedData,
      validation: validationResult
    };
    
  } catch (error) {
    console.error('❌ CSV解析テスト失敗:', error);
    return {
      success: false,
      error
    };
  }
}

// CSV取り込みテスト
export async function testCSVImport() {
  console.log('=== CSV取り込みテスト開始 ===');
  
  try {
    // まずCSVを解析
    const parseResult = await testCSVParsing();
    if (!parseResult.success || !parseResult.data) {
      throw new Error('CSV解析に失敗しました');
    }
    
    const csvData = parseResult.data;
    console.log('CSV解析完了:', csvData.length, '件');
    
    // データベースに取り込み
    const batchSize = 10;
    let successCount = 0;
    const errors: string[] = [];
    
    for (let i = 0; i < csvData.length; i += batchSize) {
      const batch = csvData.slice(i, i + batchSize);
      
      // 利用者・職員の一意な名前を取得
      const userNames = [...new Set(batch.map(record => record.userName))];
      const staffNames = [...new Set(batch.map(record => record.staffName))];
      
      try {
        // 利用者データの作成・取得
        for (const userName of userNames) {
          const { data: existingUser } = await supabase
            .from('users')
            .select('id')
            .eq('name', userName)
            .single();
            
          if (!existingUser) {
            await supabase
              .from('users')
              .insert({
                name: userName,
                name_kana: userName, // テスト用
                user_code: `USER_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
              });
          }
        }
        
        // 職員データの作成・取得
        for (const staffName of staffNames) {
          const { data: existingStaff } = await supabase
            .from('staff')
            .select('id')
            .eq('name', staffName)
            .single();
            
          if (!existingStaff) {
            await supabase
              .from('staff')
              .insert({
                name: staffName,
                staff_code: `STAFF_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
              });
          }
        }
        
        // サービス記録の挿入
        const recordsToInsert = batch.map(record => ({
          user_name: record.userName,
          staff_name: record.staffName,
          service_date: record.serviceDate,
          start_time: record.startTime,
          end_time: record.endTime,
          duration_minutes: record.durationMinutes,
          service_content: record.serviceContent,
          special_notes: 'CSV取り込みテスト用データ',
          is_manually_created: false,
          csv_import_batch_id: `TEST_${Date.now()}`
        }));
        
        const { error: insertError } = await supabase
          .from('csv_service_records')
          .upsert(recordsToInsert, {
            onConflict: 'user_name,staff_name,service_date,start_time,end_time'
          });
        
        if (insertError) {
          errors.push(`バッチ ${Math.floor(i / batchSize) + 1}: ${insertError.message}`);
        } else {
          successCount += batch.length;
        }
        
      } catch (error) {
        errors.push(`バッチ ${Math.floor(i / batchSize) + 1}: ${error}`);
      }
    }
    
    console.log('✅ CSV取り込み完了');
    console.log(`成功: ${successCount}件`);
    if (errors.length > 0) {
      console.log(`エラー: ${errors.length}件`);
      errors.forEach(error => console.log('  -', error));
    }
    
    return {
      success: true,
      successCount,
      errors,
      totalRecords: csvData.length
    };
    
  } catch (error) {
    console.error('❌ CSV取り込みテスト失敗:', error);
    return {
      success: false,
      error
    };
  }
}

// CSV取り込み後のデータ確認テスト
export async function testCSVImportVerification() {
  console.log('=== CSV取り込み後データ確認テスト開始 ===');
  
  try {
    // 取り込まれたデータを確認
    const { data: records, error } = await supabase
      .from('csv_service_records')
      .select('*')
      .like('special_notes', '%CSV取り込みテスト用データ%')
      .order('service_date', { ascending: true });
    
    if (error) throw error;
    
    console.log(`✅ 取り込み済みデータ確認: ${records.length}件`);
    
    // データの内容を表示
    records.forEach((record, index) => {
      console.log(`記録 ${index + 1}:`, {
        ID: record.id,
        利用者: record.user_name,
        職員: record.staff_name,
        日付: record.service_date,
        時間: `${record.start_time}-${record.end_time}`,
        サービス: record.service_content
      });
    });
    
    return {
      success: true,
      records
    };
    
  } catch (error) {
    console.error('❌ データ確認テスト失敗:', error);
    return {
      success: false,
      error
    };
  }
}

// CSV機能統合テスト
export async function runCSVTests() {
  console.log('🚀 CSV機能統合テスト開始');
  
  const parseResult = await testCSVParsing();
  const importResult = await testCSVImport();
  const verificationResult = await testCSVImportVerification();
  
  console.log('=== CSV機能テスト結果サマリー ===');
  console.log('CSV解析テスト:', parseResult.success ? '✅' : '❌');
  console.log('CSV取り込みテスト:', importResult.success ? '✅' : '❌');
  console.log('データ確認テスト:', verificationResult.success ? '✅' : '❌');
  
  const allTestsPassed = parseResult.success && importResult.success && verificationResult.success;
  
  console.log('🏁 CSV機能テスト結果:', allTestsPassed ? '✅ 全テスト成功' : '❌ 一部テスト失敗');
  
  return allTestsPassed;
}