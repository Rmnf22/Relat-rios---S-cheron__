# Integração com o Excel Online — ativação pendente

A interface e o cliente estão preparados. **O serviço autenticado de leitura/gravação ainda não está implementado ou conectado.** Nenhuma planilha foi alterada. O link da planilha oficial foi recebido em 17/10/2026. Para concluir, faltam o acesso autenticado, a definição do backend/fluxo Microsoft 365, sua autorização de leitura e escrita e a validação com uma cópia de teste. O link corporativo não foi incorporado ao código público.

A integração SharePoint do ChatGPT pode ajudar a identificar o arquivo, mas não fornece automaticamente credenciais ao site do GitHub.

## Regras

- FieldService e ServiceCenter têm sequências independentes. A prévia usa a maior sequência da aba + 1; não foi presumido reinício anual. Se houver reinício, confirmar e implementar a regra antes da ativação.
- Mês/ano vêm da data do relatório; revisão inicial 00.
- A prévia não reserva nada. Abrir, salvar, visualizar, baixar rascunho e voltar à internet não podem escrever na planilha.
- Somente Gerar definitivo valida o PDF e solicita um registro. O número retornado prevalece sobre a prévia.
- A gravação é confirmada antes do download definitivo. O navegador não informa de forma confiável se o usuário cancelou a janela de salvar. Falha posterior no download deve reutilizar o registro.
- O conteúdo técnico fica local e continua editável; a identificação de um registro confirmado fica vinculada ao comprovante. Duplicar cria outra solicitação.

## Mapeamento verificado

Cabeçalhos na linha 6; dados a partir da linha 7. Tabelas: `Table_1` em FieldService e `Table_2` em ServiceCenter. Não usar a última linha formatada como último número: existem linhas pré-formatadas.

| Coluna | Campo | Origem |
| --- | --- | --- |
| A | Sequencia | Serviço central |
| B | Revisão | metadata.revision |
| C | mês | Mês de metadata.date |
| D | ano | Dois últimos dígitos do ano |
| E | BU | metadata.bu |
| F | Projeto | metadata.project |
| G | Cliente | metadata.client |
| H | Elaborado por | metadata.author |
| I | Nome do Arquivo | Fórmula/regra oficial |
| J | Numero Relatório | Fórmula/regra oficial |
| K | Subestação | metadata.location, somente FieldService |
| L | País | metadata.country, somente FieldService |

Preservar fórmulas, validações, formatos e demais abas. ServiceCenter não possui K/L nesse modelo. Confirmar se o cliente calculado a partir do projeto deve prevalecer sobre o digitado.

## Transporte e autenticação

Configurar a URL HTTPS base em `site/numbering-config.js`. O cliente usa `credentials: include`; o serviço deve oferecer sessão autenticada compatível com a origem publicada. `signInUrl`, se usado, aponta para o login corporativo nesse serviço. Não há dependência de login do ChatGPT.

Validar cookies entre origens. Pode ser necessário domínio próprio com site e API sob o mesmo domínio-base. Permitir explicitamente a origem publicada no CORS; proteger as escritas com autorização, validação de Origin e proteção CSRF. Não expor senha, client secret, chave de API ou URL assinada de Power Automate no código público.

### GET catalog

Somente leitura, consulta completa das duas abas, com paginação quando necessária. Resposta sem cache público:

```json
{"source":"Excel Online","records":[{"sheet":"FieldService","row":47,"sequence":41,"revision":"00","month":"10","year":"26","bu":"TPS","project":"PROJETO-EXEMPLO","client":"CLIENTE-EXEMPLO","author":"TÉCNICO-EXEMPLO","number":"041F1026.00","filename":"RT041F1026.00 - TPS_SEBR - PROJETO-EXEMPLO - CLIENTE-EXEMPLO","location":"LOCAL-EXEMPLO","country":"Brasil"}]}
```

### POST reports/issue

Cabeçalhos `Content-Type: application/json` e `Idempotency-Key` igual a requestId. Os dados abaixo são fictícios:

```json
{"version":1,"requestId":"12345678-1234-4234-8234-123456789abc","pdfValidated":true,"metadata":{"kind":"field","revision":"00","date":"2026-10-17","bu":"TPS","client":"CLIENTE-EXEMPLO","project":"PROJETO-EXEMPLO","author":"TÉCNICO-EXEMPLO","location":"LOCAL-EXEMPLO","country":"Brasil"}}
```

O número sugerido não é enviado como número autorizado. `pdfValidated` não substitui validação e autorização no servidor. Os textos recebidos precisam ser gravados como texto literal, sem executar fórmulas injetadas.

Resposta somente após confirmar a linha no Excel:

```json
{"requestId":"12345678-1234-4234-8234-123456789abc","status":"registered","number":"042F1026","revision":"00","sheet":"FieldService","row":48,"registeredAt":"2026-10-17T15:00:00Z"}
```

Repetir a mesma solicitação deve devolver a mesma resposta. Mesma chave com dados diferentes deve ser recusada. A chave pertence ao usuário/grupo autorizado; conhecer um UUID não concede acesso.

## Concorrência e recuperação

A proteção local contra clique repetido não protege contra dois técnicos emitindo ao mesmo tempo. O serviço deve coordenar todos os emissores e manter um histórico persistente das solicitações. Não implementar como duas chamadas independentes do navegador: ler maior número e inserir maior + 1.

Uma opção no Microsoft 365 combina serviço autenticado, fila de gravação e controle persistente, usando Power Automate/Graph para o Excel. A escolha depende dos recursos e licenças da empresa. Esse backend não faz parte do pacote.

Requisitos antes de ativar:

1. Serializar a atribuição por aba em infraestrutura compartilhada. Um bloqueio na memória de uma instância não basta.
2. Manter a chave da emissão vinculada ao registro e reconciliável no Excel. Se uma coluna técnica for necessária, alinhar sua inclusão com quem mantém o controle e preservar a estrutura.
3. Após timeout, verificar a operação anterior. Nunca repetir a inserção às cegas.
4. Não devolver registered antes de confirmar a linha nem atribuir outro número para corrigir resposta perdida.
5. Definir o tratamento de registros manuais. A Microsoft não suporta modificações simultâneas de múltiplos clientes no mesmo Excel; uma fila só do aplicativo não protege de gravações manuais concorrentes. Pode ser necessário um controle transacional central com o Excel como visão sincronizada, ou coordenação de todos os escritores.
6. Diferenciar nova emissão e revisão de registro existente; respeitar fórmulas oficiais e o histórico.

## Teste no ambiente real

Usar uma cópia da planilha para testar as duas áreas, dois técnicos simultâneos, repetição, perda de resposta após gravação, permissões, sessão expirada e modo offline. Conferir fórmulas e validações. Só depois conectar produção.

O cliente foi verificado com uma API simulada; esses testes não validam transações do Excel nem permissões corporativas. Não houve teste de instalação ou visual em navegador real neste ambiente.

## Referências oficiais

- [GitHub Pages: hospedagem estática](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)
- [Excel Online: ações, concorrência e limitações](https://learn.microsoft.com/en-us/connectors/excelonlinebusiness/)
- [Microsoft identity: registro e tipos de aplicação](https://learn.microsoft.com/en-us/entra/identity-platform/v2-app-types)
