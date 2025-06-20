"use strict";
/**
 * Утилитарные функции и константы для генератора тестов
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractFeatureName = exports.groupBy = exports.safeMapGet = exports.deduplicateBy = exports.escapeRegex = exports.isValidDartIdentifier = exports.generateMockVariableName = exports.generateMockName = exports.classifyDependency = exports.extractMethodName = exports.hasSignificantCodeAfter = exports.cleanCode = exports.createTransitionKey = exports.getStateTypeConfig = exports.toPascalCase = exports.toSnakeCase = exports.REGEX_PATTERNS = exports.STATE_NAME_PATTERNS = exports.STATE_TYPE_CONFIG = void 0;
// ===== КОНСТАНТЫ =====
/**
 * Словарь типов состояний и их цветов для графов
 */
exports.STATE_TYPE_CONFIG = {
    initial: { color: 'lightgreen', label: '(начальное)' },
    loading: { color: 'lightyellow', label: '(загрузка)' },
    error: { color: 'lightcoral', label: '(ошибка)' },
    success: { color: 'lightblue', label: '(успех)' },
    default: { color: 'lightcyan', label: '(состояние)' }
};
/**
 * Паттерны для классификации состояний по именам
 */
exports.STATE_NAME_PATTERNS = {
    initial: ['initial', 'idle'],
    loading: ['loading', 'waiting', 'progress'],
    error: ['error', 'failure', 'fail'],
    success: ['success', 'loaded', 'complete']
};
/**
 * Общие регулярные выражения для парсинга
 */
exports.REGEX_PATTERNS = {
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
};
// ===== УТИЛИТАРНЫЕ ФУНКЦИИ =====
/**
 * Преобразует строку в snake_case
 * @param str - исходная строка
 * @returns строка в snake_case формате
 */
function toSnakeCase(str) {
    return str.replace(/([A-Z])/g, '_$1')
        .toLowerCase()
        .replace(/^_/, '');
}
exports.toSnakeCase = toSnakeCase;
/**
 * Преобразует snake_case в PascalCase
 * @param str - строка в snake_case
 * @returns строка в PascalCase
 */
function toPascalCase(str) {
    return str.split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join('');
}
exports.toPascalCase = toPascalCase;
/**
 * Определяет тип состояния по его имени
 * @param stateName - имя состояния
 * @returns конфигурация типа состояния
 */
function getStateTypeConfig(stateName) {
    const nameLower = stateName.toLowerCase();
    for (const [type, patterns] of Object.entries(exports.STATE_NAME_PATTERNS)) {
        if (patterns.some(pattern => nameLower.includes(pattern))) {
            return exports.STATE_TYPE_CONFIG[type];
        }
    }
    return exports.STATE_TYPE_CONFIG.default;
}
exports.getStateTypeConfig = getStateTypeConfig;
/**
 * Создает уникальный ключ для перехода в автомате состояний
 * @param from - начальное состояние
 * @param method - метод/событие
 * @param to - конечное состояние
 * @returns уникальный ключ перехода
 */
function createTransitionKey(from, method, to) {
    return `${from}-${method}-${to}`;
}
exports.createTransitionKey = createTransitionKey;
/**
 * Удаляет комментарии и лишние пробелы из кода
 * @param code - исходный код
 * @returns очищенный код
 */
