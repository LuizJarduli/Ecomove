import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/campus_zone.dart';
import '../models/commuter.dart';
import '../models/trip.dart';

abstract class EcoMoveApiRepository {
  Future<Commuter> fetchMe(String idToken);
  Future<CampusZone> fetchActiveCampusZone(String idToken);
  Future<Trip> submitTrip({
    required String idToken,
    required TransportMode transportMode,
    required List<GpsCoordinate> coordinates,
    String? carpoolSessionId,
  });
  Future<List<Trip>> fetchMyTrips(String idToken);
  Future<List<PointTransaction>> fetchMyLedger(String idToken);
  Future<CarpoolSession> createCarpoolSession(String idToken);
  Future<CarpoolSession> joinCarpoolSession({
    required String idToken,
    required String joinCode,
  });
  Future<List<HazardReport>> fetchHazards(String idToken);
  Future<HazardReport> submitHazardReport({
    required String idToken,
    required HazardCategory category,
    required String description,
    required double latitude,
    required double longitude,
  });
  Future<HazardReport> endorseHazardReport({
    required String idToken,
    required String hazardId,
  });
  Future<List<Reward>> fetchRewards(String idToken);
  Future<Redemption> redeemReward({
    required String idToken,
    required String rewardId,
  });
  Future<List<Redemption>> fetchMyRedemptions(String idToken);
  Future<MobilityInsight> fetchCommuterNudge(String idToken);
}

class HttpEcoMoveApiRepository implements EcoMoveApiRepository {
  final String baseUrl;
  final http.Client _httpClient;

  HttpEcoMoveApiRepository({
    this.baseUrl = const String.fromEnvironment(
      'API_BASE_URL',
      defaultValue: 'http://localhost:3333',
    ),
    http.Client? httpClient,
  }) : _httpClient = httpClient ?? http.Client();

  @override
  Future<Commuter> fetchMe(String idToken) async {
    final response = await _httpClient.get(
      Uri.parse('$baseUrl/v1/me'),
      headers: {'authorization': 'Bearer $idToken'},
    );
    if (response.statusCode != 200) {
      throw Exception('Falha ao carregar perfil do usuário da mobilidade.');
    }
    return Commuter.fromJson(jsonDecode(response.body) as Map<String, dynamic>);
  }

  @override
  Future<CampusZone> fetchActiveCampusZone(String idToken) async {
    final response = await _httpClient.get(
      Uri.parse('$baseUrl/v1/campus-zones/active'),
      headers: {'authorization': 'Bearer $idToken'},
    );
    if (response.statusCode != 200) {
      throw Exception('Nenhuma zona de campus ativa encontrada.');
    }
    return CampusZone.fromJson(jsonDecode(response.body) as Map<String, dynamic>);
  }

  @override
  Future<Trip> submitTrip({
    required String idToken,
    required TransportMode transportMode,
    required List<GpsCoordinate> coordinates,
    String? carpoolSessionId,
  }) async {
    final response = await _httpClient.post(
      Uri.parse('$baseUrl/v1/trips'),
      headers: {
        'authorization': 'Bearer $idToken',
        'content-type': 'application/json',
      },
      body: jsonEncode({
        'transportMode': transportMode.code,
        'coordinates': coordinates.map((point) => point.toJson()).toList(),
        'carpoolSessionId': ?carpoolSessionId,
      }),
    );
    if (response.statusCode != 201) {
      throw Exception('Falha ao sincronizar trajeto com o servidor.');
    }
    return Trip.fromJson(jsonDecode(response.body) as Map<String, dynamic>);
  }

  @override
  Future<CarpoolSession> createCarpoolSession(String idToken) async {
    final response = await _httpClient.post(
      Uri.parse('$baseUrl/v1/carpool-sessions'),
      headers: {'authorization': 'Bearer $idToken'},
    );
    if (response.statusCode != 201) {
      throw Exception('Falha ao criar sessão de carona.');
    }
    return CarpoolSession.fromJson(
      jsonDecode(response.body) as Map<String, dynamic>,
    );
  }

  @override
  Future<CarpoolSession> joinCarpoolSession({
    required String idToken,
    required String joinCode,
  }) async {
    final response = await _httpClient.post(
      Uri.parse('$baseUrl/v1/carpool-sessions/join'),
      headers: {
        'authorization': 'Bearer $idToken',
        'content-type': 'application/json',
      },
      body: jsonEncode({'joinCode': joinCode}),
    );
    if (response.statusCode != 200) {
      throw Exception('Código de carona inválido ou sessão encerrada.');
    }
    return CarpoolSession.fromJson(
      jsonDecode(response.body) as Map<String, dynamic>,
    );
  }

