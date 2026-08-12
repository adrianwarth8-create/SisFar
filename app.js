// =========================================================
// SISFAR V2
// APP.JS
// Sistema Integrado de Controle de Estoque de Farmácia
// =========================================================


// =========================================================
// FIREBASE
// =========================================================

import {
  auth,
  db
} from "./firebase.js";


import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";


import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
  runTransaction
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";


// =========================================================
// VARIÁVEIS
// =========================================================

let usuarioAtual = null;

let produtosCache = [];

let lotesCache = [];

let movimentosCache = [];

let usuariosCache = [];


let relatorioAtual = {

  titulo: "",

  tipo: "",

  registros: [],

  totalQuantidade: 0,

  totalEntradas: 0,

  totalSaidas: 0

};


// =========================================================
// ATALHO PARA ELEMENTOS
// =========================================================

const $ = (id) =>
  document.getElementById(id);


const loginScreen =
  $("loginScreen");


const appScreen =
  $("appScreen");


// =========================================================
// MENSAGENS
// =========================================================

function showMsg(
  el,
  texto,
  tipo = "error"
) {

  if (!el) return;


  el.textContent =
    texto;


  el.className =
    `message ${tipo}`;

}


function hideMsg(el) {

  if (!el) return;


  el.textContent =
    "";


  el.className =
    "message hidden";

}


// =========================================================
// SEGURANÇA DE TEXTO
// =========================================================

function esc(
  valor = ""
) {

  return String(valor)

    .replaceAll(
      "&",
      "&amp;"
    )

    .replaceAll(
      "<",
      "&lt;"
    )

    .replaceAll(
      ">",
      "&gt;"
    )

    .replaceAll(
      '"',
      "&quot;"
    )

    .replaceAll(
      "'",
      "&#039;"
    );

}


// =========================================================
// CÓDIGO DE BARRAS
// =========================================================

function normalizarCodigoBarras(
  valor
) {

  return String(
    valor
    ||
    ""
  )
    .trim()
    .replace(/\s+/g, "");

}


function encontrarProdutoPorCodigo(
  codigo
) {

  const codigoNormalizado =
    normalizarCodigoBarras(
      codigo
    );


  if (
    !codigoNormalizado
  ) {

    return null;

  }


  return produtosCache.find(
    produto =>

      normalizarCodigoBarras(
        produto.codigoBarras
      )
      ===
      codigoNormalizado

  )
  ||
  null;

}


function codigoMovimentacao(
  movimento
) {

  if (
    movimento.codigoBarras
  ) {

    return movimento.codigoBarras;

  }


  const produto =
    produtosCache.find(
      p =>
        p.id
        ===
        movimento.produtoId
    );


  return (
    produto?.codigoBarras
    ||
    "-"
  );

}


// =========================================================
// DATAS
// =========================================================

function formatDateBR(
  value
) {

  if (!value) {

    return "-";

  }


  if (
    typeof value
    ===
    "string"
  ) {

    const partes =
      value.split("-");


    if (
      partes.length
      ===
      3
    ) {

      const [
        ano,
        mes,
        dia
      ] = partes;


      return (
        `${dia}/${mes}/${ano}`
      );

    }


    return value;

  }


  if (
    value?.toDate
  ) {

    return value
      .toDate()
      .toLocaleString(
        "pt-BR"
      );

  }


  return "-";

}


function formatarDataHora(
  timestamp
) {

  if (
    timestamp?.toDate
  ) {

    return timestamp
      .toDate()
      .toLocaleString(
        "pt-BR"
      );

  }


  return "-";

}


function timestampParaData(
  timestamp
) {

  if (
    !timestamp?.toDate
  ) {

    return null;

  }


  return timestamp
    .toDate();

}


function diasAte(
  dataISO
) {

  if (!dataISO) {

    return 999999;

  }


  const hoje =
    new Date();


  hoje.setHours(
    0,
    0,
    0,
    0
  );


  const alvo =
    new Date(
      `${dataISO}T00:00:00`
    );


  return Math.ceil(

    (
      alvo
      -
      hoje
    )

    /

    (
      1000
      *
      60
      *
      60
      *
      24
    )

  );

}


// =========================================================
// PERFIS
// =========================================================

function perfilLabel(
  perfil
) {

  const perfis = {

    gestor:
      "Gestor",

    farmacia:
      "Farmácia",

    consulta:
      "Consulta"

  };


  return (
    perfis[perfil]
    ||
    perfil
    ||
    "-"
  );

}


function podeOperar() {

  return [

    "gestor",

    "farmacia"

  ].includes(
    usuarioAtual?.perfil
  );

}


function isGestor() {

  return (
    usuarioAtual?.perfil
    ===
    "gestor"
  );

}


// =========================================================
// PERMISSÕES
// =========================================================

function aplicarPermissoes() {

  document
    .querySelectorAll(
      ".gestor-only"
    )
    .forEach(
      elemento => {

        elemento
          .classList
          .toggle(
            "hidden",
            !isGestor()
          );

      }
    );


  document
    .querySelectorAll(
      ".perm-operacao"
    )
    .forEach(
      elemento => {

        elemento
          .classList
          .toggle(
            "hidden",
            !podeOperar()
          );

      }
    );

}


// =========================================================
// LOGIN
// =========================================================

$("loginForm")
  ?.addEventListener(
    "submit",
    async (event) => {

      event.preventDefault();


      hideMsg(
        $("loginMsg")
      );


      const email =
        $("loginEmail")
          .value
          .trim();


      const senha =
        $("loginSenha")
          .value;


      try {

        await signInWithEmailAndPassword(

          auth,

          email,

          senha

        );

      }

      catch (erro) {

        console.error(erro);


        showMsg(

          $("loginMsg"),

          "Não foi possível entrar. Verifique o e-mail e a senha."

        );

      }

    }
  );


// =========================================================
// LOGOUT
// =========================================================

$("logoutBtn")
  ?.addEventListener(
    "click",
    async () => {

      await signOut(
        auth
      );

    }
  );


// =========================================================
// AUTENTICAÇÃO
// =========================================================

onAuthStateChanged(

  auth,

  async (user) => {

    if (!user) {

      usuarioAtual =
        null;


      loginScreen
        ?.classList
        .remove(
          "hidden"
        );


      appScreen
        ?.classList
        .add(
          "hidden"
        );


      return;

    }


    try {

      const usuarioRef =
        doc(

          db,

          "usuarios",

          user.uid

        );


      const snap =
        await getDoc(
          usuarioRef
        );


      if (
        !snap.exists()
      ) {

        await signOut(
          auth
        );


        showMsg(

          $("loginMsg"),

          "Usuário autenticado, porém não existe perfil cadastrado na coleção usuarios."

        );


        return;

      }


      const dados =
        snap.data();


      if (
        dados.ativo
        ===
        false
      ) {

        await signOut(
          auth
        );


        showMsg(

          $("loginMsg"),

          "Este usuário está desativado."

        );


        return;

      }


      usuarioAtual = {

        uid:
          user.uid,

        email:
          user.email,

        ...dados

      };


      $("userName")
        .textContent =
        usuarioAtual.nome
        ||
        user.email;


      $("userProfile")
        .textContent =
        perfilLabel(
          usuarioAtual.perfil
        );


      aplicarPermissoes();


      loginScreen
        ?.classList
        .add(
          "hidden"
        );


      appScreen
        ?.classList
        .remove(
          "hidden"
        );


      await carregarTudo();


      abrirPagina(
        "dashboard"
      );

    }

    catch (erro) {

      console.error(erro);


      showMsg(

        $("loginMsg"),

        "Erro ao carregar o perfil do usuário."

      );

    }

  }

);


// =========================================================
// MENU
// =========================================================

document
  .querySelectorAll(
    ".nav-btn[data-page]"
  )
  .forEach(
    botao => {

      botao.addEventListener(
        "click",
        () => {

          abrirPagina(
            botao.dataset.page
          );

        }
      );

    }
  );


