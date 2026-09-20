output "project_id" {
  value = dokploy_project.futhub.id
}

output "application_ids" {
  value = merge(
    { for name, application in dokploy_application.futhub : name => application.id },
    { rustfs = dokploy_application.rustfs.id },
  )
}

output "database_id" {
  value = dokploy_database.postgres.id
}

output "domains" {
  value = merge(
    { for name, domain in dokploy_domain.futhub : name => domain.host },
    { rustfs = dokploy_domain.rustfs.host },
  )
}
