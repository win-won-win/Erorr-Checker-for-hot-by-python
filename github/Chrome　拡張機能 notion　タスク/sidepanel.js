// ローカルキャッシュ
let tasksCache = [];

// タスク一覧を取得する関数
async function fetchTasks(sorts = null, forceRefresh = false) {
  try {
    console.time('fetchTasks');
    console.log('Sidepanel: Requesting tasks from background...');
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        type: 'fetchTasks',
        sorts,
        forceRefresh
      }, response => {
        if (response.success) {
          console.log(`Sidepanel: Received tasks (${response.fromCache ? 'from cache' : 'from API'}):`);
          console.timeEnd('fetchTasks');
          // ローカルキャッシュを更新
          tasksCache = response.data;
          resolve(response.data);
        } else {
          console.error('Sidepanel: Error:', response.error);
          console.timeEnd('fetchTasks');
          reject(new Error(response.error));
        }
      });
    });
  } catch (error) {
    console.error('Sidepanel: Error fetching tasks:', error);
    console.timeEnd('fetchTasks');
    return [];
  }
}

// ローカルキャッシュからタスクを取得する関数
function getTaskFromCache(taskId) {
  return tasksCache.find(task => task.id === taskId);
}

// ローカルキャッシュを更新する関数
function updateTaskInCache(taskId, updatedTask) {
  const index = tasksCache.findIndex(task => task.id === taskId);
  if (index !== -1) {
    tasksCache[index] = updatedTask;
  }
}

// ローカルキャッシュからタスクを削除する関数
function deleteTaskFromCache(taskId) {
  const index = tasksCache.findIndex(task => task.id === taskId);
  if (index !== -1) {
    tasksCache.splice(index, 1);
  }
}

// キャッシュをクリアする関数
function clearCache() {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type: 'clearCache' }, response => {
      if (response.success) {
        console.log('Sidepanel: Cache cleared');
        resolve();
      } else {
        console.error('Sidepanel: Error clearing cache:', response.error);
        reject(new Error(response.error));
      }
    });
  });
}

// 現在の表示モードを追跡する変数
let currentViewMode = 'all'; // 'all', 'today', または 'search'

// タスクを更新する関数
async function updateTask(taskId, taskData) {
  try {
    console.log('Updating task:', taskId, taskData);
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        type: 'updateTask',
        taskId,
        ...taskData
      }, async response => {
        if (response.success) {
          console.log('Task updated successfully:', response.data);

          // ローカルキャッシュを更新
          updateTaskInCache(taskId, response.data);
          
          // 今日の対応予定タスクを抽出（ローカルキャッシュから）
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          const todaysTasks = tasksCache.filter(task => {
            const actionDate = task.properties['対応日']?.date?.start;
            if (actionDate) {
              const taskDate = new Date(actionDate);
              taskDate.setHours(0, 0, 0, 0);
              return taskDate.getTime() === today.getTime();
            }
            return false;
          });

          // 今日の対応予定タスクが存在し、全て完了しているかチェック
          console.log('今日のタスク数:', todaysTasks.length);
          if (todaysTasks.length > 0) {
            const allTodaysTasksCompleted = todaysTasks.every(task =>
              task.properties['ステータス']?.status?.name === '完了'
            );
            
            console.log('全タスク完了状態:', allTodaysTasksCompleted);
            console.log('タスクのステータス:', todaysTasks.map(task => task.properties['ステータス']?.status?.name));

            // 今日の対応予定タスクが全て完了した場合
            if (allTodaysTasksCompleted) {
              console.log('全タスク完了！レベルアップ演出を表示します');
              const allTasksDoneSound = document.getElementById('allTasksDoneSound');
              console.log('音声要素:', allTasksDoneSound);
              allTasksDoneSound.currentTime = 0;
              allTasksDoneSound.play();
              showCelebration(); // お祝いアニメーションを表示
            }
          }
          
          // 現在の表示モードに基づいてタスクを再表示
          if (currentViewMode === 'today') {
            const todayTasks = tasksCache.filter(task => getTaskDateCategory(task) === 'today');
            renderTasks(todayTasks);
          } else {
            // 全タスク表示モードの場合は、現在のフィルターを適用
            applyFilters(false); // キャッシュを使用
          }
          
          resolve(response.data);
        } else {
          console.error('Failed to update task:', response.error);
          reject(new Error(response.error));
        }
      });
    });
  } catch (error) {
    console.error('Error updating task:', error);
    throw error;
  }
}

// タスクを削除する関数
async function deleteTask(taskId) {
  try {
    console.log('Deleting task:', taskId);
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        type: 'deleteTask',
        taskId
      }, async response => {
        if (response.success) {
          console.log('Task deleted successfully:', response.data);
          
          // ローカルキャッシュからタスクを削除
          deleteTaskFromCache(taskId);
          
          // 現在の表示モードに基づいてタスクを再表示
          if (currentViewMode === 'today') {
            const todayTasks = tasksCache.filter(task => getTaskDateCategory(task) === 'today');
            renderTasks(todayTasks);
          } else {
            // 全タスク表示モードの場合は、現在のフィルターを適用
            applyFilters(false); // キャッシュを使用
          }
          
          resolve(response.data);
        } else {
          console.error('Failed to delete task:', response.error);
          reject(new Error(response.error));
        }
      });
    });
  } catch (error) {
    console.error('Error deleting task:', error);
    throw error;
  }
}

