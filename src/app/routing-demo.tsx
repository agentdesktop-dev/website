import { Bot, Code2, Laptop, Network, Route, ShieldCheck } from "lucide-react";
import styles from "./marketing.module.css";

export function RoutingDemo() {
  return (
    <figure className={styles.fleetDiagram} aria-labelledby="fleet-diagram-title">
      <div className={styles.fleetTopbar}>
        <strong id="fleet-diagram-title">Agents on employee devices</strong>
      </div>

      <div className={styles.fleetMap}>
        <div className={styles.deviceStack} aria-label="Employee devices">
          <div className={styles.deviceNode}>
            <span><Laptop size={21} aria-hidden="true" /></span>
            <div><strong>Device ENG-042</strong><p>Claude · agent-7A21</p></div>
            <i className={styles.fleetPulse} aria-hidden="true" />
          </div>
          <div className={styles.deviceNode}>
            <span><Laptop size={21} aria-hidden="true" /></span>
            <div><strong>Device FIN-018</strong><p>OpenClaw · agent-C390</p></div>
            <i className={styles.fleetPulse} aria-hidden="true" />
          </div>
          <div className={styles.deviceNode}>
            <span><Laptop size={21} aria-hidden="true" /></span>
            <div><strong>Device ENG-107</strong><p>Codex · agent-F114</p></div>
            <i className={styles.fleetPulse} aria-hidden="true" />
          </div>
        </div>

        <div className={styles.desktopCore}>
          <span className={styles.coreIcon}><Route size={25} aria-hidden="true" /></span>
          <p>Identity and inventory</p>
          <strong>agentdesktop</strong>
          <small>Records agents and resources</small>
          <ul>
            <li><Bot size={17} aria-hidden="true" /><span>Agents</span><strong>instance ID</strong></li>
            <li><Network size={17} aria-hidden="true" /><span>MCP servers</span><strong>endpoint ID</strong></li>
            <li><Code2 size={17} aria-hidden="true" /><span>Skills</span><strong>source + version</strong></li>
          </ul>
          <i className={styles.policyPulse} aria-hidden="true" />
        </div>

        <div className={styles.policyNode}>
          <span><ShieldCheck size={25} aria-hidden="true" /></span>
          <p>Policy and routing</p>
          <strong>agentgateway</strong>
          <small>Allow · deny · route · audit</small>
          <div>
            <span>Models</span>
            <span>MCP</span>
            <span>A2A</span>
          </div>
          <code>agent-7A21 @ ENG-042 → github-mcp</code>
        </div>
      </div>

      <figcaption>
        agentdesktop records the agent, user, device, and destination for each
        flow. It rejects flows that cannot be attributed.
      </figcaption>
    </figure>
  );
}