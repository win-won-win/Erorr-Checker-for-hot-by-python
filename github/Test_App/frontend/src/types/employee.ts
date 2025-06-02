export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  employeeCode: string;
  department: string;
  position: string;
  employmentType: 'FULL_TIME' | 'PART_TIME' | 'CONTRACT';
  startDate: string;
  salary?: {
    base: number;
    hourlyRate?: number;
    allowances: {
      type: string;
      amount: number;
    }[];
  };
  taxInfo: {
    taxCategory: string;
    dependents: number;
    socialInsurance: boolean;
  };
  bankInfo: {
    bankName: string;
    branchName: string;
    accountType: 'SAVINGS' | 'CHECKING';
    accountNumber: string;
    accountHolder: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeInput extends Omit<Employee, 'id' | 'createdAt' | 'updatedAt'> {}

export interface SalaryCalculation {
  employeeId: string;
  year: number;
  month: number;
  baseSalary: number;
  overtimePay: number;
  allowances: {
    type: string;
    amount: number;
  }[];
  deductions: {
    type: string;
    amount: number;
  }[];
  grossPay: number;
  netPay: number;
  taxDeductions: {
    incomeTax: number;
    residentTax: number;
    healthInsurance: number;
    pensionInsurance: number;
    employmentInsurance: number;
  };
  calculatedAt: string;
}