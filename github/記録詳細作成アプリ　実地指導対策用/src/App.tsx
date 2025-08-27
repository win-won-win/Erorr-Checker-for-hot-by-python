import React from 'react';
import { useState } from 'react';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { ScheduleManagement } from './components/ScheduleManagement';
import { ServiceRecordForm } from './components/ServiceRecordForm';
import { RecordList } from './components/RecordList';
import { PatternManagement } from './components/PatternManagement';
import { MonthlyDataManagement } from './components/MonthlyDataManagement';
import { WeeklyPatternCreation } from './components/WeeklyPatternCreation';
import UserHealthBaselines from './components/UserHealthBaselines';
import StaffMaster from './components/StaffMaster';

function App() {
  const [currentView, setCurrentView] = useState<'front' | 'back'>('front');
  const [activeTab, setActiveTab] = useState('dashboard');

  const renderContent = () => {
    if (currentView === 'front') {
      switch (activeTab) {
        case 'dashboard':
          return <Dashboard />;
        case 'schedules':
          return <ScheduleManagement />;
        case 'records':
          return <ServiceRecordForm />;
        case 'record-list':
          return <RecordList />;
        default:
          return <Dashboard />;
      }
    } else {
      switch (activeTab) {
        case 'monthly-data':
          return <MonthlyDataManagement />;
        case 'pattern-management':
          return <PatternManagement />;
        case 'weekly-pattern-creation':
          return <WeeklyPatternCreation />;
        case 'user-health-baselines':
          return <UserHealthBaselines />;
        case 'staff-master':
          return <StaffMaster />;
        default:
          return <MonthlyDataManagement />;
      }
    }
  };

  return (
    <Layout
      currentView={currentView}
      onViewChange={setCurrentView}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    >
      {renderContent()}
    </Layout>
  );
}

export default App;
