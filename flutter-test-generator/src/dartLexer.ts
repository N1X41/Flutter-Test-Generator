// ===== ЛЕКСЕР И ПАРСЕР ДЛЯ DART КОДА =====
// Является подстраховкой для реализованной регулярки в виде полноценного лексера с грамматикой

/// Лексер для токенизации Dart кода
/// Принимает: - code - исходный код для анализа
interface Token {
    type: TokenType;
    value: string;
    position: number;
    line: number;
    column: number;
}

enum TokenType {
    // Ключевые слова
    CLASS = 'CLASS',
    FUNCTION = 'FUNCTION', 
    ASYNC = 'ASYNC',
    AWAIT = 'AWAIT',
    IF = 'IF',
    ELSE = 'ELSE',
    TRY = 'TRY',
    CATCH = 'CATCH',
    FINALLY = 'FINALLY',
    SWITCH = 'SWITCH',
    CASE = 'CASE',
    DEFAULT = 'DEFAULT',
    BREAK = 'BREAK',
    RETURN = 'RETURN',
    EMIT = 'EMIT',
    ON = 'ON',
    FINAL = 'FINAL',
    CONST = 'CONST',
    VOID = 'VOID',
    FUTURE = 'FUTURE',
    EXTENDS = 'EXTENDS',
    IMPLEMENTS = 'IMPLEMENTS',
    IS = 'IS',
    
    // Типы данных и идентификаторы
    IDENTIFIER = 'IDENTIFIER',
    TYPE = 'TYPE',
    STRING = 'STRING',
    NUMBER = 'NUMBER',
    
    // Операторы и символы
    ASSIGN = 'ASSIGN',          // =
    DOT = 'DOT',               // .
    COMMA = 'COMMA',           // ,
    SEMICOLON = 'SEMICOLON',   // ;
    ARROW = 'ARROW',           // =>
    
    // Скобки
    LPAREN = 'LPAREN',         // (
    RPAREN = 'RPAREN',         // )
    LBRACE = 'LBRACE',         // {
    RBRACE = 'RBRACE',         // }
    LBRACKET = 'LBRACKET',     // [
    RBRACKET = 'RBRACKET',     // ]
    LT = 'LT',                 // <
    GT = 'GT',                 // >
    
    // Специальные
    WHITESPACE = 'WHITESPACE',
    NEWLINE = 'NEWLINE',
    COMMENT = 'COMMENT',
    EOF = 'EOF',
    UNKNOWN = 'UNKNOWN'
}

/// Лексер для разбора Dart кода на токены
/// Принимает: - code - исходный код для токенизации
export class DartLexer {
    private code: string;
    private position: number;
    private line: number;
    private column: number;
    private tokens: Token[];

    // Ключевые слова Dart
    private keywords = new Map([
        ['class', TokenType.CLASS],
        ['async', TokenType.ASYNC],
        ['await', TokenType.AWAIT],
        ['if', TokenType.IF],
        ['else', TokenType.ELSE],
        ['try', TokenType.TRY],
        ['catch', TokenType.CATCH],
        ['finally', TokenType.FINALLY],
        ['switch', TokenType.SWITCH],
        ['case', TokenType.CASE],
        ['default', TokenType.DEFAULT],
        ['break', TokenType.BREAK],
        ['return', TokenType.RETURN],
        ['emit', TokenType.EMIT],
        ['on', TokenType.ON],
        ['final', TokenType.FINAL],
        ['const', TokenType.CONST],
        ['void', TokenType.VOID],
        ['Future', TokenType.FUTURE],
        ['extends', TokenType.EXTENDS],
        ['implements', TokenType.IMPLEMENTS],
        ['is', TokenType.IS]
    ]);

    constructor(code: string) {
        this.code = code;
        this.position = 0;
        this.line = 1;
        this.column = 1;
        this.tokens = [];
    }

