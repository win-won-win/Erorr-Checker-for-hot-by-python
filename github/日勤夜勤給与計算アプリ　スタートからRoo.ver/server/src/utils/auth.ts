import jwt from 'jsonwebtoken';
import { FastifyRequest } from 'fastify';
import { createClient } from '@supabase/supabase-js';

// 環境変数から設定を読み込む
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';

// Supabaseクライアントの作成
export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// JWTの検証
export const verifyJWT = async (request: FastifyRequest): Promise<any> => {
  // リクエストからトークンを取得
  const authHeader = request.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('認証トークンがありません');
  }
  
  const token = authHeader.split(' ')[1];
  
  try {
    // JWTの検証（実際の実装ではSupabase Authを使用）
    // const { data, error } = await supabase.auth.getUser(token);
    // if (error) throw error;
    // return data.user;
    
    // 仮の実装（JWTを直接検証）
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded;
  } catch (error) {
    throw new Error('無効なトークンです');
  }
};

// ユーザーIDの取得
export const getUserId = (request: FastifyRequest): string => {
  try {
    const authHeader = request.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return '';
    }
    
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { sub: string };
    
    return decoded.sub;
  } catch (error) {
    return '';
  }
};

// 管理者権限の確認
export const isAdmin = async (userId: string): Promise<boolean> => {
  if (!userId) return false;
  
  try {
    // 実際の実装ではSupabaseから管理者情報を取得
    // const { data, error } = await supabase
    //   .from('admin_users')
    //   .select('*')
    //   .eq('user_id', userId)
    //   .single();
    
    // if (error) return false;
    // return !!data;
    
    // 仮の実装（特定のユーザーIDを管理者とする）
    const adminIds = ['admin-user-id'];
    return adminIds.includes(userId);
  } catch (error) {
    return false;
  }
};