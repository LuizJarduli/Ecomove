# EcoMove — Mobilidade Urbana Sustentável e Zeladoria Cidadã

Plataforma de incentivo à mobilidade ativa, sustentável e manutenção urbana participativa desenvolvida para a Usina de Projetos Experimentais IV (UPX IV) do Centro Universitário Facens (Sorocaba/SP).

O sistema valida trajetos realizados a pé, de bicicleta, carona solidária e transporte público por meio de regras geoespaciais em PostGIS contra o perímetro da universidade (`CampusZone`), bonificando os usuários com `EcoPoints` em um livro-razão imutável, permitindo o relato de ocorrências de infraestrutura urbana com deduplicação em raio de 30 metros e munindo gestores com mapas de calor, indicadores BI e diagnósticos via inteligência artificial.

Landing page pública: https://ecomove-facens.web.app

---

## Integrantes do Grupo (DevPro · UPX IV)

- Gabriel Ribeiro Latri — RA 251373 (Backend Fastify & PostGIS Geoespacial)
- Giovanna Antunes de Campos — RA 250904 (Proposta Científica, Documentação & ODS)
- Leonardo Hipólito Trevisani — RA 252186 (Pesquisa de Público-Alvo, Validação & Pitch)
- Lucas Henrique Gomes — RA 251740 (Portal Web do Gestor & Sistema de Recompensas)
- Luiz Miguel Jarduli Leite — RA 252520 (Aplicativo Mobile Flutter & Arquitetura)

---

## Objetivos de Desenvolvimento Sustentável (ODS)

- ODS 11 (Cidades e Comunidades Sustentáveis): Metas 11.2 e 11.6 — Acesso a transportes sustentáveis e redução do impacto ambiental per capita.
- ODS 13 (Ação Contra a Mudança Global do Clima): Descarbonização de trajetos e mensuração de gramas de CO2 evitados por deslocamento.
- ODS 9 (Indústria, Inovação e Infraestrutura): Geoprocessamento em tempo real para direcionamento eficiente de manutenção viária.

---

## Estrutura do Repositório

O projeto é estruturado como um monorepo com isolamento claro de responsabilidades:

```text
.
├── apps/
│   ├── api/          # Backend Fastify + TypeScript + Prisma ORM + PostGIS + Zod
│   ├── mobile/       # Aplicativo Flutter (Android/iOS) + BLoC + flutter_map + SQLite
│   ├── web/          # Portal do Gestor (Next.js 16 + Tailwind CSS + React-Leaflet)
│   └── landing/      # Landing Page estática institucional (Next.js export + GSAP + Lenis)
├── docs/
│   ├── adr/          # Registros de Decisões de Arquitetura (ADR 0001 a 0005)
│   ├── design/       # Especificações de telas e protótipos Auralis (Stitch)
│   └── ARCHITECTURE_AND_BPMN.md # Diagramas de arquitetura e processos BPMN
├── docker-compose.yml# Banco de dados PostgreSQL 16 com extensão PostGIS 3.4
├── GLOSSARY.md       # Dicionário de Linguagem Ubíqua do domínio
├── AGENTS.md         # Regras de arquitetura e padrões técnicos
└── package.json      # Scripts e orquestração do monorepo via pnpm
```

---

## Tecnologias e Decisões de Arquitetura

- Banco de Dados Geoespacial (ADR-0002): PostgreSQL 16 + PostGIS 3.4 com coordenadas em SRID 4326. Consultas com `ST_Intersects`, `ST_Length` e `ST_DWithin`.
- Livro-Razão Imutável de EcoPoints (ADR-0003): Tabela `PointTransaction` auditável. Saldos e resgates são executados dentro de transações com controle de concorrência (`SELECT ... FOR UPDATE`). Vouchers expiram em 7 dias com estorno automático.
- Facade de Inteligência Artificial Plugável (ADR-0004): Interface `InsightEngine` desacoplada das rotas, permitindo alternar entre Google Gemini (nuvem), Ollama (modelos locais como Llama 3.2) ou motor determinístico.
- Custo Zero de Infraestrutura (ADR-0005): Fotos de ocorrências comprimidas no cliente em formato WebP (< 300 KB) compatíveis com o plano gratuito (Spark) do Firebase Storage/Hosting.
- Resiliência Offline no Mobile: Fila local em SQLite armazena coordenadas GPS durante a rota para evitar perda de dados em zonas de sombra de sinal no campus.

