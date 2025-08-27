import React from 'react';
import { X, Printer } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ServiceRecord {
  id: string;
  user_name: string;
  staff_name: string;
  service_date: string;
  start_time: string;
  end_time: string;
  service_type: string;
  service_content: string;
  record_created_at: string;
  special_notes: string;
  deposit_amount: number;
  deposit_breakdown: string;
  service_details: any;
}

interface PrintPreviewProps {
  record: ServiceRecord;
  onClose: () => void;
}

export function PrintPreview({ record, onClose }: PrintPreviewProps) {
  // サービス種類の表示（service_contentを直接使用）
  const getServiceTypeDisplayName = (record: ServiceRecord) => {
    // service_contentがある場合はそれを使用、なければservice_typeを使用
    return record.service_content || record.service_type || '';
  };

  // 特記事項から利用者コードを除去する関数
  const cleanSpecialNotes = (notes: string) => {
    if (!notes) return '';
    // 利用者コード行を除去（例: "利用者コード: 2404128329"）
    return notes
      .split('\n')
      .filter(line => !line.trim().match(/^利用者コード\s*[:：]\s*\d+$/))
      .join('\n')
      .trim();
  };

  // 記録作成日時と印刷時間を生成
  const generateTimesForRecord = (record: ServiceRecord) => {
    const serviceDate = new Date(record.service_date);
    const endTime = record.end_time;
    
    // 終了時間を解析（HH:MM形式）
    const [endHour, endMinute] = endTime.split(':').map(Number);
    
    // 記録作成日時: サービス終了時間の5-30分後
    const recordCreatedDate = new Date(serviceDate.getFullYear(), serviceDate.getMonth(), serviceDate.getDate());
    const createdMinutesAfter = 5 + Math.floor(Math.random() * 25); // 5-30分後
    const recordCreatedTime = new Date(recordCreatedDate);
    recordCreatedTime.setHours(endHour, endMinute + createdMinutesAfter, Math.floor(Math.random() * 60), 0);
    
    // 印刷時間の決定
    let printDate: Date;
    
    if (endHour < 15 || (endHour === 15 && endMinute === 0)) {
      // 15時までのサービス → その日の15:30-18:00
      printDate = new Date(serviceDate.getFullYear(), serviceDate.getMonth(), serviceDate.getDate());
    } else {
      // 15時以降のサービス → 翌日の15:30-18:00
      printDate = new Date(serviceDate.getFullYear(), serviceDate.getMonth(), serviceDate.getDate() + 1);
    }
    
    // 15:30-18:00の範囲でランダム時間を生成
    const baseMinutes = 15 * 60 + 30; // 15:30を分で表現
    const maxMinutes = 18 * 60; // 18:00を分で表現
    const randomMinutes = baseMinutes + Math.floor(Math.random() * (maxMinutes - baseMinutes));
    
    const printHour = Math.floor(randomMinutes / 60);
    const printMinute = randomMinutes % 60;
    const printSecond = Math.floor(Math.random() * 60);
    
    printDate.setHours(printHour, printMinute, printSecond, 0);
    
    return {
      recordCreatedAt: recordCreatedTime.toISOString(),
      printDateTime: printDate.toISOString()
    };
  };

  const handlePrint = async () => {
    try {
      // 印刷時間のみを生成（記録作成日時は既存のものを使用）
      const times = generateTimesForRecord(record);
      
      // データベースの印刷時間を更新
      const { error } = await supabase
        .from('service_records')
        .update({ print_datetime: times.printDateTime })
        .eq('id', record.id);

      if (error) {
        console.error('印刷時間更新エラー:', error);
        alert('印刷時間の更新に失敗しました');
        return;
      }

      // 記録データをLocalStorageに保存（印刷時間を含む、記録作成日時は既存のものを使用）
      const recordWithPrintTime = {
        ...record,
        print_datetime: times.printDateTime
        // record_created_atは既存の値をそのまま使用
      };
      localStorage.setItem('printRecords', JSON.stringify([recordWithPrintTime]));
      
      const printUrl = `/print.html`;
      window.open(printUrl, '_blank');
      
      // 印刷完了後にモーダルを閉じる
      setTimeout(() => {
        onClose();
      }, 1000);
      
    } catch (error) {
      console.error('印刷処理エラー:', error);
      alert('印刷処理中にエラーが発生しました');
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getFullYear()}年${(date.getMonth() + 1).toString().padStart(2, '0')}月${date.getDate().toString().padStart(2, '0')}日`;
  };

  const formatTime = (timeStr: string) => {
    // HH:MM:SS形式またはHH:MM形式から時分のみを抽出
    const timeParts = timeStr.split(':');
    const hours = parseInt(timeParts[0]);
    const minutes = parseInt(timeParts[1]);
    return `${hours}時${minutes.toString().padStart(2, '0')}分`;
  };

  const details = record.service_details || {};

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-screen overflow-y-auto">
        {/* ヘッダー */}
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center print:hidden">
          <h3 className="text-lg font-medium text-gray-900">印刷プレビュー</h3>
          <div className="flex space-x-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center space-x-2"
            >
              <Printer className="h-4 w-4" />
              <span>印刷</span>
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* 印刷用スタイル */}
        <style>{`
          @media print {
            @page {
              size: A4 portrait;
              margin: 8mm;
            }
            
            /* 印刷時にスクロールバーとモーダル要素を非表示 */
            body {
              overflow: visible !important;
            }
            
            .fixed, .bg-gray-600, .bg-opacity-50 {
              position: static !important;
              background: transparent !important;
            }
            
            .max-h-screen, .overflow-y-auto {
              max-height: none !important;
              overflow: visible !important;
            }
            
            .rounded-lg, .shadow-xl {
              border-radius: 0 !important;
              box-shadow: none !important;
            }
            
            .print-hidden {
              display: none !important;
            }
            
            /* テーブルとレイアウトの最適化 */
            .compact-table td {
              padding: 2px 3px !important;
              font-size: 10px !important;
            }
            
            .table-row-expanded td {
              padding: 4px 5px !important;
              height: auto !important;
              min-height: 1.8em !important;
            }
            
            .compact-section {
              margin-bottom: 6px !important;
              page-break-inside: avoid;
            }
            
            .print-content {
              font-size: 10px !important;
              line-height: 1.1 !important;
            }
            
            /* グリッドレイアウトの調整 */
            .grid-cols-3 {
              grid-template-columns: repeat(3, 1fr) !important;
              gap: 4px !important;
            }
            
            .grid-cols-4 {
              grid-template-columns: repeat(4, 1fr) !important;
              gap: 3px !important;
            }
            
            /* チェックボックスの印刷時表示を確保 */
            .inline-block {
              display: inline-block !important;
            }
            
            .bg-black {
              background-color: black !important;
              -webkit-print-color-adjust: exact !important;
              color-adjust: exact !important;
            }
            
            .bg-gray-100 {
              background-color: #f3f4f6 !important;
              -webkit-print-color-adjust: exact !important;
              color-adjust: exact !important;
            }
            
            /* 境界線の強化 */
            .border-black {
              border-color: black !important;
            }
            
            /* 余白の調整 */
            .p-4 {
              padding: 8px !important;
            }
            
            .mb-2 {
              margin-bottom: 6px !important;
            }
            
            .mb-3 {
              margin-bottom: 8px !important;
            }
          }
        `}</style>

        {/* 印刷コンテンツ */}
        <div className="print-content p-4 bg-white text-xs">
          {/* ヘッダー部分 */}
          <div className="text-center mb-3">
            <h1 className="text-lg font-bold mb-1">サービス実施記録票</h1>
            <div className="text-xs">
              <span>事業所名：さくらケアサービス</span>
            </div>
          </div>

          {/* 基本情報 */}
          <div className="border border-black mb-2">
            <table className="w-full text-xs compact-table">
              <tbody>
                <tr style={{height: '50px'}}>
                  <td className="border-r border-black p-1 bg-gray-100 font-medium" style={{width: '60px'}}>利用者名</td>
                  <td className="border-r border-black p-1" style={{width: '80px'}}>{record.user_name}様</td>
                  <td className="border-r border-black p-1 bg-gray-100 font-medium" style={{width: '90px'}}>サービス実施日</td>
                  <td className="border-r border-black p-1" style={{width: '100px'}}>{formatDate(record.service_date)}</td>
                  <td className="border-r border-black p-1 bg-gray-100 font-medium" style={{width: '90px'}}>提供ヘルパー名</td>
                  <td className="border-r border-black p-1" style={{width: '70px'}}>{record.staff_name}</td>
                  <td className="border-r border-black p-1 bg-gray-100 font-medium" style={{width: '90px'}}>利用者確認印</td>
                  <td className="p-1 text-center" style={{width: '60px'}}></td>
                </tr>
                <tr className="border-t border-black" style={{height: '50px'}}>
                  <td className="border-r border-black p-1 bg-gray-100 font-medium" style={{width: '72px'}}>サービス時間</td>
                  <td className="border-r border-black p-1" style={{width: '140px'}}>{formatTime(record.start_time)}～{formatTime(record.end_time)}</td>
                  <td className="border-r border-black p-1 bg-gray-100 font-medium" style={{width: '90px'}}>サービス種類</td>
                  <td className="border-r border-black p-1" style={{width: '100px'}}>{getServiceTypeDisplayName(record)}</td>
                  <td className="border-r border-black p-1 bg-gray-100 font-medium" style={{width: '90px'}}>記録作成日時</td>
                  <td className="border-r border-black p-1" style={{width: '150px'}}>{record.record_created_at ? new Date(record.record_created_at).toLocaleString('ja-JP') : ''}</td>
                  <td className="border-r border-black p-1 bg-gray-100 font-medium" style={{width: '90px'}}>責任者確認印</td>
                  <td className="p-1 text-center" style={{width: '60px'}}></td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 上段：事前チェック・排泄介助・食事介助 */}
          <div className="grid grid-cols-3 gap-2 mb-2">
            {/* 事前チェック */}
            <div className="border border-black compact-section">
              <div className="bg-gray-100 p-1 border-b border-black font-medium text-xs">事前チェック</div>
              <div className="p-2">
                <div className="mb-1 text-xs">
                  <div className="flex items-center mb-1">
                    <span className="flex items-center">
                      <span className={`inline-block w-2 h-2 border border-black mr-1 ${details.pre_check?.health_check ? 'bg-black' : ''}`}></span>
                      健康チェック
                    </span>
                  </div>
                  <div className="ml-4">
                    <div className="flex items-center space-x-2 mb-1">
                      <span>体温</span>
                      <span className="border-b border-black px-1 min-w-8 text-center text-xs">
                        {details.pre_check?.temperature || '　'}
                      </span>
                      <span>°C</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span>血圧</span>
                      <span className="border-b border-black px-1 min-w-12 text-center text-xs">
                        {details.pre_check?.blood_pressure || '　／　'}
                      </span>
                      <span>・脈拍</span>
                      <span className="border-b border-black px-1 min-w-8 text-center text-xs">
                        {details.pre_check?.pulse || '　'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex space-x-3 text-xs">
                  <span className="flex items-center">
                    <span className={`inline-block w-2 h-2 border border-black mr-1 ${details.pre_check?.environment_setup ? 'bg-black' : ''}`}></span>
                    環境整備
                  </span>
                  <span className="flex items-center">
                    <span className={`inline-block w-2 h-2 border border-black mr-1 ${details.pre_check?.consultation_record ? 'bg-black' : ''}`}></span>
                    相談援助、記録等
                  </span>
                </div>
              </div>
            </div>

            {/* 排泄介助 */}
            <div className="border border-black compact-section">
              <div className="bg-gray-100 p-1 border-b border-black font-medium text-xs">排泄介助</div>
              <div className="p-2">
                <div className="grid grid-cols-2 gap-1 mb-1 text-xs">
                  <span className="flex items-center">
                    <span className={`inline-block w-2 h-2 border border-black mr-1 ${details.excretion?.toilet_assistance ? 'bg-black' : ''}`}></span>
                    トイレ
                  </span>
                  <span className="flex items-center">
                    <span className={`inline-block w-2 h-2 border border-black mr-1 ${details.excretion?.portable_toilet ? 'bg-black' : ''}`}></span>
                    ポータブル
                  </span>
                  <span className="flex items-center">
                    <span className={`inline-block w-2 h-2 border border-black mr-1 ${details.excretion?.urinal ? 'bg-black' : ''}`}></span>
                    尿器
                  </span>
                  <span className="flex items-center">
                    <span className={`inline-block w-2 h-2 border border-black mr-1 ${details.excretion?.diaper_change ? 'bg-black' : ''}`}></span>
                    おむつ交換
                  </span>
                  <span className="flex items-center">
                    <span className={`inline-block w-2 h-2 border border-black mr-1 ${details.excretion?.pad_change ? 'bg-black' : ''}`}></span>
                    パッド交換
                  </span>
                  <span className="flex items-center">
                    <span className={`inline-block w-2 h-2 border border-black mr-1 ${details.excretion?.cleaning ? 'bg-black' : ''}`}></span>
                    洗浄・清拭
                  </span>
                </div>
                <div className="flex space-x-3 text-xs">
                  <span className="flex items-center">
                    <span className={`inline-block w-2 h-2 border border-black mr-1`}></span>
                    排便（<span className="border-b border-black px-1 min-w-4 text-center">{details.excretion?.bowel_movement_count || '　'}</span>回）
                  </span>
                  <span className="flex items-center">
                    <span className={`inline-block w-2 h-2 border border-black mr-1`}></span>
                    排尿（<span className="border-b border-black px-1 min-w-4 text-center">{details.excretion?.urination_count || '　'}</span>回）
                  </span>
                </div>
              </div>
            </div>

            {/* 食事介助 */}
            <div className="border border-black compact-section">
              <div className="bg-gray-100 p-1 border-b border-black font-medium text-xs">食事介助</div>
              <div className="p-2">
                <div className="grid grid-cols-2 gap-1 mb-1 text-xs">
                  <span className="flex items-center">
                    <span className={`inline-block w-2 h-2 border border-black mr-1 ${details.meal?.full_assistance ? 'bg-black' : ''}`}></span>
                    全介助
                  </span>
                  <span className="flex items-center">
                    <span className={`inline-block w-2 h-2 border border-black mr-1 ${details.meal?.partial_assistance ? 'bg-black' : ''}`}></span>
                    一部介助
                  </span>
                  <span className="flex items-center">
                    <span className={`inline-block w-2 h-2 border border-black mr-1 ${details.meal?.supervision ? 'bg-black' : ''}`}></span>
                    見守り介助
                  </span>
                  <span className="flex items-center">
                    <span className={`inline-block w-2 h-2 border border-black mr-1 ${details.meal?.special_cooking ? 'bg-black' : ''}`}></span>
                    特段調理
                  </span>
                  <span className="flex items-center">
                    <span className={`inline-block w-2 h-2 border border-black mr-1 ${details.meal?.liquid_food ? 'bg-black' : ''}`}></span>
                    流動食
                  </span>
                  <span className="flex items-center">
                    <span className={`inline-block w-2 h-2 border border-black mr-1 ${details.meal?.thickened_food ? 'bg-black' : ''}`}></span>
                    とろみ
                  </span>
                  <span className="flex items-center">
                    <span className={`inline-block w-2 h-2 border border-black mr-1 ${details.meal?.blended_food ? 'bg-black' : ''}`}></span>
                    ミキサー食
                  </span>
                  <span className="flex items-center">
                    <span className={`inline-block w-2 h-2 border border-black mr-1 ${details.meal?.chopped_food ? 'bg-black' : ''}`}></span>
                    きざみ食
                  </span>
                </div>
                <div className="flex items-center space-x-2 mb-1 text-xs">
                  <span className="flex items-center">
                    <span className={`inline-block w-2 h-2 border border-black mr-1 ${details.meal?.completion_status === '完食' ? 'bg-black' : ''}`}></span>
                    完食
                  </span>
                  <span className="flex items-center">
                    <span className={`inline-block w-2 h-2 border border-black mr-1 ${details.meal?.completion_status === '残量あり' ? 'bg-black' : ''}`}></span>
                    残量（<span className="border-b border-black px-1 min-w-8 text-center">{details.meal?.remaining_amount || '　'}</span>）
                  </span>
                </div>
                <div className="flex items-center text-xs">
                  <span className={`inline-block w-2 h-2 border border-black mr-1`}></span>
                  水分補給（<span className="border-b border-black px-1 min-w-8 text-center">{details.meal?.water_intake || '　'}</span>cc）
                </div>
              </div>
            </div>
          </div>

          {/* 中段：身体清拭・入浴・身体整容・移乗移動 */}
          <div className="grid grid-cols-4 gap-2 mb-2">
            {/* 身体清拭・入浴 */}
            <div className="border border-black compact-section">
              <div className="bg-gray-100 p-1 border-b border-black font-medium text-xs">身体清拭・入浴</div>
              <div className="p-2">
                <div className="space-y-1 text-xs">
                  <span className="flex items-center">
                    <span className={`inline-block w-2 h-2 border border-black mr-1`}></span>
                    清拭（
                    <span className={`inline-block w-2 h-2 border border-black mx-1 ${details.body_care?.body_wipe === '全身' ? 'bg-black' : ''}`}></span>
                    全身
                    <span className={`inline-block w-2 h-2 border border-black mx-1 ${details.body_care?.body_wipe === '部分' ? 'bg-black' : ''}`}></span>
                    部分）
                  </span>
                  <span className="flex items-center">
                    <span className={`inline-block w-2 h-2 border border-black mr-1 ${details.body_care?.genital_wash ? 'bg-black' : ''}`}></span>
                    陰洗
                  </span>
                  <span className="flex items-center">
                    <span className={`inline-block w-2 h-2 border border-black mr-1`}></span>
                    全身入浴（
                    <span className={`inline-block w-2 h-2 border border-black mx-1 ${details.body_care?.full_body_bath_tub ? 'bg-black' : ''}`}></span>
                    浴槽
                    <span className={`inline-block w-2 h-2 border border-black mx-1 ${details.body_care?.full_body_bath_shower ? 'bg-black' : ''}`}></span>
                    シャワー）
                  </span>
                  <span className="flex items-center">
                    <span className={`inline-block w-2 h-2 border border-black mr-1`}></span>
                    部分浴（
                    <span className={`inline-block w-2 h-2 border border-black mx-1 ${details.body_care?.partial_bath_hand ? 'bg-black' : ''}`}></span>
                    手・
                    <span className={`inline-block w-2 h-2 border border-black mx-1 ${details.body_care?.partial_bath_foot ? 'bg-black' : ''}`}></span>
                    足）
                  </span>
                  <span className="flex items-center">
                    <span className={`inline-block w-2 h-2 border border-black mr-1 ${details.body_care?.hair_wash ? 'bg-black' : ''}`}></span>
                    洗髪
                  </span>
                  <span className="flex items-center">
                    <span className={`inline-block w-2 h-2 border border-black mr-1 ${details.body_care?.face_wash ? 'bg-black' : ''}`}></span>
                    洗面
                  </span>
                  <span className="flex items-center">
                    <span className={`inline-block w-2 h-2 border border-black mr-1 ${details.body_care?.grooming ? 'bg-black' : ''}`}></span>
                    整容
                  </span>
                  <span className="flex items-center">
                    <span className={`inline-block w-2 h-2 border border-black mr-1 ${details.body_care?.oral_care ? 'bg-black' : ''}`}></span>
                    口腔ケア
                  </span>
                </div>
              </div>
            </div>

            {/* 身体整容 */}
            <div className="border border-black compact-section">
              <div className="bg-gray-100 p-1 border-b border-black font-medium text-xs">身体整容</div>
              <div className="p-2">
                <div className="space-y-1 text-xs">
                  <span className="flex items-center">
                    <span className={`inline-block w-2 h-2 border border-black mr-1`}></span>
                    爪切り（
                    <span className={`inline-block w-2 h-2 border border-black mx-1 ${details.body_grooming?.nail_care_hand ? 'bg-black' : ''}`}></span>
                    手
                    <span className={`inline-block w-2 h-2 border border-black mx-1 ${details.body_grooming?.nail_care_foot ? 'bg-black' : ''}`}></span>
                    足）
                  </span>
                  <span className="flex items-center">
                    <span className={`inline-block w-2 h-2 border border-black mr-1 ${details.body_grooming?.clothing_assistance ? 'bg-black' : ''}`}></span>
                    更衣介助
                  </span>
                  <span className="flex items-center">
                    <span className={`inline-block w-2 h-2 border border-black mr-1 ${details.body_grooming?.hair_styling ? 'bg-black' : ''}`}></span>
                    整髪
                  </span>
                </div>
              </div>
            </div>

            {/* 移乗・移動 */}
            <div className="border border-black compact-section">
              <div className="bg-gray-100 p-1 border-b border-black font-medium text-xs">移乗・移動</div>
              <div className="p-2">
                <div className="space-y-1 text-xs">
                  <span className="flex items-center">
                    <span className={`inline-block w-2 h-2 border border-black mr-1 ${details.transfer_movement?.transfer_assistance ? 'bg-black' : ''}`}></span>
                    移乗介助
                  </span>
                  <span className="flex items-center">
                    <span className={`inline-block w-2 h-2 border border-black mr-1 ${details.transfer_movement?.movement_assistance ? 'bg-black' : ''}`}></span>
                    移動介助
                  </span>
                  <span className="flex items-center">
                    <span className={`inline-block w-2 h-2 border border-black mr-1 ${details.transfer_movement?.outing_assistance ? 'bg-black' : ''}`}></span>
                    外出介助
                  </span>
                  <span className="flex items-center">
                    <span className={`inline-block w-2 h-2 border border-black mr-1 ${details.transfer_movement?.outing_preparation ? 'bg-black' : ''}`}></span>
                    外出用意
                  </span>
                  <span className="flex items-center">
                    <span className={`inline-block w-2 h-2 border border-black mr-1 ${details.transfer_movement?.position_change ? 'bg-black' : ''}`}></span>
                    体位変換
                  </span>
                  <div className="mt-2">
                    <div className="font-medium text-xs mb-1">デイ送迎</div>
                    <div className="grid grid-cols-3 gap-1 ml-2">
                      <span className="flex items-center">
                        <span className={`inline-block w-2 h-2 border border-black mr-1 ${details.transfer_movement?.day_service_preparation ? 'bg-black' : ''}`}></span>
                        用意
                      </span>
                      <span className="flex items-center">
                        <span className={`inline-block w-2 h-2 border border-black mr-1 ${details.transfer_movement?.day_service_send ? 'bg-black' : ''}`}></span>
                        送り
                      </span>
                      <span className="flex items-center">
                        <span className={`inline-block w-2 h-2 border border-black mr-1 ${details.transfer_movement?.day_service_pickup ? 'bg-black' : ''}`}></span>
                        迎え
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 起床・就寝・服薬 */}
            <div className="border border-black compact-section">
              <div className="bg-gray-100 p-1 border-b border-black font-medium text-xs">起床・就寝・服薬</div>
              <div className="p-2">
                <div className="space-y-1 text-xs">
                  <span className="flex items-center">
                    <span className={`inline-block w-2 h-2 border border-black mr-1 ${details.sleep_wake?.wake_assistance ? 'bg-black' : ''}`}></span>
                    起床介助
                  </span>
                  <span className="flex items-center">
                    <span className={`inline-block w-2 h-2 border border-black mr-1 ${details.sleep_wake?.sleep_assistance ? 'bg-black' : ''}`}></span>
                    就寝介助
                  </span>
                  <span className="flex items-center">
                    <span className={`inline-block w-2 h-2 border border-black mr-1 ${details.medication?.medication_assistance ? 'bg-black' : ''}`}></span>
                    服薬介助
                  </span>
                  <span className="flex items-center">
                    <span className={`inline-block w-2 h-2 border border-black mr-1 ${details.medication?.medication_confirmation ? 'bg-black' : ''}`}></span>
                    確認
                  </span>
                  <span className="flex items-center">
                    <span className={`inline-block w-2 h-2 border border-black mr-1 ${details.medication?.ointment_eye_drops ? 'bg-black' : ''}`}></span>
                    軟膏・湿布・目薬
                  </span>
                  <span className="flex items-center">
                    <span className={`inline-block w-2 h-2 border border-black mr-1 ${details.medication?.suppository ? 'bg-black' : ''}`}></span>
                    坐薬
                  </span>
                  <span className="flex items-center">
                    <span className={`inline-block w-2 h-2 border border-black mr-1 ${details.medication?.sputum_suction ? 'bg-black' : ''}`}></span>
                    痰吸引
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 下段：自立支援・生活援助・退出確認 */}
          <div className="grid grid-cols-3 gap-2 mb-2">
            {/* 自立支援 */}
            <div className="border border-black compact-section">
              <div className="bg-gray-100 p-1 border-b border-black font-medium text-xs">自立支援</div>
              <div className="p-2">
                <div className="space-y-1 text-xs">
                  <span className="flex items-center">
                    <span className={`inline-block w-2 h-2 border border-black mr-1 ${details.self_support?.cooking_together ? 'bg-black' : ''}`}></span>
                    共に行う調理
                  </span>
                  <span className="flex items-center">
                    <span className={`inline-block w-2 h-2 border border-black mr-1 ${details.self_support?.safety_monitoring ? 'bg-black' : ''}`}></span>
                    安全の見守り
                  </span>
                  <span className="flex items-center">
                    <span className={`inline-block w-2 h-2 border border-black mr-1 ${details.self_support?.housework_together ? 'bg-black' : ''}`}></span>
                    共に行う家事
                  </span>
                  <span className="flex items-center">
                    <span className={`inline-block w-2 h-2 border border-black mr-1 ${details.self_support?.motivation_support ? 'bg-black' : ''}`}></span>
                    意欲・関心の引き出し
                  </span>
                </div>
              </div>
            </div>

            {/* 生活援助 */}
            <div className="border border-black compact-section">
              <div className="bg-gray-100 p-1 border-b border-black font-medium text-xs">生活援助</div>
              <div className="p-2 space-y-1 text-xs">
                {/* 清掃 */}
                <div>
                  <div className="font-medium text-xs mb-1">清掃</div>
                  <div className="grid grid-cols-2 gap-1 ml-2">
                    <span className="flex items-center">
                      <span className={`inline-block w-2 h-2 border border-black mr-1 ${details.life_support?.cleaning?.room_cleaning ? 'bg-black' : ''}`}></span>
                      居宅
                    </span>
                    <span className="flex items-center">
                      <span className={`inline-block w-2 h-2 border border-black mr-1 ${details.life_support?.cleaning?.toilet_cleaning ? 'bg-black' : ''}`}></span>
                      トイレ
                    </span>
                    <span className="flex items-center">
                      <span className={`inline-block w-2 h-2 border border-black mr-1 ${details.life_support?.cleaning?.table_cleaning ? 'bg-black' : ''}`}></span>
                      卓上掃除
                    </span>
                    <span className="flex items-center">
                      <span className={`inline-block w-2 h-2 border border-black mr-1 ${details.life_support?.cleaning?.garbage_disposal ? 'bg-black' : ''}`}></span>
                      ゴミ出し
                    </span>
                  </div>
                </div>

                {/* 洗濯 */}
                <div>
                  <div className="font-medium text-xs mb-1">洗濯</div>
                  <div className="grid grid-cols-2 gap-1 ml-2">
                    <span className="flex items-center">
                      <span className={`inline-block w-2 h-2 border border-black mr-1 ${details.life_support?.laundry?.washing_drying ? 'bg-black' : ''}`}></span>
                      洗濯乾燥
                    </span>
                    <span className="flex items-center">
                      <span className={`inline-block w-2 h-2 border border-black mr-1 ${details.life_support?.laundry?.ironing ? 'bg-black' : ''}`}></span>
                      アイロン掛け
                    </span>
                  </div>
                </div>

                {/* 買い物等 */}
                <div>
                  <div className="font-medium text-xs mb-1">買い物等</div>
                  <div className="grid grid-cols-2 gap-1 ml-2">
                    <span className="flex items-center">
                      <span className={`inline-block w-2 h-2 border border-black mr-1 ${details.life_support?.shopping?.daily_items ? 'bg-black' : ''}`}></span>
                      日常品等の買い物
                    </span>
                    <span className="flex items-center">
                      <span className={`inline-block w-2 h-2 border border-black mr-1 ${details.life_support?.shopping?.medicine_pickup ? 'bg-black' : ''}`}></span>
                      薬の受取り
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 退出確認 */}
            <div className="border border-black compact-section">
              <div className="bg-gray-100 p-1 border-b border-black font-medium text-xs">退出確認</div>
              <div className="p-2">
                <div className="grid grid-cols-2 gap-1 text-xs">
                  <span className="flex items-center">
                    <span className={`inline-block w-2 h-2 border border-black mr-1 ${details.exit_check?.fire_check ? 'bg-black' : ''}`}></span>
                    火元
                  </span>
                  <span className="flex items-center">
                    <span className={`inline-block w-2 h-2 border border-black mr-1 ${details.exit_check?.electricity_check ? 'bg-black' : ''}`}></span>
                    電気
                  </span>
                  <span className="flex items-center">
                    <span className={`inline-block w-2 h-2 border border-black mr-1 ${details.exit_check?.water_check ? 'bg-black' : ''}`}></span>
                    水道
                  </span>
                  <span className="flex items-center">
                    <span className={`inline-block w-2 h-2 border border-black mr-1 ${details.exit_check?.door_lock_check ? 'bg-black' : ''}`}></span>
                    戸締まり
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 特記事項 */}
          <div className="border border-black mb-2">
            <div className="bg-gray-100 p-1 border-b border-black font-medium text-xs">特記・連絡事項</div>
            <div className="p-2 min-h-12">
              <div className="whitespace-pre-wrap text-xs">
                {cleanSpecialNotes(record.special_notes) || '　'}
              </div>
            </div>
          </div>

          {/* フッター */}
          <div className="mt-2 text-xs text-gray-500 text-center">
            印刷日時: {new Date().toLocaleString('ja-JP')}
          </div>
        </div>
      </div>
    </div>
  );
}