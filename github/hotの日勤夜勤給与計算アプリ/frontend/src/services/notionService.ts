import { ShiftEntry, Employee } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const NOTION_DATABASE_ID = import.meta.env.VITE_NOTION_DATABASE_ID;

const headers = {
  'Content-Type': 'application/json',
};

/**
 * Save shift entry to Notion database
 */
export const saveShiftToNotion = async (shift: ShiftEntry): Promise<ShiftEntry> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/notion/v1/pages`, {
      method: 'POST',
      headers,
      body: JSON.stringify(shift)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Notion API error: ${errorData.message || 'Unknown error'}`);
    }

    const data = await response.json();
    return {
      ...data,
      開始時間: new Date(data.開始時間),
      終了時間: new Date(data.終了時間),
      勤務時間: data.勤務時間
    };
  } catch (error: any) {
    console.error('Error saving to Notion:', error);
    
    // エラーメッセージをより詳細に
    const errorMessage = error.message || 'Unknown error';
    if (errorMessage.includes('Could not find property')) {
      throw new Error('データベースのプロパティ設定を確認してください。');
    } else if (errorMessage.includes('validation_error')) {
      throw new Error('入力データが正しくありません。');
    }
    
    throw new Error(`シフトの保存中にエラーが発生しました: ${errorMessage}`);
  }
};

/**
 * Fetch shifts from Notion for a specific month and year
 */
export const fetchShiftsForMonth = async (year: string, month: string): Promise<ShiftEntry[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/notion/v1/databases/${NOTION_DATABASE_ID}/query`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ year, month })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Notion API error: ${errorData.message || 'Unknown error'}`);
    }

    const data = await response.json();
    return data.results.map((shift: any) => {
      try {
        // バックエンドから受け取ったISOString形式の日付を解析
        const startTime = new Date(shift.開始時間);
        const endTime = new Date(shift.終了時間);
        
        console.log('シフトデータ解析:', {
          raw: {
            開始時間: shift.開始時間,
            終了時間: shift.終了時間
          },
          parsed: {
            開始時間: startTime.toISOString(),
            終了時間: endTime.toISOString()
          }
        });
        
        // 勤務時間の計算
        const diffMs = endTime.getTime() - startTime.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);
        console.log(`勤務時間計算: ${diffHours} 時間`);
        
        // 勤務時間が負の値になる場合は警告
        if (diffHours < 0) {
          console.warn(`勤務時間が負の値になっています: ${diffHours} 時間`);
          console.warn(`開始時間: ${startTime.toISOString()}, 終了時間: ${endTime.toISOString()}`);
        }
        
        return {
          ...shift,
          開始時間: startTime,
          終了時間: endTime,
          勤務時間: shift.勤務時間 || diffHours
        };
      } catch (error) {
        console.error('シフトデータの解析エラー:', error);
        // エラーが発生した場合はデフォルト値を使用
        return {
          ...shift,
          開始時間: new Date(),
          終了時間: new Date(),
          勤務時間: shift.勤務時間 || 0
        };
      }
    });
  } catch (error: any) {
    console.error('Error fetching from Notion:', error);
    
    // エラーメッセージをより詳細に
    const errorMessage = error.message || 'Unknown error';
    if (errorMessage.includes('Could not find property')) {
      throw new Error('データベースのプロパティ設定を確認してください。');
    } else if (errorMessage.includes('validation_error')) {
      throw new Error('データベースの設定が正しくありません。');
    }
    
    throw new Error(`シフトデータの取得中にエラーが発生しました: ${errorMessage}`);
  }
};

/**
 * 従業員データをNotionから取得
 */
export const fetchEmployees = async (): Promise<Employee[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/notion/v1/employees`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Notion API error: ${errorData.message || 'Unknown error'}`);
    }

    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error('Error fetching employees:', error);
    throw new Error(`従業員データの取得中にエラーが発生しました: ${error.message || '不明なエラー'}`);
  }
};

/**
 * 従業員データをNotionに保存
 */
export const saveEmployee = async (employee: Employee): Promise<Employee> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/notion/v1/employees`, {
      method: 'POST',
      headers,
      body: JSON.stringify(employee)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Notion API error: ${errorData.message || 'Unknown error'}`);
    }

    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error('Error saving employee:', error);
    throw new Error(`従業員データの保存中にエラーが発生しました: ${error.message || '不明なエラー'}`);
  }
};