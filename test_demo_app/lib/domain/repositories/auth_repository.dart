/// Интерфейс репозитория для работы с аутентификацией
abstract class IAuthRepository {
  /// Выполняет авторизацию пользователя
  Future<Map<String, dynamic>> performAuthorization({
    required String email,
    required String password,
  });

  /// Обновляет токены доступа
  Future<Map<String, dynamic>> refreshTokens({
    required String refreshToken,
    required String accessToken,
  });

  /// Выполняет выход из системы
  Future<void> logout();

  /// Проверяет валидность токена
  Future<bool> validateToken(String token);
} 