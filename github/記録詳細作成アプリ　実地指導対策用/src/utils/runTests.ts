import { runDatabaseTests } from './testDatabaseConnection';
import { runCSVTests } from './testCSVImport';
import { runWeeklyPatternTests } from './testWeeklyPattern';

// テスト実行関数
export async function executeTests() {
  console.log('🧪 アプリケーションテスト開始');
  console.log('=====================================');
  
  try {
    // データベーステスト実行
    console.log('📊 データベーステスト実行中...');
    const dbTestResult = await runDatabaseTests();
    
    // CSV機能テスト実行
    console.log('📄 CSV機能テスト実行中...');
    const csvTestResult = await runCSVTests();
    
    // 週間パターン機能テスト実行
    console.log('📅 週間パターン機能テスト実行中...');
    const patternTestResult = await runWeeklyPatternTests();
    
    console.log('=====================================');
    console.log('🏁 全テスト結果サマリー');
    console.log('データベーステスト:', dbTestResult ? '✅' : '❌');
    console.log('CSV機能テスト:', csvTestResult ? '✅' : '❌');
    console.log('週間パターン機能テスト:', patternTestResult ? '✅' : '❌');
    
    const allTestsPassed = dbTestResult && csvTestResult && patternTestResult;
    
    if (allTestsPassed) {
      console.log('🎉 すべてのテストが成功しました！');
    } else {
      console.log('⚠️ 一部のテストが失敗しました');
    }
    
    return allTestsPassed;
    
  } catch (error) {
    console.error('❌ テスト実行中にエラーが発生しました:', error);
    return false;
  }
}

// 個別テスト実行関数
export async function runDatabaseTestsOnly() {
  console.log('📊 データベーステストのみ実行');
  return await runDatabaseTests();
}

export async function runCSVTestsOnly() {
  console.log('📄 CSV機能テストのみ実行');
  return await runCSVTests();
}

export async function runWeeklyPatternTestsOnly() {
  console.log('📅 週間パターン機能テストのみ実行');
  return await runWeeklyPatternTests();
}

// ブラウザのコンソールからテストを実行できるようにグローバルに公開
if (typeof window !== 'undefined') {
  (window as any).runTests = executeTests;
  (window as any).runDatabaseTests = runDatabaseTestsOnly;
  (window as any).runCSVTests = runCSVTestsOnly;
  (window as any).runWeeklyPatternTests = runWeeklyPatternTestsOnly;
  console.log('💡 ブラウザコンソールで以下のコマンドを実行できます:');
  console.log('  - runTests() : 全テスト実行');
  console.log('  - runDatabaseTests() : データベーステストのみ');
  console.log('  - runCSVTests() : CSV機能テストのみ');
  console.log('  - runWeeklyPatternTests() : 週間パターン機能テストのみ');
}