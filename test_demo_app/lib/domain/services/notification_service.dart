/// Интерфейс сервиса для работы с уведомлениями
abstract class INotificationService {
  /// Инициализирует сервис уведомлений
  Future<void> initialize();

  /// Показывает локальное уведомление
  Future<void> showNotification({
    required String title,
    required String body,
    String? payload,
  });

  /// Планирует уведомление на определенное время
  Future<void> scheduleNotification({
    required int id,
    required String title,
    required String body,
    required DateTime scheduledDate,
  });

  /// Отменяет запланированное уведомление
  Future<void> cancelNotification(int id);

  /// Отменяет все уведомления
  Future<void> cancelAllNotifications();

  /// Получает токен для push-уведомлений
  Future<String?> getDeviceToken();
} 