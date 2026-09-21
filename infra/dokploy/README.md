# Dokploy + Terraform

Este diretório cria no Dokploy um projeto `futhub`, o ambiente `production` e cinco serviços independentes. Não há stack Compose em produção.

## Serviços

- `admin`: painel administrativo.
- `player`: aplicação do jogador.
- `api`: API HTTP, inclusive `/health`.
- `postgres`: banco PostgreSQL gerenciado pelo Dokploy.
- `rustfs`: armazenamento S3 de imagens com volume persistente; o console não é publicado.

Cada aplicação Git usa um estágio próprio do `Dockerfile`. O Terraform configura as variáveis e os domínios HTTPS depois de criar as aplicações.

## Pré-requisitos

- Dokploy instalado, com API key criada.
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

O `discord-bot` permanece fora deste ambiente porque é opcional e falha sem credenciais Discord. Adicione-o somente quando houver token de produção e monitoramento.