// お祝いアニメーションを表示する関数（軽量化）
function showCelebration() {
  console.log('showCelebration関数が呼び出されました');
  const container = document.getElementById('celebrationContainer');
  const message = document.getElementById('celebrationMessage');
  
  console.log('コンテナ要素:', container);
  console.log('メッセージ要素:', message);
  
  // 既存のアニメーションが実行中の場合はクリーンアップ
  if (container.classList.contains('show')) {
    container.classList.remove('show');
    message.classList.remove('show');
    container.innerHTML = '';
  }
  
  // LEVEL UP! テキスト
  const levelUp = document.createElement('div');
  levelUp.className = 'level-up';
  levelUp.textContent = 'LEVEL UP!';
  container.appendChild(levelUp);
  
  // ステータス上昇テキスト
  const stats = [
    '知力 +10',
    '筋力 +15',
    '信仰 +20',
    '幸運 +25'
  ];
  
  stats.forEach((stat, index) => {
    const statElement = document.createElement('div');
    statElement.className = 'stat-increase';
    statElement.textContent = stat;
    statElement.style.top = `${50 + (index * 10)}%`; // 位置を調整
    statElement.style.animationDelay = `${2 + index * 0.5}s`;
    container.appendChild(statElement);
  });
  
  // スパークルエフェクト（数を減らして軽量化）
  for (let i = 0; i < 30; i++) { // 100から30に減らす
    const sparkle = document.createElement('div');
    sparkle.className = 'sparkle';
    sparkle.style.left = Math.random() * 100 + '%';
    sparkle.style.top = Math.random() * 100 + '%';
    sparkle.style.animationDelay = Math.random() * 2 + 's';
    container.appendChild(sparkle);
  }
  
  // コンフェティ（数を減らして軽量化）
  const colors = [
    { start: '#FF6B6B', end: '#FF8B94' },
    { start: '#4ECDC4', end: '#95E1D3' },
    { start: '#FFE66D', end: '#FFD93D' },
    { start: '#6C5CE7', end: '#A8A4FF' },
    { start: '#FF9F43', end: '#FFC38B' }
  ];
  
  for (let i = 0; i < 30; i++) { // 100から30に減らす
    const confetti = document.createElement('div');
    confetti.className = 'confetti';
    const color = colors[Math.floor(Math.random() * colors.length)];
    confetti.style.setProperty('--color-start', color.start);
    confetti.style.setProperty('--color-end', color.end);
    confetti.style.left = Math.random() * 100 + '%';
    confetti.style.animationDelay = Math.random() * 2 + 's';
    container.appendChild(confetti);
  }

  // アニメーションを表示
  console.log('アニメーションを表示します');
  container.classList.add('show');
  message.classList.add('show');
  message.innerHTML = `
     Quest Complete! <br>
    本日の全ミッションを<br>クリアしました！
  `;

  // アニメーション終了後にクリーンアップ
  const cleanupTimeout = setTimeout(() => {
    cleanupCelebration();
  }, 7000);
  
  // クリーンアップ関数を定義
  function cleanupCelebration() {
    console.log('セレブレーションをクリーンアップします');
    container.classList.remove('show');
    message.classList.remove('show');
    
    // 少し遅延させてから内容をクリア（アニメーション終了後）
    setTimeout(() => {
      container.innerHTML = '';
    }, 500);
  }
  
  // 念のため、ページがアンロードされる前にクリーンアップ
  window.addEventListener('beforeunload', cleanupCelebration, { once: true });
}


// 日付をフォーマットする関数
function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

// ISO文字列を日本時間に変換する関数
function convertToJST(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  const jstDate = new Date(date.getTime() + (9 * 60 * 60 * 1000)); // UTC+9
  return jstDate.toISOString();
}

// 日本時間をUTCに変換する関数
function convertToUTC(dateStr, timeStr = '') {
  if (!dateStr) return null;
  const jstDateTime = `${dateStr}${timeStr ? 'T' + timeStr : 'T00:00'}:00+09:00`;
  const date = new Date(jstDateTime);
  return date.toISOString();
}

// タスクの日付に関する判定関数
function getTaskDateCategory(task) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // 期限日または対応予定日を取得
  const dueDate = task.properties['対応期日']?.date?.start;
  const actionDate = task.properties['対応日']?.date?.start;
  
  // 日付を判定するための変数
  let taskDate = null;
  
  // 対応予定日を優先して使用
  if (actionDate) {
    taskDate = new Date(actionDate);
    taskDate.setHours(0, 0, 0, 0);
  } else if (dueDate) {
    taskDate = new Date(dueDate);
    taskDate.setHours(0, 0, 0, 0);
  }
  
  // 日付がない場合は「今日」として扱う
  if (!taskDate) {
    return 'today';
  }
  
  // 日付の比較
  if (taskDate.getTime() < today.getTime()) {
    return 'past';
  } else if (taskDate.getTime() === today.getTime()) {
    return 'today';
  } else {
    return 'future';
  }
}

// タスクが今日に関連するかどうかを判定する関数
function isTaskForToday(task) {
  return getTaskDateCategory(task) === 'today';
}

