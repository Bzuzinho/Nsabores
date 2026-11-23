# Nsabores · migração Oracle
## Registo inicial de 23 de novembro de 2026
Preparação numa branch isolada. Nenhuma alteração efetuada na Oracle, no Railway, no DNS ou na branch main. A consola Oracle apresentou “Site Unavailable” antes da autenticação. A quota Always Free disponível, o acesso à VM e o estado efetivo dos dados ainda não foram verificados.

O Railway reportou Offline em production para website, management, api, Postgres e postgres-audit-readonly. Em staging reportou Offline para website, management, api e Postgres. Ambos os serviços de base de dados conservavam um volume associado. A configuração de produção indica PostgreSQL 18. O último registo de deployment consultado das aplicações refere 2a9f095e462f743c529f0719992114b3464ad135. Isto não certifica que tenha sido a última versão funcional. O serviço de auditoria usa uma função Bun com DATABASE_URL. A sua lógica e necessidade operacional têm de ser verificadas antes da aceitação. Os ficheiros de media enviados pela API são guardados na base de dados.

## Preparação da VM e da origem
1. Na região principal da conta, verificar compute e armazenamento gratuitos já consumidos, incluindo outras VMs e volumes. Criar uma VM marcada Always Free apenas se a estimativa e a quota da conta permitirem custo zero. Registar região, shape, memória, disco, imagem, arquitetura e capacidade disponível.
2. Instalar Docker Engine, Compose v2, restic e cliente PostgreSQL 18. Permitir administração SSH apenas pela rede de administração. Para o ensaio basta um túnel SSH. O Compose só publica HTTPS em loopback.
3. Identificar o último código funcional, roles, extensões, encoding, locale e tamanhos na origem. Confirmar privilégios e dependências externas antes de importar. Não reutilizar um volume Railway diretamente na imagem Docker. Para cada ambiente criar uma exportação lógica distinta. O Compose fornecido destina-se a um ensaio isolado de produção. Para staging usar projeto Compose, volumes, segredos, porta e hostname separados. Arquivar a função de auditoria e verificar os seus privilégios de leitura.
4. Com autenticação por ficheiro pgpass protegido e um serviço libpq chamado railway_prod configurado com TLS e verificação do servidor, executar em armazenamento privado com espaço suficiente:
   `umask 077; pg_dump --dbname=service=railway_prod --format=custom --file=production.dump`.
   Registar hash SHA-256, tamanho e inventário da exportação. Para comparações exatas de contagens numa origem ativa usar o mesmo snapshot exportado em transação de leitura para pg_dump e para a contagem. Confirmar também sequências, histórico Prisma, somas comerciais e total de bytes de media. Proteger e cifrar a transferência.
## Instalação do ensaio
Trabalhar em deploy/oracle. Criar /etc/nsabores/preview.env fora do checkout, com acesso reservado ao operador. Definir APP_TAG com a revisão do build e PREVIEW_HOST=nsabores.test. Gerar valores independentes com openssl rand -hex 32 para DB_ADMIN_PASSWORD, APP_DB_PASSWORD, AUTH_SECRET, PAYMENT_HOOK, SHIPPING_HOOK e CLUB_HOOK. A API utiliza uma role própria. Não copiar tokens de fornecedores para o ensaio.

    docker compose --env-file /etc/nsabores/preview.env config --quiet
    docker compose --env-file /etc/nsabores/preview.env build api
    docker compose --env-file /etc/nsabores/preview.env up -d --wait db
    bash restore-preview.sh /caminho/privado/production.dump
    docker compose --env-file /etc/nsabores/preview.env up -d

A importação exige uma base vazia. Se houver extensões que exijam superutilizador, rever a lista da origem e preparar explicitamente as extensões antes de ensaiar o restauro. Não executar seed ou migrations automaticamente. Confirmar compatibilidade do esquema restaurado com a revisão escolhida.

## HTTPS e testes
O Caddy emite um certificado de uma CA privada para o ensaio. Obter apenas o certificado público da CA em /data/caddy/pki/authorities/local/root.crt do contentor proxy. Usar PREVIEW_HOST e CA_CERT com bash test-preview.sh na VM. O teste verifica a página inicial, loja, entrada da gestão e uma consulta ao catálogo que efetivamente depende de PostgreSQL. Verificar adicionalmente sessão, permissões, detalhe de produto e imagem, carrinho, checkout manual, gestão de encomendas e persistência após reinício, com identidade de teste e efeitos externos desativados. Registar códigos HTTP, contagens e diferenças. Não encaminhar clientes para este ensaio.

## Backups e passagem a produção
Inicializar um repositório restic privado fora da VM dentro da quota disponível. Manter a chave de restic recuperável fora da VM. Configurar RESTIC_REPOSITORY, RESTIC_PASSWORD_FILE, autenticação do armazenamento e TMPDIR privado. Para o checkout em /opt/nsabores, preencher /etc/nsabores/backup.env e instalar nsabores-backup.service e nsabores-backup.timer em /etc/systemd/system. Executar systemctl daemon-reload e systemctl enable --now nsabores-backup.timer. O horário é 03h15 UTC com uma variação máxima de dez minutos. Verificar a primeira execução, alertas e espaço. Restaurar o ficheiro nsabores.dump do snapshot numa segunda base isolada e repetir as verificações de dados. Definir retenção segundo volume medido e quota, e incluir configuração operacional e segredos em cópia cifrada separada.

Antes da mudança pedir aprovação explícita para DNS e acordar janela de escrita. Garantir uma única origem de escrita, aguardar transações, fazer cópia final e reconciliação, preparar HTTPS público e verificar o domínio com resolução local antes de encaminhar tráfego. Registar entradas DNS originais e TTL. Manter Railway disponível para reversão. Se a Oracle já tiver recebido escritas, reconciliá-las antes de reabrir a origem antiga. A eliminação de qualquer serviço exige autorização independente.

## Validação inicial
Análise sintática dos scripts Bash e leitura da configuração YAML com resolução das âncoras. Sem Docker disponível neste executor. Build de imagens, lint, tipos, testes das aplicações, ensaio funcional, restauro e backup remoto continuam pendentes. Nenhum dado de cliente foi exportado.

## Atualização do ensaio de 23 de novembro de 2026
VM dedicada no compartimento nsabores em Frankfurt, AMD64, E2.1.Micro. Ubuntu 24.04, Docker e Compose operacionais. Swap ativa de 1,8 GiB. A produção Railway voltou a reportar website, gestão, API e PostgreSQL online.

Exportação PostgreSQL 18 em formato custom na VM, verificação SHA-256 e restauro numa base de ensaio isolada. O operador confirmou a igualdade das contagens das seis tabelas selecionadas e dos dumps de estrutura, excluindo proprietários, privilégios e a linha informativa da versão de origem. Os dados foram identificados como dados de teste. O dump reside na VM, fora do repositório.

Build AMD64 concluído com sucesso no [GitHub Actions](https://github.com/Bzuzinho/Nsabores/actions/runs/45167415425), commit 78d699f7f892517592761875b74e97cb02ca692b. Continuam por validar o arranque da aplicação na VM, a role aplicacional, os fluxos funcionais e os backups externos com recuperação. O DNS de produção permanece no destino anterior.
