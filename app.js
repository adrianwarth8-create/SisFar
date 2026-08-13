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

          <td colspan="5">
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
