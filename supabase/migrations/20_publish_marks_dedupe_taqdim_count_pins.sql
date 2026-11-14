-- Publikasi: unduhan & watermark manual, deteksi duplikat
alter table public.story_submissions
  add column if not exists downloaded_at timestamptz,
  add column if not exists watermarked_at timestamptz,
  add column if not exists image_hash text,
  add column if not exists duplicate_of uuid references public.story_submissions(id) on delete set null,
  add column if not exists dup_ignore boolean not null default false;
create index if not exists story_submissions_duplicate_of_idx on public.story_submissions(duplicate_of);

-- Taqdim: jumlah konsep yang sudah ditaqdimkan
alter table public.member_period_flags
  add column if not exists taqdim_count integer not null default 0 check (taqdim_count between 0 and 20);

-- Learning Hub: gambar referensi Pinterest
alter table public.learning_materials
  add column if not exists pins jsonb not null default '[]'::jsonb,
  add column if not exists pins_checked_at timestamptz;

-- Guard setoran: kolom admin tidak bisa diubah member; final otomatis = sudah watermark
create or replace function public.story_fill_and_guard()
 returns trigger language plpgsql security definer set search_path to ''
as $function$
declare m public.members; sp public.special_editions; prev_final text;
begin
  prev_final := case when tg_op = 'UPDATE' then old.final_url else null end;

  if new.is_archive then
    if not public.is_privileged() then raise exception 'Hanya admin yang dapat mengelola arsip karya'; end if;
    if new.member_id is not null then
      select * into m from public.members where id = new.member_id;
      if m.id is null then raise exception 'Member tidak ditemukan'; end if;
      new.member_name := m.name; new.category := m.category;
    end if;
    new.qc_status := 'acc';
    if new.duplicate_of = new.id then new.duplicate_of := null; end if;
    if new.is_published_to_showcase then new.published_at := coalesce(new.published_at, now()); else new.published_at := null; end if;
    new.updated_at := now();
    return new;
  end if;

  select * into m from public.members where id = new.member_id;
  if m.id is null then raise exception 'Member tidak ditemukan'; end if;
  new.member_name := m.name;
  new.category := m.category;
  new.concept_id := null;

  if new.special_id is not null then
    select * into sp from public.special_editions where id = new.special_id;
    if sp.id is null then raise exception 'Special Edition tidak ditemukan'; end if;
    new.story_target := null;
    new.period_month := sp.period_month;
    new.title := coalesce(nullif(new.title, ''), sp.title);
    if not public.is_privileged() and sp.pic_member_id is distinct from new.member_id then
      raise exception 'Kamu bukan PIC Special Edition ini';
    end if;
  end if;

  if not public.is_privileged() then
    if not m.is_active then raise exception 'Akun tidak aktif'; end if;
    if new.special_id is null and exists (select 1 from public.rundown_periods p where p.period_month = new.period_month and p.is_locked) then
      raise exception 'Periode % sudah dikunci', new.period_month;
    end if;
    if tg_op = 'UPDATE' then
      if old.qc_status = 'acc' then raise exception 'Setoran yang sudah di-ACC tidak bisa diubah'; end if;
      new.qc_notes := old.qc_notes;
      new.wa_channel_link := old.wa_channel_link;
      new.member_id := old.member_id;
      new.special_id := old.special_id;
      new.final_url := old.final_url;
      new.is_archive := false;
      new.duplicate_of := old.duplicate_of;
      new.dup_ignore := old.dup_ignore;
      if new.file_url is distinct from old.file_url then
        new.downloaded_at := null; new.watermarked_at := null;
      else
        new.downloaded_at := old.downloaded_at; new.watermarked_at := old.watermarked_at;
      end if;
    else
      new.qc_notes := null; new.final_url := null;
      new.duplicate_of := null; new.dup_ignore := false;
      new.downloaded_at := null; new.watermarked_at := null;
    end if;
    new.is_published_to_showcase := false;
    new.published_at := null;
    new.qc_status := 'pending_qc';
  end if;

  if new.final_url is distinct from prev_final then
    new.final_uploaded_at := case when new.final_url is null then null else now() end;
    if new.final_url is not null and new.watermarked_at is null then new.watermarked_at := now(); end if;
  end if;
  if new.duplicate_of = new.id then new.duplicate_of := null; end if;
  if new.qc_status <> 'acc' then new.is_published_to_showcase := false; end if;
  if new.is_published_to_showcase then new.published_at := coalesce(new.published_at, now()); else new.published_at := null; end if;
  new.updated_at := now();
  return new;
end $function$;

-- Galeri: sembunyikan duplikat, sertakan hash untuk penyaringan tambahan
drop function if exists public.showcase_list();
create function public.showcase_list()
 returns table(id uuid, member_name text, category text, period_month text, story_target integer, title text, submission_mode text,
               file_url text, design_app text, wa_channel_link text, published_at timestamptz, is_archive boolean, is_special boolean, image_hash text)
 language sql stable security definer set search_path to ''
