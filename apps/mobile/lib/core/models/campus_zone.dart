import 'package:equatable/equatable.dart';
import 'package:latlong2/latlong.dart';

class CampusZone extends Equatable {
  final String id;
  final String name;
  final bool isActive;
  final List<LatLng> boundaryPoints;

  const CampusZone({
    required this.id,
    required this.name,
    required this.isActive,
    required this.boundaryPoints,
  });

  factory CampusZone.fromJson(Map<String, dynamic> json) {
    final boundary = json['boundary'] as Map<String, dynamic>;
    final rings = boundary['coordinates'] as List<dynamic>;
    final outerRing = rings.first as List<dynamic>;
    final points = outerRing.map((coord) {
      final pair = coord as List<dynamic>;
      final lng = (pair[0] as num).toDouble();
      final lat = (pair[1] as num).toDouble();
      return LatLng(lat, lng);
    }).toList();

    return CampusZone(
      id: json['id'] as String,
      name: json['name'] as String,
      isActive: json['isActive'] as bool? ?? true,
      boundaryPoints: points,
    );
  }

  LatLng get center {
    if (boundaryPoints.isEmpty) {
      return const LatLng(-23.4895, -47.4490);
    }
    final uniqueVertices =
        boundaryPoints.length > 1 && boundaryPoints.first == boundaryPoints.last
            ? boundaryPoints.sublist(0, boundaryPoints.length - 1)
            : boundaryPoints;
    double latSum = 0;
    double lngSum = 0;
    for (final point in uniqueVertices) {
      latSum += point.latitude;
      lngSum += point.longitude;
    }
    return LatLng(
      latSum / uniqueVertices.length,
      lngSum / uniqueVertices.length,
    );
  }

  @override
  List<Object?> get props => [id, name, isActive, boundaryPoints];
}
