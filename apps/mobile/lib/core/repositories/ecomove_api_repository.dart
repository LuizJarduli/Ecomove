import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/campus_zone.dart';
import '../models/commuter.dart';

abstract class EcoMoveApiRepository {
  Future<Commuter> fetchMe(String idToken);
  Future<CampusZone> fetchActiveCampusZone(String idToken);
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
}
