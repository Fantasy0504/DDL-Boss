# 素材来源与生成记录

界面主参考：`reference/user-reference.png`（用户提供）。辅助完整界面概念：`reference/concept.png`。所有像素素材均通过本次内置 Image Gen 工具生成，无外部图片下载或第三方角色素材。

## 角色图集

文件：`public/assets/characters.png`，透明 PNG，2×2 等分网格。

按从左到右、从上到下顺序为深渊骑士、森林史莱姆、骷髅法师、巫师猫。使用 CSS `background-size: 200% 200%` 和定位独立显示，不把 UI 文字烘焙进素材。第二轮调整角色缩放和留白，修复披风越界裁切。

最终提示词摘要：

> Transparent 2×2 production pixel-art atlas. Preserve original dark armored crimson-horn knight with greatsword and cape; emerald slime; ivory skeleton wizard with navy robe and staff; black-and-white cat with dark wizard hat and orange band. Keep each complete character within its own equal quadrant, generous transparent margins, no cross-cell pixels, no text, no UI, no backdrop. Charcoal, cream, crimson, moss green and muted gold palette. Crisp stepped pixel art.

## 场景背景

文件：`public/assets/stage.png`。

提示词摘要：

> Sparse low-contrast warm-grey pixel-art ruined courtyard. Tattered banner at far left, broken pillars at far right, light stone floor and small rubble below. Empty center for a separate character. Warm #F5F3EF backdrop, restrained and airy, no characters or UI.

## 界面概念

提示词摘要：

> Full Chinese Windows productivity app main screen, warm off-white four-column DDL Boss layout, left navigation, task cards, center original pixel-art abyss knight with speech bubble and HP, right progress and checklist. Charcoal action buttons, muted red/green, thin borders, readable Chinese UI. Task completion is the only attack action. All controls and text code-native.

最终实现以用户参考图及 PRD 为优先。概念图中的红色导航/按钮未采用，日期根据当前时间生成。应用图标是项目内 SVG 剑图标转换的 PNG，普通控件图标来自 Lucide React。