function abrirPagina(
  page
) {

  document
    .querySelectorAll(
      ".page"
    )
    .forEach(
      pagina => {

        pagina.classList.add(
          "hidden"
        );

      }
    );


  const destino =
    $(
      `page-${page}`
    );


  destino
    ?.classList
    .remove(
      "hidden"
    );


  document
    .querySelectorAll(
      ".nav-btn[data-page]"
    )
    .forEach(
      botao => {

        botao.classList.toggle(

          "active",

          botao.dataset.page
          ===
          page

        );

      }
    );


  const titulos = {

    dashboard:
      "Dashboard",

    estoque:
      "Estoque",

    entrada:
      "Entrada",

    baixa:
      "Baixa / Saída",

    movimentacoes:
      "Movimentações",

    validade:
      "Lotes e Validades",

    relatorios:
      "Relatórios",

    usuarios:
      "Usuários"

  };


  if (
    $("pageHeader")
  ) {

    $("pageHeader")
      .textContent =
      titulos[page]
      ||
      "SISFAR V2";

  }


  if (
    page
    ===
    "dashboard"
  ) {

    renderDashboard();

  }


  if (
    page
    ===
    "estoque"
  ) {

    renderEstoque();

  }


  if (
    page
    ===
    "entrada"
  ) {

    preencherSelectProdutos();

  }


  if (
    page
    ===
    "baixa"
  ) {

    preencherSelectProdutos();

  }


  if (
    page
    ===
    "movimentacoes"
  ) {

    renderMovimentacoes();

  }


  if (
    page
    ===
    "validade"
  ) {

    renderValidades();

  }


  if (
    page
    ===
    "relatorios"
  ) {

    inicializarRelatorios();

  }


  if (
    page
    ===
    "usuarios"
    &&
    isGestor()
  ) {

    carregarUsuarios();

  }

}


// =========================================================
// CARREGAMENTO
// =========================================================

async function carregarTudo() {

  await Promise.all([

    carregarProdutos(),

    carregarLotes(),

    carregarMovimentacoes()

  ]);


  preencherSelectProdutos();

  renderDashboard();

  renderEstoque();

  renderMovimentacoes();

  renderValidades();

}


// =========================================================
// PRODUTOS
// =========================================================

async function carregarProdutos() {

  const snap =
    await getDocs(

      collection(
        db,
        "produtos"
      )

    );


  produtosCache =
    snap.docs

      .map(
        documento => ({

          id:
            documento.id,

          ...documento.data()

        })
      )

      .sort(
        (a, b) =>

          (
            a.nome
            ||
            ""
          )
            .localeCompare(

              b.nome
              ||
              "",

              "pt-BR"

            )

      );

}


// =========================================================
// LOTES
// =========================================================

async function carregarLotes() {

  const snap =
    await getDocs(

      collection(
        db,
        "lotes"
      )

    );


  lotesCache =
    snap.docs.map(
      documento => ({

        id:
          documento.id,

        ...documento.data()

      })
    );

}


// =========================================================
// MOVIMENTAÇÕES
// =========================================================

async function carregarMovimentacoes() {

  try {

    const consulta =
      query(

        collection(
          db,
          "movimentacoes"
        ),

        orderBy(
          "criadoEm",
          "desc"
        )

      );


    const snap =
      await getDocs(
        consulta
      );


    movimentosCache =
      snap.docs.map(
        documento => ({

          id:
            documento.id,

          ...documento.data()

        })
      );

  }

  catch (erro) {

    console.warn(
      "Carregando movimentações sem ordenação.",
      erro
    );


    const snap =
      await getDocs(

        collection(
          db,
          "movimentacoes"
        )

      );


    movimentosCache =
      snap.docs.map(
        documento => ({

          id:
            documento.id,

          ...documento.data()

        })
      );


    movimentosCache.sort(
      (a, b) => {

        const dataA =
          a.criadoEm?.seconds
          ||
          0;


        const dataB =
          b.criadoEm?.seconds
          ||
          0;


        return (
          dataB
          -
          dataA
        );

      }
    );

  }

}


// =========================================================
// TOTAL POR PRODUTO
// =========================================================

function totalProduto(
  produtoId
) {

  return lotesCache

    .filter(
      lote =>

        lote.produtoId
        ===
        produtoId

    )

    .reduce(
      (
        total,
        lote
      ) =>

        total
        +
        Number(
          lote.quantidade
          ||
          0
        ),

      0
    );

}


// =========================================================
// DASHBOARD
// =========================================================

function renderDashboard() {

  const quantidadeTotal =
    lotesCache.reduce(
      (
        total,
        lote
      ) =>

        total
        +
        Number(
          lote.quantidade
          ||
          0
        ),

      0
    );


  const estoqueBaixo =
    produtosCache.filter(
      produto =>

        totalProduto(
          produto.id
        )

        <=

        Number(
          produto.estoqueMinimo
          ||
          0
        )

    );


  const vencendo =
    lotesCache.filter(
      lote => {

        const dias =
          diasAte(
            lote.validade
          );


        return (

          Number(
            lote.quantidade
            ||
            0
          )
          >
          0

          &&

          dias
          >=
          0

          &&

          dias
          <=
          90

        );

      }
    );


  $("statProdutos")
    .textContent =
    produtosCache.length;


  $("statQuantidade")
    .textContent =
    quantidadeTotal;


  $("statBaixo")
    .textContent =
    estoqueBaixo.length;


  $("statVencendo")
    .textContent =
    vencendo.length;


  const alertas =
    lotesCache

      .filter(
        lote => {

          const produto =
            produtosCache.find(
              item =>
                item.id
                ===
                lote.produtoId
            );


          const quantidade =
            Number(
              lote.quantidade
              ||
              0
            );


          if (
            quantidade
            <=
            0
          ) {

            return false;

          }


          const dias =
            diasAte(
              lote.validade
            );


          const problemaValidade =
            dias
            <=
            90;


          const problemaEstoque =
            produto
              ?
              totalProduto(
                produto.id
              )
              <=
              Number(
                produto.estoqueMinimo
                ||
                0
              )
              :
              false;


          return (

            problemaValidade
            ||
            problemaEstoque

          );

        }
      )

      .sort(
        (a, b) =>

          (
            a.validade
            ||
            "9999"
          )
            .localeCompare(
              b.validade
              ||
              "9999"
            )

      );


  if (
    !alertas.length
  ) {

    $("dashboardAlertas")
      .innerHTML = `

        <tr>

          <td colspan="5">

            Nenhum alerta no momento.

          </td>

        </tr>

      `;


    return;

  }


  $("dashboardAlertas")
    .innerHTML =
    alertas.map(
      lote => {

        const produto =
          produtosCache.find(
            item =>
              item.id
              ===
              lote.produtoId
          );


        const dias =
          diasAte(
            lote.validade
          );


        let badge =
          '<span class="badge ok">Normal</span>';


        if (
          dias
          <
          0
        ) {

          badge =
            '<span class="badge danger">Vencido</span>';

        }

        else if (
          dias
          <=
          30
        ) {

          badge =
            '<span class="badge danger">Vence em até 30 dias</span>';

        }

        else if (
          dias
          <=
          90
        ) {

          badge =
            '<span class="badge warning">Vence em até 90 dias</span>';

        }

        else if (
          produto
          &&
          totalProduto(
            produto.id
          )
          <=
          Number(
            produto.estoqueMinimo
            ||
            0
          )
        ) {

          badge =
            '<span class="badge warning">Estoque baixo</span>';

        }


        return `

          <tr>

            <td>
              ${esc(
                produto?.nome
                ||
                "-"
              )}
            </td>

            <td>
              ${esc(
                lote.lote
                ||
                "-"
              )}
            </td>

            <td>
              ${formatDateBR(
                lote.validade
              )}
            </td>

            <td>
              ${Number(
                lote.quantidade
                ||
                0
              )}
            </td>

            <td>
              ${badge}
            </td>

          </tr>

        `;

      }
    )
    .join("");

}


