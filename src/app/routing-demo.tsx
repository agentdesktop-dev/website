import { Bot, Check, Laptop, Network, ShieldCheck } from "lucide-react";
import styles from "./marketing.module.css";

const devices = [
  { name: "ENG-042", tool: "Claude Code" },
  { name: "FIN-018", tool: "OpenCode" },
  { name: "ENG-107", tool: "Codex" },
];

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
              <th>Detected tool</th>
              <th>Configuration</th>
              <th>Gateway</th>
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
                <td data-label="Detected tool">
                  <span className={styles.toolIdentity}><Bot size={17} aria-hidden="true" />{device.tool}</span>
                </td>
                <td data-label="Configuration">
                  <span className={styles.syncedState}><Check size={15} aria-hidden="true" />Revision 12</span>
                </td>
                <td data-label="Gateway">
                  <span className={styles.gatewayState}><i aria-hidden="true" />Connected</span>
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
            <span><Check size={15} aria-hidden="true" />3 devices synced</span>
            <span><Network size={15} aria-hidden="true" />Gateway configured</span>
            <span><Bot size={15} aria-hidden="true" />Selected events only</span>
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
