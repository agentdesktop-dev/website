import {
  ArrowRight,
  BookOpen,
  Check,
  Code2,
  HardDrive,
  Laptop,
  Menu,
  Network,
  Server,
  Settings2,
  ShieldCheck,
  X,
} from "lucide-react";
import { RoutingDemo } from "./routing-demo";
import styles from "./marketing.module.css";
import { siteConfig } from "./site-config";

const githubUrl = siteConfig.githubUrl;
const exampleDevices = [
  { name: "ENG-042", tool: "Claude Code" },
  { name: "FIN-018", tool: "OpenCode" },
  { name: "ENG-107", tool: "Codex" },
];

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
              <p className={styles.heroEyebrow}>
                <span aria-hidden="true" />
                Open source
                <i aria-hidden="true">/</i>
                Linux, macOS, and Windows
              </p>
              <h1>The open-source control plane for AI developer tools.</h1>
              <p className={styles.heroText}>
                See what is installed across your fleet, apply managed
                configuration, and connect each device to your inference gateway.
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
              <h2>Developers choose AI tools one device at a time. Platform teams manage them as a fleet.</h2>
              <p className={styles.problemIntro}>
                MDM manages the device, but each AI tool has its own settings,
                MCP connections, skills, and gateway configuration. Platform
                teams otherwise have to inspect and configure every tool separately.
              </p>
            </div>
            <div className={styles.driftComparison} aria-label="From separate tool settings to fleet configuration">
              <div className={styles.driftHeader}>
                <div><span>Device by device</span><strong>Each tool keeps its own configuration</strong></div>
                <Settings2 size={23} aria-hidden="true" />
              </div>
              <div className={styles.driftRows}>
                {exampleDevices.map((device) => (
                  <div className={styles.driftRow} key={device.name}>
                    <span><Laptop size={18} aria-hidden="true" /></span>
                    <div><strong>{device.name}</strong><small>{device.tool}</small></div>
                    <p><Settings2 size={15} aria-hidden="true" />Configured separately</p>
                  </div>
                ))}
              </div>
              <div className={styles.fleetResolution}>
                <div className={styles.resolutionHeading}>
                  <span><ShieldCheck size={22} aria-hidden="true" /></span>
                  <div><small>Managed as a fleet</small><strong>One configuration, distributed by the controller</strong></div>
                </div>
                <ul>
                  <li><Check size={15} aria-hidden="true" />Tool inventory</li>
                  <li><Check size={15} aria-hidden="true" />Managed settings</li>
                  <li><Network size={15} aria-hidden="true" />Gateway URL</li>
                  <li><Check size={15} aria-hidden="true" />Selected events</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.routingSection} id="routing">
          <div className={styles.sectionHeadingRow}>
            <h2>How agentdesktop works</h2>
            <p>
              The device daemon discovers installed tools and applies their
              managed configuration after a preview. The controller distributes
              the same configuration to enrolled devices.
            </p>
          </div>
          <div className={styles.processFlow} aria-label="agentdesktop processing flow">
            <div className={styles.processTrack} aria-hidden="true"><i /></div>
            <div className={styles.processStages}>
              <article>
                <h3>Discover</h3>
                <p>Find supported developer tools and versions, plus configured MCP servers and skills, on Linux, macOS, and Windows.</p>
                <dl className={styles.stageEvidence}>
                  <div><dt>Tools</dt><dd>Versions</dd></div>
                  <div><dt>MCP servers</dt><dd>Metadata</dd></div>
                  <div><dt>Skills</dt><dd>Front matter</dd></div>
                </dl>
              </article>
              <article>
                <h3>Configure</h3>
                <p>Preview changes, then write managed settings and the inference gateway URL for each supported tool.</p>
                <dl className={styles.stageEvidence}>
                  <div><dt>Managed settings</dt><dd>Preview</dd></div>
                  <div><dt>Gateway URL</dt><dd>Preview</dd></div>
                  <div><dt>Write</dt><dd>After review</dd></div>
                </dl>
              </article>
              <article>
                <h3>Connect</h3>
                <p>Authenticate gateway requests with direct OIDC or controller-issued JWTs. Telemetry stays off until you select events.</p>
                <dl className={styles.stageEvidence}>
                  <div><dt>Standalone</dt><dd>Direct OIDC</dd></div>
                  <div><dt>Managed</dt><dd>Short-lived JWT</dd></div>
                  <div><dt>Telemetry</dt><dd>Opt-in</dd></div>
                </dl>
              </article>
            </div>
          </div>
        </section>

        <section className={styles.deployments} id="deployments">
          <div className={styles.deploymentIntro}>
            <h2>Start with one device. Add a controller when you need a fleet.</h2>
            <p>The same daemon runs from local YAML or enrolls with a controller that distributes configuration and records fleet state.</p>
          </div>
          <div className={styles.deploymentGrid}>
            <article>
              <div className={styles.deploymentTopline}><HardDrive size={24} aria-hidden="true" /><span>01 / local</span></div>
              <h3>Standalone</h3>
              <p>Keep configuration local. Preview and apply changes from YAML without a controller or device identity, and authenticate directly to your gateway.</p>
              <ul>
                <li><Check size={16} aria-hidden="true" /> Local YAML configuration</li>
                <li><Check size={16} aria-hidden="true" /> Direct OIDC gateway auth</li>
                <li><Check size={16} aria-hidden="true" /> Dry-run before writing</li>
              </ul>
              <a href="/docs/getting-started/standalone/">Set up standalone mode <ArrowRight size={16} aria-hidden="true" /></a>
            </article>
            <div className={styles.deploymentBridge} aria-hidden="true">
              <span>Same daemon</span>
              <i><ArrowRight size={20} /></i>
            </div>
            <article>
              <div className={styles.deploymentTopline}><Server size={24} aria-hidden="true" /><span>02 / fleet</span></div>
              <h3>Controller-managed</h3>
              <p>Enroll devices and let the controller distribute versioned configuration. It also issues short-lived gateway JWTs and records fleet state for the management UI.</p>
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
              <p>Open source</p>
              <h2 id="github-cta-heading">Inspect the code and shape the roadmap.</h2>
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
          <p>The open-source control plane for AI developer tools across employee devices.</p>
          <p className={styles.createdBy}>Created by <a href="https://solo.io/" target="_blank" rel="noopener noreferrer">Solo.io</a></p>
        </div>
        <nav aria-label="Footer navigation">
          <a href="/docs/">Documentation</a><a href={githubUrl}>GitHub</a><a href={`${githubUrl}/issues`}>Issues</a><a href="/docs/contributing/">Contribute</a>
        </nav>
      </footer>
    </div>
  );
}
