//! Atualização do app (Windows): reabertura depois do instalador.

/// Windows: o instalador do atualizador encerra o app e nem sempre o reabre. Antes de instalar, deixa um vigia (PowerShell,
/// sem janela) que espera este processo sair, espera o instalador terminar e reabre o app se ele ainda não estiver rodando.
/// Se este processo não sair em 2 minutos (instalação cancelada ou falhou), o vigia desiste.
#[tauri::command]
pub fn agendar_reabertura() -> Result<(), String> {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        let exe = std::env::current_exe().map_err(|e| e.to_string())?;
        let nome = exe.file_stem().map(|s| s.to_string_lossy().to_string()).unwrap_or_default();
        let script = format!(
            "$exe='{exe}'; $n='{nome}'; $pid0={pid}; \
             $p=Get-Process -Id $pid0 -ErrorAction SilentlyContinue; if($p){{ if(-not $p.WaitForExit(120000)){{ exit }} }}; \
             Start-Sleep -Seconds 3; \
             for($i=0;$i -lt 60;$i++){{ \
               if(Get-Process -Name $n -ErrorAction SilentlyContinue){{ exit }}; \
               if(-not (Get-Process -Name 'Margem_*' -ErrorAction SilentlyContinue) -and -not (Get-Process -Name 'setup*' -ErrorAction SilentlyContinue)){{ Start-Process -FilePath $exe; exit }}; \
               Start-Sleep -Seconds 2 }}",
            exe = exe.to_string_lossy().replace('\'', "''"), nome = nome.replace('\'', "''"), pid = std::process::id());
        // CREATE_NO_WINDOW | DETACHED_PROCESS: sem janela e independente deste processo
        std::process::Command::new("powershell").args(["-NoProfile", "-WindowStyle", "Hidden", "-Command", &script])
            .creation_flags(0x0800_0000 | 0x0000_0008).spawn().map_err(|e| e.to_string())?;
    }
    Ok(())
}
