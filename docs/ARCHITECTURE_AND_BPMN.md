# EcoMove — BPMN Process Flows & System Architecture (UPX IV)

This document maps the core business processes and system architecture of **EcoMove**, fulfilling the **Modelagem de Processos de Negócios (BPMN)**, **Business Intelligence (BI)**, and **Inteligência Artificial (IA)** requirements of UPX IV.

---

## 1. System Architecture Overview

```mermaid
flowchart TB
    subgraph Clients["Client Applications"]
        Mobile["📱 Flutter Mobile App (Commuter)\nBLoC + Provider | flutter_map (OSM) | geolocator\nOffline SQLite Queue | Local AI Nudge Facade"]
        Web["💻 Next.js Web Portal (MobilityManager)\nApp Router | Tailwind + shadcn/ui | React-Leaflet\nBI Dashboards & Hazard/Reward Admin"]
    end

    subgraph CloudServices["External / BaaS (Free Tier)"]
        FirebaseAuth["🔐 Firebase Auth (Spark Plan)\nIdentity & @facens.br Detection"]
        MediaStore["🖼️ MediaStorageService\nCompressed WebP (<300KB)"]
        AIProviders["🤖 InsightEngine Providers\nCloud: Gemini API | Local: Ollama / On-Device"]
    end

    subgraph Backend["⚙️ Fastify REST API (Node.js + TypeScript)"]
        AuthMW["Firebase Token Verifier & Role Guard"]
        TripSvc["Trip & Carpool Validation Engine"]
        HazardSvc["HazardReport & 30m Deduplication Service"]
        LedgerSvc["EcoPoints Immutable Ledger & Redemption Service"]
        BISvc["BI Aggregator & InsightEngine Facade"]
    end

    subgraph Database["🗄️ PostgreSQL 16 + PostGIS 3.4"]
        SpatialTables["Spatial Tables (GiST Indexed)\n• CampusZone (Polygon)\n• Trip (LineString)\n• HazardReport (Point)"]
        RelationalTables["Domain & Ledger Tables\n• Commuter / MobilityManager\n• CarpoolSession\n• PointTransaction (Immutable)\n• Partner / Reward / Redemption"]
    end

    Mobile -->|ID Token + REST| AuthMW
    Web -->|ID Token + REST| AuthMW
    Mobile -.->|Sign In / Token| FirebaseAuth
    Web -.->|Sign In / Token| FirebaseAuth
    Mobile -->|Upload Compressed Photo| MediaStore

    AuthMW --> TripSvc
    AuthMW --> HazardSvc
    AuthMW --> LedgerSvc
    AuthMW --> BISvc

    TripSvc --> SpatialTables
    TripSvc --> LedgerSvc
    HazardSvc --> SpatialTables
    HazardSvc --> LedgerSvc
    LedgerSvc --> RelationalTables
    BISvc --> SpatialTables
    BISvc --> AIProviders
```

---

## 2. Process 1: Sustainable Trip Recording & Geospatial Validation

This process governs how a `Commuter` records a `Trip` (including optional `CarpoolSession` pairing) and how the backend validates the GPS trajectory against the `CampusZone` polygon and `TransportMode` speed thresholds before crediting `EcoPoints`.

