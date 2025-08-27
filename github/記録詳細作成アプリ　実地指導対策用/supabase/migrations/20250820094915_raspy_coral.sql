/*
  # デフォルトサービスパターンの挿入

  1. Default Patterns
    - 排泄介助＋食事介助
    - 入浴介助＋水分補給
    - 清拭＋服薬介助
    - 移乗介助＋環境整備
    - 起床介助＋健康チェック
*/

INSERT INTO service_patterns (pattern_name, pattern_details, description) VALUES
(
  '排泄介助＋食事介助',
  '{
    "pre_check": {
      "health_check": true,
      "environment_setup": false,
      "consultation_record": false
    },
    "excretion": {
      "toilet_assistance": true,
      "portable_toilet": false,
      "diaper_change": true,
      "pad_change": false,
      "cleaning": true,
      "bowel_movement_count": 1,
      "urination_count": 2
    },
    "meal": {
      "full_assistance": true,
      "completion_status": "完食",
      "water_intake": 200
    },
    "body_care": {},
    "body_grooming": {},
    "transfer_movement": {},
    "sleep_wake": {},
    "medication": {},
    "self_support": {},
    "life_support": {},
    "exit_check": {
      "fire_check": true,
      "electricity_check": true,
      "water_check": true,
      "door_lock_check": true
    }
  }',
  '排泄介助と食事介助を組み合わせた基本的なケアパターン'
),
(
  '入浴介助＋水分補給',
  '{
    "pre_check": {
      "health_check": true,
      "environment_setup": true,
      "consultation_record": false
    },
    "excretion": {},
    "meal": {
      "water_intake": 300
    },
    "body_care": {
      "full_body_bath": true,
      "hair_wash": true,
      "face_wash": true,
      "grooming": true,
      "oral_care": true
    },
    "body_grooming": {
      "clothing_assistance": true
    },
    "transfer_movement": {
      "transfer_assistance": true
    },
    "sleep_wake": {},
    "medication": {},
    "self_support": {
      "safety_monitoring": true
    },
    "life_support": {},
    "exit_check": {
      "fire_check": true,
      "electricity_check": true,
      "water_check": true,
      "door_lock_check": true
    }
  }',
  '入浴介助と水分補給を中心としたケアパターン'
),
(
  '清拭＋服薬介助',
  '{
    "pre_check": {
      "health_check": true,
      "environment_setup": false,
      "consultation_record": true
    },
    "excretion": {},
    "meal": {},
    "body_care": {
      "body_wipe": "全身",
      "face_wash": true,
      "oral_care": true
    },
    "body_grooming": {
      "clothing_assistance": true
    },
    "transfer_movement": {},
    "sleep_wake": {},
    "medication": {
      "medication_assistance": true,
      "ointment_eye_drops": false
    },
    "self_support": {
      "safety_monitoring": true
    },
    "life_support": {},
    "exit_check": {
      "fire_check": true,
      "electricity_check": true,
      "water_check": true,
      "door_lock_check": true
    }
  }',
  '清拭と服薬介助を組み合わせたケアパターン'
),
(
  '移乗介助＋環境整備',
  '{
    "pre_check": {
      "health_check": false,
      "environment_setup": true,
      "consultation_record": false
    },
    "excretion": {},
    "meal": {},
    "body_care": {},
    "body_grooming": {},
    "transfer_movement": {
      "transfer_assistance": true,
      "movement_assistance": true,
      "position_change": true
    },
    "sleep_wake": {},
    "medication": {},
    "self_support": {
      "safety_monitoring": true
    },
    "life_support": {
      "cleaning": {
        "room_cleaning": true,
        "toilet_cleaning": false,
        "table_cleaning": true
      },
      "preparation_cleanup": true
    },
    "exit_check": {
      "fire_check": true,
      "electricity_check": true,
      "water_check": true,
      "door_lock_check": true
    }
  }',
  '移乗介助と環境整備を中心としたケアパターン'
),
(
  '起床介助＋健康チェック',
  '{
    "pre_check": {
      "health_check": true,
      "environment_setup": false,
      "consultation_record": true
    },
    "excretion": {},
    "meal": {},
    "body_care": {
      "face_wash": true,
      "grooming": true
    },
    "body_grooming": {
      "clothing_assistance": true
    },
    "transfer_movement": {},
    "sleep_wake": {
      "wake_assistance": true
    },
    "medication": {},
    "self_support": {
      "safety_monitoring": true,
      "motivation_support": true
    },
    "life_support": {},
    "exit_check": {
      "fire_check": true,
      "electricity_check": true,
      "water_check": true,
      "door_lock_check": true
    }
  }',
  '起床介助と健康チェックを組み合わせた朝のケアパターン'
);