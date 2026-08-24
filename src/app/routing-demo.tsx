import { Bot, Check, KeyRound, Laptop, RefreshCw, ShieldCheck } from "lucide-react";
import styles from "./marketing.module.css";

const devices = [
  {
    name: "ENG-042",
    tools: "Claude Code · Codex",
    mcp: "6 approved",
    identity: "Short-lived JWT",
    status: "Managed",
    statusStyle: "statusGood",
  },
  {
    name: "FIN-018",
    tools: "Claude Desktop",
    mcp: "2 unapproved",
    identity: "Short-lived JWT",
    status: "Drift detected",
    statusStyle: "statusWarn",
  },
  {
    name: "ENG-107",
    tools: "OpenCode · Claude Code",
    mcp: "4 approved",
    identity: "API key on disk",
    status: "Ungoverned",
    statusStyle: "statusBad",
  },
] as const;

export function RoutingDemo() {
  return (
    <figure className={styles.fleetDiagram} aria-labelledby="fleet-diagram-title">
      <div className={styles.fleetTopbar}>
        <div>
          <span aria-hidden="true" />
          <strong id="fleet-diagram-title">Fleet state</strong>
        </div>
        <small>3 enrolled devices</small>
      </div>

      <div className={styles.fleetConsole}>
        <table className={styles.fleetTable}>
          <thead>
            <tr>
              <th>Device</th>
              <th>Agent tools</th>
              <th>MCP servers</th>
              <th>Gateway identity</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {devices.map((device) => (
              <tr key={device.name}>
                <td data-label="Device">
                  <span className={styles.deviceIdentity}>
                    <i><Laptop size={18} aria-hidden="true" /></i>
                    <span><strong>{device.name}</strong><small>agentdesktop active</small></span>
                  </span>
                </td>
                <td data-label="Agent tools">
                  <span className={styles.toolIdentity}><Bot size={17} aria-hidden="true" />{device.tools}</span>
                </td>
                <td data-label="MCP servers">
                  <span className={styles.mcpState}>{device.mcp}</span>
                </td>
                <td data-label="Gateway identity">
                  <span className={styles.gatewayState}>
                    <KeyRound size={14} aria-hidden="true" />
                    {device.identity}
                  </span>
                </td>
                <td data-label="Status">
                  <span className={`${styles.statusPill} ${styles[device.statusStyle]}`}>
                    {device.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className={styles.fleetControl}>
          <div className={styles.controlIdentity}>
            <span><ShieldCheck size={22} aria-hidden="true" /></span>
            <div><small>Fleet controller</small><strong>Desired configuration: revision 12</strong></div>
          </div>
          <div className={styles.controlFacts}>
            <span><Check size={15} aria-hidden="true" />1 device in sync</span>
            <span><RefreshCw size={15} aria-hidden="true" />Reconciling drift</span>
            <span><KeyRound size={15} aria-hidden="true" />Rotating static key</span>
          </div>
        </div>
      </div>

      <figcaption>
        <ShieldCheck size={18} aria-hidden="true" />
        <span>Inventory omits MCP command arguments, environment variables, HTTP headers, and skill bodies.</span>
      </figcaption>
    </figure>
  );
}
