import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth } from '../utils/supabase';

interface LoginProps {
  onLogin: () => void;
}

const Login = ({ onLogin }: LoginProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  
  // URLパラメータからエラーを取得
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const errorMessage = params.get('error');
    if (errorMessage) {
      setError(decodeURIComponent(errorMessage));
    }
  }, [location]);
  
  // 現在のセッションを確認
  useEffect(() => {
    const checkSession = async () => {
      const { data } = await auth.getSession();
      if (data.session) {
        onLogin();
        navigate('/attendance/new');
      }
    };
    
    checkSession();
  }, [onLogin, navigate]);
  
  // ログイン処理
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      setError('メールアドレスを入力してください');
      return;
    }
    
    setError(null);
    setIsLoading(true);
    
    try {
      const { error } = await auth.signInWithEmail(email);
      
      if (error) {
        throw error;
      }
      
      // メール送信成功
      setSuccess(true);
    } catch (error: any) {
      console.error('ログインに失敗しました:', error);
      setError(error.message || 'ログインに失敗しました');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-md">
        <h1 className="text-3xl font-bold text-center mb-8">給与集計アプリ</h1>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}
        
        {success ? (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-6">
            <p className="font-medium">メールを送信しました</p>
            <p className="text-sm mt-2">
              ログインリンクを記載したメールを送信しました。メールを確認してリンクをクリックしてください。
            </p>
          </div>
        ) : (
          <form onSubmit={handleLogin}>
            <div className="mb-6">
              <label htmlFor="email" className="block mb-2 font-medium">
                メールアドレス
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-3 border rounded"
                placeholder="example@company.com"
                required
              />
              <p className="mt-2 text-sm text-gray-500">
                ログインリンクをメールで送信します
              </p>
            </div>
            
            <button
              type="submit"
              className="w-full p-3 bg-blue-600 text-white font-medium rounded hover:bg-blue-700"
              disabled={isLoading}
            >
              {isLoading ? 'ログイン中...' : 'ログイン'}
            </button>
          </form>
        )}
        
        {/* 開発用の簡易ログイン（本番環境では削除） */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="text-center text-sm text-gray-500 mb-4">
            開発用簡易ログイン
          </p>
          <button
            onClick={() => {
              onLogin();
              navigate('/attendance/new');
            }}
            className="w-full p-2 bg-gray-200 text-gray-700 font-medium rounded hover:bg-gray-300"
          >
            ログインをスキップ
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;