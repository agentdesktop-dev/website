# Local Kind smoke test

Run the production deployment locally before applying Terraform to GCP:

```sh
./deploy/kind/smoke-test.sh
```

The script creates a dedicated `agentdesktop-smoke` Kind cluster. It does not
use the current kubectl context and cannot modify the GKE cluster. By default it
builds the controller from the adjacent `../agentdesktop` checkout, loads every
image directly into Kind, and sets `imagePullPolicy: Never`. This separates
application failures from registry authentication and pull failures.

The test installs:

- the same PostgreSQL chart used by the GCP deployment, with the Kind
  `standard` StorageClass and cloud backups disabled;
- an in-cluster Dex issuer for OIDC discovery; and
- the local Agentdesktop controller chart through the same production
  post-renderer in Kind mode.

It verifies PostgreSQL TLS, data persistence across Pod replacement, OIDC
startup, both controller configuration files, container readiness, fleet TLS
and HTTP/2, and the loopback admin API. On failure it prints workload state,
events, Pod descriptions, and current and previous logs.

The cluster is deleted on exit. Retain a failed or successful cluster for
inspection with:

```sh
KEEP_CLUSTER=true ./deploy/kind/smoke-test.sh
```

If the Agentdesktop source is elsewhere:

```sh
AGENTDESKTOP_SOURCE=/path/to/agentdesktop ./deploy/kind/smoke-test.sh
```

To reuse an already-built `localhost/agentdesktop-controller:kind-smoke` image:

```sh
SKIP_CONTROLLER_BUILD=true ./deploy/kind/smoke-test.sh
```

The public GHCR image and chart are not required for this test. Test their
pullability separately with the same registry credentials that production GKE
will use; an unauthenticated `401` there will otherwise surface as
`ImagePullBackOff` before application startup.
