/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ([
/* 0 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(__webpack_require__(1));
const path = __importStar(__webpack_require__(2));
// Используем API файловой системы VS Code вместо 'fs' для лучшей интеграции
// import * as fs from 'fs'; // Заменено на vscode.workspace.fs
// --- Активация расширения ---
function activate(context) {
    console.log('Расширение "flutter-test-generator" активировано!');
    // Регистрация провайдера Code Actions для Dart файлов
    context.subscriptions.push(vscode.languages.registerCodeActionsProvider('dart', new DartMethodActionProvider(), {
        providedCodeActionKinds: [vscode.CodeActionKind.RefactorExtract, vscode.CodeActionKind.QuickFix] // Какие типы действий предоставляем
    }));
    // Регистрация самой команды, которая будет вызываться из Code Action
    context.subscriptions.push(vscode.commands.registerCommand('flutter-test-generator.generateTest', generateTestHandler));
}
// --- Деактивация расширения (обычно для очистки ресурсов) ---
function deactivate() { }
// --- Провайдер Code Actions ---
class DartMethodActionProvider {
    provideCodeActions(document, range, context, token) {
        // 1. Получаем позицию курсора
        const position = range.start;
        // 2. Получаем строку, на которой стоит курсор
        const line = document.lineAt(position.line);
        // 3. Простая проверка (улучшим позже): ищем что-то похожее на объявление метода
        //    Формат: [тип] имяМетода( [параметры...] ) { или =>
        //    Это ОЧЕНЬ упрощенный regex, не учитывает async, =>, static, generic и т.д.
        //    Нужно будет значительно улучшить с помощью парсинга!
        //    Regex немного улучшен для поиска имени метода
        const methodRegex = /(?:^|\s)([\w<>?,\s*&]+)\s+([a-zA-Z_][\w]*)\s*\(/;
        const match = line.text.match(methodRegex);
        if (match) {
            const methodName = match[2]; // Имя метода
            // Проверяем, находится ли курсор в пределах имени метода
            const methodNameIndex = line.text.indexOf(methodName, match.index); // Ищем имя после найденного совпадения
            if (methodNameIndex === -1)
                return undefined; // Не нашли имя там, где ожидали
            const methodNameEndIndex = methodNameIndex + methodName.length;
            if (position.character >= methodNameIndex && position.character <= methodNameEndIndex) {
                // Создаем Code Action (пункт в "More Actions...")
                const action = new vscode.CodeAction('Generate test', vscode.CodeActionKind.RefactorExtract); // Или QuickFix
                // Указываем команду, которая будет выполнена при выборе этого действия
                // Передаем необходимые данные в команду
                action.command = {
                    command: 'flutter-test-generator.generateTest',
                    title: 'Generate test for method', // Название в меню
                    tooltip: `Сгенерировать unit-тест для метода ${methodName}.`, // Подсказка
                    arguments: [methodName, document.uri, range] // Передаем имя метода, URI документа и позицию/выделение
                };
                return [action];
            }
        }
        return undefined; // Нет подходящих действий
    }
}
// --- Обработчик команды генерации теста ---
async function generateTestHandler(methodName, sourceFileUri, range) {
    if (!methodName) {
        vscode.window.showErrorMessage('Не удалось определить имя метода.');
        return;
    }
    // 1. Получаем корневую папку проекта
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(sourceFileUri);
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('Не удалось найти рабочую папку. Пожалуйста, откройте Flutter проект.');
        return;
    }
    const projectRoot = workspaceFolder.uri.fsPath;
    // 2. Определяем путь к папке тестов
    const testDirPath = path.join(projectRoot, 'test', 'unit_tests');
    const testDirUri = vscode.Uri.file(testDirPath); // Используем Uri для работы с fs API
    // 3. Определяем имя файла теста (конвертируем CamelCase/PascalCase в snake_case)
    const testFileName = toSnakeCase(methodName) + '_test.dart'; // Добавляем _test суффикс по соглашению Dart
    const testFilePath = path.join(testDirPath, testFileName);
    const testFileUri = vscode.Uri.file(testFilePath);
    try {
        // 4. Получаем информацию об исходном методе
        const document = await vscode.workspace.openTextDocument(sourceFileUri);
        // --- Поиск комментариев /// ---
        let methodComments = '';
        let commentSearchLine = range.start.line - 1;
        while (commentSearchLine >= 0) {
            const lineText = document.lineAt(commentSearchLine).text.trim();
            if (lineText.startsWith('///')) {
                methodComments = lineText.substring(3).trim() + (methodComments ? '\n' + methodComments : ''); // Собираем комментарии снизу вверх
                commentSearchLine--;
            }
            else if (lineText.startsWith('@')) { // Пропускаем аннотации
                commentSearchLine--;
            }
            else {
                break; // Нашли строку не-комментарий и не аннотацию, останавливаемся
            }
        }
        methodComments = methodComments.trim();
        // --- Попытка получить ПОЛНЫЙ текст исходного метода (ЭВРИСТИКА) ---
        // ВНИМАНИЕ: Это ОЧЕНЬ ненадёжный эвристический метод!
        // Он НЕ учитывает корректно комментарии, строки, вложенные блоки произвольной глубины,
        // сложные сигнатуры и т.д. Требуется полноценный парсер Dart!
        let startLineIdx = range.start.line;
        let endLineIdx = startLineIdx;
        const documentLineCount = document.lineCount;
        // Ищем фактическое начало метода, пропуская комментарии и аннотации над ним
        let signatureLineIdx = range.start.line;
        while (signatureLineIdx > 0) {
            const prevLineText = document.lineAt(signatureLineIdx - 1).text.trim();
            if (prevLineText.startsWith('///') || prevLineText.startsWith('@')) {
                signatureLineIdx--;
            }
            else {
                break;
            }
        }
        startLineIdx = signatureLineIdx; // Запомнили найденное реальное начало
        let originalMethodCode = '';
        try {
            let braceLevel = 0;
            let foundBodyStart = false; // Нашли ли мы начало тела ({ или =>)
            let isArrowFunction = false; // Это стрелочная функция?
            let potentialEndLine = -1; // Строка, где баланс скобок стал 0
            // Основной цикл поиска конца метода
            for (let i = startLineIdx; i < documentLineCount; i++) {
                const lineText = document.lineAt(i).text;
                const trimmedLine = lineText.trim();
                // Простой поиск => (ПЕРЕД поиском {)
                if (!foundBodyStart && lineText.includes("=>")) {
                    // Нашли стрелочную функцию, теперь ищем ';'
                    // ВНИМАНИЕ: Очень ненадёжно, не учитывает многострочные выражения, ; в строках/комментариях
                    isArrowFunction = true;
                    foundBodyStart = true; // Считаем, что нашли начало
                    let searchSemicolonLine = i;
                    while (searchSemicolonLine < documentLineCount) {
                        const currentLineText = document.lineAt(searchSemicolonLine).text;
                        // Ищем точку с запятой, но не внутри строки (очень упрощенная проверка)
                        const semicolonIndex = currentLineText.indexOf(';');
                        if (semicolonIndex !== -1) {
                            // Простейшая проверка на комментарий
                            const commentIndex = currentLineText.indexOf('//');
                            if (commentIndex === -1 || semicolonIndex < commentIndex) {
                                endLineIdx = searchSemicolonLine;
                                break; // Нашли ; - это конец
                            }
                        }
                        // Если ; не найден на этой строке ИЛИ он в комментарии, идем дальше
                        if (searchSemicolonLine === i && !currentLineText.trim().endsWith(';')) {
                            // Если ; не в конце первой строки =>, ищем дальше
                            searchSemicolonLine++;
                            continue;
                        }
                        else if (searchSemicolonLine > i) {
                            // Если это не первая строка после =>, ищем дальше
                            searchSemicolonLine++;
                            continue;
                        }
                        else {
                            // ; в конце первой строки или не найдена - выходим
                            if (semicolonIndex !== -1)
                                endLineIdx = i; // Засчитаем конец на этой же строке
                            else
                                endLineIdx = i; // Не нашли ; - обрываем здесь (неверно, но лучше чем ничего)
                            break;
                        }
                    }
                    if (endLineIdx >= startLineIdx)
                        break; // Выходим из основного цикла, если нашли конец
                }
                // Поиск { и } для блочных функций (если не стрелочная)
                if (!isArrowFunction) {
                    // ВНИМАНИЕ: Не учитывает скобки в комментариях и строках!
                    for (let j = 0; j < lineText.length; j++) {
                        if (lineText[j] === '{') {
                            if (!foundBodyStart) {
                                foundBodyStart = true; // Нашли начало тела блока
                            }
                            braceLevel++;
                        }
                        else if (lineText[j] === '}') {
                            if (foundBodyStart) { // Уменьшаем уровень, только если тело уже началось
                                braceLevel--;
                                if (braceLevel === 0) {
                                    potentialEndLine = i; // Нашли парную закрывающую скобку
                                    break; // Выходим из цикла по символам строки
                                }
                            }
                        }
                    }
                }
                // Если нашли парную скобку для блока, запоминаем и выходим
                if (potentialEndLine !== -1) {
                    endLineIdx = potentialEndLine;
                    break; // Выходим из основного цикла по строкам
                }
                // Предохранитель: если тело началось, но мы ушли слишком далеко
                if (foundBodyStart && !isArrowFunction && i > startLineIdx + 150) { // Ограничение глубины поиска для блоков
                    console.warn(`[Flutter Test Generator] Поиск конца метода "${methodName}" остановлен: возможно, ошибка парсинга или очень длинный метод.`);
                    endLineIdx = i; // Обрываем по лимиту строк
                    break;
                }
                // Предохранитель для стрелочных функций
                if (isArrowFunction && i > startLineIdx + 50) {
                    console.warn(`[Flutter Test Generator] Поиск конца стрелочного метода "${methodName}" остановлен: возможно, не найдена ';' или сложное выражение.`);
                    endLineIdx = i; // Обрываем по лимиту строк
                    break;
                }
            } // конец основного цикла for по строкам
            // Если вообще не нашли начало тела ({ или =>), или конец оказался раньше начала - ошибка
            if (!foundBodyStart || endLineIdx < startLineIdx) {
                console.warn(`[Flutter Test Generator] Не удалось надежно определить границы метода "${methodName}". Будет использована только строка с сигнатурой.`);
                // Берем только исходную строку в этом случае
                originalMethodCode = document.lineAt(range.start.line).text;
            }
            else {
                // Извлекаем текст метода от найденного начала до найденного конца
                originalMethodCode = document.getText(new vscode.Range(new vscode.Position(startLineIdx, 0), // От начала стартовой строки
                // До конца найденной конечной строки
                new vscode.Position(endLineIdx, document.lineAt(endLineIdx).text.length)));
            }
        }
        catch (e) {
            console.error(`[Flutter Test Generator] Ошибка при эвристическом поиске тела метода "${methodName}":`, e);
            vscode.window.showWarningMessage(`Произошла ошибка при анализе кода метода "${methodName}". В тест будет добавлена только строка с сигнатурой.`);
            // В случае ошибки берем только строку с курсором
            originalMethodCode = document.lineAt(range.start.line).text;
        }
        // --- Определение типа возвращаемого значения (упрощенно) ---
        // Используем ту же строку, где был курсор (или первую строку метода)
        const signatureLineText = document.lineAt(range.start.line).text;
        // Улучшенный Regex для типа (захватывает слова, ?, <>)
        const returnTypeRegex = /^\s*([\w<>?,\s*&]+(?:\s*<[^>]+>)?)\s+[a-zA-Z_][\w]*\s*\(/;
        const typeMatch = signatureLineText.match(returnTypeRegex);
        // Пытаемся исключить async*, sync*, async, static из типа
        let returnType = typeMatch ? typeMatch[1].replace(/(async\*?|sync\*?|static)\s*/g, '').trim() : 'dynamic'; // По умолчанию dynamic
        if (!returnType || returnType === 'void') { // Если тип void или не найден, используем dynamic в тестах
            returnType = 'dynamic';
        }
        // 5. Генерируем содержимое файла теста
        const testContent = generate_summary_test(methodName, originalMethodCode, returnType, methodComments);
        // 6. Создаем папку /test/unit_tests, если ее нет
        // Используем API VS Code для создания папки (createDirectory рекурсивен)
        await vscode.workspace.fs.createDirectory(testDirUri);
        // 7. Создаем и записываем файл теста
        // Используем API VS Code для записи файла
        await vscode.workspace.fs.writeFile(testFileUri, Buffer.from(testContent, 'utf8'));
        // 8. Показываем сообщение и открываем созданный файл
        vscode.window.showInformationMessage(`Сгенерирован файл теста: ${testFilePath}`);
        vscode.window.showTextDocument(testFileUri);
    }
    catch (error) {
        console.error('[Flutter Test Generator] Ошибка при генерации файла теста:', error);
        vscode.window.showErrorMessage(`Не удалось сгенерировать файл теста: ${error.message || error}`);
    }
}
// --- Вспомогательные функции генерации (с русскими комментариями в выводе) ---
/**
 * Преобразует строку из camelCase или PascalCase в snake_case.
 */
