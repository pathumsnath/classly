begin;

drop policy salary_payments_select on salary_payments;

create policy salary_payments_select on salary_payments for select
  using (
    institute_id = current_institute_id()
    and (current_app_role() = 'owner' or tutor_id = current_app_user_id())
  );

commit;