// =========================================================
// ATUALIZAR DASHBOARD
// =========================================================

$("refreshDashboard")
  ?.addEventListener(
    "click",
    carregarTudo
  );


// =========================================================
// NOVO PRODUTO
// =========================================================

$("btnNovoProduto")
  ?.addEventListener(
    "click",
    () => {

      if (
        !podeOperar()
      ) {

        return;

      }


      $("produtoForm")
        .reset();


      $("produtoId")
        .value =
        "";


      $("produtoMinimo")
        .value =
        "0";


      $("produtoFormTitulo")
        .textContent =
        "Cadastrar produto";


      $("produtoFormPanel")
        .classList
        .remove(
          "hidden"
        );

    }
  );


// =========================================================
// CANCELAR PRODUTO
// =========================================================

$("cancelProduto")
  ?.addEventListener(
    "click",
    () => {

      $("produtoFormPanel")
        .classList
        .add(
          "hidden"
        );

    }
  );


// =========================================================
// SALVAR PRODUTO
// =========================================================

$("produtoForm")
  ?.addEventListener(
    "submit",
    async (event) => {

      event.preventDefault();


      if (
        !podeOperar()
      ) {

        return;

      }


      const id =
        $("produtoId")
          .value;


      const codigoBarras =
        normalizarCodigoBarras(
          $("produtoCodigoBarras")
            .value
        );


      if (
        codigoBarras
      ) {

        const duplicado =
          produtosCache.find(
            produto =>

              normalizarCodigoBarras(
                produto.codigoBarras
              )
              ===
              codigoBarras

              &&

              produto.id
              !==
              id

          );


        if (
          duplicado
        ) {

          alert(

            `Este código de barras já pertence ao produto: ${duplicado.nome}.`

          );


          return;

        }

      }


      const dados = {

        nome:
          $("produtoNome")
            .value
            .trim(),

        codigoBarras,

        apresentacao:
          $("produtoApresentacao")
            .value
            .trim(),

        categoria:
          $("produtoCategoria")
            .value
            .trim(),

        unidade:
          $("produtoUnidade")
            .value
            .trim(),

        estoqueMinimo:
          Number(
            $("produtoMinimo")
              .value
            ||
            0
          ),

        localizacao:
          $("produtoLocalizacao")
            .value
            .trim(),

        atualizadoEm:
          serverTimestamp(),

        atualizadoPor:
          usuarioAtual.uid

      };


      try {

        if (
          id
        ) {

          await updateDoc(

            doc(
              db,
              "produtos",
              id
            ),

            dados

          );

        }

        else {

          await addDoc(

            collection(
              db,
              "produtos"
            ),

            {

              ...dados,

              criadoEm:
                serverTimestamp(),

              criadoPor:
                usuarioAtual.uid

            }

          );

        }


        $("produtoFormPanel")
          .classList
          .add(
            "hidden"
          );


        await carregarProdutos();


        preencherSelectProdutos();

        renderEstoque();

        renderDashboard();

      }

      catch (erro) {

        console.error(erro);


        alert(
          "Erro ao salvar produto."
        );

      }

    }
  );


// =========================================================
// EDITAR PRODUTO
// =========================================================

window.editarProduto =
  (id) => {

    if (
      !podeOperar()
    ) {

      return;

    }


    const produto =
      produtosCache.find(
        item =>
          item.id
          ===
          id
      );


    if (
      !produto
    ) {

      return;

    }


    $("produtoId")
      .value =
      produto.id;


    $("produtoNome")
      .value =
      produto.nome
      ||
      "";


    $("produtoCodigoBarras")
      .value =
      produto.codigoBarras
      ||
      "";


    $("produtoApresentacao")
      .value =
      produto.apresentacao
      ||
      "";


    $("produtoCategoria")
      .value =
      produto.categoria
      ||
      "";


    $("produtoUnidade")
      .value =
      produto.unidade
      ||
      "";


    $("produtoMinimo")
      .value =
      Number(
        produto.estoqueMinimo
        ||
        0
      );


    $("produtoLocalizacao")
      .value =
      produto.localizacao
      ||
      "";


    $("produtoFormTitulo")
      .textContent =
      "Editar produto";


    $("produtoFormPanel")
      .classList
      .remove(
        "hidden"
      );


    window.scrollTo({

      top:
        0,

      behavior:
        "smooth"

    });

  };


// =========================================================
// EXCLUIR PRODUTO
// =========================================================

window.excluirProduto =
  async (id) => {

    if (
      !isGestor()
    ) {

      return;

    }


    const possuiEstoque =
      lotesCache.some(
        lote =>

          lote.produtoId
          ===
          id

          &&

          Number(
            lote.quantidade
            ||
            0
          )
          >
          0
      );


    if (
      possuiEstoque
    ) {

      alert(
        "Não é possível excluir um produto que ainda possui estoque."
      );


      return;

    }


    if (
      !confirm(
        "Deseja realmente excluir este produto?"
      )
    ) {

      return;

    }


    try {

      await deleteDoc(

        doc(
          db,
          "produtos",
          id
        )

      );


      await carregarProdutos();


      preencherSelectProdutos();

      renderEstoque();

      renderDashboard();

    }

    catch (erro) {

      console.error(erro);


      alert(
        "Erro ao excluir produto."
      );

    }

  };


// =========================================================
// ESTOQUE
// =========================================================

function renderEstoque() {

  if (
    !$("estoqueBody")
  ) {

    return;

  }


  const busca =
    $("searchProduto")
      ?.value
      .trim()
      .toLowerCase()
    ||
    "";


  const lista =
    produtosCache.filter(
      produto => {

        const texto = [

          produto.nome,

          produto.codigoBarras,

          produto.apresentacao,

          produto.categoria,

          produto.localizacao,

          produto.unidade

        ]
          .join(" ")
          .toLowerCase();


        return texto.includes(
          busca
        );

      }
    );


  if (
    !lista.length
  ) {

    $("estoqueBody")
      .innerHTML = `

        <tr>

          <td colspan="8">

            Nenhum produto encontrado.

          </td>

        </tr>

      `;


    return;

  }


  $("estoqueBody")
    .innerHTML =
    lista.map(
      produto => {

        const total =
          totalProduto(
            produto.id
          );


        const baixo =
          total
          <=
          Number(
            produto.estoqueMinimo
            ||
            0
          );


        let acoes =
          "-";


        if (
          podeOperar()
        ) {

          acoes = `

            <button
              class="btn btn-secondary"
              onclick="editarProduto('${produto.id}')"
            >
              Editar
            </button>

          `;


          if (
            isGestor()
          ) {

            acoes += `

              <button
                class="btn btn-danger"
                onclick="excluirProduto('${produto.id}')"
              >
                Excluir
              </button>

            `;

          }

        }


        return `

          <tr>

            <td>
              ${esc(
                produto.nome
                ||
                "-"
              )}
            </td>

            <td>
              ${esc(
                produto.codigoBarras
                ||
                "-"
              )}
            </td>

            <td>
              ${esc(
                produto.apresentacao
                ||
                "-"
              )}
            </td>

            <td>
              ${esc(
                produto.unidade
                ||
                "-"
              )}
            </td>

            <td>
              ${total}
            </td>

            <td>
              ${Number(
                produto.estoqueMinimo
                ||
                0
              )}
            </td>

            <td>

              ${
                baixo
                  ?
                  '<span class="badge warning">Baixo</span>'
                  :
                  '<span class="badge ok">Normal</span>'
              }

            </td>

            <td>
              ${acoes}
            </td>

          </tr>

        `;

      }
    )
    .join("");

}


// =========================================================
// PESQUISA ESTOQUE
// =========================================================

$("searchProduto")
  ?.addEventListener(
    "input",
    renderEstoque
  );


// =========================================================
// SELECT DE PRODUTOS
// =========================================================

