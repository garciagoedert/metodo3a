-- Create roteiro_comments table
create table roteiro_comments (
    id uuid default gen_random_uuid() primary key,
    roteiro_id uuid references roteiros(id) on delete cascade not null,
    user_id uuid references auth.users(id) on delete cascade not null,
    content text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table roteiro_comments enable row level security;

-- Create policies
create policy "Users can view comments for their roteiros"
    on roteiro_comments for select
    using (true);

create policy "Users can insert comments"
    on roteiro_comments for insert
    with check (auth.uid() = user_id);

create policy "Users can delete their own comments"
    on roteiro_comments for delete
    using (auth.uid() = user_id);
