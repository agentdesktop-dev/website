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
