// Em que tela o app está e em que pasta/aba/foco cada tela abriu. O histórico (Voltar/Avançar) fica no App porque mexe na nota aberta.
import { useState } from "react";
import { store } from "@/lib/store";

export function useNavegacao() {
  const [page, setPage] = useState("inicio"); // "inicio" = Hoje; "ano" = Ano em abas
  const [ciclo, setCiclo] = useState(null);
  const [anoAba, setAnoAba] = useState(() => store.get("anoAba", "semana")); // aba aberta em Ano: semana | plano | prod | diario
  const mudarAnoAba = (a) => { setAnoAba(a); store.set("anoAba", a); };
  const [documentosPasta, setDocumentosPasta] = useState(""); // pasta aberta em Documentos, relativa a Acervo (os crumbs e a página compartilham)
  const [documentosTipo, setDocumentosTipo] = useState({ tipo: "", n: 0 }); // filtro de tipo com que Documentos abre (submenu do menu lateral); `n` muda a cada clique
  const [correcaoFoco, setCorrecaoFoco] = useState(null);
  const [correcaoVista, setCorrecaoVista] = useState("aluno"); // vista com que a Correção abre: "aluno" ou "turma"
  const [documentosAba, setDocumentosAba] = useState(""); // "montar" = tela de montar prova dentro de Documentos
  const [textoAtiv, setTextoAtiv] = useState(null);

  const irAno = (aba) => { if (aba) mudarAnoAba(aba); setPage("ano"); };
  const irMontarProva = () => { setDocumentosAba("montar"); setPage("documentos"); };
  const irDocumentos = (pasta = "", tipo = "") => { setDocumentosTipo((d) => ({ tipo, n: d.n + 1 })); setDocumentosPasta(pasta); setDocumentosAba(""); setPage("documentos"); };
  // Menu lateral: cada área abre na sua tela inicial.
  const irSecao = (id) => {
    if (id === "hoje") setPage("inicio");
    else if (id === "ano") irAno();
    else if (id.startsWith("ano:")) { const aba = id.slice(4); if (aba === "prod") setCorrecaoFoco(null); irAno(aba); }
    else if (id === "semana" || id === "plano" || id === "diario") irAno(id);
    else if (id === "correcao") { setCorrecaoFoco(null); irAno("prod"); }
    else if (id === "documentos") irDocumentos("");
    else if (id.startsWith("documentos:")) irDocumentos("", id.slice(11)); // submenu: Documentos já filtrado por tipo
    else if (id === "ciclos") irDocumentos("Ciclos"); // os ciclos moram em Documentos
    else setPage(id);
  };

  return {
    page, setPage, ciclo, setCiclo, anoAba, setAnoAba: mudarAnoAba, documentosPasta, setDocumentosPasta, 
    correcaoFoco, setCorrecaoFoco, correcaoVista, setCorrecaoVista, documentosAba, setDocumentosAba,
    textoAtiv, setTextoAtiv, documentosTipo, irAno, irMontarProva, irDocumentos, irSecao,
  };
}
