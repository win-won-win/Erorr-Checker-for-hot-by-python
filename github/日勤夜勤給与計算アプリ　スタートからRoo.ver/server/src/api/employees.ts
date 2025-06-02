import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { supabase, getUserId, isAdmin } from '../utils/auth';

// リクエストパラメータの型定義
interface EmployeeParams {
  id: string;
}

// 従業員作成/更新の型定義
interface EmployeeBody {
  name: string;
  allowance_pct: number;
  display_start: string;
  display_end: string;
}

// 従業員APIルート
export const employeeRoutes = async (fastify: FastifyInstance) => {
  // 従業員一覧の取得
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = getUserId(request);
      
      // クエリパラメータから退職者表示フラグを取得
      const showDeleted = request.query as { showDeleted?: string };
      
      // Supabaseクエリの構築
      let query = supabase.from('employees').select('*');
      
      // 退職者を含まない場合はフィルタリング
      if (!showDeleted || showDeleted.showDeleted !== 'true') {
        query = query.is('deleted_at', null);
      }
      
      // データの取得
      const { data, error } = await query.order('name');
      
      if (error) {
        throw error;
      }
      
      return reply.code(200).send(data);
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: '従業員データの取得に失敗しました' });
    }
  });
  
  // 従業員の取得
  fastify.get('/:id', async (request: FastifyRequest<{ Params: EmployeeParams }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      
      // データの取得
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) {
        throw error;
      }
      
      return reply.code(200).send(data);
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: '従業員データの取得に失敗しました' });
    }
  });
  
  // 従業員の作成
  fastify.post('/', async (request: FastifyRequest<{ Body: EmployeeBody }>, reply: FastifyReply) => {
    try {
      const userId = getUserId(request);
      const { name, allowance_pct, display_start, display_end } = request.body;
      
      // バリデーション
      if (!name || allowance_pct < 0 || !display_start || !display_end) {
        return reply.code(400).send({ error: '入力データが不正です' });
      }
      
      // データの作成
      const { data, error } = await supabase
        .from('employees')
        .insert([
          {
            name,
            allowance_pct,
            display_start,
            display_end,
          },
        ])
        .select()
        .single();
      
      if (error) {
        throw error;
      }
      
      // 監査ログの記録
      await supabase.from('audit_log').insert([
        {
          event: 'employee_created',
          payload: { employee_id: data.id, name },
          actor_id: userId,
        },
      ]);
      
      return reply.code(201).send(data);
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: '従業員の作成に失敗しました' });
    }
  });
  
  // 従業員の更新
  fastify.put('/:id', async (request: FastifyRequest<{ Params: EmployeeParams; Body: EmployeeBody }>, reply: FastifyReply) => {
    try {
      const userId = getUserId(request);
      const { id } = request.params;
      const { name, allowance_pct, display_start, display_end } = request.body;
      
      // バリデーション
      if (!name || allowance_pct < 0 || !display_start || !display_end) {
        return reply.code(400).send({ error: '入力データが不正です' });
      }
      
      // データの更新
      const { data, error } = await supabase
        .from('employees')
        .update({
          name,
          allowance_pct,
          display_start,
          display_end,
        })
        .eq('id', id)
        .select()
        .single();
      
      if (error) {
        throw error;
      }
      
      // 監査ログの記録
      await supabase.from('audit_log').insert([
        {
          event: 'employee_updated',
          payload: { employee_id: id, name },
          actor_id: userId,
        },
      ]);
      
      return reply.code(200).send(data);
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: '従業員の更新に失敗しました' });
    }
  });
  
  // 従業員の削除（ソフトデリート）
  fastify.delete('/:id', async (request: FastifyRequest<{ Params: EmployeeParams }>, reply: FastifyReply) => {
    try {
      const userId = getUserId(request);
      const { id } = request.params;
      
      // 管理者権限の確認
      const admin = await isAdmin(userId);
      if (!admin) {
        return reply.code(403).send({ error: '権限がありません' });
      }
      
      // 現在の従業員データを取得
      const { data: employee, error: fetchError } = await supabase
        .from('employees')
        .select('name')
        .eq('id', id)
        .single();
      
      if (fetchError) {
        throw fetchError;
      }
      
      // データの削除（ソフトデリート）
      const { error } = await supabase
        .from('employees')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);
      
      if (error) {
        throw error;
      }
      
      // 監査ログの記録
      await supabase.from('audit_log').insert([
        {
          event: 'employee_deleted',
          payload: { employee_id: id, name: employee.name },
          actor_id: userId,
        },
      ]);
      
      return reply.code(200).send({ success: true });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: '従業員の削除に失敗しました' });
    }
  });
};