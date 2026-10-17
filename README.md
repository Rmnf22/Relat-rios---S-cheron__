# Sécheron Relatórios Offline — 2.1

Atualização de 17/10/2026: crédito do elaborador abaixo de Como usar, prévia da próxima sequência por área e preparação da emissão com registro no Excel Online.

**A gravação no Excel real ainda não está conectada.** Este pacote contém a interface e o cliente de integração, com configuração vazia. O serviço autenticado de numeração ainda precisa ser implementado/configurado no ambiente da empresa e validado com a planilha oficial. Não basta colar um link de compartilhamento no código.

## Arquivos

- `Abrir_Gerador_Offline.html`: arquivo portátil para editar, visualizar e baixar rascunhos sem internet. Salve o JSON antes de fechar.
- `site/`: versão estática para publicar no GitHub Pages e instalar como PWA.
- `LEIA_PRIMEIRO.html`: orientações para uso e publicação.
- `INTEGRACAO_EXCEL.md`: mapeamento da planilha e contrato da integração pendente.
- `site/numbering-config.js`: endereço do serviço autenticado; vazio nesta entrega. Não colocar senhas ou chaves.
- `scripts/build-portable.mjs`: reconstrói o HTML portátil e atualiza o cache da PWA.
- `tests/`: verificações do modo offline e da emissão contra uma API simulada.

## Fluxo solicitado

1. Abrir um relatório novo consulta a numeração quando a integração estiver ativa. Field Service e Service Center usam sequências independentes.
2. Se a última sequência de Field Service é 41, a prévia é 42. Alterar a área recalcula a prévia. A importação local do XLSX já permite conferir essa função.
3. Preencher, salvar, visualizar e baixar um rascunho não solicitam gravação no Excel.
4. **Gerar definitivo** valida os campos e a capacidade de gerar o PDF antes de solicitar o registro. O serviço deve atribuir o número e confirmar a gravação da linha.
5. O PDF usa o número confirmado. Se outro técnico usou a prévia, a confirmação pode trazer outro número.
6. Baixar novamente reutiliza o comprovante. Após uma resposta perdida, a mesma solicitação é reapresentada.

A identificação fica vinculada à solicitação durante sua confirmação e após o registro. O conteúdo técnico continua editável. Para outro serviço, use Novo ou Duplicar; duplicar remove a vinculação. Relatórios antigos podem usar um número já registrado, sem criar nova linha.

## Offline

O portátil não tenta conexão com o Excel. A PWA guarda a última consulta quando consegue obtê-la. Offline, a sequência é apenas uma estimativa; uma emissão nova depende da confirmação online. Relatórios já confirmados podem ser baixados novamente offline.

No portátil, os rascunhos duram a sessão: baixe o JSON antes de fechar. Na PWA, ficam em IndexedDB quando disponível. O JSON mantém o identificador e o comprovante da emissão, para recuperar uma operação sem pedir outro número.

Não há sincronização automática de rascunhos, fotos ou PDFs entre computadores. O pedido de registro envia somente campos de identificação. A lista corporativa não acompanha a publicação no GitHub.

## Publicação e manutenção

Envie o conteúdo de `site/` para a raiz do repositório. Em Settings → Pages, escolha Deploy from a branch e `/(root)`. Configure a integração somente depois de disponibilizar o serviço protegido descrito no documento técnico.

Os técnicos não precisam de Node.js. Para manutenção, use Node.js 24:

```sh
node scripts/build-portable.mjs
node tests/distribution.mjs
node tests/numbering.mjs
```

Execute o build depois de qualquer mudança em `site/`, inclusive configuração. A PWA exige primeiro acesso online e preparação do cache. O crédito “Elaborador: Ramon Oliveira” fica abaixo de Como usar, com fonte de 10 px.

## Verificação

Verificados: PDF no portátil sem rede; prévia 41→42 em Field Service e 71→72 em Service Center; ausência de registro em rascunhos; bloqueio offline/sem conexão; falha de PDF anterior à solicitação; clique repetido; uso do número retornado; recuperação de resposta perdida; JSON com comprovante; nova cópia sem repetir registro; cobertura do cache da PWA.

A API usada nos testes é simulada. Não houve escrita na planilha oficial, teste do serviço de produção, instalação ou verificação visual em um navegador real neste ambiente.
