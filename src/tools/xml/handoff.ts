import { ref } from 'vue'

/** 其它工具（如 JSON 工具）投递给 XML 工具的待处理文本；XML 工具取走后清空 */
export const pendingXmlInput = ref<string | null>(null)

export function sendToXmlTool(text: string) {
  pendingXmlInput.value = text
}
