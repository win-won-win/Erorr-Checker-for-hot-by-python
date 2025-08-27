/**
 * パターン紐付けサービス
 * 自動パターン紐付け、手動パターン紐付け、パターン候補提案機能を提供
 */

import {
  TimeSlotRecord,
  PatternLinkingCandidate,
  PatternLinkingResult,
  BulkPatternLinking,
  BulkOperationResult,
  PatternLinkingHistory,
  UnlinkedDataAnalysis,
  DailyDataManagementConfig,
  DailyDataManagementEvent,
  DailyDataManagementEventHandler,
  IDailyDataManagementService
} from '../types/dailyData';

import {
  ServicePattern,
  PatternDetails,
  PatternMatchResult,
  PatternMatchingCriteria
} from '../types/pattern';

import { patternService } from './patternService';

/**
 * パターン紐付けサービスクラス
 */
export class PatternLinkingService {
  private eventHandlers: DailyDataManagementEventHandler[] = [];
  private linkingHistory: PatternLinkingHistory[] = [];
  private config: DailyDataManagementConfig = {
    time_slot_duration: 60,
    auto_linking: {
      enabled: true,
      confidence_threshold: 0.7,
      require_confirmation: false
    },
    display: {
      show_confidence_scores: true,
      highlight_unlinked: true,
      group_by_user: false,
      show_pattern_suggestions: true
    },
    notifications: {
      unlinked_data_alert: true,
      low_confidence_warning: true,
      bulk_operation_confirmation: true
    }
  };

  /**
   * パターン候補を取得
   */
  async getPatternCandidates(record: TimeSlotRecord): Promise<PatternLinkingCandidate[]> {
    try {
      const patterns = await patternService.listPatterns();
      const candidates: PatternLinkingCandidate[] = [];

      for (const pattern of patterns) {
        const confidence = await this.calculatePatternConfidence(record, pattern);
        const matchingFactors = this.analyzeMatchingFactors(record, pattern);
        
        if (confidence > 0.3) { // 最低信頼度閾値
          candidates.push({
            record_id: record.id,
            pattern: pattern,
            confidence: confidence,
            matching_factors: matchingFactors,
            auto_apply_eligible: confidence >= this.config.auto_linking.confidence_threshold,
            reason: this.generateCandidateReason(matchingFactors, confidence)
          });
        }
      }

      // 信頼度順でソート
      candidates.sort((a, b) => b.confidence - a.confidence);
      
      return candidates.slice(0, 5); // 上位5件を返す
    } catch (error) {
      console.error('パターン候補取得エラー:', error);
      return [];
    }
  }

  /**
   * パターンの信頼度を計算
   */
  private async calculatePatternConfidence(record: TimeSlotRecord, pattern: ServicePattern): Promise<number> {
    let confidence = 0;
    let totalWeight = 0;

    // サービス内容の類似度 (重み: 0.4)
    const serviceWeight = 0.4;
    const serviceMatch = this.calculateServiceContentSimilarity(record.service_content, pattern);
    confidence += serviceMatch * serviceWeight;
    totalWeight += serviceWeight;

    // 時間帯の一致度 (重み: 0.3)
    const timeWeight = 0.3;
    const timeMatch = await this.calculateTimeMatch(record, pattern);
    confidence += timeMatch * timeWeight;
    totalWeight += timeWeight;

    // 利用者の履歴一致度 (重み: 0.2)
    const userWeight = 0.2;
    const userMatch = await this.calculateUserHistoryMatch(record.user_name, pattern);
    confidence += userMatch * userWeight;
    totalWeight += userWeight;

    // 曜日の一致度 (重み: 0.1)
    const dayWeight = 0.1;
    const dayMatch = this.calculateDayMatch(record, pattern);
    confidence += dayMatch * dayWeight;
    totalWeight += dayWeight;

    return totalWeight > 0 ? confidence / totalWeight : 0;
  }

