import React, { useState, useEffect } from 'react';
import { FileText, Upload, Settings, Calendar, ClipboardList, CheckCircle, Clock, User, Users } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface LayoutProps {
  children: React.ReactNode;
  currentView: 'front' | 'back';
  onViewChange: (view: 'front' | 'back') => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function Layout({ children, currentView, onViewChange, activeTab, onTabChange }: LayoutProps) {
  const [secretClickCount, setSecretClickCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);

  // 自動接続チェック
  useEffect(() => {
    const checkConnection = async () => {
      if (isSupabaseConfigured()) {
        try {
          const { data, error } = await supabase.from('users').select('count').limit(1);
          if (!error) {
            setIsConnected(true);
          }
        } catch (error) {
          console.log('データベース接続確認中:', error);
        }
      }
    };
    
    checkConnection();
  }, []);

  const handleLogoClick = () => {
    setSecretClickCount(prev => prev + 1);
    if (secretClickCount >= 4) {
      onViewChange(currentView === 'front' ? 'back' : 'front');
      setSecretClickCount(0);
    }
    
    // 3秒後にカウントをリセット
    setTimeout(() => setSecretClickCount(0), 3000);
  };

  const frontTabs = [
    { id: 'dashboard', label: 'ダッシュボード', icon: Calendar },
    { id: 'schedules', label: '予定管理', icon: Calendar },
    { id: 'records', label: '記録入力', icon: ClipboardList },
    { id: 'record-list', label: '記録一覧', icon: FileText }
  ];

  const backTabs = [
    { id: 'monthly-data', label: '月別データ管理', icon: Calendar },
    { id: 'pattern-management', label: 'パターン管理', icon: Settings },
    { id: 'weekly-pattern-creation', label: '週間パターン作成', icon: Clock },
    { id: 'user-health-baselines', label: '利用者健康基準値', icon: User },
    { id: 'staff-master', label: '従業員マスタ管理', icon: Users },
  ];

  const currentTabs = currentView === 'front' ? frontTabs : backTabs;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <button
                onClick={handleLogoClick}
                className="flex items-center space-x-2 text-indigo-600 hover:text-indigo-700 transition-colors"
              >
                <FileText className="h-8 w-8" />
                <div>
                  <h1 className="text-xl font-bold">介護記録管理システム</h1>
                  <p className="text-xs text-gray-500">
                    {currentView === 'front' ? '記録作成モード' : 'CSV一括処理モード'}
                  </p>
                </div>
              </button>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-500">
                さくらケアサービス
              </div>
              {isConnected && (
                <div className="flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  <CheckCircle className="h-3 w-3" />
                  <span>DB接続済み</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* タブナビゲーション */}
      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {currentTabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* メインコンテンツ */}
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {children}
      </main>

    </div>
  );
}