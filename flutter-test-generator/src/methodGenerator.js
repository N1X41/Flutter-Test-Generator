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
exports.generateTest = void 0;
const vscode = __importStar(require("vscode"));
const util_1 = require("util");
async function generateTest(workspaceRoot, testDir, methodName, methodCode) {
    const testUri = vscode.Uri.joinPath(workspaceRoot, testDir, 'unit_test', `${methodName}_test.dart`);
    const dirUri = vscode.Uri.joinPath(workspaceRoot, testDir, 'unit_test');
    await vscode.workspace.fs.createDirectory(dirUri);
    const content = new util_1.TextEncoder().encode(methodCode);
    await vscode.workspace.fs.writeFile(testUri, content);
    vscode.window.showInformationMessage(`Тестовый файл создан: ${testUri.fsPath}`);
}
exports.generateTest = generateTest;
//# sourceMappingURL=methodGenerator.js.map