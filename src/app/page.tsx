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
      applicationCategory: "SecurityApplication",
      applicationSubCategory: "AI agent governance",
      isAccessibleForFree: true,
      featureList: [
        "AI agent discovery",
        "MCP server and skill inventory",
        "Agent and device attribution",
        "Policy routing and enforcement",
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
              <p className={styles.heroKicker}>Manage AI agents on employee devices.</p>
              <p className={styles.heroText}>
                agentdesktop finds Claude Code, Codex, OpenClaw, and other
                agents, along with their MCP servers, tools, and skills. It ties
                each action to an agent instance and device, then routes the
                traffic through centrally managed policy and inspection.
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
              <h2>AI agents are already running on employee devices.</h2>
              <p className={styles.problemIntro}>
                They can reach models, MCP servers, skills, and sensitive local
                files. Security teams need to know what is installed, who is
                using it, and where its traffic goes.
              </p>
            </div>
            <ul className={styles.questions}>
              <li><p>Attribute each call to an agent, user, and device.</p></li>
              <li><p>Inventory the MCP servers, tools, and skills available to each agent.</p></li>
              <li><p>Apply policy using verified user and device identity.</p></li>
              <li><p>Block traffic when identity or the policy route is unavailable.</p></li>
            </ul>
          </div>
        </section>

        <section className={styles.routingSection} id="routing">
          <div className={styles.sectionHeadingRow}>
            <h2>How agentdesktop works</h2>
            <p>
              agentdesktop inventories agents and resources on each device,
              attaches source identity to each flow, and sends the flow to
              your policy service for evaluation and inspection.
            </p>
          </div>
          <div className={styles.processFlow} aria-label="agentdesktop processing flow">
            <div className={styles.processTrack} aria-hidden="true"><i /></div>
            <div className={styles.processStages}>
              <article>
                <h3>Discover</h3>
                <p>Find installed agents, MCP server connections, tools, and skills on each supported device.</p>
              </article>
              <article>
                <h3>Identify</h3>
                <p>Bind each agent instance to its verified user, device, process scope, and discovered resource IDs.</p>
              </article>
              <article>
                <h3>Apply policy</h3>
                <p>Send source and destination context to the policy service. Reject flows whose source cannot be identified.</p>
              </article>
            </div>
          </div>
        </section>

        <section className={styles.deployments} id="deployments">
          <div className={styles.deploymentIntro}>
            <h2>Run policy locally or centrally</h2>
            <p>Individuals can keep policy on their laptop. Organizations can manage policy for employee devices from a central service.</p>
          </div>
          <div className={styles.deploymentGrid}>
            <article>
              <div className={styles.deploymentTopline}><HardDrive size={24} aria-hidden="true" /></div>
              <h3>Self-managed</h3>
              <p>agentdesktop runs with a local policy service on one laptop. Policy and credentials stay local.</p>
              <ul>
                <li><Check size={16} aria-hidden="true" /> User-owned policy</li>
                <li><Check size={16} aria-hidden="true" /> Local-only endpoints</li>
                <li><Check size={16} aria-hidden="true" /> Agents, MCP + skills</li>
              </ul>
              <a href="/docs/getting-started/standalone/">Set up local mode <ArrowRight size={16} aria-hidden="true" /></a>
            </article>
            <article>
              <div className={styles.deploymentTopline}><Server size={24} aria-hidden="true" /></div>
              <h3>Organization-managed</h3>
              <p>Enroll each user and device, then route agent, model, MCP, and tool traffic to a central policy service.</p>
              <ul>
                <li><Check size={16} aria-hidden="true" /> Browser-based enrollment</li>
                <li><Check size={16} aria-hidden="true" /> User + device identity</li>
                <li><Check size={16} aria-hidden="true" /> Fleet-wide policy context</li>
              </ul>
              <a href="/docs/getting-started/managed/">Explore managed mode <ArrowRight size={16} aria-hidden="true" /></a>
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
          <p>Manage AI agents and their traffic across employee devices.</p>
          <p className={styles.createdBy}>Created by <a href="https://solo.io/" target="_blank" rel="noopener noreferrer">Solo.io</a></p>
        </div>
        <nav aria-label="Footer navigation">
          <a href="/docs/">Documentation</a><a href={githubUrl}>GitHub</a><a href={`${githubUrl}/issues`}>Issues</a><a href={`${githubUrl}/blob/main/CONTRIBUTING.md`}>Contribute</a>
        </nav>
      </footer>
    </div>
  );
}
