locals {
  labels = merge({
    application = "agentdesktop"
    environment = "production"
    managed-by  = "terraform"
  }, var.labels)

  required_services = toset([
    "artifactregistry.googleapis.com",
    "compute.googleapis.com",
    "container.googleapis.com",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "secretmanager.googleapis.com",
    "storage.googleapis.com",
  ])

  node_iam_roles = toset([
    "roles/artifactregistry.reader",
    "roles/logging.logWriter",
    "roles/monitoring.metricWriter",
    "roles/monitoring.viewer",
    "roles/stackdriver.resourceMetadata.writer",
  ])

  secret_ids = toset([
    "controller-ca-key",
    "controller-ca",
    "controller-key",
    "controller-certificate",
    "device-ca-key",
    "device-ca",
    "gateway-jwt-key",
    "postgres-ca-key",
    "postgres-ca",
    "postgres-key",
    "postgres-certificate",
    "postgres-password",
  ])

  backup_bucket_name = substr("${var.project_id}-${var.name}-postgres-backups", 0, 63)
}

resource "google_project_service" "required" {
  for_each = local.required_services

  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}

resource "google_compute_network" "production" {
  name                    = "${var.name}-production"
  auto_create_subnetworks = false
  routing_mode            = "REGIONAL"

  depends_on = [google_project_service.required]
}

resource "google_compute_subnetwork" "gke" {
  name                     = "${var.name}-gke"
  region                   = var.region
  network                  = google_compute_network.production.id
  ip_cidr_range            = "10.10.0.0/20"
  private_ip_google_access = true

  secondary_ip_range {
    range_name    = "${var.name}-pods"
    ip_cidr_range = "10.20.0.0/16"
  }

  secondary_ip_range {
    range_name    = "${var.name}-services"
    ip_cidr_range = "10.30.0.0/20"
  }

  log_config {
    aggregation_interval = "INTERVAL_5_SEC"
    flow_sampling        = 0.5
    metadata             = "INCLUDE_ALL_METADATA"
  }
}

resource "google_compute_router" "gke" {
  name    = "${var.name}-gke"
  region  = var.region
  network = google_compute_network.production.id
}

resource "google_compute_router_nat" "gke" {
  name                               = "${var.name}-gke"
  region                             = var.region
  router                             = google_compute_router.gke.name
  nat_ip_allocate_option             = "AUTO_ONLY"
  source_subnetwork_ip_ranges_to_nat = "LIST_OF_SUBNETWORKS"

  subnetwork {
    name                    = google_compute_subnetwork.gke.id
    source_ip_ranges_to_nat = ["ALL_IP_RANGES"]
  }

  log_config {
    enable = true
    filter = "ERRORS_ONLY"
  }
}

resource "google_service_account" "gke_nodes" {
  project      = var.project_id
  account_id   = substr("${var.name}-gke-nodes", 0, 30)
  display_name = "agentdesktop GKE nodes"

  depends_on = [google_project_service.required]
}

resource "google_project_iam_member" "gke_nodes" {
  for_each = local.node_iam_roles

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.gke_nodes.email}"
}

resource "google_container_cluster" "production" {
  name     = var.name
  location = var.region

  network    = google_compute_network.production.id
  subnetwork = google_compute_subnetwork.gke.id

  remove_default_node_pool = true
  initial_node_count       = 1
  deletion_protection      = var.deletion_protection

  networking_mode   = "VPC_NATIVE"
  datapath_provider = "ADVANCED_DATAPATH"

  ip_allocation_policy {
    cluster_secondary_range_name  = "${var.name}-pods"
    services_secondary_range_name = "${var.name}-services"
  }

  private_cluster_config {
    enable_private_nodes    = true
    enable_private_endpoint = false
    master_ipv4_cidr_block  = "172.16.0.0/28"
  }

  master_authorized_networks_config {
    dynamic "cidr_blocks" {
      for_each = var.admin_cidr_blocks
      content {
        cidr_block   = cidr_blocks.value.cidr_block
        display_name = cidr_blocks.value.display_name
      }
    }
  }

  workload_identity_config {
    workload_pool = "${var.project_id}.svc.id.goog"
  }

  release_channel {
    channel = "REGULAR"
  }

  logging_config {
    enable_components = ["SYSTEM_COMPONENTS", "WORKLOADS", "APISERVER", "SCHEDULER", "CONTROLLER_MANAGER"]
  }

  monitoring_config {
    enable_components = ["SYSTEM_COMPONENTS", "APISERVER", "SCHEDULER", "CONTROLLER_MANAGER", "STORAGE", "HPA", "POD", "DAEMONSET", "DEPLOYMENT", "STATEFULSET", "CADVISOR", "KUBELET"]

    managed_prometheus {
      enabled = true
    }
  }

  vertical_pod_autoscaling {
    enabled = true
  }

  addons_config {
    gce_persistent_disk_csi_driver_config {
      enabled = true
    }
  }

  cost_management_config {
    enabled = true
  }

  dns_config {
    cluster_dns        = "CLOUD_DNS"
    cluster_dns_scope  = "CLUSTER_SCOPE"
    cluster_dns_domain = "cluster.local"
  }

  maintenance_policy {
    recurring_window {
      start_time = "2026-01-04T02:00:00Z"
      end_time   = "2026-01-04T06:00:00Z"
      recurrence = "FREQ=WEEKLY;BYDAY=SU"
    }
  }

  resource_labels = local.labels

  lifecycle {
    precondition {
      condition     = var.node_total_max_count >= var.node_total_min_count
      error_message = "node_total_max_count must be at least node_total_min_count."
    }
  }

  depends_on = [
    google_compute_router_nat.gke,
    google_project_service.required,
  ]
}

