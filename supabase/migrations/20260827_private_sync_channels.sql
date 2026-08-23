-- Realtime broadcast channels are private and scoped to one authenticated
-- user's UUID. This prevents one signed-in client from joining another
-- user's sync stream or spoofing their workout updates.

drop policy if exists "Track users can receive their own sync messages" on realtime.messages;
create policy "Track users can receive their own sync messages"
  on realtime.messages
  for select
  to authenticated
  using (realtime.topic() = 'track-sync-' || (select auth.uid()::text));

drop policy if exists "Track users can send their own sync messages" on realtime.messages;
create policy "Track users can send their own sync messages"
  on realtime.messages
  for insert
  to authenticated
  with check (realtime.topic() = 'track-sync-' || (select auth.uid()::text));
