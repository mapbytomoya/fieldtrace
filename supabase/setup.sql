-- FieldTrace: 写真付き共有リンク用の保存場所
-- Supabase の SQL Editor に貼り付けて 1 回だけ実行する。

-- 公開バケット（URL を知っていれば読める）。1 ファイル 20MB まで、JSON のみ。
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('shares', 'shares', true, 20971520, array['application/json'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 誰でも「新規追加」だけできる。上書き・削除・一覧取得はできない。
-- ファイル名はアプリが作るランダムな 22 文字の ID のみ許可する。
drop policy if exists "fieldtrace share upload" on storage.objects;
create policy "fieldtrace share upload"
  on storage.objects for insert
  to anon, authenticated
  with check (
    bucket_id = 'shares'
    and name ~ '^[A-Za-z0-9_-]{22}\.json$'
  );