function preencherSelectProdutos() {

  const opcoes =

    `
      <option value="">
        Selecione...
      </option>
    `

    +

    produtosCache.map(
      produto => `

        <option value="${produto.id}">

          ${esc(
            produto.nome
          )}

          ${
            produto.apresentacao
              ?
              ` - ${esc(
                produto.apresentacao
              )}`
              :
              ""
          }

        </option>

      `
    )
    .join("");


  if (
    $("entradaProduto")
  ) {

    $("entradaProduto")
      .innerHTML =
      opcoes;

  }


  if (
    $("baixaProduto")
  ) {

    $("baixaProduto")
      .innerHTML =
      opcoes;

  }


  preencherLotesBaixa();

}


// =========================================================
// LOCALIZAR CÓDIGO NA ENTRADA
// =========================================================

function localizarCodigoEntrada() {

  const campo =
    $("entradaCodigoBarras");


  if (
    !campo
  ) {

    return;

  }


  const codigo =
    normalizarCodigoBarras(
      campo.value
    );


  if (
    !codigo
  ) {

    return;

  }


  const produto =
    encontrarProdutoPorCodigo(
      codigo
    );


  if (
    produto
  ) {

    $("entradaProduto")
      .value =
      produto.id;


    hideMsg(
      $("entradaMsg")
    );

  }

  else {

    $("entradaProduto")
      .value =
      "";


    showMsg(

      $("entradaMsg"),

      "Código de barras não encontrado no cadastro de produtos."

    );

  }

}


$("entradaCodigoBarras")
  ?.addEventListener(
    "change",
    localizarCodigoEntrada
  );


$("entradaCodigoBarras")
  ?.addEventListener(
    "keydown",
    event => {

      if (
        event.key
        ===
        "Enter"
      ) {

        event.preventDefault();


        localizarCodigoEntrada();

      }

    }
  );


// =========================================================
// SELEÇÃO MANUAL NA ENTRADA
// =========================================================

$("entradaProduto")
  ?.addEventListener(
    "change",
    () => {

      const produtoId =
        $("entradaProduto")
          .value;


      const produto =
        produtosCache.find(
          item =>
            item.id
            ===
            produtoId
        );


      if (
        produto
        &&
        $("entradaCodigoBarras")
      ) {

        $("entradaCodigoBarras")
          .value =
          produto.codigoBarras
          ||
          "";

      }

    }
  );


// =========================================================
// ENTRADA DE ESTOQUE
// =========================================================

$("entradaForm")
  ?.addEventListener(
    "submit",
    async (event) => {

      event.preventDefault();


      if (
        !podeOperar()
      ) {

        return;

      }


      const produtoId =
        $("entradaProduto")
          .value;


      const loteNumero =
        $("entradaLote")
          .value
          .trim();


      const validade =
        $("entradaValidade")
          .value;


      const quantidade =
        Number(
          $("entradaQuantidade")
            .value
        );


      if (
        !produtoId
        ||
        !loteNumero
        ||
        !validade
        ||
        quantidade
        <=
        0
      ) {

        showMsg(

          $("entradaMsg"),

          "Preencha corretamente os campos obrigatórios."

        );


        return;

      }


      try {

        const produto =
          produtosCache.find(
            item =>
              item.id
              ===
              produtoId
          );


        if (
          !produto
        ) {

          throw new Error(
            "Produto não encontrado."
          );

        }


        const existente =
          lotesCache.find(
            lote =>

              lote.produtoId
              ===
              produtoId

              &&

              String(
                lote.lote
                ||
                ""
              )
                .trim()
                .toLowerCase()

              ===

              loteNumero
                .toLowerCase()

              &&

              lote.validade
              ===
              validade
          );


        let loteId;


        if (
          existente
        ) {

          const loteRef =
            doc(

              db,

              "lotes",

              existente.id

            );


          await runTransaction(

            db,

            async transaction => {

              const snap =
                await transaction.get(
                  loteRef
                );


              if (
                !snap.exists()
              ) {

                throw new Error(
                  "Lote não encontrado."
                );

              }


              const atual =
                Number(
                  snap.data()
                    .quantidade
                  ||
                  0
                );


              transaction.update(

                loteRef,

                {

                  quantidade:
                    atual
                    +
                    quantidade,

                  atualizadoEm:
                    serverTimestamp(),

                  atualizadoPor:
                    usuarioAtual.uid

                }

              );

            }

          );


          loteId =
            existente.id;

        }

        else {

          const ref =
            await addDoc(

              collection(
                db,
                "lotes"
              ),

              {

                produtoId,

                lote:
                  loteNumero,

                validade,

                quantidade,

                criadoEm:
                  serverTimestamp(),

                criadoPor:
                  usuarioAtual.uid

              }

            );


          loteId =
            ref.id;

        }


        await addDoc(

          collection(
            db,
            "movimentacoes"
          ),

          {

            tipo:
              "entrada",

            produtoId,

            produtoNome:
              produto.nome
              ||
              "",

            codigoBarras:
              produto.codigoBarras
              ||
              "",

            loteId,

            lote:
              loteNumero,

            quantidade,

            origem:
              $("entradaOrigem")
                .value
                .trim(),

            observacao:
              $("entradaObs")
                .value
                .trim(),

            responsavelUid:
              usuarioAtual.uid,

            responsavelNome:
              usuarioAtual.nome
              ||
              usuarioAtual.email,

            criadoEm:
              serverTimestamp()

          }

        );


        $("entradaForm")
          .reset();


        showMsg(

          $("entradaMsg"),

          "Entrada registrada com sucesso.",

          "ok"

        );


        await carregarLotes();

        await carregarMovimentacoes();


        preencherSelectProdutos();

        renderDashboard();

        renderEstoque();

        renderMovimentacoes();

        renderValidades();

      }

      catch (erro) {

        console.error(erro);


        showMsg(

          $("entradaMsg"),

          erro.message
          ||
          "Erro ao registrar entrada."

        );

      }

    }
  );


// =========================================================
// LOCALIZAR CÓDIGO NA BAIXA
// =========================================================

function localizarCodigoBaixa() {

  const campo =
    $("baixaCodigoBarras");


  if (
    !campo
  ) {

    return;

  }


  const codigo =
    normalizarCodigoBarras(
      campo.value
    );


  if (
    !codigo
  ) {

    return;

  }


  const produto =
    encontrarProdutoPorCodigo(
      codigo
    );


  if (
    produto
  ) {

    $("baixaProduto")
      .value =
      produto.id;


    preencherLotesBaixa();


    hideMsg(
      $("baixaMsg")
    );

  }

  else {

    $("baixaProduto")
      .value =
      "";


    preencherLotesBaixa();


    showMsg(

      $("baixaMsg"),

      "Código de barras não encontrado no cadastro de produtos."

    );

  }

}


$("baixaCodigoBarras")
  ?.addEventListener(
    "change",
    localizarCodigoBaixa
  );


$("baixaCodigoBarras")
  ?.addEventListener(
    "keydown",
    event => {

      if (
        event.key
        ===
        "Enter"
      ) {

        event.preventDefault();


        localizarCodigoBaixa();

      }

    }
  );


// =========================================================
// PRODUTO MANUAL NA BAIXA
// =========================================================

$("baixaProduto")
  ?.addEventListener(
    "change",
    () => {

      const produtoId =
        $("baixaProduto")
          .value;


      const produto =
        produtosCache.find(
          item =>
            item.id
            ===
            produtoId
        );


      if (
        produto
        &&
        $("baixaCodigoBarras")
      ) {

        $("baixaCodigoBarras")
          .value =
          produto.codigoBarras
          ||
          "";

      }


      preencherLotesBaixa();

    }
  );


// =========================================================
// LOTES DA BAIXA
// =========================================================

