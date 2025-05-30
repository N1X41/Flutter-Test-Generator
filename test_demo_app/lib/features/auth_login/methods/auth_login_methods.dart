/// Форматирует имя пользователя, добавляя префикс и обрезая пробелы
///
/// Принимает:
/// - [name] - имя пользователя
/// - [prefix] - префикс для добавления
/// Возвращает отформатированную строку
String formatUserName(String name, {String prefix = 'User_'}) {
  final trimmedName = name.trim();
  if (trimmedName.isEmpty) return prefix + 'Anonymous';
  return prefix + trimmedName.replaceAll(' ', '_');
}

/// Вычисляет общее количество страниц на основе количества элементов и размера страницы
///
/// Принимает:
/// - [itemCount] - общее количество элементов
/// - [pageSize] - размер страницы
/// Возвращает количество страниц, округленное вверх
int calculateTotalPages(int itemCount, int pageSize) {
  if (itemCount <= 0 || pageSize <= 0) return 1;
  return (itemCount / pageSize).ceil();
}

/// Проверяет, является ли email действительным по простому шаблону
///
/// Принимает:
/// - [email] - адрес электронной почты
/// Возвращает true, если email соответствует базовому формату
bool isValidEmail(String email) {
  final emailRegex = RegExp(r'^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$');
  return emailRegex.hasMatch(email);
}