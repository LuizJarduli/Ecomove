import 'dart:convert';
import 'package:http/http.dart' as http;

/// Boundary for Commuter authentication (Firebase Auth REST / SDK or local dev token).
abstract class CommuterAuthGateway {
  Future<String> signInWithEmailAndPassword({
    required String email,
    required String password,
  });

  Future<void> signOut();
}

/// Firebase Auth gateway that exchanges email/password for an ID token on the Spark plan,
/// falling back to the deterministic local development token format when no API key is set.
class FirebaseRestCommuterAuthGateway implements CommuterAuthGateway {
  final String firebaseWebApiKey;
  final http.Client _httpClient;

  FirebaseRestCommuterAuthGateway({
    this.firebaseWebApiKey = const String.fromEnvironment('FIREBASE_WEB_API_KEY'),
    http.Client? httpClient,
  }) : _httpClient = httpClient ?? http.Client();

  @override
  Future<String> signInWithEmailAndPassword({
    required String email,
    required String password,
  }) async {
    final normalizedEmail = email.trim().toLowerCase();
    if (normalizedEmail.isEmpty || password.isEmpty) {
      throw Exception('Preencha e-mail e senha.');
    }

    if (firebaseWebApiKey.isEmpty) {
      return 'test:uid-$normalizedEmail:$normalizedEmail';
    }

    final uri = Uri.parse(
      'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=$firebaseWebApiKey',
    );
    final response = await _httpClient.post(
      uri,
      headers: {'content-type': 'application/json'},
      body: jsonEncode({
        'email': normalizedEmail,
        'password': password,
        'returnSecureToken': true,
      }),
    );

    if (response.statusCode != 200) {
      throw Exception('E-mail ou senha inválidos.');
    }
    final payload = jsonDecode(response.body) as Map<String, dynamic>;
    return payload['idToken'] as String;
  }

  @override
  Future<void> signOut() async {}
}
