"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateTest = exports.generateTestFilesStructure = exports.createCombinedTestData = void 0;
const vscode = require("vscode");
const dartLexer_1 = require("./dartLexer");
const utils_1 = require("./utils");
const webviewGenerator_1 = require("./webviewGenerator");
// ===== ИСПРАВЛЕННЫЕ ФУНКЦИИ ПАРСИНГА =====
/**
 * Находит соответствующую закрывающую скобку
 * @param text - текст для поиска
 * @param startIndex - индекс открывающей скобки
 * @returns индекс закрывающей скобки
 */
function findMatchingBrace(text, startIndex) {
    let braceCount = 1;
    let currentIndex = startIndex + 1;
    while (currentIndex < text.length && braceCount > 0) {
        const char = text[currentIndex];
        if (char === '{') {
            braceCount++;
        }
        else if (char === '}') {
            braceCount--;
        }
        currentIndex++;
    }
    return braceCount === 0 ? currentIndex - 1 : text.length;
}
/**
 * Парсит контексты метода (блоки try, catch, if, etc.)
 * @param methodBody - тело метода для анализа
 * @returns массив контекстов метода
 */
function parseMethodContexts(methodBody) {
    const contexts = [];
    const rootContext = {
        blockType: 'root',
        startIndex: 0,
        endIndex: methodBody.length - 1,
        nestingLevel: 0
    };
    contexts.push(rootContext);
    const blockPatterns = [
        { pattern: /try\s*{/g, type: 'try' },
        { pattern: /}\s*catch\s*\([^)]*\)\s*{/g, type: 'catch' },
        { pattern: /}\s*on\s+\w+\s+catch\s*\([^)]*\)\s*{/g, type: 'catch' },
        { pattern: /if\s*\([^)]*\)\s*{/g, type: 'if' },
        { pattern: /else\s*{/g, type: 'else' },
        { pattern: /switch\s*\([^)]*\)\s*{/g, type: 'switch' },
        { pattern: /case\s+[^:]+:/g, type: 'case' },
        { pattern: /default\s*:/g, type: 'default' }
    ];
    for (const { pattern, type } of blockPatterns) {
        let match;
        while ((match = pattern.exec(methodBody)) !== null) {
            const startIndex = match.index;
            let endIndex = methodBody.length - 1;
            if (type === 'case' || type === 'default') {
                // Для case/default ищем до следующего case/default/break или }
                const restCode = methodBody.substring(startIndex);
                const nextBreakMatch = restCode.match(/(?:case\s+[^:]+:|default\s*:|break\s*;|})/);
                if (nextBreakMatch && nextBreakMatch.index) {
                    endIndex = startIndex + nextBreakMatch.index - 1;
                }
            }
            else {
                const openBraceIndex = methodBody.indexOf('{', startIndex);
                if (openBraceIndex !== -1) {
                    endIndex = findMatchingBrace(methodBody, openBraceIndex);
                }
            }
            let parentContext;
            for (const ctx of contexts) {
                if (ctx.startIndex < startIndex && ctx.endIndex > endIndex) {
                    if (!parentContext ||
                        (ctx.startIndex > parentContext.startIndex && ctx.endIndex < parentContext.endIndex)) {
                        parentContext = ctx;
                    }
                }
            }
            const context = {
                blockType: type,
                startIndex,
                endIndex,
                nestingLevel: parentContext ? parentContext.nestingLevel + 1 : 1,
                parentContext
            };
            contexts.push(context);
        }
    }
    return contexts.sort((a, b) => a.startIndex - b.startIndex);
}
/**
 * Парсит guard условия из тела метода
 * @param methodBody - тело метода для анализа
 * @returns массив guard условий
 */
//TODO(Vlad): ИЛИ условие множественных гуардов
function parseGuardConditions(methodBody) {
    const guardConditions = [];
    // Ищем условия типа: if (state is SomeState) return;
    const guardPattern = /if\s*\(\s*state\s+is\s+(\w+)\s*\)\s*return\s*;/g;
    let match;
    while ((match = guardPattern.exec(methodBody)) !== null) {
        const stateName = match[1];
        guardConditions.push({
            blockedState: stateName,
            action: 'return'
        });
    }
    return guardConditions;
}
/**
 * Вычисляет разрешенные состояния на основе guard условий
 * @param realStates - Set реальных состояний
 * @param guardConditions - массив guard условий
 * @returns массив разрешенных состояний
 */
function calculateAllowedStates(realStates, guardConditions) {
    const allowedStates = Array.from(realStates);
    // Убираем состояния, заблокированные guard условиями
    guardConditions.forEach(guard => {
        const index = allowedStates.indexOf(guard.blockedState);
        if (index > -1) {
            allowedStates.splice(index, 1);
        }
    });
    return allowedStates;
}
/**
 * Анализирует статус emit вызова (транзитный или финальный)
 * @param methodBody - тело метода
 * @param emitPosition - позиция emit в тексте
 * @param contexts - массив контекстов метода
 * @param emitContext - контекст данного emit
 * @param fullEmitMatch - полное совпадение emit
 * @returns объект с информацией о статусе emit
 */
