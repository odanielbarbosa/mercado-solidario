# 🤝 Mercado Solidário

Controle de doações da igreja. Projeto **100% offline / estático** (sem back-end),
no mesmo estilo e arquitetura do `learning-english`: HTML + CSS + JS puro, tema
claro/escuro e banco de dados em JSON (localStorage).

## O que faz

- **Login simples**: a pessoa digita apenas o *usuário* (sem senha). Se o usuário
  existir no arquivo `js/users.js`, o acesso é liberado.
- **Registrar doações**: produto, categoria, quantidade, unidade, doador e data.
- **Lista de doações**: busca por produto/doador, filtro por categoria, editar e remover.
- **Resumo**: totais, itens por categoria, doações por dia e as últimas doações.
- **Backup**: exportar / importar todo o banco em um `db.json`.

## Estrutura dos arquivos

| Arquivo | Papel |
|---|---|
| `index.html` | Shell da página (carrega o tema, o CSS e os scripts). |
| `styles.css` | Todo o visual (tema claro/escuro por variáveis CSS). |
| `js/users.js` | "Banco de dados" de logins autorizados (`window.USERS`). |
| `js/app.js` | A aplicação: login, cadastro de doações, resumo, import/export. |
| `db.example.json` | Exemplo do formato do banco de doações. |

### Como adicionar/remover usuários

Edite `js/users.js` e publique de novo:

```js
window.USERS = [
  { id: "admin",  name: "Administrador",       avatar: "🤝",   color: "#58cc02" },
  { id: "daniel", name: "Daniel Barbosa",      avatar: "🧑‍💻", color: "#1cb0f6" },
  { id: "maria",  name: "Maria da Igreja",     avatar: "⛪",   color: "#ce82ff" }
];
```

O `id` é o que a pessoa digita no login (não diferencia maiúsculas/minúsculas).

### Onde ficam as doações

As doações ficam salvas no **navegador** (localStorage, em formato JSON), sem servidor.
Como é um site estático, cada navegador guarda a própria lista — para backup ou para
levar de um computador a outro, use **Exportar db.json** / **Importar db.json** no app.

## Como publicar (GitHub Pages)

O projeto é estático. Basta enviar os arquivos para um repositório e ativar o Pages:

```bash
git init
git add .
git commit -m "Mercado Solidário"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/mercado-solidario.git
git push -u origin main
```

No GitHub: **Settings → Pages → Branch `main` / root → Save**. Em ~1 minuto o site
fica em `https://SEU_USUARIO.github.io/mercado-solidario/`.

## Como rodar localmente

Abrir o `index.html` direto no navegador já funciona. Se quiser servir por HTTP:

```bash
npx serve .
# ou
python -m http.server 8000
```
