import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:latlong2/latlong.dart';
import 'package:ecomove_mobile/core/auth/commuter_auth_gateway.dart';
import 'package:ecomove_mobile/core/models/campus_zone.dart';
import 'package:ecomove_mobile/core/models/commuter.dart';
import 'package:ecomove_mobile/core/repositories/ecomove_api_repository.dart';
import 'package:ecomove_mobile/main.dart';

class FakeCommuterAuthGateway implements CommuterAuthGateway {
  @override
  Future<String> signInWithEmailAndPassword({
    required String email,
    required String password,
  }) async {
    if (password == 'wrong') {
      throw Exception('Credenciais inválidas');
    }
    return 'test:uid-$email:$email';
  }

  @override
  Future<void> signOut() async {}
}

class FakeEcoMoveApiRepository implements EcoMoveApiRepository {
  @override
  Future<Commuter> fetchMe(String idToken) async {
    final parts = idToken.split(':');
    final email = parts.last;
    return Commuter(
      id: 'commuter-1',
      email: email,
      name: 'Beatriz Andrade',
      isInstitutional: email.endsWith('@facens.br'),
      ecoPointsBalance: 0,
      totalDistanceMeters: 0,
      totalCo2SavedGrams: 0,
    );
  }

  @override
  Future<CampusZone> fetchActiveCampusZone(String idToken) async {
    return const CampusZone(
      id: 'zone-facens',
      name: 'Campus FACENS',
      isActive: true,
      boundaryPoints: [
        LatLng(-23.493, -47.454),
        LatLng(-23.493, -47.444),
        LatLng(-23.486, -47.444),
        LatLng(-23.486, -47.454),
        LatLng(-23.493, -47.454),
      ],
    );
  }
}

void main() {
  testWidgets(
    'Commuter signs in with @facens.br, sees Portuguese profile summary, institutional badge, and active CampusZone on flutter_map',
    (WidgetTester tester) async {
      await tester.pumpWidget(
        EcoMoveApp(
          authGateway: FakeCommuterAuthGateway(),
          apiRepository: FakeEcoMoveApiRepository(),
        ),
      );

      // Verify Portuguese login screen
      expect(find.text('EcoMove Campus'), findsOneWidget);
      expect(find.text('Entrar'), findsOneWidget);

      await tester.enterText(
        find.byKey(const Key('email_input')),
        'beatriz@facens.br',
      );
      await tester.enterText(
        find.byKey(const Key('password_input')),
        'senha123',
      );
      await tester.tap(find.byKey(const Key('sign_in_button')));
      await tester.pumpAndSettle();

      // Verify Portuguese profile summary & institutional affiliation
      expect(find.textContaining('beatriz@facens.br'), findsOneWidget);
      expect(find.text('Comunidade FACENS (@facens.br)'), findsOneWidget);
      expect(find.text('0 pts'), findsOneWidget);
      expect(find.text('Campus FACENS'), findsOneWidget);

      // Verify active CampusZone polygon rendered on FlutterMap
      expect(find.byType(FlutterMap), findsOneWidget);
      final polygonLayer = tester.widget<PolygonLayer>(find.byType(PolygonLayer));
      expect(polygonLayer.polygons, hasLength(1));
      expect(polygonLayer.polygons.first.points, hasLength(5));
    },
  );

  testWidgets(
    'External resident Commuter sees Comunidade Externa badge and invalid credentials show Portuguese error',
    (WidgetTester tester) async {
      await tester.pumpWidget(
        EcoMoveApp(
          authGateway: FakeCommuterAuthGateway(),
          apiRepository: FakeEcoMoveApiRepository(),
        ),
      );

      // Invalid credentials
      await tester.enterText(
        find.byKey(const Key('email_input')),
        'morador@gmail.com',
      );
      await tester.enterText(
        find.byKey(const Key('password_input')),
        'wrong',
      );
      await tester.tap(find.byKey(const Key('sign_in_button')));
      await tester.pumpAndSettle();

      expect(find.text('Credenciais inválidas'), findsOneWidget);

      // Valid external login
      await tester.enterText(
        find.byKey(const Key('password_input')),
        'correta123',
      );
      await tester.tap(find.byKey(const Key('sign_in_button')));
      await tester.pumpAndSettle();

      expect(find.text('Comunidade Externa'), findsOneWidget);

      // Sign out returns to login screen
      await tester.tap(find.byKey(const Key('sign_out_button')));
      await tester.pumpAndSettle();
      expect(find.text('Entrar'), findsOneWidget);
    },
  );
}