function analyzeEmitStatusFixed(methodBody, emitPosition, contexts, emitContext, fullEmitMatch) {
    if (!emitContext) {
        return {
            isTransient: false,
            isFinal: true,
            reason: 'Emit без контекста считается финальным'
        };
    }
    const afterEmitPosition = emitPosition + fullEmitMatch.length;
    // Для case/default блоков проверяем только до break
    if (emitContext.blockType === 'case' || emitContext.blockType === 'default') {
        const remainingCodeInContext = methodBody.substring(afterEmitPosition, emitContext.endIndex);
        const hasBreak = /break\s*;/.test(remainingCodeInContext);
        if (hasBreak) {
            return {
                isTransient: false,
                isFinal: true,
                reason: `Финальный в ${emitContext.blockType} блоке с break`
            };
        }
        else {
            return {
                isTransient: true,
                isFinal: false,
                reason: `Транзитный в ${emitContext.blockType} блоке без break`
            };
        }
    }
    // Для catch блоков всегда финальные
    if (emitContext.blockType === 'catch') {
        return {
            isTransient: false,
            isFinal: true,
            reason: 'Финальный в catch блоке'
        };
    }
    // Для root контекста проверяем весь оставшийся код метода
    if (emitContext.blockType === 'root') {
        const remainingCodeInMethod = methodBody.substring(afterEmitPosition);
        // Убираем комментарии и лишние пробелы
        const cleanRemainingCode = remainingCodeInMethod
            .replace(/\/\/.*$/gm, '')
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .replace(/\s+/g, ' ')
            .trim();
        // Ищем значимый код: try, switch, if, await, вызовы методов, присваивания
        const hasSignificantCodeAfter = /(?:try\s*{|switch\s*\(|if\s*\(|await\s+\w+|\w+\s*=|\w+\.\w+\s*\()/.test(cleanRemainingCode);
        if (hasSignificantCodeAfter) {
            return {
                isTransient: true,
                isFinal: false,
                reason: 'Транзитное - есть значимый код после emit в root контексте'
            };
        }
        else {
            return {
                isTransient: false,
                isFinal: true,
                reason: 'Финальное - нет значимого кода после emit в root контексте'
            };
        }
    }
    // Для остальных контекстов (try, if, else и т.д.) - по умолчанию финальное
    return {
        isTransient: false,
        isFinal: true,
        reason: `Финальное в ${emitContext.blockType} контексте`
    };
}
/**
 * Парсит расширенные emit выражения из тела метода
 * @param methodBody - тело метода для анализа
 * @param methodName - имя метода для логирования
 * @returns объект с emit'ами и контекстами
 */
function parseEnhancedEmitStatements(methodBody, methodName) {
    const emits = [];
    const contexts = parseMethodContexts(methodBody);
    // Regex для многострочных emit
    const emitPattern = /emit\s*\(\s*(?:const\s+)?(\w+)\s*\([^)]*\)\s*\)/g;
    let match;
    while ((match = emitPattern.exec(methodBody)) !== null) {
        const stateName = match[1];
        const emitPosition = match.index;
        const fullEmitMatch = match[0];
        // Находим контекст для этого emit
        let emitContext = null;
        for (let i = contexts.length - 1; i >= 0; i--) {
            const context = contexts[i];
            if (context.startIndex <= emitPosition && context.endIndex >= emitPosition) {
                if (!emitContext || context.nestingLevel > emitContext.nestingLevel) {
                    emitContext = context;
                }
            }
        }
        const analysis = analyzeEmitStatusFixed(methodBody, emitPosition, contexts, emitContext, fullEmitMatch);
        emits.push({
            state: stateName,
            rawStatement: match[0],
            context: emitContext,
            isTransient: analysis.isTransient,
            isFinal: analysis.isFinal,
            reason: analysis.reason
        });
    }
    return { emits, contexts };
}
/**
 * Парсит вызовы репозиториев, хранилищ и приватных методов в теле метода
 * @param methodBody - Тело метода для анализа
 * @param classCode - Полный код класса для контекста
 * @param knownEventHandlers - Список известных обработчиков событий (для исключения из приватных методов)
 * @returns Объект с массивами вызовов репозиториев, хранилищ и приватных методов
 */
function parseStorageRepositoryCalls(methodBody, classCode, knownEventHandlers = []) {
    const repositoryCalls = [];
    const storageCalls = [];
    const privateMethodCalls = [];
    console.log(`🔍 ПАРСЕР ВЫЗОВОВ: Анализируем тело метода (${methodBody.length} символов)`);
    // Создаем новые экземпляры регулярных выражений для каждого поиска
    // чтобы избежать проблем с глобальным флагом /g
    const repositoryRegex = new RegExp(utils_1.REGEX_PATTERNS.anyRepositoryCall.source, 'g');
    const storageRegex = new RegExp(utils_1.REGEX_PATTERNS.anyStorageCall.source, 'g');
    const serviceRegex = new RegExp(utils_1.REGEX_PATTERNS.anyServiceCall.source, 'g');
    const privateMethodRegex = new RegExp(utils_1.REGEX_PATTERNS.privateMethod.source, 'g');
    // Ищем вызовы репозитория
    let repoMatch;
    while ((repoMatch = repositoryRegex.exec(methodBody)) !== null) {
        // Для новых паттернов нужно извлечь правильную часть из match
        const fullMatch = repoMatch[0];
        const actualCall = fullMatch.includes('.') ? fullMatch.substring(fullMatch.lastIndexOf(' ') + 1) : fullMatch;
        const methodCall = (0, utils_1.extractMethodName)(actualCall);
        repositoryCalls.push(methodCall);
        console.log(`   📦 Repository вызов: ${methodCall} (из: ${fullMatch.trim()})`);
    }
    // Ищем вызовы хранилища
    let storageMatch;
    while ((storageMatch = storageRegex.exec(methodBody)) !== null) {
        const fullMatch = storageMatch[0];
        const actualCall = fullMatch.includes('.') ? fullMatch.substring(fullMatch.lastIndexOf(' ') + 1) : fullMatch;
        const methodCall = (0, utils_1.extractMethodName)(actualCall);
        storageCalls.push(methodCall);
        console.log(`   💾 Storage вызов: ${methodCall} (из: ${fullMatch.trim()})`);
    }
    // Ищем вызовы сервисов (добавляем их к репозиториям для моков)
    let serviceMatch;
    while ((serviceMatch = serviceRegex.exec(methodBody)) !== null) {
        const fullMatch = serviceMatch[0];
        const actualCall = fullMatch.includes('.') ? fullMatch.substring(fullMatch.lastIndexOf(' ') + 1) : fullMatch;
        const methodCall = (0, utils_1.extractMethodName)(actualCall);
        repositoryCalls.push(methodCall); // Добавляем сервисы к репозиториям для простоты
        console.log(`   ⚙️ Service вызов: ${methodCall} (из: ${fullMatch.trim()})`);
    }
    // Ищем вызовы приватных методов (исключая известные обработчики событий)
    let privateMatch;
    while ((privateMatch = privateMethodRegex.exec(methodBody)) !== null) {
        const methodCall = (0, utils_1.extractMethodName)(privateMatch[0]);
        // Исключаем известные обработчики событий из списка приватных методов
        if (!knownEventHandlers.includes(methodCall)) {
            privateMethodCalls.push(methodCall);
            console.log(`   🔒 Private метод вызов: ${methodCall}`);
        }
    }
    console.log(`✓ ПАРСЕР ВЫЗОВОВ: ${repositoryCalls.length} repo, ${storageCalls.length} storage, ${privateMethodCalls.length} private`);
    return { repositoryCalls, storageCalls, privateMethodCalls };
}
// Создание переходов из всех allowedStates
/**
 * Создает структуры переходов состояний из всех allowedStates
 * @param emits - массив информации об emit'ах
 * @param repositoryCalls - массив вызовов репозитория
 * @param storageCalls - массив вызовов хранилища
 * @param privateMethodCalls - массив вызовов приватных методов
 * @param allowedStates - массив разрешенных состояний
 * @returns массив переходов состояний
 */
function createStateTransitionStructuresFixed(emits, repositoryCalls, storageCalls, privateMethodCalls, allowedStates) {
    const transitions = [];
    if (emits.length === 0)
        return transitions;
    // Создаем только переходы из всех allowedStates в финальные состояния
    const finalStates = emits.filter(e => e.isFinal).map(e => e.state);
    allowedStates.forEach(allowedState => {
        finalStates.forEach(finalState => {
            // Добавляем переход из каждого allowedState в каждое финальное состояние
            const existingTransition = transitions.find(t => t.fromState === allowedState && t.toState === finalState);
            if (!existingTransition) {
                transitions.push({
                    fromState: allowedState,
                    toState: finalState,
                    transientStates: emits.filter(e => e.isTransient).map(e => e.state),
                    repositoryCalls,
                    storageCalls,
                    privateMethodCalls,
                    isReachable: true,
                    conditionGuards: []
                });
            }
        });
    });
    return transitions;
}
/**
 * Парсит отдельный метод и создает расширенную информацию о нем
 * @param name - Имя метода/события
 * @param handler - Имя обработчика (для событий блока)
 * @param methodBody - Тело метода для анализа
 * @param type - Тип: 'event' для событий блока, 'method' для методов кубита
 * @param classCode - Полный код класса для контекста
 * @param realStates - Set реальных состояний из файла состояний
 * @param isArrowFunction - Является ли метод стрелочной функцией
 * @param knownEventHandlers - Список известных обработчиков событий (для исключения из приватных методов)
 * @returns Объект EnhancedMethodInfo с полной информацией о методе
 */
function parseEnhancedSingleMethod(name, handler, methodBody, type, classCode, realStates, // принимаем только реальные состояния
isArrowFunction = false, // флаг стрелочной функции
knownEventHandlers = [] // известные обработчики событий
) {
    const { emits } = parseEnhancedEmitStatements(methodBody, name);
    const { repositoryCalls, storageCalls, privateMethodCalls } = parseStorageRepositoryCalls(methodBody, classCode, knownEventHandlers);
    // Парсинг guard условий и расчет allowedStates
    const guardConditions = parseGuardConditions(methodBody);
    // Используем только реальные состояния
    const reachableStates = Array.from(new Set(emits.map(e => e.state)));
    const allowedStates = calculateAllowedStates(realStates, guardConditions);
    const transitions = createStateTransitionStructuresFixed(emits, repositoryCalls, storageCalls, privateMethodCalls, allowedStates);
    const finalStates = emits.filter(e => e.isFinal).map(e => e.state);
    const transientStates = emits.filter(e => e.isTransient).map(e => e.state);
    return {
        name,
        type,
        event: type === 'event' ? name : undefined,
        handler: type === 'event' ? handler : undefined,
        parameters: [],
        transitions,
        reachableStates,
        finalStates,
        transientStates,
        repositoryCalls,
        storageCalls,
        privateMethodCalls,
        guardConditions,
        allowedStates,
        isArrowFunction
    };
}
/**
 * Парсит методы кубита/блока и создает расширенную информацию
 * @param classCode - Код класса для анализа
 * @param cubitName - Имя класса кубита/блока
 * @param isBloc - Является ли класс блоком (true) или кубитом (false)
 * @param realStates - Массив реальных состояний из файла состояний
 */
function parseEnhancedMethods(classCode, cubitName, isBloc, realStates) {
    const enhancedMethods = [];
    const enhancedStates = [];
    // Создаем Set только из реальных состояний
    const realStatesSet = new Set(realStates.map(s => s.name));
    // 1. Парсим все методы через унифицированный лексер 
    // includePrivate = true для блоков (нужны приватные обработчики _on*), false для кубитов
    const allMethods = (0, dartLexer_1.parseAllMethodsWithLexer)(classCode, isBloc);
    const processedMethodNames = new Set();
    if (isBloc) {
        // Для блоков: сначала парсим события и их обработчики, потом глобальные методы
        const { events } = parseCubitOrBloc(classCode);
        // Собираем список всех обработчиков событий для правильной фильтрации приватных методов
        const knownEventHandlers = events.map(event => event.handler);
        console.log(`🔧 ЛЕКСЕР: Обрабатываем ${events.length} событий блока`);
        console.log(`📋 Известные обработчики: ${knownEventHandlers.join(', ')}`);
        // 1.1. Обработчики событий (приватные методы _on*)
        for (const event of events) {
            const handlerMethod = allMethods.find(m => m.name === event.handler);
            if (handlerMethod && handlerMethod.body) {
                const enhancedMethod = parseEnhancedSingleMethod(event.name, event.handler, handlerMethod.body, 'event', classCode, realStatesSet, handlerMethod.isArrowFunction, knownEventHandlers);
                enhancedMethods.push(enhancedMethod);
                processedMethodNames.add(event.handler);
                console.log(`   📧 Событие ${event.name} → ${event.handler} (${handlerMethod.isArrowFunction ? 'стрелочная' : 'обычная'} функция)`);
            }
        }
        // 1.2. Глобальные методы блока (публичные методы, не являющиеся обработчиками)
        const globalMethods = allMethods.filter(m => !m.isPrivate &&
            !processedMethodNames.has(m.name) &&
            !m.name.includes('Bloc') &&
            !m.name.includes('Cubit'));
        for (const globalMethod of globalMethods) {
            if (globalMethod.body) {
                const enhancedMethod = parseEnhancedSingleMethod(globalMethod.name, globalMethod.name, globalMethod.body, 'method', classCode, realStatesSet, globalMethod.isArrowFunction, knownEventHandlers);
                enhancedMethods.push(enhancedMethod);
                console.log(`   ⚙️ Глобальный метод ${globalMethod.name} (${globalMethod.isArrowFunction ? 'стрелочная' : 'обычная'} функция)`);
            }
        }
        console.log(`✓ ПАРСЕР: Найдено ${enhancedMethods.length} методов для блока (${events.length} событий + ${globalMethods.length} глобальных методов)`);
    }
    else {
        // Для кубитов: все публичные методы (нет обработчиков событий)
        console.log(`🔧 ЛЕКСЕР: Парсим методы кубита через лексер`);
        const cubitMethods = allMethods.filter(m => !m.isPrivate &&
            !m.name.includes('Cubit') &&
            !m.name.includes('Bloc'));
        // Для кубитов нет обработчиков событий
        const knownEventHandlers = [];
        for (const cubitMethod of cubitMethods) {
            if (cubitMethod.body) {
                const enhancedMethod = parseEnhancedSingleMethod(cubitMethod.name, cubitMethod.name, cubitMethod.body, 'method', classCode, realStatesSet, cubitMethod.isArrowFunction, knownEventHandlers);
                enhancedMethods.push(enhancedMethod);
                console.log(`   ⚙️ Метод ${cubitMethod.name} (${cubitMethod.isArrowFunction ? 'стрелочная' : 'обычная'} функция)`);
            }
        }
        console.log(`✓ ПАРСЕР: Найдено ${cubitMethods.length} методов кубита`);
    }
    // Создаем EnhancedStateInfo только для реальных состояний
    realStates.forEach((stateInfo) => {
        const enhancedState = {
            name: stateInfo.name,
            isInitial: stateInfo.isInitial,
            isError: stateInfo.isError,
            isLoading: stateInfo.isLoading,
            isSuccess: stateInfo.isSuccess,
            isReachable: true,
            reachabilityPaths: []
        };
        enhancedStates.push(enhancedState);
    });
    return { enhancedMethods, enhancedStates };
}
// ===== ФУНКЦИИ ПОСТРОЕНИЯ АВТОМАТА И ГЕНЕРАЦИИ ТЕСТОВ =====
/**
 * Создает ветки выполнения на основе реальных тестовых путей
 * @param testPaths - массив реальных тестовых путей
 * @param combinedPaths - массив комбинированных тестовых путей
 * @param enhancedMethods - массив расширенной информации о методах
 * @returns Map с ветками выполнения, соответствующими реальным тестам
 */
function createExecutionBranchesFromTestPaths(testPaths, combinedPaths, enhancedMethods) {
    const executionBranches = new Map();
    // 1. Обязательные тесты (один тест на финальное состояние метода)
    for (const path of testPaths) {
        if (path.methods.length === 0)
            continue; // пропускаем тест инициализации
        const methodName = path.methods[0];
        const method = enhancedMethods.find(m => m.name === methodName);
        if (!method)
            continue;
        const fromState = path.states[0];
        const toState = path.states[path.states.length - 1];
        // Ищем соответствующий переход
        const transition = method.transitions.find(t => t.fromState === fromState && t.toState === toState) || method.transitions.find(t => t.toState === toState); // fallback
        const branchId = `${methodName}_basic_${toState}`;
        const branch = {
            branchId,
            states: transition ? [transition.fromState, ...transition.transientStates, transition.toState] : path.states,
            repositoryCalls: (transition === null || transition === void 0 ? void 0 : transition.repositoryCalls) || method.repositoryCalls,
            storageCalls: (transition === null || transition === void 0 ? void 0 : transition.storageCalls) || method.storageCalls,
            privateMethodCalls: (transition === null || transition === void 0 ? void 0 : transition.privateMethodCalls) || method.privateMethodCalls,
            isSuccessPath: !toState.toLowerCase().includes('error'),
            isErrorPath: toState.toLowerCase().includes('error'),
            isFinalState: method.finalStates.includes(toState)
        };
        if (!executionBranches.has(methodName)) {
            executionBranches.set(methodName, []);
        }
        executionBranches.get(methodName).push(branch);
    }
    // 2. Комбинированные тесты (случайные пути)
    for (let i = 0; i < combinedPaths.length; i++) {
        const path = combinedPaths[i];
        if (path.methods.length === 0)
            continue;
        const combinedData = createCombinedTestData(path, enhancedMethods);
        const pathDescription = path.methods.join('→');
        const branchId = `combined_${i}_${pathDescription}`;
        const branch = {
            branchId,
            states: combinedData.allStatesInOrder.length > 0 ? combinedData.allStatesInOrder : path.states,
            repositoryCalls: combinedData.combinedRepositoryCalls,
            storageCalls: combinedData.combinedStorageCalls,
            privateMethodCalls: combinedData.combinedPrivateMethodCalls,
            isSuccessPath: !path.states[path.states.length - 1].toLowerCase().includes('error'),
            isErrorPath: path.states[path.states.length - 1].toLowerCase().includes('error'),
            isFinalState: true // комбинированные пути всегда ведут к финальному состоянию
        };
        // Добавляем комбинированную ветку как отдельную категорию
        const combinedKey = `combined_test_${i}`;
        if (!executionBranches.has(combinedKey)) {
            executionBranches.set(combinedKey, []);
        }
        executionBranches.get(combinedKey).push(branch);
    }
    console.log(`✓ Создано ${Array.from(executionBranches.values()).reduce((acc, branches) => acc + branches.length, 0)} веток выполнения на основе реальных тестовых путей`);
    return executionBranches;
}
/**
 * Строит расширенный конечный автомат состояний
 * @param enhancedMethods - массив расширенной информации о методах
 * @param enhancedStates - массив расширенной информации о состояниях
 * @param initialState - начальное состояние
 * @returns объект с FSM, методами и ветками выполнения
 */
function buildEnhancedFSM(enhancedMethods, enhancedStates, initialState) {
    const states = [initialState, ...enhancedStates.map(s => s.name)];
    const transitions = [];
    const parsedMethods = [];
    for (const method of enhancedMethods) {
        const parsedMethod = {
            name: method.name,
            type: method.type,
            allowedFromStates: [initialState],
            emitStates: method.reachableStates,
            guardConditions: []
        };
        parsedMethods.push(parsedMethod);
        // Создаем переходы для автомата
        for (const transition of method.transitions) {
            const fsmTransition = {
                from: transition.fromState === 'initial' ? initialState : transition.fromState,
                to: transition.toState,
                method: method.name
            };
            transitions.push(fsmTransition);
        }
    }
    const fsm = {
        states: Array.from(new Set(states)),
        transitions,
        initialState
    };
    // Ветки выполнения будут созданы позже на основе реальных тестовых путей
    const executionBranches = new Map();
    return { fsm, parsedMethods, executionBranches };
}
/**
 * Генерирует случайные комбинированные пути
 * @param fsm - конечный автомат состояний
 * @param enhancedMethods - массив расширенной информации о методах
 * @param maxPaths - максимальное количество путей
 * @param minLength - минимальная длина пути
 * @param maxLength - максимальная длина пути
 * @returns массив тестовых путей
 */
function generateRandomCombinedPaths(fsm, enhancedMethods, maxPaths = 5, minLength = 2, maxLength = 3) {
    const combinedPaths = [];
    const maxAttempts = 50; // Максимум попыток генерации
    for (let attempt = 0; attempt < maxAttempts && combinedPaths.length < maxPaths; attempt++) {
        // Случайная длина пути (2-3 перехода)
        const pathLength = Math.floor(Math.random() * (maxLength - minLength + 1)) + minLength;
        // Начинаем с начального состояния
        let currentState = fsm.initialState;
        const pathStates = [currentState];
        const pathMethods = [];
        let validPath = true;
        // Строим случайный путь
        for (let i = 0; i < pathLength; i++) {
            // Находим все возможные переходы из текущего состояния
            const availableTransitions = fsm.transitions.filter(t => t.from === currentState);
            if (availableTransitions.length === 0) {
                validPath = false;
                break;
            }
            // Выбираем случайный переход
            const randomTransition = availableTransitions[Math.floor(Math.random() * availableTransitions.length)];
            pathMethods.push(randomTransition.method);
            pathStates.push(randomTransition.to);
            currentState = randomTransition.to;
        }
        // Проверяем, что путь валидный и уникальный
        if (validPath && pathMethods.length >= minLength) {
            const pathKey = `${pathStates.join('-')}-${pathMethods.join('-')}`;
            const isDuplicate = combinedPaths.some(existing => existing.states.join('-') === pathStates.join('-') &&
                existing.methods.join('-') === pathMethods.join('-'));
            if (!isDuplicate) {
                combinedPaths.push({
                    states: pathStates,
                    methods: pathMethods,
                    conditions: []
                });
            }
        }
    }
    console.log(`✓ Сгенерировано ${combinedPaths.length} комбинированных путей`);
    return combinedPaths;
}
/**
 * Создает объединенные тестовые данные для пути
 * @param path - тестовый путь
 * @param enhancedMethods - массив расширенной информации о методах
 * @returns объект с объединенными данными теста
 */
function createCombinedTestData(path, enhancedMethods) {
    const combinedRepositoryCalls = [];
    const combinedStorageCalls = [];
    const combinedPrivateMethodCalls = [];
    const allStatesInOrder = []; // последовательный порядок конкретных переходов
    const allReachableStates = [];
    // Ищем конкретные переходы по пути состояний
    for (let i = 0; i < path.methods.length; i++) {
        const methodName = path.methods[i];
        const fromState = path.states[i]; // Начальное состояние перехода
        const toState = path.states[i + 1]; // Конечное состояние перехода
        const methodInfo = enhancedMethods.find(m => m.name === methodName);
        if (methodInfo) {
            // Добавляем mock вызовы метода
            combinedRepositoryCalls.push(...methodInfo.repositoryCalls);
            combinedStorageCalls.push(...methodInfo.storageCalls);
            combinedPrivateMethodCalls.push(...methodInfo.privateMethodCalls);
            // Ищем конкретный переход fromState -> toState
            const specificTransition = methodInfo.transitions.find(t => t.fromState === fromState && t.toState === toState);
            if (specificTransition) {
                // Добавляем состояния КОНКРЕТНОГО перехода
                allStatesInOrder.push(...specificTransition.transientStates);
                allStatesInOrder.push(specificTransition.toState);
            }
            else {
                // Если конкретный переход не найден, используем общую информацию метода
                console.warn(`⚠️ Конкретный переход ${fromState} -> ${toState} для ${methodName} не найден`);
                allStatesInOrder.push(...methodInfo.transientStates);
                allStatesInOrder.push(toState);
            }
            // Для совместимости с WebView
            allReachableStates.push(...methodInfo.reachableStates);
        }
    }
    //TODO(vlad): убрать подряд идущие дубликаты
    // Возвращаем все данные без удаления дубликатов
    return {
        combinedRepositoryCalls,
        combinedStorageCalls,
        combinedPrivateMethodCalls,
        allStatesInOrder,
        allReachableStates
    };
}
exports.createCombinedTestData = createCombinedTestData;
/**
 * Генерирует тестовые пути из автомата состояний
 * @param fsm - конечный автомат состояний
 * @param enhancedMethods - массив расширенной информации о методах
 * @param maxPaths - максимальное количество путей
 * @returns массив тестовых путей
 */
function generateTestPaths(fsm, enhancedMethods, maxPaths = Number.MAX_SAFE_INTEGER) {
    const paths = [];
    // Один тест на одно конечное состояние метода
    for (const method of enhancedMethods) {
        for (const finalState of method.finalStates) {
            paths.push({
                states: [fsm.initialState, finalState],
                methods: [method.name],
                conditions: []
            });
        }
    }
    // Если нет методов, добавляем тест инициализации
    if (paths.length === 0) {
        paths.push({
            states: [fsm.initialState],
            methods: [],
            conditions: []
        });
    }
    console.log(`✓ Сгенерировано ${paths.length} обязательных тестов (один тест на конечное состояние)`);
    return paths.slice(0, maxPaths);
}
// ===== ОСНОВНАЯ ФУНКЦИЯ ГЕНЕРАЦИИ =====
/**
 * Генерирует структуру тестовых файлов
 * @param workspaceRoot - корневая директория рабочего пространства
 * @param testDir - директория тестов
 * @param featureName - имя фичи
 * @param cubitName - имя кубита/блока
 * @param enhancedMethods - анализированные методы
 * @param enhancedStates - анализированные состояния
 * @param testPaths - тестовые пути
 * @param combinedPaths - комбинированные тестовые пути
 * @param isBloc - является ли блоком
 * @param fsm - конечный автомат состояний
 * @param classCode - исходный код класса
 */
function generateTestFilesStructure(workspaceRoot, testDir, featureName, cubitName, enhancedMethods, enhancedStates, testPaths, combinedPaths, isBloc, fsm, classCode // Исходный код класса
) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('\n🧪 НОВЫЙ ГЕНЕРАТОР: Создание тестовых файлов...');
        const isDirectory = cubitName.toLowerCase().includes('bloc') ? 'bloc' : 'cubit';
        // Создаем структуру директорий: test/features/featureName/cubit(bloc)/
        const testFeatureDir = vscode.Uri.joinPath(workspaceRoot, testDir, 'features', featureName);
        const testCubitDir = vscode.Uri.joinPath(testFeatureDir, isDirectory);
        yield vscode.workspace.fs.createDirectory(testCubitDir);
        // Генерируем содержимое теста
        const testContent = generateEnhancedTestContent(cubitName, featureName, enhancedMethods, enhancedStates, testPaths, combinedPaths, isBloc, fsm, classCode);
        const testFileName = `${(0, utils_1.toSnakeCase)(cubitName)}_test.dart`;
        const testFilePath = vscode.Uri.joinPath(testCubitDir, testFileName);
        yield vscode.workspace.fs.writeFile(testFilePath, Buffer.from(testContent, 'utf8'));
        console.log(`✓ Тест создан: ${testFilePath.fsPath}`);
        // Создаем общий файл для фичи: test/features/featureName/featureName_test.dart
        yield generateFeatureTestFileNew(workspaceRoot, testDir, featureName, cubitName, isBloc);
        // Обновляем главный тестовый файл: test/test.dart
        yield updateMainTestFileNew(workspaceRoot, testDir, featureName);
        // Применяем форматирование к созданным файлам
        yield formatCreatedFiles(workspaceRoot, testDir, featureName, cubitName, isBloc);
        console.log('✅ Структура тестов создана успешно!');
    });
}
exports.generateTestFilesStructure = generateTestFilesStructure;
/**
 * Функция для форматирования созданных файлов
 * @param workspaceRoot - корневая директория рабочего пространства
 * @param testDir - директория тестов
 * @param featureName - имя фичи
 * @param cubitName - имя кубита/блока
 * @param isBloc - является ли блоком
 */
