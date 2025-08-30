create table if not exists users (
  id text primary key,
  email text unique,
  fr_uid text unique,
  consent integer default 0,
  created_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  last_seen_at text
);
create table if not exists profiles (
  user_id text primary key references users(id) on delete cascade,
  stage text default 'erdeklodo',
  preferences text default '{}',
  notes text,
  last_topics text
);
create table if not exists conversations (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  started_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ended_at text,
  messages text default '[]',
  summary text
);
create index if not exists idx_users_email on users(email);
create index if not exists idx_users_fr_uid on users(fr_uid);
create index if not exists idx_conv_user_started on conversations(user_id, started_at);
