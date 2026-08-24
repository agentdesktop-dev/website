import {
  ArrowRight,
  BookOpen,
  Check,
  Code2,
  Eye,
  HardDrive,
  KeyRound,
  Menu,
  Server,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { RoutingDemo } from "./routing-demo";
import styles from "./marketing.module.css";
import { siteConfig } from "./site-config";

const githubUrl = siteConfig.githubUrl;

const pillars = [
  {
    category: "Visibility",
    question: "Do you know what’s running?",
    body: "Every laptop is quietly accumulating agent harnesses, MCP servers, and skills that no inventory captures. The first step analysts recommend for agent governance: build the inventory.",
    statValue: "52% vs 90%",
    statDetail:
      "of employees use unapproved AI tools, while 90% of executives believe they have full visibility.",
    statSource: "Okta · AI Agents at Work 2026",
    icon: Eye,
  },
  {
    category: "Security",
    question: "What can it reach?",
    body: "Agents authenticate with long-lived API keys sitting in plaintext config files — the exact credentials harvested at scale when supply-chain attacks weaponized AI tools on developer laptops.",
    statValue: "24,000+",
    statDetail:
      "secrets found in MCP configuration files on public GitHub alone. Thousands were still valid.",
    statSource: "GitGuardian · State of Secrets Sprawl 2026",
    icon: KeyRound,
  },
  {
    category: "Control",
    question: "Who decides how it behaves?",
    body: "Every harness has its own settings format, its own admin console, its own drift. Policy you set once should hold everywhere — on every device, in every tool, continuously reconciled.",
    statValue: "5 / 5 / 0",
    statDetail:
      "five tools, five configuration formats, zero shared policy. Per-vendor consoles can’t see each other.",
    statSource: "Claude · Codex · Copilot · Cursor · OpenCode",
    icon: SlidersHorizontal,
  },
];

const gaps = [
  {
    who: "MDM",
    does: "Manages the device: apps, disk encryption, OS policy.",
    miss: "Sees the app, not the agent. Can’t parse tool configs, inventory MCP servers, or reconcile drift.",
  },
  {
    who: "Vendor consoles",
    does: "Managed settings for one harness at a time.",
    miss: "One tool, one format, one silo. No cross-tool inventory, no device identity.",
  },
  {
    who: "AI gateways",
    does: "Govern model traffic: routing, quotas, logging.",
    miss: "Never touch the device. Developers still hand-edit configs and hold static keys.",
  },
  {
    who: "AI security tools",
    does: "Watch usage, block data egress, alert on risk.",
    miss: "Surveillance after the fact — they observe the fleet, they don’t manage it.",
  },
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
      applicationSubCategory: "AI agent governance",
      isAccessibleForFree: true,
      featureList: [
        "AI agent and developer tool discovery",
        "Secret-minimized MCP server and skill inventory",
        "Managed configuration reconciliation",
        "Short-lived gateway identity for devices",
        "Device enrollment and fleet telemetry",
      ],
      isPartOf: { "@id": `${siteConfig.url}/#website` },
    },
  ],
};

function Brand({ inverted = false }: { inverted?: boolean }) {
  return (
    <span
      className={`${styles.brandLogo} ${inverted ? styles.brandLogoInverted : ""}`}
      role="img"
      aria-label="agentdesktop"
    />
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
          <a href="#gaps">Why now</a>
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
            <a href="#gaps">Why now</a>
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
              <h1>
                Your largest agent runtime has the <em className={styles.heroEm}>least amount of governance.</em>
              </h1>
              <p className={styles.heroText}>
                AI agents run in agent harnesses on every developer and employee desktop in your organization. 
                These agents integrate models with production data, APIs, and endpoints while running outside of 
                existing governance controls. Agentdesktop brings visibility, security, and control to agents 
                where they actually run - on the desktop.
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
          <div className={styles.problemHeading}>
            <h2>
              Your platform no longer ends at the cluster. It extends to every
              desktop.
            </h2>
            <p className={styles.problemIntro}>
              Agent harnesses connect reasoning models to live production data
              through tools, MCP servers, and skills &mdash; from machines that
              sit outside every governance boundary you&rsquo;ve built. Three
              questions your current stack can&rsquo;t answer:
            </p>
          </div>
          <div className={styles.pillarGrid}>
            {pillars.map((pillar) => (
              <article className={styles.pillar} key={pillar.category}>
                <span className={styles.pillarCategory}>
                  <pillar.icon size={16} aria-hidden="true" />
                  {pillar.category}
                </span>
                <h3>{pillar.question}</h3>
                <p>{pillar.body}</p>
                <div className={styles.pillarStat}>
                  <strong>{pillar.statValue}</strong>
                  <p>{pillar.statDetail}</p>
                  <small>{pillar.statSource}</small>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.gapsSection} id="gaps">
          <div className={styles.gapsHeading}>
            <h2>
              Everything you run today covers a piece. Nothing governs the
              runtime itself.
            </h2>
          </div>
          <div className={styles.gapGrid}>
            {gaps.map((gap) => (
              <article className={styles.gapCard} key={gap.who}>
                <h3>{gap.who}</h3>
                <p>{gap.does}</p>
                <p className={styles.gapMiss}>
                  <X size={14} aria-hidden="true" />
                  {gap.miss}
                </p>
              </article>
            ))}
          </div>
          <div className={styles.gapVerdict}>
            <p>
              agentdesktop is the layer that governs the agent runtime &mdash;
              working with your MDM, your gateway, and your security stack,
              doing what none of them can.
            </p>
            <small>
              Aligned with CSA agent-governance guidance, the OWASP Agentic and
              MCP Top 10, and NIST AI agent standards work.
            </small>
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
              <div className={styles.deploymentTopline}><HardDrive size={24} aria-hidden="true" /></div>
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
              <div className={styles.deploymentTopline}><Server size={24} aria-hidden="true" /></div>
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
              <h2 id="github-cta-heading">Inspect the code and shape the roadmap.</h2>
              <small>100% open source, end to end. Browse the source, open an issue, or contribute.</small>
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
          <Brand inverted />
          <p>The open-source governance layer for AI agents on desktops.</p>
          <p className={styles.createdBy}>Created by <a href="https://solo.io/" target="_blank" rel="noopener noreferrer">Solo.io</a>, alongside <a href="https://agentgateway.dev/" target="_blank" rel="noopener noreferrer">agentgateway</a>.</p>
        </div>
        <nav aria-label="Footer navigation">
          <a href="/docs/">Documentation</a><a href={githubUrl}>GitHub</a><a href={`${githubUrl}/issues`}>Issues</a><a href="/docs/contributing/">Contribute</a>
        </nav>
      </footer>
    </div>
  );
}