function formatCreatedFiles(workspaceRoot, testDir, featureName, cubitName, isBloc) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.log('\n🎨 Форматирование созданных тестовых файлов...');
            const isDirectory = isBloc ? 'bloc' : 'cubit';
            // Список файлов для форматирования
            const filesToFormat = [
                vscode.Uri.joinPath(workspaceRoot, testDir, 'features', featureName, isDirectory, `${(0, utils_1.toSnakeCase)(cubitName)}_test.dart`),
                vscode.Uri.joinPath(workspaceRoot, testDir, 'features', featureName, `${featureName}_test.dart`),
                vscode.Uri.joinPath(workspaceRoot, testDir, 'test.dart')
            ];
            for (const filePath of filesToFormat) {
                try {
                    yield vscode.workspace.fs.stat(filePath);
                    const document = yield vscode.workspace.openTextDocument(filePath);
                    yield vscode.window.showTextDocument(document, { preview: true });
                    // Применяем команду форматирования
                    yield vscode.commands.executeCommand('editor.action.formatDocument');
                    // Сохраняем файл
                    yield document.save();
                    console.log(`✓ Форматирование: ${filePath.fsPath}`);
                }
                catch (error) {
                    console.log(`⚠️ Файл не найден для форматирования: ${filePath.fsPath}`);
                }
            }
            console.log('✅ Форматирование завершено');
        }
        catch (error) {
            console.error('❌ Ошибка при форматировании:', error);
        }
    });
}
/**
 * Генерирует расширенное содержимое теста
 * @param cubitName - имя кубита/блока
 * @param featureName - имя фичи
 * @param enhancedMethods - массив расширенной информации о методах
 * @param enhancedStates - массив расширенной информации о состояниях
 * @param testPaths - массив тестовых путей
 * @param combinedPaths - массив комбинированных тестовых путей
 * @param isBloc - является ли блоком
 * @param fsm - конечный автомат состояний
 * @param classCode - исходный код класса для парсинга зависимостей
 * @returns строка с содержимым теста
 */
