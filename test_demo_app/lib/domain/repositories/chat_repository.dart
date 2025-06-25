/// Интерфейс репозитория для работы с чатом и сообщениями
abstract class IChatRepository {
  /// Подключается к чату
  Future<void> connectToChat({
    required String chatId,
    required String userId,
  });

  /// Отключается от чата
  Future<void> disconnectFromChat(String chatId);

  /// Получает сообщения чата с пагинацией
  Future<List<Map<String, dynamic>>> getMessages({
    required String chatId,
    int page = 1,
  });

  /// Отправляет сообщение в чат
  Future<Map<String, dynamic>> sendMessage({
    required String chatId,
    required String message,
    required String senderId,
    String? replyToMessageId,
  });

  /// Отмечает сообщения как прочитанные
  Future<void> markMessagesAsRead({
    required String chatId,
    required List<String> messageIds,
  });

  /// Получает информацию о чате
  Future<Map<String, dynamic>> getChatInfo(String chatId);

  /// Получает список участников чата
  Future<List<Map<String, dynamic>>> getChatParticipants(String chatId);
} 