/// Интерфейс репозитория для работы с новостями
abstract class INewsRepository {
  /// Получает список новостей с пагинацией
  Future<List<Map<String, dynamic>>> getNews({
    required int page,
    int limit = 20,
    String? category,
  });

  /// Получает детали новости
  Future<Map<String, dynamic>> getNewsDetails(String newsId);

  /// Добавляет новость в избранное
  Future<void> addToFavorites(String newsId);

  /// Удаляет новость из избранного
  Future<void> removeFromFavorites(String newsId);

  /// Получает избранные новости
  Future<List<Map<String, dynamic>>> getFavoriteNews();

  /// Поиск новостей
  Future<List<Map<String, dynamic>>> searchNews({
    required String query,
    int page = 1,
  });
} 