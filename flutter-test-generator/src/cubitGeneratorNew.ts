import * as vscode from 'vscode';
import { parseClassWithLexer, parseStatesWithLexer, extractMethodBodyWithLexer, parseCubitMethodsWithLexer } from './dartLexer';

// ===== ОСНОВНЫЕ ИНТЕРФЕЙСЫ ДЛЯ ГЕНЕРАЦИИ ТЕСТОВ =====

interface StateInfo {
    name: string;                // Название состояния (например, AuthLoadingState)
    properties?: string[];       // Свойства состояния (например, ['String message', 'int code'])
    isInitial?: boolean;         // Является ли начальным состоянием
    isError?: boolean;           // Является ли состоянием ошибки
    isLoading?: boolean;         // Является ли состоянием загрузки
    isSuccess?: boolean;         // Является ли успешным состоянием
}

interface DependencyInfo {
    name: string;                // Имя переменной зависимости (например, authRepo)
    type: string;                // Тип зависимости (например, IAuthRepository)
}

interface EventInfo {
    name: string;                // Название события (например, AuthLoginUserEvent)
    handler: string;             // Название метода-обработчика (например, _onPerformAuthorization) 
}

interface ParsedMethod {
    name: string;                // Название метода/события
    type: 'event' | 'method';    // Тип: событие (для Bloc) или метод (для Cubit)
    allowedFromStates: string[]; // Состояния, из которых можно вызвать
    emitStates: string[];        // Состояния, которые эмитируются
    guardConditions: string[];   // Guard условия (запрещенные состояния)
}

interface FSMTransition {
    from: string;                // Исходное состояние
    to: string;                  // Целевое состояние
    method: string;              // Метод/событие, вызывающее переход
    condition?: string;          // Условие перехода
}

interface FSM {
    states: string[];            // Все состояния в автомате
    transitions: FSMTransition[]; // Все возможные переходы
    initialState: string;        // Начальное состояние
}

interface TestPath {
    states: string[];            // Последовательность состояний в пути
    methods: string[];           // Последовательность методов/событий
    conditions: (string | undefined)[]; // Условия для каждого перехода
}

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

interface DartMethodContext {
    blockType: 'try' | 'catch' | 'if' | 'else' | 'switch' | 'case' | 'default' | 'root';
    startIndex: number;
    endIndex: number;
    nestingLevel: number;
    parentContext?: DartMethodContext;
}

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

interface GuardCondition {
    blockedState: string;        // Заблокированное состояние
    action: string;              // Действие (обычно "return")
}

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

interface EnhancedStateInfo extends StateInfo {
    isReachable?: boolean;       // Достижимость состояния
    reachabilityPaths?: string[]; // Пути достижения состояния
}

interface EmitInfo {
    state: string;               // Нормализованное название состояния
    rawStatement: string;        // Оригинальный emit statement  
    context: DartMethodContext | null;
    isTransient: boolean;
    isFinal: boolean;
    reason: string;
}

// ===== ИСПРАВЛЕННЫЕ ФУНКЦИИ ПАРСИНГА =====

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

// Парсинг guard условий
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

// Определение allowedStates
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

