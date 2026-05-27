# Consulta Judicial

MVP de consulta de processos judiciais públicos inspirado no fluxo de produtos como Jusbrasil, mas usando integração própria com fontes oficiais.

## Funcionalidades

- Busca por número CNJ com detecção automática do tribunal.
- Busca por nome em modo preliminar, limitada aos campos públicos disponíveis na fonte consultada.
- Seleção manual de tribunal ou busca nos principais tribunais.
- Página de resultado com capa processual, classe, assunto, órgão julgador e movimentações recentes.
- Modo de consulta simplificada para resposta rápida.
- Modo de consulta completa com linha do tempo, documentos/expedientes, dados técnicos e validação PJe.
- Fluxo de captcha oficial do PJe/TRT4 dentro do site para carregar detalhes quando o tribunal exigir validação.
- Explicação por IA para movimentações, documentos e expedientes, com fallback local quando não houver chave OpenAI.
- Login/cadastro obrigatório antes de qualquer consulta.
- Bloqueio de `/api/search`, `/api/pje/details` e `/api/ai/explain` por sessão.
- Planos Grátis, Pro e Escritório com limite diário de uso.
- Página `/precos` e upgrade em modo MVP.
- Registro local de uso por usuário para monetização e controle de abuso.
- Alertas por processo dentro do site e por e-mail SMTP.
- Anúncios discretos no site e anúncio recompensado para liberar recurso avulso.
- Histórico local no navegador.
- Backend próprio em Next.js para proteger a chamada ao DataJud.
- Rate limit simples por IP e cache em memória.
- Avisos de LGPD, sigilo e limitação de dados públicos.

## Fonte de dados

A integração padrão usa a API Pública do DataJud/CNJ.

- Documentação: https://datajud-wiki.cnj.jus.br/api-publica/
- Acesso e chave pública: https://datajud-wiki.cnj.jus.br/api-publica/acesso/
- Endpoints por tribunal: https://datajud-wiki.cnj.jus.br/api-publica/endpoints/
- Glossário de campos: https://datajud-wiki.cnj.jus.br/api-publica/glossario/

## Como rodar

```bash
npm.cmd install
npm.cmd run dev
```

Abra `http://localhost:3000`.

Opcionalmente crie `.env.local`:

```bash
DATAJUD_API_KEY="sua-chave"
OPENAI_API_KEY="sua-chave-openai"
OPENAI_MODEL="gpt-4.1-mini"
SMTP_HOST="smtp.seudominio.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="usuario"
SMTP_PASS="senha"
SMTP_FROM="alertas@seudominio.com"
NEXT_PUBLIC_ADSENSE_CLIENT="ca-pub-0000000000000000"
NEXT_PUBLIC_ADSENSE_SIDEBAR_SLOT="0000000000"
NEXT_PUBLIC_ADSENSE_CONTENT_SLOT="0000000000"
```

Se `DATAJUD_API_KEY` não existir, o app usa a chave pública vigente documentada pelo CNJ no momento da implementação.
Se `OPENAI_API_KEY` não existir, os botões de explicação continuam funcionando com regras locais simples.
Se o SMTP não estiver configurado, os alertas continuam aparecendo dentro do site e o envio por e-mail fica pendente.
Se `NEXT_PUBLIC_ADSENSE_CLIENT` e os slots não existirem, o site mostra apenas o fallback discreto de publicidade.

## Autenticação e planos

O MVP usa persistência local em `data/auth-store.json`, ignorada pelo Git. Esse arquivo guarda usuários, sessões e contadores diários.
Os alertas usam `data/alerts-store.json`, também ignorado pelo Git.

- Grátis: 5 consultas/dia, sem explicação por IA.
- Pro: 100 consultas/dia, IA, histórico e monitoramento.
- Escritório: 1.000 consultas/dia, IA, equipe, alertas e painel admin.

O upgrade atual é um mock operacional pela rota `/api/billing/upgrade`. Para cobrança real, conecte Mercado Pago ou Stripe nessa rota.

## Anúncios e desbloqueio por recompensa

O MVP inclui espaços de anúncio discretos e uma rota `/api/ads/reward`. O fluxo recompensado libera créditos para:

- 1 explicação por IA;
- 1 monitoramento de processo.

Hoje o anúncio é simulado por uma tela com temporizador. Para monetização real, substitua o placeholder visual pelo SDK da rede escolhida e chame `/api/ads/reward` somente após a confirmação oficial de conclusão do anúncio.

Para anúncios discretos com AdSense, crie uma conta, adicione o site, gere blocos de anúncio do tipo display/responsivo e preencha as variáveis `NEXT_PUBLIC_ADSENSE_CLIENT`, `NEXT_PUBLIC_ADSENSE_SIDEBAR_SLOT` e `NEXT_PUBLIC_ADSENSE_CONTENT_SLOT`.

## Alertas

Usuários Pro e Escritório podem ativar o botão `Monitorar` em um processo. O sistema cria:

- monitoramento do processo para o usuário;
- notificação dentro do site;
- e-mail de confirmação quando SMTP estiver configurado.

A rota `/api/alerts/test` dispara um alerta manual de teste para validar notificação no site e envio de e-mail. Para alertas automáticos recorrentes, conecte uma rotina agendada chamando a fonte oficial, comparando movimentações novas e criando notificações com a mesma camada de alertas.

## Próximas etapas recomendadas

- Persistir consultas, cache e monitoramentos em SQLite/PostgreSQL.
- Criar fila recorrente para alertas de movimentações.
- Adicionar consentimento, opt-out e fluxo de remoção/ocultação.
- Integrar API jurídica complementar para busca robusta por nome, CPF/CNPJ ou OAB.
- Adicionar autenticação de usuários e plano de assinatura.
