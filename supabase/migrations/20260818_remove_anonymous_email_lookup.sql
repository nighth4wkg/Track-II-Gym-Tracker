-- Track username privacy hardening.
-- Username sign-in and recovery are handled by the rate-limited username-auth
-- Edge Function. No browser or anonymous database caller needs account email.

drop function if exists public.lookup_login_email(text);
