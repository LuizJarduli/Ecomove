import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';
import 'core/auth/commuter_auth_gateway.dart';
import 'core/models/trip.dart';
import 'core/repositories/ecomove_api_repository.dart';
import 'core/services/location_queue_service.dart';
import 'features/session/commuter_session_bloc.dart';
import 'features/trips/trip_tracker_bloc.dart';

void main() {
  runApp(
    EcoMoveApp(
      authGateway: FirebaseRestCommuterAuthGateway(),
      apiRepository: HttpEcoMoveApiRepository(),
      locationQueueService: SqliteLocationQueueService(),
    ),
  );
}

class EcoMoveApp extends StatelessWidget {
  final CommuterAuthGateway authGateway;
  final EcoMoveApiRepository apiRepository;
  final LocationQueueService? locationQueueService;

  const EcoMoveApp({
    super.key,
    required this.authGateway,
    required this.apiRepository,
    this.locationQueueService,
  });

  @override
  Widget build(BuildContext context) {
    final queueService = locationQueueService ?? SqliteLocationQueueService();
    return MultiProvider(
      providers: [
        Provider<CommuterAuthGateway>.value(value: authGateway),
        Provider<EcoMoveApiRepository>.value(value: apiRepository),
        Provider<LocationQueueService>.value(value: queueService),
      ],
      child: MultiBlocProvider(
        providers: [
          BlocProvider(
            create: (context) => CommuterSessionBloc(
              authGateway: context.read<CommuterAuthGateway>(),
              apiRepository: context.read<EcoMoveApiRepository>(),
            ),
          ),
          BlocProvider(
            create: (context) => TripTrackerBloc(
              apiRepository: context.read<EcoMoveApiRepository>(),
              locationQueueService: context.read<LocationQueueService>(),
            ),
          ),
        ],
        child: MaterialApp(
          title: 'EcoMove Campus',
          debugShowCheckedModeBanner: false,
          theme: ThemeData(
            scaffoldBackgroundColor: const Color(0xFFF7F7F5),
            colorScheme: ColorScheme.fromSeed(
              seedColor: const Color(0xFF10B981),
              primary: const Color(0xFF111111),
              surface: const Color(0xFFFCFCFB),
            ),
            useMaterial3: true,
          ),
          home: BlocConsumer<CommuterSessionBloc, CommuterSessionState>(
            listenWhen: (previous, current) =>
                previous is! CommuterAuthenticated &&
                current is CommuterAuthenticated,
            listener: (context, state) {
              if (state is CommuterAuthenticated) {
                context
                    .read<TripTrackerBloc>()
                    .add(TripHistoryLoadRequested(state.idToken));
              }
            },
            builder: (context, state) {
              if (state is CommuterAuthenticated) {
                return CommuterHomeScreen(state: state);
              }
              return CommuterLoginScreen(state: state);
            },
          ),
        ),
      ),
    );
  }
}

class CommuterLoginScreen extends StatefulWidget {
  final CommuterSessionState state;

  const CommuterLoginScreen({super.key, required this.state});

  @override
  State<CommuterLoginScreen> createState() => _CommuterLoginScreenState();
}

