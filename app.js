import { auth, db } from "./firebase.js";

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

let usuarioAtual = null;
let produtosCache = [];
let lotesCache = [];
let movimentosCache = [];

const $ = (id) => document.getElementById(id);

const loginScreen = $("loginScreen");
const appScreen = $("appScreen");


/* =========================================
   MENSAGENS
========================================= */

function showMsg(el, texto, tipo = "error") {

  el.textContent = texto;

  el.className = `message ${tipo}`;

}


function hideMsg(el) {

  el.textContent = "";

  el.className = "message hidden";

}


/* =========================================
   SEGURANÇA DE TEXTO
========================================= */

function esc(v = "") {

  return String(v)

    .replaceAll("&", "&amp;")

    .replaceAll("<", "&lt;")

    .replaceAll(">", "&gt;")

    .replaceAll('"', "&quot;")

    .replaceAll("'", "&#039;");

}


/* =========================================
   DATAS
========================================= */

function formatDateBR(value) {

  if (!value) return "-";


  if (typeof value === "string") {

    const [y, m, d] = value.split("-");

    return (y && m && d)
      ? `${d}/${m}/${y}`
      : value;

  }


  if (value?.toDate) {

    return value
      .toDate()
      .toLocaleString("pt-BR");

  }


  return "-";

}


function diasAte(dataISO) {

  if (!dataISO) return 999999;


  const hoje = new Date();

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
    (alvo - hoje)
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


/* =========================================
   PERFIS
========================================= */

function perfilLabel(p) {

  return ({

    gestor:
      "Gestor",

    farmacia:
      "Farmácia",

    consulta:
      "Consulta"

  })[p] || p;

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


/* =========================================
   PERMISSÕES DA INTERFACE
========================================= */

function aplicarPermissoes() {

  document
    .querySelectorAll(
      ".gestor-only"
    )
    .forEach(el => {

      el
        .classList
        .toggle(
          "hidden",
          !isGestor()
        );

    });


  document
    .querySelectorAll(
      ".perm-operacao"
    )
    .forEach(el => {

      el
        .classList
        .toggle(
          "hidden",
          !podeOperar()
        );

    });

}


/* =========================================
   LOGIN
========================================= */

$("loginForm")
  .addEventListener(
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
          "Não foi possível entrar. Verifique e-mail, senha e se o acesso por E-mail/Senha está ativado."
        );

      }

    }
  );


/* =========================================
   LOGOUT
========================================= */

$("logoutBtn")
  .addEventListener(
    "click",
    async () => {

      await signOut(auth);

    }
  );


/* =========================================
   ESTADO DE AUTENTICAÇÃO
========================================= */

