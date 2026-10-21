import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../core/models/trip.dart';
import '../../core/repositories/ecomove_api_repository.dart';
import '../../core/services/location_queue_service.dart';

sealed class TripTrackerEvent extends Equatable {
  const TripTrackerEvent();

  @override
  List<Object?> get props => [];
}

final class TripHistoryLoadRequested extends TripTrackerEvent {
  final String idToken;

  const TripHistoryLoadRequested(this.idToken);

  @override
  List<Object?> get props => [idToken];
}

final class TripTransportModeSelected extends TripTrackerEvent {
  final TransportMode transportMode;

  const TripTransportModeSelected(this.transportMode);

  @override
  List<Object?> get props => [transportMode];
}

final class TripRecordingStarted extends TripTrackerEvent {
  const TripRecordingStarted();
}

final class TripGpsCoordinateRecorded extends TripTrackerEvent {
  final GpsCoordinate coordinate;

  const TripGpsCoordinateRecorded(this.coordinate);

  @override
  List<Object?> get props => [coordinate];
}

final class TripRecordingCompleted extends TripTrackerEvent {
  final String idToken;

  const TripRecordingCompleted(this.idToken);

  @override
  List<Object?> get props => [idToken];
}

final class TripSummaryDismissed extends TripTrackerEvent {
  const TripSummaryDismissed();
}

class TripTrackerState extends Equatable {
  final TransportMode selectedMode;
  final bool isRecording;
  final bool isSyncing;
  final List<GpsCoordinate> bufferedCoordinates;
  final List<Trip> tripHistory;
  final List<PointTransaction> ledgerEntries;
  final Trip? lastCompletedTrip;
  final String? errorMessage;

  const TripTrackerState({
    this.selectedMode = TransportMode.walk,
    this.isRecording = false,
    this.isSyncing = false,
    this.bufferedCoordinates = const [],
    this.tripHistory = const [],
    this.ledgerEntries = const [],
    this.lastCompletedTrip,
    this.errorMessage,
  });

  TripTrackerState copyWith({
    TransportMode? selectedMode,
    bool? isRecording,
    bool? isSyncing,
    List<GpsCoordinate>? bufferedCoordinates,
    List<Trip>? tripHistory,
    List<PointTransaction>? ledgerEntries,
    Trip? lastCompletedTrip,
    bool clearLastCompletedTrip = false,
    String? errorMessage,
    bool clearErrorMessage = false,
  }) {
    return TripTrackerState(
      selectedMode: selectedMode ?? this.selectedMode,
      isRecording: isRecording ?? this.isRecording,
      isSyncing: isSyncing ?? this.isSyncing,
      bufferedCoordinates: bufferedCoordinates ?? this.bufferedCoordinates,
      tripHistory: tripHistory ?? this.tripHistory,
      ledgerEntries: ledgerEntries ?? this.ledgerEntries,
      lastCompletedTrip:
          clearLastCompletedTrip ? null : (lastCompletedTrip ?? this.lastCompletedTrip),
      errorMessage: clearErrorMessage ? null : (errorMessage ?? this.errorMessage),
    );
  }

  @override
  List<Object?> get props => [
        selectedMode,
        isRecording,
        isSyncing,
        bufferedCoordinates,
        tripHistory,
        ledgerEntries,
        lastCompletedTrip,
        errorMessage,
      ];
}

class TripTrackerBloc extends Bloc<TripTrackerEvent, TripTrackerState> {
  final EcoMoveApiRepository apiRepository;
  final LocationQueueService locationQueueService;

  TripTrackerBloc({
    required this.apiRepository,
    required this.locationQueueService,
  }) : super(const TripTrackerState()) {
    on<TripHistoryLoadRequested>(_onHistoryLoadRequested);
    on<TripTransportModeSelected>(_onTransportModeSelected);
    on<TripRecordingStarted>(_onRecordingStarted);
    on<TripGpsCoordinateRecorded>(_onGpsCoordinateRecorded);
    on<TripRecordingCompleted>(_onRecordingCompleted);
    on<TripSummaryDismissed>(_onSummaryDismissed);
  }

  Future<void> _onHistoryLoadRequested(
    TripHistoryLoadRequested event,
    Emitter<TripTrackerState> emit,
  ) async {
    try {
      final buffered = await locationQueueService.getBufferedPoints();
      final trips = await apiRepository.fetchMyTrips(event.idToken);
      final ledger = await apiRepository.fetchMyLedger(event.idToken);
      emit(
        state.copyWith(
          bufferedCoordinates: buffered,
          tripHistory: trips,
          ledgerEntries: ledger,
          clearErrorMessage: true,
        ),
      );
    } catch (error) {
      emit(
        state.copyWith(
          errorMessage: error.toString().replaceFirst('Exception: ', ''),
        ),
      );
    }
  }

  void _onTransportModeSelected(
    TripTransportModeSelected event,
    Emitter<TripTrackerState> emit,
  ) {
    if (state.isRecording) return;
    emit(state.copyWith(selectedMode: event.transportMode, clearErrorMessage: true));
  }

  Future<void> _onRecordingStarted(
    TripRecordingStarted event,
    Emitter<TripTrackerState> emit,
  ) async {
    await locationQueueService.clearQueue();
    emit(
      state.copyWith(
        isRecording: true,
        bufferedCoordinates: const [],
        clearLastCompletedTrip: true,
        clearErrorMessage: true,
      ),
    );
  }

  Future<void> _onGpsCoordinateRecorded(
    TripGpsCoordinateRecorded event,
    Emitter<TripTrackerState> emit,
  ) async {
    await locationQueueService.enqueuePoint(event.coordinate);
    final updated = await locationQueueService.getBufferedPoints();
    emit(state.copyWith(bufferedCoordinates: updated, clearErrorMessage: true));
  }

  Future<void> _onRecordingCompleted(
    TripRecordingCompleted event,
    Emitter<TripTrackerState> emit,
  ) async {
    final buffered = await locationQueueService.getBufferedPoints();
    if (buffered.length < 2) {
      emit(
        state.copyWith(
          errorMessage:
              'Registre ao menos 2 pontos GPS antes de finalizar o trajeto.',
        ),
      );
      return;
    }

    emit(state.copyWith(isSyncing: true, clearErrorMessage: true));
    try {
      final completedTrip = await apiRepository.submitTrip(
        idToken: event.idToken,
        transportMode: state.selectedMode,
        coordinates: buffered,
      );
      await locationQueueService.clearQueue();
      final trips = await apiRepository.fetchMyTrips(event.idToken);
      final ledger = await apiRepository.fetchMyLedger(event.idToken);

      emit(
        state.copyWith(
          isRecording: false,
          isSyncing: false,
          bufferedCoordinates: const [],
          tripHistory: trips,
          ledgerEntries: ledger,
          lastCompletedTrip: completedTrip,
          clearErrorMessage: true,
        ),
      );
    } catch (error) {
      emit(
        state.copyWith(
          isSyncing: false,
          errorMessage:
              'Sem conexão: ${buffered.length} pontos GPS mantidos na fila SQLite local para reenvio.',
        ),
      );
    }
  }

  void _onSummaryDismissed(
    TripSummaryDismissed event,
    Emitter<TripTrackerState> emit,
  ) {
    emit(state.copyWith(clearLastCompletedTrip: true));
  }
}
