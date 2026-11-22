alter table public.users
  add column avatar_data text,
  add constraint users_avatar_jpeg_check check (
    avatar_data is null or (
      octet_length(avatar_data) <= 32791
      and avatar_data like 'data:image/jpeg;base64,%'
    )
  );
