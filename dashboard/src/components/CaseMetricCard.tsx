import React, { useState, useEffect, useRef } from 'react';

const componentStyles = `
.caseMetricCard {
    container-type: inline-size;
}

.caseMetricLayout[data-image-side="right"] .caseMetricPreview {
    order: 2;
}

.caseMetricLayout[data-image-side="right"] .caseMetricResults {
    order: 1;
}

@container (max-width: 560px) {
    .caseMetricLayout {
        grid-template-columns: 1fr !important;
    }

    .caseMetricLayout[data-image-side="right"] .caseMetricPreview,
    .caseMetricLayout[data-image-side="right"] .caseMetricResults {
        order: initial !important;
    }
}

/* Entrance reveal */
.cm-armed .cm-item {
    opacity: 0;
    transform: translateY(12px);
    will-change: opacity, transform;
}

.cm-armed.cm-inview .cm-item {
    opacity: 1;
    transform: none;
    transition:
        opacity 0.6s cubic-bezier(0.22, 0.7, 0.2, 1),
        transform 0.6s cubic-bezier(0.22, 0.7, 0.2, 1);
    transition-delay: calc(var(--cm-i, 0) * 65ms);
}

/* Light sweep across the media on hover */
.cm-shine::after {
    content: "";
    position: absolute;
    inset: 0;
    z-index: 3;
    pointer-events: none;
    background: linear-gradient(
        105deg,
        transparent 32%,
        rgba(255, 255, 255, 0.45) 47%,
        rgba(255, 255, 255, 0.2) 54%,
        transparent 68%
    );
    transform: translateX(-130%);
}

.cm-hoverable:hover .cm-shine::after {
    transform: translateX(130%);
    transition: transform 0.9s cubic-bezier(0.4, 0.1, 0.2, 1);
}

/* Progress sheen */
.cm-progressFill {
    position: relative;
    overflow: hidden;
}

.cm-progressFill::after {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(
        90deg,
        transparent,
        rgba(255, 255, 255, 0.75),
        transparent
    );
    transform: translateX(-100%);
    animation: cmProgressSheen 2.4s ease-in-out 1.2s infinite;
}

@keyframes cmProgressSheen {
    0% {
        transform: translateX(-100%);
    }
    55%,
    100% {
        transform: translateX(340%);
    }
}

/* Growing CTA underline */
.cm-cta {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
}

.cm-cta::after {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    bottom: -2px;
    height: 1.5px;
    background: currentColor;
    transform: scaleX(0);
    transform-origin: left;
    transition: transform 0.3s cubic-bezier(0.2, 0.7, 0.2, 1);
}

.cm-hoverable:hover .cm-cta::after,
.cm-cta:hover::after {
    transform: scaleX(1);
}
`;

export interface CaseMetricCardProps {
  title?: string;
  description?: string;
  category?: string;
  projectImage?: string;
  clientName?: string;
  mainMetric?: string;
  metricLabel?: string;
  progressValue?: number;
  resultBadge?: string;
  stat1Value?: string;
  stat1Label?: string;
  stat2Value?: string;
  stat2Label?: string;
  stat3Value?: string;
  stat3Label?: string;
  ctaText?: string;
  onCtaClick?: () => void;
  className?: string;
}

