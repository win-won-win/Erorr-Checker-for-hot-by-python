import { Client } from '@notionhq/client';
import { ShiftEntry, Employee } from '../types';
import dotenv from 'dotenv';

dotenv.config();

const notion = new Client({
  auth: process.env.NOTION_API_KEY,
});

const SHIFT_DATABASE_ID = process.env.NOTION_DATABASE_ID || '';
const EMPLOYEE_DATABASE_ID = '1f6ef211-dcd0-80d5-a77b-c70bfa00902b';

// データベースのプロパティ名を保持する変数
let databaseProperties: {
  titleProperty: string;
  shiftTypeProperty: string;
  startTimeProperty: string;
  endTimeProperty: string;
  workHoursProperty: string;
} | null = null;

// データベースのプロパティ情報を取得する関数
const fetchDatabaseProperties = async (forceRefresh = false) => {
  // 強制リフレッシュが要求された場合はキャッシュをクリア
  if (forceRefresh) {
    console.log('Forcing refresh of database properties');
    databaseProperties = null;
  }

  if (databaseProperties) return databaseProperties;

  try {
    console.log('Fetching database properties for database:', SHIFT_DATABASE_ID);
    const response = await notion.databases.retrieve({
      database_id: SHIFT_DATABASE_ID
    });

    // プロパティを探す
    const properties = response.properties;
    console.log('Notion Database Response:', JSON.stringify(response, null, 2));
    console.log('Notion Database Properties:', JSON.stringify(properties, null, 2));
    
    let titleProp = '';
    let shiftTypeProp = '';
    let startTimeProp = '';
    let endTimeProp = '';
    let workHoursProp = '';

    // プロパティ名のマッチングパターン
    const patterns = {
      title: ['name', '名前', '従業員'],
      shiftType: ['shift', '勤務', 'type', '種別'],
      startTime: ['start', '開始', 'from'],
      endTime: ['end', '終了', 'to'],
      workHours: ['hours', '時間', 'タイム', 'duration']
    };

    // 各プロパティを探す
    for (const [key, value] of Object.entries(properties)) {
      console.log(`Checking property: ${key}, type: ${value.type}`);
      const keyLower = key.toLowerCase();
      
      // 各パターンに対してマッチングを試みる
      if (value.type === 'title' || patterns.title.some(p => keyLower.includes(p.toLowerCase()))) {
        titleProp = key;
        console.log('Found title property:', key);
      }
      
      if (value.type === 'select' && patterns.shiftType.some(p => keyLower.includes(p.toLowerCase()))) {
        shiftTypeProp = key;
        console.log('Found shift type property:', key);
      }
      
      if (value.type === 'date' && patterns.startTime.some(p => keyLower.includes(p.toLowerCase()))) {
        startTimeProp = key;
        console.log('Found start time property:', key);
      }
      
      if (value.type === 'date' && patterns.endTime.some(p => keyLower.includes(p.toLowerCase()))) {
        endTimeProp = key;
        console.log('Found end time property:', key);
      }
      
      if (value.type === 'number' && patterns.workHours.some(p => keyLower.includes(p.toLowerCase()))) {
        workHoursProp = key;
        console.log('Found work hours property:', key);
      }
    }

    console.log('Found properties:', {
      titleProp,
      shiftTypeProp,
      startTimeProp,
      endTimeProp,
      workHoursProp
    });

    // 見つからなかったプロパティを記録
    const missingProps = [];
    if (!titleProp) missingProps.push('タイトル（従業員名）');
    if (!shiftTypeProp) missingProps.push('勤務種別');
    if (!startTimeProp) missingProps.push('開始時間');
    if (!endTimeProp) missingProps.push('終了時間');
    if (!workHoursProp) missingProps.push('勤務時間');

    // プロパティが見つからない場合は詳細なログを出力
    if (missingProps.length > 0) {
      console.warn('Missing properties:', missingProps);
      console.warn('Available properties:', Object.keys(properties));
    }

    // デフォルト値のセット（日本語と英語の両方を試す）
    databaseProperties = {
      titleProperty: titleProp || findFirstMatch(properties, ['従業員名', '名前', 'Name', 'Employee']),
      shiftTypeProperty: shiftTypeProp || findFirstMatch(properties, ['勤務種別', 'シフト種別', 'Shift Type', 'Type']),
      startTimeProperty: startTimeProp || findFirstMatch(properties, ['開始時間', '開始', 'Start Time', 'Start']),
      endTimeProperty: endTimeProp || findFirstMatch(properties, ['終了時間', '終了', 'End Time', 'End']),
      workHoursProperty: workHoursProp || findFirstMatch(properties, ['勤務時間', '時間', 'Work Hours', 'Hours'])
    };

    console.log('Using database properties:', databaseProperties);
    
    // 必要なプロパティが全て見つからない場合は警告を出力
    const missingRequiredProps = Object.entries(databaseProperties)
      .filter(([_, value]) => !value)
      .map(([key]) => key);
    
    if (missingRequiredProps.length > 0) {
      console.error('Missing required properties:', missingRequiredProps);
      console.error('Please check your Notion database structure.');
    }

    return databaseProperties;
  } catch (error) {
    console.error('Error fetching database properties:', error);
    // エラーが発生した場合はデフォルト値を返す
    databaseProperties = {
      titleProperty: '従業員名',
      shiftTypeProperty: '勤務種別',
      startTimeProperty: '開始時間',
      endTimeProperty: '終了時間',
      workHoursProperty: '勤務時間'
    };
    console.log('Using default properties:', databaseProperties);
    return databaseProperties;
  }
};

