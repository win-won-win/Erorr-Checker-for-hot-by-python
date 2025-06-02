import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// 環境変数の読み込み
dotenv.config();

const app = express();

// ミドルウェアの設定
app.use(cors());
app.use(express.json());

// Supabaseクライアントの初期化
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

// ルートハンドラー
app.get('/', (_, res) => {
  res.json({ message: 'Salary calculation API' });
});

// 従業員関連のルート
import employeeRoutes from './routes/employee';
app.use('/api/employees', employeeRoutes);

// 給与計算関連のルート
import salaryRoutes from './routes/salary';
app.use('/api/salary', salaryRoutes);

// エラーハンドリング
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// サーバーの起動
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});