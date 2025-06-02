import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { theme } from './utils/theme';
import Layout from './components/Layout';
import EmployeeList from './pages/EmployeeList';
import EmployeeCreate from './pages/EmployeeCreate';
import EmployeeEdit from './pages/EmployeeEdit';
import EmployeeDetail from './pages/EmployeeDetail';
import SalaryCalculation from './pages/SalaryCalculation';

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<EmployeeList />} />
            <Route path="/employees/new" element={<EmployeeCreate />} />
            <Route path="/employees/:id" element={<EmployeeDetail />} />
            <Route path="/employees/:id/edit" element={<EmployeeEdit />} />
            <Route path="/employees/:id/salary" element={<SalaryCalculation />} />
          </Routes>
        </Layout>
      </Router>
    </ThemeProvider>
  );
}

export default App;