    /// Основная функция токенизации
    /// Принимает: нет параметров, работает с внутренним состоянием
    public tokenize(): Token[] {
        while (this.position < this.code.length) {
            this.skipWhitespace();
            
            if (this.position >= this.code.length) {
                break;
            }

            const char = this.currentChar();
            
            if (this.isLetter(char) || char === '_') {
                this.readIdentifierOrKeyword();
            } else if (this.isDigit(char)) {
                this.readNumber();
            } else if (char === '"' || char === "'") {
                this.readString();
            } else if (char === '/' && this.peekChar() === '/') {
                this.readSingleLineComment();
            } else if (char === '/' && this.peekChar() === '*') {
                this.readMultiLineComment();
            } else {
                this.readSymbol();
            }
        }

        this.addToken(TokenType.EOF, '');
        return this.tokens;
    }

    /// Получение текущего символа
    /// Принимает: нет параметров
    private currentChar(): string {
        return this.code[this.position];
    }

    /// Просмотр следующего символа без перемещения позиции
    /// Принимает: нет параметров
    private peekChar(): string {
        return this.position + 1 < this.code.length ? this.code[this.position + 1] : '';
    }

    /// Перемещение на следующий символ
    /// Принимает: нет параметров
    private advance(): void {
        if (this.currentChar() === '\n') {
            this.line++;
            this.column = 1;
        } else {
            this.column++;
        }
        this.position++;
    }

    /// Проверка является ли символ буквой
    /// Принимает: - char - символ для проверки
    private isLetter(char: string): boolean {
        return /[a-zA-Z]/.test(char);
    }

    /// Проверка является ли символ цифрой
    /// Принимает: - char - символ для проверки
    private isDigit(char: string): boolean {
        return /[0-9]/.test(char);
    }

    /// Проверка является ли символ буквенно-цифровым или подчеркиванием
    /// Принимает: - char - символ для проверки
    private isAlphaNumeric(char: string): boolean {
        return this.isLetter(char) || this.isDigit(char) || char === '_';
    }

    /// Пропуск пробельных символов
    /// Принимает: нет параметров
    private skipWhitespace(): void {
        while (this.position < this.code.length && 
               /\s/.test(this.currentChar()) && 
               this.currentChar() !== '\n') {
            this.advance();
        }
    }

    /// Чтение идентификатора или ключевого слова
    /// Принимает: нет параметров
    private readIdentifierOrKeyword(): void {
        const startPos = this.position;
        let value = '';

        while (this.position < this.code.length && 
               this.isAlphaNumeric(this.currentChar())) {
            value += this.currentChar();
            this.advance();
        }

        const tokenType = this.keywords.get(value) || TokenType.IDENTIFIER;
        this.addToken(tokenType, value);
    }

    /// Чтение числового литерала
    /// Принимает: нет параметров
    private readNumber(): void {
        let value = '';

        while (this.position < this.code.length && 
               (this.isDigit(this.currentChar()) || this.currentChar() === '.')) {
            value += this.currentChar();
            this.advance();
        }

        this.addToken(TokenType.NUMBER, value);
    }

    /// Чтение строкового литерала
    /// Принимает: нет параметров
    private readString(): void {
        const quote = this.currentChar();
        let value = quote;
        this.advance();

        while (this.position < this.code.length && 
               this.currentChar() !== quote) {
            if (this.currentChar() === '\\') {
                value += this.currentChar();
                this.advance();
                if (this.position < this.code.length) {
                    value += this.currentChar();
                    this.advance();
                }
            } else {
                value += this.currentChar();
                this.advance();
            }
        }

        if (this.position < this.code.length) {
            value += this.currentChar();
            this.advance();
        }

        this.addToken(TokenType.STRING, value);
    }

    /// Чтение однострочного комментария
    /// Принимает: нет параметров
    private readSingleLineComment(): void {
        let value = '';

        while (this.position < this.code.length && 
               this.currentChar() !== '\n') {
            value += this.currentChar();
            this.advance();
        }

        this.addToken(TokenType.COMMENT, value);
    }

    /// Чтение многострочного комментария
    /// Принимает: нет параметров
    private readMultiLineComment(): void {
        let value = '';

        while (this.position < this.code.length - 1) {
            value += this.currentChar();
            if (this.currentChar() === '*' && this.peekChar() === '/') {
                this.advance();
                value += this.currentChar();
                this.advance();
                break;
            }
            this.advance();
        }

        this.addToken(TokenType.COMMENT, value);
    }

