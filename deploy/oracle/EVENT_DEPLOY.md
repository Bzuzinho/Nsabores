# Deploy Oracle por evento do GitHub (sem polling)

O GitHub Actions `Oracle production image` compila a imagem de `main`.
O workflow `Promote verified Oracle image` confirma CI e Management smoke do
mesmo commit, promove a imagem imutável a `:production` no GHCR e inicia o
deploy na VM via SSH. Não existe temporizador a consultar o registry.

## Configuração única

**Não integrar/ativar a etapa de SSH antes desta configuração**, caso contrário
o workflow indicará uma falha explícita de configuração.

1. Na Oracle, instalar o script de deploy como root:
   `sudo install -m 700 deploy/oracle/auto-deploy.sh /usr/local/sbin/nsabores-auto-deploy`.
   O ficheiro deve provir do commit validado, nunca de uma branch não revista.
   Validar com `sudo bash -n /usr/local/sbin/nsabores-auto-deploy`.
2. Gerar um par de chaves SSH **dedicado à publicação**, sem palavra-passe
   (o runner não tem terminal interativo). Não reutilizar a chave SSH pessoal.
3. Criar um utilizador de sistema exclusivo para deploy, sem acesso a outros
   serviços. Autorizar apenas a chave pública gerada e conceder com `sudoers`
   a execução sem password de **um único comando**:
   `/usr/local/sbin/nsabores-auto-deploy`.
   Não atribuir pertença ao grupo Docker a este utilizador.
4. Em GitHub → Settings → Secrets and variables → Actions, adicionar os secrets:
   - `ORACLE_DEPLOY_SSH_KEY`: chave privada dedicada ao deploy.
   - `ORACLE_SSH_KNOWN_HOSTS`: entrada `known_hosts` com chave do servidor,
     **validada com a fingerprint no console Oracle**, não confiando apenas
     no resultado de `ssh-keyscan`.
   - `ORACLE_SSH_HOST`: IP público ou nome da VM.
   - `ORACLE_SSH_USER`: utilizador SSH dedicado.
5. Testar o comando de deploy manualmente uma vez. Não imprimir a chave privada
   nem segredos no output.
6. As portas 80/443 continuam no Caddy; SSH 22 deve ficar protegido por chave
   e, se possível, origem limitada.

## Controlos

- O workflow só atua após publicação de uma imagem validada e após CI e smoke
  verdes para o mesmo SHA de `main`.
- A VM descarrega a imagem pública `:production` apenas quando o GitHub
  desencadeia a operação (não há agendamentos).
- O script atualiza apenas `api`, `website`, `management`; não remove
  volumes de PostgreSQL/Caddy.
- Depois, confirma HTTP 200 em website, loja, gestão e API, HTTP 401 na rota
  admin sem sessão e PostgreSQL disponível; em falha tenta repor a imagem
  anterior. Estes checks não substituem testes funcionais autenticados.
- Atualizações que exijam migrações da BD, dados externos ou mudanças de
  infraestrutura devem ter procedimento específico e uma janela de publicação.

**Importante:** a chave de deploy confere acesso sensível à produção.
Utilizar a proteção de branch/PR em `main` e rever alterações aos workflows.