---

## Pré-requisitos

Para executar todos os módulos do projeto em ambiente local, é necessário possuir instalado:

- Node.js (versão 20 LTS ou superior, testado com v22)
- pnpm (versão 9 ou 10)
- Docker e Docker Compose (para o PostgreSQL/PostGIS)
- Flutter SDK (versão 3.24 ou superior) e Android Studio / Xcode configurados
- Git

---

## Guia de Instalação e Execução Local

### 1. Clonar o repositório

```bash
git clone https://github.com/LuizJarduli/Ecomove.git
cd Ecomove
```

### 2. Instalar dependências Node.js

Na raiz do repositório, instale as dependências de todos os workspaces:

```bash
pnpm install
```

### 3. Iniciar o Banco de Dados PostGIS

Inicie o container do PostgreSQL com PostGIS via Docker Compose:

```bash
docker compose up -d
```

O container `ecomove-db` estará ativo na porta `5432` com as credenciais padrão:
- Usuário: `ecomove`
- Senha: `ecomove`
- Banco: `ecomove`

### 4. Configurar e Iniciar o Backend (apps/api)

Navegue até a pasta da API ou execute via comandos de workspace:

```bash
cd apps/api

# Copie as variáveis de ambiente (se necessário, ajuste os valores)
cp .env.example .env

# Execute as migrações do Prisma no banco PostGIS
pnpm prisma:migrate

# Popule o banco com a CampusZone oficial da FACENS e dados de demonstração
pnpm db:seed

# Inicie o servidor em modo desenvolvimento (porta 3333)
pnpm dev
```

A API estará disponível em `http://localhost:3333`.

Para rodar a suíte completa de testes automatizados da API:

```bash
pnpm test
```

### 5. Iniciar o Portal Web do Gestor (apps/web)

Em outro terminal, acesse a pasta da aplicação web:

```bash
cd apps/web

# Copie as variáveis de ambiente
cp .env.example .env.local

# Inicie o servidor Next.js em modo desenvolvimento (porta 3000)
pnpm dev
```

Acesse o portal em `http://localhost:3000`. O painel operacional dos gestores fica na rota `http://localhost:3000/painel`.

Para build de produção:

```bash
pnpm build
```

### 6. Iniciar a Landing Page Standalone (apps/landing)

Caso queira executar a landing page de demonstração isoladamente:

```bash
cd apps/landing
pnpm dev
```

Acesse em `http://localhost:3001`. Para gerar os arquivos estáticos de deploy:

```bash
pnpm build
```

Os arquivos prontos para hospedagem (Vercel/Firebase) serão gerados no diretório `apps/landing/out`.

### 7. Iniciar o Aplicativo Mobile (apps/mobile)

Certifique-se de que um emulador Android/iOS ou dispositivo físico esteja conectado:

```bash
cd apps/mobile

# Baixe as dependências do Flutter
flutter pub get

# Verifique a integridade do código
flutter analyze

# Execute os testes unitários e de widgets
flutter test

# Execute o aplicativo
flutter run
```

---

## Comandos Rápidos na Raiz do Projeto

O `package.json` raiz oferece atalhos para os principais serviços:

- `pnpm dev`: Inicia o Portal Web do Gestor.
- `pnpm api:dev`: Inicia o servidor backend Fastify.
- `pnpm api:test`: Roda a suíte de testes de integração com banco de testes PostGIS.
- `pnpm landing:dev`: Inicia a Landing Page na porta 3001.
- `pnpm landing:build`: Compila a Landing Page estática para a pasta `out`.
- `pnpm db:up`: Sobe o container Docker do banco de dados.

---

## Licença

Projeto desenvolvido para fins acadêmicos no Centro Universitário Facens sob licença MIT. Consulte o arquivo `LICENSE` para detalhes.
