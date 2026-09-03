"use client";

import Image from "next/image";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  KeyRound,
  ScanSearch,
  SlidersHorizontal,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type { KeyboardEvent, MouseEvent } from "react";
import { useRef, useState } from "react";
import styles from "./marketing.module.css";

const capabilities = [
  {
    category: "Discovery",
    title: "Know what’s running.",
    body: "Build a live inventory of every harness, model, MCP server, and skill across the fleet, attributed to a device and the associated user. Know exactly what's running and where. Surface shadow AI without reading secrets: no command arguments, environment variables, headers, or skill bodies.",
    image: "/images/capability-discovery-glasswing-v2.png",
    imageAlt:
      "agentdesktop device inventory showing discovered developer tools, MCP servers, skills, and local models",
    imageLabel: "Device inventory",
    icon: ScanSearch,
  },
  {
    category: "Policy",
    title: "Decide how it behaves.",
    body: "Declare configuration centrally and agentdesktop applies it to every harness, previews every change, and continuously reconciles drift. Ensure consistent and uniform security posture across every installation.",
    image: "/images/capability-policy-glasswing-v2.png",
    imageAlt:
      "agentdesktop configuration builder showing managed gateway, telemetry, and developer tool policy",
    imageLabel: "Managed configuration",
    icon: SlidersHorizontal,
  },
  {
    category: "Identity",
    title: "Control what it reaches.",
    body: "Treat agents as non-human identities with least-privilege access. Devices enroll, bind to their user through OIDC, and receive short-lived, just-in-time credentials identifying the specific combination of device, user, and agent. Eliminate the blast radius and unpredictable attack vectors of long-lived secrets stored locally.",
    image: "/images/capability-identity-glasswing-v2.png",
    imageAlt:
      "agentdesktop controller identity controls showing OIDC enrollment and short-lived gateway credentials",
    imageLabel: "Identity controls",
    icon: KeyRound,
  },
  {
    category: "Observability",
    title: "See what it did.",
    body: "Opt-in session and tool-use telemetry, attributed to user and device, from only the events you select. Real-time awareness of agent activity.",
    image: "/images/capability-observability-glasswing-v2.png",
    imageAlt:
      "agentdesktop recent activity view showing attributed agent sessions and selected tool-use events",
    imageLabel: "Selected telemetry",
    icon: Activity,
  },
];

