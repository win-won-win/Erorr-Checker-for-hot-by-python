import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { saveShiftToNotion, fetchShiftsForMonth, fetchEmployees, saveEmployee } from './services/notionService';
import { ShiftEntry, Employee } from './types';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// ミドルウェアの設定
app.use(cors());
app.use(express.json());

// シフトを保存するエンドポイント
app.post('/api/notion/v1/pages', async (req, res) => {
  try {
    const shiftData: ShiftEntry = {
      ...req.body,
      開始時間: new Date(req.body['Start Time'] || req.body.開始時間),
      終了時間: new Date(req.body['End Time'] || req.body.終了時間)
    };
    const savedShift = await saveShiftToNotion(shiftData);
    res.json(savedShift);
  } catch (error) {
    console.error('Error saving shift:', error);
    res.status(500).json({ message: 'シフトの保存中にエラーが発生しました。' });
  }
});

// 特定の月のシフトを取得するエンドポイント
app.post('/api/notion/v1/databases/:databaseId/query', async (req, res) => {
  try {
    const { year, month } = req.body;
    const shifts = await fetchShiftsForMonth(year, month);
    
    // シフトデータの日付を適切な形式に変換
    const formattedShifts = shifts.map(shift => ({
      ...shift,
      開始時間: shift.開始時間.toISOString(),
      終了時間: shift.終了時間.toISOString()
    }));
    
    console.log('Sending formatted shifts:', formattedShifts);
    res.json({ results: formattedShifts });
  } catch (error) {
    console.error('Error fetching shifts:', error);
    res.status(500).json({ message: 'シフトデータの取得中にエラーが発生しました。' });
  }
});

// 従業員一覧を取得するエンドポイント
app.get('/api/notion/v1/employees', async (req, res) => {
  try {
    const employees = await fetchEmployees();
    res.json(employees);
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({ message: '従業員データの取得中にエラーが発生しました。' });
  }
});

// 従業員を保存するエンドポイント
app.post('/api/notion/v1/employees', async (req, res) => {
  try {
    const employeeData: Employee = req.body;
    const savedEmployee = await saveEmployee(employeeData);
    res.json(savedEmployee);
  } catch (error) {
    console.error('Error saving employee:', error);
    res.status(500).json({ message: '従業員データの保存中にエラーが発生しました。' });
  }
});

app.listen(port, () => {
  console.log(`バックエンドサーバーが起動しました: http://localhost:${port}`);
});