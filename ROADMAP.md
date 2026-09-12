# Intellifusion — Roadmap

## What is Demoable Now (MVP)

- Offline field observation capture (mobile) with photo + geo-tag / beacon-ID
- On-device risk scoring (edge model, zero network dependency)
- Store-and-forward sync queue with measurable sync-success KPI
- Cloud-side risk enrichment with explainability output (feature contributions)
- Suggested corrective action per flagged observation (rule-based)
- Role-based REST API (inspector / mine official / corporate / regulator)
- Append-only hash-chained audit trail with verification endpoint
- Role-based dashboard (map/heatmap, Risk Cards, KPI panel, closure flow)
- OCR proof-of-concept (English + Hindi) with human-review queue for low-confidence items
- Simulated tamper-evidence demo via hash-chain verify endpoint

---

## Phase 2 / Scale-Up (Deferred)

### Infrastructure
- **Kafka event streaming** — replace direct API calls with event-driven architecture for high-throughput mine environments
- **TimescaleDB** — dedicated sensor time-series pipeline for IoT sensor data (gas levels, vibration, equipment telemetry)
- **Real object store (S3/GCS)** — replace local filesystem photo storage
- **WebSocket / SSE** — real-time dashboard push instead of polling
- **Separate enrichment microservice** — extract cloud enrichment into its own deployable service
- **JWT refresh token rotation + key rotation** — production-grade auth

### Field / Mobile
- **Real UWB/BLE hardware mesh** — replace simulated beacon IDs with actual underground positioning hardware
- **Native push notifications** — alert managers on new high-risk observations without polling
- **Expo bare workflow / native modules** — if any native dependency proves impossible in managed Expo

### Intelligence
- **Multi-Agent RAG Statutory Auditor** — full pipeline:
  - Document classifier
  - Extractor
  - Violation matcher against DGMS / Mines Act / CIL circulars
  - Risk predictor with citation-backed findings
  - Production-scale statutory knowledge base ingestion
- **Contractor Trust & Performance Graph** — model contractors as nodes:
  - Historical violation density
  - Open observation counts
  - Geo-tagged activity patterns
  - "Deployment risk" score before assigning crew to high-risk zones
- **Full SHAP explainability** — replace path-length-delta approximation with proper SHAP values
- **Online learning** — edge model updates as new labeled observations accumulate

### Compliance & Governance
- **Real Hyperledger Fabric blockchain** — replace hash-chain simulation with a production-grade distributed ledger
- **DGMS portal integration** — automated regulatory report submission
- **ERP / DigiCOAL integration** — bidirectional data sync with existing Coal India systems

### Language & Accessibility
- **Full multi-language OCR coverage** — expand beyond English + Hindi to all scheduled languages
- **Multilingual conversational query interface** — natural-language queries over observation data ("show open high-risk observations in Area X this week")
- **Voice-to-text observation logging** — for field conditions where typing is impractical

### Analytics
- **Predictive risk analytics** — anticipate high-risk periods/zones before incidents occur
- **Contractor performance benchmarking** — cross-mine comparison
- **Regulatory compliance score trending** — month-over-month compliance health per site

---

*Last updated: Phase 0 - pre-code*