function preencherLotesBaixa() {

  if (
    !$("baixaProduto")
    ||
    !$("baixaLote")
  ) {

    return;

  }


  const produtoId =
    $("baixaProduto")
      .value;


  const lotes =
    lotesCache

      .filter(
        lote =>

          lote.produtoId
          ===
          produtoId

          &&

          Number(
            lote.quantidade
            ||
            0
          )
          >
          0

      )

      .sort(
        (a, b) =>

          (
            a.validade
            ||
            "9999"
          )
            .localeCompare(
              b.validade
              ||
              "9999"
            )

      );


  $("baixaLote")
    .innerHTML =

    `
      <option value="">
        Selecione...
      </option>
    `

    +

    lotes.map(
      (
        lote,
        index
      ) => `

        <option value="${lote.id}">

          ${
            index
            ===
            0
              ?
              "FEFO → "
              :
              ""
          }

          ${esc(
            lote.lote
          )}

          |

          ${formatDateBR(
            lote.validade
          )}

          |

          qtd. ${Number(
            lote.quantidade
            ||
            0
          )}

        </option>

      `
    )
    .join("");

}


// =========================================================
// BAIXA
// =========================================================

$("baixaForm")
  ?.addEventListener(
    "submit",
    async (event) => {

      event.preventDefault();


      if (
        !podeOperar()
      ) {

        return;

      }


      const produtoId =
        $("baixaProduto")
          .value;


      const loteId =
        $("baixaLote")
          .value;


      const quantidade =
        Number(
          $("baixaQuantidade")
            .value
        );


      if (
        !produtoId
        ||
        !loteId
        ||
        quantidade
        <=
        0
      ) {

        showMsg(

          $("baixaMsg"),

          "Preencha corretamente os campos obrigatórios."

        );


        return;

      }


      try {

        const produto =
          produtosCache.find(
            item =>
              item.id
              ===
              produtoId
          );


        if (
          !produto
        ) {

          throw new Error(
            "Produto não encontrado."
          );

        }


        const loteRef =
          doc(

            db,

            "lotes",

            loteId

          );


        let loteDados =
          null;


        await runTransaction(

          db,

          async transaction => {

            const snap =
              await transaction.get(
                loteRef
              );


            if (
              !snap.exists()
            ) {

              throw new Error(
                "Lote não encontrado."
              );

            }


            loteDados =
              snap.data();


            const atual =
              Number(
                loteDados.quantidade
                ||
                0
              );


            if (
              quantidade
              >
              atual
            ) {

              throw new Error(

                `Estoque insuficiente. Disponível: ${atual}.`

              );

            }


            transaction.update(

              loteRef,

              {

                quantidade:
                  atual
                  -
                  quantidade,

                atualizadoEm:
                  serverTimestamp(),

                atualizadoPor:
                  usuarioAtual.uid

              }

            );

          }

        );


        await addDoc(

          collection(
            db,
            "movimentacoes"
          ),

          {

            tipo:
              "saida",

            produtoId,

            produtoNome:
              produto.nome
              ||
              "",

            codigoBarras:
              produto.codigoBarras
              ||
              "",

            loteId,

            lote:
              loteDados?.lote
              ||
              "",

            quantidade,

            destino:
              $("baixaDestino")
                .value
                .trim(),

            motivo:
              $("baixaMotivo")
                .value,

            observacao:
              $("baixaObs")
                .value
                .trim(),

            responsavelUid:
              usuarioAtual.uid,

            responsavelNome:
              usuarioAtual.nome
              ||
              usuarioAtual.email,

            criadoEm:
              serverTimestamp()

          }

        );


        $("baixaForm")
          .reset();


        showMsg(

          $("baixaMsg"),

          "Baixa registrada com sucesso.",

          "ok"

        );


        await carregarLotes();

        await carregarMovimentacoes();


        preencherSelectProdutos();

        renderDashboard();

        renderEstoque();

        renderMovimentacoes();

        renderValidades();

      }

      catch (erro) {

        console.error(erro);


        showMsg(

          $("baixaMsg"),

          erro.message
          ||
          "Erro ao registrar baixa."

        );

      }

    }
  );


// =========================================================
// MOVIMENTAÇÕES
// =========================================================

function renderMovimentacoes() {

  if (
    !$("movBody")
  ) {

    return;

  }


  const tipo =
    $("movTipoFiltro")
      ?.value
    ||
    "";


  const busca =
    $("movBusca")
      ?.value
      .trim()
      .toLowerCase()
    ||
    "";


  const lista =
    movimentosCache.filter(
      movimento => {

        const tipoOk =
          !tipo
          ||
          movimento.tipo
          ===
          tipo;


        const texto = [

          movimento.produtoNome,

          codigoMovimentacao(
            movimento
          ),

          movimento.lote,

          movimento.responsavelNome,

          movimento.destino,

          movimento.origem,

          movimento.motivo

        ]
          .join(" ")
          .toLowerCase();


        return (

          tipoOk

          &&

          texto.includes(
            busca
          )

        );

      }
    );


  if (
    !lista.length
  ) {

    $("movBody")
      .innerHTML = `

        <tr>

          <td colspan="8">

            Nenhuma movimentação encontrada.

          </td>

        </tr>

      `;


    return;

  }


  $("movBody")
    .innerHTML =
    lista.map(
      movimento => `

        <tr>

          <td>
            ${formatarDataHora(
              movimento.criadoEm
            )}
          </td>

          <td>

            ${
              movimento.tipo
              ===
              "entrada"
                ?
                '<span class="badge ok">Entrada</span>'
                :
                '<span class="badge info">Saída</span>'
            }

          </td>

          <td>
            ${esc(
              movimento.produtoNome
              ||
              "-"
            )}
          </td>

          <td>
            ${esc(
              codigoMovimentacao(
                movimento
              )
            )}
          </td>

          <td>
            ${esc(
              movimento.lote
              ||
              "-"
            )}
          </td>

          <td>
            ${Number(
              movimento.quantidade
              ||
              0
            )}
          </td>

          <td>
            ${esc(
              movimento.destino
              ||
              movimento.origem
              ||
              "-"
            )}
          </td>

          <td>
            ${esc(
              movimento.responsavelNome
              ||
              "-"
            )}
          </td>

        </tr>

      `
    )
    .join("");

}


// =========================================================
// FILTROS MOVIMENTAÇÕES
// =========================================================

$("movTipoFiltro")
  ?.addEventListener(
    "change",
    renderMovimentacoes
  );


$("movBusca")
  ?.addEventListener(
    "input",
    renderMovimentacoes
  );


// =========================================================
// VALIDADES
// =========================================================

function statusValidade(
  lote
) {

  const dias =
    diasAte(
      lote.validade
    );


  if (
    dias
    <
    0
  ) {

    return {

      texto:
        "Vencido",

      classe:
        "danger"

    };

  }


  if (
    dias
    <=
    30
  ) {

    return {

      texto:
        "Até 30 dias",

      classe:
        "danger"

    };

  }


  if (
    dias
    <=
    90
  ) {

    return {

      texto:
        "Até 90 dias",

      classe:
        "warning"

    };

  }


  return {

    texto:
      "Regular",

    classe:
      "ok"

  };

}


function renderValidades() {

  if (
    !$("validadeBody")
  ) {

    return;

  }


  const lista =
    [

      ...lotesCache

    ]
      .sort(
        (a, b) =>

          (
            a.validade
            ||
            "9999"
          )
            .localeCompare(
              b.validade
              ||
              "9999"
            )

      );


  if (
    !lista.length
  ) {

    $("validadeBody")
      .innerHTML = `

        <tr>

          <td colspan="6">

            Nenhum lote cadastrado.

          </td>

        </tr>

      `;


    return;

  }


  $("validadeBody")
    .innerHTML =
    lista.map(
      lote => {

        const produto =
          produtosCache.find(
            item =>
              item.id
              ===
              lote.produtoId
          );


        const status =
          statusValidade(
            lote
          );


        return `

          <tr>

            <td>
              ${esc(
                produto?.nome
                ||
                "-"
              )}
            </td>

            <td>
              ${esc(
                produto?.codigoBarras
                ||
                "-"
              )}
            </td>

            <td>
              ${esc(
                lote.lote
                ||
                "-"
              )}
            </td>

            <td>
              ${formatDateBR(
                lote.validade
              )}
            </td>

            <td>
              ${Number(
                lote.quantidade
                ||
                0
              )}
            </td>

            <td>

              <span
                class="badge ${status.classe}"
              >
                ${status.texto}
              </span>

            </td>

          </tr>

        `;

      }
    )
    .join("");

}