function cleanCode(code) {
    return code
        .replace(/\/\/.*$/gm, '') // однострочные комментарии
        .replace(/\/\*[\s\S]*?\*\//g, '') // многострочные комментарии
        .replace(/\s+/g, ' ') // множественные пробелы
        .trim();
}
exports.cleanCode = cleanCode;
/**
 * Проверяет, содержит ли код значимые инструкции после заданной позиции
 * @param code - код для проверки
 * @param afterPosition - позиция для проверки
 * @returns true если есть значимый код
 */
function hasSignificantCodeAfter(code, afterPosition) {
    const remainingCode = cleanCode(code.substring(afterPosition));
    return /(?:try\s*{|switch\s*\(|if\s*\(|await\s+\w+|\w+\s*=|\w+\.\w+\s*\()/.test(remainingCode);
}
exports.hasSignificantCodeAfter = hasSignificantCodeAfter;
/**
 * Извлекает имя метода из вызова метода
 * @param methodCall - строка с вызовом метода (например, "repository.login(")
 * @returns имя метода без скобок
 */
function extractMethodName(methodCall) {
    return methodCall.slice(0, -1); // убираем последнюю скобку
}
exports.extractMethodName = extractMethodName;
/**
 * Классифицирует зависимость по типу
 * @param type - тип зависимости
 * @returns категория зависимости
 */
function classifyDependency(type) {
    const typeLower = type.toLowerCase();
    if (typeLower.includes('repository') || typeLower.includes('repo')) {
        return 'repository';
    }
    else if (typeLower.includes('storage') || typeLower.includes('secure')) {
        return 'storage';
    }
    else if (typeLower.includes('service')) {
        return 'service';
    }
    else {
        return 'other';
    }
}
exports.classifyDependency = classifyDependency;
/**
 * Генерирует mock имя для зависимости
 * @param type - тип зависимости
 * @returns имя mock класса
 */
function generateMockName(type) {
    return `Mock${type.replace(/^I/, '')}`;
}
exports.generateMockName = generateMockName;
/**
 * Генерирует имя переменной mock
 * @param type - тип зависимости
 * @returns имя переменной mock
 */
function generateMockVariableName(type) {
    return `mock${type.replace(/^I/, '')}`;
}
exports.generateMockVariableName = generateMockVariableName;
/**
 * Проверяет, является ли строка валидным Dart идентификатором
 * @param str - строка для проверки
 * @returns true если валидный идентификатор
 */
function isValidDartIdentifier(str) {
    return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(str);
}
exports.isValidDartIdentifier = isValidDartIdentifier;
/**
 * Экранирует специальные символы для использования в регулярных выражениях
 * @param str - строка для экранирования
 * @returns экранированная строка
 */
function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
exports.escapeRegex = escapeRegex;
/**
 * Дедуплицирует массив объектов по ключу
 * @param array - массив для дедупликации
 * @param keyExtractor - функция извлечения ключа
 * @returns массив без дубликатов
 */
function deduplicateBy(array, keyExtractor) {
    const seen = new Set();
    return array.filter(item => {
        const key = keyExtractor(item);
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
}
exports.deduplicateBy = deduplicateBy;
/**
 * Безопасно получает значение из Map с fallback
 * @param map - карта для поиска
 * @param key - ключ для поиска
 * @param fallback - значение по умолчанию
 * @returns значение из карты или fallback
 */
function safeMapGet(map, key, fallback) {
    var _a;
    return (_a = map.get(key)) !== null && _a !== void 0 ? _a : fallback;
}
exports.safeMapGet = safeMapGet;
/**
 * Группирует массив по ключу
 * @param array - массив для группировки
 * @param keyExtractor - функция извлечения ключа
 * @returns Map с группами
 */
function groupBy(array, keyExtractor) {
    var _a;
    const groups = new Map();
    for (const item of array) {
        const key = keyExtractor(item);
        const group = (_a = groups.get(key)) !== null && _a !== void 0 ? _a : [];
        group.push(item);
        groups.set(key, group);
    }
    return groups;
}
exports.groupBy = groupBy;
/**
 * Извлекает имя фичи из пути к файлу
 * @param filePath - полный путь к файлу
 * @returns имя фичи или null, если не найдено
 */
function extractFeatureName(filePath) {
    const separator = filePath.includes('/') ? '/' : '\\';
    const parts = filePath.split(separator);
    const featuresIndex = parts.indexOf('features');
    if (featuresIndex !== -1 && featuresIndex + 1 < parts.length) {
        return parts[featuresIndex + 1];
    }
    return null;
}
exports.extractFeatureName = extractFeatureName;
//# sourceMappingURL=utils.js.map