  /**
   * サービス内容の類似度を計算
   */
  private calculateServiceContentSimilarity(serviceContent: string, pattern: ServicePattern): number {
    const keywords = this.extractServiceKeywords(serviceContent);
    const patternKeywords = this.extractPatternKeywords(pattern.pattern_details);
    
    if (keywords.length === 0 || patternKeywords.length === 0) {
      return 0;
    }

    const matchCount = keywords.filter(keyword => 
      patternKeywords.some(patternKeyword => 
        keyword.includes(patternKeyword) || patternKeyword.includes(keyword)
      )
    ).length;

    return matchCount / Math.max(keywords.length, patternKeywords.length);
  }

  /**
   * サービス内容からキーワードを抽出
   */
  private extractServiceKeywords(serviceContent: string): string[] {
    const keywords = [
      '排泄', '食事', '入浴', '清拭', '服薬', '移乗', '移動', '外出',
      '起床', '就寝', '清掃', '洗濯', '調理', '買い物', '見守り'
    ];
    
    return keywords.filter(keyword => serviceContent.includes(keyword));
  }

  /**
   * パターン詳細からキーワードを抽出
   */
  private extractPatternKeywords(patternDetails: PatternDetails): string[] {
    const keywords: string[] = [];
    
    if (patternDetails.excretion.toilet_assistance || patternDetails.excretion.diaper_change) {
      keywords.push('排泄');
    }
    if (patternDetails.meal.full_assistance) {
      keywords.push('食事');
    }
    if (patternDetails.body_care.full_body_bath) {
      keywords.push('入浴');
    }
    if (patternDetails.body_care.body_wipe) {
      keywords.push('清拭');
    }
    if (patternDetails.medication.medication_assistance) {
      keywords.push('服薬');
    }
    if (patternDetails.transfer_movement.transfer_assistance) {
      keywords.push('移乗');
    }
    if (patternDetails.transfer_movement.movement_assistance) {
      keywords.push('移動');
    }
    if (patternDetails.transfer_movement.outing_assistance) {
      keywords.push('外出');
    }
    if (patternDetails.sleep_wake.wake_assistance) {
      keywords.push('起床');
    }
    if (patternDetails.sleep_wake.sleep_assistance) {
      keywords.push('就寝');
    }
    if (patternDetails.life_support.cleaning.room_cleaning) {
      keywords.push('清掃');
    }
    if (patternDetails.life_support.laundry.washing_drying) {
      keywords.push('洗濯');
    }
    if (patternDetails.life_support.cooking.general_cooking) {
      keywords.push('調理');
    }
    if (patternDetails.life_support.shopping.daily_items) {
      keywords.push('買い物');
    }
    if (patternDetails.self_support.safety_monitoring) {
      keywords.push('見守り');
    }
    
    return keywords;
  }

  /**
   * 時間帯の一致度を計算
   */
  private async calculateTimeMatch(record: TimeSlotRecord, pattern: ServicePattern): Promise<number> {
    try {
      // 利用者時間パターンから該当パターンの時間帯を取得
      const userTimePatterns = await patternService.listUserTimePatterns({
        user_id: record.user_name, // 実際の実装では user_id を使用
        is_active: true
      });

      const matchingTimePatterns = userTimePatterns.filter(utp => utp.pattern_id === pattern.id);
      
      if (matchingTimePatterns.length === 0) {
        return 0.5; // デフォルト値
      }

      const recordStartHour = parseInt(record.start_time.split(':')[0]);
      
      for (const timePattern of matchingTimePatterns) {
        const patternStartHour = parseInt(timePattern.start_time.split(':')[0]);
        const hourDiff = Math.abs(recordStartHour - patternStartHour);
        
        if (hourDiff <= 1) {
          return 1.0; // 1時間以内の差なら完全一致
        } else if (hourDiff <= 2) {
          return 0.7; // 2時間以内なら高い一致度
        } else if (hourDiff <= 3) {
          return 0.4; // 3時間以内なら中程度の一致度
        }
      }
      
      return 0.2; // それ以外は低い一致度
    } catch (error) {
      console.error('時間一致度計算エラー:', error);
      return 0.5;
    }
  }

  /**
   * 利用者履歴の一致度を計算
   */
  private async calculateUserHistoryMatch(userName: string, pattern: ServicePattern): Promise<number> {
    try {
      const userTimePatterns = await patternService.listUserTimePatterns({
        user_id: userName, // 実際の実装では user_id を使用
        is_active: true
      });

      const hasUsedPattern = userTimePatterns.some(utp => utp.pattern_id === pattern.id);
      return hasUsedPattern ? 1.0 : 0.3;
    } catch (error) {
      console.error('利用者履歴一致度計算エラー:', error);
      return 0.5;
    }
  }

