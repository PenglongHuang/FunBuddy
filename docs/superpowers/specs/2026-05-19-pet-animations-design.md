# 新增宠物悬停动画设计

## 目标

在 FunBuddy 桌面宠物中新增 5 种悬停动画，丰富宠物的交互表现力。保持现有触发方式（鼠标悬停随机播放）和架构不变，仅通过新增 Motion variant 配置实现。

## 范围

- 新增 5 种悬停动画：翻滚、压缩弹回、跳跃、摇晃、跳舞
- 动画全部使用纯 Motion (Framer Motion) 变体，通过 SVG transform（rotate、scaleX、scaleY、y、x）实现
- 不涉及新的 SVG 覆盖层或表情变化

## 新增动画参数

### 1. 翻滚 (tumble)

```
rotate: [0, 360]
scaleY: [1, 0.85, 1]
transition: { duration: 0.9, ease: "easeInOut" }
```

模拟前翻效果，scaleY 变化营造翻转透视感。

### 2. 压缩弹回 (squish)

```
scaleY: [1, 0.6, 1.15, 0.95, 1]
scaleX: [1, 1.2, 0.9, 1.05, 1]
y: [0, 10, -5, 2, 0]
transition: { duration: 1.0, ease: "easeInOut" }
```

果冻弹性效果，先压扁再弹回，Y 轴同步下移模拟着地。

### 3. 跳跃 (jump)

```
y: [0, -30, 0]
rotate: [0, -5, 5, 0]
scaleY: [1, 0.9, 1.05, 1]
transition: { duration: 0.7, ease: "easeOut" }
```

快速向上跳起再落下，起跳时压缩、空中时拉伸。

### 4. 摇晃 (shake)

```
x: [0, -8, 8, -6, 6, -3, 3, 0]
rotate: [0, -3, 3, -2, 2, -1, 1, 0]
transition: { duration: 0.6, ease: "easeInOut" }
```

快速左右抖动，X 位移配合微旋转，节奏快。

### 5. 跳舞 (dance)

```
rotate: [0, 10, -10, 8, -8, 0]
y: [0, -8, 0, -8, 0]
scaleX: [1, 0.95, 1.05, 0.95, 1]
transition: { duration: 1.4, ease: "easeInOut" }
```

左右摇摆加两步跳，节奏感强的舞蹈动作。

## 代码改动

### 文件 1: `src/renderer/src/types/pet.ts`

在 `HoverAnimation` 类型（或联合类型）中新增 5 个值：

```
| 'tumble' | 'squish' | 'jump' | 'shake' | 'dance'
```

### 文件 2: `src/renderer/src/components/pet/hoverAnimations.ts`

新增 5 个 motion variant 对象，导出后加入现有的 `hoverAnimations` 数组。每个动画包含 `initial` 和 `animate` 状态，结构与现有动画（spin、stretch、bounce 等）一致。

### 无需改动的文件

- `PetAvatar.tsx` — 已通过循环 `hoverAnimations` 数组随机选择动画，新增项自动生效
- `PetModeView.tsx` — 不涉及
- `petStore.ts` — 不涉及
- `usePetDrag.ts` — 悬停检测逻辑不涉及

## 约束

- 动画时长控制在 0.5s-1.5s，与现有动画节奏一致
- 不引入新的依赖库
- 不修改现有的动画选择逻辑（随机 + 不重复上次）
