# HOLD / 无畏契约架枪训练

一个本地运行的 VALORANT 架枪训练原型，按用户提供的三个地图视角组织训练：C 拐角、B 区市场、B 点掩体。目标从指定掩体后横向拉出，脚底贴合地图地面；同一时间最多出现一个目标，命中后才会进入下一次出敌。

## 已实现

- 正义、幻影、狂徒三种枪械选择。
- 简单、标准、困难、噩梦四档难度，难度越高出敌间隔越短、命中窗口越小。
- 30 / 60 / 120 秒训练时长。
- 鼠标移动瞄准、左键射击、ESC 暂停；支持准星、灵敏度、声音和指针锁定设置。
- 头部 200 分、身体 100 分；命中、爆头、空枪和漏敌都有反馈。
- 成绩按地图、枪械、难度、时长分别保存，并在本地存储不可用时保持页面生命周期内的最高分。
- 训练场背景取自批准的三图图集，敌人使用 OKIAIMX 的原始角色 GIF，并按每帧可见脚底定位。

## 本地运行

```powershell
cd D:\chatgpt\瓦射击\trainer
pnpm install
node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4173 --strictPort
```

打开 <http://127.0.0.1:4173/> 即可开始训练。构建和测试：

```powershell
pnpm run build
pnpm test
pnpm run test:sites
```

## 素材来源

- 原始敌人动画与参数：`design/references/okiaimx-enemies/`、`design/references/okiaimx-enemies.json`。
- 地图图集与持枪素材：`public/assets/maps.png`、`public/assets/weapons/*`。
- 敌人动画与目录：`public/assets/enemies/`、`public/assets/enemy-catalog.json`。
- 枪械选择图标与 HOLD 标记已随项目打包，运行时不依赖远程字体或脚本。
