# Security

Please do not open a public issue with credentials, access tokens, private
workout data, or screenshots containing personal information.

For a suspected security problem, contact the project owner privately. Never
commit a Supabase service-role key or other privileged secret; the browser app
should only receive the publishable client key.

## Content Security Policy

The deployed headers block both inline scripts and inline style attributes.
Runtime-calculated visual values are applied through CSS custom properties and
the Web Animations API, while finite visual states use classes and data
attributes. This keeps the drag indicators, menus, announcements, calendar
scrollbar, rank meters, and safe-area layout working without allowing arbitrary
inline CSS from injected markup.
