import {
  ArrowRight,
  BookOpen,
  Check,
  Code2,
  HardDrive,
  Menu,
  Server,
  X,
} from "lucide-react";
import { RoutingDemo } from "./routing-demo";
import styles from "./marketing.module.css";
import { siteConfig } from "./site-config";

const githubUrl = siteConfig.githubUrl;

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${siteConfig.url}/#website`,
      url: `${siteConfig.url}/`,
      name: siteConfig.name,
      description: siteConfig.description,
      inLanguage: siteConfig.language,
      sameAs: [siteConfig.githubUrl],
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${siteConfig.url}/#software`,
      name: siteConfig.name,
      url: `${siteConfig.url}/`,
      description: siteConfig.description,
      applicationCategory: "DeveloperApplication",
      applicationSubCategory: "AI developer tool management",
      isAccessibleForFree: true,
      featureList: [
        "AI developer tool discovery",
        "Secret-minimized MCP server and skill inventory",
        "Managed configuration reconciliation",
        "Device enrollment and fleet telemetry",
      ],
      isPartOf: { "@id": `${siteConfig.url}/#website` },
    },
  ],
};

function Brand() {
  return (
    <span className={styles.brand}>
      <span className={styles.brandMark} aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      <span>agentdesktop</span>
    </span>
  );
}