// タスクをソートする関数
function sortTasks(tasks, field, direction) {
  return [...tasks].sort((a, b) => {
    let valueA, valueB;
    
    switch (field) {
      case 'priority':
        const priorityOrder = { '高': 3, '中': 2, '低': 1, '': 0 };
        valueA = priorityOrder[a.properties['優先度']?.select?.name || ''] || 0;
        valueB = priorityOrder[b.properties['優先度']?.select?.name || ''] || 0;
        break;
      
      case 'dueDate':
        valueA = a.properties['対応期日']?.date?.start || '9999-12-31';
        valueB = b.properties['対応期日']?.date?.start || '9999-12-31';
        break;
      
      case 'actionDate':
        valueA = a.properties['対応日']?.date?.start || '9999-12-31';
        valueB = b.properties['対応日']?.date?.start || '9999-12-31';
        break;
      
      case 'status':
        const statusOrder = { '未着手': 0, '次に対応': 1, '対応中': 2, '完了': 3 };
        valueA = statusOrder[a.properties['ステータス']?.status?.name || ''] || -1;
        valueB = statusOrder[b.properties['ステータス']?.status?.name || ''] || -1;
        break;
      
      case 'createdTime':
        valueA = a.properties['作成日']?.created_time || '';
        valueB = b.properties['作成日']?.created_time || '';
        break;
      
      default:
        return 0;
    }
    
    const compareResult = valueA < valueB ? -1 : valueA > valueB ? 1 : 0;
    return direction === 'desc' ? -compareResult : compareResult;
  });
}

// タスクサマリーを更新する関数
function updateTaskSummary(tasks) {
  const totalTasks = tasks.length;
  const todayTasks = tasks.filter(isTaskForToday).length;
  const completedTasks = tasks.filter(task => 
    task.properties['ステータス']?.status?.name === '完了'
  ).length;
  
  document.getElementById('totalTasks').textContent = totalTasks;
  document.getElementById('todayDueTasks').textContent = todayTasks;
  document.getElementById('completedTasks').textContent = completedTasks;
}

// メニューの開閉処理
function toggleMenu() {
  const menuPanel = document.getElementById('menuPanel');
  const menuOverlay = document.getElementById('menuOverlay');
  menuPanel.classList.toggle('open');
  menuOverlay.classList.toggle('open');
}

// タスクの詳細を切り替える関数
function toggleTaskDetails(taskElement) {
  const detailsElement = taskElement.querySelector('.task-details');
  if (detailsElement) {
    detailsElement.classList.toggle('hidden');
  }
}

// タブを切り替える関数
function switchTab(tabId) {
  // すべてのタブコンテンツを非表示にする
  const tabContents = document.querySelectorAll('.tab-content');
  tabContents.forEach(content => {
    content.classList.remove('active');
  });
  
  // すべてのタブボタンから active クラスを削除
  const tabButtons = document.querySelectorAll('.tab-btn');
  tabButtons.forEach(button => {
    button.classList.remove('active');
  });
  
  // 選択されたタブを表示
  document.getElementById(tabId).classList.add('active');
  
  // 対応するタブボタンをアクティブにする
  let activeTabBtn;
  if (tabId === 'activeTasksSection') {
    activeTabBtn = 'activeTasksTab';
  } else if (tabId === 'completedTasksSection') {
    activeTabBtn = 'completedTasksTab';
  }
  
  document.getElementById(activeTabBtn).classList.add('active');
}

// タスク追加モーダルを表示する関数
function showAddTaskModal() {
  const modal = document.getElementById('addTaskModal');
  const form = document.getElementById('newTaskForm');
  const closeBtn = modal.querySelector('.modal-close');
  const cancelBtn = modal.querySelector('.cancel-btn');

  // フォームの初期値を設定
  const today = new Date();
  const formattedDate = today.toISOString().split('T')[0];
  document.getElementById('newActionDate').value = formattedDate;
  
  // 開始時間を18:00に固定
  document.getElementById('newActionStartTime').value = '18:00';
  
  // 終了時間を19:00に固定
  document.getElementById('newActionEndTime').value = '19:00';

  // モーダルを表示
  modal.classList.remove('hidden');

  // モーダルを閉じる関数
  const closeModal = () => {
    modal.classList.add('hidden');
    form.reset();
  };

  // 閉じるボタンとキャンセルボタンのイベントリスナーを設定
  closeBtn.onclick = closeModal;
  cancelBtn.onclick = closeModal;
}

