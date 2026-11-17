// Baixa um texto como arquivo Markdown (devolutivas).
export const baixar = (nome, texto) => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([texto], { type: "text/markdown;charset=utf-8" }));
  a.download = nome; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};
