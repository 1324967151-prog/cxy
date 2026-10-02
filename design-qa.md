# 设计 QA

## 参考与布局

- 参考主界面：`../design/selected/immersive-v5.png`。
- 参考人物位置：`../design/references/single-enemy-grounded-preview.png`。
- 参考地图：`../design/references/user-three-map-atlas.png`。
- 1280×720 与 1487×1058 浏览器视口均检查过：主画面、顶部 HUD、底部配置区和训练按钮没有重叠；主画面保持统一的 16:9 地图裁切。
- B 区市场和 B 点掩体的左侧目标均从指定掩体后向右拉出，透明边界不会把人物抬离地面。

## 行为检查

- `node --test tests/*.test.mjs`：25 项通过。
- 实际浏览器操作已验证：资源加载、设置弹窗、开始倒计时、实际命中得分、空枪结算、漏敌结算、ESC 暂停与继续、三地图/三枪/四难度/三种时长切换。
- 单敌人约束由引擎状态和渲染属性共同覆盖：活跃目标未清除前不会生成下一个目标。
- 头部判定使用角色目录中的稳定命中框；被掩体遮挡的透明像素不能命中。
- 低高度 GIF 进出场帧被过滤，避免只露腿的帧改变人物高度或被误判为爆头。

## 交付截图

- `qa/desktop-full.png`：默认桌面布局。
- `qa/b-market-final.png`：B 区市场地面与橙墙遮挡复核。
- `qa/b-cover-final.png`：B 点掩体地面与蓝墙遮挡复核。