// 編集モーダルを表示する関数
function showEditModal(taskId) {
  const modal = document.getElementById('editTaskModal');
  const form = document.getElementById('editTaskForm');
  const closeBtn = modal.querySelector('.modal-close');
  const cancelBtn = modal.querySelector('.cancel-btn');

  fetchTasks().then(tasks => {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      document.getElementById('editTaskId').value = taskId;
      let taskName = task.properties['タスク名']?.title[0]?.plain_text || '';
      taskName = taskName.replace(/^✅ /, ''); // チェックマークを削除
      document.getElementById('editTaskName').value = taskName;
      document.getElementById('editTaskStatus').value = task.properties['ステータス']?.status?.name || '未着手';
      document.getElementById('editTaskPriority').value = task.properties['優先度']?.select?.name || '中';
      
      // 日付と時間の設定
      const dueDate = task.properties['対応期日']?.date;
      const actionDate = task.properties['対応日']?.date;
      
      // 期限日の設定
      if (dueDate?.start) {
        const jstDate = convertToJST(dueDate.start);
        const [date, time] = jstDate.split('T');
        document.getElementById('editDueDate').value = date;
        if (time) {
          document.getElementById('editDueTime').value = time.substring(0, 5);
        } else {
          document.getElementById('editDueTime').value = '';
        }
      } else {
        document.getElementById('editDueDate').value = '';
        document.getElementById('editDueTime').value = '';
      }
      
      // 対応予定日の設定
      if (actionDate?.start) {
        const jstStartDate = convertToJST(actionDate.start);
        const [date, startTime] = jstStartDate.split('T');
        document.getElementById('editActionDate').value = date;
        if (startTime) {
          document.getElementById('editActionStartTime').value = startTime.substring(0, 5);
        } else {
          document.getElementById('editActionStartTime').value = '';
        }
        
        if (actionDate.end) {
          const jstEndDate = convertToJST(actionDate.end);
          const [, endTime] = jstEndDate.split('T');
          document.getElementById('editActionEndTime').value = endTime.substring(0, 5);
        } else {
          document.getElementById('editActionEndTime').value = '';
        }
      } else {
        document.getElementById('editActionDate').value = '';
        document.getElementById('editActionStartTime').value = '';
        document.getElementById('editActionEndTime').value = '';
      }
      
      document.getElementById('editNotes').value = task.properties['備考欄']?.rich_text[0]?.plain_text || '';
    }
  });

  modal.classList.remove('hidden');

  const closeModal = () => {
    modal.classList.add('hidden');
  };

  closeBtn.onclick = closeModal;
  cancelBtn.onclick = closeModal;

  form.onsubmit = async (e) => {
    e.preventDefault();
    
    // 現在のタスクデータを取得
    const tasks = await fetchTasks();
    const currentTask = tasks.find(t => t.id === taskId);
    
    // 編集可能なフィールドのみを更新
    const taskData = {
      taskName: document.getElementById('editTaskName').value,
      notes: document.getElementById('editNotes').value || null,
      // 元のタスクから他の情報を保持
      status: currentTask.properties['ステータス']?.status?.name || '未着手',
      priority: currentTask.properties['優先度']?.select?.name || '中'
    };

    // 期限日の設定（元のデータを保持）
    if (currentTask.properties['対応期日']?.date) {
      taskData.dueDate = currentTask.properties['対応期日'].date.start;
    } else {
      taskData.dueDate = null;
    }

    // 対応予定日の設定（元のデータを保持）
    if (currentTask.properties['対応日']?.date) {
      taskData.actionDate = {
        start: currentTask.properties['対応日'].date.start
      };
      
      if (currentTask.properties['対応日'].date.end) {
        taskData.actionDate.end = currentTask.properties['対応日'].date.end;
      }
    } else {
      taskData.actionDate = null;
    }

    try {
      await updateTask(taskId, taskData);
      closeModal();
      // 現在の表示モードに基づいてタスクを再表示（updateTask関数内で処理）
    } catch (error) {
      console.error('Failed to update task:', error);
      alert('タスクの更新に失敗しました。');
    }
  };
}

// フィルター処理
function applyFilters(forceRefresh = false) {
  console.log('Applying filters...');
  const statusFilter = document.getElementById('statusFilter').value;
  const priorityFilter = document.getElementById('priorityFilter').value;
  const sortField = document.getElementById('sortField').value;
  const sortDirection = document.getElementById('sortDirection').getAttribute('data-direction');

  // 検索入力をクリア
  document.getElementById('searchInput').value = '';
  
  // 全タスク表示モードに設定
  currentViewMode = 'all';

  // タスクを取得（forceRefreshパラメータに応じてキャッシュまたはデータベースから）
  const processFilters = (tasks) => {
    console.log('Filtering tasks:', tasks.length);
    if (!Array.isArray(tasks)) {
      console.error('Invalid tasks data:', tasks);
      return;
    }

    let filteredTasks = tasks.filter(task => {
      const taskStatus = task.properties['ステータス']?.status?.name || '';
      const taskPriority = task.properties['優先度']?.select?.name || '';

      return (!statusFilter || taskStatus === statusFilter) &&
             (!priorityFilter || taskPriority === priorityFilter);
    });

    // ソート適用
    filteredTasks = sortTasks(filteredTasks, sortField, sortDirection);
    
    console.log('Filtered and sorted tasks:', filteredTasks.length);
    renderTasks(filteredTasks);
  };

  if (forceRefresh) {
    // 強制更新の場合はAPIから取得
    fetchTasks(null, true).then(processFilters).catch(error => {
      console.error('Error applying filters:', error);
    });
  } else {
    // キャッシュを使用
    processFilters(tasksCache);
  }
}