  /**
   * 曜日の一致度を計算
   */
  private calculateDayMatch(record: TimeSlotRecord, pattern: ServicePattern): number {
    // 実際の実装では、記録の日付から曜日を計算し、
    // パターンの設定曜日と比較する
    return 0.8; // 仮の値
  }

  /**
   * マッチング要因を分析
   */
  private analyzeMatchingFactors(record: TimeSlotRecord, pattern: ServicePattern): {
    user_match: boolean;
    time_match: boolean;
    day_match: boolean;
    service_match: boolean;
  } {
    return {
      user_match: true, // 実際の実装では詳細な分析を行う
      time_match: true,
      day_match: true,
      service_match: this.calculateServiceContentSimilarity(record.service_content, pattern) > 0.5
    };
  }

  /**
   * 候補理由を生成
   */
  private generateCandidateReason(matchingFactors: any, confidence: number): string {
    const reasons: string[] = [];
    
    if (matchingFactors.service_match) {
      reasons.push('サービス内容が一致');
    }
    if (matchingFactors.time_match) {
      reasons.push('時間帯が一致');
    }
    if (matchingFactors.user_match) {
      reasons.push('利用者履歴が一致');
    }
    if (matchingFactors.day_match) {
      reasons.push('曜日が一致');
    }

    if (confidence >= 0.8) {
      reasons.unshift('高い信頼度');
    } else if (confidence >= 0.6) {
      reasons.unshift('中程度の信頼度');
    }

    return reasons.length > 0 ? reasons.join('、') : '部分的な一致';
  }

  /**
   * パターンを紐付け
   */
  async linkPattern(recordId: string, patternId: string, method: 'auto' | 'manual' = 'manual'): Promise<PatternLinkingResult> {
    try {
      const pattern = await patternService.getPattern(patternId);
      if (!pattern) {
        return {
          record_id: recordId,
          pattern_id: null,
          success: false,
          confidence: 0,
          method: method,
          applied_at: new Date().toISOString(),
          error_message: 'パターンが見つかりません'
        };
      }

      // 実際の実装では、データベースの更新処理を行う
      const confidence = method === 'auto' ? 0.8 : 1.0; // 手動の場合は信頼度100%

      const result: PatternLinkingResult = {
        record_id: recordId,
        pattern_id: patternId,
        success: true,
        confidence: confidence,
        method: method,
        applied_at: new Date().toISOString()
      };

      // 履歴を記録
      this.addToHistory({
        id: Date.now().toString(),
        record_id: recordId,
        pattern_id: patternId,
        previous_pattern_id: null,
        operation: 'assign',
        method: method === 'auto' ? 'auto' : 'manual',
        confidence: confidence,
        timestamp: new Date().toISOString()
      });

      // イベントを発火
      this.emitEvent({
        type: 'pattern_assigned',
        payload: { record_id: recordId, pattern_id: patternId, confidence: confidence }
      });

      return result;
    } catch (error) {
      console.error('パターン紐付けエラー:', error);
      return {
        record_id: recordId,
        pattern_id: null,
        success: false,
        confidence: 0,
        method: method,
        applied_at: new Date().toISOString(),
        error_message: error instanceof Error ? error.message : '不明なエラー'
      };
    }
  }

  /**
   * パターンの紐付けを解除
   */
  async unlinkPattern(recordId: string): Promise<PatternLinkingResult> {
    try {
      // 実際の実装では、データベースの更新処理を行う
      
      const result: PatternLinkingResult = {
        record_id: recordId,
        pattern_id: null,
        success: true,
        confidence: 0,
        method: 'manual',
        applied_at: new Date().toISOString()
      };

      // 履歴を記録
      this.addToHistory({
        id: Date.now().toString(),
        record_id: recordId,
        pattern_id: null,
        previous_pattern_id: 'unknown', // 実際の実装では以前のパターンIDを記録
        operation: 'unassign',
        method: 'manual',
        confidence: 0,
        timestamp: new Date().toISOString()
      });

      // イベントを発火
      this.emitEvent({
        type: 'pattern_unassigned',
        payload: { record_id: recordId, previous_pattern_id: 'unknown' }
      });

      return result;
    } catch (error) {
      console.error('パターン紐付け解除エラー:', error);
      return {
        record_id: recordId,
        pattern_id: null,
        success: false,
        confidence: 0,
        method: 'manual',
        applied_at: new Date().toISOString(),
        error_message: error instanceof Error ? error.message : '不明なエラー'
      };
    }
  }

