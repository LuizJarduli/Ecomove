import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../core/auth/commuter_auth_gateway.dart';
import '../../core/models/campus_zone.dart';
import '../../core/models/commuter.dart';
import '../../core/repositories/ecomove_api_repository.dart';

sealed class CommuterSessionEvent extends Equatable {
  const CommuterSessionEvent();

  @override
  List<Object?> get props => [];
}

final class CommuterSignInRequested extends CommuterSessionEvent {
  final String email;
  final String password;

  const CommuterSignInRequested({
    required this.email,
    required this.password,
  });

  @override
  List<Object?> get props => [email, password];
}

final class CommuterSignOutRequested extends CommuterSessionEvent {
  const CommuterSignOutRequested();
}

sealed class CommuterSessionState extends Equatable {
  const CommuterSessionState();

  @override
  List<Object?> get props => [];
}

final class CommuterUnauthenticated extends CommuterSessionState {
  final String? errorMessage;

  const CommuterUnauthenticated({this.errorMessage});

  @override
  List<Object?> get props => [errorMessage];
}

final class CommuterAuthenticating extends CommuterSessionState {
  const CommuterAuthenticating();
}

final class CommuterAuthenticated extends CommuterSessionState {
  final String idToken;
  final Commuter commuter;
  final CampusZone campusZone;

  const CommuterAuthenticated({
    required this.idToken,
    required this.commuter,
    required this.campusZone,
  });

  @override
  List<Object?> get props => [idToken, commuter, campusZone];
}

class CommuterSessionBloc
    extends Bloc<CommuterSessionEvent, CommuterSessionState> {
  final CommuterAuthGateway authGateway;
  final EcoMoveApiRepository apiRepository;

  CommuterSessionBloc({
    required this.authGateway,
    required this.apiRepository,
  }) : super(const CommuterUnauthenticated()) {
    on<CommuterSignInRequested>(_onSignInRequested);
    on<CommuterSignOutRequested>(_onSignOutRequested);
  }

  Future<void> _onSignInRequested(
    CommuterSignInRequested event,
    Emitter<CommuterSessionState> emit,
  ) async {
    emit(const CommuterAuthenticating());
    try {
      final token = await authGateway.signInWithEmailAndPassword(
        email: event.email,
        password: event.password,
      );
      final commuter = await apiRepository.fetchMe(token);
      final campusZone = await apiRepository.fetchActiveCampusZone(token);
      emit(
        CommuterAuthenticated(
          idToken: token,
          commuter: commuter,
          campusZone: campusZone,
        ),
      );
    } catch (error) {
      emit(
        CommuterUnauthenticated(
          errorMessage: error.toString().replaceFirst('Exception: ', ''),
        ),
      );
    }
  }

  Future<void> _onSignOutRequested(
    CommuterSignOutRequested event,
    Emitter<CommuterSessionState> emit,
  ) async {
    await authGateway.signOut();
    emit(const CommuterUnauthenticated());
  }
}