// タスク要素を作成する関数
function createTaskElement(task, isCompleted = false) {
  const properties = task.properties;
  
  const taskId = task.id;
  let taskName = properties['タスク名']?.title[0]?.plain_text || 'Untitled';
  
  // 完了済みタスク一覧に表示される場合は、先頭の✅を無条件で削除
  if (isCompleted) {
    taskName = taskName.replace(/^✅\s*/, '');
  } else {
    // 通常表示の場合は従来通り
    taskName = taskName.replace(/^✅ /, '');
  }
  const status = properties['ステータス']?.status?.name || '未設定';
  const priority = properties['優先度']?.select?.name || '未設定';
  const dueDate = properties['対応期日']?.date?.start;
  const actionDate = properties['対応日']?.date;
  const notes = properties['備考欄']?.rich_text[0]?.plain_text;
  
  const taskElement = document.createElement('div');
  taskElement.className = `task-item ${isCompleted ? 'completed' : ''}`;
  taskElement.dataset.taskId = taskId;
  
  // 日付と時間の表示用フォーマット
  // 時間の長さを計算する関数（12時間を最大とする）
  const calculateDuration = (startTime, endTime) => {
    if (!startTime || !endTime) return 0;
    const start = new Date(`2000-01-01T${startTime}`);
    const end = new Date(`2000-01-01T${endTime}`);
    const durationHours = (end - start) / (1000 * 60 * 60);
    return Math.min(durationHours, 12) / 12 * 100; // パーセンテージに変換
  };

  // 合計時間を計算してフォーマットする関数
  const formatTotalTime = (startTime, endTime) => {
    if (!startTime || !endTime) return '';
    const start = new Date(`2000-01-01T${startTime}`);
    const end = new Date(`2000-01-01T${endTime}`);
    const durationMinutes = (end - start) / (1000 * 60);
    const hours = Math.floor(durationMinutes / 60);
    const minutes = Math.round(durationMinutes % 60);
    return `${hours}時間${minutes > 0 ? ` ${minutes}分` : ''}`;
  };

  const formatDateTime = (dateTimeStr) => {
    if (!dateTimeStr) return '';
    const jstDate = convertToJST(dateTimeStr);
    const [date, time] = jstDate.split('T');
    const formattedDate = formatDate(date);
    return time ? `${formattedDate} ${time.substring(0, 5)}` : formattedDate;
  };

  // 対応予定日の表示テキストを作成
  let actionDateText = '';
  if (actionDate?.start) {
    actionDateText = formatDateTime(actionDate.start);
    if (actionDate.end) {
      const endTime = convertToJST(actionDate.end).split('T')[1].substring(0, 5);
      actionDateText += ` → ${endTime}`;
    }
  }
  
  // タスクの時間バーを作成
  let timeBarHtml = '';
  if (actionDate?.start && actionDate?.end) {
    const startTime = convertToJST(actionDate.start).split('T')[1].substring(0, 5);
    const endTime = convertToJST(actionDate.end).split('T')[1].substring(0, 5);
    const durationPercent = calculateDuration(startTime, endTime);
    const totalTime = formatTotalTime(startTime, endTime);
    timeBarHtml = `
      <div class="task-duration">
        <div class="duration-bar" style="width: ${durationPercent}%">
          <span class="duration-time">${startTime} → ${endTime}</span>
        </div>
        <span class="total-duration-time"><i class="ri-time-line"></i> ${totalTime}</span>
      </div>
    `;
  }

  taskElement.innerHTML = `
    <div class="task-header">
      <div class="task-title-row">
        <div class="task-checkbox-title">
          <input type="checkbox" class="task-status-checkbox" ${isCompleted ? 'checked' : ''}>
          <span class="task-title">
            ${notes ? `<i class="ri-sticky-note-fill note-icon" title="備考あり"></i>` : ''}
            ${taskName}
          </span>
        </div>
        <div class="task-actions">
          <button class="edit-task-btn" title="タスクを編集">
            <i class="ri-edit-line"></i>
          </button>
        </div>
      </div>
      ${timeBarHtml}
      <div class="task-meta">
        <span class="task-status status-${status}">${status}</span>
        <span class="task-priority priority-${priority}">${priority}</span>
      </div>
    </div>
    <div class="task-details hidden">
      <div class="task-dates">
        ${dueDate ? `
          <div class="date-item">
            <span class="date-label">期限:</span>
            <span class="date-value">${formatDateTime(dueDate)}</span>
          </div>
        ` : ''}
        ${actionDateText ? `
          <div class="date-item">
            <span class="date-label">対応予定:</span>
            <span class="date-value">${actionDateText}</span>
          </div>
        ` : ''}
      </div>
      ${notes ? `<div class="task-notes">${notes}</div>` : ''}
      <div class="task-detail-actions">
        <button class="delete-task-btn" title="タスクを削除">
          <i class="ri-delete-bin-line"></i> 削除
        </button>
      </div>
    </div>
  `;
  
  // イベントリスナーの設定
  const header = taskElement.querySelector('.task-header');
  header.addEventListener('click', () => toggleTaskDetails(taskElement));

  const checkbox = taskElement.querySelector('.task-status-checkbox');
  checkbox.addEventListener('click', async (e) => {
    e.stopPropagation();
    
    // クリックされた時点でのチェック状態を保存
    const isChecked = e.target.checked;
    const newStatus = isChecked ? '完了' : '未完了';
    
    // クリック音を再生
    const clickSound = document.getElementById('clickSound');
    clickSound.currentTime = 0;
    clickSound.play();
    
    try {
      // ローカルキャッシュからタスク情報を取得
      const task = getTaskFromCache(taskId);
      if (!task) throw new Error('Task not found in cache');

      // タスク名を取得（既存の✅を除去）
      let taskName = task.properties['タスク名']?.title[0]?.plain_text || '';
      // taskName = taskName.replace(/^[✅📝\s]+/, '');

      // ✅を追加するコードをコメントアウト
      // if (newStatus === '完了') {
      //   taskName = '✅ ' + taskName.replace(/^✅ /, '');
      // } else {
      //   taskName = taskName.replace(/^✅ /, '');
      // }

      // タスクの更新
      await updateTask(taskId, {
        status: newStatus,
        taskName: taskName
      });

      // 更新が成功したら、チェックボックスの状態を確定
      e.target.checked = isChecked;
      
    } catch (error) {
      console.error('Failed to update task status:', error);
      // エラーが発生した場合は、チェックボックスの状態を元に戻す
      e.target.checked = !isChecked;
    }
  });

  // 対応中ボタンのイベントリスナーを削除

  const editBtn = taskElement.querySelector('.edit-task-btn');
  if (editBtn) {
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      showEditModal(taskId);
    });
  }

  // 削除ボタンのイベントリスナーを追加
  const deleteBtn = taskElement.querySelector('.delete-task-btn');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm('このタスクを削除してもよろしいですか？この操作は元に戻せません。')) {
        deleteTask(taskId);
      }
    });
  }

  return taskElement;
}

