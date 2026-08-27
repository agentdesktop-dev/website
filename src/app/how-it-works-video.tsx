"use client";

import { useEffect, useRef } from "react";
import styles from "./marketing.module.css";

export function HowItWorksVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let visible = false;

    const syncPlayback = () => {
      if (visible && !reducedMotion.matches) {
        void video.play().catch(() => undefined);
      } else {
        video.pause();
      }
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        syncPlayback();
      },
      { threshold: 0.35 },
    );

    observer.observe(video);
    reducedMotion.addEventListener("change", syncPlayback);

    return () => {
      observer.disconnect();
      reducedMotion.removeEventListener("change", syncPlayback);
    };
  }, []);

  return (
    <figure className={styles.howVideo} aria-labelledby="how-video-caption">
      <div className={styles.howVideoFrame}>
        <video
          ref={videoRef}
          muted
          playsInline
          controls
          preload="metadata"
          poster="/images/how-agentdesktop-works-poster.png"
        >
          <source src="/videos/how-agentdesktop-works.mp4" type="video/mp4" />
          <track
            kind="captions"
            src="/videos/how-agentdesktop-works.vtt"
            srcLang="en"
            label="English"
          />
          <a href="/videos/how-agentdesktop-works.mp4">
            Download the How agentdesktop works video
          </a>
        </video>
      </div>
      <figcaption id="how-video-caption">
        From device discovery to managed configuration and short-lived gateway
        identity. No developer-tool traffic passes through the controller.
      </figcaption>
    </figure>
  );
}