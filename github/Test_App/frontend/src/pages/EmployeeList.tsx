import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import CalculateIcon from '@mui/icons-material/Calculate';
import { employeeApi } from '../services/supabase';
import type { Employee } from '../types/employee';

const EmployeeList = () => {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<Employee[]>([]);

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const data = await employeeApi.getEmployees();
      setEmployees(data);
    } catch (error) {
      console.error('従業員データの取得に失敗しました:', error);
      // TODO: エラー処理の実装
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('この従業員を削除してもよろしいですか？')) {
      return;
    }

    try {
      await employeeApi.deleteEmployee(id);
      await fetchEmployees();
    } catch (error) {
      console.error('従業員の削除に失敗しました:', error);
      // TODO: エラー処理の実装
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4" component="h1">
          従業員一覧
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/employees/new')}
        >
          新規登録
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>従業員コード</TableCell>
              <TableCell>氏名</TableCell>
              <TableCell>部署</TableCell>
              <TableCell>役職</TableCell>
              <TableCell>雇用形態</TableCell>
              <TableCell>操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {employees.map((employee) => (
              <TableRow key={employee.id}>
                <TableCell>{employee.employeeCode}</TableCell>
                <TableCell>
                  {employee.lastName} {employee.firstName}
                </TableCell>
                <TableCell>{employee.department}</TableCell>
                <TableCell>{employee.position}</TableCell>
                <TableCell>
                  {employee.employmentType === 'FULL_TIME'
                    ? '正社員'
                    : employee.employmentType === 'PART_TIME'
                    ? 'パートタイム'
                    : '契約社員'}
                </TableCell>
                <TableCell>
                  <IconButton
                    color="primary"
                    onClick={() => navigate(`/employees/${employee.id}`)}
                  >
                    <EditIcon />
                  </IconButton>
                  <IconButton
                    color="error"
                    onClick={() => handleDelete(employee.id)}
                  >
                    <DeleteIcon />
                  </IconButton>
                  <IconButton
                    color="success"
                    onClick={() => navigate(`/employees/${employee.id}/salary`)}
                  >
                    <CalculateIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default EmployeeList;