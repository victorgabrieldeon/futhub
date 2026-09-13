provider "dokploy" {
  host    = var.dokploy_api_url
  api_key = var.dokploy_api_key
}

resource "dokploy_project" "futhub" {
  name        = var.project_name
  description = "FutHub production"
}

resource "dokploy_environment" "production" {
  project_id  = dokploy_project.futhub.id
  name        = "production"
  description = "Production"
}

resource "dokploy_project_environment_variables" "futhub" {
  project_id = dokploy_project.futhub.id

  variables = {
    ADMIN_API_TOKEN             = var.admin_api_token
    ADMIN_API_URL               = "http://api:3000"
    ADMIN_DISCORD_REDIRECT_URI  = "https://${var.admin_domain}/api/auth/discord/callback"
    ADMIN_DISCORD_USER_IDS      = var.admin_discord_user_ids
    ADMIN_SESSION_SECRET        = var.admin_session_secret
    API_INTERNAL_TOKEN          = var.api_internal_token
    API_PORT                    = "3000"
    BRAVE_SEARCH_API_KEY        = var.brave_search_api_key
    DATABASE_URL                = "postgresql://futhub:${var.postgres_password}@postgres:5432/futhub"
    DISCORD_CLIENT_ID           = var.discord_client_id
    DISCORD_CLIENT_SECRET       = var.discord_client_secret
    MINIO_ACCESS_KEY            = var.minio_root_user
    MINIO_BUCKET                = "futhub-card-images"
    MINIO_ENDPOINT              = "minio"
    MINIO_PORT                  = "9000"
    MINIO_PUBLIC_URL            = "https://${var.minio_domain}"
    MINIO_ROOT_PASSWORD         = var.minio_root_password
    MINIO_ROOT_USER             = var.minio_root_user
    MINIO_SECRET_KEY            = var.minio_root_password
    MINIO_USE_SSL               = "false"
    PLAYER_API_URL              = "http://api:3000"
    PLAYER_APP_URL              = "https://${var.player_domain}"
    PLAYER_DISCORD_REDIRECT_URI = "https://${var.player_domain}/v1/auth/player/discord/callback"
    PLAYER_SESSION_SECRET       = var.player_session_secret
    POSTGRES_DB                 = "futhub"
    POSTGRES_PASSWORD           = var.postgres_password
    POSTGRES_USER               = "futhub"
    PORT                        = "3000"
    THESPORTSDB_API_KEY         = var.thesportsdb_api_key
  }
}

resource "dokploy_compose" "futhub" {
  project_id                = dokploy_project.futhub.id
  environment_id            = dokploy_environment.production.id
  name                      = "futhub"
  source_type               = "git"
  custom_git_url            = var.repository_url
  custom_git_branch         = var.repository_branch
  custom_git_ssh_key_id     = var.dokploy_git_ssh_key_id
  compose_path              = "infra/dokploy/docker-compose.yml"
  auto_deploy               = true
  deploy_on_create          = true
  delete_volumes_on_destroy = false

  depends_on = [dokploy_project_environment_variables.futhub]
}

locals {
  domains = {
    admin  = { host = var.admin_domain, service_name = "admin", port = 3000 }
    player = { host = var.player_domain, service_name = "player", port = 3000 }
    api    = { host = var.api_domain, service_name = "api", port = 3000 }
    minio  = { host = var.minio_domain, service_name = "minio", port = 9000 }
  }
}

resource "dokploy_domain" "futhub" {
  for_each = local.domains

  compose_id           = dokploy_compose.futhub.id
  host                 = each.value.host
  service_name         = each.value.service_name
  port                 = each.value.port
  https                = true
  certificate_provider = "letsencrypt"
  redeploy_on_update   = true
}
