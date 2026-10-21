import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:provider/provider.dart';
import 'core/auth/commuter_auth_gateway.dart';
import 'core/repositories/ecomove_api_repository.dart';
import 'features/session/commuter_session_bloc.dart';

void main() {
  runApp(
    EcoMoveApp(
      authGateway: FirebaseRestCommuterAuthGateway(),
      apiRepository: HttpEcoMoveApiRepository(),
    ),
  );
}

class EcoMoveApp extends StatelessWidget {
  final CommuterAuthGateway authGateway;
  final EcoMoveApiRepository apiRepository;

  const EcoMoveApp({
    super.key,
    required this.authGateway,
    required this.apiRepository,
  });

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        Provider<CommuterAuthGateway>.value(value: authGateway),
        Provider<EcoMoveApiRepository>.value(value: apiRepository),
      ],
      child: BlocProvider(
        create: (context) => CommuterSessionBloc(
          authGateway: context.read<CommuterAuthGateway>(),
          apiRepository: context.read<EcoMoveApiRepository>(),
        ),
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
          home: BlocBuilder<CommuterSessionBloc, CommuterSessionState>(
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

class CommuterHomeScreen extends StatelessWidget {
  final CommuterAuthenticated state;

  const CommuterHomeScreen({super.key, required this.state});

  @override
  Widget build(BuildContext context) {
    final commuter = state.commuter;
    final zone = state.campusZone;

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
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(
              padding: const EdgeInsets.all(16),
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
                            fontSize: 15,
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
                  const SizedBox(height: 12),
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
            const SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  zone.name,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const Text(
                  'Perímetro Ativo · PostGIS SRID 4326',
                  style: TextStyle(fontSize: 11, color: Color(0xFF6B6B6B)),
                ),
              ],
            ),
            const SizedBox(height: 8),
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
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
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
