import 'package:equatable/equatable.dart';

class Commuter extends Equatable {
  final String id;
  final String email;
  final String? name;
  final bool isInstitutional;
  final int ecoPointsBalance;
  final double totalDistanceMeters;
  final double totalCo2SavedGrams;

  const Commuter({
    required this.id,
    required this.email,
    required this.name,
    required this.isInstitutional,
    required this.ecoPointsBalance,
    required this.totalDistanceMeters,
    required this.totalCo2SavedGrams,
  });

  factory Commuter.fromJson(Map<String, dynamic> json) {
    return Commuter(
      id: json['id'] as String,
      email: json['email'] as String,
      name: json['name'] as String?,
      isInstitutional: json['isInstitutional'] as bool? ?? false,
      ecoPointsBalance: (json['ecoPointsBalance'] as num?)?.toInt() ?? 0,
      totalDistanceMeters: (json['totalDistanceMeters'] as num?)?.toDouble() ?? 0,
      totalCo2SavedGrams: (json['totalCo2SavedGrams'] as num?)?.toDouble() ?? 0,
    );
  }

  @override
  List<Object?> get props => [
        id,
        email,
        name,
        isInstitutional,
        ecoPointsBalance,
        totalDistanceMeters,
        totalCo2SavedGrams,
      ];
}
