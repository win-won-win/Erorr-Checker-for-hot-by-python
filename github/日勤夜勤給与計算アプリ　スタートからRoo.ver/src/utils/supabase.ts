import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL and Anon Key must be provided in environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 認証関連のヘルパー関数
export const auth = {
  // メールリンクでサインイン
  signInWithEmail: async (email: string) => {
    return await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/login/callback`,
      },
    });
  },

  // 現在のセッションを取得
  getSession: async () => {
    return await supabase.auth.getSession();
  },

  // ログアウト
  signOut: async () => {
    return await supabase.auth.signOut();
  },

  // 認証状態の変更を監視
  onAuthStateChange: (callback: (event: 'SIGNED_IN' | 'SIGNED_OUT', session: any) => void) => {
    return supabase.auth.onAuthStateChange((event, session) => {
      callback(event as any, session);
    });
  },
};