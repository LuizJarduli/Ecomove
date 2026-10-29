import 'package:equatable/equatable.dart';
import 'package:latlong2/latlong.dart';

enum TransportMode {
  walk('WALK', 'Caminhada', '10 pts/km · 140g CO₂/km'),
  bicycle('BICYCLE', 'Bicicleta', '8 pts/km · 140g CO₂/km'),
  publicTransit('PUBLIC_TRANSIT', 'Transporte Público', '4 pts/km · 100g CO₂/km'),
  carpool('CARPOOL', 'Carona Solidária', '5 pts/km · 70g CO₂/km');

  final String code;
  final String labelPt;
  final String rateLabelPt;

  const TransportMode(this.code, this.labelPt, this.rateLabelPt);

  static TransportMode fromCode(String code) {
    return TransportMode.values.firstWhere(
      (mode) => mode.code == code,
      orElse: () => TransportMode.walk,
    );
  }
}

enum TripStatus {
  recording('RECORDING', 'Gravando'),
  validated('VALIDATED', 'Validada'),
  pendingReview('PENDING_REVIEW', 'Em Análise pelo Gestor'),
  rejected('REJECTED', 'Rejeitada');

  final String code;
  final String labelPt;

  const TripStatus(this.code, this.labelPt);

  static TripStatus fromCode(String code) {
    return TripStatus.values.firstWhere(
      (status) => status.code == code,
      orElse: () => TripStatus.rejected,
    );
  }
}

class GpsCoordinate extends Equatable {
  final double latitude;
  final double longitude;
  final DateTime recordedAt;

  const GpsCoordinate({
    required this.latitude,
    required this.longitude,
    required this.recordedAt,
  });

  LatLng get latLng => LatLng(latitude, longitude);

  Map<String, dynamic> toJson() => {
        'latitude': latitude,
        'longitude': longitude,
        'recordedAt': recordedAt.toUtc().toIso8601String(),
      };

  factory GpsCoordinate.fromMap(Map<String, dynamic> map) {
    return GpsCoordinate(
      latitude: (map['latitude'] as num).toDouble(),
      longitude: (map['longitude'] as num).toDouble(),
      recordedAt: DateTime.parse(map['recordedAt'] as String),
    );
  }

  @override
  List<Object?> get props => [latitude, longitude, recordedAt];
}

class Trip extends Equatable {
  final String id;
  final String commuterId;
  final TransportMode transportMode;
  final TripStatus status;
  final List<LatLng> routePoints;
  final double distanceMeters;
  final int durationSeconds;
  final double avgSpeedKmh;
  final double peakSpeedKmh;
  final double co2SavedGrams;
  final int ecoPointsEarned;
  final String? rejectionReason;
  final DateTime startedAt;
  final DateTime endedAt;
  final DateTime createdAt;

  const Trip({
    required this.id,
    required this.commuterId,
    required this.transportMode,
    required this.status,
    required this.routePoints,
    required this.distanceMeters,
    required this.durationSeconds,
    required this.avgSpeedKmh,
    required this.peakSpeedKmh,
    required this.co2SavedGrams,
    required this.ecoPointsEarned,
    required this.rejectionReason,
    required this.startedAt,
    required this.endedAt,
    required this.createdAt,
  });

  factory Trip.fromJson(Map<String, dynamic> json) {
    final route = json['route'] as Map<String, dynamic>;
    final rawCoords = route['coordinates'] as List<dynamic>;
    final points = rawCoords.map((coord) {
      final pair = coord as List<dynamic>;
      final lng = (pair[0] as num).toDouble();
      final lat = (pair[1] as num).toDouble();
      return LatLng(lat, lng);
    }).toList();

    return Trip(
      id: json['id'] as String,
      commuterId: json['commuterId'] as String,
      transportMode: TransportMode.fromCode(json['transportMode'] as String),
      status: TripStatus.fromCode(json['status'] as String),
      routePoints: points,
      distanceMeters: (json['distanceMeters'] as num).toDouble(),
      durationSeconds: (json['durationSeconds'] as num).toInt(),
      avgSpeedKmh: (json['avgSpeedKmh'] as num).toDouble(),
      peakSpeedKmh: (json['peakSpeedKmh'] as num).toDouble(),
      co2SavedGrams: (json['co2SavedGrams'] as num).toDouble(),
      ecoPointsEarned: (json['ecoPointsEarned'] as num).toInt(),
      rejectionReason: json['rejectionReason'] as String?,
      startedAt: DateTime.parse(json['startedAt'] as String),
      endedAt: DateTime.parse(json['endedAt'] as String),
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }

  @override
  List<Object?> get props => [
        id,
        commuterId,
        transportMode,
        status,
        routePoints,
        distanceMeters,
        durationSeconds,
        avgSpeedKmh,
        peakSpeedKmh,
        co2SavedGrams,
        ecoPointsEarned,
        rejectionReason,
        startedAt,
        endedAt,
        createdAt,
      ];
}

class PointTransaction extends Equatable {
  final String id;
  final String commuterId;
  final int amount;
  final String reason;
  final String? tripId;
  final DateTime createdAt;

  const PointTransaction({
    required this.id,
    required this.commuterId,
    required this.amount,
    required this.reason,
    required this.tripId,
    required this.createdAt,
  });

