-- File asli (kualitas penuh) setoran disimpan terpisah di bucket privat; galeri tetap memakai WebP ringan
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('originals', 'originals', false, 41943040, array['image/png','image/jpeg','image/webp','image/gif','image/tiff'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

alter table public.story_submissions
  add column if not exists original_path text,
  add column if not exists original_name text,
  add column if not exists original_size bigint;

drop policy if exists originals_member_upload on storage.objects;
create policy originals_member_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'originals' and (((storage.foldername(name))[1] = (select auth.uid())::text and (select public.is_active_member())) or (select public.is_admin())));
drop policy if exists originals_read on storage.objects;
create policy originals_read on storage.objects for select to authenticated
  using (bucket_id = 'originals' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_admin())));
drop policy if exists originals_update on storage.objects;
create policy originals_update on storage.objects for update to authenticated
  using (bucket_id = 'originals' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_admin())));
drop policy if exists originals_delete on storage.objects;
create policy originals_delete on storage.objects for delete to authenticated
  using (bucket_id = 'originals' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_admin())));
