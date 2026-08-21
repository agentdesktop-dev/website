variable "project_id" {
  description = "Google Cloud project that will own the production deployment."
  type        = string

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{4,28}[a-z0-9]$", var.project_id))
    error_message = "project_id must be a valid Google Cloud project ID."
  }
}

variable "region" {
  description = "Google Cloud region for GKE, networking, and PostgreSQL backups."
  type        = string
  default     = "us-central1"
}

variable "name" {
  description = "Short name used as a prefix for deployment resources."
  type        = string
  default     = "agentdesktop"

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{1,18}[a-z0-9]$", var.name))
    error_message = "name must contain 3-20 lowercase letters, numbers, or hyphens."
  }
}

variable "controller_hostname" {
  description = "Public fleet API hostname. DNS remains with your current provider."
  type        = string

  validation {
    condition = (
      length(var.controller_hostname) <= 253 &&
      can(regex("^[a-z0-9][a-z0-9.-]*[a-z0-9]$", var.controller_hostname)) &&
      strcontains(var.controller_hostname, ".") &&
      !strcontains(var.controller_hostname, "..")
    )
    error_message = "controller_hostname must be a lowercase fully qualified DNS name."
  }
}

variable "controller_dns_aliases" {
  description = "Optional hostnames that your DNS provider should CNAME to controller_hostname."
  type        = list(string)
  default     = []

  validation {
    condition = alltrue([
      for alias in var.controller_dns_aliases :
      length(alias) <= 253 &&
      can(regex("^[a-z0-9][a-z0-9.-]*[a-z0-9]$", alias)) &&
      strcontains(alias, ".") &&
      !strcontains(alias, "..")
    ])
    error_message = "Every controller DNS alias must be a lowercase fully qualified DNS name."
  }
}

variable "admin_cidr_blocks" {
  description = "Networks allowed to reach the public GKE control-plane endpoint."
  type = list(object({
    cidr_block   = string
    display_name = string
  }))

  validation {
    condition     = length(var.admin_cidr_blocks) > 0 && alltrue([for block in var.admin_cidr_blocks : can(cidrhost(block.cidr_block, 0))])
    error_message = "Provide at least one valid administrator CIDR block."
  }
}

variable "node_machine_type" {
  description = "Machine type for GKE worker nodes."
  type        = string
  default     = "e2-standard-4"
}

variable "node_total_min_count" {
  description = "Minimum worker count across the regional node pool."
  type        = number
  default     = 3

  validation {
    condition     = var.node_total_min_count >= 3
    error_message = "A production regional cluster requires at least three workers."
  }
}

variable "node_total_max_count" {
  description = "Maximum worker count across the regional node pool."
  type        = number
  default     = 6
}

variable "node_disk_size_gb" {
  description = "Boot disk size for each GKE worker."
  type        = number
  default     = 100
}

variable "deletion_protection" {
  description = "Protect the GKE cluster from accidental Terraform deletion."
  type        = bool
  default     = true
}

variable "backup_retention_days" {
  description = "Minimum retention period for PostgreSQL backup objects."
  type        = number
  default     = 30

  validation {
    condition     = var.backup_retention_days >= 7
    error_message = "Keep production PostgreSQL backups for at least seven days."
  }
}

variable "labels" {
  description = "Additional labels to add to supported Google Cloud resources."
  type        = map(string)
  default     = {}
}