function generateEnhancedTestContent(cubitName, featureName, enhancedMethods, enhancedStates, testPaths, combinedPaths, isBloc, fsm, classCode // Исходный код класса для парсинга зависимостей
) {
    var _a, _b;
    const className = cubitName;
    const instanceName = cubitName.charAt(0).toLowerCase() + cubitName.slice(1);
    // Правильное название общего состояния
    const stateClassName = `${(0, utils_1.toPascalCase)(featureName)}State`;
    // Автоматическое определение всех зависимостей из исходного кода
    const repositories = [];
    const services = [];
    const storages = [];
    // Упрощенный парсинг зависимостей из кода
    const dependencyRegex = /final\s+(\w+)\s+_(\w+);/g;
    let match;
    while ((match = dependencyRegex.exec(classCode)) !== null) {
        const type = match[1];
        const name = match[2];
        const dependency = {
            name: name,
            type: type
        };
        // Классифицируем по типу
        if (type.toLowerCase().includes('repository') || type.toLowerCase().includes('repo')) {
            repositories.push(dependency);
        }
        else if (type.toLowerCase().includes('storage') || type.toLowerCase().includes('secure')) {
            storages.push(dependency);
        }
        else if (type.toLowerCase().includes('service')) {
            services.push(dependency);
        }
    }
    console.log(`✓ Найдены зависимости: ${repositories.length} репозиториев, ${services.length} сервисов, ${storages.length} хранилищ`);
    // Генерируем импорты
    const imports = [
        `import 'package:bloc_test/bloc_test.dart';`,
        `import 'package:flutter_test/flutter_test.dart';`,
        `import 'package:mocktail/mocktail.dart';`,
        `import 'package:test_demo_app/features/${featureName}/${isBloc ? 'bloc' : 'cubit'}/${featureName}_${isBloc ? 'bloc' : 'cubit'}.dart';`,
        `import 'package:test_demo_app/features/${featureName}/${isBloc ? 'bloc' : 'cubit'}/${featureName}_state.dart';`,
    ];
    if (isBloc) {
        imports.push(`import 'package:test_demo_app/features/${featureName}/${isBloc ? 'bloc' : 'cubit'}/${featureName}_event.dart';`);
    }
    if (repositories.length > 0) {
        imports.push(`import 'package:test_demo_app/domain/repositories/auth_repository.dart';`);
    }
    if (services.length > 0) {
        imports.push(`import 'package:test_demo_app/domain/services/notification_service.dart';`);
    }
    if (storages.length > 0) {
        imports.push(`import 'package:test_demo_app/domain/services/secure_storage_service.dart';`);
    }
    // Генерируем mock классы для всех зависимостей
    const mocks = [];
    repositories.forEach(repo => {
        mocks.push(`class Mock${repo.type.replace(/^I/, '')} extends Mock implements ${repo.type} {}`);
    });
    services.forEach(service => {
        mocks.push(`class Mock${service.type.replace(/^I/, '')} extends Mock implements ${service.type} {}`);
    });
    storages.forEach(storage => {
        mocks.push(`class Mock${storage.type.replace(/^I/, '')} extends Mock implements ${storage.type} {}`);
    });
    // Генерируем setup с мокированием всех зависимостей
    const mockDeclarations = [];
    const mockInitializations = [];
    const constructorParams = [];
    repositories.forEach(repo => {
        const mockName = `mock${repo.type.replace(/^I/, '')}`;
        mockDeclarations.push(`late Mock${repo.type.replace(/^I/, '')} ${mockName};`);
        mockInitializations.push(`${mockName} = Mock${repo.type.replace(/^I/, '')}();`);
        constructorParams.push(`${repo.name}: ${mockName},`);
    });
    services.forEach(service => {
        const mockName = `mock${service.type.replace(/^I/, '')}`;
        mockDeclarations.push(`late Mock${service.type.replace(/^I/, '')} ${mockName};`);
        mockInitializations.push(`${mockName} = Mock${service.type.replace(/^I/, '')}();`);
        constructorParams.push(`${service.name}: ${mockName},`);
    });
    storages.forEach(storage => {
        const mockName = `mock${storage.type.replace(/^I/, '')}`;
        mockDeclarations.push(`late Mock${storage.type.replace(/^I/, '')} ${mockName};`);
        mockInitializations.push(`${mockName} = Mock${storage.type.replace(/^I/, '')}();`);
        constructorParams.push(`${storage.name}: ${mockName},`);
    });
    // 1. ОБЯЗАТЕЛЬНЫЕ ТЕСТЫ (на основе BFS остовного дерева)
    const basicTestCases = testPaths.map((path, index) => {
        const method = enhancedMethods.find(m => m.name === path.methods[0]);
        if (!method || path.methods.length === 0)
            return '';
        const finalState = path.states[path.states.length - 1];
        const testName = `'${method.name} должен эмитировать ${finalState}'`;
        const methodCall = isBloc
            ? `${isBloc ? 'bloc' : 'cubit'}.add(${method.name}())`
            : `${isBloc ? 'bloc' : 'cubit'}.${method.name}()`;
        // Генерируем моки только для тех зависимостей, которые действительно используются методом
        const repositoryMocks = method.repositoryCalls.length > 0 ? `
      // Repository mocks
      ${method.repositoryCalls.map(call => {
            const methodName = call.includes('.') ? call.split('.')[1] : call.replace(/\w+\./g, '').replace(/\(/g, '');
            return `
      when(() => mockAuthRepository.${methodName}(any()))
          .thenAnswer((_) async => {});`;
        }).join('')}` : '';
        const storageMocks = method.storageCalls.length > 0 ? `
      // Storage mocks
      ${method.storageCalls.map(call => {
            const methodName = call.includes('.') ? call.split('.')[1] : call.replace(/\w+\./g, '').replace(/\(/g, '');
            return `
      when(() => mockSecureStorageService.${methodName}(any()))
          .thenAnswer((_) async => 'test_value');`;
        }).join('')}` : '';
        // Если метод не использует зависимости, добавляем комментарий
        const noMocksComment = (method.repositoryCalls.length === 0 && method.storageCalls.length === 0)
            ? `
      // Метод не использует зависимости - моки не нужны` : '';
        return `
  blocTest<${className}, ${stateClassName}>(
    ${testName},
    build: () {${repositoryMocks}${storageMocks}${noMocksComment}
      
      return ${instanceName};
    },
    act: (${isBloc ? 'bloc' : 'cubit'}) => ${methodCall},
    expect: () => [
      ${method.transientStates.map(state => `const ${state}(),`).join('\n      ')}
      const ${finalState}(),
    ],
  );`;
    }).filter(test => test.length > 0);
    // 2. КОМБИНИРОВАННЫЕ ТЕСТЫ (случайные пути 2-3 перехода)
    const combinedTestCases = combinedPaths.map((path, index) => {
        const combinedData = createCombinedTestData(path, enhancedMethods);
        const finalState = path.states[path.states.length - 1];
        const pathDescription = path.methods.join(' → ');
        const testName = `'комбинированный тест: ${pathDescription}'`;
        // Комбинированные моки только для реально используемых зависимостей
        const combinedRepositoryMocks = combinedData.combinedRepositoryCalls.length > 0 ? `
      // Комбинированные repository mock'и
      ${combinedData.combinedRepositoryCalls.map(call => `
      when(() => mockAuthRepository.${call.split('.')[1]}(any()))
          .thenAnswer((_) async => {});`).join('')}` : '';
        const combinedStorageMocks = combinedData.combinedStorageCalls.length > 0 ? `
      // Комбинированные storage mock'и
      ${combinedData.combinedStorageCalls.map(call => `
      when(() => mockSecureStorageService.${call.split('.')[1]}(any()))
          .thenAnswer((_) async => 'test_value');`).join('')}` : '';
        return `
  blocTest<${className}, ${stateClassName}>(
    ${testName},
    build: () {${combinedRepositoryMocks}${combinedStorageMocks}
      
      return ${instanceName};
    },
    act: (${isBloc ? 'bloc' : 'cubit'}) async {
      ${path.methods.map(methodName => {
            const methodInfo = enhancedMethods.find(m => m.name === methodName);
            if (isBloc) {
                return `${isBloc ? 'bloc' : 'cubit'}.add(${methodName}());`;
            }
            else {
                return `${isBloc ? 'bloc' : 'cubit'}.${methodName}();`;
            }
        }).join('\n      ')}
    },
    expect: () => [
      ${combinedData.allStatesInOrder.map((state) => `const ${state}(),`).join('\n      ')}
    ],
  );`;
    }).filter(test => test.length > 0);
    return `${imports.join('\n')}

${mocks.join('\n')}

void main() {
  group('${className}', () {
    late ${className} ${instanceName};
    ${mockDeclarations.join('\n    ')}

    setUp(() {
      ${mockInitializations.join('\n      ')}
      ${instanceName} = ${className}(
        ${constructorParams.join('\n        ')}
      );
    });

    test('начальное состояние должно быть ${((_a = enhancedStates.find(s => s.isInitial)) === null || _a === void 0 ? void 0 : _a.name) || 'InitialState'}', () {
      expect(${instanceName}.state, equals(const ${((_b = enhancedStates.find(s => s.isInitial)) === null || _b === void 0 ? void 0 : _b.name) || 'InitialState'}()));
    });

    group('Обязательные тесты (методы → конечные состояния)', () {
      ${basicTestCases.join('\n')}
    });

    ${combinedTestCases.length > 0 ? `group('Комбинированные тесты (случайные пути)', () {
      ${combinedTestCases.join('\n')}
    });` : ''}
  });
}
`;
}
/**
 * Генерирует файл теста для фичи
 * @param workspaceRoot - корневая директория рабочего пространства
 * @param testDir - директория тестов
 * @param featureName - имя фичи
 * @param cubitName - имя кубита/блока
 * @param isBloc - является ли блоком
 */