  /**
   * 一括パターン紐付け
   */
  async bulkLinkPatterns(operation: BulkPatternLinking): Promise<BulkOperationResult> {
    const results: PatternLinkingResult[] = [];
    const errors: { record_id: string; error_message: string }[] = [];
    let successful = 0;
    let failed = 0;

    for (const recordId of operation.record_ids) {
      try {
        let result: PatternLinkingResult;

        switch (operation.operation) {
          case 'assign':
            if (!operation.pattern_id) {
              throw new Error('パターンIDが指定されていません');
            }
            result = await this.linkPattern(recordId, operation.pattern_id, 'manual');
            break;
          case 'unassign':
            result = await this.unlinkPattern(recordId);
            break;
          case 'reassign':
            if (!operation.pattern_id) {
              throw new Error('パターンIDが指定されていません');
            }
            // まず解除してから紐付け
            await this.unlinkPattern(recordId);
            result = await this.linkPattern(recordId, operation.pattern_id, 'manual');
            break;
          default:
            throw new Error('不正な操作です');
        }

        results.push(result);
        if (result.success) {
          successful++;
        } else {
          failed++;
          if (result.error_message) {
            errors.push({ record_id: recordId, error_message: result.error_message });
          }
        }
      } catch (error) {
        failed++;
        errors.push({
          record_id: recordId,
          error_message: error instanceof Error ? error.message : '不明なエラー'
        });
      }
    }

    const bulkResult: BulkOperationResult = {
      total_processed: operation.record_ids.length,
      successful: successful,
      failed: failed,
      results: results,
      errors: errors,
      summary: {
        patterns_assigned: [],
        completion_rate_change: 0 // 実際の実装では計算する
      }
    };

    // イベントを発火
    this.emitEvent({
      type: 'bulk_operation_completed',
      payload: { operation: operation, result: bulkResult }
    });

    return bulkResult;
  }

  /**
   * 自動パターン紐付け
   */
  async autoLinkPatterns(records: TimeSlotRecord[]): Promise<BulkOperationResult> {
    if (!this.config.auto_linking.enabled) {
      throw new Error('自動紐付けが無効になっています');
    }

    const results: PatternLinkingResult[] = [];
    const errors: { record_id: string; error_message: string }[] = [];
    let successful = 0;
    let failed = 0;

    for (const record of records) {
      try {
        if (record.is_pattern_assigned) {
          continue; // 既に紐付け済みの場合はスキップ
        }

        const candidates = await this.getPatternCandidates(record);
        const bestCandidate = candidates.find(c => c.auto_apply_eligible);

        if (bestCandidate && bestCandidate.confidence >= this.config.auto_linking.confidence_threshold) {
          const result = await this.linkPattern(record.id, bestCandidate.pattern.id, 'auto');
          results.push(result);
          
          if (result.success) {
            successful++;
          } else {
            failed++;
            if (result.error_message) {
              errors.push({ record_id: record.id, error_message: result.error_message });
            }
          }
        }
      } catch (error) {
        failed++;
        errors.push({
          record_id: record.id,
          error_message: error instanceof Error ? error.message : '不明なエラー'
        });
      }
    }

    const bulkResult: BulkOperationResult = {
      total_processed: records.length,
      successful: successful,
      failed: failed,
      results: results,
      errors: errors,
      summary: {
        patterns_assigned: [],
        completion_rate_change: 0
      }
    };

    // イベントを発火
    this.emitEvent({
      type: 'auto_linking_completed',
      payload: { processed: records.length, assigned: successful }
    });

    return bulkResult;
  }

