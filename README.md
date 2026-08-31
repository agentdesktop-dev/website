# agentdesktop website

<!-- markdownlint-disable-next-line MD033 -->
<a href="https://agentdesktop.dev"><img src="./src/app/icon.svg" alt="agentdesktop" width="48"></a>

[Website](https://agentdesktop.dev) ·
[Blog](https://agentdesktop.dev/blog/) ·
[Documentation](https://agentdesktop.dev/docs/) ·
[Project source](https://github.com/agentdesktop-dev/agentdesktop)

---

**agentdesktop** discovers AI developer tools, inventories MCP servers and skills, reconciles managed configuration, and connects employee devices to a shared inference gateway. This repository contains the public website and documentation for the project.

The marketing site is a Next.js application under `src/app/`. The documentation and blog are Hugo sites under `docs/` and `blog/`, published at `/docs/` and `/blog/` on the same domain.

## Local development

Install the dependencies:

```bash
npm install
```

Run the marketing, documentation, and blog servers in separate terminals:

```bash
npm run dev       # http://localhost:3000
npm run dev:docs  # http://localhost:1313/docs/
npm run dev:blog  # http://localhost:1314/blog/
```

Next.js proxies `/docs/*` and `/blog/*` to their Hugo servers during local development, so the combined site is available at [http://localhost:3000](http://localhost:3000).

Create a draft blog post with:

```bash
npm run new:post -- posts/my-post.md
```

Posts live in `blog/content/posts/`. Set `draft: false` when a post is ready to publish. Use categories for broad sections and tags for specific topics; both generate archive pages and RSS feeds.

Blog builds generate a branded `1200x630` Open Graph card under `/blog/og/` for every post. Set `ogImage` and `ogImageAlt` in a post's front matter to use a custom social image instead.

The development and production build commands regenerate the downloadable GCP
deployment kit at `public/downloads/agentdesktop-gcp-deployment-kit.zip` from
an explicit source-file allowlist. Run `npm run build:deployment-kit` to rebuild
only that archive.

## Contributing

Run the full validation suite before opening a pull request:

```bash
npm run check
```

This runs ESLint, builds the Next.js site, and builds the Hugo documentation and blog. Product code and product-level issues belong in the [agentdesktop project repository](https://github.com/agentdesktop-dev/agentdesktop).

## Production deployment

Read the [production deployment guide](docs/content/operations/production.md)
for architecture, identity, PKI, controller, MDM, pilot, and operating
requirements. The complete GCP Terraform, Helm, image-build, PKI, Intune
bootstrap, backup, teardown, and local smoke-test assets are indexed under
[deploy/](deploy/README.md).

## Cloudflare Pages

Build one static artifact containing the Next.js marketing site at `/`, the Hugo documentation at `/docs/`, and the Hugo blog at `/blog/`:

```bash
npm run build:cloudflare
```

The artifact is written to `out/`. Preview it with Cloudflare's local runtime:

```bash
npm run preview:cloudflare
```

For Git integration, import this repository into Cloudflare Pages with these settings:

| Setting | Value |
| --- | --- |
| Production branch | `main` |
| Build command | `npm run build:cloudflare` |
| Build output directory | `out` |
| Environment variable | `HUGO_VERSION=0.163.3` |

For direct upload, authenticate Wrangler, create the `agentdesktop-website` Pages project once, then deploy:

```bash
npx wrangler login
npx wrangler pages project create agentdesktop-website --production-branch main
npm run deploy:cloudflare
```

After the first deployment, add `agentdesktop.dev` under the Pages project's **Custom domains** settings. The apex domain must be a zone in the same Cloudflare account.
