import { Bot, Code2, Laptop, Network, Route, ShieldCheck } from "lucide-react";
import styles from "./marketing.module.css";

export function RoutingDemo() {
  return (
    <figure className={styles.fleetDiagram} aria-labelledby="fleet-diagram-title">
      <div className={styles.fleetTopbar}>
        <strong id="fleet-diagram-title">Developer tools across the fleet</strong>
      </div>

      <div className={styles.fleetMap}>
        <div className={styles.deviceStack} aria-label="Employee devices">
          <div className={styles.deviceNode}>
            <span><Laptop size={21} aria-hidden="true" /></span>
            <div><strong>Device ENG-042</strong><p>Claude Code · installed</p></div>
            <i className={styles.fleetPulse} aria-hidden="true" />
          </div>
          <div className={styles.deviceNode}>
            <span><Laptop size={21} aria-hidden="true" /></span>
            <div><strong>Device FIN-018</strong><p>OpenCode · installed</p></div>
            <i className={styles.fleetPulse} aria-hidden="true" />
          </div>
          <div className={styles.deviceNode}>
            <span><Laptop size={21} aria-hidden="true" /></span>
            <div><strong>Device ENG-107</strong><p>Codex · installed</p></div>
            <i className={styles.fleetPulse} aria-hidden="true" />
          </div>
        </div>

        <div className={styles.desktopCore}>
          <span className={styles.coreIcon}><Route size={25} aria-hidden="true" /></span>
          <p>Device daemon</p>
          <strong>agentdesktop</strong>
          <small>Discovers and reconciles</small>
          <ul>
            <li><Bot size={17} aria-hidden="true" /><span>Developer tools</span><strong>versions</strong></li>
            <li><Network size={17} aria-hidden="true" /><span>MCP servers</span><strong>secret-free</strong></li>
            <li><Code2 size={17} aria-hidden="true" /><span>Skills</span><strong>front matter</strong></li>
          </ul>
          <i className={styles.policyPulse} aria-hidden="true" />
        </div>

        <div className={styles.policyNode}>
          <span><ShieldCheck size={25} aria-hidden="true" /></span>
          <p>Fleet management</p>
          <strong>controller</strong>
          <small>Enroll · configure · observe</small>
          <div>
            <span>Devices</span>
            <span>Config</span>
            <span>Events</span>
          </div>
          <code>config revision 12 → ENG-042</code>
        </div>
      </div>

      <figcaption>
        Each daemon reconciles local tool configuration. Managed devices receive
        desired configuration and short-lived gateway credentials from the controller.
      </figcaption>
    </figure>
  );
}