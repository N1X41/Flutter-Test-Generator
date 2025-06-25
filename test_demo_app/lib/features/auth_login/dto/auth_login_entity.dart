import 'package:equatable/equatable.dart';

/// Класс для реализации сущности данных авторизации
class AuthLoginEntity extends Equatable {
  /// Создает сущность данных авторизации
  ///
  /// Принимает:
  /// - [accessToken] - токен доступа
  /// - [refreshToken] - токен обновления
  const AuthLoginEntity({
    required this.accessToken,
    required this.refreshToken,
  });

  /// Токен доступа
  final String accessToken;

  /// Токен обновления
  final String refreshToken;

  @override
  List<Object?> get props => [accessToken, refreshToken];
}