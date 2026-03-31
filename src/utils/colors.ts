/**
 * 全局色彩计算函数：实现从灰绿到水绿的平滑 RGB 线性插值
 * 起始色: #6c7c6f (RGB: 108, 124, 111)
 * 终点色: #82e3be (RGB: 130, 227, 190)
 */

const START_COLOR = { r: 108, g: 124, b: 111 }; // #6c7c6f
const END_COLOR = { r: 130, g: 227, b: 190 }; // #82e3be

/**
 * 根据 0-100 的湿度值计算精准的 RGB 颜色字符串
 * @param value 0-100 的湿度值
 * @returns "rgb(r, g, b)" 格式的颜色字符串
 */
export function getGranularColorFromHumidity(value: number): string {
  // 将 value 限制在 0-100 范围
  const normalized = Math.max(0, Math.min(100, value)) / 100;

  // RGB 线性插值
  const r = Math.round(
    START_COLOR.r + (END_COLOR.r - START_COLOR.r) * normalized,
  );
  const g = Math.round(
    START_COLOR.g + (END_COLOR.g - START_COLOR.g) * normalized,
  );
  const b = Math.round(
    START_COLOR.b + (END_COLOR.b - START_COLOR.b) * normalized,
  );

  return `rgb(${r}, ${g}, ${b})`;
}
