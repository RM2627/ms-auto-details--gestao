-- Primeiro crie o usuário em Authentication > Users.
-- Substitua SOMENTE o e-mail abaixo pelo e-mail desse usuário.
-- Execute no SQL Editor; não existe senha neste arquivo.
do $$
declare target_id uuid;
begin
 select id into target_id from auth.users where lower(email)=lower('SEU_EMAIL_AQUI');
 if target_id is null then raise exception 'Crie o usuário em Authentication > Users e confira o e-mail neste script.';end if;
 insert into public.ms_admin_users(user_id) values(target_id) on conflict do nothing;
end$$;