export const saveShiftToNotion = async (shift: ShiftEntry, forceRefresh = false): Promise<ShiftEntry> => {
  try {
    // データベースのプロパティ情報を取得
    const props = await fetchDatabaseProperties();

    // プロパティの検証
    const missingProps = [];
    if (!props.titleProperty) missingProps.push('タイトル（従業員名）');
    if (!props.shiftTypeProperty) missingProps.push('勤務種別');
    if (!props.startTimeProperty) missingProps.push('開始時間');
    if (!props.endTimeProperty) missingProps.push('終了時間');
    if (!props.workHoursProperty) missingProps.push('勤務時間');

    if (missingProps.length > 0) {
      const errorMessage = `以下のプロパティが見つかりません: ${missingProps.join(', ')}\n` +
        'Notionデータベースの設定を確認してください。';
      console.error('Missing required properties:', props);
      throw new Error(errorMessage);
    }

    // プロパティを動的に構築
    const properties: any = {};
    
    // タイトル（従業員名）
    properties[props.titleProperty] = {
      title: [{ text: { content: shift.従業員名 } }]
    };

    // 勤務種別
    properties[props.shiftTypeProperty] = {
      select: { name: shift.シフト種別 === 'day' ? '日勤' : '夜勤' }
    };

    // 開始時間と終了時間を別々のプロパティとして設定
    properties[props.startTimeProperty] = {
      date: {
        start: shift.開始時間.toISOString()  // 開始時間は単一の時点として設定
      }
    };

    properties[props.endTimeProperty] = {
      date: {
        start: shift.終了時間.toISOString()  // 終了時間も単一の時点として設定
      }
    };

    // 時間の差分を計算して確認
    const diffMs = shift.終了時間.getTime() - shift.開始時間.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    console.log('Saving shift:', {
      startTime: {
        raw: shift.開始時間,
        iso: shift.開始時間.toISOString()
      },
      endTime: {
        raw: shift.終了時間,
        iso: shift.終了時間.toISOString()
      },
      difference: {
        ms: diffMs,
        hours: diffHours
      }
    });

    console.log('Saving shift with properties:', {
      startTime: properties[props.startTimeProperty],
      endTime: properties[props.endTimeProperty]
    });

    // 勤務時間
    properties[props.workHoursProperty] = {
      number: calculateHours(shift.開始時間, shift.終了時間)
    };

    const response = await notion.pages.create({
      parent: { database_id: SHIFT_DATABASE_ID },
      properties
    });

    return {
      ...shift,
      id: response.id,
      勤務時間: calculateHours(shift.開始時間, shift.終了時間)
    };
  } catch (error: any) {
    console.error('Error saving to Notion:', error);
    
    // エラーの種類に応じて適切なメッセージを返す
    if (error.message?.includes('Could not find property')) {
      if (!forceRefresh) {
        console.log('Property not found, attempting refresh...');
        return saveShiftToNotion(shift, true);
      } else {
        throw new Error('Notionデータベースのプロパティ設定を確認してください。\n' +
          'プロパティ名が正しく設定されていることを確認してください。');
      }
    } else if (error.code === 'unauthorized') {
      throw new Error('Notion APIの認証に失敗しました。\n' +
        'APIキーが正しく設定されていることを確認してください。');
    } else if (error.code === 'object_not_found') {
      throw new Error('指定されたデータベースが見つかりません。\n' +
        'データベースIDが正しく設定されていることを確認してください。');
    } else if (error.code === 'validation_error') {
      throw new Error('データの形式が正しくありません。\n' +
        '入力データが正しい形式であることを確認してください。');
    } else if (error.code === 'rate_limited') {
      throw new Error('APIリクエストの制限に達しました。\n' +
        'しばらく待ってから再度お試しください。');
    }
    
    // その他のエラー
    throw new Error(`シフトの保存中にエラーが発生しました: ${error.message || '不明なエラー'}`);
  }
};