export function CapabilityCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [zoomed, setZoomed] = useState(false);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const visualRef = useRef<HTMLDivElement>(null);

  function selectCapability(index: number, nextDirection?: 1 | -1) {
    if (index === activeIndex) return;
    setDirection(nextDirection ?? (index > activeIndex ? 1 : -1));
    setActiveIndex(index);
    setZoomed(false);
    tabRefs.current[index]?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }

  function moveCarousel(step: 1 | -1) {
    const nextIndex =
      (activeIndex + step + capabilities.length) % capabilities.length;
    selectCapability(nextIndex, step);
  }

  function handleTabKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
      return;
    }
    event.preventDefault();
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? capabilities.length - 1
          : (index + (event.key === "ArrowRight" ? 1 : -1) +
              capabilities.length) %
            capabilities.length;
    selectCapability(nextIndex, event.key === "ArrowLeft" ? -1 : 1);
    tabRefs.current[nextIndex]?.focus();
  }

  function toggleZoom(event: MouseEvent<HTMLButtonElement>) {
    if (zoomed) {
      setZoomed(false);
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    const x = event.detail === 0 ? 50 : ((event.clientX - bounds.left) / bounds.width) * 100;
    const y = event.detail === 0 ? 50 : ((event.clientY - bounds.top) / bounds.height) * 100;
    visualRef.current?.style.setProperty("--zoom-x", `${x}%`);
    visualRef.current?.style.setProperty("--zoom-y", `${y}%`);
    setZoomed(true);
  }

  const activeCapability = capabilities[activeIndex];

  return (
    <div
      className={styles.whatCarousel}
      role="region"
      aria-label="agentdesktop capabilities"
      aria-roledescription="carousel"
    >
      <div
        className={styles.capTabs}
        role="tablist"
        aria-label="Choose a capability"
      >
        {capabilities.map((capability, index) => (
          <button
            className={`${styles.capTab} ${index === activeIndex ? styles.capTabActive : ""}`}
            id={`capability-tab-${index}`}
            type="button"
            role="tab"
            aria-controls="capability-panel"
            aria-selected={index === activeIndex}
            tabIndex={index === activeIndex ? 0 : -1}
            ref={(element) => {
              tabRefs.current[index] = element;
            }}
            key={capability.category}
            onClick={() => selectCapability(index)}
            onKeyDown={(event) => handleTabKeyDown(event, index)}
          >
            <capability.icon size={17} aria-hidden="true" />
            <span>{capability.category}</span>
          </button>
        ))}
      </div>

      <div
        className={styles.capStage}
        id="capability-panel"
        role="tabpanel"
        aria-labelledby={`capability-tab-${activeIndex}`}
      >
        <div className={styles.whatVisual} id="capability-visual">
          <div
            className={`${styles.capVisualFrame} ${direction === 1 ? styles.capVisualForward : styles.capVisualBackward} ${zoomed ? styles.capVisualFrameZoomed : ""}`}
            ref={visualRef}
          >
            {capabilities.map((capability, index) => (
              <figure
                className={`${styles.capSlide} ${index === activeIndex ? styles.capSlideActive : ""}`}
                aria-hidden={index !== activeIndex}
                aria-label={`${capability.category}: ${capability.imageLabel}`}
                key={capability.category}
              >
                <Image
                  src={capability.image}
                  alt={capability.imageAlt}
                  width={1600}
                  height={1000}
                  sizes="(max-width: 680px) calc(100vw - 40px), (max-width: 920px) calc(100vw - 64px), 68vw"
                  priority={index === 0}
                />
              </figure>
            ))}
            <button
              className={styles.capZoomButton}
              type="button"
              aria-label={zoomed ? "Reset screenshot zoom" : "Zoom screenshot"}
              aria-pressed={zoomed}
              title={zoomed ? "Reset zoom" : "Zoom screenshot"}
              onClick={toggleZoom}
              onKeyDown={(event) => {
                if (event.key === "Escape" && zoomed) {
                  event.preventDefault();
                  setZoomed(false);
                }
              }}
            >
              <span className={styles.capZoomIndicator}>
                {zoomed ? (
                  <ZoomOut size={18} aria-hidden="true" />
                ) : (
                  <ZoomIn size={18} aria-hidden="true" />
                )}
              </span>
            </button>
          </div>
          <p className={styles.capVisualLabel}>{activeCapability.imageLabel}</p>
        </div>

        <article className={styles.capCopy} aria-live="polite" aria-atomic="true">
          <span className={styles.capCounter}>
            {String(activeIndex + 1).padStart(2, "0")} / 04
          </span>
          <div>
            <span className={styles.capCategory}>
              <activeCapability.icon size={16} aria-hidden="true" />
              {activeCapability.category}
            </span>
            <h3>{activeCapability.title}</h3>
            <p>{activeCapability.body}</p>
          </div>
          <div className={styles.capControls}>
            <button
              type="button"
              aria-label={`Previous: ${capabilities[(activeIndex - 1 + capabilities.length) % capabilities.length].category}`}
              title="Previous capability"
              onClick={() => moveCarousel(-1)}
            >
              <ArrowLeft size={19} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label={`Next: ${capabilities[(activeIndex + 1) % capabilities.length].category}`}
              title="Next capability"
              onClick={() => moveCarousel(1)}
            >
              <ArrowRight size={19} aria-hidden="true" />
            </button>
          </div>
        </article>
      </div>
    </div>
  );
}