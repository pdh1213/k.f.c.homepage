alter table public.showroom_chatbot_faqs
  add column if not exists image_path text,
  add column if not exists link_label text,
  add column if not exists link_url text;
alter table public.showroom_chatbot_questions
  add column if not exists image_path text,
  add column if not exists link_label text,
  add column if not exists link_url text;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('chatbot-images','chatbot-images',false,5242880,array['image/jpeg','image/png','image/webp','image/gif','image/avif'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists kfc_chatbot_images_upload on storage.objects;
create policy kfc_chatbot_images_upload on storage.objects for insert to authenticated with check (
  bucket_id='chatbot-images'
  and (storage.foldername(name))[1]='chatbot'
  and (storage.foldername(name))[2]=(select private.current_profile_id())::text
  and (select private.is_admin())
);

update public.showroom_chatbot_faqs
set link_label='Windows 앱 다운로드 페이지',link_url='/download'
where (question ilike '%Windows%' or question like '%윈도우%') and (link_url is null or link_url='');
