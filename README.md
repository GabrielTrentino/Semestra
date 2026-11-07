# Semestra

App de estudos **desktop hotbar** para acompanhar aulas, marcar o que já foi
assistido e organizar os compromissos do semestre usando o calendário
acadêmico do INFNET e os links que chegam pelo WhatsApp.

Stack: Electron 33 (shell nativo) + React 18 + Vite + TypeScript + Tailwind.
O handoff original pedia Tauri; mudei para Electron porque não há toolchain
Rust/MSVC instalado nesta máquina. O front-end é o mesmo React, então migrar
para Tauri depois é só trocar o shell.

## Como rodar

### Dev (hot-reload, janela nativa + Vite)

```bash
npm install
npm start
```

Isso sobe o Vite em `http://127.0.0.1:5173` e abre a janela Electron
apontando pra ele.

### Build de produção

```bash
npm run build          # bundla a UI em dist/
npm run electron:prod  # abre o Electron carregando dist/index.html
# npm run dist         # gera instalador .exe (NSIS) em release/
```

## Modos de janela

- **Dock (72 px)** — barra fina encaixada na borda, sempre no topo. Mostra a
  próxima aula pendente e um botão "entrar na aula".
- **Painel (420 px)** — painel completo com abas, por cima das janelas,
  sempre no topo.
- **Janela completa** — modo tradicional, para editar e navegar o calendário.

Trocar modo: pelo botão no cabeçalho, pelo menu da bandeja (clique
direito no ícone), ou pelo **atalho global `Ctrl+Shift+Space`** para
ocultar/mostrar.

## ⚠️ `ELECTRON_RUN_AS_NODE`

Se você tem essa variável de ambiente setada (acontece quando algum editor,
extensão ou script configurou), o Electron ignora o modo "main process" e
roda como Node puro — a janela não abre. O script `electron/launch.cjs`
remove a variável antes de spawnar o binário, então `npm start` sempre
funciona. Se for rodar `electron .` manualmente, lembre: `Remove-Item
Env:ELECTRON_RUN_AS_NODE` antes.

## Fluxo

1. **Importar** → cole o texto do grupo do WhatsApp (ou use "Usar exemplo").
   O app detecta disciplinas, dias da semana e links do Zoom.
2. **Disciplinas** → ajuste cores, dias e link se precisar.
3. **Aulas** → cada ocorrência futura/passada aparece ligada ao calendário
   acadêmico INFNET 2026. Clique no ícone à esquerda para marcar como
   *Assistida*; use o dropdown para outros status (*Faltei*, *Gravada para
   depois*).
4. **Calendário** → visão de 2026 com as aulas plotadas na grade, destacando
   feriados e a semana atual.

Os dados ficam no `localStorage` do navegador. Botões de ↑/↓ no cabeçalho
exportam/importam um JSON de backup.

## Dados do calendário

`src/data/calendar-2026.json` foi gerado a partir da planilha oficial da
Faculdade INFNET (`Calendário Acadêmico Discente_Presencial e Live_Graduação
e MBA.xlsx`, aba *Graduação 2026*) com o script
`scripts/extract_calendar.py` do scratchpad. Para atualizar em outro ano, basta
rodar o script apontando para a aba equivalente.
