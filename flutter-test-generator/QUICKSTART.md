# Быстрый старт Flutter Test Generator

## 1. Установка

1. Скачайте `.vsix` файл плагина, или выполните `npm run compile` из директории плагина и запустите проект - F5
2. В VS Code: Extensions → "..." → Install from VSIX
3. Выберите скачанный файл

## 2. Подготовка проекта

Убедитесь что ваш Flutter проект имеет структуру:

```
lib/
├── features/
│   └── [название_фичи]/
│       ├── bloc/ (или cubit/)
│       │   ├── [имя]_bloc.dart
│       │   ├── [имя]_event.dart  (только для Bloc)
│       │   └── [имя]_state.dart
├── domain/
│   ├── repositories/
│   └── services/
```

## 3. Использование

1. Откройте файл Bloc/Cubit/Dto/Файл с методом (например, `auth_login_bloc.dart`)
2. Нажмите `Ctrl+Shift+P`, когда курсор находится на названии класса (начало файла, именно объявление)
3. Введите "Flutter: Generate Test"
4. Плагин автоматически создаст тесты в `test/features/[название_фичи]/`, включая тест выбранного объекта, общий исполнительный файл фичи, а так же обновит (или создаст) общий исполнительный файл всех тестов проекта

## 4. Что получите

Структура тестов:

```
test/
├── features/
│   └── [название_фичи]/
│       ├── bloc/ (или cubit/)
│       │   └── [имя]_bloc(или cubit)_test.dart   - тест кубита/блока
|       ├── dto
|       |   └── [имя]_dto_test.dart               - тест дто
|       ├── [имя]_test.dart                       - общий тест фичи
├── unit_test/
│   ├── method1/
│   └── method2/
├── test.dart                                     - общий тест всех фичей
```

- ✅ Полные unit-тесты с mock объектами (возможны ручные доработки)
- ✅ Тесты для всех методов/событий, которые изменяют состояние
- ✅ Проверка начального состояния
- ✅ Комбинированные тесты, состоящие из последовательных вызовов нескольких методов/событий
- ✅ Визуализация автомата состояний и тестовых множеств
- ✅ Автоматическое форматирование

## 5. Пример результата

```dart
blocTest<AuthLoginBloc, AuthLoginState>(
  'AuthLoginUserEvent должен эмитировать Loading -> Success',
  build: () {
    when(() => mockAuthRepository.performAuthorization(
      email: any(named: 'email'),
      password: any(named: 'password'),
    )).thenAnswer((_) async => {'token': 'test_token'});
    
    return authLoginBloc;
  },
  act: (bloc) => bloc.add(const AuthLoginUserEvent(
    email: 'test@test.com',
    password: 'password123',
  )),
  expect: () => [
    const AuthLoadingLoginState(),
    const AuthSuccessLoginState(),
  ],
);
```