    /// Чтение символьных операторов
    /// Принимает: нет параметров
    private readSymbol(): void {
        const char = this.currentChar();

        switch (char) {
            case '(':
                this.addToken(TokenType.LPAREN, char);
                this.advance();
                break;
            case ')':
                this.addToken(TokenType.RPAREN, char);
                this.advance();
                break;
            case '{':
                this.addToken(TokenType.LBRACE, char);
                this.advance();
                break;
            case '}':
                this.addToken(TokenType.RBRACE, char);
                this.advance();
                break;
            case '[':
                this.addToken(TokenType.LBRACKET, char);
                this.advance();
                break;
            case ']':
                this.addToken(TokenType.RBRACKET, char);
                this.advance();
                break;
            case '<':
                this.addToken(TokenType.LT, char);
                this.advance();
                break;
            case '>':
                this.addToken(TokenType.GT, char);
                this.advance();
                break;
            case '.':
                this.addToken(TokenType.DOT, char);
                this.advance();
                break;
            case ',':
                this.addToken(TokenType.COMMA, char);
                this.advance();
                break;
            case ';':
                this.addToken(TokenType.SEMICOLON, char);
                this.advance();
                break;
            case '=':
                if (this.peekChar() === '>') {
                    this.addToken(TokenType.ARROW, '=>');
                    this.advance();
                    this.advance();
                } else {
                    this.addToken(TokenType.ASSIGN, char);
                    this.advance();
                }
                break;
            case '\n':
                this.addToken(TokenType.NEWLINE, char);
                this.advance();
                break;
            default:
                this.addToken(TokenType.UNKNOWN, char);
                this.advance();
                break;
        }
    }

    /// Добавление токена в список
    /// Принимает: - type - тип токена, - value - значение токена
    private addToken(type: TokenType, value: string): void {
        this.tokens.push({
            type,
            value,
            position: this.position,
            line: this.line,
            column: this.column
        });
    }
}

// ===== AST УЗЛЫ ДЛЯ ПАРСЕРА =====

/// Базовый класс для всех AST узлов
/// Принимает: - type - тип узла
export abstract class ASTNode {
    public type: string;
    
    constructor(type: string) {
        this.type = type;
    }
}

/// Узел класса
/// Принимает: - name - имя класса, - extendsClass - родительский класс, - body - тело класса
export class ClassNode extends ASTNode {
    public name: string;
    public extendsClass?: string;
    public body: ASTNode[];
    
    constructor(name: string, extendsClass?: string, body: ASTNode[] = []) {
        super('class');
        this.name = name;
        this.extendsClass = extendsClass;
        this.body = body;
    }
}

/// Узел метода
/// Принимает: - name - имя метода, - returnType - тип возврата, - isAsync - асинхронный ли, - parameters - параметры, - body - тело метода
export class MethodNode extends ASTNode {
    public name: string;
    public returnType: string;
    public isAsync: boolean;
    public parameters: string[];
    public body: ASTNode[];
    
    constructor(name: string, returnType: string, isAsync: boolean = false, parameters: string[] = [], body: ASTNode[] = []) {
        super('method');
        this.name = name;
        this.returnType = returnType;
        this.isAsync = isAsync;
        this.parameters = parameters;
        this.body = body;
    }
}

/// Узел события (для Bloc)
/// Принимает: - eventType - тип события, - handler - обработчик
export class EventHandlerNode extends ASTNode {
    public eventType: string;
    public handler: string;
    
    constructor(eventType: string, handler: string) {
        super('eventHandler');
        this.eventType = eventType;
        this.handler = handler;
    }
}

/// Узел вызова метода emit
/// Принимает: - stateName - имя состояния, - parameters - параметры
export class EmitNode extends ASTNode {
    public stateName: string;
    public parameters: string[];
    
    constructor(stateName: string, parameters: string[] = []) {
        super('emit');
        this.stateName = stateName;
        this.parameters = parameters;
    }
}