// =========================================================
// USUÁRIOS
// =========================================================

async function carregarUsuarios() {

  if (
    !isGestor()
  ) {

    return;

  }


  try {

    const snap =
      await getDocs(

        collection(
          db,
          "usuarios"
        )

      );


    usuariosCache =
      snap.docs.map(
        documento => ({

          id:
            documento.id,

          ...documento.data()

        })
      );


    usuariosCache.sort(
      (a, b) =>

        (
          a.nome
          ||
          a.email
          ||
          ""
        )
          .localeCompare(

            b.nome
            ||
            b.email
            ||
            "",

            "pt-BR"

          )

    );


    renderUsuarios();

  }

  catch (erro) {

    console.error(erro);


    $("usuariosBody")
      .innerHTML = `

        <tr>

          <td colspan="5">

            Erro ao carregar usuários.

          </td>

        </tr>

      `;

  }

}


// =========================================================
// RENDER USUÁRIOS
// =========================================================

function renderUsuarios() {

  if (
    !$("usuariosBody")
  ) {

    return;

  }


  if (
    !usuariosCache.length
  ) {

    $("usuariosBody")
      .innerHTML = `

        <tr>

          <td colspan="5">

            Nenhum usuário cadastrado.

          </td>

        </tr>

      `;


    return;

  }


  $("usuariosBody")
    .innerHTML =
    usuariosCache.map(
      usuario => `

        <tr>

          <td>
            ${esc(
              usuario.nome
              ||
              "-"
            )}
          </td>

          <td>
            ${esc(
              usuario.email
              ||
              "-"
            )}
          </td>

          <td>
            ${esc(
              perfilLabel(
                usuario.perfil
              )
            )}
          </td>

          <td>

            ${
              usuario.ativo
              ===
              false
                ?
                '<span class="badge danger">Inativo</span>'
                :
                '<span class="badge ok">Ativo</span>'
            }

          </td>

          <td>

            <button
              class="btn btn-secondary"
              onclick="editarUsuario('${usuario.id}')"
            >
              Editar
            </button>

          </td>

        </tr>

      `
    )
    .join("");

}


// =========================================================
// EDITAR USUÁRIO
// =========================================================

window.editarUsuario =
  (id) => {

    if (
      !isGestor()
    ) {

      return;

    }


    const usuario =
      usuariosCache.find(
        item =>
          item.id
          ===
          id
      );


    if (
      !usuario
    ) {

      return;

    }


    $("usuarioId")
      .value =
      usuario.id;


    $("usuarioNome")
      .value =
      usuario.nome
      ||
      "";


    $("usuarioEmail")
      .value =
      usuario.email
      ||
      "";


    $("usuarioPerfil")
      .value =
      usuario.perfil
      ||
      "consulta";


    $("usuarioAtivo")
      .value =
      usuario.ativo
      ===
      false
        ?
        "false"
        :
        "true";


    $("usuarioFormPanel")
      .classList
      .remove(
        "hidden"
      );


    window.scrollTo({

      top:
        0,

      behavior:
        "smooth"

    });

  };


// =========================================================
// CANCELAR USUÁRIO
// =========================================================

$("cancelUsuario")
  ?.addEventListener(
    "click",
    () => {

      $("usuarioForm")
        ?.reset();


      $("usuarioFormPanel")
        ?.classList
        .add(
          "hidden"
        );

    }
  );


// =========================================================
// SALVAR USUÁRIO
// =========================================================

$("usuarioForm")
  ?.addEventListener(
    "submit",
    async event => {

      event.preventDefault();


      if (
        !isGestor()
      ) {

        return;

      }


      const id =
        $("usuarioId")
          .value;


      const nome =
        $("usuarioNome")
          .value
          .trim();


      const perfil =
        $("usuarioPerfil")
          .value;


      const ativo =
        $("usuarioAtivo")
          .value
        ===
        "true";


      if (
        !id
        ||
        !nome
      ) {

        alert(
          "Preencha os dados do usuário."
        );


        return;

      }


      if (
        id
        ===
        usuarioAtual.uid
      ) {

        if (
          !ativo
        ) {

          alert(
            "Você não pode desativar o usuário que está utilizando no momento."
          );


          return;

        }


        if (
          perfil
          !==
          "gestor"
        ) {

          alert(
            "Para evitar perda de acesso, você não pode retirar o perfil Gestor da sua própria conta."
          );


          return;

        }

      }


      try {

        await updateDoc(

          doc(
            db,
            "usuarios",
            id
          ),

          {

            nome,

            perfil,

            ativo,

            atualizadoEm:
              serverTimestamp(),

            atualizadoPor:
              usuarioAtual.uid

          }

        );


        $("usuarioFormPanel")
          .classList
          .add(
            "hidden"
          );


        $("usuarioForm")
          .reset();


        await carregarUsuarios();


        alert(
          "Usuário atualizado com sucesso."
        );

      }

      catch (erro) {

        console.error(erro);


        alert(
          "Erro ao atualizar usuário."
        );

      }

    }
  );


// =========================================================
// RELATÓRIOS
// =========================================================

function inicializarRelatorios() {

  if (
    !$("relatorioTipo")
  ) {

    return;

  }


  if (
    !relatorioAtual.tipo
  ) {

    gerarRelatorio();

  }

}


// =========================================================
// MOVIMENTO DENTRO DO PERÍODO
// =========================================================

function movimentoDentroPeriodo(
  movimento,
  dataInicial,
  dataFinal
) {

  const data =
    timestampParaData(
      movimento.criadoEm
    );


  if (
    !data
  ) {

    return (

      !dataInicial
      &&
      !dataFinal

    );

  }


  if (
    dataInicial
  ) {

    const inicio =
      new Date(
        `${dataInicial}T00:00:00`
      );


    if (
      data
      <
      inicio
    ) {

      return false;

    }

  }


  if (
    dataFinal
  ) {

    const fim =
      new Date(
        `${dataFinal}T23:59:59`
      );


    if (
      data
      >
      fim
    ) {

      return false;

    }

  }


  return true;

}


// =========================================================
// GERAR RELATÓRIO
// =========================================================

