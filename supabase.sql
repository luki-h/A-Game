-- Run in the SQL Editor of your Supabase project.
create table public.money_press_scores (
  user_id uuid primary key references auth.users (id) on delete cascade,
  bank_name text not null check (char_length(bank_name) between 1 and 32),
  bill_clicks bigint not null check (bill_clicks between 0 and 9007199254740991)
);

alter table public.money_press_scores enable row level security;
revoke all on public.money_press_scores from anon, authenticated;
grant select (bank_name, bill_clicks) on public.money_press_scores to anon;
grant select, insert, update on public.money_press_scores to authenticated;

create policy "Read rankings"
  on public.money_press_scores for select to anon, authenticated
  using (true);

create policy "Post own score"
  on public.money_press_scores for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Update own score"
  on public.money_press_scores for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
