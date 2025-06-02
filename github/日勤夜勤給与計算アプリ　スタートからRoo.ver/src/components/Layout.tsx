import { ReactNode } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';

interface LayoutProps {
  onLogout: () => void;
}

const Layout = ({ onLogout }: LayoutProps) => {
  const location = useLocation();
  
  // 現在のパスがアクティブかどうかを判定する関数
  const isActive = (path: string) => {
    return location.pathname.startsWith(path);
  };

  return (
    <div className="layout">
      {/* サイドバー */}
      <div className="sidebar">
        <div className="sidebar-logo">給与集計アプリ</div>
        <ul className="sidebar-menu">
          <li>
            <Link 
              to="/attendance/new" 
              className={isActive('/attendance') ? 'active' : ''}
            >
              勤怠登録
            </Link>
          </li>
          <li>
            <Link 
              to="/employees" 
              className={isActive('/employees') ? 'active' : ''}
            >
              従業員管理
            </Link>
          </li>
          <li>
            <Link 
              to="/reports/day" 
              className={isActive('/reports/day') ? 'active' : ''}
            >
              日勤集計
            </Link>
          </li>
          <li>
            <Link 
              to="/reports/night" 
              className={isActive('/reports/night') ? 'active' : ''}
            >
              夜勤集計
            </Link>
          </li>
          <li>
            <Link 
              to="/close-period" 
              className={isActive('/close-period') ? 'active' : ''}
            >
              締め処理
            </Link>
          </li>
        </ul>
      </div>

      {/* メインコンテンツ */}
      <div className="flex flex-col flex-1">
        {/* ヘッダー */}
        <header className="header">
          <h1 className="text-xl font-bold">
            {location.pathname.includes('attendance') && '勤怠登録'}
            {location.pathname.includes('employees') && '従業員管理'}
            {location.pathname.includes('reports/day') && '日勤集計'}
            {location.pathname.includes('reports/night') && '夜勤集計'}
            {location.pathname.includes('close-period') && '締め処理'}
          </h1>
          <div className="user-menu">
            <span>ユーザー名</span>
            <button 
              onClick={onLogout}
              className="btn btn-secondary"
            >
              ログアウト
            </button>
          </div>
        </header>

        {/* コンテンツエリア */}
        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;