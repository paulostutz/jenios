# Dependências originais Letter CB016 + UM001

As duas dependências mínimas deste diretório foram copiadas byte a byte para
compor o laboratório offline R129. Seus contratos não foram alterados.

| Arquivo | Origem recebida | SHA-256 |
| --- | --- | --- |
| `packages/group-billing/clients/central-billing-client.mjs` | `sources/r129-input/letter_cb016/packages/group-billing/clients/central-billing-client.mjs` | `d723887eda5b084e3fa8f8d8b57ee303a4ec469fdf471f4db5a45adb6ed1addc` |
| `packages/group-billing/candidates/ultra-monthly-um001/monthly-performance.mjs` | `sources/r129-input/um001/letter-overlay/packages/group-billing/candidates/ultra-monthly-um001/monthly-performance.mjs` | `313cb4db3c8538ebd7abf66b7667a67be67962a5abb9d1230d06070c71924993` |

O módulo mensal original importa somente `assertReceipt` do cliente CB016.
A composição R129 não instancia `createCentralBillingClient`, não usa o
auxiliar de período pago de assinatura e não executa HTTP, SQL, gateway ou
contato bancário. O cliente original contém uma fábrica HTTP; preservar seu
arquivo não ativa essa fábrica. A finalidade mensal Ultra continua candidata;
a lista original de finalidades de produção não foi ampliada.

O laboratório mantém as marcas privadas dos drafts e snapshots de pagamento.
Um snapshot copiado ou serializado não é uma observação autoritativa de outra
instância. Todos os pagamentos demonstrados são fictícios e locais ao processo,
sem durabilidade, saldo real ou autorização financeira.

Os testes R129 fixam os hashes e importam essas cópias locais. Não dependem de
`git show`, de outro checkout ou de rede.
