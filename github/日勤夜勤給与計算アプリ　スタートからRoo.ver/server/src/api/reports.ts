import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { supabase } from '../utils/auth';

// レポートAPIルート
export const reportRoutes = async (fastify: FastifyInstance) => {
  // 日勤集計レポート
  fastify.get('/day', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as { ym?: string };
      
      if (!query.ym) {
        return reply.code(400).send({ error: '年月パラメータが必要です' });
      }
      
      // 年月から期間を計算
      const year = parseInt(query.ym.split('-')[0]);
      const month = parseInt(query.ym.split('-')[1]);
      const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0];
      const endDate = new Date(year, month, 0).toISOString().split('T')[0];
      
      // 日勤データの取得
      const { data, error } = await supabase
        .from('shifts')
        .select(`
          id,
          employee_id,
          employees (
            id,
            name
          ),
          work_date,
          start_ts,
          end_ts
        `)
        .eq('duty_type', 'day')
        .gte('work_date', startDate)
        .lte('work_date', endDate);
      
      if (error) {
        throw error;
      }
      
      // 従業員ごとに集計
      const employeeSummary: Record<string, any> = {};
      
      data.forEach((shift) => {
        const employeeId = shift.employee_id;
        const employeeName = shift.employees?.name || 'Unknown';
        
        // 勤務時間の計算
        const startTime = new Date(shift.start_ts);
        const endTime = new Date(shift.end_ts);
        const hours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
        
        // 日勤の支給額計算（時給1,300円）
        const amount = hours * 1300;
        
        // 従業員サマリーの更新
        if (!employeeSummary[employeeId]) {
          employeeSummary[employeeId] = {
            employee_id: employeeId,
            employee_name: employeeName,
            total_hours: 0,
            total_days: 0,
            total_amount: 0,
          };
        }
        
        employeeSummary[employeeId].total_hours += hours;
        employeeSummary[employeeId].total_days += 1;
        employeeSummary[employeeId].total_amount += amount;
      });
      
      // 結果を配列に変換
      const result = Object.values(employeeSummary).map((summary: any) => ({
        ...summary,
        total_hours: Math.round(summary.total_hours * 10) / 10, // 小数点第1位まで
        total_amount: Math.round(summary.total_amount), // 円単位に丸める
      }));
      
      return reply.code(200).send(result);
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: '日勤集計の取得に失敗しました' });
    }
  });
  
  // 日勤詳細レポート
  fastify.get('/day/detail', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as { ym?: string; employee_id?: string };
      
      if (!query.ym || !query.employee_id) {
        return reply.code(400).send({ error: '年月と従業員IDパラメータが必要です' });
      }
      
      // 年月から期間を計算
      const year = parseInt(query.ym.split('-')[0]);
      const month = parseInt(query.ym.split('-')[1]);
      const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0];
      const endDate = new Date(year, month, 0).toISOString().split('T')[0];
      
      // 日勤データの取得
      const { data, error } = await supabase
        .from('shifts')
        .select(`
          id,
          work_date,
          start_ts,
          end_ts
        `)
        .eq('duty_type', 'day')
        .eq('employee_id', query.employee_id)
        .gte('work_date', startDate)
        .lte('work_date', endDate)
        .order('work_date');
      
      if (error) {
        throw error;
      }
      
      // 詳細データの作成
      const detailData = data.map((shift) => {
        // 勤務時間の計算
        const startTime = new Date(shift.start_ts);
        const endTime = new Date(shift.end_ts);
        const hours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
        
        // 日勤の支給額計算（時給1,300円）
        const amount = hours * 1300;
        
        return {
          work_date: shift.work_date,
          start_time: startTime.toTimeString().substring(0, 5),
          end_time: endTime.toTimeString().substring(0, 5),
          hours: Math.round(hours * 10) / 10, // 小数点第1位まで
          amount: Math.round(amount), // 円単位に丸める
        };
      });
      
      return reply.code(200).send(detailData);
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: '日勤詳細の取得に失敗しました' });
    }
  });
  
  // 夜勤集計レポート
  fastify.get('/night', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as { ym?: string };
      
      if (!query.ym) {
        return reply.code(400).send({ error: '年月パラメータが必要です' });
      }
      
      // 年月から期間を計算
      const year = parseInt(query.ym.split('-')[0]);
      const month = parseInt(query.ym.split('-')[1]);
      const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0];
      const endDate = new Date(year, month, 0).toISOString().split('T')[0];
      
      // 夜勤データの取得
      const { data, error } = await supabase
        .from('shifts')
        .select(`
          id,
          employee_id,
          employees (
            id,
            name,
            allowance_pct
          ),
          work_date,
          start_ts,
          end_ts
        `)
        .eq('duty_type', 'night')
        .gte('work_date', startDate)
        .lte('work_date', endDate);
      
      if (error) {
        throw error;
      }
      
      // 従業員ごとに集計
      const employeeSummary: Record<string, any> = {};
      
      data.forEach((shift) => {
        const employeeId = shift.employee_id;
        const employeeName = shift.employees?.name || 'Unknown';
        const allowancePct = shift.employees?.allowance_pct || 0;
        
        // 勤務時間の計算
        const startTime = new Date(shift.start_ts);
        const endTime = new Date(shift.end_ts);
        const hours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
        
        // 夜勤の支給額計算
        // 基本賃金（時給1,200円）
        const baseWage = hours * 1200;
        
        // 夜勤手当（固定3,000円/日）
        const nightShiftAllowance = 3000;
        
        // 残業手当（8時間超過分に対して25%割増）
        const overtimeHours = Math.max(0, hours - 8);
        const overtimeAllowance = overtimeHours * 1200 * 0.25;
        
        // 深夜手当（22:00-翌5:00の時間に対して25%割増）
        const nightTimeAllowance = calculateNightTimeAllowance(startTime, endTime);
        
        // 処遇改善加算
        const improvementAllowance = (baseWage + overtimeAllowance + nightTimeAllowance) * (allowancePct / 100);
        
        // 合計支給額
        const totalAmount = baseWage + nightShiftAllowance + overtimeAllowance + nightTimeAllowance + improvementAllowance;
        
        // 従業員サマリーの更新
        if (!employeeSummary[employeeId]) {
          employeeSummary[employeeId] = {
            employee_id: employeeId,
            employee_name: employeeName,
            allowance_pct: allowancePct,
            total_hours: 0,
            total_days: 0,
            total_amount: 0,
          };
        }
        
        employeeSummary[employeeId].total_hours += hours;
        employeeSummary[employeeId].total_days += 1;
        employeeSummary[employeeId].total_amount += totalAmount;
      });
      
      // 結果を配列に変換
      const result = Object.values(employeeSummary).map((summary: any) => ({
        ...summary,
        total_hours: Math.round(summary.total_hours * 10) / 10, // 小数点第1位まで
        total_amount: Math.round(summary.total_amount), // 円単位に丸める
      }));
      
      return reply.code(200).send(result);
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: '夜勤集計の取得に失敗しました' });
    }
  });
  
  // 夜勤詳細レポート
  fastify.get('/night/detail', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as { ym?: string; employee_id?: string };
      
      if (!query.ym || !query.employee_id) {
        return reply.code(400).send({ error: '年月と従業員IDパラメータが必要です' });
      }
      
      // 年月から期間を計算
      const year = parseInt(query.ym.split('-')[0]);
      const month = parseInt(query.ym.split('-')[1]);
      const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0];
      const endDate = new Date(year, month, 0).toISOString().split('T')[0];
      
      // 従業員データの取得
      const { data: employeeData, error: employeeError } = await supabase
        .from('employees')
        .select('allowance_pct')
        .eq('id', query.employee_id)
        .single();
      
      if (employeeError) {
        throw employeeError;
      }
      
      const allowancePct = employeeData.allowance_pct || 0;
      
      // 夜勤データの取得
      const { data, error } = await supabase
        .from('shifts')
        .select(`
          id,
          work_date,
          start_ts,
          end_ts
        `)
        .eq('duty_type', 'night')
        .eq('employee_id', query.employee_id)
        .gte('work_date', startDate)
        .lte('work_date', endDate)
        .order('work_date');
      
      if (error) {
        throw error;
      }
      
      // 詳細データの作成
      const detailData = data.map((shift) => {
        // 勤務時間の計算
        const startTime = new Date(shift.start_ts);
        const endTime = new Date(shift.end_ts);
        const hours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
        
        // 夜勤の支給額計算
        // 基本賃金（時給1,200円）
        const baseWage = hours * 1200;
        
        // 夜勤手当（固定3,000円/日）
        const nightShiftAllowance = 3000;
        
        // 残業手当（8時間超過分に対して25%割増）
        const overtimeHours = Math.max(0, hours - 8);
        const overtimeAllowance = overtimeHours * 1200 * 0.25;
        
        // 深夜手当（22:00-翌5:00の時間に対して25%割増）
        const nightTimeAllowance = calculateNightTimeAllowance(startTime, endTime);
        
        // 処遇改善加算
        const improvementAllowance = (baseWage + overtimeAllowance + nightTimeAllowance) * (allowancePct / 100);
        
        // 合計支給額
        const totalAmount = baseWage + nightShiftAllowance + overtimeAllowance + nightTimeAllowance + improvementAllowance;
        
        return {
          work_date: shift.work_date,
          start_time: startTime.toTimeString().substring(0, 5),
          end_time: endTime.toTimeString().substring(0, 5),
          hours: Math.round(hours * 10) / 10, // 小数点第1位まで
          base_wage: Math.round(baseWage),
          night_shift_allowance: nightShiftAllowance,
          overtime_allowance: Math.round(overtimeAllowance),
          night_time_allowance: Math.round(nightTimeAllowance),
          improvement_allowance: Math.round(improvementAllowance),
          total_amount: Math.round(totalAmount),
        };
      });
      
      return reply.code(200).send(detailData);
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: '夜勤詳細の取得に失敗しました' });
    }
  });
};

// 深夜時間帯（22:00-翌5:00）の手当計算
function calculateNightTimeAllowance(startTime: Date, endTime: Date): number {
  // 深夜時間帯の開始・終了
  const nightStart = new Date(startTime);
  nightStart.setHours(22, 0, 0, 0);
  
  const nightEnd = new Date(startTime);
  nightEnd.setDate(nightEnd.getDate() + 1);
  nightEnd.setHours(5, 0, 0, 0);
  
  // 勤務時間が深夜時間帯と重なる部分を計算
  const overlapStart = startTime > nightStart ? startTime : nightStart;
  const overlapEnd = endTime < nightEnd ? endTime : nightEnd;
  
  // 重なる時間（秒）
  let overlapSeconds = 0;
  
  if (overlapEnd > overlapStart) {
    overlapSeconds = (overlapEnd.getTime() - overlapStart.getTime()) / 1000;
  }
  
  // 深夜時間（時間）
  const nightHours = overlapSeconds / 3600;
  
  // 深夜手当（時給1,200円の25%割増）
  return nightHours * 1200 * 0.25;
}