  /**
   * 未紐付けデータを分析
   */
  async analyzeUnlinkedData(records: TimeSlotRecord[]): Promise<UnlinkedDataAnalysis> {
    const unlinkedRecords = records.filter(record => !record.is_pattern_assigned);
    
    // 時間帯別分析
    const byTimeSlot = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      count: unlinkedRecords.filter(record => {
        const recordHour = parseInt(record.start_time.split(':')[0]);
        return recordHour === hour;
      }).length
    })).filter(slot => slot.count > 0);

    // 利用者別分析
    const userCounts = new Map<string, number>();
    unlinkedRecords.forEach(record => {
      const count = userCounts.get(record.user_name) || 0;
      userCounts.set(record.user_name, count + 1);
    });
    const byUser = Array.from(userCounts.entries()).map(([user_name, count]) => ({
      user_name,
      count
    }));

    // サービス種別分析
    const serviceTypeCounts = new Map<string, number>();
    unlinkedRecords.forEach(record => {
      const keywords = this.extractServiceKeywords(record.service_content);
      keywords.forEach(keyword => {
        const count = serviceTypeCounts.get(keyword) || 0;
        serviceTypeCounts.set(keyword, count + 1);
      });
    });
    const byServiceType = Array.from(serviceTypeCounts.entries()).map(([service_type, count]) => ({
      service_type,
      count
    }));

    // 一括紐付け候補を取得
    const bulkAssignmentCandidates: PatternLinkingCandidate[] = [];
    for (const record of unlinkedRecords.slice(0, 10)) { // 最初の10件のみ
      const candidates = await this.getPatternCandidates(record);
      if (candidates.length > 0) {
        bulkAssignmentCandidates.push(candidates[0]);
      }
    }

    const analysis: UnlinkedDataAnalysis = {
      date: records.length > 0 ? records[0].start_time.split('T')[0] : new Date().toISOString().split('T')[0],
      unlinked_records: unlinkedRecords,
      analysis: {
        total_unlinked: unlinkedRecords.length,
        by_time_slot: byTimeSlot,
        by_user: byUser,
        by_service_type: byServiceType
      },
      suggestions: {
        create_new_patterns: unlinkedRecords.length > 5 && byServiceType.length > 0,
        similar_patterns: [], // 実際の実装では類似パターンを検索
        bulk_assignment_candidates: bulkAssignmentCandidates
      }
    };

    // イベントを発火
    this.emitEvent({
      type: 'unlinked_data_detected',
      payload: { analysis }
    });

    return analysis;
  }

  /**
   * 履歴を追加
   */
  private addToHistory(history: PatternLinkingHistory): void {
    this.linkingHistory.push(history);
    // 実際の実装では、データベースに保存
  }

  /**
   * 紐付け履歴を取得
   */
  getPatternLinkingHistory(date: string): PatternLinkingHistory[] {
    return this.linkingHistory.filter(history => 
      history.timestamp.startsWith(date)
    );
  }

  /**
   * 設定を取得
   */
  getConfig(): DailyDataManagementConfig {
    return { ...this.config };
  }

  /**
   * 設定を更新
   */
  async updateConfig(config: Partial<DailyDataManagementConfig>): Promise<void> {
    this.config = { ...this.config, ...config };
    // 実際の実装では、設定をデータベースに保存
  }

  /**
   * イベントハンドラーを追加
   */
  addEventListener(handler: DailyDataManagementEventHandler): () => void {
    this.eventHandlers.push(handler);
    return () => {
      const index = this.eventHandlers.indexOf(handler);
      if (index > -1) {
        this.eventHandlers.splice(index, 1);
      }
    };
  }

  /**
   * イベントハンドラーを削除
   */
  removeEventListener(handler: DailyDataManagementEventHandler): void {
    const index = this.eventHandlers.indexOf(handler);
    if (index > -1) {
      this.eventHandlers.splice(index, 1);
    }
  }

  /**
   * イベントを発火
   */
  private emitEvent(event: DailyDataManagementEvent): void {
    this.eventHandlers.forEach(handler => {
      try {
        handler(event);
      } catch (error) {
        console.error('イベントハンドラーエラー:', error);
      }
    });
  }
}

// シングルトンインスタンス
export const patternLinkingService = new PatternLinkingService();