```mermaid
sequenceDiagram
    autonumber
    actor Commuter as Commuter (Mobile App)
    participant Mobile as Flutter App (BLoC + SQLite)
    participant API as Fastify API (Trip Engine)
    participant PostGIS as PostgreSQL + PostGIS
    actor Manager as MobilityManager (Web Portal)

    Commuter->>Mobile: Select TransportMode (WALK, BICYCLE, PUBLIC_TRANSIT, CARPOOL)
    opt TransportMode == CARPOOL
        Commuter->>API: Create or Join CarpoolSession (4-digit code / QR)
        API-->>Mobile: CarpoolSession Linked (Driver + Passengers)
    end
    Commuter->>Mobile: Tap "Start Trip"
    loop Every 5 seconds / 10 meters
        Mobile->>Mobile: Capture GPS Point & buffer in local SQLite queue
    end
    Commuter->>Mobile: Tap "Finish Trip"
    Mobile->>API: POST /v1/trips (TransportMode, GPS Trace, CarpoolSessionId)
    API->>PostGIS: Build LineString, check ST_Length >= 300m & ST_Intersects(CampusZone)
    alt Outside CampusZone OR Distance < 300m OR Extreme Speed Violation
        API->>PostGIS: Save Trip as REJECTED
        API-->>Mobile: Trip REJECTED (Reason displayed to Commuter)
    else Clean Speed & Geofence (and Carpool peers inside CampusZone)
        API->>PostGIS: Save Trip as VALIDATED + Compute CO2 Saved (140g/km)
        API->>PostGIS: Append PointTransaction (Credit EcoPoints up to 100/day cap)
        API-->>Mobile: Trip VALIDATED (+EcoPoints & AI Sustainability Nudge)
    else Borderline Speed / Minor GPS Drift
        API->>PostGIS: Save Trip as PENDING_REVIEW
        API-->>Mobile: Trip PENDING_REVIEW (Awaiting Manager Check)
        Manager->>API: Review Trip on Web Portal (Approve or Reject)
        API->>PostGIS: Update Trip status & credit PointTransaction if VALIDATED
    end
```

---

## 3. Process 2: Urban Maintenance (`HazardReport`) & 30m Spatial Deduplication

This process maps citizen infrastructure reporting (*zeladoria urbana*), preventing duplicate reports within 30 meters via `HazardEndorsement` and rewarding `Commuter`s once a `MobilityManager` approves the report.

```mermaid
flowchart TD
    A(["Commuter spots urban hazard\n(Sidewalk, Bike Lane, Lighting, Bus Stop)"]) --> B["Open Hazard Report screen in Flutter App"]
    B --> C["Capture GPS Coordinate & select HazardCategory"]
    C --> D["API queries PostGIS:\nST_DWithin(existing active reports, 30m) & same category"]
    D --> E{"Existing active report\nwithin 30m?"}
    E -- "Yes" --> F["Prompt Commuter to endorse existing HazardReport"]
    F --> G["Create HazardEndorsement (+1 priority score)"]
    G --> H(["Priority elevated on MobilityManager Heatmap"])

    E -- "No" --> I["Compress photo (<300KB WebP) & submit description"]
    I --> J["Save HazardReport with status = PENDING"]
    J --> K["MobilityManager inspects report, photo & map pin in Web Portal"]
    K --> L{"Manager Decision"}
    L -- "Reject (Invalid / Spam)" --> M["Status = REJECTED\n(0 EcoPoints)"]
    L -- "Approve (Valid Hazard)" --> N["Status = APPROVED\nAppend PointTransaction (+25 EcoPoints to reporter)"]
    N --> O["Campus Infrastructure Team addresses physical issue"]
    O --> P(["MobilityManager marks status = RESOLVED"])
```

---

## 4. Process 3: `EcoPoints` Economy & `Reward` Redemption Lifecycle

This process ensures atomic stock reservation, single-use voucher generation, and automatic 7-day expiration refunds using an append-only `PointTransaction` ledger.

```mermaid
stateDiagram-v2
    [*] --> BrowseCatalog: Commuter views active Rewards
    BrowseCatalog --> ClaimReward: Commuter taps "Redeem" (EcoPoints >= Cost & Stock > 0)

    state ClaimReward {
        [*] --> AtomicTx: Begin DB Transaction
        AtomicTx --> DebitLedger: Insert PointTransaction (-Cost)
        DebitLedger --> DecrementStock: Decrement Reward.stock by 1
        DecrementStock --> IssueVoucher: Create Redemption (status = ACTIVE, expiresAt = +7d)
    }

    ClaimReward --> ActiveVoucher: Voucher Code & QR displayed in App
    ActiveVoucher --> UsedAtPartner: Commuter presents voucher at Partner & marks USED
    ActiveVoucher --> ExpiredRefund: Not used within 7 days (Scheduled Check)

    state ExpiredRefund {
        [*] --> RefundTx: Begin DB Transaction
        RefundTx --> MarkExpired: Set Redemption status = EXPIRED
        MarkExpired --> CreditLedger: Insert PointTransaction (+Cost Refund)
        CreditLedger --> RestoreStock: Increment Reward.stock by 1
    }

    UsedAtPartner --> [*]
    ExpiredRefund --> [*]
```
