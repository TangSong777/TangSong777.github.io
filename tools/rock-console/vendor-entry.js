// esbuild 入口：把 xterm.js 与其样式打包成本地资源，
// 避免公网页面引用任何 CDN（CSP 为 default-src 'self'）。
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

window.RockConsoleXterm = { Terminal, FitAddon };
