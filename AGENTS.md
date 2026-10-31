# K.F.C. project working rules

- When adding or changing a member-facing feature, update the isolated demo experience in the same change so visitors can try the feature. Demo data must remain in local component memory and must never call member APIs, Supabase, or Realtime.
- Keep the website and Windows package version aligned in `package.json`. Add concise release notes for each new version and show them once per version in both clients.
- Verify the demo isolation test and production build before publishing.
