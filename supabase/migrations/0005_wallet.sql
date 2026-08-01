begin;

alter type payment_method add value 'wallet_credit';

create table wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references institutes(id) on delete cascade,
  student_id uuid not null references users(id) on delete cascade,
  amount numeric(10, 2) not null check (amount > 0),
  type text not null check (type in ('credit', 'debit')),
  payment_id uuid references payments(id),
  note text,
  recorded_by uuid not null references users(id),
  created_at timestamptz not null default now()
);
create index wallet_transactions_student_idx on wallet_transactions (institute_id, student_id);

alter table wallet_transactions enable row level security;

create policy wallet_transactions_select on wallet_transactions for select
  using (institute_id = current_institute_id());

create policy wallet_transactions_insert on wallet_transactions for insert
  with check (institute_id = current_institute_id() and current_app_role() in ('owner', 'admin_staff'));

commit;
