import { readdir, readFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import matter from "gray-matter";
import {
  ArrowRight,
  BookOpen,
  Check,
  Code2,
  Eye,
  HardDrive,
  KeyRound,
  Menu,
  MessageCircle,
  Megaphone,
  Server,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { CapabilityCarousel } from "./capability-carousel";
import { HowItWorksVideo } from "./how-it-works-video";
import { RoutingDemo } from "./routing-demo";
import styles from "./marketing.module.css";
import { siteConfig } from "./site-config";

const githubUrl = siteConfig.githubUrl;
const discordUrl = "https://discord.gg/uKX2FvCVpS";
const blogPostsDirectory = join(process.cwd(), "blog/content/posts");

type BlogAnnouncement = {
  href: string;
  publishedAt: number;
  title: string;
};

function isAnnouncementCategory(value: unknown) {
  const categories = Array.isArray(value) ? value : [value];

  return categories.some(
    (category) =>
      typeof category === "string" &&
      category.toLowerCase() === "announcement",
  );
}

function parsePostDate(value: unknown) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value !== "string" && typeof value !== "number") {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function getLatestAnnouncement(): Promise<BlogAnnouncement | null> {
  const filenames = await readdir(blogPostsDirectory);
  const now = Date.now();
  const announcements = await Promise.all(
    filenames
      .filter((filename) => filename.endsWith(".md") && filename !== "_index.md")
      .map(async (filename) => {
        const source = await readFile(join(blogPostsDirectory, filename), "utf8");
        const { data } = matter(source);
        const date = parsePostDate(data.date);

        if (
          data.draft === true ||
          !date ||
          date.getTime() > now ||
          typeof data.title !== "string" ||
          !isAnnouncementCategory(data.categories)
        ) {
          return null;
        }

        const customSlug = typeof data.slug === "string" ? data.slug.trim() : "";
        const slug = customSlug || basename(filename, extname(filename));
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, "0");

        return {
          href: `/blog/${year}/${month}/${slug}/`,
          publishedAt: date.getTime(),
          title: data.title,
        };
      }),
  );

  return announcements
    .filter((announcement): announcement is BlogAnnouncement => announcement !== null)
    .sort((first, second) => second.publishedAt - first.publishedAt)[0] ?? null;
}

const pillars = [
  {
    category: "Visibility",
    question: "Do you know what’s running?",
    body: "Every laptop is quietly accumulating agent harnesses, MCP servers, and skills that no inventory captures. You can't govern what you don't know about: a live inventory of agents is the foundation for all governance.",
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
    question: "What can it access?",
    body: "Agents authenticate with long-lived API keys sitting in plaintext config files, the exact credentials harvested at scale when supply-chain attacks weaponized AI tools on developer laptops.",
    statValue: "28M+",
    statLine: "hardcoded secrets leaked on GitHub in a single year.",
    sourceHref: "https://blog.gitguardian.com/the-state-of-secrets-sprawl-2026/",
    sourceLabel: "GitGuardian, State of Secrets Sprawl 2026",
    sourceNum: 2,
    icon: KeyRound,
  },
  {
    category: "Control",
    question: "Who decides how it behaves?",
    body: "Every harness has its own settings format, its own admin console, its own drift. Policy you set once should hold everywhere: on every device, in every tool, continuously reconciled.",
    statValue: "86%",
    statLine: "of enterprises don’t enforce AI identity policies.",
    sourceHref:
      "https://labs.cloudsecurityalliance.org/research/csa-research-note-ai-agent-governance-framework-gap-20260403/",
    sourceLabel: "Cloud Security Alliance, 2026",
    sourceNum: 3,
    icon: SlidersHorizontal,
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

export default async function Home() {
  const latestAnnouncement = await getLatestAnnouncement();

  return (
    <div className={`${styles.page} ${latestAnnouncement ? styles.pageWithAnnouncement : ""}`}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      {latestAnnouncement ? (
        <aside className={styles.announcementBanner} aria-label="Announcement">
          <a href={latestAnnouncement.href}>
            <Megaphone size={15} aria-hidden="true" />
            <span className={styles.announcementLabel}>New</span>
            <strong>{latestAnnouncement.title}</strong>
            <span className={styles.announcementDescription}>Read the latest announcement</span>
            <ArrowRight className={styles.announcementArrow} size={15} aria-hidden="true" />
          </a>
        </aside>
      ) : null}
      <header className={styles.header}>
        <a className={styles.logoLink} href="#top" aria-label="agentdesktop home">
          <Brand />
        </a>
        <nav className={styles.desktopNav} aria-label="Main navigation">
          <a href="#why">Why</a>
          <a href="#what">What it does</a>
          <a href="#routing">How it works</a>
          <a href="#deployments">Deployments</a>
          <a href="/blog/">Blog</a>
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
            <a href="/blog/">Blog</a>
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
                Production starts at the <em className={styles.heroEm}>desktop</em>
              </h1>
              <p className={styles.heroText}>
                Agentdesktop is an open-source visibility, policy, and management layer for the AI tools across your desktop fleet.
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
              end-to-end observability, delivered by one daemon on the device
              and one controller for the fleet.
            </p>
          </div>
          <CapabilityCarousel />
        </section>

        <section className={styles.routingSection} id="routing">
          <div className={styles.sectionHeadingRow}>
            <h2>How agentdesktop works</h2>
            <p>
              A daemon on each device, a controller for the fleet, and a trust
              chain to your inference gateway.
            </p>
          </div>
          <HowItWorksVideo />
          <div className={styles.configPanel}>
            <div className={styles.configCopy}>
              <h3>One configuration, every tool.</h3>
              <p>
                A single declarative config manages the gateway connection,
                telemetry, and per-tool policy, reconciled into Claude Code,
                Claude Desktop, Codex, and OpenCode in their own formats.
              </p>
              <p className={styles.configNote}>
                Pairs with{" "}
                <a href="https://agentgateway.dev/" target="_blank" rel="noopener noreferrer">
                  agentgateway
                </a>{" "}
                and works with any inference gateway that verifies JWTs.
              </p>
            </div>
            <pre className={styles.configCode}>
              <code>{`llmGateway:
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
              <h3>Standalone mode</h3>
              <p>Local governance on a single machine in minutes. Preview and apply changes from YAML without a controller or device identity, and authenticate directly to your gateway.</p>
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
              <h3>Fleet mode</h3>
              <p>Centralized management, policy, and visibility across every desktop in your organization. The controller distributes versioned configuration, issues short-lived gateway JWTs, and records fleet state for the management UI.</p>
              <ul>
                <li><Check size={16} aria-hidden="true" /> User + device enrollment</li>
                <li><Check size={16} aria-hidden="true" /> Versioned configuration</li>
                <li><Check size={16} aria-hidden="true" /> Opt-in session + tool events</li>
              </ul>
              <a href="/docs/getting-started/managed/">Set up fleet mode <ArrowRight size={16} aria-hidden="true" /></a>
            </article>
          </div>
        </section>

        <section className={styles.githubCta} aria-labelledby="github-cta-heading">
          <div className={styles.githubCtaCopy}>
            <span><Code2 size={24} aria-hidden="true" /></span>
            <div>
              <h2 id="github-cta-heading">Inspect the code and shape the roadmap.</h2>
              <small>100% open source, end to end. Browse the source, contribute, or join the community on Discord.</small>
            </div>
          </div>
          <div className={styles.githubCtaActions}>
            <a className={styles.githubCtaPrimary} href={githubUrl} target="_blank" rel="noopener noreferrer">
              View on GitHub
              <ArrowRight size={18} aria-hidden="true" />
            </a>
            <a className={styles.githubCtaSecondary} href={discordUrl} target="_blank" rel="noopener noreferrer">
              <MessageCircle size={18} aria-hidden="true" />
              Join Discord
            </a>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div>
          <Brand inverted />
          <p>An open-source visibility, policy, and management layer for the AI tools across your desktop fleet.</p>
          <p className={styles.createdBy}>Created by <a href="https://solo.io/" target="_blank" rel="noopener noreferrer">Solo.io</a>, alongside <a href="https://agentgateway.dev/" target="_blank" rel="noopener noreferrer">agentgateway</a>.</p>
        </div>
        <nav aria-label="Footer navigation">
          <a href="/blog/">Blog</a><a href="/docs/">Documentation</a><a href={githubUrl}>GitHub</a><a href={`${githubUrl}/issues`}>Issues</a><a href="/docs/contributing/">Contribute</a>
        </nav>
      </footer>
    </div>
  );
}
