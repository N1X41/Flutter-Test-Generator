import 'package:flutter_test/flutter_test.dart';
import 'package:test_demo_app/features/auth_login/dto/auth_login_dto.dart';
import 'package:test_demo_app/features/auth_login/dto/auth_login_entity.dart';

const _authlogindtoData = {
  'access_token': 'test', // Переменная типа String
  'refresh_token': 'test', // Переменная типа String
};

final _expected = AuthLoginEntity(
  accessToken: 'test', // Переменная типа String
  refreshToken: 'test', // Переменная типа String
);

void main() {
  group('Сценарий парсинга AuthLoginDto', () {
    
    test('Проверка парсинга AuthLoginDto с правильными данными', () {
      final result = AuthLoginDto.fromJson(_authlogindtoData).toEntity();
      expect(result, _expected);
    });
    test('Проверка парсинга AuthLoginDto, если пришло лишнее поле', () {
      final data = Map<String, dynamic>.from(_authlogindtoData)..['test'] = 'test';
      final result = AuthLoginDto.fromJson(data).toEntity();
      expect(result, _expected);
    });
    test('Проверка парсинга AuthLoginDto, если поле access_token не пришло', () {
      final data = Map<String, dynamic>.from(_authlogindtoData)..remove('access_token');
      expect(() => AuthLoginDto.fromJson(data).toEntity(), throwsA(isA<TypeError>()));
    });
    test('Проверка парсинга AuthLoginDto, если поле access_token неправильного типа', () {
      final data = Map<String, dynamic>.from(_authlogindtoData)..update('access_token', (_) => 0);
      expect(() => AuthLoginDto.fromJson(data).toEntity(), throwsA(isA<TypeError>()));
    });
    test('Проверка парсинга AuthLoginDto, если поле refresh_token не пришло', () {
      final data = Map<String, dynamic>.from(_authlogindtoData)..remove('refresh_token');
      expect(() => AuthLoginDto.fromJson(data).toEntity(), throwsA(isA<TypeError>()));
    });
    test('Проверка парсинга AuthLoginDto, если поле refresh_token неправильного типа', () {
      final data = Map<String, dynamic>.from(_authlogindtoData)..update('refresh_token', (_) => 0);
      expect(() => AuthLoginDto.fromJson(data).toEntity(), throwsA(isA<TypeError>()));
    });
  });
}