function toSnakeCase(str) {
    if (!str)
        return '';
    // Улучшенный вариант, обрабатывающий аббревиатуры (типа URL -> url)
    return str
        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2') // Перед заглавной, если перед ней тоже заглавная+строчная (MyURLRequest -> My_URLRequest)
        .replace(/([a-z\d])([A-Z])/g, '$1_$2') // Перед заглавной, если перед ней строчная или цифра (myVariable -> my_Variable)
        .toLowerCase(); // Все в нижний регистр
}
/**
 * Генерирует итоговый текст файла теста.
 */
function generate_summary_test(methodName, originalMethodCode, returnType, methodComments) {
    const commentedOriginal = generateCommentedOriginal(originalMethodCode);
    const description = generateMethodDescription(methodName, returnType, methodComments);
    const testBody = generateTestBody(methodName);
    // Используем русские комментарии в шаблоне
    return `import 'package:flutter_test/flutter_test.dart';
// import 'package:имя_вашего_проекта/путь/к/вашему/файлу.dart'; // TODO: Импортируйте файл, содержащий тестируемый метод/класс

// --- Исходный метод ---
${commentedOriginal}

// --- Описание метода ---
${description}

void main() {
${testBody}
}
`;
}
/**
 * Генерирует закомментированный исходный код метода.
 */
