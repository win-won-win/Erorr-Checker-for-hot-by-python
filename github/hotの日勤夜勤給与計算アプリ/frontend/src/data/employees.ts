import { Employee } from '../types';
import { fetchEmployees } from '../services/notionService';

let cachedEmployees: Employee[] = [];

export const getEmployees = async (): Promise<Employee[]> => {
  if (cachedEmployees.length === 0) {
    try {
      cachedEmployees = await fetchEmployees();
    } catch (error) {
      console.error('従業員データの取得に失敗しました:', error);
      return [];
    }
  }
  return cachedEmployees;
};

export const getEmployeeById = async (id: string): Promise<Employee | undefined> => {
  const employees = await getEmployees();
  return employees.find(employee => employee.id === id);
};

export const getEmployeeByName = async (従業員名: string): Promise<Employee | undefined> => {
  const employees = await getEmployees();
  return employees.find(employee => employee.従業員名 === 従業員名);
};

export const refreshEmployees = async (): Promise<void> => {
  try {
    cachedEmployees = await fetchEmployees();
  } catch (error) {
    console.error('従業員データの更新に失敗しました:', error);
  }
};