// タスクを表示する関数
function renderTasks(tasks) {
  console.log('Sidepanel: Rendering tasks:', tasks);
  const pastTaskList = document.getElementById('pastTaskList');
  const todayTaskList = document.getElementById('todayTaskList');
  const futureTaskList = document.getElementById('futureTaskList');
  const completedTaskList = document.getElementById('completedTaskList');
  
  // 各リストを初期化
  pastTaskList.innerHTML = '';
  todayTaskList.innerHTML = '';
  futureTaskList.innerHTML = '';
  completedTaskList.innerHTML = '';

  if (!tasks || tasks.length === 0) {
    // 全セクションに「タスクがありません」メッセージを表示
    const emptyMessage = '<div class="empty-task-message">タスクが見つかりませんでした</div>';
    pastTaskList.innerHTML = emptyMessage;
    todayTaskList.innerHTML = emptyMessage;
    futureTaskList.innerHTML = emptyMessage;
    completedTaskList.innerHTML = emptyMessage;
    return;
  }
  
  // タスクを完了/未完了で分類
  const completedTasks = tasks.filter(task => task.properties['ステータス']?.status?.name === '完了');
  const activeTasks = tasks.filter(task => task.properties['ステータス']?.status?.name !== '完了');

  // アクティブなタスクを日付カテゴリで分類
  const pastTasks = activeTasks.filter(task => getTaskDateCategory(task) === 'past');
  const todayTasks = activeTasks.filter(task => getTaskDateCategory(task) === 'today');
  const futureTasks = activeTasks.filter(task => getTaskDateCategory(task) === 'future');

  // 過去のタスクを表示
  if (pastTasks.length > 0) {
    pastTasks.forEach(task => {
      const taskElement = createTaskElement(task);
      pastTaskList.appendChild(taskElement);
    });
  } else {
    pastTaskList.innerHTML = '<div class="empty-task-message">過去のタスクはありません。素晴らしい進捗です！</div>';
  }
  
  // 今日のタスクを表示
  if (todayTasks.length > 0) {
    todayTasks.forEach(task => {
      const taskElement = createTaskElement(task);
      todayTaskList.appendChild(taskElement);
    });
  } else {
    todayTaskList.innerHTML = '<div class="empty-task-message">今日のタスクはありません。新しいタスクを追加しましょう！</div>';
  }
  
  // 日付ごとにタスクをグループ化する関数
  const groupTasksByDate = (taskList, tasks, isCompleted = false) => {
    // 対応予定日のソート順（完了タスクは新しい順、それ以外は近い順）
    const sortDirection = isCompleted ? 'desc' : 'asc';
    const sortedTasks = sortTasks(tasks, 'actionDate', sortDirection);
    
    // 日付ごとにタスクをグループ化
    const tasksByDate = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    sortedTasks.forEach(task => {
      // 期限日または対応予定日を取得
      const dueDate = task.properties['対応期日']?.date?.start;
      const actionDate = task.properties['対応日']?.date?.start;
      
      // 日付を判定するための変数
      let taskDate = null;
      let dateKey = 'no-date';
      let daysFromToday = 0;
      
      // 対応予定日を優先して使用
      if (actionDate) {
        taskDate = new Date(actionDate);
        taskDate.setHours(0, 0, 0, 0);
        dateKey = actionDate.split('T')[0]; // YYYY-MM-DD形式
        
        // 今日からの日数を計算
        const diffTime = taskDate.getTime() - today.getTime();
        daysFromToday = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      } else if (dueDate) {
        taskDate = new Date(dueDate);
        taskDate.setHours(0, 0, 0, 0);
        dateKey = dueDate.split('T')[0]; // YYYY-MM-DD形式
        
        // 今日からの日数を計算
        const diffTime = taskDate.getTime() - today.getTime();
        daysFromToday = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      }
      
      // 日付ごとのグループに追加
      if (!tasksByDate[dateKey]) {
        tasksByDate[dateKey] = {
          date: taskDate,
          daysFromToday: daysFromToday,
          tasks: []
        };
      }
      
      tasksByDate[dateKey].tasks.push(task);
    });
    
    // 日付ごとにタスクを表示
    const dateKeys = Object.keys(tasksByDate).sort((a, b) => {
      // 日付なしは最後に
      if (a === 'no-date') return 1;
      if (b === 'no-date') return -1;
      
      // 日付順にソート（完了タスクは新しい順、それ以外は古い順）
      return isCompleted ? b.localeCompare(a) : a.localeCompare(b);
    });
    
    if (dateKeys.length === 0) {
      return false;
    } else {
      dateKeys.forEach(dateKey => {
        const dateGroup = tasksByDate[dateKey];
        const dateSection = document.createElement('div');
        dateSection.className = 'future-date-section';
        
        // 日付ヘッダーを作成
        const dateHeader = document.createElement('h3');
        dateHeader.className = 'future-date-header';
        
        if (dateKey === 'no-date') {
          dateHeader.textContent = '日付未設定';
        } else {
          const formattedDate = formatDate(dateGroup.date);
          let daysText = '';
          
          if (dateGroup.daysFromToday === 1) {
            daysText = '（明日）';
          } else if (dateGroup.daysFromToday === 2) {
            daysText = '（明後日）';
          } else if (dateGroup.daysFromToday === 3) {
            daysText = '（3日後）';
          } else if (dateGroup.daysFromToday === 7) {
            daysText = '（1週間後）';
          } else if (dateGroup.daysFromToday > 3) {
            daysText = `（${dateGroup.daysFromToday}日後）`;
          } else if (dateGroup.daysFromToday < 0) {
            daysText = `（${Math.abs(dateGroup.daysFromToday)}日前）`;
          } else if (dateGroup.daysFromToday === 0) {
            daysText = '（今日）';
          }
          
          dateHeader.textContent = `${formattedDate} ${daysText}`;
        }
        
        dateSection.appendChild(dateHeader);
        
        // 日付ごとのタスクリストを作成
        const dateTasks = document.createElement('div');
        dateTasks.className = 'future-date-tasks';
        
        dateGroup.tasks.forEach(task => {
          const taskElement = createTaskElement(task, task.properties['ステータス']?.status?.name === '完了');
          dateTasks.appendChild(taskElement);
        });
        
        dateSection.appendChild(dateTasks);
        taskList.appendChild(dateSection);
      });
      return true;
    }
  };
  
  // 未来のタスクを表示（日付ごとにグループ化）
  if (futureTasks.length > 0) {
    if (!groupTasksByDate(futureTaskList, futureTasks)) {
      futureTaskList.innerHTML = '<div class="empty-task-message">未来のタスクはありません。計画的に予定を立てましょう！</div>';
    }
  } else {
    futureTaskList.innerHTML = '<div class="empty-task-message">未来のタスクはありません。計画的に予定を立てましょう！</div>';
  }
  
  // 完了したタスクを表示（日付ごとにグループ化、新しい順）
  if (completedTasks.length > 0) {
    if (!groupTasksByDate(completedTaskList, completedTasks, true)) {
      completedTaskList.innerHTML = '<div class="empty-task-message">完了したタスクはありません。頑張りましょう！</div>';
    }
  } else {
    completedTaskList.innerHTML = '<div class="empty-task-message">完了したタスクはありません。頑張りましょう！</div>';
  }
}

