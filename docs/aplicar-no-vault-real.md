# Aplicar mudanças no vault real

Sempre com simulação e cópia antes (antes ficava na tela Saúde do app).

1. Copie a pasta do vault (ex.: `cp -r Escola Escola-antes`).
2. Simule: `vault reorganizar <pasta>` e `vault migrar <pasta>` (sem `--aplicar` só mostram o que mudaria).
3. Confira o resultado e só então rode com `--aplicar`.
4. Abra a tela Saúde do app e clique em “Verificar de novo”.
