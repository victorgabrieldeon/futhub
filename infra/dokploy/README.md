# Dokploy + Terraform

Este diretório cria no Dokploy um projeto `futhub`, ambiente `production`, variáveis, Compose e quatro domínios HTTPS. O código continua sendo clonado do Git; Terraform não armazena o Compose nem segredos no repositório.

## Pré-requisitos

- Dokploy já instalado, com API key criada.
- DNS de `admin_domain`, `player_domain`, `api_domain` e `minio_domain` apontando para o servidor Dokploy.
- Repositório acessível ao Dokploy. Para repositório privado, cadastre a chave SSH no Dokploy e informe `dokploy_git_ssh_key_id`.
- Redirect URLs configuradas no Discord:
  - `https://<player_domain>/v1/auth/player/discord/callback`
  - `https://<admin_domain>/api/auth/discord/callback`

## Aplicar

```sh
cd infra/dokploy
cp terraform.tfvars.example terraform.tfvars
export TF_VAR_dokploy_api_key='...'
terraform init
terraform plan -out=tfplan
terraform apply tfplan
```

`terraform.tfvars` e o state contêm segredos. Não os versione; use backend remoto criptografado antes de aplicar em equipe.

## Resultado

- `admin`: painel administrativo.
- `player`: aplicação do jogador.
- `api`: API HTTP, inclusive `/health`.
- `minio`: armazenamento de imagens. O console administrativo não é publicado.
- PostgreSQL e MinIO usam volumes persistentes. `terraform destroy` não remove volumes por padrão.

O `discord-bot` permanece fora deste stack porque é opcional e falha sem credenciais Discord. Adicione-o somente quando houver token de produção e monitoramento.
