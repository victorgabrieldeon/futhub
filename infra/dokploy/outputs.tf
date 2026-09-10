output "project_id" {
  value = dokploy_project.futhub.id
}

output "compose_id" {
  value = dokploy_compose.futhub.id
}

output "domains" {
  value = { for name, domain in dokploy_domain.futhub : name => domain.host }
}