// DOMContentLoadedイベントリスナー
// タスクを検索する関数
function searchTasks(query, options = { title: true, notes: false }) {
  const clearSearchBtn = document.getElementById('clearSearchBtn');
  
  // 検索クエリが空の場合
  if (!query.trim()) {
    clearSearchBtn.classList.add('hidden');
    return applyFilters();
  }
  
  // 検索クエリがある場合は×ボタンを表示
  clearSearchBtn.classList.remove('hidden');
  
  // ローカルキャッシュが空の場合は取得
  if (tasksCache.length === 0) {
    fetchTasks().then(tasks => {
      performSearch(tasks, query, options);
    });
  } else {
    // ローカルキャッシュを使用
    performSearch(tasksCache, query, options);
  }
}

// 実際の検索処理を行う関数
function performSearch(tasks, query, options) {
  const searchResults = tasks.filter(task => {
    // タスク名を検索
    if (options.title) {
      const taskName = task.properties['タスク名']?.title[0]?.plain_text || '';
      if (taskName.toLowerCase().includes(query.toLowerCase())) {
        return true;
      }
    }
    
    // 備考を検索
    if (options.notes) {
      const notes = task.properties['備考欄']?.rich_text[0]?.plain_text || '';
      if (notes.toLowerCase().includes(query.toLowerCase())) {
        return true;
      }
    }
    
    return false;
  });
  
  // 検索結果を表示
  renderTasks(searchResults);
  
  // 表示モードを変更
  currentViewMode = 'search';
}

// 検索をクリアする関数
function clearSearch() {
  const searchInput = document.getElementById('searchInput');
  const clearSearchBtn = document.getElementById('clearSearchBtn');
  
  searchInput.value = '';
  clearSearchBtn.classList.add('hidden');
  currentViewMode = 'all';
  applyFilters(); // 全件表示に戻る
}

