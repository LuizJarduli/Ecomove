# EcoMove

EcoMove is a gamified sustainable urban mobility and citizen infrastructure reporting platform focused on the university campus surroundings (FACENS) and its connected urban corridors.

## Actors

**Commuter**:
A student, professor, staff member, or local resident who uses the mobile application to record sustainable journeys, report or endorse urban infrastructure hazards, and redeem rewards.
_Avoid_: User, mobile user, student, participant, citizen

**MobilityManager**:
A campus infrastructure coordinator or urban administrator who uses the web portal to analyze mobility dashboards, review borderline trips and hazard reports, and manage partners and rewards.
_Avoid_: Admin, administrator, manager, gestor

**Partner**:
A local business or campus establishment that provides redeemable benefits in exchange for points earned by commuters.
_Avoid_: Sponsor, merchant, store, vendor

## Mobility & Tracking

**Trip**:
A recorded geographical displacement made by a commuter from an origin to a destination, captured via periodic GPS coordinates, yielding an estimated $\text{CO}_2$ emission reduction, and evaluated through the validation lifecycle (`RECORDING` → `VALIDATED`, `PENDING_REVIEW`, or `REJECTED`).
_Avoid_: Route, journey, trajectory, displacement, deslocamento, trajeto, rota

**TransportMode**:
The method of transportation declared for a trip and verified against speed and geospatial rules (`WALK`, `BICYCLE`, `PUBLIC_TRANSIT`, or `CARPOOL`).
_Avoid_: Modal, vehicle type, meio de transporte

**CarpoolSession**:
A shared trip session initiated by a driver commuter via a short join code or QR code that links one or more passenger commuters to the same journey and requires mutual arrival within the campus zone to qualify as a valid carpool.
_Avoid_: Ride share, group trip, carona

**CampusZone**:
A defined geospatial polygon (such as the FACENS campus and its surrounding student hub) used to validate whether a trip or hazard report falls within the active operational area.
_Avoid_: Area of coverage, geofence, region

## Urban Maintenance (Zeladoria)

**HazardReport**:
A geo-tagged citizen submission documenting a physical urban mobility obstacle or infrastructure defect categorized under a `HazardCategory`, progressing through `PENDING`, `APPROVED`, `REJECTED`, and `RESOLVED`.
_Avoid_: Occurrence, issue, ticket, problem, complaint, ocorrência, problema

**HazardCategory**:
The standardized classification of an urban mobility obstacle (`SIDEWALK_DAMAGE`, `BIKE_LANE_OBSTRUCTION`, `POOR_LIGHTING`, `BUS_STOP_ISSUE`, or `OTHER`).
_Avoid_: Issue type, problem type, tag

**HazardEndorsement**:
A commuter's confirmation (upvote) of an existing nearby hazard report within 30 meters rather than creating a duplicate, increasing the report's priority score for mobility managers.
_Avoid_: Duplicate report, like, vote

## Gamification & Economy

**EcoPoints**:
The virtual currency credited to a commuter's balance upon validation of a sustainable trip or approval of a hazard report, and debited when redeeming a reward.
_Avoid_: Coins, credits, score, points, moedas, créditos

**PointTransaction**:
An immutable ledger entry recording a credit, debit, or expiration refund of points for a commuter, linked to its originating cause (a validated trip, an approved hazard report, or a reward redemption).
_Avoid_: Wallet history, point log, balance change

**Reward**:
A specific benefit, discount, or item offered by a partner that a commuter can claim for a defined cost in points while inventory is available.
_Avoid_: Benefit, prize, offer, coupon, benefício

**Redemption**:
A commuter's claim of a reward (`ACTIVE`, `USED`, or `EXPIRED`), which deducts points, reserves one unit of stock, and issues a single-use verification voucher code that expires and auto-refunds if unused within 7 days.
_Avoid_: Purchase, exchange, order, troca

## Intelligence & Analytics

**MobilityInsight**:
An AI-generated diagnostic or recommendation synthesized from aggregated geospatial trips and hazard reports for mobility managers, or a personalized sustainability nudge delivered to a commuter.
_Avoid_: AI report, prediction, prompt output
