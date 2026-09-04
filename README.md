# MS AUTO DETAILS — GitHub Pages + Supabase

Gestão com login, clientes, serviços e preços, orçamento calculado e compartilhável, agenda, ganhos, despesas, estoque, custos por serviço e fotos. A interface usa preto, vermelho e branco.

O **GitHub Pages hospeda o site estático**. **Supabase Auth, PostgreSQL e Storage guardam e protegem os dados**. Não é necessário HostGator, Vercel, servidor Node em produção ou chave secreta no site.

## 1. Preparar o Supabase

1. Crie um projeto em [supabase.com](https://supabase.com).
2. No **SQL Editor → New query**, cole TODO o arquivo `supabase/schema.sql` e execute **Run**. Use um projeto vazio dedicado à MS.
3. Em **Authentication → Users → Add user**, crie seu e-mail e uma senha forte. Marque a confirmação de e-mail se houver essa opção.
4. Abra `supabase/autorizar-admin.sql`, substitua `SEU_EMAIL_AQUI` por esse e-mail e execute no SQL Editor. Isso libera o acesso administrativo. Apenas criar um usuário não libera a gestão.
5. Nas configurações de Authentication, desative novos cadastros públicos e login anônimo. O cliente não precisa criar conta para responder ao orçamento.
6. Em **Project Settings → API Keys**, copie a chave **publishable** (ou a antiga **anon**). Copie também a URL do projeto, disponível no painel **Connect** ou nas configurações de API.

**Nunca use service_role, sb_secret, senha do banco ou senha do usuário no código ou nas variáveis do site.** Só a URL e a chave pública são usadas. A chave pública aparece no navegador por definição; a proteção está nas permissões do banco, que este SQL configura.

O sistema é de **uma empresa**, com usuários administradores explicitamente autorizados. Não é uma plataforma multiempresa. Tabelas da gestão não permitem acesso direto de visitantes, nem de usuários não autorizados. As funções administrativas conferem o ID autenticado no banco. Fotos ficam em bucket privado.

Este pacote não importa dados da versão anterior automaticamente. Caso já tenha registros reais, preserve a versão anterior e faça uma migração separada antes de trocar.

## 2. Colocar os arquivos no seu GitHub

Repositório informado: [RM2627/ms-auto-details--gestao](https://github.com/RM2627/ms-auto-details--gestao).

Extraia o ZIP e envie seu **conteúdo**, mantendo as pastas. `package.json`, `app`, `supabase` e `.github` devem estar diretamente na raiz do repositório, sem uma pasta extra por fora. Enviar apenas o ZIP para o GitHub não publica o site.

O pacote é completo. Se o repositório já tem uma versão antiga, guarde uma cópia antes de substituí-la. Não misture APIs antigas com esta versão: esta versão não tem `app/api`, `lib/supabase-server.ts` nem `app/orcamento/[token]`.

### Se o celular não deixar enviar pastas

1. No repositório, abra **Code → Codespaces → Create codespace** (se disponível na sua conta; confira sua cota antes).
2. Pelo explorador de arquivos do editor, envie o ZIP e use o terminal para extraí-lo na raiz do projeto. Preserve ou remova arquivos antigos só depois de conferir quais são.
3. Confira se `.github/workflows/pages.yml` foi extraído, registre as alterações e sincronize com o GitHub.

Outra opção é enviar a pasta extraída pelo navegador de um computador. O ponto essencial é preservar os nomes e as pastas, inclusive `.github`.

## 3. Configurar o GitHub Pages

1. No repositório, abra **Settings → Secrets and variables → Actions → Variables**.
2. Clique em **New repository variable** e crie:

| Nome | Valor |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL do seu projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chave publishable ou anon, nunca a secret/service_role |

3. Em **Settings → Pages → Build and deployment → Source**, selecione **GitHub Actions**.
4. Abra **Actions → Publicar MS Auto Details → Run workflow**. O fluxo também executa quando você envia alterações para `main` ou `master`.
5. Aguarde os trabalhos **build** e **deploy** terminarem. O endereço publicado aparece em **Settings → Pages**.

Para o repositório informado, o endereço esperado é:
`https://rm2627.github.io/ms-auto-details--gestao/`

Esse endereço só funcionará depois da configuração e da publicação. O workflow detecta automaticamente o caminho do repositório; login, imagens e links dos orçamentos usam o mesmo caminho. Se mudar uma variável, execute o workflow novamente.

No Supabase, configure **Authentication → URL Configuration → Site URL** com o endereço final do site. Mantenha HTTPS. O login com e-mail e senha não depende de um redirecionamento OAuth.

O GitHub Pages pode exigir repositório público no seu plano. O código será público, mas **não envie exportações do banco, senhas, fotos de clientes ou dados reais ao repositório**. Os dados ficam no Supabase. Confira os limites e as condições dos seus planos de GitHub e Supabase.

## 4. Usar a gestão

Abra o site, entre com seu e-mail e senha e defina seus preços na aba **Serviços**. Os 26 serviços solicitados já vêm cadastrados, sem valores inventados.

- Novo orçamento gera um ganho integral a receber, não uma receita já recebida.
- Em **Compartilhar**, envie o link para o cliente aprovar/recusar ou mantenha o envio por texto/WhatsApp.
- O link tem o formato `/orcamento/?token=CODIGO_ALEATORIO`, que funciona diretamente no Pages e ao atualizar a página. O cliente não precisa fazer login.
- O cliente vê apenas aquele orçamento: itens, adicionais, desconto, total à vista e validade. Não vê telefone, observações internas ou dados da gestão.
- A resposta é única e validada no banco. A aprovação aparece no painel; você define data e horário em **Agendar serviço**. Não é criado um horário fictício nem permitido autoagendamento.
- Recusa ou cancelamento cancela o ganho pendente. Um orçamento cancelado pode ser excluído se não tiver pagamento, consumo, fotos ou outro histórico que deva ser preservado.
- Ao concluir o serviço, marque se recebeu o valor integral ou se ele continua a receber. Não há pagamento parcial, sinal ou parcelamento.
- Compra de produto gera despesa uma vez. Consumo baixa o estoque e calcula custo do serviço, **sem nova despesa**. O limite mínimo sinaliza reposição.
- No celular há quatro atalhos inferiores; as outras opções ficam no menu lateral.

O link é uma autorização de acesso àquele orçamento: qualquer pessoa com ele pode vê-lo e responder enquanto pendente. Envie só ao cliente, não publique nas redes sociais. Isso não substitui assinatura eletrônica nem confirma a identidade civil de quem respondeu.

## 5. Conferir antes de usar com clientes

1. Faça login como administrador; crie um cliente e um orçamento de teste.
2. Abra o link em uma janela anônima, confira os itens e aprove. Atualize a gestão e agende.
3. Conclua e registre o recebimento integral. Confira ganhos e despesas.
4. Faça uma compra e registre consumo; confira que a despesa não duplicou.
5. Teste cancelamento/exclusão em outro orçamento e envio/remoção de fotos.
6. Um usuário criado no Auth, mas ausente de `ms_admin_users`, deve ser recusado. Sem login, tabelas e funções administrativas não devem liberar dados.

Foram incluídos testes locais de autorização e regras do banco. Ainda é necessário validar a instalação no **seu projeto Supabase**, especialmente login, upload e publicação.

## Desenvolvimento local

Requer Node.js 22.13 ou superior.

Copie `.env.example` para `.env.local` e preencha somente URL e chave pública. Deixe `NEXT_PUBLIC_BASE_PATH` vazio.

```bash
npm ci
npm test
npm run dev
```

`npm run build` gera o site estático em `out/`. Não use `next start`: não há servidor Next em produção.

Para testar a exportação no caminho do repositório:

```bash
NEXT_PUBLIC_BASE_PATH=/ms-auto-details--gestao npm run build
```

Os testes SQL usam PostgreSQL local em WebAssembly (PGlite), com Auth/Storage simulados. Não acessam nem alteram seu Supabase real.

## Referências

- [Exportação estática do Next.js](https://nextjs.org/docs/app/guides/static-exports)
- [Publicação com GitHub Actions](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- [Proteção de dados no Supabase](https://supabase.com/docs/guides/database/secure-data)
#   m s - a u t o - d e t a i l s - - g e s t a o  
 