import 'package:path/path.dart' as p;
import 'package:sqflite/sqflite.dart';
import '../models/trip.dart';

abstract class LocationQueueService {
  Future<void> enqueuePoint(GpsCoordinate coordinate);
  Future<List<GpsCoordinate>> getBufferedPoints();
  Future<void> clearQueue();
}

class InMemoryLocationQueueService implements LocationQueueService {
  final List<GpsCoordinate> _buffer = [];

  @override
  Future<void> enqueuePoint(GpsCoordinate coordinate) async {
    _buffer.add(coordinate);
  }

  @override
  Future<List<GpsCoordinate>> getBufferedPoints() async {
    return List.unmodifiable(_buffer);
  }

  @override
  Future<void> clearQueue() async {
    _buffer.clear();
  }
}

class SqliteLocationQueueService implements LocationQueueService {
  final DatabaseFactory? databaseFactoryOverride;
  final String dbPath;
  Database? _db;

  SqliteLocationQueueService({
    this.databaseFactoryOverride,
    this.dbPath = 'ecomove_location_queue.db',
  });

  Future<Database> _getDb() async {
    if (_db != null) return _db!;

    final factory = databaseFactoryOverride ?? databaseFactory;
    final resolvedPath = dbPath == inMemoryDatabasePath
        ? inMemoryDatabasePath
        : p.join(await factory.getDatabasesPath(), dbPath);

    _db = await factory.openDatabase(
      resolvedPath,
      options: OpenDatabaseOptions(
        version: 1,
        onCreate: (db, version) async {
          await db.execute('''
            CREATE TABLE trip_location_queue (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              latitude REAL NOT NULL,
              longitude REAL NOT NULL,
              recorded_at TEXT NOT NULL
            )
          ''');
        },
      ),
    );
    return _db!;
  }

  @override
  Future<void> enqueuePoint(GpsCoordinate coordinate) async {
    final db = await _getDb();
    await db.insert('trip_location_queue', {
      'latitude': coordinate.latitude,
      'longitude': coordinate.longitude,
      'recorded_at': coordinate.recordedAt.toUtc().toIso8601String(),
    });
  }

  @override
  Future<List<GpsCoordinate>> getBufferedPoints() async {
    final db = await _getDb();
    final rows = await db.query(
      'trip_location_queue',
      orderBy: 'id ASC',
    );
    return rows
        .map(
          (row) => GpsCoordinate(
            latitude: (row['latitude'] as num).toDouble(),
            longitude: (row['longitude'] as num).toDouble(),
            recordedAt: DateTime.parse(row['recorded_at'] as String),
          ),
        )
        .toList();
  }

  @override
  Future<void> clearQueue() async {
    final db = await _getDb();
    await db.delete('trip_location_queue');
  }
}
