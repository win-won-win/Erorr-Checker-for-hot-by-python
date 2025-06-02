import { useState, useEffect } from 'react';
import { employeesApi } from '../api/client';

// 従業員の型定義
interface Employee {
  id: string;
  name: string;
  allowance_pct: number;
  display_start: string;
  display_end: string;
  deleted_at: string | null;
}

// モーダルの状態を管理する型
type ModalState = {
  isOpen: boolean;
  mode: 'create' | 'edit';
  employee: Employee | null;
};

const EmployeeManagement = () => {
  // 状態管理
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [showDeleted, setShowDeleted] = useState<boolean>(false);
  const [modalState, setModalState] = useState<ModalState>({
    isOpen: false,
    mode: 'create',
    employee: null,
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // 従業員データの取得
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        setIsLoading(true);
        const data = await employeesApi.getAll(showDeleted);
        setEmployees(data);
        setError(null);
      } catch (err: any) {
        console.error('従業員データの取得に失敗しました:', err);
        setError(err.message || '従業員データの取得に失敗しました');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchEmployees();
  }, [showDeleted]);
  
  // 表示する従業員のフィルタリング
  const filteredEmployees = employees.filter(employee => {
    if (showDeleted) {
      return true;
    }
    return employee.deleted_at === null;
  });
  
  // 新規登録モーダルを開く
  const openCreateModal = () => {
    setModalState({
      isOpen: true,
      mode: 'create',
      employee: null,
    });
  };
  
  // 編集モーダルを開く
  const openEditModal = (employee: Employee) => {
    setModalState({
      isOpen: true,
      mode: 'edit',
      employee,
    });
  };
  
  // モーダルを閉じる
  const closeModal = () => {
    setModalState({
      ...modalState,
      isOpen: false,
    });
  };
  
  // 従業員を削除する
  const handleDelete = async (id: string) => {
    if (window.confirm('この従業員を削除しますか？')) {
      try {
        setIsLoading(true);
        await employeesApi.delete(id);
        
        // 成功したら従業員リストを更新
        const updatedEmployees = employees.map(emp => {
          if (emp.id === id) {
            return {
              ...emp,
              deleted_at: new Date().toISOString(),
            };
          }
          return emp;
        });
        
        setEmployees(updatedEmployees);
        setError(null);
      } catch (err: any) {
        console.error('従業員の削除に失敗しました:', err);
        setError(err.message || '従業員の削除に失敗しました');
      } finally {
        setIsLoading(false);
      }
    }
  };
  
  // 従業員フォームの送信処理
  const handleSubmit = async (formData: Omit<Employee, 'id' | 'deleted_at'>) => {
    try {
      setIsLoading(true);
      
      if (modalState.mode === 'create') {
        // 新規作成の場合
        const newEmployee = await employeesApi.create(formData);
        setEmployees([...employees, newEmployee]);
      } else if (modalState.mode === 'edit' && modalState.employee) {
        // 編集の場合
        const updatedEmployee = await employeesApi.update(
          modalState.employee.id,
          formData
        );
        
        // 従業員リストを更新
        const updatedEmployees = employees.map(emp => {
          if (emp.id === updatedEmployee.id) {
            return updatedEmployee;
          }
          return emp;
        });
        
        setEmployees(updatedEmployees);
      }
      
      setError(null);
      // モーダルを閉じる
      closeModal();
    } catch (err: any) {
      console.error('従業員データの保存に失敗しました:', err);
      setError(err.message || '従業員データの保存に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">従業員管理</h2>
        <div className="flex items-center space-x-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={showDeleted}
              onChange={() => setShowDeleted(!showDeleted)}
              className="mr-2"
            />
            退職者を含む
          </label>
          <button
            onClick={openCreateModal}
            className="btn btn-primary"
            disabled={isLoading}
          >
            新規登録
          </button>
        </div>
      </div>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      {isLoading ? (
        <div className="text-center py-8">読み込み中...</div>
      ) : filteredEmployees.length === 0 ? (
        <div className="text-center py-8">従業員データがありません</div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>従業員名</th>
              <th>処遇改善加算%</th>
              <th>表示開始月</th>
              <th>表示終了月</th>
              <th>状態</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredEmployees.map((employee) => (
              <tr key={employee.id}>
                <td>{employee.name}</td>
                <td>{employee.allowance_pct}%</td>
                <td>{new Date(employee.display_start).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long' })}</td>
                <td>{new Date(employee.display_end).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long' })}</td>
                <td>
                  {employee.deleted_at ? (
                    <span className="text-red-500">退職</span>
                  ) : (
                    <span className="text-green-500">在籍中</span>
                  )}
                </td>
                <td>
                  <button
                    onClick={() => openEditModal(employee)}
                    className="btn btn-secondary mr-2"
                    disabled={!!employee.deleted_at || isLoading}
                  >
                    編集
                  </button>
                  <button
                    onClick={() => handleDelete(employee.id)}
                    className="btn btn-danger"
                    disabled={!!employee.deleted_at || isLoading}
                  >
                    削除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      
      {/* 従業員モーダル */}
      {modalState.isOpen && (
        <EmployeeModal
          mode={modalState.mode}
          employee={modalState.employee}
          onClose={closeModal}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
};

// 従業員モーダルコンポーネント
interface EmployeeModalProps {
  mode: 'create' | 'edit';
  employee: Employee | null;
  onClose: () => void;
  onSubmit: (formData: Omit<Employee, 'id' | 'deleted_at'>) => void;
}

const EmployeeModal = ({ mode, employee, onClose, onSubmit }: EmployeeModalProps) => {
  // フォームの状態
  const [name, setName] = useState<string>(employee?.name || '');
  const [allowancePct, setAllowancePct] = useState<number>(employee?.allowance_pct || 0);
  const [displayStart, setDisplayStart] = useState<string>(
    employee?.display_start || new Date().toISOString().split('T')[0]
  );
  const [displayEnd, setDisplayEnd] = useState<string>(
    employee?.display_end || new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0]
  );
  
  // フォーム送信処理
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    onSubmit({
      name,
      allowance_pct: allowancePct,
      display_start: displayStart,
      display_end: displayEnd,
    });
  };
  
  return (
    <div className="modal-backdrop">
      <div className="modal-content">
        <div className="modal-header">
          <h3 className="modal-title">
            {mode === 'create' ? '従業員新規登録' : '従業員編集'}
          </h3>
          <button onClick={onClose} className="modal-close">&times;</button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="name" className="required">従業員名</label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-2 border rounded"
              required
            />
          </div>
          
          <div className="form-field">
            <label htmlFor="allowancePct" className="required">処遇改善加算%</label>
            <input
              type="number"
              id="allowancePct"
              value={allowancePct}
              onChange={(e) => setAllowancePct(Number(e.target.value))}
              min="0"
              max="100"
              className="w-full p-2 border rounded"
              required
            />
          </div>
          
          <div className="form-field">
            <label htmlFor="displayStart" className="required">表示開始月</label>
            <input
              type="date"
              id="displayStart"
              value={displayStart}
              onChange={(e) => setDisplayStart(e.target.value)}
              className="w-full p-2 border rounded"
              required
            />
          </div>
          
          <div className="form-field">
            <label htmlFor="displayEnd" className="required">表示終了月</label>
            <input
              type="date"
              id="displayEnd"
              value={displayEnd}
              onChange={(e) => setDisplayEnd(e.target.value)}
              className="w-full p-2 border rounded"
              required
            />
          </div>
          
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              キャンセル
            </button>
            <button type="submit" className="btn btn-primary">
              保存
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EmployeeManagement;