function generateCommentedOriginal(originalCode) {
    // Используем русский комментарий для случая ошибки
    if (!originalCode)
        return '// Не удалось получить исходный код метода.';
    const lines = originalCode.split('\n');
    // Комментируем каждую строку
    return lines.map(line => `// ${line}`).join('\n');
}
/**
 * Генерирует описание метода.
 */
function generateMethodDescription(methodName, returnType, comments) {
    // Используем русские метки
    let description = `// Метод: ${methodName}\n`;
    description += `// Тип возвращаемого значения (предполагаемый): ${returnType}\n`; // Указываем, что тип предполагаемый
    if (comments) {
        description += '// Комментарии документации:\n';
        const commentLines = comments.split('\n');
        description += commentLines.map(line => `//   ${line}`).join('\n');
    }
    else {
        description += '// Комментарии документации: Не найдены.';
    }
    return description;
}
/**
 * Генерирует базовое тело теста.
 */
function generateTestBody(methodName) {
    // Базовый шаблон для Flutter unit тестов с русскими комментариями
    return `
  group('Тесты для ${methodName}', () {

    setUp(() {
      // Код инициализации, который выполняется перед каждым тестом в этой группе
      // например, инициализация мок-объектов, сброс состояния
    });

    tearDown(() {
      // Код очистки, который выполняется после каждого теста в этой группе
      // например, освобождение ресурсов (dispose)
    });

    test('Тестовый случай 1: Базовый сценарий', () {
      // Arrange (Подготовка): Задайте условия для теста.
      // final instance = ВашКласс(); // TODO: Создайте экземпляр класса, если метод не статический.
      // final param1 = значение1;    // TODO: Определите входные параметры.

      // Act (Действие): Вызовите тестируемый метод.
      // final result = instance.${methodName}(param1); // TODO: Вызовите метод с подготовленными параметрами.
      // Если метод статический: final result = ВашКласс.${methodName}(param1);
      // Если это функция вне класса: final result = ${methodName}(param1);

      // Assert (Проверка): Проверьте, соответствует ли результат ожиданиям.
      // expect(result, equals(ожидаемое_значение)); // TODO: Замените на реальную проверку.
      expect(true, isTrue); // TODO: Замените эту заглушку на реальную проверку!

      /* Примеры проверок (expect):
         expect(result, equals(expectedValue)); // Равенство
         expect(result, isNotNull);             // Не null
         expect(result, isTrue);                // true
         expect(result, isFalse);               // false
         expect(result, isEmpty);               // Пустая коллекция/строка
         expect(result, isNotEmpty);            // Не пустая коллекция/строка
         expect(result, contains(element));     // Коллекция содержит элемент
         expect(result, isA<ТипДанных>());      // Проверка типа
         expect(() => instance.${methodName}(невалидный_параметр), throwsException); // Ожидание исключения
         expect(() => instance.${methodName}(параметр), returnsNormally); // Ожидание нормального завершения
      */
    });

    test('Тестовый случай 2: Граничный или ошибочный сценарий', () {
      // Arrange (Подготовка)
      // final instance = ВашКласс();
      // final param1 = граничное_значение; // Например, null, пустая строка, 0, -1 и т.д.

      // Act (Действие)
      // final result = instance.${methodName}(param1);
      // Или используйте expect(..., throwsA<ТипОшибки>()); для проверки ошибок

      // Assert (Проверка)
      // expect(result, equals(ожидаемый_результат_для_граничного_случая));
      expect(true, isTrue); // TODO: Замените эту заглушку на реальную проверку!
    });

    // TODO: Добавьте больше тестовых случаев для различных сценариев:
    // - Разные корректные входные данные
    // - Некорректные входные данные (null, неправильный формат и т.д.)
    // - Пограничные значения
    // - Случаи, приводящие к ошибкам (если применимо)

  });
`;
}


/***/ }),
/* 1 */
/***/ ((module) => {

module.exports = require("vscode");

/***/ }),
/* 2 */
/***/ ((module) => {

module.exports = require("path");

/***/ })
/******/ 	]);
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module is referenced by other modules so it can't be inlined
/******/ 	var __webpack_exports__ = __webpack_require__(0);
/******/ 	module.exports = __webpack_exports__;
/******/ 	
/******/ })()
;
//# sourceMappingURL=extension.js.map