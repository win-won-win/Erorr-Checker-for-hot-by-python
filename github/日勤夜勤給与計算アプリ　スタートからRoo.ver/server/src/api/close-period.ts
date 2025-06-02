import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { supabase, getUserId, isAdmin } from '../utils/auth';

// 締め処理APIルート
export const closePeriodRoutes = async (fastify: FastifyInstance) => {
  // 締め履歴の取得
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // 締め履歴データの取得
      const { data, error } = await supabase
        .from('payroll_closing')
        .select('*')
        .order('year_month', { ascending: false });
      
      if (error) {
        throw error;
      }
      
      return reply.code(200).send(data);
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: '締め履歴の取得に失敗しました' });
    }
  });
  
  // 締め処理の実行
  fastify.post('/', async (request: FastifyRequest<{ Body: { ym: string } }>, reply: FastifyReply) => {
    try {
      const userId = getUserId(request);
      const { ym } = request.body;
      
      if (!ym) {
        return reply.code(400).send({ error: '年月パラメータが必要です' });
      }
      
      // 年月の形式チェック（YYYY-MM）
      if (!/^\d{4}-\d{2}$/.test(ym)) {
        return reply.code(400).send({ error: '年月の形式が不正です（YYYY-MM）' });
      }
      
      // 未来の月は締めできない
      const today = new Date();
      const targetDate = new Date(ym + '-01');
      
      if (targetDate > today) {
        return reply.code(400).send({ error: '未来の月は締め処理できません' });
      }
      
      // 既に締め済みかチェック
      const { data: existingData, error: checkError } = await supabase
        .from('payroll_closing')
        .select('*')
        .eq('year_month', ym)
        .maybeSingle();
      
      if (checkError) {
        throw checkError;
      }
      
      if (existingData) {
        return reply.code(400).send({ error: '選択した月は既に締め処理済みです' });
      }
      
      // 締め処理の実行
      const { data, error } = await supabase
        .from('payroll_closing')
        .insert([
          {
            year_month: ym,
            closed_by: userId,
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
          event: 'period_closed',
          payload: { year_month: ym },
          actor_id: userId,
        },
      ]);
      
      return reply.code(201).send(data);
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: '締め処理に失敗しました' });
    }
  });
  
  // 締め解除（管理者のみ）
  fastify.delete('/:ym', async (request: FastifyRequest<{ Params: { ym: string } }>, reply: FastifyReply) => {
    try {
      const userId = getUserId(request);
      const { ym } = request.params;
      
      // 管理者権限の確認
      const admin = await isAdmin(userId);
      if (!admin) {
        return reply.code(403).send({ error: '締め解除は管理者のみ実行できます' });
      }
      
      // 締め情報の確認
      const { data: existingData, error: checkError } = await supabase
        .from('payroll_closing')
        .select('*')
        .eq('year_month', ym)
        .maybeSingle();
      
      if (checkError) {
        throw checkError;
      }
      
      if (!existingData) {
        return reply.code(404).send({ error: '指定された月の締め情報が見つかりません' });
      }
      
      // 締め解除の実行
      const { error } = await supabase
        .from('payroll_closing')
        .delete()
        .eq('year_month', ym);
      
      if (error) {
        throw error;
      }
      
      // 監査ログの記録
      await supabase.from('audit_log').insert([
        {
          event: 'period_reopened',
          payload: { year_month: ym },
          actor_id: userId,
        },
      ]);
      
      return reply.code(200).send({ success: true });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: '締め解除に失敗しました' });
    }
  });
};