function parseStorageRepositoryCalls(methodBody: string, classCode: string): {
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
    
    // Ищем вызовы приватных методов
    const privateMethodRegex = /_\w+\(/g;
    let privateMatch;
    while ((privateMatch = privateMethodRegex.exec(methodBody)) !== null) {
        const methodCall = privateMatch[0].slice(0, -1);
        if (!methodCall.includes('_on') && !methodCall.includes('_handle')) {
            privateMethodCalls.push(methodCall);
        }
    }
    
    return { repositoryCalls, storageCalls, privateMethodCalls };
}

function extractMethodBodyFromCode(classCode: string, methodName: string): string | null {
    // Сначала пробуем лексер
    const lexerResult = extractMethodBodyWithLexer(classCode, methodName);
    if (lexerResult) {
        console.log(`🔧 ЛЕКСЕР: Извлечено тело метода ${methodName}`);
        return lexerResult;
    }
    
    // Fallback на старый метод с регулярками если лексер не справился
    console.log(`⚠️ ЛЕКСЕР: Не удалось извлечь тело метода ${methodName}, используем регулярки`);
    
    const methodStartRegex = new RegExp(`Future<void>\\s+_?${methodName}\\s*\\([^)]*\\)\\s*async\\s*\\{`, 'g');
    const match = methodStartRegex.exec(classCode);
    
    if (!match) {
        // Пробуем найти обычный метод
        const normalMethodRegex = new RegExp(`(?:Future<[^>]+>|void)\\s+${methodName}\\s*\\([^)]*\\)\\s*(?:async\\s*)?\\s*\\{`, 'g');
        const normalMatch = normalMethodRegex.exec(classCode);
        if (!normalMatch) {
            return null;
        }
        
        const startIndex = normalMatch.index + normalMatch[0].length;
        let braceCount = 1;
        let currentIndex = startIndex;
        
        while (currentIndex < classCode.length && braceCount > 0) {
            const char = classCode[currentIndex];
            if (char === '{') {
                braceCount++;
            } else if (char === '}') {
                braceCount--;
            }
            currentIndex++;
        }
        
        if (braceCount === 0) {
            return classCode.substring(startIndex, currentIndex - 1);
        }
        return null;
    }
    
    const startIndex = match.index + match[0].length;
    let braceCount = 1;
    let currentIndex = startIndex;
    
    while (currentIndex < classCode.length && braceCount > 0) {
        const char = classCode[currentIndex];
        if (char === '{') {
            braceCount++;
        } else if (char === '}') {
            braceCount--;
        }
        currentIndex++;
    }
    
    if (braceCount === 0) {
        return classCode.substring(startIndex, currentIndex - 1);
    }
    
    return null;
}

// Создание переходов из всех allowedStates
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

function parseEnhancedSingleMethod(
    name: string, 
    handler: string, 
    methodBody: string, 
    type: 'event' | 'method',
    classCode: string,
    realStates: Set<string>, // принимаем только реальные состояния
    isArrowFunction: boolean = false  // флаг стрелочной функции
): EnhancedMethodInfo {
    const { emits } = parseEnhancedEmitStatements(methodBody, name);
    const { repositoryCalls, storageCalls, privateMethodCalls } = parseStorageRepositoryCalls(methodBody, classCode);
    
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

function parseEnhancedMethods(classCode: string, cubitName: string, isBloc: boolean, realStates: StateInfo[]): {
    enhancedMethods: EnhancedMethodInfo[];
    enhancedStates: EnhancedStateInfo[];
} {
    const enhancedMethods: EnhancedMethodInfo[] = [];
    const enhancedStates: EnhancedStateInfo[] = [];
    
    // Создаем Set только из реальных состояний
    const realStatesSet = new Set(realStates.map(s => s.name));
    
    // Парсим основную информацию о кубите/блоке
    const { events, dependencies } = parseCubitOrBloc(classCode);
    
    if (isBloc && events.length > 0) {
        // Для блоков парсим события и их обработчики
        console.log(`🔧 ЛЕКСЕР: Обрабатываем ${events.length} событий блока`);
        for (const event of events) {
            const methodBody = extractMethodBodyFromCode(classCode, event.handler);
            if (methodBody) {
                const enhancedMethod = parseEnhancedSingleMethod(
                    event.name,
                    event.handler,
                    methodBody,
                    'event',
                    classCode,
                    realStatesSet,
                    false
                );
                enhancedMethods.push(enhancedMethod);
            }
        }
    } else {
        // Для кубитов используем лексер вместо регулярок
        console.log(`🔧 ЛЕКСЕР: Парсим методы кубита через лексер`);
        const lexerMethods = parseCubitMethodsWithLexer(classCode);
        
        for (const lexerMethod of lexerMethods) {
            if (lexerMethod.body) {
                const enhancedMethod = parseEnhancedSingleMethod(
                    lexerMethod.name,
                    lexerMethod.name,
                    lexerMethod.body,
                    'method',
                    classCode,
                    realStatesSet,
                    lexerMethod.isArrowFunction
                );
                enhancedMethods.push(enhancedMethod);
                console.log(`   ✓ Метод ${lexerMethod.name} (${lexerMethod.isArrowFunction ? 'стрелочная' : 'обычная'} функция)`);
            }
        }
        
        console.log(`🔧 ЛЕКСЕР: Найдено ${lexerMethods.length} методов кубита`);
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
    const executionBranches = new Map<string, ExecutionBranch[]>();
    
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
        
        // Создаем ветки выполнения
        const branches: ExecutionBranch[] = [];
        for (let i = 0; i < method.transitions.length; i++) {
            const transition = method.transitions[i];
            const branch: ExecutionBranch = {
                branchId: `${method.name}_${i}`,
                states: [transition.fromState, ...transition.transientStates, transition.toState],
                repositoryCalls: transition.repositoryCalls,
                storageCalls: transition.storageCalls,
                privateMethodCalls: transition.privateMethodCalls,
                isSuccessPath: !transition.toState.toLowerCase().includes('error'),
                isErrorPath: transition.toState.toLowerCase().includes('error'),
                isFinalState: method.finalStates.includes(transition.toState)
            };
            branches.push(branch);
        }
        executionBranches.set(method.name, branches);
    }
    
    const fsm: FSM = {
        states: Array.from(new Set(states)),
        transitions,
        initialState
    };
    
    return { fsm, parsedMethods, executionBranches };
}

// Функция для генерации случайных путей длиной 2-3 перехода
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

// Функция для объединения данных переходов в комбинированный тест
function createCombinedTestData(path: TestPath, enhancedMethods: EnhancedMethodInfo[]): {
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

function toSnakeCase(str: string): string {
    return str.replace(/([A-Z])/g, '_$1')
              .toLowerCase()
              .replace(/^_/, '');
}

// Функция для преобразования featureName в правильное название состояния
function toStateClassName(featureName: string): string {
    // Преобразуем feature_name в FeatureName
    return featureName.split('_')
                     .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                     .join('');
}

export async function generateTestFilesStructure(
    workspaceRoot: vscode.Uri,
    testDir: string,
    featureName: string,
    cubitName: string,
    enhancedMethods: EnhancedMethodInfo[],
    enhancedStates: EnhancedStateInfo[],
    testPaths: TestPath[],
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

// Функция для форматирования созданных файлов
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

function generateEnhancedTestContent(
    cubitName: string,
    featureName: string,
    enhancedMethods: EnhancedMethodInfo[],
    enhancedStates: EnhancedStateInfo[],
    testPaths: TestPath[],
    isBloc: boolean,
    fsm: FSM,
    classCode: string  // Исходный код класса для парсинга зависимостей
): string {
    const className = cubitName;
    const instanceName = cubitName.charAt(0).toLowerCase() + cubitName.slice(1);
    
    // Правильное название общего состояния
    const stateClassName = `${toStateClassName(featureName)}State`;
    
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
    const combinedPaths = generateRandomCombinedPaths(fsm, enhancedMethods, 5);
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

/// Парсинг кубита/блока через лексер вместо регулярок
/// Принимает: - classCode - код класса для анализа
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

/// Парсинг состояний через лексер вместо регулярок
/// Принимает: - classCode - код с определениями состояний
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
    
    // Добавляем тестовые пути с разными цветами для каждого пути
    const pathColors = ['red', 'blue', 'green', 'purple', 'orange', 'brown', 'pink', 'gray', 'olive', 'navy'];
    
    for (let i = 0; i < paths.length; i++) {
        const path = paths[i];
        const color = pathColors[i % pathColors.length];
        
        dot += `\n  // Тестовый путь ${i + 1}: ${path.methods.join(' → ') || 'инициализация'}\n`;
        
        if (path.states.length === 1) {
            // Путь инициализации - только одно состояние
            dot += `  // Путь инициализации: ${path.states[0]}\n`;
        } else {
            // Путь с переходами между состояниями
            for (let j = 0; j < path.methods.length; j++) {
                const fromState = path.states[j];
                const toState = path.states[j + 1];
                const method = path.methods[j];
                
                dot += `  "${fromState}" -> "${toState}" [label="Путь ${i + 1}:\\n${method}", color=${color}, penwidth=2, fontcolor=${color}];\n`;
            }
        }
    }
    
    // Добавляем легенду для понимания путей
    if (paths.length > 0) {
        dot += '\n  // Легенда тестовых путей\n';
        dot += '  subgraph cluster_legend {\n';
        dot += '    label="Легенда тестовых путей";\n';
        dot += '    style=filled;\n';
        dot += '    fillcolor=lightyellow;\n';
        
        for (let i = 0; i < Math.min(paths.length, pathColors.length); i++) {
            const color = pathColors[i];
            const pathDescription = paths[i].methods.length > 0 
                ? paths[i].methods.join(' → ') 
                : 'Инициализация';
            dot += `    "legend${i}" [shape=box, style=filled, fillcolor=white, label="Путь ${i + 1}:\\n${pathDescription}", color=${color}, penwidth=2];\n`;
        }
        
        dot += '  }\n';
    }
    
    dot += '}\n';
    return dot;
}

// ===== ФУНКЦИЯ ГЕНЕРАЦИИ WEBVIEW =====

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
    
    // Генерируем комбинированные пути для статистики
    const combinedPaths = generateRandomCombinedPaths(fsm, enhancedMethods, 5);
    
    // Генерируем HTML для информации о методах
    const methodsInfoHtml = enhancedMethods.map(method => `
        <div class="method-info">
            <h4>${method.type === 'event' ? '📧' : '⚙️'} ${method.name} (${method.type})</h4>
            <div class="method-details">
                <div class="allowed-states">
                    <strong>✓ Разрешенные состояния:</strong> 
                    ${method.allowedStates.length > 0 ? method.allowedStates.join(', ') : 'Нет'}
                </div>
                <div class="reachable-states">
                    <strong>🎯 Достижимые состояния:</strong> 
                    ${method.reachableStates.length > 0 ? method.reachableStates.join(', ') : 'Нет'}
                </div>
                <div class="final-states">
                    <strong>🏁 Финальные состояния:</strong> 
                    ${method.finalStates.length > 0 ? method.finalStates.join(', ') : 'Нет'}
                </div>
                <div class="transient-states">
                    <strong>🔄 Транзитные состояния:</strong> 
                    ${method.transientStates.length > 0 ? method.transientStates.join(', ') : 'Нет'}
                </div>
                ${method.guardConditions.length > 0 ? `
                <div class="guard-conditions">
                    <strong>🚫 Guard условия:</strong> 
                    ${method.guardConditions.map(g => g.blockedState).join(', ')}
                </div>` : ''}
                <div class="transitions-count">
                    <strong>🔄 Переходов:</strong> 
                    ${method.transitions.length}
                </div>
                <div class="calls-info">
                    <strong>📞 Вызовы:</strong>
                    Repository: ${method.repositoryCalls.join(', ') || 'нет'}, 
                    Storage: ${method.storageCalls.join(', ') || 'нет'}, 
                    Private: ${method.privateMethodCalls.join(', ') || 'нет'}
                </div>
            </div>
        </div>
    `).join('');

    // Генерируем HTML для веток выполнения
    const branchesInfoHtml = Array.from(executionBranches.entries()).map(([methodName, branches]) => `
        <div class="event-branches">
            <h4>⚙️ ${methodName}</h4>
            ${branches.map((branch, index) => `
                <div class="branch-info">
                    <h5>${branch.isSuccessPath ? '✅' : branch.isErrorPath ? '❌' : '🔄'} ${branch.branchId}</h5>
                    <div class="branch-details">
                        <div><strong>Путь:</strong> ${branch.states.join(' → ')}</div>
                        <div><strong>Репозиторий:</strong> ${branch.repositoryCalls.join(', ') || 'нет'}</div>
                        <div><strong>Хранилище:</strong> ${branch.storageCalls.join(', ') || 'нет'}</div>
                        <div><strong>Приватные методы:</strong> ${branch.privateMethodCalls.join(', ') || 'нет'}</div>
                        <div><strong>Финальная ветка:</strong> ${branch.isFinalState ? 'Да' : 'Нет'}</div>
                    </div>
                </div>
            `).join('')}
        </div>
    `).join('');
    
    // Генерируем HTML для комбинированных путей
    const combinedPathsHtml = combinedPaths.map((path, index) => `
        <div class="combined-path-info">
            <h5>🔗 Комбинированный путь ${index + 1}</h5>
            <div class="path-details">
                <div><strong>Последовательность состояний:</strong> ${path.states.join(' → ')}</div>
                <div><strong>Последовательность методов:</strong> ${path.methods.join(' → ')}</div>
                <div><strong>Длина пути:</strong> ${path.methods.length} переходов</div>
                ${(() => {
                    const combinedData = createCombinedTestData(path, enhancedMethods);
                    return `
                    <div><strong>Объединенные Repository вызовы:</strong> ${combinedData.combinedRepositoryCalls.join(', ') || 'нет'}</div>
                    <div><strong>Объединенные Storage вызовы:</strong> ${combinedData.combinedStorageCalls.join(', ') || 'нет'}</div>
                    <div><strong>Состояния конкретных переходов:</strong> ${combinedData.allStatesInOrder.join(', ') || 'нет'}</div>
                    <div><strong>Все достижимые состояния:</strong> ${combinedData.allReachableStates.join(', ') || 'нет'}</div>
                    `;
                })()}
            </div>
        </div>
    `).join('');

    // Создаем DOT графы для кнопок
    const fsmDot = generateFSMGraphvizDot(fsm, enhancedStates);
    const pathsDot = generateTestPathsGraphvizDot(fsm, testPaths, enhancedStates);

    // Генерируем HTML контент
    const htmlContent = `<!DOCTYPE html>
 <html>
 <head>
     <title>Анализ генератора тестов v2.0: ${cubitName}</title>
     <meta charset="UTF-8">
     <script src="https://unpkg.com/@hpcc-js/wasm@1.12.8/dist/index.min.js"></script>
     <script src="https://unpkg.com/d3@5"></script>
     <script src="https://unpkg.com/d3-graphviz@3.1.0/build/d3-graphviz.min.js"></script>
     <style>
         body { 
             font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
             margin: 0; 
             padding: 20px;
             background-color: #f8f9fa;
             color: #212529;
             line-height: 1.6;
         }
         .container {
             max-width: 1400px;
             margin: 0 auto;
             background-color: white;
             padding: 30px;
             border-radius: 12px;
             box-shadow: 0 4px 12px rgba(0,0,0,0.1);
         }
         .header {
             color: #2c3e50;
             border-bottom: 3px solid #3498db;
             padding-bottom: 15px;
             margin-bottom: 30px;
             text-align: center;
         }
         .stats {
             background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
             color: white;
             border-radius: 8px;
             padding: 20px;
             margin: 20px 0;
         }
         .stats h3 {
             margin-top: 0;
             color: white;
         }
         .stats ul {
             list-style-type: none;
             padding: 0;
         }
         .stats li {
             margin: 8px 0;
             padding: 5px 0;
             border-bottom: 1px solid rgba(255,255,255,0.2);
         }
         .methods-section {
             background-color: #f8f9fa;
             border: 1px solid #dee2e6;
             border-radius: 8px;
             padding: 20px;
             margin: 20px 0;
         }
         .method-info {
             background-color: white;
             border-left: 4px solid #007bff;
             border-radius: 4px;
             padding: 15px;
             margin: 15px 0;
             box-shadow: 0 2px 4px rgba(0,0,0,0.05);
         }
         .method-details {
             margin-top: 10px;
             font-size: 0.9em;
         }
         .method-details > div {
             margin: 8px 0;
             padding: 5px 0;
         }
         .allowed-states { color: #28a745; }
         .reachable-states { color: #007bff; }
         .final-states { color: #fd7e14; }
         .transient-states { color: #6f42c1; }
         .guard-conditions { color: #dc3545; }
         .transitions-count { color: #6610f2; }
         .calls-info { color: #6c757d; }
         .event-branches {
             background-color: white;
             border-left: 4px solid #28a745;
             border-radius: 4px;
             padding: 15px;
             margin: 15px 0;
             box-shadow: 0 2px 4px rgba(0,0,0,0.05);
         }
         .branch-info {
             background-color: #f8f9fa;
             border: 1px solid #e9ecef;
             border-radius: 4px;
             padding: 12px;
             margin: 10px 0;
         }
         .branch-details {
             margin-top: 8px;
             font-size: 0.9em;
         }
         .branch-details > div {
             margin: 4px 0;
         }
         .combined-path-info {
             background-color: white;
             border-left: 4px solid #ffc107;
             border-radius: 4px;
             padding: 15px;
             margin: 15px 0;
             box-shadow: 0 2px 4px rgba(0,0,0,0.05);
         }
         .path-details {
             margin-top: 8px;
             font-size: 0.9em;
         }
         .path-details > div {
             margin: 4px 0;
         }
         .enhanced-badge {
             background: linear-gradient(45deg, #28a745, #20c997);
             color: white;
             padding: 5px 15px;
             border-radius: 20px;
             font-size: 0.8em;
             margin-left: 15px;
             font-weight: bold;
         }
         .buttons-section {
             background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
             color: white;
             border-radius: 8px;
             padding: 20px;
             margin: 20px 0;
             text-align: center;
         }
         .btn {
             display: inline-block;
             padding: 12px 24px;
             margin: 10px;
             background-color: #007bff;
             color: white;
             text-decoration: none;
             border-radius: 6px;
             border: none;
             cursor: pointer;
             font-size: 14px;
             transition: all 0.3s ease;
         }
         .btn:hover {
             background-color: #0056b3;
             transform: translateY(-2px);
             box-shadow: 0 4px 8px rgba(0,0,0,0.2);
         }
         .btn-primary { background-color: #007bff; }
         .btn-success { background-color: #28a745; }
         .btn-warning { background-color: #ffc107; color: #212529; }
         .btn-info { background-color: #17a2b8; }
         .btn-secondary { background-color: #6c757d; }
         .tech-info {
             background-color: #e9ecef;
             border-radius: 8px;
             padding: 20px;
             margin: 20px 0;
         }
         .tech-info h4 {
             color: #495057;
             border-bottom: 2px solid #adb5bd;
             padding-bottom: 8px;
         }
         .tech-info ul {
             list-style-type: none;
             padding: 0;
         }
         .tech-info li {
             margin: 6px 0;
             padding: 6px 12px;
             background-color: #f8f9fa;
             border-left: 3px solid #28a745;
             border-radius: 3px;
         }
         
         /* Стили для графов */
         .graph-container {
             background-color: white;
             border: 2px solid #dee2e6;
             border-radius: 8px;
             padding: 20px;
             margin: 20px 0;
             text-align: center;
             min-height: 400px;
         }
         .graph-display {
             width: 100%;
             height: 500px;
             border: 1px solid #ccc;
             overflow: auto;
             background-color: #fafafa;
         }
         .graph-buttons {
             margin-bottom: 15px;
         }
         .graph-buttons .btn {
             margin: 5px;
         }
         
         /* Стили для выпадающих секций */
         .collapsible {
             background-color: #3498db;
             color: white;
             cursor: pointer;
             padding: 18px;
             width: 100%;
             border: none;
             text-align: left;
             outline: none;
             font-size: 16px;
             font-weight: bold;
             border-radius: 8px;
             margin: 10px 0;
             transition: all 0.3s ease;
         }
         .collapsible:hover {
             background-color: #2980b9;
         }
         .collapsible.active {
             background-color: #2980b9;
         }
         .collapsible::after {
             content: '▼';
             float: right;
             margin-left: 5px;
             transition: transform 0.3s ease;
         }
         .collapsible.active::after {
             transform: rotate(180deg);
         }
         .collapsible-content {
             max-height: 0;
             overflow: hidden;
             transition: max-height 0.3s ease;
             background-color: #f8f9fa;
             border-radius: 0 0 8px 8px;
         }
         .collapsible-content.active {
             max-height: 2000px;
             padding: 20px;
         }
     </style>
 </head>
 <body>
     <div class="container">         
         <div class="stats">
             <h3>📊 Статистика анализа</h3>
             <ul>
                 <li><strong>🔧 Методов/событий:</strong> ${enhancedMethods.length}</li>
                 <li><strong>🏗️ Состояний:</strong> ${enhancedStates.length}</li>
                 <li><strong>🔄 Переходов в автомате:</strong> ${fsm.transitions.length}</li>
                 <li><strong>📝 Обязательных тестов:</strong> ${testPaths.length} (метод → конечное состояние)</li>
                 <li><strong>🔗 Комбинированных тестов:</strong> ${combinedPaths.length} (пути 2-3 перехода)</li>
                 <li><strong>📝 Всего тестов:</strong> ${testPaths.length + combinedPaths.length}</li>
                 <li><strong>🌳 Веток выполнения:</strong> ${Array.from(executionBranches.values()).reduce((total, branches) => total + branches.length, 0)}</li>
                 <li><strong>🚀 Начальное состояние:</strong> ${fsm.initialState}</li>
                 <li><strong>📅 Дата анализа:</strong> ${new Date().toLocaleString('ru-RU')}</li>
             </ul>
         </div>

         <div class="methods-section">
             <h3>⚙️ Детальная информация о методах/событиях</h3>
             ${methodsInfoHtml}
         </div>

         <div class="buttons-section">
             <h3>🔧 Функции генератора</h3>
             <button class="btn btn-warning" onclick="copyFSMDot()">📋 Копировать DOT (FSM)</button>
             <button class="btn btn-info" onclick="copyPathsDot()">📋 Копировать DOT (Пути)</button>
             <button class="btn btn-secondary" onclick="openGraphvizOnline()">🌐 Graphviz Online</button>
         </div>

         <!-- Автомат состояний с графом -->
         <div class="graph-container">
             <h3>🏗️ Автомат состояний</h3>
             <div class="graph-buttons">
                 <button class="btn btn-primary" onclick="showFSMGraph()">🎨 Показать граф</button>
                 <button class="btn btn-secondary" onclick="hideFSMGraph()">❌ Скрыть граф</button>
             </div>
             <div id="fsm-graph" class="graph-display" style="display: none;"></div>
             
             <!-- Выпадающая подробная информация об автомате -->
             <button class="collapsible">📋 Подробная информация об автомате состояний</button>
             <div class="collapsible-content">
                 <div class="stats">
                     <p><strong>🚀 Начальное состояние:</strong> ${fsm.initialState}</p>
                     <p><strong>🏗️ Все состояния:</strong></p>
                     <ul>
                         ${fsm.states.map(state => {
                             const stateInfo = enhancedStates.find(s => s.name === state);
                             const flags = [];
                             if (stateInfo?.isInitial) flags.push('🚀 начальное');
                             if (stateInfo?.isLoading) flags.push('⏳ загрузка');
                             if (stateInfo?.isError) flags.push('❌ ошибка');
                             if (stateInfo?.isSuccess) flags.push('✅ успех');
                             return `<li>${state}${flags.length > 0 ? ` (${flags.join(', ')})` : ''}</li>`;
                         }).join('')}
                     </ul>
                     <p><strong>🔄 Переходы:</strong></p>
                     <ul>
                         ${fsm.transitions.map(t => `<li>${t.from} →[${t.method}]→ ${t.to}</li>`).join('')}
                     </ul>
                 </div>
             </div>
         </div>

         <!-- Тестовые пути с графом -->
         <div class="graph-container">
             <h3>🛤️ Тестовые пути</h3>
             <div class="graph-buttons">
                 <button class="btn btn-success" onclick="showPathsGraph()">🎨 Показать граф</button>
                 <button class="btn btn-secondary" onclick="hidePathsGraph()">❌ Скрыть граф</button>
             </div>
             <div id="paths-graph" class="graph-display" style="display: none;"></div>
             
             <!-- Выпадающая подробная информация о тестовых путях -->
             <button class="collapsible">📋 Подробная информация о тестовых путях</button>
             <div class="collapsible-content">
                 <div class="stats">
                     <h4>📝 Обязательные тесты (метод → конечное состояние):</h4>
                     ${testPaths.map((path, index) => `<p>${index + 1}. <strong>${path.methods.join(', ')}</strong> → <em>${path.states.join(' → ')}</em></p>`).join('')}
                     
                     <h4>🔗 Комбинированные тесты (конкретные переходы объединяются):</h4>
                     ${combinedPaths.map((path, index) => `<p>${index + 1}. <strong>${path.methods.join(' → ')}</strong> → <em>${path.states.join(' → ')}</em></p>`).join('')}
                 </div>
             </div>
         </div>

         <!-- Выпадающие ветки выполнения -->
         <div class="methods-section">
             <button class="collapsible">🌳 Ветки выполнения (для генерации тестов)</button>
             <div class="collapsible-content">
                 ${branchesInfoHtml}
             </div>
         </div>
         
         <!-- Выпадающие комбинированные пути -->
         <div class="methods-section">
             <button class="collapsible">🔗 Комбинированные тестовые пути (конкретные переходы)</button>
             <div class="collapsible-content">
                 ${combinedPathsHtml}
             </div>
         </div>
      </div>

     <script>
         // Данные для генерации графов
         const fsmDotData = ${JSON.stringify(fsmDot)};
         const pathsDotData = ${JSON.stringify(pathsDot)};

         // Инициализация выпадающих секций
         document.addEventListener('DOMContentLoaded', function() {
             const collapsibles = document.querySelectorAll('.collapsible');
             collapsibles.forEach(function(collapsible) {
                 collapsible.addEventListener('click', function() {
                     this.classList.toggle('active');
                     const content = this.nextElementSibling;
                     content.classList.toggle('active');
                 });
             });
         });

         // Функции для работы с графами
         function showFSMGraph() {
             const container = document.getElementById('fsm-graph');
             container.style.display = 'block';
             
             try {
                 d3.select("#fsm-graph").graphviz()
                     .renderDot(fsmDotData)
                     .on("end", function() {
                         console.log('FSM граф отрендерен');
                     });
             } catch (error) {
                 console.error('Ошибка рендеринга FSM графа:', error);
                 container.innerHTML = '<div style="padding: 20px; color: #dc3545;">❌ Ошибка рендеринга графа. Проверьте консоль браузера.</div>';
             }
         }

         function hideFSMGraph() {
             const container = document.getElementById('fsm-graph');
             container.style.display = 'none';
             container.innerHTML = '';
         }

         function showPathsGraph() {
             const container = document.getElementById('paths-graph');
             container.style.display = 'block';
             
             try {
                 d3.select("#paths-graph").graphviz()
                     .renderDot(pathsDotData)
                     .on("end", function() {
                         console.log('Paths граф отрендерен');
                     });
             } catch (error) {
                 console.error('Ошибка рендеринга Paths графа:', error);
                 container.innerHTML = '<div style="padding: 20px; color: #dc3545;">❌ Ошибка рендеринга графа. Проверьте консоль браузера.</div>';
             }
         }

         function hidePathsGraph() {
             const container = document.getElementById('paths-graph');
             container.style.display = 'none';
             container.innerHTML = '';
         }

         function copyFSMDot() {
             navigator.clipboard.writeText(fsmDotData).then(() => {
                 alert('📋 DOT код автомата состояний скопирован в буфер обмена!');
             }).catch(err => {
                 console.error('Ошибка копирования: ', err);
                 alert('❌ Ошибка копирования в буфер обмена');
             });
         }

         function copyPathsDot() {
             navigator.clipboard.writeText(pathsDotData).then(() => {
                 alert('📋 DOT код тестовых путей скопирован в буфер обмена!');
             }).catch(err => {
                 console.error('Ошибка копирования: ', err);
                 alert('❌ Ошибка копирования в буфер обмена');
             });
         }

         function openGraphvizOnline() {
             window.open('https://dreampuf.github.io/GraphvizOnline/', '_blank');
             alert('🌐 Graphviz Online открыт в новой вкладке. Вставьте скопированный DOT код для визуализации!');
         }
     </script>
 </body>
 </html>`;

    // Показываем WebView в VS Code
    const panel = vscode.window.createWebviewPanel(
        'testAnalysisV2',
        `🎯 Анализ тестов v2.0: ${cubitName}`,
        vscode.ViewColumn.Beside,
        {
            enableScripts: true,
            retainContextWhenHidden: true
        }
    );
    
    panel.webview.html = htmlContent;
    console.log('✓ WebView панель открыта в VS Code');
}

// ===== ГЛАВНАЯ ФУНКЦИЯ ГЕНЕРАЦИИ =====

export async function generateTestNew(
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
        const { fsm, parsedMethods, executionBranches } = buildEnhancedFSM(enhancedMethods, enhancedStates, initialState);
        console.log(`✓ Построен автомат: ${fsm.states.length} состояний, ${fsm.transitions.length} переходов`);
        
        // 4. Генерация тестовых путей
        const testPaths = generateTestPaths(fsm, enhancedMethods, 20);
        console.log(`✓ Сгенерировано ${testPaths.length} тестовых путей`);
        
        // 5. Создание информационного файла
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
        
        // 6. Генерация структуры тестов
        await generateTestFilesStructure(
            workspaceRoot,
            testDir,
            featureName,
            cubitName,
            enhancedMethods,
            enhancedStates,
            testPaths,
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