  String get reasonLabelPt {
    switch (reason) {
      case 'TRIP_VALIDATED':
        return 'Trajeto Sustentável Validado';
      case 'HAZARD_APPROVED':
        return 'Ocorrência Urbana Aprovada';
      case 'REWARD_REDEEMED':
        return 'Resgate de Recompensa';
      case 'REDEMPTION_EXPIRED_REFUND':
        return 'Estorno de Voucher Expirado';
      default:
        return reason;
    }
  }

  factory PointTransaction.fromJson(Map<String, dynamic> json) {
    return PointTransaction(
      id: json['id'] as String,
      commuterId: json['commuterId'] as String,
      amount: (json['amount'] as num).toInt(),
      reason: json['reason'] as String,
      tripId: json['tripId'] as String?,
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }

  @override
  List<Object?> get props => [id, commuterId, amount, reason, tripId, createdAt];
}

class CarpoolSession extends Equatable {
  final String id;
  final String driverId;
  final String joinCode;
  final String status;
  final int participantCount;

  const CarpoolSession({
    required this.id,
    required this.driverId,
    required this.joinCode,
    required this.status,
    required this.participantCount,
  });

  factory CarpoolSession.fromJson(Map<String, dynamic> json) {
    final participants = json['participants'] as List<dynamic>? ?? const [];
    return CarpoolSession(
      id: json['id'] as String,
      driverId: json['driverId'] as String,
      joinCode: json['joinCode'] as String,
      status: json['status'] as String,
      participantCount: participants.length,
    );
  }

  @override
  List<Object?> get props => [id, driverId, joinCode, status, participantCount];
}

enum HazardCategory {
  sidewalkDamage('SIDEWALK_DAMAGE', 'Calçada Danificada'),
  bikeLaneObstruction('BIKE_LANE_OBSTRUCTION', 'Ciclovia Obstruída'),
  poorLighting('POOR_LIGHTING', 'Iluminação Precária'),
  busStopIssue('BUS_STOP_ISSUE', 'Ponto de Ônibus'),
  other('OTHER', 'Outros');

  final String code;
  final String labelPt;

  const HazardCategory(this.code, this.labelPt);

  static HazardCategory fromCode(String code) {
    return HazardCategory.values.firstWhere(
      (cat) => cat.code == code,
      orElse: () => HazardCategory.other,
    );
  }
}

class HazardReport extends Equatable {
  final String id;
  final HazardCategory category;
  final String description;
  final String status;
  final int endorsementCount;
  final LatLng location;

  const HazardReport({
    required this.id,
    required this.category,
    required this.description,
    required this.status,
    required this.endorsementCount,
    required this.location,
  });

  factory HazardReport.fromJson(Map<String, dynamic> json) {
    final loc = json['location'] as Map<String, dynamic>;
    final coords = loc['coordinates'] as List<dynamic>;
    return HazardReport(
      id: json['id'] as String,
      category: HazardCategory.fromCode(json['category'] as String),
      description: json['description'] as String,
      status: json['status'] as String,
      endorsementCount: (json['endorsementCount'] as num).toInt(),
      location: LatLng(
        (coords[1] as num).toDouble(),
        (coords[0] as num).toDouble(),
      ),
    );
  }

  @override
  List<Object?> get props => [
        id,
        category,
        description,
        status,
        endorsementCount,
        location,
      ];
}

class Reward extends Equatable {
  final String id;
  final String partnerName;
  final String partnerCategory;
  final String title;
  final String description;
  final int costEcoPoints;
  final int stock;

  const Reward({
    required this.id,
    required this.partnerName,
    required this.partnerCategory,
    required this.title,
    required this.description,
    required this.costEcoPoints,
    required this.stock,
  });

  factory Reward.fromJson(Map<String, dynamic> json) {
    return Reward(
      id: json['id'] as String,
      partnerName: json['partnerName'] as String,
      partnerCategory: json['partnerCategory'] as String,
      title: json['title'] as String,
      description: json['description'] as String,
      costEcoPoints: (json['costEcoPoints'] as num).toInt(),
      stock: (json['stock'] as num).toInt(),
    );
  }

  @override
  List<Object?> get props => [
        id,
        partnerName,
        partnerCategory,
        title,
        description,
        costEcoPoints,
        stock,
      ];
}

class Redemption extends Equatable {
  final String id;
  final String rewardTitle;
  final String partnerName;
  final String voucherCode;
  final int costEcoPoints;
  final String status;

  const Redemption({
    required this.id,
    required this.rewardTitle,
    required this.partnerName,
    required this.voucherCode,
    required this.costEcoPoints,
    required this.status,
  });

  factory Redemption.fromJson(Map<String, dynamic> json) {
    return Redemption(
      id: json['id'] as String,
      rewardTitle: json['rewardTitle'] as String,
      partnerName: json['partnerName'] as String,
      voucherCode: json['voucherCode'] as String,
      costEcoPoints: (json['costEcoPoints'] as num).toInt(),
      status: json['status'] as String,
    );
  }

  @override
  List<Object?> get props => [
        id,
        rewardTitle,
        partnerName,
        voucherCode,
        costEcoPoints,
        status,
      ];
}

class MobilityInsight extends Equatable {
  final String id;
  final String provider;
  final String summary;

  const MobilityInsight({
    required this.id,
    required this.provider,
    required this.summary,
  });

  factory MobilityInsight.fromJson(Map<String, dynamic> json) {
    return MobilityInsight(
      id: json['id'] as String,
      provider: json['provider'] as String,
      summary: json['summary'] as String,
    );
  }

  @override
  List<Object?> get props => [id, provider, summary];
}
