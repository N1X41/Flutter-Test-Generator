/// Интерфейс репозитория для работы с платежами
abstract class IPaymentRepository {
  /// Инициализирует платеж
  Future<Map<String, dynamic>> initializePayment({
    required double amount,
    required String currency,
    required String paymentMethod,
    required Map<String, dynamic> additionalData,
  });

  /// Подтверждает платеж
  Future<Map<String, dynamic>> confirmPayment({
    required String paymentId,
    required String confirmationCode,
  });

  /// Обрабатывает платеж
  Future<Map<String, dynamic>> processPayment({
    required String paymentId,
    required Map<String, dynamic> processingData,
  });

  /// Отменяет платеж
  Future<void> cancelPayment({
    required String paymentId,
    required String reason,
  });

  /// Получает статус платежа
  Future<Map<String, dynamic>> getPaymentStatus(String paymentId);

  /// Получает историю платежей
  Future<List<Map<String, dynamic>>> getPaymentHistory({
    int page = 1,
    int limit = 20,
  });

  /// Возвращает средства
  Future<Map<String, dynamic>> refundPayment({
    required String paymentId,
    required double amount,
    required String reason,
  });
} 