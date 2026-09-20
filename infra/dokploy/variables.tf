variable "dokploy_api_url" {
  description = "URL da API do Dokploy, por exemplo https://dokploy.example.com/api."
  type        = string
}

variable "dokploy_api_key" {
  description = "API key criada no Dokploy."
  type        = string
  sensitive   = true
}

variable "repository_url" {
  description = "URL Git clonável pelo servidor Dokploy."
  type        = string
}

variable "repository_branch" {
  description = "Branch publicada pelo Dokploy."
  type        = string
  default     = "main"
}

variable "dokploy_git_ssh_key_id" {
  description = "ID da chave SSH já cadastrada no Dokploy. Necessária para repositório Git privado."
  type        = string
  default     = ""
}

variable "project_name" {
  description = "Nome do projeto no Dokploy."
  type        = string
  default     = "futhub"
}

variable "admin_domain" {
  description = "Domínio público do painel administrativo."
  type        = string
}

variable "player_domain" {
  description = "Domínio público da aplicação do jogador."
  type        = string
}

variable "api_domain" {
  description = "Domínio público da API."
  type        = string
}

variable "minio_domain" {
  description = "Domínio público do endpoint S3."
  type        = string
}

variable "postgres_password" {
  description = "Senha do PostgreSQL."
  type        = string
  sensitive   = true

  validation {
    condition     = length(var.postgres_password) >= 24
    error_message = "postgres_password deve ter pelo menos 24 caracteres."
  }
}

variable "minio_root_user" {
  description = "Access key administrativa do RustFS."
  type        = string
  sensitive   = true
}

variable "minio_root_password" {
  description = "Secret key administrativa do RustFS."
  type        = string
  sensitive   = true

  validation {
    condition     = length(var.minio_root_password) >= 24
    error_message = "minio_root_password deve ter pelo menos 24 caracteres."
  }
}

variable "api_internal_token" {
  description = "Token Bearer usado pelo bot Discord para chamadas internas da API."
  type        = string
  sensitive   = true

  validation {
    condition     = length(var.api_internal_token) >= 32
    error_message = "api_internal_token deve ter pelo menos 32 caracteres."
  }
}

variable "admin_api_token" {
  description = "Token que protege a API administrativa e cifra as credenciais do assistente IA."
  type        = string
  sensitive   = true

  validation {
    condition     = length(var.admin_api_token) >= 32
    error_message = "admin_api_token deve ter pelo menos 32 caracteres."
  }
}

variable "admin_session_secret" {
  description = "Segredo de sessão do painel administrativo."
  type        = string
  sensitive   = true

  validation {
    condition     = length(var.admin_session_secret) >= 32
    error_message = "admin_session_secret deve ter pelo menos 32 caracteres."
  }
}

variable "player_session_secret" {
  description = "Segredo de sessão da aplicação do jogador."
  type        = string
  sensitive   = true

  validation {
    condition     = length(var.player_session_secret) >= 32
    error_message = "player_session_secret deve ter pelo menos 32 caracteres."
  }
}

variable "discord_client_id" {
  description = "Client ID OAuth2 do Discord."
  type        = string
}

variable "discord_client_secret" {
  description = "Client secret OAuth2 do Discord."
  type        = string
  sensitive   = true
}

variable "admin_discord_user_ids" {
  description = "IDs Discord autorizados no painel, no formato esperado pela aplicação."
  type        = string
}

variable "brave_search_api_key" {
  description = "Chave opcional do Brave Search para o assistente IA."
  type        = string
  sensitive   = true
  default     = ""
}

variable "thesportsdb_api_key" {
  description = "Chave opcional da TheSportsDB."
  type        = string
  sensitive   = true
  default     = ""
}
