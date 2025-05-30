/// Интерфейс репозитория для работы с пользователями
abstract class IUserRepository {
  /// Получает профиль пользователя
  Future<Map<String, dynamic>> getUserProfile(String userId);

  /// Обновляет профиль пользователя
  Future<Map<String, dynamic>> updateUserProfile({
    required String userId,
    required Map<String, dynamic> profileData,
  });

  /// Загружает аватар пользователя
  Future<String> uploadAvatar({
    required String userId,
    required String imagePath,
  });

  /// Удаляет аккаунт пользователя
  Future<void> deleteAccount(String userId);

  /// Получает список друзей
  Future<List<Map<String, dynamic>>> getFriends(String userId);
} 