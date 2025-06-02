import * as vscode from 'vscode';
import { parseClassWithLexer, parseStatesWithLexer, extractMethodBodyWithLexer, parseCubitMethodsWithLexer, parseAllMethodsWithLexer } from './dartLexer';
import { 
    toSnakeCase, 
    toPascalCase, 
    getStateTypeConfig, 
    createTransitionKey, 
    cleanCode, 
    hasSignificantCodeAfter, 
    extractMethodName,
    classifyDependency,
    generateMockName,
    generateMockVariableName,
    deduplicateBy,
    REGEX_PATTERNS,
    extractFeatureName
} from './utils';
import { createTestAnalysisWebview } from './webviewGenerator';

// ===== ОСНОВНЫЕ ИНТЕРФЕЙСЫ ДЛЯ ГЕНЕРАЦИИ ТЕСТОВ =====

/**
 * Интерфейс информации о состоянии
 */
interface StateInfo {
    name: string;                // Название состояния (например, AuthLoadingState)
    properties?: string[];       // Свойства состояния (например, ['String message', 'int code'])
    isInitial?: boolean;         // Является ли начальным состоянием
    isError?: boolean;           // Является ли состоянием ошибки
    isLoading?: boolean;         // Является ли состоянием загрузки
    isSuccess?: boolean;         // Является ли успешным состоянием
}

/**
 * Интерфейс информации о зависимости
 */
interface DependencyInfo {
    name: string;                // Имя переменной зависимости (например, authRepo)
    type: string;                // Тип зависимости (например, IAuthRepository)
}

/**
 * Интерфейс информации о событии
 */
interface EventInfo {
    name: string;                // Название события (например, AuthLoginUserEvent)
    handler: string;             // Название метода-обработчика (например, _onPerformAuthorization) 
}

/**
 * Интерфейс разобранного метода
 */
interface ParsedMethod {
    name: string;                // Название метода/события
    type: 'event' | 'method';    // Тип: событие (для Bloc) или метод (для Cubit)
    allowedFromStates: string[]; // Состояния, из которых можно вызвать
    emitStates: string[];        // Состояния, которые эмитируются
    guardConditions: string[];   // Guard условия (запрещенные состояния)
}

/**
 * Интерфейс перехода конечного автомата
 */
interface FSMTransition {
    from: string;                // Исходное состояние
    to: string;                  // Целевое состояние
    method: string;              // Метод/событие, вызывающее переход
    condition?: string;          // Условие перехода
}

/**
 * Интерфейс конечного автомата
 */
interface FSM {
    states: string[];            // Все состояния в автомате
    transitions: FSMTransition[]; // Все возможные переходы
    initialState: string;        // Начальное состояние
}

/**
 * Интерфейс тестового пути
 */
interface TestPath {
    states: string[];            // Последовательность состояний в пути
    methods: string[];           // Последовательность методов/событий
    conditions: (string | undefined)[]; // Условия для каждого перехода
}

/**
 * Интерфейс ветки выполнения
 */
interface ExecutionBranch {
    branchId: string;            // Уникальный идентификатор ветки (например, "login_success_1")
    states: string[];            // Последовательность состояний в этой ветке
    repositoryCalls: string[];   // Вызовы методов репозитория в этой ветке
    storageCalls: string[];      // Вызовы методов хранилища в этой ветке
    privateMethodCalls: string[]; // Вызовы приватных методов в этой ветке
    isSuccessPath: boolean;      // Является ли это успешным путем выполнения
    isErrorPath: boolean;        // Является ли это путем с ошибкой
    isFinalState: boolean;       // Заканчивается ли ветка конечным состоянием
}

// ===== ИНТЕРФЕЙСЫ ДЛЯ ПАРСЕРА =====

/**
 * Интерфейс контекста метода Dart
 */
interface DartMethodContext {
    blockType: 'try' | 'catch' | 'if' | 'else' | 'switch' | 'case' | 'default' | 'root';
    startIndex: number;
    endIndex: number;
    nestingLevel: number;
    parentContext?: DartMethodContext;
}

/**
 * Интерфейс перехода между состояниями
 */
interface StateTransition {
    fromState: string;           // Начальное состояние
    toState: string;             // Конечное состояние
    transientStates: string[];   // Сквозные состояния между началом и концом
    repositoryCalls: string[];   // Вызовы методов репозитория
    storageCalls: string[];      // Вызовы методов хранилища
    privateMethodCalls: string[];// Вызовы приватных методов
    isReachable: boolean;        // Достижимость перехода
    conditionGuards: string[];   // Условия/ограничения перехода
}

/**
 * Интерфейс guard условия
 */
interface GuardCondition {
    blockedState: string;        // Заблокированное состояние
    action: string;              // Действие (обычно "return")
}

/**
 * Интерфейс расширенной информации о методе
 */
interface EnhancedMethodInfo {
    name: string;                // Название метода/события
    type: 'event' | 'method';    // Тип: событие (для Bloc) или метод (для Cubit)
    event?: string;              // Само событие (для блоков)
    handler?: string;            // Обработчик (для блоков)
    parameters: string[];        // Параметры
    transitions: StateTransition[]; // Детальные переходы между состояниями
    reachableStates: string[];   // Все достижимые состояния из этого метода
    finalStates: string[];       // Конечные состояния метода
    transientStates: string[];   // Сквозные состояния метода
    repositoryCalls: string[];   // Вызовы репозитория
    storageCalls: string[];      // Вызовы хранилища
    privateMethodCalls: string[];// Вызовы приватных методов
    guardConditions: GuardCondition[]; // Guard условия
    allowedStates: string[];     // Разрешенные состояния для вызова
    isArrowFunction?: boolean;   // ДОБАВЛЕНИЕ: является ли стрелочной функцией
}

