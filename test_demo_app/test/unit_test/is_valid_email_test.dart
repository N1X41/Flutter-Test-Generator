import 'package:flutter_test/flutter_test.dart';
import 'package:test_demo_app/features/auth_login/methods/auth_login_methods.dart';

void main() {
  group('Тестирование метода isValidEmail', () {
    test('Тест для копирования', () {
      final result = isValidEmail();
      const expected = null; // Заполните ожидаемое значение
      expect(result, expected);
    });
  });
}