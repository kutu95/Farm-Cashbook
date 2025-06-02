-- Create user_invitations table
create table if not exists public.user_invitations (
  id uuid default gen_random_uuid() primary key,
  email text not null,
  token text not null unique,
  invited_by uuid not null references auth.users(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  expires_at timestamp with time zone not null,
  used_at timestamp with time zone
);

-- Add RLS policies
alter table public.user_invitations enable row level security;

-- Drop existing policies if they exist
drop policy if exists "Admins can create invitations" on public.user_invitations;
drop policy if exists "Admins can view all invitations" on public.user_invitations;
drop policy if exists "Users can validate their own invitation" on public.user_invitations;
drop policy if exists "Users can delete their own used invitation" on public.user_invitations;

-- Allow admins to create invitations
create policy "Admins can create invitations"
  on public.user_invitations
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.user_roles
      where user_id = auth.uid()
      and role = 'admin'
    )
  );

-- Allow admins to view all invitations
create policy "Admins can view all invitations"
  on public.user_invitations
  for select
  to authenticated
  using (
    exists (
      select 1 from public.user_roles
      where user_id = auth.uid()
      and role = 'admin'
    )
  );

-- Allow anyone to validate their own invitation token
create policy "Users can validate their own invitation"
  on public.user_invitations
  for select
  using (true);

-- Allow users to delete their own used invitation
create policy "Users can delete their own used invitation"
  on public.user_invitations
  for delete
  using (true);

-- Create index on token for faster lookups
create index if not exists user_invitations_token_idx on public.user_invitations(token);

-- Create index on email for faster lookups
create index if not exists user_invitations_email_idx on public.user_invitations(email); 