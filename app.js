// =========================================================
// SISFAR V2
// APP.JS
// SISTEMA INTEGRADO DE CONTROLE DE ESTOQUE DE FARMÁCIA
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
// VARIÁVEIS GERAIS
// =========================================================

let usuarioAtual = null;

let produtosCache = [];

let lotesCache = [];

let movimentosCache = [];

let relatorioAtual = {

  titulo: "",

  tipo: "",

  registros: []

};


// =========================================================
// ATALHO ELEMENTOS
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

  el.textContent = "";

  el.className =
    "message hidden";

}


// =========================================================
// PROTEÇÃO DE TEXTO
// =========================================================

function esc(v = "") {

  return String(v)

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
// DATAS
// =========================================================

function formatDateBR(value) {

  if (!value)
    return "-";


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


function diasAte(
  dataISO
) {

  if (!dataISO)
    return 999999;


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
      el => {

        el.classList.toggle(
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
      el => {

        el.classList.toggle(
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
    async (e) => {

      e.preventDefault();


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

      catch (err) {

        console.error(err);


        showMsg(
          $("loginMsg"),
          "Não foi possível entrar. Verifique e-mail e senha."
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
// ESTADO DE AUTENTICAÇÃO
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

    catch (err) {

      console.error(err);


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
    btn => {

      btn.addEventListener(
        "click",
        () => {

          abrirPagina(
            btn.dataset.page
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
      btn => {

        btn.classList.toggle(

          "active",

          btn.dataset.page
          ===
          page

        );

      }
    );


  const labels = {

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
      labels[page]
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
// CARREGAMENTO GERAL
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
        d => ({

          id:
            d.id,

          ...d.data()

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
      d => ({

        id:
          d.id,

        ...d.data()

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
        d => ({

          id:
            d.id,

          ...d.data()

        })
      );

  }

  catch (err) {

    console.warn(
      "Carregando movimentações sem orderBy.",
      err
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
        d => ({

          id:
            d.id,

          ...d.data()

        })
      );


    movimentosCache.sort(
      (a, b) => {

        const ad =
          a.criadoEm?.seconds
          ||
          0;


        const bd =
          b.criadoEm?.seconds
          ||
          0;


        return (
          bd
          -
          ad
        );

      }
    );

  }

}


// =========================================================
// TOTAL DE ESTOQUE POR PRODUTO
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

  const totalQtd =
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
    totalQtd;


  $("statBaixo")
    .textContent =
    baixos.length;


  $("statVencendo")
    .textContent =
    vencendo.length;


  const alertas =
    lotesCache

      .filter(
        lote => {

          const produto =
            produtosCache.find(
              p =>
                p.id
                ===
                lote.produtoId
            );


          const quantidade =
            Number(
              lote.quantidade
              ||
              0
            );


          const proximidade =
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
              proximidade
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
            p =>
              p.id
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
      )
        return;


      $("produtoForm")
        .reset();


      $("produtoId")
        .value = "";


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
// CANCELAR CADASTRO
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
    async (e) => {

      e.preventDefault();


      if (
        !podeOperar()
      )
        return;


      const id =
        $("produtoId")
          .value;


      const dados = {

        nome:
          $("produtoNome")
            .value
            .trim(),

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

      catch (err) {

        console.error(err);


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
    )
      return;


    const produto =
      produtosCache.find(
        p =>
          p.id
          ===
          id
      );


    if (
      !produto
    )
      return;


    $("produtoId")
      .value =
      produto.id;


    $("produtoNome")
      .value =
      produto.nome
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
    )
      return;


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


    const confirmar =
      confirm(
        "Deseja realmente excluir este produto?"
      );


    if (
      !confirmar
    )
      return;


    try {

      await deleteDoc(

        doc(
          db,
          "produtos",
          id
        )

      );


      await carregarProdutos();


      renderEstoque();

      renderDashboard();

    }

    catch (err) {

      console.error(err);


      alert(
        "Erro ao excluir produto."
      );

    }

  };


// =========================================================
// RENDER ESTOQUE
// =========================================================

function renderEstoque() {

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

          <td colspan="7">

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
// ENTRADA
// =========================================================

$("entradaForm")
  ?.addEventListener(
    "submit",
    async (e) => {

      e.preventDefault();


      if (
        !podeOperar()
      )
        return;


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
          "Preencha corretamente todos os campos obrigatórios."
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

            async (
              transaction
            ) => {

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
            p =>
              p.id
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


        renderDashboard();

        renderEstoque();

        renderMovimentacoes();

        renderValidades();

      }

      catch (err) {

        console.error(err);


        showMsg(

          $("entradaMsg"),

          err.message
          ||
          "Erro ao registrar entrada."

        );

      }

    }
  );


// =========================================================
// LOTES PARA BAIXA
// =========================================================

$("baixaProduto")
  ?.addEventListener(
    "change",
    preencherLotesBaixa
  );


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
    async (e) => {

      e.preventDefault();


      if (
        !podeOperar()
      )
        return;


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
          "Preencha corretamente todos os campos."
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

          async (
            transaction
          ) => {

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
            p =>
              p.id
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


        preencherLotesBaixa();

        renderDashboard();

        renderEstoque();

        renderMovimentacoes();

        renderValidades();

      }

      catch (err) {

        console.error(err);


        showMsg(

          $("baixaMsg"),

          err.message
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
  )
    return;


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
      mov => {

        const okTipo =
          !tipo
          ||
          mov.tipo
          ===
          tipo;


        const texto = [

          mov.produtoNome,

          mov.lote,

          mov.responsavelNome,

          mov.destino,

          mov.origem,

          mov.motivo

        ]
          .join(" ")
          .toLowerCase();


        return (

          okTipo

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
      mov => `

        <tr>

          <td>

            ${formatarDataHora(
              mov.criadoEm
            )}

          </td>

          <td>

            ${
              mov.tipo
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
              mov.produtoNome
              ||
              "-"
            )}

          </td>

          <td>

            ${esc(
              mov.lote
              ||
              "-"
            )}

          </td>

          <td>

            ${Number(
              mov.quantidade
              ||
              0
            )}

          </td>

          <td>

            ${esc(
              mov.destino
              ||
              mov.origem
              ||
              "-"
            )}

          </td>

          <td>

            ${esc(
              mov.responsavelNome
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
// LOTES E VALIDADES
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
  )
    return;


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
            p =>
              p.id
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
  )
    return;


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
        d => ({

          id:
            d.id,

          ...d.data()

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

  catch (err) {

    console.error(err);


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

function inicializarRelatorios() {

  if (
    !$("relatorioTipo")
  )
    return;


  if (
    !relatorioAtual.tipo
  ) {

    gerarRelatorio();

  }

}


// =========================================================
// FILTRAR MOVIMENTAÇÕES POR DATA
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

  const tipo =
    $("relatorioTipo")
      ?.value
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


  let registros = [];

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

        <th>Apresentação</th>

        <th>Unidade</th>

        <th>Quantidade</th>

        <th>Estoque mínimo</th>

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

        <th>Apresentação</th>

        <th>Quantidade atual</th>

        <th>Estoque mínimo</th>

        <th>Diferença</th>

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


          const diferenca =
            minimo
            -
            item.quantidade;


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

                ${diferenca}

              </td>

            </tr>

          `;

        }
      )
      .join("");

  }


  // =======================================================
  // VALIDADES
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
                p =>
                  p.id
                  ===
                  lote.produtoId
              );


            const dias =
              diasAte(
                lote.validade
              );


            const texto = [

              produto?.nome,

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
              p =>
                p.id
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
  // ENTRADAS / SAÍDAS / MOVIMENTAÇÕES
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

    let tipoMov =
      "";


    if (
      tipo
      ===
      "entradas"
    ) {

      titulo =
        "Relatório de Entradas";

      tipoMov =
        "entrada";

    }


    if (
      tipo
      ===
      "saidas"
    ) {

      titulo =
        "Relatório de Saídas";

      tipoMov =
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
            !tipoMov
            ||
            movimento.tipo
            ===
            tipoMov;


          const periodoOk =
            movimentoDentroPeriodo(

              movimento,

              dataInicial,

              dataFinal

            );


          const texto = [

            movimento.produtoNome,

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
  // CONTADORES DE ENTRADAS E SAÍDAS
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
          mov =>
            mov.tipo
            ===
            "entrada"
        )

        .reduce(
          (
            total,
            mov
          ) =>

            total
            +
            Number(
              mov.quantidade
              ||
              0
            ),

          0
        );


    totalSaidas =
      movimentosPeriodo

        .filter(
          mov =>
            mov.tipo
            ===
            "saida"
        )

        .reduce(
          (
            total,
            mov
          ) =>

            total
            +
            Number(
              mov.quantidade
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

    const colspan =

      [
        "entradas",
        "saidas",
        "movimentacoes"
      ].includes(
        tipo
      )
        ?
        7
        :
        tipo
        ===
        "estoque"
          ?
          6
          :
          5;


    body = `

      <tr>

        <td colspan="${colspan}">

          Nenhum registro encontrado para os filtros selecionados.

        </td>

      </tr>

    `;

  }


  // =======================================================
  // MOSTRAR RESULTADO
  // =======================================================

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
// BOTÃO GERAR RELATÓRIO
// =========================================================

$("btnGerarRelatorio")
  ?.addEventListener(
    "click",
    gerarRelatorio
  );


// =========================================================
// ALTERAR TIPO DO RELATÓRIO
// =========================================================

$("relatorioTipo")
  ?.addEventListener(
    "change",
    gerarRelatorio
  );


// =========================================================
// GERAR PDF
// =========================================================

$("btnPdfRelatorio")
  ?.addEventListener(
    "click",
    () => {

      gerarRelatorio();


      gerarPDFRelatorio();

    }
  );


// =========================================================
// PDF VIA IMPRESSÃO
// =========================================================

function gerarPDFRelatorio() {

  if (
    !relatorioAtual.titulo
  ) {

    alert(
      "Gere um relatório antes de criar o PDF."
    );


    return;

  }


  const titulo =
    relatorioAtual.titulo;


  const dataGeracao =
    new Date()
      .toLocaleString(
        "pt-BR"
      );


  const periodoInicial =
    $("relatorioDataInicial")
      ?.value;


  const periodoFinal =
    $("relatorioDataFinal")
      ?.value;


  let periodo =
    "Todos os períodos";


  if (
    periodoInicial
    &&
    periodoFinal
  ) {

    periodo =

      `${formatDateBR(
        periodoInicial
      )} a ${formatDateBR(
        periodoFinal
      )}`;

  }

  else if (
    periodoInicial
  ) {

    periodo =

      `A partir de ${formatDateBR(
        periodoInicial
      )}`;

  }

  else if (
    periodoFinal
  ) {

    periodo =

      `Até ${formatDateBR(
        periodoFinal
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
          titulo
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

          color: #222222;

          margin: 30px;

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

          color: #17375e;

          font-size: 19px;

          margin-top: 5px;

        }

        table {

          width: 100%;

          border-collapse: collapse;

          font-size: 11px;

        }

        th {

          background: #17375e;

          color: white;

          padding: 8px;

          border:
            1px solid
            #cccccc;

          text-align: left;

        }

        td {

          padding: 7px;

          border:
            1px solid
            #cccccc;

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
            titulo
          )}

        </h2>

        <p>

          Sistema Integrado de Controle de Estoque de Farmácia

        </p>

        <p>

          Período:
          ${esc(
            periodo
          )}

        </p>

        <p>

          Gerado em:
          ${esc(
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

        SISFAR V2 -
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
// FIM APP.JS
// =========================================================
