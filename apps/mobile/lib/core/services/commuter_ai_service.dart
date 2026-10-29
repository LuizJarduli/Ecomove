import '../models/trip.dart';
import '../repositories/ecomove_api_repository.dart';

/// Pluggable AI CommuterAiService Facade (ADR-0004).
/// Never hardcodes Gemini SDK or Ollama HTTP calls directly inside Flutter widgets.
abstract class CommuterAiService {
  Future<MobilityInsight> fetchCommuterNudge(String idToken);
}

class ApiCommuterAiService implements CommuterAiService {
  final EcoMoveApiRepository apiRepository;

  ApiCommuterAiService({required this.apiRepository});

  @override
  Future<MobilityInsight> fetchCommuterNudge(String idToken) {
    return apiRepository.fetchCommuterNudge(idToken);
  }
}