export const CaseMetricCard: React.FC<CaseMetricCardProps> = ({
  title = "Gallery 4: Roof Fall & Support Prop Failure",
  description = "Immediate support failure detected near working face with elevated convergence rate.",
  category = "SAFETY CRITICAL",
  projectImage = "https://images.unsplash.com/photo-1578328819058-b69f3a3b0f6b?q=80&w=800&auto=format&fit=crop",
  clientName = "Inspector Rajesh Kumar &bull; Sector 4",
  mainMetric = "0.94",
  metricLabel = "AI Anomaly Risk Score",
  progressValue = 94,
  resultBadge = "AI DIAGNOSTIC RESULT",
  stat1Value = "Active",
  stat1Label = "Roof Fall Keyword",
  stat2Value = "0.85",
  stat2Label = "Zone Baseline Risk",
  stat3Value = "28 days",
  stat3Label = "Uninspected Duration",
  ctaText = "Initiate DGMS Protocol",
  onCtaClick,
  className = "",
}) => {
  const [hovered, setHovered] = useState(false);
  const [inView, setInView] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInView(true);
  }, []);

  return (
    <article
      ref={cardRef}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`caseMetricCard cm-hoverable cm-armed ${inView ? 'cm-inview' : ''} ${className}`}
      style={{
        position: 'relative',
        width: '100%',
        boxSizing: 'border-box',
        overflow: 'hidden',
        padding: 14,
        borderRadius: 18,
        border: `1px solid ${hovered ? '#18181B' : '#E4E4E7'}`,
        background: '#FFFFFF',
        color: '#09090B',
        boxShadow: hovered
          ? '0 16px 40px rgba(16, 24, 40, 0.08), 0 4px 12px rgba(0, 0, 0, 0.04)'
          : '0 2px 8px rgba(16, 24, 40, 0.04)',
        transform: hovered ? 'translateY(-2px)' : 'none',
        transition: 'transform 220ms cubic-bezier(.2,.8,.2,1), border-color 200ms ease, box-shadow 240ms ease',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      <style>{componentStyles}</style>

      <div
        className="caseMetricLayout"
        style={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 54fr) minmax(0, 46fr)',
          gap: 14,
          alignItems: 'stretch',
        }}
      >
        {/* Left: Preview & Story */}
        <section
          className="caseMetricPreview"
          style={{
            position: 'relative',
            zIndex: 1,
            minWidth: 0,
            display: 'grid',
            gap: 12,
            alignContent: 'start',
          }}
        >
          {/* Media Block in browser frame with shine */}
          <div
            className="cm-item cm-media cm-shine"
            style={{
              position: 'relative',
              width: '100%',
              overflow: 'hidden',
              borderRadius: 12,
              aspectRatio: '16 / 10',
              background: '#F4F4F5',
              border: '1px solid rgba(9, 9, 11, 0.08)',
              isolation: 'isolate',
              ['--cm-i' as any]: 0,
            }}
          >
            {/* Browser top chrome */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 22,
                zIndex: 2,
                display: 'grid',
                gridTemplateColumns: '34px 1fr',
                alignItems: 'center',
                gap: 7,
                padding: '0 8px',
                borderBottom: '1px solid rgba(9, 9, 11, 0.08)',
                background: 'rgba(255, 255, 255, 0.88)',
                backdropFilter: 'blur(8px)',
              }}
            >
              <div style={{ display: 'flex', gap: 3.5 }}>
                <span style={{ width: 4, height: 4, borderRadius: 999, background: '#71717A' }} />
                <span style={{ width: 4, height: 4, borderRadius: 999, background: '#A1A1AA' }} />
                <span style={{ width: 4, height: 4, borderRadius: 999, background: '#D4D4D8' }} />
              </div>
              <div
                style={{
                  width: '50%',
                  height: 5,
                  borderRadius: 999,
                  background: 'rgba(9, 9, 11, 0.08)',
                }}
              />
            </div>

            {/* Evidence Image */}
            <img
              src={projectImage}
              alt={title}
              style={{
                position: 'relative',
                zIndex: 1,
                width: '100%',
                height: '100%',
                display: 'block',
                objectFit: 'cover',
                objectPosition: 'center',
                paddingTop: 22,
                boxSizing: 'border-box',
                transform: hovered ? 'scale(1.03)' : 'scale(1)',
                transition: 'transform 240ms ease',
                filter: 'grayscale(100%) contrast(1.15)',
              }}
            />
          </div>

          {/* Content Block */}
          <div style={{ display: 'grid', gap: 6, alignContent: 'start' }}>
            <span
              className="cm-item"
              style={{
                ['--cm-i' as any]: 1,
                display: 'inline-flex',
                width: 'fit-content',
                color: '#71717A',
                fontSize: 10,
                lineHeight: 1,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              {category}
            </span>

            <div className="cm-item" style={{ ['--cm-i' as any]: 2, display: 'grid', gap: 4 }}>
              <h3
                style={{
                  margin: 0,
                  color: '#09090B',
                  fontSize: 17,
                  lineHeight: 1.2,
                  letterSpacing: '-0.025em',
                  fontWeight: 700,
                }}
              >
                {title}
              </h3>
              {description && (
                <p
                  style={{
                    margin: 0,
                    color: '#71717A',
                    fontSize: 12,
                    lineHeight: 1.45,
                  }}
                >
                  {description}
                </p>
              )}
            </div>

            {clientName && (
              <div
                className="cm-item"
                style={{
                  ['--cm-i' as any]: 3,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 11,
                  color: '#71717A',
                }}
              >
                <span>Reported by:</span>
                <span style={{ color: '#09090B', fontWeight: 600 }}>{clientName}</span>
              </div>
            )}

            {ctaText && (
              <div className="cm-item" style={{ ['--cm-i' as any]: 4, marginTop: 2 }}>
                <span
                  onClick={onCtaClick}
                  className="cm-cta"
                  style={{
                    color: hovered ? '#000000' : '#18181B',
                    fontSize: 12,
                    fontWeight: 700,
                    lineHeight: 1,
                  }}
                >
                  <span>{ctaText}</span>
                  <span
                    style={{
                      display: 'inline-flex',
                      transform: hovered ? 'translateX(3px)' : 'translateX(0)',
                      transition: 'transform 200ms ease',
                    }}
                  >
                    &rarr;
                  </span>
                </span>
              </div>
            )}
          </div>
        </section>

        {/* Right: Results & Metrics Panel */}
        <section
          className="caseMetricResults"
          style={{
            position: 'relative',
            zIndex: 1,
            minWidth: 0,
            display: 'grid',
            alignContent: 'center',
            gap: 10,
            padding: 16,
            borderRadius: 12,
            border: '1px solid rgba(9, 9, 11, 0.08)',
            background: '#FAFAFA',
          }}
        >
          {resultBadge && (
            <span
              className="cm-item"
              style={{
                ['--cm-i' as any]: 2,
                display: 'inline-flex',
                width: 'fit-content',
                color: '#71717A',
                fontSize: 9.5,
                lineHeight: 1,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              {resultBadge}
            </span>
          )}

          <div className="cm-item" style={{ ['--cm-i' as any]: 3, display: 'grid', gap: 3 }}>
            <div
              style={{
                color: '#09090B',
                fontSize: 38,
                lineHeight: 0.95,
                letterSpacing: '-0.035em',
                fontWeight: 800,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {mainMetric}
            </div>
            <p
              style={{
                margin: 0,
                color: '#71717A',
                fontSize: 12,
                lineHeight: 1.2,
                fontWeight: 600,
              }}
            >
              {metricLabel}
            </p>
          </div>

          {/* Progress Bar with traveling sheen */}
          <div
            className="cm-item"
            style={{
              ['--cm-i' as any]: 4,
              width: '100%',
              height: 4,
              borderRadius: 999,
              overflow: 'hidden',
              background: 'rgba(9, 9, 11, 0.08)',
              marginTop: 2,
            }}
          >
            <div
              className="cm-progressFill"
              style={{
                width: `${progressValue}%`,
                height: '100%',
                borderRadius: 999,
                background: '#09090B',
                transition: 'width 1.1s cubic-bezier(.2,.7,.2,1)',
              }}
            />
          </div>

          {/* 3 Stats with border dividers */}
          <dl style={{ display: 'grid', gap: 0, margin: '4px 0 0 0' }}>
            <div
              className="cm-item"
              style={{
                ['--cm-i' as any]: 5,
                display: 'grid',
                gridTemplateColumns: '70px minmax(0, 1fr)',
                alignItems: 'center',
                gap: 8,
                padding: '0 0 7px',
              }}
            >
              <dd
                style={{
                  margin: 0,
                  color: '#09090B',
                  fontSize: 12,
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                }}
              >
                {stat1Value}
              </dd>
              <dt
                style={{
                  margin: 0,
                  color: '#71717A',
                  fontSize: 11,
                  textAlign: 'right',
                }}
              >
                {stat1Label}
              </dt>
            </div>

            <div
              className="cm-item"
              style={{
                ['--cm-i' as any]: 6,
                display: 'grid',
                gridTemplateColumns: '70px minmax(0, 1fr)',
                alignItems: 'center',
                gap: 8,
                padding: '7px 0',
                borderTop: '1px solid rgba(9, 9, 11, 0.08)',
              }}
            >
              <dd
                style={{
                  margin: 0,
                  color: '#09090B',
                  fontSize: 12,
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                }}
              >
                {stat2Value}
              </dd>
              <dt
                style={{
                  margin: 0,
                  color: '#71717A',
                  fontSize: 11,
                  textAlign: 'right',
                }}
              >
                {stat2Label}
              </dt>
            </div>

            <div
              className="cm-item"
              style={{
                ['--cm-i' as any]: 7,
                display: 'grid',
                gridTemplateColumns: '70px minmax(0, 1fr)',
                alignItems: 'center',
                gap: 8,
                padding: '7px 0 0',
                borderTop: '1px solid rgba(9, 9, 11, 0.08)',
              }}
            >
              <dd
                style={{
                  margin: 0,
                  color: '#09090B',
                  fontSize: 12,
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                }}
              >
                {stat3Value}
              </dd>
              <dt
                style={{
                  margin: 0,
                  color: '#71717A',
                  fontSize: 11,
                  textAlign: 'right',
                }}
              >
                {stat3Label}
              </dt>
            </div>
          </dl>
        </section>
      </div>
    </article>
  );
};
