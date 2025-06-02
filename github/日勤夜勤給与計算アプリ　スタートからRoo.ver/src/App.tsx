import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import './styles/App.css'
import { auth } from './utils/supabase'

// レイアウトコンポーネント
import Layout from './components/Layout'

// ページコンポーネント
import AttendanceForm from './pages/AttendanceForm'
import EmployeeManagement from './pages/EmployeeManagement'
import DayShiftReport from './pages/DayShiftReport'
import NightShiftReport from './pages/NightShiftReport'
import ClosePeriod from './pages/ClosePeriod'
import Login from './pages/Login'
import NotFound from './pages/NotFound'

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // 認証状態の監視
  useEffect(() => {
    const checkAuth = async () => {
      const { data } = await auth.getSession();
      setIsAuthenticated(!!data.session);
      setIsLoading(false);
    };

    // 初期認証状態の確認
    checkAuth();

    // 認証状態の変更を監視
    const { data: authListener } = auth.onAuthStateChange((event, session) => {
      setIsAuthenticated(!!session);
    });

    // クリーンアップ
    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // 認証状態の管理
  const handleLogin = () => {
    setIsAuthenticated(true)
  }

  const handleLogout = async () => {
    await auth.signOut();
    setIsAuthenticated(false)
  }

  // ローディング中の表示
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">読み込み中...</div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route path="/login" element={
          isAuthenticated
            ? <Navigate to="/attendance/new" replace />
            : <Login onLogin={handleLogin} />
        } />
        
        <Route path="/" element={
          isAuthenticated
            ? <Layout onLogout={handleLogout} />
            : <Navigate to="/login" replace />
        }>
          <Route index element={<Navigate to="/attendance/new" replace />} />
          <Route path="attendance/new" element={<AttendanceForm />} />
          <Route path="employees" element={<EmployeeManagement />} />
          <Route path="reports/day" element={<DayShiftReport />} />
          <Route path="reports/night" element={<NightShiftReport />} />
          <Route path="close-period" element={<ClosePeriod />} />
        </Route>
        
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  )
}

export default App