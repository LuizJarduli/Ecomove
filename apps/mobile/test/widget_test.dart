import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:latlong2/latlong.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';
import 'package:ecomove_mobile/core/auth/commuter_auth_gateway.dart';
import 'package:ecomove_mobile/core/models/campus_zone.dart';
import 'package:ecomove_mobile/core/models/commuter.dart';
import 'package:ecomove_mobile/core/models/trip.dart';
import 'package:ecomove_mobile/core/repositories/ecomove_api_repository.dart';
import 'package:ecomove_mobile/core/services/location_queue_service.dart';
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
  int _balance = 0;
  double _distance = 0;
  double _co2 = 0;
  final List<Trip> _trips = [];
  final List<PointTransaction> _ledger = [];

  @override
  Future<Commuter> fetchMe(String idToken) async {
    final parts = idToken.split(':');
    final email = parts.last;
    return Commuter(
      id: 'commuter-1',
      email: email,
      name: 'Beatriz Andrade',
      isInstitutional: email.endsWith('@facens.br'),
      ecoPointsBalance: _balance,
      totalDistanceMeters: _distance,
      totalCo2SavedGrams: _co2,
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

  @override
  Future<Trip> submitTrip({
    required String idToken,
    required TransportMode transportMode,
    required List<GpsCoordinate> coordinates,
    String? carpoolSessionId,
  }) async {
    final now = DateTime.utc(2026, 10, 21, 10, 10);
    final trip = Trip(
      id: 'trip-${_trips.length + 1}',
      commuterId: 'commuter-1',
      transportMode: transportMode,
      status: TripStatus.validated,
      routePoints: coordinates.map((c) => c.latLng).toList(),
      distanceMeters: 1020,
      durationSeconds: 600,
      avgSpeedKmh: 6.12,
      peakSpeedKmh: 7.4,
      co2SavedGrams: 142.8,
      ecoPointsEarned: 8,
      rejectionReason: null,
      startedAt: coordinates.first.recordedAt,
      endedAt: coordinates.last.recordedAt,
      createdAt: now,
    );
    _trips.insert(0, trip);
    _balance += 8;
    _distance += 1020;
    _co2 += 142.8;
    _ledger.insert(
      0,
      PointTransaction(
        id: 'tx-${_ledger.length + 1}',
        commuterId: 'commuter-1',
        amount: 8,
        reason: 'TRIP_VALIDATED',
        tripId: trip.id,
        createdAt: now,
      ),
    );
    return trip;
  }

  @override
  Future<List<Trip>> fetchMyTrips(String idToken) async => List.of(_trips);

  @override
  Future<List<PointTransaction>> fetchMyLedger(String idToken) async =>
      List.of(_ledger);

  @override
  Future<CarpoolSession> createCarpoolSession(String idToken) async {
    return const CarpoolSession(
      id: 'carpool-1',
      driverId: 'commuter-1',
      joinCode: 'EC42',
      status: 'OPEN',
      participantCount: 1,
    );
  }

  @override
  Future<CarpoolSession> joinCarpoolSession({
    required String idToken,
    required String joinCode,
  }) async {
    return CarpoolSession(
      id: 'carpool-1',
      driverId: 'driver-1',
      joinCode: joinCode.toUpperCase(),
      status: 'OPEN',
      participantCount: 2,
    );
  }
}

void main() {
  setUpAll(() {
    sqfliteFfiInit();
  });

  test(
    'SqliteLocationQueueService persists, orders, and clears GPS coordinates in SQLite',
    () async {
      final sqliteQueue = SqliteLocationQueueService(
        databaseFactoryOverride: databaseFactoryFfi,
        dbPath: inMemoryDatabasePath,
      );

      final p1 = GpsCoordinate(
        latitude: -23.4900,
        longitude: -47.4540,
        recordedAt: DateTime.utc(2026, 10, 21, 10, 0),
      );
      final p2 = GpsCoordinate(
        latitude: -23.4900,
        longitude: -47.4490,
        recordedAt: DateTime.utc(2026, 10, 21, 10, 5),
      );

      await sqliteQueue.enqueuePoint(p1);
      await sqliteQueue.enqueuePoint(p2);

      final buffered = await sqliteQueue.getBufferedPoints();
      expect(buffered, [p1, p2]);

      await sqliteQueue.clearQueue();
      expect(await sqliteQueue.getBufferedPoints(), isEmpty);
    },
  );

  testWidgets(
    'Commuter signs in with @facens.br, sees Portuguese profile summary, institutional badge, and active CampusZone on flutter_map',
    (WidgetTester tester) async {
      await tester.pumpWidget(
        EcoMoveApp(
          authGateway: FakeCommuterAuthGateway(),
          apiRepository: FakeEcoMoveApiRepository(),
          locationQueueService: InMemoryLocationQueueService(),
        ),
      );

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

      expect(find.textContaining('beatriz@facens.br'), findsOneWidget);
      expect(find.text('Comunidade FACENS (@facens.br)'), findsOneWidget);
      expect(find.text('0 pts'), findsOneWidget);
      expect(find.text('Campus FACENS'), findsOneWidget);

      expect(find.byType(FlutterMap), findsOneWidget);
      final polygonLayer =
          tester.widget<PolygonLayer>(find.byType(PolygonLayer));
      expect(polygonLayer.polygons, hasLength(1));
      expect(polygonLayer.polygons.first.points, hasLength(5));
    },
  );

  testWidgets(
    'Commuter selects BICYCLE, buffers GPS coordinates in SQLite queue, completes Trip, and views history & ledger',
    (WidgetTester tester) async {
      final queue = InMemoryLocationQueueService();
      await tester.pumpWidget(
        EcoMoveApp(
          authGateway: FakeCommuterAuthGateway(),
          apiRepository: FakeEcoMoveApiRepository(),
          locationQueueService: queue,
        ),
      );

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

      // Select BICYCLE transport mode
      await tester.tap(find.byKey(const Key('mode_chip_BICYCLE')));
      await tester.pumpAndSettle();

      // Start Trip recording
      await tester.tap(find.byKey(const Key('start_trip_button')));
      await tester.pumpAndSettle();

      // Record 3 GPS points into SQLite LocationQueueService
      await tester.tap(find.byKey(const Key('record_gps_point_button')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('record_gps_point_button')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('record_gps_point_button')));
      await tester.pumpAndSettle();

      expect(find.text('Fila SQLite: 3 pts · PostGIS 4326'), findsOneWidget);
      expect(await queue.getBufferedPoints(), hasLength(3));

      // Complete Trip & verify SQLite queue cleared + Portuguese validation banner + updated balance
      await tester.tap(find.byKey(const Key('finish_trip_button')));
      await tester.pumpAndSettle();

      expect(await queue.getBufferedPoints(), isEmpty);
      expect(find.byKey(const Key('trip_summary_card')), findsOneWidget);
      expect(find.text('Viagem Validada · +8 EcoPoints'), findsOneWidget);
      expect(find.text('8 pts'), findsOneWidget);

      // Navigate to Histórico & Extrato tab
      await tester.tap(find.byKey(const Key('nav_history_tab')));
      await tester.pumpAndSettle();

      expect(find.text('Bicicleta · Validada'), findsOneWidget);
      expect(find.text('Trajeto Sustentável Validado'), findsOneWidget);
      expect(find.text('+8 EcoPoints'), findsOneWidget);
    },
  );

  testWidgets(
    'External resident Commuter sees Comunidade Externa badge and invalid credentials show Portuguese error',
    (WidgetTester tester) async {
      await tester.pumpWidget(
        EcoMoveApp(
          authGateway: FakeCommuterAuthGateway(),
          apiRepository: FakeEcoMoveApiRepository(),
          locationQueueService: InMemoryLocationQueueService(),
        ),
      );

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

      await tester.enterText(
        find.byKey(const Key('password_input')),
        'correta123',
      );
      await tester.tap(find.byKey(const Key('sign_in_button')));
      await tester.pumpAndSettle();

      expect(find.text('Comunidade Externa'), findsOneWidget);

      await tester.tap(find.byKey(const Key('sign_out_button')));
      await tester.pumpAndSettle();
      expect(find.text('Entrar'), findsOneWidget);
    },
  );
}
