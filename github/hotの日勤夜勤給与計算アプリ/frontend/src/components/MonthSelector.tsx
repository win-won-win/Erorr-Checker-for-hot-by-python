import React from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';

interface MonthSelectorProps {
  year: string;
  month: string;
  onYearChange: (year: string) => void;
  onMonthChange: (month: string) => void;
}

const MonthSelector: React.FC<MonthSelectorProps> = ({
  year,
  month,
  onYearChange,
  onMonthChange
}) => {
  // Generate years (current year - 2 to current year + 1)
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 4 }, (_, i) => String(currentYear - 2 + i));
  
  // Months array for dropdown
  const months = [
    { value: '01', label: '1月' },
    { value: '02', label: '2月' },
    { value: '03', label: '3月' },
    { value: '04', label: '4月' },
    { value: '05', label: '5月' },
    { value: '06', label: '6月' },
    { value: '07', label: '7月' },
    { value: '08', label: '8月' },
    { value: '09', label: '9月' },
    { value: '10', label: '10月' },
    { value: '11', label: '11月' },
    { value: '12', label: '12月' },
  ];
  
  // Handler for previous month
  const handlePrevMonth = () => {
    let newMonth = String(parseInt(month) - 1).padStart(2, '0');
    let newYear = year;
    
    if (newMonth === '00') {
      newMonth = '12';
      newYear = String(parseInt(year) - 1);
    }
    
    onMonthChange(newMonth);
    onYearChange(newYear);
  };
  
  // Handler for next month
  const handleNextMonth = () => {
    let newMonth = String(parseInt(month) + 1).padStart(2, '0');
    let newYear = year;
    
    if (newMonth === '13') {
      newMonth = '01';
      newYear = String(parseInt(year) + 1);
    }
    
    onMonthChange(newMonth);
    onYearChange(newYear);
  };

  return (
    <div className="flex items-center justify-between bg-blue-50 p-3 rounded-lg shadow-sm mb-6">
      <button 
        onClick={handlePrevMonth}
        className="p-2 rounded-full hover:bg-blue-200 transition-colors duration-200"
        aria-label="Previous month"
      >
        <ChevronLeft size={20} />
      </button>
      
      <div className="flex items-center space-x-2">
        <Calendar size={18} className="text-blue-600" />
        
        <select
          value={year}
          onChange={(e) => onYearChange(e.target.value)}
          className="px-2 py-1 bg-white border border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}年
            </option>
          ))}
        </select>
        
        <select
          value={month}
          onChange={(e) => onMonthChange(e.target.value)}
          className="px-2 py-1 bg-white border border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
        >
          {months.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </div>
      
      <button 
        onClick={handleNextMonth}
        className="p-2 rounded-full hover:bg-blue-200 transition-colors duration-200"
        aria-label="Next month"
      >
        <ChevronRight size={20} />
      </button>
    </div>
  );
};

export default MonthSelector;