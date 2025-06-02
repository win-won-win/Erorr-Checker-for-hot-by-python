const NOTION_API_TOKEN = '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';
const DATABASE_ID = '163ef211dcd0806aa12be1b2701fd822';
const NOTION_API_BASE = 'https://api.notion.com/v1';

// キャッシュ関連の定数
const CACHE_KEY = 'notion_tasks_cache';
const CACHE_TIMESTAMP_KEY = 'notion_tasks_cache_timestamp';
const CACHE_EXPIRY = 5 * 60 * 1000; // 5分間キャッシュを有効にする

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

// Notion APIへのリクエストを処理
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'fetchTasks') {
    console.log('Background: Fetching tasks...');
    
    // forceRefreshパラメータがある場合はキャッシュを無視
    if (request.forceRefresh) {
      console.log('Background: Force refresh requested, bypassing cache');
      fetchTasksFromAPI(request.sorts, sendResponse);
      return true;
    }
    
    // キャッシュからタスクを取得
    chrome.storage.local.get([CACHE_KEY, CACHE_TIMESTAMP_KEY], (result) => {
      const cachedTasks = result[CACHE_KEY];
      const cacheTimestamp = result[CACHE_TIMESTAMP_KEY] || 0;
      const now = Date.now();
      
      // キャッシュが有効かチェック
      if (cachedTasks && (now - cacheTimestamp < CACHE_EXPIRY)) {
        console.log('Background: Using cached tasks data');
        
        // キャッシュされたデータをソート
        let sortedTasks = [...cachedTasks];
        if (request.sorts && request.sorts.length > 0) {
          sortedTasks = sortTasksLocally(sortedTasks, request.sorts);
        } else {
          // デフォルトのソート
          sortedTasks = sortTasksLocally(sortedTasks, [
            {
              property: "優先度",
              direction: "descending"
            },
            {
              property: "対応期日",
              direction: "ascending"
            }
          ]);
        }
        
        sendResponse({ success: true, data: sortedTasks, fromCache: true });
      } else {
        console.log('Background: Cache expired or not found, fetching from API');
        fetchTasksFromAPI(request.sorts, sendResponse);
      }
    });
    
    return true;
  }

  if (request.type === 'updateTask') {
    console.log('Background: Updating task...', request);
    
    // キャッシュからタスクの現在の状態を取得
    chrome.storage.local.get([CACHE_KEY], (result) => {
      const properties = {};
      
      // ステータスの更新
      if (request.status !== undefined) {
        properties['ステータス'] = {
          status: {
            name: request.status
          }
        };
      }
      
      // 優先度の更新
      if (request.priority !== undefined) {
        properties['優先度'] = {
          select: {
            name: request.priority
          }
        };
      }
      
      // 期限日の更新
      if (request.dueDate !== undefined) {
        properties['対応期日'] = {
          date: request.dueDate ? { start: request.dueDate } : null
        };
      }
      
      // 対応日の更新
      if (request.actionDate !== undefined) {
        properties['対応日'] = {
          date: request.actionDate ? {
            start: request.actionDate.start,
            end: request.actionDate.end || null
          } : null
        };
      }
      
      // 備考欄の更新
      if (request.notes !== undefined) {
        properties['備考欄'] = {
          rich_text: request.notes ? [
            {
              type: 'text',
              text: {
                content: request.notes
              }
            }
          ] : []
        };
      }
      
      // タスク名の更新（完了状態とメモの有無に基づいてアイコンを追加）
      if (request.taskName !== undefined) {
        // 既存のアイコンを除去（✅, 📝, ☑️📝 など）
        const taskName = request.taskName.replace(/^[✅☑️📝\s]+/, '');
        
        // 完了状態の確認
        const isCompleted = request.status === '完了';
        
        // メモの有無の確認
        const hasNotes = request.notes !== undefined ? !!request.notes : null;
        
        const cachedTasks = result[CACHE_KEY] || [];
        const currentTask = cachedTasks.find(task => task.id === request.taskId);
        
        // 現在のメモの状態を確認
        let currentHasNotes = false;
        if (currentTask && currentTask.properties['備考欄']) {
          currentHasNotes = currentTask.properties['備考欄'].rich_text.length > 0;
        }
        
        // メモの状態を決定（更新されている場合は新しい値、そうでない場合は現在の値）
        const finalHasNotes = hasNotes !== null ? hasNotes : currentHasNotes;
        
        // プレフィックスを決定
        let prefix = '';
        // ✅を追加するコードをコメントアウト（📝はそのまま）
        if (isCompleted && finalHasNotes) {
          // prefix = '✅📝 ';
          prefix = '📝 ';
        } else if (!isCompleted && finalHasNotes) {
          prefix = '📝 ';
        } else if (isCompleted && !finalHasNotes) {
          // prefix = '✅ ';
          prefix = '';
        }
        // 完了でなく、メモもない場合はプレフィックスなし
        
        // タスク名プロパティを設定
        properties['タスク名'] = {
          title: [
            {
              type: 'text',
              text: {
                content: prefix + taskName
              }
            }
          ]
        };
      }
      
      // APIリクエストを送信
      fetch(`${NOTION_API_BASE}/pages/${request.taskId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${NOTION_API_TOKEN}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ properties })
      })
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      // キャッシュを更新
      chrome.storage.local.get([CACHE_KEY], (result) => {
        const cachedTasks = result[CACHE_KEY] || [];
        
        // 更新されたタスクでキャッシュを更新
        const updatedCache = cachedTasks.map(task => {
          if (task.id === request.taskId) {
            // 更新されたタスクで置き換え
            const updatedTask = { ...data };
            
            // ステータスの更新を確実に反映
            if (request.status !== undefined) {
              if (!updatedTask.properties['ステータス']) {
                updatedTask.properties['ステータス'] = {};
              }
              updatedTask.properties['ステータス'].status = {
                name: request.status
              };
            }
            
            return updatedTask;
          }
          return task;
        });
        
        // 更新されたキャッシュを保存
        chrome.storage.local.set({
          [CACHE_KEY]: updatedCache,
          [CACHE_TIMESTAMP_KEY]: Date.now()
        }, () => {
          console.log('Background: Cache updated after task update');
        });
      });
      
      sendResponse({ success: true, data });
    })
    .catch(error => {
      console.error('Background: Error:', error);
      sendResponse({ success: false, error: error.message });
    });
  });
  return true;
}

if (request.type === 'createTask') {
    console.log('Background: Creating new task...', request);
    
    // 完了状態とメモの有無に基づいてプレフィックスを決定
    let prefix = '';
    const isCompleted = request.status === '完了';
    const hasNotes = !!request.notes;
    
    // ✅を追加するコードをコメントアウト（📝はそのまま）
    if (isCompleted && hasNotes) {
      // prefix = '✅📝 ';
      prefix = '📝 ';
    } else if (!isCompleted && hasNotes) {
      prefix = '📝 ';
    } else if (isCompleted && !hasNotes) {
      // prefix = '✅ ';
      prefix = '';
    }
    // 完了でなく、メモもない場合はプレフィックスなし
    
    const taskName = request.taskName.replace(/^[✅☑️📝\s]+/, ''); // 既存のアイコンを除去

    const properties = {
      'タスク名': {
        title: [
          {
            type: 'text',
            text: {
              content: prefix + taskName
            }
          }
        ]
      },
      'ステータス': {
        status: {
          name: request.status || 'Not started'
        }
      },
      '優先度': {
        select: {
          name: request.priority || '中'
        }
      }
    };

    // 期限日の設定
    if (request.dueDate) {
      properties['対応期日'] = {
        date: { start: request.dueDate }
      };
    }

    // 対応予定日の設定
    if (request.actionDate && request.actionDate.start) {
      properties['対応日'] = {
        date: {
          start: request.actionDate.start,
          end: request.actionDate.end || null
        }
      };
    }

    // 備考欄の設定
    if (request.notes) {
      properties['備考欄'] = {
        rich_text: [
          {
            type: 'text',
            text: {
              content: request.notes
            }
          }
        ]
      };
    }
    
    const body = {
      parent: { database_id: DATABASE_ID },
      properties
    };

    console.log('Request body:', JSON.stringify(body, null, 2));
    
    fetch(`${NOTION_API_BASE}/pages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_API_TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    })
    .then(response => {
      if (!response.ok) {
        return response.text().then(text => {
          throw new Error(`HTTP error! status: ${response.status}, body: ${text}`);
        });
      }
      return response.json();
    })
    .then(data => {
      console.log('Task created successfully:', data);
      
      // キャッシュを更新
      chrome.storage.local.get([CACHE_KEY], (result) => {
        const cachedTasks = result[CACHE_KEY] || [];
        
        // 新しいタスクをキャッシュに追加
        const updatedCache = [...cachedTasks, data];
        
        // 更新されたキャッシュを保存
        chrome.storage.local.set({
          [CACHE_KEY]: updatedCache,
          [CACHE_TIMESTAMP_KEY]: Date.now()
        }, () => {
          console.log('Background: Cache updated after task creation');
        });
      });
      
      sendResponse({ success: true, data });
    })
    .catch(error => {
      console.error('Background: Error:', error);
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }
  
  // キャッシュをクリアするリクエスト
  if (request.type === 'clearCache') {
    chrome.storage.local.remove([CACHE_KEY, CACHE_TIMESTAMP_KEY], () => {
      console.log('Background: Cache cleared');
      sendResponse({ success: true });
    });
    return true;
  }

  // タスクを削除する処理（アーカイブ）
  if (request.type === 'deleteTask') {
    console.log('Background: Archiving task...', request.taskId);
    
    fetch(`${NOTION_API_BASE}/pages/${request.taskId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${NOTION_API_TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        archived: true
      })
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      console.log('Task archived successfully:', data);
      
      // キャッシュを更新
      chrome.storage.local.get([CACHE_KEY], (result) => {
        const cachedTasks = result[CACHE_KEY] || [];
        
        // 削除されたタスクをキャッシュから削除
        const updatedCache = cachedTasks.filter(task => task.id !== request.taskId);
        
        // 更新されたキャッシュを保存
        chrome.storage.local.set({
          [CACHE_KEY]: updatedCache,
          [CACHE_TIMESTAMP_KEY]: Date.now()
        }, () => {
          console.log('Background: Cache updated after task deletion');
        });
      });
      
      sendResponse({ success: true, data });
    })
    .catch(error => {
      console.error('Background: Error:', error);
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }
});

// APIからタスクを取得する関数
function fetchTasksFromAPI(sorts, sendResponse) {
  const defaultSorts = [
    {
      property: "優先度",
      direction: "descending"
    },
    {
      property: "対応期日",
      direction: "ascending"
    }
  ];
  
  fetchAllTasks(sorts || defaultSorts).then(allResults => {
    // 取得したタスクをキャッシュに保存
    chrome.storage.local.set({
      [CACHE_KEY]: allResults,
      [CACHE_TIMESTAMP_KEY]: Date.now()
    }, () => {
      console.log('Background: Tasks cached successfully');
    });
    
    sendResponse({ success: true, data: allResults, fromCache: false });
  }).catch(error => {
    console.error('Background: Error:', error);
    sendResponse({ success: false, error: error.message });
  });
}

// ローカルでタスクをソートする関数
function sortTasksLocally(tasks, sorts) {
  if (!sorts || sorts.length === 0) return tasks;
  
  return [...tasks].sort((a, b) => {
    for (const sort of sorts) {
      const { property, direction } = sort;
      const isDesc = direction === 'descending';
      
      let valueA, valueB;
      
      // プロパティに基づいて値を取得
      switch (property) {
        case '優先度':
          const priorityOrder = { '高': 3, '中': 2, '低': 1, '': 0 };
          valueA = priorityOrder[a.properties['優先度']?.select?.name || ''] || 0;
          valueB = priorityOrder[b.properties['優先度']?.select?.name || ''] || 0;
          break;
        
        case '対応期日':
          valueA = a.properties['対応期日']?.date?.start || '9999-12-31';
          valueB = b.properties['対応期日']?.date?.start || '9999-12-31';
          break;
        
        case 'ステータス':
          const statusOrder = { '未着手': 0, '次に対応': 1, '対応中': 2, '完了': 3 };
          valueA = statusOrder[a.properties['ステータス']?.status?.name || ''] || -1;
          valueB = statusOrder[b.properties['ステータス']?.status?.name || ''] || -1;
          break;
        
        case '作成日':
          valueA = a.properties['作成日']?.created_time || '';
          valueB = b.properties['作成日']?.created_time || '';
          break;
        
        default:
          continue;
      }
      
      // 値を比較
      if (valueA !== valueB) {
        return isDesc ? (valueB - valueA) : (valueA - valueB);
      }
    }
    
    return 0;
  });
}

// ページネーションを使用して全てのタスクを取得する関数
async function fetchAllTasks(sorts) {
  console.time('fetchAllTasks');
  let allResults = [];
  let hasMore = true;
  let nextCursor = undefined;
  
  while (hasMore) {
    const body = {
      sorts: sorts,
      page_size: 100 // 1回のリクエストで最大100件取得
    };
    
    // 次のページがある場合はstart_cursorを設定
    if (nextCursor) {
      body.start_cursor = nextCursor;
    }
    
    try {
      const response = await fetch(`${NOTION_API_BASE}/databases/${DATABASE_ID}/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${NOTION_API_TOKEN}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // 結果を蓄積
      allResults = [...allResults, ...data.results];
      
      // 次のページがあるかどうかを確認
      if (data.has_more && data.next_cursor) {
        nextCursor = data.next_cursor;
        console.log(`Fetched ${allResults.length} tasks so far, getting next page...`);
      } else {
        hasMore = false;
        console.log(`Fetched all ${allResults.length} tasks successfully.`);
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
      throw error;
    }
  }
  
  console.timeEnd('fetchAllTasks');
  return allResults;
}