onAuthStateChanged(
  auth,
  async (user) => {

    if (!user) {

      usuarioAtual = null;


      loginScreen
        .classList
        .remove("hidden");


      appScreen
        .classList
        .add("hidden");


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


      if (!snap.exists()) {

        await signOut(auth);


        showMsg(
          $("loginMsg"),
          `Usuário autenticado, mas não existe cadastro de perfil em usuarios/${user.uid}. Crie esse documento no Firestore.`
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

        await signOut(auth);


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
        .classList
        .add("hidden");


      appScreen
        .classList
        .remove("hidden");


      await carregarTudo();


      abrirPagina(
        "dashboard"
      );

    }

    catch (err) {

      console.error(err);


      await signOut(auth);


      showMsg(
        $("loginMsg"),
        "Erro ao carregar o perfil. Verifique as regras do Firestore."
      );

    }

  }
);


/* =========================================
   MENU
========================================= */

document
  .querySelectorAll(
    ".nav-btn[data-page]"
  )
  .forEach(btn => {

    btn
      .addEventListener(
        "click",
        () => {

          abrirPagina(
            btn.dataset.page
          );

        }
      );

  });


function abrirPagina(page) {

  document
    .querySelectorAll(
      ".page"
    )
    .forEach(p => {

      p
        .classList
        .add("hidden");

    });


  const destino =
    $(
      `page-${page}`
    );


  if (destino) {

    destino
      .classList
      .remove("hidden");

  }


  document
    .querySelectorAll(
      ".nav-btn[data-page]"
    )
    .forEach(b => {

      b
        .classList
        .toggle(
          "active",
          b.dataset.page
          ===
          page
        );

    });


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

    usuarios:
      "Usuários"

  };


  $("pageHeader")
    .textContent =
    labels[page]
    ||
    "SISFAR V2";


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


/* =========================================
   CARREGAMENTO GERAL
========================================= */

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


/* =========================================
   PRODUTOS
========================================= */

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
      .map(d => ({

        id:
          d.id,

        ...d.data()

      }))
      .sort(
        (a, b) =>

          (a.nome || "")
            .localeCompare(
              b.nome || "",
              "pt-BR"
            )

      );

}


/* =========================================
   LOTES
========================================= */

async function carregarLotes() {

  const snap =
    await getDocs(
      collection(
        db,
        "lotes"
      )
    );


  lotesCache =
    snap.docs
      .map(d => ({

        id:
          d.id,

        ...d.data()

      }));

}


/* =========================================
   MOVIMENTAÇÕES
========================================= */

async function carregarMovimentacoes() {

  try {

    const q =
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
      await getDocs(q);


    movimentosCache =
      snap.docs
        .map(d => ({

          id:
            d.id,

          ...d.data()

        }));

  }

  catch (err) {

    console.warn(
      "Fallback sem orderBy:",
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
      snap.docs
        .map(d => ({

          id:
            d.id,

          ...d.data()

        }));


    movimentosCache
      .sort(
        (a, b) => {

          const ad =
            a.criadoEm?.seconds
            ||
            0;


          const bd =
            b.criadoEm?.seconds
            ||
            0;


          return bd - ad;

        }
      );

  }

}


/* =========================================
   TOTAL POR PRODUTO
========================================= */

function totalProduto(
  produtoId
) {

  return lotesCache

    .filter(
      l =>
        l.produtoId
        ===
        produtoId
    )

    .reduce(
      (s, l) =>
        s
        +
        Number(
          l.quantidade
          ||
          0
        ),

      0
    );

}


/* =========================================
   DASHBOARD
========================================= */

function renderDashboard() {

  const totalQtd =
    lotesCache
      .reduce(
        (s, l) =>
          s
          +
          Number(
            l.quantidade
            ||
            0
          ),
        0
      );


  const baixos =
    produtosCache
      .filter(
        p =>
          totalProduto(
            p.id
          )
          <=
          Number(
            p.estoqueMinimo
            ||
            0
          )
      )
      .length;


  const vencendo =
    lotesCache
      .filter(
        l => {

          const d =
            diasAte(
              l.validade
            );


          return (
            Number(
              l.quantidade
              ||
              0
            )
            >
            0
            &&
            d
            >=
            0
            &&
            d
            <=
            90
          );

        }
      )
      .length;


  $("statProdutos")
    .textContent =
    produtosCache.length;


  $("statQuantidade")
    .textContent =
    totalQtd;


  $("statBaixo")
    .textContent =
    baixos;


  $("statVencendo")
    .textContent =
    vencendo;


  const alertas =
    lotesCache

      .filter(
        l => {

          const p =
            produtosCache
              .find(
                x =>
                  x.id
                  ===
                  l.produtoId
              );


          const qtd =
            Number(
              l.quantidade
              ||
              0
            );


          const venc =
            diasAte(
              l.validade
            )
            <=
            90;


          const baixo =
            p
              ?
              totalProduto(
                p.id
              )
              <=
              Number(
                p.estoqueMinimo
                ||
                0
              )
              :
              false;


          return (
            qtd
            >
            0
            &&
            (
              venc
              ||
              baixo
            )
          );

        }
      )

      .sort(
        (a, b) =>

          (a.validade || "9999")
            .localeCompare(
              b.validade || "9999"
            )

      );


  $("dashboardAlertas")
    .innerHTML =
    alertas.length
      ?
      alertas
        .map(
          l => {

            const p =
              produtosCache
                .find(
                  x =>
                    x.id
                    ===
                    l.produtoId
                );


            const d =
              diasAte(
                l.validade
              );


            let badge =
              '<span class="badge ok">Normal</span>';


            if (
              d
              <
              0
            ) {

              badge =
                '<span class="badge danger">Vencido</span>';

            }

            else if (
              d
              <=
              30
            ) {

              badge =
                '<span class="badge danger">Vence em até 30 dias</span>';

            }

            else if (
              d
              <=
              90
            ) {

              badge =
                '<span class="badge warning">Vence em até 90 dias</span>';

            }

            else if (
              p
              &&
              totalProduto(
                p.id
              )
              <=
              Number(
                p.estoqueMinimo
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
                    p?.nome
                    ||
                    "Produto não encontrado"
                  )}
                </td>

                <td>
                  ${esc(
                    l.lote
                    ||
                    "-"
                  )}
                </td>

                <td>
                  ${formatDateBR(
                    l.validade
                  )}
                </td>

                <td>
                  ${Number(
                    l.quantidade
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
        .join("")

      :

      `
        <tr>
          <td colspan="5">
            Nenhum alerta no momento.
          </td>
        </tr>
      `;

}


/* =========================================
   ATUALIZAR DASHBOARD
========================================= */

$("refreshDashboard")
  .addEventListener(
    "click",
    carregarTudo
  );


/* =========================================
   NOVO PRODUTO
========================================= */

$("btnNovoProduto")
  .addEventListener(
    "click",
    () => {

      if (
        !podeOperar()
      )
        return;


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
        .remove("hidden");

    }
  );


/* =========================================
   CANCELAR PRODUTO
========================================= */

$("cancelProduto")
  .addEventListener(
    "click",
    () => {

      $("produtoFormPanel")
        .classList
        .add("hidden");

    }
  );


/* =========================================
   SALVAR PRODUTO
========================================= */

$("produtoForm")
  .addEventListener(
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

        if (id) {

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
          .add("hidden");


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


/* =========================================
   EDITAR PRODUTO
========================================= */

window.editarProduto =
  (id) => {

    if (
      !podeOperar()
    )
      return;


    const p =
      produtosCache
        .find(
          x =>
            x.id
            ===
            id
        );


    if (!p)
      return;


    $("produtoId")
      .value =
      p.id;


    $("produtoNome")
      .value =
      p.nome
      ||
      "";


    $("produtoApresentacao")
      .value =
      p.apresentacao
      ||
      "";


    $("produtoCategoria")
      .value =
      p.categoria
      ||
      "";


    $("produtoUnidade")
      .value =
      p.unidade
      ||
      "";


    $("produtoMinimo")
      .value =
      Number(
        p.estoqueMinimo
        ||
        0
      );


    $("produtoLocalizacao")
      .value =
      p.localizacao
      ||
      "";


    $("produtoFormTitulo")
      .textContent =
      "Editar produto";


    $("produtoFormPanel")
      .classList
      .remove("hidden");


    window.scrollTo({

      top:
        0,

      behavior:
        "smooth"

    });

  };


/* =========================================
   EXCLUIR PRODUTO
========================================= */

window.excluirProduto =
  async (id) => {

    if (
      !isGestor()
    )
      return;


    if (
      lotesCache
        .some(
          l =>
            l.produtoId
            ===
            id
            &&
            Number(
              l.quantidade
              ||
              0
            )
            >
            0
        )
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


/* =========================================
   TABELA DE ESTOQUE
========================================= */

function renderEstoque() {

  const busca =
    $("searchProduto")
      .value
      .trim()
      .toLowerCase();


  const lista =
    produtosCache
      .filter(
        p =>

          [

            p.nome,

            p.apresentacao,

            p.categoria,

            p.localizacao

          ]

            .join(" ")

            .toLowerCase()

            .includes(busca)

      );


  $("estoqueBody")
    .innerHTML =
    lista.length
      ?
      lista
        .map(
          p => {

            const total =
              totalProduto(
                p.id
              );


            const baixo =
              total
              <=
              Number(
                p.estoqueMinimo
                ||
                0
              );


            let acoes =
              "-";


            if (
              podeOperar()
            ) {

              acoes =
                `
                  <button
                    class="btn btn-secondary"
                    onclick="editarProduto('${p.id}')"
                  >
                    Editar
                  </button>
                `;


              if (
                isGestor()
              ) {

                acoes +=
                  `
                    <button
                      class="btn btn-danger"
                      onclick="excluirProduto('${p.id}')"
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
                    p.nome
                    ||
                    "-"
                  )}
                </td>

                <td>
                  ${esc(
                    p.apresentacao
                    ||
                    "-"
                  )}
                </td>

                <td>
                  ${esc(
                    p.unidade
                    ||
                    "-"
                  )}
                </td>

                <td>
                  ${total}
                </td>

                <td>
                  ${Number(
                    p.estoqueMinimo
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
        .join("")

      :

      `
        <tr>
          <td colspan="7">
            Nenhum produto encontrado.
          </td>
        </tr>
      `;

}


/* =========================================
   PESQUISA PRODUTO
========================================= */

$("searchProduto")
  .addEventListener(
    "input",
    renderEstoque
  );


/* =========================================
   SELECTS DE PRODUTOS
========================================= */

function preencherSelectProdutos() {

  const opts =

    `
      <option value="">
        Selecione...
      </option>
    `

    +

    produtosCache
      .map(
        p =>

          `
            <option value="${p.id}">

              ${esc(
                p.nome
              )}

              ${
                p.apresentacao
                  ?
                  ` - ${esc(
                    p.apresentacao
                  )}`
                  :
                  ""
              }

            </option>
          `

      )
      .join("");


  $("entradaProduto")
    .innerHTML =
    opts;


  $("baixaProduto")
    .innerHTML =
    opts;


  preencherLotesBaixa();

}


/* =========================================
   ENTRADA DE ESTOQUE
========================================= */

$("entradaForm")
  .addEventListener(
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
      )
        return;


      try {

        const existente =
          lotesCache
            .find(
              l =>

                l.produtoId
                ===
                produtoId

                &&

                String(
                  l.lote
                  ||
                  ""
                )
                  .trim()
                  .toLowerCase()

                ===

                loteNumero
                  .toLowerCase()

                &&

                l.validade
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

            async (tx) => {

              const snap =
                await tx.get(
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


              tx.update(

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

                produtoId:
                  produtoId,

                lote:
                  loteNumero,

                validade:
                  validade,

                quantidade:
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
          produtosCache
            .find(
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

            produtoId:
              produtoId,

            produtoNome:
              produto?.nome
              ||
              "",

            loteId:
              loteId,

            lote:
              loteNumero,

            quantidade:
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

        renderValidades();

      }

      catch (err) {

        console.error(err);


        showMsg(
          $("entradaMsg"),
          "Erro ao registrar entrada."
        );

      }

    }
  );


/* =========================================
   PRODUTO DA BAIXA
========================================= */

$("baixaProduto")
  .addEventListener(
    "change",
    preencherLotesBaixa
  );


/* =========================================
   LOTES PARA BAIXA
========================================= */

function preencherLotesBaixa() {

  const produtoId =
    $("baixaProduto")
      .value;


  const lotes =
    lotesCache

      .filter(
        l =>

          l.produtoId
          ===
          produtoId

          &&

          Number(
            l.quantidade
            ||
            0
          )
          >
          0
      )

      .sort(
        (a, b) =>

          (a.validade || "9999")
            .localeCompare(
              b.validade || "9999"
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

    lotes
      .map(
        (l, i) =>

          `
            <option value="${l.id}">

              ${
                i
                ===
                0
                  ?
                  "FEFO → "
                  :
                  ""
              }

              ${esc(
                l.lote
              )}

              |

              ${formatDateBR(
                l.validade
              )}

              |

              qtd.

              ${Number(
                l.quantidade
                ||
                0
              )}

            </option>
          `

      )
      .join("");

}


/* =========================================
   BAIXA DE ESTOQUE
========================================= */

$("baixaForm")
  .addEventListener(
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
      )
        return;


      try {

        const loteRef =
          doc(
            db,
            "lotes",
            loteId
          );


        let loteDados;


        await runTransaction(

          db,

          async (tx) => {

            const snap =
              await tx.get(
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


            tx.update(

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
          produtosCache
            .find(
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

            produtoId:
              produtoId,

            produtoNome:
              produto?.nome
              ||
              "",

            loteId:
              loteId,

            lote:
              loteDados?.lote
              ||
              "",

            quantidade:
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


        preencherLotesBaixa();


        showMsg(
          $("baixaMsg"),
          "Baixa registrada com sucesso.",
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
          $("baixaMsg"),
          err.message
          ||
          "Erro ao registrar baixa."
        );

      }

    }
  );


/* =========================================
   DATA/HORA MOVIMENTAÇÃO
========================================= */

function dataMov(m) {

  return m.criadoEm?.toDate

    ?

    m.criadoEm
      .toDate()
      .toLocaleString(
        "pt-BR"
      )

    :

    "-";

}


/* =========================================
   TABELA MOVIMENTAÇÕES
========================================= */

function renderMovimentacoes() {

  const tipo =
    $("movTipoFiltro")
      .value;


  const busca =
    $("movBusca")
      .value
      .trim()
      .toLowerCase();


  const lista =
    movimentosCache
      .filter(
        m => {

          const okTipo =
            !tipo
            ||
            m.tipo
            ===
            tipo;


          const texto = [

            m.produtoNome,

            m.lote,

            m.responsavelNome,

            m.destino,

            m.origem,

            m.motivo

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


  $("movBody")
    .innerHTML =
    lista.length
      ?
      lista
        .map(
          m =>

            `
              <tr>

                <td>
                  ${dataMov(m)}
                </td>

                <td>

                  ${
                    m.tipo
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
                    m.produtoNome
                    ||
                    "-"
                  )}
                </td>

                <td>
                  ${esc(
                    m.lote
                    ||
                    "-"
                  )}
                </td>

                <td>
                  ${Number(
                    m.quantidade
                    ||
                    0
                  )}
                </td>

                <td>
                  ${esc(
                    m.destino
                    ||
                    m.origem
                    ||
                    "-"
                  )}
                </td>

                <td>
                  ${esc(
                    m.responsavelNome
                    ||
                    "-"
                  )}
                </td>

              </tr>
            `

        )
        .join("")

      :

      `
        <tr>

          <td colspan="7">

            Nenhuma movimentação encontrada.

          </td>

        </tr>
      `;

}


/* =========================================
   FILTROS MOVIMENTAÇÕES
========================================= */

$("movTipoFiltro")
  .addEventListener(
    "change",
    renderMovimentacoes
  );


$("movBusca")
  .addEventListener(
    "input",
    renderMovimentacoes
  );


/* =========================================
   LOTES E VALIDADES
========================================= */

function renderValidades() {

  const lista = [

    ...lotesCache

  ]

    .sort(
      (a, b) =>

        (a.validade || "9999")
          .localeCompare(
            b.validade || "9999"
          )

    );


  $("validadeBody")
    .innerHTML =
    lista.length

      ?

    lista
      .map(
        l => {

          const p =
            produtosCache
              .find(
                x =>
                  x.id
                  ===
                  l.produtoId
              );


          const d =
            diasAte(
              l.validade
            );


          let status =
            '<span class="badge ok">Regular</span>';


          if (
            d
            <
            0
          ) {

            status =
              '<span class="badge danger">Vencido</span>';

          }

          else if (
            d
            <=
            30
          ) {

            status =
              '<span class="badge danger">Até 30 dias</span>';

          }

          else if (
            d
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
                  p?.nome
                  ||
                  "-"
                )}
              </td>

              <td>
                ${esc(
                  l.lote
                  ||
                  "-"
                )}
              </td>

              <td>
                ${formatDateBR(
                  l.validade
                )}
              </td>

              <td>
                ${Number(
                  l.quantidade
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
      .join("")

      :

    `
      <tr>

        <td colspan="5">

          Nenhum lote cadastrado.

        </td>

      </tr>
    `;

}


/* =========================================
   USUÁRIOS
========================================= */

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


    const users =
      snap.docs
        .map(
          d => ({

            id:
              d.id,

            ...d.data()

          })
        );


    $("usuariosBody")
      .innerHTML =
      users.length

        ?

      users
        .map(
          u =>

            `
              <tr>

                <td>
                  ${esc(
                    u.nome
                    ||
                    "-"
                  )}
                </td>

                <td>
                  ${esc(
                    u.email
                    ||
                    "-"
                  )}
                </td>

                <td>
                  ${esc(
                    perfilLabel(
                      u.perfil
                    )
                  )}
                </td>

                <td>

                  ${
                    u.ativo
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
        .join("")

        :

      `
        <tr>

          <td colspan="4">

            Nenhum usuário cadastrado.

          </td>

        </tr>
      `;

  }

  catch (err) {

    console.error(err);


    $("usuariosBody")
      .innerHTML =
      `
        <tr>

          <td colspan="4">

            Erro ao carregar usuários.

          </td>

        </tr>
      `;

  }

}