/// Узел условного блока (if/else)
/// Принимает: - condition - условие, - thenBody - тело then, - elseBody - тело else
export class ConditionalNode extends ASTNode {
    public condition: string;
    public thenBody: ASTNode[];
    public elseBody: ASTNode[];
    
    constructor(condition: string, thenBody: ASTNode[] = [], elseBody: ASTNode[] = []) {
        super('conditional');
        this.condition = condition;
        this.thenBody = thenBody;
        this.elseBody = elseBody;
    }
}

/// Узел блока try-catch
/// Принимает: - tryBody - тело try, - catchBody - тело catch, - finallyBody - тело finally
export class TryCatchNode extends ASTNode {
    public tryBody: ASTNode[];
    public catchBody: ASTNode[];
    public finallyBody: ASTNode[];
    
    constructor(tryBody: ASTNode[] = [], catchBody: ASTNode[] = [], finallyBody: ASTNode[] = []) {
        super('tryCatch');
        this.tryBody = tryBody;
        this.catchBody = catchBody;
        this.finallyBody = finallyBody;
    }
}

/// Узел зависимости (final поле)
/// Принимает: - name - имя переменной, - type - тип зависимости
export class DependencyNode extends ASTNode {
    public name: string;
    public type: string;
    
    constructor(name: string, type: string) {
        super('dependency');
        this.name = name;
        this.type = type;
    }
}

// ===== ПАРСЕР DART КОДА =====

/// Парсер для создания AST из токенов
/// Принимает: - tokens - массив токенов для парсинга
export class DartParser {
    private tokens: Token[];
    private position: number;

    constructor(tokens: Token[]) {
        this.tokens = tokens;
        this.position = 0;
    }

    /// Парсинг класса Cubit/Bloc
    /// Принимает: нет параметров
    public parseClass(): ClassNode | null {
        const classToken = this.findToken(TokenType.CLASS);
        if (!classToken) return null;

        const nameToken = this.peekToken(1);
        if (!nameToken || nameToken.type !== TokenType.IDENTIFIER) return null;

        const className = nameToken.value;
        let extendsClass: string | undefined;

        // Проверяем наличие extends
        const extendsToken = this.findToken(TokenType.EXTENDS);
        if (extendsToken) {
            const parentToken = this.peekToken(1, this.findTokenPosition(extendsToken));
            if (parentToken) {
                extendsClass = parentToken.value;
            }
        }

        const body = this.parseClassBody();
        return new ClassNode(className, extendsClass, body);
    }

    /// Парсинг тела класса
    /// Принимает: нет параметров
    private parseClassBody(): ASTNode[] {
        const body: ASTNode[] = [];
        
        // Ищем все методы, зависимости и обработчики событий
        body.push(...this.parseDependencies());
        body.push(...this.parseEventHandlers());
        body.push(...this.parseMethods());
        
        return body;
    }

    /// Парсинг зависимостей (final поля)
    /// Принимает: нет параметров
    private parseDependencies(): DependencyNode[] {
        const dependencies: DependencyNode[] = [];
        
        for (let i = 0; i < this.tokens.length - 2; i++) {
            const token = this.tokens[i];
            if (token.type === TokenType.FINAL) {
                const typeToken = this.tokens[i + 1];
                const nameToken = this.tokens[i + 2];
                
                if (typeToken.type === TokenType.IDENTIFIER && 
                    nameToken.type === TokenType.IDENTIFIER &&
                    nameToken.value.startsWith('_')) {
                    
                    dependencies.push(new DependencyNode(
                        nameToken.value.substring(1), // Убираем _
                        typeToken.value
                    ));
                }
            }
        }
        
        return dependencies;
    }

