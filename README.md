# agentdesktop website

<!-- markdownlint-disable-next-line MD033 -->
<a href="https://agentdesktop.dev"><img src="./src/app/icon.svg" alt="agentdesktop" width="48"></a>

[Website](https://agentdesktop.dev) ·
[Documentation](https://agentdesktop.dev/docs/) ·
[Project source](https://github.com/agentdesktop-dev/agentdesktop)

---

**agentdesktop** discovers AI developer tools, inventories MCP servers and skills, reconciles managed configuration, and connects employee devices to a shared inference gateway. This repository contains the public website and documentation for the project.

The marketing site is a Next.js application under `src/app/`. The documentation is a Hugo site under `docs/` and is published at `/docs/` on the same domain.

## Local development

Install the dependencies:

```bash
npm install
```

Run the marketing and documentation servers in separate terminals:

```bash
npm run dev       # http://localhost:3000
npm run dev:docs  # http://localhost:1313/docs/
```

Next.js proxies `/docs/*` to Hugo during local development, so the combined site is available at [http://localhost:3000](http://localhost:3000).

## Contributing

Run the full validation suite before opening a pull request:

```bash
npm run check
```

This runs ESLint, builds the Next.js site, and builds the Hugo documentation. Product code and product-level issues belong in the [agentdesktop project repository](https://github.com/agentdesktop-dev/agentdesktop).

## Cloudflare Pages

Build one static artifact containing the Next.js marketing site at `/` and the Hugo documentation at `/docs/`:

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
