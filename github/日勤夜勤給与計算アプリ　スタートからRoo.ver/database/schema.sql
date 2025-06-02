-- 日勤夜勤給与計算アプリのデータベーススキーマ

-- ① 従業員管理テーブル
create table employees (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  allowance_pct numeric not null check (allowance_pct >= 0),
  display_start date not null,          -- 例: '2025-04-01'
  display_end   date not null,          -- 月末日を保存
  deleted_at    timestamptz
);

-- ② 勤務データテーブル
create table shifts (
  id            uuid primary key default gen_random_uuid(),
  employee_id   uuid references employees(id) on delete restrict,
  duty_type     text check (duty_type in ('day','night')),
  work_date     date not null,
  start_ts      timestamptz not null,
  end_ts        timestamptz not null,
  created_by    uuid,   -- user_id
  created_at    timestamptz default now()
);

-- ③ 締め情報テーブル
create table payroll_closing (
  year_month    text primary key,  -- '2025-04'
  closed_by     uuid,
  closed_at     timestamptz default now()
);

-- ④ 監査ログテーブル
create table audit_log (
  id            bigint generated always as identity,
  event         text,
  payload       jsonb,
  actor_id      uuid,
  created_at    timestamptz default now()
);

-- RLSポリシーの設定
-- テーブルのRLSを有効化
alter table employees enable row level security;
alter table shifts enable row level security;
alter table payroll_closing enable row level security;
alter table audit_log enable row level security;

-- 認証済みユーザーのみアクセス可能にする
create policy "authenticated_can_read_employees" on employees
  for select using (auth.role() = 'authenticated');

create policy "authenticated_can_insert_employees" on employees
  for insert with check (auth.role() = 'authenticated');

create policy "authenticated_can_update_employees" on employees
  for update using (auth.role() = 'authenticated');

create policy "authenticated_can_delete_employees" on employees
  for delete using (auth.role() = 'authenticated');

-- shifts：work_dateが締め済み月の場合は書込拒否
create policy "shifts_insert_policy" on shifts
  for insert
  with check (
    auth.role() = 'authenticated' and
    not exists (
      select 1 from payroll_closing
      where year_month = to_char(work_date, 'YYYY-MM')
    )
  );

create policy "shifts_update_policy" on shifts
  for update
  using (
    auth.role() = 'authenticated' and
    not exists (
      select 1 from payroll_closing
      where year_month = to_char(work_date, 'YYYY-MM')
    )
  );

create policy "shifts_delete_policy" on shifts
  for delete
  using (
    auth.role() = 'authenticated' and
    not exists (
      select 1 from payroll_closing
      where year_month = to_char(work_date, 'YYYY-MM')
    )
  );

create policy "shifts_select_policy" on shifts
  for select using (auth.role() = 'authenticated');

-- employees：表示期間内のみ表示（退職者を含む場合は除外）
create policy "employees_select_policy" on employees
  for select
  using (
    auth.role() = 'authenticated' and
    (
      (display_start <= current_date and display_end >= current_date)
      or (deleted_at is null)
    )
  );

-- payroll_closing：認証済みユーザーのみアクセス可能
create policy "authenticated_can_read_payroll_closing" on payroll_closing
  for select using (auth.role() = 'authenticated');

create policy "authenticated_can_insert_payroll_closing" on payroll_closing
  for insert with check (auth.role() = 'authenticated');

create policy "authenticated_can_delete_payroll_closing" on payroll_closing
  for delete using (auth.role() = 'authenticated');

-- audit_log：認証済みユーザーのみアクセス可能
create policy "authenticated_can_read_audit_log" on audit_log
  for select using (auth.role() = 'authenticated');

create policy "authenticated_can_insert_audit_log" on audit_log
  for insert with check (auth.role() = 'authenticated');

-- サンプルデータの挿入
-- 従業員データ
insert into employees (name, allowance_pct, display_start, display_end)
values
  ('山田 太郎', 10, '2024-04-01', '2025-03-31'),
  ('佐藤 花子', 15, '2024-04-01', '2025-03-31'),
  ('鈴木 一郎', 5, '2024-04-01', '2025-03-31');

-- 勤務データ（サンプル）
-- 実際のアプリケーションでは、フロントエンドから入力