    /// Парсинг обработчиков событий (для Bloc)
    /// Принимает: нет параметров
    private parseEventHandlers(): EventHandlerNode[] {
        const handlers: EventHandlerNode[] = [];
        
        for (let i = 0; i < this.tokens.length - 5; i++) {
            const token = this.tokens[i];
            if (token.type === TokenType.ON && 
                this.tokens[i + 1].type === TokenType.LT) {
                
                const eventTypeToken = this.tokens[i + 2];
                if (eventTypeToken.type === TokenType.IDENTIFIER) {
                    // Ищем обработчик в скобках
                    let handlerName = '';
                    for (let j = i + 3; j < this.tokens.length; j++) {
                        if (this.tokens[j].type === TokenType.LPAREN) {
                            const handlerToken = this.tokens[j + 1];
                            if (handlerToken.type === TokenType.IDENTIFIER) {
                                handlerName = handlerToken.value;
                                break;
                            }
                        }
                    }
                    
                    if (handlerName) {
                        handlers.push(new EventHandlerNode(
                            eventTypeToken.value,
                            handlerName
                        ));
                    }
                }
            }
        }
        
        return handlers;
    }

    /// Парсинг методов класса
    /// Принимает: нет параметров
    private parseMethods(): MethodNode[] {
        const methods: MethodNode[] = [];
        
        for (let i = 0; i < this.tokens.length - 3; i++) {
            const token = this.tokens[i];
            
            // Ищем типы возврата методов
            if ((token.type === TokenType.VOID || 
                 token.type === TokenType.FUTURE ||
                 token.value === 'String' || 
                 token.value === 'int' ||
                 token.value === 'bool') &&
                this.tokens[i + 1].type === TokenType.IDENTIFIER) {
                
                const methodName = this.tokens[i + 1].value;
                const returnType = token.value;
                
                // Проверяем что это не конструктор или геттер
                if (!methodName.startsWith('_') || methodName.startsWith('_on')) {
                    const isAsync = this.checkAsyncMethod(i);
                    const methodBody = this.parseMethodBody(methodName);
                    
                    methods.push(new MethodNode(
                        methodName,
                        returnType,
                        isAsync,
                        [], // параметры пока не парсим детально
                        methodBody
                    ));
                }
            }
        }
        
        return methods;
    }

    /// Парсинг тела метода
    /// Принимает: - methodName - имя метода
    private parseMethodBody(methodName: string): ASTNode[] {
        const body: ASTNode[] = [];
        
        // Ищем emit вызовы
        body.push(...this.parseEmitCalls());
        
        // Ищем условные блоки
        body.push(...this.parseConditionalBlocks());
        
        // Ищем try-catch блоки
        body.push(...this.parseTryCatchBlocks());
        
        return body;
    }

    /// Парсинг вызовов emit
    /// Принимает: нет параметров
    private parseEmitCalls(): EmitNode[] {
        const emits: EmitNode[] = [];
        
        for (let i = 0; i < this.tokens.length - 3; i++) {
            const token = this.tokens[i];
            if (token.type === TokenType.EMIT &&
                this.tokens[i + 1].type === TokenType.LPAREN) {
                
                // Ищем состояние в скобках
                for (let j = i + 2; j < this.tokens.length; j++) {
                    const stateToken = this.tokens[j];
                    if (stateToken.type === TokenType.IDENTIFIER &&
                        stateToken.value.endsWith('State')) {
                        
                        emits.push(new EmitNode(stateToken.value));
                        break;
                    }
                    
                    if (this.tokens[j].type === TokenType.RPAREN) {
                        break;
                    }
                }
            }
        }
        
        return emits;
    }

    /// Парсинг условных блоков
    /// Принимает: нет параметров
    private parseConditionalBlocks(): ConditionalNode[] {
        const conditionals: ConditionalNode[] = [];
        
        for (let i = 0; i < this.tokens.length - 2; i++) {
            const token = this.tokens[i];
            if (token.type === TokenType.IF) {
                const condition = this.extractCondition(i);
                const thenBody = this.extractBlockBody(i, 'if');
                const elseBody = this.extractElseBody(i);
                
                conditionals.push(new ConditionalNode(condition, thenBody, elseBody));
            }
        }
        
        return conditionals;
    }

