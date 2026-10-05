// 写真付き共有リンクの保存先（Supabase Storage）。
// anon / publishable key はブラウザに公開する前提の値で、権限は supabase/setup.sql のポリシーで制限する。
export const SUPABASE_URL = 'https://veeadbgyfnhmvkmyqlfx.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_Ka_4UvJAOjrDhZwY50fMzQ_BLW7MbqB';

export const SHARE_BUCKET = 'shares';

export const cloudShareEnabled = SUPABASE_URL !== '' && SUPABASE_ANON_KEY !== '';