/**
 * Интерфейс расширенной информации о состоянии
 */
interface EnhancedStateInfo extends StateInfo {
    isReachable?: boolean;       // Достижимость состояния
    reachabilityPaths?: string[]; // Пути достижения состояния
}

/**
 * Интерфейс информации об emit вызове
 */
interface EmitInfo {
    state: string;               // Нормализованное название состояния
    rawStatement: string;        // Оригинальный emit statement  
    context: DartMethodContext | null;
    isTransient: boolean;
    isFinal: boolean;
    reason: string;
}

// ===== ИСПРАВЛЕННЫЕ ФУНКЦИИ ПАРСИНГА =====

/**
 * Находит соответствующую закрывающую скобку
 * @param text - текст для поиска
 * @param startIndex - индекс открывающей скобки
 * @returns индекс закрывающей скобки
 */
function findMatchingBrace(text: string, startIndex: number): number {
    let braceCount = 1;
    let currentIndex = startIndex + 1;
    
    while (currentIndex < text.length && braceCount > 0) {
        const char = text[currentIndex];
        if (char === '{') {
            braceCount++;
        } else if (char === '}') {
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
function parseMethodContexts(methodBody: string): DartMethodContext[] {
    const contexts: DartMethodContext[] = [];
    
    const rootContext: DartMethodContext = {
        blockType: 'root',
        startIndex: 0,
        endIndex: methodBody.length - 1,
        nestingLevel: 0
    };
    contexts.push(rootContext);
    
    const blockPatterns = [
        { pattern: /try\s*{/g, type: 'try' as const },
        { pattern: /}\s*catch\s*\([^)]*\)\s*{/g, type: 'catch' as const },
        { pattern: /}\s*on\s+\w+\s+catch\s*\([^)]*\)\s*{/g, type: 'catch' as const },
        { pattern: /if\s*\([^)]*\)\s*{/g, type: 'if' as const },
        { pattern: /else\s*{/g, type: 'else' as const },
        { pattern: /switch\s*\([^)]*\)\s*{/g, type: 'switch' as const },
        { pattern: /case\s+[^:]+:/g, type: 'case' as const },
        { pattern: /default\s*:/g, type: 'default' as const }
    ];
    
    for (const { pattern, type } of blockPatterns) {
        let match: RegExpExecArray | null;
        while ((match = pattern.exec(methodBody)) !== null) {
            const startIndex = match.index;
            let endIndex = methodBody.length - 1;
            
            if (type === 'case' || type === 'default') {
                // Для case/default ищем до следующего case/default/break или }
                const restCode = methodBody.substring(startIndex);
                const nextBreakMatch = restCode.match(/(?:case\s+[^:]+:|default\s*:|break\s*;|})/) ;
                if (nextBreakMatch && nextBreakMatch.index) {
                    endIndex = startIndex + nextBreakMatch.index - 1;
                }
            } else {
                const openBraceIndex = methodBody.indexOf('{', startIndex);
                if (openBraceIndex !== -1) {
                    endIndex = findMatchingBrace(methodBody, openBraceIndex);
                }
            }
            
            let parentContext: DartMethodContext | undefined;
            for (const ctx of contexts) {
                if (ctx.startIndex < startIndex && ctx.endIndex > endIndex) {
                    if (!parentContext || 
                        (ctx.startIndex > parentContext.startIndex && ctx.endIndex < parentContext.endIndex)) {
                        parentContext = ctx;
                    }
                }
            }
            
            const context: DartMethodContext = {
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
function parseGuardConditions(methodBody: string): GuardCondition[] {
    const guardConditions: GuardCondition[] = [];
    
    // Ищем условия типа: if (state is SomeState) return;
    const guardPattern = /if\s*\(\s*state\s+is\s+(\w+)\s*\)\s*return\s*;/g;
    let match: RegExpExecArray | null;
    
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
function calculateAllowedStates(realStates: Set<string>, guardConditions: GuardCondition[]): string[] {
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
function analyzeEmitStatusFixed(methodBody: string, emitPosition: number, contexts: DartMethodContext[], emitContext: DartMethodContext | null, fullEmitMatch: string): { isTransient: boolean; isFinal: boolean; reason: string } {
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
        } else {
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
        } else {
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
function parseEnhancedEmitStatements(methodBody: string, methodName: string): {
    emits: EmitInfo[];
    contexts: DartMethodContext[];
} {
    const emits: EmitInfo[] = [];
    const contexts = parseMethodContexts(methodBody);
    
    // debug логирование
    // console.log(`🔍 Парсинг метода ${methodName}:`);
    // console.log(`   Найдено ${contexts.length} контекстов:`);
    // contexts.forEach((ctx, i) => {
    //     console.log(`   ${i + 1}. ${ctx.blockType} (${ctx.startIndex}-${ctx.endIndex}, level: ${ctx.nestingLevel})`);
    // });
    
    // Улучшенный regex для многострочных emit
    const emitPattern = /emit\s*\(\s*(?:const\s+)?(\w+)\s*\([^)]*\)\s*\)/g;
    let match: RegExpExecArray | null;
    
    while ((match = emitPattern.exec(methodBody)) !== null) {
        const stateName = match[1];
        const emitPosition = match.index;
        const fullEmitMatch = match[0];
        
        // Находим контекст для этого emit
        let emitContext: DartMethodContext | null = null;
        for (let i = contexts.length - 1; i >= 0; i--) {
            const context = contexts[i];
            if (context.startIndex <= emitPosition && context.endIndex >= emitPosition) {
                if (!emitContext || context.nestingLevel > emitContext.nestingLevel) {
                    emitContext = context;
                }
            }
        }
        
        const analysis = analyzeEmitStatusFixed(methodBody, emitPosition, contexts, emitContext, fullEmitMatch);
        
        // debug логирование
        // console.log(`   📤 emit(${stateName}) на позиции ${emitPosition}:`);
        // console.log(`      Контекст: ${emitContext?.blockType || 'null'}`);
        // console.log(`      Статус: ${analysis.isTransient ? 'транзитный' : 'финальный'}`);
        // console.log(`      Причина: ${analysis.reason}`);
        
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
function parseStorageRepositoryCalls(
    methodBody: string, 
    classCode: string, 
    knownEventHandlers: string[] = []
): {
    repositoryCalls: string[];
    storageCalls: string[];
    privateMethodCalls: string[];
} {
    const repositoryCalls: string[] = [];
    const storageCalls: string[] = [];
    const privateMethodCalls: string[] = [];
    
    // Ищем вызовы репозитория
    const repoRegex = /(\w+Repository|\w+Repo)\.\w+\(/g;
    let repoMatch;
    while ((repoMatch = repoRegex.exec(methodBody)) !== null) {
        repositoryCalls.push(repoMatch[0].slice(0, -1));
    }
    
    // Ищем вызовы хранилища
    const storageRegex = /(secureStorage|storage|_storage|localStorage)\.\w+\(/g;
    let storageMatch;
    while ((storageMatch = storageRegex.exec(methodBody)) !== null) {
        storageCalls.push(storageMatch[0].slice(0, -1));
    }
    
    // Ищем вызовы приватных методов (исключая известные обработчики событий)
    const privateMethodRegex = /_\w+\(/g;
    let privateMatch;
    while ((privateMatch = privateMethodRegex.exec(methodBody)) !== null) {
        const methodCall = privateMatch[0].slice(0, -1);
        
        // Исключаем известные обработчики событий из списка приватных методов
        if (!knownEventHandlers.includes(methodCall)) {
            privateMethodCalls.push(methodCall);
        }
    }
    
    return { repositoryCalls, storageCalls, privateMethodCalls };
}

/**
 * Извлекает тело метода из кода класса через лексер
 * @param classCode - Код класса для анализа
 * @param methodName - Имя метода для извлечения тела
 * @returns Тело метода в виде строки или null если метод не найден
 */
function extractMethodBodyFromCode(classCode: string, methodName: string): string | null {
    const lexerResult = extractMethodBodyWithLexer(classCode, methodName);
    if (lexerResult) {
        console.log(`🔧 ЛЕКСЕР: Извлечено тело метода ${methodName}`);
        return lexerResult;
    }
    
    console.log(`⚠️ ЛЕКСЕР: Не удалось извлечь тело метода ${methodName}`);
    return null;
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
function createStateTransitionStructuresFixed(emits: EmitInfo[], repositoryCalls: string[], storageCalls: string[], privateMethodCalls: string[], allowedStates: string[]): StateTransition[] {
    const transitions: StateTransition[] = [];
    
    if (emits.length === 0) return transitions;
    
    // Создаем только переходы из всех allowedStates в финальные состояния
    const finalStates = emits.filter(e => e.isFinal).map(e => e.state);
    
    allowedStates.forEach(allowedState => {
        finalStates.forEach(finalState => {
            // Добавляем переход из каждого allowedState в каждое финальное состояние
            const existingTransition = transitions.find(t => 
                t.fromState === allowedState && t.toState === finalState
            );
            
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
function parseEnhancedSingleMethod(
    name: string, 
    handler: string, 
    methodBody: string, 
    type: 'event' | 'method',
    classCode: string,
    realStates: Set<string>, // принимаем только реальные состояния
    isArrowFunction: boolean = false,  // флаг стрелочной функции
    knownEventHandlers: string[] = []  // известные обработчики событий
): EnhancedMethodInfo {
    const { emits } = parseEnhancedEmitStatements(methodBody, name);
    const { repositoryCalls, storageCalls, privateMethodCalls } = parseStorageRepositoryCalls(
        methodBody, 
        classCode, 
        knownEventHandlers
    );
    
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
function parseEnhancedMethods(classCode: string, cubitName: string, isBloc: boolean, realStates: StateInfo[]): {
    enhancedMethods: EnhancedMethodInfo[];
    enhancedStates: EnhancedStateInfo[];
} {
    const enhancedMethods: EnhancedMethodInfo[] = [];
    const enhancedStates: EnhancedStateInfo[] = [];
    
    // Создаем Set только из реальных состояний
    const realStatesSet = new Set(realStates.map(s => s.name));
    
    // 1. Парсим все методы через унифицированный лексер 
    // includePrivate = true для блоков (нужны приватные обработчики _on*), false для кубитов
    const allMethods = parseAllMethodsWithLexer(classCode, isBloc);
    const processedMethodNames = new Set<string>();
    
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
                const enhancedMethod = parseEnhancedSingleMethod(
                    event.name,
                    event.handler,
                    handlerMethod.body,
                    'event',
                    classCode,
                    realStatesSet,
                    handlerMethod.isArrowFunction,
                    knownEventHandlers
                );
                enhancedMethods.push(enhancedMethod);
                processedMethodNames.add(event.handler);
                console.log(`   📧 Событие ${event.name} → ${event.handler} (${handlerMethod.isArrowFunction ? 'стрелочная' : 'обычная'} функция)`);
            }
        }
        
        // 1.2. Глобальные методы блока (публичные методы, не являющиеся обработчиками)
        const globalMethods = allMethods.filter(m => 
            !m.isPrivate && 
            !processedMethodNames.has(m.name) &&
            !m.name.includes('Bloc') &&
            !m.name.includes('Cubit')
        );
        
        for (const globalMethod of globalMethods) {
            if (globalMethod.body) {
                const enhancedMethod = parseEnhancedSingleMethod(
                    globalMethod.name,
                    globalMethod.name,
                    globalMethod.body,
                    'method',
                    classCode,
                    realStatesSet,
                    globalMethod.isArrowFunction,
                    knownEventHandlers
                );
                enhancedMethods.push(enhancedMethod);
                console.log(`   ⚙️ Глобальный метод ${globalMethod.name} (${globalMethod.isArrowFunction ? 'стрелочная' : 'обычная'} функция)`);
            }
        }
        
        console.log(`✓ НОВЫЙ ПАРСЕР: Найдено ${enhancedMethods.length} методов для блока (${events.length} событий + ${globalMethods.length} глобальных методов)`);
        
    } else {
        // Для кубитов: все публичные методы (нет обработчиков событий)
        console.log(`🔧 ЛЕКСЕР: Парсим методы кубита через лексер`);
        
        const cubitMethods = allMethods.filter(m => 
            !m.isPrivate && 
            !m.name.includes('Cubit') &&
            !m.name.includes('Bloc')
        );
        
        // Для кубитов нет обработчиков событий
        const knownEventHandlers: string[] = [];
        
        for (const cubitMethod of cubitMethods) {
            if (cubitMethod.body) {
                const enhancedMethod = parseEnhancedSingleMethod(
                    cubitMethod.name,
                    cubitMethod.name,
                    cubitMethod.body,
                    'method',
                    classCode,
                    realStatesSet,
                    cubitMethod.isArrowFunction,
                    knownEventHandlers
                );
                enhancedMethods.push(enhancedMethod);
                console.log(`   ⚙️ Метод ${cubitMethod.name} (${cubitMethod.isArrowFunction ? 'стрелочная' : 'обычная'} функция)`);
            }
        }
        
        console.log(`✓ НОВЫЙ ПАРСЕР: Найдено ${cubitMethods.length} методов кубита`);
    }
    
    // Создаем EnhancedStateInfo только для реальных состояний
    realStates.forEach((stateInfo) => {
        const enhancedState: EnhancedStateInfo = {
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
function createExecutionBranchesFromTestPaths(
    testPaths: TestPath[], 
    combinedPaths: TestPath[], 
    enhancedMethods: EnhancedMethodInfo[]
): Map<string, ExecutionBranch[]> {
    const executionBranches = new Map<string, ExecutionBranch[]>();
    
    // 1. Обязательные тесты (один тест на финальное состояние метода)
    for (const path of testPaths) {
        if (path.methods.length === 0) continue; // пропускаем тест инициализации
        
        const methodName = path.methods[0];
        const method = enhancedMethods.find(m => m.name === methodName);
        if (!method) continue;
        
        const fromState = path.states[0];
        const toState = path.states[path.states.length - 1];
        
        // Ищем соответствующий переход
        const transition = method.transitions.find(t => 
            t.fromState === fromState && t.toState === toState
        ) || method.transitions.find(t => t.toState === toState); // fallback
        
        const branchId = `${methodName}_basic_${toState}`;
        const branch: ExecutionBranch = {
            branchId,
            states: transition ? [transition.fromState, ...transition.transientStates, transition.toState] : path.states,
            repositoryCalls: transition?.repositoryCalls || method.repositoryCalls,
            storageCalls: transition?.storageCalls || method.storageCalls,
            privateMethodCalls: transition?.privateMethodCalls || method.privateMethodCalls,
            isSuccessPath: !toState.toLowerCase().includes('error'),
            isErrorPath: toState.toLowerCase().includes('error'),
            isFinalState: method.finalStates.includes(toState)
        };
        
        if (!executionBranches.has(methodName)) {
            executionBranches.set(methodName, []);
        }
        executionBranches.get(methodName)!.push(branch);
    }
    
    // 2. Комбинированные тесты (случайные пути)
    for (let i = 0; i < combinedPaths.length; i++) {
        const path = combinedPaths[i];
        if (path.methods.length === 0) continue;
        
        const combinedData = createCombinedTestData(path, enhancedMethods);
        const pathDescription = path.methods.join('→');
        const branchId = `combined_${i}_${pathDescription}`;
        
        const branch: ExecutionBranch = {
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
        executionBranches.get(combinedKey)!.push(branch);
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
function buildEnhancedFSM(
    enhancedMethods: EnhancedMethodInfo[], 
    enhancedStates: EnhancedStateInfo[], 
    initialState: string
): {
    fsm: FSM;
    parsedMethods: ParsedMethod[];
    executionBranches: Map<string, ExecutionBranch[]>;
} {
    const states = [initialState, ...enhancedStates.map(s => s.name)];
    const transitions: FSMTransition[] = [];
    const parsedMethods: ParsedMethod[] = [];
    
    for (const method of enhancedMethods) {
        const parsedMethod: ParsedMethod = {
            name: method.name,
            type: method.type,
            allowedFromStates: [initialState],
            emitStates: method.reachableStates,
            guardConditions: []
        };
        parsedMethods.push(parsedMethod);
        
        // Создаем переходы для автомата
        for (const transition of method.transitions) {
            const fsmTransition: FSMTransition = {
                from: transition.fromState === 'initial' ? initialState : transition.fromState,
                to: transition.toState,
                method: method.name
            };
            transitions.push(fsmTransition);
        }
    }
    
    const fsm: FSM = {
        states: Array.from(new Set(states)),
        transitions,
        initialState
    };
    
    // Ветки выполнения будут созданы позже на основе реальных тестовых путей
    const executionBranches = new Map<string, ExecutionBranch[]>();
    
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
function generateRandomCombinedPaths(
    fsm: FSM, 
    enhancedMethods: EnhancedMethodInfo[], 
    maxPaths: number = 5,
    minLength: number = 2,
    maxLength: number = 3
): TestPath[] {
    const combinedPaths: TestPath[] = [];
    const maxAttempts = 50; // Максимум попыток генерации
    
    for (let attempt = 0; attempt < maxAttempts && combinedPaths.length < maxPaths; attempt++) {
        // Случайная длина пути (2-3 перехода)
        const pathLength = Math.floor(Math.random() * (maxLength - minLength + 1)) + minLength;
        
        // Начинаем с начального состояния
        let currentState = fsm.initialState;
        const pathStates = [currentState];
        const pathMethods: string[] = [];
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
            const isDuplicate = combinedPaths.some(existing => 
                existing.states.join('-') === pathStates.join('-') && 
                existing.methods.join('-') === pathMethods.join('-')
            );
            
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
export function createCombinedTestData(path: TestPath, enhancedMethods: EnhancedMethodInfo[]): {
    combinedRepositoryCalls: string[];
    combinedStorageCalls: string[];
    combinedPrivateMethodCalls: string[];
    allStatesInOrder: string[];  // состояния конкретных переходов
    allReachableStates: string[];
} {
    const combinedRepositoryCalls: string[] = [];
    const combinedStorageCalls: string[] = [];
    const combinedPrivateMethodCalls: string[] = [];
    const allStatesInOrder: string[] = [];  // последовательный порядок конкретных переходов
    const allReachableStates: string[] = [];
    
    // Ищем конкретные переходы по пути состояний
    for (let i = 0; i < path.methods.length; i++) {
        const methodName = path.methods[i];
        const fromState = path.states[i];     // Начальное состояние перехода
        const toState = path.states[i + 1];   // Конечное состояние перехода
        
        const methodInfo = enhancedMethods.find(m => m.name === methodName);
        
        if (methodInfo) {
            // Добавляем mock вызовы метода
            combinedRepositoryCalls.push(...methodInfo.repositoryCalls);
            combinedStorageCalls.push(...methodInfo.storageCalls);
            combinedPrivateMethodCalls.push(...methodInfo.privateMethodCalls);
            
            // Ищем конкретный переход fromState -> toState
            const specificTransition = methodInfo.transitions.find(t => 
                t.fromState === fromState && t.toState === toState
            );
            
            if (specificTransition) {
                // Добавляем состояния КОНКРЕТНОГО перехода
                allStatesInOrder.push(...specificTransition.transientStates);
                allStatesInOrder.push(specificTransition.toState);
            } else {
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
        allStatesInOrder,  // состояния конкретных переходов
        allReachableStates
    };
}

/**
 * Генерирует тестовые пути из автомата состояний
 * @param fsm - конечный автомат состояний
 * @param enhancedMethods - массив расширенной информации о методах
 * @param maxPaths - максимальное количество путей
 * @returns массив тестовых путей
 */
function generateTestPaths(fsm: FSM, enhancedMethods: EnhancedMethodInfo[], maxPaths: number = Number.MAX_SAFE_INTEGER): TestPath[] {
    const paths: TestPath[] = [];
    
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
export async function generateTestFilesStructure(
    workspaceRoot: vscode.Uri,
    testDir: string,
    featureName: string,
    cubitName: string,
    enhancedMethods: EnhancedMethodInfo[],
    enhancedStates: EnhancedStateInfo[],
    testPaths: TestPath[],
    combinedPaths: TestPath[],
    isBloc: boolean,
    fsm: FSM,
    classCode: string  // Исходный код класса
) {
    console.log('\n🧪 НОВЫЙ ГЕНЕРАТОР: Создание тестовых файлов...');
    
    const isDirectory = cubitName.toLowerCase().includes('bloc') ? 'bloc' : 'cubit';
    
    // Создаем структуру директорий: test/features/featureName/cubit(bloc)/
    const testFeatureDir = vscode.Uri.joinPath(workspaceRoot, testDir, 'features', featureName);
    const testCubitDir = vscode.Uri.joinPath(testFeatureDir, isDirectory);
    
    await vscode.workspace.fs.createDirectory(testCubitDir);
    
    // Генерируем содержимое теста
    const testContent = generateEnhancedTestContent(
        cubitName,
        featureName,
        enhancedMethods,
        enhancedStates,
        testPaths,
        combinedPaths,
        isBloc,
        fsm,
        classCode
    );
    
    const testFileName = `${toSnakeCase(cubitName)}_test.dart`;
    const testFilePath = vscode.Uri.joinPath(testCubitDir, testFileName);
    await vscode.workspace.fs.writeFile(testFilePath, Buffer.from(testContent, 'utf8'));
    
    console.log(`✓ Тест создан: ${testFilePath.fsPath}`);
    
    // Создаем общий файл для фичи: test/features/featureName/featureName_test.dart
    await generateFeatureTestFileNew(workspaceRoot, testDir, featureName, cubitName, isBloc);
    
    // Обновляем главный тестовый файл: test/test.dart
    await updateMainTestFileNew(workspaceRoot, testDir, featureName);
    
    // Применяем форматирование к созданным файлам
    await formatCreatedFiles(workspaceRoot, testDir, featureName, cubitName, isBloc);
    
    console.log('✅ Структура тестов создана успешно!');
}

/**
 * Функция для форматирования созданных файлов
 * @param workspaceRoot - корневая директория рабочего пространства
 * @param testDir - директория тестов
 * @param featureName - имя фичи
 * @param cubitName - имя кубита/блока
 * @param isBloc - является ли блоком
 */
async function formatCreatedFiles(
    workspaceRoot: vscode.Uri,
    testDir: string,
    featureName: string,
    cubitName: string,
    isBloc: boolean
) {
    try {
        console.log('\n🎨 Форматирование созданных тестовых файлов...');
        
        const isDirectory = isBloc ? 'bloc' : 'cubit';
        
        // Список файлов для форматирования
        const filesToFormat = [
            vscode.Uri.joinPath(workspaceRoot, testDir, 'features', featureName, isDirectory, `${toSnakeCase(cubitName)}_test.dart`),
            vscode.Uri.joinPath(workspaceRoot, testDir, 'features', featureName, `${featureName}_test.dart`),
            vscode.Uri.joinPath(workspaceRoot, testDir, 'test.dart')
        ];
        
        for (const filePath of filesToFormat) {
            try {
                await vscode.workspace.fs.stat(filePath);
                const document = await vscode.workspace.openTextDocument(filePath);
                await vscode.window.showTextDocument(document, { preview: true });
                
                // Применяем команду форматирования
                await vscode.commands.executeCommand('editor.action.formatDocument');
                
                // Сохраняем файл
                await document.save();
                
                console.log(`✓ Форматирование: ${filePath.fsPath}`);
            } catch (error) {
                console.log(`⚠️ Файл не найден для форматирования: ${filePath.fsPath}`);
            }
        }
        
        console.log('✅ Форматирование завершено');
    } catch (error) {
        console.error('❌ Ошибка при форматировании:', error);
    }
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
function generateEnhancedTestContent(
    cubitName: string,
    featureName: string,
    enhancedMethods: EnhancedMethodInfo[],
    enhancedStates: EnhancedStateInfo[],
    testPaths: TestPath[],
    combinedPaths: TestPath[],
    isBloc: boolean,
    fsm: FSM,
    classCode: string  // Исходный код класса для парсинга зависимостей
): string {
    const className = cubitName;
    const instanceName = cubitName.charAt(0).toLowerCase() + cubitName.slice(1);
    
    // Правильное название общего состояния
    const stateClassName = `${toPascalCase(featureName)}State`;
    
    // Автоматическое определение всех зависимостей из исходного кода
    const repositories: DependencyInfo[] = [];
    const services: DependencyInfo[] = [];
    const storages: DependencyInfo[] = [];
    
    // Упрощенный парсинг зависимостей из кода
    const dependencyRegex = /final\s+(\w+)\s+_(\w+);/g;
    let match: RegExpExecArray | null;
    
    while ((match = dependencyRegex.exec(classCode)) !== null) {
        const type = match[1];
        const name = match[2];
        
        const dependency: DependencyInfo = {
            name: name,
            type: type
        };
        
        // Классифицируем по типу
        if (type.toLowerCase().includes('repository') || type.toLowerCase().includes('repo')) {
            repositories.push(dependency);
        } else if (type.toLowerCase().includes('storage') || type.toLowerCase().includes('secure')) {
            storages.push(dependency);
        } else if (type.toLowerCase().includes('service')) {
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
    const mocks: string[] = [];
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
    const mockDeclarations: string[] = [];
    const mockInitializations: string[] = [];
    const constructorParams: string[] = [];
    
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
        if (!method || path.methods.length === 0) return '';
        
        const finalState = path.states[path.states.length - 1];
        const testName = `'${method.name} должен эмитировать ${finalState}'`;
        
        const methodCall = isBloc 
            ? `${isBloc ? 'bloc' : 'cubit'}.add(${method.name}())`
            : `${isBloc ? 'bloc' : 'cubit'}.${method.name}()`;
        
        // Генерируем моки только для тех зависимостей, которые действительно используются методом
        const repositoryMocks = method.repositoryCalls.length > 0 ? `
      // Repository mocks
      ${method.repositoryCalls.map(call => `
      when(() => mockAuthRepository.${call.split('.')[1]}(any()))
          .thenAnswer((_) async => {});`).join('')}` : '';
          
        const storageMocks = method.storageCalls.length > 0 ? `
      // Storage mocks
      ${method.storageCalls.map(call => `
      when(() => mockSecureStorageService.${call.split('.')[1]}(any()))
          .thenAnswer((_) async => 'test_value');`).join('')}` : '';
        
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
  );`
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
        } else {
            return `${isBloc ? 'bloc' : 'cubit'}.${methodName}();`;
        }
      }).join('\n      ')}
    },
    expect: () => [
      ${combinedData.allStatesInOrder.map((state: string) => `const ${state}(),`).join('\n      ')}
    ],
  );`
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

    test('начальное состояние должно быть ${enhancedStates.find(s => s.isInitial)?.name || 'InitialState'}', () {
      expect(${instanceName}.state, equals(const ${enhancedStates.find(s => s.isInitial)?.name || 'InitialState'}()));
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
async function generateFeatureTestFileNew(
    workspaceRoot: vscode.Uri,
    testDir: string,
    featureName: string,
    cubitName: string,
    isBloc: boolean
) {
    const featureTestDir = vscode.Uri.joinPath(workspaceRoot, testDir, 'features', featureName);
    const featureTestFile = vscode.Uri.joinPath(featureTestDir, `${featureName}_test.dart`);
    
    const isDirectory = isBloc ? 'bloc' : 'cubit';
    const testFileName = `${toSnakeCase(cubitName)}_test.dart`;
    const testAlias = `${toSnakeCase(cubitName)}_test`;
    
    const content = `import '${isDirectory}/${testFileName}' as ${testAlias};

void main() {
  ${testAlias}.main();
}
`;
    
    await vscode.workspace.fs.writeFile(featureTestFile, Buffer.from(content, 'utf8'));
    console.log(`✓ Feature test файл создан: ${featureTestFile.fsPath}`);
}

/**
 * Обновляет главный тестовый файл
 * @param workspaceRoot - корневая директория рабочего пространства
 * @param testDir - директория тестов
 * @param featureName - имя фичи
 */
async function updateMainTestFileNew(
    workspaceRoot: vscode.Uri,
    testDir: string,
    featureName: string
) {
    const mainTestFile = vscode.Uri.joinPath(workspaceRoot, testDir, 'test.dart');
    
    try {
        // Читаем существующий файл
        const existingContent = await vscode.workspace.fs.readFile(mainTestFile);
        const content = Buffer.from(existingContent).toString('utf8');
        
        const importLine = `import 'features/${featureName}/${featureName}_test.dart' as ${featureName}_test;`;
        const callLine = `${featureName}_test.main();`;
        
        // Проверяем, есть ли уже эта фича
        if (content.includes(`features/${featureName}/${featureName}_test.dart`)) {
            console.log(`✓ Feature ${featureName} уже добавлена в main test файл`);
            return;
        }
        
        const lines = content.split('\n');
        const imports: string[] = [];
        const calls: string[] = [];
        let inMainFunction = false;
        
        // Парсим существующий контент и исправляем неправильные импорты
        lines.forEach((line: string) => {
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
            } else if (line.trim().startsWith('Future<void> main()') || line.trim().startsWith('void main()')) {
                inMainFunction = true;
            } else if (inMainFunction && (line.trim().endsWith('_test.main();') || line.trim().endsWith('.main();'))) {
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
        
        await vscode.workspace.fs.writeFile(mainTestFile, Buffer.from(newContent, 'utf8'));
        console.log(`✓ Main test файл обновлен: ${mainTestFile.fsPath}`);
        
    } catch (error) {
        // Если файл не существует, создаем новый
        const newContent = `import 'features/${featureName}/${featureName}_test.dart' as ${featureName}_test;

Future<void> main() async {
  ${featureName}_test.main();
}
`;
        
        await vscode.workspace.fs.writeFile(mainTestFile, Buffer.from(newContent, 'utf8'));
        console.log(`✓ Main test файл создан: ${mainTestFile.fsPath}`);
    }
}

/**
 * Парсинг кубита/блока через лексер
 * @param classCode - код класса для анализа
 * @returns объект с событиями и зависимостями
 */
function parseCubitOrBloc(classCode: string): { events: EventInfo[], dependencies: DependencyInfo[] } {
    // Используем лексер вместо регулярок
    const lexerResult = parseClassWithLexer(classCode);
    
    const events: EventInfo[] = lexerResult.events.map(e => ({
        name: e.name,
        handler: e.handler
    }));
    
    const dependencies: DependencyInfo[] = lexerResult.dependencies.map(d => ({
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
function parseInlineStates(classCode: string): StateInfo[] {
    // Используем лексер вместо регулярок
    const lexerStates = parseStatesWithLexer(classCode);
    
    const states: StateInfo[] = lexerStates.map(s => ({
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
async function parseStates(stateFilePath: vscode.Uri): Promise<StateInfo[]> {
    try {
        const stateDocument = await vscode.workspace.openTextDocument(stateFilePath);
        const stateCode = stateDocument.getText();
        return parseInlineStates(stateCode);
    } catch (error) {
        // Если файл не найден, возвращаем пустой массив
        return [];
    }
}

// ===== ФУНКЦИИ ГЕНЕРАЦИИ DOT ГРАФОВ =====

/**
 * Генерирует DOT граф для конечного автомата состояний
 * @param fsm - конечный автомат состояний
 * @param states - массив информации о состояниях
 * @returns строка с DOT кодом
 */
function generateFSMGraphvizDot(fsm: FSM, states?: StateInfo[]): string {
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
            const stateInfo = states?.find(s => s.name === state);
            
            let color = 'lightgray';
            let label = state;
            let stateType = '';
            
            // Определяем цвет на основе типа состояния
            if (stateInfo) {
                if (stateInfo.isError) {
                    color = 'lightcoral';
                    stateType = '(ошибка)';
                } else if (stateInfo.isLoading) {
                    color = 'lightyellow';
                    stateType = '(загрузка)';
                } else if (stateInfo.isSuccess) {
                    color = 'lightblue';
                    stateType = '(успех)';
                } else {
                    color = 'lightcyan';
                    stateType = '(состояние)';
                }
            } else {
                // Анализ по названию состояния
                const stateLower = state.toLowerCase();
                if (stateLower.includes('error') || stateLower.includes('failure') || stateLower.includes('fail')) {
                    color = 'lightcoral';
                    stateType = '(ошибка)';
                } else if (stateLower.includes('loading') || stateLower.includes('waiting') || stateLower.includes('progress')) {
                    color = 'lightyellow';
                    stateType = '(загрузка)';
                } else if (stateLower.includes('success') || stateLower.includes('loaded') || stateLower.includes('complete')) {
                    color = 'lightblue';
                    stateType = '(успех)';
                } else if (stateLower.includes('initial') || stateLower.includes('idle')) {
                    color = 'lightgreen';
                    stateType = '(начальное)';
                } else {
                    color = 'lightcyan';
                    stateType = '(состояние)';
                }
            }
            
            label += `\\n${stateType}`;
            dot += `  "${state}" [style=filled, fillcolor=${color}, label="${label}"];\n`;
        }
    }
    
    // Добавляем переходы между состояниями
    const addedTransitions = new Set<string>();
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
function generateTestPathsGraphvizDot(fsm: FSM, paths: TestPath[], states?: StateInfo[]): string {
    let dot = 'digraph TestPaths {\n';
    dot += '  rankdir=LR;\n';
    dot += '  node [shape=circle];\n';
    dot += '  edge [fontsize=10];\n';
    
    // Собираем все состояния, используемые в тестовых путях
    const usedStates = new Set<string>();
    for (const path of paths) {
        for (const state of path.states) {
            usedStates.add(state);
        }
    }
    
    // Добавляем состояния с цветовой кодировкой
    for (const state of Array.from(usedStates)) {
        const isInitial = state === fsm.initialState;
        
        const stateInfo = states?.find(s => s.name === state);
        
        let color = 'lightgray';
        let label = state;
        let stateType = '';
        
        if (isInitial) {
            color = 'green';
            stateType = '(начальное)';
        } else if (stateInfo) {
            // Используем информацию из анализа состояний
            if (stateInfo.isError) {
                color = 'lightcoral';
                stateType = '(ошибка)';
            } else if (stateInfo.isLoading) {
                color = 'lightyellow';
                stateType = '(загрузка)';
            } else if (stateInfo.isSuccess) {
                color = 'lightblue';
                stateType = '(успех)';
            } else {
                color = 'lightcyan';
                stateType = '(состояние)';
            }
        } else {
            // Анализ по названию
            const stateLower = state.toLowerCase();
            if (stateLower.includes('error') || stateLower.includes('failure') || stateLower.includes('fail')) {
                color = 'lightcoral';
                stateType = '(ошибка)';
            } else if (stateLower.includes('loading') || stateLower.includes('waiting') || stateLower.includes('progress')) {
                color = 'lightyellow';
                stateType = '(загрузка)';
            } else if (stateLower.includes('success') || stateLower.includes('loaded') || stateLower.includes('complete')) {
                color = 'lightblue';
                stateType = '(успех)';
            } else if (stateLower.includes('initial') || stateLower.includes('idle')) {
                color = 'green';
                stateType = '(начальное)';
            } else {
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
        } else {
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
async function generateInfoFile(
    workspaceRoot: vscode.Uri,
    testDir: string,
    featureName: string,
    cubitName: string,
    enhancedMethods: EnhancedMethodInfo[],
    enhancedStates: EnhancedStateInfo[],
    fsm: FSM,
    testPaths: TestPath[],
    executionBranches: Map<string, ExecutionBranch[]>
) {
    console.log('\n📋 НОВЫЙ ГЕНЕРАТОР: Создание WebView панели...');
    
    // Создаем DOT графы
    const fsmDot = generateFSMGraphvizDot(fsm, enhancedStates);
    const pathsDot = generateTestPathsGraphvizDot(fsm, testPaths, enhancedStates);

    // Используем новый модуль webview
    createTestAnalysisWebview(
        cubitName,
        enhancedMethods,
        enhancedStates,
        fsm,
        testPaths,
        executionBranches,
        fsmDot,
        pathsDot
    );
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
export async function generateTest(
    workspaceRoot: vscode.Uri, 
    testDir: string, 
    featureName: string, 
    cubitName: string, 
    classCode: string, 
    packageName: string
) {
    console.log('\n🚀 НОВЫЙ ГЕНЕРАТОР: Начинаем генерацию тестов...');
    
    try {
        const isBloc = cubitName.toLowerCase().includes('bloc');
        
        // 1. Парсинг состояний
        let states: StateInfo[] = [];

        const stateDirectory = isBloc ? 'bloc' : 'cubit';
        const stateFilePath = vscode.Uri.joinPath(workspaceRoot, 'lib', 'features', featureName, stateDirectory, `${featureName}_state.dart`);
        
        try {
            await vscode.workspace.fs.stat(stateFilePath);
            states = await parseStates(stateFilePath);
            console.log(`✓ Найдено ${states.length} состояний из файла состояний (${stateDirectory})`);
        } catch {
            states = parseInlineStates(classCode);
            console.log(`✓ Найдено ${states.length} встроенных состояний`);
        }
        
        if (states.length === 0) {
            throw new Error('Не найдено ни одного состояния');
        }
        
        const initialState = states.find(s => s.isInitial)?.name || states[0].name;
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
        
        // 4. Генерация тестовых путей
        const testPaths = generateTestPaths(fsm, enhancedMethods, 20);
        console.log(`✓ Сгенерировано ${testPaths.length} тестовых путей`);
        
        // 5. Генерация комбинированных путей
        const combinedPaths = generateRandomCombinedPaths(fsm, enhancedMethods, 5);
        console.log(`✓ Сгенерировано ${combinedPaths.length} комбинированных путей`);
        
        // 6. Создание веток выполнения на основе реальных тестовых путей
        const executionBranches = createExecutionBranchesFromTestPaths(testPaths, combinedPaths, enhancedMethods);
        console.log(`✓ Создано ${Array.from(executionBranches.values()).reduce((acc, branches) => acc + branches.length, 0)} веток выполнения`);
        
        // 7. Создание информационного файла
        await generateInfoFile(
            workspaceRoot,
            testDir,
            featureName,
            cubitName,
            enhancedMethods,
            enhancedStates,
            fsm,
            testPaths,
            executionBranches
        );
        
        // 8. Генерация структуры тестов
        await generateTestFilesStructure(
            workspaceRoot,
            testDir,
            featureName,
            cubitName,
            enhancedMethods,
            enhancedStates,
            testPaths,
            combinedPaths,
            isBloc,
            fsm,
            classCode
        );
        
        console.log('🎉 НОВЫЙ ГЕНЕРАТОР: Генерация завершена успешно!');
        
    } catch (error) {
        console.error('❌ НОВЫЙ ГЕНЕРАТОР: Ошибка при генерации:', error);
        throw error;
    }
} 
