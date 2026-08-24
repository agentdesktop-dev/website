import {
  Activity,
  ArrowRight,
  BookOpen,
  Check,
  Code2,
  Eye,
  HardDrive,
  KeyRound,
  Menu,
  ScanSearch,
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
    statValue: "52%",
    statLine: "of employees run unapproved AI tools at work.",
    sourceHref:
      "https://www.okta.com/newsroom/articles/ai-agents-at-work-2026-agentic-enterprise-security/",
    sourceLabel: "Okta, AI Agents at Work 2026",
    sourceNum: 1,
    icon: Eye,
  },
  {
    category: "Security",
    question: "What can it reach?",
    body: "Agents authenticate with long-lived API keys sitting in plaintext config files — the exact credentials harvested at scale when supply-chain attacks weaponized AI tools on developer laptops.",
    statValue: "28M+",
    statLine: "hardcoded secrets leaked on GitHub in 2026.",
    sourceHref: "https://blog.gitguardian.com/the-state-of-secrets-sprawl-2026/",
    sourceLabel: "GitGuardian, State of Secrets Sprawl 2026",
    sourceNum: 2,
    icon: KeyRound,
  },
  {
    category: "Control",
    question: "Who decides how it behaves?",
    body: "Every harness has its own settings format, its own admin console, its own drift. Policy you set once should hold everywhere — on every device, in every tool, continuously reconciled.",
    statValue: "86%",
    statLine: "of enterprises don’t enforce AI identity policies.",
    sourceHref:
      "https://labs.cloudsecurityalliance.org/research/csa-research-note-ai-agent-governance-framework-gap-20260403/",
    sourceLabel: "Cloud Security Alliance, 2026",
    sourceNum: 3,
    icon: SlidersHorizontal,
  },
];

