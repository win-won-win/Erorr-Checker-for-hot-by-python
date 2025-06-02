import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  FormControl,
  FormControlLabel,
  FormLabel,
  Grid,
  InputLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import type { Employee, EmployeeInput } from '../types/employee';

interface EmployeeFormProps {
  employee?: Employee;
  onSubmit: (data: EmployeeInput) => Promise<void>;
  isLoading?: boolean;
}

const defaultSalary = {
  base: 0,
  hourlyRate: 0,
  allowances: [],
};

const defaultTaxInfo = {
  taxCategory: 'A',
  dependents: 0,
  socialInsurance: true,
};

const defaultBankInfo = {
  bankName: '',
  branchName: '',
  accountType: 'SAVINGS' as const,
  accountNumber: '',
  accountHolder: '',
};

const initialState: EmployeeInput = {
  firstName: '',
  lastName: '',
  email: '',
  employeeCode: '',
  department: '',
  position: '',
  employmentType: 'FULL_TIME',
  startDate: '',
  salary: defaultSalary,
  taxInfo: defaultTaxInfo,
  bankInfo: defaultBankInfo,
};

const EmployeeForm = ({ employee, onSubmit, isLoading = false }: EmployeeFormProps) => {
  const [formData, setFormData] = useState<EmployeeInput>(initialState);

  useEffect(() => {
    if (employee) {
      setFormData(employee);
    }
  }, [employee]);

  const handleChange = (field: keyof EmployeeInput, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleNestedChange = (parent: keyof EmployeeInput, field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [parent]: {
        ...(prev[parent] as any),
        [field]: value,
      },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(formData);
  };

  return (
    <Box component="form" onSubmit={handleSubmit}>
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Typography variant="h6" component="h2">基本情報</Typography>
        </Grid>

        <Grid item xs={12} sm={6}>
          <TextField
            required
            fullWidth
            label="姓"
            value={formData.lastName}
            onChange={(e) => handleChange('lastName', e.target.value)}
          />
        </Grid>

        <Grid item xs={12} sm={6}>
          <TextField
            required
            fullWidth
            label="名"
            value={formData.firstName}
            onChange={(e) => handleChange('firstName', e.target.value)}
          />
        </Grid>

        <Grid item xs={12}>
          <TextField
            required
            fullWidth
            type="email"
            label="メールアドレス"
            value={formData.email}
            onChange={(e) => handleChange('email', e.target.value)}
          />
        </Grid>

        <Grid item xs={12}>
          <TextField
            required
            fullWidth
            label="従業員コード"
            value={formData.employeeCode}
            onChange={(e) => handleChange('employeeCode', e.target.value)}
          />
        </Grid>

        <Grid item xs={12} sm={6}>
          <TextField
            required
            fullWidth
            label="部署"
            value={formData.department}
            onChange={(e) => handleChange('department', e.target.value)}
          />
        </Grid>

        <Grid item xs={12} sm={6}>
          <TextField
            required
            fullWidth
            label="役職"
            value={formData.position}
            onChange={(e) => handleChange('position', e.target.value)}
          />
        </Grid>

        <Grid item xs={12}>
          <FormControl>
            <FormLabel>雇用形態</FormLabel>
            <RadioGroup
              row
              value={formData.employmentType}
              onChange={(e) => handleChange('employmentType', e.target.value)}
            >
              <FormControlLabel
                value="FULL_TIME"
                control={<Radio />}
                label="正社員"
              />
              <FormControlLabel
                value="PART_TIME"
                control={<Radio />}
                label="パートタイム"
              />
              <FormControlLabel
                value="CONTRACT"
                control={<Radio />}
                label="契約社員"
              />
            </RadioGroup>
          </FormControl>
        </Grid>

        <Grid item xs={12}>
          <TextField
            required
            fullWidth
            type="date"
            label="入社日"
            value={formData.startDate}
            onChange={(e) => handleChange('startDate', e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
        </Grid>

        <Grid item xs={12}>
          <Typography variant="h6" component="h2">給与情報</Typography>
        </Grid>

        <Grid item xs={12} sm={6}>
          <TextField
            required
            fullWidth
            type="number"
            label="基本給"
            value={formData.salary?.base ?? 0}
            onChange={(e) =>
              handleNestedChange('salary', 'base', Number(e.target.value))
            }
          />
        </Grid>

        {formData.employmentType !== 'FULL_TIME' && (
          <Grid item xs={12} sm={6}>
            <TextField
              required
              fullWidth
              type="number"
              label="時給"
              value={formData.salary?.hourlyRate ?? 0}
              onChange={(e) =>
                handleNestedChange('salary', 'hourlyRate', Number(e.target.value))
              }
            />
          </Grid>
        )}

        <Grid item xs={12}>
          <Typography variant="h6" component="h2">税務情報</Typography>
        </Grid>

        <Grid item xs={12} sm={6}>
          <FormControl fullWidth>
            <InputLabel>税区分</InputLabel>
            <Select
              value={formData.taxInfo?.taxCategory ?? 'A'}
              label="税区分"
              onChange={(e) =>
                handleNestedChange('taxInfo', 'taxCategory', e.target.value)
              }
            >
              <MenuItem value="A">甲</MenuItem>
              <MenuItem value="B">乙</MenuItem>
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={12} sm={6}>
          <TextField
            required
            fullWidth
            type="number"
            label="扶養人数"
            value={formData.taxInfo?.dependents ?? 0}
            onChange={(e) =>
              handleNestedChange('taxInfo', 'dependents', Number(e.target.value))
            }
          />
        </Grid>

        <Grid item xs={12}>
          <FormControlLabel
            control={
              <Radio
                checked={formData.taxInfo?.socialInsurance ?? true}
                onChange={(e) =>
                  handleNestedChange(
                    'taxInfo',
                    'socialInsurance',
                    e.target.checked
                  )
                }
              />
            }
            label="社会保険加入"
          />
        </Grid>

        <Grid item xs={12}>
          <Typography variant="h6" component="h2">振込口座情報</Typography>
        </Grid>

        <Grid item xs={12} sm={6}>
          <TextField
            required
            fullWidth
            label="銀行名"
            value={formData.bankInfo?.bankName ?? ''}
            onChange={(e) =>
              handleNestedChange('bankInfo', 'bankName', e.target.value)
            }
          />
        </Grid>

        <Grid item xs={12} sm={6}>
          <TextField
            required
            fullWidth
            label="支店名"
            value={formData.bankInfo?.branchName ?? ''}
            onChange={(e) =>
              handleNestedChange('bankInfo', 'branchName', e.target.value)
            }
          />
        </Grid>

        <Grid item xs={12} sm={6}>
          <FormControl fullWidth>
            <InputLabel>口座種別</InputLabel>
            <Select
              value={formData.bankInfo?.accountType ?? 'SAVINGS'}
              label="口座種別"
              onChange={(e) =>
                handleNestedChange('bankInfo', 'accountType', e.target.value)
              }
            >
              <MenuItem value="SAVINGS">普通</MenuItem>
              <MenuItem value="CHECKING">当座</MenuItem>
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={12} sm={6}>
          <TextField
            required
            fullWidth
            label="口座番号"
            value={formData.bankInfo?.accountNumber ?? ''}
            onChange={(e) =>
              handleNestedChange('bankInfo', 'accountNumber', e.target.value)
            }
          />
        </Grid>

        <Grid item xs={12}>
          <TextField
            required
            fullWidth
            label="口座名義"
            value={formData.bankInfo?.accountHolder ?? ''}
            onChange={(e) =>
              handleNestedChange('bankInfo', 'accountHolder', e.target.value)
            }
          />
        </Grid>

        <Grid item xs={12}>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
            <Button
              type="submit"
              variant="contained"
              disabled={isLoading}
            >
              {employee ? '更新' : '登録'}
            </Button>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
};

export default EmployeeForm;