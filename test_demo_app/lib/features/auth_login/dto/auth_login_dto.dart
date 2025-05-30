import 'package:test_demo_app/features/auth_login/dto/auth_login_entity.dart';

/// Класс для реализации DTO для парсинга данных авторизации в сущность
class AuthLoginDto {
  /// Создает DTO для парсинга данных авторизации в сущность
  ///
  /// Принимает:
  /// - [accessToken] - токен доступа
  /// - [refreshToken] - токен обновления
  const AuthLoginDto._({
    required this.accessToken,
    required this.refreshToken,
  });

  /// Создает DTO для парсинга данных авторизации в сущность из [json]
  factory AuthLoginDto.fromJson(Map<String, dynamic> json) => AuthLoginDto._(
        accessToken: json['access_token'] as String,
        refreshToken: json['refresh_token'] as String,
      );

  /// Токен доступа
  final String accessToken;

  /// Токен обновления
  final String refreshToken;

  /// Метод для создания сущности данных авторизации из DTO
  AuthLoginEntity toEntity() => AuthLoginEntity(
        accessToken: accessToken,
        refreshToken: refreshToken,
      );
}