import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { supabase, getUserId } from '../utils/auth';

// 勤怠データの型定義
interface ShiftBody {
  employee_id: string;
  duty_type: 'day' | 'night';
  work_date: string;
  start_ts: string;
  end_ts: string;
}

// 勤怠データAPIルート
export const shiftRoutes = async (fastify: FastifyInstance) => {
  // 勤怠データの作成
  fastify.post('/', async (request: FastifyRequest<{ Body: ShiftBody }>, reply: FastifyReply) => {
    try {
      const userId = getUserId(request);
      const { employee_id, duty_type, work_date, start_ts, end_ts } = request.body;
      
      // バリデーション
      if (!employee_id || !duty_type || !work_date || !start_ts || !end_ts) {
        return reply.code(400).send({ error: '入力データが不正です' });
      }
      
      // 開始時間と終了時間の比較
      const startDate = new Date(start_ts);
      const endDate = new Date(end_ts);
      
      if (endDate <= startDate) {
        return reply.code(400).send({ error: '終了時間は開始時間より後である必要があります' });
      }
      
      // 締め済み期間のチェック
      const yearMonth = work_date.substring(0, 7); // YYYY-MM形式
      
      const { data: closingData, error: closingError } = await supabase
        .from('payroll_closing')
        .select('*')
        .eq('year_month', yearMonth)
        .maybeSingle();
      
      if (closingError) {
        throw closingError;
      }
      
      if (closingData) {
        return reply.code(400).send({ error: '選択した月は締め処理済みです' });
      }
      
      // 勤怠データの作成
      const { data, error } = await supabase
        .from('shifts')
        .insert([
          {
            employee_id,
            duty_type,
            work_date,
            start_ts,
            end_ts,
            created_by: userId,
          },
        ])
        .select()
        .single();
      
      if (error) {
        throw error;
      }
      
      return reply.code(201).send(data);
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: '勤怠データの保存に失敗しました' });
    }
  });
  
  // 勤怠データの取得（従業員ID・期間指定）
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as {
        employee_id?: string;
        start_date?: string;
        end_date?: string;
      };
      
      // クエリの構築
      let dbQuery = supabase.from('shifts').select(`
        *,
        employees (
          name
        )
      `);
      
      // 従業員IDでフィルタリング
      if (query.employee_id) {
        dbQuery = dbQuery.eq('employee_id', query.employee_id);
      }
      
      // 期間でフィルタリング
      if (query.start_date) {
        dbQuery = dbQuery.gte('work_date', query.start_date);
      }
      
      if (query.end_date) {
        dbQuery = dbQuery.lte('work_date', query.end_date);
      }
      
      // データの取得
      const { data, error } = await dbQuery.order('work_date', { ascending: false });
      
      if (error) {
        throw error;
      }
      
      return reply.code(200).send(data);
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: '勤怠データの取得に失敗しました' });
    }
  });
  
  // 勤怠データの更新
  fastify.put('/:id', async (request: FastifyRequest<{ Params: { id: string }; Body: ShiftBody }>, reply: FastifyReply) => {
    try {
      const userId = getUserId(request);
      const { id } = request.params;
      const { employee_id, duty_type, work_date, start_ts, end_ts } = request.body;
      
      // バリデーション
      if (!employee_id || !duty_type || !work_date || !start_ts || !end_ts) {
        return reply.code(400).send({ error: '入力データが不正です' });
      }
      
      // 開始時間と終了時間の比較
      const startDate = new Date(start_ts);
      const endDate = new Date(end_ts);
      
      if (endDate <= startDate) {
        return reply.code(400).send({ error: '終了時間は開始時間より後である必要があります' });
      }
      
      // 締め済み期間のチェック
      const yearMonth = work_date.substring(0, 7); // YYYY-MM形式
      
      const { data: closingData, error: closingError } = await supabase
        .from('payroll_closing')
        .select('*')
        .eq('year_month', yearMonth)
        .maybeSingle();
      
      if (closingError) {
        throw closingError;
      }
      
      if (closingData) {
        return reply.code(400).send({ error: '選択した月は締め処理済みです' });
      }
      
      // 勤怠データの更新
      const { data, error } = await supabase
        .from('shifts')
        .update({
          employee_id,
          duty_type,
          work_date,
          start_ts,
          end_ts,
        })
        .eq('id', id)
        .select()
        .single();
      
      if (error) {
        throw error;
      }
      
      return reply.code(200).send(data);
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: '勤怠データの更新に失敗しました' });
    }
  });
  
  // 勤怠データの削除
  fastify.delete('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      
      // 勤怠データの取得
      const { data: shiftData, error: fetchError } = await supabase
        .from('shifts')
        .select('work_date')
        .eq('id', id)
        .single();
      
      if (fetchError) {
        throw fetchError;
      }
      
      // 締め済み期間のチェック
      const yearMonth = shiftData.work_date.substring(0, 7); // YYYY-MM形式
      
      const { data: closingData, error: closingError } = await supabase
        .from('payroll_closing')
        .select('*')
        .eq('year_month', yearMonth)
        .maybeSingle();
      
      if (closingError) {
        throw closingError;
      }
      
      if (closingData) {
        return reply.code(400).send({ error: '締め処理済みの勤怠データは削除できません' });
      }
      
      // 勤怠データの削除
      const { error } = await supabase
        .from('shifts')
        .delete()
        .eq('id', id);
      
      if (error) {
        throw error;
      }
      
      return reply.code(200).send({ success: true });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: '勤怠データの削除に失敗しました' });
    }
  });
};