export default function Home() {
  return (
    <div className={styles.page}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <header className={styles.header}>
        <a className={styles.logoLink} href="#top" aria-label="agentdesktop home">
          <Brand />
        </a>
        <nav className={styles.desktopNav} aria-label="Main navigation">
          <a href="#why">Why</a>
          <a href="#routing">How it works</a>
          <a href="#deployments">Deployments</a>
        </nav>
        <div className={styles.headerActions}>
          <a
            className={styles.githubLink}
            href={githubUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Code2 size={17} aria-hidden="true" />
            GitHub
          </a>
          <a className={styles.headerCta} href="/docs/">
            Read the docs
            <ArrowRight size={16} aria-hidden="true" />
          </a>
        </div>
        <details className={styles.mobileNav}>
          <summary title="Open navigation">
            <Menu className={styles.menuOpen} size={22} aria-hidden="true" />
            <X className={styles.menuClose} size={22} aria-hidden="true" />
            <span className={styles.srOnly}>Toggle navigation</span>
          </summary>
          <nav aria-label="Mobile navigation">
            <a href="#why">Why agentdesktop</a>
            <a href="#routing">How it works</a>
            <a href="#deployments">Deployments</a>
            <a href="/docs/">Documentation</a>
            <a href={githubUrl}>GitHub</a>
          </nav>
        </details>
      </header>

      <main>
        <section className={styles.hero} id="top">
          <div className={styles.heroGrid}>
            <div className={styles.heroCopy}>
              <h1>agentdesktop</h1>
              <p className={styles.heroKicker}>Manage AI developer tools across your fleet.</p>
              <p className={styles.heroText}>
                Discover Claude Code, Claude Desktop, Codex, OpenCode, and VS Code
                across employee devices. Inventory versions, MCP servers, and
                skills, reconcile managed settings, and connect each device to
                your inference gateway.
              </p>
              <div className={styles.heroActions}>
                <a className={styles.primaryCta} href="/docs/">
                  <BookOpen size={18} aria-hidden="true" />
                  Get started
                  <ArrowRight size={17} aria-hidden="true" />
                </a>
                <a className={styles.textCta} href={githubUrl} target="_blank" rel="noopener noreferrer">
                  <Code2 size={18} aria-hidden="true" />
                  View source
                </a>
              </div>
            </div>

            <RoutingDemo />
          </div>
        </section>

        <section className={styles.problem} id="why">
          <div className={styles.problemGrid}>
            <div>
              <h2>MDM manages devices. AI tools need their own control plane.</h2>
              <p className={styles.problemIntro}>
                Each developer tool has its own configuration, extensions, MCP
                connections, and gateway settings. Platform teams need one view
                of what is installed and one way to manage it.
              </p>
            </div>
            <ul className={styles.questions}>
              <li><p>See installed tools and versions on each device.</p></li>
              <li><p>Inventory MCP servers and skill metadata without collecting their secrets or bodies.</p></li>
              <li><p>Distribute managed settings and a shared inference gateway.</p></li>
              <li><p>Associate devices with users and collect only the events you select.</p></li>
            </ul>
          </div>
        </section>

        <section className={styles.routingSection} id="routing">
          <div className={styles.sectionHeadingRow}>
            <h2>How agentdesktop works</h2>
            <p>
              The device daemon discovers installed tools and reconciles their
              configuration. In managed deployments, the controller distributes
              desired state, enrolls devices, and records opt-in telemetry.
            </p>
          </div>
          <div className={styles.processFlow} aria-label="agentdesktop processing flow">
            <div className={styles.processTrack} aria-hidden="true"><i /></div>
            <div className={styles.processStages}>
              <article>
                <h3>Discover</h3>
                <p>Find supported developer tools, versions, MCP servers, and skills on Linux, macOS, and Windows.</p>
              </article>
              <article>
                <h3>Configure</h3>
                <p>Preview changes, then reconcile each supported tool&apos;s managed settings and inference gateway URL.</p>
              </article>
              <article>
                <h3>Connect</h3>
                <p>Use direct OIDC or controller-issued JWTs for gateway access, and report selected events when enabled.</p>
              </article>
            </div>
          </div>
        </section>

        <section className={styles.deployments} id="deployments">
          <div className={styles.deploymentIntro}>
            <h2>Use a local file or manage a fleet</h2>
            <p>Run from YAML on one device, or enroll devices with a controller that distributes configuration and records fleet state.</p>
          </div>
          <div className={styles.deploymentGrid}>
            <article>
              <div className={styles.deploymentTopline}><HardDrive size={24} aria-hidden="true" /></div>
              <h3>Standalone</h3>
              <p>Run the daemon from local YAML without a controller or device identity. OIDC can authenticate directly to your gateway.</p>
              <ul>
                <li><Check size={16} aria-hidden="true" /> Local YAML configuration</li>
                <li><Check size={16} aria-hidden="true" /> Direct OIDC gateway auth</li>
                <li><Check size={16} aria-hidden="true" /> Dry-run before writing</li>
              </ul>
              <a href="/docs/getting-started/standalone/">Set up standalone mode <ArrowRight size={16} aria-hidden="true" /></a>
            </article>
            <article>
              <div className={styles.deploymentTopline}><Server size={24} aria-hidden="true" /></div>
              <h3>Controller-managed</h3>
              <p>Enroll devices, distribute desired configuration, issue short-lived gateway JWTs, and inspect fleet state in the management UI.</p>
              <ul>
                <li><Check size={16} aria-hidden="true" /> User + device enrollment</li>
                <li><Check size={16} aria-hidden="true" /> Versioned configuration</li>
                <li><Check size={16} aria-hidden="true" /> Opt-in session + tool events</li>
              </ul>
              <a href="/docs/getting-started/managed/">Set up managed mode <ArrowRight size={16} aria-hidden="true" /></a>
            </article>
          </div>
        </section>

        <section className={styles.githubCta} aria-labelledby="github-cta-heading">
          <div className={styles.githubCtaCopy}>
            <span><Code2 size={24} aria-hidden="true" /></span>
            <div>
              <p>Source code and roadmap</p>
              <h2 id="github-cta-heading">agentdesktop is developed on GitHub.</h2>
              <small>Browse the source, open an issue, or contribute.</small>
            </div>
          </div>
          <a href={githubUrl} target="_blank" rel="noopener noreferrer">
            View on GitHub
            <ArrowRight size={18} aria-hidden="true" />
          </a>
        </section>
      </main>

      <footer className={styles.footer}>
        <div>
          <Brand />
          <p>Manage AI developer tools and their configuration across employee devices.</p>
          <p className={styles.createdBy}>Created by <a href="https://solo.io/" target="_blank" rel="noopener noreferrer">Solo.io</a></p>
        </div>
        <nav aria-label="Footer navigation">
          <a href="/docs/">Documentation</a><a href={githubUrl}>GitHub</a><a href={`${githubUrl}/issues`}>Issues</a><a href="/docs/contributing/">Contribute</a>
        </nav>
      </footer>
    </div>
  );
}