function gerarRelatorio() {

  if (
    !$("relatorioTipo")
  ) {

    return;

  }


  const tipo =
    $("relatorioTipo")
      .value
    ||
    "estoque";


  const dataInicial =
    $("relatorioDataInicial")
      ?.value
    ||
    "";


  const dataFinal =
    $("relatorioDataFinal")
      ?.value
    ||
    "";


  const busca =
    $("relatorioBusca")
      ?.value
      .trim()
      .toLowerCase()
    ||
    "";


  let registros =
    [];


  let titulo =
    "Relatório";


  let head =
    "";


  let body =
    "";


  let totalQuantidade =
    0;


  let totalEntradas =
    0;


  let totalSaidas =
    0;


  // =======================================================
  // ESTOQUE ATUAL
  // =======================================================

  if (
    tipo
    ===
    "estoque"
  ) {

    titulo =
      "Relatório de Estoque Atual";


    registros =
      produtosCache

        .map(
          produto => ({

            produto,

            quantidade:
              totalProduto(
                produto.id
              )

          })
        )

        .filter(
          item => {

            const texto = [

              item.produto.nome,

              item.produto.codigoBarras,

              item.produto.apresentacao,

              item.produto.categoria,

              item.produto.localizacao

            ]
              .join(" ")
              .toLowerCase();


            return texto.includes(
              busca
            );

          }
        );


    head = `

      <tr>

        <th>Produto</th>

        <th>Código</th>

        <th>Apresentação</th>

        <th>Unidade</th>

        <th>Quantidade</th>

        <th>Mínimo</th>

        <th>Situação</th>

      </tr>

    `;


    body =
      registros.map(
        item => {

          const minimo =
            Number(
              item.produto.estoqueMinimo
              ||
              0
            );


          const baixo =
            item.quantidade
            <=
            minimo;


          totalQuantidade +=
            item.quantidade;


          return `

            <tr>

              <td>
                ${esc(
                  item.produto.nome
                  ||
                  "-"
                )}
              </td>

              <td>
                ${esc(
                  item.produto.codigoBarras
                  ||
                  "-"
                )}
              </td>

              <td>
                ${esc(
                  item.produto.apresentacao
                  ||
                  "-"
                )}
              </td>

              <td>
                ${esc(
                  item.produto.unidade
                  ||
                  "-"
                )}
              </td>

              <td>
                ${item.quantidade}
              </td>

              <td>
                ${minimo}
              </td>

              <td>

                ${
                  baixo
                    ?
                    '<span class="badge warning">Baixo</span>'
                    :
                    '<span class="badge ok">Normal</span>'
                }

              </td>

            </tr>

          `;

        }
      )
      .join("");

  }


  // =======================================================
  // ESTOQUE BAIXO
  // =======================================================

  if (
    tipo
    ===
    "baixo"
  ) {

    titulo =
      "Relatório de Estoque Baixo";


    registros =
      produtosCache

        .map(
          produto => ({

            produto,

            quantidade:
              totalProduto(
                produto.id
              )

          })
        )

        .filter(
          item => {

            const minimo =
              Number(
                item.produto.estoqueMinimo
                ||
                0
              );


            const texto = [

              item.produto.nome,

              item.produto.codigoBarras,

              item.produto.apresentacao,

              item.produto.categoria

            ]
              .join(" ")
              .toLowerCase();


            return (

              item.quantidade
              <=
              minimo

              &&

              texto.includes(
                busca
              )

            );

          }
        );


    head = `

      <tr>

        <th>Produto</th>

        <th>Código</th>

        <th>Apresentação</th>

        <th>Quantidade atual</th>

        <th>Estoque mínimo</th>

        <th>Falta</th>

      </tr>

    `;


    body =
      registros.map(
        item => {

          const minimo =
            Number(
              item.produto.estoqueMinimo
              ||
              0
            );


          const falta =
            Math.max(
              minimo
              -
              item.quantidade,
              0
            );


          totalQuantidade +=
            item.quantidade;


          return `

            <tr>

              <td>
                ${esc(
                  item.produto.nome
                  ||
                  "-"
                )}
              </td>

              <td>
                ${esc(
                  item.produto.codigoBarras
                  ||
                  "-"
                )}
              </td>

              <td>
                ${esc(
                  item.produto.apresentacao
                  ||
                  "-"
                )}
              </td>

              <td>
                ${item.quantidade}
              </td>

              <td>
                ${minimo}
              </td>

              <td>
                ${falta}
              </td>

            </tr>

          `;

        }
      )
      .join("");

  }


  // =======================================================
  // VALIDADE
  // =======================================================

  if (
    tipo
    ===
    "validade"
  ) {

    titulo =
      "Relatório de Produtos Próximos do Vencimento";


    registros =
      lotesCache

        .filter(
          lote => {

            const produto =
              produtosCache.find(
                item =>
                  item.id
                  ===
                  lote.produtoId
              );


            const dias =
              diasAte(
                lote.validade
              );


            const texto = [

              produto?.nome,

              produto?.codigoBarras,

              lote.lote

            ]
              .join(" ")
              .toLowerCase();


            return (

              Number(
                lote.quantidade
                ||
                0
              )
              >
              0

              &&

              dias
              <=
              90

              &&

              texto.includes(
                busca
              )

            );

          }
        )

        .sort(
          (a, b) =>

            (
              a.validade
              ||
              ""
            )
              .localeCompare(
                b.validade
                ||
                ""
              )

        );


    head = `

      <tr>

        <th>Produto</th>

        <th>Código</th>

        <th>Lote</th>

        <th>Validade</th>

        <th>Quantidade</th>

        <th>Status</th>

      </tr>

    `;


    body =
      registros.map(
        lote => {

          const produto =
            produtosCache.find(
              item =>
                item.id
                ===
                lote.produtoId
            );


          const status =
            statusValidade(
              lote
            );


          totalQuantidade +=
            Number(
              lote.quantidade
              ||
              0
            );


          return `

            <tr>

              <td>
                ${esc(
                  produto?.nome
                  ||
                  "-"
                )}
              </td>

              <td>
                ${esc(
                  produto?.codigoBarras
                  ||
                  "-"
                )}
              </td>

              <td>
                ${esc(
                  lote.lote
                  ||
                  "-"
                )}
              </td>

              <td>
                ${formatDateBR(
                  lote.validade
                )}
              </td>

              <td>
                ${Number(
                  lote.quantidade
                  ||
                  0
                )}
              </td>

              <td>

                <span
                  class="badge ${status.classe}"
                >
                  ${status.texto}
                </span>

              </td>

            </tr>

          `;

        }
      )
      .join("");

  }


  // =======================================================
  // MOVIMENTAÇÕES / ENTRADAS / SAÍDAS
  // =======================================================

  if (
    [

      "entradas",

      "saidas",

      "movimentacoes"

    ].includes(
      tipo
    )
  ) {

    let filtroTipo =
      "";


    if (
      tipo
      ===
      "entradas"
    ) {

      titulo =
        "Relatório de Entradas";


      filtroTipo =
        "entrada";

    }


    if (
      tipo
      ===
      "saidas"
    ) {

      titulo =
        "Relatório de Saídas";


      filtroTipo =
        "saida";

    }


    if (
      tipo
      ===
      "movimentacoes"
    ) {

      titulo =
        "Relatório de Movimentações";

    }


    registros =
      movimentosCache.filter(
        movimento => {

          const tipoOk =
            !filtroTipo
            ||
            movimento.tipo
            ===
            filtroTipo;


          const periodoOk =
            movimentoDentroPeriodo(

              movimento,

              dataInicial,

              dataFinal

            );


          const texto = [

            movimento.produtoNome,

            codigoMovimentacao(
              movimento
            ),

            movimento.lote,

            movimento.responsavelNome,

            movimento.origem,

            movimento.destino,

            movimento.motivo,

            movimento.observacao

          ]
            .join(" ")
            .toLowerCase();


          return (

            tipoOk

            &&

            periodoOk

            &&

            texto.includes(
              busca
            )

          );

        }
      );


    head = `

      <tr>

        <th>Data/Hora</th>

        <th>Tipo</th>

        <th>Produto</th>

        <th>Código</th>

        <th>Lote</th>

        <th>Quantidade</th>

        <th>Origem / Destino</th>

        <th>Responsável</th>

      </tr>

    `;


    body =
      registros.map(
        movimento => {

          const quantidade =
            Number(
              movimento.quantidade
              ||
              0
            );


          totalQuantidade +=
            quantidade;


          if (
            movimento.tipo
            ===
            "entrada"
          ) {

            totalEntradas +=
              quantidade;

          }


          if (
            movimento.tipo
            ===
            "saida"
          ) {

            totalSaidas +=
              quantidade;

          }


          return `

            <tr>

              <td>
                ${formatarDataHora(
                  movimento.criadoEm
                )}
              </td>

              <td>

                ${
                  movimento.tipo
                  ===
                  "entrada"
                    ?
                    '<span class="badge ok">Entrada</span>'
                    :
                    '<span class="badge info">Saída</span>'
                }

              </td>

              <td>
                ${esc(
                  movimento.produtoNome
                  ||
                  "-"
                )}
              </td>

              <td>
                ${esc(
                  codigoMovimentacao(
                    movimento
                  )
                )}
              </td>

              <td>
                ${esc(
                  movimento.lote
                  ||
                  "-"
                )}
              </td>

              <td>
                ${quantidade}
              </td>

              <td>
                ${esc(
                  movimento.destino
                  ||
                  movimento.origem
                  ||
                  "-"
                )}
              </td>

              <td>
                ${esc(
                  movimento.responsavelNome
                  ||
                  "-"
                )}
              </td>

            </tr>

          `;

        }
      )
      .join("");

  }


  // =======================================================
  // TOTAIS DE ENTRADAS E SAÍDAS
  // =======================================================

  if (
    ![

      "entradas",

      "saidas",

      "movimentacoes"

    ].includes(
      tipo
    )
  ) {

    const movimentosPeriodo =
      movimentosCache.filter(
        movimento =>

          movimentoDentroPeriodo(

            movimento,

            dataInicial,

            dataFinal

          )
      );


    totalEntradas =
      movimentosPeriodo

        .filter(
          movimento =>
            movimento.tipo
            ===
            "entrada"
        )

        .reduce(
          (
            total,
            movimento
          ) =>

            total
            +
            Number(
              movimento.quantidade
              ||
              0
            ),

          0
        );


    totalSaidas =
      movimentosPeriodo

        .filter(
          movimento =>
            movimento.tipo
            ===
            "saida"
        )

        .reduce(
          (
            total,
            movimento
          ) =>

            total
            +
            Number(
              movimento.quantidade
              ||
              0
            ),

          0
        );

  }


  // =======================================================
  // SEM RESULTADOS
  // =======================================================

  if (
    !registros.length
  ) {

    let colspan =
      6;


    if (
      tipo
      ===
      "estoque"
    ) {

      colspan =
        7;

    }


    if (
      [

        "entradas",

        "saidas",

        "movimentacoes"

      ].includes(
        tipo
      )
    ) {

      colspan =
        8;

    }


    body = `

      <tr>

        <td colspan="${colspan}">

          Nenhum registro encontrado para os filtros selecionados.

        </td>

      </tr>

    `;

  }


  $("relatorioTitulo")
    .textContent =
    titulo;


  $("relatorioHead")
    .innerHTML =
    head;


  $("relatorioBody")
    .innerHTML =
    body;


  $("relatorioTotalRegistros")
    .textContent =
    registros.length;


  $("relatorioQuantidade")
    .textContent =
    totalQuantidade;


  $("relatorioEntradas")
    .textContent =
    totalEntradas;


  $("relatorioSaidas")
    .textContent =
    totalSaidas;


  relatorioAtual = {

    titulo,

    tipo,

    registros,

    dataInicial,

    dataFinal,

    busca,

    totalQuantidade,

    totalEntradas,

    totalSaidas

  };

}