function generateFeatureTestFileNew(workspaceRoot, testDir, featureName, cubitName, isBloc) {
    return __awaiter(this, void 0, void 0, function* () {
        const featureTestDir = vscode.Uri.joinPath(workspaceRoot, testDir, 'features', featureName);
        const featureTestFile = vscode.Uri.joinPath(featureTestDir, `${featureName}_test.dart`);
        const isDirectory = isBloc ? 'bloc' : 'cubit';
        const testFileName = `${(0, utils_1.toSnakeCase)(cubitName)}_test.dart`;
        const testAlias = `${(0, utils_1.toSnakeCase)(cubitName)}_test`;
        const content = `import '${isDirectory}/${testFileName}' as ${testAlias};

void main() {
  ${testAlias}.main();
}
`;
        yield vscode.workspace.fs.writeFile(featureTestFile, Buffer.from(content, 'utf8'));
        console.log(`✓ Feature test файл создан: ${featureTestFile.fsPath}`);
    });
}
/**
 * Обновляет главный тестовый файл
 * @param workspaceRoot - корневая директория рабочего пространства
 * @param testDir - директория тестов
 * @param featureName - имя фичи
 */
function updateMainTestFileNew(workspaceRoot, testDir, featureName) {
    return __awaiter(this, void 0, void 0, function* () {
        const mainTestFile = vscode.Uri.joinPath(workspaceRoot, testDir, 'test.dart');
        try {
            // Читаем существующий файл
            const existingContent = yield vscode.workspace.fs.readFile(mainTestFile);
            const content = Buffer.from(existingContent).toString('utf8');
            const importLine = `import 'features/${featureName}/${featureName}_test.dart' as ${featureName}_test;`;
            const callLine = `${featureName}_test.main();`;
            // Проверяем, есть ли уже эта фича
            if (content.includes(`features/${featureName}/${featureName}_test.dart`)) {
                console.log(`✓ Feature ${featureName} уже добавлена в main test файл`);
                return;
            }
            const lines = content.split('\n');
            const imports = [];
            const calls = [];
            let inMainFunction = false;
            // Парсим существующий контент и исправляем неправильные импорты
            lines.forEach((line) => {
                if (line.trim().startsWith('import ') && line.includes('_test.dart')) {
                    let correctedImport = line.trim();
                    // Исправляем импорты без 'as' 
                    if (!correctedImport.includes(' as ') && correctedImport.includes('features/')) {
                        // Извлекаем путь до .dart
                        const pathMatch = correctedImport.match(/import\s+'([^']+)'/);
                        if (pathMatch) {
                            const importPath = pathMatch[1];
                            // Извлекаем название фичи из пути features/feature_name/feature_name_test.dart
                            const featureMatch = importPath.match(/features\/([^\/]+)\/[^\/]+_test\.dart/);
                            if (featureMatch) {
                                const feature = featureMatch[1];
                                correctedImport = `import '${importPath}' as ${feature}_test;`;
                            }
                        }
                    }
                    imports.push(correctedImport);
                }
                else if (line.trim().startsWith('Future<void> main()') || line.trim().startsWith('void main()')) {
                    inMainFunction = true;
                }
                else if (inMainFunction && (line.trim().endsWith('_test.main();') || line.trim().endsWith('.main();'))) {
                    // Исправляем вызовы без префикса
                    let correctedCall = line.trim();
                    if (!correctedCall.includes('_test.main()') && correctedCall.includes('.main()')) {
                        // Ищем соответствующий импорт чтобы понять правильное название
                        const callMatch = correctedCall.match(/(\w+)\.main\(\);/);
                        if (callMatch) {
                            const callName = callMatch[1];
                            correctedCall = `${callName}_test.main();`;
                        }
                    }
                    calls.push(correctedCall);
                }
            });
            // Добавляем новую фичу
            imports.push(importLine);
            calls.push(callLine);
            // Убираем дубликаты и сортируем
            const uniqueImports = Array.from(new Set(imports));
            const uniqueCalls = Array.from(new Set(calls));
            uniqueImports.sort();
            uniqueCalls.sort();
            // Генерируем новый контент
            const newContent = `${uniqueImports.join('\n')}

Future<void> main() async {
${uniqueCalls.map(call => `  ${call}`).join('\n')}
}
`;
            yield vscode.workspace.fs.writeFile(mainTestFile, Buffer.from(newContent, 'utf8'));
            console.log(`✓ Main test файл обновлен: ${mainTestFile.fsPath}`);
        }
        catch (error) {
            // Если файл не существует, создаем новый
            const newContent = `import 'features/${featureName}/${featureName}_test.dart' as ${featureName}_test;

Future<void> main() async {
  ${featureName}_test.main();
}
`;
            yield vscode.workspace.fs.writeFile(mainTestFile, Buffer.from(newContent, 'utf8'));
            console.log(`✓ Main test файл создан: ${mainTestFile.fsPath}`);
        }
    });
}
/**
 * Парсинг кубита/блока через лексер
 * @param classCode - код класса для анализа
 * @returns объект с событиями и зависимостями
 */
function parseCubitOrBloc(classCode) {
    // Используем лексер вместо регулярок
    const lexerResult = (0, dartLexer_1.parseClassWithLexer)(classCode);
    const events = lexerResult.events.map(e => ({
        name: e.name,
        handler: e.handler
    }));
    const dependencies = lexerResult.dependencies.map(d => ({
        name: d.name,
        type: d.type
    }));
    console.log(`🔧 ЛЕКСЕР: Найдено ${events.length} событий и ${dependencies.length} зависимостей`);
    return { events, dependencies };
}
/**
 * Парсинг состояний через лексер
 * @param classCode - код с определениями состояний
 * @returns массив объектов состояний
 */
function parseInlineStates(classCode) {
    // Используем лексер вместо регулярок
    const lexerStates = (0, dartLexer_1.parseStatesWithLexer)(classCode);
    const states = lexerStates.map(s => ({
        name: s.name,
        isInitial: s.isInitial,
        isError: s.isError,
        isLoading: s.isLoading,
        isSuccess: s.isSuccess
    }));
    console.log(`🔧 ЛЕКСЕР: Найдено ${states.length} состояний`);
    return states;
}
/**
 * Парсинг состояний из файла
 * @param stateFilePath - путь к файлу с состояниями
 * @returns Promise с массивом состояний
 */
function parseStates(stateFilePath) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const stateDocument = yield vscode.workspace.openTextDocument(stateFilePath);
            const stateCode = stateDocument.getText();
            return parseInlineStates(stateCode);
        }
        catch (error) {
            // Если файл не найден, возвращаем пустой массив
            return [];
        }
    });
}
// ===== ФУНКЦИИ ГЕНЕРАЦИИ DOT ГРАФОВ =====
/**
 * Генерирует DOT граф для конечного автомата состояний
 * @param fsm - конечный автомат состояний
 * @param states - массив информации о состояниях
 * @returns строка с DOT кодом
 */
function generateFSMGraphvizDot(fsm, states) {
    let dot = 'digraph FSM {\n';
    dot += '  rankdir=LR;\n';
    dot += '  node [shape=circle];\n';
    dot += '  edge [fontsize=10];\n';
    // Добавляем начальное состояние с зеленой заливкой
    dot += `  "${fsm.initialState}" [style=filled, fillcolor=green, label="${fsm.initialState}\\n(начальное)"];\n`;
    // Добавляем остальные состояния с цветовой кодировкой
    for (const state of fsm.states) {
        if (state !== fsm.initialState) {
            // Получаем информацию о типе состояния
            const stateInfo = states === null || states === void 0 ? void 0 : states.find(s => s.name === state);
            let color = 'lightgray';
            let label = state;
            let stateType = '';
            // Определяем цвет на основе типа состояния
            if (stateInfo) {
                if (stateInfo.isError) {
                    color = 'lightcoral';
                    stateType = '(ошибка)';
                }
                else if (stateInfo.isLoading) {
                    color = 'lightyellow';
                    stateType = '(загрузка)';
                }
                else if (stateInfo.isSuccess) {
                    color = 'lightblue';
                    stateType = '(успех)';
                }
                else {
                    color = 'lightcyan';
                    stateType = '(состояние)';
                }
            }
            else {
                // Анализ по названию состояния
                const stateLower = state.toLowerCase();
                if (stateLower.includes('error') || stateLower.includes('failure') || stateLower.includes('fail')) {
                    color = 'lightcoral';
                    stateType = '(ошибка)';
                }
                else if (stateLower.includes('loading') || stateLower.includes('waiting') || stateLower.includes('progress')) {
                    color = 'lightyellow';
                    stateType = '(загрузка)';
                }
                else if (stateLower.includes('success') || stateLower.includes('loaded') || stateLower.includes('complete')) {
                    color = 'lightblue';
                    stateType = '(успех)';
                }
                else if (stateLower.includes('initial') || stateLower.includes('idle')) {
                    color = 'lightgreen';
                    stateType = '(начальное)';
                }
                else {
                    color = 'lightcyan';
                    stateType = '(состояние)';
                }
            }
            label += `\\n${stateType}`;
            dot += `  "${state}" [style=filled, fillcolor=${color}, label="${label}"];\n`;
        }
    }
    // Добавляем переходы между состояниями
    const addedTransitions = new Set();
    for (const transition of fsm.transitions) {
        const transitionKey = `${transition.from}-${transition.method}-${transition.to}`;
        if (!addedTransitions.has(transitionKey)) {
            addedTransitions.add(transitionKey);
            dot += `  "${transition.from}" -> "${transition.to}" [label="${transition.method}"];\n`;
        }
    }
    dot += '}\n';
    return dot;
}
/**
 * Генерирует DOT граф для тестовых путей
 * @param fsm - конечный автомат состояний
 * @param paths - массив тестовых путей
 * @param states - массив информации о состояниях
 * @returns строка с DOT кодом
 */
