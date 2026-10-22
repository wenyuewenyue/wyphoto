# WyPhoto 小白P图

免费在线 P 图工具，部署在 Cloudflare Pages（静态站，无构建、无后端、无密钥）。

功能（全部在浏览器本地处理，图片不上传，不调任何云端 AI API、零额度）：
- AI 抠图：@imgly/background-removal 本地 ONNX 模型，首次下载约 40MB 后缓存
- 换背景（透明/白/蓝/红/自选色/图片背景）、一寸/二寸证件照
- 消除笔：本地 AI 模型 MI-GAN（ONNX/WASM，模型 MIT 许可，首次下载约 28MB 后缓存到 IndexedDB；独立编写的适配代码，未复制 GPL 的 inpaint-web 代码），失败时兜底 OpenCV.js inpaint（TELEA）
- 一键美化、滤镜预设、亮度/对比/饱和微调
- 按比例裁剪（1:1、3:4、4:3、16:9、9:16）、旋转、翻转、改尺寸
- 加文字、加水印、马赛克打码
- 导出 PNG/JPG/WebP，可调画质、显示体积

部署：Cloudflare Pages 项目 `wyphoto`，框架 None、无构建命令、输出目录 `/`，自定义域名 wyphoto.2221314.xyz。
