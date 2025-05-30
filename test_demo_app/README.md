# Тестовый Flutter проект для демонстрации плагина автогенерации тестов

Этот проект создан специально для демонстрации возможностей плагина автоматической генерации тестов для Flutter Bloc/Cubit компонентов. Проект содержит **10 полноценных фич** с различными типами логики для всестороннего тестирования плагина.

## 📊 Статистика готовности проекта

### ✅ **ПОЛНОСТЬЮ ГОТОВЫЕ ФИЧИ: 10 из 10 (100%)**

#### 🏗️ **Блоки (5 штук) - сложная логика:**

1. **AuthLoginBloc** ✅ **ГОТОВ**
   - 5 состояний (Initial, Loading, Success, Error, Validation)
   - 5 событий с различными параметрами
   - Guard условия (`if (state is AuthLoadingLoginState) return`)
   - Try-catch блоки с обработкой ошибок
   - Приватный метод `_writeLoginData()`
   - 2 зависимости (AuthRepository, SecureStorageService)

2. **UserProfileBloc** ✅ **ГОТОВ**
   - 6 состояний (Initial, Loading, Loaded, Error, Updating, Updated)
   - 5 событий (Load, Update, UploadAvatar, DeleteAccount, Reset)
   - Guard условия и сложная логика переходов
   - Try-catch блоки с типизированными исключениями
   - Приватные методы для кэширования (`_cacheProfile`, `_clearProfileCache`)
   - 2 зависимости (UserRepository, SecureStorageService)

3. **NewsFeedBloc** ✅ **ГОТОВ**
   - 7 состояний (Initial, Loading, Loaded, Error, LoadingMore, Searching, SearchResults)
   - 6 событий (Load, LoadMore, Search, AddToFavorites, RemoveFromFavorites, Reset)
   - Сложная логика пагинации и поиска
   - Guard условия для предотвращения дублирования запросов
   - Приватные методы для кэширования и обновления статуса
   - 2 зависимости (NewsRepository, SecureStorageService)

4. **ChatMessagingBloc** ✅ **ГОТОВ**
   - 7 состояний (Initial, Loading, Loaded, SendingMessage, MessageSent, Error, Connecting)
   - 6 событий (Connect, LoadMessages, SendMessage, LoadMore, MarkAsRead, Disconnect)
   - Сложная логика подключения к чату и управления сообщениями
   - Guard условия для различных состояний
   - Множественные приватные методы для кэширования
   - 2 зависимости (ChatRepository, SecureStorageService)

5. **PaymentProcessingBloc** ✅ **ГОТОВ**
   - 7 состояний (Initial, Initializing, Pending, InProgress, Success, Error, Cancelled)
   - 6 событий (Initialize, Confirm, Process, Cancel, CheckStatus, Reset)
   - Сложная логика обработки платежей с множественными переходами
   - Guard условия для предотвращения некорректных операций
   - Приватные методы для кэширования и управления данными платежей
   - 2 зависимости (PaymentRepository, SecureStorageService)

#### ⚙️ **Кубиты (5 штук) - разнообразная логика:**

1. **ThemeSettingsCubit** ✅ **ГОТОВ**
   - 5 состояний (Initial, Light, Dark, System, Loading)
   - Arrow functions: `void setLightTheme() => emit(const ThemeLightState())`
   - Async методы с try-catch для загрузки настроек
   - 1 зависимость (SecureStorageService)

2. **LanguageSelectorCubit** ✅ **ГОТОВ**
   - 5 состояний (Initial, Russian, English, German, Loading)
   - Комбинация arrow functions и async методов
   - Логика загрузки сохраненного языка
   - 1 зависимость (SecureStorageService)

3. **NotificationToggleCubit** ✅ **ГОТОВ**
   - 6 состояний (Initial, Enabled, Disabled, PushEnabled, EmailEnabled, Loading)
   - Комбинация arrow functions и сложных async методов
   - Приватные методы для управления уведомлениями
   - 2 зависимости (SecureStorageService, NotificationService)