const capabilities = [
  {
    category: "Discovery",
    title: "Know what’s running.",
    body: "Build the agent inventory security frameworks now call for: every harness, version, MCP server, and skill across the fleet, attributed to a device and its signed-in user. Surface shadow AI without reading secrets — no command arguments, environment variables, headers, or skill bodies.",
    icon: ScanSearch,
  },
  {
    category: "Policy",
    title: "Decide how it behaves.",
    body: "Set policy once and enforce it everywhere. Managed settings are written into each tool’s native configuration format, previewed before anything is written, and continuously reconciled back to the desired state when devices drift.",
    icon: SlidersHorizontal,
  },
  {
    category: "Identity",
    title: "Control what it reaches.",
    body: "Treat agents as non-human identities with least-privilege access. Devices enroll through OIDC, bind to the signed-in user, and receive short-lived, just-in-time credentials for your inference gateway — no standing API keys on disk.",
    icon: KeyRound,
  },
  {
    category: "Observability",
    title: "See what it did.",
    body: "End-to-end session inspection across every harness. Opt-in session and tool-use events stream to the controller, attributed to user and device — the audit trail agent governance requires, collected only for the events you select.",
    icon: Activity,
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
          <a href="#what">What it does</a>
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
            <a href="#what">What it does</a>
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
            <h2>Three questions your current stack can&rsquo;t answer.</h2>
          </div>
          <div className={styles.pillarGrid}>
            {pillars.map((pillar) => (
              <article className={styles.pillar} key={pillar.category}>
                <span className={styles.pillarCategory}>
                  <pillar.icon size={16} aria-hidden="true" />
                  {pillar.category}
                </span>
                <h3>{pillar.question}</h3>
                <div className={styles.pillarStat}>
                  <strong>{pillar.statValue}</strong>
                  <p>
                    {pillar.statLine}{" "}
                    <a
                      className={styles.pillarRef}
                      href={pillar.sourceHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={pillar.sourceLabel}
                      aria-label={`Source: ${pillar.sourceLabel}`}
                    >
                      [{pillar.sourceNum}]
                    </a>
                  </p>
                </div>
                <p className={styles.pillarBody}>{pillar.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.whatSection} id="what">
          <div className={styles.whatHeading}>
            <h2>Answers with agentdesktop</h2>
            <p>
              An agent inventory, managed policy, non-human identity, and
              end-to-end observability &mdash; delivered by one daemon on the
              device and one controller for the fleet.
            </p>
          </div>
          <div className={styles.whatGrid}>
            <div className={styles.capStack}>
              {capabilities.map((cap) => (
                <article className={styles.capCard} key={cap.category}>
                  <span className={styles.capCategory}>
                    <cap.icon size={16} aria-hidden="true" />
                    {cap.category}
                  </span>
                  <h3>{cap.title}</h3>
                  <p>{cap.body}</p>
                </article>
              ))}
            </div>
            <div className={styles.whatVisual}>
              <img
                src="/images/device-details.png"
                alt="agentdesktop device details view showing discovered developer tools, MCP servers and skills, configuration state, recent agent activity, and enrollment identity"
                loading="lazy"
              />
            </div>
          </div>
        </section>

        <section className={styles.routingSection} id="routing">
          <div className={styles.sectionHeadingRow}>
            <h2>How agentdesktop works</h2>
            <p>
              A daemon on each device, a controller for the fleet, and a trust
              chain to your inference gateway.
            </p>
          </div>
          <div className={styles.processFlow} aria-label="agentdesktop processing flow">
            <div className={styles.processTrack} aria-hidden="true"><i /></div>
            <div className={styles.processStages}>
              <article>
                <h3>Reconcile on the device</h3>
                <p>The daemon discovers installed tools, MCP servers, and skills, then writes managed settings into each harness&rsquo;s native format &mdash; previewed with a dry run, and pulled back to the desired state when configs drift.</p>
                <dl className={styles.stageEvidence}>
                  <div><dt>Discovery</dt><dd>Tools · MCP · Skills</dd></div>
                  <div><dt>Preview</dt><dd>Dry-run</dd></div>
                  <div><dt>Drift</dt><dd>Reconciled</dd></div>
                </dl>
              </article>
              <article>
                <h3>Distribute from the controller</h3>
                <p>Devices enroll through OIDC with a device-bound key. The controller distributes versioned configuration, records fleet state for the management UI, and collects only the telemetry events you select.</p>
                <dl className={styles.stageEvidence}>
                  <div><dt>Enrollment</dt><dd>OIDC + device key</dd></div>
                  <div><dt>Configuration</dt><dd>Versioned</dd></div>
                  <div><dt>Telemetry</dt><dd>Opt-in</dd></div>
                </dl>
              </article>
              <article>
                <h3>Broker identity to the gateway</h3>
                <p>Agents request short-lived JWTs through the daemon; the gateway verifies them against the controller and attributes every request to a user and device. The API key never reaches the laptop.</p>
                <dl className={styles.stageEvidence}>
                  <div><dt>Credentials</dt><dd>Short-lived JWT</dd></div>
                  <div><dt>Verification</dt><dd>Controller JWKS</dd></div>
                  <div><dt>API keys</dt><dd>Never on device</dd></div>
                </dl>
              </article>
            </div>
          </div>
          <div className={styles.configPanel}>
            <div className={styles.configCopy}>
              <h3>One configuration, every tool.</h3>
              <p>
                A single declarative config manages the gateway connection,
                telemetry, and per-tool policy &mdash; reconciled into Claude
                Code, Claude Desktop, Codex, and OpenCode in their own formats.
              </p>
              <p className={styles.configNote}>
                Pairs with{" "}
                <a href="https://agentgateway.dev/" target="_blank" rel="noopener noreferrer">
                  agentgateway
                </a>{" "}
                &mdash; or any inference gateway that verifies JWTs.
              </p>
            </div>
            <pre className={styles.configCode}>
              <code>{`inferenceGateway:
  url: https://gateway.example.com
  authentication:
    type: controllerJwt
    audience: agentgateway

telemetry:
  events: [session.new, tool.use]

programs:
  claudeCode:
    permissions:
      defaultMode: plan
  claudeDesktop: {}
  codex: {}`}</code>
            </pre>
          </div>
        </section>

        <section className={styles.deployments} id="deployments">
          <div className={styles.deploymentIntro}>
            <h2>Start with one device, extend to your entire fleet.</h2>
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
