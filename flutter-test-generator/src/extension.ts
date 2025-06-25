import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { generateTest as generateMethodTest } from './methodGenerator';
import { generateTest as generateDtoTest } from './dtoGenerator';
import { generateTest as generateCubitTest } from './cubitGeneratorNew';
import { extractFeatureName } from './utils';

let packageName: string | null = null;

/**
 * Находит символ в указанной позиции в дереве символов документа
 * @param symbols - массив символов документа
 * @param position - позиция для поиска
 * @returns найденный символ или null
 */
function findSymbolAtPosition(symbols: vscode.DocumentSymbol[], position: vscode.Position): vscode.DocumentSymbol | null {
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

/**
 * Активирует расширение Flutter Test Generator
 * Регистрирует команды и провайдеры для генерации тестов
 * @param context - контекст расширения VS Code
 */
export function activate(context: vscode.ExtensionContext) {
    console.log('Flutter Test Generator: расширение активировано!');

    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (workspaceRoot) {
        const pubspecPath = path.join(workspaceRoot, 'pubspec.yaml');
        try {
            const pubspecContent = fs.readFileSync(pubspecPath, 'utf8');
            const pubspec = yaml.load(pubspecContent) as { name?: string };
            packageName = pubspec.name || null;
            if (packageName) {
                console.log(`Flutter Test Generator: имя пакета - ${packageName}`);
            }
        } catch (error) {
            console.error('Flutter Test Generator: ошибка при чтении pubspec.yaml:', error);
            vscode.window.showErrorMessage('Не удалось прочитать pubspec.yaml.');
        }
    }

    const disposable = vscode.commands.registerCommand('flutterTestGenerator.generateTest', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document.languageId !== 'dart') {
            vscode.window.showErrorMessage('Команда доступна только для Dart-файлов.');
            return;
        }
        const position = editor.selection.active;
        const document = editor.document;

        const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>('vscode.executeDocumentSymbolProvider', document.uri);
        if (!symbols) {
            vscode.window.showErrorMessage('Символы не найдены в документе.');
            return;
        }
        const symbol = findSymbolAtPosition(symbols, position);
        if (!symbol) {
            vscode.window.showErrorMessage('Символ не найден в позиции курсора.');
            return;
        }

        const testDir = vscode.workspace.getConfiguration('flutterTestGenerator').get('testDir', 'test');
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
        if (!workspaceRoot || !packageName) {
            vscode.window.showErrorMessage('Рабочая область или имя пакета не найдены.');
            return;
        }

        if (symbol.kind === vscode.SymbolKind.Method || symbol.kind === vscode.SymbolKind.Function) {
            const methodName = symbol.name;
            const methodCode = document.getText(symbol.range);
            await generateMethodTest(workspaceRoot, testDir, methodName, methodCode, packageName);
        } else if (symbol.kind === vscode.SymbolKind.Class) {
            const className = symbol.name;
            const classCode = document.getText(symbol.range);
            const filePath = document.uri.fsPath;
            const featureName = extractFeatureName(filePath);
            if (!featureName) {
                vscode.window.showErrorMessage('Не удалось определить название фичи.');
                return;
            }
            if (filePath.toLowerCase().includes('dto')) {
                await generateDtoTest(workspaceRoot, testDir, featureName, className, classCode, packageName);
            } else if (filePath.toLowerCase().includes('cubit') || filePath.toLowerCase().includes('bloc')) {
                await generateCubitTest(workspaceRoot, testDir, featureName, className, classCode, packageName);
            } else {
                vscode.window.showErrorMessage('Выбранный класс не является DTO или Cubit/Bloc.');
            }
        } else {
            vscode.window.showErrorMessage('Выбранный символ не является методом, функцией или классом.');
        }
    });
    context.subscriptions.push(disposable);

    context.subscriptions.push(
        vscode.languages.registerCodeActionsProvider('dart', {
            provideCodeActions(document, range) {
                return vscode.commands.executeCommand<vscode.DocumentSymbol[]>('vscode.executeDocumentSymbolProvider', document.uri).then(symbols => {
                    if (!symbols) return [];
                    const symbol = findSymbolAtPosition(symbols, range.start);
                    if (!symbol || (symbol.kind !== vscode.SymbolKind.Method && symbol.kind !== vscode.SymbolKind.Function && symbol.kind !== vscode.SymbolKind.Class)) return [];
                    const action = new vscode.CodeAction('Flutter: Generate Test', vscode.CodeActionKind.Refactor);
                    action.command = {
                        command: 'flutterTestGenerator.generateTest',
                        title: 'Generate Test',
                        tooltip: 'Generate a unit test for the selected method, function, DTO, or Cubit/Bloc'
                    };
                    return [action];
                });
            }
        }, { providedCodeActionKinds: [vscode.CodeActionKind.Refactor] })
    );
}

/**
 * Деактивирует расширение Flutter Test Generator
 * Выполняет очистку ресурсов при отключении расширения
 */
export function deactivate() {
    console.log('Flutter Test Generator: расширение деактивировано.');
}