  @override
  Future<List<Trip>> fetchMyTrips(String idToken) async {
    final response = await _httpClient.get(
      Uri.parse('$baseUrl/v1/trips/me'),
      headers: {'authorization': 'Bearer $idToken'},
    );
    if (response.statusCode != 200) {
      throw Exception('Falha ao carregar histórico de viagens.');
    }
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    final rawTrips = data['trips'] as List<dynamic>;
    return rawTrips
        .map((item) => Trip.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  @override
  Future<List<PointTransaction>> fetchMyLedger(String idToken) async {
    final response = await _httpClient.get(
      Uri.parse('$baseUrl/v1/ledger/me'),
      headers: {'authorization': 'Bearer $idToken'},
    );
    if (response.statusCode != 200) {
      throw Exception('Falha ao carregar extrato de EcoPoints.');
    }
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    final rawTransactions = data['transactions'] as List<dynamic>;
    return rawTransactions
        .map((item) => PointTransaction.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  @override
  Future<List<HazardReport>> fetchHazards(String idToken) async {
    final response = await _httpClient.get(
      Uri.parse('$baseUrl/v1/hazards'),
      headers: {'authorization': 'Bearer $idToken'},
    );
    if (response.statusCode != 200) {
      throw Exception('Falha ao carregar ocorrências de zeladoria.');
    }
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    final raw = data['hazards'] as List<dynamic>;
    return raw
        .map((item) => HazardReport.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  @override
  Future<HazardReport> submitHazardReport({
    required String idToken,
    required HazardCategory category,
    required String description,
    required double latitude,
    required double longitude,
  }) async {
    final response = await _httpClient.post(
      Uri.parse('$baseUrl/v1/hazards'),
      headers: {
        'authorization': 'Bearer $idToken',
        'content-type': 'application/json',
      },
      body: jsonEncode({
        'category': category.code,
        'description': description,
        'latitude': latitude,
        'longitude': longitude,
      }),
    );
    if (response.statusCode != 201) {
      throw Exception('Ocorrência próxima encontrada num raio de 30m.');
    }
    return HazardReport.fromJson(
      jsonDecode(response.body) as Map<String, dynamic>,
    );
  }

  @override
  Future<HazardReport> endorseHazardReport({
    required String idToken,
    required String hazardId,
  }) async {
    final response = await _httpClient.post(
      Uri.parse('$baseUrl/v1/hazards/$hazardId/endorse'),
      headers: {'authorization': 'Bearer $idToken'},
    );
    if (response.statusCode != 200) {
      throw Exception('Você já endossou esta ocorrência.');
    }
    return HazardReport.fromJson(
      jsonDecode(response.body) as Map<String, dynamic>,
    );
  }

  @override
  Future<List<Reward>> fetchRewards(String idToken) async {
    final response = await _httpClient.get(
      Uri.parse('$baseUrl/v1/rewards'),
      headers: {'authorization': 'Bearer $idToken'},
    );
    if (response.statusCode != 200) {
      throw Exception('Falha ao carregar catálogo de recompensas.');
    }
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    final raw = data['rewards'] as List<dynamic>;
    return raw
        .map((item) => Reward.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  @override
  Future<Redemption> redeemReward({
    required String idToken,
    required String rewardId,
  }) async {
    final response = await _httpClient.post(
      Uri.parse('$baseUrl/v1/rewards/$rewardId/redeem'),
      headers: {'authorization': 'Bearer $idToken'},
    );
    if (response.statusCode != 201) {
      throw Exception('Saldo insuficiente ou recompensa esgotada.');
    }
    return Redemption.fromJson(
      jsonDecode(response.body) as Map<String, dynamic>,
    );
  }

  @override
  Future<List<Redemption>> fetchMyRedemptions(String idToken) async {
    final response = await _httpClient.get(
      Uri.parse('$baseUrl/v1/redemptions/me'),
      headers: {'authorization': 'Bearer $idToken'},
    );
    if (response.statusCode != 200) {
      throw Exception('Falha ao carregar vouchers resgatados.');
    }
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    final raw = data['redemptions'] as List<dynamic>;
    return raw
        .map((item) => Redemption.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  @override
  Future<MobilityInsight> fetchCommuterNudge(String idToken) async {
    final response = await _httpClient.get(
      Uri.parse('$baseUrl/v1/commuters/me/nudge'),
      headers: {'authorization': 'Bearer $idToken'},
    );
    if (response.statusCode != 200) {
      throw Exception('Falha ao obter recomendação inteligente.');
    }
    return MobilityInsight.fromJson(
      jsonDecode(response.body) as Map<String, dynamic>,
    );
  }
}