export const fetchShiftsForMonth = async (year: string, month: string, forceRefresh = false): Promise<ShiftEntry[]> => {
  try {
    // データベースのプロパティ情報を取得（強制リフレッシュ付き）
    console.log('Fetching database properties for month:', { year, month });
    const props = await fetchDatabaseProperties(forceRefresh);
    console.log('Retrieved properties:', props);

    // プロパティの検証
    const missingProps = [];
    if (!props.titleProperty) missingProps.push('タイトル（従業員名）');
    if (!props.shiftTypeProperty) missingProps.push('勤務種別');
    if (!props.startTimeProperty) missingProps.push('開始時間');
    if (!props.endTimeProperty) missingProps.push('終了時間');
    if (!props.workHoursProperty) missingProps.push('勤務時間');

    if (missingProps.length > 0) {
      const errorMessage = `以下のプロパティが見つかりません: ${missingProps.join(', ')}\n` +
        'Notionデータベースの設定を確認してください。';
      console.error('Missing required properties:', props);
      throw new Error(errorMessage);
    }

    const startOfMonth = new Date(`${year}-${month}-01T00:00:00Z`);
    const endOfMonth = new Date(new Date(startOfMonth).setMonth(startOfMonth.getMonth() + 1) - 1);

    const response = await notion.databases.query({
      database_id: SHIFT_DATABASE_ID,
      filter: {
        property: props.startTimeProperty,
        date: {
          on_or_after: startOfMonth.toISOString()
        }
      },
      sorts: [
        {
          property: props.startTimeProperty,
          direction: 'ascending'
        }
      ]
    });

    // エラーハンドリングを追加してマッピング
    const shifts = response.results
      .map((page: any) => {
        try {
          const properties = page.properties;
          
          // プロパティが存在するか確認
          if (!properties) return null;
          
          // 日付の変換を安全に行う
          let startTime: Date;
          let endTime: Date;
          
          try {
            // 開始時間と終了時間のプロパティをログ出力
            console.log('Raw properties:', {
              start: properties[props.startTimeProperty],
              end: properties[props.endTimeProperty]
            });

            // 開始時間の処理
            const startTimeProperty = properties[props.startTimeProperty]?.date;
            if (startTimeProperty) {
              startTime = new Date(startTimeProperty.start);
              console.log('Start time:', {
                property: startTimeProperty,
                parsed: startTime.toISOString()
              });
            } else {
              console.warn('Start time property is missing');
              startTime = new Date();
            }
            
            // 終了時間の処理
            const endTimeProperty = properties[props.endTimeProperty]?.date;
            if (endTimeProperty) {
              // 終了時間は独立したプロパティとして扱う
              endTime = new Date(endTimeProperty.start);
              console.log('End time:', {
                property: endTimeProperty,
                parsed: endTime.toISOString()
              });
            } else {
              console.warn('End time property is missing');
              endTime = new Date();
            }

            // 時間の差分を確認
            const diffMs = endTime.getTime() - startTime.getTime();
            console.log('Time difference:', {
              startTime: startTime.toISOString(),
              endTime: endTime.toISOString(),
              diffMs,
              diffHours: diffMs / (1000 * 60 * 60)
            });
          } catch (dateError) {
            console.error('Date conversion error:', dateError);
            startTime = new Date();
            endTime = new Date();
          }

          return {
            id: page.id,
            従業員ID: '',
            従業員名: properties[props.titleProperty]?.title?.[0]?.text?.content || '名前なし',
            シフト種別: properties[props.shiftTypeProperty]?.select?.name === '日勤' ? 'day' : 'night',
            開始時間: startTime,
            終了時間: endTime,
            勤務時間: properties[props.workHoursProperty]?.number || calculateHours(startTime, endTime)
          } as ShiftEntry;
        } catch (error) {
          console.error('Error processing page:', error);
          return null;
        }
      })
      .filter((shift): shift is ShiftEntry => shift !== null);
      
    return shifts;
  } catch (error: any) {
    console.error('Error fetching from Notion:', error);
    
    // エラーの種類に応じて適切なメッセージを返す
    if (error.message?.includes('Could not find property')) {
      if (!forceRefresh) {
        console.log('Property not found, attempting refresh...');
        return fetchShiftsForMonth(year, month, true);
      } else {
        throw new Error('Notionデータベースのプロパティ設定を確認してください。\n' +
          'プロパティ名が正しく設定されていることを確認してください。');
      }
    } else if (error.code === 'unauthorized') {
      throw new Error('Notion APIの認証に失敗しました。\n' +
        'APIキーが正しく設定されていることを確認してください。');
    } else if (error.code === 'object_not_found') {
      throw new Error('指定されたデータベースが見つかりません。\n' +
        'データベースIDが正しく設定されていることを確認してください。');
    } else if (error.code === 'validation_error') {
      throw new Error('データベースのプロパティ設定が正しくありません。\n' +
        'プロパティの型が正しく設定されていることを確認してください。');
    }
    
    // その他のエラー
    throw new Error(`シフトデータの取得中にエラーが発生しました: ${error.message || '不明なエラー'}`);
  }
};

