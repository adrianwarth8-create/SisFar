// =========================================================
// SISFAR V2
// APP.JS
// Controle de Estoque de Farmácia
// Versão com leitor de código de barras pela câmera
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


// =========================================================
// SCANNER
// =========================================================

let scannerDestino = null;

let scannerControles = null;

let scannerAtivo = false;

let ultimoCodigoLido = "";

let ultimoCodigoTempo = 0;


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
  elemento,
  texto,
  tipo = "error"
) {

  if (!elemento) {
    return;
  }


  elemento.textContent =
    texto;


  elemento.className =
    `message ${tipo}`;

}


function hideMsg(
  elemento
) {

  if (!elemento) {
    return;
  }


  elemento.textContent =
    "";


  elemento.className =
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
    .replace(
      /\s+/g,
      ""
    );

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


// =========================================================
// DATAS
// =========================================================

function formatDateBR(
  value
) {

  if (
    !value
  ) {

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


function diasAte(
  dataISO
) {

  if (
    !dataISO
  ) {

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

  return ({

    gestor:
      "Gestor",

    farmacia:
      "Farmácia",

    consulta:
      "Consulta"

  })[perfil]

  ||

  perfil

  ||

  "-";

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

        elemento.classList.toggle(

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

        elemento.classList.toggle(

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

        console.error(
          "Erro no login:",
          erro
        );


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

      fecharScanner();


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

    if (
      !user
    ) {

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

      const snap =
        await getDoc(

          doc(

            db,

            "usuarios",

            user.uid

          )

        );


      if (
        !snap.exists()
      ) {

        await signOut(
          auth
        );


        showMsg(

          $("loginMsg"),

          "Usuário autenticado, mas não existe perfil cadastrado na coleção usuarios."

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


      if (
        $("userName")
      ) {

        $("userName")
          .textContent =
          usuarioAtual.nome
          ||
          user.email;

      }


      if (
        $("userProfile")
      ) {

        $("userProfile")
          .textContent =
          perfilLabel(
            usuarioAtual.perfil
          );

      }


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

      console.error(
        "Erro ao carregar perfil:",
        erro
      );


      await signOut(
        auth
      );


      showMsg(

        $("loginMsg"),

        "Erro ao carregar o perfil. Verifique as regras do Firestore."

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

          fecharScanner();


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


  if (
    destino
  ) {

    destino.classList.remove(
      "hidden"
    );

  }


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

    etiquetas:
      "Etiquetas",

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
    "etiquetas"
  ) {

    preencherSelectEtiquetas();
    atualizarPreviewEtiqueta();

  }


  if (
    page
    ===
    "relatorios"
  ) {

    preencherSelectRelatorios();
    gerarRelatorio();

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
// CARREGAR DADOS
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

  preencherSelectEtiquetas();

  preencherSelectRelatorios();

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
      "Carregando movimentações sem orderBy:",
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
// TOTAL DO PRODUTO
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

  const totalQuantidade =
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


  const baixos =
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

    )
    .length;


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
    )
    .length;


  if (
    $("statProdutos")
  ) {

    $("statProdutos")
      .textContent =
      produtosCache.length;

  }


  if (
    $("statQuantidade")
  ) {

    $("statQuantidade")
      .textContent =
      totalQuantidade;

  }


  if (
    $("statBaixo")
  ) {

    $("statBaixo")
      .textContent =
      baixos;

  }


  if (
    $("statVencendo")
  ) {

    $("statVencendo")
      .textContent =
      vencendo;

  }


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


          const vencimento =
            diasAte(
              lote.validade
            )
            <=
            90;


          const baixo =
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

            quantidade
            >
            0

            &&

            (
              vencimento
              ||
              baixo
            )

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
    !$("dashboardAlertas")
  ) {

    return;

  }


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
                "Produto não encontrado"
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

        const produtoDuplicado =
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
          produtoDuplicado
        ) {

          alert(

            `Este código de barras já está cadastrado para: ${produtoDuplicado.nome}`

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

        console.error(
          erro
        );


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
        "Excluir este produto?"
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

      console.error(
        erro
      );


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

          produto.localizacao

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
// PESQUISA
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

    `<option value="">
      Selecione...
    </option>`

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
// SELEÇÃO MANUAL NA ENTRADA
// =========================================================

$("entradaProduto")
  ?.addEventListener(
    "change",
    () => {

      const produto =
        produtosCache.find(
          item =>
            item.id
            ===
            $("entradaProduto")
              .value
        );


      if (
        $("entradaCodigoBarras")
      ) {

        $("entradaCodigoBarras")
          .value =
          produto?.codigoBarras
          ||
          "";

      }

    }
  );


// =========================================================
// ENTRADA
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

          "Preencha os campos obrigatórios."

        );


        return;

      }


      try {

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


        const produto =
          produtosCache.find(
            item =>
              item.id
              ===
              produtoId
          );


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
              produto?.nome
              ||
              "",

            codigoBarras:
              produto?.codigoBarras
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

        console.error(
          erro
        );


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
// SELEÇÃO MANUAL NA BAIXA
// =========================================================

$("baixaProduto")
  ?.addEventListener(
    "change",
    () => {

      const produto =
        produtosCache.find(
          item =>
            item.id
            ===
            $("baixaProduto")
              .value
        );


      if (
        $("baixaCodigoBarras")
      ) {

        $("baixaCodigoBarras")
          .value =
          produto?.codigoBarras
          ||
          "";

      }


      preencherLotesBaixa();

    }
  );


// =========================================================
// LOTES DA BAIXA - FEFO
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

    `<option value="">
      Selecione...
    </option>`

    +

    lotes.map(
      (
        lote,
        indice
      ) => `

        <option value="${lote.id}">

          ${
            indice
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

          "Preencha os campos obrigatórios."

        );


        return;

      }


      try {

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


        const produto =
          produtosCache.find(
            item =>
              item.id
              ===
              produtoId
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
              produto?.nome
              ||
              "",

            codigoBarras:
              produto?.codigoBarras
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

        console.error(
          erro
        );


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
// DATA DA MOVIMENTAÇÃO
// =========================================================

function dataMov(
  movimento
) {

  return movimento.criadoEm?.toDate

    ?

    movimento.criadoEm
      .toDate()
      .toLocaleString(
        "pt-BR"
      )

    :

    "-";

}


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

          movimento.codigoBarras,

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

          <td colspan="7">
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
            ${dataMov(
              movimento
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
// FILTROS MOVIMENTAÇÃO
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


        const dias =
          diasAte(
            lote.validade
          );


        let status =
          '<span class="badge ok">Regular</span>';


        if (
          dias
          <
          0
        ) {

          status =
            '<span class="badge danger">Vencido</span>';

        }

        else if (
          dias
          <=
          30
        ) {

          status =
            '<span class="badge danger">Até 30 dias</span>';

        }

        else if (
          dias
          <=
          90
        ) {

          status =
            '<span class="badge warning">Até 90 dias</span>';

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
              ${status}
            </td>

            <td>
              <button
                type="button"
                class="btn btn-secondary"
                onclick="gerarEtiquetaLote('${lote.id}')"
              >
                🏷️ Etiqueta
              </button>
            </td>

          </tr>

        `;

      }
    )
    .join("");

}


// =========================================================
// ETIQUETAS
// =========================================================

let etiquetasLista = [];

function preencherSelectEtiquetas() {
  const select = $("etiquetaProduto");
  if (!select) return;

  const atual = select.value;

  select.innerHTML =
    '<option value="">Selecione...</option>' +
    produtosCache.map(produto => `
      <option value="${produto.id}">
        ${esc(produto.nome || "-")}${produto.apresentacao ? ` - ${esc(produto.apresentacao)}` : ""}
      </option>
    `).join("");

  if (produtosCache.some(p => p.id === atual)) {
    select.value = atual;
  }

  preencherLotesEtiqueta();
  renderListaEtiquetas();
}

function preencherLotesEtiqueta(loteSelecionado = "") {
  const produtoId = $("etiquetaProduto")?.value || "";
  const select = $("etiquetaLote");
  if (!select) return;

  const lotes = lotesCache
    .filter(lote => lote.produtoId === produtoId)
    .sort((a, b) =>
      (a.validade || "9999").localeCompare(b.validade || "9999")
    );

  select.innerHTML =
    '<option value="">Selecione...</option>' +
    lotes.map(lote => `
      <option value="${lote.id}">
        ${esc(lote.lote || "-")} | ${formatDateBR(lote.validade)} | qtd. ${Number(lote.quantidade || 0)}
      </option>
    `).join("");

  if (loteSelecionado && lotes.some(l => l.id === loteSelecionado)) {
    select.value = loteSelecionado;
  }

  preencherDadosEtiqueta();
}

function preencherDadosEtiqueta() {
  const produto = produtosCache.find(
    p => p.id === ($("etiquetaProduto")?.value || "")
  );

  const lote = lotesCache.find(
    l => l.id === ($("etiquetaLote")?.value || "")
  );

  if ($("etiquetaNome")) {
    $("etiquetaNome").value = produto?.nome || "";
  }

  if ($("etiquetaApresentacao")) {
    $("etiquetaApresentacao").value = produto?.apresentacao || "";
  }

  if ($("etiquetaLoteTexto")) {
    $("etiquetaLoteTexto").value = lote?.lote || "";
  }

  if ($("etiquetaValidade")) {
    $("etiquetaValidade").value =
      lote?.validade ? formatDateBR(lote.validade) : "";
  }

  atualizarPreviewEtiqueta();
}

function atualizarPreviewEtiqueta() {
  if ($("previewEtiquetaNome")) {
    $("previewEtiquetaNome").textContent =
      $("etiquetaNome")?.value || "NOME DO PRODUTO";
  }

  if ($("previewEtiquetaApresentacao")) {
    $("previewEtiquetaApresentacao").textContent =
      $("etiquetaApresentacao")?.value || "Apresentação";
  }

  if ($("previewEtiquetaLote")) {
    $("previewEtiquetaLote").textContent =
      $("etiquetaLoteTexto")?.value || "-";
  }

  if ($("previewEtiquetaValidade")) {
    $("previewEtiquetaValidade").textContent =
      $("etiquetaValidade")?.value || "-";
  }
}

function limparCamposEtiqueta() {
  if ($("etiquetaProduto")) {
    $("etiquetaProduto").value = "";
  }

  if ($("etiquetaLote")) {
    $("etiquetaLote").innerHTML =
      '<option value="">Selecione primeiro o produto...</option>';
  }

  [
    "etiquetaNome",
    "etiquetaApresentacao",
    "etiquetaLoteTexto",
    "etiquetaValidade"
  ].forEach(id => {
    if ($(id)) {
      $(id).value = "";
    }
  });

  if ($("etiquetaQuantidade")) {
    $("etiquetaQuantidade").value = "1";
  }

  atualizarPreviewEtiqueta();
}

function obterEtiquetaSelecionada() {
  const produtoId = $("etiquetaProduto")?.value || "";
  const loteId = $("etiquetaLote")?.value || "";
  const quantidade = Math.max(
    1,
    Math.min(
      100,
      Number($("etiquetaQuantidade")?.value || 1)
    )
  );

  const produto = produtosCache.find(p => p.id === produtoId);
  const lote = lotesCache.find(l => l.id === loteId);

  if (!produto || !lote) {
    return null;
  }

  return {
    chave: `${produto.id}__${lote.id}`,
    produtoId: produto.id,
    loteId: lote.id,
    nome: produto.nome || "",
    apresentacao: produto.apresentacao || "",
    lote: lote.lote || "",
    validadeISO: lote.validade || "",
    validade: lote.validade ? formatDateBR(lote.validade) : "",
    quantidade
  };
}

function adicionarEtiquetaLista() {
  hideMsg($("etiquetaMsg"));

  const item = obterEtiquetaSelecionada();

  if (!item) {
    showMsg(
      $("etiquetaMsg"),
      "Selecione o produto e o lote antes de adicionar à lista."
    );
    return;
  }

  const existente = etiquetasLista.find(
    etiqueta => etiqueta.chave === item.chave
  );

  if (existente) {
    existente.quantidade = Math.min(
      999,
      Number(existente.quantidade || 0) + item.quantidade
    );
  } else {
    etiquetasLista.push(item);
  }

  renderListaEtiquetas();

  showMsg(
    $("etiquetaMsg"),
    `${item.quantidade} etiqueta(s) adicionada(s) à lista.`,
    "ok"
  );

  if ($("etiquetaQuantidade")) {
    $("etiquetaQuantidade").value = "1";
  }
}

function renderListaEtiquetas() {
  const body = $("etiquetaListaBody");

  if (!body) {
    return;
  }

  const totalItens = etiquetasLista.length;

  const totalQuantidade = etiquetasLista.reduce(
    (total, item) =>
      total + Number(item.quantidade || 0),
    0
  );

  if ($("etiquetaTotalItens")) {
    $("etiquetaTotalItens").textContent = totalItens;
  }

  if ($("etiquetaTotalQuantidade")) {
    $("etiquetaTotalQuantidade").textContent = totalQuantidade;
  }

  if (!etiquetasLista.length) {
    body.innerHTML = `
      <tr>
        <td colspan="6">
          Nenhuma etiqueta adicionada à lista.
        </td>
      </tr>
    `;
    return;
  }

  body.innerHTML = etiquetasLista.map((item, indice) => `
    <tr>
      <td>${esc(item.nome || "-")}</td>
      <td>${esc(item.apresentacao || "-")}</td>
      <td>${esc(item.lote || "-")}</td>
      <td>${esc(item.validade || "-")}</td>
      <td>
        <input
          type="number"
          min="1"
          max="999"
          value="${Number(item.quantidade || 1)}"
          style="width:90px"
          onchange="alterarQuantidadeEtiqueta(${indice}, this.value)"
        >
      </td>
      <td>
        <button
          type="button"
          class="btn btn-danger"
          onclick="removerEtiquetaLista(${indice})"
        >
          🗑️ Remover
        </button>
      </td>
    </tr>
  `).join("");
}

window.alterarQuantidadeEtiqueta = (indice, valor) => {
  const quantidade = Math.max(
    1,
    Math.min(999, Number(valor || 1))
  );

  if (!etiquetasLista[indice]) {
    return;
  }

  etiquetasLista[indice].quantidade = quantidade;
  renderListaEtiquetas();
};

window.removerEtiquetaLista = (indice) => {
  if (!etiquetasLista[indice]) {
    return;
  }

  etiquetasLista.splice(indice, 1);
  renderListaEtiquetas();

  showMsg(
    $("etiquetaMsg"),
    "Etiqueta removida da lista.",
    "ok"
  );
};

function limparListaEtiquetas() {
  if (!etiquetasLista.length) {
    return;
  }

  if (!confirm("Limpar toda a lista de etiquetas?")) {
    return;
  }

  etiquetasLista = [];
  renderListaEtiquetas();

  showMsg(
    $("etiquetaMsg"),
    "Lista de etiquetas limpa.",
    "ok"
  );
}

function htmlEtiquetaDados(item) {
  const nome = esc(item.nome || "");
  const apresentacao = esc(item.apresentacao || "");
  const lote = esc(item.lote || "");
  const validade = esc(item.validade || "");

  return `
    <div class="print-label">
      <div class="sisfar">SISFAR V2</div>
      <div class="nome">${nome}</div>
      ${apresentacao ? `<div class="apresentacao">${apresentacao}</div>` : ""}
      <div><b>Lote:</b> ${lote}</div>
      <div><b>Validade:</b> ${validade}</div>
    </div>
  `;
}

function abrirJanelaImpressao(itens, formato = "a4") {
  const individual = formato === "individual";

  const etiquetas = itens.map(item =>
    Array.from(
      { length: Math.max(1, Number(item.quantidade || 1)) },
      () => htmlEtiquetaDados(item)
    ).join("")
  ).join("");

  const total = itens.reduce(
    (soma, item) =>
      soma + Math.max(1, Number(item.quantidade || 1)),
    0
  );

  const janela = window.open("", "_blank");

  if (!janela) {
    showMsg(
      $("etiquetaMsg"),
      "O navegador bloqueou a janela de impressão. Autorize pop-ups e tente novamente."
    );
    return false;
  }

  janela.document.write(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>Etiquetas SISFAR</title>
      <style>
        @page {
          size: ${individual ? "60mm 40mm" : "A4"};
          margin: ${individual ? "0" : "8mm"};
        }

        * {
          box-sizing: border-box;
        }

        body {
          font-family: Arial, sans-serif;
          margin: 0;
          color: #000;
        }

        .sheet {
          display: ${individual ? "block" : "grid"};
          grid-template-columns: ${individual ? "1fr" : "repeat(3, 1fr)"};
          gap: ${individual ? "0" : "4mm"};
        }

        .print-label {
          width: ${individual ? "60mm" : "100%"};
          height: ${individual ? "40mm" : "35mm"};
          border: 1px solid #000;
          padding: 3mm;
          overflow: hidden;
          break-inside: avoid;
          page-break-inside: avoid;
          ${individual ? "page-break-after: always;" : ""}
        }

        .sisfar {
          text-align: center;
          font-weight: 700;
          font-size: 9pt;
          border-bottom: 1px solid #000;
          margin-bottom: 2mm;
          padding-bottom: 1mm;
        }

        .nome {
          font-weight: 700;
          font-size: 11pt;
          text-transform: uppercase;
          white-space: normal;
        }

        .apresentacao {
          font-size: 9pt;
          margin: 1mm 0 2mm;
        }

        .print-label div {
          line-height: 1.2;
        }

        @media print {
          button {
            display: none;
          }
        }
      </style>
    </head>
    <body>
      <div class="sheet">${etiquetas}</div>
      <script>
        window.onload = () => {
          window.print();
        };
      <\/script>
    </body>
    </html>
  `);

  janela.document.close();

  showMsg(
    $("etiquetaMsg"),
    `${total} etiqueta(s) preparada(s) para impressão.`,
    "ok"
  );

  return true;
}

function imprimirEtiquetaSelecionada() {
  const item = obterEtiquetaSelecionada();

  if (!item) {
    showMsg(
      $("etiquetaMsg"),
      "Selecione o produto e o lote antes de imprimir."
    );
    return;
  }

  preencherDadosEtiqueta();

  abrirJanelaImpressao(
    [item],
    $("etiquetaFormato")?.value || "a4"
  );
}

function imprimirTodasEtiquetas() {
  if (!etiquetasLista.length) {
    showMsg(
      $("etiquetaMsg"),
      "Adicione pelo menos uma etiqueta à lista antes de imprimir."
    );
    return;
  }

  abrirJanelaImpressao(
    etiquetasLista,
    $("etiquetaFormato")?.value || "a4"
  );
}

$("etiquetaProduto")
  ?.addEventListener(
    "change",
    () => preencherLotesEtiqueta()
  );

$("etiquetaLote")
  ?.addEventListener(
    "change",
    preencherDadosEtiqueta
  );

$("btnVisualizarEtiqueta")
  ?.addEventListener(
    "click",
    atualizarPreviewEtiqueta
  );

$("btnLimparEtiqueta")
  ?.addEventListener(
    "click",
    () => {
      limparCamposEtiqueta();
      hideMsg($("etiquetaMsg"));
    }
  );

$("btnAdicionarEtiqueta")
  ?.addEventListener(
    "click",
    adicionarEtiquetaLista
  );

$("btnImprimirEtiqueta")
  ?.addEventListener(
    "click",
    imprimirEtiquetaSelecionada
  );

$("btnImprimirTodasEtiquetas")
  ?.addEventListener(
    "click",
    imprimirTodasEtiquetas
  );

$("btnLimparListaEtiquetas")
  ?.addEventListener(
    "click",
    limparListaEtiquetas
  );

window.gerarEtiquetaLote = (loteId) => {
  const lote = lotesCache.find(
    item => item.id === loteId
  );

  if (!lote) {
    return;
  }

  abrirPagina("etiquetas");
  preencherSelectEtiquetas();

  if ($("etiquetaProduto")) {
    $("etiquetaProduto").value = lote.produtoId;
  }

  preencherLotesEtiqueta(lote.id);
  preencherDadosEtiqueta();

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
};


// =========================================================
// USUÁRIOS
// =========================================================

async function carregarUsuarios() {

  if (
    !isGestor()
  ) {

    return;

  }


  if (
    !$("usuariosBody")
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


    const usuarios =
      snap.docs.map(
        documento => ({

          id:
            documento.id,

          ...documento.data()

        })
      );


    if (
      !usuarios.length
    ) {

      $("usuariosBody")
        .innerHTML = `

          <tr>

            <td colspan="4">
              Nenhum usuário cadastrado.
            </td>

          </tr>

        `;


      return;

    }


    $("usuariosBody")
      .innerHTML =
      usuarios.map(
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
                  '<span class="badge danger">Não</span>'

                  :
                  '<span class="badge ok">Sim</span>'
              }

            </td>

          </tr>

        `
      )
      .join("");

  }

  catch (erro) {

    console.error(
      erro
    );


    $("usuariosBody")
      .innerHTML = `

        <tr>

          <td colspan="4">
            Erro ao carregar usuários.
          </td>

        </tr>

      `;

  }

}


// =========================================================
// RELATÓRIOS
// =========================================================

function preencherSelectRelatorios() {
  const select = $("relatorioProduto");
  if (!select) return;

  const atual = select.value;
  select.innerHTML =
    '<option value="">Todos os produtos</option>' +
    produtosCache.map(produto => `
      <option value="${produto.id}">
        ${esc(produto.nome || "-")}${produto.apresentacao ? ` - ${esc(produto.apresentacao)}` : ""}
      </option>
    `).join("");

  if (produtosCache.some(p => p.id === atual)) {
    select.value = atual;
  }
}

function dataMovDate(movimento) {
  if (movimento?.criadoEm?.toDate) return movimento.criadoEm.toDate();
  if (movimento?.criadoEm?.seconds) return new Date(movimento.criadoEm.seconds * 1000);
  if (movimento?.criadoEm instanceof Date) return movimento.criadoEm;
  return null;
}

function dataDentroPeriodo(data, inicial, final) {
  if (!data) return !inicial && !final;
  const d = new Date(data);
  d.setHours(0, 0, 0, 0);

  if (inicial) {
    const ini = new Date(`${inicial}T00:00:00`);
    if (d < ini) return false;
  }

  if (final) {
    const fim = new Date(`${final}T23:59:59`);
    if (d > fim) return false;
  }

  return true;
}

function textoBuscaRelatorio(valores, busca) {
  if (!busca) return true;
  return valores
    .map(v => String(v ?? ""))
    .join(" ")
    .toLowerCase()
    .includes(busca);
}

function statusValidadeRelatorio(validade) {
  const dias = diasAte(validade);
  if (dias < 0) return "Vencido";
  if (dias <= 30) return "Vence em até 30 dias";
  if (dias <= 90) return "Vence em até 90 dias";
  return "Regular";
}

function atualizarResumoRelatorio(registros, quantidade, entradas = 0, saidas = 0) {
  if ($("relatorioTotalRegistros")) $("relatorioTotalRegistros").textContent = registros;
  if ($("relatorioQuantidadeTotal")) $("relatorioQuantidadeTotal").textContent = quantidade;
  if ($("relatorioTotalEntradas")) $("relatorioTotalEntradas").textContent = entradas;
  if ($("relatorioTotalSaidas")) $("relatorioTotalSaidas").textContent = saidas;
}

function gerarRelatorio() {
  const tipo = $("relatorioTipo")?.value || "estoque";
  const produtoId = $("relatorioProduto")?.value || "";
  const inicial = $("relatorioDataInicial")?.value || "";
  const final = $("relatorioDataFinal")?.value || "";
  const busca = ($("relatorioBusca")?.value || "").trim().toLowerCase();
  const diasValidade = Number($("relatorioValidadeDias")?.value || 90);

  const head = $("relatorioHead");
  const body = $("relatorioBody");
  if (!head || !body) return;

  hideMsg($("relatorioMsg"));

  const nomes = {
    estoque: "Estoque atual",
    baixo: "Estoque baixo",
    semEstoque: "Produtos sem estoque",
    validade: "Lotes e validades",
    vencendo: "Próximos do vencimento",
    entradas: "Entradas",
    saidas: "Saídas",
    movimentacoes: "Movimentações"
  };

  if ($("relatorioTitulo")) $("relatorioTitulo").textContent = nomes[tipo] || "Relatório";
  if ($("relatorioPeriodo")) {
    const periodo = inicial || final
      ? `Período: ${inicial ? formatDateBR(inicial) : "início"} até ${final ? formatDateBR(final) : "hoje"}`
      : "Todos os registros disponíveis";
    $("relatorioPeriodo").textContent = periodo;
  }

  if (["estoque", "baixo", "semEstoque"].includes(tipo)) {
    let lista = produtosCache.map(produto => ({
      ...produto,
      total: totalProduto(produto.id)
    }));

    if (produtoId) lista = lista.filter(p => p.id === produtoId);
    if (tipo === "baixo") lista = lista.filter(p => p.total <= Number(p.estoqueMinimo || 0));
    if (tipo === "semEstoque") lista = lista.filter(p => p.total <= 0);
    lista = lista.filter(p => textoBuscaRelatorio([
      p.nome, p.codigoBarras, p.apresentacao, p.categoria, p.unidade, p.localizacao
    ], busca));

    head.innerHTML = `<tr>
      <th>Produto</th><th>Código</th><th>Apresentação</th><th>Unidade</th>
      <th>Quantidade</th><th>Mínimo</th><th>Situação</th>
    </tr>`;

    body.innerHTML = lista.length ? lista.map(p => `
      <tr>
        <td>${esc(p.nome || "-")}</td>
        <td>${esc(p.codigoBarras || "-")}</td>
        <td>${esc(p.apresentacao || "-")}</td>
        <td>${esc(p.unidade || "-")}</td>
        <td>${Number(p.total || 0)}</td>
        <td>${Number(p.estoqueMinimo || 0)}</td>
        <td>${p.total <= 0 ? '<span class="badge danger">Sem estoque</span>' : p.total <= Number(p.estoqueMinimo || 0) ? '<span class="badge warning">Baixo</span>' : '<span class="badge ok">Normal</span>'}</td>
      </tr>
    `).join("") : '<tr><td colspan="7">Nenhum registro encontrado.</td></tr>';

    atualizarResumoRelatorio(
      lista.length,
      lista.reduce((t, p) => t + Number(p.total || 0), 0),
      0,
      0
    );
    return;
  }

  if (["validade", "vencendo"].includes(tipo)) {
    let lista = lotesCache.map(lote => {
      const produto = produtosCache.find(p => p.id === lote.produtoId);
      return { ...lote, produto };
    });

    if (produtoId) lista = lista.filter(l => l.produtoId === produtoId);
    if (tipo === "vencendo") {
      lista = lista.filter(l => {
        const dias = diasAte(l.validade);
        return Number(l.quantidade || 0) > 0 && dias >= 0 && dias <= diasValidade;
      });
    }
    lista = lista.filter(l => textoBuscaRelatorio([
      l.produto?.nome, l.produto?.codigoBarras, l.lote, l.validade, l.produto?.apresentacao
    ], busca));
    lista.sort((a, b) => (a.validade || "9999").localeCompare(b.validade || "9999"));

    head.innerHTML = `<tr>
      <th>Produto</th><th>Lote</th><th>Validade</th><th>Quantidade</th><th>Status</th>
    </tr>`;
    body.innerHTML = lista.length ? lista.map(l => `
      <tr>
        <td>${esc(l.produto?.nome || "-")}</td>
        <td>${esc(l.lote || "-")}</td>
        <td>${formatDateBR(l.validade)}</td>
        <td>${Number(l.quantidade || 0)}</td>
        <td>${esc(statusValidadeRelatorio(l.validade))}</td>
      </tr>
    `).join("") : '<tr><td colspan="5">Nenhum lote encontrado.</td></tr>';

    atualizarResumoRelatorio(
      lista.length,
      lista.reduce((t, l) => t + Number(l.quantidade || 0), 0),
      0,
      0
    );
    return;
  }

  let lista = movimentosCache.filter(m => {
    if (tipo === "entradas" && m.tipo !== "entrada") return false;
    if (tipo === "saidas" && m.tipo !== "saida") return false;
    if (produtoId && m.produtoId !== produtoId) return false;
    if (!dataDentroPeriodo(dataMovDate(m), inicial, final)) return false;
    return textoBuscaRelatorio([
      m.produtoNome, m.codigoBarras, m.lote, m.responsavelNome,
      m.destino, m.origem, m.motivo, m.observacao
    ], busca);
  });

  head.innerHTML = `<tr>
    <th>Data/Hora</th><th>Tipo</th><th>Produto</th><th>Lote</th>
    <th>Quantidade</th><th>Destino/Origem</th><th>Responsável</th>
  </tr>`;
  body.innerHTML = lista.length ? lista.map(m => `
    <tr>
      <td>${dataMov(m)}</td>
      <td>${m.tipo === "entrada" ? "Entrada" : "Saída"}</td>
      <td>${esc(m.produtoNome || "-")}</td>
      <td>${esc(m.lote || "-")}</td>
      <td>${Number(m.quantidade || 0)}</td>
      <td>${esc(m.destino || m.origem || "-")}</td>
      <td>${esc(m.responsavelNome || "-")}</td>
    </tr>
  `).join("") : '<tr><td colspan="7">Nenhuma movimentação encontrada.</td></tr>';

  const entradas = lista
    .filter(m => m.tipo === "entrada")
    .reduce((t, m) => t + Number(m.quantidade || 0), 0);
  const saidas = lista
    .filter(m => m.tipo === "saida")
    .reduce((t, m) => t + Number(m.quantidade || 0), 0);

  atualizarResumoRelatorio(
    lista.length,
    lista.reduce((t, m) => t + Number(m.quantidade || 0), 0),
    entradas,
    saidas
  );
}

function limparFiltrosRelatorio() {
  if ($("relatorioTipo")) $("relatorioTipo").value = "estoque";
  if ($("relatorioProduto")) $("relatorioProduto").value = "";
  if ($("relatorioDataInicial")) $("relatorioDataInicial").value = "";
  if ($("relatorioDataFinal")) $("relatorioDataFinal").value = "";
  if ($("relatorioBusca")) $("relatorioBusca").value = "";
  if ($("relatorioValidadeDias")) $("relatorioValidadeDias").value = "90";
  gerarRelatorio();
}

function imprimirRelatorio() {
  const tabela = $("relatorioTabela");
  if (!tabela) return;

  const titulo = $("relatorioTitulo")?.textContent || "Relatório SISFAR V2";
  const periodo = $("relatorioPeriodo")?.textContent || "";
  const janela = window.open("", "_blank", "width=1100,height=800");

  if (!janela) {
    alert("O navegador bloqueou a janela de impressão. Autorize pop-ups e tente novamente.");
    return;
  }

  janela.document.write(`<!DOCTYPE html>
  <html lang="pt-BR">
  <head>
    <meta charset="UTF-8">
    <title>${esc(titulo)}</title>
    <style>
      body{font-family:Arial,sans-serif;color:#111;padding:24px}
      h1{margin:0 0 6px;font-size:22px}
      .sub{margin-bottom:18px;color:#444}
      .resumo{display:flex;gap:12px;flex-wrap:wrap;margin:16px 0}
      .box{border:1px solid #bbb;padding:8px 12px;border-radius:6px}
      table{width:100%;border-collapse:collapse;font-size:12px}
      th,td{border:1px solid #999;padding:6px;text-align:left}
      th{background:#eee}
      .rodape{margin-top:18px;font-size:11px;color:#555}
      @page{size:A4 landscape;margin:12mm}
    </style>
  </head>
  <body>
    <h1>SISFAR V2 — ${esc(titulo)}</h1>
    <div class="sub">${esc(periodo)}</div>
    <div class="resumo">
      <div class="box"><b>Registros:</b> ${esc($("relatorioTotalRegistros")?.textContent || "0")}</div>
      <div class="box"><b>Quantidade:</b> ${esc($("relatorioQuantidadeTotal")?.textContent || "0")}</div>
      <div class="box"><b>Entradas:</b> ${esc($("relatorioTotalEntradas")?.textContent || "0")}</div>
      <div class="box"><b>Saídas:</b> ${esc($("relatorioTotalSaidas")?.textContent || "0")}</div>
    </div>
    ${tabela.outerHTML}
    <div class="rodape">Gerado pelo SISFAR V2 em ${new Date().toLocaleString("pt-BR")}.</div>
  </body>
  </html>`);
  janela.document.close();
  janela.focus();
  setTimeout(() => janela.print(), 300);
}

$("btnGerarRelatorio")?.addEventListener("click", gerarRelatorio);
$("btnLimparRelatorio")?.addEventListener("click", limparFiltrosRelatorio);
$("btnImprimirRelatorio")?.addEventListener("click", imprimirRelatorio);
$("relatorioTipo")?.addEventListener("change", gerarRelatorio);
$("relatorioProduto")?.addEventListener("change", gerarRelatorio);
$("relatorioDataInicial")?.addEventListener("change", gerarRelatorio);
$("relatorioDataFinal")?.addEventListener("change", gerarRelatorio);
$("relatorioValidadeDias")?.addEventListener("change", gerarRelatorio);
$("relatorioBusca")?.addEventListener("input", gerarRelatorio);


// =========================================================
// STATUS DO SCANNER
// =========================================================

function statusScanner(
  texto
) {

  if (
    $("scannerStatus")
  ) {

    $("scannerStatus")
      .textContent =
      texto;

  }

}


// =========================================================
// FECHAR CÂMERA
// =========================================================

function fecharScanner() {

  scannerAtivo =
    false;


  scannerDestino =
    null;


  ultimoCodigoLido =
    "";


  try {

    scannerControles
      ?.stop?.();

  }

  catch (erro) {

    console.warn(
      "Erro ao parar scanner:",
      erro
    );

  }


  scannerControles =
    null;


  const video =
    $("scannerVideo");


  if (
    video?.srcObject
  ) {

    try {

      video
        .srcObject
        .getTracks()
        .forEach(
          track => {

            track.stop();

          }
        );

    }

    catch (erro) {

      console.warn(
        "Erro ao encerrar câmera:",
        erro
      );

    }


    video.srcObject =
      null;

  }


  $("scannerModal")
    ?.classList
    .add(
      "hidden"
    );

}


// =========================================================
// PROCESSAR CÓDIGO DA CÂMERA
// =========================================================

function processarCodigoScanner(
  codigo
) {

  const codigoNormalizado =
    normalizarCodigoBarras(
      codigo
    );


  if (
    !codigoNormalizado
  ) {

    return;

  }


  const agora =
    Date.now();


  if (
    codigoNormalizado
    ===
    ultimoCodigoLido

    &&

    agora
    -
    ultimoCodigoTempo
    <
    1500
  ) {

    return;

  }


  ultimoCodigoLido =
    codigoNormalizado;


  ultimoCodigoTempo =
    agora;


  const produto =
    encontrarProdutoPorCodigo(
      codigoNormalizado
    );


  if (
    !produto
  ) {

    statusScanner(

      `Código ${codigoNormalizado} não está cadastrado no SISFAR.`

    );


    if (
      navigator.vibrate
    ) {

      navigator.vibrate([
        100,
        80,
        100
      ]);

    }


    return;

  }


  if (
    scannerDestino
    ===
    "entrada"
  ) {

    if (
      $("entradaCodigoBarras")
    ) {

      $("entradaCodigoBarras")
        .value =
        codigoNormalizado;

    }


    if (
      $("entradaProduto")
    ) {

      $("entradaProduto")
        .value =
        produto.id;

    }


    hideMsg(
      $("entradaMsg")
    );

  }


  if (
    scannerDestino
    ===
    "baixa"
  ) {

    if (
      $("baixaCodigoBarras")
    ) {

      $("baixaCodigoBarras")
        .value =
        codigoNormalizado;

    }


    if (
      $("baixaProduto")
    ) {

      $("baixaProduto")
        .value =
        produto.id;

    }


    preencherLotesBaixa();


    hideMsg(
      $("baixaMsg")
    );

  }


  statusScanner(

    `Produto encontrado: ${produto.nome}`

  );


  if (
    navigator.vibrate
  ) {

    navigator.vibrate(
      120
    );

  }


  setTimeout(
    fecharScanner,
    350
  );

}


// =========================================================
// ABRIR CÂMERA
// =========================================================

async function abrirScanner(
  destino
) {

  if (
    scannerAtivo
  ) {

    return;

  }


  const modal =
    $("scannerModal");


  const video =
    $("scannerVideo");


  if (
    !modal
    ||
    !video
  ) {

    alert(
      "O leitor de câmera não foi encontrado."
    );


    return;

  }


  if (
    !window.ZXingBrowser
  ) {

    alert(
      "A biblioteca do leitor de código de barras não carregou. Atualize a página e tente novamente."
    );


    return;

  }


  scannerDestino =
    destino;


  scannerAtivo =
    true;


  ultimoCodigoLido =
    "";


  ultimoCodigoTempo =
    0;


  modal.classList.remove(
    "hidden"
  );


  statusScanner(
    "Solicitando acesso à câmera..."
  );


  try {

    const leitor =
      new window.ZXingBrowser
        .BrowserMultiFormatReader();


    const dispositivos =
      await window.ZXingBrowser
        .BrowserCodeReader
        .listVideoInputDevices();


    if (
      !dispositivos.length
    ) {

      throw new Error(
        "Nenhuma câmera encontrada."
      );

    }


    let camera =
      dispositivos[0];


    const traseira =
      dispositivos.find(
        dispositivo => {

          const nome =
            (
              dispositivo.label
              ||
              ""
            )
              .toLowerCase();


          return (

            nome.includes(
              "back"
            )

            ||

            nome.includes(
              "rear"
            )

            ||

            nome.includes(
              "environment"
            )

            ||

            nome.includes(
              "traseira"
            )

          );

        }
      );


    if (
      traseira
    ) {

      camera =
        traseira;

    }


    statusScanner(
      "Câmera ativa. Aponte para o código de barras."
    );


    scannerControles =
      await leitor.decodeFromVideoDevice(

        camera.deviceId,

        video,

        (
          resultado,
          erro,
          controles
        ) => {

          scannerControles =
            controles;


          if (
            resultado
          ) {

            processarCodigoScanner(
              resultado.getText()
            );

          }


          if (
            erro
            &&
            erro.name
            !==
            "NotFoundException"
          ) {

            console.debug(
              "Scanner:",
              erro
            );

          }

        }

      );

  }

  catch (erro) {

    console.error(
      "Erro na câmera:",
      erro
    );


    scannerAtivo =
      false;


    let mensagem =
      "Não foi possível abrir a câmera.";


    if (
      erro?.name
      ===
      "NotAllowedError"

      ||

      erro?.name
      ===
      "PermissionDeniedError"
    ) {

      mensagem =
        "Permissão da câmera negada. Autorize a câmera no navegador e tente novamente.";

    }

    else if (
      erro?.name
      ===
      "NotFoundError"
    ) {

      mensagem =
        "Nenhuma câmera foi encontrada neste aparelho.";

    }

    else if (
      erro?.name
      ===
      "NotReadableError"
    ) {

      mensagem =
        "A câmera está sendo utilizada por outro aplicativo.";

    }

    else if (
      erro?.message
    ) {

      mensagem =
        erro.message;

    }


    statusScanner(
      mensagem
    );

  }

}


// =========================================================
// CÂMERA - ENTRADA
// =========================================================

$("btnScanEntrada")
  ?.addEventListener(
    "click",
    () => {

      abrirScanner(
        "entrada"
      );

    }
  );


// =========================================================
// CÂMERA - BAIXA
// =========================================================

$("btnScanBaixa")
  ?.addEventListener(
    "click",
    () => {

      abrirScanner(
        "baixa"
      );

    }
  );


// =========================================================
// FECHAR SCANNER
// =========================================================

$("btnFecharScanner")
  ?.addEventListener(
    "click",
    fecharScanner
  );


// =========================================================
// FECHAR CLICANDO FORA
// =========================================================

$("scannerModal")
  ?.addEventListener(
    "click",
    event => {

      if (
        event.target
        ===
        $("scannerModal")
      ) {

        fecharScanner();

      }

    }
  );


// =========================================================
// FECHAR AO SAIR DA ABA
// =========================================================

document.addEventListener(
  "visibilitychange",
  () => {

    if (
      document.hidden
      &&
      scannerAtivo
    ) {

      fecharScanner();

    }

  }
);


// =========================================================
// FIM DO APP.JS
// =========================================================

console.log(
  "✅ SISFAR V2 carregado."
);

console.log(
  "📷 Leitor pela câmera disponível."
);