4. **SearchFilterCubit** ✅ **ГОТОВ**
   - 5 состояний (Initial, Applied, Cleared, Loading, Saving)
   - Сложная логика управления фильтрами поиска
   - Приватные методы для парсинга и сохранения фильтров
   - 1 зависимость (SecureStorageService)

5. **FavoritesManagerCubit** ✅ **ГОТОВ**
   - 6 состояний (Initial, Loading, Loaded, Empty, Syncing, Error)
   - Сложная логика синхронизации с сервером
   - Приватные методы для кэширования и объединения данных
   - 2 зависимости (NewsRepository, SecureStorageService)

## 🎯 Особенности для тестирования плагина

### 📈 **Статистика компонентов:**
- **Общее количество состояний**: 58 состояний
- **Общее количество событий/методов**: 53 события и метода
- **Приватные методы**: 25+ приватных методов
- **Зависимости**: 15 различных зависимостей
- **Guard условия**: Присутствуют во всех блоках
- **Try-catch блоки**: Во всех async методах

### 🔧 **Типы логики для тестирования:**

#### **Простые паттерны:**
- Arrow functions (`void method() => emit(state)`)
- Простые async методы
- Базовые переходы состояний

#### **Сложные паттерны:**
- Guard условия (`if (state is SomeState) return`)
- Вложенные try-catch блоки
- Цепочки событий (`add(AnotherEvent())`)
- Приватные методы с бизнес-логикой
- Кэширование и синхронизация данных

#### **Разнообразные зависимости:**
- Репозитории (AuthRepository, UserRepository, NewsRepository, ChatRepository, PaymentRepository)
- Сервисы (SecureStorageService, NotificationService)
- Различные комбинации зависимостей (1-2 на компонент)

## 🧪 Готовность для демонстрации плагина

Проект **полностью готов** для демонстрации всех возможностей плагина автогенерации тестов:

### ✅ **Парсинг кода:**
- Различные типы состояний и событий
- Сложные методы с guard условиями
- Приватные методы и их вызовы
- Зависимости и их использование

### ✅ **Построение автоматов состояний:**
- Простые переходы (arrow functions)
- Сложные переходы с условиями
- Множественные пути выполнения
- Обработка ошибок

### ✅ **Генерация тестов:**
- Моки для всех типов зависимостей
- Тесты успешных и ошибочных сценариев
- Проверка guard условий
- Тестирование приватных методов через публичные

### ✅ **Визуализация:**
- Автоматы состояний различной сложности
- Тестовые пути с цветовой кодировкой
- Graphviz диаграммы для анализа

## 🚀 Использование

1. Откройте любой файл блока или кубита в VS Code
2. Используйте команду плагина для генерации тестов
3. Наблюдайте автоматическое создание:
   - Полноценных тестовых файлов
   - Моков для зависимостей
   - Диаграмм автоматов состояний
   - Визуализации тестовых путей

## 📁 Структура проекта

```
test_demo_app/
├── lib/
│   ├── domain/
│   │   ├── repositories/          # Интерфейсы репозиториев
│   │   └── services/             # Интерфейсы сервисов
│   └── features/                 # 10 полноценных фич
│       ├── auth_login/           # Блок авторизации
│       ├── user_profile/         # Блок профиля
│       ├── news_feed/            # Блок новостей
│       ├── chat_messaging/       # Блок чата
│       ├── payment_processing/   # Блок платежей
│       ├── theme_settings/       # Кубит темы
│       ├── language_selector/    # Кубит языка
│       ├── notification_toggle/  # Кубит уведомлений
│       ├── search_filter/        # Кубит фильтров
│       └── favorites_manager/    # Кубит избранного
└── test/                         # Автогенерированные тесты
```

## 🎉 Результат

Проект представляет собой **идеальную демонстрационную площадку** для плагина автогенерации тестов, содержащую все возможные сценарии использования Flutter Bloc/Cubit паттернов от простейших arrow functions до сложных многоуровневых автоматов состояний с guard условиями и приватными методами. 