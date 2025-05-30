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
exports.deactivate = exports.activate = void 0;
const vscode = require("vscode");
const path = require("path");
const fs = require("fs");
const yaml = require("js-yaml");
const methodGenerator_1 = require("./methodGenerator");
const dtoGenerator_1 = require("./dtoGenerator");
const cubitGenerator_1 = require("./cubitGenerator");
let packageName = null;
function findSymbolAtPosition(symbols, position) {
    for (const symbol of symbols) {
        if (symbol.range.contains(position)) {
            if (symbol.children) {
                const childSymbol = findSymbolAtPosition(symbol.children, position);
                if (childSymbol) {
                    return childSymbol;
                }
            }
            return symbol;
        }
    }
    return null;
}
function extractFeatureName(filePath) {
    const parts = filePath.split(path.sep);
    const featuresIndex = parts.indexOf('features');
    if (featuresIndex !== -1 && featuresIndex + 1 < parts.length) {
        const featureName = parts[featuresIndex + 1];
        return featureName;
    }
    return null;
}
function activate(context) {
    var _a, _b;
    console.log('Flutter Test Generator: расширение активировано!');
    const workspaceRoot = (_b = (_a = vscode.workspace.workspaceFolders) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.uri.fsPath;
    if (workspaceRoot) {
        const pubspecPath = path.join(workspaceRoot, 'pubspec.yaml');
        try {
            const pubspecContent = fs.readFileSync(pubspecPath, 'utf8');
            const pubspec = yaml.load(pubspecContent);
            packageName = pubspec.name || null;
            if (packageName) {
                console.log(`Flutter Test Generator: имя пакета - ${packageName}`);
            }
        }
        catch (error) {
            console.error('Flutter Test Generator: ошибка при чтении pubspec.yaml:', error);
            vscode.window.showErrorMessage('Не удалось прочитать pubspec.yaml.');
        }
    }
    const disposable = vscode.commands.registerCommand('flutterTestGenerator.generateTest', () => __awaiter(this, void 0, void 0, function* () {
        var _c, _d, _e, _f;
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document.languageId !== 'dart') {
            vscode.window.showErrorMessage('Команда доступна только для Dart-файлов.');
            return;
        }
        const position = editor.selection.active;
        const document = editor.document;
        const symbols = yield vscode.commands.executeCommand('vscode.executeDocumentSymbolProvider', document.uri);
        if (!symbols) {
            vscode.window.showErrorMessage('Символы не найдены в документе.');
            return;
        }
        const symbol = findSymbolAtPosition(symbols, position);
        if (!symbol) {
            vscode.window.showErrorMessage('Символ не найден в позиции курсора.');
            return;
        }
        if (symbol.kind === vscode.SymbolKind.Method) {
            const methodName = symbol.name;
            const methodCode = document.getText(symbol.range);
            const testDir = vscode.workspace.getConfiguration('flutterTestGenerator').get('testDir', 'test');
            const workspaceRoot = (_d = (_c = vscode.workspace.workspaceFolders) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.uri;
            if (!workspaceRoot || !packageName) {
                vscode.window.showErrorMessage('Рабочая область или имя пакета не найдены.');
                return;
            }
            yield (0, methodGenerator_1.generateTest)(workspaceRoot, testDir, methodName, methodCode, packageName);
        }
        else if (symbol.kind === vscode.SymbolKind.Class) {
            const className = symbol.name;
            const classCode = document.getText(symbol.range);
            const filePath = document.uri.fsPath;
            const featureName = extractFeatureName(filePath);
            if (!featureName) {
                vscode.window.showErrorMessage('Не удалось определить название фичи.');
                return;
            }
            const testDir = vscode.workspace.getConfiguration('flutterTestGenerator').get('testDir', 'test');
            const workspaceRoot = (_f = (_e = vscode.workspace.workspaceFolders) === null || _e === void 0 ? void 0 : _e[0]) === null || _f === void 0 ? void 0 : _f.uri;
            if (!workspaceRoot || !packageName) {
                vscode.window.showErrorMessage('Рабочая область или имя пакета не найдены.');
                return;
            }
            if (filePath.toLowerCase().includes('dto')) {
                yield (0, dtoGenerator_1.generateTest)(workspaceRoot, testDir, featureName, className, classCode, packageName);
            }
            else if (filePath.toLowerCase().includes('cubit') || filePath.toLowerCase().includes('bloc')) {
                yield (0, cubitGenerator_1.generateTest)(workspaceRoot, testDir, featureName, className, classCode, packageName);
            }
            else {
                vscode.window.showErrorMessage('Выбранный класс не является DTO или Cubit/Bloc.');
            }
        }
        else {
            vscode.window.showErrorMessage('Выбранный символ не является методом или классом.');
        }
    }));
    context.subscriptions.push(disposable);
    context.subscriptions.push(vscode.languages.registerCodeActionsProvider('dart', {
        provideCodeActions(document, range) {
            return vscode.commands.executeCommand('vscode.executeDocumentSymbolProvider', document.uri).then(symbols => {
                if (!symbols)
                    return [];
                const symbol = findSymbolAtPosition(symbols, range.start);
                if (!symbol || (symbol.kind !== vscode.SymbolKind.Method && symbol.kind !== vscode.SymbolKind.Class))
                    return [];
                const action = new vscode.CodeAction('Flutter: Generate Test', vscode.CodeActionKind.Refactor);
                action.command = {
                    command: 'flutterTestGenerator.generateTest',
                    title: 'Generate Test',
                    tooltip: 'Generate a unit test for the selected method, DTO, or Cubit/Bloc'
                };
                return [action];
            });
        }
    }, { providedCodeActionKinds: [vscode.CodeActionKind.Refactor] }));
}
exports.activate = activate;
function deactivate() {
    console.log('Flutter Test Generator: расширение деактивировано.');
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map