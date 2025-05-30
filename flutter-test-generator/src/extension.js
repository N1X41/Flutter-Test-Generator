"use strict";
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
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode = __importStar(require("vscode"));
const methodGenerator_js_1 = require("./methodGenerator.js");
const dtoGenerator_js_1 = require("./dtoGenerator.js");
const cubitGenerator_js_1 = require("./cubitGenerator.js");
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
    const parts = filePath.split('/');
    const featuresIndex = parts.indexOf('features');
    if (featuresIndex !== -1 && featuresIndex + 1 < parts.length) {
        return parts[featuresIndex + 1];
    }
    return null;
}
function activate(context) {
    const disposable = vscode.commands.registerCommand('flutterTestGenerator.generateTest', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('Нет активного редактора.');
            return;
        }
        const position = editor.selection.active;
        const document = editor.document;
        const symbols = await vscode.commands.executeCommand('vscode.executeDocumentSymbolProvider', document.uri);
        const symbol = findSymbolAtPosition(symbols, position);
        if (!symbol) {
            vscode.window.showErrorMessage('Символ не найден в позиции курсора.');
            return;
        }
        if (symbol.kind === vscode.SymbolKind.Method) {
            const methodName = symbol.name;
            const methodCode = document.getText(symbol.range);
            const testDir = vscode.workspace.getConfiguration('flutterTestGenerator').get('testDir', 'test');
            const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
            if (!workspaceRoot) {
                vscode.window.showErrorMessage('Рабочая область не найдена.');
                return;
            }
            await (0, methodGenerator_js_1.generateTest)(workspaceRoot, testDir, methodName, methodCode);
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
            const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
            if (!workspaceRoot) {
                vscode.window.showErrorMessage('Рабочая область не найдена.');
                return;
            }
            if (filePath.includes('/dto/')) {
                await (0, dtoGenerator_js_1.generateTest)(workspaceRoot, testDir, featureName, className, classCode);
            }
            else if (filePath.includes('/cubit/')) {
                await (0, cubitGenerator_js_1.generateTest)(workspaceRoot, testDir, featureName, className, classCode);
            }
            else {
                vscode.window.showErrorMessage('Выбранный класс не является DTO или Cubit.');
            }
        }
        else {
            vscode.window.showErrorMessage('Выбранный символ не является методом или классом.');
        }
    });
    context.subscriptions.push(disposable);
}
exports.activate = activate;
function deactivate() { }
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map