// 従業員データベースのプロパティ情報を保持する変数
let employeeDatabaseProperties: {
  employeeIdProperty: string;
  nameProperty: string;
  hourlyRateProperty: string;
  nightHourlyRateProperty: string;
} | null = null;

// 従業員データベースのプロパティ情報を取得する関数
const fetchEmployeeDatabaseProperties = async (forceRefresh = false) => {
  if (forceRefresh) {
    console.log('Forcing refresh of employee database properties');
    employeeDatabaseProperties = null;
  }

  if (employeeDatabaseProperties) return employeeDatabaseProperties;

  try {
    console.log('Fetching employee database properties');
    const response = await notion.databases.retrieve({
      database_id: EMPLOYEE_DATABASE_ID
    });

    const properties = response.properties;
    console.log('Employee Database Properties:', JSON.stringify(properties, null, 2));

    let employeeIdProp = '';
    let nameProp = '';
    let hourlyRateProp = '';
    let nightHourlyRateProp = '';

    // プロパティ名のマッチングパターン
    const patterns = {
      employeeId: ['従業員ID', '社員ID', 'ID'],
      name: ['従業員名', '名前', '氏名'],
      hourlyRate: ['時給', '日勤時給', '通常時給'],
      nightHourlyRate: ['深夜時給', '夜勤時給']
    };

    // 各プロパティを探す
    for (const [key, value] of Object.entries(properties)) {
      const keyLower = key.toLowerCase();

      if (patterns.employeeId.some(p => key.includes(p))) {
        employeeIdProp = key;
      }
      if (value.type === 'title' || patterns.name.some(p => key.includes(p))) {
        nameProp = key;
      }
      if (value.type === 'number' && patterns.hourlyRate.some(p => key.includes(p))) {
        hourlyRateProp = key;
      }
      if (value.type === 'number' && patterns.nightHourlyRate.some(p => key.includes(p))) {
        nightHourlyRateProp = key;
      }
    }

    employeeDatabaseProperties = {
      employeeIdProperty: employeeIdProp || findFirstMatch(properties, patterns.employeeId),
      nameProperty: nameProp || findFirstMatch(properties, patterns.name),
      hourlyRateProperty: hourlyRateProp || findFirstMatch(properties, patterns.hourlyRate),
      nightHourlyRateProperty: nightHourlyRateProp || findFirstMatch(properties, patterns.nightHourlyRate)
    };

    return employeeDatabaseProperties;
  } catch (error) {
    console.error('Error fetching employee database properties:', error);
    throw new Error('従業員データベースのプロパティ取得に失敗しました');
  }
};

