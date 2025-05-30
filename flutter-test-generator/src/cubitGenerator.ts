import * as vscode from 'vscode';
import * as path from 'path';
import { TextDecoder, TextEncoder } from 'util';

/**
 * Генерирует Graphviz диаграмму автомата состояний
 * Отображает все состояния и возможные переходы между ними
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
 * Генерирует Graphviz диаграмму тестовых путей с цветовой кодировкой
 * Отображает конкретные пути, которые будут протестированы
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
    for (const state of usedStates) {
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
        
        dot += `\n  // Тестовый путь ${i + 1}: ${path.methods.join(' -> ')}\n`;
        for (let j = 0; j < path.methods.length; j++) {
            const from = path.states[j];
            const to = path.states[j + 1];
            const method = path.methods[j];
            dot += `  "${from}" -> "${to}" [label="Путь ${i + 1}:\\n${method}", color=${color}, penwidth=2, fontcolor=${color}];\n`;
        }
    }
    
    // Добавляем легенду для понимания путей
    dot += '\n  // Легенда тестовых путей\n';
    dot += '  subgraph cluster_legend {\n';
    dot += '    label="Легенда тестовых путей";\n';
    dot += '    style=filled;\n';
    dot += '    fillcolor=lightyellow;\n';
    
    for (let i = 0; i < Math.min(paths.length, pathColors.length); i++) {
        const color = pathColors[i];
        const pathMethods = paths[i].methods.join(' → ');
        dot += `    "legend${i}" [shape=box, style=filled, fillcolor=white, label="Путь ${i + 1}:\\n${pathMethods}", color=${color}, penwidth=2];\n`;
    }
    
    dot += '  }\n';
    dot += '}\n';
    return dot;
}

/**
 * Преобразует CamelCase в snake_case для соответствия соглашениям Dart
 * @param str Строка в CamelCase (например: OAuthLoginBloc)
 * @returns Строка в snake_case (например: o_auth_login_bloc)
 */
function camelToSnakeCase(str: string): string {
    return str
        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')  // Обрабатываем последовательные заглавные буквы
        .replace(/([a-z\d])([A-Z])/g, '$1_$2')      // Обрабатываем обычный camelCase
        .toLowerCase();
}

/**
 * Интерфейсы для структурированного хранения данных о компонентах Flutter
 */

/**
 * Информация о состоянии Bloc/Cubit
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
 * Информация о событии Bloc
 */
interface EventInfo {
    name: string;                // Название события (например, AuthLoginUserEvent)
    handler: string;             // Название метода-обработчика (например, _onPerformAuthorization)
    parameters?: string[];       // Параметры события
    // Дополнительные поля для анализа состояний:
    transientStates?: string[];  // Сквозные состояния (проходные)
    finalStates?: string[];      // Конечные состояния (завершающие)
}

/**
 * Информация о зависимости (репозиторий, сервис и т.д.)
 */
interface DependencyInfo {
    name: string;                // Имя переменной зависимости (например, authRepo)
    type: string;                // Тип зависимости (например, IAuthRepository)
}

/**
 * Информация о методе Cubit
 */
interface MethodInfo {
    name: string;                // Название метода
    parameters: string[];        // Параметры метода
    transitions: {               // Переходы между состояниями в методе
        from: string;            // Исходное состояние
        to: string;              // Целевое состояние
        condition?: string;      // Условие перехода (guard)
        chainedEvent?: string;   // Связанное событие
    }[];
    // Дополнительные поля для анализа состояний:
    transientStates?: string[];  // Сквозные состояния (проходные)
    finalStates?: string[];      // Конечные состояния (завершающие)
}

/**
 * Обработанная информация о методе или событии
 * Используется для построения автомата состояний
 */
interface ParsedMethod {
    name: string;                // Название метода/события
    type: 'event' | 'method';    // Тип: событие (для Bloc) или метод (для Cubit)
    allowedFromStates: string[]; // Состояния, из которых можно вызвать
    emitStates: string[];        // Состояния, которые эмитируются
    guardConditions: string[];   // Guard условия (запрещенные состояния)
}

/**
 * Переход в автомате состояний
 * Представляет одно ребро в графе состояний
 */
interface FSMTransition {
    from: string;                // Исходное состояние
    to: string;                  // Целевое состояние
    method: string;              // Метод/событие, вызывающее переход
    condition?: string;          // Условие перехода
}

/**
 * Автомат конечных состояний (FSM)
 * Полное представление логики Bloc/Cubit
 */
interface FSM {
    states: string[];            // Все состояния в автомате
    transitions: FSMTransition[]; // Все возможные переходы
    initialState: string;        // Начальное состояние
}

/**
 * Тестовый путь через автомат состояний
 * Представляет последовательность переходов для одного теста
 */
interface TestPath {
    states: string[];            // Последовательность состояний в пути
    methods: string[];           // Последовательность методов/событий
    conditions: (string | undefined)[]; // Условия для каждого перехода
}

/**
 * Парсит состояния, определенные в том же файле, что и Bloc/Cubit
 * Используется когда состояния не вынесены в отдельный файл
 * @param classCode - код класса для анализа
 * @returns массив информации о найденных состояниях
 */
function parseInlineStates(classCode: string): StateInfo[] {
    const states: StateInfo[] = [];
    
    const stateRegex = /(?:abstract\s+|final\s+)?class\s+(\w+State)\s+(?:extends\s+\w+State)?(?:\s+implements\s+\w+)?\s*{([^}]*)}/g;
    // Ищем свойства состояний (final поля)
    const propertyRegex = /final\s+(?:List<)?(\w+)(?:>)?\s+(\w+);/g;
    
    let match: RegExpExecArray | null;
    while ((match = stateRegex.exec(classCode)) !== null) {
        const stateName = match[1];
        const stateBody = match[2];
        
        // Извлекаем свойства состояния
        const properties: string[] = [];
        let propertyMatch: RegExpExecArray | null;
        
        while ((propertyMatch = propertyRegex.exec(stateBody)) !== null) {
            properties.push(`${propertyMatch[1]} ${propertyMatch[2]}`);
        }
        
        // Создаем информацию о состоянии с автоматической классификацией
        const stateInfo: StateInfo = {
            name: stateName,
            properties: properties.length > 0 ? properties : undefined,
            isInitial: stateName.toLowerCase().includes('initial'),
            isError: stateName.toLowerCase().includes('error'),
            isLoading: stateName.toLowerCase().includes('loading') || stateName.toLowerCase().includes('waiting'),
            isSuccess: stateName.toLowerCase().includes('success')
        };
        
        states.push(stateInfo);
    }
    
    return states;
}

// Парсинг состояний
async function parseStates(stateFilePath: string): Promise<StateInfo[]> {
    const stateDocument = await vscode.workspace.openTextDocument(stateFilePath);
    const stateCode = stateDocument.getText();
    
    const states: StateInfo[] = [];
    
    const stateRegex = /(?:final\s+)?class\s+(\w+)\s+extends\s+\w+State(?:\s+implements\s+\w+)?\s*{([^}]*)}/g;
    const propertyRegex = /final\s+(?:List<)?(\w+)(?:>)?\s+(\w+);/g;
    
    let match: RegExpExecArray | null;
    while ((match = stateRegex.exec(stateCode)) !== null) {
        const stateName = match[1];
        const stateBody = match[2];
        
        const properties: string[] = [];
        let propertyMatch: RegExpExecArray | null;
        
        while ((propertyMatch = propertyRegex.exec(stateBody)) !== null) {
            properties.push(`${propertyMatch[1]} ${propertyMatch[2]}`);
        }
        
        const stateInfo: StateInfo = {
            name: stateName,
            properties: properties.length > 0 ? properties : undefined,
            isInitial: stateName.toLowerCase().includes('initial'),
            isError: stateName.toLowerCase().includes('error'),
            isLoading: stateName.toLowerCase().includes('loading'),
            isSuccess: stateName.toLowerCase().includes('success')
        };
        
        states.push(stateInfo);
    }
    
    // Если не нашли начальное состояние, но есть состояния с Initial в имени
    if (!states.some(s => s.isInitial) && states.length > 0) {
        const initialState = states.find(s => s.name.includes('Initial'));
        if (initialState) {
            initialState.isInitial = true;
        } else {
            // Если нет явного начального состояния, считаем первое состояние начальным
            states[0].isInitial = true;
        }
    }
    
    return states;
}

// Парсинг методов, событий и зависимостей
function parseCubitOrBloc(classCode: string): { events: EventInfo[], dependencies: DependencyInfo[], methods: MethodInfo[] } {
    const events: EventInfo[] = [];
    const dependencies: DependencyInfo[] = [];
    const methods: MethodInfo[] = [];// Парсинг событий и их обработчиков для блоков
    const onRegex = /on<(\w+)>\(\s*(_?\w+)\s*\)/g;
    let match: RegExpExecArray | null;
    while ((match = onRegex.exec(classCode)) !== null) {
        const eventName = match[1];
        let handlerName = match[2];
        
        // НЕ убираем префикс _ - сохраняем имя как есть
        // Потому что в коде метод может быть объявлен с _ или без _
        events.push({ 
            name: eventName,
            handler: handlerName
        });
    }

    // Парсинг зависимостей
    const dependencyRegex = /final\s+(\w+)\s+_(\w+);/g;
    while ((match = dependencyRegex.exec(classCode)) !== null) {
        if (match[1].includes('Repository') || match[1].includes('Secure') || match[1].includes('Service')) {
            dependencies.push({ name: match[2], type: match[1] });
        }
    }

    // Парсинг методов для блоков (приватные методы-обработчики)
    if (events.length > 0) {
        // Для каждого события ищем его обработчик
        for (const event of events) {
            // Функция для извлечения полного тела метода с правильным подсчетом скобок
            function extractMethodBody(code: string, methodName: string): string | null {
                // Ищем как публичные, так и приватные методы
                const methodStartRegex = new RegExp(`Future<void>\\s+_?${methodName}\\s*\\([^)]*\\)\\s*async\\s*\\{`, 'g');
                const match = methodStartRegex.exec(code);
                
                if (!match) {
                    return null;
                }
                
                const startIndex = match.index + match[0].length;
                let braceCount = 1;
                let currentIndex = startIndex;
                
                while (currentIndex < code.length && braceCount > 0) {
                    const char = code[currentIndex];
                    if (char === '{') {
                        braceCount++;
                    } else if (char === '}') {
                        braceCount--;
                    }
                    currentIndex++;
                }
                
                if (braceCount === 0) {
                    return code.substring(startIndex, currentIndex - 1);
                }
                
                return null;
            }
            
            // Пробуем найти метод с точным именем
            let methodBody = extractMethodBody(classCode, event.handler);
            
            // Если не нашли, пробуем варианты с _ и без _
            if (!methodBody) {
                if (event.handler.startsWith('_')) {
                    const handlerWithoutUnderscore = event.handler.substring(1);
                    methodBody = extractMethodBody(classCode, handlerWithoutUnderscore);
                } else {
                    methodBody = extractMethodBody(classCode, `_${event.handler}`);
                }
            }
            
            if (methodBody) {
                console.log(`   Тело метода: ${methodBody.substring(0, 100)}...`);
                
                const transitions = parseMethodTransitions(methodBody, event.handler);
                methods.push({ 
                    name: event.handler, 
                    parameters: [], 
                    transitions 
                });
            } else {
                console.log(`✗ Не найден обработчик ${event.handler} (пробовали с _ и без _)`);
                
                // Дополнительная отладка - покажем все методы в коде
                const allMethodsRegex = /Future<void>\s+(\w+)\s*\([^)]*\)\s*async\s*\{/g;
                const foundMethods = [];
                let allMethodsMatch;
                while ((allMethodsMatch = allMethodsRegex.exec(classCode)) !== null) {
                    foundMethods.push(allMethodsMatch[1]);
                }
            }
        }
    } else {
        // Парсинг методов для кубитов (публичные методы)
        // Функция для извлечения полного тела метода кубита с правильным подсчетом скобок
        function extractCubitMethodBody(code: string, methodName: string): string | null {
            // Сначала пробуем найти блочный метод
            const blockMethodRegex = new RegExp(`(?:Future<[^>]+>|void)\\s+${methodName}\\s*\\([^)]*\\)\\s*(?:async\\s*)?\\s*\\{`, 'g');
            const blockMatch = blockMethodRegex.exec(code);
            
            if (blockMatch) {
                const startIndex = blockMatch.index + blockMatch[0].length;
                let braceCount = 1;
                let currentIndex = startIndex;
                
                while (currentIndex < code.length && braceCount > 0) {
                    const char = code[currentIndex];
                    if (char === '{') {
                        braceCount++;
                    } else if (char === '}') {
                        braceCount--;
                    }
                    currentIndex++;
                }
                
                if (braceCount === 0) {
                    return code.substring(startIndex, currentIndex - 1);
                }
            }
            
            // Если не нашли блочный метод, пробуем однострочный
            const arrowMethodRegex = new RegExp(`(?:Future<[^>]+>|void)\\s+${methodName}\\s*\\([^)]*\\)\\s*(?:async\\s*)?=>([^;]+);`, 'g');
            const arrowMatch = arrowMethodRegex.exec(code);
            
            if (arrowMatch) {
                return arrowMatch[1];
            }
            
            return null;
        }
        
        // Ищем все публичные методы (не приватные, не конструкторы)
        const cubitMethodRegex = /(?:Future<[^>]+>|void)\s+(\w+)\s*\([^)]*\)\s*(?:async\s*)?(?:=>|{)/g;
        
        while ((match = cubitMethodRegex.exec(classCode)) !== null) {
        const methodName = match[1];
            
            // Пропускаем ненужные методы
            if (methodName.startsWith('_') || 
                methodName === 'super' || 
                methodName.includes('Cubit') ||
                methodName.includes('Bloc')) {
                continue;
            }
            
            // Извлекаем полное тело метода
            const methodBody = extractCubitMethodBody(classCode, methodName);
            
            if (!methodBody) {
                console.log(`✗ Не удалось извлечь тело метода ${methodName}`);
                continue;
            }
            
            console.log(`   Тело метода: ${methodBody.substring(0, 100)}...`);
            
            const transitions = parseMethodTransitions(methodBody, methodName);
            methods.push({ 
                name: methodName, 
                parameters: [], 
                transitions 
            });
        }
    }

    console.log(`\n✓ Парсинг завершен:`);
    console.log(`   События: ${events.length}`);
    console.log(`   Зависимости: ${dependencies.length}`);
    console.log(`   Методы: ${methods.length}`);

    return { events, dependencies, methods };
}

/**
 * Ветка выполнения метода - представляет один возможный путь выполнения
 * Используется для генерации конкретных тестов с моками и проверками
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

/**
 * Анализ состояния для определения его роли в автомате
 * Помогает классифицировать состояния для правильной генерации тестов
 */
interface StateAnalysis {
    name: string;                // Название состояния
    isTransient: boolean;        // Сквозное состояние (проходное, не конечное)
    isFinal: boolean;            // Конечное состояние (завершающее выполнение)
    appearsInTryCatch: boolean;  // Появляется ли в блоке try-catch
    appearsOutsideTryCatch: boolean; // Появляется ли вне блока try-catch
}