function generateTestPathsGraphvizDot(fsm, paths, states) {
    let dot = 'digraph TestPaths {\n';
    dot += '  rankdir=LR;\n';
    dot += '  node [shape=circle];\n';
    dot += '  edge [fontsize=10];\n';
    // Собираем все состояния, используемые в тестовых путях
    const usedStates = new Set();
    for (const path of paths) {
        for (const state of path.states) {
            usedStates.add(state);
        }
    }
    // Добавляем состояния с цветовой кодировкой
    for (const state of Array.from(usedStates)) {
        const isInitial = state === fsm.initialState;
        const stateInfo = states === null || states === void 0 ? void 0 : states.find(s => s.name === state);
        let color = 'lightgray';
        let label = state;
        let stateType = '';
        if (isInitial) {
            color = 'green';
            stateType = '(начальное)';
        }
        else if (stateInfo) {
            // Используем информацию из анализа состояний
            if (stateInfo.isError) {
                color = 'lightcoral';
                stateType = '(ошибка)';
            }
            else if (stateInfo.isLoading) {
                color = 'lightyellow';
                stateType = '(загрузка)';
            }
            else if (stateInfo.isSuccess) {
                color = 'lightblue';
                stateType = '(успех)';
            }
            else {
                color = 'lightcyan';
                stateType = '(состояние)';
            }
        }
        else {
            // Анализ по названию
            const stateLower = state.toLowerCase();
            if (stateLower.includes('error') || stateLower.includes('failure') || stateLower.includes('fail')) {
                color = 'lightcoral';
                stateType = '(ошибка)';
            }
            else if (stateLower.includes('loading') || stateLower.includes('waiting') || stateLower.includes('progress')) {
                color = 'lightyellow';
                stateType = '(загрузка)';
            }
            else if (stateLower.includes('success') || stateLower.includes('loaded') || stateLower.includes('complete')) {
                color = 'lightblue';
                stateType = '(успех)';
            }
            else if (stateLower.includes('initial') || stateLower.includes('idle')) {
                color = 'green';
                stateType = '(начальное)';
            }
            else {
                color = 'lightcyan';
                stateType = '(состояние)';
            }
        }
        label += `\\n${stateType}`;
        dot += `  "${state}" [style=filled, fillcolor=${color}, label="${label}"];\n`;
    }
    // Добавляем тестовые пути с уникальной комбинацией цвет + ширина линии
    const pathColors = ['red', 'blue', 'green', 'purple', 'orange', 'brown', 'pink', 'gray', 'olive', 'navy'];
    const baseWidth = 2; // Базовая ширина линии
    const widthStep = 1; // Шаг увеличения ширины для каждой "группы" цветов
    for (let i = 0; i < paths.length; i++) {
        const path = paths[i];
        const colorIndex = i % pathColors.length;
        const color = pathColors[colorIndex];
        const widthGroup = Math.floor(i / pathColors.length);
        const penwidth = baseWidth + widthGroup * widthStep;
        dot += `\n  // Тестовый путь ${i + 1}: ${path.methods.join(' → ') || 'инициализация'} (цвет: ${color}, ширина: ${penwidth})\n`;
        if (path.states.length === 1) {
            // Путь инициализации - только одно состояние
            dot += `  // Путь инициализации: ${path.states[0]}\n`;
        }
        else {
            // Путь с переходами между состояниями
            for (let j = 0; j < path.methods.length; j++) {
                const fromState = path.states[j];
                const toState = path.states[j + 1];
                const method = path.methods[j];
                dot += `  "${fromState}" -> "${toState}" [label="Путь ${i + 1}:\\n${method}", color=${color}, penwidth=${penwidth}, fontcolor=${color}];\n`;
            }
        }
    }
    // Добавляем легенду для понимания путей с уникальными комбинациями цвет+ширина
    if (paths.length > 0) {
        dot += '\n  // Легенда тестовых путей\n';
        dot += '  subgraph cluster_legend {\n';
        dot += '    label="Легенда тестовых путей";\n';
        dot += '    style=filled;\n';
        dot += '    fillcolor=lightyellow;\n';
        // Показываем все пути в легенде с их уникальными визуальными характеристиками
        for (let i = 0; i < paths.length; i++) {
            const colorIndex = i % pathColors.length;
            const color = pathColors[colorIndex];
            const widthGroup = Math.floor(i / pathColors.length);
            const penwidth = baseWidth + widthGroup * widthStep;
            const pathDescription = paths[i].methods.length > 0
                ? paths[i].methods.join(' → ')
                : 'Инициализация';
            // Создаем описание с указанием ширины для различения одинаковых цветов
            const visualDescription = widthGroup > 0
                ? `${pathDescription}\\n(ширина: ${penwidth})`
                : pathDescription;
            dot += `    "legend${i}" [shape=box, style=filled, fillcolor=white, label="Путь ${i + 1}:\\n${visualDescription}", color=${color}, penwidth=${penwidth}];\n`;
        }
        // Добавляем пояснение о системе визуального кодирования
        if (paths.length > pathColors.length) {
            dot += `    "legend_info" [shape=plaintext, label="Примечание:\\nОдинаковые цвета различаются\\nшириной линий", fontsize=9, color=gray];\n`;
        }
        dot += '  }\n';
    }
    dot += '}\n';
    return dot;
}
// ===== ФУНКЦИЯ ГЕНЕРАЦИИ WEBVIEW =====
/**
 * Создает WebView панель для анализа тестов
 * @param workspaceRoot - корневая директория рабочего пространства
 * @param testDir - директория тестов
 * @param featureName - имя фичи
 * @param cubitName - имя кубита/блока
 * @param enhancedMethods - анализированные методы
 * @param enhancedStates - анализированные состояния
 * @param fsm - автомат состояний
 * @param testPaths - массив тестовых путей
 * @param executionBranches - Map веток выполнения
 */
function generateInfoFile(workspaceRoot, testDir, featureName, cubitName, enhancedMethods, enhancedStates, fsm, testPaths, executionBranches) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('\n📋 НОВЫЙ ГЕНЕРАТОР: Создание WebView панели...');
        // Создаем DOT графы
        const fsmDot = generateFSMGraphvizDot(fsm, enhancedStates);
        const pathsDot = generateAdvancedTestPathsGraphvizDot(fsm, testPaths, enhancedStates);
        // Используем новый модуль webview
        (0, webviewGenerator_1.createTestAnalysisWebview)(cubitName, enhancedMethods, enhancedStates, fsm, testPaths, executionBranches, fsmDot, pathsDot);
    });
}
// ===== ГЛАВНАЯ ФУНКЦИЯ ГЕНЕРАЦИИ =====
/**
 * Главная функция генерации тестов для Cubit/Bloc классов
 * Анализирует код класса, парсит состояния и методы, строит автомат состояний
 * и генерирует полную структуру тестов с WebView панелью для анализа
 *
 * @param workspaceRoot - Корневая директория рабочего пространства VS Code
 * @param testDir - Директория для создания тестов (обычно 'test')
 * @param featureName - Имя фичи (используется для структуры папок)
 * @param cubitName - Имя класса Cubit/Bloc для анализа
 * @param classCode - Полный исходный код класса Cubit/Bloc
 * @param packageName - Имя пакета (для импортов в тестах)
 *
 * @throws {Error} Если не найдено состояний или произошла ошибка при парсинге
 *
 * @description
 * **Этапы генерации:**
 * 1. Парсинг состояний из отдельного файла или встроенных
 * 2. Анализ методов/событий через унифицированный лексер
 * 3. Построение автомата состояний (FSM)
 * 4. Генерация тестовых путей
 * 5. Создание WebView панели с анализом
 * 6. Генерация файлов тестов (.dart)
 *
 * **Результат:**
 * - Файлы тестов в test/features/[featureName]/
 * - WebView панель с интерактивным анализом
 * - Графы автомата состояний и тестовых путей
 * - Логи процесса генерации в консоли
 */
function generateTest(workspaceRoot, testDir, featureName, cubitName, classCode, packageName) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        console.log('\n🚀 НОВЫЙ ГЕНЕРАТОР: Начинаем генерацию тестов...');
        try {
            const isBloc = cubitName.toLowerCase().includes('bloc');
            // 1. Парсинг состояний
            let states = [];
            const stateDirectory = isBloc ? 'bloc' : 'cubit';
            const stateFilePath = vscode.Uri.joinPath(workspaceRoot, 'lib', 'features', featureName, stateDirectory, `${featureName}_state.dart`);
            try {
                yield vscode.workspace.fs.stat(stateFilePath);
                states = yield parseStates(stateFilePath);
                console.log(`✓ Найдено ${states.length} состояний из файла состояний (${stateDirectory})`);
            }
            catch (_b) {
                states = parseInlineStates(classCode);
                console.log(`✓ Найдено ${states.length} встроенных состояний`);
            }
            if (states.length === 0) {
                throw new Error('Не найдено ни одного состояния');
            }
            const initialState = ((_a = states.find(s => s.isInitial)) === null || _a === void 0 ? void 0 : _a.name) || states[0].name;
            console.log(`✓ Начальное состояние: ${initialState}`);
            // 2. Парсинг методов с новым парсером
            const { enhancedMethods, enhancedStates } = parseEnhancedMethods(classCode, cubitName, isBloc, states);
            console.log(`✓ НОВЫЙ ПАРСЕР: Найдено ${enhancedMethods.length} методов`);
            for (const method of enhancedMethods) {
                console.log(`   📋 ${method.name}: ${method.reachableStates.length} состояний, ${method.finalStates.length} финальных, ${method.transientStates.length} сквозных`);
            }
            // 3. Построение автомата
            const { fsm, parsedMethods } = buildEnhancedFSM(enhancedMethods, enhancedStates, initialState);
            console.log(`✓ Построен автомат: ${fsm.states.length} состояний, ${fsm.transitions.length} переходов`);
            // 4. Генерация тестовых путей на основе полной теории BFS остовного дерева
            const testPaths = generateTestPaths(fsm, enhancedMethods, 10);
            console.log(`✓ ТЕОРИЯ BFS: Сгенерировано ${testPaths.length} основных тестовых путей`);
            // 5. Генерация дополнительных интеллектуальных комбинированных путей
            const combinedPaths = generateSmartCombinedPaths(fsm, enhancedMethods, testPaths, 5, 2, 3);
            console.log(`✓ ТЕОРИЯ: Сгенерировано ${combinedPaths.length} интеллектуальных комбинированных путей`);
            // 📊 ДЕТАЛЬНАЯ СТАТИСТИКА ПОКРЫТИЯ
            const allGeneratedPaths = [...testPaths, ...combinedPaths];
            console.log(`\n📊 ФИНАЛЬНАЯ СТАТИСТИКА ТЕОРИИ BFS:`);
            console.log(`   🧮 Основных путей (систематические): ${testPaths.length}`);
            console.log(`   🎯 Дополнительных путей (интеллектуальные): ${combinedPaths.length}`);
            console.log(`   📈 Всего уникальных тестовых путей: ${allGeneratedPaths.length}`);
            // Анализ покрытия методов и состояний
            const allMethods = [];
            const allStates = [];
            for (const path of allGeneratedPaths) {
                allMethods.push(...path.methods);
                allStates.push(...path.states);
            }
            const coveredMethods = new Set(allMethods);
            const coveredStates = new Set(allStates);
            const totalMethods = enhancedMethods.length;
            const totalStates = fsm.states.length;
            console.log(`   ⚙️ Покрытие методов: ${coveredMethods.size}/${totalMethods} (${Math.round(coveredMethods.size / totalMethods * 100)}%)`);
            console.log(`   🎭 Покрытие состояний: ${coveredStates.size}/${totalStates} (${Math.round(coveredStates.size / totalStates * 100)}%)`);
            // Детальный анализ по типам путей
            const initializationPaths = testPaths.filter(p => p.methods.length === 0);
            const shortPaths = testPaths.filter(p => p.methods.length >= 1 && p.methods.length <= 2);
            const mediumPaths = testPaths.filter(p => p.methods.length >= 3);
            console.log(`   📝 Распределение основных путей:`);
            console.log(`      - Инициализация: ${initializationPaths.length}`);
            console.log(`      - Короткие (1-2 перехода): ${shortPaths.length}`);
            console.log(`      - Средние (3+ переходов): ${mediumPaths.length}`);
            // Анализ качества покрытия
            const methodCoverageQuality = coveredMethods.size / totalMethods;
            const stateCoverageQuality = coveredStates.size / totalStates;
            const avgPathLength = allGeneratedPaths.reduce((sum, path) => sum + path.methods.length, 0) / allGeneratedPaths.length;
            console.log(`   📈 Качественные метрики:`);
            console.log(`      - Средняя длина пути: ${avgPathLength.toFixed(1)} переходов`);
            console.log(`      - Коэффициент покрытия методов: ${(methodCoverageQuality * 100).toFixed(1)}%`);
            console.log(`      - Коэффициент покрытия состояний: ${(stateCoverageQuality * 100).toFixed(1)}%`);
            console.log(`      - Общий коэффициент качества: ${((methodCoverageQuality + stateCoverageQuality) / 2 * 100).toFixed(1)}%`);
            // 6. Создание веток выполнения на основе реальных тестовых путей
            const executionBranches = createExecutionBranchesFromTestPaths(testPaths, combinedPaths, enhancedMethods);
            console.log(`✓ Создано ${Array.from(executionBranches.values()).reduce((acc, branches) => acc + branches.length, 0)} веток выполнения`);
            // 7. Создание информационного файла
            yield generateInfoFile(workspaceRoot, testDir, featureName, cubitName, enhancedMethods, enhancedStates, fsm, testPaths, executionBranches);
            // 8. Генерация структуры тестов
            yield generateTestFilesStructure(workspaceRoot, testDir, featureName, cubitName, enhancedMethods, enhancedStates, testPaths, combinedPaths, isBloc, fsm, classCode);
            console.log('🎉 ГЕНЕРАТОР: Генерация завершена успешно!');
        }
        catch (error) {
            console.error('❌ ГЕНЕРАТОР: Ошибка при генерации:', error);
            throw error;
        }
    });
}
exports.generateTest = generateTest;
/**
 * Строит BFS остовное дерево для автомата состояний согласно теории
 * @param fsm - конечный автомат состояний
 * @returns корень дерева, все узлы и классификация ребер
 */
