"use strict";
// ===== ЛЕКСЕР И ПАРСЕР ДЛЯ DART КОДА =====
// Основной лексер для анализа Dart кода с полноценной грамматикой
Object.defineProperty(exports, "__esModule", { value: true });
exports.debugParseImports = exports.parseImportsWithLexer = exports.parseCubitMethodsWithLexer = exports.parseAllMethodsWithLexer = exports.extractMethodBodyWithLexer = exports.parseMethodsWithLexer = exports.parseStatesWithLexer = exports.parseClassWithLexer = exports.DartParser = exports.DependencyNode = exports.TryCatchNode = exports.ConditionalNode = exports.EmitNode = exports.EventHandlerNode = exports.MethodNode = exports.ClassNode = exports.ASTNode = exports.DartLexer = void 0;
/**
 * Перечисление типов токенов для Dart лексера
 */
var TokenType;
(function (TokenType) {
    // Ключевые слова
    TokenType["CLASS"] = "CLASS";
    TokenType["IMPORT"] = "IMPORT";
    TokenType["FUNCTION"] = "FUNCTION";
    TokenType["ASYNC"] = "ASYNC";
    TokenType["AWAIT"] = "AWAIT";
    TokenType["IF"] = "IF";
    TokenType["ELSE"] = "ELSE";
    TokenType["TRY"] = "TRY";
    TokenType["CATCH"] = "CATCH";
    TokenType["FINALLY"] = "FINALLY";
    TokenType["SWITCH"] = "SWITCH";
    TokenType["CASE"] = "CASE";
    TokenType["DEFAULT"] = "DEFAULT";
    TokenType["BREAK"] = "BREAK";
    TokenType["RETURN"] = "RETURN";
    TokenType["EMIT"] = "EMIT";
    TokenType["ON"] = "ON";
    TokenType["FINAL"] = "FINAL";
    TokenType["CONST"] = "CONST";
    TokenType["VOID"] = "VOID";
    TokenType["FUTURE"] = "FUTURE";
    TokenType["EXTENDS"] = "EXTENDS";
    TokenType["IMPLEMENTS"] = "IMPLEMENTS";
    TokenType["IS"] = "IS";
    // Типы данных и идентификаторы
    TokenType["IDENTIFIER"] = "IDENTIFIER";
    TokenType["TYPE"] = "TYPE";
    TokenType["STRING"] = "STRING";
    TokenType["NUMBER"] = "NUMBER";
    TokenType["BOOLEAN"] = "BOOLEAN";
    TokenType["CHAR"] = "CHAR";
    TokenType["FLOAT"] = "FLOAT";
    TokenType["DOUBLE"] = "DOUBLE";
    // Операторы и символы
    TokenType["ASSIGN"] = "ASSIGN";
    TokenType["EQUALS"] = "EQUALS";
    TokenType["NOT_EQUALS"] = "NOT_EQUALS";
    TokenType["LT_EQUALS"] = "LT_EQUALS";
    TokenType["GT_EQUALS"] = "GT_EQUALS";
    TokenType["DOT"] = "DOT";
    TokenType["COMMA"] = "COMMA";
    TokenType["SEMICOLON"] = "SEMICOLON";
    TokenType["ARROW"] = "ARROW";
    // Скобки
    TokenType["LPAREN"] = "LPAREN";
    TokenType["RPAREN"] = "RPAREN";
    TokenType["LBRACE"] = "LBRACE";
    TokenType["RBRACE"] = "RBRACE";
    TokenType["LBRACKET"] = "LBRACKET";
    TokenType["RBRACKET"] = "RBRACKET";
    TokenType["LT"] = "LT";
    TokenType["GT"] = "GT";
    // Специальные
    TokenType["WHITESPACE"] = "WHITESPACE";
    TokenType["NEWLINE"] = "NEWLINE";
    TokenType["COMMENT"] = "COMMENT";
    TokenType["EOF"] = "EOF";
    TokenType["UNKNOWN"] = "UNKNOWN";
})(TokenType || (TokenType = {}));
/**
 * Лексер для разбора Dart кода на токены
 * @param code - исходный код для токенизации
 */
