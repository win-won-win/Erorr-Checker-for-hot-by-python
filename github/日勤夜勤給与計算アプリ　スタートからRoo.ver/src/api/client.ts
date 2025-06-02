import { supabase } from '../utils/supabase';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// APIリクエストの基本設定
const fetchWithAuth = async (endpoint: string, options: RequestInit = {}) => {
  // 現在のセッションからJWTを取得
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  // ヘッダーの設定
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  // リクエストの実行
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  // エラーハンドリング
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `API request failed with status ${response.status}`);
  }

  // レスポンスの解析
  return response.json();
};

// 従業員API
export const employeesApi = {
  // 従業員一覧の取得
  getAll: async (showDeleted = false) => {
    return fetchWithAuth(`/api/employees?showDeleted=${showDeleted}`);
  },

  // 従業員の取得
  getById: async (id: string) => {
    return fetchWithAuth(`/api/employees/${id}`);
  },

  // 従業員の作成
  create: async (data: {
    name: string;
    allowance_pct: number;
    display_start: string;
    display_end: string;
  }) => {
    return fetchWithAuth('/api/employees', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // 従業員の更新
  update: async (
    id: string,
    data: {
      name: string;
      allowance_pct: number;
      display_start: string;
      display_end: string;
    }
  ) => {
    return fetchWithAuth(`/api/employees/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // 従業員の削除
  delete: async (id: string) => {
    return fetchWithAuth(`/api/employees/${id}`, {
      method: 'DELETE',
    });
  },
};

// 勤怠データAPI
export const shiftsApi = {
  // 勤怠データの作成
  create: async (data: {
    employee_id: string;
    duty_type: 'day' | 'night';
    work_date: string;
    start_ts: string;
    end_ts: string;
  }) => {
    return fetchWithAuth('/api/shifts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // 勤怠データの取得
  getAll: async (params: {
    employee_id?: string;
    start_date?: string;
    end_date?: string;
  }) => {
    const queryParams = new URLSearchParams();
    if (params.employee_id) queryParams.append('employee_id', params.employee_id);
    if (params.start_date) queryParams.append('start_date', params.start_date);
    if (params.end_date) queryParams.append('end_date', params.end_date);

    return fetchWithAuth(`/api/shifts?${queryParams.toString()}`);
  },

  // 勤怠データの更新
  update: async (
    id: string,
    data: {
      employee_id: string;
      duty_type: 'day' | 'night';
      work_date: string;
      start_ts: string;
      end_ts: string;
    }
  ) => {
    return fetchWithAuth(`/api/shifts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // 勤怠データの削除
  delete: async (id: string) => {
    return fetchWithAuth(`/api/shifts/${id}`, {
      method: 'DELETE',
    });
  },
};

// レポートAPI
export const reportsApi = {
  // 日勤集計レポート
  getDayReport: async (ym: string) => {
    return fetchWithAuth(`/api/reports/day?ym=${ym}`);
  },

  // 日勤詳細レポート
  getDayDetail: async (ym: string, employeeId: string) => {
    return fetchWithAuth(`/api/reports/day/detail?ym=${ym}&employee_id=${employeeId}`);
  },

  // 夜勤集計レポート
  getNightReport: async (ym: string) => {
    return fetchWithAuth(`/api/reports/night?ym=${ym}`);
  },

  // 夜勤詳細レポート
  getNightDetail: async (ym: string, employeeId: string) => {
    return fetchWithAuth(`/api/reports/night/detail?ym=${ym}&employee_id=${employeeId}`);
  },
};

// 締め処理API
export const closePeriodApi = {
  // 締め履歴の取得
  getAll: async () => {
    return fetchWithAuth('/api/close-period');
  },

  // 締め処理の実行
  close: async (ym: string) => {
    return fetchWithAuth('/api/close-period', {
      method: 'POST',
      body: JSON.stringify({ ym }),
    });
  },

  // 締め解除（管理者のみ）
  reopen: async (ym: string) => {
    return fetchWithAuth(`/api/close-period/${ym}`, {
      method: 'DELETE',
    });
  },
};