function buildBFSSpanningTreeAdvanced(fsm) {
    const visited = new Set();
    const queue = [];
    const allNodes = new Map();
    const edges = [];
    const treeEdges = [];
    const nonTreeEdges = [];
    // Создаем корневой узел (начальное состояние q₀)
    const root = {
        state: fsm.initialState,
        depth: 0,
        pathFromRoot: [],
        statesFromRoot: [fsm.initialState]
    };
    queue.push(root);
    visited.add(fsm.initialState);
    allNodes.set(fsm.initialState, root);
    console.log(`🌳 BFS ТЕОРИЯ: Построение остовного дерева из q₀ = ${fsm.initialState}`);
    // BFS обход для построения остовного дерева
    while (queue.length > 0) {
        const currentNode = queue.shift();
        const currentState = currentNode.state;
        // Находим все исходящие переходы из текущего состояния
        const outgoingTransitions = fsm.transitions.filter(t => t.from === currentState);
        for (const transition of outgoingTransitions) {
            const edge = {
                from: transition.from,
                to: transition.to,
                method: transition.method,
                isInTree: false
            };
            if (!visited.has(transition.to)) {
                // Новая вершина - добавляем в остовное дерево
                visited.add(transition.to);
                edge.isInTree = true;
                const newNode = {
                    state: transition.to,
                    parent: currentNode,
                    depth: currentNode.depth + 1,
                    pathFromRoot: [...currentNode.pathFromRoot, transition.method],
                    statesFromRoot: [...currentNode.statesFromRoot, transition.to]
                };
                queue.push(newNode);
                allNodes.set(transition.to, newNode);
                treeEdges.push(edge);
                console.log(`   ✓ Дерево: ${transition.from} --[${transition.method}]--> ${transition.to} (глубина ${newNode.depth})`);
            }
            else {
                // Уже посещенная вершина - ребро вне остовного дерева
                edge.isInTree = false;
                nonTreeEdges.push(edge);
                console.log(`   → Вне дерева: ${transition.from} --[${transition.method}]--> ${transition.to}`);
            }
            edges.push(edge);
        }
    }
    console.log(`✓ BFS дерево: ${allNodes.size} узлов, ${treeEdges.length} ребер в дереве, ${nonTreeEdges.length} ребер вне дерева`);
    return { root, allNodes, edges, treeEdges, nonTreeEdges };
}
/**
 * Генерирует пути в остовном дереве (до каждого достижимого состояния)
 * @param allNodes - все узлы BFS дерева
 * @returns массив путей в остовном дереве
 */
function generateInTreePathsAdvanced(allNodes) {
    const paths = [];
    console.log(`🛤️ ТЕОРИЯ: Генерация путей в остовном дереве:`);
    for (const [state, node] of allNodes) {
        if (node.depth === 0) {
            // Корневой узел - путь инициализации
            paths.push({
                states: [node.state],
                methods: [],
                conditions: [],
                pathType: 'in-tree-root',
                depth: 0,
                isSpanningTreePath: true
            });
            console.log(`   📍 Корневой путь: q₀ = ${node.state}`);
        }
        else {
            // Путь от корня до данного узла по ребрам остовного дерева
            paths.push({
                states: node.statesFromRoot,
                methods: node.pathFromRoot,
                conditions: [],
                pathType: 'in-tree-node',
                depth: node.depth,
                isSpanningTreePath: true
            });
            console.log(`   🎯 Путь в дереве (d=${node.depth}): ${node.pathFromRoot.join(' → ')} = ${node.statesFromRoot.join(' → ')}`);
        }
    }
    return paths;
}
/**
 * Генерирует пути по ребрам вне остовного дерева
 * @param nonTreeEdges - ребра вне остовного дерева
 * @param allNodes - все узлы BFS дерева
 * @returns массив путей по ребрам вне дерева
 */
function generateOutTreePathsAdvanced(nonTreeEdges, allNodes) {
    const paths = [];
    console.log(`🔄 ТЕОРИЯ: Генерация путей по ребрам вне остовного дерева:`);
    for (const edge of nonTreeEdges) {
        const fromNode = allNodes.get(edge.from);
        if (fromNode) {
            // Путь: (BFS путь до узла from) + (ребро вне дерева)
            const pathStates = [...fromNode.statesFromRoot, edge.to];
            const pathMethods = [...fromNode.pathFromRoot, edge.method];
            paths.push({
                states: pathStates,
                methods: pathMethods,
                conditions: [],
                pathType: 'out-tree',
                depth: fromNode.depth + 1,
                isSpanningTreePath: false
            });
            console.log(`   🔄 Путь вне дерева: (${fromNode.pathFromRoot.join(' → ')}) + [${edge.method}] = ${pathStates.join(' → ')}`);
        }
    }
    return paths;
}
/**
 * Выбирает наиболее разнообразные пути из множества согласно критериям теории
 * @param allPaths - все сгенерированные пути
 * @param maxPaths - максимальное количество путей для выбора
 * @param preferredMinLength - предпочтительная минимальная длина пути
 * @param preferredMaxLength - предпочтительная максимальная длина пути
 * @returns отобранные пути с максимальным покрытием
 */
function selectDiversePathsAdvanced(allPaths, maxPaths = 5, preferredMinLength = 2, preferredMaxLength = 3) {
    console.log(`🎲 ТЕОРИЯ: Выбор ${maxPaths} наиболее разнообразных путей из ${allPaths.length}:`);
    // Группируем пути по типам для обеспечения покрытия
    const inTreePaths = allPaths.filter(p => p.pathType.startsWith('in-tree'));
    const outTreePaths = allPaths.filter(p => p.pathType === 'out-tree');
    // Фильтруем пути по предпочтительной длине (2-3 перехода)
    const preferredLengthPaths = allPaths.filter(p => p.methods.length >= preferredMinLength && p.methods.length <= preferredMaxLength);
    const selectedPaths = [];
    const usedTransitions = new Set();
    const usedStates = new Set();
    // 1. Путь инициализации (q₀)
    const rootPath = inTreePaths.find(p => p.methods.length === 0);
    if (rootPath) {
        selectedPaths.push({
            states: rootPath.states,
            methods: rootPath.methods,
            conditions: rootPath.conditions
        });
        console.log(`   ✅ Обязательный: Инициализация q₀`);
    }
    // 2. Пути предпочтительной длины с максимальным покрытием
    const sortedPreferredPaths = preferredLengthPaths.sort((a, b) => {
        // Приоритизируем пути с новыми переходами и состояниями
        const newTransitionsA = a.methods.filter(m => !usedTransitions.has(m)).length;
        const newTransitionsB = b.methods.filter(m => !usedTransitions.has(m)).length;
        const newStatesA = a.states.filter(s => !usedStates.has(s)).length;
        const newStatesB = b.states.filter(s => !usedStates.has(s)).length;
        // Комбинированный скор: новые переходы + новые состояния
        const scoreA = newTransitionsA * 2 + newStatesA;
        const scoreB = newTransitionsB * 2 + newStatesB;
        return scoreB - scoreA; // по убыванию
    });
    for (const path of sortedPreferredPaths) {
        if (selectedPaths.length >= maxPaths)
            break;
        const hasNewContent = path.methods.some(method => !usedTransitions.has(method)) ||
            path.states.some(state => !usedStates.has(state));
        if (hasNewContent || selectedPaths.length < 3) {
            selectedPaths.push({
                states: path.states,
                methods: path.methods,
                conditions: path.conditions
            });
            // Обновляем множества использованных элементов
            path.methods.forEach(method => usedTransitions.add(method));
            path.states.forEach(state => usedStates.add(state));
            const pathTypeDesc = path.pathType === 'in-tree-node' ? 'в дереве' :
                path.pathType === 'out-tree' ? 'вне дерева' : 'корень';
            console.log(`   ✅ Выбран (${pathTypeDesc}, d=${path.depth || 0}): ${path.methods.join(' → ') || 'q₀'}`);
        }
    }
    // 3. Оставшиеся пути для достижения maxPaths
    const remainingPaths = allPaths.filter(p => !selectedPaths.some(sp => sp.states.join('-') === p.states.join('-') &&
        sp.methods.join('-') === p.methods.join('-')));
    for (const path of remainingPaths) {
        if (selectedPaths.length >= maxPaths)
            break;
        selectedPaths.push({
            states: path.states,
            methods: path.methods,
            conditions: path.conditions
        });
        const pathTypeDesc = path.pathType === 'in-tree-node' ? 'в дереве' :
            path.pathType === 'out-tree' ? 'вне дерева' : 'корень';
        console.log(`   ✅ Дополнительный (${pathTypeDesc}): ${path.methods.join(' → ') || 'q₀'}`);
    }
    console.log(`✓ ТЕОРИЯ: Отобрано ${selectedPaths.length} путей для тестов`);
    // Анализ покрытия
    const allMethods = new Set();
    const allStates = new Set();
    for (const path of selectedPaths) {
        path.methods.forEach(method => allMethods.add(method));
        path.states.forEach(state => allStates.add(state));
    }
    console.log(`📊 Покрытие: ${allMethods.size} методов, ${allStates.size} состояний`);
    return selectedPaths;
}
/**
 * Генерирует дополнительные комбинированные пути с учетом уже выбранных
 * @param fsm - конечный автомат состояний
 * @param enhancedMethods - массив расширенной информации о методах
 * @param excludePaths - пути, которые уже были выбраны (чтобы избежать дубликатов)
 * @param maxPaths - максимальное количество дополнительных путей
 * @param minLength - минимальная длина пути
 * @param maxLength - максимальная длина пути
 * @returns массив дополнительных тестовых путей
 */