// Вспомогательная функция для парсинга переходов в методе
function parseMethodTransitions(methodBody: string, methodName: string): { from: string; to: string; condition?: string; chainedEvent?: string }[] {
    const transitions: { from: string; to: string; condition?: string; chainedEvent?: string }[] = [];
    
    // Проверяем, является ли это arrow function (простой emit)
    const isArrowFunction = methodBody.trim().startsWith('emit(') && !methodBody.includes('{') && !methodBody.includes('}');
    
    if (isArrowFunction) {
        // Для arrow function просто извлекаем состояние из emit
        const arrowEmitMatch = methodBody.match(/emit\s*\(\s*(?:const\s+)?(\w+State)/);
        if (arrowEmitMatch) {
            const toState = arrowEmitMatch[1];
            
            // Создаем переход из любого состояния в найденное состояние
            transitions.push({
                from: '*',  // '*' означает любое состояние
                to: toState,
                condition: undefined,
                chainedEvent: undefined
            });}
        
        console.log(`   ✓ Найдено переходов: ${transitions.length}`);
        return transitions;
    }
    
    // Шаг 1: Найти все emit вызовы с их позициями и контекстом
    const emitCalls: Array<{
        state: string;
        position: number;
        context: {
            inTryCatch: boolean;
            inSwitch: boolean;
            inIf: boolean;
            inCatchBlock: boolean;
            inDefaultCase: boolean;
            isTransient: boolean;
            condition: string | undefined;
        };
    }> = [];
    
    const emitRegex = /emit\s*\(/g;
    let emitMatch;
    
    while ((emitMatch = emitRegex.exec(methodBody)) !== null) {
        const startIndex = emitMatch.index + emitMatch[0].length;
        let parenCount = 1;
        let currentIndex = startIndex;
        let emitContent = '';
        
        // Собираем содержимое emit до закрывающей скобки
        while (currentIndex < methodBody.length && parenCount > 0) {
            const char = methodBody[currentIndex];
            emitContent += char;
            
            if (char === '(') {
                parenCount++;
            } else if (char === ')') {
                parenCount--;
            }
            currentIndex++;
        }
        
        // Извлекаем имя состояния из содержимого
        const stateMatch = emitContent.match(/^\s*(?:const\s+)?(\w+State)/);
        if (stateMatch) {
            const toState = stateMatch[1];
            const position = emitMatch.index;
            
            // Анализируем контекст emit вызова
            const context = analyzeEmitContext(methodBody, position);
            
            emitCalls.push({
                state: toState,
                position: position,
                context: context
            });}
    }
    
    // Шаг 2: Создаем переходы на основе анализа контекста
    const transientStates = emitCalls.filter(call => call.context.isTransient);
    const finalStates = emitCalls.filter(call => !call.context.isTransient);// Создаем переходы для сквозных состояний (обычно Loading)
    transientStates.forEach(call => {
        transitions.push({
            from: '*',
            to: call.state,
            condition: call.context.condition,
            chainedEvent: undefined
            });});
    
    // Создаем переходы для конечных состояний
    finalStates.forEach(call => {
        // Если есть сквозные состояния, переходы идут от них
        if (transientStates.length > 0) {
            transientStates.forEach(transientCall => {
                transitions.push({
                    from: transientCall.state,
                    to: call.state,
                    condition: call.context.condition,
                    chainedEvent: undefined
            });});
        } else {
            // Если нет сквозных состояний, переходы от любого состояния
            transitions.push({
                from: '*',
                to: call.state,
                condition: call.context.condition,
                chainedEvent: undefined
            });}
    });

    console.log(`   ✓ Найдено переходов: ${transitions.length}`);
    return transitions;
}

// Функция для анализа контекста emit вызова
function analyzeEmitContext(methodBody: string, emitPosition: number): {
    inTryCatch: boolean;
    inSwitch: boolean;
    inIf: boolean;
    inCatchBlock: boolean;
    inDefaultCase: boolean;
    isTransient: boolean;
    condition: string | undefined;
} {
    const beforeEmit = methodBody.substring(0, emitPosition);
    
    // Анализируем try-catch структуру
    const tryMatches: RegExpMatchArray[] = [];
    const tryRegex = /try\s*\{/g;
    let tryMatch;
    while ((tryMatch = tryRegex.exec(beforeEmit)) !== null) {
        tryMatches.push(tryMatch);
    }
    
    const catchMatches: RegExpMatchArray[] = [];
    const catchRegex = /catch\s*\([^)]*\)\s*\{/g;
    let catchMatch;
    while ((catchMatch = catchRegex.exec(methodBody)) !== null) {
        catchMatches.push(catchMatch);
    }
    
    let inTryCatch = false;
    let inCatchBlock = false;
    
    // Проверяем try блоки
    if (tryMatches.length > 0) {
        const lastTryMatch = tryMatches[tryMatches.length - 1];
        const lastTryIndex = lastTryMatch.index!;
        const tryBlockStart = lastTryIndex + lastTryMatch[0].length - 1;
        const tryBlockEnd = findMatchingBrace(methodBody, tryBlockStart);
        
        if (emitPosition > lastTryIndex && emitPosition < tryBlockEnd) {
            inTryCatch = true;
        }
    }
    
    // Проверяем catch блоки
    if (catchMatches.length > 0) {
        for (const catchMatchItem of catchMatches) {
            const catchIndex = catchMatchItem.index!;
            const catchBlockStart = catchIndex + catchMatchItem[0].length - 1;
            const catchBlockEnd = findMatchingBrace(methodBody, catchBlockStart);
            
            if (emitPosition > catchIndex && emitPosition < catchBlockEnd) {
                inCatchBlock = true;
                inTryCatch = true; // catch тоже часть try-catch структуры
                break;
            }
        }
    }
    
    // Анализируем switch структуру
    const switchMatches: RegExpMatchArray[] = [];
    const switchRegex = /switch\s*\([^)]*\)\s*\{/g;
    let switchMatch;
    while ((switchMatch = switchRegex.exec(beforeEmit)) !== null) {
        switchMatches.push(switchMatch);
    }
    
    let inSwitch = false;
    let inDefaultCase = false;
    
    if (switchMatches.length > 0) {
        const lastSwitchMatch = switchMatches[switchMatches.length - 1];
        const lastSwitchIndex = lastSwitchMatch.index!;
        const switchBlockEnd = findMatchingBrace(methodBody, lastSwitchIndex + lastSwitchMatch[0].length - 1);
        
        if (emitPosition > lastSwitchIndex && emitPosition < switchBlockEnd) {
            inSwitch = true;
            
            // Проверяем, в default case ли мы
            const switchBlock = methodBody.substring(lastSwitchIndex, switchBlockEnd);
            const defaultMatch = switchBlock.match(/default\s*:/);
            if (defaultMatch) {
                const defaultIndex = lastSwitchIndex + defaultMatch.index!;
                if (emitPosition > defaultIndex) {
                    inDefaultCase = true;
                }
            }
        }
    }
    
    // Анализируем if структуру
    const ifMatches: RegExpMatchArray[] = [];
    const ifRegex = /if\s*\([^)]*\)\s*\{/g;
    let ifMatch;
    while ((ifMatch = ifRegex.exec(beforeEmit)) !== null) {
        ifMatches.push(ifMatch);
    }
    
    let inIf = false;
    
    if (ifMatches.length > 0) {
        const lastIfMatch = ifMatches[ifMatches.length - 1];
        const lastIfIndex = lastIfMatch.index!;
        const ifBlockEnd = findMatchingBrace(methodBody, lastIfIndex + lastIfMatch[0].length - 1);
        
        if (emitPosition > lastIfIndex && emitPosition < ifBlockEnd) {
            inIf = true;
        }
    }
    
    // Определяем тип состояния
    let isTransient = false;
    let condition: string | undefined = undefined;
    
    if (!inTryCatch && !inSwitch && !inIf) {
        // Emit вне всех блоков - сквозное состояние
        isTransient = true;
        condition = 'transient';
    } else if (inCatchBlock) {
        // Emit в catch блоке - конечное состояние (обработка ошибок)
        isTransient = false;
        condition = 'error_path';
    } else if (inDefaultCase) {
        // Emit в default case - конечное состояние (fallback)
        isTransient = false;
        condition = 'default_case';
    } else if (inSwitch) {
        // Emit в switch case - конечное состояние (успешный путь)
        isTransient = false;
        condition = 'switch_case';
    } else if (inTryCatch) {
        // Emit в try блоке - конечное состояние (успешный путь)
        isTransient = false;
        condition = 'success_path';
    } else if (inIf) {
        // Emit в if блоке - конечное состояние
        isTransient = false;
        condition = 'conditional';
    }
    
    return {
        inTryCatch,
        inSwitch,
        inIf,
        inCatchBlock,
        inDefaultCase,
        isTransient,
        condition
    };
}

// Функция для поиска соответствующей закрывающей скобки
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

// Функция для анализа состояний и определения конечных состояний
function analyzeStates(methodBody: string, classCode: string): StateAnalysis[] {
    const stateAnalysis: StateAnalysis[] = [];
    const stateOccurrences = new Map<string, { inTryCatch: number; outsideTryCatch: number; hasReturn: boolean }>();
    const trimmedBody = methodBody.trim();
    const isArrowFunction = trimmedBody.startsWith('emit(') && 
                           !trimmedBody.includes('\n') && 
                           !trimmedBody.includes('try') && 
                           !trimmedBody.includes('if') &&
                           !trimmedBody.includes('switch') &&
                           trimmedBody.split(';').length <= 2; // Только один emit statement
    
    if (isArrowFunction) {
        // Для arrow function просто извлекаем состояние из emit
        const arrowEmitMatch = methodBody.match(/emit\s*\(\s*(?:const\s+)?(\w+State)/);
        if (arrowEmitMatch) {
            const state = arrowEmitMatch[1];// В arrow function все emit являются конечными состояниями
            const analysis: StateAnalysis = {
                name: state,
                isTransient: false,
                isFinal: true,
                appearsInTryCatch: false,
                appearsOutsideTryCatch: true
            };
            
            stateAnalysis.push(analysis);
            console.log(`  • ${state}: конечное (arrow function)`);
        }
        
        return stateAnalysis;
    }
    
    // Ищем все emit вызовы с улучшенным алгоритмом для блочных методов
    const emitRegex = /emit\s*\(/g;
    let emitMatch;
    
    while ((emitMatch = emitRegex.exec(methodBody)) !== null) {
        const startIndex = emitMatch.index + emitMatch[0].length;
        let parenCount = 1;
        let currentIndex = startIndex;
        let emitContent = '';
        
        // Собираем содержимое emit до закрывающей скобки
        while (currentIndex < methodBody.length && parenCount > 0) {
            const char = methodBody[currentIndex];
            emitContent += char;
            
            if (char === '(') {
                parenCount++;
            } else if (char === ')') {
                parenCount--;
            }
            currentIndex++;
        }
        
        // Извлекаем имя состояния из содержимого
        const stateMatch = emitContent.match(/^\s*(?:const\s+)?(\w+State)/);
        if (stateMatch) {
            const state = stateMatch[1];
            const position = emitMatch.index;
            
            // Определяем, находится ли emit в try-catch блоке
            const beforeEmit = methodBody.substring(0, position);
            
            let inTryCatch = false;
            const lastTryIndex = beforeEmit.lastIndexOf('try');
            const lastCatchIndex = beforeEmit.lastIndexOf('catch');
            
            if (lastTryIndex !== -1) {
                // Проверяем, находимся ли мы внутри try блока
                const afterLastTry = methodBody.substring(lastTryIndex);
                const tryBlockMatch = afterLastTry.match(/try\s*\{([^}]*)\}/);
                if (tryBlockMatch && tryBlockMatch[0].includes(`emit(${emitContent}`)) {
                    inTryCatch = false; // В try блоке, но не в catch
                }
            }
            
            if (lastCatchIndex !== -1) {
                // Проверяем, находимся ли мы внутри catch блока
                const afterLastCatch = beforeEmit.substring(lastCatchIndex);
                const hasOpenBrace = afterLastCatch.includes('{');
                const hasCloseBrace = afterLastCatch.includes('}');
                
                if (hasOpenBrace && !hasCloseBrace) {
                    inTryCatch = true; // В catch блоке
                }
            }
            
            // Проверяем, есть ли return после emit или перед emit (return emit(...))
            const afterEmit = methodBody.substring(currentIndex);
            const nextStatementMatch = afterEmit.match(/^\s*;\s*(return\s*;|return\s+[^;]+;)/);
            
            // Также проверяем, есть ли return перед emit
            const beforeEmitStatement = methodBody.substring(Math.max(0, emitMatch.index - 50), emitMatch.index);
            const returnBeforeEmit = beforeEmitStatement.match(/return\s+emit\s*\($/);
            
            const hasReturn = nextStatementMatch !== null || returnBeforeEmit !== null;
            
            // Подсчитываем вхождения состояния
            if (!stateOccurrences.has(state)) {
                stateOccurrences.set(state, { inTryCatch: 0, outsideTryCatch: 0, hasReturn: false });
            }
            
            const occurrence = stateOccurrences.get(state)!;
            if (inTryCatch) {
                occurrence.inTryCatch++;
            } else {
                occurrence.outsideTryCatch++;
            }
            
            if (hasReturn) {
                occurrence.hasReturn = true;
            }}
    }
    
    // Анализируем каждое состояние
    for (const [stateName, occurrence] of stateOccurrences.entries()) {
        const appearsInTryCatch = occurrence.inTryCatch > 0;
        const appearsOutsideTryCatch = occurrence.outsideTryCatch > 0;
        const hasReturn = occurrence.hasReturn;
        // Сквозное состояние: появляется ТОЛЬКО вне try-catch/switch блоков и является началом выполнения
        const isTransient = appearsOutsideTryCatch && !appearsInTryCatch && !hasReturn &&
                           (stateName.toLowerCase().includes('loading') || 
                            stateName.toLowerCase().includes('processing') ||
                            stateName.toLowerCase().includes('waiting')) &&
                           !stateName.toLowerCase().includes('success') && 
                           !stateName.toLowerCase().includes('error') &&
                           !stateName.toLowerCase().includes('data') &&
                           !stateName.toLowerCase().includes('initial');
        
        // Конечное состояние: появляется в try-catch, имеет return или является результирующим состоянием
        const isFinal = appearsInTryCatch || hasReturn ||
                       stateName.toLowerCase().includes('success') || 
                       stateName.toLowerCase().includes('error') ||
                       stateName.toLowerCase().includes('data') ||
                       stateName.toLowerCase().includes('initial') ||
                       stateName.toLowerCase().includes('enabled') ||
                       stateName.toLowerCase().includes('disabled') ||
                       stateName.toLowerCase().includes('light') ||
                       stateName.toLowerCase().includes('dark') ||
                       stateName.toLowerCase().includes('system') ||
                       (!isTransient && !stateName.toLowerCase().includes('loading'));
        
        const analysis: StateAnalysis = {
            name: stateName,
            isTransient,
            isFinal,
            appearsInTryCatch,
            appearsOutsideTryCatch
        };
        
        stateAnalysis.push(analysis);
        
        console.log(`  • ${stateName}: ${isTransient ? 'сквозное' : isFinal ? 'конечное' : 'промежуточное'} (return: ${hasReturn})`);
    }
    
    return stateAnalysis;
}

// Функция для парсинга приватных методов
function parsePrivateMethodCalls(methodBody: string, classCode: string): string[] {
    const privateMethodCalls: string[] = [];
    
    // Ищем вызовы приватных методов (await _methodName(...))
    const privateMethodPattern = /await\s+(_\w+)\s*\(/g;
    let match;
    
    while ((match = privateMethodPattern.exec(methodBody)) !== null) {
        const methodName = match[1];
        privateMethodCalls.push(methodName);// Анализируем тело приватного метода для поиска вызовов storage
        const privateMethodBody = extractPrivateMethodBody(classCode, methodName.substring(1));
        if (privateMethodBody) {// Ищем вызовы storage в приватном методе
            const storageCallsInPrivate = parseStorageCalls(privateMethodBody, classCode);
            if (storageCallsInPrivate.length > 0) {}
        }
    }
    
    return privateMethodCalls;
}

// Функция для парсинга веток выполнения метода
function parseExecutionBranches(methodBody: string, methodName: string, classCode: string): ExecutionBranch[] {
    const branches: ExecutionBranch[] = [];// Анализируем состояния для определения конечных состояний
    const stateAnalysis = analyzeStates(methodBody, classCode);
    
    // Ищем вызовы репозитория, хранилища и приватных методов
    const repositoryCalls = parseRepositoryCalls(methodBody, classCode);
    const storageCalls = parseStorageCalls(methodBody, classCode);
    const privateMethodCalls = parsePrivateMethodCalls(methodBody, classCode);
    
    // Определяем сквозные и конечные состояния
    const transientStates = stateAnalysis.filter(s => s.isTransient).map(s => s.name);
    const finalStates = stateAnalysis.filter(s => s.isFinal).map(s => s.name);console.log(`  • Конечные состояния: ${finalStates.join(', ')}`);// Создаем ветки только для конечных состояний
    finalStates.forEach((finalState, index) => {
        const isSuccessPath = finalState.toLowerCase().includes('success');
        const isErrorPath = finalState.toLowerCase().includes('error');
        
        // Полный путь: сквозные состояния + конечное состояние
        const fullPath = [...transientStates, finalState];
        
        // Определяем, какие методы вызываются для этого пути
        let pathRepositoryCalls = [...repositoryCalls];
        let pathStorageCalls = [...storageCalls];
        let pathPrivateMethodCalls = [...privateMethodCalls];
        
        // Для успешного пути включаем приватные методы (например, _writeLoginData)
        if (isSuccessPath) {
            // Приватные методы вызываются только в успешном пути
            console.log(`    ✓ Успешный путь включает приватные методы: ${pathPrivateMethodCalls.join(', ')}`);
        } else if (isErrorPath) {
            // В пути с ошибкой приватные методы не вызываются
            pathPrivateMethodCalls = [];
            pathStorageCalls = [];
            console.log(`    ✗ Путь с ошибкой не включает приватные методы`);
        }
        
        const branch: ExecutionBranch = {
            branchId: `${methodName}_${isSuccessPath ? 'success' : isErrorPath ? 'error' : 'path'}_${index + 1}`,
            states: fullPath,
            repositoryCalls: pathRepositoryCalls,
            storageCalls: pathStorageCalls,
            privateMethodCalls: pathPrivateMethodCalls,
            isSuccessPath,
            isErrorPath,
            isFinalState: true
        };
        
        branches.push(branch);console.log(`     Тип: ${isSuccessPath ? 'успешный путь' : isErrorPath ? 'путь с ошибкой' : 'обычный путь'}`);
        console.log(`     Методы: repo[${pathRepositoryCalls.join(',')}] storage[${pathStorageCalls.join(',')}] private[${pathPrivateMethodCalls.join(',')}]`);
    });
    
    return branches;
}

// Функция для парсинга вызовов репозитория
function parseRepositoryCalls(methodBody: string, classCode: string): string[] {
    const calls: string[] = [];
    
    // Ищем вызовы через _repo или _repository
    const repoCallPattern = /_\w*[Rr]epo\w*\.(\w+)\s*\(/g;
    let match;
    while ((match = repoCallPattern.exec(methodBody)) !== null) {
        calls.push(match[1]);
    }
    
    return calls;
}

// Функция для парсинга вызовов хранилища
function parseStorageCalls(methodBody: string, classCode: string): string[] {
    const calls: string[] = [];
    
    // Ищем вызовы через _storage или _secureStorage
    const storageCallPattern = /_\w*[Ss]torage\w*\.(\w+)\s*\(/g;
    let match;
    while ((match = storageCallPattern.exec(methodBody)) !== null) {
        calls.push(match[1]);
    }
    
    // Ищем вызовы приватных методов (они могут содержать вызовы хранилища)
    const privateMethodPattern = /await\s+_(\w+)\s*\(/g;
    while ((match = privateMethodPattern.exec(methodBody)) !== null) {
        const privateMethodName = match[1];// Ищем тело приватного метода в classCode
        const privateMethodBody = extractPrivateMethodBody(classCode, privateMethodName);
        if (privateMethodBody) {
            const privateStorageCalls = parseStorageCalls(privateMethodBody, classCode);
            calls.push(...privateStorageCalls);
        }
    }
    
    return calls;
}

// Функция для извлечения тела метода из кода класса
function extractMethodBodyFromCode(classCode: string, methodName: string): string | null {
    // Убираем префиксы для поиска
    let searchName = methodName;
    if (searchName.startsWith('_on')) {
        searchName = searchName.substring(3);
    } else if (searchName.startsWith('on')) {
        searchName = searchName.substring(2);
    }
    
    // Ищем метод с разными вариантами имени
    const patterns = [
        // Для блоков - async методы
        `Future<void>\\s+_on${searchName}\\s*\\([^)]*\\)\\s*async\\s*\\{`,
        `Future<void>\\s+on${searchName}\\s*\\([^)]*\\)\\s*async\\s*\\{`,
        `Future<void>\\s+_${searchName}\\s*\\([^)]*\\)\\s*async\\s*\\{`,
        `Future<void>\\s+${methodName}\\s*\\([^)]*\\)\\s*async\\s*\\{`,
        
        // Для кубитов - простые void методы (блочные)
        `void\\s+${methodName}\\s*\\([^)]*\\)\\s*\\{`,
        
        // Для кубитов - arrow functions
        `void\\s+${methodName}\\s*\\([^)]*\\)\\s*=>`,
        
        // Для кубитов - Future методы (блочные)
        `Future<[^>]+>\\s+${methodName}\\s*\\([^)]*\\)\\s*(?:async\\s*)?\\{`,
        
        // Для кубитов - Future методы (arrow functions)
        `Future<[^>]+>\\s+${methodName}\\s*\\([^)]*\\)\\s*(?:async\\s*)?=>`
    ];
    
    for (const pattern of patterns) {
        const methodRegex = new RegExp(pattern, 'g');
        const match = methodRegex.exec(classCode);
        
        if (match) {// Проверяем, является ли это arrow function
            if (match[0].includes('=>')) {
                // Arrow function - ищем до точки с запятой
                const startIndex = match.index + match[0].length;
                const restOfCode = classCode.substring(startIndex);
                const semicolonIndex = restOfCode.indexOf(';');
                
                if (semicolonIndex !== -1) {
                    const arrowBody = restOfCode.substring(0, semicolonIndex).trim();return arrowBody;
                }
            } else {
                // Блочный метод - ищем с правильным подсчетом скобок
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
                    const blockBody = classCode.substring(startIndex, currentIndex - 1);return blockBody;
                }
            }
        }
    }
    
    console.log(`✗ Не найден метод ${methodName} ни с одним из паттернов`);
    return null;
}

// Функция для извлечения тела приватного метода
function extractPrivateMethodBody(classCode: string, methodName: string): string | null {
    const methodRegex = new RegExp(`Future<void>\\s+_${methodName}\\s*\\([^)]*\\)\\s*async\\s*\\{`, 'g');
    const match = methodRegex.exec(classCode);
    
    if (!match) {
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

// Проверка существования файла
async function fileExists(fileUri: vscode.Uri): Promise<boolean> {
    try {
        await vscode.workspace.fs.stat(fileUri);
        return true;
    } catch {
        return false;
    }
}

// Функция для применения всех Code Actions
async function applyAllCodeActions(document: vscode.TextDocument): Promise<void> {
    try {
        const diagnostics = vscode.languages.getDiagnostics(document.uri);
        
        for (const diagnostic of diagnostics) {
            if (diagnostic.severity === vscode.DiagnosticSeverity.Error && 
                diagnostic.message.includes('required argument')) {
                
                console.log(`• Найдена ошибка с обязательным аргументом: ${diagnostic.message}`);
                
                // Получаем Code Actions для этой диагностической проблемы
                const codeActions = await vscode.commands.executeCommand<vscode.CodeAction[]>(
                    'vscode.executeCodeActionProvider',
                    document.uri,
                    diagnostic.range,
                    {
                        diagnostics: [diagnostic],
                        only: [vscode.CodeActionKind.QuickFix]
                    }
                );
                
                // Ищем Quick Fix для добавления аргументов
                if (codeActions && codeActions.length > 0) {
                    const addArgumentFix = codeActions.find(action => 
                        action.title.toLowerCase().includes('add') && 
                        action.title.toLowerCase().includes('argument')
                    );
                    
                    if (addArgumentFix && addArgumentFix.edit) {
                        await vscode.workspace.applyEdit(addArgumentFix.edit);
                        console.log(`✓ Применено исправление: ${addArgumentFix.title}`);
                        
                        // Пауза между исправлениями
                        await new Promise(resolve => setTimeout(resolve, 300));
                    }
                }
            }
        }
        
        // Затем применяем остальные Quick Fix
        const remainingDiagnostics = vscode.languages.getDiagnostics(document.uri);
        
        for (const diagnostic of remainingDiagnostics) {
            if (diagnostic.severity === vscode.DiagnosticSeverity.Error || 
                diagnostic.severity === vscode.DiagnosticSeverity.Warning) {
                
                // Получаем Code Actions для каждой диагностической проблемы
                const codeActions = await vscode.commands.executeCommand<vscode.CodeAction[]>(
                    'vscode.executeCodeActionProvider',
                    document.uri,
                    diagnostic.range,
                    {
                        diagnostics: [diagnostic],
                        only: [vscode.CodeActionKind.QuickFix]
                    }
                );
                
                // Применяем первое доступное исправление
                if (codeActions && codeActions.length > 0) {
                    const quickFix = codeActions.find(action => 
                        action.kind?.value.startsWith('quickfix') ||
                        action.title.toLowerCase().includes('add') ||
                        action.title.toLowerCase().includes('import') ||
                        action.title.toLowerCase().includes('create')
                    );
                    
                    if (quickFix && quickFix.edit) {
                        await vscode.workspace.applyEdit(quickFix.edit);// Небольшая пауза между исправлениями
                        await new Promise(resolve => setTimeout(resolve, 200));
                    }
                }
            }
        }
    } catch (error) {
        console.error('✗ Ошибка при применении Code Actions:', error);
    }
}
// Функция для запуска тестов
async function runTestsForFile(testUri: vscode.Uri): Promise<void> {
    try {
        console.log(`🧪 Запускаем тесты для файла: ${testUri.fsPath}`);
        
        // Получаем относительный путь к тестовому файлу
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(testUri);
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('Не удалось определить рабочую папку для запуска тестов');
            return;
        }
        
        const relativePath = path.relative(workspaceFolder.uri.fsPath, testUri.fsPath);
        
        // Создаем терминал для запуска тестов
        const terminal = vscode.window.createTerminal({
            name: `Flutter Tests: ${path.basename(testUri.fsPath)}`,
            cwd: workspaceFolder.uri.fsPath
        });
        
        // Показываем терминал
        terminal.show();
        
        // Запускаем команду flutter test для конкретного файла
        terminal.sendText(`flutter test ${relativePath}`);
        
        vscode.window.showInformationMessage(
            `🧪 Запущены тесты для ${path.basename(testUri.fsPath)}`,
            'Показать терминал'
        ).then(selection => {
            if (selection === 'Показать терминал') {
                terminal.show();
            }
        });
        
    } catch (error) {
        console.error('✗ Ошибка при запуске тестов:', error);
        vscode.window.showErrorMessage(`Ошибка при запуске тестов: ${error}`);
    }
}

function buildFSM(states: StateInfo[], methods: MethodInfo[], events: EventInfo[], initialState: string, classCode: string, cubitName: string): { fsm: FSM, parsedMethods: ParsedMethod[], executionBranches: Map<string, ExecutionBranch[]> } {
    const transitions: FSMTransition[] = [];
    const parsedMethods: ParsedMethod[] = [];
    const executionBranches = new Map<string, ExecutionBranch[]>();
    
    console.log(`\n=== Начинаем анализ ${cubitName} ===`);
    console.log(`Всего состояний: ${states.length}`);
    console.log(`Состояния: ${states.map(s => s.name).join(', ')}`);

    let actualStates = states;
    if (states.length === 0) {const discoveredStates = new Set<string>();
        
        // Собираем все состояния из методов
        for (const method of methods) {
            for (const transition of method.transitions) {
                if (transition.to) {
                    discoveredStates.add(transition.to);
                }
            }
        }
        
        // Создаем StateInfo для найденных состояний
        actualStates = Array.from(discoveredStates).map(stateName => ({
            name: stateName,
            isInitial: stateName.toLowerCase().includes('initial'),
            isError: stateName.toLowerCase().includes('error'),
            isLoading: stateName.toLowerCase().includes('loading'),
            isSuccess: stateName.toLowerCase().includes('success')
        }));
        
        console.log(`✓ Извлечено состояний из emit: ${actualStates.length}`);
        console.log(`Состояния: ${actualStates.map(s => s.name).join(', ')}`);
        
        // Если нет начального состояния, находим или создаем его
        if (!actualStates.some(s => s.isInitial)) {
            const initState = actualStates.find(s => s.name.includes('Initial'));
            if (initState) {
                initState.isInitial = true;
                console.log(`✓ Установлено начальное состояние: ${initState.name}`);
            } else if (actualStates.length > 0) {
                // Устанавливаем первое состояние как начальное
                actualStates[0].isInitial = true;
                console.log(`✓ Установлено начальное состояние: ${actualStates[0].name}`);
            }
        }
    }
    
    // Добавляем все состояния в автомат
    const fsm: FSM = {
        states: actualStates.map(s => s.name),
        transitions: [],
        initialState: actualStates.find(s => s.isInitial)?.name || initialState || 'InitialState'
    };

    // Шаг 1: Парсим события и связанные с ними методы
    for (const event of events) {
        const method = methods.find(m => m.name === event.handler);
        if (!method) {
            console.log(`✗ Обработчик ${event.handler} для события ${event.name} не найден`);
            continue;
        }// Извлекаем тело метода для анализа веток выполнения
        const methodBody = extractMethodBodyFromCode(classCode, method.name);
        if (methodBody) {
            const branches = parseExecutionBranches(methodBody, method.name, classCode);
            executionBranches.set(event.name, branches);}
        
        // Используем уже распарсенные данные из method.transitions
        // Не нужно заново парсить тело метода
        
        // Определяем разрешенные состояния (все состояния минус guard условия)
        const allowedFromStates: string[] = [];
        const guardConditions: string[] = [];
        
        // Начинаем со всех состояний
        for (const state of actualStates) {
            allowedFromStates.push(state.name);
        }

        // Используем результаты parseMethodTransitions для получения guard условий и эмитов
        const methodTransitions = method.transitions;
        
        // Извлекаем guard условия из transitions
        const guardStates = new Set<string>();
        for (const transition of methodTransitions) {
            if (transition.condition && transition.condition.includes('state is not')) {
                // Парсим guard условия из condition строки
                const guardMatches = transition.condition.match(/state is not (\w+State)/g);
                if (guardMatches) {
                    for (const guardMatch of guardMatches) {
                        const stateName = guardMatch.replace('state is not ', '');
                        guardStates.add(stateName);
                        // Добавляем в массив guard условий, избегая дублирования
                        if (!guardConditions.includes(stateName)) {
                            guardConditions.push(stateName);
                        }
                    }
                }
            }
        }
        
        // Убираем guard состояния из разрешенных
        for (const guardState of guardStates) {
            const index = allowedFromStates.indexOf(guardState);
            if (index > -1) {
                allowedFromStates.splice(index, 1);
            }
        }

        // Извлекаем emit состояния из transitions
        const emitStates: string[] = [];
        for (const transition of methodTransitions) {
            if (transition.to && !emitStates.includes(transition.to)) {
                emitStates.push(transition.to);
            }
        }

        // Сохраняем информацию о методе
        parsedMethods.push({
            name: event.name,
            type: 'event',
            allowedFromStates: [...allowedFromStates],
            emitStates: [...emitStates],
            guardConditions: [...guardConditions]
        });

        console.log(`  ✓ Разрешенные состояния: ${allowedFromStates.join(', ')}`);}

    // Шаг 2: Для кубитов парсим глобальные методы
    if (events.length === 0) {const methodRegex = /(?:Future<[^>]+>|void)\s+(\w+)\s*\([^)]*\)\s*(?:async\s*)?\s*(?:=>|{)([^}]*?)(?:}|;)/g;
        let methodMatch;
        const processedMethods = new Set<string>();
        
        while ((methodMatch = methodRegex.exec(classCode)) !== null) {
            const methodName = methodMatch[1];
            const methodBody = methodMatch[2];
            
            // Пропускаем ненужные методы
            if (methodName.startsWith('_') || 
                methodName === 'super' || 
                methodName === cubitName.replace('Cubit', '').replace('Bloc', '') ||
                processedMethods.has(methodName)) {
                continue;
            }
            
            processedMethods.add(methodName);// Используем результаты parseMethodTransitions
            const methodInfo = methods.find(m => m.name === methodName);
            if (!methodInfo) {
                console.log(`✗ Информация о методе ${methodName} не найдена`);
                continue;
            }
            
            const methodTransitions = methodInfo.transitions;
            
            // Для кубитов начинаем со всех состояний
            const allowedFromStates = actualStates.map(s => s.name);
            
            // Извлекаем guard условия и убираем их из разрешенных состояний
            const guardStates = new Set<string>();
            const guardConditions: string[] = [];
            for (const transition of methodTransitions) {
                if (transition.condition && transition.condition.includes('state is not')) {
                    const guardMatches = transition.condition.match(/state is not (\w+State)/g);
                    if (guardMatches) {
                        for (const guardMatch of guardMatches) {
                            const stateName = guardMatch.replace('state is not ', '');
                            guardStates.add(stateName);
                            // Добавляем в массив guard условий, избегая дублирования
                            if (!guardConditions.includes(stateName)) {
                                guardConditions.push(stateName);
                            }
                        }
                    }
                }
            }
            
            // Убираем guard состояния из разрешенных
            for (const guardState of guardStates) {
                const index = allowedFromStates.indexOf(guardState);
                if (index > -1) {
                    allowedFromStates.splice(index, 1);
                }
            }
            
            // Извлекаем emit состояния из transitions
            const emitStates: string[] = [];
            for (const transition of methodTransitions) {
                if (transition.to && !emitStates.includes(transition.to)) {
                    emitStates.push(transition.to);}
            }
            
            // Сохраняем информацию о методе
            parsedMethods.push({
                name: methodName,
                type: 'method',
                allowedFromStates: [...allowedFromStates],
                emitStates: [...emitStates],
                guardConditions: [...guardConditions]
            });

            // ДОБАВЛЯЕМ: Извлекаем тело метода для анализа веток выполнения (для кубитов)
            const methodBodyForBranches = extractMethodBodyFromCode(classCode, methodName);
            if (methodBodyForBranches) {
                const branches = parseExecutionBranches(methodBodyForBranches, methodName, classCode);
                executionBranches.set(methodName, branches);} else {}

            console.log(`  ✓ Разрешенные состояния: ${allowedFromStates.join(', ')}`);}
    }

    // Шаг 3: Создаем переходы на основе собранной информации
    const createdTransitions = new Set<string>(); // Для избежания дублирования
    
    for (const parsedMethod of parsedMethods) {
        // Если allowedFromStates пустой, используем все доступные состояния
        const fromStates = parsedMethod.allowedFromStates.length > 0 
            ? parsedMethod.allowedFromStates 
            : actualStates.map(s => s.name);
        
        // Создаем переходы из каждого разрешенного состояния в каждое emit состояние
        for (const fromState of fromStates) {
            for (const toState of parsedMethod.emitStates) {
                const transitionKey = `${fromState}-${parsedMethod.name}-${toState}`;
                
                // Проверяем, что такого перехода еще не было
                if (!createdTransitions.has(transitionKey)) {
                    createdTransitions.add(transitionKey);
                    transitions.push({
                        from: fromState,
                        to: toState,
                        method: parsedMethod.name,
                        condition: undefined
                    });
                    console.log(`  ➕ Переход: ${fromState} --[${parsedMethod.name}]--> ${toState}`);
                } else {}
            }
        }
    }

    fsm.transitions = transitions;
    console.log(`\n✓ Создано переходов: ${transitions.length}`);
    console.log(`=== Конец анализа ${cubitName} ===\n`);
    
    return { fsm, parsedMethods, executionBranches };
}

function generateTestPaths(fsm: FSM, maxPaths: number = Number.MAX_SAFE_INTEGER): TestPath[] {
    const paths: TestPath[] = [];console.log(`  Состояний: ${fsm.states.length}`);
    console.log(`  Переходов: ${fsm.transitions.length}`);
    console.log(`  Начальное состояние: ${fsm.initialState}`);
    
    // Шаг 1: Построение остовного дерева BFS
    const { spanningTree, visited } = buildBFSSpanningTree(fsm);for (const [state, parent] of spanningTree.entries()) {
        if (parent) {
            console.log(`  ${parent.from} --${parent.method}--> ${state}`);
        } else {
            console.log(`  ${state} (корень)`);
        }
    }
    
    // Шаг 2: Генерация In-tree путей (пути в остовном дереве)
    const inTreePaths = generateInTreePaths(fsm, spanningTree);
    paths.push(...inTreePaths);
    
    console.log(`✓ Создано In-tree путей: ${inTreePaths.length}`);
    for (const path of inTreePaths) {
        console.log(`  ${path.states.join(' → ')} | методы: [${path.methods.join(', ')}]`);
    }
    
    // Шаг 3: Определение ребер вне дерева (Out-tree edges)
    const outTreeEdges = findOutTreeEdges(fsm, spanningTree);for (const edge of outTreeEdges) {
        console.log(`  ${edge.from} --${edge.method}--> ${edge.to} ${edge.condition ? `[${edge.condition}]` : ''}`);
    }
    
    // Шаг 4: Генерация Out-tree путей
    const outTreePaths = generateOutTreePaths(fsm, spanningTree, outTreeEdges);
    paths.push(...outTreePaths);
    
    console.log(`✓ Создано Out-tree путей: ${outTreePaths.length}`);
    for (const path of outTreePaths) {
        console.log(`  ${path.states.join(' → ')} | методы: [${path.methods.join(', ')}]`);
    }
    
    // Шаг 5: Удаление дублирующихся путей
    const uniquePaths = removeDuplicatePaths(paths);console.log(`  Всего путей до дедупликации: ${paths.length}`);
    console.log(`  Уникальных путей: ${uniquePaths.length}`);
    console.log(`  In-tree путей: ${inTreePaths.length}`);
    console.log(`  Out-tree путей: ${outTreePaths.length}`);
    
    return uniquePaths;
}

// Построение остовного дерева BFS
function buildBFSSpanningTree(fsm: FSM): { 
    spanningTree: Map<string, FSMTransition | null>, 
    visited: Set<string> 
} {
    const spanningTree = new Map<string, FSMTransition | null>();
    const visited = new Set<string>();
    const queue: string[] = [];
    
    // Начинаем с начального состояния
    queue.push(fsm.initialState);
    visited.add(fsm.initialState);
    spanningTree.set(fsm.initialState, null); // корень дерева
    
    while (queue.length > 0) {
        const currentState = queue.shift()!;
        
        // Находим все переходы из текущего состояния
        const outgoingTransitions = fsm.transitions.filter(t => t.from === currentState);
        
        for (const transition of outgoingTransitions) {
            if (!visited.has(transition.to)) {
                // Новое состояние - добавляем в дерево
                visited.add(transition.to);
                spanningTree.set(transition.to, transition);
                queue.push(transition.to);
            }
        }
    }
    
    return { spanningTree, visited };
}

// Генерация In-tree путей (пути в остовном дереве до каждого узла)
function generateInTreePaths(fsm: FSM, spanningTree: Map<string, FSMTransition | null>): TestPath[] {
    const paths: TestPath[] = [];
    
    for (const state of spanningTree.keys()) {
        const path = reconstructPathToState(state, spanningTree);
        if (path) {
            paths.push(path);
        }
    }
    
    return paths;
}

// Восстановление пути от корня до заданного состояния
function reconstructPathToState(targetState: string, spanningTree: Map<string, FSMTransition | null>): TestPath | null {
    const states: string[] = [];
    const methods: string[] = [];
    const conditions: (string | undefined)[] = [];
    
    let currentState = targetState;
    const pathStates: string[] = [];
    const pathTransitions: FSMTransition[] = [];
    
    // Идем назад от целевого состояния к корню
    while (currentState) {
        pathStates.unshift(currentState);
        const parentTransition = spanningTree.get(currentState);
        
        if (parentTransition) {
            pathTransitions.unshift(parentTransition);
            currentState = parentTransition.from;
        } else {
            // Достигли корня
            break;
        }
    }
    
    // Формируем путь
    states.push(...pathStates);
    for (const transition of pathTransitions) {
        methods.push(transition.method);
        conditions.push(transition.condition);
    }
    
    return {
        states,
        methods,
        conditions
    };
}

// Поиск ребер вне остовного дерева
function findOutTreeEdges(fsm: FSM, spanningTree: Map<string, FSMTransition | null>): FSMTransition[] {
    const outTreeEdges: FSMTransition[] = [];
    const treeEdges = new Set<string>();
    
    // Собираем все ребра из остовного дерева
    for (const [state, parentTransition] of spanningTree.entries()) {
        if (parentTransition) {
            const edgeKey = `${parentTransition.from}->${parentTransition.to}:${parentTransition.method}`;
            treeEdges.add(edgeKey);
        }
    }
    
    // Находим ребра, не входящие в остовное дерево
    for (const transition of fsm.transitions) {
        const edgeKey = `${transition.from}->${transition.to}:${transition.method}`;
        if (!treeEdges.has(edgeKey)) {
            outTreeEdges.push(transition);
        }
    }
    
    return outTreeEdges;
}

// Генерация Out-tree путей
function generateOutTreePaths(fsm: FSM, spanningTree: Map<string, FSMTransition | null>, outTreeEdges: FSMTransition[]): TestPath[] {
    const paths: TestPath[] = [];
    
    for (const edge of outTreeEdges) {
        // Путь BFS до исходного состояния ребра
        const pathToSource = reconstructPathToState(edge.from, spanningTree);
        
        if (pathToSource) {
            // Добавляем само ребро вне дерева к пути
            const outTreePath: TestPath = {
                states: [...pathToSource.states, edge.to],
                methods: [...pathToSource.methods, edge.method],
                conditions: [...pathToSource.conditions, edge.condition]
            };
            
            paths.push(outTreePath);
        }
    }
    
    return paths;
}

// Удаление дублирующихся путей
function removeDuplicatePaths(paths: TestPath[]): TestPath[] {
    const uniquePaths: TestPath[] = [];
    const seenPaths = new Set<string>();
    
    for (const path of paths) {
        // Создаем уникальную строку для пути
        const pathKey = `${path.states.join('->')}_${path.methods.join('->')}_${path.conditions.join('->')}`;
        
        if (!seenPaths.has(pathKey)) {
            seenPaths.add(pathKey);
            uniquePaths.push(path);
        }
    }
    
    return uniquePaths;
}

function generateBlocTests(
    cubitName: string,
    paths: TestPath[],
    isBloc: boolean,
    dependencies: DependencyInfo[],
    states: StateInfo[],
    methods: MethodInfo[],
    events: EventInfo[],
    classCode: string,
    executionBranches: Map<string, ExecutionBranch[]>
): string {
    console.log(`\n🧪 === НОВАЯ АРХИТЕКТУРА ГЕНЕРАЦИИ ТЕСТОВ ===`);console.log(`  Методов/событий: ${methods.length}`);
    console.log(`  Тестовых путей автомата: ${paths.length}`);
    console.log(`  Состояний: ${states.length}`);
    console.log(`  Веток выполнения: ${Array.from(executionBranches.values()).reduce((total, branches) => total + branches.length, 0)}`);
    
    let tests = '';
    
    // Генерация моков
    const mockDeclarations = dependencies.map(dep => 
        `class _Mock${dep.type} extends Mock implements ${dep.type} {}`
    ).join('\n');
    
    const lateDeclarations = dependencies.map(dep => 
        `late _Mock${dep.type} mock${dep.type};`
    ).join('\n') + `\nlate ${cubitName} ${camelToSnakeCase(cubitName)};`;
    
    const setUpContent = dependencies.map(dep => 
        `mock${dep.type} = _Mock${dep.type}();`
    ).join('\n') + `\n${camelToSnakeCase(cubitName)} = ${cubitName}(${dependencies.map(dep => `${dep.name}: mock${dep.type}`).join(', ')});`;

    // Генерируем тест начального состояния
    const initialState = states.find(s => s.isInitial) || states[0];
    if (initialState) {
        tests += `
    test(
      'Проверка начального состояния',
      () {
        expect(
          ${camelToSnakeCase(cubitName)}.state,
          const ${initialState.name}(),
        );
      },
    );`;
    }

    // ЭТАП 1: Генерируем минимальные необходимые тесты
    console.log(`\n• ЭТАП 1: Генерация минимальных необходимых тестов`);
    const minimalTests = generateMinimalRequiredTests(cubitName, methods, events, dependencies, states, isBloc, classCode);
    tests += minimalTests.tests;

    // ЭТАП 2: Генерируем множественные тесты из обязательных
    const multipleTests = generateMultipleTestsFromMandatory(
        cubitName, 
        minimalTests.mandatoryTestsInfo, 
        dependencies, 
        5 // Максимум 5 множественных тестов
    );
    tests += multipleTests;

    // Подсчитываем итоговую статистику
    const testCount = (tests.match(/blocTest</g) || []).length + (tests.match(/test\(/g) || []).length;console.log(`  Всего тестов: ${testCount}`);
    console.log(`🧪 === КОНЕЦ ГЕНЕРАЦИИ ТЕСТОВ ===\n`);

    return `
${mockDeclarations}

void main() {
  ${lateDeclarations}

  setUp(() {
    ${setUpContent}
  });

  tearDown(() {
    ${camelToSnakeCase(cubitName)}.close();
  });

  group('Тесты для ${cubitName}', () {
    ${tests}
  });
}`;
}

// Функция для генерации моков на основе ветки выполнения
function generateBranchMockSetup(dependencies: DependencyInfo[], branch: ExecutionBranch): string {
    if (dependencies.length === 0) {
        return '';
    }

    const mockSetups: string[] = [];
    
    // Генерируем моки для вызовов репозитория
    branch.repositoryCalls.forEach(call => {
        const repoDep = dependencies.find(dep => dep.type.toLowerCase().includes('repository'));
        if (repoDep) {
            // Получаем правильные параметры для метода
            const methodParams = getMethodParamsForMock(call);
            
            if (branch.isErrorPath) {
                mockSetups.push(`when(
          () => mock${repoDep.type}.${call}(${methodParams}),
        ).thenThrow(Exception('Test error'));`);
            } else {
                // Для успешного пути возвращаем тестовые данные
                mockSetups.push(`when(
          () => mock${repoDep.type}.${call}(${methodParams}),
        ).thenAnswer((_) async => generateTestData());`);
            }
        }
    });
    
    // Генерируем моки для вызовов хранилища (только для успешного пути)
    if (branch.isSuccessPath && branch.privateMethodCalls.length > 0) {
        const storageDep = dependencies.find(dep => dep.type.toLowerCase().includes('storage'));
        if (storageDep) {
            // Для приватных методов, которые используют storage
            branch.privateMethodCalls.forEach(privateMethod => {
                if (privateMethod.toLowerCase().includes('writelogindata') || privateMethod.toLowerCase().includes('write')) {
                    // Используем общий мок для write, так как приватный метод недоступен для мокирования
                    mockSetups.push(`when(
            () => mock${storageDep.type}.write(any(), any()),
          ).thenAnswer((_) async {});`);
                }
            });
        }
    }
    
    return mockSetups.join('\n        ');
}

// Функция для генерации verify блоков на основе ветки выполнения
function generateBranchVerify(dependencies: DependencyInfo[], branch: ExecutionBranch): string {
    if (dependencies.length === 0) {
        return '';
    }

    const verifyStatements: string[] = [];
    
    // Генерируем verify только для вызовов репозитория
    branch.repositoryCalls.forEach(call => {
        const repoDep = dependencies.find(dep => dep.type.toLowerCase().includes('repository'));
        if (repoDep) {
            verifyStatements.push(`verify(
          () => mock${repoDep.type}.${call}(),
        ).called(1);`);
        }
    });
    
    // НЕ добавляем verify для storage - оставляем только репозитории
    
    return verifyStatements.join('\n          ');
}

function generateMockSetup(dependencies: DependencyInfo[], handler: MethodInfo, transition: any): {
    success: string;
    error: string;
    verify: string;
} {
    if (dependencies.length === 0) {
        return { success: '', error: '', verify: '' };
    }

    const dep = dependencies[0];
    const methodName = getRepositoryMethod(handler.name);
    
    // Генерируем моки без заполнения параметров - для Quick Fix
    const success = `when(
          () => mock${dep.type}.${methodName}(),
        ).thenAnswer((_) async => null);`;

    const error = `when(
          () => mock${dep.type}.${methodName}(),
        ).thenThrow(Exception('Test error'));`;

    const verify = `verify(
          () => mock${dep.type}.${methodName}(),
        ).called(1);`;

    return { success, error, verify };
}

function generateComplexMockSetup(dependencies: DependencyInfo[], methods: string[], allMethods: MethodInfo[]): string {
    if (dependencies.length === 0) return '';
    
    const dep = dependencies[0];
    return methods.map(methodName => {
        const method = allMethods.find(m => m.name === methodName);
        if (!method) return '';
        
        const repoMethod = getRepositoryMethod(methodName);
        const params = getMethodParams(methodName);
        
        return `when(() => mock${dep.type}.${repoMethod}(${params}))
              .thenAnswer((_) async => generateTestData());`;
    }).join('\n          ');
}

function generateStateInstance(stateName: string, states: StateInfo[]): string {
    const state = states.find(s => s.name === stateName);
    if (!state || !state.properties || state.properties.length === 0) {
        return `const ${stateName}()`;
    }

    const params = state.properties.map(prop => {
        const [type, name] = prop.split(' ');
        return `${name}: ${getDefaultValue(type)}`;
    }).join(', ');

    return `${stateName}(${params})`;
}

function generateStateExpectation(stateName: string, states: StateInfo[]): string {
    return `isA<${stateName}>()`;
}

// Анализирует обязательные состояния в методе обработчика
function analyzeMandatoryStates(handler: MethodInfo, transition: any, classCode?: string): string[] {
    const mandatoryStates: string[] = [];
    
    // Анализируем все переходы в методе для поиска обязательных состояний
    const allEmitStates = handler.transitions.map(t => t.to);
    
    // Ищем состояния загрузки (они обычно эмитятся первыми и не в try-catch блоках)
    const loadingStates = allEmitStates.filter(state => 
        state.toLowerCase().includes('loading') || 
        state.toLowerCase().includes('waiting') ||
        state.toLowerCase().includes('progress')
    );
    
    // Если есть состояния загрузки, добавляем их как обязательные
    if (loadingStates.length > 0) {
        loadingStates.forEach(state => {
            mandatoryStates.push(state);
        });
    }
    
    // Добавляем финальное состояние перехода
    if (!mandatoryStates.some(state => state.includes(transition.to))) {
        mandatoryStates.push(transition.to);
    }
    
    return mandatoryStates;
}

function getRepositoryMethod(handlerName: string): string {
    // Убираем префиксы обработчиков событий
    let methodName = handlerName;
    
    // Убираем префиксы _on и on только в начале
    if (methodName.startsWith('_on')) {
        methodName = methodName.substring(3);
    } else if (methodName.startsWith('on')) {
        methodName = methodName.substring(2);
    }
    
    // Преобразуем первую букву в нижний регистр для camelCase
    if (methodName.length > 0) {
        methodName = methodName.charAt(0).toLowerCase() + methodName.slice(1);
    }
    
    // Специальные случаи для известных методов
    const lowerMethodName = methodName.toLowerCase();
    if (lowerMethodName.includes('authorization') || lowerMethodName.includes('auth')) {
        return 'performAuthorization';
    }
    if (lowerMethodName.includes('fetch') && lowerMethodName.includes('favorite')) {
        return 'fetchFavorites';
    }
    if (lowerMethodName.includes('refresh') && lowerMethodName.includes('token')) {
        return 'refreshToken';
    }
    if (lowerMethodName.includes('write') && lowerMethodName.includes('login')) {
        return 'writeLoginData';
    }
    if (lowerMethodName.includes('read') && lowerMethodName.includes('login')) {
        return 'readLoginData';
    }
    
    // Возвращаем обработанное имя метода
    return methodName;
}

function getMethodParams(handlerName: string): string {
    const lowerHandlerName = handlerName.toLowerCase();
    
    if (lowerHandlerName.includes('authorization') || lowerHandlerName.includes('auth')) {
        return 'email: any(named: "email"), password: any(named: "password")';
    }
    if (lowerHandlerName.includes('fetch')) {
        return 'page: any(named: "page")';
    }
    if (lowerHandlerName.includes('refresh')) {
        return 'refreshToken: any(named: "refreshToken"), accessToken: any(named: "accessToken")';
    }
    if (lowerHandlerName.includes('write') && lowerHandlerName.includes('login')) {
        return 'data: any(named: "data")';
    }
    if (lowerHandlerName.includes('write')) {
        return 'any(named: "key"), any(named: "value")';
    }
    if (lowerHandlerName.includes('read')) {
        return 'any(named: "key")';
    }
    if (lowerHandlerName.includes('delete')) {
        return 'any(named: "key")';
    }
    return '';
}

function getDefaultValue(type: string): string {
    switch (type.toLowerCase()) {
        case 'int':
            return '0';
        case 'double':
            return '0.0';
        case 'string':
            return "''";
        case 'bool':
            return 'false';
        case 'list':
        case 'list<dynamic>':
            return '[]';
        case 'map':
        case 'map<dynamic, dynamic>':
            return '{}';
        default:
            return 'null';
    }
}

// Новая функция для генерации экземпляра события с параметрами
function generateEventInstance(eventName: string, events: EventInfo[]): string {
    const event = events.find(e => e.name === eventName);
    if (!event || !event.parameters || event.parameters.length === 0) {
        return `const ${eventName}()`;
    }

    const params = event.parameters.map(param => {
        const [type, name] = param.split(' ');
        return `${name}: ${getDefaultValueForParam(type, name)}`;
    }).join(', ');

    return `const ${eventName}(${params})`;
}

// Новая функция для генерации значений по умолчанию для параметров
function getDefaultValueForParam(type: string, paramName: string): string {
    // Специальные случаи для известных параметров
    if (paramName.toLowerCase().includes('email')) {
        return "''";
    }
    if (paramName.toLowerCase().includes('password')) {
        return "''";
    }
    if (paramName.toLowerCase().includes('remember')) {
        return 'false';
    }
    
    // Общие случаи по типу
    return getDefaultValue(type);
}

// Новая функция для генерации экземпляра состояния с правильными параметрами
function generateStateInstanceWithParams(stateName: string, states: StateInfo[], isErrorPath: boolean = false, errorMessage?: string): string {
    const state = states.find(s => s.name === stateName);
    if (!state || !state.properties || state.properties.length === 0) {
        return `${stateName}()`;
    }

    const params = state.properties.map(prop => {
        const [type, name] = prop.split(' ');
        
        // Специальная обработка для состояний ошибок
        if (isErrorPath && name.toLowerCase().includes('message') && errorMessage) {
            return `${name}: ${errorMessage}`;
        }
        if (isErrorPath && name.toLowerCase().includes('code')) {
            return `${name}: 500`;
        }
        
        return `${name}: ${getDefaultValue(type)}`;
    }).join(', ');

    return `${stateName}(${params})`;
}

function generateTestDataFunction(states: StateInfo[], dependencies: DependencyInfo[]): string {
    // Генерируем функцию для создания тестовых данных
    let testDataFunction = '';
    
    // Если есть зависимости, создаем функцию генерации данных
    if (dependencies.length > 0) {
        const dep = dependencies[0];
        if (dep.type.toLowerCase().includes('favorite')) {
            testDataFunction = `
// Функция для генерации тестовых данных
List<dynamic> generateTestData() {
  return List.generate(20, (index) => {
    'id': index + 1,
    'url': 'test.url/\$index',
    'title': 'Test Title \$index',
    'subtitle': 'Test Subtitle \$index',
    'publishDateWithTime': 'now',
    'imageUrl': 'image.url/\$index',
    'shareUrl': 'share.url/\$index',
    'paymentExpired': null,
    'isPaymentRequired': false,
    'type': 'another',
    'rubric': 'Test',
    'typeTitle': 'Test',
    'isExternal': false,
  });
}`;
        } else if (dep.type.toLowerCase().includes('jwt') || dep.type.toLowerCase().includes('auth')) {
            testDataFunction = `
// Функция для генерации тестовых данных авторизации
dynamic generateTestData() {
  return {
    'accessToken': 'test_access_token_12345',
    'refreshToken': 'test_refresh_token_67890',
    'userId': 'test_user_123',
    'email': 'test@example.com',
  };
}`;
        } else {
            testDataFunction = `
// Функция для генерации тестовых данных
dynamic generateTestData() {
  return <String, dynamic>{
    'id': 1,
    'data': 'test data',
    'timestamp': DateTime.now().toIso8601String(),
  };
}`;
        }
    }
    
    return testDataFunction;
}

/**
 * Генерирует общий тестовый файл для фичи, который импортирует все тесты фичи
 * @param workspaceRoot - корневая папка проекта
 * @param testDir - папка с тестами
 * @param featureName - название фичи
 * @param hasBloc - есть ли блок/кубит тест
 * @param hasDto - есть ли DTO тест
 */
async function generateFeatureTestFile(
    workspaceRoot: vscode.Uri, 
    testDir: string, 
    featureName: string, 
    hasBloc: boolean, 
    hasDto: boolean
): Promise<void> {
    if (!hasBloc && !hasDto) {return;
    }

    const featureTestFileName = `${featureName}_test.dart`;
    const featureTestUri = vscode.Uri.joinPath(workspaceRoot, testDir, 'features', featureName, featureTestFileName);
    
    let imports: string[] = [];
    let mainCalls: string[] = [];
    
    // Добавляем импорт и вызов для блока/кубита если есть
    if (hasBloc) {
        // Ищем файлы блоков/кубитов в папке
        const blocDir = vscode.Uri.joinPath(workspaceRoot, testDir, 'features', featureName, 'bloc');
        const cubitDir = vscode.Uri.joinPath(workspaceRoot, testDir, 'features', featureName, 'cubit');
        
        let blocTestFile = '';
        let importAlias = '';
        
        // Проверяем папку bloc
        try {
            const blocFiles = await vscode.workspace.fs.readDirectory(blocDir);
            const blocTestFiles = blocFiles.filter(([name, type]) => 
                type === vscode.FileType.File && name.endsWith('_test.dart')
            );
            
            if (blocTestFiles.length > 0) {
                blocTestFile = `bloc/${blocTestFiles[0][0]}`;
                importAlias = `${featureName}_bloc_test`;
            }
        } catch (error) {
            // Папка bloc не существует, проверяем cubit
        }
        
        // Если не нашли в bloc, проверяем папку cubit
        if (!blocTestFile) {
            try {
                const cubitFiles = await vscode.workspace.fs.readDirectory(cubitDir);
                const cubitTestFiles = cubitFiles.filter(([name, type]) => 
                    type === vscode.FileType.File && name.endsWith('_test.dart')
                );
                
                if (cubitTestFiles.length > 0) {
                    blocTestFile = `cubit/${cubitTestFiles[0][0]}`;
                    importAlias = `${featureName}_cubit_test`;
                }
            } catch (error) {
                // Папка cubit не существует
            }
        }
        
        if (blocTestFile) {
            imports.push(`import '${blocTestFile}' as ${importAlias};`);
            mainCalls.push(`  ${importAlias}.main();`);
        }
    }
    
    // Добавляем импорт и вызов для DTO если есть
    if (hasDto) {
        const dtoTestFile = `${featureName}_dto_test/${featureName}_dto_test.dart`;
        const dtoImportAlias = `${featureName}_dto_test`;
        
        imports.push(`import '${dtoTestFile}' as ${dtoImportAlias};`);
        mainCalls.push(`  ${dtoImportAlias}.main();`);
    }
    
    const featureTestContent = `${imports.join('\n')}

void main() {
${mainCalls.join('\n')}
}`;console.log(`   Импорты: ${imports.length}`);
    console.log(`   Вызовы: ${mainCalls.length}`);
    
    const content = new TextEncoder().encode(featureTestContent);
    await vscode.workspace.fs.writeFile(featureTestUri, content);
    
    // Применяем форматирование к созданному файлу
    try {
        const document = await vscode.workspace.openTextDocument(featureTestUri);
        await vscode.window.showTextDocument(document, { preview: false, preserveFocus: true });await vscode.commands.executeCommand('editor.action.formatDocument');
        await new Promise(resolve => setTimeout(resolve, 500));
        
        await vscode.commands.executeCommand('editor.action.organizeImports');
        await new Promise(resolve => setTimeout(resolve, 500));
        
        await document.save();
        console.log(`✓ Общий тестовый файл фичи создан и отформатирован: ${featureTestFileName}`);
        
    } catch (error) {
        console.error('✗ Ошибка при форматировании общего файла фичи:', error);
    }
}

/**
 * Обновляет главный test.dart файл, добавляя импорт и вызов для новой фичи
 * @param workspaceRoot - корневая папка проекта
 * @param testDir - папка с тестами
 * @param featureName - название фичи
 */
async function updateMainTestFile(
    workspaceRoot: vscode.Uri, 
    testDir: string, 
    featureName: string
): Promise<void> {
    const mainTestUri = vscode.Uri.joinPath(workspaceRoot, testDir, 'test.dart');
    
    try {
        // Проверяем, существует ли главный тестовый файл
        const mainTestExists = await fileExists(mainTestUri);
        
        if (!mainTestExists) {// Создаем новый главный тестовый файл
            const newMainTestContent = `import 'features/${featureName}/${featureName}_test.dart' as ${featureName}_test;

Future<void> main() async {
  ${featureName}_test.main();
}`;
            
            const content = new TextEncoder().encode(newMainTestContent);
            await vscode.workspace.fs.writeFile(mainTestUri, content);
            
        } else {// Читаем существующий файл
            const mainTestData = await vscode.workspace.fs.readFile(mainTestUri);
            let mainTestContent = new TextDecoder().decode(mainTestData);
            
            const featureImport = `import 'features/${featureName}/${featureName}_test.dart' as ${featureName}_test;`;
            const featureCall = `  ${featureName}_test.main();`;
            
            // Проверяем, есть ли уже импорт для этой фичи
            if (mainTestContent.includes(featureImport)) {return;
            }
            
            // Находим место для вставки импорта (после последнего импорта)
            const importLines = mainTestContent.split('\n').filter(line => line.trim().startsWith('import '));
            const lastImportIndex = mainTestContent.lastIndexOf(importLines[importLines.length - 1]);
            const afterLastImport = mainTestContent.indexOf('\n', lastImportIndex) + 1;
            
            // Вставляем новый импорт
            mainTestContent = mainTestContent.slice(0, afterLastImport) + 
                             featureImport + '\n' + 
                             mainTestContent.slice(afterLastImport);
            
            // Находим место для вставки вызова (перед закрывающей скобкой main функции)
            const mainFunctionMatch = mainTestContent.match(/Future<void>\s+main\(\)\s+async\s*\{([\s\S]*)\}/);
            if (mainFunctionMatch) {
                const mainBody = mainFunctionMatch[1];
                const lastCallMatch = mainBody.trim().match(/.*\.main\(\);/);
                
                if (lastCallMatch) {
                    // Находим позицию последнего вызова
                    const lastCallIndex = mainTestContent.lastIndexOf(lastCallMatch[0]);
                    const afterLastCall = mainTestContent.indexOf('\n', lastCallIndex) + 1;
                    
                    // Вставляем новый вызов
                    mainTestContent = mainTestContent.slice(0, afterLastCall) + 
                                     featureCall + '\n' + 
                                     mainTestContent.slice(afterLastCall);
                } else {
                    // Если нет других вызовов, добавляем в начало main функции
                    const mainStartIndex = mainTestContent.indexOf('{', mainTestContent.indexOf('main()')) + 1;
                    mainTestContent = mainTestContent.slice(0, mainStartIndex) + 
                                     '\n' + featureCall + '\n' + 
                                     mainTestContent.slice(mainStartIndex);
                }
            } else {
                // Пробуем найти обычную main функцию без async
                const simpleFunctionMatch = mainTestContent.match(/void\s+main\(\)\s*\{([\s\S]*)\}/);
                if (simpleFunctionMatch) {
                    const mainBody = simpleFunctionMatch[1];
                    const lastCallMatch = mainBody.trim().match(/.*\.main\(\);/);
                    
                    if (lastCallMatch) {
                        // Находим позицию последнего вызова
                        const lastCallIndex = mainTestContent.lastIndexOf(lastCallMatch[0]);
                        const afterLastCall = mainTestContent.indexOf('\n', lastCallIndex) + 1;
                        
                        // Вставляем новый вызов
                        mainTestContent = mainTestContent.slice(0, afterLastCall) + 
                                         featureCall + '\n' + 
                                         mainTestContent.slice(afterLastCall);
                    } else {
                        // Если нет других вызовов, добавляем в начало main функции
                        const mainStartIndex = mainTestContent.indexOf('{', mainTestContent.indexOf('main()')) + 1;
                        mainTestContent = mainTestContent.slice(0, mainStartIndex) + 
                                         '\n' + featureCall + '\n' + 
                                         mainTestContent.slice(mainStartIndex);
                    }
                }
            }
            
            // Сохраняем обновленный файл
            const updatedContent = new TextEncoder().encode(mainTestContent);
            await vscode.workspace.fs.writeFile(mainTestUri, updatedContent);
        }
        
        // Применяем форматирование к главному файлу
        try {
            const document = await vscode.workspace.openTextDocument(mainTestUri);
            await vscode.window.showTextDocument(document, { preview: false, preserveFocus: true });await vscode.commands.executeCommand('editor.action.formatDocument');
            await new Promise(resolve => setTimeout(resolve, 500));
            
            await vscode.commands.executeCommand('editor.action.organizeImports');
            await new Promise(resolve => setTimeout(resolve, 500));
            
            await document.save();
            console.log(`✓ Главный test.dart файл обновлен для фичи: ${featureName}`);
            
        } catch (error) {
            console.error('✗ Ошибка при форматировании главного test.dart:', error);
        }
        
    } catch (error) {
        console.error('✗ Ошибка при обновлении главного test.dart:', error);
        vscode.window.showErrorMessage(`Ошибка при обновлении главного test.dart: ${error}`);
    }
}

/**
 * Проверяет наличие DTO тестов для фичи
 * @param workspaceRoot - корневая папка проекта
 * @param testDir - папка с тестами
 * @param featureName - название фичи
 * @returns true если есть DTO тесты
 */
async function checkDtoTestsExist(
    workspaceRoot: vscode.Uri, 
    testDir: string, 
    featureName: string
): Promise<boolean> {
    try {
        const dtoTestDir = vscode.Uri.joinPath(workspaceRoot, testDir, 'features', featureName, `${featureName}_dto_test`);
        const dtoTestFile = vscode.Uri.joinPath(dtoTestDir, `${featureName}_dto_test.dart`);
        
        return await fileExists(dtoTestFile);
    } catch (error) {
        return false;
    }
}

// Генерация тестов
export async function generateTest(workspaceRoot: vscode.Uri, testDir: string, featureName: string, cubitName: string, classCode: string, packageName: string) {
    const isBloc = cubitName.toLowerCase().includes('bloc');
    
    // Исправляем генерацию имени файла с использованием snake_case
    const snakeCaseName = camelToSnakeCase(cubitName);
    const testFileName = `${snakeCaseName}_test.dart`;
    const testUri = vscode.Uri.joinPath(workspaceRoot, testDir, 'features', featureName, isBloc ? 'bloc' : 'cubit', testFileName);
    const dirUri = vscode.Uri.joinPath(workspaceRoot, testDir, 'features', featureName, isBloc ? 'bloc' : 'cubit');
    await vscode.workspace.fs.createDirectory(dirUri);

    // Формирование пути к файлу состояний путем замены _cubit или _bloc на _state
    const cubitFilePath = vscode.window.activeTextEditor?.document.uri.fsPath;
    if (!cubitFilePath) {
        vscode.window.showErrorMessage('Не удалось определить путь к файлу кубита/блока.');
        return;
    }
    const cubitFileName = path.basename(cubitFilePath, '.dart');
    const stateFileName = cubitFileName.replace(/_cubit|_bloc$/, '_state') + '.dart';
    const stateFilePath = path.join(path.dirname(cubitFilePath), stateFileName);
    const stateFileUri = vscode.Uri.file(stateFilePath);

    // Формирование импорта кубита/блока
    const relativePath = path.relative(path.join(workspaceRoot.fsPath, 'lib'), cubitFilePath);
    const importPathParts = relativePath.split(path.sep);
    const featuresIndex = importPathParts.indexOf('features');
    if (featuresIndex === -1) {
        vscode.window.showErrorMessage('Папка features не найдена в пути файла.');
        return;
    }
    const cubitImportPath = `package:${packageName}/${importPathParts.slice(featuresIndex).join('/')}`.replace(/\\/g, '/');

    // Извлечение импортов репозитория и secure_store
    const cubitFileUri = vscode.Uri.file(cubitFilePath);
    let cubitFileContent: string;
    try {
        const cubitFileData = await vscode.workspace.fs.readFile(cubitFileUri);
        cubitFileContent = new TextDecoder().decode(cubitFileData);
    } catch (error) {
        vscode.window.showErrorMessage('Ошибка чтения файла кубита/блока.');
        console.error('Flutter Test Generator: ошибка чтения файла кубита/блока:', error);
        return;
    }

    const importRegex = /^import\s+['"]([^'"]+)['"]\s*;/gm;
    const repositoryImports: string[] = [];
    const secureStoreImports: string[] = [];
    const entityImports: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = importRegex.exec(cubitFileContent)) !== null) {
        const importStatement = match[0];
        const importUrl = match[1];
        if (importUrl.includes('repository') || importUrl.includes('repositories')) {
            repositoryImports.push(importStatement);
        } else if (importUrl.includes('secure_store') || importUrl.includes('secure_storage') || 
                   importUrl.includes('app_services') || importUrl.includes('service') || 
                   importUrl.includes('services')) {
            secureStoreImports.push(importStatement);
        } else if (importUrl.includes('entity') || importUrl.includes('entities') || 
                   (importUrl.includes('domain') && (importUrl.includes('model') || importUrl.includes('entity')))) {
            entityImports.push(importStatement);
        }
    }

    const states: StateInfo[] = await fileExists(stateFileUri) ? await parseStates(stateFilePath) : [];
    let { events, dependencies, methods } = parseCubitOrBloc(classCode);
    
    // Для блоков дополнительно парсим события из файла событий
    if (isBloc) {
        const eventFileName = cubitFileName.replace(/_bloc$/, '_event') + '.dart';
        const eventFilePath = path.join(path.dirname(cubitFilePath), eventFileName);
        const eventFileUri = vscode.Uri.file(eventFilePath);
        
        if (await fileExists(eventFileUri)) {const eventsFromFile = await parseEvents(eventFilePath);
            
            // Объединяем события из файла с обработчиками из блока
            for (const eventFromFile of eventsFromFile) {
                const existingEvent = events.find(e => e.name === eventFromFile.name);
                if (existingEvent) {
                    // Обновляем параметры события
                    existingEvent.parameters = eventFromFile.parameters;} else {
                    // Добавляем новое событие (возможно, обработчик не найден)
                    events.push(eventFromFile);
                    console.log(`➕ Добавлено событие без обработчика: ${eventFromFile.name}`);
                }
            }
        }
    }

    // Если состояния не найдены в отдельном файле, попробуем найти их в том же файле
    if (states.length === 0) {
        console.log(`Файл состояний не найден: ${stateFilePath}, ищем состояния в том же файле...`);
        const inlineStates = parseInlineStates(classCode);
        states.push(...inlineStates);
    }

    const initialState = states.find(s => s.isInitial)?.name || states[0]?.name || 'InitialState';
    const { fsm, parsedMethods, executionBranches } = buildFSM(states, methods, events, initialState, classCode, cubitName);
    
    let actualStates = states;
    if (states.length === 0 && fsm.states.length > 0) {
        // Создаем StateInfo объекты для состояний, найденных в FSM
        actualStates = fsm.states.map(stateName => ({
            name: stateName,
            isInitial: stateName.toLowerCase().includes('initial') || stateName === fsm.initialState,
            isError: stateName.toLowerCase().includes('error'),
            isLoading: stateName.toLowerCase().includes('loading'),
            isSuccess: stateName.toLowerCase().includes('success')
        }));
        console.log(`✓ Использованы состояния из FSM: ${actualStates.map(s => s.name).join(', ')}`);
    }
    
    const paths = generateTestPaths(fsm);
    
    // Отладочная информация
    console.log(`\n=== Отладочная информация для ${cubitName} ===`);
    console.log(`Найдено состояний: ${actualStates.length}`);
    console.log(`Состояния: ${actualStates.map(s => s.name).join(', ')}`);
    console.log(`Найдено событий: ${events.length}`);
    console.log(`События: ${events.map(e => e.name).join(', ')}`);
    console.log(`Найдено методов: ${methods.length}`);
    console.log(`Методы: ${methods.map(m => m.name).join(', ')}`);
    console.log(`Переходов в автомате: ${fsm.transitions.length}`);
    fsm.transitions.forEach((t: any, i: any) => {
        console.log(`  ${i + 1}. ${t.from} --[${t.method}]--> ${t.to}`);
    });
    console.log(`Тестовых путей: ${paths.length}`);
    console.log('=== Конец отладочной информации ===\n');
    
    // Генерируем и выводим Graphviz диаграммы
    const fsmDotContent = generateFSMGraphvizDot(fsm, actualStates);
    const pathsDotContent = generateTestPathsGraphvizDot(fsm, paths, actualStates);
    
    console.log('\n=== Graphviz DOT диаграмма автомата состояний ===');
    console.log(fsmDotContent);
    console.log('\n=== Graphviz DOT диаграмма тестовых путей ===');
    console.log(pathsDotContent);
    console.log('\nДля визуализации:');
    console.log('1. Скопируйте DOT содержимое выше');
    console.log('2. Используйте онлайн инструменты: https://dreampuf.github.io/GraphvizOnline/');
    console.log('3. Или установите Graphviz локально: dot -Tpng input.dot -o output.png');
    console.log('=== Конец диаграмм ===\n');
    
    // Показываем диаграмму в отдельном окне VS Code
    const graphvizPanel = vscode.window.createWebviewPanel(
        'graphvizDiagram',
        `Диаграмма автомата состояний: ${cubitName}`,
        vscode.ViewColumn.Beside,
        {
            enableScripts: true
        }
    );
    
    // Генерируем HTML для информации о методах
    const methodsInfoHtml = parsedMethods.map(method => `
        <div class="method-info">
            <h4>${method.type === 'event' ? '•' : '•'} ${method.name} (${method.type})</h4>
            <div class="method-details">
                <div class="allowed-states">
                    <strong>✓ Разрешенные состояния:</strong> 
                    ${method.allowedFromStates.length > 0 ? method.allowedFromStates.join(', ') : 'Нет'}
                </div>
                <div class="emit-states">
                    <strong>• Emit состояния:</strong> 
                    ${method.emitStates.length > 0 ? method.emitStates.join(', ') : 'Нет'}
                </div>
                ${method.guardConditions.length > 0 ? `
                <div class="guard-conditions">
                    <strong>🚫 Guard условия:</strong> 
                    ${method.guardConditions.join(', ')}
                </div>` : ''}
                <div class="transitions-count">
                    <strong>🔄 Создано переходов:</strong> 
                    ${method.allowedFromStates.length * method.emitStates.length}
                </div>
            </div>
        </div>
    `).join('');

    // Генерируем HTML для информации о ветках выполнения
    const branchesInfoHtml = Array.from(executionBranches.entries()).map(([eventName, branches]) => `
        <div class="event-branches">
            <h4>• ${eventName}</h4>
            ${branches.map((branch, index) => `
                <div class="branch-info">
                    <h5>${branch.isSuccessPath ? '✓' : '✗'} ${branch.branchId}</h5>
                    <div class="branch-details">
                        <div><strong>Путь:</strong> ${branch.states.join(' → ')}</div>
                        <div><strong>Репозиторий:</strong> ${branch.repositoryCalls.join(', ') || 'нет'}</div>
                        <div><strong>Хранилище:</strong> ${branch.storageCalls.join(', ') || 'нет'}</div>
                        <div><strong>Приватные методы:</strong> ${branch.privateMethodCalls.join(', ') || 'нет'}</div>
                    </div>
                </div>
            `).join('')}
        </div>
    `).join('');

    graphvizPanel.webview.html = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Диаграмма автомата состояний</title>
        <style>
            body { 
                font-family: Arial, sans-serif; 
                margin: 20px; 
                background-color: #f5f5f5;
                color: #000;
            }
            .container {
                background-color: white;
                padding: 20px;
                border-radius: 8px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .header {
                color: #333;
                border-bottom: 2px solid #007acc;
                padding-bottom: 10px;
                margin-bottom: 20px;
            }
            .dot-content {
                background-color: #f8f8f8;
                border: 1px solid #ddd;
                border-radius: 4px;
                padding: 15px;
                font-family: 'Courier New', monospace;
                white-space: pre-wrap;
                overflow-x: auto;
                margin: 15px 0;
                color: #000;
            }
            .instructions {
                background-color: #e7f3ff;
                border-left: 4px solid #007acc;
                padding: 15px;
                margin: 15px 0;
            }
            .button {
                background-color: #007acc;
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 4px;
                cursor: pointer;
                margin: 5px 5px 5px 0;
                font-size: 14px;
            }
            .button:hover {
                background-color: #005a9e;
            }
            .button:disabled {
                background-color: #ccc;
                cursor: not-allowed;
            }
            .generate-button {
                background-color: #28a745;
            }
            .generate-button:hover {
                background-color: #218838;
            }
            .stats {
                background-color: #f0f8ff;
                border: 1px solid #b3d9ff;
                border-radius: 4px;
                padding: 10px;
                margin: 15px 0;
            }
            .methods-section {
                background-color: #f9f9f9;
                border: 1px solid #ddd;
                border-radius: 4px;
                padding: 15px;
                margin: 15px 0;
            }
            .method-info {
                background-color: white;
                border: 1px solid #e0e0e0;
                border-radius: 4px;
                padding: 10px;
                margin: 10px 0;
            }
            .method-details {
                margin-top: 8px;
                font-size: 0.9em;
            }
            .method-details > div {
                margin: 4px 0;
                padding: 2px 0;
            }
            .allowed-states { color: #2d8f2d; }
            .emit-states { color: #0066cc; }
            .guard-conditions { color: #cc6600; }
            .transitions-count { color: #6600cc; }
            .event-branches {
                background-color: white;
                border: 1px solid #e0e0e0;
                border-radius: 4px;
                padding: 10px;
                margin: 10px 0;
            }
            .branch-info {
                background-color: #f9f9f9;
                border: 1px solid #ddd;
                border-radius: 4px;
                padding: 8px;
                margin: 8px 0;
            }
            .branch-details {
                margin-top: 5px;
                font-size: 0.9em;
            }
            .branch-details > div {
                margin: 2px 0;
            }
            .graph-container {
                background-color: white;
                border: 2px solid #007acc;
                border-radius: 8px;
                padding: 20px;
                margin: 20px 0;
                text-align: center;
            }
            .graph-image {
                max-width: 100%;
                height: auto;
                border: 1px solid #ddd;
                border-radius: 4px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            }
            .loading {
                color: #007acc;
                font-style: italic;
            }
            .error {
                color: #dc3545;
                background-color: #f8d7da;
                border: 1px solid #f5c6cb;
                border-radius: 4px;
                padding: 10px;
                margin: 10px 0;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1 class="header">Диаграмма автомата состояний: ${cubitName}</h1>
            
            <div class="stats">
                <h3>Статистика автомата:</h3>
                <ul>
                    <li><strong>Состояний:</strong> ${fsm.states.length}</li>
                    <li><strong>Переходов:</strong> ${fsm.transitions.length}</li>
                    <li><strong>Тестовых путей (BFS):</strong> ${paths.length}</li>
                    <li><strong>Реальных тестов:</strong> ${Array.from(executionBranches.values()).reduce((total, branches) => total + branches.length, 0)}</li>
                    <li><strong>Начальное состояние:</strong> ${fsm.initialState}</li>
                    <li><strong>Проанализировано методов/событий:</strong> ${parsedMethods.length}</li>
                </ul>
            </div>

            <div class="methods-section">
                <h3>• Детальная информация о методах/событиях:</h3>
                ${methodsInfoHtml}
            </div>

            <div class="methods-section">
                <h3>🌳 Ветки выполнения (реальные тесты):</h3>
                ${branchesInfoHtml}
            </div>
            
            <h3>🖼️ Визуализация автомата состояний:</h3>
            <div style="margin: 15px 0;">
                <button class="button generate-button" onclick="generateFSMGraph()" id="generateFSMBtn">
                    🎨 Сгенерировать автомат состояний
                </button>
                <button class="button generate-button" onclick="generatePathsGraph()" id="generatePathsBtn">
                    🛤️ Сгенерировать тестовые пути
                </button>
                <button class="button" onclick="copyFSMToClipboard()">• Скопировать DOT автомата</button>
                <button class="button" onclick="copyPathsToClipboard()">• Скопировать DOT путей</button>
                <button class="button" onclick="toggleFSMDotCode()">👁️ Показать/скрыть DOT автомата</button>
                <button class="button" onclick="togglePathsDotCode()">👁️ Показать/скрыть DOT путей</button>
            </div>
            
            <div class="graph-container" id="fsmGraphContainer" style="display: none;">
                <h4>🏗️ Автомат состояний</h4>
                <div id="fsmLoadingMessage" class="loading" style="display: none;">
                    ⏳ Генерируем изображение автомата состояний...
                </div>
                <div id="fsmErrorMessage" class="error" style="display: none;"></div>
                <img id="fsmGraphImage" class="graph-image" style="display: none;" alt="Диаграмма автомата состояний">
            </div>
            
            <div class="graph-container" id="pathsGraphContainer" style="display: none;">
                <h4>🛤️ Тестовые пути</h4>
                <div id="pathsLoadingMessage" class="loading" style="display: none;">
                    ⏳ Генерируем изображение тестовых путей...
                </div>
                <div id="pathsErrorMessage" class="error" style="display: none;"></div>
                <img id="pathsGraphImage" class="graph-image" style="display: none;" alt="Диаграмма тестовых путей">
            </div>
            
            <div class="dot-content" id="fsmDotContent" style="display: none;">${fsmDotContent}</div>
            <div class="dot-content" id="pathsDotContent" style="display: none;">${pathsDotContent}</div>
            
            <div class="instructions">
                <h3>Инструкции:</h3>
                <ol>
                    <li><strong>Автоматическая генерация:</strong> Нажмите кнопки "Сгенерировать автомат состояний" и "Сгенерировать тестовые пути" для создания визуализаций</li>
                    <li><strong>Ручная генерация:</strong> Скопируйте соответствующий DOT код и используйте <a href="https://dreampuf.github.io/GraphvizOnline/" target="_blank">Graphviz Online</a></li>
                    <li><strong>Локальная генерация:</strong> Установите Graphviz и используйте команду: <code style="background-color: #f0f0f0; padding: 2px 4px; border-radius: 3px; color: #d63384;">dot -Tpng input.dot -o output.png</code></li>
                </ol>
                <h4>Различия между графиками:</h4>
                <ul>
                    <li><strong>🏗️ Автомат состояний:</strong> Показывает все состояния и возможные переходы между ними</li>
                    <li><strong>🛤️ Тестовые пути:</strong> Показывает конкретные пути, которые будут протестированы, с цветовой кодировкой и легендой</li>
                </ul>
            </div>
            
            <h3>Описание цветов:</h3>
            <ul>
                <li><span style="color: green;">🟢 Зеленый</span> - Начальное состояние</li>
                <li><span style="color: red;">🔴 Красный</span> - Состояния ошибок</li>
                <li><span style="color: orange;">🟡 Желтый</span> - Состояния загрузки</li>
                <li><span style="color: blue;">🔵 Синий</span> - Успешные состояния</li>
                <li><span style="color: red;"><strong>Красные стрелки</strong></span> - Тестовые пути</li>
            </ul>
        </div>
        
        <script>
            function copyFSMToClipboard() {
                const dotContent = document.getElementById('fsmDotContent').textContent;
                navigator.clipboard.writeText(dotContent).then(function() {
                    const button = event.target;
                    const originalText = button.textContent;
                    button.textContent = '✓ Скопировано!';
                    setTimeout(() => {
                        button.textContent = originalText;
                    }, 2000);
                });
            }
            
            function copyPathsToClipboard() {
                const dotContent = document.getElementById('pathsDotContent').textContent;
                navigator.clipboard.writeText(dotContent).then(function() {
                    const button = event.target;
                    const originalText = button.textContent;
                    button.textContent = '✓ Скопировано!';
                    setTimeout(() => {
                        button.textContent = originalText;
                    }, 2000);
                });
            }
            
            function toggleFSMDotCode() {
                const dotContent = document.getElementById('fsmDotContent');
                const button = event.target;
                if (dotContent.style.display === 'none') {
                    dotContent.style.display = 'block';
                    button.textContent = '👁️ Скрыть DOT автомата';
    } else {
                    dotContent.style.display = 'none';
                    button.textContent = '👁️ Показать DOT автомата';
                }
            }
            
            function togglePathsDotCode() {
                const dotContent = document.getElementById('pathsDotContent');
                const button = event.target;
                if (dotContent.style.display === 'none') {
                    dotContent.style.display = 'block';
                    button.textContent = '👁️ Скрыть DOT путей';
                } else {
                    dotContent.style.display = 'none';
                    button.textContent = '👁️ Показать DOT путей';
                }
            }
            
            async function generateFSMGraph() {
                const generateBtn = document.getElementById('generateFSMBtn');
                const graphContainer = document.getElementById('fsmGraphContainer');
                const loadingMessage = document.getElementById('fsmLoadingMessage');
                const errorMessage = document.getElementById('fsmErrorMessage');
                const graphImage = document.getElementById('fsmGraphImage');
                const dotContent = document.getElementById('fsmDotContent').textContent;
                
                // Показываем контейнер и индикатор загрузки
                graphContainer.style.display = 'block';
                loadingMessage.style.display = 'block';
                errorMessage.style.display = 'none';
                graphImage.style.display = 'none';
                generateBtn.disabled = true;
                generateBtn.textContent = '⏳ Генерируем...';
                
                try {
                    // Используем публичный API для генерации изображения
                    const response = await fetch('https://quickchart.io/graphviz', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            graph: dotContent,
                            format: 'png'
                        })
                    });
                    
                    if (!response.ok) {
                        throw new Error(\`HTTP error! status: \${response.status}\`);
                    }
                    
                    const blob = await response.blob();
                    const imageUrl = URL.createObjectURL(blob);
                    
                    // Показываем изображение
                    graphImage.src = imageUrl;
                    graphImage.style.display = 'block';
                    loadingMessage.style.display = 'none';
                    generateBtn.textContent = '✓ Автомат создан!';
                    
                    setTimeout(() => {
                        generateBtn.textContent = '🎨 Сгенерировать автомат состояний';
                        generateBtn.disabled = false;
                    }, 3000);
                    
                } catch (error) {
                    console.error('Ошибка генерации автомата:', error);
                    loadingMessage.style.display = 'none';
                    errorMessage.style.display = 'block';
                    errorMessage.textContent = \`Ошибка генерации изображения: \${error.message}. Попробуйте использовать ручную генерацию через Graphviz Online.\`;
                    generateBtn.textContent = '✗ Ошибка генерации';
                    generateBtn.disabled = false;
                    
                    setTimeout(() => {
                        generateBtn.textContent = '🎨 Сгенерировать автомат состояний';
                    }, 3000);
                }
            }
            
            async function generatePathsGraph() {
                const generateBtn = document.getElementById('generatePathsBtn');
                const graphContainer = document.getElementById('pathsGraphContainer');
                const loadingMessage = document.getElementById('pathsLoadingMessage');
                const errorMessage = document.getElementById('pathsErrorMessage');
                const graphImage = document.getElementById('pathsGraphImage');
                const dotContent = document.getElementById('pathsDotContent').textContent;
                
                // Показываем контейнер и индикатор загрузки
                graphContainer.style.display = 'block';
                loadingMessage.style.display = 'block';
                errorMessage.style.display = 'none';
                graphImage.style.display = 'none';
                generateBtn.disabled = true;
                generateBtn.textContent = '⏳ Генерируем...';
                
                try {
                    // Используем публичный API для генерации изображения
                    const response = await fetch('https://quickchart.io/graphviz', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            graph: dotContent,
                            format: 'png'
                        })
                    });
                    
                    if (!response.ok) {
                        throw new Error(\`HTTP error! status: \${response.status}\`);
                    }
                    
                    const blob = await response.blob();
                    const imageUrl = URL.createObjectURL(blob);
                    
                    // Показываем изображение
                    graphImage.src = imageUrl;
                    graphImage.style.display = 'block';
                    loadingMessage.style.display = 'none';
                    generateBtn.textContent = '✓ Пути созданы!';
                    
                    setTimeout(() => {
                        generateBtn.textContent = '🛤️ Сгенерировать тестовые пути';
                        generateBtn.disabled = false;
                    }, 3000);
                    
                } catch (error) {
                    console.error('Ошибка генерации путей:', error);
                    loadingMessage.style.display = 'none';
                    errorMessage.style.display = 'block';
                    errorMessage.textContent = \`Ошибка генерации изображения: \${error.message}. Попробуйте использовать ручную генерацию через Graphviz Online.\`;
                    generateBtn.textContent = '✗ Ошибка генерации';
                    generateBtn.disabled = false;
                    
                    setTimeout(() => {
                        generateBtn.textContent = '🛤️ Сгенерировать тестовые пути';
                    }, 3000);
                }
            }
        </script>
    </body>
    </html>`;
    
    // Показываем уведомление с ссылкой
    vscode.window.showInformationMessage(
        'Диаграмма автомата состояний создана! Откройте панель справа для просмотра.',
        'Открыть Graphviz Online'
    ).then(selection => {
        if (selection === 'Открыть Graphviz Online') {
            vscode.env.openExternal(vscode.Uri.parse('https://dreampuf.github.io/GraphvizOnline/'));
        }
    });
    
    let tests = generateBlocTests(cubitName, paths, isBloc, dependencies, actualStates, methods, events, classCode, executionBranches);

    // Автоматический поиск Entity импортов в коде блока
    const entityImportRegex = /import\s+['"]([^'"]*entity[^'"]*)['"]/gi;
    let entityMatch;
    while ((entityMatch = entityImportRegex.exec(cubitFileContent)) !== null) {
        const entityImport = `import '${entityMatch[1]}';`;
        if (!entityImports.includes(entityImport)) {
            entityImports.push(entityImport);}
    }

    const allImportsSet = new Set<string>([
        ...repositoryImports,
        ...secureStoreImports,
        ...entityImports,
        `import '${cubitImportPath}';`,
        `import 'package:bloc_test/bloc_test.dart';`,
        `import 'package:flutter_test/flutter_test.dart';`
    ]);
    
    if (repositoryImports.length > 0 || secureStoreImports.length > 0) {
        allImportsSet.add(`import 'package:mocktail/mocktail.dart';`);
    }
    
    // Добавляем импорты событий и состояний для блоков и кубитов
    const cubitDir = path.dirname(cubitFilePath);
    
    // Для блоков добавляем импорт событий
    if (isBloc) {
        const eventFileName = cubitFileName.replace(/_bloc$/, '_event') + '.dart';
        const eventFilePath = path.join(cubitDir, eventFileName);
        const eventFileUri = vscode.Uri.file(eventFilePath);
        
        if (await fileExists(eventFileUri)) {
            // Используем полный package путь для событий
            const eventRelativePath = path.relative(path.join(workspaceRoot.fsPath, 'lib'), eventFilePath);
            const eventImportPath = `package:${packageName}/${eventRelativePath.replace(/\\/g, '/')}`;
            allImportsSet.add(`import '${eventImportPath}';`);}
    }
    
    // Для блоков и кубитов добавляем импорт состояний
    const stateFileNameForImport = cubitFileName.replace(/_cubit|_bloc$/, '_state') + '.dart';
    const stateFilePathForImport = path.join(cubitDir, stateFileNameForImport);
    const stateFileUriForImport = vscode.Uri.file(stateFilePathForImport);
    
    if (await fileExists(stateFileUriForImport)) {
        // Используем полный package путь для состояний
        const stateRelativePath = path.relative(path.join(workspaceRoot.fsPath, 'lib'), stateFilePathForImport);
        const stateImportPath = `package:${packageName}/${stateRelativePath.replace(/\\/g, '/')}`;
        allImportsSet.add(`import '${stateImportPath}';`);}
    
    // Конвертируем Set в массив и сортируем
    const allImports = Array.from(allImportsSet).sort();
    // Генерируем функцию для создания тестовых данных
    const testDataFunction = generateTestDataFunction(actualStates, dependencies);

    const testContent = `
${allImports.join('\n')}

${testDataFunction}

${tests}
`.trim();

    const content = new TextEncoder().encode(testContent);
    await vscode.workspace.fs.writeFile(testUri, content);
    
    // Автоматическое форматирование и исправление ошибок
    try {
        // Открываем созданный файл
        const document = await vscode.workspace.openTextDocument(testUri);
        const editor = await vscode.window.showTextDocument(document, { preview: false, preserveFocus: true });
        
        // СНАЧАЛА применяем Code Actions для исправления ошибок (особенно добавление аргументов)
        await applyAllCodeActions(document);
        
        // Ждем немного после применения Code Actions
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Сохраняем файл после исправлений
        await document.save();
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // ЗАТЕМ применяем форматирование (только если нет критических ошибок)
        const diagnosticsAfterFix = vscode.languages.getDiagnostics(testUri);
        const criticalErrors = diagnosticsAfterFix.filter(d => 
            d.severity === vscode.DiagnosticSeverity.Error && 
            d.message.includes('parse error')
        );
        
        if (criticalErrors.length === 0) {await vscode.commands.executeCommand('editor.action.formatDocument');
            
            // Ждем немного, чтобы форматирование завершилось
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Организуем импорты
            await vscode.commands.executeCommand('editor.action.organizeImports');
            
            // Ждем немного, чтобы организация импортов завершилась
            await new Promise(resolve => setTimeout(resolve, 1000));
        } else {}
        
        // Применяем автоматические исправления (Quick Fix)
        await vscode.commands.executeCommand('editor.action.autoFix');
        
        // Ждем немного, чтобы исправления применились
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Применяем исправления для всех проблем в файле
        await vscode.commands.executeCommand('editor.action.fixAll');
        
        // Ждем немного, чтобы все исправления применились
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Сохраняем файл после всех изменений
        await document.save();
        
        // Ждем немного после сохранения, чтобы анализатор обработал файл
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Проверяем диагностические ошибки
        const diagnostics = vscode.languages.getDiagnostics(testUri);
        const errors = diagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Error);
        const warnings = diagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Warning);
        
        console.log('✓ Форматирование и автоисправления применены');if (errors.length === 0) {
            vscode.window.showInformationMessage(
                `✓ Тестовый файл создан и отформатирован без ошибок: ${path.basename(testUri.fsPath)}`,
                'Открыть файл', 'Запустить тесты'
            ).then(selection => {
                if (selection === 'Открыть файл') {
                    vscode.window.showTextDocument(document);
                } else if (selection === 'Запустить тесты') {
                    // Запускаем тесты для созданного файла
                    runTestsForFile(testUri);
                }
            });
        } else {
            vscode.window.showWarningMessage(
                `Внимание: Тестовый файл создан с ${errors.length} ошибками и ${warnings.length} предупреждениями: ${path.basename(testUri.fsPath)}`,
                'Открыть файл', 'Показать проблемы', 'Попробовать запустить тесты'
            ).then(selection => {
                if (selection === 'Открыть файл') {
                    vscode.window.showTextDocument(document);
                } else if (selection === 'Показать проблемы') {
                    vscode.commands.executeCommand('workbench.actions.view.problems');
                } else if (selection === 'Попробовать запустить тесты') {
                    runTestsForFile(testUri);
                }
            });
        }
        
    } catch (error) {
        console.error('✗ Ошибка при форматировании:', error);
        vscode.window.showWarningMessage(`Внимание: Тестовый файл создан, но возникла ошибка при форматировании: ${testUri.fsPath}`);
    }

    // Генерируем общие тестовые файлы
    try {// Проверяем наличие DTO тестов
        const hasDtoTests = await checkDtoTestsExist(workspaceRoot, testDir, featureName);// Генерируем общий тестовый файл фичи
        await generateFeatureTestFile(workspaceRoot, testDir, featureName, true, hasDtoTests);
        
        // Обновляем главный test.dart файл
        await updateMainTestFile(workspaceRoot, testDir, featureName);
        
        console.log('✓ Общие тестовые файлы успешно созданы/обновлены');
        
    } catch (error) {
        console.error('✗ Ошибка при генерации общих тестовых файлов:', error);
        vscode.window.showWarningMessage(`Внимание: Ошибка при генерации общих тестовых файлов: ${error}`);
    }
}

// Парсинг событий из файла событий
async function parseEvents(eventFilePath: string): Promise<EventInfo[]> {
    try {
        const eventDocument = await vscode.workspace.openTextDocument(eventFilePath);
        const eventCode = eventDocument.getText();
        
        const events: EventInfo[] = [];
        
        // Регулярное выражение для парсинга классов событий
        const eventClassRegex = /class\s+(\w+Event)\s+extends\s+\w+Event\s*{([^}]*)}/g;
        
        let match: RegExpExecArray | null;
        while ((match = eventClassRegex.exec(eventCode)) !== null) {
            const eventName = match[1];
            const eventBody = match[2];
            
            // Парсим параметры из полей класса (final поля)
            const parameters: string[] = [];
            const fieldRegex = /final\s+(\w+\??)\s+(\w+);/g;
            let fieldMatch;
            while ((fieldMatch = fieldRegex.exec(eventBody)) !== null) {
                parameters.push(`${fieldMatch[1]} ${fieldMatch[2]}`);
            }
            
            events.push({
                name: eventName,
                handler: '', // Будет заполнено позже
                parameters
            });}
        
        return events;
    } catch (error) {return [];
    }
}

// Новая функция для получения параметров метода для мока
function getMethodParamsForMock(methodName: string): string {
    const lowerMethodName = methodName.toLowerCase();
    
    if (lowerMethodName.includes('performauthorization') || lowerMethodName.includes('authorization')) {
        return 'email: any(named: "email"), password: any(named: "password")';
    }
    if (lowerMethodName.includes('logout')) {
        return '';
    }
    if (lowerMethodName.includes('fetch')) {
        return 'page: any(named: "page")';
    }
    if (lowerMethodName.includes('refresh')) {
        return 'refreshToken: any(named: "refreshToken"), accessToken: any(named: "accessToken")';
    }
    
    return '';
}

// НОВАЯ ФУНКЦИЯ: Генерация минимального необходимого количества тестов
function generateMinimalRequiredTests(
    cubitName: string, 
    methods: MethodInfo[], 
    events: EventInfo[], 
    dependencies: DependencyInfo[], 
    states: StateInfo[], 
    isBloc: boolean,
    classCode?: string  // Добавляем classCode как параметр
): { tests: string, mandatoryTestsInfo: MandatoryTestInfo[] } {
    let tests = '';
    const mandatoryTestsInfo: MandatoryTestInfo[] = [];
    console.log(`\n• Генерируем минимальные необходимые тесты:`);
    
    // вспомогательный АНАЛИЗ: Обогащаем методы/события информацией о состояниях
    let enrichedMethods: MethodInfo[] = methods;
    let enrichedEvents: EventInfo[] = events;
    
    if (classCode) {const enrichmentResult = enrichMethodsWithStateAnalysis(methods, events, classCode);
        enrichedMethods = enrichmentResult.enrichedMethods;
        enrichedEvents = enrichmentResult.enrichedEvents;
    } else {}
    
    if (isBloc) {for (const event of events) {// Находим метод-обработчик для события
            const method = methods.find(m => m.name === event.handler);
            if (!method) {
                console.log(`    ✗ Метод-обработчик ${event.handler} не найден`);
                continue;
            }
            
            // Анализируем конечные состояния для этого события
            const finalStates = new Set<string>();
            const transientStates = new Set<string>();
            
            method.transitions.forEach(transition => {
                finalStates.add(transition.to);
                // Добавляем промежуточные состояния как сквозные
                if (transition.from !== method.transitions[0]?.from) {
                    transientStates.add(transition.from);
                }
            });
            
            console.log(`    • Найдено конечных состояний: ${finalStates.size}, сквозных: ${transientStates.size}`);
            
            // Генерируем тесты для каждого конечного состояния
            let testIndex = 1;
            for (const finalState of finalStates) {
                const testName = `${event.name}_to_${finalState}_test_${testIndex}`;// вспомогательный ПРОВЕРКА: Проверяем валидность теста
                if (classCode) {
                    const testStates = [...Array.from(transientStates), finalState];
                    const isValid = isTestValid(testStates, event.name, enrichedMethods, enrichedEvents);
                    
                    if (!isValid) {
                        console.log(`    ✗ Пропускаем неликвидный тест: ${testName}`);
                        testIndex++;
                        continue;
                    }
                }
                
                console.log(`    ✓ Генерируем валидный тест: ${testName}`);
                
                // Создаем MandatoryTestInfo
                const mandatoryTestInfo = createMandatoryTestInfo(
                    cubitName,
                    { ...method, name: event.name }, // Используем имя события
                    finalState,
                    Array.from(transientStates),
                    dependencies,
                    isBloc,
                    testName,
                    classCode
                );
                
                mandatoryTestsInfo.push(mandatoryTestInfo);
                
                // Находим переход к этому конечному состоянию
                const transition = method.transitions.find(t => t.to === finalState);
                if (transition) {
                    tests += generateSingleMethodTest(
                        cubitName,
                        { ...method, name: event.name }, // Используем имя события
                        finalState,
                        transition,
                        dependencies,
                        states,
                        isBloc,
                        testName,
                        Array.from(transientStates),
                        classCode
                    );
                }
                testIndex++;
            }
        }
    } else {for (const method of methods) {
            console.log(`  • Обрабатываем метод: ${method.name}`);
            
            // Анализируем конечные состояния для этого метода
            const finalStates = new Set<string>();
            const transientStates = new Set<string>();
            
            method.transitions.forEach(transition => {
                finalStates.add(transition.to);
                // Добавляем промежуточные состояния как сквозные
                if (transition.from !== method.transitions[0]?.from) {
                    transientStates.add(transition.from);
                }
            });
            
            console.log(`    • Найдено конечных состояний: ${finalStates.size}, сквозных: ${transientStates.size}`);
            
            // Генерируем тесты для каждого конечного состояния
            let testIndex = 1;
            for (const finalState of finalStates) {
                const testName = `${method.name}_to_${finalState}_test_${testIndex}`;// вспомогательный ПРОВЕРКА: Проверяем валидность теста
                if (classCode) {
                    const testStates = [...Array.from(transientStates), finalState];
                    const isValid = isTestValid(testStates, method.name, enrichedMethods, enrichedEvents);
                    
                    if (!isValid) {
                        console.log(`    ✗ Пропускаем неликвидный тест: ${testName}`);
                        testIndex++;
                        continue;
                    }
                }
                
                console.log(`    ✓ Генерируем валидный тест: ${testName}`);
                
                // Создаем MandatoryTestInfo
                const mandatoryTestInfo = createMandatoryTestInfo(
                    cubitName,
                    method,
                    finalState,
                    Array.from(transientStates),
                    dependencies,
                    isBloc,
                    testName,
                    classCode
                );
                
                mandatoryTestsInfo.push(mandatoryTestInfo);
                
                const transition = method.transitions.find(t => t.to === finalState);
                if (transition) {
                    tests += generateSingleMethodTest(
                        cubitName,
                        method,
                        finalState,
                        transition,
                        dependencies,
                        states,
                        isBloc,
                        testName,
                        Array.from(transientStates),
                        classCode
                    );
                }
                testIndex++;
            }
        }
    }
    
    const testCount = (tests.match(/blocTest</g) || []).length;
    console.log(`\n✓ Сгенерировано минимальных обязательных тестов: ${testCount}`);return { tests, mandatoryTestsInfo };
}

// НОВАЯ ФУНКЦИЯ: Генерация одного теста для конкретного метода и конечного состояния
function generateSingleMethodTest(
    cubitName: string,
    method: MethodInfo,
    finalState: string,
    transition: any,
    dependencies: DependencyInfo[],
    states: StateInfo[],
    isBloc: boolean,
    testName: string,
    transientStates: string[],
    classCode?: string  // Добавляем classCode как опциональный параметр
): string {
    let methodCall: string;
    if (isBloc) {
        // Для блоков генерируем событие с параметрами
        const eventParams = getEventParams(method.name);
        methodCall = `cubit.add(const ${method.name}(${eventParams}))`;
    } else {
        // Для кубитов генерируем вызов метода
        const methodParams = getMethodParams(method.name);
        methodCall = `cubit.${method.name}(${methodParams})`;
    }
    
    const expectedStates = [...transientStates, finalState];
    const expectedStatesCode = expectedStates.map(state => `const ${state}()`).join(',\n          ');
    
    // НОВОЕ: Парсим mock вызовы по маршруту теста
    let mockSetups = '';
    let mockVerifies: string[] = [];
    
    if (classCode && dependencies.length > 0) {const mockCallsResult = parseMockCallsByTestRoute(
            method.name,
            finalState,
            transientStates,
            classCode,
            dependencies,
            isBloc
        );
        
        // Объединяем все setup блоки
        const allSetups = [...mockCallsResult.repositorySetups, ...mockCallsResult.storageSetups];
        if (allSetups.length > 0) {
            mockSetups = `
        // Mock setups для маршрута теста
        ${allSetups.join('\n        ')}
        `;
            console.log(`  ✓ Добавлено ${allSetups.length} mock setup блоков`);
        }
        
        // Объединяем все verify блоки
        mockVerifies = [...mockCallsResult.repositoryVerifies, ...mockCallsResult.storageVerifies];
        if (mockVerifies.length > 0) {
            console.log(`  ✓ Добавлено ${mockVerifies.length} mock verify блоков`);
        }
    }
    
    // Генерируем verify блок
    let verifyBlock = '';
    if (mockVerifies.length > 0) {
        verifyBlock = `
      verify: (_) {
        ${mockVerifies.join('\n        ')}
      },`;
    } else if (dependencies.length > 0) {
        // Fallback к старой логике если парсинг не сработал
        const verifyStatements: string[] = [];
        
        // Проверяем вызовы репозитория
        if (transition.repositoryCalls && transition.repositoryCalls.length > 0) {
            for (const repoCall of transition.repositoryCalls) {
                const mockDep = dependencies.find(dep => dep.type.toLowerCase().includes('repository'));
                if (mockDep) {
                    verifyStatements.push(`verify(() => mock${mockDep.type}.${repoCall}()).called(1);`);
                }
            }
        }
        
        if (verifyStatements.length > 0) {
            verifyBlock = `
      verify: (_) {
        ${verifyStatements.join('\n        ')}
      },`;
        }
    }
    
    return `
    blocTest<${cubitName}, ${cubitName.replace('Cubit', 'State').replace('Bloc', 'State')}>(
      '${testName}: ${method.name} должен эмитировать ${expectedStates.join(' -> ')}',
      build: () {${mockSetups}
        return ${camelToSnakeCase(cubitName)};
      },
      act: (cubit) => ${methodCall},
      expect: () => [
          ${expectedStatesCode}
      ],${verifyBlock}
    );`;
}

// Новая функция для получения параметров события
function getEventParams(eventName: string): string {
    const lowerEventName = eventName.toLowerCase();
    
    if (lowerEventName.includes('loginuser') || lowerEventName.includes('authorization')) {
        return 'email: "test@test.com", password: "password123"';
    }
    if (lowerEventName.includes('logout')) {
        return '';
    }
    if (lowerEventName.includes('fetch')) {
        return 'page: 1';
    }
    if (lowerEventName.includes('refresh')) {
        return 'refreshToken: "refresh", accessToken: "access"';
    }
    
    return '';
}

// НОВАЯ ФУНКЦИЯ: Генерация дополнительных комбинированных тестов  
function generateAdditionalCombinedTests(
    cubitName: string, 
    paths: TestPath[], 
    dependencies: DependencyInfo[], 
    states: StateInfo[], 
    isBloc: boolean, 
    maxAdditionalTests: number = 10
): string {
    let tests = '';// Берем наиболее интересные пути (с несколькими переходами)
    const interestingPaths = paths
        .filter(path => path.methods.length > 1 && path.methods.length <= 3)
        .slice(0, maxAdditionalTests);for (let i = 0; i < interestingPaths.length; i++) {
        const path = interestingPaths[i];
        const testName = `combined_test_${i + 1}_${path.methods.join('_')}`;
        console.log(`    ✓ Генерируем комбинированный тест: ${testName}`);
        
        tests += generateCombinedPathTest(cubitName, path, dependencies, states, isBloc, testName);
    }
    
    console.log(`\n✓ Сгенерировано дополнительных тестов: ${interestingPaths.length}`);
    return tests;
}

// НОВАЯ ФУНКЦИЯ: Генерация теста для комбинированного пути
function generateCombinedPathTest(
    cubitName: string, 
    path: TestPath, 
    dependencies: DependencyInfo[], 
    states: StateInfo[], 
    isBloc: boolean, 
    testName: string
): string {
    // Создаем последовательность вызовов методов  
    const methodCalls = path.methods.map(method => 
        isBloc 
            ? `cubit.add(${generateEventInstance(method, [])});`
            : `cubit.${method}();`
    ).join('\n        ');
    
    // Создаем список ожидаемых состояний
    const expectedStates = path.states.slice(1); // Убираем начальное состояние
    const expectedStatesCode = expectedStates.map(state => `const ${state}()`).join(',\n          ');
    
    // Генерируем verify блок для комбинированных тестов
    let verifyBlock = '';
    if (dependencies.length > 0 && path.methods.length > 0) {
        const verifyStatements: string[] = [];
        
        // Для каждого метода в пути проверяем взаимодействия
        for (const method of path.methods) {
            const mockDep = dependencies.find(dep => dep.type.toLowerCase().includes('repository'));
            if (mockDep) {
                const repoMethod = getRepositoryMethod(method);
                verifyStatements.push(`verify(() => mock${mockDep.type}.${repoMethod}()).called(1);`);
            }
        }
        
        if (verifyStatements.length > 0) {
            verifyBlock = `
      verify: (_) {
        ${verifyStatements.join('\n        ')}
      },`;
        }
    }
    
    return `
    blocTest<${cubitName}, ${cubitName.replace('Cubit', 'State').replace('Bloc', 'State')}>(
      '${testName}: последовательность ${path.methods.join(' -> ')} должна привести к ${path.states.join(' -> ')}',
      build: () {
        return ${camelToSnakeCase(cubitName)};
      },
      act: (cubit) async {
        ${methodCalls}
      },
      expect: () => [
          ${expectedStatesCode}
      ],${verifyBlock}
    );`;
}

/**
 * вспомогательный МЕТОД: Парсинг mock вызовов по маршруту теста
 * Анализирует код метода/события и находит все mock вызовы между входом и конечным эмитом
 */
function parseMockCallsByTestRoute(
    eventOrMethodName: string,
    finalState: string,
    transientStates: string[],
    classCode: string,
    dependencies: DependencyInfo[],
    isBloc: boolean
): {
    repositorySetups: string[];
    repositoryVerifies: string[];
    storageSetups: string[];
    storageVerifies: string[];
} {const result = {
        repositorySetups: [] as string[],
        repositoryVerifies: [] as string[],
        storageSetups: [] as string[],
        storageVerifies: [] as string[]
    };

    // Шаг 1: Найти метод-обработчик (для блоков) или сам метод (для кубитов)
    let targetMethodName = eventOrMethodName;
    if (isBloc) {
        // Для блоков ищем метод-обработчик по регексу
        const handlerRegex = new RegExp(`on<${eventOrMethodName}>\\(([^)]+)\\)`, 'g');
        const handlerMatch = handlerRegex.exec(classCode);
        if (handlerMatch) {
            targetMethodName = handlerMatch[1];}
    }

    // Шаг 2: Извлечь тело метода
    const methodBody = extractMethodBodyFromCode(classCode, targetMethodName);
    if (!methodBody) {
        console.log(`  ✗ Тело метода ${targetMethodName} не найдено`);
        return result;
    }// Шаг 3: Найти все состояния в маршруте (сквозные + конечное)
    const routeStates = [...transientStates, finalState];// Шаг 4: Парсить вызовы репозитория
    dependencies.forEach(dep => {
        if (dep.type.toLowerCase().includes('repository')) {// Паттерны вызовов репозитория
            const repoCallPatterns = [
                `${dep.name}\\.performAuthorization`,
                `${dep.name}\\.login`,
                `${dep.name}\\.logout`,
                `${dep.name}\\.refreshToken`,
                `${dep.name}\\.fetch`,
                `${dep.name}\\.get`,
                `${dep.name}\\.post`,
                `${dep.name}\\.put`,
                `${dep.name}\\.delete`
            ];

            repoCallPatterns.forEach(pattern => {
                const regex = new RegExp(pattern, 'g');
                if (regex.test(methodBody)) {
                    console.log(`    ✓ Найден вызов: ${pattern}`);
                    
                    // Определяем метод для мока
                    const methodName = pattern.split('.')[1];
                    
                    // Определяем тип пути (успех или ошибка) по конечному состоянию
                    const isSuccessPath = finalState.toLowerCase().includes('success') || 
                                         finalState.toLowerCase().includes('loaded') || 
                                         finalState.toLowerCase().includes('data');
                    
                    if (isSuccessPath) {
                        // Setup для успешного пути
                        result.repositorySetups.push(
                            `when(() => mock${dep.type}.${methodName}()).thenAnswer((_) async => 'test_success_data');`
                        );
                    } else {
                        // Setup для пути с ошибкой
                        result.repositorySetups.push(
                            `when(() => mock${dep.type}.${methodName}()).thenThrow(Exception('Test repository error'));`
                        );
                    }
                    
                    // Verify блок
                    result.repositoryVerifies.push(
                        `verify(() => mock${dep.type}.${methodName}()).called(1);`
                    );
                }
            });
        }
        
        if (dep.type.toLowerCase().includes('storage') || dep.type.toLowerCase().includes('secure')) {// Паттерны вызовов хранилища
            const storageCallPatterns = [
                `${dep.name}\\.write`,
                `${dep.name}\\.read`,
                `${dep.name}\\.delete`,
                `${dep.name}\\.clear`,
                `${dep.name}\\.save`,
                `${dep.name}\\.get`,
                `${dep.name}\\.set`
            ];

            storageCallPatterns.forEach(pattern => {
                const regex = new RegExp(pattern, 'g');
                if (regex.test(methodBody)) {
                    console.log(`    ✓ Найден вызов хранилища: ${pattern}`);
                    
                    const methodName = pattern.split('.')[1];
                    
                    // Setup для хранилища (обычно всегда успешные)
                    if (methodName === 'write' || methodName === 'save' || methodName === 'set') {
                        result.storageSetups.push(
                            `when(() => mock${dep.type}.${methodName}(any(), any())).thenAnswer((_) async {});`
                        );
                        result.storageVerifies.push(
                            `verify(() => mock${dep.type}.${methodName}(any(), any())).called(1);`
                        );
                    } else if (methodName === 'read' || methodName === 'get') {
                        result.storageSetups.push(
                            `when(() => mock${dep.type}.${methodName}(any())).thenAnswer((_) async => 'test_stored_value');`
                        );
                        result.storageVerifies.push(
                            `verify(() => mock${dep.type}.${methodName}(any())).called(1);`
                        );
                    } else {
                        result.storageSetups.push(
                            `when(() => mock${dep.type}.${methodName}()).thenAnswer((_) async {});`
                        );
                        result.storageVerifies.push(
                            `verify(() => mock${dep.type}.${methodName}()).called(1);`
                        );
                    }
                }
            });
        }
    });console.log(`    Repository setups: ${result.repositorySetups.length}`);
    console.log(`    Repository verifies: ${result.repositoryVerifies.length}`);
    console.log(`    Storage setups: ${result.storageSetups.length}`);
    console.log(`    Storage verifies: ${result.storageVerifies.length}`);

    return result;
}

/**
 * ИНТЕРФЕЙС: Полная информация об обязательном тесте для множественных тестов
 */
interface MandatoryTestInfo {
    id: string;                           // Уникальный ID теста
    eventOrMethodName: string;            // Имя события или метода
    finalState: string;                   // Конечное состояние
    transientStates: string[];            // Сквозные состояния
    expectedStates: string[];             // Все ожидаемые состояния для expect
    methodCall: string;                   // Act блок (вызов метода/события)
    mockSetups: string[];                 // Setup блоки для mock (when блоки)
    mockVerifies: string[];               // Verify блоки для mock
    isSuccessPath: boolean;               // Путь успеха или ошибки
    testName: string;                     // Полное имя теста
}

/**
 * вспомогательный МЕТОД: Создание MandatoryTestInfo из теста
 */
function createMandatoryTestInfo(
    cubitName: string,
    method: MethodInfo,
    finalState: string,
    transientStates: string[],
    dependencies: DependencyInfo[],
    isBloc: boolean,
    testName: string,
    classCode?: string
): MandatoryTestInfo {// Генерируем act блок
    let methodCall: string;
    if (isBloc) {
        const eventParams = getEventParams(method.name);
        methodCall = `cubit.add(const ${method.name}(${eventParams}))`;
    } else {
        const methodParams = getMethodParams(method.name);
        methodCall = `cubit.${method.name}(${methodParams})`;
    }
    
    // Создаем список ожидаемых состояний
    const expectedStates = [...transientStates, finalState];
    
    // Парсим mock вызовы если есть classCode
    let mockSetups: string[] = [];
    let mockVerifies: string[] = [];
    
    if (classCode && dependencies.length > 0) {
        const mockCallsResult = parseMockCallsByTestRoute(
            method.name,
            finalState,
            transientStates,
            classCode,
            dependencies,
            isBloc
        );
        
        mockSetups = [...mockCallsResult.repositorySetups, ...mockCallsResult.storageSetups];
        mockVerifies = [...mockCallsResult.repositoryVerifies, ...mockCallsResult.storageVerifies];}
    
    // Определяем тип пути
    const isSuccessPath = finalState.toLowerCase().includes('success') || 
                         finalState.toLowerCase().includes('loaded') || 
                         finalState.toLowerCase().includes('data');
    
    const testInfo: MandatoryTestInfo = {
        id: `${method.name}_to_${finalState}`,
        eventOrMethodName: method.name,
        finalState,
        transientStates,
        expectedStates,
        methodCall,
        mockSetups,
        mockVerifies,
        isSuccessPath,
        testName
    };
    
    console.log(`  ✓ Создан MandatoryTestInfo: ${testInfo.id}`);
    return testInfo;
}

/**
 * вспомогательный МЕТОД: Комбинирование двух обязательных тестов в множественный
 */
function combineTwoMandatoryTests(
    cubitName: string,
    test1: MandatoryTestInfo,
    test2: MandatoryTestInfo,
    dependencies: DependencyInfo[],
    multipleTestIndex: number
): string {// Создаем уникальный ID для множественного теста
    const multipleTestId = `multiple_test_${multipleTestIndex}_${test1.eventOrMethodName}_${test2.eventOrMethodName}`;
    
    // Объединяем expected states (БЕЗ дедупликации - состояния могут повторяться в разные моменты)
    const combinedExpectedStates = [...test1.expectedStates, ...test2.expectedStates];
    const expectedStatesCode = combinedExpectedStates.map(state => `${state}()`).join(',\n          ');// Объединяем mock setup блоки (убираем дубликаты)
    const combinedMockSetups = [...test1.mockSetups, ...test2.mockSetups];
    const uniqueMockSetups = Array.from(new Set(combinedMockSetups));
    
    // Объединяем mock verify блоки (убираем дубликаты)
    const combinedMockVerifies = [...test1.mockVerifies, ...test2.mockVerifies];
    const uniqueMockVerifies = Array.from(new Set(combinedMockVerifies));// Генерируем combined mock setups для build блока
    let mockSetupsBlock = '';
    if (uniqueMockSetups.length > 0) {
        mockSetupsBlock = `
        // Combined mock setups from both tests
        ${uniqueMockSetups.join('\n        ')}
        `;
    }
    
    // Генерируем combined verify блок
    let verifyBlock = '';
    if (uniqueMockVerifies.length > 0) {
        verifyBlock = `
      verify: (_) {
        ${uniqueMockVerifies.join('\n        ')}
      },`;
    }
    
    // Комбинируем method calls
    const combinedMethodCalls = `${test1.methodCall};\n        ${test2.methodCall};`;
    
    const multipleTest = `
    blocTest<${cubitName}, ${cubitName.replace('Cubit', 'State').replace('Bloc', 'State')}>(
      '${multipleTestId}: последовательность ${test1.eventOrMethodName} -> ${test2.eventOrMethodName}',
      build: () {${mockSetupsBlock}
        return ${camelToSnakeCase(cubitName)};
      },
      act: (cubit) async {
        ${combinedMethodCalls}
      },
      expect: () => [
          ${expectedStatesCode}
      ],${verifyBlock}
    );`;
    
    console.log(`  ✓ Создан множественный тест: ${multipleTestId}`);
    return multipleTest;
}

/**
 * вспомогательный МЕТОД: Генерация множественных тестов из обязательных
 */
function generateMultipleTestsFromMandatory(
    cubitName: string,
    mandatoryTests: MandatoryTestInfo[],
    dependencies: DependencyInfo[],
    maxMultipleTests: number = 5
): string {
    let tests = '';if (mandatoryTests.length < 2) {
        console.log(`✗ Недостаточно обязательных тестов для создания множественных (нужно минимум 2)`);
        return tests;
    }
    
    let multipleTestCount = 0;
    
    // Комбинируем тесты попарно
    for (let i = 0; i < mandatoryTests.length && multipleTestCount < maxMultipleTests; i++) {
        for (let j = i + 1; j < mandatoryTests.length && multipleTestCount < maxMultipleTests; j++) {
            const test1 = mandatoryTests[i];
            const test2 = mandatoryTests[j];
            
            // Проверяем, что тесты для разных событий/методов (избегаем дубликатов)
            if (test1.eventOrMethodName !== test2.eventOrMethodName) {// вспомогательный ПРОВЕРКА: Проверяем валидность комбинированных состояний
                const combinedStates = [...test1.expectedStates, ...test2.expectedStates];
                
                // Проверяем каждый тест отдельно на валидность с помощью простой эвристики
                const hasValidStates = combinedStates.some(state => {
                    const lowerState = state.toLowerCase();
                    return lowerState.includes('success') || 
                           lowerState.includes('error') || 
                           lowerState.includes('enabled') || 
                           lowerState.includes('disabled') || 
                           lowerState.includes('initial') || 
                           lowerState.includes('data') || 
                           lowerState.includes('completed');
                });
                
                if (!hasValidStates) {
                    console.log(`    ✗ Пропускаем неликвидную комбинацию (только сквозные состояния): ${combinedStates.join(' -> ')}`);
                    continue;
                }tests += combineTwoMandatoryTests(
                    cubitName,
                    test1,
                    test2,
                    dependencies,
                    multipleTestCount + 1
                );
                
                multipleTestCount++;
            }
        }
    }
    
    console.log(`\n✓ Сгенерировано множественных тестов: ${multipleTestCount}`);
    return tests;
}

/**
 * вспомогательный ФУНКЦИЯ: Анализ состояний для методов/событий
 * Использует существующий парсер analyzeStates для заполнения информации о сквозных и конечных состояниях
 */
function enrichMethodsWithStateAnalysis(
    methods: MethodInfo[], 
    events: EventInfo[], 
    classCode: string
): { enrichedMethods: MethodInfo[], enrichedEvents: EventInfo[] } {const enrichedMethods: MethodInfo[] = methods.map(method => {// Извлекаем тело метода
        const methodBody = extractMethodBodyFromCode(classCode, method.name);
        if (!methodBody) {
            console.log(`    ✗ Не удалось извлечь тело метода: ${method.name}`);
            return { ...method, transientStates: [], finalStates: [] };
        }
        
        // Используем существующий analyzeStates
        const stateAnalysis = analyzeStates(methodBody, classCode);
        
        // Разделяем на сквозные и конечные
        const transientStates = stateAnalysis
            .filter(s => s.isTransient)
            .map(s => s.name.endsWith('State') ? s.name : s.name + 'State');
            
        const finalStates = stateAnalysis
            .filter(s => s.isFinal)
            .map(s => s.name.endsWith('State') ? s.name : s.name + 'State');console.log(`    • Конечные состояния: ${finalStates.join(', ') || 'нет'}`);
        
        return {
            ...method,
            transientStates,
            finalStates
        };
    });
    
    const enrichedEvents: EventInfo[] = events.map(event => {// Извлекаем тело обработчика
        const handlerBody = extractMethodBodyFromCode(classCode, event.handler);
        if (!handlerBody) {
            console.log(`    ✗ Не удалось извлечь тело обработчика: ${event.handler}`);
            return { ...event, transientStates: [], finalStates: [] };
        }
        
        // Используем существующий analyzeStates
        const stateAnalysis = analyzeStates(handlerBody, classCode);
        
        // Разделяем на сквозные и конечные
        const transientStates = stateAnalysis
            .filter(s => s.isTransient)
            .map(s => s.name.endsWith('State') ? s.name : s.name + 'State');
            
        const finalStates = stateAnalysis
            .filter(s => s.isFinal)
            .map(s => s.name.endsWith('State') ? s.name : s.name + 'State');console.log(`    • Конечные состояния: ${finalStates.join(', ') || 'нет'}`);
        
        return {
            ...event,
            transientStates,
            finalStates
        };
    });
    
    console.log('✓ вспомогательный АНАЛИЗ: Обогащение завершено');
    return { enrichedMethods, enrichedEvents };
}

/**
 * вспомогательный ФУНКЦИЯ: Проверка валидности теста на основе анализа состояний
 * Проверяет, что тест содержит хотя бы одно конечное состояние из метода/события
 */
function isTestValid(
    testStates: string[],
    methodOrEventName: string,
    enrichedMethods: MethodInfo[],
    enrichedEvents: EventInfo[]
): boolean {// Ищем метод или событие в обогащенных данных
    let finalStatesFromAnalysis: string[] = [];
    
    // Сначала ищем в методах
    const method = enrichedMethods.find(m => m.name === methodOrEventName);
    if (method && method.finalStates) {
        finalStatesFromAnalysis = method.finalStates;}
    
    // Если не нашли в методах, ищем в событиях
    if (finalStatesFromAnalysis.length === 0) {
        const event = enrichedEvents.find(e => e.name === methodOrEventName);
        if (event && event.finalStates) {
            finalStatesFromAnalysis = event.finalStates;}
    }
    
    // Если у метода/события нет конечных состояний - считаем тест неликвидным
    if (finalStatesFromAnalysis.length === 0) {
        console.log(`  ✗ У ${methodOrEventName} нет конечных состояний - тест неликвидный`);
        return false;
    }
    
    // Проверяем, есть ли пересечение между состояниями теста и конечными состояниями метода/события
    const hasIntersection = testStates.some(testState => 
        finalStatesFromAnalysis.some(finalState => 
            testState === finalState || testState.includes(finalState) || finalState.includes(testState)
        )
    );
    
    if (hasIntersection) {
        console.log(`  ✓ Тест валидный - найдено пересечение с конечными состояниями`);
        return true;
    } else {
        console.log(`  ✗ Тест неликвидный - нет пересечения с конечными состояниями`);
        return false;
    }
}