    /// Парсинг try-catch блоков
    /// Принимает: нет параметров
    private parseTryCatchBlocks(): TryCatchNode[] {
        const tryCatchBlocks: TryCatchNode[] = [];
        
        for (let i = 0; i < this.tokens.length - 1; i++) {
            const token = this.tokens[i];
            if (token.type === TokenType.TRY) {
                const tryBody = this.extractBlockBody(i, 'try');
                const catchBody = this.extractBlockBody(i, 'catch');
                const finallyBody = this.extractBlockBody(i, 'finally');
                
                tryCatchBlocks.push(new TryCatchNode(tryBody, catchBody, finallyBody));
            }
        }
        
        return tryCatchBlocks;
    }

    // ===== ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ =====

    /// Поиск токена по типу
    /// Принимает: - type - тип токена для поиска
    private findToken(type: TokenType): Token | null {
        return this.tokens.find(token => token.type === type) || null;
    }

    /// Поиск позиции токена
    /// Принимает: - token - токен для поиска позиции
    private findTokenPosition(token: Token): number {
        return this.tokens.indexOf(token);
    }

    /// Просмотр токена со смещением
    /// Принимает: - offset - смещение, - startFrom - начальная позиция
    private peekToken(offset: number, startFrom: number = this.position): Token | null {
        const pos = startFrom + offset;
        return pos < this.tokens.length ? this.tokens[pos] : null;
    }

    /// Проверка является ли метод асинхронным
    /// Принимает: - position - позиция в массиве токенов
    private checkAsyncMethod(position: number): boolean {
        for (let i = position; i < Math.min(position + 10, this.tokens.length); i++) {
            if (this.tokens[i].type === TokenType.ASYNC) {
                return true;
            }
            if (this.tokens[i].type === TokenType.LBRACE || 
                this.tokens[i].type === TokenType.ARROW) {
                break;
            }
        }
        return false;
    }

    /// Извлечение условия из if блока
    /// Принимает: - position - позиция if токена
    private extractCondition(position: number): string {
        let condition = '';
        let parenCount = 0;
        let started = false;
        
        for (let i = position + 1; i < this.tokens.length; i++) {
            const token = this.tokens[i];
            
            if (token.type === TokenType.LPAREN) {
                parenCount++;
                started = true;
            } else if (token.type === TokenType.RPAREN) {
                parenCount--;
                if (parenCount === 0 && started) {
                    break;
                }
            }
            
            if (started && parenCount > 0) {
                condition += token.value + ' ';
            }
        }
        
        return condition.trim();
    }

    /// Извлечение тела блока
    /// Принимает: - position - позиция начального токена, - blockType - тип блока
    private extractBlockBody(position: number, blockType: string): ASTNode[] {
        // Упрощенная реализация - возвращаем пустой массив
        // В полной реализации здесь был бы рекурсивный парсинг
        return [];
    }

    /// Извлечение тела else блока
    /// Принимает: - position - позиция if токена
    private extractElseBody(position: number): ASTNode[] {
        // Упрощенная реализация - возвращаем пустой массив
        return [];
    }
}

// ===== ЭКСПОРТИРУЕМЫЕ ФУНКЦИИ ДЛЯ ЗАМЕНЫ РЕГУЛЯРОК =====

/// Парсинг класса через лексер (подстраховка для parseCubitOrBloc)
/// Принимает: - classCode - код класса для анализа
export function parseClassWithLexer(classCode: string): {
    events: { name: string; handler: string }[];
    dependencies: { name: string; type: string }[];
    className: string;
    extendsClass?: string;
} {
    const lexer = new DartLexer(classCode);
    const tokens = lexer.tokenize();
    const parser = new DartParser(tokens);
    const classNode = parser.parseClass();
    
    if (!classNode) {
        return { events: [], dependencies: [], className: '', extendsClass: undefined };
    }
    
    const events: { name: string; handler: string }[] = [];
    const dependencies: { name: string; type: string }[] = [];
    
    for (const node of classNode.body) {
        if (node instanceof EventHandlerNode) {
            events.push({ name: node.eventType, handler: node.handler });
        } else if (node instanceof DependencyNode) {
            dependencies.push({ name: node.name, type: node.type });
        }
    }
    
    return {
        events,
        dependencies,
        className: classNode.name,
        extendsClass: classNode.extendsClass
    };
}