function generateSmartCombinedPaths(fsm, enhancedMethods, excludePaths = [], maxPaths = 5, minLength = 2, maxLength = 3) {
    console.log('\n🎯 ТЕОРИЯ: Генерация интеллектуальных комбинированных путей...');
    const combinedPaths = [];
    const maxAttempts = 100;
    const excludeSignatures = new Set(excludePaths.map(p => `${p.states.join('-')}-${p.methods.join('-')}`));
    // Группируем переходы по состояниям для эффективного поиска
    const transitionsByState = new Map();
    for (const transition of fsm.transitions) {
        if (!transitionsByState.has(transition.from)) {
            transitionsByState.set(transition.from, []);
        }
        transitionsByState.get(transition.from).push(transition);
    }
    // Анализ частоты использования методов в уже выбранных путях
    const methodUsage = new Map();
    for (const path of excludePaths) {
        for (const method of path.methods) {
            methodUsage.set(method, (methodUsage.get(method) || 0) + 1);
        }
    }
    console.log(`🔍 Исключаем ${excludePaths.length} существующих путей`);
    console.log(`📈 Приоритизируем менее используемые методы`);
    for (let attempt = 0; attempt < maxAttempts && combinedPaths.length < maxPaths; attempt++) {
        // Случайная длина пути в заданном диапазоне
        const pathLength = Math.floor(Math.random() * (maxLength - minLength + 1)) + minLength;
        // Начинаем с начального состояния
        let currentState = fsm.initialState;
        const pathStates = [currentState];
        const pathMethods = [];
        let validPath = true;
        // Строим интеллектуальный случайный путь
        for (let i = 0; i < pathLength; i++) {
            const availableTransitions = transitionsByState.get(currentState) || [];
            if (availableTransitions.length === 0) {
                validPath = false;
                break;
            }
            // Сортируем переходы по частоте использования (менее используемые - приоритетнее)
            const sortedTransitions = availableTransitions.sort((a, b) => {
                const usageA = methodUsage.get(a.method) || 0;
                const usageB = methodUsage.get(b.method) || 0;
                return usageA - usageB;
            });
            // Выбираем из первой трети наименее используемых (с элементом случайности)
            const topThird = sortedTransitions.slice(0, Math.max(1, Math.ceil(sortedTransitions.length / 3)));
            const selectedTransition = topThird[Math.floor(Math.random() * topThird.length)];
            pathMethods.push(selectedTransition.method);
            pathStates.push(selectedTransition.to);
            currentState = selectedTransition.to;
        }
        // Проверяем валидность и уникальность пути
        if (validPath && pathMethods.length >= minLength) {
            const pathSignature = `${pathStates.join('-')}-${pathMethods.join('-')}`;
            if (!excludeSignatures.has(pathSignature)) {
                const newPath = {
                    states: pathStates,
                    methods: pathMethods,
                    conditions: []
                };
                combinedPaths.push(newPath);
                excludeSignatures.add(pathSignature);
                // Обновляем статистику использования методов
                pathMethods.forEach(method => {
                    methodUsage.set(method, (methodUsage.get(method) || 0) + 1);
                });
                console.log(`   🎯 Путь ${combinedPaths.length}: ${pathMethods.join(' → ')} = ${pathStates.join(' → ')}`);
            }
        }
    }
    console.log(`✓ ТЕОРИЯ: Сгенерировано ${combinedPaths.length} интеллектуальных комбинированных путей`);
    return combinedPaths;
}
/**
 * Главная функция генерации тестовых путей на основе полной теории BFS остовного дерева
 * @param fsm - конечный автомат состояний
 * @param enhancedMethods - массив расширенной информации о методах
 * @param maxPaths - максимальное количество основных путей
 * @returns массив тестовых путей
 */
function generateAdvancedTestPaths(fsm, enhancedMethods, maxPaths = 10) {
    console.log('\n🧮 ТЕОРИЯ BFS: Генерация систематического тестового множества...');
    // Проверяем, есть ли вообще переходы
    if (fsm.transitions.length === 0) {
        console.log('⚠️ Автомат не имеет переходов, создаем только тест инициализации');
        return [{
                states: [fsm.initialState],
                methods: [],
                conditions: []
            }];
    }
    // 1. Строим BFS остовное дерево согласно теории
    const { root, allNodes, edges, treeEdges, nonTreeEdges } = buildBFSSpanningTreeAdvanced(fsm);
    // 2. Генерируем пути в остовном дереве (покрывают все достижимые состояния)
    const inTreePaths = generateInTreePathsAdvanced(allNodes);
    // 3. Генерируем пути по ребрам вне дерева (покрывают сложные переходы)
    const outTreePaths = generateOutTreePathsAdvanced(nonTreeEdges, allNodes);
    // 4. Объединяем все пути
    const allPaths = [...inTreePaths, ...outTreePaths];
    console.log(`📊 ТЕОРИЯ - Статистика путей:`);
    console.log(`   📍 Пути в остовном дереве: ${inTreePaths.length}`);
    console.log(`   🔄 Пути по ребрам вне дерева: ${outTreePaths.length}`);
    console.log(`   📈 Всего путей в множестве: ${allPaths.length}`);
    // 5. Выбираем наиболее разнообразные пути (длиной 2-3 перехода)
    const selectedPaths = selectDiversePathsAdvanced(allPaths, Math.min(maxPaths, 10), 2, 3);
    return selectedPaths;
}
/**
 * Генерирует улучшенный DOT граф для тестовых путей с визуализацией теории BFS
 * @param fsm - конечный автомат состояний
 * @param paths - массив тестовых путей
 * @param states - массив информации о состояниях
 * @returns строка с DOT кодом
 */
function generateAdvancedTestPathsGraphvizDot(fsm, paths, states) {
    let dot = 'digraph AdvancedTestPaths {\n';
    dot += '  rankdir=LR;\n';
    dot += '  node [shape=circle, fontsize=10];\n';
    dot += '  edge [fontsize=8];\n';
    // Собираем все состояния, используемые в тестовых путях
    const usedStates = new Set();
    for (const path of paths) {
        for (const state of path.states) {
            usedStates.add(state);
        }
    }
    // Добавляем состояния с улучшенной цветовой кодировкой
    for (const state of Array.from(usedStates)) {
        const isInitial = state === fsm.initialState;
        const stateInfo = states === null || states === void 0 ? void 0 : states.find(s => s.name === state);
        let color = 'lightgray';
        let label = state;
        let stateType = '';
        if (isInitial) {
            color = 'green';
            stateType = '(q₀)';
        }
        else if (stateInfo) {
            // Используем информацию из анализа состояний
            if (stateInfo.isError) {
                color = 'lightcoral';
                stateType = '(error)';
            }
            else if (stateInfo.isLoading) {
                color = 'lightyellow';
                stateType = '(loading)';
            }
            else if (stateInfo.isSuccess) {
                color = 'lightblue';
                stateType = '(success)';
            }
            else {
                color = 'lightcyan';
                stateType = '(state)';
            }
        }
        else {
            // Анализ по названию
            const stateLower = state.toLowerCase();
            if (stateLower.includes('error') || stateLower.includes('failure') || stateLower.includes('fail')) {
                color = 'lightcoral';
                stateType = '(error)';
            }
            else if (stateLower.includes('loading') || stateLower.includes('waiting') || stateLower.includes('progress')) {
                color = 'lightyellow';
                stateType = '(loading)';
            }
            else if (stateLower.includes('success') || stateLower.includes('loaded') || stateLower.includes('complete')) {
                color = 'lightblue';
                stateType = '(success)';
            }
            else if (stateLower.includes('initial') || stateLower.includes('idle')) {
                color = 'lightgreen';
                stateType = '(initial)';
            }
            else {
                color = 'lightcyan';
                stateType = '(state)';
            }
        }
        label += `\\n${stateType}`;
        dot += `  "${state}" [style=filled, fillcolor=${color}, label="${label}"];\n`;
    }
    // Цветовая схема для разных типов путей согласно теории BFS
    const pathColors = {
        'initialization': { color: 'green', style: 'bold', width: 3 },
        'in-tree': { color: 'blue', style: 'solid', width: 2 },
        'out-tree': { color: 'red', style: 'dashed', width: 2 },
        'combined': { color: 'purple', style: 'dotted', width: 1 }
    };
    // Добавляем тестовые пути с классификацией по теории BFS
    for (let i = 0; i < paths.length; i++) {
        const path = paths[i];
        // Определяем тип пути
        let pathType;
        let pathDescription;
        if (path.methods.length === 0) {
            pathType = 'initialization';
            pathDescription = 'Инициализация q₀';
        }
        else if (i < 5) { // Первые 5 путей считаем основными (из теории BFS)
            pathType = 'in-tree';
            pathDescription = `BFS-дерево: ${path.methods.join(' → ')}`;
        }
        else if (i < 8) { // Следующие как пути вне дерева
            pathType = 'out-tree';
            pathDescription = `Вне дерева: ${path.methods.join(' → ')}`;
        }
        else { // Остальные как комбинированные
            pathType = 'combined';
            pathDescription = `Комбинированный: ${path.methods.join(' → ')}`;
        }
        const style = pathColors[pathType];
        dot += `\n  // ${pathDescription}\n`;
        if (path.states.length === 1) {
            // Путь инициализации - добавляем специальную пометку
            dot += `  // Путь инициализации: ${path.states[0]}\n`;
            dot += `  "start" [shape=point, color=${style.color}];\n`;
            dot += `  "start" -> "${path.states[0]}" [label="init", color=${style.color}, penwidth=${style.width}, style=${style.style}];\n`;
        }
        else {
            // Путь с переходами между состояниями
            for (let j = 0; j < path.methods.length; j++) {
                const fromState = path.states[j];
                const toState = path.states[j + 1];
                const method = path.methods[j];
                // Добавляем путевую метку с типом пути
                const edgeLabel = `${method}\\n[${pathType.toUpperCase()}]`;
                dot += `  "${fromState}" -> "${toState}" [label="${edgeLabel}", color=${style.color}, penwidth=${style.width}, style=${style.style}, fontcolor=${style.color}];\n`;
            }
        }
    }
    // Добавляем легенду с теорией BFS
    if (paths.length > 0) {
        dot += '\n  // Легенда согласно теории BFS остовного дерева\n';
        dot += '  subgraph cluster_legend {\n';
        dot += '    label="Легенда теории BFS остовного дерева";\n';
        dot += '    style=filled;\n';
        dot += '    fillcolor=lightyellow;\n';
        dot += '    fontsize=12;\n';
        // Показываем типы путей с их характеристиками
        let legendIndex = 0;
        Object.entries(pathColors).forEach(([type, style]) => {
            const typeDescriptions = {
                'initialization': 'Инициализация (q₀)',
                'in-tree': 'Пути в остовном дереве',
                'out-tree': 'Пути по ребрам вне дерева',
                'combined': 'Интеллектуальные комбинированные пути'
            };
            const description = typeDescriptions[type];
            dot += `    "legend_${type}" [shape=box, style=filled, fillcolor=white, label="${description}", color=${style.color}, penwidth=${style.width}];\n`;
            legendIndex++;
        });
        // Добавляем статистику покрытия
        const initPaths = paths.filter(p => p.methods.length === 0).length;
        const shortPaths = paths.filter(p => p.methods.length >= 1 && p.methods.length <= 2).length;
        const mediumPaths = paths.filter(p => p.methods.length >= 3).length;
        dot += `    "legend_stats" [shape=plaintext, label="Статистика:\\nВсего путей: ${paths.length}\\nИнициализация: ${initPaths}\\nКороткие (1-2): ${shortPaths}\\nСредние (3+): ${mediumPaths}", fontsize=9, color=gray];\n`;
        dot += '  }\n';
    }
    dot += '}\n';
    return dot;
}
//# sourceMappingURL=cubitGeneratorNew.js.map