class DartLexer {
    constructor(code) {
        // Ключевые слова Dart
        this.keywords = new Map([
            ['class', TokenType.CLASS],
            ['import', TokenType.IMPORT],
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
            ['is', TokenType.IS],
            // Дополнительные типы данных
            ['bool', TokenType.BOOLEAN],
            ['char', TokenType.CHAR],
            ['float', TokenType.FLOAT],
            ['double', TokenType.DOUBLE],
            ['String', TokenType.TYPE],
            ['int', TokenType.TYPE]
        ]);
        this.code = code;
        this.position = 0;
        this.line = 1;
        this.column = 1;
        this.tokens = [];
    }
    /**
     * Основная функция токенизации
     * @returns массив токенов
     */
    tokenize() {
        while (this.position < this.code.length) {
            this.skipWhitespace();
            if (this.position >= this.code.length) {
                break;
            }
            const char = this.currentChar();
            if (this.isLetter(char) || char === '_') {
                this.readIdentifierOrKeyword();
            }
            else if (this.isDigit(char)) {
                this.readNumber();
            }
            else if (char === '"' || char === "'") {
                this.readString();
            }
            else if (char === '/' && this.peekChar() === '/') {
                this.readSingleLineComment();
            }
            else if (char === '/' && this.peekChar() === '*') {
                this.readMultiLineComment();
            }
            else {
                this.readSymbol();
            }
        }
        this.addToken(TokenType.EOF, '');
        return this.tokens;
    }
    /**
     * Получение текущего символа
     * @returns текущий символ строки
     */
    currentChar() {
        return this.code[this.position];
    }
    /**
     * Просмотр следующего символа без перемещения позиции
     * @returns следующий символ или пустая строка
     */
    peekChar() {
        return this.position + 1 < this.code.length ? this.code[this.position + 1] : '';
    }
    /**
     * Перемещение на следующий символ
     */
    advance() {
        if (this.currentChar() === '\n') {
            this.line++;
            this.column = 1;
        }
        else {
            this.column++;
        }
        this.position++;
    }
    /**
     * Проверка является ли символ буквой
     * @param char - символ для проверки
     * @returns true если символ является буквой
     */
    isLetter(char) {
        return /[a-zA-Z]/.test(char);
    }
    /**
     * Проверка является ли символ цифрой
     * @param char - символ для проверки
     * @returns true если символ является цифрой
     */
    isDigit(char) {
        return /[0-9]/.test(char);
    }
    /**
     * Проверка является ли символ буквенно-цифровым или подчеркиванием
     * @param char - символ для проверки
     * @returns true если символ буквенно-цифровой или подчеркивание
     */
    isAlphaNumeric(char) {
        return this.isLetter(char) || this.isDigit(char) || char === '_';
    }
    /**
     * Пропуск пробельных символов
     */
    skipWhitespace() {
        while (this.position < this.code.length &&
            /\s/.test(this.currentChar()) &&
            this.currentChar() !== '\n') {
            this.advance();
        }
    }
    /**
     * Чтение идентификатора или ключевого слова
     */
    readIdentifierOrKeyword() {
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
    /**
     * Чтение числового литерала (включая отрицательные и с плавающей точкой)
     */
    readNumber() {
        let value = '';
        let hasDecimalPoint = false;
        // Проверяем знак минус для отрицательных чисел
        if (this.currentChar() === '-') {
            value += this.currentChar();
            this.advance();
        }
        while (this.position < this.code.length &&
            (this.isDigit(this.currentChar()) ||
                (this.currentChar() === '.' && !hasDecimalPoint))) {
            if (this.currentChar() === '.') {
                hasDecimalPoint = true;
            }
            value += this.currentChar();
            this.advance();
        }
        // Проверяем суффиксы типов (f для float, d для double)
        if (this.position < this.code.length) {
            const suffix = this.currentChar().toLowerCase();
            if (suffix === 'f') {
                value += this.currentChar();
                this.advance();
                this.addToken(TokenType.FLOAT, value);
                return;
            }
            else if (suffix === 'd') {
                value += this.currentChar();
                this.advance();
                this.addToken(TokenType.DOUBLE, value);
                return;
            }
        }
        // Определяем тип числа автоматически
        if (hasDecimalPoint) {
            this.addToken(TokenType.DOUBLE, value);
        }
        else {
            this.addToken(TokenType.NUMBER, value);
        }
    }
    /**
     * Чтение строкового литерала с поддержкой экранированных символов
     */
    readString() {
        const quote = this.currentChar();
        let value = quote;
        this.advance();
        while (this.position < this.code.length &&
            this.currentChar() !== quote) {
            // Обработка экранированных символов
            if (this.currentChar() === '\\' && this.position + 1 < this.code.length) {
                value += this.currentChar(); // добавляем \
                this.advance();
                // Добавляем экранированный символ
                if (this.position < this.code.length) {
                    value += this.currentChar();
                    this.advance();
                }
            }
            else {
                value += this.currentChar();
                this.advance();
            }
        }
        // Добавляем закрывающую кавычку если она есть
        if (this.position < this.code.length && this.currentChar() === quote) {
            value += this.currentChar();
            this.advance();
        }
        this.addToken(TokenType.STRING, value);
    }
    /**
     * Чтение однострочного комментария
     */
    readSingleLineComment() {
        let value = '';
        while (this.position < this.code.length &&
            this.currentChar() !== '\n') {
            value += this.currentChar();
            this.advance();
        }
        this.addToken(TokenType.COMMENT, value);
    }
    /**
     * Чтение многострочного комментария
     */
    readMultiLineComment() {
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
    /**
     * Чтение символов и операторов (включая составные операторы)
     */
    readSymbol() {
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
                if (this.peekChar() === '=') {
                    this.addToken(TokenType.LT_EQUALS, '<=');
                    this.advance();
                    this.advance();
                }
                else {
                    this.addToken(TokenType.LT, char);
                    this.advance();
                }
                break;
            case '>':
                if (this.peekChar() === '=') {
                    this.addToken(TokenType.GT_EQUALS, '>=');
                    this.advance();
                    this.advance();
                }
                else {
                    this.addToken(TokenType.GT, char);
                    this.advance();
                }
                break;
            case '=':
                if (this.peekChar() === '>') {
                    this.addToken(TokenType.ARROW, '=>');
                    this.advance();
                    this.advance();
                }
                else if (this.peekChar() === '=') {
                    this.addToken(TokenType.EQUALS, '==');
                    this.advance();
                    this.advance();
                }
                else {
                    this.addToken(TokenType.ASSIGN, char);
                    this.advance();
                }
                break;
            case '!':
                if (this.peekChar() === '=') {
                    this.addToken(TokenType.NOT_EQUALS, '!=');
                    this.advance();
                    this.advance();
                }
                else {
                    this.addToken(TokenType.UNKNOWN, char);
                    this.advance();
                }
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
            case '\n':
                this.addToken(TokenType.NEWLINE, char);
                this.advance();
                break;
            case '-':
                // Проверяем, не является ли это началом отрицательного числа
                if (this.isDigit(this.peekChar())) {
                    this.readNumber();
                }
                else {
                    this.addToken(TokenType.UNKNOWN, char);
                    this.advance();
                }
                break;
            default:
                this.addToken(TokenType.UNKNOWN, char);
                this.advance();
                break;
        }
    }
    /**
     * Добавление токена в список
     * @param type - тип токена
     * @param value - значение токена
     */
    addToken(type, value) {
        this.tokens.push({
            type,
            value,
            position: this.position,
            line: this.line,
            column: this.column
        });
    }
}
exports.DartLexer = DartLexer;
// ===== AST УЗЛЫ ДЛЯ ПАРСЕРА =====
/**
 * Базовый класс для всех AST узлов
 * @param type - тип узла
 */
class ASTNode {
    constructor(type) {
        this.type = type;
    }
}
exports.ASTNode = ASTNode;
/**
 * Узел класса
 * @param name - имя класса
 * @param extendsClass - родительский класс
 * @param body - тело класса
 */
class ClassNode extends ASTNode {
    constructor(name, extendsClass, body = []) {
        super('class');
        this.name = name;
        this.extendsClass = extendsClass;
        this.body = body;
    }
}
exports.ClassNode = ClassNode;
/**
 * Узел метода
 * @param name - имя метода
 * @param returnType - тип возврата
 * @param isAsync - асинхронный ли
 * @param parameters - параметры
 * @param body - тело метода
 */
class MethodNode extends ASTNode {
    constructor(name, returnType, isAsync = false, parameters = [], body = []) {
        super('method');
        this.name = name;
        this.returnType = returnType;
        this.isAsync = isAsync;
        this.parameters = parameters;
        this.body = body;
    }
}
exports.MethodNode = MethodNode;
/**
 * Узел события (для Bloc)
 * @param eventType - тип события
 * @param handler - обработчик
 */
class EventHandlerNode extends ASTNode {
    constructor(eventType, handler) {
        super('eventHandler');
        this.eventType = eventType;
        this.handler = handler;
    }
}
exports.EventHandlerNode = EventHandlerNode;
/**
 * Узел вызова метода emit
 * @param stateName - имя состояния
 * @param parameters - параметры
 */
class EmitNode extends ASTNode {
    constructor(stateName, parameters = []) {
        super('emit');
        this.stateName = stateName;
        this.parameters = parameters;
    }
}
exports.EmitNode = EmitNode;
/**
 * Узел условного блока (if/else)
 * @param condition - условие
 * @param thenBody - тело then
 * @param elseBody - тело else
 */
class ConditionalNode extends ASTNode {
    constructor(condition, thenBody = [], elseBody = []) {
        super('conditional');
        this.condition = condition;
        this.thenBody = thenBody;
        this.elseBody = elseBody;
    }
}
exports.ConditionalNode = ConditionalNode;
/**
 * Узел блока try-catch
 * @param tryBody - тело try
 * @param catchBody - тело catch
 * @param finallyBody - тело finally
 */
class TryCatchNode extends ASTNode {
    constructor(tryBody = [], catchBody = [], finallyBody = []) {
        super('tryCatch');
        this.tryBody = tryBody;
        this.catchBody = catchBody;
        this.finallyBody = finallyBody;
    }
}
exports.TryCatchNode = TryCatchNode;
/**
 * Узел зависимости (final поле)
 * @param name - имя переменной
 * @param type - тип зависимости
 */
class DependencyNode extends ASTNode {
    constructor(name, type) {
        super('dependency');
        this.name = name;
        this.type = type;
    }
}
exports.DependencyNode = DependencyNode;
// ===== ПАРСЕР DART КОДА =====
/**
 * Парсер для создания AST из токенов
 * @param tokens - массив токенов для парсинга
 */
class DartParser {
    constructor(tokens) {
        this.tokens = tokens;
        this.position = 0;
    }
    /**
     * Парсинг класса Cubit/Bloc
     * @returns узел класса или null
     */
    parseClass() {
        const classToken = this.findToken(TokenType.CLASS);
        if (!classToken)
            return null;
        const nameToken = this.peekToken(1);
        if (!nameToken || nameToken.type !== TokenType.IDENTIFIER)
            return null;
        const className = nameToken.value;
        let extendsClass;
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
    /**
     * Парсинг тела класса
     * @returns массив узлов AST
     */
    parseClassBody() {
        const body = [];
        // Ищем все методы, зависимости и обработчики событий
        body.push(...this.parseDependencies());
        body.push(...this.parseEventHandlers());
        body.push(...this.parseMethods());
        return body;
    }
    /**
     * Парсинг зависимостей (final поля)
     * @returns массив узлов зависимостей
     */
    parseDependencies() {
        const dependencies = [];
        for (let i = 0; i < this.tokens.length - 2; i++) {
            const token = this.tokens[i];
            if (token.type === TokenType.FINAL) {
                const typeToken = this.tokens[i + 1];
                const nameToken = this.tokens[i + 2];
                if (typeToken.type === TokenType.IDENTIFIER &&
                    nameToken.type === TokenType.IDENTIFIER &&
                    nameToken.value.startsWith('_')) {
                    dependencies.push(new DependencyNode(nameToken.value.substring(1), // Убираем _
                    typeToken.value));
                }
            }
        }
        return dependencies;
    }
    /**
     * Парсинг обработчиков событий (для Bloc)
     * @returns массив узлов обработчиков событий
     */
    parseEventHandlers() {
        const handlers = [];
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
                        handlers.push(new EventHandlerNode(eventTypeToken.value, handlerName));
                    }
                }
            }
        }
        return handlers;
    }
    /**
     * Парсинг методов класса
     * @returns массив узлов методов
     */
    parseMethods() {
        const methods = [];
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
                    methods.push(new MethodNode(methodName, returnType, isAsync, [], // параметры пока не парсим детально
                    methodBody));
                }
            }
        }
        return methods;
    }
    /**
     * Парсинг тела метода
     * @param methodName - имя метода
     * @returns массив узлов AST
     */
    parseMethodBody(methodName) {
        const body = [];
        // Ищем emit вызовы
        body.push(...this.parseEmitCalls());
        // Ищем условные блоки
        body.push(...this.parseConditionalBlocks());
        // Ищем try-catch блоки
        body.push(...this.parseTryCatchBlocks());
        return body;
    }
    /**
     * Парсинг вызовов emit
     * @returns массив узлов emit
     */
    parseEmitCalls() {
        const emits = [];
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
    /**
     * Парсинг условных блоков
     * @returns массив узлов условных блоков
     */
    parseConditionalBlocks() {
        const conditionals = [];
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
    /**
     * Парсинг try-catch блоков
     * @returns массив узлов try-catch
     */
    parseTryCatchBlocks() {
        const tryCatchBlocks = [];
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
    /**
     * Поиск токена по типу
     * @param type - тип токена для поиска
     * @returns найденный токен или null
     */
    findToken(type) {
        return this.tokens.find(token => token.type === type) || null;
    }
    /**
     * Поиск позиции токена
     * @param token - токен для поиска позиции
     * @returns позиция токена в массиве
     */
    findTokenPosition(token) {
        return this.tokens.indexOf(token);
    }
    /**
     * Просмотр токена со смещением
     * @param offset - смещение
     * @param startFrom - начальная позиция
     * @returns токен или null
     */
    peekToken(offset, startFrom = this.position) {
        const pos = startFrom + offset;
        return pos < this.tokens.length ? this.tokens[pos] : null;
    }
    /**
     * Проверка является ли метод асинхронным
     * @param position - позиция в массиве токенов
     * @returns true если метод асинхронный
     */
    checkAsyncMethod(position) {
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
    /**
     * Извлечение условия из if блока
     * @param position - позиция if токена
     * @returns строка условия
     */
    extractCondition(position) {
        let condition = '';
        let parenCount = 0;
        let started = false;
        for (let i = position + 1; i < this.tokens.length; i++) {
            const token = this.tokens[i];
            if (token.type === TokenType.LPAREN) {
                parenCount++;
                started = true;
            }
            else if (token.type === TokenType.RPAREN) {
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
    /**
     * Извлечение тела блока
     * @param position - позиция начального токена
     * @param blockType - тип блока
     * @returns массив узлов AST
     */
    extractBlockBody(position, blockType) {
        // Упрощенная реализация - возвращаем пустой массив
        // В полной реализации здесь был бы рекурсивный парсинг
        return [];
    }
    /**
     * Извлечение тела else блока
     * @param position - позиция if токена
     * @returns массив узлов AST
     */
    extractElseBody(position) {
        // Упрощенная реализация - возвращаем пустой массив
        return [];
    }
}
exports.DartParser = DartParser;
// ===== ЭКСПОРТИРУЕМЫЕ ФУНКЦИИ ДЛЯ АНАЛИЗА DART КОДА =====
/**
 * Парсинг класса через лексер
 * @param classCode - код класса для анализа
 * @returns объект с событиями, зависимостями и информацией о классе
 */
function parseClassWithLexer(classCode) {
    const lexer = new DartLexer(classCode);
    const tokens = lexer.tokenize();
    const parser = new DartParser(tokens);
    const classNode = parser.parseClass();
    if (!classNode) {
        return { events: [], dependencies: [], className: '', extendsClass: undefined };
    }
    const events = [];
    const dependencies = [];
    for (const node of classNode.body) {
        if (node instanceof EventHandlerNode) {
            events.push({ name: node.eventType, handler: node.handler });
        }
        else if (node instanceof DependencyNode) {
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
exports.parseClassWithLexer = parseClassWithLexer;
/**
 * Парсинг состояний через лексер
 * @param classCode - код с определениями состояний
 * @returns массив объектов состояний
 */
function parseStatesWithLexer(classCode) {
    const lexer = new DartLexer(classCode);
    const tokens = lexer.tokenize();
    const states = [];
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
exports.parseStatesWithLexer = parseStatesWithLexer;
/**
 * Парсинг методов через лексер
 * @param classCode - код класса
 * @param isBloc - является ли блоком
 * @returns массив объектов методов
 */
function parseMethodsWithLexer(classCode, isBloc) {
    const lexer = new DartLexer(classCode);
    const tokens = lexer.tokenize();
    const parser = new DartParser(tokens);
    const classNode = parser.parseClass();
    if (!classNode) {
        return [];
    }
    const methods = [];
    // Извлекаем методы из AST
    for (const node of classNode.body) {
        if (node instanceof MethodNode) {
            const emitCalls = [];
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
exports.parseMethodsWithLexer = parseMethodsWithLexer;
/**
 * Извлечение тела метода через лексер
 * @param classCode - код класса
 * @param methodName - имя метода
 * @returns тело метода в виде строки или null
 */
function extractMethodBodyWithLexer(classCode, methodName) {
    const lexer = new DartLexer(classCode);
    const tokens = lexer.tokenize();
    // Ищем начало метода
    for (let i = 0; i < tokens.length - 3; i++) {
        const token = tokens[i];
        if (token.type === TokenType.IDENTIFIER && token.value === methodName) {
            // Проверяем различные паттерны возвращаемых типов перед именем метода
            let hasValidReturnType = false;
            // Паттерн 1: void methodName 
            if (i > 0 && tokens[i - 1].type === TokenType.VOID) {
                hasValidReturnType = true;
            }
            // Паттерн 2: Future<void> methodName 
            else if (i > 3 &&
                tokens[i - 4].type === TokenType.FUTURE &&
                tokens[i - 3].type === TokenType.LT &&
                tokens[i - 2].type === TokenType.VOID &&
                tokens[i - 1].type === TokenType.GT) {
                hasValidReturnType = true;
            }
            // Паттерн 3: Future<SomeType> methodName
            else if (i > 3 &&
                tokens[i - 4].type === TokenType.FUTURE &&
                tokens[i - 3].type === TokenType.LT &&
                tokens[i - 2].type === TokenType.IDENTIFIER &&
                tokens[i - 1].type === TokenType.GT) {
                hasValidReturnType = true;
            }
            // Паттерн 4: String/int/bool methodName
            else if (i > 0 && (tokens[i - 1].value === 'String' ||
                tokens[i - 1].value === 'int' ||
                tokens[i - 1].value === 'bool')) {
                hasValidReturnType = true;
            }
            if (!hasValidReturnType) {
                continue;
            }
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
                        }
                        else if (bodyToken.type === TokenType.RBRACE) {
                            braceCount--;
                            if (braceCount === 0)
                                break;
                        }
                        body += bodyToken.value;
                        // Добавляем пробел после токена, кроме специальных случаев
                        if (bodyToken.type !== TokenType.DOT &&
                            bodyToken.type !== TokenType.LPAREN &&
                            bodyToken.type !== TokenType.LBRACE &&
                            bodyToken.type !== TokenType.LBRACKET &&
                            bodyToken.type !== TokenType.WHITESPACE) {
                            // Проверяем следующий токен
                            if (k + 1 < tokens.length) {
                                const nextToken = tokens[k + 1];
                                if (nextToken.type !== TokenType.DOT &&
                                    nextToken.type !== TokenType.RPAREN &&
                                    nextToken.type !== TokenType.RBRACE &&
                                    nextToken.type !== TokenType.RBRACKET &&
                                    nextToken.type !== TokenType.SEMICOLON &&
                                    nextToken.type !== TokenType.COMMA &&
                                    nextToken.type !== TokenType.WHITESPACE) {
                                    body += ' ';
                                }
                            }
                        }
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
exports.extractMethodBodyWithLexer = extractMethodBodyWithLexer;
/**
 * Парсинг всех методов через лексер (для блоков и кубитов)
 * @param classCode - код класса
 * @param includePrivate - включать ли приватные методы
 * @returns массив объектов методов с подробной информацией
 */
function parseAllMethodsWithLexer(classCode, includePrivate = false) {
    const lexer = new DartLexer(classCode);
    const tokens = lexer.tokenize();
    const methods = [];
    for (let i = 0; i < tokens.length - 3; i++) {
        const token = tokens[i];
        // Ищем различные паттерны методов
        let hasValidReturnType = false;
        let returnType = '';
        let methodStartIndex = -1;
        // Паттерн 1: void methodName
        if (token.type === TokenType.VOID &&
            tokens[i + 1].type === TokenType.IDENTIFIER) {
            hasValidReturnType = true;
            returnType = 'void';
            methodStartIndex = i + 1;
        }
        // Паттерн 2: Future<void> methodName
        else if (token.type === TokenType.FUTURE &&
            i + 4 < tokens.length &&
            tokens[i + 1].type === TokenType.LT &&
            tokens[i + 2].type === TokenType.VOID &&
            tokens[i + 3].type === TokenType.GT &&
            tokens[i + 4].type === TokenType.IDENTIFIER) {
            hasValidReturnType = true;
            returnType = 'Future<void>';
            methodStartIndex = i + 4;
        }
        // Паттерн 3: Future<SomeType> methodName
        else if (token.type === TokenType.FUTURE &&
            i + 4 < tokens.length &&
            tokens[i + 1].type === TokenType.LT &&
            tokens[i + 2].type === TokenType.IDENTIFIER &&
            tokens[i + 3].type === TokenType.GT &&
            tokens[i + 4].type === TokenType.IDENTIFIER) {
            hasValidReturnType = true;
            returnType = `Future<${tokens[i + 2].value}>`;
            methodStartIndex = i + 4;
        }
        // Паттерн 4: String/int/bool methodName
        else if ((token.value === 'String' ||
            token.value === 'int' ||
            token.value === 'bool') &&
            tokens[i + 1].type === TokenType.IDENTIFIER) {
            hasValidReturnType = true;
            returnType = token.value;
            methodStartIndex = i + 1;
        }
        if (!hasValidReturnType || methodStartIndex === -1) {
            continue;
        }
        const methodName = tokens[methodStartIndex].value;
        const isPrivate = methodName.startsWith('_');
        // Фильтруем методы
        if (methodName === 'super' ||
            methodName.includes('Cubit') ||
            methodName.includes('Bloc')) {
            continue;
        }
        // Пропускаем приватные методы если не нужны
        if (isPrivate && !includePrivate) {
            continue;
        }
        // Ищем параметры и тело метода
        let paramStartIndex = -1;
        let isAsync = false;
        let isArrowFunction = false;
        let bodyStartIndex = -1;
        // Находим открывающую скобку параметров
        for (let j = methodStartIndex + 1; j < tokens.length; j++) {
            if (tokens[j].type === TokenType.LPAREN) {
                paramStartIndex = j;
                break;
            }
        }
        if (paramStartIndex === -1)
            continue;
        // Ищем закрывающую скобку параметров и дальше
        let paramEndIndex = -1;
        let parenCount = 1;
        for (let j = paramStartIndex + 1; j < tokens.length; j++) {
            if (tokens[j].type === TokenType.LPAREN) {
                parenCount++;
            }
            else if (tokens[j].type === TokenType.RPAREN) {
                parenCount--;
                if (parenCount === 0) {
                    paramEndIndex = j;
                    break;
                }
            }
        }
        if (paramEndIndex === -1)
            continue;
        // Проверяем async и стрелочную функцию
        for (let j = paramEndIndex + 1; j < Math.min(paramEndIndex + 5, tokens.length); j++) {
            if (tokens[j].type === TokenType.ASYNC) {
                isAsync = true;
            }
            else if (tokens[j].type === TokenType.ARROW) {
                isArrowFunction = true;
                bodyStartIndex = j + 1;
                break;
            }
            else if (tokens[j].type === TokenType.LBRACE) {
                bodyStartIndex = j;
                break;
            }
        }
        if (bodyStartIndex === -1)
            continue;
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
        }
        else {
            // Для обычных методов - до закрывающей скобки
            let braceCount = 1;
            for (let j = bodyStartIndex + 1; j < tokens.length && braceCount > 0; j++) {
                if (tokens[j].type === TokenType.LBRACE) {
                    braceCount++;
                }
                else if (tokens[j].type === TokenType.RBRACE) {
                    braceCount--;
                    if (braceCount === 0)
                        break;
                }
                body += tokens[j].value;
                // Добавляем пробел после токена, кроме специальных случаев
                if (tokens[j].type !== TokenType.DOT &&
                    tokens[j].type !== TokenType.LPAREN &&
                    tokens[j].type !== TokenType.LBRACE &&
                    tokens[j].type !== TokenType.LBRACKET &&
                    tokens[j].type !== TokenType.WHITESPACE) {
                    // Проверяем следующий токен
                    if (j + 1 < tokens.length) {
                        const nextToken = tokens[j + 1];
                        if (nextToken.type !== TokenType.DOT &&
                            nextToken.type !== TokenType.RPAREN &&
                            nextToken.type !== TokenType.RBRACE &&
                            nextToken.type !== TokenType.RBRACKET &&
                            nextToken.type !== TokenType.SEMICOLON &&
                            nextToken.type !== TokenType.COMMA &&
                            nextToken.type !== TokenType.WHITESPACE) {
                            body += ' ';
                        }
                    }
                }
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
            body: body.trim(),
            isPrivate: isPrivate
        });
    }
    return methods;
}
exports.parseAllMethodsWithLexer = parseAllMethodsWithLexer;
/**
 * Для обратной совместимости
 * @param classCode - код класса
 * @returns массив объектов методов кубита
 */
function parseCubitMethodsWithLexer(classCode) {
    return parseAllMethodsWithLexer(classCode, false).map(method => ({
        name: method.name,
        returnType: method.returnType,
        isAsync: method.isAsync,
        isArrowFunction: method.isArrowFunction,
        body: method.body
    }));
}
exports.parseCubitMethodsWithLexer = parseCubitMethodsWithLexer;
/**
 * Парсинг импортов через лексер
 * @param classCode - код файла для анализа импортов
 * @returns массив объектов импортов
 */
function parseImportsWithLexer(classCode) {
    const lexer = new DartLexer(classCode);
    const tokens = lexer.tokenize();
    const imports = [];
    for (let i = 0; i < tokens.length - 1; i++) {
        const token = tokens[i];
        // Ищем токен import
        if (token.type === TokenType.IMPORT) {
            // Следующий токен должен быть строкой с путем
            const pathToken = tokens[i + 1];
            if (pathToken.type === TokenType.STRING) {
                // Убираем кавычки из пути
                const path = pathToken.value.slice(1, -1);
                const isPackageImport = path.startsWith('package:');
                const isRelativeImport = path.startsWith('./') || path.startsWith('../');
                // Извлекаем имя файла из пути
                const pathParts = path.split('/');
                const fileName = pathParts[pathParts.length - 1];
                // Проверяем, содержит ли путь слово entity/entities
                const containsEntity = path.toLowerCase().includes('entit');
                imports.push({
                    path,
                    isPackageImport,
                    isRelativeImport,
                    fileName,
                    containsEntity
                });
            }
        }
    }
    return imports;
}
exports.parseImportsWithLexer = parseImportsWithLexer;
/**
 * Отладочная функция для тестирования парсинга импортов
 * @param classCode - код для тестирования
 * @returns детальная информация о токенах
 */
function debugParseImports(classCode) {
    const lexer = new DartLexer(classCode);
    const tokens = lexer.tokenize();
    const importTokens = tokens.filter(t => t.type === TokenType.IMPORT).length;
    const stringTokens = tokens.filter(t => t.type === TokenType.STRING).length;
    const allTokens = tokens.map(t => ({ type: t.type, value: t.value }));
    const imports = parseImportsWithLexer(classCode);
    return {
        totalTokens: tokens.length,
        importTokens,
        stringTokens,
        allTokens: allTokens.slice(0, 20),
        imports
    };
}
exports.debugParseImports = debugParseImports;
//# sourceMappingURL=dartLexer.js.map