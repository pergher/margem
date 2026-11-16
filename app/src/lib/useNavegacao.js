// Em que tela o app está e em que pasta/aba/foco cada tela abriu. O histórico (Voltar/Avançar) fica no App porque mexe na nota aberta.
import { useState } from "react";
import { store } from "@/lib/store";

export function useNavegacao() {
  const [page, setPage] = useState("semana");
  const [ciclo, setCiclo] = useState(null);
  const [inicioModo, setInicioModoState] = useState(() => store.get("inicioModo", "hoje"));
  const setInicioModo = (m) => { setInicioModoState(m); store.set("inicioModo", m); };
  const [aulasPasta, setAulasPasta] = useState(""); // pasta aberta em Aulas (os crumbs e a página compartilham)
  const [ciclosPasta, setCiclosPasta] = useState(""); // pasta aberta em Ciclos
  const [gramaticaPasta, setGramaticaPasta] = useState(""); // pasta aberta em Gramática
  const [correcaoFoco, setCorrecaoFoco] = useState(null);
  const [correcaoVista, setCorrecaoVista] = useState("aluno"); // vista com que a Correção abre: "aluno" ou "turma"
  const [recursosAba, setRecursosAba] = useState("bancos");
  const [recursosPasta, setRecursosPasta] = useState(""); // pasta aberta em Recursos
  const [textoAtiv, setTextoAtiv] = useState(null);

  const irAno = () => { setInicioModo("ano"); setPage("semana"); };
  const irMontarProva = () => { setRecursosAba("montar"); setPage("recursos"); };
  const irAulas = (pasta) => { setAulasPasta(pasta); setPage("aulas"); };
  const irRecursos = (pasta) => { setRecursosPasta(pasta); setRecursosAba("bancos"); setPage("recursos"); };
  // Menu lateral: cada área abre na sua tela inicial.
  const irSecao = (id) => {
    if (id === "hoje" || id === "semana" || id === "ano") { setInicioModo(id); setPage("semana"); }
    else if (id === "correcao") { setCorrecaoFoco(null); setPage("correcao"); }
    else { if (id === "aulas") setAulasPasta(""); if (id === "gramatica") setGramaticaPasta(""); if (id === "ciclos") setCiclosPasta(""); if (id === "recursos") { setRecursosPasta(""); setRecursosAba("bancos"); } setPage(id); }
  };

  return {
    page, setPage, ciclo, setCiclo, inicioModo, setInicioModo, inicioModoRaw: setInicioModoState, aulasPasta, setAulasPasta, ciclosPasta, setCiclosPasta, gramaticaPasta, setGramaticaPasta,
    correcaoFoco, setCorrecaoFoco, correcaoVista, setCorrecaoVista, recursosAba, setRecursosAba, recursosPasta, setRecursosPasta,
    textoAtiv, setTextoAtiv, irAno, irMontarProva, irAulas, irRecursos, irSecao,
  };
}