as $function$
  select s.id, coalesce(nullif(s.member_name,''), 'Tim Credible Story'), s.category, s.period_month, s.story_target, s.title,
         case when s.final_url is not null then 'file' else s.submission_mode end,
         coalesce(s.final_url, s.file_url), s.design_app, s.wa_channel_link, s.published_at, s.is_archive, s.special_id is not null,
         case when s.dup_ignore then null else s.image_hash end
    from public.story_submissions s
   where s.is_published_to_showcase and s.published_at <= now() and s.duplicate_of is null
   order by s.published_at desc nulls last, s.created_at desc;
$function$;
grant execute on function public.showcase_list() to anon, authenticated;

-- Admin: simpan sidik gambar & tanda duplikat secara massal
create or replace function public.admin_set_hashes(p jsonb)
 returns integer language plpgsql security definer set search_path to ''
as $function$
declare n int;
begin
  if not public.is_privileged() then raise exception 'Hanya admin'; end if;
  update public.story_submissions s set image_hash = x.h
    from jsonb_to_recordset(p) as x(id uuid, h text)
   where s.id = x.id and x.h ~ '^[0-9a-f]{64}$';
  get diagnostics n = row_count;
  return n;
end $function$;

create or replace function public.admin_mark_duplicates(p jsonb)
 returns integer language plpgsql security definer set search_path to ''
as $function$
declare n int;
begin
  if not public.is_privileged() then raise exception 'Hanya admin'; end if;
  update public.story_submissions s set duplicate_of = x."of", dup_ignore = false
    from jsonb_to_recordset(p) as x(id uuid, "of" uuid)
   where s.id = x.id and (x."of" is null or x."of" <> x.id);
  get diagnostics n = row_count;
  return n;
end $function$;

create or replace function public.admin_ignore_duplicates(p_ids uuid[])
 returns integer language plpgsql security definer set search_path to ''
as $function$
declare n int;
begin
  if not public.is_privileged() then raise exception 'Hanya admin'; end if;
  update public.story_submissions set dup_ignore = true, duplicate_of = null where id = any(p_ids);
  get diagnostics n = row_count;
  return n;
end $function$;
revoke all on function public.admin_set_hashes(jsonb), public.admin_mark_duplicates(jsonb), public.admin_ignore_duplicates(uuid[]) from public, anon;
grant execute on function public.admin_set_hashes(jsonb), public.admin_mark_duplicates(jsonb), public.admin_ignore_duplicates(uuid[]) to authenticated;

-- Taqdim: selesai bila konsep + 2 × Special Edition (PIC) >= target bulan itu
create or replace function public.flags_taqdim_sync()
 returns trigger language plpgsql security definer set search_path to ''
as $function$
declare se int; q int;
begin
  select count(*) into se from public.special_editions where pic_member_id = new.member_id and period_month = new.period_month;
  q := public.period_quota(new.period_month);
  new.taqdim_done := q > 0 and (coalesce(new.taqdim_count, 0) + 2 * se) >= q;
  if coalesce(new.taqdim_count, 0) = 0 and not new.taqdim_done then
    new.taqdim_marked_at := null;
  elsif tg_op = 'INSERT' or new.taqdim_count is distinct from old.taqdim_count or new.taqdim_done is distinct from old.taqdim_done then
    new.taqdim_marked_at := now();
  end if;
  return new;
end $function$;
drop trigger if exists flags_taqdim_sync on public.member_period_flags;
create trigger flags_taqdim_sync before insert or update on public.member_period_flags
  for each row execute function public.flags_taqdim_sync();

create or replace function public.special_resync_taqdim()
 returns trigger language plpgsql security definer set search_path to ''
as $function$
begin
  if tg_op in ('UPDATE','DELETE') and old.pic_member_id is not null then
    update public.member_period_flags set updated_at = updated_at where member_id = old.pic_member_id and period_month = old.period_month;
  end if;
  if tg_op in ('INSERT','UPDATE') and new.pic_member_id is not null then
    insert into public.member_period_flags (member_id, period_month) values (new.pic_member_id, new.period_month)
      on conflict (member_id, period_month) do update set updated_at = public.member_period_flags.updated_at;
  end if;
  return null;
end $function$;
drop trigger if exists special_resync_taqdim on public.special_editions;
create trigger special_resync_taqdim after insert or update of pic_member_id, period_month or delete on public.special_editions
  for each row execute function public.special_resync_taqdim();

-- Data lama: yang sudah dicentang "sudah taqdim" dianggap lengkap sesuai target
update public.member_period_flags set taqdim_count = greatest(public.period_quota(period_month), 1) where taqdim_done and taqdim_count = 0;
update public.member_period_flags set updated_at = updated_at;
