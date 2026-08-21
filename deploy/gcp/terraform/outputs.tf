output "cluster_name" {
  description = "GKE cluster name."
  value       = google_container_cluster.production.name
}

output "region" {
  description = "GKE control-plane region."
  value       = var.region
}

output "controller_ipv4_address" {
  description = "Reserved address for the controller's L4 load balancer."
  value       = google_compute_address.controller.address
}

output "controller_address_resource_name" {
  description = "Google Compute address resource name used by the GKE Service annotation."
  value       = google_compute_address.controller.name
}

output "controller_image_repository" {
  description = "Artifact Registry repository path for locally built controller images."
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.controller.repository_id}/agentdesktop-controller"
}

output "dns_records" {
  description = "Records to create with the existing DNS provider; Terraform does not manage the DNS zone."
  value = {
    controller = {
      type  = "A"
      name  = var.controller_hostname
      value = google_compute_address.controller.address
    }
    aliases = [for alias in var.controller_dns_aliases : {
      type  = "CNAME"
      name  = alias
      value = "${var.controller_hostname}."
    }]
  }
}

output "postgres_backup_bucket" {
  description = "GCS bucket used for PostgreSQL logical dumps and checksums."
  value       = google_storage_bucket.postgres_backups.name
}

output "postgres_backup_service_account" {
  description = "Google service account impersonated by the PostgreSQL backup Kubernetes service account."
  value       = google_service_account.postgres_backup.email
}

output "secret_names" {
  description = "Secret Manager containers populated by the deployment script without passing values through Terraform."
  value       = { for key, secret in google_secret_manager_secret.deployment : key => secret.secret_id }
}