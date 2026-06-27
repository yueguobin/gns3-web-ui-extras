# GNS3 Management Proxy — Browser Extension

让用户浏览器通过 GNS3 server 的 **3090 CONNECT 代理** 访问拓扑内设备的 Web 管理界面（如 CSR1000v、pfSense 的 WebUI）。装一次扩展，浏览器自动对管理网段流量走代理，不配系统代理、不影响正常上网。

## 工作方式

```
用户浏览器
  │ chrome.proxy PAC: isInNet(管理网段) → PROXY gns3host:3090
  │ chrome.webRequest.onAuthRequired: 注入 admin 凭据
  ▼
gns3server 3090 CONNECT 代理
  → 校验用户名密码（复用 GNS3 login API）
  → 透传 TCP 到设备
```

## 技术选型

- **平台**: Chrome / Chromium（Manifest V3）
- **后端**: 无后端，纯前端扩展
- **后续可适配**: Firefox（`browser.proxy.settings` API 类似）

## 安装

### 开发者模式加载

1. 打开 `chrome://extensions/`
2. 开启右上角「开发者模式」
3. 点击「加载已解压的扩展」
4. 选择本目录

### 打包发布

```
cd extension/
zip -r ../gns3-proxy.zip . -x 'generate-icons.sh'
```

然后上传到 Chrome Web Store 开发者控制台。

## 配置

| 字段 | 默认值 | 说明 |
|---|---|---|
| GNS3 Server 地址 | `127.0.0.1` | gns3server 的主机名或 IP |
| 代理端口 | `3090` | CONNECT 代理端口 |
| 管理网段 | `172.16.40.0/23` | 触发代理的 IP 段，只这个段走代理 |
| 用户名 | `admin` | GNS3 login 用户名 |
| 密码 | （空） | GNS3 login 密码 |
| 启用代理 | off | 一键开关 |

## 测试

1. 确认 gns3server 的 3090 代理已启动
2. 在扩展配置页配好 Server 地址、管理网段、用户名密码
3. 开启代理
4. 在浏览器中打开设备页面（如 `https://172.16.40.2/`）
5. 页面正常加载即为成功
6. 访问管理网段外的地址（如 `example.com`）应直连，不走代理

## 项目结构

```
extension/
├── manifest.json      # 扩展清单 (MV3)
├── background.js      # 后台 Service Worker — PAC 代理 + 认证
├── popup.html / .js   # 工具栏弹出面板
├── options.html / .js # 配置页
├── styles.css         # 暗色主题 (GNS3 风格)
├── icons/icon.svg     # 扩展图标
└── generate-icons.sh  # PNG 图标生成脚本
```
