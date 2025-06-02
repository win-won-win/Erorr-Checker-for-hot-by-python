import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Clock, Calendar, Users } from 'lucide-react';

const Header: React.FC = () => {
  const location = useLocation();
  
  return (
    <header className="bg-gradient-to-r from-blue-600 to-blue-800 text-white shadow-md">
      <div className="container mx-auto px-4 py-4">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <Link to="/" className="text-2xl font-bold flex items-center mb-4 md:mb-0">
            <Clock className="mr-2" size={28} />
            <span>勤務管理システム</span>
          </Link>
          
          <nav className="flex space-x-1 md:space-x-4">
            <NavLink to="/" current={location.pathname === '/'}>
              <Calendar size={18} className="mr-1" />
              <span>勤務登録</span>
            </NavLink>
            <NavLink to="/day-shift" current={location.pathname === '/day-shift'}>
              <Users size={18} className="mr-1" />
              <span>日勤計算</span>
            </NavLink>
            <NavLink to="/night-shift" current={location.pathname === '/night-shift'}>
              <Users size={18} className="mr-1" />
              <span>夜勤計算</span>
            </NavLink>
          </nav>
        </div>
      </div>
    </header>
  );
};

interface NavLinkProps {
  to: string;
  current: boolean;
  children: React.ReactNode;
}

const NavLink: React.FC<NavLinkProps> = ({ to, current, children }) => {
  return (
    <Link 
      to={to}
      className={`
        px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200
        flex items-center
        ${current 
          ? 'bg-white text-blue-800' 
          : 'text-blue-100 hover:bg-blue-700 hover:text-white'}
      `}
    >
      {children}
    </Link>
  );
};

export default Header;