class _CommuterLoginScreenState extends State<CommuterLoginScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isLoading = widget.state is CommuterAuthenticating;
    final errorMessage = widget.state is CommuterUnauthenticated
        ? (widget.state as CommuterUnauthenticated).errorMessage
        : null;

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Container(
              constraints: const BoxConstraints(maxWidth: 400),
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: const Color(0xFFFCFCFB),
                borderRadius: BorderRadius.circular(24),
                border: Border.all(color: const Color(0xFFE7E7E4)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 10,
                        height: 10,
                        decoration: const BoxDecoration(
                          color: Color(0xFF10B981),
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 8),
                      const Text(
                        'EcoMove Campus',
                        style: TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF111111),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    'Cada trajeto conta, mova-se de forma sustentável.',
                    style: TextStyle(fontSize: 13, color: Color(0xFF6B6B6B)),
                  ),
                  const SizedBox(height: 24),
                  TextField(
                    key: const Key('email_input'),
                    controller: _emailController,
                    keyboardType: TextInputType.emailAddress,
                    decoration: InputDecoration(
                      labelText: 'E-mail (@facens.br ou pessoal)',
                      filled: true,
                      fillColor: const Color(0xFFF7F7F5),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                  ),
                  const SizedBox(height: 14),
                  TextField(
                    key: const Key('password_input'),
                    controller: _passwordController,
                    obscureText: true,
                    decoration: InputDecoration(
                      labelText: 'Senha',
                      filled: true,
                      fillColor: const Color(0xFFF7F7F5),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                  ),
                  if (errorMessage != null) ...[
                    const SizedBox(height: 12),
                    Text(
                      errorMessage,
                      style: const TextStyle(
                        color: Color(0xFFBA1A1A),
                        fontSize: 13,
                      ),
                    ),
                  ],
                  const SizedBox(height: 20),
                  FilledButton(
                    key: const Key('sign_in_button'),
                    onPressed: isLoading
                        ? null
                        : () {
                            context.read<CommuterSessionBloc>().add(
                                  CommuterSignInRequested(
                                    email: _emailController.text,
                                    password: _passwordController.text,
                                  ),
                                );
                          },
                    style: FilledButton.styleFrom(
                      backgroundColor: const Color(0xFF111111),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(999),
                      ),
                    ),
                    child: Text(isLoading ? 'Entrando…' : 'Entrar'),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class CommuterHomeScreen extends StatefulWidget {
  final CommuterAuthenticated state;

  const CommuterHomeScreen({super.key, required this.state});

  @override
  State<CommuterHomeScreen> createState() => _CommuterHomeScreenState();
}

class _CommuterHomeScreenState extends State<CommuterHomeScreen> {
  int _selectedTabIndex = 0;

  static const List<LatLng> _demoCampusCorridor = [
    LatLng(-23.4900, -47.4540),
    LatLng(-23.4900, -47.4515),
    LatLng(-23.4900, -47.4490),
    LatLng(-23.4900, -47.4465),
    LatLng(-23.4900, -47.4440),
  ];

  void _recordNextCampusGpsPoint(TripTrackerState trackerState) {
    final idx = trackerState.bufferedCoordinates.length;
    final basePoint =
        _demoCampusCorridor[idx % _demoCampusCorridor.length];
    final timestamp = DateTime.utc(2026, 10, 21, 10, 0, 0)
        .add(Duration(minutes: idx * 3));
    context.read<TripTrackerBloc>().add(
          TripGpsCoordinateRecorded(
            GpsCoordinate(
              latitude: basePoint.latitude,
              longitude: basePoint.longitude,
              recordedAt: timestamp,
            ),
          ),
        );
  }

  @override
  Widget build(BuildContext context) {
    final commuter = widget.state.commuter;
    final zone = widget.state.campusZone;

    return BlocConsumer<TripTrackerBloc, TripTrackerState>(
      listenWhen: (previous, current) =>
          previous.lastCompletedTrip != current.lastCompletedTrip &&
          current.lastCompletedTrip != null,
      listener: (context, trackerState) {
        context
            .read<CommuterSessionBloc>()
            .add(const CommuterProfileRefreshRequested());
      },
      builder: (context, trackerState) {
        return Scaffold(
          appBar: AppBar(
            backgroundColor: const Color(0xFFF7F7F5),
            elevation: 0,
            title: const Text(
              'EcoMove Campus',
              style: TextStyle(fontWeight: FontWeight.w600, fontSize: 18),
            ),
            actions: [
              TextButton(
                key: const Key('sign_out_button'),
                onPressed: () {
                  context
                      .read<CommuterSessionBloc>()
                      .add(const CommuterSignOutRequested());
                },
                child: const Text('Sair'),
              ),
            ],
          ),
          bottomNavigationBar: NavigationBar(
            selectedIndex: _selectedTabIndex,
            onDestinationSelected: (index) {
              setState(() => _selectedTabIndex = index);
            },
            destinations: const [
              NavigationDestination(
                key: Key('nav_map_tab'),
                icon: Icon(Icons.map_outlined),
                label: 'Mapa & Trajeto',
              ),
              NavigationDestination(
                key: Key('nav_history_tab'),
                icon: Icon(Icons.receipt_long_outlined),
                label: 'Histórico & Extrato',
              ),
            ],
          ),
          body: Padding(
            padding: const EdgeInsets.all(16),
            child: _selectedTabIndex == 0
                ? _buildMapAndTrackerTab(commuter, zone, trackerState)
                : _buildHistoryAndLedgerTab(trackerState),
          ),
        );
      },
    );
  }

  Widget _buildMapAndTrackerTab(
    dynamic commuter,
    dynamic zone,
    TripTrackerState trackerState,
  ) {
    final completedTrip = trackerState.lastCompletedTrip;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: const Color(0xFFFCFCFB),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: const Color(0xFFE7E7E4)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Flexible(
                    child: Text(
                      'Olá, ${commuter.name ?? commuter.email} · ${commuter.email}',
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: commuter.isInstitutional
                          ? const Color(0xFFD1FAE5)
                          : const Color(0xFFF3F2EF),
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(
                      commuter.isInstitutional
                          ? 'Comunidade FACENS (@facens.br)'
                          : 'Comunidade Externa',
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: _MetricTile(
                      label: 'SALDO ECOPOINTS',
                      value: '${commuter.ecoPointsBalance} pts',
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: _MetricTile(
                      label: 'DISTÂNCIA',
                      value:
                          '${(commuter.totalDistanceMeters / 1000).toStringAsFixed(1)} km',
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: _MetricTile(
                      label: 'CO₂ EVITADO',
                      value:
                          '${commuter.totalCo2SavedGrams.toStringAsFixed(0)} g',
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 10),
        // TransportMode Selector
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: [
              for (final mode in const [
                TransportMode.walk,
                TransportMode.bicycle,
                TransportMode.publicTransit,
              ])
                Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: ChoiceChip(
                    key: Key('mode_chip_${mode.code}'),
                    label: Text(mode.labelPt),
                    selected: trackerState.selectedMode == mode,
                    onSelected: trackerState.isRecording
                        ? null
                        : (_) {
                            context
                                .read<TripTrackerBloc>()
                                .add(TripTransportModeSelected(mode));
                          },
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: 8),
        if (completedTrip != null)
          Container(
            key: const Key('trip_summary_card'),
            margin: const EdgeInsets.only(bottom: 8),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: const Color(0xFF1C1B1B),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Viagem ${completedTrip.status.labelPt} · +${completedTrip.ecoPointsEarned} EcoPoints',
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w600,
                          fontSize: 13,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        completedTrip.rejectionReason ??
                            '${(completedTrip.distanceMeters / 1000).toStringAsFixed(2)} km · ${completedTrip.co2SavedGrams.toStringAsFixed(0)} g CO₂ evitados',
                        style: const TextStyle(
                          color: Color(0xFFD4D4D8),
                          fontSize: 11,
                        ),
                      ),
                    ],
                  ),
                ),
                TextButton(
                  key: const Key('dismiss_summary_button'),
                  onPressed: () {
                    context
                        .read<TripTrackerBloc>()
                        .add(const TripSummaryDismissed());
                  },
                  child: const Text(
                    'Fechar',
                    style: TextStyle(color: Color(0xFF6EE7B7)),
                  ),
                ),
              ],
            ),
          ),
        if (trackerState.errorMessage != null)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Text(
              trackerState.errorMessage!,
              key: const Key('trip_error_text'),
              style: const TextStyle(color: Color(0xFFBA1A1A), fontSize: 12),
            ),
          ),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              zone.name,
              style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
              ),
            ),
            Text(
              'Fila SQLite: ${trackerState.bufferedCoordinates.length} pts · PostGIS 4326',
              key: const Key('sqlite_queue_counter'),
              style: const TextStyle(fontSize: 11, color: Color(0xFF6B6B6B)),
            ),
          ],
        ),
        const SizedBox(height: 6),
        Expanded(
          child: ClipRRect(
            borderRadius: BorderRadius.circular(20),
            child: FlutterMap(
              options: MapOptions(
                initialCenter: zone.center,
                initialZoom: 15,
              ),
              children: [
                TileLayer(
                  urlTemplate:
                      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                  userAgentPackageName: 'br.facens.ecomove.ecomove_mobile',
                ),
                PolygonLayer(
                  polygons: [
                    Polygon(
                      points: zone.boundaryPoints,
                      color: const Color(0x3310B981),
                      borderColor: const Color(0xFF10B981),
                      borderStrokeWidth: 2.5,
                    ),
                  ],
                ),
                if (trackerState.bufferedCoordinates.length >= 2)
                  PolylineLayer(
                    polylines: [
                      Polyline(
                        points: trackerState.bufferedCoordinates
                            .map((c) => c.latLng)
                            .toList(),
                        color: const Color(0xFF111111),
                        strokeWidth: 4,
                      ),
                    ],
                  ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 10),
        if (!trackerState.isRecording)
          FilledButton(
            key: const Key('start_trip_button'),
            onPressed: () {
              context
                  .read<TripTrackerBloc>()
                  .add(const TripRecordingStarted());
            },
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFF111111),
              padding: const EdgeInsets.symmetric(vertical: 12),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(999),
              ),
            ),
            child: Text(
              'Iniciar Trajeto (${trackerState.selectedMode.labelPt})',
            ),
          )
        else
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  key: const Key('record_gps_point_button'),
                  onPressed: trackerState.isSyncing
                      ? null
                      : () => _recordNextCampusGpsPoint(trackerState),
                  child: const Text('+ Ponto GPS (SQLite)'),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: FilledButton(
                  key: const Key('finish_trip_button'),
                  onPressed: trackerState.isSyncing
                      ? null
                      : () {
                          context.read<TripTrackerBloc>().add(
                                TripRecordingCompleted(widget.state.idToken),
                              );
                        },
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFF006C49),
                  ),
                  child: Text(
                    trackerState.isSyncing
                        ? 'Sincronizando…'
                        : 'Finalizar e Validar',
                  ),
                ),
              ),
            ],
          ),
      ],
    );
  }

  Widget _buildHistoryAndLedgerTab(TripTrackerState trackerState) {
    return ListView(
      children: [
        const Text(
          'Histórico de Viagens (PostGIS)',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: 8),
        if (trackerState.tripHistory.isEmpty)
          const Text(
            'Nenhuma viagem registrada ainda.',
            style: TextStyle(fontSize: 13, color: Color(0xFF6B6B6B)),
          )
        else
          for (final trip in trackerState.tripHistory)
            Container(
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFFCFCFB),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: const Color(0xFFE7E7E4)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '${trip.transportMode.labelPt} · ${trip.status.labelPt}',
                        style: const TextStyle(
                          fontWeight: FontWeight.w600,
                          fontSize: 13,
                        ),
                      ),
                      Text(
                        '${(trip.distanceMeters / 1000).toStringAsFixed(2)} km · ${trip.co2SavedGrams.toStringAsFixed(0)} g CO₂',
                        style: const TextStyle(
                          fontSize: 12,
                          color: Color(0xFF6B6B6B),
                        ),
                      ),
                    ],
                  ),
                  Text(
                    '+${trip.ecoPointsEarned} pts',
                    style: const TextStyle(
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF006C49),
                    ),
                  ),
                ],
              ),
            ),
        const SizedBox(height: 16),
        const Text(
          'Extrato Imutável (PointTransaction)',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: 8),
        if (trackerState.ledgerEntries.isEmpty)
          const Text(
            'Nenhuma transação de EcoPoints registrada.',
            style: TextStyle(fontSize: 13, color: Color(0xFF6B6B6B)),
          )
        else
          for (final entry in trackerState.ledgerEntries)
            Container(
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFFCFCFB),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: const Color(0xFFE7E7E4)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    entry.reasonLabelPt,
                    style: const TextStyle(fontSize: 13),
                  ),
                  Text(
                    '${entry.amount >= 0 ? '+' : ''}${entry.amount} EcoPoints',
                    style: const TextStyle(
                      fontWeight: FontWeight.w600,
                      fontSize: 13,
                    ),
                  ),
                ],
              ),
            ),
      ],
    );
  }
}

class _MetricTile extends StatelessWidget {
  final String label;
  final String value;

  const _MetricTile({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: const Color(0xFFF7F7F5),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE7E7E4)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: const TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w600,
              color: Color(0xFF6B6B6B),
            ),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: const TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w600,
              color: Color(0xFF111111),
            ),
          ),
        ],
      ),
    );
  }
}
