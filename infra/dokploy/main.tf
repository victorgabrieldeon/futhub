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

resource "dokploy_database" "postgres" {
  project_id     = dokploy_project.futhub.id
  environment_id = dokploy_environment.production.id
  name           = "postgres"
  type           = "postgres"
  version        = "17-alpine"
  password       = var.postgres_password
}

resource "dokploy_application" "rustfs" {
  project_id            = dokploy_project.futhub.id
  environment_id        = dokploy_environment.production.id
  name                  = "rustfs"
  source_type           = "git"
  custom_git_url        = var.repository_url
  custom_git_branch     = var.repository_branch
  custom_git_ssh_key_id = var.dokploy_git_ssh_key_id
  build_type            = "dockerfile"
  dockerfile_path       = "./Dockerfile"
  docker_context_path   = "/"
  docker_build_stage    = "rustfs"
  auto_deploy           = true
  deploy_on_create      = false

  mounts = [{
    mount_type  = "volume"
    mount_path  = "/data"
    volume_name = "futhub-rustfs-data"
  }]
}

resource "dokploy_environment_variables" "rustfs" {
  application_id = dokploy_application.rustfs.id
  variables = {
    RUSTFS_ACCESS_KEY     = var.minio_root_user
    RUSTFS_SECRET_KEY     = var.minio_root_password
    RUSTFS_CONSOLE_ENABLE = "false"
  }
}

locals {
  applications = {
    admin  = { stage = "admin", host = var.admin_domain }
    api    = { stage = "api", host = var.api_domain }
    player = { stage = "player", host = var.player_domain }
  }

  application_variables = {
    admin = {
      ADMIN_API_TOKEN            = var.admin_api_token
      ADMIN_API_URL              = "https://${var.api_domain}"
      ADMIN_DISCORD_REDIRECT_URI = "https://${var.admin_domain}/api/auth/discord/callback"
      ADMIN_DISCORD_USER_IDS     = var.admin_discord_user_ids
      ADMIN_SESSION_SECRET       = var.admin_session_secret
      DISCORD_CLIENT_ID          = var.discord_client_id
      DISCORD_CLIENT_SECRET      = var.discord_client_secret
      PORT                       = "3000"
    }
    api = {
      ADMIN_API_TOKEN             = var.admin_api_token
      API_INTERNAL_TOKEN          = var.api_internal_token
      API_PORT                    = "3000"
      BRAVE_SEARCH_API_KEY        = var.brave_search_api_key
      DATABASE_URL                = "postgresql://postgres:${var.postgres_password}@${dokploy_database.postgres.name}:${dokploy_database.postgres.internal_port}/postgres"
      DISCORD_CLIENT_ID           = var.discord_client_id
      DISCORD_CLIENT_SECRET       = var.discord_client_secret
      MINIO_ACCESS_KEY            = var.minio_root_user
      MINIO_BUCKET                = "futhub-card-images"
      MINIO_ENDPOINT              = var.minio_domain
      MINIO_PORT                  = "443"
      MINIO_PUBLIC_URL            = "https://${var.minio_domain}"
      MINIO_SECRET_KEY            = var.minio_root_password
      MINIO_USE_SSL               = "true"
      PLAYER_APP_URL              = "https://${var.player_domain}"
      PLAYER_DISCORD_REDIRECT_URI = "https://${var.player_domain}/v1/auth/player/discord/callback"
      PLAYER_SESSION_SECRET       = var.player_session_secret
      THESPORTSDB_API_KEY         = var.thesportsdb_api_key
    }
    player = {
      PLAYER_API_URL = "https://${var.api_domain}"
      PORT           = "3000"
    }
  }
}

resource "dokploy_application" "futhub" {
  for_each = local.applications

  project_id            = dokploy_project.futhub.id
  environment_id        = dokploy_environment.production.id
  name                  = each.key
  source_type           = "git"
  custom_git_url        = var.repository_url
  custom_git_branch     = var.repository_branch
  custom_git_ssh_key_id = var.dokploy_git_ssh_key_id
  build_type            = "dockerfile"
  dockerfile_path       = "./Dockerfile"
  docker_context_path   = "/"
  docker_build_stage    = each.value.stage
  auto_deploy           = true
  deploy_on_create      = false
}

resource "dokploy_environment_variables" "futhub" {
  for_each = local.application_variables

  application_id = dokploy_application.futhub[each.key].id
  variables      = each.value
}

resource "dokploy_domain" "futhub" {
  for_each = local.applications

  application_id       = dokploy_application.futhub[each.key].id
  host                 = each.value.host
  port                 = 3000
  https                = true
  certificate_provider = "letsencrypt"
  redeploy_on_update   = true

  depends_on = [dokploy_environment_variables.futhub]
}

resource "dokploy_domain" "rustfs" {
  application_id       = dokploy_application.rustfs.id
  host                 = var.minio_domain
  port                 = 9000
  https                = true
  certificate_provider = "letsencrypt"
  redeploy_on_update   = true

  depends_on = [dokploy_environment_variables.rustfs]
}

moved {
  from = dokploy_domain.futhub["minio"]
  to   = dokploy_domain.rustfs
}
