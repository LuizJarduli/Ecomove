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
