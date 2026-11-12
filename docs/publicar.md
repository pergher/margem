# Publicar no GitHub, instalar no Windows e atualizar

Fluxo: você mexe no código aqui → envia ao GitHub → o GitHub compila o instalador do Windows → o app instalado se atualiza sozinho.

## Uma vez só (preparação)

1. **Conta no GitHub:** crie em <https://github.com/signup> (gratuita). Anote o nome de usuário.
2. **Repositório vazio:** em <https://github.com/new> crie `editor-md`, **Public**, sem README/.gitignore/licença (o projeto já tem).
3. **Troque `OWNER`** pelo seu usuário em `app/src-tauri/tauri.conf.json` (campo `endpoints`) e faça commit:
   ```bash
   cd ~/dev/editor-md
   sed -i 's#github.com/OWNER/#github.com/SEU_USUARIO/#' app/src-tauri/tauri.conf.json
   git add -A && git commit -m "Endereço do atualizador"
   ```
4. **Ligue o repositório e envie** (o GitHub pede login; use um *Personal Access Token* como senha: Settings › Developer settings › Tokens (classic) › marque `repo` e `workflow`):
   ```bash
   git branch -M main
   git remote add origin https://github.com/SEU_USUARIO/editor-md.git
   git push -u origin main
   ```
5. **Chave de assinatura das atualizações** (já gerada em `~/.tauri/editor-md.key`, sem senha; a pública já está no `tauri.conf.json`). No GitHub: repositório › Settings › Secrets and variables › Actions › *New repository secret*:
   - Nome `TAURI_SIGNING_PRIVATE_KEY`, valor = todo o conteúdo de `~/.tauri/editor-md.key` (`cat ~/.tauri/editor-md.key`).
   - Nome `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`, valor vazio (ou crie o secret com um espaço, se o GitHub recusar vazio).
   - **Guarde uma cópia da chave fora do computador** (ex.: Drive privado). Sem ela, apps já instalados não aceitam mais atualizações; o `.gitignore` já impede de ela ir ao repositório.

## Lançar uma versão

1. Aumente o número em `app/src-tauri/tauri.conf.json` (`"version"`, ex.: `0.1.1`) — e igual em `app/package.json` e `app/src-tauri/Cargo.toml`, para não confundir.
2. Commit, tag e envio:
   ```bash
   git add -A && git commit -m "Versão 0.1.1"
   git tag v0.1.1
   git push && git push --tag
   ```
3. Em *Actions* no GitHub acompanhe o job **Release** (leva ~10–15 min na primeira vez). Ao terminar, a página *Releases* tem o instalador `editor-md_0.1.1_x64-setup.exe` e o `latest.json`.

## No Windows da escola

- **Primeira vez:** baixe o `…-setup.exe` em *Releases* e execute. Instala só para o seu usuário (não pede administrador). O Windows pode mostrar "O Windows protegeu o computador" (o instalador não tem certificado pago): *Mais informações › Executar assim mesmo*. Se faltar o WebView2, o instalador baixa sozinho.
- Ao abrir, o app pede **a pasta do vault** (a pasta `Escola`, no Google Drive para computador, por exemplo `G:\Meu Drive\Escola`). Dá para trocar em Configurações › Pasta do vault.
- **Atualizar:** o app procura sozinho ao abrir e avisa no rodapé; ou Configurações › Atualizações › *Procurar atualização* › *Baixar e instalar*. O app reinicia e o vault não é tocado.

## Notas

- O vault real **nunca** vai ao GitHub: o repositório só tem o código e fixtures anônimas (`tests/fixtures/vault/` está no `.gitignore`).
- O workflow **CI** roda `cargo test` do núcleo no Linux e no Windows a cada push.
- Se o job Release falhar, abra o log do passo vermelho e me mande o trecho do erro.