// 従業員データを取得する関数
export const fetchEmployees = async (forceRefresh = false): Promise<Employee[]> => {
  try {
    const props = await fetchEmployeeDatabaseProperties(forceRefresh);

    const response = await notion.databases.query({
      database_id: EMPLOYEE_DATABASE_ID,
      sorts: [
        {
          property: props.employeeIdProperty,
          direction: 'ascending'
        }
      ]
    });

    const employees = response.results.map((page: any) => {
      const properties = page.properties;
      return {
        id: page.id,
        従業員ID: properties[props.employeeIdProperty]?.rich_text?.[0]?.text?.content || '',
        従業員名: properties[props.nameProperty]?.title?.[0]?.text?.content || '',
        時給: properties[props.hourlyRateProperty]?.number || 0,
        深夜時給: properties[props.nightHourlyRateProperty]?.number || 0
      } as Employee;
    });

    return employees;
  } catch (error: any) {
    console.error('Error fetching employees:', error);
    throw new Error('従業員データの取得に失敗しました');
  }
};

// 従業員データを保存する関数
export const saveEmployee = async (employee: Employee): Promise<Employee> => {
  try {
    const props = await fetchEmployeeDatabaseProperties();

    const properties: any = {
      [props.employeeIdProperty]: {
        rich_text: [{ text: { content: employee.従業員ID } }]
      },
      [props.nameProperty]: {
        title: [{ text: { content: employee.従業員名 } }]
      },
      [props.hourlyRateProperty]: {
        number: employee.時給
      },
      [props.nightHourlyRateProperty]: {
        number: employee.深夜時給
      }
    };

    const response = await notion.pages.create({
      parent: { database_id: EMPLOYEE_DATABASE_ID },
      properties
    });

    return {
      ...employee,
      id: response.id
    };
  } catch (error: any) {
    console.error('Error saving employee:', error);
    throw new Error('従業員データの保存に失敗しました');
  }
};

// プロパティ名の候補から最初に一致するものを探す
const findFirstMatch = (properties: any, candidates: string[]): string => {
  for (const candidate of candidates) {
    if (properties[candidate]) {
      return candidate;
    }
  }
  return candidates[0]; // 見つからない場合は最初の候補を返す
};

const calculateHours = (start: Date, end: Date): number => {
  // 日付オブジェクトからミリ秒単位の差分を計算
  const diffMs = end.getTime() - start.getTime();
  
  // ミリ秒を時間に変換（小数点以下2桁まで）
  const hours = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
  
  console.log(`Calculating hours: ${start.toISOString()} to ${end.toISOString()} = ${hours} hours`);
  
  return hours;
};