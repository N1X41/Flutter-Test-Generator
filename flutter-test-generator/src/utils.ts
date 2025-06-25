/**
 * Утилитарные функции и константы для генератора тестов
 */

// ===== КОНСТАНТЫ =====

/**
 * Словарь типов состояний и их цветов для графов
 */
export const STATE_TYPE_CONFIG = {
    initial: { color: 'lightgreen', label: '(начальное)' },
    loading: { color: 'lightyellow', label: '(загрузка)' },
    error: { color: 'lightcoral', label: '(ошибка)' },
    success: { color: 'lightblue', label: '(успех)' },
    default: { color: 'lightcyan', label: '(состояние)' }
} as const;

/**
 * Паттерны для классификации состояний по именам
 */
export const STATE_NAME_PATTERNS = {
    initial: ['initial', 'idle'],
    loading: ['loading', 'waiting', 'progress'],
    error: ['error', 'failure', 'fail'],
    success: ['success', 'loaded', 'complete']
} as const;

/**
 * Общие регулярные выражения для парсинга
 */
export const REGEX_PATTERNS = {
    // Основные паттерны для поиска вызовов методов
    privateMethod: /_\w+\(/g,
    repository: /(?:final\s+)?(?:_)?(\w*[Rr]epository|\w*[Rr]epo)\.\w+\(/g,
    storage: /(?:final\s+)?(?:_)?(secureStorage|storage|_storage|localStorage|_secureStorage)\.\w+\(/g,
    guardCondition: /if\s*\(\s*state\s+is\s+(\w+)\s*\)\s*return\s*;/g,
    
    // Расширенные паттерны для поиска вызовов зависимостей
    anyRepositoryCall: /(?:^|[^a-zA-Z0-9_])(_?\w*[Rr]epository|_?\w*[Rr]epo)\.\w+\s*\(/g,
    anyStorageCall: /(?:^|[^a-zA-Z0-9_])(_?secureStorage|_?storage|_?localStorage|_?storageService|_?\w*Storage)\.\w+\s*\(/g,
    anyServiceCall: /(?:^|[^a-zA-Z0-9_])(_?\w*[Ss]ervice)\.\w+\s*\(/g,
    
    // Паттерны для блоков управления потоком
    breakStatement: /break\s*;/,
    emitStatement: /emit\s*\(\s*(?:const\s+)?(\w+)\s*\([^)]*\)\s*\)/g,
    
    // Паттерны для типов и зависимостей
    dependency: /final\s+(\w+)\s+_(\w+);/g
} as const;

// ===== УТИЛИТАРНЫЕ ФУНКЦИИ =====

/**
 * Преобразует строку в snake_case
 * @param str - исходная строка
 * @returns строка в snake_case формате
 */
export function toSnakeCase(str: string): string {
    return str.replace(/([A-Z])/g, '_$1')
              .toLowerCase()
              .replace(/^_/, '');
}

/**
 * Преобразует snake_case в PascalCase
 * @param str - строка в snake_case
 * @returns строка в PascalCase
 */
export function toPascalCase(str: string): string {
    return str.split('_')
             .map(word => word.charAt(0).toUpperCase() + word.slice(1))
             .join('');
}

/**
 * Определяет тип состояния по его имени
 * @param stateName - имя состояния
 * @returns конфигурация типа состояния
 */
export function getStateTypeConfig(stateName: string): { color: string; label: string } {
    const nameLower = stateName.toLowerCase();
    
    for (const [type, patterns] of Object.entries(STATE_NAME_PATTERNS)) {
        if (patterns.some(pattern => nameLower.includes(pattern))) {
            return STATE_TYPE_CONFIG[type as keyof typeof STATE_TYPE_CONFIG];
        }
    }
    
    return STATE_TYPE_CONFIG.default;
}

/**
 * Создает уникальный ключ для перехода в автомате состояний
 * @param from - начальное состояние
 * @param method - метод/событие
 * @param to - конечное состояние
 * @returns уникальный ключ перехода
 */
export function createTransitionKey(from: string, method: string, to: string): string {
    return `${from}-${method}-${to}`;
}

/**
 * Удаляет комментарии и лишние пробелы из кода
 * @param code - исходный код
 * @returns очищенный код
 */
export function cleanCode(code: string): string {
    return code
        .replace(/\/\/.*$/gm, '')           // однострочные комментарии
        .replace(/\/\*[\s\S]*?\*\//g, '')  // многострочные комментарии
        .replace(/\s+/g, ' ')              // множественные пробелы
        .trim();
}

/**
 * Проверяет, содержит ли код значимые инструкции после заданной позиции
 * @param code - код для проверки
 * @param afterPosition - позиция для проверки
 * @returns true если есть значимый код
 */
export function hasSignificantCodeAfter(code: string, afterPosition: number): boolean {
    const remainingCode = cleanCode(code.substring(afterPosition));
    return /(?:try\s*{|switch\s*\(|if\s*\(|await\s+\w+|\w+\s*=|\w+\.\w+\s*\()/.test(remainingCode);
}

/**
 * Извлекает имя метода из вызова метода
 * @param methodCall - строка с вызовом метода (например, "repository.login(")
 * @returns имя метода без скобок
 */
export function extractMethodName(methodCall: string): string {
    return methodCall.slice(0, -1); // убираем последнюю скобку
}

/**
 * Классифицирует зависимость по типу
 * @param type - тип зависимости
 * @returns категория зависимости
 */
export function classifyDependency(type: string): 'repository' | 'service' | 'storage' | 'other' {
    const typeLower = type.toLowerCase();
    
    if (typeLower.includes('repository') || typeLower.includes('repo')) {
        return 'repository';
    } else if (typeLower.includes('storage') || typeLower.includes('secure')) {
        return 'storage';
    } else if (typeLower.includes('service')) {
        return 'service';
    } else {
        return 'other';
    }
}

/**
 * Генерирует mock имя для зависимости
 * @param type - тип зависимости
 * @returns имя mock класса
 */
export function generateMockName(type: string): string {
    return `Mock${type.replace(/^I/, '')}`;
}

/**
 * Генерирует имя переменной mock
 * @param type - тип зависимости
 * @returns имя переменной mock
 */
export function generateMockVariableName(type: string): string {
    return `mock${type.replace(/^I/, '')}`;
}

/**
 * Проверяет, является ли строка валидным Dart идентификатором
 * @param str - строка для проверки
 * @returns true если валидный идентификатор
 */
export function isValidDartIdentifier(str: string): boolean {
    return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(str);
}

/**
 * Экранирует специальные символы для использования в регулярных выражениях
 * @param str - строка для экранирования
 * @returns экранированная строка
 */
export function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Дедуплицирует массив объектов по ключу
 * @param array - массив для дедупликации
 * @param keyExtractor - функция извлечения ключа
 * @returns массив без дубликатов
 */
export function deduplicateBy<T>(array: T[], keyExtractor: (item: T) => string): T[] {
    const seen = new Set<string>();
    return array.filter(item => {
        const key = keyExtractor(item);
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
}

/**
 * Безопасно получает значение из Map с fallback
 * @param map - карта для поиска
 * @param key - ключ для поиска
 * @param fallback - значение по умолчанию
 * @returns значение из карты или fallback
 */
export function safeMapGet<K, V>(map: Map<K, V>, key: K, fallback: V): V {
    return map.get(key) ?? fallback;
}

/**
 * Группирует массив по ключу
 * @param array - массив для группировки
 * @param keyExtractor - функция извлечения ключа
 * @returns Map с группами
 */
export function groupBy<T>(array: T[], keyExtractor: (item: T) => string): Map<string, T[]> {
    const groups = new Map<string, T[]>();
    
    for (const item of array) {
        const key = keyExtractor(item);
        const group = groups.get(key) ?? [];
        group.push(item);
        groups.set(key, group);
    }
    
    return groups;
}

/**
 * Извлекает имя фичи из пути к файлу
 * @param filePath - полный путь к файлу
 * @returns имя фичи или null, если не найдено
 */
export function extractFeatureName(filePath: string): string | null {
    const separator = filePath.includes('/') ? '/' : '\\';
    const parts = filePath.split(separator);
    const featuresIndex = parts.indexOf('features');
    
    if (featuresIndex !== -1 && featuresIndex + 1 < parts.length) {
        return parts[featuresIndex + 1];
    }
    
    return null;
} 