/// Парсинг состояний через лексер (подстраховка для parseInlineStates)
/// Принимает: - classCode - код с определениями состояний
export function parseStatesWithLexer(classCode: string): {
    name: string;
    isInitial: boolean;
    isError: boolean;
    isLoading: boolean;
    isSuccess: boolean;
}[] {
    const lexer = new DartLexer(classCode);
    const tokens = lexer.tokenize();
    const states: {
        name: string;
        isInitial: boolean;
        isError: boolean;
        isLoading: boolean;
        isSuccess: boolean;
    }[] = [];
    
    // Ищем объявления классов состояний
    for (let i = 0; i < tokens.length - 2; i++) {
        const token = tokens[i];
        if (token.type === TokenType.CLASS) {
            const nameToken = tokens[i + 1];
            if (nameToken.type === TokenType.IDENTIFIER && 
                nameToken.value.endsWith('State')) {
                
                const stateName = nameToken.value;
                states.push({
                    name: stateName,
                    isInitial: stateName.toLowerCase().includes('initial'),
                    isError: stateName.toLowerCase().includes('error'),
                    isLoading: stateName.toLowerCase().includes('loading') || 
                              stateName.toLowerCase().includes('waiting'),
                    isSuccess: stateName.toLowerCase().includes('success')
                });
            }
        }
    }
    
    return states;
}

/// Парсинг методов через лексер (подстраховка для parseEnhancedMethods)
/// Принимает: - classCode - код класса, - isBloc - является ли блоком
export function parseMethodsWithLexer(classCode: string, isBloc: boolean): {
    name: string;
    type: 'event' | 'method';
    returnType: string;
    isAsync: boolean;
    emitCalls: string[];
}[] {
    const lexer = new DartLexer(classCode);
    const tokens = lexer.tokenize();
    const parser = new DartParser(tokens);
    const classNode = parser.parseClass();
    
    if (!classNode) {
        return [];
    }
    
    const methods: {
        name: string;
        type: 'event' | 'method';
        returnType: string;
        isAsync: boolean;
        emitCalls: string[];
    }[] = [];
    
    // Извлекаем методы из AST
    for (const node of classNode.body) {
        if (node instanceof MethodNode) {
            const emitCalls: string[] = [];
            
            // Извлекаем emit вызовы из тела метода
            for (const bodyNode of node.body) {
                if (bodyNode instanceof EmitNode) {
                    emitCalls.push(bodyNode.stateName);
                }
            }
            
            methods.push({
                name: node.name,
                type: node.name.startsWith('_on') ? 'event' : 'method',
                returnType: node.returnType,
                isAsync: node.isAsync,
                emitCalls
            });
        }
    }
    
    return methods;
}

/// Извлечение тела метода через лексер (подстраховка для extractMethodBodyFromCode)
/// Принимает: - classCode - код класса, - methodName - имя метода
export function extractMethodBodyWithLexer(classCode: string, methodName: string): string | null {
    const lexer = new DartLexer(classCode);
    const tokens = lexer.tokenize();
    
    // Ищем начало метода
    for (let i = 0; i < tokens.length - 3; i++) {
        const token = tokens[i];
        if (token.type === TokenType.IDENTIFIER && token.value === methodName &&
            i > 0 && (tokens[i - 1].type === TokenType.VOID || 
                      tokens[i - 1].type === TokenType.FUTURE ||
                      tokens[i - 1].value === 'String')) {
            
            // Ищем открывающую скобку
            for (let j = i + 1; j < tokens.length; j++) {
                if (tokens[j].type === TokenType.LBRACE) {
                    // Извлекаем тело метода до закрывающей скобки
                    let braceCount = 1;
                    let body = '';
                    
                    for (let k = j + 1; k < tokens.length && braceCount > 0; k++) {
                        const bodyToken = tokens[k];
                        if (bodyToken.type === TokenType.LBRACE) {
                            braceCount++;
                        } else if (bodyToken.type === TokenType.RBRACE) {
                            braceCount--;
                            if (braceCount === 0) break;
                        }
                        
                        body += bodyToken.value;
                        if (bodyToken.type === TokenType.NEWLINE || 
                            bodyToken.type === TokenType.SEMICOLON) {
                            body += ' ';
                        }
                    }
                    
                    return body.trim();
                }
            }
        }
    }
    
    return null;
}

