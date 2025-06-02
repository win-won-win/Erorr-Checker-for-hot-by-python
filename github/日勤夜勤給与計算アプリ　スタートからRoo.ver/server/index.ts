import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { employeeRoutes } from './src/api/employees';
import { shiftRoutes } from './src/api/shifts';
import { reportRoutes } from './src/api/reports';
import { closePeriodRoutes } from './src/api/close-period';
import { verifyJWT } from './src/utils/auth';

// サーバーインスタンスの作成
const server = Fastify({
  logger: true,
});

// CORSの設定
server.register(cors, {
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
});

// 認証ミドルウェア
server.addHook('onRequest', async (request, reply) => {
  // 認証が不要なルートをスキップ
  if (request.url === '/api/health') {
    return;
  }
  
  try {
    // JWTの検証（実際の実装ではSupabase Authを使用）
    await verifyJWT(request);
  } catch (error) {
    reply.code(401).send({ error: '認証に失敗しました' });
  }
});

// ヘルスチェックエンドポイント
server.get('/api/health', async () => {
  return { status: 'ok' };
});

// APIルートの登録
server.register(employeeRoutes, { prefix: '/api/employees' });
server.register(shiftRoutes, { prefix: '/api/shifts' });
server.register(reportRoutes, { prefix: '/api/reports' });
server.register(closePeriodRoutes, { prefix: '/api/close-period' });

// サーバーの起動
const start = async () => {
  try {
    const port = process.env.PORT ? parseInt(process.env.PORT) : 8000;
    const host = process.env.HOST || '0.0.0.0';
    
    await server.listen({ port, host });
    console.log(`Server is running on ${host}:${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();