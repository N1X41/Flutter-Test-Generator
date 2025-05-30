/// Интерфейс сервиса для безопасного хранения данных
abstract class ISecureStorageService {
  /// Записывает данные в безопасное хранилище
  Future<void> write(String key, String value);

  /// Читает данные из безопасного хранилища
  Future<String?> read(String key);

  /// Удаляет данные из безопасного хранилища
  Future<void> delete(String key);

  /// Очищает все данные из безопасного хранилища
  Future<void> deleteAll();

  /// Проверяет существование ключа
  Future<bool> containsKey(String key);

  /// Получает все ключи
  Future<Set<String>> getAllKeys();
} 