/// Парсинг методов кубитов через лексер
/// Принимает: - classCode - код класса
export function parseCubitMethodsWithLexer(classCode: string): {
    name: string;
    returnType: string;
    isAsync: boolean;
    isArrowFunction: boolean;
    body: string;
}[] {
    const lexer = new DartLexer(classCode);
    const tokens = lexer.tokenize();
    const methods: {
        name: string;
        returnType: string;
        isAsync: boolean;
        isArrowFunction: boolean;
        body: string;
    }[] = [];
    
    for (let i = 0; i < tokens.length - 3; i++) {
        const token = tokens[i];
        
        // Ищем типы возврата методов (void, Future, String, int, bool)
        if ((token.type === TokenType.VOID || 
             token.type === TokenType.FUTURE ||
             token.value === 'String' || 
             token.value === 'int' ||
             token.value === 'bool') &&
            tokens[i + 1].type === TokenType.IDENTIFIER) {
            
            const methodName = tokens[i + 1].value;
            const returnType = token.value;
            
            // Фильтруем методы
            if (methodName.startsWith('_') || 
                methodName === 'super' || 
                methodName.includes('Cubit') ||
                methodName.includes('Bloc')) {
                continue;
            }
            
            // Ищем параметры и тело метода
            let paramStartIndex = -1;
            let isAsync = false;
            let isArrowFunction = false;
            let bodyStartIndex = -1;
            
            // Находим открывающую скобку параметров
            for (let j = i + 2; j < tokens.length; j++) {
                if (tokens[j].type === TokenType.LPAREN) {
                    paramStartIndex = j;
                    break;
                }
            }
            
            if (paramStartIndex === -1) continue;
            
            // Ищем закрывающую скобку параметров и дальше
            let paramEndIndex = -1;
            let parenCount = 1;
            for (let j = paramStartIndex + 1; j < tokens.length; j++) {
                if (tokens[j].type === TokenType.LPAREN) {
                    parenCount++;
                } else if (tokens[j].type === TokenType.RPAREN) {
                    parenCount--;
                    if (parenCount === 0) {
                        paramEndIndex = j;
                        break;
                    }
                }
            }
            
            if (paramEndIndex === -1) continue;
            
            // Проверяем async и стрелочную функцию
            for (let j = paramEndIndex + 1; j < Math.min(paramEndIndex + 5, tokens.length); j++) {
                if (tokens[j].type === TokenType.ASYNC) {
                    isAsync = true;
                } else if (tokens[j].type === TokenType.ARROW) {
                    isArrowFunction = true;
                    bodyStartIndex = j + 1;
                    break;
                } else if (tokens[j].type === TokenType.LBRACE) {
                    bodyStartIndex = j;
                    break;
                }
            }
            
            if (bodyStartIndex === -1) continue;
            
            // Извлекаем тело метода
            let body = '';
            if (isArrowFunction) {
                // Для стрелочных функций - до точки с запятой
                for (let j = bodyStartIndex; j < tokens.length; j++) {
                    if (tokens[j].type === TokenType.SEMICOLON) {
                        break;
                    }
                    body += tokens[j].value + ' ';
                }
            } else {
                // Для обычных методов - до закрывающей скобки
                let braceCount = 1;
                for (let j = bodyStartIndex + 1; j < tokens.length && braceCount > 0; j++) {
                    if (tokens[j].type === TokenType.LBRACE) {
                        braceCount++;
                    } else if (tokens[j].type === TokenType.RBRACE) {
                        braceCount--;
                        if (braceCount === 0) break;
                    }
                    
                    body += tokens[j].value;
                    if (tokens[j].type === TokenType.NEWLINE || 
                        tokens[j].type === TokenType.SEMICOLON) {
                        body += ' ';
                    }
                }
            }
            
            methods.push({
                name: methodName,
                returnType: returnType,
                isAsync: isAsync,
                isArrowFunction: isArrowFunction,
                body: body.trim()
            });
        }
    }
    
    return methods;
} 