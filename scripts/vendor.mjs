/**
 * AgentBrowser - 依赖安装脚本
 * 将 node_modules 中的 echarts 复制到 src/vendor，供渲染进程使用
 */
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const vendorDir = path.join(root, 'src', 'vendor');

fs.mkdirSync(vendorDir, { recursive: true });

const require = createRequire(import.meta.url);

function copyPkg(pkgName, file, destName) {
  try {
    const src = require.resolve(`${pkgName}/${file}`);
    const dest = path.join(vendorDir, destName);
    fs.copyFileSync(src, dest);
    console.log(`✓ ${pkgName}/${file} -> src/vendor/${destName}`);
  } catch (e) {
    console.warn(`✗ 未找到 ${pkgName}/${file}: ${e.message}`);
  }
}

// ECharts 完整版（含所有图表类型）
copyPkg('echarts', 'dist/echarts.min.js', 'echarts.min.js');

console.log('vendor 依赖准备完成');