// 新規タスクを作成する関数
async function createNewTask(taskData) {
  try {
    console.log('Creating new task:', taskData);
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        type: 'createTask',
        ...taskData
      }, response => {
        if (response.success) {
          console.log('Task created successfully:', response.data);
          
          // ローカルキャッシュを更新（新しいタスクを追加）
          tasksCache.push(response.data);
          
          // 現在の表示モードに基づいてタスクを再表示
          applyFilters(false); // キャッシュを使用
          
          // 未完了タスクタブを表示
          document.getElementById('activeTasksSection').classList.add('active');
          document.getElementById('activeTasksTab').classList.add('active');
          
          resolve(response.data);
        } else {
          console.error('Failed to create task:', response.error);
          reject(new Error(response.error));
        }
      });
    });
  } catch (error) {
    console.error('Error creating task:', error);
    throw error;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // 初期表示（すべてのタスクを表示）
  console.log('初期表示: タスクを取得します');
  
  // まずキャッシュからタスクを取得し、失敗した場合はAPIから取得
  fetchTasks([
    {
      property: "優先度",
      direction: "descending"
    },
    {
      property: "対応期日",
      direction: "ascending"
    }
  ], false).then(tasks => {
    console.log(`取得したタスク数: ${tasks.length}`);
    
    // すべてのタスクを表示
    renderTasks(tasks);
    
    // 初期表示のソート順をUIに反映
    document.getElementById('sortField').value = 'priority';
    currentViewMode = 'all';
  }).catch(error => {
    console.error('初期表示でエラーが発生しました:', error);
    
    // エラーが発生した場合でも空の配列を表示
    renderTasks([]);
  });
  
  // 検索機能の実装
  const searchInput = document.getElementById('searchInput');
  const searchBtn = document.getElementById('searchBtn');
  const clearSearchBtn = document.getElementById('clearSearchBtn');
  const searchInTitle = document.getElementById('searchInTitle');
  const searchInNotes = document.getElementById('searchInNotes');
  
  // 検索ボタンクリック時の処理
  searchBtn.addEventListener('click', () => {
    const query = searchInput.value.trim();
    if (!query) return;
    
    const options = {
      title: searchInTitle.checked,
      notes: searchInNotes.checked
    };
    
    searchTasks(query, options);
  });
  
  // 検索クリアボタンクリック時の処理
  clearSearchBtn.addEventListener('click', clearSearch);
  
  // 検索入力欄の変更時の処理
  searchInput.addEventListener('input', () => {
    const query = searchInput.value.trim();
    if (!query) {
      clearSearchBtn.classList.add('hidden');
    } else {
      clearSearchBtn.classList.remove('hidden');
    }
  });
  
  // Enterキー押下時の処理
  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      const query = searchInput.value.trim();
      if (!query) return;
      
      const options = {
        title: searchInTitle.checked,
        notes: searchInNotes.checked
      };
      
      searchTasks(query, options);
    }
  });

  // メニュー関連のイベントリスナー
  document.getElementById('menuToggle').addEventListener('click', toggleMenu);
  document.getElementById('menuClose').addEventListener('click', toggleMenu);
  document.getElementById('menuOverlay').addEventListener('click', toggleMenu);
  
  // タブ切り替えのイベントリスナー
  document.getElementById('activeTasksTab').addEventListener('click', () => switchTab('activeTasksSection'));
  document.getElementById('completedTasksTab').addEventListener('click', () => switchTab('completedTasksSection'));
  document.getElementById('addTaskBtn').addEventListener('click', showAddTaskModal);

  // 新規タスク追加フォームのイベントリスナー
  document.getElementById('newTaskForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const taskName = document.getElementById('newTaskName').value;
    const actionDate = document.getElementById('newActionDate').value;
    const actionStartTime = document.getElementById('newActionStartTime').value;
    const actionEndTime = document.getElementById('newActionEndTime').value;
    const notes = document.getElementById('newNotes').value;
    
    // 開始時間と終了時間を含む対応予定日を作成
    const actionDateWithTime = {
      start: convertToUTC(actionDate, actionStartTime),
      end: convertToUTC(actionDate, actionEndTime)
    };
    
    try {
      // 新規タスクデータを作成
      const taskData = {
        taskName: taskName,
        status: '未完了',
        priority: '中',
        actionDate: actionDateWithTime,
        notes: notes || null
      };
      
      // タスクを作成
      await createNewTask(taskData);
      
      // モーダルを閉じる
      document.getElementById('addTaskModal').classList.add('hidden');
      
      // フォームをリセット
      document.getElementById('newTaskForm').reset();
      
      // 成功メッセージを表示
      alert('タスクが正常に作成されました！');
    } catch (error) {
      console.error('Failed to create task:', error);
      alert('タスクの作成に失敗しました。');
    }
  });
  // 更新ボタン
  document.getElementById('refreshBtn').addEventListener('click', () => {
    const refreshBtn = document.getElementById('refreshBtn');
    refreshBtn.querySelector('i').classList.add('spinning');
    
    if (currentViewMode === 'today') {
      // 今日のタスク表示モードの場合
      fetchTasks([
        {
          property: "対応日",
          direction: "ascending"
        },
        {
          property: "優先度",
          direction: "descending"
        }
      ], true).then(tasks => {
        const todaysTasks = tasks.filter(task => getTaskDateCategory(task) === 'today');
        renderTasks(todaysTasks);
        refreshBtn.querySelector('i').classList.remove('spinning');
      }).catch(error => {
        console.error('Error refreshing tasks:', error);
        refreshBtn.querySelector('i').classList.remove('spinning');
      });
    } else {
      // 全タスク表示モードの場合
      applyFilters(true); // forceRefresh=trueを指定してデータベースから再取得
    }
  });

  

  // フィルター
  document.getElementById('statusFilter').addEventListener('change', () => {
    applyFilters();
  });
  document.getElementById('priorityFilter').addEventListener('change', () => {
    applyFilters();
  });

  // ソート
  document.getElementById('sortField').addEventListener('change', () => {
    applyFilters();
  });
  document.getElementById('sortDirection').addEventListener('click', (e) => {
    const currentDirection = e.target.getAttribute('data-direction');
    const newDirection = currentDirection === 'asc' ? 'desc' : 'asc';
    e.target.setAttribute('data-direction', newDirection);
    const icon = e.target.querySelector('i');
    icon.className = newDirection === 'asc' ? 'ri-arrow-up-line' : 'ri-arrow-down-line';
    applyFilters();
  });

 
  // タブの初期表示
  switchTab('activeTasksSection');
});