// =========================================================
// EVENTOS RELATÓRIOS
// =========================================================

$("btnGerarRelatorio")
  ?.addEventListener(
    "click",
    gerarRelatorio
  );


$("relatorioTipo")
  ?.addEventListener(
    "change",
    gerarRelatorio
  );


$("btnPdfRelatorio")
  ?.addEventListener(
    "click",
    () => {

      gerarRelatorio();

      gerarPDFRelatorio();

    }
  );


// =========================================================
// PDF
// =========================================================

function gerarPDFRelatorio() {

  if (
    !relatorioAtual.titulo
  ) {

    alert(
      "Gere o relatório antes de criar o PDF."
    );


    return;

  }


  const dataGeracao =
    new Date()
      .toLocaleString(
        "pt-BR"
      );


  const inicio =
    $("relatorioDataInicial")
      ?.value
    ||
    "";


  const fim =
    $("relatorioDataFinal")
      ?.value
    ||
    "";


  let periodo =
    "Todos os períodos";


  if (
    inicio
    &&
    fim
  ) {

    periodo =

      `${formatDateBR(
        inicio
      )} a ${formatDateBR(
        fim
      )}`;

  }

  else if (
    inicio
  ) {

    periodo =

      `A partir de ${formatDateBR(
        inicio
      )}`;

  }

  else if (
    fim
  ) {

    periodo =

      `Até ${formatDateBR(
        fim
      )}`;

  }


  const tabela =
    $("relatorioBody")
      ?.closest(
        "table"
      )
      ?.outerHTML
    ||
    "";


  const janela =
    window.open(

      "",

      "_blank"

    );


  if (
    !janela
  ) {

    alert(
      "O navegador bloqueou a janela do relatório. Permita pop-ups para gerar o PDF."
    );


    return;

  }


  janela.document.write(`

    <!DOCTYPE html>

    <html lang="pt-BR">

    <head>

      <meta charset="UTF-8">

      <meta
        name="viewport"
        content="width=device-width, initial-scale=1.0"
      >

      <title>
        ${esc(
          relatorioAtual.titulo
        )}
      </title>

      <style>

        * {
          box-sizing: border-box;
        }

        body {

          font-family:
            Arial,
            Helvetica,
            sans-serif;

          margin: 30px;

          color: #222222;

        }

        .cabecalho {

          text-align: center;

          border-bottom:
            2px solid
            #17375e;

          padding-bottom: 15px;

          margin-bottom: 20px;

        }

        .cabecalho h1 {

          color: #17375e;

          margin:
            0
            0
            5px;

          font-size: 26px;

        }

        .cabecalho h2 {

          margin:
            5px
            0;

          font-size: 18px;

        }

        .cabecalho p {

          margin:
            4px
            0;

          color: #555555;

          font-size: 12px;

        }

        .resumo {

          display: grid;

          grid-template-columns:
            repeat(
              4,
              1fr
            );

          gap: 10px;

          margin-bottom: 20px;

        }

        .resumo div {

          border:
            1px solid
            #cccccc;

          padding: 10px;

          border-radius: 6px;

          text-align: center;

        }

        .resumo strong {

          display: block;

          margin-top: 5px;

          color: #17375e;

          font-size: 19px;

        }

        table {

          width: 100%;

          border-collapse: collapse;

          font-size: 10px;

        }

        th {

          background: #17375e;

          color: #ffffff;

          border:
            1px solid
            #cccccc;

          padding: 7px;

          text-align: left;

        }

        td {

          border:
            1px solid
            #cccccc;

          padding: 7px;

        }

        tr:nth-child(even) {

          background: #f5f5f5;

        }

        .badge {

          font-weight: bold;

        }

        .rodape {

          margin-top: 30px;

          font-size: 10px;

          color: #666666;

          text-align: center;

        }

        @page {

          size: A4 landscape;

          margin: 12mm;

        }

        @media print {

          body {

            margin: 0;

          }

        }

      </style>

    </head>


    <body>


      <div class="cabecalho">

        <h1>
          SISFAR V2
        </h1>

        <h2>
          ${esc(
            relatorioAtual.titulo
          )}
        </h2>

        <p>
          Sistema Integrado de Controle de Estoque de Farmácia
        </p>

        <p>
          Período: ${esc(
            periodo
          )}
        </p>

        <p>
          Gerado em: ${esc(
            dataGeracao
          )}
        </p>

        <p>

          Responsável:

          ${esc(
            usuarioAtual?.nome
            ||
            usuarioAtual?.email
            ||
            "-"
          )}

        </p>

      </div>


      <div class="resumo">

        <div>

          Registros

          <strong>
            ${relatorioAtual.registros.length}
          </strong>

        </div>


        <div>

          Quantidade

          <strong>
            ${relatorioAtual.totalQuantidade}
          </strong>

        </div>


        <div>

          Entradas

          <strong>
            ${relatorioAtual.totalEntradas}
          </strong>

        </div>


        <div>

          Saídas

          <strong>
            ${relatorioAtual.totalSaidas}
          </strong>

        </div>

      </div>


      ${tabela}


      <div class="rodape">

        SISFAR V2 —
        Relatório gerado eletronicamente pelo sistema.

      </div>


      <script>

        window.onload = function() {

          setTimeout(

            function() {

              window.print();

            },

            500

          );

        };

      <\/script>


    </body>

    </html>

  `);


  janela.document.close();

}


// =========================================================
// FIM
// =========================================================