resource "google_container_node_pool" "production" {
  name     = "production"
  location = var.region
  cluster  = google_container_cluster.production.name

  initial_node_count = 1

  autoscaling {
    total_min_node_count = var.node_total_min_count
    total_max_node_count = var.node_total_max_count
    location_policy      = "BALANCED"
  }

  management {
    auto_repair  = true
    auto_upgrade = true
  }

  upgrade_settings {
    strategy        = "SURGE"
    max_surge       = 1
    max_unavailable = 0
  }

  node_config {
    machine_type    = var.node_machine_type
    disk_type       = "pd-balanced"
    disk_size_gb    = var.node_disk_size_gb
    image_type      = "COS_CONTAINERD"
    service_account = google_service_account.gke_nodes.email
    oauth_scopes    = ["https://www.googleapis.com/auth/cloud-platform"]

    labels = local.labels

    metadata = {
      disable-legacy-endpoints = "true"
    }

    shielded_instance_config {
      enable_integrity_monitoring = true
      enable_secure_boot          = true
    }

    workload_metadata_config {
      mode = "GKE_METADATA"
    }
  }

  depends_on = [google_project_iam_member.gke_nodes]
}

resource "google_compute_address" "controller" {
  name         = "${var.name}-controller"
  region       = var.region
  address_type = "EXTERNAL"
  network_tier = "PREMIUM"

  depends_on = [google_project_service.required]
}

resource "google_artifact_registry_repository" "controller" {
  project       = var.project_id
  location      = var.region
  repository_id = var.name
  description   = "Locally built agentdesktop controller images"
  format        = "DOCKER"
  labels        = local.labels

  cleanup_policy_dry_run = false

  cleanup_policies {
    id     = "keep-recent"
    action = "KEEP"

    most_recent_versions {
      keep_count = 10
    }
  }

  cleanup_policies {
    id     = "delete-old-untagged"
    action = "DELETE"

    condition {
      tag_state  = "UNTAGGED"
      older_than = "2592000s"
    }
  }

  depends_on = [google_project_service.required]
}

resource "google_storage_bucket" "postgres_backups" {
  name                        = local.backup_bucket_name
  project                     = var.project_id
  location                    = var.region
  storage_class               = "STANDARD"
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
  force_destroy               = false
  labels                      = local.labels

  versioning {
    enabled = true
  }

  soft_delete_policy {
    retention_duration_seconds = 604800
  }

  retention_policy {
    retention_period = var.backup_retention_days * 86400
    is_locked        = false
  }

  lifecycle_rule {
    condition {
      age = var.backup_retention_days + 30
    }
    action {
      type = "Delete"
    }
  }

  depends_on = [google_project_service.required]
}

resource "google_service_account" "postgres_backup" {
  project      = var.project_id
  account_id   = substr("${var.name}-postgres-backup", 0, 30)
  display_name = "agentdesktop PostgreSQL backup writer"

  depends_on = [google_project_service.required]
}

resource "google_storage_bucket_iam_member" "postgres_backup" {
  bucket = google_storage_bucket.postgres_backups.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.postgres_backup.email}"
}

resource "google_service_account_iam_member" "postgres_backup_workload_identity" {
  service_account_id = google_service_account.postgres_backup.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "serviceAccount:${var.project_id}.svc.id.goog[agentdesktop/postgres-backup]"
}

resource "google_secret_manager_secret" "deployment" {
  for_each = local.secret_ids

  project   = var.project_id
  secret_id = "${var.name}-${each.value}"
  labels    = local.labels

  replication {
    auto {}
  }

  depends_on = [google_project_service.required]
}